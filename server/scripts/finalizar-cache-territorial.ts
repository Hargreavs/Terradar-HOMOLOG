import { supabase } from '../supabase'

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

async function main() {
  const startedAt = Date.now()
  const cacheInicial = await contarCache()
  const alvo = await contarAlvo()
  console.log(`[INICIO] cache=${cacheInicial} / alvo=${alvo} (faltam ${alvo - cacheInicial})`)

  let totalInserido = 0
  let iteracao = 0
  let chunkSize = 2000
  let zerosConsecutivos = 0

  while (true) {
    iteracao++
    const t0 = Date.now()

    const { data, error } = await supabase.rpc(
      'fn_populate_cache_territorial_chunk',
      { p_limit: chunkSize }
    )

    const dt = ((Date.now() - t0) / 1000).toFixed(1)

    if (error) {
      console.log(`[${iteracao}] ERRO chunk=${chunkSize} dt=${dt}s msg=${error.message}`)
      if (chunkSize > 200) {
        chunkSize = Math.max(200, Math.floor(chunkSize / 2))
        console.log(`  -> baixando chunk para ${chunkSize}`)
        await new Promise(r => setTimeout(r, 3000))
        continue
      } else {
        console.log('  chunk minimo e ainda da erro, abortando')
        break
      }
    }

    const inseridos = (data as number) ?? 0
    totalInserido += inseridos
    console.log(`[${iteracao}] chunk=${chunkSize} inseridos=${inseridos} acumulado=${totalInserido} dt=${dt}s`)

    if (inseridos === 0) {
      zerosConsecutivos++
      const cacheAtual = await contarCache()
      console.log(`  zeros=${zerosConsecutivos} cache_atual=${cacheAtual} / ${alvo}`)
      if (cacheAtual >= alvo - 5) {
        console.log('[OK] cache completo (diferenca <=5 aceitavel)')
        break
      }
      if (zerosConsecutivos >= 3 && chunkSize <= 300) {
        console.log('[FIM] 3 zeros seguidos com chunk minimo, parando')
        break
      }
      if (chunkSize > 300) {
        chunkSize = Math.max(300, Math.floor(chunkSize / 2))
        console.log(`  -> reduzindo chunk para ${chunkSize} para atravessar faixa pesada`)
      }
      continue
    }

    zerosConsecutivos = 0

    // Se veio cheio, subir chunk de volta rumo a 2000
    if (inseridos === chunkSize && chunkSize < 2000) {
      chunkSize = Math.min(2000, chunkSize * 2)
      console.log(`  -> subindo chunk para ${chunkSize}`)
    }
  }

  const cacheFinal = await contarCache()
  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1)
  console.log(`[FIM] cache_final=${cacheFinal} / alvo=${alvo} total_inserido=${totalInserido} elapsed=${elapsedMin}min`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
