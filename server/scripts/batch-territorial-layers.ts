import { config as dotenvConfig } from 'dotenv'
import { Pool } from 'pg'

dotenvConfig({ path: '.env.local' })

const dbUrl =
  process.env.DATABASE_URL_BATCH ??
  process.env.DATABASE_URL ??
  process.env.VITE_DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL_BATCH ou DATABASE_URL é obrigatório')
  process.exit(1)
}

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback
  const n = Number(process.argv[idx + 1])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const LIMIT = getArg('limit', Number.MAX_SAFE_INTEGER)
const CONCURRENCY = getArg('concurrency', 8)
const CHUNK_SIZE = getArg('chunk', 100)

console.log(`[territorial-layers] Configuração:`)
console.log(`  Concorrência (workers): ${CONCURRENCY}`)
console.log(`  Chunk size (por chamada SQL): ${CHUNK_SIZE}`)
console.log(
  `  Limite total: ${LIMIT === Number.MAX_SAFE_INTEGER ? 'sem limite' : LIMIT}`,
)
console.log()

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: CONCURRENCY + 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
})

pool.on('error', (err) => console.error('[pool] erro:', err.message))

let totalProcessados = 0
let totalRestantes = 0
let workersAtivos = 0
let workersFinalizados = 0
const tStart = Date.now()
const lastProgress = { totalProcessados: 0, ts: Date.now() }
let stopRequested = false

async function worker(id: number): Promise<void> {
  workersAtivos++
  console.log(`[worker-${id}] iniciado`)

  while (!stopRequested && totalProcessados < LIMIT) {
    try {
      const { rows } = await pool.query<{
        processados: number
        restantes: number
      }>('SELECT * FROM public.fn_build_territorial_layers_chunk($1)', [
        CHUNK_SIZE,
      ])
      const r = rows[0]!
      if (r.processados === 0) {
        console.log(`[worker-${id}] sem mais pendentes, finalizando`)
        break
      }
      totalProcessados += r.processados
      totalRestantes = r.restantes
    } catch (err) {
      console.error(
        `[worker-${id}] erro:`,
        err instanceof Error ? err.message : String(err),
      )
      await new Promise((res) => setTimeout(res, 1000))
    }
  }

  workersAtivos--
  workersFinalizados++
  console.log(`[worker-${id}] finalizado (${workersFinalizados}/${CONCURRENCY})`)
}

const reportInterval = setInterval(() => {
  const elapsed = (Date.now() - tStart) / 1000
  const ratEnd = (Date.now() - lastProgress.ts) / 1000
  const incremento = totalProcessados - lastProgress.totalProcessados
  const taxaInstant = ratEnd > 0 ? incremento / ratEnd : 0
  const taxaMedia = elapsed > 0 ? totalProcessados / elapsed : 0
  const eta = taxaMedia > 0 ? Math.round(totalRestantes / taxaMedia) : 0
  const etaH = Math.floor(eta / 3600)
  const etaM = Math.floor((eta % 3600) / 60)

  console.log(
    `[progresso] ${totalProcessados.toLocaleString('pt-BR')} processados | ` +
      `restantes ${totalRestantes.toLocaleString('pt-BR')} | ` +
      `taxa instant ${taxaInstant.toFixed(1)}/s | ` +
      `taxa média ${taxaMedia.toFixed(1)}/s | ` +
      `workers ativos ${workersAtivos} | ` +
      `ETA ${etaH}h${etaM}m`,
  )

  lastProgress.totalProcessados = totalProcessados
  lastProgress.ts = Date.now()
}, 10_000)

async function rodar() {
  const { rows: stats } = await pool.query<{
    total: number
    com_layers: number
    pendentes: number
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE p.ativo_derivado = true AND p.geom IS NOT NULL)::int AS total,
      COUNT(*) FILTER (WHERE p.ativo_derivado = true AND p.geom IS NOT NULL AND EXISTS (
        SELECT 1 FROM territorial_layers tl WHERE tl.processo_id = p.id
      ))::int AS com_layers,
      COUNT(*) FILTER (WHERE p.ativo_derivado = true AND p.geom IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM territorial_layers tl WHERE tl.processo_id = p.id
      ))::int AS pendentes
    FROM processos p
  `)
  const s = stats[0]!
  console.log(`[territorial-layers] Estado inicial:`)
  console.log(`  Total ativos com geom: ${s.total.toLocaleString('pt-BR')}`)
  console.log(`  Já com layers:         ${s.com_layers.toLocaleString('pt-BR')}`)
  console.log(`  Pendentes:             ${s.pendentes.toLocaleString('pt-BR')}`)
  totalRestantes = s.pendentes
  console.log()

  if (s.pendentes === 0) {
    console.log('[territorial-layers] Nada a processar.')
    clearInterval(reportInterval)
    await pool.end()
    return
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)

  clearInterval(reportInterval)

  const elapsed = (Date.now() - tStart) / 1000
  console.log()
  console.log(`[territorial-layers] ╔════════════════════════════════════╗`)
  console.log(`[territorial-layers] ║          BATCH FINALIZADO          ║`)
  console.log(`[territorial-layers] ╚════════════════════════════════════╝`)
  console.log(`  Total processados: ${totalProcessados.toLocaleString('pt-BR')}`)
  console.log(`  Tempo total:       ${(elapsed / 60).toFixed(1)} min`)
  console.log(
    `  Taxa média:        ${(totalProcessados / elapsed).toFixed(1)} processos/s`,
  )

  await pool.end()
}

let interrompendo = false
process.on('SIGINT', () => {
  if (interrompendo) {
    console.log('\n[territorial-layers] Forçando saída.')
    process.exit(1)
  }
  interrompendo = true
  stopRequested = true
  console.log(
    '\n[territorial-layers] Interrupção recebida. Workers finalizam o chunk atual e param.',
  )
})

rodar()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[territorial-layers] Erro fatal:', err)
    process.exit(1)
  })
