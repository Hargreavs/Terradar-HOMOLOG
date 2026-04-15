import { corFaixaRiscoValor } from '../../lib/riskScoreDecomposicao'
import { corFaixaOS } from '../../lib/oportunidadeRelatorioUi'
import {
  REGIME_ANM_PARA_TERRADAR,
  REGIME_LABELS,
} from '../../lib/regimes'
import { labelSubstanciaParaExibicao } from '../../lib/substancias'
import type { Regime } from '../../types'
import type {
  CfemHistoricoItem,
  InfraData,
  LayerData,
  MasterSubstancia,
  ReportData,
  RiskDimension,
} from '../../lib/reportTypes'
import {
  fetchProcessoCompleto,
  type AnaliseTerritorial,
  type ScoreAutoResult,
} from '../../lib/processoApi'
import {
  capagIndicadorResolvido,
  formatDividaConsolidadaExibicao,
  normalizeCapagNotaDisplay,
} from '../../lib/fiscalDisplay'
import { piorIndicadorCapag } from '../../lib/capagPiorIndicador'

/** 1 t métrica = 32.151 oz troy (preço master em USD/t → exibição em oz). */
const OZ_POR_TONELADA = 32_151
/** Premissa TERRADAR: volume de massa por ha para val in-situ (30 m × 2,5 t/m³ × 10.000 m²). */
const TONELADAS_POR_HA = 750_000

function riskDimFromScore(score: number): RiskDimension {
  const color = corFaixaRiscoValor(score)
  let label = 'Moderado'
  if (score <= 10) label = 'Muito baixo'
  else if (score <= 25) label = 'Baixo'
  else if (score <= 50) label = 'Moderado'
  else if (score <= 75) label = 'Alto'
  else label = 'Muito alto'

  return {
    valor: score,
    label,
    width_pct: Math.min(100, Math.max(0, score)),
    color,
  }
}

function osDimFromScore(valor: number): RiskDimension {
  const color = corFaixaOS(valor)
  let label = 'Moderado'
  if (valor >= 80) label = 'Muito favorável'
  else if (valor >= 65) label = 'Favorável'
  else if (valor >= 45) label = 'Moderado'
  else label = 'Desfavorável'

  return {
    valor,
    label,
    width_pct: Math.min(100, Math.max(0, valor)),
    color,
  }
}

function nd(s: unknown): string {
  const t = String(s ?? '').trim()
  return t === '' ? 'Não disponível' : t
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * A coluna `estrategia_nacional` em `master_substancias` pode vir da planilha sem acentos.
 * `sanitizeReportText` não remove acentos; o problema é a fonte. Corrigimos grafias conhecidas do PNM.
 */
function fixEstrategiaNacionalPnmAcentos(s: string): string {
  if (!s) return s
  return s
    .replace(/\bCertificacao\b/g, 'Certificação')
    .replace(/\bcertificacao\b/g, 'certificação')
    .replace(/\bexportacao\b/gi, 'exportação')
    .replace(/\bFormalizacao\b/g, 'Formalização')
    .replace(/\bformalizacao\b/g, 'formalização')
}

function fmtRegimeFromApi(regime: unknown): string {
  const r = String(regime ?? '').trim()
  if (!r) return 'Não disponível'
  if (r in REGIME_LABELS) {
    return REGIME_LABELS[r as Regime]
  }
  const norm = r.toUpperCase().replace(/\s+/g, ' ').trim()
  const normSans = stripAccents(norm)
  if (norm in REGIME_ANM_PARA_TERRADAR) {
    return REGIME_LABELS[
      REGIME_ANM_PARA_TERRADAR[
        norm as keyof typeof REGIME_ANM_PARA_TERRADAR
      ]
    ]
  }
  for (const [anm, terr] of Object.entries(REGIME_ANM_PARA_TERRADAR)) {
    const k = stripAccents(anm.toUpperCase().replace(/\s+/g, ' ').trim())
    if (k === normSans) return REGIME_LABELS[terr]
  }
  return r
}

function fmtFaseFromApi(fase: unknown): string {
  const f = String(fase ?? '').trim()
  if (!f) return 'Não disponível'
  const collapsed = f.replace(/\s+/g, ' ').trim()
  if (/^concess[aã]o\s+de\s+lavra$/i.test(collapsed)) return 'Lavra'
  const faseNorm = stripAccents(collapsed.toUpperCase().replace(/\s+/g, ' '))
  if (faseNorm === 'CONCESSAO DE LAVRA') return 'Lavra'
  const map: Record<string, string> = {
    pesquisa: 'Pesquisa',
    requerimento: 'Requerimento',
    concessao: 'Concessão',
    lavra: 'Lavra',
    encerrado: 'Encerrado',
  }
  return map[f.toLowerCase()] ?? f
}

function parseDimJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function dimScore(dim: unknown): number {
  if (typeof dim === 'number' && !Number.isNaN(dim)) return dim
  if (dim && typeof dim === 'object') {
    const o = dim as Record<string, unknown>
    const s = o.score ?? o.valor
    if (typeof s === 'number') return s
    if (typeof s === 'string') return Number(s) || 0
  }
  return 0
}

function scoreFromDimensao(
  dims: Record<string, unknown> | null,
  keys: string[],
): number {
  if (!dims) return 0
  for (const k of keys) {
    if (k in dims) return dimScore(dims[k])
  }
  return 0
}

function dadosSeiFromProcesso(
  p: Record<string, unknown>,
): ReportData['dados_sei'] | undefined {
  const nup = String(p.nup_sei ?? p.numero_sei ?? '').trim()
  if (!nup) return undefined
  const pick = (key: string): string | undefined => {
    const v = p[key]
    if (v == null || String(v).trim() === '') return undefined
    return String(v).trim()
  }
  return {
    nup,
    portaria_dou: pick('portaria_dou'),
    licenca_ambiental: pick('licenca_ambiental'),
    tah_pago: pick('tah_pago') ?? pick('tah_status'),
    certidao: pick('certidao_regularidade') ?? pick('certidao'),
    plano_lavra: pick('plano_lavra'),
    plano_fechamento: pick('plano_fechamento_mina') ?? pick('plano_fechamento'),
    ultimo_despacho: pick('ultimo_despacho'),
  }
}

function estagioFromFase(fase: unknown): {
  estagio: string
  estagio_index: number
} {
  const f = String(fase ?? '').trim().toLowerCase()
  if (f.includes('pesquisa')) return { estagio: 'Inicial', estagio_index: 1 }
  if (f.includes('lavra')) return { estagio: 'Avançado', estagio_index: 4 }
  return { estagio: 'Intermediário', estagio_index: 2 }
}

function formatIsoToBr(iso: unknown): string {
  const s = String(iso ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return s
  return `${m[3]}/${m[2]}/${m[1]}`
}

function formatBrlNum(n: number): string {
  if (!n || Number.isNaN(n)) return 'R$ 0'
  return `R$ ${n.toLocaleString('pt-BR')}`
}

function buildLayersFromApi(rows: Record<string, unknown>[]): LayerData[] {
  if (!rows.length) return []
  return rows.map((row) => {
    const sobrePct = Number(row.sobreposicao_pct ?? 0)
    const sobreposto = sobrePct > 0
    return {
      tipo: nd(row.tipo),
      nome: nd(row.nome),
      detalhes: nd(row.detalhes),
      distancia_km: Number(row.distancia_km) || 0,
      sobreposto,
      tag_class: sobreposto ? 'ta' : 'tg',
      tag_label: sobreposto ? 'Sobreposto' : 'Não',
    }
  })
}

function buildInfraFromApi(rows: Record<string, unknown>[]): InfraData[] {
  if (!rows.length) return []
  return rows.map((row) => ({
    tipo: nd(row.tipo),
    nome: nd(row.nome),
    detalhes: nd(row.detalhes),
    distancia_km: Number(row.distancia_km) || 0,
  }))
}

/**
 * Por chave (subcategoria de exibição), mantém só o registo com menor `distancia_km`.
 */
function keepClosestPerKey<T extends { distancia_km: number }>(
  items: T[],
  keyOf: (item: T) => string,
): T[] {
  const sorted = [...items].sort((a, b) => a.distancia_km - b.distancia_km)
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of sorted) {
    const k = keyOf(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/**
 * Converte analise_territorial.areas_protegidas (+ aquíferos) → LayerData[].
 * Áreas protegidas: 1 mais próximo por subcategoria (TI, UC por categoria PI/US, Quilombola).
 * Aquíferos: todos (interseções).
 */
function buildLayersFromPostGIS(analise: AnaliseTerritorial): LayerData[] {
  const fromAp: LayerData[] = []

  for (const ap of analise.areas_protegidas) {
    const sobreposto = ap.distancia_km <= 0.5
    fromAp.push({
      tipo: formatTipoArea(ap.tipo, ap.categoria),
      nome: ap.nome,
      detalhes: ap.orgao ?? '',
      distancia_km: ap.distancia_km,
      sobreposto,
      tag_class: sobreposto ? 'ta' : 'tg',
      tag_label: sobreposto ? 'Sobreposto' : 'Não',
    })
  }

  const areasPorSubcategoria = keepClosestPerKey(fromAp, (l) => l.tipo).sort(
    (a, b) => a.distancia_km - b.distancia_km,
  )

  const aquiferos: LayerData[] = []
  for (const aq of analise.aquiferos) {
    aquiferos.push({
      tipo: 'Aquífero',
      nome: aq.nome,
      detalhes: aq.tipo,
      distancia_km: 0,
      sobreposto: true,
      tag_class: 'ta',
      tag_label: 'Sobreposto',
    })
  }

  return [...areasPorSubcategoria, ...aquiferos]
}

function formatTipoArea(tipo: string, categoria: string | null): string {
  const cat = categoria?.trim() ?? ''
  switch (tipo) {
    case 'TI':
      return 'Terra Indígena'
    case 'UC':
      return cat ? `UC ${cat}` : 'Unidade de Conservação'
    case 'QUILOMBOLA':
      return 'Quilombola'
    default:
      return tipo
  }
}

/**
 * Converte analise_territorial.infraestrutura + portos → InfraData[].
 * Mantém só o mais próximo por tipo: Ferrovia, Rodovia, Hidrovia, Porto.
 */
function buildInfraFromPostGIS(analise: AnaliseTerritorial): InfraData[] {
  const raw: InfraData[] = []

  for (const item of analise.infraestrutura) {
    raw.push({
      tipo: formatTipoInfra(item.tipo),
      nome: item.nome,
      detalhes: item.categoria ?? '',
      distancia_km: item.distancia_km,
    })
  }

  for (const porto of analise.portos) {
    raw.push({
      tipo: 'Porto',
      nome: porto.nome,
      detalhes: porto.uf ?? '',
      distancia_km: porto.distancia_km,
    })
  }

  return keepClosestPerKey(raw, (i) => i.tipo).sort(
    (a, b) => a.distancia_km - b.distancia_km,
  )
}

function formatTipoInfra(tipo: string): string {
  switch (tipo) {
    case 'FERROVIA':
      return 'Ferrovia'
    case 'RODOVIA':
      return 'Rodovia'
    case 'HIDROVIA':
      return 'Hidrovia'
    default:
      return tipo
  }
}

function cfemHistoricoFromApi(cfem: Record<string, unknown>[]): CfemHistoricoItem[] {
  return cfem.map((r) => {
    const v = Number(r.valor_brl) || 0
    const br = formatBrlNum(v)
    return {
      ano: Number(r.ano) || 0,
      processo_valor: br,
      municipio_valor: br,
      substancias: nd(
        Array.isArray(r.substancias)
          ? r.substancias.map((x) => String(x)).join(', ')
          : r.substancias,
      ),
    }
  })
}

function rsClassificacaoLabel(total: number): string {
  if (total < 40) return 'Risco baixo'
  if (total <= 69) return 'Risco médio'
  return 'Risco alto'
}

/**
 * `fiscal_municipios` na API costuma ser um objeto; normaliza se vier como array (defensivo).
 */
function fiscalMunicipioNormalizado(
  raw: unknown,
): Record<string, unknown> | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first != null && typeof first === 'object'
      ? (first as Record<string, unknown>)
      : null
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function numFiscalOuNull(
  fm: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!fm) return null
  const v = fm[key]
  if (v == null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Campos do `ReportData` lidos por `reportPages.ts` (nomes: `receita_propria`, `divida`, etc.).
 * Mapeia colunas de `fiscal_municipios` (ex.: `receita_tributaria`, `divida_consolidada` via `formatDividaConsolidadaExibicao`).
 */
function indicadoresMunicipaisParaTemplate(
  fm: Record<string, unknown> | null,
  processo: Record<string, unknown>,
): {
  receita_propria: string
  divida: string
  dependencia_transf: string
  idh: string
  populacao: string
} {
  const receitaBrl =
    numFiscalOuNull(fm, 'receita_tributaria') ??
    numFiscalOuNull(fm, 'receita_propria')

  const receita_propria =
    receitaBrl != null && receitaBrl > 0
      ? `R$ ${(receitaBrl / 1_000_000).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} Mi`
      : 'Não disponível'

  const divida = formatDividaConsolidadaExibicao(fm)

  const depPct = numFiscalOuNull(fm, 'dep_transferencias_pct')
  const dependencia_transf =
    depPct != null
      ? `${depPct.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : 'Não disponível'

  let idh: string
  if (fm?.idh != null && String(fm.idh).trim() !== '') {
    const idhN = Number(fm.idh)
    idh = Number.isFinite(idhN)
      ? idhN.toLocaleString('pt-BR', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })
      : nd(processo.idh)
  } else {
    idh = nd(processo.idh)
  }

  const pop = numFiscalOuNull(fm, 'populacao')
  const populacao =
    pop != null && pop > 0
      ? `${pop.toLocaleString('pt-BR')} hab.`
      : nd(processo.populacao)

  return {
    receita_propria,
    divida,
    dependencia_transf,
    idh,
    populacao,
  }
}

/**
 * Monta `ReportData` a partir da API Express + Supabase (`GET /api/processo/:numero`).
 * `numeroProcesso` no formato ANM, ex.: "864.231/2017".
 */
export async function buildReportData(
  numeroProcesso: string,
): Promise<ReportData> {
  const api = await fetchProcessoCompleto(numeroProcesso)
  const p = api.processo as Record<string, unknown>
  const scores = (api.scores ?? null) as Record<string, unknown> | null
  const fiscal = api.fiscal
  const mercado: MasterSubstancia | null = api.mercado
  const capag = fiscal.capag as Record<string, unknown> | null
  const fiscalMun = fiscalMunicipioNormalizado(api.fiscal_municipio)
  const incentivosUf = (api.incentivos_uf ?? null) as Record<
    string,
    unknown
  > | null
  const linhasBndes = (api.linhas_bndes ?? []) as Record<string, unknown>[]

  const scoresAuto: ScoreAutoResult | null = api.scores_auto ?? null
  const analise = api.analise_territorial ?? null

  // ═══ SCORES: preferir scores_auto, fallback para seed manual ═══
  let riskScore: number
  let rs_classificacao_final: string
  let rsGeo: RiskDimension
  let rsAmb: RiskDimension
  let rsSoc: RiskDimension
  let rsReg: RiskDimension
  let osCons: number
  let osMod: number
  let osArr: number
  let osClass: string
  let osMerc: RiskDimension
  let osViab: RiskDimension
  let osSeg: RiskDimension

  if (scoresAuto) {
    riskScore = scoresAuto.risk_score
    rs_classificacao_final = scoresAuto.risk_label

    rsGeo = riskDimFromScore(scoresAuto.risk_breakdown.geologico)
    rsAmb = riskDimFromScore(scoresAuto.risk_breakdown.ambiental)
    rsSoc = riskDimFromScore(scoresAuto.risk_breakdown.social)
    rsReg = riskDimFromScore(scoresAuto.risk_breakdown.regulatorio)

    osCons = scoresAuto.os_conservador
    osMod = scoresAuto.os_moderado
    osArr = scoresAuto.os_arrojado
    osClass = scoresAuto.os_label_conservador

    osMerc = osDimFromScore(scoresAuto.os_breakdown.atratividade)
    osViab = osDimFromScore(scoresAuto.os_breakdown.viabilidade)
    osSeg = osDimFromScore(scoresAuto.os_breakdown.seguranca)
  } else {
    riskScore = Number(scores?.risk_score ?? 0) || 0
    const riskLabelRaw = String(scores?.risk_label ?? '').trim()
    rs_classificacao_final = riskLabelRaw || rsClassificacaoLabel(riskScore)

    const dimsRisco = parseDimJson(scores?.dimensoes_risco)
    rsGeo = riskDimFromScore(
      scoreFromDimensao(dimsRisco, ['geologico', 'geológico']),
    )
    rsAmb = riskDimFromScore(
      scoreFromDimensao(dimsRisco, ['ambiental']),
    )
    rsSoc = riskDimFromScore(scoreFromDimensao(dimsRisco, ['social']))
    rsReg = riskDimFromScore(
      scoreFromDimensao(dimsRisco, ['regulatorio', 'regulatório']),
    )

    const dimsOport = parseDimJson(scores?.dimensoes_oportunidade)
    osMerc = osDimFromScore(
      scoreFromDimensao(dimsOport, ['mercado', 'atratividade']),
    )
    osViab = osDimFromScore(
      scoreFromDimensao(dimsOport, ['viabilidade']),
    )
    osSeg = osDimFromScore(
      scoreFromDimensao(dimsOport, ['seguranca', 'segurança']),
    )

    osCons = Number(scores?.os_conservador ?? 0) || 0
    osMod = Number(scores?.os_moderado ?? 0) || 0
    osArr = Number(scores?.os_arrojado ?? 0) || 0
    osClass =
      String(scores?.os_classificacao ?? '').trim() ||
      String(scores?.os_label ?? '').trim() ||
      'Não disponível'
  }

  const substanciaRaw = String(p.substancia ?? '')
  const areaHa = Number(p.area_ha) || 0
  const uf = String(p.uf ?? '')
  const municipioNome = String(p.municipio ?? '')
  const municipioUf =
    municipioNome && uf
      ? `${municipioNome}/${uf}`
      : nd(municipioNome || uf)

  const cfemRows = (fiscal.cfem_historico ?? []) as Record<string, unknown>[]
  const cfemTotal = Number(fiscal.cfem_total_4anos) || 0
  const cfemEstHaMunicipal =
    areaHa > 0 && cfemTotal > 0
      ? Math.round(cfemTotal / areaHa)
      : 0

  /** `preco_usd` / `preco_brl` na master são sempre por tonelada. */
  const precoUsdPorT = Number(mercado?.preco_usd ?? 0) || 0
  const precoBrlPorT = Number(mercado?.preco_brl ?? 0) || 0
  const unidadePreco = String(mercado?.unidade_preco ?? '').trim().toLowerCase()

  const precoOzUsd =
    unidadePreco === 'oz' && precoUsdPorT > 0
      ? precoUsdPorT / OZ_POR_TONELADA
      : precoUsdPorT

  /** BRL/g a partir do preço por tonelada (ex.: ouro). */
  const precoBrlPorGrama = precoBrlPorT > 0 ? precoBrlPorT / 1_000_000 : 0

  /**
   * `teor_pct` na master é a percentagem em massa (ex.: 0,0005 = 0,0005 % Au).
   * Fração = teor_pct / 100 (ex.: 0,000005 para 5 g/t).
   */
  const teorFracao = (Number(mercado?.teor_pct ?? 0) || 0) / 100
  const cambioRef =
    Number(mercado?.cambio_referencia ?? 0) > 0
      ? Number(mercado?.cambio_referencia)
      : 5.0229

  /**
   * Valor in-situ e CFEM: sempre derivados de teor × massa/ha × preço.
   * Não usar `val_reserva_usd_ha` / `val_reserva_brl_ha` da master (escala incorreta no dataset legado).
   */
  const valReservaUsdHa =
    mercado && precoUsdPorT > 0 && teorFracao > 0
      ? TONELADAS_POR_HA * teorFracao * precoUsdPorT
      : 0
  const valReservaBrlHa = valReservaUsdHa * cambioRef

  const cfemPctAliquota =
    Number(mercado?.cfem_pct ?? p.cfem_aliquota_pct ?? 0) || 0
  const cfemBrlSobreInSituHa =
    mercado && valReservaBrlHa > 0
      ? (cfemPctAliquota / 100) * valReservaBrlHa
      : 0

  const cfemEstimadaHaFinal =
    mercado && precoUsdPorT > 0 && teorFracao > 0 && cfemBrlSobreInSituHa > 0
      ? Math.round(cfemBrlSobreInSituHa)
      : cfemEstHaMunicipal

  const var12 = Number(mercado?.var_1a_pct ?? 0) || 0
  const cagr5 = Number(mercado?.cagr_5a_pct ?? 0) || 0

  let pibMunicipalStr = 'Não disponível'
  const pibMiFiscal = fiscalMun?.pib_municipal_mi
  if (
    typeof pibMiFiscal === 'number' &&
    !Number.isNaN(pibMiFiscal) &&
    pibMiFiscal > 0
  ) {
    pibMunicipalStr = `R$ ${pibMiFiscal.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} Mi`
  } else {
    const pibCapag = capag?.pib_municipal
    if (typeof pibCapag === 'number' && !Number.isNaN(pibCapag)) {
      pibMunicipalStr = `R$ ${pibCapag.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} Mi`
    } else {
      const pibStr = String(pibCapag ?? '').trim()
      if (pibStr !== '') pibMunicipalStr = pibStr
    }
  }

  const capagNota = normalizeCapagNotaDisplay(
    capag?.nota != null ? String(capag.nota) : null,
  )

  const endiv = capagIndicadorResolvido(capag, {
    indicadorNum: 'indicador_1',
    indicadorStr: 'endividamento',
    notaCol: 'nota_1',
  })
  const poup = capagIndicadorResolvido(capag, {
    indicadorNum: 'indicador_2',
    indicadorStr: 'poupanca',
    notaCol: 'nota_2',
  })
  const liq = capagIndicadorResolvido(capag, {
    indicadorNum: 'indicador_3',
    indicadorStr: 'liquidez',
    notaCol: 'nota_3',
  })

  const { estagio, estagio_index } = estagioFromFase(
    String(p.fase ?? ''),
  )

  const dataRel = new Date()
  const dataRelatorio = `${String(dataRel.getDate()).padStart(2, '0')}.${String(dataRel.getMonth() + 1).padStart(2, '0')}.${dataRel.getFullYear()}`

  const alvaraRaw = p.alvara_validade ?? p.alvara_vencimento

  const linhasBndesNomes = linhasBndes
    .map((row) => String((row as { linha?: unknown }).linha ?? '').trim())
    .filter(Boolean)

  const templateFiscal = indicadoresMunicipaisParaTemplate(fiscalMun, p)

  const faseFmt = fmtFaseFromApi(String(p.fase ?? ''))
  const regimeFmt = fmtRegimeFromApi(String(p.regime ?? ''))
  const piorCap = piorIndicadorCapag(
    endiv.notaLetra === '–' ? '–' : endiv.notaLetra,
    poup.notaLetra === '–' ? '–' : poup.notaLetra,
    liq.notaLetra === '–' ? '–' : liq.notaLetra,
  )
  const exercicioFiscalStr =
    fiscalMun?.exercicio != null ? String(fiscalMun.exercicio) : 'N/D'
  const anoBaseCapagStr =
    capag?.ano_referencia != null
      ? String(capag.ano_referencia)
      : '2023'

  return {
    processo: String(p.numero ?? numeroProcesso),
    titular: nd(p.titular),
    cnpj: nd(p.cnpj_titular ?? p.cnpj),
    substancia_anm: labelSubstanciaParaExibicao(substanciaRaw),
    regime: regimeFmt,
    fase: faseFmt,
    fase_processo: faseFmt,
    regime_display: regimeFmt,
    area_ha: areaHa,
    municipio: municipioUf,
    bioma: analise?.bioma?.length
      ? analise.bioma.map((b) => b.nome).join(', ')
      : nd(p.bioma),

    alvara_validade: alvaraRaw
      ? formatIsoToBr(String(alvaraRaw))
      : 'Não disponível',
    alvara_status: nd(p.alvara_status),
    ultimo_despacho: (() => {
      const ud = p.ultimo_evento_descricao
      if (ud != null && String(ud).trim() !== '') {
        const ue = p.ultimo_evento_data
        const datePart =
          ue != null && String(ue).trim() !== ''
            ? `${formatIsoToBr(String(ue))} · `
            : ''
        return nd(`${datePart}${String(ud).trim()}`)
      }
      return nd(p.ultimo_despacho)
    })(),
    nup_sei: nd(String(p.nup_sei ?? p.numero_sei ?? '')),
    gu_status: nd(p.gu_status),
    gu_pendencia: nd(p.gu_pendencia),
    tah_status: nd(p.tah_status),
    licenca_ambiental: nd(p.licenca_ambiental),
    protocolo_anos: (() => {
      const ap = p.ano_protocolo
      if (ap != null && Number.isFinite(Number(ap))) {
        return new Date().getFullYear() - Number(ap)
      }
      const numero = String(p.numero ?? '')
      const match = /\/(\d{4})$/.exec(numero)
      if (match) {
        const anoProtocolo = parseInt(match[1], 10)
        return new Date().getFullYear() - anoProtocolo
      }
      return Number(p.protocolo_anos) || 0
    })(),

    risk_score: riskScore,
    rs_classificacao: rs_classificacao_final,
    rs_geo: rsGeo,
    rs_amb: rsAmb,
    rs_soc: rsSoc,
    rs_reg: rsReg,

    os_conservador: osCons,
    os_moderado: osMod,
    os_arrojado: osArr,
    os_classificacao: osClass,
    os_merc: osMerc,
    os_viab: osViab,
    os_seg: osSeg,

    preco_oz_usd: precoOzUsd,
    preco_g_brl: precoBrlPorGrama,
    ptax: cambioRef,
    var_12m_pct: var12,
    mercado_tendencia:
      mercado?.tendencia != null &&
      String(mercado.tendencia).trim() !== ''
        ? String(mercado.tendencia).trim()
        : 'Não disponível',
    cagr_5a_pct: cagr5,
    /** Master: `demanda_projetada_2030` é texto; sem campo em ReportData até o redesenho do PDF. */
    demanda_global_t: 0,
    reservas_mundiais_pct: Number(mercado?.reservas_br_pct ?? 0) || 0,
    producao_mundial_pct: Number(mercado?.producao_br_pct ?? 0) || 0,
    estrategia_nacional: mercado?.estrategia_nacional
      ? fixEstrategiaNacionalPnmAcentos(String(mercado.estrategia_nacional))
      : 'Não disponível',
    aplicacoes_substancia: (() => {
      const a = mercado?.aplicacoes
      const u = mercado?.aplicacoes_usgs
      const s = [a, u].find((x) => x != null && String(x).trim() !== '')
      return s != null ? String(s).trim() : null
    })(),
    cfem_aliquota_pct: cfemPctAliquota,
    valor_insitu_usd_ha: valReservaUsdHa,
    cfem_estimada_ha: cfemEstimadaHaFinal,

    mapa_base64: '',
    layers: analise
      ? buildLayersFromPostGIS(analise)
      : buildLayersFromApi(api.territorial.layers as Record<string, unknown>[]),
    infraestrutura: analise
      ? buildInfraFromPostGIS(analise)
      : buildInfraFromApi(api.territorial.infra as Record<string, unknown>[]),

    capag_nota: capagNota,
    capag_endiv: endiv.texto,
    capag_endiv_nota: endiv.notaLetra === '–' ? '–' : endiv.notaLetra,
    capag_poupcorr: poup.texto,
    capag_poupcorr_nota: poup.notaLetra === '–' ? '–' : poup.notaLetra,
    capag_liquidez: liq.texto,
    capag_liquidez_nota: liq.notaLetra === '–' ? '–' : liq.notaLetra,
    capag_nota_final: capagNota,
    capag_indicadores: {
      endividamento: {
        valor: endiv.texto,
        nota: endiv.notaLetra === '–' ? '–' : endiv.notaLetra,
      },
      poupanca_corrente: {
        valor: poup.texto,
        nota: poup.notaLetra === '–' ? '–' : poup.notaLetra,
      },
      liquidez: {
        valor: liq.texto,
        nota: liq.notaLetra === '–' ? '–' : liq.notaLetra,
      },
    },
    capag_pior_indicador_nome: piorCap.indicador,
    capag_pior_indicador_letra: piorCap.letra,
    dados_sei: dadosSeiFromProcesso(p),
    receita_propria: templateFiscal.receita_propria,
    divida: templateFiscal.divida,
    pib_municipal: pibMunicipalStr,
    dependencia_transf: templateFiscal.dependencia_transf,
    populacao: templateFiscal.populacao,
    idh: templateFiscal.idh,
    fiscal_contexto_referencia: `CAPAG ano-base ${anoBaseCapagStr} | Exercício fiscal ${exercicioFiscalStr}`,
    incentivos: {
      programa_estadual:
        incentivosUf != null &&
        incentivosUf.programas != null &&
        String(incentivosUf.programas).trim() !== ''
          ? String(incentivosUf.programas)
          : nd(p.programa_estadual_incentivos),
      linhas_bndes:
        linhasBndesNomes.length ||
        linhasBndes.length ||
        Number(p.linhas_bndes ?? 0) ||
        0,
      linhas_bndes_nomes: linhasBndesNomes,
    },
    cfem_historico: cfemHistoricoFromApi(cfemRows),

    estagio,
    estagio_index,

    data_relatorio: dataRelatorio,
    versao: 'R1',
  }
}
