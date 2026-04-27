/**
 * S31 v3 - Risk + OS motor (Node + postgres.js + config_scores).
 * Modelo: S31_REFATOR_FINAL_RISK_OPP_v3.md
 */
import './env'
import postgres, { type JSONValue } from 'postgres'
import type { ScoreResult } from './scoreEngine'

const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
let _sql: ReturnType<typeof postgres> | null = null
function getSql() {
  if (!dbUrl) throw new Error('DATABASE_URL or VITE_DATABASE_URL required for S31')
  if (!_sql) {
    _sql = postgres(dbUrl, {
      max: 20,
      idle_timeout: 0,
      connect_timeout: 60,
      prepare: false,
      ssl: /supabase|amazonaws/i.test(dbUrl) ? 'require' : false,
    })
  }
  return _sql
}

export type ProcessoMotorRow = {
  id: string
  numero: string
  uf: string | null
  municipio_ibge: string | null
  substancia: string | null
  substancia_familia: string | null
  fase: string | null
  regime: string | null
  area_ha: number | null
  app_overlap_pct: number | null
  bioma_territorial: string | null
  ativo_derivado: boolean
  situacao: string | null
  geog: unknown
  amb_ti_sobrepoe: boolean | null
  amb_quilombola_sobrepoe: boolean | null
  amb_uc_pi_sobrepoe: boolean | null
  amb_assentamento_sobrepoe: boolean | null
  amb_assentamento_2km: boolean | null
  amb_app_sobrepoe: boolean | null
  amb_uc_us_5km: boolean | null
  amb_aquifero_5km: boolean | null
  alvara_validade: string | null
  gu_validade: string | null
  ral_ultimo_data: string | null
  inicio_lavra_data: string | null
  portaria_lavra_data: string | null
  pendencias_abertas: number | null
  ultimo_evento_data: string | null
  capag_nota: string | null
  idh_municipio: number | null
  pib_pc_municipio: number | null
  densidade_demografica: number | null
  autonomia_fiscal_ratio: number | null
  incentivo_b7: number | null
  receita_tributaria: number | null
  divida_consolidada: number | null
}

export type LayerRow = {
  tipo: string
  nome: string
  distancia_km: number
  sobreposicao_pct: number | null
}

export type SubData = {
  gap_pp: number | null
  preco_brl: number | null
  preco_usd: number | null
  tendencia: string | null
  val_reserva_brl_ha: number | null
  mineral_critico_2025: boolean | null
}

/** Caches de leitura para recálculo em massa (config, substâncias, CPT, incentivos, BNDES). */
export type S31MassCaches = {
  configByAba: Record<string, unknown>
  subByUpper: Map<string, SubData>
  cptByUf: Map<string, number>
  incentivoB7ByUf: Map<string, number | null>
  linhasBndes: Array<{ minerais_elegiveis?: string | null; linha?: string | null }>
}

let sessionMassCaches: S31MassCaches | null = null

const FASE_MAP: Record<string, string> = {
  'CONCESSAO DE LAVRA': 'lavra',
  LAVRA: 'lavra',
  'LAVRA GARIMPEIRA': 'lavra',
  'REQUERIMENTO DE LAVRA': 'concessao',
  'DIREITO DE REQUERER A LAVRA': 'concessao',
  LICENCIAMENTO: 'concessao',
  'AUTORIZACAO DE PESQUISA': 'pesquisa',
  PESQUISA: 'pesquisa',
  'REQUERIMENTO DE PESQUISA': 'requerimento',
  DISPONIBILIDADE: 'encerrado',
  'APTO PARA DISPONIBILIDADE': 'encerrado',
}

function mapFase(f: string): string {
  return FASE_MAP[f.toUpperCase().trim()] ?? 'requerimento'
}

const MS_DIA = 86_400_000
function diasDesde(iso: string | null | undefined): number | null {
  if (iso == null || iso === '') return null
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / MS_DIA)
}
function semPrazoAlvara(r: string | null): boolean {
  if (!r) return false
  const x = r.toLowerCase()
  return x.includes('disponibilidade') || (x.includes('concess') && x.includes('lavra'))
}
function diasAteCaducidade(al: string | null, regime: string | null): number | null {
  if (semPrazoAlvara(regime)) return null
  if (!al) return null
  const v = new Date(al)
  if (Number.isNaN(v.getTime())) return null
  return Math.floor((v.getTime() - Date.now()) / MS_DIA)
}

const SCORE_SUB: Record<string, number> = { OURO: 50, 'MINERIO DE OURO': 50, FERRO: 25, 'TERRAS RARAS': 68 }
const SCORE_FASE_OS: Record<string, number> = {
  lavra: 100,
  concessao: 80,
  pesquisa: 50,
  requerimento: 25,
  encerrado: 5,
}

let cfgCache: Record<string, unknown> | null = null
export async function loadConfigScores(): Promise<Record<string, unknown>> {
  if (sessionMassCaches) return sessionMassCaches.configByAba
  if (cfgCache) return cfgCache
  const s = getSql()
  const rows = await s`SELECT aba, dados FROM config_scores`
  cfgCache = {}
  for (const r of rows as unknown as { aba: string; dados: unknown }[]) {
    cfgCache[r.aba] = r.dados
  }
  return cfgCache
}

function pickSubScore(n: string | null, cfg: Record<string, unknown> | null): number {
  if (!n) return 50
  const u = n.replace(/^MIN[EI]RIO DE /i, '').trim().toUpperCase()
  if (SCORE_SUB[u] != null) return SCORE_SUB[u]!
  const t = cfg && cfg['2_RS_GEOLOGICO']
  if (Array.isArray(t)) {
    for (const row of t) {
      if (Array.isArray(row) && row.length >= 2) {
        const a = String(row[0] ?? '').toUpperCase()
        const b = Number(row[1])
        if (a && (a.includes(u) || u.includes(a))) return Number.isFinite(b) ? b : 50
      }
    }
  }
  return 50
}

function capagScore(n: string | null | undefined): number {
  if (n == null || n === '') return 30
  const t = n.trim()
  const m: Record<string, number> = {
    'A+': 0, A: 5, 'B+': 10, B: 15, C: 50, D: 80, 'n.d.': 30, 'N.D.': 30, 'N.E.': 50, 'n.e.': 50,
  }
  return m[t] ?? 30
}

function biomaMult(s: number, b: string | null | undefined): number {
  if (!b) return Math.min(100, Math.round(s))
  const k = b.trim()
  const o: Record<string, number> = {
    'Amazonia': 1.3, 'Amazônia': 1.3, 'MATA ATLANTICA': 1.2, 'MATA ATLÂNTICA': 1.2, Pantanal: 1.25, Cerrado: 1.1,
    Caatinga: 1, Pampa: 1,
  }
  return Math.min(100, Math.round(s * (o[k] ?? 1)))
}

const ti = (l: LayerRow) => /ind[ií]gena|terra\s*ind/i.test(l.tipo)
const qx = (l: LayerRow) => /quilombol/i.test(l.tipo)
const ucpi = (l: LayerRow) => /uc\s*pi|PARNA|integral/i.test(l.tipo)
const uucs = (l: LayerRow) => /uc\s*us|apa|flona/i.test(l.tipo) && !ucpi(l)
const aqu = (l: LayerRow) => /aqu[ií]fer/i.test(l.tipo)
const mine = (ls: LayerRow[], p: (l: LayerRow) => boolean) => {
  const d = ls.filter(p).map((l) => l.distancia_km)
  return d.length ? Math.min(...d) : Number.POSITIVE_INFINITY
}
const ovl = (ls: LayerRow[], p: (l: LayerRow) => boolean, x: number) =>
  ls.some((l) => p(l) && (l.sobreposicao_pct ?? 0) >= x)

export function dimGeologico(p: ProcessoMotorRow, cfg: Record<string, unknown> | null) {
  return Math.min(100, Math.round(0.5 * pickSubScore(p.substancia, cfg) + 25))
}

export async function dimAmbiental(p: ProcessoMotorRow, ls: LayerRow[]) {
  const s = getSql()
  const t1 = ls.find(ti)
  const q1 = ls.find(qx)
  const ucp = ls.filter(ucpi)
  const tiS = p.amb_ti_sobrepoe === true || ovl(ls, ti, 100)
  const qS = p.amb_quilombola_sobrepoe === true || ovl(ls, qx, 100)
  const uS = p.amb_uc_pi_sobrepoe === true || ucp.some((u) => (u.sobreposicao_pct ?? 0) >= 100)
  if (tiS || qS || uS) return biomaMult(100, p.bioma_territorial)
  let pt = 0
  if (t1 && !tiS) {
    if (t1.distancia_km <= 5) pt += 50
    else if (t1.distancia_km <= 10) pt += 30
    else if (t1.distancia_km <= 20) pt += 15
  }
  const umin = ucp.length ? Math.min(...ucp.map((u) => u.distancia_km)) : Number.POSITIVE_INFINITY
  if (Number.isFinite(umin) && !uS) {
    if (umin <= 5) pt += 40
    else if (umin <= 10) pt += 20
  }
  if (q1 && !qS) {
    if (q1.distancia_km <= 5) pt += 45
    else if (q1.distancia_km <= 10) pt += 25
  }
  // Usa coluna geog precomputada (4326) + GIST em geo_sitios_arqueologicos — evita ST_Transform por linha
  if (p.geog != null) {
    const d0 = (await s`
      SELECT MIN(ST_Distance(p.geog, s.geog)) / 1000 AS d
      FROM processos p
      CROSS JOIN geo_sitios_arqueologicos s
      WHERE p.id = ${p.id}
        AND ST_DWithin(p.geog, s.geog, 5000)
    `) as { d: string | null }[]
    const dk = d0[0]?.d != null ? Number(d0[0].d) : null
    if (dk != null && Number.isFinite(dk)) {
      if (dk <= 1) pt += 30
      else if (dk <= 5) pt += 15
    }
  }
  const ap = p.app_overlap_pct
  if (ap != null) {
    if (ap > 10) pt += 25
    else if (ap >= 1) pt += 15
    else if (ap > 0) pt += 8
  } else if (p.amb_app_sobrepoe) pt += 8
  const usL = ls.filter((l) => uucs(l))
  if (usL.some((u) => (u.sobreposicao_pct ?? 0) > 0)) pt += 20
  else {
    const x = mine(ls, (l) => uucs(l) && !ucpi(l))
    if (Number.isFinite(x) && x <= 5) pt += 10
  }
  if (p.amb_uc_us_5km) pt = Math.max(pt, 10)
  const a = ls.find(aqu)
  if (a) {
    if ((a.sobreposicao_pct ?? 0) > 0) pt += 15
    else if (a.distancia_km <= 1) pt += 10
    else if (a.distancia_km <= 5) pt += 5
  } else if (p.amb_aquifero_5km) pt += 5
  return biomaMult(Math.min(100, pt), p.bioma_territorial)
}

function cmu(p: ProcessoMotorRow, ls: LayerRow[]) {
  if (p.amb_assentamento_sobrepoe) return 85
  if (p.amb_assentamento_2km) return 60
  const a = Math.min(mine(ls, ti) || 9e9, mine(ls, qx) || 9e9)
  if (a < 5) return 65
  if (a < 10) return 35
  if (a < 20) return 15
  return 5
}
function idh0(x: number | null) {
  if (x == null) return 35
  if (x < 0.5) return 80
  if (x < 0.6) return 60
  if (x < 0.7) return 35
  if (x < 0.8) return 15
  return 5
}
function dns(x: number | null) {
  if (x == null) return 5
  if (x > 100) return 60
  if (x > 50) return 35
  if (x > 10) return 15
  return 5
}
function pib0(x: number | null) {
  if (x == null || x <= 0) return 35
  if (x < 8e4) return 20
  if (x < 1e5) return 50
  if (x < 15e4) return 60
  return 75
}

export function dimSocial(p: ProcessoMotorRow, ls: LayerRow[], cpt: number) {
  const c1 = cmu(p, ls)
  const c2 = Math.round(0.5 * idh0(p.idh_municipio) + 0.5 * pib0(p.pib_pc_municipio))
  const c3 = Math.min(100, Math.max(0, 30 + 70 * (cpt - 1)))
  const c4 = dns(p.densidade_demografica)
  return Math.min(100, Math.round(c1 * 0.45 + c2 * 0.2 + c3 * 0.2 + c4 * 0.15))
}

function t0(d: number | null) { if (d == null) return 50; if (d > 365) return 80; if (d >= 180) return 50; if (d >= 30) return 20; return 5 }
function p0(n: number | null) { if (n == null) return 5; if (n >= 3) return 75; if (n === 2) return 50; if (n === 1) return 30; return 5 }
function c0(d: number | null, r: string | null, f: string) {
  if (d == null) return semPrazoAlvara(r) || f === 'encerrado' ? 5 : 50
  if (d < 0) return 90
  if (d < 180) return 85
  if (d <= 365) return 50
  return 10
}
function aut0(n: number, t: number) { return Math.min(100, n * 18 + Math.min(50, t / 5e4)) }

export function dimRegul(p: ProcessoMotorRow, aut: { count: number; total: number }) {
  const f = mapFase(p.fase ?? '')
  const sp = p0(p.pendencias_abertas != null ? Number(p.pendencias_abertas) : 0)
  const sc = c0(diasAteCaducidade(p.alvara_validade, p.regime), p.regime, f)
  const st = t0(diasDesde(p.ultimo_evento_data))
  const sa = aut0(aut.count, aut.total)
  const sa2 = 5
  const cp = capagScore(p.capag_nota)
  let v = sp * 0.25 + sc * 0.2 + sa * 0.2 + st * 0.1 + sa2 * 0.1 + cp * 0.15
  if (sc >= 90 || sa >= 60) v = Math.max(v, 70)
  return Math.min(100, Math.round(v * 10) / 10)
}

function b7(x: number | null) { if (x == null) return 15; if (x >= 3) return 90; if (x >= 2) return 70; if (x >= 1) return 45; return 15 }
function b3(ls: LayerRow[]) {
  let b = 20
  const f = mine(ls, (l) => /ferrov|porto|hidrovi/i.test(l.tipo) || l.tipo.toUpperCase().includes('FERRO'))
  if (f <= 50) b = 90
  else if (f <= 100) b = 70
  else if (f <= 200) b = 45
  return b
}
function fiscalB6(p: ProcessoMotorRow) {
  const r = p.autonomia_fiscal_ratio, rv = p.receita_tributaria, d = p.divida_consolidada
  if (r == null && rv == null && d == null) return 35
  if (r != null) { if (r > 1.2) return 90; if (r > 0.8) return 60; if (r > 0.4) return 35; return 15 }
  if (rv != null && (d == null || d === 0) && rv > 0) return 80
  return 40
}
function cf0(t: number) { if (t <= 0) return 20; if (t < 1e6) return 40; if (t < 2e7) return 60; if (t < 2e8) return 80; return 90 }
function ar0(a: number | null) { if (a == null) return 15; if (a > 2e3) return 90; if (a >= 500) return 70; if (a >= 100) return 50; if (a >= 50) return 30; return 15 }
function bm0(b: string | null) { if (!b) return 50; const u = b.toUpperCase(); if (u.includes('AMAZ') || u.includes('PANTAN')) return 30; if (u.includes('MATA')) return 40; return 60 }

function opAtr(p: ProcessoMotorRow, sub: SubData | null, cfg: Record<string, unknown> | null) {
  const a1 = pickSubScore(p.substancia, cfg)
  const g = sub?.gap_pp
  let a2 = 40
  if (g != null) { if (g > 15) a2 = 95; else if (g >= 10) a2 = 80; else if (g >= 5) a2 = 60; else if (g >= 1) a2 = 40; else a2 = 15 }
  const pr = sub?.preco_brl
  let a3 = 30
  if (pr != null && pr > 0) { const lg = Math.log10(pr); if (lg > 5) a3 = 95; else if (lg >= 4) a3 = 80; else if (lg >= 3) a3 = 65; else if (lg >= 2) a3 = 45; else if (lg >= 1) a3 = 25; else a3 = 10 }
  const M: Record<string, number> = { 'Alta (demanda)': 95, Alta: 90, 'Estavel': 50, 'Estável': 50, Queda: 15 }
  const a4 = sub?.tendencia != null ? (M[sub.tendencia] ?? 50) : 50
  let a5 = 10
  const vh = sub?.val_reserva_brl_ha, ah = p.area_ha
  if (vh != null && ah != null && ah > 0) {
    const vt = vh * ah
    if (vt >= 1e9) a5 = 95
    else if (vt >= 1e8) a5 = 80
    else if (vt >= 1e7) a5 = 60
    else if (vt >= 1e6) a5 = 35
  }
  let t = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  if (sub?.mineral_critico_2025) t = Math.min(100, t + 10)
  return t
}

function opVab(p: ProcessoMotorRow, ls: LayerRow[], cf: number, bnd: boolean) {
  const f = mapFase(p.fase ?? '')
  const b1 = SCORE_FASE_OS[f] ?? 25, b2 = 50, b3m = b3(ls), b4 = p.ativo_derivado === false || f === 'encerrado' ? 5 : 90, b5 = cf0(cf)
  const b6m = fiscalB6(p)
  const b7n = Math.min(100, b7(p.incentivo_b7) + (bnd ? 5 : 0))
  return Math.round(
    b1 * 0.2 + b2 * 0.15 + b3m * 0.15 + b4 * 0.15 + b5 * 0.1 + b6m * 0.1 + b7n * 0.05 + bm0(p.bioma_territorial) * 0.05 + ar0(p.area_ha) * 0.05
  )
}

function opSeg(risk: number, p: ProcessoMotorRow, aut: { count: number }) {
  const c1 = 100 - risk, c2 = p.gu_validade ? 75 : 50, c3 = aut.count ? 50 : 75, c4 = 50
  return Math.round(c1 * 0.5 + c2 * 0.25 + c3 * 0.2 + c4 * 0.05)
}

function pen(v: number, p: ProcessoMotorRow, risk: number, a: number, s: number, g: number, rec: string[], first: boolean) {
  const f = mapFase(p.fase ?? ''), t = (p.situacao ?? '').toLowerCase()
  let o = v
  if (/bloqueio\s*perma|permanen/.test(t)) { o = Math.min(o, 10); if (first) rec.push('Bloqueio permanente (cap 10)') }
  if (f === 'encerrado' || p.ativo_derivado === false) { o = Math.min(o, 20); if (first) rec.push('Encerrado/inativo (cap 20)') }
  if (a >= 95 || s >= 95) { o = Math.min(o, 25); if (first) rec.push('Veto socioambiental (cap 25)') }
  if (t.includes('bloqueio prov')) o *= 0.6
  if (g >= 85) o *= 0.5
  if (t.includes('bloquead')) o *= 0.7
  if (risk >= 80) o *= 0.6
  if (risk >= 90) o *= 0.5
  return Math.min(100, Math.round(o * 10) / 10)
}

function rLab(n: number, ativo: boolean) {
  if (!ativo) return { l: 'Processo extinto', c: '#6B7280' }
  if (n <= 39) return { l: 'Risco baixo', c: '#1D9E75' }
  if (n <= 69) return { l: 'Risco médio', c: '#E8A830' }
  return { l: 'Risco alto', c: '#E24B4A' }
}
function oLab(n: number, ativo: boolean) {
  if (!ativo) return { l: 'N/A - Processo extinto', c: '#6B7280' }
  if (n >= 75) return { l: 'Alta', c: '#1D9E75' }
  if (n >= 50) return { l: 'Moderada', c: '#E8A830' }
  if (n >= 25) return { l: 'Baixa', c: '#888780' }
  return { l: 'Nao recomendado', c: '#E24B4A' }
}

export async function loadProcesso(id: string): Promise<ProcessoMotorRow | null> {
  const s = getSql()
  const rows = (await s`
    SELECT
      p.id, p.numero, p.uf, p.municipio_ibge, p.substancia, p.substancia_familia, p.fase, p.regime,
      p.area_ha, p.app_overlap_pct, p.bioma_territorial, p.ativo_derivado,
      NULL::text AS situacao,
      p.geog,
      p.amb_ti_sobrepoe, p.amb_quilombola_sobrepoe, p.amb_uc_pi_sobrepoe,
      p.amb_assentamento_sobrepoe, p.amb_assentamento_2km,
      p.amb_app_sobrepoe, p.amb_uc_us_5km, p.amb_aquifero_5km,
      p.alvara_validade, p.gu_validade, p.ral_ultimo_data, p.inicio_lavra_data, p.portaria_lavra_data,
      p.pendencias_abertas, p.ultimo_evento_data,
      (SELECT c.nota FROM capag_municipios c WHERE c.municipio_ibge = p.municipio_ibge ORDER BY c.ano DESC NULLS LAST LIMIT 1) AS capag_nota,
      (SELECT f.idh FROM fiscal_municipios f WHERE f.municipio_ibge = p.municipio_ibge ORDER BY f.exercicio DESC NULLS LAST LIMIT 1) AS idh_municipio,
      (SELECT (f2.pib_municipal_mi * 1e6 / NULLIF(f2.populacao,0))::float8 FROM fiscal_municipios f2
        WHERE f2.municipio_ibge = p.municipio_ibge ORDER BY f2.exercicio DESC NULLS LAST LIMIT 1) AS pib_pc_municipio,
      (SELECT f3.densidade FROM fiscal_municipios f3 WHERE f3.municipio_ibge = p.municipio_ibge ORDER BY f3.exercicio DESC NULLS LAST LIMIT 1) AS densidade_demografica,
      (SELECT f4.autonomia_ratio FROM fiscal_municipios f4 WHERE f4.municipio_ibge = p.municipio_ibge ORDER BY f4.exercicio DESC NULLS LAST LIMIT 1) AS autonomia_fiscal_ratio,
      (SELECT f5.receita_tributaria FROM fiscal_municipios f5 WHERE f5.municipio_ibge = p.municipio_ibge ORDER BY f5.exercicio DESC NULLS LAST LIMIT 1) AS receita_tributaria,
      (SELECT f6.divida_consolidada FROM fiscal_municipios f6 WHERE f6.municipio_ibge = p.municipio_ibge ORDER BY f6.exercicio DESC NULLS LAST LIMIT 1) AS divida_consolidada,
      COALESCE(iu.score_b7, (iu.score_incentivo)::float8) AS incentivo_b7
    FROM processos p
    LEFT JOIN incentivos_uf iu ON iu.uf = p.uf
    WHERE p.id = ${id}
  `) as ProcessoMotorRow[]
  return rows[0] ?? null
}
export async function loadLayers(id: string) {
  const s2 = getSql()
  return (await s2`
    SELECT tipo, nome, distancia_km, sobreposicao_pct FROM territorial_layers WHERE processo_id = ${id}
  `) as LayerRow[]
}
export async function loadSub(n: string | null) {
  if (!n?.trim()) return null
  const k = n.trim().toUpperCase()
  if (sessionMassCaches?.subByUpper.size) {
    return sessionMassCaches.subByUpper.get(k) ?? null
  }
  const sx = getSql()
  const r = (await sx`
    SELECT gap_pp, preco_brl, preco_usd, tendencia, val_reserva_brl_ha, mineral_critico_2025
    FROM master_substancias WHERE UPPER(substancia_anm) = UPPER(${n}) LIMIT 1
  `) as SubData[]
  return r[0] ?? null
}
export async function loadCpt(uf: string | null) {
  if (!uf?.trim()) return 1
  const u = uf.trim()
  if (sessionMassCaches?.cptByUf.has(u)) {
    const m = sessionMassCaches.cptByUf.get(u)
    return m != null && Number.isFinite(m) ? m : 1
  }
  try {
    const sx = getSql()
    const r = (await sx`SELECT public.fn_cpt_multiplicador_uf(${uf}::text) AS m`) as { m: string }[]
    return r[0]?.m != null ? Number(r[0].m) : 1
  } catch {
    return 1
  }
}
export async function loadCfem(numero: string) {
  const sx = getSql()
  const r = (await sx`
    SELECT COALESCE(SUM(valor_recolhido),0)::float8 AS t FROM cfem_arrecadacao WHERE processo_numero = ${numero}
  `) as { t: string }[]
  return Number(r[0]?.t ?? 0)
}
export async function loadAutu(num: string) {
  const sx = getSql()
  const r = (await sx`
    SELECT COUNT(*)::int AS c, COALESCE(SUM(COALESCE(valor,0)),0)::float8 AS t FROM cfem_autuacao
    WHERE processo_minerario = ${num} AND (ano_publicacao IS NULL OR ano_publicacao >= EXTRACT(YEAR FROM NOW())::int - 2)
  `) as { c: number; t: string }[]
  return { count: r[0]?.c ?? 0, total: Number(r[0]?.t ?? 0) }
}
type BndesRow = { minerais_elegiveis?: string | null; linha?: string | null }
function bndesRowMatch(sub: string, row: BndesRow): boolean {
  const t = sub.trim()
  if (!t) return false
  const low = t.toLowerCase()
  if (row.minerais_elegiveis != null && String(row.minerais_elegiveis).toLowerCase().includes(low)) return true
  if (row.linha != null && String(row.linha).toLowerCase().includes(low)) return true
  return false
}
export async function loadBndes(sub: string | null) {
  if (!sub?.trim()) return false
  if (sessionMassCaches?.linhasBndes.length) {
    return sessionMassCaches.linhasBndes.some((r) => bndesRowMatch(sub, r))
  }
  const sx = getSql()
  const t = await sx`
    SELECT 1 FROM linhas_bndes WHERE
      (minerais_elegiveis IS NOT NULL AND minerais_elegiveis ILIKE ${'%' + sub + '%'})
      OR (linha IS NOT NULL AND linha ILIKE ${'%' + sub + '%'})
    LIMIT 1
  `
  return (t as unknown[]).length > 0
}

export async function runS31MotorAndPersist(
  processoId: string,
  opts: { persist?: boolean; massCaches?: S31MassCaches } = {},
): Promise<ScoreResult> {
  const prevSess = sessionMassCaches
  const prevCfg = cfgCache
  sessionMassCaches = opts.massCaches ?? null
  const persist = opts.persist === true
  let p: ProcessoMotorRow | null
  let ls: LayerRow[], sub: SubData | null, cpt: number, cfg: Record<string, unknown>, aut: { count: number; total: number }
  let cfe: number, bnd: boolean
  try {
  p = await loadProcesso(processoId)
  if (!p) throw new Error('Processo nao encontrado: ' + processoId)
  if (sessionMassCaches?.incentivoB7ByUf.size && p.uf) {
    const u = p.uf.trim()
    if (sessionMassCaches.incentivoB7ByUf.has(u)) p.incentivo_b7 = sessionMassCaches.incentivoB7ByUf.get(u) ?? null
  }
  ;[ls, sub, cpt, cfg, aut, cfe, bnd] = await Promise.all([
    loadLayers(processoId), loadSub(p.substancia), loadCpt(p.uf), loadConfigScores(),
    loadAutu(p.numero), loadCfem(p.numero), loadBndes(p.substancia),
  ])
  const dg = dimGeologico(p, cfg)
  const da = await dimAmbiental(p, ls)
  const ds = dimSocial(p, ls, cpt)
  const dr = dimRegul(p, aut)
  let risk = dg * 0.25 + da * 0.3 + ds * 0.25 + dr * 0.2

  // PISOs ambientais/sociais (mais restritivos primeiro)
  if (da >= 95 || ds >= 95) risk = Math.max(risk, 80)
  else if (da >= 75 || ds >= 75) risk = Math.max(risk, 60)

  // PISOs regulatórios (calibrado pós-smoke BEMISA 864.231/2017)
  if (dr >= 95) risk = Math.max(risk, 75)
  else if (dr >= 85) risk = Math.max(risk, 65)
  else if (dr >= 70) risk = Math.max(risk, 55)

  risk = Math.min(100, Math.round(risk))
  const oa = opAtr(p, sub, cfg), ov = opVab(p, ls, cfe, bnd), os0 = opSeg(risk, p, aut)
  const pr = 0.2 * oa + 0.3 * ov + 0.5 * os0, pm = 0.4 * oa + 0.3 * ov + 0.3 * os0, pa = 0.55 * oa + 0.25 * ov + 0.2 * os0
  const R: string[] = []
  const at = p.ativo_derivado !== false
  const oc = pen(pr, p, risk, da, ds, dr, R, true), om = pen(pm, p, risk, da, ds, dr, R, false), oa2 = pen(pa, p, risk, da, ds, dr, R, false)
  // Colunas `scores.os_*` no Postgres: inteiro 0-100
  const ocI = Math.round(oc), omI = Math.round(om), oa2I = Math.round(oa2)
  const rI = rLab(risk, at)
  const cL = oLab(oc, at), mL = oLab(om, at), aL = oLab(oa2, at)
  const osU = om >= 70 ? 'Alta' : om >= 40 ? 'Média' : 'Baixa'
  const dimR = { geologico: { valor: dg, subfatores: [] as unknown[] }, ambiental: { valor: da, subfatores: [] }, social: { valor: ds, subfatores: [] }, regulatorio: { valor: dr, subfatores: [] } }
  const dimO = { atratividade: { valor: oa, subfatores: [] }, viabilidade: { valor: ov, subfatores: [] }, seguranca: { valor: os0, subfatores: [] }, penalidades: R }
  const dimRJson = JSON.parse(JSON.stringify(dimR)) as JSONValue
  const dimOJson = JSON.parse(JSON.stringify(dimO)) as JSONValue
  const s = getSql()
  if (persist) {
    const ex = (await s`SELECT scores_fonte FROM scores WHERE processo_id = ${processoId} LIMIT 1`) as { scores_fonte: string | null }[]
    const skip = ex[0]?.scores_fonte?.startsWith('manual_') ?? false
    if (!skip) {
      await s`
        INSERT INTO scores (processo_id, risk_score, risk_label, risk_cor, os_conservador, os_moderado, os_arrojado, os_label, os_classificacao,
          dimensoes_risco, dimensoes_oportunidade, calculated_at, scores_fonte)
        VALUES (${processoId}::uuid, ${risk}, ${rI.l}, ${rI.c}, ${ocI}, ${omI}, ${oa2I}, ${osU}, ${osU},
          ${s.json(dimRJson)}::jsonb, ${s.json(dimOJson)}::jsonb, NOW(), 's31_v3_20260427')
        ON CONFLICT (processo_id) DO UPDATE SET
          risk_score = EXCLUDED.risk_score, risk_label = EXCLUDED.risk_label, risk_cor = EXCLUDED.risk_cor,
          os_conservador = EXCLUDED.os_conservador, os_moderado = EXCLUDED.os_moderado, os_arrojado = EXCLUDED.os_arrojado,
          os_label = EXCLUDED.os_label, os_classificacao = EXCLUDED.os_classificacao,
          dimensoes_risco = EXCLUDED.dimensoes_risco, dimensoes_oportunidade = EXCLUDED.dimensoes_oportunidade,
          calculated_at = NOW(), scores_fonte = 's31_v3_20260427'
      `
    }
  }
  return {
    risk_score: risk, risk_label: rI.l, risk_cor: rI.c,
    risk_breakdown: { geologico: dg, ambiental: da, social: ds, regulatorio: dr },
    os_conservador: ocI, os_moderado: omI, os_arrojado: oa2I,
    os_label_conservador: cL.l, os_label_moderado: mL.l, os_label_arrojado: aL.l,
    os_breakdown: { atratividade: oa, viabilidade: ov, seguranca: os0 },
    detail: {
      scoreSubstancia: pickSubScore(p.substancia, null), scoreFase: SCORE_FASE_OS[mapFase(p.fase ?? '')] ?? 25, scoreQualidade: 50,
      scoreComunidades: 0, scoreCAPAG_rs: 0, scoreCaducidade: 0, scoreRegTempo: 0, scoreRegPendencias: 0, scoreRegAlertas: 0,
      a1:0,a2:0,a3:0,a4:0,a5:0, b1:0,b2:0,b3:0,b4:0,b5:0,b6:0,b7:0, c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,
    },
    fallbacks_usados: ['s31_v3_20260427'],
  }
  } finally {
    sessionMassCaches = prevSess
    cfgCache = prevCfg
  }
}
