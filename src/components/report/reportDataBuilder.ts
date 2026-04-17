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
import type { ReportLang } from '../../lib/reportLang'
import { getCfemProcessoStatus } from '../../lib/cfemProcessoStatus'
import { getReportStrings } from '../report/reportL10n'

/** 1 t métrica = 32.151 oz troy (preço master em USD/t → exibição em oz). */
const OZ_POR_TONELADA = 32_151
/** Premissa TERRADAR: volume de massa por ha para val in-situ (30 m × 2,5 t/m³ × 10.000 m²). */
const TONELADAS_POR_HA = 750_000

function riskDimFromScore(score: number, lang: ReportLang): RiskDimension {
  const color = corFaixaRiscoValor(score)
  const en = lang === 'en'
  let label = en ? 'Moderate' : 'Moderado'
  if (score <= 10) label = en ? 'Very low' : 'Muito baixo'
  else if (score <= 25) label = en ? 'Low' : 'Baixo'
  else if (score <= 50) label = en ? 'Moderate' : 'Moderado'
  else if (score <= 75) label = en ? 'High' : 'Alto'
  else label = en ? 'Very high' : 'Muito alto'

  return {
    valor: score,
    label,
    width_pct: Math.min(100, Math.max(0, score)),
    color,
  }
}

/**
 * Dicionário de substâncias minerais PT→EN. Usado para traduzir `substancia_anm`
 * e os itens da coluna "Commodities" do histórico CFEM quando o relatório é emitido em EN.
 *
 * A chave é a grafia PT canônica (com acentos, capitalização natural); a função de tradução
 * também normaliza versões UPPERCASE e sem acentos. Mantém o valor original quando desconhecido.
 */
const COMMODITY_PT_EN: Record<string, string> = {
  'Minério de ouro': 'Gold ore',
  'Ouro': 'Gold',
  'Minério de ferro': 'Iron ore',
  'Ferro': 'Iron',
  'Minério de cobre': 'Copper ore',
  'Cobre': 'Copper',
  'Minério de zircônio': 'Zirconium ore',
  'Minério de zirconio': 'Zirconium ore',
  'Zircônio': 'Zirconium',
  'Zirconio': 'Zirconium',
  'Bauxita': 'Bauxite',
  'Nióbio': 'Niobium',
  'Niobio': 'Niobium',
  'Lítio': 'Lithium',
  'Litio': 'Lithium',
  'Níquel': 'Nickel',
  'Niquel': 'Nickel',
  'Manganês': 'Manganese',
  'Manganes': 'Manganese',
  'Estanho': 'Tin',
  'Chumbo': 'Lead',
  'Zinco': 'Zinc',
  'Alumínio': 'Aluminum',
  'Aluminio': 'Aluminum',
  'Prata': 'Silver',
  'Terras Raras': 'Rare earth elements',
  'Terras raras': 'Rare earth elements',
  'Neodímio': 'Neodymium',
  'Neodimio': 'Neodymium',
  'Praseodímio': 'Praseodymium',
  'Praseodimio': 'Praseodymium',
  'Térbio': 'Terbium',
  'Terbio': 'Terbium',
  'Disprósio': 'Dysprosium',
  'Disprosio': 'Dysprosium',
  'Quartzo': 'Quartz',
  'Areia': 'Sand',
  'Granito': 'Granite',
  'Argila': 'Clay',
  'Calcário': 'Limestone',
  'Calcario': 'Limestone',
  'Fosfato': 'Phosphate',
  'Gipsita': 'Gypsum',
  'Dolomita': 'Dolomite',
  'Mármore': 'Marble',
  'Marmore': 'Marble',
  'Ardósia': 'Slate',
  'Ardosia': 'Slate',
  'Caulim': 'Kaolin',
  'Cromita': 'Chromite',
  'Cassiterita': 'Cassiterite',
  'Diamante': 'Diamond',
  'Turmalina': 'Tourmaline',
}

/**
 * Dicionário de regimes e fases minerárias (ANM) PT→EN.
 * Cobre tanto o nome do regime quanto o valor bruto que às vezes vem na fase (ex.: "Autorização de Pesquisa").
 */
const TENURE_PT_EN: Record<string, string> = {
  'Autorização de Pesquisa': 'Exploration authorization',
  'Autorizacao de Pesquisa': 'Exploration authorization',
  'Concessão de Lavra': 'Mining concession',
  'Concessao de Lavra': 'Mining concession',
  'Requerimento de Pesquisa': 'Exploration application',
  'Requerimento de Lavra': 'Mining application',
  'Requerimento de Licenciamento': 'Licensing application',
  'Requerimento de Registro de Extração': 'Extraction registration application',
  'Requerimento de Lavra Garimpeira': 'Garimpo permit application',
  'Licenciamento': 'Licensing',
  'Registro de Extração': 'Extraction registration',
  'Registro de Extracao': 'Extraction registration',
  'Disponibilidade': 'Availability',
  'Grupamento Mineiro': 'Mining group',
  'Permissão de Lavra Garimpeira': 'Garimpo mining permit',
  'Permissao de Lavra Garimpeira': 'Garimpo mining permit',
  'Pesquisa': 'Exploration',
  'Lavra': 'Production',
  'Requerimento': 'Application',
  'Concessão': 'Concession',
  'Concessao': 'Concession',
  'Suspensão': 'Suspension',
  'Suspensao': 'Suspension',
  'Encerrado': 'Closed',
  'Encerramento': 'Closure',
}

function ciLookup(dict: Record<string, string>, raw: string): string | null {
  const norm = stripAccents(raw).toUpperCase().replace(/\s+/g, ' ').trim()
  for (const k of Object.keys(dict)) {
    const kn = stripAccents(k).toUpperCase().replace(/\s+/g, ' ').trim()
    if (kn === norm) return dict[k]
  }
  return null
}

/**
 * Traduz uma substância PT→EN preservando o case original (UPPERCASE / Title Case / lower).
 * Suporta listas separadas por vírgula, ponto e vírgula ou barra.
 */
function translateCommodity(raw: string, lang: ReportLang): string {
  if (lang !== 'en') return raw
  const s = String(raw ?? '').trim()
  if (!s) return raw
  return s
    .split(/[,;/]/)
    .map((part) => {
      const trimmed = part.trim()
      if (!trimmed) return trimmed
      const hit = ciLookup(COMMODITY_PT_EN, trimmed)
      if (!hit) return trimmed
      if (trimmed === trimmed.toUpperCase()) return hit.toUpperCase()
      return hit
    })
    .filter((x) => x !== '')
    .join(', ')
}

/**
 * Traduz regime/fase minerária PT→EN; mantém o raw quando desconhecido.
 */
function translateTenure(raw: string, lang: ReportLang): string {
  if (lang !== 'en') return raw
  const s = String(raw ?? '').trim()
  if (!s) return raw
  const hit = ciLookup(TENURE_PT_EN, s)
  return hit ?? raw
}

/**
 * Dicionário de frases canônicas do `estrategia_nacional` PNM PT→EN. Muitos valores vêm do
 * master de substâncias como texto livre, então fazemos substituição por frase inteira quando
 * reconhecemos o texto (fallback: mantém o PT, que é menos ruim que uma tradução grosseira).
 */
const PNM_PHRASES_PT_EN: Array<[RegExp | string, string]> = [
  [
    /Rastreabilidade da cadeia produtiva \(LGPD e compliance LBMA\) e combate ao garimpo ilegal\. Formaliza[cç][aã]o de pequenos produtores via cooperativas \(PNM 2030 \/ Decreto 10\.966\/2022\)\./i,
    'Supply-chain traceability (LGPD and LBMA compliance) and enforcement against illegal mining. Formalization of small-scale producers through cooperatives (PNM 2030 / Decree 10,966/2022).',
  ],
  [
    /PNM 2030: rastreabilidade da cadeia produtiva e combate ao garimpo ilegal\. Certifica[cç][aã]o de origem para exporta[cç][aã]o \(compliance LBMA\)\. Formaliza[cç][aã]o e fortalecimento de MPEs e cooperativas garimpeiras\./i,
    'PNM 2030: traceability of the mineral supply chain and enforcement against illegal mining. Origin certification for exports (LBMA compliance). Formalization and strengthening of small-scale miners and cooperatives.',
  ],
  [
    /Brasil domina 94% das reservas e 88% da produ[cç][aã]o mundial\. CBMM refer[eê]ncia global\./i,
    'Brazil holds 94% of world reserves and 88% of global production. CBMM is the global benchmark.',
  ],
  [
    /Pol[ií]tica de valor agregado e log[ií]stica ferrovi[aá]ria\/portu[aá]ria; CPAs e desmatamento zero na mira regulat[oó]ria\./i,
    'Value-added policy and rail/port logistics; CPAs and zero-deforestation targets under regulatory focus.',
  ],
  [
    /Programas de mapeamento mineral e incentivo a estudos de viabilidade em prov[ií]ncias polimet[aá]licas\./i,
    'Mineral mapping programs and incentives for feasibility studies in polymetallic provinces.',
  ],
  [
    /Integra[cç][aã]o com parque solar e cer[aâ]mica; exig[eê]ncias de licenciamento ambiental municipal\./i,
    'Integration with solar and ceramics clusters; municipal environmental licensing requirements.',
  ],
  [
    /Expans[aã]o de refinarias costeiras e log[ií]stica mineral; aten[cç][aã]o a licen[cç]as de supress[aã]o em Cerrado\./i,
    'Expansion of coastal refineries and mineral logistics; attention to vegetation-removal permits in the Cerrado.',
  ],
  [
    /Inser[cç][aã]o em rota estrat[eé]gica de minerais cr[ií]ticos; prioridade a estudos de salar e pegmatitos com ESG refor[cç]ado\./i,
    'Inclusion in the strategic critical-minerals route; priority on salar and pegmatite studies with reinforced ESG.',
  ],
  [
    /Integra[cç][aã]o com polo de Goi[aá]s\/Tocantins e incentivos [aà] metalurgia de primeira transforma[cç][aã]o\./i,
    'Integration with the Goiás/Tocantins hub and incentives for first-stage metallurgy.',
  ],
  [
    /Acompanhamento setorial ANM e pol[ií]tica mineral\./i,
    'Sectoral monitoring by ANM and mineral policy.',
  ],
]

function translateEstrategiaPnm(raw: string, lang: ReportLang): string {
  if (lang !== 'en') return raw
  const s = String(raw ?? '').trim()
  if (!s) return raw
  for (const [needle, repl] of PNM_PHRASES_PT_EN) {
    if (typeof needle === 'string') {
      if (s === needle) return repl
    } else if (needle.test(s)) {
      return s.replace(needle, repl)
    }
  }
  return raw
}

/**
 * Traduz rótulos PT comuns do domínio (classificações, tendência de preço) para EN quando
 * o relatório é emitido em inglês. Preserva valores desconhecidos inalterados.
 */
function translatePtLabel(raw: string, lang: ReportLang): string {
  if (lang !== 'en') return raw
  const s = String(raw ?? '').trim()
  if (!s) return raw
  const map: Record<string, string> = {
    // Classificações de risco
    'risco baixo': 'Low risk',
    'risco médio': 'Medium risk',
    'risco medio': 'Medium risk',
    'risco alto': 'High risk',
    // Classificações de oportunidade / genéricas
    'muito favorável': 'Very favorable',
    'muito favoravel': 'Very favorable',
    'favorável': 'Favorable',
    'favoravel': 'Favorable',
    'moderada': 'Moderate',
    'moderado': 'Moderate',
    'desfavorável': 'Unfavorable',
    'desfavoravel': 'Unfavorable',
    // Tendências de mercado (master_substancias.tendencia)
    'alta': 'Rising',
    'em alta': 'Rising',
    'estável': 'Stable',
    'estavel': 'Stable',
    'lateral': 'Sideways',
    'baixa': 'Falling',
    'em baixa': 'Falling',
    'queda': 'Falling',
    // Faixas
    'muito baixo': 'Very low',
    'muito baixa': 'Very low',
    'baixo': 'Low',
    'muito alto': 'Very high',
    'muito alta': 'Very high',
    'alto': 'High',
    // Fases
    'pesquisa': 'Exploration',
    'lavra': 'Production',
  }
  const hit = map[s.toLowerCase()]
  return hit ?? raw
}

function osDimFromScore(valor: number, lang: ReportLang): RiskDimension {
  const color = corFaixaOS(valor)
  const en = lang === 'en'
  let label = en ? 'Moderate' : 'Moderado'
  // Cortes alinhados a `corFaixaOS` (3 cores): ≥80 muito favorável, ≥60 favorável,
  // ≥40 moderado, <40 desfavorável. Garante que label e cor da barra batam sempre.
  if (valor >= 80) label = en ? 'Very favorable' : 'Muito favorável'
  else if (valor >= 60) label = en ? 'Favorable' : 'Favorável'
  else if (valor >= 40) label = en ? 'Moderate' : 'Moderado'
  else label = en ? 'Unfavorable' : 'Desfavorável'

  return {
    valor,
    label,
    width_pct: Math.min(100, Math.max(0, valor)),
    color,
  }
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

function normalizeTipoLayer(raw: unknown): string {
  const k = (typeof raw === 'string' ? raw : String(raw ?? '')).trim()
  switch (k) {
    case 'Terra Indigena':
    case 'TI':
      return 'Terra Indígena'
    case 'UC Protecao Integral':
    case 'UC PI':
      return 'UC (PI) Proteção integral'
    case 'UC Uso Sustentavel':
    case 'UC US':
      return 'UC (US) Uso sustentável'
    case 'Aquifero':
      return 'Aquífero'
    default:
      return k
  }
}

function buildLayersFromApi(
  rows: Record<string, unknown>[],
  nd: (s: unknown) => string,
  tagSobre: string,
  tagNao: string,
): LayerData[] {
  if (!rows.length) return []
  return rows.map((row) => {
    const sobrePct = Number(row.sobreposicao_pct ?? 0)
    const sobreposto = sobrePct > 0
    return {
      tipo: normalizeTipoLayer(row.tipo),
      nome: nd(row.nome),
      detalhes: nd(row.detalhes),
      distancia_km: Number(row.distancia_km) || 0,
      sobreposto,
      tag_class: sobreposto ? 'ta' : 'tg',
      tag_label: sobreposto ? tagSobre : tagNao,
    }
  })
}

function buildInfraFromApi(
  rows: Record<string, unknown>[],
  nd: (s: unknown) => string,
): InfraData[] {
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
function buildLayersFromPostGIS(
  analise: AnaliseTerritorial,
  tagSobre: string,
  tagNao: string,
): LayerData[] {
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
      tag_label: sobreposto ? tagSobre : tagNao,
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
      tag_label: tagSobre,
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

/**
 * Número máximo de linhas exibidas no quadro «Arrecadação CFEM (histórico)».
 * Mantemos os 5 anos mais recentes com arrecadação > 0 — descarta anos zerados e trunca a
 * janela para evitar que a página 5 (Fiscal) estoure o layout impresso.
 */
const MAX_CFEM_YEARS = 5

function cfemHistoricoFromApi(
  cfem: Record<string, unknown>[],
  nd: (s: unknown) => string,
  lang: ReportLang,
  regime: string | null | undefined,
): CfemHistoricoItem[] {
  const en = lang === 'en'
  const status = getCfemProcessoStatus(regime)
  const processoValorCell = (): string => {
    if (status === 'SEM_DADO_INDIVIDUALIZADO') {
      return en
        ? 'Not available per process in current database'
        : 'Não individualizado na base'
    }
    if (status === 'PROCESSO_NAO_PRODUTIVO') {
      return nd(null)
    }
    return nd(null)
  }
  const mapped = cfem.map((r) => {
    const v = Number(r.valor_brl) || 0
    const br = formatBrlNum(v)
    const substanciasRaw = Array.isArray(r.substancias)
      ? r.substancias.map((x) => String(x)).join(', ')
      : r.substancias
    return {
      ano: Number(r.ano) || 0,
      valor: v,
      municipio_valor: br,
      substancias: nd(translateCommodity(String(substanciasRaw ?? ''), lang)),
    }
  })

  const topRecent = mapped
    .filter((r) => r.ano > 0 && r.valor > 0)
    .sort((a, b) => b.ano - a.ano)
    .slice(0, MAX_CFEM_YEARS)
    .sort((a, b) => a.ano - b.ano)

  return topRecent.map((r) => ({
    ano: r.ano,
    processo_valor: processoValorCell(),
    municipio_valor: r.municipio_valor,
    substancias: r.substancias,
  }))
}

function rsClassificacaoLabel(total: number, lang: ReportLang): string {
  const en = lang === 'en'
  if (total < 40) return en ? 'Low risk' : 'Risco baixo'
  if (total <= 69) return en ? 'Medium risk' : 'Risco médio'
  return en ? 'High risk' : 'Risco alto'
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
  nd: (s: unknown) => string,
  locale: string,
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
      ? `R$ ${(receitaBrl / 1_000_000).toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} Mi`
      : nd(null)

  const divida = formatDividaConsolidadaExibicao(fm)

  const depPct = numFiscalOuNull(fm, 'dep_transferencias_pct')
  const dependencia_transf =
    depPct != null
      ? `${depPct.toLocaleString(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : nd(null)

  let idh: string
  if (fm?.idh != null && String(fm.idh).trim() !== '') {
    const idhN = Number(fm.idh)
    idh = Number.isFinite(idhN)
      ? idhN.toLocaleString(locale, {
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
      ? `${pop.toLocaleString(locale)} hab.`
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
  lang: ReportLang = 'pt',
  mapBase64?: string,
): Promise<ReportData> {
  const t = getReportStrings(lang)
  const nd = (s: unknown) => {
    const x = String(s ?? '').trim()
    return x === '' ? t.nd : x
  }

  const api = await fetchProcessoCompleto(numeroProcesso)
  const pendenciasOrdenadas = [...(api.pendencias ?? [])].sort((a, b) => {
    const pa = a.status === 'CRITICA' ? 0 : 1
    const pb = b.status === 'CRITICA' ? 0 : 1
    if (pa !== pb) return pa - pb
    return (b.dias_em_aberto ?? 0) - (a.dias_em_aberto ?? 0)
  })
  const pendenciasFmt: string[] = pendenciasOrdenadas.map((pd) => {
    const label = pd.status === 'CRITICA' ? 'CRITICA' : pd.gravidade
    const cab = label ? `${pd.tipo} (${label})` : pd.tipo
    const partes: string[] = [cab]
    if (pd.data_origem) {
      const d = new Date(pd.data_origem)
      if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getUTCDate()).padStart(2, '0')
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
        const yyyy = d.getUTCFullYear()
        partes.push(`${dd}/${mm}/${yyyy}`)
      }
    }
    if (pd.dias_em_aberto != null) {
      partes.push(`${pd.dias_em_aberto} dias em aberto`)
    }
    return partes.join(' · ')
  })
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
    rs_classificacao_final = translatePtLabel(scoresAuto.risk_label, lang)

    rsGeo = riskDimFromScore(scoresAuto.risk_breakdown.geologico, lang)
    rsAmb = riskDimFromScore(scoresAuto.risk_breakdown.ambiental, lang)
    rsSoc = riskDimFromScore(scoresAuto.risk_breakdown.social, lang)
    rsReg = riskDimFromScore(scoresAuto.risk_breakdown.regulatorio, lang)

    osCons = scoresAuto.os_conservador
    osMod = scoresAuto.os_moderado
    osArr = scoresAuto.os_arrojado
    osClass = translatePtLabel(scoresAuto.os_label_conservador, lang)

    osMerc = osDimFromScore(scoresAuto.os_breakdown.atratividade, lang)
    osViab = osDimFromScore(scoresAuto.os_breakdown.viabilidade, lang)
    osSeg = osDimFromScore(scoresAuto.os_breakdown.seguranca, lang)
  } else {
    riskScore = Number(scores?.risk_score ?? 0) || 0
    const riskLabelRaw = String(scores?.risk_label ?? '').trim()
    rs_classificacao_final = riskLabelRaw
      ? translatePtLabel(riskLabelRaw, lang)
      : rsClassificacaoLabel(riskScore, lang)

    const dimsRisco = parseDimJson(scores?.dimensoes_risco)
    rsGeo = riskDimFromScore(
      scoreFromDimensao(dimsRisco, ['geologico', 'geológico']),
      lang,
    )
    rsAmb = riskDimFromScore(
      scoreFromDimensao(dimsRisco, ['ambiental']),
      lang,
    )
    rsSoc = riskDimFromScore(scoreFromDimensao(dimsRisco, ['social']), lang)
    rsReg = riskDimFromScore(
      scoreFromDimensao(dimsRisco, ['regulatorio', 'regulatório']),
      lang,
    )

    const dimsOport = parseDimJson(scores?.dimensoes_oportunidade)
    osMerc = osDimFromScore(
      scoreFromDimensao(dimsOport, ['mercado', 'atratividade']),
      lang,
    )
    osViab = osDimFromScore(
      scoreFromDimensao(dimsOport, ['viabilidade']),
      lang,
    )
    osSeg = osDimFromScore(
      scoreFromDimensao(dimsOport, ['seguranca', 'segurança']),
      lang,
    )

    osCons = Number(scores?.os_conservador ?? 0) || 0
    osMod = Number(scores?.os_moderado ?? 0) || 0
    osArr = Number(scores?.os_arrojado ?? 0) || 0
    const osClassRaw =
      String(scores?.os_classificacao ?? '').trim() ||
      String(scores?.os_label ?? '').trim()
    osClass = osClassRaw ? translatePtLabel(osClassRaw, lang) : t.nd
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
  const regimeParaCfem =
    p.regime == null || String(p.regime).trim() === ''
      ? null
      : String(p.regime)
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
   * Exibição do preço spot: a unidade real vem de master_substancias.unidade_preco (ex.: 'oz' para ouro, 't' para mármore/ferro).
   * O sublabel "R$ X/g" só faz sentido para metais preciosos cotados em oz; para commodities/rochas ornamentais é suprimido.
   */
  const precoUnidadeLabel =
    unidadePreco === 'oz' ? 'oz' : unidadePreco !== '' ? unidadePreco : 't'
  const precoSubLabel: string | null =
    unidadePreco === 'oz' && precoBrlPorGrama > 0
      ? `R$ ${precoBrlPorGrama.toLocaleString(t.locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}/g`
      : null

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

  /** `var_1a_pct` e `cagr_5a_pct` podem ser NULL na master (substância sem série publicada). Preservamos null. */
  const var12: number | null =
    mercado?.var_1a_pct == null ||
    (typeof mercado.var_1a_pct === 'string' && String(mercado.var_1a_pct).trim() === '')
      ? null
      : Number.isFinite(Number(mercado.var_1a_pct))
        ? Number(mercado.var_1a_pct)
        : null
  const cagr5: number | null =
    mercado?.cagr_5a_pct == null ||
    (typeof mercado.cagr_5a_pct === 'string' && String(mercado.cagr_5a_pct).trim() === '')
      ? null
      : Number.isFinite(Number(mercado.cagr_5a_pct))
        ? Number(mercado.cagr_5a_pct)
        : null

  let pibMunicipalStr: string = t.nd
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

  const templateFiscal = indicadoresMunicipaisParaTemplate(
    fiscalMun,
    p,
    nd,
    t.locale,
  )

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
    substancia_anm: translateCommodity(
      labelSubstanciaParaExibicao(substanciaRaw),
      lang,
    ),
    regime: translateTenure(regimeFmt, lang),
    fase: translateTenure(faseFmt, lang),
    fase_processo: faseFmt,
    regime_display: translateTenure(regimeFmt, lang),
    area_ha: areaHa,
    municipio: municipioUf,
    bioma: analise?.bioma?.length
      ? analise.bioma.map((b) => b.nome).join(', ')
      : nd(p.bioma),

    alvara_validade: alvaraRaw
      ? formatIsoToBr(String(alvaraRaw))
      : nd(null),
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
    pendencias: pendenciasFmt,
    tah_status: (() => {
      const dt = p.tah_ultimo_pagamento
      if (dt != null && String(dt).trim() !== '') {
        return `Pago em ${formatIsoToBr(String(dt))}`
      }
      return nd(p.tah_status)
    })(),
    licenca_ambiental: (() => {
      const dt = p.licenca_ambiental_data
      if (dt != null && String(dt).trim() !== '') {
        return `Protocolada em ${formatIsoToBr(String(dt))}`
      }
      return nd(p.licenca_ambiental)
    })(),
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

    preco_spot_usd_t: precoUsdPorT,
    preco_oz_usd: precoOzUsd,
    preco_g_brl: precoBrlPorGrama,
    ptax: cambioRef,
    preco_unidade_label: precoUnidadeLabel,
    preco_sub_label: precoSubLabel,
    var_12m_pct: var12,
    mercado_tendencia:
      mercado?.tendencia != null &&
      String(mercado.tendencia).trim() !== ''
        ? translatePtLabel(String(mercado.tendencia).trim(), lang)
        : t.mercadoTendenciaNd,
    cagr_5a_pct: cagr5,
    /** Master: `demanda_projetada_2030` é texto; sem campo em ReportData até o redesenho do PDF. */
    demanda_global_t: 0,
    reservas_mundiais_pct: Number(mercado?.reservas_br_pct ?? 0) || 0,
    producao_mundial_pct: Number(mercado?.producao_br_pct ?? 0) || 0,
    fonte_res_prod:
      mercado?.fonte_res_prod != null &&
      String(mercado.fonte_res_prod).trim() !== ''
        ? String(mercado.fonte_res_prod).trim()
        : null,
    estrategia_nacional: mercado?.estrategia_nacional
      ? translateEstrategiaPnm(
          fixEstrategiaNacionalPnmAcentos(String(mercado.estrategia_nacional)),
          lang,
        )
      : t.nd,
    aplicacoes_substancia: (() => {
      const a = mercado?.aplicacoes
      const u = mercado?.aplicacoes_usgs
      const s = [a, u].find((x) => x != null && String(x).trim() !== '')
      return s != null ? String(s).trim() : null
    })(),
    cfem_aliquota_pct: cfemPctAliquota,
    valor_insitu_usd_ha: valReservaUsdHa,
    cfem_estimada_ha: cfemEstimadaHaFinal,

    mapa_base64: mapBase64 && mapBase64.length > 20 ? mapBase64 : '',
    layers:
      Array.isArray(api.territorial?.layers) && api.territorial.layers.length > 0
        ? buildLayersFromApi(
            api.territorial.layers as Record<string, unknown>[],
            nd,
            t.tagSobreposto,
            t.tagNao,
          )
        : analise
          ? buildLayersFromPostGIS(analise, t.tagSobreposto, t.tagNao)
          : [],
    infraestrutura:
      Array.isArray(api.territorial?.infra) && api.territorial.infra.length > 0
        ? buildInfraFromApi(
            api.territorial.infra as Record<string, unknown>[],
            nd,
          )
        : analise
          ? buildInfraFromPostGIS(analise)
          : [],

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
    fiscal_contexto_referencia: t.fiscalRefTpl(anoBaseCapagStr, exercicioFiscalStr),
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
    cfem_historico: cfemHistoricoFromApi(cfemRows, nd, lang, regimeParaCfem),
    cfem_processo_status: getCfemProcessoStatus(regimeParaCfem),

    estagio,
    estagio_index,

    data_relatorio: dataRelatorio,
    versao: 'R1',

    lang,
  }
}
