/**
 * Popula cache_territorial: keyset em processos (rapido) + batch check em cache + fn_territorial_analysis por faltante.
 */
import { supabase } from '../supabase'

const LOTE_PROCESSOS = 40
const LOG_CADA = 200

async function main() {
  const startTime = Date.now()
  let totalInseridos = 0
  let lastNumero = ''

  console.log('[populate-cache] iniciando materializacao cache_territorial...')

  while (true) {
    const { data: rows, error: e1 } = await supabase
      .from('processos')
      .select('numero')
      .not('geom', 'is', null)
      .not('substancia', 'is', null)
      .not('municipio_ibge', 'is', null)
      .gt('numero', lastNumero)
      .order('numero', { ascending: true })
      .limit(LOTE_PROCESSOS)

    if (e1) {
      console.error('[populate-cache] Erro listagem processos:', e1.message)
      process.exit(1)
    }
    if (!rows?.length) break

    const numeros = rows.map((r) => String(r.numero))
    lastNumero = numeros[numeros.length - 1]

    const { data: jaCache, error: e2 } = await supabase
      .from('cache_territorial')
      .select('numero')
      .in('numero', numeros)

    if (e2) {
      console.error('[populate-cache] Erro leitura cache:', e2.message)
      process.exit(1)
    }
    const temCache = new Set((jaCache ?? []).map((r) => String(r.numero)))

    for (const numero of numeros) {
      if (temCache.has(numero)) continue

      const { data: territorial, error: e3 } = await supabase.rpc('fn_territorial_analysis', {
        p_numero: numero,
      })
      if (e3) {
        console.error(`[populate-cache] Erro fn_territorial_analysis ${numero}:`, e3.message)
        process.exit(1)
      }

      const { error: e4 } = await supabase.from('cache_territorial').upsert(
        {
          numero,
          territorial,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'numero' },
      )
      if (e4) {
        console.error(`[populate-cache] Erro upsert ${numero}:`, e4.message)
        process.exit(1)
      }

      totalInseridos++
      if (totalInseridos % LOG_CADA === 0) {
        const elapsedSec = (Date.now() - startTime) / 1000
        const rate = totalInseridos / elapsedSec
        console.log(
          `[populate-cache] ${totalInseridos} novos | ${rate.toFixed(1)} proc/s | ${Math.round(elapsedSec)}s`,
        )
      }
    }

    if (rows.length < LOTE_PROCESSOS) break
  }

  const totalSec = (Date.now() - startTime) / 1000
  console.log(
    `[populate-cache][FIM] ${totalInseridos} linhas inseridas em ${Math.round(totalSec)}s (${(totalSec / 60).toFixed(1)} min)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
