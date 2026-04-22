import pLimit from 'p-limit'
import { supabase } from '../supabase'

const CONCURRENCY = 10
const MAX_ITERACOES_SEM_PROGRESSO = 3

async function contarCache(): Promise<number> {
  const { count, error } = await supabase
    .from('cache_territorial')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function contarAlvo(): Promise<number> {
  const { count, error } = await supabase
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .not('geom', 'is', null)
  if (error) throw error
  return count ?? 0
}

async function chamarRPC(): Promise<{ ok: boolean; inseridos: number; erro?: string; dt: number }> {
  const t0 = Date.now()
  try {
    const { data, error } = await supabase.rpc(
      'fn_populate_cache_territorial_chunk',
      { p_limit: 1 }
    )
    const dt = Date.now() - t0
    if (error) return { ok: false, inseridos: 0, erro: error.message || 'erro sem mensagem', dt }
    return { ok: true, inseridos: (data as number) ?? 0, dt }
  } catch (e: any) {
    return { ok: false, inseridos: 0, erro: e?.message ?? String(e), dt: Date.now() - t0 }
  }
}

async function main() {
  const startedAt = Date.now()
  const cacheInicial = await contarCache()
  const alvo = await contarAlvo()
  console.log(`[INICIO] cache=${cacheInicial} / alvo=${alvo} (faltam ${alvo - cacheInicial})`)
  console.log(`[CONFIG] concurrency=${CONCURRENCY} chunk=1`)

  const limit = pLimit(CONCURRENCY)
  let totalInserido = 0
  let totalErros = 0
  let totalChamadas = 0
  let rodada = 0
  let iteracoesSemProgresso = 0
  const errosPorTipo = new Map<string, number>()

  while (true) {
    rodada++
    const cacheAntes = await contarCache()
    const faltam = alvo - cacheAntes

    if (faltam <= 5) {
      console.log(`[OK] cache completo (${cacheAntes}/${alvo}, diferenca=${alvo - cacheAntes})`)
      break
    }

    // Disparar min(faltam, 200) chamadas em paralelo (200 = bloco de trabalho por rodada)
    const chamadasDesseBloco = Math.min(faltam, 200)
    const promessas = Array.from({ length: chamadasDesseBloco }, () =>
      limit(() => chamarRPC())
    )

    const resultados = await Promise.all(promessas)
    totalChamadas += resultados.length

    let inseridosRodada = 0
    let errosRodada = 0
    let tempoMedio = 0

    for (const r of resultados) {
      tempoMedio += r.dt
      if (r.ok) {
        inseridosRodada += r.inseridos
      } else {
        errosRodada++
        const chave = (r.erro ?? 'desconhecido').slice(0, 60)
        errosPorTipo.set(chave, (errosPorTipo.get(chave) ?? 0) + 1)
      }
    }
    tempoMedio = Math.round(tempoMedio / resultados.length)
    totalInserido += inseridosRodada
    totalErros += errosRodada

    const cacheDepois = await contarCache()
    const progresso = cacheDepois - cacheAntes

    const pct = ((cacheDepois / alvo) * 100).toFixed(2)
    const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1)

    console.log(
      `[R${rodada}] bloco=${chamadasDesseBloco} inseridos=${inseridosRodada} erros=${errosRodada} ` +
      `progresso=${progresso} cache=${cacheDepois}/${alvo} (${pct}%) dtMedio=${tempoMedio}ms ` +
      `acumulado=${totalInserido} elapsed=${elapsedMin}min`
    )

    if (progresso === 0) {
      iteracoesSemProgresso++
      console.log(`  [ALERTA] iteracoes sem progresso: ${iteracoesSemProgresso}/${MAX_ITERACOES_SEM_PROGRESSO}`)
      if (iteracoesSemProgresso >= MAX_ITERACOES_SEM_PROGRESSO) {
        console.log(`  [STOP] ${MAX_ITERACOES_SEM_PROGRESSO} rodadas sem progresso, abortando`)
        break
      }
      // Pequeno backoff antes de tentar de novo
      await new Promise(r => setTimeout(r, 5000))
    } else {
      iteracoesSemProgresso = 0
    }
  }

  const cacheFinal = await contarCache()
  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1)
  console.log(`\n[FIM] cache=${cacheFinal}/${alvo} inseridos_total=${totalInserido} ` +
    `erros_total=${totalErros}/${totalChamadas} elapsed=${elapsedMin}min`)

  if (errosPorTipo.size > 0) {
    console.log(`\n[ERROS_POR_TIPO]`)
    const sorted = Array.from(errosPorTipo.entries()).sort((a, b) => b[1] - a[1])
    for (const [msg, count] of sorted.slice(0, 10)) {
      console.log(`  ${count}x: ${msg}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
