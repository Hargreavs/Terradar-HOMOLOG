/**
 * Auditoria READ-ONLY dos 13 NUPs da apresenta뿯½뿯½o.
 * Compara RPCs (o que a UI v뿯½) contra queries PostGIS diretas (verdade).
 * Gera tmp/audit-13-processos.md + tmp/audit-13-processos.json.
 *
 * N뿯½O modifica dados. N뿯½O commita. N뿯½O rechama batch-scores.
 * Uso (raiz do projeto):
 *   npx tsx server/scripts/audit-13-processos.ts
 */
import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente em .env.local')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 4,
  ssl: DATABASE_URL.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : undefined,
})

const NUPS = [
  '864.016/2026',
  '864.026/2026',
  '871.516/2011',
  '860.890/2022',
  '860.891/2022',
  '860.892/2022',
  '860.893/2022',
  '860.894/2022',
  '860.895/2022',
  '860.896/2022',
  '860.897/2022',
  '860.898/2022',
  '860.900/2022',
] as const

const OUT_DIR = path.join(process.cwd(), 'tmp')
const OUT_MD = path.join(OUT_DIR, 'audit-13-processos.md')
const OUT_JSON = path.join(OUT_DIR, 'audit-13-processos.json')

type QR<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

async function q<T>(
  label: string,
  sql: string,
  params: unknown[] = [],
): Promise<QR<T>> {
  try {
    const r = await pool.query(sql, params)
    return { ok: true, data: r.rows as unknown as T }
  } catch (e) {
    const err = e as { message: string; code?: string }
    return {
      ok: false,
      error: `${label}: ${err.code ? `[${err.code}] ` : ''}${err.message}`,
      code: err.code,
    }
  }
}

function classifyError<T>(r: QR<T>): string | null {
  if (r.ok) return null
  if (r.code === '42883') return 'RPC_AUSENTE'
  if (r.code === '42P01') return 'TABELA_AUSENTE'
  if (r.code === '42703') return 'COLUNA_AUSENTE'
  return 'SCHEMA_MISMATCH'
}

interface AnyRow {
  [k: string]: unknown
}

interface ProcAudit {
  numero: string
  flags: Set<string>
  errors: string[]
  processo: AnyRow | null
  eventos: AnyRow | null
  pendencias: AnyRow[] | null
  territorial_rpc: AnyRow | null
  areas_postgis: AnyRow[] | null
  infra_postgis: AnyRow[] | null
  portos_postgis: AnyRow[] | null
  bioma_postgis: AnyRow[] | null
  aquifero_postgis: AnyRow[] | null
  mercado: AnyRow[] | null
  scores: AnyRow | null
  caducidade: AnyRow[] | null
  regulatorio: AnyRow[] | null
  capag: AnyRow | null
  fiscal: AnyRow | null
  cfem: AnyRow[] | null
  incentivos_uf: AnyRow | null
  bndes: AnyRow[] | null
  fallback_dimensoes?: string[]
}

function pushError<T>(audit: ProcAudit, r: QR<T>) {
  if (!r.ok) {
    const f = classifyError(r)
    if (f) audit.flags.add(f)
    audit.errors.push(r.error)
  }
}

function asNumber(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

async function auditOne(numero: string): Promise<ProcAudit> {
  const a: ProcAudit = {
    numero,
    flags: new Set(),
    errors: [],
    processo: null,
    eventos: null,
    pendencias: null,
    territorial_rpc: null,
    areas_postgis: null,
    infra_postgis: null,
    portos_postgis: null,
    bioma_postgis: null,
    aquifero_postgis: null,
    mercado: null,
    scores: null,
    caducidade: null,
    regulatorio: null,
    capag: null,
    fiscal: null,
    cfem: null,
    incentivos_uf: null,
    bndes: null,
  }

  // === Sec 1 - Processo ===
  const p = await q<AnyRow[]>(
    'processos',
    `
    SELECT
      id, numero, titular, cnpj, cnpj_titular, cnpj_filial, nup_sei,
      substancia, substancia_familia, regime, fase, area_ha, uf, municipio, municipio_ibge,
      ano_protocolo, alvara_validade, gu_validade, gu_status,
      tah_ultimo_pagamento, licenca_ambiental_data, ral_ultimo_data,
      exigencia_pendente, total_eventos,
      ultimo_evento_data, ultimo_evento_codigo, ultimo_evento_descricao,
      updated_at
    FROM processos WHERE numero = $1
    `,
    [numero],
  )
  pushError(a, p)
  a.processo = p.ok ? (p.data[0] ?? null) : null

  const procId = a.processo?.id as string | number | undefined
  const regime = a.processo?.regime as string | undefined
  const substancia = a.processo?.substancia as string | undefined
  const municipioIbge = a.processo?.municipio_ibge as string | undefined
  const uf = a.processo?.uf as string | undefined

  const ev = await q<AnyRow[]>(
    'eventos_count',
    `
    SELECT COUNT(*)::int AS total,
           MIN(data_evento)::text AS min_data,
           MAX(data_evento)::text AS max_data
    FROM processo_eventos WHERE processo_numero = $1
    `,
    [numero],
  )
  pushError(a, ev)
  a.eventos = ev.ok ? (ev.data[0] ?? null) : null

  const pend = await q<AnyRow[]>(
    'fn_pendencias_processo',
    `SELECT * FROM fn_pendencias_processo($1)`,
    [numero],
  )
  pushError(a, pend)
  a.pendencias = pend.ok ? pend.data : null

  if (a.processo) {
    const cnpj = (a.processo.cnpj ?? null) as string | null
    const cnpjTit = (a.processo.cnpj_titular ?? null) as string | null
    if (cnpj == null || cnpj !== cnpjTit) a.flags.add('CNPJ_INCONSISTENTE')
    const nupSei = (a.processo.nup_sei ?? '') as string
    if (nupSei && (/^99/.test(nupSei) || /^[^\d]/.test(nupSei))) {
      a.flags.add('NUP_SEI_SUSPEITO')
    }
    const totalBanco = asNumber(a.processo.total_eventos)
    const totalReal = asNumber(a.eventos?.total)
    if (totalBanco != null && totalReal != null && totalBanco !== totalReal) {
      a.flags.add('TOTAL_EVENTOS_DIVERGE')
    }
  }
  if (a.pendencias && a.pendencias.length > 0) {
    a.flags.add('PENDENCIA_CRITICA')
  }

  // === Sec 2 - Territorio ===
  const terrRpc = await q<AnyRow[]>(
    'fn_territorial_analysis',
    `SELECT fn_territorial_analysis($1) AS result`,
    [numero],
  )
  pushError(a, terrRpc)
  a.territorial_rpc = terrRpc.ok
    ? ((terrRpc.data[0]?.result ?? null) as AnyRow | null)
    : null

  const areas = await q<AnyRow[]>(
    'areas_postgis',
    `
    SELECT ga.tipo, ga.nome, ga.categoria, ga.orgao,
      ROUND((ST_Distance(p.geom::geography, ST_Transform(ga.geom, 4326)::geography) / 1000)::numeric, 2) AS dist_km,
      CASE WHEN ST_Intersects(p.geom, ST_Transform(ga.geom, 4326))
           THEN ROUND((ST_Area(ST_Intersection(p.geom, ST_Transform(ga.geom, 4326))::geography)
                       / NULLIF(ST_Area(p.geom::geography), 0) * 100)::numeric, 2)
           ELSE 0 END AS pct_sobrep
    FROM processos p, geo_areas_protegidas ga
    WHERE p.numero = $1
    ORDER BY p.geom <-> ST_Transform(ga.geom, 4326)
    LIMIT 10
    `,
    [numero],
  )
  pushError(a, areas)
  a.areas_postgis = areas.ok ? areas.data : null

  const infra = await q<AnyRow[]>(
    'infra_postgis',
    `
    SELECT gi.tipo, gi.nome, gi.categoria,
      ROUND((ST_Distance(p.geom::geography, ST_Transform(gi.geom, 4326)::geography) / 1000)::numeric, 2) AS dist_km
    FROM processos p, geo_infraestrutura gi
    WHERE p.numero = $1
    ORDER BY gi.tipo, p.geom <-> ST_Transform(gi.geom, 4326)
    LIMIT 20
    `,
    [numero],
  )
  pushError(a, infra)
  a.infra_postgis = infra.ok ? infra.data : null

  const portos = await q<AnyRow[]>(
    'portos_postgis',
    `
    SELECT gp.tipo, gp.nome, gp.uf,
      ROUND((ST_Distance(p.geom::geography, ST_Transform(gp.geom, 4326)::geography) / 1000)::numeric, 2) AS dist_km
    FROM processos p, geo_pontos_interesse gp
    WHERE p.numero = $1 AND gp.tipo = 'PORTO'
    ORDER BY p.geom <-> ST_Transform(gp.geom, 4326)
    LIMIT 5
    `,
    [numero],
  )
  pushError(a, portos)
  a.portos_postgis = portos.ok ? portos.data : null

  const bioma = await q<AnyRow[]>(
    'bioma_postgis',
    `
    SELECT gb.nome,
      ROUND((ST_Area(ST_Intersection(p.geom, ST_Transform(gb.geom, 4326))::geography)
             / NULLIF(ST_Area(p.geom::geography), 0) * 100)::numeric, 2) AS pct
    FROM processos p, geo_biomas gb
    WHERE p.numero = $1 AND ST_Intersects(p.geom, ST_Transform(gb.geom, 4326))
    ORDER BY pct DESC NULLS LAST
    `,
    [numero],
  )
  pushError(a, bioma)
  a.bioma_postgis = bioma.ok ? bioma.data : null

  const aq = await q<AnyRow[]>(
    'aquifero_postgis',
    `
    SELECT ga.nome, ga.tipo,
      CASE WHEN ST_Intersects(p.geom, ST_Transform(ga.geom, 4326))
           THEN ROUND((ST_Area(ST_Intersection(p.geom, ST_Transform(ga.geom, 4326))::geography)
                       / NULLIF(ST_Area(p.geom::geography), 0) * 100)::numeric, 2)
           ELSE 0 END AS pct,
      ROUND((ST_Distance(p.geom::geography, ST_Transform(ga.geom, 4326)::geography) / 1000)::numeric, 2) AS dist_km
    FROM processos p, geo_aquiferos ga
    WHERE p.numero = $1
      AND (ST_Intersects(p.geom, ST_Transform(ga.geom, 4326))
           OR ST_DWithin(p.geom::geography, ST_Transform(ga.geom, 4326)::geography, 50000))
    ORDER BY pct DESC NULLS LAST, dist_km ASC
    LIMIT 5
    `,
    [numero],
  )
  pushError(a, aq)
  a.aquifero_postgis = aq.ok ? aq.data : null

  // Compara RPC x PostGIS - porto
  if (a.territorial_rpc && a.portos_postgis && a.portos_postgis.length > 0) {
    const rpcPortos = Array.isArray(
      (a.territorial_rpc as { portos?: unknown }).portos,
    )
      ? ((a.territorial_rpc as { portos: AnyRow[] }).portos as AnyRow[])
      : []
    const rpcFirst = rpcPortos[0]
    const realFirst = a.portos_postgis[0]
    if (rpcFirst && realFirst && rpcFirst.nome !== realFirst.nome) {
      a.flags.add('DIVERGENCIA_PORTO')
    }
  }

  // BUG_AQUIFERO: UI mostra SOBREPOSTO mas pct real baixo
  if (a.territorial_rpc) {
    const rpcAqs = Array.isArray(
      (a.territorial_rpc as { aquiferos?: unknown }).aquiferos,
    )
      ? ((a.territorial_rpc as { aquiferos: AnyRow[] }).aquiferos as AnyRow[])
      : []
    if (rpcAqs.length > 0 && a.aquifero_postgis) {
      const first = rpcAqs[0]
      const match = a.aquifero_postgis.find(
        (x) => String(x.nome) === String(first.nome),
      )
      const pct = match ? asNumber(match.pct) ?? 0 : 0
      if (pct < 1) a.flags.add('BUG_AQUIFERO')
    }
  }

  // APP_EM_RPC - nao deveria aparecer porque fn_territorial_analysis nao calcula APP
  if (
    a.territorial_rpc &&
    Array.isArray(
      (a.territorial_rpc as { areas_protegidas?: unknown }).areas_protegidas,
    )
  ) {
    const aps = (a.territorial_rpc as { areas_protegidas: AnyRow[] })
      .areas_protegidas
    const hasApp = aps.some((ap) => {
      const tipo = String(ap.tipo ?? '').toUpperCase()
      const cat = String(ap.categoria ?? '').toUpperCase()
      return tipo === 'APP' || /\bAPP\b/.test(cat)
    })
    if (hasApp) a.flags.add('APP_EM_RPC')
  }

  // === Sec 3 - Mercado ===
  if (substancia) {
    const mkt = await q<AnyRow[]>(
      'master_substancias',
      `
      SELECT *
      FROM master_substancias
      WHERE LOWER(substancia_anm) = LOWER($1)
         OR LOWER(substancia_anm) LIKE LOWER($1) || '%'
      LIMIT 3
      `,
      [substancia],
    )
    pushError(a, mkt)
    a.mercado = mkt.ok ? mkt.data : null
    if (mkt.ok && (!mkt.data || mkt.data.length === 0)) {
      a.flags.add('SUBSTANCIA_SEM_MATCH')
    }
    if (mkt.ok && mkt.data && mkt.data[0]) {
      const row = mkt.data[0]
      const hasPreco =
        row.preco_brl != null ||
        row.preco_usd != null ||
        row.preco_unitario != null ||
        row.preco_medio_brl != null
      if (!hasPreco) a.flags.add('MERCADO_SEM_PRECO')
    }
  }

  // === Sec 4 & 5 - Scores ===
  if (procId != null) {
    const sc = await q<AnyRow[]>(
      'scores',
      `
      SELECT risk_score, risk_label, risk_cor, dimensoes_risco,
             os_conservador, os_moderado, os_arrojado, os_label, os_classificacao,
             dimensoes_oportunidade, calculated_at, scores_fonte
      FROM scores WHERE processo_id = $1
      ORDER BY calculated_at DESC LIMIT 1
      `,
      [procId],
    )
    pushError(a, sc)
    a.scores = sc.ok ? (sc.data[0] ?? null) : null

    if (a.scores?.calculated_at && a.eventos?.max_data) {
      const calc = new Date(String(a.scores.calculated_at)).getTime()
      const lastEv = new Date(String(a.eventos.max_data)).getTime()
      if (Number.isFinite(calc) && Number.isFinite(lastEv) && lastEv > calc) {
        a.flags.add('SCORES_DESATUALIZADO')
      }
    }

    const dimsAfetadas: string[] = []
    const checkDim = (dim: unknown, nome: string) => {
      if (!dim || typeof dim !== 'object') return
      const subs = (dim as { subfatores?: unknown[] }).subfatores
      if (!Array.isArray(subs)) return
      const hasFb = subs.some((s) => {
        const t = (s as { texto?: unknown })?.texto
        return typeof t === 'string' && /^fallback/i.test(t.trim())
      })
      if (hasFb) dimsAfetadas.push(nome)
    }
    const dr = (a.scores?.dimensoes_risco ?? {}) as Record<string, unknown>
    const dop = (a.scores?.dimensoes_oportunidade ?? {}) as Record<
      string,
      unknown
    >
    checkDim(dr.geologico, 'risco.geologico')
    checkDim(dr.ambiental, 'risco.ambiental')
    checkDim(dr.social, 'risco.social')
    checkDim(dr.regulatorio, 'risco.regulatorio')
    checkDim(dop.atratividade, 'oportunidade.atratividade')
    checkDim(dop.viabilidade, 'oportunidade.viabilidade')
    checkDim(dop.seguranca, 'oportunidade.seguranca')
    if (dimsAfetadas.length > 0) {
      a.flags.add('SCORES_COM_FALLBACK')
      a.fallback_dimensoes = dimsAfetadas
    }
  }

  const cad = await q<AnyRow[]>(
    'fn_caducidade_score',
    `SELECT * FROM fn_caducidade_score($1)`,
    [numero],
  )
  pushError(a, cad)
  a.caducidade = cad.ok ? cad.data : null

  const reg = await q<AnyRow[]>(
    'fn_regulatorio_metrics',
    `SELECT * FROM fn_regulatorio_metrics($1)`,
    [numero],
  )
  pushError(a, reg)
  a.regulatorio = reg.ok ? reg.data : null

  if (
    a.caducidade &&
    a.caducidade[0] &&
    a.scores?.dimensoes_risco &&
    typeof a.scores.dimensoes_risco === 'object'
  ) {
    const regDim = (a.scores.dimensoes_risco as Record<string, unknown>)
      .regulatorio as { valor?: unknown } | undefined
    const regVal = asNumber(regDim?.valor) ?? -1
    const cad0 = a.caducidade[0]
    const cadPts =
      asNumber(cad0.pontos) ??
      asNumber(cad0.score) ??
      asNumber(cad0.caducidade_score) ??
      0
    if (cadPts > 30 && regVal >= 0 && regVal < 30) {
      a.flags.add('DESCASAMENTO_REGULATORIO')
    }
  }

  // === Sec 6 - Fiscal ===
  if (municipioIbge) {
    const cp = await q<AnyRow[]>(
      'capag_municipios',
      `SELECT * FROM capag_municipios WHERE municipio_ibge = $1 ORDER BY ano DESC LIMIT 1`,
      [String(municipioIbge)],
    )
    pushError(a, cp)
    a.capag = cp.ok ? (cp.data[0] ?? null) : null
    if (cp.ok && !a.capag) a.flags.add('CAPAG_AUSENTE')

    const fm = await q<AnyRow[]>(
      'fiscal_municipios',
      `SELECT * FROM fiscal_municipios WHERE municipio_ibge = $1 ORDER BY exercicio DESC LIMIT 1`,
      [String(municipioIbge)],
    )
    pushError(a, fm)
    a.fiscal = fm.ok ? (fm.data[0] ?? null) : null

    const cf = await q<AnyRow[]>(
      'cfem_historico',
      `SELECT ano, valor_brl, substancias FROM cfem_historico WHERE municipio_ibge = $1 ORDER BY ano DESC LIMIT 5`,
      [String(municipioIbge)],
    )
    pushError(a, cf)
    a.cfem = cf.ok ? cf.data : null
    if (cf.ok && (!a.cfem || a.cfem.length === 0)) {
      a.flags.add('CFEM_ZERO_MUNICIPIO')
    }
  }

  if (uf) {
    const inc = await q<AnyRow[]>(
      'incentivos_uf',
      `SELECT * FROM incentivos_uf WHERE uf = $1 LIMIT 1`,
      [uf],
    )
    pushError(a, inc)
    a.incentivos_uf = inc.ok ? (inc.data[0] ?? null) : null
  }

  if (substancia) {
    const bn = await q<AnyRow[]>(
      'linhas_bndes',
      `SELECT linha, valor_minimo, taxa, prazo FROM linhas_bndes LIMIT 10`,
      [],
    )
    pushError(a, bn)
    a.bndes = bn.ok ? bn.data : null
  }

  // CFEM_FIX_PENDENTE - informativo (nao bug: fix ja aplicado p/ os 3 regimes)
  if (
    regime &&
    ['requerimento_pesquisa', 'autorizacao_pesquisa', 'req_lavra'].includes(
      regime,
    )
  ) {
    a.flags.add('REGIME_SEM_CFEM')
  }

  return a
}

function fmt(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v).slice(0, 80)
    } catch {
      return '[object]'
    }
  }
  if (typeof v === 'number') return v.toLocaleString('pt-BR')
  return String(v)
}

function renderMd(audits: ProcAudit[]): string {
  const L: string[] = []
  L.push(`# Auditoria 13 processos — gerado em ${new Date().toISOString()}`)
  L.push('')
  L.push('## Sum뿯½rio executivo')
  L.push('')
  L.push('| Processo | Titular | Flags | Cr뿯½tico? |')
  L.push('|---|---|---|---|')
  const CRITICAS = new Set([
    'CNPJ_INCONSISTENTE',
    'BUG_AQUIFERO',
    'DIVERGENCIA_PORTO',
    'SCORES_DESATUALIZADO',
    'TOTAL_EVENTOS_DIVERGE',
    'SCORES_COM_FALLBACK',
    'DESCASAMENTO_REGULATORIO',
    'TABELA_AUSENTE',
    'RPC_AUSENTE',
  ])
  for (const a of audits) {
    const flags = [...a.flags]
    const crit = flags.some((f) => CRITICAS.has(f)) ? 'SIM' : 'nao'
    const tit = String(a.processo?.titular ?? '—').slice(0, 40)
    L.push(`| ${a.numero} | ${tit} | ${flags.join(', ') || 'OK'} | ${crit} |`)
  }
  L.push('')

  for (const a of audits) {
    const p = a.processo ?? ({} as AnyRow)
    L.push('---')
    L.push(`## ${a.numero} — ${fmt(p.titular)}`)
    L.push('')
    L.push(`**Flags:** ${[...a.flags].join(', ') || '(nenhum)'}`)
    if (a.errors.length > 0) {
      L.push('')
      L.push('**Erros de query:**')
      for (const e of a.errors) L.push(`- ${e}`)
    }
    L.push('')

    // Sec 1
    L.push('### Aba Processo')
    L.push('')
    L.push('| Campo | Valor |')
    L.push('|---|---|')
    const keys = [
      'titular',
      'cnpj',
      'cnpj_titular',
      'cnpj_filial',
      'nup_sei',
      'regime',
      'fase',
      'substancia',
      'substancia_familia',
      'uf',
      'municipio',
      'municipio_ibge',
      'area_ha',
      'total_eventos',
      'ultimo_evento_data',
      'ultimo_evento_codigo',
      'ultimo_evento_descricao',
      'updated_at',
    ]
    for (const k of keys) L.push(`| ${k} | ${fmt(p[k])} |`)
    if (a.eventos) {
      L.push(`| eventos (COUNT real) | ${fmt(a.eventos.total)} |`)
      L.push(
        `| eventos (min 뿯↽ max data) | ${fmt(a.eventos.min_data)} 뿯↽ ${fmt(a.eventos.max_data)} |`,
      )
    }
    if (a.pendencias && a.pendencias.length > 0) {
      L.push('')
      L.push('**Pend뿯½ncias (fn_pendencias_processo):**')
      for (const pend of a.pendencias) {
        L.push(`- ${JSON.stringify(pend).slice(0, 240)}`)
      }
    }
    L.push('')

    // Sec 2
    L.push('### Aba Territ뿯½rio — RPC vs PostGIS')
    L.push('')
    if (a.territorial_rpc) {
      L.push('**RPC (`fn_territorial_analysis`):**')
      L.push('')
      L.push('```json')
      L.push(JSON.stringify(a.territorial_rpc, null, 2))
      L.push('```')
      L.push('')
    }
    if (a.areas_postgis) {
      L.push('**뿯½reas protegidas (top 10 por dist뿯½ncia, PostGIS direto):**')
      L.push('')
      L.push('| tipo | nome | categoria | 뿯½rg뿯½o | dist_km | pct_sobrep |')
      L.push('|---|---|---|---|---|---|')
      for (const r of a.areas_postgis) {
        L.push(
          `| ${fmt(r.tipo)} | ${String(r.nome ?? '').slice(0, 50)} | ${fmt(r.categoria)} | ${fmt(r.orgao)} | ${fmt(r.dist_km)} | ${fmt(r.pct_sobrep)} |`,
        )
      }
      L.push('')
    }
    if (a.infra_postgis) {
      L.push('**Infraestrutura (top 20 por tipo):**')
      L.push('')
      L.push('| tipo | nome | categoria | dist_km |')
      L.push('|---|---|---|---|')
      for (const r of a.infra_postgis) {
        L.push(
          `| ${fmt(r.tipo)} | ${String(r.nome ?? '').slice(0, 60)} | ${fmt(r.categoria)} | ${fmt(r.dist_km)} |`,
        )
      }
      L.push('')
    }
    if (a.portos_postgis) {
      L.push('**Portos (top 5 por dist뿯½ncia, `tipo = PORTO`):**')
      L.push('')
      L.push('| nome | uf | dist_km |')
      L.push('|---|---|---|')
      for (const r of a.portos_postgis) {
        L.push(`| ${fmt(r.nome)} | ${fmt(r.uf)} | ${fmt(r.dist_km)} |`)
      }
      L.push('')
    }
    if (a.bioma_postgis) {
      L.push('**Biomas (interse뿯½뿯½o):**')
      L.push('')
      L.push('| nome | pct |')
      L.push('|---|---|')
      for (const r of a.bioma_postgis) {
        L.push(`| ${fmt(r.nome)} | ${fmt(r.pct)} |`)
      }
      L.push('')
    }
    if (a.aquifero_postgis) {
      L.push('**Aqu뿯½feros (intersectam ou at뿯½ 50 km):**')
      L.push('')
      L.push('| nome | tipo | pct | dist_km |')
      L.push('|---|---|---|---|')
      for (const r of a.aquifero_postgis) {
        L.push(
          `| ${fmt(r.nome)} | ${fmt(r.tipo)} | ${fmt(r.pct)} | ${fmt(r.dist_km)} |`,
        )
      }
      L.push('')
    }

    // Sec 3
    L.push('### Aba Intelig뿯½ncia (mercado)')
    L.push('')
    if (a.mercado && a.mercado[0]) {
      const m = a.mercado[0]
      L.push(`- subst뿯½ncia_anm: \`${fmt(m.substancia_anm)}\``)
      L.push(`- fam뿯½lia: \`${fmt(m.substancia_familia)}\``)
      if (m.preco_brl != null) L.push(`- preco_brl: \`${fmt(m.preco_brl)}\``)
      if (m.preco_usd != null) L.push(`- preco_usd: \`${fmt(m.preco_usd)}\``)
      if (m.preco_medio_brl != null)
        L.push(`- preco_medio_brl: \`${fmt(m.preco_medio_brl)}\``)
      if (m.val_reserva_brl_ha != null)
        L.push(`- val_reserva_brl_ha: \`${fmt(m.val_reserva_brl_ha)}\``)
    } else {
      L.push(`- sem match pra subst뿯½ncia \`${fmt(p.substancia)}\``)
    }
    L.push('')

    // Sec 4
    L.push('### Aba Risco')
    L.push('')
    if (a.scores) {
      L.push(
        `- risk_score: **${fmt(a.scores.risk_score)}** (${fmt(a.scores.risk_label)})`,
      )
      L.push(`- calculated_at: ${fmt(a.scores.calculated_at)}`)
      L.push(`- scores_fonte: ${fmt(a.scores.scores_fonte)}`)
      const dr = (a.scores.dimensoes_risco ?? {}) as Record<
        string,
        { valor?: unknown; subfatores?: unknown[] }
      >
      L.push(
        `- dimens뿯½es (valor 뿯½ #sub): geo=${fmt(dr.geologico?.valor)} 뿯½ amb=${fmt(dr.ambiental?.valor)} 뿯½ soc=${fmt(dr.social?.valor)} 뿯½ reg=${fmt(dr.regulatorio?.valor)}`,
      )
    }
    if (a.caducidade && a.caducidade[0]) {
      L.push(`- fn_caducidade_score: \`${JSON.stringify(a.caducidade[0])}\``)
    }
    if (a.regulatorio && a.regulatorio[0]) {
      L.push(`- fn_regulatorio_metrics: \`${JSON.stringify(a.regulatorio[0])}\``)
    }
    if (a.fallback_dimensoes && a.fallback_dimensoes.length > 0) {
      L.push(`- fallback em: ${a.fallback_dimensoes.join(', ')}`)
    }
    L.push('')

    // Sec 5
    L.push('### Aba Oportunidade')
    L.push('')
    if (a.scores) {
      L.push(
        `- OS cons/mod/arr: **${fmt(a.scores.os_conservador)}/${fmt(a.scores.os_moderado)}/${fmt(a.scores.os_arrojado)}** (${fmt(a.scores.os_label)})`,
      )
      const dop = (a.scores.dimensoes_oportunidade ?? {}) as Record<
        string,
        { valor?: unknown }
      >
      L.push(
        `- dimens뿯½es (valor): atr=${fmt(dop.atratividade?.valor)} 뿯½ via=${fmt(dop.viabilidade?.valor)} 뿯½ seg=${fmt(dop.seguranca?.valor)}`,
      )
    }
    L.push('')

    // Sec 6
    L.push('### Aba Fiscal')
    L.push('')
    if (a.capag) {
      L.push(
        `- CAPAG (ano ${fmt(a.capag.ano)}): nota=${fmt(a.capag.nota ?? a.capag.capag)}`,
      )
    } else {
      L.push('- CAPAG: ausente')
    }
    if (a.fiscal) {
      L.push(
        `- fiscal_municipios (exerc뿯½cio ${fmt(a.fiscal.exercicio)}): idh=${fmt(a.fiscal.idh)}, divida=${fmt(a.fiscal.divida_consolidada)}`,
      )
    }
    if (a.cfem && a.cfem.length > 0) {
      L.push('- cfem_historico:')
      for (const c of a.cfem) L.push(`  - ${fmt(c.ano)}: R$ ${fmt(c.valor_brl)}`)
    } else {
      L.push('- cfem_historico: sem arrecada뿯½뿯½o no munic뿯½pio')
    }
    if (a.incentivos_uf) {
      L.push(
        `- incentivos_uf: score=${fmt(a.incentivos_uf.score_incentivo)}`,
      )
    }
    if (a.bndes && a.bndes.length > 0) {
      L.push(
        `- BNDES: ${a.bndes.length} linha(s); primeira=${fmt(a.bndes[0].linha)}`,
      )
    }
    L.push('')
  }

  // Apendice
  L.push('---')
  L.push('## Ap뿯½ndice — Flags consolidadas')
  L.push('')
  const flagMap = new Map<string, string[]>()
  for (const a of audits)
    for (const f of a.flags) {
      if (!flagMap.has(f)) flagMap.set(f, [])
      flagMap.get(f)!.push(a.numero)
    }
  L.push('| Flag | Quantos | NUPs |')
  L.push('|---|---|---|')
  const sorted = [...flagMap.entries()].sort(
    (x, y) => y[1].length - x[1].length,
  )
  for (const [f, nups] of sorted) {
    L.push(`| ${f} | ${nups.length} | ${nups.join(', ')} |`)
  }
  L.push('')

  return L.join('\n')
}

async function main() {
  console.log(
    `TERRADAR 뿯½ Auditoria 13 NUPs 뿯½ ${new Date().toISOString()}`,
  )
  console.log('================================================================')
  const audits: ProcAudit[] = []
  let i = 0
  for (const nup of NUPS) {
    i++
    process.stdout.write(`  [${i}/13] ${nup} ... `)
    try {
      const a = await auditOne(nup)
      audits.push(a)
      const flags = [...a.flags]
      console.log(`flags: ${flags.join(',') || 'OK'}`)
    } catch (e) {
      console.log(`ERRO: ${(e as Error).message}`)
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const json = audits.map((a) => ({ ...a, flags: [...a.flags] }))
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2), 'utf8')
  fs.writeFileSync(OUT_MD, renderMd(audits), 'utf8')

  console.log()
  console.log(`Gerado:`)
  console.log(
    `  ${OUT_MD} (${fs.statSync(OUT_MD).size.toLocaleString('pt-BR')} bytes)`,
  )
  console.log(
    `  ${OUT_JSON} (${fs.statSync(OUT_JSON).size.toLocaleString('pt-BR')} bytes)`,
  )

  const flagMap = new Map<string, number>()
  for (const a of audits)
    for (const f of a.flags) flagMap.set(f, (flagMap.get(f) ?? 0) + 1)
  console.log('\nFlags consolidadas (ordem de frequ뿯½ncia):')
  const sorted = [...flagMap.entries()].sort((x, y) => y[1] - x[1])
  for (const [f, n] of sorted) {
    console.log(`  ${n.toString().padStart(3)} 뿯½ ${f}`)
  }

  await pool.end()
}

main().catch(async (e) => {
  console.error(e)
  try {
    await pool.end()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
