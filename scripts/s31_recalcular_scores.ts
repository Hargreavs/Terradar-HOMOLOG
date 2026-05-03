import 'dotenv/config'
import { Pool } from 'pg'
import { computeScoresAuto } from '../server/db'
import type { S31MassCaches, SubData, LayerExtrasRow, TahStatusRow } from '../server/scoringMotorS31'

const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 12,
  idleTimeoutMillis: 30_000,
})

async function buildMassCaches(): Promise<S31MassCaches> {
  const t0 = Date.now()
  const [cfgR, subR, cptR, incR, bndR, extrasR, tahR] = await Promise.all([
    pool.query<{ aba: string; dados: unknown }>(`SELECT aba, dados FROM config_scores`),
    pool.query<Record<string, unknown>>(
      `SELECT substancia_anm, gap_pp, preco_brl, preco_usd, tendencia, val_reserva_brl_ha, mineral_critico_2025
       FROM master_substancias`,
    ),
    pool.query<{ uf: string; mult: string | null }>(`
      SELECT u.uf, public.fn_cpt_multiplicador_uf(u.uf)::text AS mult
      FROM (SELECT DISTINCT uf::text AS uf FROM processos WHERE uf IS NOT NULL) u
    `),
    pool.query<{ uf: string; b7: string | null }>(`
      SELECT uf::text AS uf, COALESCE(score_b7, (score_incentivo)::float8) AS b7
      FROM incentivos_uf
    `),
    pool.query<{ minerais_elegiveis: string | null; linha: string | null }>(
      `SELECT minerais_elegiveis, linha FROM linhas_bndes`,
    ),
    pool.query<Record<string, unknown>>(`
      SELECT processo_id::text AS pid,
        sitio_id, sitio_nome, sitio_distancia_km, sitio_tipo, sitio_natureza, sitio_sobreposicao_pct,
        assent_id, assent_nome, assent_distancia_km, assent_sobreposicao_pct
      FROM processos_territorial_extras
    `),
    pool.query<{
      processo_numero: string
      pct_pago: string | null
      qtd_pagamentos: string | number
      qtd_nao_pagos: string | number
    }>(`
      SELECT processo_numero,
        ROUND(100.0 * SUM(COALESCE(valor_pago, 0)) / NULLIF(SUM(COALESCE(valor_total, 0)), 0), 2) AS pct_pago,
        COUNT(*)::int AS qtd_pagamentos,
        COUNT(*) FILTER (WHERE COALESCE(valor_pago, 0) = 0 OR valor_pago IS NULL)::int AS qtd_nao_pagos
      FROM tah_pagamentos
      GROUP BY processo_numero
      HAVING SUM(COALESCE(valor_total, 0)) > 0
    `),
  ])
  const configByAba: Record<string, unknown> = {}
  for (const r of cfgR.rows) {
    configByAba[r.aba] = r.dados
  }
  const subByUpper = new Map<string, SubData>()
  for (const r of subR.rows) {
    const k = String(r.substancia_anm ?? '')
      .trim()
      .toUpperCase()
    if (!k) continue
    subByUpper.set(k, {
      gap_pp: (r.gap_pp as number | null) ?? null,
      preco_brl: (r.preco_brl as number | null) ?? null,
      preco_usd: (r.preco_usd as number | null) ?? null,
      tendencia: (r.tendencia as string | null) ?? null,
      val_reserva_brl_ha: (r.val_reserva_brl_ha as number | null) ?? null,
      mineral_critico_2025: (r.mineral_critico_2025 as boolean | null) ?? null,
    })
  }
  const cptByUf = new Map<string, number>()
  for (const r of cptR.rows) {
    const u = String(r.uf).trim()
    const m = r.mult != null ? Number(r.mult) : 1
    cptByUf.set(u, Number.isFinite(m) ? m : 1)
  }
  const incentivoB7ByUf = new Map<string, number | null>()
  for (const r of incR.rows) {
    const u = String(r.uf).trim()
    incentivoB7ByUf.set(u, r.b7 != null && r.b7 !== '' ? Number(r.b7) : null)
  }
  const linhasBndes = bndR.rows.map((r) => ({
    minerais_elegiveis: r.minerais_elegiveis,
    linha: r.linha,
  }))
  const extrasByProcessoId = new Map<string, LayerExtrasRow>()
  for (const r of extrasR.rows) {
    const pid = String(r.pid ?? '')
    if (!pid) continue
    extrasByProcessoId.set(pid, {
      sitio_id: r.sitio_id != null ? Number(r.sitio_id) : null,
      sitio_nome: r.sitio_nome != null ? String(r.sitio_nome) : null,
      sitio_distancia_km: r.sitio_distancia_km != null ? Number(r.sitio_distancia_km) : null,
      sitio_tipo: r.sitio_tipo != null ? String(r.sitio_tipo) : null,
      sitio_natureza: r.sitio_natureza != null ? String(r.sitio_natureza) : null,
      sitio_sobreposicao_pct:
        r.sitio_sobreposicao_pct != null ? Number(r.sitio_sobreposicao_pct) : null,
      assent_id: r.assent_id != null ? Number(r.assent_id) : null,
      assent_nome: r.assent_nome != null ? String(r.assent_nome) : null,
      assent_distancia_km: r.assent_distancia_km != null ? Number(r.assent_distancia_km) : null,
      assent_sobreposicao_pct:
        r.assent_sobreposicao_pct != null ? Number(r.assent_sobreposicao_pct) : null,
    })
  }
  const tahByProcessoNumero = new Map<string, TahStatusRow>()
  for (const r of tahR.rows) {
    const num = String(r.processo_numero ?? '').trim()
    if (!num || r.pct_pago == null) continue
    tahByProcessoNumero.set(num, {
      pct_pago: Number(r.pct_pago),
      qtd_pagamentos: Number(r.qtd_pagamentos),
      qtd_nao_pagos: Number(r.qtd_nao_pagos),
    })
  }
  console.log(`[s31] Caches carregados em ${Date.now() - t0}ms (extras=${extrasByProcessoId.size}, tah=${tahByProcessoNumero.size})`)
  return {
    configByAba,
    subByUpper,
    cptByUf,
    incentivoB7ByUf,
    linhasBndes,
    extrasByProcessoId,
    tahByProcessoNumero,
  }
}

const massCaches = await buildMassCaches()

const sql = `SELECT p.id::text AS id FROM processos p
  LEFT JOIN scores s ON s.processo_id = p.id
  WHERE p.ativo_derivado = TRUE AND p.geog IS NOT NULL
  AND (s.scores_fonte IS NULL OR s.scores_fonte <> 's31_v5_20260503')
  ORDER BY p.id LIMIT $1`
const BATCH = 1000
const CONCURRENCY = 8

let errorLinesLogged = 0
function logS31Error(id: string, reason: unknown) {
  if (errorLinesLogged >= 10) return
  errorLinesLogged++
  console.error(String(id), reason)
}

async function processChunk(chunk: { id: string }[]) {
  const results = await Promise.allSettled(
    chunk.map(({ id }) => computeScoresAuto(id, { persist: true, massCaches })),
  )
  let ok = 0
  let err = 0
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    if (r.status === 'fulfilled') {
      ok++
    } else {
      err++
      logS31Error(chunk[i]!.id, r.reason)
    }
  }
  return { ok, err }
}

let total = 0
let erros = 0
const t0 = Date.now()
for (;;) {
  const { rows } = await pool.query<{ id: string }>(sql, [BATCH])
  if (rows.length === 0) break
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY)
    const { ok, err } = await processChunk(chunk)
    total += ok
    erros += err
  }
  console.log('[s31]', total, 'ok,', erros, 'err,', ((Date.now() - t0) / 1000).toFixed(1), 's')
}
await pool.end()
process.exit(0)
