/**
 * worker-score-stale.ts — Worker S31 incremental.
 *
 * Função: consumir a fila `scores.is_stale=true` (Query A) + processos novos
 * sem score (Query B), recalcular via motor S31 v5, persistir em `scores`.
 *
 * O trigger `trg_scores_clear_stale_on_recalc` limpa is_stale=false
 * automaticamente após cada UPDATE em scores (pelo motor).
 *
 * Padrão de uso:
 *   - Disparado pós-pipeline (DOU/SCM/ANM/CFEM) via último step do GitLab CI
 *   - Cron horário como paraquedas (pega o que push perdeu)
 *
 * Idempotente: pode rodar várias vezes em paralelo. FOR UPDATE SKIP LOCKED
 * garante que múltiplos workers dividem trabalho automaticamente sem
 * processar o mesmo processo duas vezes.
 *
 * Uso:
 *   npx tsx server/scripts/worker-score-stale.ts
 *   npx tsx server/scripts/worker-score-stale.ts --dry-run
 *   npx tsx server/scripts/worker-score-stale.ts --uf BA
 *   npx tsx server/scripts/worker-score-stale.ts --max-duration 30
 *   npx tsx server/scripts/worker-score-stale.ts --max-processed 5000
 *
 * Flags:
 *   --dry-run            Conta a fila e simula. Não chama motor nem grava.
 *   --uf XX              Processa só processos da UF (emergência).
 *   --max-duration N     Timeout em minutos. Default 60. Encerra após N min.
 *   --max-processed N    Limite de processos nesta execução. Default ilimitado.
 *   --chunk N            Tamanho do chunk (default 50). Subir só se motor estiver folgado.
 *   --cobre-novos BOOL   Processa Query B (novos sem score). Default true.
 *
 * Conforme DED-005 §7 (Worker S31) e DED-004 §7.
 */
import 'dotenv/config'
import {
  runS31MotorAndPersist,
  buildS31ExtrasTahMapsOnly,
  getSqlBatch,
  type S31MassCaches,
  type LayerExtrasRow,
  type TahStatusRow,
} from '../scoringMotorS31'
import { parseCliArgs } from './utils/cli-args'

// ──────────────────────────────────────────────────────────────────────
// Configuração
// ──────────────────────────────────────────────────────────────────────

const SCORES_FONTE = 's31_v5_20260503'
const DEFAULT_CHUNK = 50
const DEFAULT_MAX_DURATION_MIN = 60
const PRELOAD_THRESHOLD = 5000 // > N stale → vale pré-carregar extras+TAH

// ──────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ──────────────────────────────────────────────────────────────────────

type QueueItem = { processo_id: string; origem: 'stale' | 'novo' }

type RunStats = {
  processados: number
  erros: number
  ja_stale_acabaram: number
  novos_processados: number
  inicio: Date
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h${String(m).padStart(2, '0')}m${String(sec).padStart(2, '0')}s`
}

function fmtBRT(d: Date): string {
  return d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
  })
}

function log(msg: string) {
  console.log(`[${fmtBRT(new Date())}] [worker-score-stale] ${msg}`)
}

// ──────────────────────────────────────────────────────────────────────
// Sinal handlers (encerramento gracioso)
// ──────────────────────────────────────────────────────────────────────

let gracefulStopRequested = false

process.on('SIGTERM', () => {
  log('SIGTERM recebido — vai encerrar após chunk atual.')
  gracefulStopRequested = true
})
process.on('SIGINT', () => {
  log('SIGINT recebido — vai encerrar após chunk atual.')
  gracefulStopRequested = true
})

// ──────────────────────────────────────────────────────────────────────
// Queries de seleção de fila
// ──────────────────────────────────────────────────────────────────────

async function contaStaleEnovos(
  sql: ReturnType<typeof getSqlBatch>,
  uf?: string,
): Promise<{ stale: number; novos: number }> {
  const ufFilter = uf ? sql`AND p.uf = ${uf}` : sql``

  const [staleRow, novosRow] = await Promise.all([
    sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM scores s
      JOIN processos p ON p.id = s.processo_id
      WHERE s.is_stale = true
        AND p.ativo_derivado = true
        ${ufFilter}
    `,
    sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM processos p
      WHERE p.ativo_derivado = true
        AND p.geom IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM scores s WHERE s.processo_id = p.id)
        ${ufFilter}
    `,
  ])

  return {
    stale: staleRow[0]?.n ?? 0,
    novos: novosRow[0]?.n ?? 0,
  }
}

/**
 * Pega chunk de items pra processar.
 * Combina Query A (stale) + Query B (novos) na mesma chamada.
 * Usa FOR UPDATE SKIP LOCKED → seguro pra paralelismo entre workers.
 */
async function pegarChunk(
  sql: ReturnType<typeof getSqlBatch>,
  chunkSize: number,
  cobreNovos: boolean,
  uf?: string,
): Promise<QueueItem[]> {
  const ufFilter = uf ? sql`AND p.uf = ${uf}` : sql``

  // Query A: stale conhecidos (existem em scores com is_stale=true)
  const stale = await sql<{ processo_id: string }[]>`
    SELECT s.processo_id::text AS processo_id
    FROM scores s
    JOIN processos p ON p.id = s.processo_id
    WHERE s.is_stale = true
      AND p.ativo_derivado = true
      ${ufFilter}
    ORDER BY s.stale_em ASC NULLS LAST
    LIMIT ${chunkSize}
    FOR UPDATE OF s SKIP LOCKED
  `

  const items: QueueItem[] = stale.map((r) => ({
    processo_id: r.processo_id,
    origem: 'stale' as const,
  }))

  // Query B: novos sem score — só se ainda há espaço no chunk
  if (cobreNovos && items.length < chunkSize) {
    const restante = chunkSize - items.length
    const novos = await sql<{ processo_id: string }[]>`
      SELECT p.id::text AS processo_id
      FROM processos p
      WHERE p.ativo_derivado = true
        AND p.geom IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM scores s WHERE s.processo_id = p.id)
        ${ufFilter}
      ORDER BY p.created_at ASC NULLS LAST
      LIMIT ${restante}
      FOR UPDATE OF p SKIP LOCKED
    `
    for (const r of novos) {
      items.push({
        processo_id: r.processo_id,
        origem: 'novo' as const,
      })
    }
  }

  return items
}

// ──────────────────────────────────────────────────────────────────────
// Processamento de chunk
// ──────────────────────────────────────────────────────────────────────

async function processarChunk(
  sql: ReturnType<typeof getSqlBatch>,
  items: QueueItem[],
  massCaches: S31MassCaches | undefined,
  stats: RunStats,
): Promise<void> {
  for (const item of items) {
    if (gracefulStopRequested) {
      log('Stop solicitado — abortando chunk corrente.')
      break
    }

    try {
      await runS31MotorAndPersist(item.processo_id, {
        persist: true,
        massCaches,
        scoresFonte: SCORES_FONTE,
        sqlClient: sql,
      })
      stats.processados++
      if (item.origem === 'novo') stats.novos_processados++
    } catch (err) {
      stats.erros++
      console.error(
        `[worker-score-stale] Erro processo ${item.processo_id} (${item.origem}):`,
        err instanceof Error ? err.message : err,
      )
      // Não marca limpo — fica stale, próxima execução tenta de novo.
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Main loop
// ──────────────────────────────────────────────────────────────────────

async function main() {
  const { flags } = parseCliArgs(process.argv.slice(2))

  const dryRun = flags['dry-run'] === true
  const uf =
    typeof flags.uf === 'string' && flags.uf.trim()
      ? flags.uf.trim().toUpperCase()
      : undefined
  const maxDurationMin =
    typeof flags['max-duration'] === 'string' &&
    flags['max-duration'].trim()
      ? Math.max(1, parseInt(flags['max-duration'].trim(), 10))
      : DEFAULT_MAX_DURATION_MIN
  const maxProcessed =
    typeof flags['max-processed'] === 'string' &&
    flags['max-processed'].trim()
      ? Math.max(1, parseInt(flags['max-processed'].trim(), 10))
      : null
  const chunkSize =
    typeof flags.chunk === 'string' && flags.chunk.trim()
      ? Math.max(1, Math.min(500, parseInt(flags.chunk.trim(), 10)))
      : DEFAULT_CHUNK
  const cobreNovos = flags['cobre-novos'] !== false // default true

  const sql = getSqlBatch()

  log('═══════════════════════════════════════════════════════════')
  log(`Worker S31 incremental — fonte=${SCORES_FONTE}`)
  log('═══════════════════════════════════════════════════════════')
  log(`Modo:           ${dryRun ? 'DRY-RUN' : 'EXECUÇÃO REAL'}`)
  log(`Chunk size:     ${chunkSize}`)
  log(`Max duration:   ${maxDurationMin} minutos`)
  log(`Max processed:  ${maxProcessed ?? 'ilimitado'}`)
  log(`Filtro UF:      ${uf ?? '(todas)'}`)
  log(`Cobre novos:    ${cobreNovos ? 'SIM' : 'NAO'}`)

  // 1) Snapshot inicial da fila
  const filaInicial = await contaStaleEnovos(sql, uf)
  const totalAlvo = filaInicial.stale + (cobreNovos ? filaInicial.novos : 0)

  log('───────────────────────────────────────────────────────────')
  log(`Fila inicial:`)
  log(`  Stale (Query A):    ${filaInicial.stale.toLocaleString('pt-BR')}`)
  log(`  Novos sem score (Query B): ${filaInicial.novos.toLocaleString('pt-BR')}`)
  log(`  Total alvo:         ${totalAlvo.toLocaleString('pt-BR')}`)

  if (totalAlvo === 0) {
    log('Fila vazia — nada a fazer. Encerrando.')
    await sql.end()
    return
  }

  if (dryRun) {
    log('───────────────────────────────────────────────────────────')
    log('[DRY-RUN] Simulação completa. Nenhuma escrita feita.')
    log(`[DRY-RUN] Em execução real, processaria ${totalAlvo.toLocaleString('pt-BR')} processos.`)
    if (totalAlvo > PRELOAD_THRESHOLD) {
      log(`[DRY-RUN] Pré-carregaria extras+TAH em memória (>${PRELOAD_THRESHOLD} stale).`)
    } else {
      log(`[DRY-RUN] Faria queries individuais por processo (<= ${PRELOAD_THRESHOLD} stale).`)
    }
    await sql.end()
    return
  }

  // 2) Decisão preload de extras+TAH
  let massCaches: S31MassCaches | undefined
  if (totalAlvo > PRELOAD_THRESHOLD) {
    log('───────────────────────────────────────────────────────────')
    log(`Volume alto (>${PRELOAD_THRESHOLD}): pré-carregando extras+TAH em memória...`)
    const t0 = Date.now()
    const { extrasByProcessoId, tahByProcessoNumero } =
      await buildS31ExtrasTahMapsOnly(sql)
    log(
      `Preload completo em ${fmtMs(Date.now() - t0)} | extras=${extrasByProcessoId.size.toLocaleString('pt-BR')} | tah=${tahByProcessoNumero.size.toLocaleString('pt-BR')}`,
    )
    // S31MassCaches espera todos os campos populados; só extras+tah importam aqui
    massCaches = {
      configByAba: {},
      subByUpper: new Map(),
      cptByUf: new Map(),
      incentivoB7ByUf: new Map(),
      linhasBndes: [],
      extrasByProcessoId,
      tahByProcessoNumero,
    }
  } else {
    log(
      `Volume baixo (<= ${PRELOAD_THRESHOLD}): queries individuais por processo (sem preload).`,
    )
  }

  // 3) Loop principal
  log('───────────────────────────────────────────────────────────')
  log('Iniciando processamento incremental...')
  log('───────────────────────────────────────────────────────────')

  const stats: RunStats = {
    processados: 0,
    erros: 0,
    ja_stale_acabaram: 0,
    novos_processados: 0,
    inicio: new Date(),
  }

  const deadline = stats.inicio.getTime() + maxDurationMin * 60 * 1000
  let chunksProcessados = 0
  let ultimoLog = Date.now()

  while (true) {
    // Stop conditions
    if (gracefulStopRequested) {
      log('Encerramento solicitado — saindo do loop.')
      break
    }
    if (Date.now() > deadline) {
      log(`Max duration ${maxDurationMin}min atingido — encerrando.`)
      break
    }
    if (maxProcessed !== null && stats.processados >= maxProcessed) {
      log(`Max processed ${maxProcessed} atingido — encerrando.`)
      break
    }

    // Pegar próximo chunk
    let chunk: QueueItem[]
    try {
      chunk = await sql.begin(async (tx) => {
        return await pegarChunk(tx, chunkSize, cobreNovos, uf)
      })
    } catch (err) {
      console.error(
        '[worker-score-stale] Erro ao pegar chunk — aguardando 5s:',
        err instanceof Error ? err.message : err,
      )
      await new Promise((r) => setTimeout(r, 5000))
      continue
    }

    if (chunk.length === 0) {
      log('Fila vazia — encerrando loop principal.')
      break
    }

    // Processar
    await processarChunk(sql, chunk, massCaches, stats)
    chunksProcessados++

    // Heartbeat a cada 30s
    if (Date.now() - ultimoLog > 30_000) {
      const elapsedMs = Date.now() - stats.inicio.getTime()
      const thr = stats.processados / (elapsedMs / 1000)
      const filaAtual = await contaStaleEnovos(sql, uf)
      const restante = filaAtual.stale + (cobreNovos ? filaAtual.novos : 0)
      log(
        `Progresso: processados=${stats.processados} | erros=${stats.erros} | thr=${thr.toFixed(1)}/s | restante=${restante.toLocaleString('pt-BR')}`,
      )
      ultimoLog = Date.now()
    }
  }

  // 4) Snapshot final
  const elapsedMs = Date.now() - stats.inicio.getTime()
  const filaFinal = await contaStaleEnovos(sql, uf)

  log('───────────────────────────────────────────────────────────')
  log('Encerrado.')
  log(`  Processados:        ${stats.processados.toLocaleString('pt-BR')}`)
  log(`  Erros:              ${stats.erros.toLocaleString('pt-BR')}`)
  log(`  Novos processados:  ${stats.novos_processados.toLocaleString('pt-BR')}`)
  log(`  Chunks:             ${chunksProcessados}`)
  log(`  Tempo total:        ${fmtMs(elapsedMs)}`)
  log(
    `  Throughput médio:   ${(stats.processados / Math.max(elapsedMs / 1000, 1)).toFixed(1)} processos/s`,
  )
  log(`  Fila restante:`)
  log(`    Stale:            ${filaFinal.stale.toLocaleString('pt-BR')}`)
  log(`    Novos sem score:  ${filaFinal.novos.toLocaleString('pt-BR')}`)
  log('═══════════════════════════════════════════════════════════')

  await sql.end()

  // Exit code 0 se tudo OK; 1 se houve erros (CI captura)
  if (stats.erros > 0) {
    console.error(`[worker-score-stale] FINAL: ${stats.erros} erros — verifique logs.`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[worker-score-stale] Erro fatal:', e)
  process.exit(1)
})
