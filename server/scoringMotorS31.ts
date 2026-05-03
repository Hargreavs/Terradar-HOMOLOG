/**
 * S31 v5 - Risk + OS motor (Node + postgres.js + config_scores).
 * v5: territorial extras (sítio IPHAN + assentamento INCRA) + TAH regulatório. Modelo base v4.
 */
import './env'
import postgres, { type JSONValue } from 'postgres'
import type { ScoreResult } from './scoreEngine'
import type { DimensaoOutput, SubfatorOutput } from './scoringS31BreakdownTypes'

export type { DimensaoOutput, SubfatorOutput } from './scoringS31BreakdownTypes'

function fmtKm(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
/** Preço em BRL/t (não usar fmtKm para preço). */
function fmtPrecoBrlPorTon(n: number): string {
  return (
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + '/t'
  )
}


function classifyLabelRisk(bruto0_100: number): string {
  if (bruto0_100 < 40) return 'Risco baixo'
  if (bruto0_100 < 70) return 'Risco médio'
  return 'Risco alto'
}

function classifyLabelOpp(bruto0_100: number): string {
  if (bruto0_100 < 25) return 'Oportunidade baixa'
  if (bruto0_100 < 50) return 'Oportunidade média'
  if (bruto0_100 < 75) return 'Oportunidade alta'
  return 'Oportunidade muito alta'
}

function biomaCoef(b: string | null | undefined): number {
  if (!b) return 1
  const k = b.trim()
  const o: Record<string, number> = {
    Amazonia: 1.3,
    'Amazônia': 1.3,
    'MATA ATLANTICA': 1.2,
    'MATA ATLÂNTICA': 1.2,
    Pantanal: 1.25,
    Cerrado: 1.1,
    Caatinga: 1,
    Pampa: 1,
  }
  return o[k] ?? 1
}

function warnCoerenciaDimensao(label: string, d: DimensaoOutput) {

  const ponderados = d.subfatores.filter((r) => r.peso_pct != null)

  const residuais = d.subfatores.filter((r) => r.peso_pct == null)

  const somaPond = ponderados.reduce((s, r) => s + r.valor, 0)

  const somaResidual = residuais.reduce((s, r) => s + r.valor, 0)

  if (Math.abs(somaPond + somaResidual - d.valor) > 0.501)

    console.warn(

      '[scoringMotorS31] Coerência ' +

        label +

        ': ponderados=' +

        somaPond.toFixed(3) +

        ' + ajuste=' +

        somaResidual.toFixed(3) +

        ' vs dimensão.valor=' +

        d.valor,

    )

}



const fmtBr1 = (n: number) =>

  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n)



function textoRegulPendencias(n: number | null): string {

  const c =

    n != null && Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : null

  if (c == null || c <= 0) return 'Sem pendências administrativas em aberto no retrato atual do cadastro.'

  if (c === 1)

    return 'Há uma pendência administrativa em aberto segundo o retrato atual do cadastro público.'

  return `Há ${c} pendências administrativas em aberto segundo o retrato atual do cadastro público.`

}



function textoRegulCaducidade(dCad: number | null): string {

  if (dCad == null)

    return 'Prazos de validade incompletos no cadastro ou sem data objetiva aqui — situação examinada com o regime declarado.'

  if (dCad < 0) return 'Documentação obrigatória aparece já vencida na linha temporal do cadastro.'

  return `Documentação obrigatória com cerca de ${Math.round(dCad)} dias até a data‑limite tratada pelo cadastro.`

}



function textoRegulUltimaMov(dias: number | null): string {

  if (dias == null) return 'Data do último evento público não consolidada aqui.'

  return `Última movimentação pública há cerca de ${Math.round(dias)} dias segundo o último evento disponível.`

}



function textoRegulCapag(notaRaw: string | null | undefined): string {

  if (notaRaw != null && String(notaRaw).trim().length > 0)

    return `Situação fiscal municipal segundo nota declarada (${String(notaRaw).trim()}) nos critérios oficiais de capacidade de pagamento do ente.`

  return 'Nota técnico‑fiscal do ente local não declarada aqui; cenário tratado como neutro.'

}



const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
let _sql: ReturnType<typeof postgres> | null = null
function getSql() {
  if (!dbUrl) throw new Error('DATABASE_URL or VITE_DATABASE_URL required for S31')
  if (!_sql) {
    _sql = postgres(dbUrl, {
      max: 20,
      idle_timeout: 30,
      max_lifetime: 60 * 5,
      connect_timeout: 30,
      prepare: false,
      ssl: /supabase|amazonaws/i.test(dbUrl) ? 'require' : false,
      connection: {
        statement_timeout: 60_000,
        idle_in_transaction_session_timeout: 60_000,
        application_name: 'batch-scores-s31-v5',
      },
    })
  }
  return _sql
}

/** URL Postgres direct (5432) para batch; fallback conserva CI quando só DATABASE_URL existe. */
const batchDbUrl =
  process.env.DATABASE_URL_BATCH ??
  process.env.DATABASE_URL ??
  process.env.VITE_DATABASE_URL
let _sqlBatch: ReturnType<typeof postgres> | null = null

/**
 * Pool dedicado ao batch (ligação direct ao PostgreSQL, não transaction pooler 6543).
 * Usar só em `batch-scores.ts` via `runS31MotorAndPersist(..., { sqlClient: getSqlBatch() })`.
 */
export function getSqlBatch() {
  if (!batchDbUrl)
    throw new Error(
      'DATABASE_URL_BATCH or DATABASE_URL or VITE_DATABASE_URL required for batch SQL',
    )
  if (!_sqlBatch) {
    _sqlBatch = postgres(batchDbUrl, {
      max: 10,
      idle_timeout: 60,
      connect_timeout: 30,
      max_lifetime: 60 * 30,
      ssl: /supabase|amazonaws/i.test(batchDbUrl) ? 'require' : false,
      connection: {
        statement_timeout: 60_000,
        idle_in_transaction_session_timeout: 60_000,
        application_name: 'batch-scores-direct',
      },
    })
  }
  return _sqlBatch
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

/** Linha 1:1 de `processos_territorial_extras` (batch territorial). */
export type LayerExtrasRow = {
  sitio_id: number | null
  sitio_nome: string | null
  sitio_distancia_km: number | null
  sitio_tipo: string | null
  sitio_natureza: string | null
  sitio_sobreposicao_pct: number | null
  assent_id: number | null
  assent_nome: string | null
  assent_distancia_km: number | null
  assent_sobreposicao_pct: number | null
}

/** Agregado `tah_pagamentos` por processo (ANM). */
export type TahStatusRow = {
  pct_pago: number
  qtd_pagamentos: number
  qtd_nao_pagos: number
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
  /** Opcional: mapa por `processo_id` (uuid string) para batch sem N+1. */
  extrasByProcessoId?: Map<string, LayerExtrasRow>
  /** Opcional: agregado TAH por `processo_numero`. */
  tahByProcessoNumero?: Map<string, TahStatusRow>
}

let sessionMassCaches: S31MassCaches | null = null

const FASE_MAP: Record<string, string> = {
  'CONCESSAO DE LAVRA': 'concessao',
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
  const k = f.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim()
  return FASE_MAP[k] ?? 'requerimento'
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

/** Validade da GU: gradiente por dias até/ após vencimento (Mudança 1). */
function c2GuValidade(guValidade: string | null | undefined): number {
  if (guValidade == null || String(guValidade).trim() === '') return 50
  const v = new Date(String(guValidade))
  if (Number.isNaN(v.getTime())) return 50
  const dias = Math.floor((v.getTime() - Date.now()) / MS_DIA)
  if (dias < -90) return 25
  if (dias < 0) return 35
  if (dias < 90) return 60
  if (dias <= 365) return 75
  return 85
}

/** Qualidade cadastral a partir de CFEM, início de lavra e RAL (Mudança 4). */
function scoreQualOperacaoReal(p: ProcessoMotorRow, cfemTotal: number): number {
  let score = 30
  if (cfemTotal > 1e6) score = 85
  else if (cfemTotal > 0) score = 70
  if (p.inicio_lavra_data != null && String(p.inicio_lavra_data).trim() !== '')
    score = Math.max(score, 75)
  const ralDias = diasDesde(p.ral_ultimo_data)
  if (ralDias != null && ralDias < 365) score = Math.max(score, 70)
  return score
}

/** Autuações: magnitude domina; reincidência até +30% (Mudança 2). */
function aut0(n: number, t: number): number {
  if (n === 0) return 0
  let baseValor = 15
  if (t >= 1e8) baseValor = 90
  else if (t >= 1e7) baseValor = 70
  else if (t >= 1e6) baseValor = 50
  else if (t >= 1e5) baseValor = 30
  const fatorN = Math.min(1.3, 1 + 0.05 * Math.min(Math.max(0, n - 1), 6))
  return Math.min(100, Math.round(baseValor * fatorN))
}

/** Histórico de cumprimento / autuações para opSeg c3 (Mudança 3). */
function c3HistoricoCumprimento(aut: { count: number; total: number }): number {
  if (aut.count === 0) return 85
  if (aut.total >= 1e7) return 20
  if (aut.total >= 1e6) return 35
  if (aut.count >= 3 && aut.total < 1e6) return 40
  return 55
}

function b2ProfundidadeDado(p: ProcessoMotorRow, fase: string): number {
  if (fase === 'lavra') return 80
  if (fase === 'concessao') return 65
  if (fase === 'pesquisa') {
    const d = diasDesde(p.ultimo_evento_data)
    if (d == null) return 40
    if (d > 730) return 60
    if (d > 365) return 50
    return 35
  }
  if (fase === 'requerimento') return 25
  return 30
}

/** Situação operacional com gradiente; `situacao` null trata como ativo regular (Mudança 6). */
function b4SituacaoGradiente(p: ProcessoMotorRow, fase: string): number {
  if (p.ativo_derivado === false || fase === 'encerrado') return 5
  const raw = (p.situacao ?? '').toLowerCase()
  if (!raw) return 90
  if (raw.includes('bloqueio perma')) return 10
  if (raw.includes('bloqueio prov')) return 25
  if (raw.includes('bloquead')) return 40
  if (raw.includes('suspens')) return 50
  if (raw.includes('exig')) return 60
  if (raw.includes('aguard')) return 70
  return 90
}

function b7_v2(scoreB7: number | null): number {
  if (scoreB7 == null) return 15
  return Math.min(100, Math.max(0, scoreB7))
}

export type AlertaDirecionadoRow = { categoria: string; dias_desde: number }

function sa2_v2(alertas: AlertaDirecionadoRow[]): number {
  if (!alertas.length) return 0
  const pesoCat = (cat: string): number => {
    const u = cat.trim().toUpperCase()
    if (u.includes('CRIT')) return 85
    if (u.includes('DESFAVOR')) return 60
    if (u.includes('NEUTRO')) return 0
    if (u.includes('POSITIV')) return -20
    if (u.includes('FAVOR')) return -10
    return 0
  }
  let soma = 0
  for (const a of alertas) {
    const w = pesoCat(a.categoria)
    let decay = 0
    if (a.dias_desde <= 90) decay = 1
    else if (a.dias_desde <= 365) decay = 0.5
    else decay = 0
    soma += w * decay
  }
  return Math.max(0, Math.min(100, soma))
}

function c4_v2(sa2: number): number {
  return Math.max(0, Math.min(100, 50 - sa2 / 2))
}

/** CPT municipal severo/alto/moderado ou fallback UF (reformula dimSocial). */
function scoreCptSocial(cptUf: number, cptMunicipio: string | null): number {
  if (cptMunicipio != null) {
    const m = cptMunicipio.trim().toLowerCase()
    if (m === 'severo') return 90
    if (m === 'alto') return 65
    if (m === 'moderado') return 35
  }
  return Math.min(100, Math.max(0, 30 + 70 * (cptUf - 1)))
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
export async function loadConfigScores(
  sql?: ReturnType<typeof postgres>,
): Promise<Record<string, unknown>> {
  if (sessionMassCaches) return sessionMassCaches.configByAba
  if (cfgCache) return cfgCache
  const s = sql ?? getSql()
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

export function dimGeologico(
  p: ProcessoMotorRow,
  cfg: Record<string, unknown> | null,
  cfemTotal: number,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const scoreSubst = pickSubScore(p.substancia, cfg)
  const scoreQual = scoreQualOperacaoReal(p, cfemTotal)
  const valor = Math.min(100, Math.round(0.5 * scoreSubst + scoreQual * 0.5))
  if (!options?.returnSubfatores) return valor
  const txtQual =
    cfemTotal > 1e6
      ? `CFEM histórica elevada (${fmtBr1(cfemTotal)}); qualidade operacional mapeada em ${fmtKm(scoreQual)}.`
      : cfemTotal > 0
        ? `CFEM histórica positiva (${fmtBr1(cfemTotal)}); referência ${fmtKm(scoreQual)}.`
        : p.inicio_lavra_data
          ? `Início de lavra declarado; score qualidade ${fmtKm(scoreQual)} (RAL/CFEM quando aplicável).`
          : diasDesde(p.ral_ultimo_data) != null && (diasDesde(p.ral_ultimo_data) ?? 999) < 365
            ? `RAL recente; qualidade documental/operacional ${fmtKm(scoreQual)}.`
            : `Qualidade da informação cadastral e produção declarada (CFEM ${fmtBr1(cfemTotal)}): ${fmtKm(scoreQual)}.`
  const sf: SubfatorOutput[] = [
    {
      nome: 'Substância mineral',
      fonte: 'ANM/config_scores (2_RS_GEOLOGICO)',
      label: classifyLabelRisk(scoreSubst),
      texto:
        p.substancia != null && String(p.substancia).trim().length > 0
          ? `Substância declarada: "${String(p.substancia)}". Índice de relevância minerária ${fmtKm(scoreSubst)}.`
          : 'Substância não informada; cadastro tratado aqui como neutro.',
      valor: scoreSubst * 0.5,
      peso_pct: 0.5,
      valor_bruto: scoreSubst,
    },
    {
      nome: 'Qualidade da informação cadastral',
      fonte: 'CFEM + início lavra + RAL (motor S31 v4)',
      label: classifyLabelRisk(scoreQual),
      texto: txtQual,
      valor: scoreQual * 0.5,
      peso_pct: 0.5,
      valor_bruto: scoreQual,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Geológico', out)
  return out
}

export async function dimAmbiental(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  extras: LayerExtrasRow | null,
  options?: { returnSubfatores?: boolean },
): Promise<number | DimensaoOutput> {
  const want = !!options?.returnSubfatores
  const subs: SubfatorOutput[] = []
  const t1 = ls.find(ti)
  const q1 = ls.find(qx)
  const ucp = ls.filter(ucpi)
  const tiS = p.amb_ti_sobrepoe === true || ovl(ls, ti, 100)
  const qS = p.amb_quilombola_sobrepoe === true || ovl(ls, qx, 100)
  const uS = p.amb_uc_pi_sobrepoe === true || ucp.some((u) => (u.sobreposicao_pct ?? 0) >= 100)

  const fonteMix = 'ICMBio/FUNAI/INCRA/ANA + territorial_layers + SQL interno'
  const pushBio = (preBio: number, valorFinal: number) => {
    if (!want) return
    const coef = biomaCoef(p.bioma_territorial)
    subs.push({
            nome: 'Multiplicador de bioma',

      fonte: 'IBGE/bioma_territorial',

      label: '',

      texto:

        p.bioma_territorial != null && String(p.bioma_territorial).trim().length > 0

          ? `${String(p.bioma_territorial).trim()}: multiplicador ${fmtBr1(coef)}× sobre os pontos ambientais brutos (antes do teto aplicado).`

          : `Bioma não informado ao cadastro; multiplicador 1,0× sobre os pontos ambientais brutos.`,

      valor: valorFinal - preBio,

      peso_pct: null,

      valor_bruto: coef,

    })
  }

  if (tiS || qS || uS) {
    const preBio = 100
    const valorFinal = biomaMult(100, p.bioma_territorial)
    if (!want) return valorFinal
    const partes: string[] = []
    if (tiS) partes.push('sobreposição com Terra Indígena homologada ou camada equivalente')
    if (qS) partes.push('sobreposição com comunidade quilombola ou camada equivalente')
    if (uS) partes.push('sobreposição com UC de Proteção Integral ou camada equivalente')
    subs.push({
      nome: 'Sobreposição ambiental (teto 100 antes do bioma)',
      fonte: fonteMix,
      label: classifyLabelRisk(100),
      texto: partes.length > 0 ? partes.join('; ') + '.' : 'Vetor de sobreposição calculado.',
      valor: preBio,
      peso_pct: 1,
      valor_bruto: 100,
    })
    pushBio(preBio, valorFinal)
    const out: DimensaoOutput = { valor: valorFinal, subfatores: subs }
    warnCoerenciaDimensao('Ambiental', out)
    return out
  }

  let pt = 0

  const pushDelta = (row: SubfatorOutput) => {
    if (row.valor === 0) return
    pt += row.valor
    if (want) subs.push(row)
  }

  if (t1 && !tiS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (t1.distancia_km <= 5) {
      delta = 50
      bruto = 50
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 5 km).`
    } else if (t1.distancia_km <= 10) {
      delta = 30
      bruto = 30
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 10 km).`
    } else if (t1.distancia_km <= 20) {
      delta = 15
      bruto = 15
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 20 km).`
    }
    pushDelta({
      nome: 'Proximidade a Terra Indígena',
      fonte: 'FUNAI/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto:
        delta > 0
          ? txt
          : `Sem proximidade em faixa de pontuação; mais próximo: ${fmtKm(t1.distancia_km)} km.`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  const umin = ucp.length ? Math.min(...ucp.map((u) => u.distancia_km)) : Number.POSITIVE_INFINITY
  const ucNear = ucp.length ? ucp.reduce((a, b) => (a.distancia_km <= b.distancia_km ? a : b)) : null
  if (Number.isFinite(umin) && !uS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (umin <= 5) {
      delta = 40
      bruto = 40
      txt = `${ucNear?.nome ?? 'UC PI'} a ${fmtKm(umin)} km (≤ 5 km).`
    } else if (umin <= 10) {
      delta = 20
      bruto = 20
      txt = `${ucNear?.nome ?? 'UC PI'} a ${fmtKm(umin)} km (≤ 10 km).`
    } else txt = `Sem UC de Proteção Integral próxima em faixa pontuada (${fmtKm(umin)} km).`
    pushDelta({
      nome: 'UC Proteção Integral próxima',
      fonte: 'ICMBio/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : `Sem pontos: distância ${fmtKm(umin)} km.`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  if (q1 && !qS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (q1.distancia_km <= 5) {
      delta = 45
      bruto = 45
      txt = `${q1.nome ?? 'Território quilombola'} a ${fmtKm(q1.distancia_km)} km (≤ 5 km).`
    } else if (q1.distancia_km <= 10) {
      delta = 25
      bruto = 25
      txt = `${q1.nome ?? 'Território quilombola'} a ${fmtKm(q1.distancia_km)} km (≤ 10 km).`
    }
    pushDelta({
      nome: 'Proximidade a território quilombola',
      fonte: 'INCRA/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : `Sem quilombola em faixa pontuada (${fmtKm(q1.distancia_km)} km).`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  // Sítio (IPHAN): lei `processos_territorial_extras` — mesma régua de faixas que geo_sitios (v4).
  if (extras?.sitio_distancia_km != null) {
    const dKm = Number(extras.sitio_distancia_km)
    if (Number.isFinite(dKm)) {
      const nome = extras.sitio_nome?.trim() || 'sítio arqueológico'
      let dkPts = 0
      let lim = ''
      if (dKm <= 1) {
        dkPts = 30
        lim = '≤1 km'
      } else if (dKm <= 5) {
        dkPts = 15
        lim = '≤5 km'
      }
      if (dkPts > 0)
        pushDelta({
          nome: 'Sítio arqueológico',
          fonte: 'IPHAN/processos_territorial_extras',
          label: classifyLabelRisk(dkPts),
          texto: `${nome} a ${fmtKm(dKm)} km (${lim}).`,
          valor: dkPts,
          peso_pct: 1,
          valor_bruto: dkPts,
        })
    }
  }

  const ap = p.app_overlap_pct
  if (ap != null) {
    let delta = 0
    if (ap > 10) delta = 25
    else if (ap >= 1) delta = 15
    else if (ap > 0) delta = 8
    pushDelta({
      nome: 'APP hídrica',
      fonte: 'ANA/geo_processos/overlap_pct',
      label: classifyLabelRisk(delta),
      texto:
        delta > 0
          ? `Sobreposição com APP ${fmtKm(ap)}%`
          : 'Sem sobreposição APP registrada sobre limiares de pontuação.',
      valor: delta,
      peso_pct: 1,
      valor_bruto: delta,
    })
  } else if (p.amb_app_sobrepoe)
    pushDelta({
      nome: 'APP hídrica',
      fonte: 'flags processo/motor',
      label: classifyLabelRisk(8),
      texto: 'Sobreposição com APP identificada no cadastro.',
      valor: 8,
      peso_pct: 1,
      valor_bruto: 8,
    })

  const usL = ls.filter((l) => uucs(l))
  if (usL.some((u) => (u.sobreposicao_pct ?? 0) > 0))
    pushDelta({
      nome: 'UC Uso Sustentável próxima (sobreposição)',
      fonte: 'ICMBio/territorial_layers',
      label: classifyLabelRisk(20),
      texto: 'Sobreposição com UC Uso Sustentável / APA etc.',
      valor: 20,
      peso_pct: 1,
      valor_bruto: 20,
    })
  else {
    const x = mine(ls, (l) => uucs(l) && !ucpi(l))
    if (Number.isFinite(x) && x <= 5)
      pushDelta({
        nome: 'UC Uso Sustentável próxima',
        fonte: 'ICMBio/territorial_layers',
        label: classifyLabelRisk(10),
        texto: `Infraestrutura UC/US a ${fmtKm(x)} km (≤ 5 km); sem sobrep. positiva.`,
        valor: 10,
        peso_pct: 1,
        valor_bruto: 10,
      })
  }

  const beforeFloor = pt
  if (p.amb_uc_us_5km) pt = Math.max(pt, 10)
  const flo = pt - beforeFloor
  if (want && flo > 0)
    subs.push({
      nome: 'Piso de proximidade UC Uso Sustentável (5 km)',
      fonte: 'flags territorial',
      label: classifyLabelRisk(10),
      texto: `Infraestrutura de UC ou US a até 5 km do polígono: piso mínimo (+${fmtKm(flo)}) sem alteração da soma além da própria regra.`,
      valor: flo,
      peso_pct: 1,
      valor_bruto: 10,
    })

  const a = ls.find(aqu)
  if (a) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if ((a.sobreposicao_pct ?? 0) > 0) {
      delta = 15
      bruto = 15
      txt = 'Sobreposição com aquífero.'
    } else if (a.distancia_km <= 1) {
      delta = 10
      bruto = 10
      txt = `Aquífero a ${fmtKm(a.distancia_km)} km (≤ 1 km).`
    } else if (a.distancia_km <= 5) {
      delta = 5
      bruto = 5
      txt = `Aquífero a ${fmtKm(a.distancia_km)} km (≤ 5 km).`
    }
    pushDelta({
      nome: 'Aquífero subjacente',
      fonte: 'ANA/camadas hidrogeológicas',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : 'Sem aquífero em faixa pontuada.',
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  } else if (p.amb_aquifero_5km)
    pushDelta({
      nome: 'Aquífero subjacente',
      fonte: 'flags territorial',
      label: classifyLabelRisk(5),
      texto: 'Aquífero a até 5 km do polígono.',
      valor: 5,
      peso_pct: 1,
      valor_bruto: 5,
    })

  const rawLin = pt
  const preBio = Math.min(100, rawLin)
  if (want && rawLin > 100)
    subs.push({
      nome: 'Teto da soma linear (100 pontos)',
      fonte: 'Regra motor S31 ambiental',
      label: '',
      texto: `Soma linear ${fmtKm(rawLin)} limitada a 100 antes do bioma.`,
      valor: preBio - rawLin,
      peso_pct: 1,
      valor_bruto: preBio - rawLin,
    })

  const valorFinal = biomaMult(preBio, p.bioma_territorial)
  if (!want) return valorFinal

  pushBio(preBio, valorFinal)
  const out: DimensaoOutput = { valor: valorFinal, subfatores: subs }
  warnCoerenciaDimensao('Ambiental', out)
  return out
}

/** Sobreposição assent INCRA em `processos_territorial_extras` (PG pode devolver string/decimal). */
function assentamentoSobrepoeEmExtras(extras: LayerExtrasRow | null): boolean {
  const raw = extras?.assent_sobreposicao_pct
  if (raw == null) return false
  const n = Number(raw)
  return Number.isFinite(n) && n >= 99.5
}

/** Hierarquia TI/quilombola/assentamento e gradiente de distância (v5: assentamento via extras). */
function cmu_v2(p: ProcessoMotorRow, ls: LayerRow[], extras: LayerExtrasRow | null) {
  if (p.amb_ti_sobrepoe) return 95
  if (p.amb_quilombola_sobrepoe) return 90

  if (assentamentoSobrepoeEmExtras(extras)) return 80

  const dTi = mine(ls, ti)
  const dQx = mine(ls, qx)
  if (dTi < 2 || dQx < 2) return 85
  if (dTi < 5 || dQx < 5) return 65

  const assentDistKm =
    extras?.assent_distancia_km != null && Number.isFinite(Number(extras.assent_distancia_km))
      ? Number(extras.assent_distancia_km)
      : null
  // 0 km com pct≠100 cai aqui: não usar faixa ≤2 km (evita 60 quando sobrepõe mas dist arredondou a 0).
  if (assentDistKm != null && assentDistKm > 0 && assentDistKm <= 2) return 60

  if (dTi < 10 || dQx < 10) return 40
  if (dTi < 20 || dQx < 20) return 20
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

export function dimSocial(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  cptUf: number,
  cptMunicipio: string | null,
  extras: LayerExtrasRow | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const c1 = cmu_v2(p, ls, extras)
  const c2 = Math.round(0.5 * idh0(p.idh_municipio) + 0.5 * pib0(p.pib_pc_municipio))
  const c3 = scoreCptSocial(cptUf, cptMunicipio)
  const c4 = dns(p.densidade_demografica)
  const valor = Math.min(100, Math.round(c1 * 0.45 + c2 * 0.2 + c3 * 0.2 + c4 * 0.15))
  if (!options?.returnSubfatores) return valor
  const v1 = c1 * 0.45
  const v2 = c2 * 0.2
  const v3 = c3 * 0.2
  const v4 = c4 * 0.15
  const sumW = v1 + v2 + v3 + v4
  const ufS = (p.uf ?? '').trim()

  const cptUfLabel = fmtKm(cptUf)
  const munNorm = cptMunicipio != null ? cptMunicipio.trim().toLowerCase() : ''
  const munTxt =
    munNorm === 'severo'
      ? 'CPT municipal em nível severo.'
      : munNorm === 'alto'
        ? 'CPT municipal em nível alto.'
        : munNorm === 'moderado'
          ? 'CPT municipal em nível moderado.'
          : ''

  const textoCpt =
    munTxt.length > 0
      ? `${munTxt} Incidências estaduais (multiplicador UF ${cptUfLabel}) entram como referência secundária.`
      : ufS.length > 0
        ? `Incidentes de conflitos no campo listados pelo CPT para o estado ${ufS.toUpperCase()} (multiplicador UF ${cptUfLabel}; sem nível municipal consolidado).`
        : `Incidentes de conflitos no campo segundo cadastro CPT (UF não informada); multiplicador UF ${cptUfLabel}.`

  const den = p.densidade_demografica

  const textoDen =

    den != null && Number.isFinite(den)

      ? `Adensamento humano na área urbana habitual (~${fmtBr1(den)} hab/km²).`

      : 'Densidade municipal não declarada ao motor; cenário tratado aqui como adensamento baixo‑moderado.'



  const sf: SubfatorOutput[] = [

    {

      nome: 'Comunidades vulneráveis',

      fonte: 'FUNAI/INCRA/ICMBio — malhas territoriais',

      label: classifyLabelRisk(c1),

      texto:

        `Proximidade ou sobreposição com terras indígenas, quilombolas e demais territórios em situação de vulnerabilidade institucional, segundo distâncias calculadas sobre a malha vigente.`,

      valor: v1,

      peso_pct: 0.45,

      valor_bruto: c1,

    },

    {

      nome: 'Socioeconômico do município',

      fonte: 'IBGE — IDH municipal e PIB/hab.',

      label: classifyLabelRisk(c2),

      texto:

        `Condição socioeconômica sintetizada pelo IDH municipal e pela renda per capita oficialmente divulgada.`,

      valor: v2,

      peso_pct: 0.2,

      valor_bruto: c2,

    },

    {

      nome: 'Conflitos territoriais (CPT)',

      fonte: 'CPT — registros municipais e estaduais',

      label: classifyLabelRisk(c3),

      texto: textoCpt,

      valor: v3,

      peso_pct: 0.2,

      valor_bruto: c3,

    },

    {

      nome: 'Densidade demográfica',

      fonte: 'IBGE — densidade municipal',

      label: classifyLabelRisk(c4),

      texto: textoDen,

      valor: v4,

      peso_pct: 0.15,

      valor_bruto: c4,

    },

  ]

  if (options?.returnSubfatores && extras) {
    const distKm =
      extras.assent_distancia_km != null && Number.isFinite(Number(extras.assent_distancia_km))
        ? Number(extras.assent_distancia_km)
        : null
    const sobrep = assentamentoSobrepoeEmExtras(extras)
    const nome = extras.assent_nome?.trim() || 'Assentamento INCRA'

    let texto: string
    let valorPontos: number

    if (sobrep) {
      texto = `${nome} (sobreposição)`
      valorPontos = 80
    } else if (distKm != null && distKm <= 2) {
      texto = `${nome} a ${fmtKm(distKm)} km (≤2 km)`
      valorPontos = 60
    } else if (distKm != null && distKm <= 10) {
      texto = `${nome} a ${fmtKm(distKm)} km (zona distante)`
      valorPontos = 0
    } else if (distKm != null) {
      texto = `${nome} a ${fmtKm(distKm)} km (sem impacto)`
      valorPontos = 0
    } else {
      texto = 'Sem dado de assentamento'
      valorPontos = 0
    }

    sf.push({
      nome: 'Assentamento INCRA',
      label: 'Vulnerabilidade institucional',
      texto,
      valor: valorPontos,
      peso_pct: null,
      valor_bruto: valorPontos,
      fonte: 'INCRA / processos_territorial_extras',
    })
  }

  const adj = valor - sumW

  if (Math.abs(adj) > 1e-6) {

    sf.push({

      nome: 'Ajuste consolidador social',

      fonte: 'arredondamento do índice da dimensão',

      label: '',

      texto: `Diferença de ${fmtBr1(adj)} para reconciliar o índice exibido com o arredondamento aplicado à combinação anterior (${fmtBr1(sumW)}).`,

      valor: adj,

      peso_pct: null,

      valor_bruto: adj,

    })

  }

  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Social', out)
  return out
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

export function dimRegul(

  p: ProcessoMotorRow,

  aut: { count: number; total: number },

  alertas: AlertaDirecionadoRow[],

  tah: TahStatusRow | null,

  options?: { returnSubfatores?: boolean },

): number | DimensaoOutput {

  const f = mapFase(p.fase ?? '')

  const pendN = p.pendencias_abertas != null ? Number(p.pendencias_abertas) : null

  const sp = p0(pendN != null ? pendN : 0)

  const dCad = diasAteCaducidade(p.alvara_validade, p.regime)

  const diasUlt = diasDesde(p.ultimo_evento_data)

  const sc = c0(dCad, p.regime, f)

  const st = t0(diasUlt)

  const sa = aut0(aut.count, aut.total)

  const sa2 = sa2_v2(alertas)

  const cp = capagScore(p.capag_nota)

  const tahRaw = scoreTahInadimplencia(tah)

  let v = sp * 0.25 + sc * 0.2 + sa * 0.2 + st * 0.1 + sa2 * 0.1 + cp * 0.15 + tahRaw

  if (sa >= 80 && sa2 >= 80) v = Math.max(v, 90)
  else if (sc >= 95 || sa >= 90) v = Math.max(v, 85)
  else if (sc >= 90 || sa >= 60) v = Math.max(v, 70)

  const valor = Math.min(100, Math.round(v * 10) / 10)

  if (!options?.returnSubfatores) return valor

  const p1 = sp * 0.25

  const p2 = sc * 0.2

  const p3 = sa * 0.2

  const p4 = st * 0.1

  const p5 = sa2 * 0.1

  const p6 = cp * 0.15

  const p7 = tahRaw

  const sumP = p1 + p2 + p3 + p4 + p5 + p6 + p7

  const adj = valor - sumP

  const textoAlertasDou =
    alertas.length === 0
      ? 'Nenhum alerta DOU direto (citação explícita ou CNPJ) ligado a este processo no Radar IA na janela vigente.'
      : `Alertas DOU diretos: ${alertas.length} evento(s); índice composto ${fmtKm(sa2)} com decaimento temporal por categoria.`

  const tahTexto =
    tah == null
      ? 'Sem registro TAH'
      : tah.pct_pago >= 100
        ? `TAH 100% paga (${tah.qtd_pagamentos} pagamento${tah.qtd_pagamentos === 1 ? '' : 's'})`
        : `TAH ${tah.pct_pago.toFixed(1)}% paga · ${tah.qtd_nao_pagos} pendente${tah.qtd_nao_pagos === 1 ? '' : 's'}`

  const tahLabel =
    tahRaw === 0 ? 'Em dia' : tahRaw <= 10 ? 'Atraso recente' : tahRaw <= 25 ? 'Inadimplência relevante' : 'Inadimplência grave'

  const sf: SubfatorOutput[] = [

    {

      nome: 'Pendências abertas',

      fonte: 'cadastro público da ANM',

      label: classifyLabelRisk(sp),

      texto: textoRegulPendencias(pendN),

      valor: p1,

      peso_pct: 0.25,

      valor_bruto: sp,

    },

    {

      nome: 'Caducidade documental',

      fonte: 'eventos públicos — licença/alvará',

      label: classifyLabelRisk(sc),

      texto: textoRegulCaducidade(dCad),

      valor: p2,

      peso_pct: 0.2,

      valor_bruto: sc,

    },

    {

      nome: 'Autuações e débitos',

      fonte: 'ANM — autuações',

      label: classifyLabelRisk(sa),

      texto: `Autuações registradas (${aut.count}); volume econômico associado (${fmtKm(aut.total)}).`,

      valor: p3,

      peso_pct: 0.2,

      valor_bruto: sa,

    },

    {

      nome: 'Tempo do processo',

      fonte: 'último movimento público',

      label: classifyLabelRisk(st),

      texto: textoRegulUltimaMov(diasUlt),

      valor: p4,

      peso_pct: 0.1,

      valor_bruto: st,

    },

    {

      nome: 'Alertas DOU',

      fonte: 'Radar IA (radar_eventos_processos + radar_eventos)',

      label: classifyLabelRisk(sa2),

      texto: textoAlertasDou,

      valor: p5,

      peso_pct: 0.1,

      valor_bruto: sa2,

    },

    {

      nome: 'CAPAG do município',

      fonte: 'Tesouro Nacional — CAPAG',

      label: classifyLabelRisk(cp),

      texto: textoRegulCapag(p.capag_nota),

      valor: p6,

      peso_pct: 0.15,

      valor_bruto: cp,

    },

    {

      nome: 'Inadimplência TAH',

      fonte: 'ANM / tah_pagamentos',

      label: tahLabel,

      texto: tahTexto,

      valor: p7,

      peso_pct: 1,

      valor_bruto: tahRaw,

    },

  ]

  if (Math.abs(adj) > 1e-8) {

    sf.push({

      nome: 'Ajuste consolidador regulatório',

      fonte: 'arredondamento do índice da dimensão',

      label: '',

      texto: `Diferença de ${fmtBr1(adj)} entre a combinação numérica imediatamente anterior (${fmtBr1(

        sumP,

      )}) e o valor exibido (${fmtBr1(valor)}) após arredondar a uma casa decimal.`,

      valor: adj,

      peso_pct: null,

      valor_bruto: adj,

    })

  }

  const out: DimensaoOutput = { valor, subfatores: sf }

  warnCoerenciaDimensao('Regulatório', out)

  return out

}


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

function opAtr(
  p: ProcessoMotorRow,
  sub: SubData | null,
  cfg: Record<string, unknown> | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const a1 = pickSubScore(p.substancia, cfg)
  const g = sub?.gap_pp
  let a2 = 40
  if (g != null) {
    if (g > 15) a2 = 95
    else if (g >= 10) a2 = 80
    else if (g >= 5) a2 = 60
    else if (g >= 1) a2 = 40
    else a2 = 15
  }
  const pr = sub?.preco_brl
  let a3 = 30
  if (pr != null && pr > 0) {
    const lg = Math.log10(pr)
    if (lg > 5) a3 = 95
    else if (lg >= 4) a3 = 80
    else if (lg >= 3) a3 = 65
    else if (lg >= 2) a3 = 45
    else if (lg >= 1) a3 = 25
    else a3 = 10
  }
  const M: Record<string, number> = { 'Alta (demanda)': 95, Alta: 90, Estavel: 50, Estável: 50, Queda: 15 }
  const a4 = sub?.tendencia != null ? (M[sub.tendencia] ?? 50) : 50
  let a5 = 10
  const vh = sub?.val_reserva_brl_ha,
    ah = p.area_ha
  if (vh != null && ah != null && ah > 0) {
    const vt = vh * ah
    if (vt >= 1e9) a5 = 95
    else if (vt >= 1e8) a5 = 80
    else if (vt >= 1e7) a5 = 60
    else if (vt >= 1e6) a5 = 35
  }
  let t = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  const mc = !!sub?.mineral_critico_2025
  const baseR = t
  if (mc) t = Math.min(100, Math.round(t * 1.1))
  if (!options?.returnSubfatores) return t
  const w1 = a1 * 0.25
  const w2 = a2 * 0.25
  const w3 = a3 * 0.2
  const w4 = a4 * 0.15
  const w5 = a5 * 0.15
  const sumW = w1 + w2 + w3 + w4 + w5
  const adjBase = baseR - sumW
  const bonus = t - baseR
  const sf: SubfatorOutput[] = [
    {
      nome: 'Relevância da substância (A1)',
      fonte: 'ANM/config_scores master_substâncias',
      label: classifyLabelOpp(a1),
      texto: `Substância ${p.substancia ?? '—'} mapeada com índice sintético ${fmtKm(a1)} no quadro atual.`,
      valor: w1 + adjBase / 5,
      peso_pct: 0.25,
      valor_bruto: a1,
    },
    {
      nome: 'Espaço de mercado (gap) (A2)',
      fonte: 'master_substancias.gap_pp',
      label: classifyLabelOpp(a2),
      texto:
        g != null
          ? `Gap de mercado (${fmtKm(g)} p.p.) entre substância e benchmark interno.`
          : 'Mercado não informado; cenário econômico marcado aqui como referência média.',
      valor: w2 + adjBase / 5,
      peso_pct: 0.25,
      valor_bruto: a2,
    },
    {
      nome: 'Preço de mercado (A3)',
      fonte: 'séries mercado interno',
      label: classifyLabelOpp(a3),
      texto:
        pr != null && pr > 0
          ? `Preço médio monitorado (${fmtPrecoBrlPorTon(pr)}).`
          : 'Preço externo não informado; posição econômica marcada aqui como fraca até nova evidência.',
      valor: w3 + adjBase / 5,
      peso_pct: 0.2,
      valor_bruto: a3,
    },
    {
      nome: 'Tendência de demanda (A4)',
      fonte: 'curvas de mercado',
      label: classifyLabelOpp(a4),
      texto:
        sub?.tendencia != null
          ? `Tendência de mercado registrada: ${sub.tendencia}.`
          : 'Tendência não informada; trajetória assumida estável até novo dado.',
      valor: w4 + adjBase / 5,
      peso_pct: 0.15,
      valor_bruto: a4,
    },
    {
      nome: 'Valor da reserva por hectare (A5)',
      fonte: 'val_reserva × área',
      label: classifyLabelOpp(a5),
      texto:
        vh != null && ah != null && ah > 0
          ? `Valor reserva/ha × área (${fmtKm(vh)} × ${fmtKm(ah)} ha).`
          : 'Sem valores de reserva econômica nem áreas declaradas; cenário econômico marcado aqui como muito restrito.',
      valor: w5 + adjBase / 5,
      peso_pct: 0.15,
      valor_bruto: a5,
    },
  ]

    sf.push({
      nome: 'Bônus mineral crítico',
      fonte: 'master_substancias.mineral_critico_2025',
      label: '',
      texto: mc ? 'Substância em mineral crítico 2025: fator multiplicativo +10% sobre o índice antes do bônus.' : 'Substância sem flag de criticidade: sem ajuste multiplicativo.',
      valor: bonus,
      peso_pct: null,
      valor_bruto: bonus,
    })
  const out: DimensaoOutput = { valor: t, subfatores: sf }
  warnCoerenciaDimensao('Atratividade', out)
  return out
}

function b3InfraText(ls: LayerRow[]): string {
  const pred = (l: LayerRow) => /ferrov|porto|hidrovi/i.test(l.tipo) || l.tipo.toUpperCase().includes('FERRO')
  const cand = ls.filter(pred)
  if (!cand.length) return 'Nenhuma ferrovia, porto ou hidrovia identificada na malha listada; distância de referência neutra usada (20 em escala interna).'
  const best = cand.reduce((a, b) => (a.distancia_km <= b.distancia_km ? a : b))
  return `${best.tipo} a ${fmtKm(best.distancia_km)} km (menor distância).`
}

function opVab(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  cf: number,
  bnd: boolean,
  sub: SubData | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const f = mapFase(p.fase ?? '')
  const b1 = SCORE_FASE_OS[f] ?? 25,
    b2 = b2ProfundidadeDado(p, f),
    b3m = b3(ls),
    b4 = b4SituacaoGradiente(p, f),
    b5 = cf0(cf)
  const b6m = fiscalB6(p)
  const b7Base = b7_v2(p.incentivo_b7)
  const mc = !!sub?.mineral_critico_2025
  const multBndes = bnd && mc ? 1.3 : bnd ? 1.15 : mc ? 1.05 : 1
  const b7n = Math.min(100, Math.round(b7Base * multBndes))
  const b8m = bm0(p.bioma_territorial)
  const b9m = ar0(p.area_ha)
  const valor = Math.round(
    b1 * 0.2 + b2 * 0.15 + b3m * 0.15 + b4 * 0.15 + b5 * 0.1 + b6m * 0.1 + b7n * 0.05 + b8m * 0.05 + b9m * 0.05,
  )
  if (!options?.returnSubfatores) return valor
  const p1 = b1 * 0.2
  const p2 = b2 * 0.15
  const p3 = b3m * 0.15
  const p4 = b4 * 0.15
  const p5 = b5 * 0.1
  const p6 = b6m * 0.1
  const p7 = b7n * 0.05
  const p8 = b8m * 0.05
  const p9 = b9m * 0.05
  const sumP = p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
  const adj = valor - sumP
  const sf: SubfatorOutput[] = [
    {
      nome: 'Fase do processo (B1)',
      fonte: 'ANM/fase',
      label: classifyLabelOpp(b1),
      texto: `Fase declarada ${p.fase ?? '—'}; posição no quadro de fases ${fmtKm(b1)}.`,
      valor: p1 + adj / 9,
      peso_pct: 0.2,
      valor_bruto: b1,
    },
    {
      nome: 'Profundidade do dado geológico (B2)',
      fonte: 'fase + recência de eventos (motor S31 v4)',
      label: classifyLabelOpp(b2),
      texto: `Profundidade documental e de fase (${p.fase ?? '—'}): ${fmtKm(b2)}.`,
      valor: p2 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b2,
    },
    {
      nome: 'Infraestrutura logística (B3)',
      fonte: 'IBGE/ports + malha logística',
      label: classifyLabelOpp(b3m),
      texto: `${b3InfraText(ls)}; posição infraestrutural ${fmtKm(b3m)} no mesmo quadro.`,
      valor: p3 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b3m,
    },
    {
      nome: 'Situação atual (B4)',
      fonte: 'ativo/situação declarada',
      label: classifyLabelOpp(b4),
      texto:
        b4 <= 5
          ? 'Processo inativo ou encerrado; ou situação cadastral crítica.'
          : `Situação operacional mapeada em gradiente (${fmtKm(b4)}); campo situação ainda neutro quando não preenchido.`,
      valor: p4 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b4,
    },
    {
      nome: 'CFEM histórica produzida (B5)',
      fonte: 'ANM/CFEM',
      label: classifyLabelOpp(b5),
      texto: `CFEM acumulada ${fmtKm(cf)} → faixa ${fmtKm(b5)}.`,
      valor: p5 + adj / 9,
      peso_pct: 0.1,
      valor_bruto: b5,
    },
    {
      nome: 'Autonomia fiscal do município (B6)',
      fonte: 'RGF/receitas',
      label: classifyLabelOpp(b6m),
      texto: 'Indicadores de autonomia e dívida consolidada.',
      valor: p6 + adj / 9,
      peso_pct: 0.1,
      valor_bruto: b6m,
    },
    {
      nome: 'Incentivos regionais (B7)',
      fonte: 'incentivos_uf.score_b7 + linhas BNDES + mineral crítico',
      label: classifyLabelOpp(b7n),
      texto: `Base estadual ${fmtKm(b7Base)}; multiplicador composto ${fmtBr1(multBndes)}× (BNDES e criticidade) → ${fmtKm(b7n)}.`,
      valor: p7 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b7n,
    },
    {
      nome: 'Bioma operacional (B8)',
      fonte: 'IBGE/bioma',
      label: classifyLabelOpp(b8m),
      texto: `Bioma ${p.bioma_territorial ?? '—'} → ${fmtKm(b8m)}.`,
      valor: p8 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b8m,
    },
    {
      nome: 'Área do processo (B9)',
      fonte: 'declarada ANM',
      label: classifyLabelOpp(b9m),
      texto: `Área ${p.area_ha != null ? fmtKm(p.area_ha) + ' ha' : 'não informada'}.`,
      valor: p9 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b9m,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Viabilidade', out)
  return out
}

function opSeg(
  risk: number,
  p: ProcessoMotorRow,
  aut: { count: number; total: number },
  sa2: number,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const c1 = 100 - risk,
    c2 = c2GuValidade(p.gu_validade),
    c3 = c3HistoricoCumprimento(aut),
    c4 = c4_v2(sa2)
  const valor = Math.round(c1 * 0.5 + c2 * 0.25 + c3 * 0.2 + c4 * 0.05)
  if (!options?.returnSubfatores) return valor
  const guTxt = (() => {
    const g = p.gu_validade
    if (g == null || String(g).trim() === '') return 'Sem data de validade da GU; referência neutra.'
    const v = new Date(String(g))
    if (Number.isNaN(v.getTime())) return 'Validade da GU não interpretada; referência neutra.'
    const dias = Math.floor((v.getTime() - Date.now()) / MS_DIA)
    if (dias < -90) return `GU expirada há mais de 90 dias (score ${fmtKm(c2)}).`
    if (dias < 0) return `GU expirada há até 90 dias (score ${fmtKm(c2)}).`
    if (dias < 90) return `GU vence em menos de 90 dias (score ${fmtKm(c2)}).`
    if (dias <= 365) return `GU vigente entre 90 e 365 dias (score ${fmtKm(c2)}).`
    return `GU com horizonte além de 365 dias (score ${fmtKm(c2)}).`
  })()
  const c3Txt =
    aut.count === 0
      ? 'Sem autuações mapeadas no recorte considerado; cumprimento aparente favorável.'
      : aut.total >= 1e7
        ? `Autuações com volume econômico elevado (${fmtBr1(aut.total)}); score ${fmtKm(c3)}.`
        : aut.total >= 1e6
          ? `Autuações com volume moderado (${fmtBr1(aut.total)}); score ${fmtKm(c3)}.`
          : aut.count >= 3
            ? `Três ou mais autuações com valores abaixo de R$ 1 mi; score ${fmtKm(c3)}.`
            : `Histórico de autuações (${aut.count}); score ${fmtKm(c3)}.`
  const w1 = c1 * 0.5
  const w2 = c2 * 0.25
  const w3 = c3 * 0.2
  const w4 = c4 * 0.05
  const sumW = w1 + w2 + w3 + w4
  const adj = valor - sumW
  const sf: SubfatorOutput[] = [
    {
      nome: 'Solidez geral (100 − Risk)',
      fonte: 'consolidador risk_score',
      label: classifyLabelOpp(c1),
      texto: `Risco consolidado ${fmtKm(risk)} → complemento ${fmtKm(c1)}.`,
      valor: w1 + adj / 4,
      peso_pct: 0.5,
      valor_bruto: c1,
    },
    {
      nome: 'Estabilidade documental',
      fonte: 'gu_validade (gradiente temporal)',
      label: classifyLabelOpp(c2),
      texto: guTxt,
      valor: w2 + adj / 4,
      peso_pct: 0.25,
      valor_bruto: c2,
    },
    {
      nome: 'Histórico de cumprimento',
      fonte: 'ANM autuações (valor + contagem)',
      label: classifyLabelOpp(c3),
      texto: c3Txt,
      valor: w3 + adj / 4,
      peso_pct: 0.2,
      valor_bruto: c3,
    },
    {
      nome: 'Exposição a alertas DOU (Radar)',
      fonte: 'sa2_v2 → c4',
      label: classifyLabelOpp(c4),
      texto:
        sa2 <= 0
          ? 'Sem carga de alertas DOU diretos; componente neutro-alinhado ao índice de oportunidade regulatória.'
          : `Alertas diretos consolidam pressão ${fmtKm(sa2)}; ajuste fino ${fmtKm(c4)} na segurança da tese.`,
      valor: w4 + adj / 4,
      peso_pct: 0.05,
      valor_bruto: c4,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Segurança', out)
  return out
}

function pen(v: number, p: ProcessoMotorRow, risk: number, a: number, s: number, g: number, rec: string[], first: boolean) {
  const f = mapFase(p.fase ?? ''), t = (p.situacao ?? '').toLowerCase()
  let o = v
  if (/bloqueio\s*perma|permanen/.test(t)) { o = Math.min(o, 10); if (first) rec.push('Bloqueio permanente (cap 10)') }
  if (f === 'encerrado' || p.ativo_derivado === false) { o = Math.min(o, 20); if (first) rec.push('Encerrado/inativo (cap 20)') }
  if (a >= 95 || s >= 95) { o = Math.min(o, 25); if (first) rec.push('Veto socioambiental (cap 25)') }
  const fatores: number[] = []
  if (t.includes('bloqueio prov')) fatores.push(0.6)
  if (g >= 85) fatores.push(0.5)
  if (t.includes('bloquead')) fatores.push(0.7)
  if (risk >= 80) fatores.push(0.6)
  if (risk >= 90) fatores.push(0.5)
  if (fatores.length > 0) {
    const pior = Math.min(...fatores)
    const penAcum = pior * 0.9 ** (fatores.length - 1)
    o = o * penAcum
    if (first) {
      const desc = fatores.length === 1
        ? `Multiplicador aplicado (×${fmtKm(pior)})`
        : `Multiplicadores compostos (${fatores.length} sinais, pior=${fmtKm(pior)})`
      rec.push(desc)
    }
  }
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

export async function loadProcesso(
  id: string,
  sql?: ReturnType<typeof postgres>,
): Promise<ProcessoMotorRow | null> {
  const s = sql ?? getSql()
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
export async function loadLayers(
  id: string,
  sql?: ReturnType<typeof postgres>,
) {
  const s2 = sql ?? getSql()
  return (await s2`
    SELECT tipo, nome, distancia_km, sobreposicao_pct FROM territorial_layers WHERE processo_id = ${id}
  `) as LayerRow[]
}

export async function loadExtras(
  id: string,
  sql?: ReturnType<typeof postgres>,
): Promise<LayerExtrasRow | null> {
  if (sessionMassCaches?.extrasByProcessoId) {
    return sessionMassCaches.extrasByProcessoId.get(id) ?? null
  }
  const s = sql ?? getSql()
  const rows = await s<LayerExtrasRow[]>`
    SELECT
      sitio_id, sitio_nome, sitio_distancia_km, sitio_tipo, sitio_natureza, sitio_sobreposicao_pct,
      assent_id, assent_nome, assent_distancia_km, assent_sobreposicao_pct
    FROM processos_territorial_extras
    WHERE processo_id = ${id}::uuid
  `
  return rows[0] ?? null
}

export async function loadTahStatus(
  numero: string,
  sql?: ReturnType<typeof postgres>,
): Promise<TahStatusRow | null> {
  if (!numero?.trim()) return null
  const key = numero.trim()
  if (sessionMassCaches?.tahByProcessoNumero) {
    return sessionMassCaches.tahByProcessoNumero.get(key) ?? null
  }
  const s = sql ?? getSql()
  const rows = await s<
    { pct_pago: string | null; qtd_pagamentos: string | number; qtd_nao_pagos: string | number }[]
  >`
    SELECT
      ROUND(100.0 * SUM(COALESCE(valor_pago, 0)) / NULLIF(SUM(COALESCE(valor_total, 0)), 0), 2) AS pct_pago,
      COUNT(*)::int AS qtd_pagamentos,
      COUNT(*) FILTER (WHERE COALESCE(valor_pago, 0) = 0 OR valor_pago IS NULL)::int AS qtd_nao_pagos
    FROM tah_pagamentos
    WHERE processo_numero = ${key}
  `
  if (!rows[0] || rows[0].pct_pago == null) return null
  return {
    pct_pago: Number(rows[0].pct_pago),
    qtd_pagamentos: Number(rows[0].qtd_pagamentos),
    qtd_nao_pagos: Number(rows[0].qtd_nao_pagos),
  }
}

/**
 * Pré-carrega mapas de extras territoriais e TAH para batch (evita N+1 em `loadExtras` / `loadTahStatus`).
 */
export async function buildS31ExtrasTahMapsOnly(
  sql: ReturnType<typeof postgres> = getSqlBatch(),
): Promise<{
  extrasByProcessoId: Map<string, LayerExtrasRow>
  tahByProcessoNumero: Map<string, TahStatusRow>
}> {
  const [extrasRows, tahRows] = await Promise.all([
    sql<Record<string, unknown>[]>`
      SELECT processo_id::text AS pid,
        sitio_id, sitio_nome, sitio_distancia_km, sitio_tipo, sitio_natureza, sitio_sobreposicao_pct,
        assent_id, assent_nome, assent_distancia_km, assent_sobreposicao_pct
      FROM processos_territorial_extras
    `,
    sql<
      {
        processo_numero: string
        pct_pago: string | null
        qtd_pagamentos: string | number
        qtd_nao_pagos: string | number
      }[]
    >`
      SELECT processo_numero,
        ROUND(100.0 * SUM(COALESCE(valor_pago, 0)) / NULLIF(SUM(COALESCE(valor_total, 0)), 0), 2) AS pct_pago,
        COUNT(*)::int AS qtd_pagamentos,
        COUNT(*) FILTER (WHERE COALESCE(valor_pago, 0) = 0 OR valor_pago IS NULL)::int AS qtd_nao_pagos
      FROM tah_pagamentos
      GROUP BY processo_numero
      HAVING SUM(COALESCE(valor_total, 0)) > 0
    `,
  ])
  const extrasByProcessoId = new Map<string, LayerExtrasRow>()
  for (const r of extrasRows) {
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
  for (const r of tahRows) {
    const num = String(r.processo_numero ?? '').trim()
    if (!num || r.pct_pago == null) continue
    tahByProcessoNumero.set(num, {
      pct_pago: Number(r.pct_pago),
      qtd_pagamentos: Number(r.qtd_pagamentos),
      qtd_nao_pagos: Number(r.qtd_nao_pagos),
    })
  }
  return { extrasByProcessoId, tahByProcessoNumero }
}

/** Penalidade 0–40 sobre inadimplência TAH (v5 Regulatório). */
function scoreTahInadimplencia(tah: TahStatusRow | null): number {
  if (!tah) return 0
  const pct = tah.pct_pago
  if (pct >= 100) return 0
  if (pct >= 90) return 10
  if (pct >= 50) return 25
  return 40
}
export async function loadSub(
  n: string | null,
  sql?: ReturnType<typeof postgres>,
) {
  if (!n?.trim()) return null
  const k = n.trim().toUpperCase()
  if (sessionMassCaches?.subByUpper.size) {
    return sessionMassCaches.subByUpper.get(k) ?? null
  }
  const sx = sql ?? getSql()
  const r = (await sx`
    SELECT gap_pp, preco_brl, preco_usd, tendencia, val_reserva_brl_ha, mineral_critico_2025
    FROM master_substancias WHERE UPPER(substancia_anm) = UPPER(${n}) LIMIT 1
  `) as SubData[]
  return r[0] ?? null
}
export async function loadCpt(
  uf: string | null,
  sql?: ReturnType<typeof postgres>,
) {
  if (!uf?.trim()) return 1
  const u = uf.trim()
  if (sessionMassCaches?.cptByUf.has(u)) {
    const m = sessionMassCaches.cptByUf.get(u)
    return m != null && Number.isFinite(m) ? m : 1
  }
  try {
    const sx = sql ?? getSql()
    const r = (await sx`SELECT public.fn_cpt_multiplicador_uf(${uf}::text) AS m`) as { m: string }[]
    return r[0]?.m != null ? Number(r[0].m) : 1
  } catch {
    return 1
  }
}

async function loadCptMunicipio(
  municipioIbge: string | null,
  sql?: ReturnType<typeof postgres>,
): Promise<string | null> {
  if (municipioIbge == null || String(municipioIbge).trim() === '') return null
  try {
    const sx = sql ?? getSql()
    const r = (await sx`
      SELECT indice_cpt_nivel FROM v_cpt_municipio_resumo WHERE municipio_ibge = ${String(municipioIbge).trim()} LIMIT 1
    `) as { indice_cpt_nivel: string | null }[]
    const raw = r[0]?.indice_cpt_nivel
    return raw != null && String(raw).trim() !== '' ? String(raw).trim() : null
  } catch {
    return null
  }
}

async function loadAlertasDirecionados(
  processoId: string,
  sql?: ReturnType<typeof postgres>,
): Promise<AlertaDirecionadoRow[]> {
  const sx = sql ?? getSql()
  const rows = (await sx`
    SELECT re.categoria, (CURRENT_DATE - re.data_evento)::int AS dias_desde
    FROM radar_eventos_processos rep
    JOIN radar_eventos re ON re.id = rep.evento_id
    WHERE rep.processo_id = ${processoId}::uuid
      AND rep.match_motivo IN ('CITADO_DIRETAMENTE', 'CNPJ')
      AND re.data_evento IS NOT NULL
  `) as { categoria: string; dias_desde: number }[]
  return rows.map((r) => ({ categoria: String(r.categoria ?? ''), dias_desde: Number(r.dias_desde) }))
}
export async function loadCfem(
  numero: string,
  sql?: ReturnType<typeof postgres>,
) {
  const sx = sql ?? getSql()
  const r = (await sx`
    SELECT COALESCE(SUM(valor_recolhido),0)::float8 AS t FROM cfem_arrecadacao WHERE processo_numero = ${numero}
  `) as { t: string }[]
  return Number(r[0]?.t ?? 0)
}
export async function loadAutu(
  num: string,
  sql?: ReturnType<typeof postgres>,
) {
  const sx = sql ?? getSql()
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
export async function loadBndes(
  sub: string | null,
  sql?: ReturnType<typeof postgres>,
) {
  if (!sub?.trim()) return false
  if (sessionMassCaches?.linhasBndes.length) {
    return sessionMassCaches.linhasBndes.some((r) => bndesRowMatch(sub, r))
  }
  const sx = sql ?? getSql()
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
  opts: {
    persist?: boolean
    massCaches?: S31MassCaches
    returnSubfatores?: boolean
    scoresFonte?: string
    /** Cliente Postgres direct (batch) ou default pooler; usado em TODAS as queries SQL do motor quando definido. */
    sqlClient?: ReturnType<typeof postgres>
  } = {},
): Promise<ScoreResult> {
  const prevSess = sessionMassCaches
  const prevCfg = cfgCache
  sessionMassCaches = opts.massCaches ?? null
  const wantSub = opts.returnSubfatores === true
  const persist = opts.persist === true && !wantSub
  const sfDefault = 's31_v5_20260503'
  const sfRaw = opts.scoresFonte ?? sfDefault
  if (
    typeof sfRaw !== 'string' ||
    !/^[a-zA-Z0-9_.\-]+$/.test(sfRaw) ||
    sfRaw.length > 120
  ) {
    throw new Error('scoresFonte invalido')
  }
  const scoresFonte = sfRaw
  const sMotor = opts.sqlClient ?? getSql()
  let p: ProcessoMotorRow | null
  let ls: LayerRow[]
  let sub: SubData | null
  let cpt: number
  let cptMun: string | null
  let cfg: Record<string, unknown>
  let aut: { count: number; total: number }
  let cfe: number
  let bnd: boolean
  let alertas: AlertaDirecionadoRow[]
  let extras: LayerExtrasRow | null
  let tah: TahStatusRow | null
  try {
  p = await loadProcesso(processoId, sMotor)
  if (!p) throw new Error('Processo nao encontrado: ' + processoId)
  if (sessionMassCaches?.incentivoB7ByUf.size && p.uf) {
    const u = p.uf.trim()
    if (sessionMassCaches.incentivoB7ByUf.has(u)) p.incentivo_b7 = sessionMassCaches.incentivoB7ByUf.get(u) ?? null
  }
  ;[ls, sub, cpt, cptMun, cfg, aut, cfe, bnd, alertas, extras, tah] = await Promise.all([
    loadLayers(processoId, sMotor),
    loadSub(p.substancia, sMotor),
    loadCpt(p.uf, sMotor),
    loadCptMunicipio(p.municipio_ibge, sMotor),
    loadConfigScores(sMotor),
    loadAutu(p.numero, sMotor),
    loadCfem(p.numero, sMotor),
    loadBndes(p.substancia, sMotor),
    loadAlertasDirecionados(processoId, sMotor),
    loadExtras(processoId, sMotor),
    loadTahStatus(p.numero, sMotor),
  ])
  const dgR = dimGeologico(p, cfg, cfe, { returnSubfatores: wantSub })
  const dg = typeof dgR === 'number' ? dgR : dgR.valor
  const daR = await dimAmbiental(p, ls, extras, { returnSubfatores: wantSub })
  const da = typeof daR === 'number' ? daR : daR.valor
  const dsR = dimSocial(p, ls, cpt, cptMun, extras, { returnSubfatores: wantSub })
  const ds = typeof dsR === 'number' ? dsR : dsR.valor
  const drR = dimRegul(p, aut, alertas, tah, { returnSubfatores: wantSub })
  const dr = typeof drR === 'number' ? drR : drR.valor
  const sa2Alertas = sa2_v2(alertas)
  let risk = dg * 0.25 + da * 0.3 + ds * 0.25 + dr * 0.2

  if (da >= 95 || ds >= 95) risk = Math.max(risk, 80)
  else if (da >= 80 || ds >= 80) risk = Math.max(risk, 65)
  else if (da >= 65 || ds >= 65) risk = Math.max(risk, 50)

  if (dr >= 90) risk = Math.max(risk, 75)
  else if (dr >= 80) risk = Math.max(risk, 60)
  else if (dr >= 70) risk = Math.max(risk, 50)

  risk = Math.min(100, Math.round(risk))
  const oaR = opAtr(p, sub, cfg, { returnSubfatores: wantSub })
  const ovR = opVab(p, ls, cfe, bnd, sub, { returnSubfatores: wantSub })
  const osR = opSeg(risk, p, aut, sa2Alertas, { returnSubfatores: wantSub })
  const oa = typeof oaR === 'number' ? oaR : oaR.valor
  const ov = typeof ovR === 'number' ? ovR : ovR.valor
  const os0 = typeof osR === 'number' ? osR : osR.valor
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
  if (persist) {
    const ex = (await sMotor`SELECT scores_fonte FROM scores WHERE processo_id = ${processoId} LIMIT 1`) as { scores_fonte: string | null }[]
    const skip = ex[0]?.scores_fonte?.startsWith('manual_') ?? false
    if (!skip) {
      await sMotor`
        INSERT INTO scores (processo_id, risk_score, risk_label, risk_cor, os_conservador, os_moderado, os_arrojado, os_label, os_classificacao,
          dimensoes_risco, dimensoes_oportunidade, calculated_at, scores_fonte)
        VALUES (${processoId}::uuid, ${risk}, ${rI.l}, ${rI.c}, ${ocI}, ${omI}, ${oa2I}, ${osU}, ${osU},
          ${sMotor.json(dimRJson)}::jsonb, ${sMotor.json(dimOJson)}::jsonb, NOW(), ${scoresFonte})
        ON CONFLICT (processo_id) DO UPDATE SET
          risk_score = EXCLUDED.risk_score, risk_label = EXCLUDED.risk_label, risk_cor = EXCLUDED.risk_cor,
          os_conservador = EXCLUDED.os_conservador, os_moderado = EXCLUDED.os_moderado, os_arrojado = EXCLUDED.os_arrojado,
          os_label = EXCLUDED.os_label, os_classificacao = EXCLUDED.os_classificacao,
          dimensoes_risco = EXCLUDED.dimensoes_risco, dimensoes_oportunidade = EXCLUDED.dimensoes_oportunidade,
          calculated_at = NOW(), scores_fonte = ${scoresFonte}
      `
    }
  }
  return {
    risk_score: risk, risk_label: rI.l, risk_cor: rI.c,
    risk_breakdown: { geologico: dg, ambiental: da, social: ds, regulatorio: dr },
    ...(wantSub
      ? {
          dimensoes_risco: {
            geologico: dgR as DimensaoOutput,
            ambiental: daR as DimensaoOutput,
            social: dsR as DimensaoOutput,
            regulatorio: drR as DimensaoOutput,
          },
          dimensoes_oportunidade: {
            atratividade: oaR as DimensaoOutput,
            viabilidade: ovR as DimensaoOutput,
            seguranca: osR as DimensaoOutput,
            penalidades: R,
          },
        }
      : {}),
    os_conservador: ocI, os_moderado: omI, os_arrojado: oa2I,
    os_label_conservador: cL.l, os_label_moderado: mL.l, os_label_arrojado: aL.l,
    os_breakdown: { atratividade: oa, viabilidade: ov, seguranca: os0 },
    detail: {
      scoreSubstancia: pickSubScore(p.substancia, null), scoreFase: SCORE_FASE_OS[mapFase(p.fase ?? '')] ?? 25, scoreQualidade: scoreQualOperacaoReal(p, cfe),
      scoreComunidades: 0, scoreCAPAG_rs: 0, scoreCaducidade: 0, scoreRegTempo: 0, scoreRegPendencias: 0, scoreRegAlertas: 0,
      a1:0,a2:0,a3:0,a4:0,a5:0, b1:0,b2:0,b3:0,b4:0,b5:0,b6:0,b7:0, c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,
    },
    fallbacks_usados: [scoresFonte],
  }
  } finally {
    sessionMassCaches = prevSess
    cfgCache = prevCfg
  }
}

export async function computeProcessoComBreakdown(processoId: string): Promise<ScoreResult> {
  return runS31MotorAndPersist(processoId, { returnSubfatores: true, persist: false })
}
