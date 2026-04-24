import { createPortal } from 'react-dom'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ArrowUpRight, Ban, Info, Loader2, Sparkles } from 'lucide-react'
import { relatoriosMock } from '../../data/relatorio.mock'
import type {
  DadosANM,
  IntelMineral,
  ObservacoesTecnicas,
  ObservacoesTecnicasItem,
  RelatorioData,
  RelatorioOportunidadeData,
  RelatorioScoresExibicaoApi,
  Timestamps,
} from '../../data/relatorio.mock'
import {
  rotuloFontePublicacaoExibicao,
  textoTooltipNivelImpactoLegislativo,
} from '../../lib/alertaImpactoLegislativo'
import { estiloBadgeRelevancia } from '../../lib/relevanciaAlerta'
import { formatarRealBrlInteligente } from '../../lib/formatarRealBrlInteligente'
import { formatarUsdMiInteligente } from '../../lib/formatarUsdMiInteligente'
import {
  formatarSubstancia,
  labelSubstanciaParaExibicao,
  substanciaDesconhecida,
} from '../../lib/substancias'
import { textoAposSemFonteOficial } from '../../lib/reportFonteResProd'
import {
  formatarPctTopUf,
  formatarPrecoMedioBrBrlPorT,
  formatarProducaoNacionalT,
  formatarValorProducaoBrBrl,
  isTipoMercadoBrOnly,
} from '../../lib/formatContextoBrasilIntel'
import { REGIME_LABELS } from '../../lib/regimes'
import { RegimeBadge } from '../ui/RegimeBadge'
import { AlertaItemImpactoBar } from '../legislativo/AlertaItemImpactoBar'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import { TextoTruncadoComTooltip } from '../ui/TextoTruncadoComTooltip'
import { gerarRiskDecomposicaoParaProcesso } from '../../lib/riskScoreDecomposicao'
import {
  corFaixaOS,
  PESOS_OS_POR_PERFIL,
  type PerfilOportunidadeOSKey,
} from '../../lib/oportunidadeRelatorioUi'
import { getOpportunityLabel } from '../../lib/opportunityScore'
import { normalizarSeparadoresRotuloDb } from '../../lib/normalizarRotuloScore'
import type {
  AlertaLegislativo,
  CfemBreakdownMunicipio,
  ClassificacaoZumbi,
  Fase,
  Processo,
  Regime,
} from '../../types'
import { ExportReportButton } from '../report/ExportReportButton'
import { fmtCfemEstimadaBrlMiPerHa } from '../report/reportHtmlUtils'
import { fraseDeterminadaPeloIndicadorCapag } from '../../lib/capagPiorIndicador'
import { normalizeCapagNotaDisplay } from '../../lib/fiscalDisplay'
import { RiskDecomposicaoRelatorioPanel } from './RiskDecomposicaoRelatorioPanel'
import { OportunidadeDecomposicaoRelatorioPanel } from './OportunidadeDecomposicaoRelatorioPanel'
import { OportunidadePerfilCalcTooltipContent } from './OportunidadeScoreCalcTooltipContent'
import { RiskTotalCalcTooltipContent } from './RiskScoreCalcTooltipContent'
// import { DrawerRegulatoryBadges } from "./DrawerRegulatoryBadges"; // TODO: arquivo nunca existiu no repo, componente referenciado mas nao criado (bug pre-existente em b30d6ad)
import { ProcessoEventosTimeline } from './ProcessoEventosTimeline'
import { useExchangeRate } from '../../context/ExchangeRateContext'
import {
  getSubstanceMarketState,
  textoExplicativoFonte,
  type SubstanceMarketState,
} from '../../lib/substanceMarketState'
import { useTerritorialAmbiental } from '../../hooks/useTerritorialAmbiental'
import {
  appOverlapTextColor,
  formatDistM,
} from '../../lib/territorialAmbientalDisplay'

type AbaId =
  | 'processo'
  | 'territorio'
  | 'inteligencia'
  | 'risco'
  | 'oportunidade'
  | 'fiscal'

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'processo', label: 'Processo' },
  { id: 'territorio', label: 'Território' },
  { id: 'inteligencia', label: 'Inteligência' },
  { id: 'risco', label: 'Risco' },
  { id: 'oportunidade', label: 'Oportunidade' },
  { id: 'fiscal', label: 'Fiscal' },
]

/** Mesma cor de "Camadas disponíveis" na sidebar (`index.css` --text-section-title) */
const SECTION_TITLE = 'var(--text-section-title)'


/** Escala tipográfica do drawer (mínimo 12px) */
const FS = {
  min: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  metric: 17,
  xl: 18,
  xxl: 21,
  h2: 23,
  display: 26,
  hero: 56,
  jumbo: 58,
  highlight: 32,
} as const

const GRAMAS_POR_ONCA_TROY = 31.1034768

/** Preço BRL no drawer: USD × câmbio ao vivo; se indisponível, legado da master. */
function computePrecoBrlDrawer(
  intel: IntelMineral,
  liveRate: number | null,
): { brlPorGrama: number | null; brlPorTonelada: number | null } {
  if (liveRate != null && liveRate > 0) {
    let brlPorGrama: number | null = null
    if (
      intel.unidade_preco === 'oz' &&
      intel.preco_referencia_usd_oz != null &&
      intel.preco_referencia_usd_oz > 0
    ) {
      brlPorGrama =
        (intel.preco_referencia_usd_oz * liveRate) / GRAMAS_POR_ONCA_TROY
    }
    const brlPorTonelada =
      intel.preco_medio_usd_t > 0 ? intel.preco_medio_usd_t * liveRate : null
    return { brlPorGrama, brlPorTonelada }
  }
  const legG = intel.preco_brl_por_g_legacy
  const legT = intel.preco_brl_por_t_legacy
  return {
    brlPorGrama: legG != null && legG > 0 ? legG : null,
    brlPorTonelada: legT != null && legT > 0 ? legT : null,
  }
}

/** Borda superior inativa (faixa com opacidade). */
function hexCorParaRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return hex
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const RX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Total municipal na linha histórica: `valor_total_municipio_brl` (API) ou `valor_recolhido_brl` (mapeado). */
function valorBrlCfemMunicipalHistorico(x: {
  valor_recolhido_brl?: number
  valor_total_municipio_brl?: number
}): number {
  const v = x.valor_total_municipio_brl
  if (v != null && Number.isFinite(v)) return v
  return x.valor_recolhido_brl ?? 0
}

/** Espaço vertical entre o último conteúdo do card e o rodapé "Atualizado em…". */
const FONTE_LABEL_MARGIN_TOP_PX = 20

/** Reforço antes de "Atualizado em…" nas abas Inteligência, Território, Risco e Fiscal. */
const FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX = 32

/** Espaço abaixo dos títulos de secção do drawer (alinhado ao cabeçalho número do processo + badge). */
const TITULO_SECAO_MARGIN_BOTTOM_PX = 30

/** SEI/ANM: processos anteriores a set/2019 podem ter tramitação parcialmente digitalizada. */
function mostrarDisclaimerSEI(p: Processo): boolean {
  if (p.ano_protocolo < 2019) return true
  return (
    p.ano_protocolo === 2019 &&
    p.mes_protocolo != null &&
    p.mes_protocolo < 9
  )
}

const TEXTO_DISCLAIMER_SEI_ANM =
  'Processos protocolados antes de setembro de 2019 podem ter tramitação anterior à migração para o SEI/ANM parcialmente digitalizada. Documentos históricos podem não estar disponíveis integralmente.'

const TEXTO_DISCLAIMER_SEI_OBSERVACOES =
  'Tramitação anterior a setembro de 2019 pode ter digitalização parcial no SEI-ANM.'

/** Observações técnicas v5.1 (SIGMINE / SEI-ANM). */
const OBS_V5_TITULO_SECAO: CSSProperties = {
  fontSize: 11,
  color: '#B8821E',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 600,
  margin: 0,
  marginBottom: 12,
}

const OBS_V5_SEP_ENTRE_SECOES: CSSProperties = {
  height: 1,
  backgroundColor: '#2C2C2A',
  marginTop: 18,
  marginBottom: 18,
}

function filtrarLinhasObservacoes(
  itens: ObservacoesTecnicasItem[],
): ObservacoesTecnicasItem[] {
  return itens.filter(
    (x) => x.valor != null && String(x.valor).trim() !== '',
  )
}

function formatarDataIsoPtBr(iso: string | null | undefined): string {
  if (iso == null || iso === '') return ''
  if (!RX_DATA_ISO.test(iso)) return iso
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Rótulo da substância com acentuação correta (ex.: NIQUEL → Níquel). */
function apresentarSubstanciaLabel(s: string): string {
  return labelSubstanciaParaExibicao(s)
}

/** Títulos de subseção no drawer (16px / 700); rótulos do grid Processo usam FS.md / 600. */
const subsecaoTituloStyle = {
  fontSize: FS.lg,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  color: SECTION_TITLE,
}

const FASE_LABELS: Record<Fase, string> = {
  requerimento: 'Requerimento',
  pesquisa: 'Pesquisa',
  concessao: 'Concessão',
  lavra: 'Lavra',
  encerrado: 'Encerrado',
}

/** Disclaimer hipotético: pré-lavra / disponibilidade; não exibir em lavra ou concessão. */
function processoCfemDisclaimerHipotetico(p: Processo): boolean {
  if (p.fase === 'lavra' || p.fase === 'encerrado') return false
  if (p.fase === 'concessao') return false
  return (
    p.fase === 'requerimento' ||
    p.fase === 'pesquisa' ||
    p.regime === 'disponibilidade'
  )
}

function corFaixaRisco(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

/** Rótulo curto para a coluna Substância (tabela Processos vizinhos). */
function abreviarSubstanciaVizinho(raw: string): string {
  const t = raw.trim()
  const u = t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (u === 'MINERIO DE OURO') return 'Min. de Ouro'
  if (u === 'OURO') return 'Ouro'
  if (u === 'MINERIO DE LITIO') return 'Min. de Lítio'
  if (u === 'TERRAS RARAS') return 'Terras Raras'
  if (u === 'GRANITO') return 'Granito'
  return t
}

function classificacaoRiscoTotal(r: number): string {
  if (r < 40) return 'Baixo risco'
  if (r <= 69) return 'Risco médio'
  return 'Alto risco'
}

const COR_BADGE_EXTINTO = '#6B7280'

function isRotuloScoreTerminado(label: string): boolean {
  return /extinto|N\/A|terminal/i.test(label)
}

function montarExibicaoScoresRelatorio(
  processo: Processo,
  scoresApi: RelatorioScoresExibicaoApi | undefined,
): {
  rsLabel: string
  rsCorNumero: string
  rsCorRotulo: string
  /**
   * `valorPerfil` aceita `null` para processos sem Opportunity Score
   * calculado (empty state da aba Oportunidade). Retorna string vazia
   * nesse caso — caller decide se exibe "—" ou oculta.
   */
  osLabel: (valorPerfil: number | null) => string
  osCor: (valorPerfil: number | null) => string
} {
  const se = scoresApi
  const rsLabel = normalizarSeparadoresRotuloDb(
    se?.rs_label?.trim() ||
      processo.risk_label_persistido?.trim() ||
      (processo.risk_score != null
        ? classificacaoRiscoTotal(processo.risk_score)
        : ''),
  )
  const rsCorBase =
    se?.rs_cor?.trim() ||
    processo.risk_cor_persistido?.trim() ||
    (processo.risk_score != null
      ? corFaixaRisco(processo.risk_score)
      : '#888780')
  const terminadoRisco = isRotuloScoreTerminado(rsLabel)
  const rsCorNumero = terminadoRisco ? '#888780' : rsCorBase
  const rsCorRotulo = terminadoRisco ? COR_BADGE_EXTINTO : rsCorBase

  const osPersistRaw =
    se?.os_label?.trim() || processo.os_label_persistido?.trim()
  const osPersist = normalizarSeparadoresRotuloDb(osPersistRaw ?? '')
  const osCorPersist = se?.os_cor?.trim()

  return {
    rsLabel,
    rsCorNumero,
    rsCorRotulo,
    osLabel: (valorPerfil: number | null) => {
      if (osPersist && osPersist !== '') return osPersist
      if (valorPerfil == null) return ''
      return getOpportunityLabel(valorPerfil)
    },
    osCor: (valorPerfil: number | null) => {
      if (osCorPersist && osCorPersist !== '') return osCorPersist
      if (valorPerfil == null) return '#888780'
      return corFaixaOS(valorPerfil)
    },
  }
}

/** Ícones de tendência de preço (subaba Inteligência). */
function IconTendenciaAlta({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 16L9.5 10.5 14 14 20 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 6h5v5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTendenciaEstavel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 12h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 9v6M17 9v6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTendenciaQueda({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 8L9.5 13.5 14 10 20 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 18h5v-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Cor semântica para distâncias em km no card Áreas Sensíveis (perto = risco). */
function corDistanciaKm(km: number): string {
  if (km < 10) return '#E24B4A'
  if (km < 30) return '#E8A830'
  if (km <= 50) return '#D3D1C7'
  return '#1D9E75'
}

/** Infraestrutura logística: perto = favorável; longe = desfavorável (inverso de áreas sensíveis). */
function corDistanciaLogisticaKm(km: number): string {
  if (km <= 30) return '#1D9E75'
  if (km <= 100) return '#E8A830'
  return '#E24B4A'
}

/** Km em pt-BR (vírgula decimal), ex.: 109,7 km */
function formatKmPtBr(km: number, decimals: number): string {
  return `${km.toFixed(decimals).replace('.', ',')} km`
}

function distanciaSensivelLabel(km: number): { text: string; color: string } {
  if (km <= 0) return { text: 'SOBREPOSTO', color: '#E24B4A' }
  return { text: formatKmPtBr(km, 1), color: corDistanciaKm(km) }
}

function distanciaLogisticaLabel(km: number): { text: string; color: string } {
  if (km <= 0) return { text: 'ACESSO DIRETO', color: '#1D9E75' }
  return { text: formatKmPtBr(km, 1), color: corDistanciaLogisticaKm(km) }
}

const GLOSSARIO_APP =
  'Área de Preservação Permanente (APP): faixa de proteção ao longo de rios, nascentes e topos de morro. Vedada a supressão de vegetação salvo em casos de utilidade pública (Código Florestal, Lei 12.651/2012).'

const GLOSSARIO_QUILOMBOLA =
  'Comunidade remanescente de quilombo com território reconhecido pelo INCRA. Exige consulta prévia conforme Convenção 169 da OIT.'

const AREAS_SENSIVEIS_DIST_TOOLTIP =
  'As distâncias são calculadas entre o centroide do processo minerário e o limite mais próximo de cada área sensível (FUNAI/ICMBio/INCRA). Cores indicam proximidade: vermelho (< 10 km, zona de influência direta), âmbar (10-30 km, zona de atenção), neutro (30-50 km), verde (> 50 km, distância segura). Referência: zonas de amortecimento conforme SNUC e normas específicas de cada UC.'

const AQUIFERO_HIDROGEO_TOOLTIP =
  'Dados de aquífero (CPRM/SGB): nome, unidade hidrogeológica e sobreposição com o polígono. Estudos hidrogeológicos específicos serão exigidos no licenciamento ambiental.'

const SIGLAS_UC_COMUNS = [
  'APA',
  'FLONA',
  'REBIO',
  'ESEC',
  'PARNA',
  'RDS',
  'RPPN',
  'MONA',
] as const

function normalizarAsciiUpper(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function siglasPresentesNoNomeUc(nome: string): Set<string> {
  const u = normalizarAsciiUpper(nome)
  const set = new Set<string>()
  for (const sig of SIGLAS_UC_COMUNS) {
    if (new RegExp(`\\b${sig}\\b`).test(u)) set.add(sig)
  }
  return set
}

function extrairSiglaEntreParentesesUc(tipo: string): string | null {
  const m = tipo.match(/\(\s*([A-Za-zÀ-ÿ]{2,8})\s*\)/)
  if (!m) return null
  return normalizarAsciiUpper(m[1])
}

function extrairSiglaDoTipoUc(tipo: string): string | null {
  const sigs = SIGLAS_UC_COMUNS as readonly string[]
  const p = extrairSiglaEntreParentesesUc(tipo)
  if (p && sigs.includes(p)) return p
  const t = normalizarAsciiUpper(tipo.trim())
  if (sigs.includes(t)) return t
  return null
}

/** Uma linha: nome da UC, sem repetir tipo por extenso se a sigla já está no nome. */
function rotuloUcUmaLinha(nome: string, tipo: string | null): string {
  const n = nome.trim()
  if (!tipo) return n
  const sigTipo = extrairSiglaDoTipoUc(tipo)
  const noNome = siglasPresentesNoNomeUc(n)
  if (sigTipo && noNome.has(sigTipo)) return n
  if (sigTipo && !noNome.has(sigTipo)) return `${sigTipo} ${n}`
  if (/protec[aã]o\s+integral/i.test(tipo)) {
    if (/\bPI\b/i.test(n)) return n
    return `PI ${n}`
  }
  if (/\bUC\s+/i.test(n)) return n
  return `UC ${n}`
}

function tooltipTextoUcCompleto(nome: string, tipo: string | null): string {
  const n = nome.trim()
  if (!tipo) return n
  return `${n}: ${tipo}`
}

const SEI_ANM_PESQUISA_URL =
  'https://sei.anm.gov.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=pesquisa_processo&id_orgao_acesso_externo=0'

/** Gap em p.p.: inteiro se |gap| ≥ 1; senão uma casa decimal. */
function formatarGapPontosPercentuais(gap: number): string {
  if (Math.abs(gap) >= 1) {
    return Math.round(gap).toLocaleString('pt-BR')
  }
  return gap.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })
}

function formatarPctContextoGlobal(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function textoTooltipDependenciaTransferencias(pct: number): string {
  const s = String(pct)
  if (pct <= 40) {
    return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Baixa dependência indica boa capacidade de arrecadação própria.`
  }
  if (pct <= 70) {
    return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Dependência moderada, comum em municípios de médio porte.`
  }
  return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Alta dependência indica vulnerabilidade fiscal, o município gera pouca receita própria.`
}

function anoProtocoloRelatorio(d: DadosANM): string {
  if (d.ano_protocolo != null) return String(d.ano_protocolo)
  const iso = d.data_protocolo
  if (/^\d{4}$/.test(iso)) return iso
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? String(y) : iso
}

/** Dots em “Áreas sensíveis”. Paleta v2 território. */
const DOT_TI = '#D4785A'
const DOT_UC = '#4A8C5E'
const DOT_APP = '#6BAF7B'
const DOT_QUILOMBOLA = '#B8785C'
/** Ausência positiva (sem TI na região monitorada). */
const DOT_AUSENCIA_POSITIVA = '#1D9E75'

/** Logística v2: ferrovia, porto, sede; ausência de infra usa cinza terciário. */
const DOT_FERROVIA = '#8B7A6A'
const DOT_RODOVIA = '#7A8B6E'
const DOT_PORTO = '#5A8AA0'
const DOT_SEDE_MUNICIPAL = '#9E958A'
const DOT_AUSENCIA_INFRA = '#5F5E5A'

/** Entre itens nos cards Território (Áreas sensíveis, Logística). */
const separadorInsetTerritorio: CSSProperties = {
  height: 1,
  backgroundColor: '#2C2C2A',
  margin: '10px 0',
  marginLeft: 0,
  marginRight: 0,
  flexShrink: 0,
}

/** Subtexto do APP (Áreas sensíveis), alinhado ao texto após o bullet. */
const areasSensiveisAppSubtextoStyle: CSSProperties = {
  fontSize: 11,
  color: '#888780',
  fontStyle: 'italic',
  marginTop: 2,
  marginBottom: 0,
  paddingLeft: 14,
  lineHeight: 1.45,
}

/** Quebra `texto` em parágrafos por linhas em branco (`\\n\\n`). */
function BlocoParagrafosMultilinha({
  texto,
  styleParagrafo,
}: {
  texto: string
  styleParagrafo: CSSProperties
}) {
  const partes = texto.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)
  if (partes.length === 0) return null
  return (
    <>
      {partes.map((p, i) => (
        <p
          key={i}
          style={{
            ...styleParagrafo,
            marginTop: i === 0 ? styleParagrafo.marginTop : 8,
          }}
        >
          {p}
        </p>
      ))}
    </>
  )
}

const DOT_AQUIFERO = '#4A8FB8'
/** Rótulo SOBREPOSTO no card Aquífero — âmbar/dourado padrão TERRADAR (`#EF9F27`). */
const COR_SOBREPOSTO_AQUIFERO = '#EF9F27'

function corTramitacaoAnos(anos: number): string {
  if (anos <= 5) return '#1D9E75'
  if (anos <= 15) return '#D3D1C7'
  if (anos <= 30) return '#E8A830'
  return '#E24B4A'
}

function corDependenciaTransferenciasPct(pct: number): string {
  if (pct <= 40) return '#1D9E75'
  if (pct <= 60) return '#D3D1C7'
  if (pct <= 80) return '#E8A830'
  return '#E24B4A'
}

function biomaImplicacoes(bioma: string): string {
  if (bioma.includes('Amazônia') && !bioma.includes('Cerrado'))
    return 'Exige licenciamento federal, IBAMA. Alta sensibilidade ambiental e social. Consulta FUNAI obrigatória para processos em TIs.'
  if (bioma.includes('Amazônia') && bioma.includes('Cerrado'))
    return 'Transição Amazônia/Cerrado, atenção a competências federal e estadual e a corredores ecológicos.'
  if (bioma.includes('Cerrado'))
    return 'Licenciamento estadual na maioria dos casos. Biodiversidade crítica mas processo mais ágil que Amazônia.'
  if (bioma.includes('Caatinga'))
    return 'Menor complexidade ambiental relativa. Atenção especial a recursos hídricos.'
  if (bioma.includes('Mata Atlântica'))
    return 'Bioma prioritário, restrições severas de supressão de vegetação. Lei da Mata Atlântica (11.428/2006).'
  if (bioma.includes('Pampa'))
    return 'Paisagem de campos, licenciamento estadual e zoneamento rural relevantes.'
  if (bioma.includes('Pantanal'))
    return 'Patrimônio hidrológico sensível, restrições a obras e supressão em áreas úmidas.'
  return 'Verificar legislação federal e estadual aplicável ao bioma e ao uso do solo.'
}

function capagCor(letra: 'A' | 'B' | 'C' | 'D'): string {
  switch (letra) {
    case 'A':
      return '#5B9A6F'
    case 'B':
      return '#7A9B5A'
    case 'C':
      return '#C4915A'
    case 'D':
      return '#A85C5C'
  }
}

/** Cor do selo CAPAG no drawer: letras A–D ou texto STN (n.d., n.e.). */
function capagCorExibicao(notaOuTexto: string): string {
  const t = notaOuTexto.trim()
  const low = t.toLowerCase()
  if (low.startsWith('n.d') || low.startsWith('n.e')) return '#8A8880'
  const one = t.length === 1 ? t.toUpperCase() : t.charAt(0).toUpperCase()
  if (one === 'A' || one === 'B' || one === 'C' || one === 'D') {
    return capagCor(one)
  }
  return '#8A8880'
}

function textoTooltipCapag(letra: 'A' | 'B' | 'C' | 'D'): string {
  switch (letra) {
    case 'A':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota A indica excelente saúde fiscal, com bom equilíbrio entre endividamento, poupança corrente e liquidez.'
    case 'B':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota B indica saúde fiscal adequada, com indicadores dentro dos limites aceitáveis.'
    case 'C':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota C indica fragilidade fiscal em pelo menos um dos indicadores avaliados. Requer atenção.'
    case 'D':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota D indica situação fiscal comprometida, o município não possui condições de receber garantia da União.'
  }
}

function textoTooltipCapagPublico(notaOuTexto: string): string {
  const low = notaOuTexto.trim().toLowerCase()
  if (low.startsWith('n.d')) {
    return 'n.d.: indicador ou nota não disponível na publicação STN consultada para o exercício de referência.'
  }
  if (low.startsWith('n.e')) {
    return 'n.e.: município não enquadrado na metodologia CAPAG STN para a posição consultada.'
  }
  const c = notaOuTexto.trim().charAt(0).toUpperCase()
  if (c === 'A' || c === 'B' || c === 'C' || c === 'D') {
    return textoTooltipCapag(c)
  }
  return 'CAPAG (Capacidade de Pagamento): classificação fiscal municipal da Secretaria do Tesouro Nacional.'
}

function capagCorIndicadorLinha(nota: string): string {
  const t = nota.trim()
  if (t === '–' || t === '-' || /^n\.d/i.test(t) || /^n\.e/i.test(t)) {
    return '#8A8880'
  }
  const c = t.charAt(0).toUpperCase()
  if (c === 'A' || c === 'B' || c === 'C' || c === 'D') return capagCor(c)
  return '#8A8880'
}

/** Igual ao parágrafo "Alíquota aplicável:" na subaba Fiscal (tamanho e cor do texto base). */
const CFEM_CARD_SUBTITLE_STYLE: CSSProperties = {
  fontSize: FS.lg,
  color: '#888780',
  lineHeight: 1.5,
}

/** Alinhado a `CamadaTooltipHover` (variante Fiscal: fundo escuro + borda #3a3a38). */
const CFEM_BAR_TOOLTIP = {
  maxWidthPx: 280,
  padding: '10px 12px',
  backgroundColor: '#2C2C2A',
  border: '1px solid #3a3a38',
  borderRadius: 6,
  fontLine: 1.4 as const,
  /** Ano (legenda do período) */
  fontCaption: FS.sm,
  colorCaption: '#C4C2BB',
  /** Linhas de série */
  fontBody: FS.md,
  colorLabelProcesso: '#8BC5E8',
  colorLabelMunicipio: '#F0B85C',
  colorValue: '#F1EFE8',
  colorMuted: '#9E9C96',
  zIndex: 10060,
} as const

const CFEM_BAR_TOOLTIP_OPACITY_MS = 150

type CfemBarTooltipAnchor = {
  ano: number
  vp: number
  vm: number
  left: number
  top: number
  transform: string
}

function RelatorioCfemBarrasComTooltip({
  processoTemCfem,
  anos,
  procPorAno,
  munPorAno,
  maxProc,
  maxMun,
  trackH,
}: {
  processoTemCfem: boolean
  anos: number[]
  procPorAno: Map<number, number>
  munPorAno: Map<number, number>
  maxProc: number
  maxMun: number
  trackH: number
}) {
  const [tip, setTip] = useState<CfemBarTooltipAnchor | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const positionFromRect = useCallback((r: DOMRect) => {
    const cx = r.left + r.width / 2
    const vw = window.innerWidth
    const margin = 8
    const halfW = CFEM_BAR_TOOLTIP.maxWidthPx / 2 + margin
    const left = Math.max(halfW, Math.min(cx, vw - halfW))
    const showBelow = r.top < 100
    return {
      left,
      top: showBelow ? r.bottom : r.top,
      transform: showBelow
        ? 'translate(-50%, 8px)'
        : 'translate(-50%, calc(-100% - 8px))',
    }
  }, [])

  const showTip = useCallback(
    (
      ano: number,
      vp: number,
      vm: number,
      el: HTMLElement,
    ) => {
      clearHideTimer()
      const pos = positionFromRect(el.getBoundingClientRect())
      setTip({ ano, vp, vm, ...pos })
      requestAnimationFrame(() => setTipVisible(true))
    },
    [clearHideTimer, positionFromRect],
  )

  const hideTip = useCallback(() => {
    setTipVisible(false)
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      setTip(null)
      hideTimerRef.current = null
    }, CFEM_BAR_TOOLTIP_OPACITY_MS)
  }, [clearHideTimer])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  const tooltipPortal =
    tip != null
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none"
            style={{
              position: 'fixed',
              zIndex: CFEM_BAR_TOOLTIP.zIndex,
              left: tip.left,
              top: tip.top,
              transform: tip.transform,
              maxWidth: CFEM_BAR_TOOLTIP.maxWidthPx,
              minWidth: 200,
              padding: CFEM_BAR_TOOLTIP.padding,
              backgroundColor: CFEM_BAR_TOOLTIP.backgroundColor,
              border: CFEM_BAR_TOOLTIP.border,
              borderRadius: CFEM_BAR_TOOLTIP.borderRadius,
              boxSizing: 'border-box',
              opacity: tipVisible ? 1 : 0,
              transition: `opacity ${CFEM_BAR_TOOLTIP_OPACITY_MS}ms ease`,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: CFEM_BAR_TOOLTIP.fontCaption,
                color: CFEM_BAR_TOOLTIP.colorCaption,
                lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                fontWeight: 500,
                marginBottom: 8,
                letterSpacing: '0.02em',
              }}
            >
              {tip.ano}
            </div>
            {processoTemCfem ? (
              <div
                style={{
                  fontSize: CFEM_BAR_TOOLTIP.fontBody,
                  lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                }}
              >
                <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelProcesso }}>
                  Este processo:{' '}
                </span>
                <span
                  style={{
                    color: CFEM_BAR_TOOLTIP.colorValue,
                    fontWeight: 500,
                  }}
                >
                  {formatarRealBrlInteligente(tip.vp)}
                </span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: CFEM_BAR_TOOLTIP.fontBody,
                  lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                }}
              >
                <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelProcesso }}>
                  Este processo:{' '}
                </span>
                <span
                  style={{
                    color: CFEM_BAR_TOOLTIP.colorMuted,
                    fontWeight: 500,
                  }}
                >
                  sem arrecadação
                </span>
              </div>
            )}
            <div
              style={{
                fontSize: CFEM_BAR_TOOLTIP.fontBody,
                lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                marginTop: 6,
              }}
            >
              <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelMunicipio }}>
                Município:{' '}
              </span>
              <span
                style={{
                  color: CFEM_BAR_TOOLTIP.colorValue,
                  fontWeight: 500,
                }}
              >
                {formatarRealBrlInteligente(tip.vm)}
              </span>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {tooltipPortal}
      {processoTemCfem ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginBottom: 22,
          }}
        >
          {anos.map((ano) => {
            const vp = procPorAno.get(ano) ?? 0
            const vm = munPorAno.get(ano) ?? 0
            const hP =
              maxProc > 0 && vp > 0
                ? Math.max(4, (vp / maxProc) * trackH)
                : 0
            const hM =
              maxMun > 0 && vm > 0
                ? Math.max(4, (vm / maxMun) * trackH)
                : 0
            return (
              <div
                key={ano}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 4,
                    width: '100%',
                  }}
                  onMouseEnter={(e) => showTip(ano, vp, vm, e.currentTarget)}
                  onMouseLeave={hideTip}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: trackH,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      {hP > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            height: hP,
                            backgroundColor: '#4A90B8',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: trackH,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      {hM > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            height: hM,
                            backgroundColor: '#EF9F27',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {ano}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginTop: 18,
            marginBottom: 22,
          }}
        >
          {anos.map((ano) => {
            const vm = munPorAno.get(ano) ?? 0
            const vp = 0
            const hM =
              maxMun > 0 && vm > 0
                ? Math.max(4, (vm / maxMun) * trackH)
                : 0
            return (
              <div
                key={ano}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    height: trackH,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => showTip(ano, vp, vm, e.currentTarget)}
                  onMouseLeave={hideTip}
                >
                  {hM > 0 ? (
                    <div
                      style={{
                        width: '100%',
                        height: hM,
                        backgroundColor: '#EF9F27',
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 1,
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {ano}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/** Um card «processo vs. município» com denominador municipal alinhado ao IBGE do card. */
function CfemVsMunicipioBreakdownCard({
  item,
  timestamps,
}: {
  item: CfemBreakdownMunicipio
  timestamps: Timestamps
}) {
  const ANO_ATUAL = new Date().getFullYear()
  const ANO_MIN_CFEM = ANO_ATUAL - 4
  const serie5y = item.serie_anual.filter((s) => s.ano >= ANO_MIN_CFEM)
  const procPorAno = new Map(serie5y.map((s) => [s.ano, s.processo]))
  const munPorAno = new Map(serie5y.map((s) => [s.ano, s.municipio]))
  const anos = [...new Set(serie5y.map((s) => s.ano))].sort((a, b) => a - b)
  const processoTemCfem = serie5y.some((s) => s.processo > 0)
  const maxProc = Math.max(...anos.map((y) => procPorAno.get(y) ?? 0), 1)
  const maxMun = Math.max(...anos.map((y) => munPorAno.get(y) ?? 0), 1)
  const trackH = 80

  const pctRaw = item.percentual_do_municipio
  const pct = Number.isFinite(pctRaw) ? Math.min(pctRaw, 100) : 0
  const muitoBaixa = pct > 0 && pct < 1
  const pctTexto = muitoBaixa
    ? '< 1%'
    : `${pct.toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      })}%`

  const linhaPct =
    item.municipio_total > 0 ? (
      <p
        style={{
          ...CFEM_CARD_SUBTITLE_STYLE,
          color: '#D3D1C7',
          margin: '10px 0 0 0',
        }}
      >
        {pct >= 1 ? (
          <>
            Este processo representa{' '}
            <strong
              style={{
                fontWeight: 700,
                color: '#EF9F27',
              }}
            >
              {pctTexto}
            </strong>{' '}
            da CFEM de {item.municipio_nome}.
          </>
        ) : (
          <>
            Este processo representa menos de 1% da CFEM de {item.municipio_nome}.
          </>
        )}
      </p>
    ) : (
      <p
        style={{
          fontSize: FS.min,
          color: '#5F5E5A',
          margin: '10px 0 0 0',
          lineHeight: 1.5,
        }}
      >
        Dados municipais indisponíveis
      </p>
    )

  const ufPart = item.uf.trim() !== '' ? `/${item.uf}` : ''
  const dataIsoCfem = [timestamps.cfem, timestamps.cfem_municipal].reduce(
    (a, b) => (a > b ? a : b),
  )

  return (
    <Card>
      <SecLabel branco style={{ marginBottom: 4 }}>
        CFEM: processo vs. {item.municipio_nome}
        {ufPart}
      </SecLabel>
      <p
        style={{
          ...CFEM_CARD_SUBTITLE_STYLE,
          margin: '0 0 28px 0',
          textTransform: 'none',
          letterSpacing: 'normal',
          fontWeight: 400,
        }}
      >
        Arrecadação deste processo em {item.municipio_nome}, comparada à CFEM
        total do município.
      </p>
      {serie5y.length > 0 || processoTemCfem ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 16,
            marginBottom: 18,
          }}
        >
          {processoTemCfem ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: '#4A90B8',
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                Este processo
              </span>
            </div>
          ) : null}
          {serie5y.some((s) => s.municipio > 0) ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: '#EF9F27',
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                {item.municipio_nome}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <RelatorioCfemBarrasComTooltip
        processoTemCfem={processoTemCfem}
        anos={anos}
        procPorAno={procPorAno}
        munPorAno={munPorAno}
        maxProc={maxProc}
        maxMun={maxMun}
        trackH={trackH}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          marginTop: 4,
          marginBottom: 28,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: '#888780',
              margin: '0 0 6px 0',
              lineHeight: 1.3,
            }}
          >
            Este processo ({item.municipio_nome})
          </p>
          {item.processo_total > 0 ? (
            <p
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#4A90B8',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {formatarRealBrlInteligente(item.processo_total)}
            </p>
          ) : (
            <p
              style={{
                fontSize: FS.sm,
                color: '#5F5E5A',
                margin: 0,
                lineHeight: 1.2,
                fontWeight: 400,
              }}
            >
              Sem arrecadação
            </p>
          )}
        </div>
        <div
          style={{
            width: 1,
            flexShrink: 0,
            backgroundColor: '#2C2C2A',
            alignSelf: 'stretch',
            margin: '0 8px',
          }}
          aria-hidden
        />
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: '#888780',
              margin: '0 0 6px 0',
              lineHeight: 1.3,
            }}
          >
            {item.municipio_nome} total
          </p>
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#EF9F27',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {formatarRealBrlInteligente(item.municipio_total)}
          </p>
        </div>
      </div>
      {linhaPct}
      <FonteLabel
        dataIso={dataIsoCfem}
        fonte="ANM / CFEM"
        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
      />
    </Card>
  )
}

function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#1E1E1C',
        borderRadius: 8,
        padding: '20px 18px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SecLabel({
  children,
  branco = false,
  style,
}: {
      children: ReactNode
      branco?: boolean
      style?: CSSProperties
    }) {
  return (
    <p
      style={{
        ...subsecaoTituloStyle,
        color: branco ? '#F1EFE8' : SECTION_TITLE,
        margin: 0,
        marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

const analiseTerradarCardStyle: CSSProperties = {
  position: 'relative',
  backgroundColor: 'rgba(212, 168, 67, 0.04)',
  borderRadius: 8,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'stretch',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
}

const analiseTerradarBordaGradiente: CSSProperties = {
  width: 3,
  flexShrink: 0,
  alignSelf: 'stretch',
  borderRadius: '3px 0 0 3px',
  background: 'linear-gradient(to bottom, #D4A843, #1D9E75)',
}

const analiseTerradarTextoStyle: CSSProperties = {
  fontSize: FS.md,
  fontWeight: 400,
  color: '#B4B2A9',
  lineHeight: 1.6,
  margin: 0,
}

const analiseTerradarDestaqueStyle: CSSProperties = {
  fontWeight: 600,
  color: '#F1EFE8',
}

function TextoOportunidadeComDestaqueNumeros({
  texto,
  destaques,
}: {
  texto: string
  // Aceita `null` nos elementos porque scores podem vir indisponíveis
  // (zumbis, sem geom, processos sem score). Entradas `null` são ignoradas
  // — não geram destaque no texto renderizado.
  destaques: readonly (number | null)[]
}) {
  let partes: ReactNode[] = [texto]
  destaques.forEach((num, di) => {
    if (num == null) return
    const str = String(num)
    partes = partes.flatMap((parte, pi) => {
      if (typeof parte !== 'string') return [parte]
      const idx = parte.indexOf(str)
      if (idx === -1) return [parte]
      const out: ReactNode[] = []
      if (idx > 0) out.push(parte.slice(0, idx))
      out.push(
        <strong
          key={`${str}-${di}-${pi}-${idx}`}
          style={analiseTerradarDestaqueStyle}
        >
          {str}
        </strong>,
      )
      if (idx + str.length < parte.length) {
        out.push(parte.slice(idx + str.length))
      }
      return out
    })
  })
  return <>{partes}</>
}

function OportunidadeAnaliseTerradarCard({
  cruzamento,
}: {
  cruzamento: RelatorioOportunidadeData['cruzamento']
}) {
  return (
    <div style={analiseTerradarCardStyle}>
      <div aria-hidden style={analiseTerradarBordaGradiente} />
      <div
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          padding: '22px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Sparkles size={16} color="#D4A843" strokeWidth={2} aria-hidden />
          <span
            style={{
              fontSize: FS.md,
              fontWeight: 700,
              color: '#D4A843',
              letterSpacing: '0.3px',
            }}
          >
            Análise TERRADAR
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={analiseTerradarTextoStyle}>{cruzamento.abertura}</p>
          <p style={analiseTerradarTextoStyle}>
            <TextoOportunidadeComDestaqueNumeros
              texto={cruzamento.explicacao}
              destaques={[cruzamento.rs, cruzamento.os]}
            />
          </p>
          <p style={analiseTerradarTextoStyle}>{cruzamento.contexto}</p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 20,
            paddingTop: 12,
            borderTop: '1px solid rgba(212, 168, 67, 0.12)',
          }}
        >
          <Sparkles size={11} color="#5F5E5A" strokeWidth={2} aria-hidden />
          <span
            style={{
              fontSize: 11,
              color: '#5F5E5A',
              letterSpacing: '0.3px',
            }}
          >
            {`TERRADAR · ${cruzamento.data}`}
          </span>
        </div>
      </div>
    </div>
  )
}

function FonteLabel({
  dataIso,
  fonte,
  marginTopPx = FONTE_LABEL_MARGIN_TOP_PX,
  noWrap = false,
  fonteTitulo = 'Fonte',
}: {
  dataIso: string
  fonte: string
  marginTopPx?: number
  noWrap?: boolean
  /** `Fontes` no plural quando há várias fontes listadas no rodapé. */
  fonteTitulo?: 'Fonte' | 'Fontes'
}) {
  const [y, m, d] = dataIso.split('-')
  const linha =
    d && m && y
      ? `Atualizado em ${d}/${m}/${y} · ${fonteTitulo}: ${fonte}`
      : `${fonteTitulo}: ${fonte}`
  return (
    <span
      style={{
        display: 'block',
        textAlign: 'right',
        marginTop: marginTopPx,
        fontSize: 11,
        lineHeight: 1.45,
        color: '#5F5E5A',
        whiteSpace: noWrap ? 'nowrap' : undefined,
      }}
    >
      {linha}
    </span>
  )
}

/**
 * Quando o polígono/viewport cai em `disponibilidade` por fallback (regime vazio ou não casado),
 * recompõe o regime a partir da fase exibida no relatório (`dados_anm.fase_atual` ← SIGMINE/ANM).
 * Cobre PT e os rótulos EN de `translateTenure` no `ReportData`.
 */
function regimeInferidoDeFaseExibida(
  faseAtual: string | undefined | null,
): Regime | null {
  if (faseAtual == null) return null
  const r = faseAtual.toLowerCase().trim()
  if (!r) return null
  if (r.includes('mining application')) return 'req_lavra'
  if (r.includes('exploration application')) return 'requerimento_pesquisa'
  if (r.includes('exploration authorization')) return 'autorizacao_pesquisa'
  if (
    r.includes('licensing application') ||
    r.includes('licenciamento') ||
    (r.includes('licenc') && r.includes('requer'))
  ) {
    return 'licenciamento'
  }
  if (
    r.includes('extraction registration') ||
    (r.includes('registro') && r.includes('extra'))
  ) {
    return 'registro_extracao'
  }
  if (r.includes('garimpo permit application') || r.includes('garimpeir')) {
    return 'lavra_garimpeira'
  }
  if (r.includes('mining concession')) return 'concessao_lavra'
  if (r.includes('requer') && r.includes('pesquis')) {
    return 'requerimento_pesquisa'
  }
  if (r.includes('reconhec')) return 'requerimento_pesquisa'
  if (r.includes('requer') && r.includes('lavra')) return 'req_lavra'
  if (r.includes('pesquis')) return 'autorizacao_pesquisa'
  if (r.includes('licenci')) return 'licenciamento'
  if (r.includes('dispon')) return 'disponibilidade'
  if (r.includes('estratég') || r.includes('estrateg')) {
    return 'mineral_estrategico'
  }
  if (r.includes('bloqueio') && r.includes('prov')) return 'bloqueio_provisorio'
  if (r.includes('bloqueio') && r.includes('perm')) return 'bloqueio_permanente'
  return null
}

/** Regime para badge e rótulos: não usar `disponibilidade` como proxy de alvará vencido. */
function regimeParaExibicaoDrawer(
  processo: Processo,
  faseAtualRelatorio: string | undefined,
): Regime {
  if (processo.regime !== 'disponibilidade') return processo.regime
  const inferred = regimeInferidoDeFaseExibida(faseAtualRelatorio)
  return inferred ?? processo.regime
}

export interface RelatorioCompletoProps {
  processo: Processo | null
  aberto: boolean
  onFechar: () => void
  abaInicial?: AbaId
  /** Quando incrementa (ex.: «Ver decomposição completa» no mapa), força a aba ativa = `abaInicial`. */
  abaRiscoRequestId?: number
  /** Quando o processo veio da API (`fromApi`), dados montados por `buildReportData` / `relatorioDataFromReportData`. */
  dadosRelatorioApi?: RelatorioData | null
  relatorioApiLoading?: boolean
  relatorioApiErro?: string | null
}

/**
 * Banner no topo do drawer. 3 estados mutuamente exclusivos:
 * - `dadosInsuficientes=true` → vermelho, "dados insuficientes" (prioridade
 *   máxima: mesmo que semGeom também seja true, este banner prevalece).
 * - `semGeom=true && !dadosInsuficientes` → âmbar, "sem georreferenciamento".
 * - ambos false → não renderiza (return null).
 *
 * Renderizado no container scroll (acima do bloco `aba === ...`) para ficar
 * visível em todas as 6 abas, não só na aba Processo.
 */
function RelatorioBanner({
  dadosInsuficientes,
  semGeom,
  classificacaoZumbi,
}: {
  dadosInsuficientes: boolean
  semGeom: boolean
  classificacaoZumbi: ClassificacaoZumbi | null
}) {
  if (dadosInsuficientes) {
    // Copy do banner vermelho vem da classificação de arquétipo. Só 33 de
    // 180 zumbis são grupamento mineiro — os outros são fantasma cadastral,
    // disponibilidade ou trâmite administrativo, cada um com texto próprio.
    const tituloBanner =
      classificacaoZumbi?.label_regime ?? 'Dados insuficientes para análise'
    const explicacao =
      classificacaoZumbi?.explicacao_curta ??
      'Este processo não possui substância, município ou geometria declarados, o que impede o cálculo de Risk Score, Opportunity Score e análise de mercado.'
    return (
      <div
        style={{
          padding: '12px 14px',
          background: 'rgba(220, 72, 72, 0.08)',
          border: '1px solid rgba(220, 72, 72, 0.32)',
          borderRadius: 6,
          fontSize: 12,
          color: '#E88080',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 4 }}>
          {tituloBanner}
        </strong>
        {explicacao}{' '}
        Dados cadastrais básicos seguem disponíveis na aba Processo. Análise
        de risco, mercado e território estão indisponíveis para este processo.
      </div>
    )
  }

  if (semGeom) {
    return (
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(232, 168, 48, 0.08)',
          border: '1px solid rgba(232, 168, 48, 0.25)',
          borderRadius: 6,
          fontSize: 12,
          color: '#D3A558',
          lineHeight: 1.5,
        }}
      >
        <strong>Processo sem georreferenciamento</strong>
        <br />
        Este processo está cadastrado na ANM mas não possui polígono
        georreferenciado no SIGMINE. Dados cadastrais, regulatórios e fiscais
        estão disponíveis. A análise territorial não pode ser gerada.
      </div>
    )
  }

  return null
}

export function RelatorioCompleto({
  processo,
  aberto,
  onFechar,
  abaInicial = 'processo',
  abaRiscoRequestId = 0,
  dadosRelatorioApi = null,
  relatorioApiLoading = false,
  relatorioApiErro = null,
}: RelatorioCompletoProps) {
  const dadosResolved: RelatorioData | undefined = processo
    ? dadosRelatorioApi ?? relatoriosMock[processo.id]
    : undefined

  const loadingApi = Boolean(
    processo?.fromApi && relatorioApiLoading && !dadosRelatorioApi,
  )
  const erroApi = Boolean(
    processo?.fromApi &&
      relatorioApiErro &&
      !dadosRelatorioApi &&
      !relatorioApiLoading,
  )

  const dados: RelatorioData | undefined = dadosResolved

  const {
    rate: cambioAoVivo,
    isStale: cambioStale,
    loading: cambioLoading,
    fetchedAt: cambioFetchedAt,
  } = useExchangeRate()

  const commodityMarketState = useMemo((): SubstanceMarketState | null => {
    const im = dados?.intel_mineral
    if (!im) return null
    const r =
      im.reservas_br_pct_dado !== undefined
        ? im.reservas_br_pct_dado
        : im.reservas_brasil_mundial_pct
    const p =
      im.producao_br_pct_dado !== undefined
        ? im.producao_br_pct_dado
        : im.producao_brasil_mundial_pct
    return getSubstanceMarketState({
      fonte_preco: im.fonte_preco,
      fonte_res_prod: im.fonte_res_prod,
      reservas_br_pct: r,
      producao_br_pct: p,
    })
  }, [dados?.intel_mineral])

  const drawerPrecoBrl = useMemo(
    () =>
      dados?.intel_mineral
        ? computePrecoBrlDrawer(dados.intel_mineral, cambioAoVivo)
        : { brlPorGrama: null, brlPorTonelada: null },
    [dados?.intel_mineral, cambioAoVivo],
  )

  const valorReservaBrlBiPorHaAoVivo = useMemo(() => {
    const im = dados?.intel_mineral
    if (
      im?.valor_estimado_usd_ha != null &&
      im.valor_estimado_usd_ha > 0 &&
      cambioAoVivo != null &&
      cambioAoVivo > 0
    ) {
      return (im.valor_estimado_usd_ha * cambioAoVivo) / 1_000_000_000
    }
    return null
  }, [dados?.intel_mineral, cambioAoVivo])

  const [aba, setAba] = useState<AbaId>(abaInicial)
  const [perfilOportunidadeAtivo, setPerfilOportunidadeAtivo] =
    useState<PerfilOportunidadeOSKey>('conservador')
  const [hoverPerfilOportunidade, setHoverPerfilOportunidade] =
    useState<PerfilOportunidadeOSKey | null>(null)

  useEffect(() => {
    if (aberto) setAba(abaInicial)
  }, [aberto, abaInicial, abaRiscoRequestId])

  const alertasOrdenados = useMemo(() => {
    if (!processo) return []
    const extras: AlertaLegislativo[] = []
    if (processo.exigencia_pendente === true) {
      const historico = processo.ativo_derivado === false
      extras.push({
        id: 'terr-exigencia-pendente-scm',
        fonte: 'ANM',
        fonte_diario: 'Microdados SCM',
        data:
          processo.ultimo_evento_data?.trim() ||
          new Date().toISOString().slice(0, 10),
        titulo: historico ? 'Exigência (histórico)' : 'Exigência pendente',
        resumo: historico
          ? 'Exigência registrada nos Microdados SCM ao encerrar o processo — consulta histórica.'
          : 'Existe exigência publicada sem cumprimento registrado nos Microdados SCM.',
        nivel_impacto: historico ? 1 : 2,
        tipo_impacto: historico ? 'neutro' : 'restritivo',
        urgencia: historico ? 'medio_prazo' : 'imediata',
      })
    }
    return [...extras, ...processo.alertas].sort(
      (a, b) => a.nivel_impacto - b.nivel_impacto,
    )
  }, [processo])

  const riskDecomposicaoMemo = useMemo(() => {
    if (!processo) return null
    return (
      processo.risk_decomposicao ?? gerarRiskDecomposicaoParaProcesso(processo)
    )
  }, [processo])

  const exibicaoScoresRelatorio = useMemo(() => {
    if (!processo) {
      return {
        rsLabel: '',
        rsCorNumero: '#888780',
        rsCorRotulo: '#888780',
        osLabel: (valorPerfil: number | null) =>
          valorPerfil == null ? '' : getOpportunityLabel(valorPerfil),
        osCor: (valorPerfil: number | null) =>
          valorPerfil == null ? '#888780' : corFaixaOS(valorPerfil),
      }
    }
    return montarExibicaoScoresRelatorio(
      processo,
      dadosResolved?.scores_exibicao_api,
    )
  }, [processo, dadosResolved])

  const regimeDrawerUi = useMemo((): Regime => {
    if (!processo) return 'disponibilidade'
    return regimeParaExibicaoDrawer(
      processo,
      dados?.dados_anm?.fase_atual,
    )
  }, [processo, dados?.dados_anm?.fase_atual])

  // Imediatamente após os demais hooks, antes de qualquer return — ver comentario
  // no bloco `dados` abaixo (sem geometria, zumbi).
  const semGeom =
    processo != null &&
    (!Number.isFinite(processo.lat) || !Number.isFinite(processo.lng))

  const dadosInsuficientes =
    processo != null && processo.dados_insuficientes === true

  const { data: ambiental, loading: ambientalLoading, error: ambientalError } =
    useTerritorialAmbiental(
      processo?.numero,
      Boolean(
        aberto &&
          aba === 'territorio' &&
          processo?.numero &&
          !dadosInsuficientes &&
          !semGeom,
      ),
    )

  if (!processo) return null

  // Estado de loading/erro usa o MESMO container + header do return completo
  // (abaixo). Isso é crítico para que a animação `translateX` não quebre:
  // React reconcilia o `<div>` raiz + `<header>` (ambos têm mesmo tipo/estrutura
  // nos dois returns) em vez de desmontar/montar uma árvore nova quando
  // loadingApi vira false. Sem essa unificação, processos abertos via busca
  // (sem fly-to/popup prévios — ex.: zumbis, sem-geom) mostravam flip visível
  // entre o drawer "spinner" e o drawer "completo".
  if (loadingApi || erroApi) {
    return (
      <div
        className="pointer-events-auto"
        style={{
          position: 'fixed',
          top: 48,
          right: 0,
          width: 520,
          height: 'calc(100vh - 48px)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#111110',
          borderLeft: '1px solid #2C2C2A',
          transform: aberto ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out',
          boxSizing: 'border-box',
        }}
      >
        <header
          style={{
            height: 56,
            flexShrink: 0,
            backgroundColor: '#0D0D0C',
            borderBottom: '1px solid #2C2C2A',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            <RegimeBadge regime={regimeDrawerUi} variant="drawer" />
            {/* <DrawerRegulatoryBadges processo={processo} /> */}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              gap: 8,
            }}
          >
            <ExportReportButton numeroProcesso={processo.numero} />
            <div
              style={{
                width: 1,
                height: 16,
                backgroundColor: '#2C2C2A',
                margin: '0 12px',
                flexShrink: 0,
              }}
              aria-hidden
            />
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar relatório"
              className="cursor-pointer border-0 bg-transparent p-0"
              style={{
                fontSize: 18,
                lineHeight: 1,
                color: '#888780',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#D3D1C7'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888780'
              }}
            >
              ✕
            </button>
          </div>
        </header>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
          }}
        >
          {loadingApi ? (
            <>
              <Loader2
                className="h-8 w-8 shrink-0 animate-spin"
                aria-hidden
                style={{ color: '#EF9F27' }}
              />
              <span style={{ fontSize: FS.md, color: '#888780' }}>
                Carregando relatório…
              </span>
            </>
          ) : (
            <span
              style={{
                fontSize: FS.md,
                color: '#E24B4A',
                textAlign: 'center',
                lineHeight: 1.45,
              }}
            >
              {relatorioApiErro}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (!dados) return null

  const {
    dados_anm,
    observacoes_tecnicas,
    territorial,
    intel_mineral,
    fiscal,
    timestamps,
    metadata,
    oportunidade,
  } = dados

  // `semGeom` e `dadosInsuficientes` + `useTerritorialAmbiental` estão no topo
  // (antes de `if (!processo)` / `if (!dados)`) para respeitar a ordem dos hooks.

  // True quando o processo não tem Risk Score calculável. Ativa empty state
  // nas abas Risco e Oportunidade (Bloco 3a/3b). Casos cobertos:
  //   - processo é zumbi (dadosInsuficientes=true, sem score persistido)
  //   - processo sem geom sem score (pós-limpeza 2026-04-21, 0 processos
  //     em produção, mas resiliente a futuros casos sem re-score)
  //   - processo não scoreado (raro, mas possível durante ingestão ou
  //     drop/rebuild da tabela `scores`)
  //
  // Usa `== null` (pega null e undefined) porque o patch do MapView agora
  // sobrescreve residuais do Zustand com `null` explícito para processos
  // sem score no banco.
  const scoreIndisponivel =
    !processo ||
    processo.risk_score == null

  // Classificação de arquétipo vem do `dados_anm` (já populado no backend
  // via fn_classificacao_zumbi). Null para processos normais.
  const classZumbi: ClassificacaoZumbi | null =
    dados_anm.classificacao_zumbi ?? null

  // Derivações de exibição para campos da aba Processo com empty states
  // contextuais. Resolve 3 cenários:
  //   1. SCM_SUBSTANCIA_NAO_INFORMADA (251 processos) → travessão
  //   2. dados_insuficientes=true → labels dinâmicas do arquétipo
  //      (ex.: grupamento → "Requerimento de grupamento / Grupamento pendente",
  //       não o enganoso "Concessão de Lavra / Lavra" herdado do DB)
  //   3. area_ha=0 para zumbi → travessão em vez de "0 ha"
  const substanciaFormatada: string | null = formatarSubstancia(
    processo?.substancia ?? null,
  )
  const regimeExibicao: string = dadosInsuficientes
    ? (classZumbi?.label_regime ?? '—')
    : (REGIME_LABELS[regimeDrawerUi] ?? String(regimeDrawerUi))
  const faseExibicao: string = dadosInsuficientes
    ? (classZumbi?.label_fase ?? '—')
    : (processo?.fase != null
        ? (FASE_LABELS[processo.fase] ?? String(processo.fase))
        : '—')
  const areaExibicao: string =
    dadosInsuficientes || !processo?.area_ha || processo.area_ha === 0
      ? '—'
      : `${Number(processo.area_ha).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`

  const cambioIntel = intel_mineral.cambio_brl_usd ?? metadata?.cambio
  const cambioLegendaDrawer =
    cambioAoVivo != null && cambioAoVivo > 0 ? cambioAoVivo : cambioIntel
  const areaHa = processo.area_ha
  /** Mi USD/ha — valor in-situ teórico por hectare (sem multiplicar pela área do processo). */
  const valorReservaUsdMiPorHa =
    intel_mineral.valor_estimado_usd_ha != null
      ? intel_mineral.valor_estimado_usd_ha / 1_000_000
      : intel_mineral.valor_estimado_usd_mi != null && areaHa > 0
        ? intel_mineral.valor_estimado_usd_mi / areaHa
        : null
  /** Bilhões BRL/ha (cabeçalho do card). */
  const valorReservaBrlBiPorHa =
    intel_mineral.valor_estimado_brl_ha != null
      ? intel_mineral.valor_estimado_brl_ha / 1_000_000_000
      : cambioIntel != null && intel_mineral.valor_estimado_usd_ha != null
        ? (intel_mineral.valor_estimado_usd_ha * cambioIntel) / 1_000_000_000
        : cambioIntel != null && valorReservaUsdMiPorHa != null
          ? (valorReservaUsdMiPorHa * cambioIntel) / 1000
          : intel_mineral.valor_estimado_brl_tri != null && areaHa > 0
            ? (intel_mineral.valor_estimado_brl_tri * 1000) / areaHa
            : null
  const valorReservaBrlBiPorHaEfetivo =
    valorReservaBrlBiPorHaAoVivo ?? valorReservaBrlBiPorHa

  const cfemMunicipioParaContexto =
    fiscal.cfem_municipio.length > 0
      ? fiscal.cfem_municipio
      : fiscal.cfem_municipal_historico.map((h) => ({
          ano: h.ano,
          valor_recolhido_brl: h.valor_total_municipio_brl,
        }))
  const cfemHistFiscal = cfemMunicipioParaContexto
  const cfemMunicipalTotalBrl = cfemHistFiscal.reduce(
    (s, x) => s + valorBrlCfemMunicipalHistorico(x),
    0,
  )
  const anosCfemMunicipal = cfemHistFiscal.length
  const cfemMunicipalMediaAnualBrl =
    anosCfemMunicipal > 0 ? cfemMunicipalTotalBrl / anosCfemMunicipal : 0
  const cfemMultiplicadorHa =
    cfemMunicipalMediaAnualBrl > 0 && fiscal.cfem_estimada_ha > 0
      ? fiscal.cfem_estimada_ha / cfemMunicipalMediaAnualBrl
      : null
  const cfemPctPib =
    fiscal.pib_municipal_mi > 0 && fiscal.cfem_estimada_ha > 0
      ? (fiscal.cfem_estimada_ha / (fiscal.pib_municipal_mi * 1_000_000)) * 100
      : null
  const mostrarCfemLinha1 = cfemHistFiscal.length > 0
  const mostrarCfemLinha2 =
    cfemHistFiscal.length > 0 &&
    cfemMunicipalMediaAnualBrl > 0 &&
    cfemMultiplicadorHa != null &&
    Number.isFinite(cfemMultiplicadorHa) &&
    fiscal.cfem_estimada_ha > 0
  const mostrarCfemLinha3 =
    cfemPctPib != null &&
    Number.isFinite(cfemPctPib) &&
    fiscal.pib_municipal_mi > 0
  const mostrarContextoCfemComparativo =
    fiscal.cfem_estimada_ha > 0 &&
    (mostrarCfemLinha1 || mostrarCfemLinha2 || mostrarCfemLinha3)

  const temCfemHistoricoMunicipal =
    fiscal.cfem_municipio.length > 0 ||
    fiscal.cfem_municipal_historico.length > 0

  const fontePrecoTendenciaCard =
    metadata?.fonte_demanda ??
    metadata?.fonte_precos ??
    'IMF PCPS / USGS MCS 2026'

  const ucUsNome = territorial.nome_uc_us_proxima ?? territorial.nome_uc_proxima
  const ucUsTipo = territorial.tipo_uc_us ?? territorial.tipo_uc
  const ucUsKm = territorial.distancia_uc_us_km ?? territorial.distancia_uc_km
  const temUcPi =
    territorial.nome_uc_pi_proxima != null &&
    territorial.nome_uc_pi_proxima !== '' &&
    territorial.distancia_uc_pi_km != null
  const useQuilombolaDistancia =
    territorial.distancia_quilombola_km != null &&
    !Number.isNaN(Number(territorial.distancia_quilombola_km))
  const nomeQuilombolaExibicao =
    territorial.nome_quilombola_proximo ?? territorial.nome_quilombola

  const distanciaSedeKm =
    territorial.distancia_sede_km ?? territorial.distancia_sede_municipal_km

  const auditoriaTerritorial =
    territorial.fase_ti != null && territorial.fase_ti !== ''

  const nomeTiLinha =
    auditoriaTerritorial &&
    territorial.nome_ti_proxima != null &&
    territorial.nome_ti_proxima !== ''
      ? territorial.fase_ti != null && territorial.fase_ti !== ''
        ? `Terra Indígena · ${territorial.nome_ti_proxima} (${territorial.fase_ti})`
        : `Terra Indígena · ${territorial.nome_ti_proxima}`
      : territorial.nome_ti_proxima

  const ucPiLinha =
    territorial.nome_uc_pi_proxima != null && territorial.nome_uc_pi_proxima !== ''
      ? auditoriaTerritorial
        ? `UC Proteção integral · ${territorial.nome_uc_pi_proxima}`
        : rotuloUcUmaLinha(
            territorial.nome_uc_pi_proxima,
            territorial.tipo_uc_pi ?? null,
          )
      : ''

  const ucUsLinhaDisplay =
    auditoriaTerritorial && ucUsNome
      ? `UC Uso sustentável · ${ucUsNome}`
      : rotuloUcUmaLinha(ucUsNome ?? '', ucUsTipo ?? null)

  const areasSensiveisTiUcRows = [
    {
      dot: DOT_TI,
      nome: nomeTiLinha,
      tipo: 'Terra Indígena' as const,
      km: territorial.distancia_ti_km,
      semIdTexto: 'Sem terra indígena na região',
    },
    ...(temUcPi
      ? [
          {
            dot: DOT_UC,
            nome: ucPiLinha,
            tipo: territorial.tipo_uc_pi as string,
            km: territorial.distancia_uc_pi_km as number,
            semIdTexto:
              'Sem unidade de conservação identificada na região monitorada',
          },
        ]
      : []),
    {
      dot: DOT_UC,
      nome: ucUsLinhaDisplay,
      tipo: ucUsTipo,
      km: ucUsKm,
      semIdTexto:
        'Sem unidade de conservação identificada na região monitorada',
    },
  ]

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: 48,
        right: 0,
        width: 520,
        height: 'calc(100vh - 48px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111110',
        borderLeft: '1px solid #2C2C2A',
        transform: aberto ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          height: 56,
          flexShrink: 0,
          backgroundColor: '#0D0D0C',
          borderBottom: '1px solid #2C2C2A',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <RegimeBadge regime={regimeDrawerUi} variant="drawer" />
          {/* <DrawerRegulatoryBadges processo={processo} /> */}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <ExportReportButton numeroProcesso={processo.numero} />
          <div
            style={{
              width: 1,
              height: 16,
              backgroundColor: '#2C2C2A',
              margin: '0 12px',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar relatório"
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{
              fontSize: 18,
              lineHeight: 1,
              color: '#888780',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D3D1C7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            ✕
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <nav
          style={{
            height: 44,
            flexShrink: 0,
            backgroundColor: '#0D0D0C',
            borderBottom: '1px solid #2C2C2A',
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
          }}
        >
        {ABAS.map((t) => {
          const ativo = aba === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAba(t.id)}
              className="cursor-pointer border-0 bg-transparent whitespace-nowrap"
              style={{
                fontSize: FS.md,
                padding: '0 8px',
                height: '100%',
                fontWeight: 600,
                color: ativo ? '#F1EFE8' : '#888780',
                borderBottom: ativo ? '2px solid #EF9F27' : '2px solid transparent',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!ativo) e.currentTarget.style.color = '#B4B2A9'
              }}
              onMouseLeave={(e) => {
                if (!ativo) e.currentTarget.style.color = '#888780'
              }}
            >
              {t.label}
            </button>
          )
        })}
        </nav>

        <div
          className="terrae-relatorio-drawer-scroll min-h-0 flex-1 overflow-y-auto"
          style={{
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <RelatorioBanner
            dadosInsuficientes={dadosInsuficientes}
            semGeom={semGeom}
            classificacaoZumbi={dados_anm.classificacao_zumbi ?? null}
          />
          {processo.ativo_derivado === false ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(180, 178, 169, 0.1)',
                border: '1px solid #2C2C2A',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  color: '#888780',
                  fontSize: FS.md,
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
                aria-hidden
              >
                ⓘ
              </span>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: FS.md,
                    fontWeight: 600,
                    color: '#D3D1C7',
                  }}
                >
                  Processo encerrado
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: FS.sm,
                    color: '#888780',
                    lineHeight: 1.45,
                  }}
                >
                  Dados exibidos são históricos.
                </p>
              </div>
            </div>
          ) : null}
        {aba === 'processo' ? (
          <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                <p
                  style={{
                    fontSize: FS.display,
                    fontWeight: 500,
                    color: '#F1EFE8',
                    margin: 0,
                    lineHeight: 1.25,
                  }}
                >
                  {processo.numero}
                </p>
                {(() => {
                  if (processo.ativo_derivado === false) {
                    return (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: FS.sm,
                          fontWeight: 700,
                          backgroundColor: 'rgba(107, 114, 128, 0.18)',
                          color: COR_BADGE_EXTINTO,
                        }}
                      >
                        Extinto
                      </span>
                    )
                  }
                  const sit = processo.situacao
                  const cfg =
                    sit === 'ativo'
                      ? {
                          bg: 'rgba(74, 144, 184, 0.15)',
                          fg: '#4A90B8',
                          l: 'Ativo',
                        }
                      : sit === 'bloqueado'
                        ? {
                            bg: 'rgba(226, 75, 74, 0.15)',
                            fg: '#E24B4A',
                            l: 'Bloqueado',
                          }
                        : {
                            bg: 'rgba(136, 135, 128, 0.15)',
                            fg: '#888780',
                            l: 'Inativo',
                          }
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: FS.sm,
                        fontWeight: 700,
                        backgroundColor: cfg.bg,
                        color: cfg.fg,
                      }}
                    >
                      {cfg.l}
                    </span>
                  )
                })()}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: 16,
                  rowGap: 20,
                  marginTop: 0,
                }}
              >
                {[
                  { label: 'Titular', value: processo.titular, span: 2 },
                  {
                    label: 'Substância',
                    // Usa `formatarSubstancia` para resolver o sentinel
                    // SCM_SUBSTANCIA_NAO_INFORMADA → travessão. Fallback
                    // em `apresentarSubstanciaLabel` para casing consistente.
                    value:
                      substanciaFormatada != null
                        ? apresentarSubstanciaLabel(processo.substancia)
                        : '—',
                  },
                  { label: 'Regime', value: regimeExibicao },
                  { label: 'Área', value: areaExibicao },
                  {
                    label: 'UF',
                    value:
                      processo.uf != null && processo.uf.trim() !== ''
                        ? processo.uf
                        : '—',
                  },
                  {
                    label: 'Município',
                    value:
                      processo.municipio != null &&
                      processo.municipio.trim() !== ''
                        ? processo.municipio
                        : '—',
                  },
                  { label: 'Fase', value: faseExibicao },
                  {
                    label: 'Ano de protocolo',
                    value: anoProtocoloRelatorio(dados_anm),
                  },
                  {
                    label: 'Tempo de tramitação',
                    value:
                      dados_anm.tempo_tramitacao_texto != null &&
                      dados_anm.tempo_tramitacao_texto.trim() !== ''
                        ? dados_anm.tempo_tramitacao_texto.trim()
                        : `${dados_anm.tempo_tramitacao_anos} anos`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      gridColumn: row.span === 2 ? 'span 2' : undefined,
                    }}
                  >
                    <p
                      style={{
                        fontSize: FS.md,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: '#F1EFE8',
                        margin: '0 0 6px 0',
                      }}
                    >
                      {row.label}
                    </p>
                    <p
                      style={{
                        fontSize: FS.base,
                        color:
                          'valueColor' in row &&
                          row.valueColor != null &&
                          typeof row.valueColor === 'string'
                            ? row.valueColor
                            : '#D3D1C7',
                        margin: 0,
                        lineHeight: 1.35,
                      }}
                    >
                      {row.label === 'Tempo de tramitação' ? (
                        <span
                          style={{
                            color:
                              processo.ativo_derivado === false &&
                              dados_anm.tempo_tramitacao_texto?.trim()
                                ? COR_BADGE_EXTINTO
                                : corTramitacaoAnos(
                                    dados_anm.tempo_tramitacao_anos,
                                  ),
                          }}
                        >
                          {dados_anm.tempo_tramitacao_texto?.trim() ||
                            `${dados_anm.tempo_tramitacao_anos} anos`}
                        </span>
                      ) : (
                        row.value
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="ANM / Cadastro Mineiro"
              />
            </Card>

            <Card>
              <ProcessoEventosTimeline
                numero={processo.numero}
                totalEventos={processo.total_eventos}
                ativoDerivado={processo.ativo_derivado}
                numeroSei={dados_anm.numero_sei}
                cadastroDataIso={timestamps.cadastro_mineiro}
              />
              {mostrarDisclaimerSEI(processo) ? (
                <div
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #2C2C2A',
                  }}
                >
                  {TEXTO_DISCLAIMER_SEI_ANM.replace(/!/g, '')}
                </div>
              ) : null}
            </Card>

            {dados_anm.pendencias.length > 0 ? (
              <Card>
                <SecLabel branco>Pendências</SecLabel>
                {processo.ativo_derivado === false ? (
                  <p
                    style={{
                      fontSize: FS.sm,
                      color: '#888780',
                      margin: '0 0 10px 0',
                      lineHeight: 1.45,
                    }}
                  >
                    Registros históricos ao encerrar o processo — não indicam
                    pendência administrativa atual.
                  </p>
                ) : null}
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {dados_anm.pendencias.map((p, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        marginBottom: i < dados_anm.pendencias.length - 1 ? 10 : 0,
                      }}
                    >
                      <span
                        style={{
                          color:
                            processo.ativo_derivado === false
                              ? '#888780'
                              : '#E24B4A',
                          fontSize: FS.md,
                          lineHeight: 1.4,
                        }}
                      >
                        {processo.ativo_derivado === false ? '◆' : '▲'}
                      </span>
                      <span style={{ fontSize: FS.md, color: '#D3D1C7', lineHeight: 1.4 }}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
                <FonteLabel
                  dataIso={timestamps.cadastro_mineiro}
                  fonte="ANM / Cadastro Mineiro"
                />
              </Card>
            ) : null}

            {(() => {
              const ot: ObservacoesTecnicas = observacoes_tecnicas
              const c = filtrarLinhasObservacoes(ot.ciclo_regulatorio)
              const id = filtrarLinhasObservacoes(ot.identificacao)
              const todasVazias = c.length === 0 && id.length === 0
              const secoes: {
                key: string
                titulo: string
                linhas: ObservacoesTecnicasItem[]
              }[] = [
                { key: 'ciclo', titulo: 'Ciclo regulatório', linhas: c },
                { key: 'id', titulo: 'Identificação', linhas: id },
              ].filter((s) => s.linhas.length > 0)
              const rodapeData = formatarDataIsoPtBr(timestamps.cadastro_mineiro)
              const mostrarDisclaimerObservacoes =
                dados_anm.ano_protocolo != null &&
                dados_anm.ano_protocolo < 2019
              return (
                <Card>
                  <SecLabel branco>Observações técnicas</SecLabel>
                  {todasVazias ? (
                    <p
                      style={{
                        fontSize: FS.base,
                        color: '#888780',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      Dados oficiais ANM em atualização.
                    </p>
                  ) : (
                    <>
                      {secoes.map((sec, si) => (
                        <Fragment key={sec.key}>
                          {si > 0 ? (
                            <div style={OBS_V5_SEP_ENTRE_SECOES} aria-hidden />
                          ) : null}
                          <div>
                            <p style={OBS_V5_TITULO_SECAO}>{sec.titulo}</p>
                            {sec.linhas.map((row, ri) => (
                              <div
                                key={`${sec.key}-${row.label}-${ri}`}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: 12,
                                  paddingTop: 7,
                                  paddingBottom: 7,
                                  borderBottom:
                                    ri < sec.linhas.length - 1
                                      ? '1px dotted rgba(255,255,255,0.08)'
                                      : 'none',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: FS.md,
                                    color: '#888780',
                                    fontWeight: 400,
                                    lineHeight: 1.45,
                                    flexShrink: 0,
                                  }}
                                >
                                  {row.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: FS.md,
                                    color: '#D3D1C7',
                                    fontWeight: 500,
                                    lineHeight: 1.45,
                                    textAlign: 'right',
                                    maxWidth: '55%',
                                  }}
                                >
                                  {row.valor}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Fragment>
                      ))}
                    </>
                  )}
                  {!todasVazias && mostrarDisclaimerObservacoes ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: '#5F5E5A',
                        fontStyle: 'italic',
                        lineHeight: 1.5,
                        marginTop: 16,
                        marginBottom: 0,
                        paddingTop: 12,
                        borderTop: '1px solid #2C2C2A',
                      }}
                    >
                      {TEXTO_DISCLAIMER_SEI_OBSERVACOES}
                    </p>
                  ) : null}
                  <span
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      marginTop: 14,
                      fontSize: 10,
                      lineHeight: 1.45,
                      color: '#5F5E5A',
                    }}
                  >
                    {rodapeData
                      ? `Atualizado em ${rodapeData} · Fonte: SIGMINE / SEI-ANM`
                      : 'Fonte: SIGMINE / SEI-ANM'}
                  </span>
                </Card>
              )
            })()}
          </>
        ) : null}

        {aba === 'territorio' ? (
          <>
            {dadosInsuficientes ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    marginBottom: 6,
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  Análise territorial indisponível
                </div>
                Este processo não possui polígono georreferenciado no SIGMINE.
                Sem geometria, não é possível verificar sobreposição com terras
                indígenas, unidades de conservação, aquíferos ou infraestrutura.
              </div>
            ) : semGeom ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    marginBottom: 6,
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  Geometria indisponível no SIGMINE
                </div>
                Processo cadastrado na ANM mas sem polígono georreferenciado.
                A análise territorial será gerada quando a geometria for
                publicada pelo SIGMINE.
              </div>
            ) : (
              <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                <SecLabel branco style={{ marginBottom: 0, flex: 1 }}>
                  Áreas sensíveis
                </SecLabel>
                <CamadaTooltipHover texto={AREAS_SENSIVEIS_DIST_TOOLTIP} maxWidthPx={300}>
                  <span
                    aria-label="Sobre cores de distância"
                    style={{
                      cursor: 'help',
                      fontSize: FS.md,
                      color: '#888780',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ⓘ
                  </span>
                </CamadaTooltipHover>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {areasSensiveisTiUcRows.map((row, i) => {
                  const semDado = row.km === null || row.nome == null
                  const ausenciaTiPositiva =
                    row.tipo === 'Terra Indígena' && semDado
                  const corCirculo = ausenciaTiPositiva
                    ? DOT_AUSENCIA_POSITIVA
                    : semDado
                      ? '#444441'
                      : row.dot
                  const corTextoEsquerda = ausenciaTiPositiva
                    ? DOT_AUSENCIA_POSITIVA
                    : '#D3D1C7'
                  const distSens =
                    row.km != null ? distanciaSensivelLabel(row.km) : null
                  return (
                    <Fragment key={i}>
                      {i > 0 ? (
                        <div
                          aria-hidden
                          style={separadorInsetTerritorio}
                        />
                      ) : null}
                      <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: corCirculo,
                            flexShrink: 0,
                          }}
                        />
                        {row.nome && row.dot === DOT_UC ? (
                          <TextoTruncadoComTooltip
                            text={
                              auditoriaTerritorial
                                ? row.nome
                                : rotuloUcUmaLinha(
                                    row.nome,
                                    row.tipo ?? null,
                                  )
                            }
                            textoTooltip={
                              auditoriaTerritorial
                                ? row.tipo
                                  ? `${row.nome}: ${row.tipo}`
                                  : row.nome
                                : tooltipTextoUcCompleto(
                                    row.nome,
                                    row.tipo ?? null,
                                  )
                            }
                            placement="side"
                            className="min-w-0 flex-1"
                            style={{ fontSize: FS.md, color: corTextoEsquerda }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: FS.md,
                              color: corTextoEsquerda,
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            {row.nome ? row.nome : row.semIdTexto}
                          </span>
                        )}
                      </div>
                      {distSens ? (
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 500,
                            color: distSens.color,
                            flexShrink: 0,
                          }}
                        >
                          {distSens.text}
                        </span>
                      ) : null}
                    </div>
                    </Fragment>
                  )
                })}
                <div aria-hidden style={separadorInsetTerritorio} />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: DOT_APP,
                          flexShrink: 0,
                        }}
                      />
                      <CamadaTooltipHover
                        texto={GLOSSARIO_APP}
                        maxWidthPx={300}
                        inlineWrap
                      >
                        <span
                          style={{
                            fontSize: FS.md,
                            color: '#D3D1C7',
                            cursor: 'help',
                            textDecoration: 'underline dotted',
                            textUnderlineOffset: 2,
                          }}
                        >
                          APP
                        </span>
                      </CamadaTooltipHover>
                    </div>
                    <span
                      style={{
                        fontSize: FS.md,
                        fontWeight: 500,
                        color: territorial.sobreposicao_app
                          ? '#E24B4A'
                          : '#888780',
                        flexShrink: 0,
                        marginLeft: 'auto',
                        textAlign: 'right',
                      }}
                    >
                      {territorial.sobreposicao_app
                        ? 'Sim'
                        : 'Não verificada'}
                    </span>
                  </div>
                  {territorial.observacao_app ? (
                    <BlocoParagrafosMultilinha
                      texto={territorial.observacao_app}
                      styleParagrafo={areasSensiveisAppSubtextoStyle}
                    />
                  ) : null}
                </div>
                <div aria-hidden style={separadorInsetTerritorio} />
                {useQuilombolaDistancia ? (
                  (() => {
                    const qkm = territorial.distancia_quilombola_km as number
                    const dq = distanciaSensivelLabel(qkm)
                    return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: DOT_QUILOMBOLA,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <CamadaTooltipHover
                          texto={GLOSSARIO_QUILOMBOLA}
                          maxWidthPx={300}
                          inlineWrap
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            Quilombola
                          </span>
                        </CamadaTooltipHover>
                        {nomeQuilombolaExibicao
                          ? ` · ${nomeQuilombolaExibicao}`
                          : ''}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: FS.md,
                        fontWeight: 500,
                        color: dq.color,
                        flexShrink: 0,
                        marginLeft: 'auto',
                        textAlign: 'right',
                      }}
                    >
                      {dq.text}
                    </span>
                  </div>
                    )
                  })()
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: DOT_QUILOMBOLA,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <CamadaTooltipHover
                          texto={GLOSSARIO_QUILOMBOLA}
                          maxWidthPx={300}
                          inlineWrap
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            Quilombola
                          </span>
                        </CamadaTooltipHover>
                        {nomeQuilombolaExibicao
                          ? ` (${nomeQuilombolaExibicao})`
                          : ''}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: FS.md,
                        fontWeight: 500,
                        color: territorial.sobreposicao_quilombola
                          ? '#E24B4A'
                          : '#1D9E75',
                        flexShrink: 0,
                        marginLeft: 'auto',
                        textAlign: 'right',
                      }}
                    >
                      {territorial.sobreposicao_quilombola ? 'Sim' : 'Não'}
                    </span>
                  </div>
                )}
              </div>
              <FonteLabel
                dataIso={timestamps.terras_indigenas}
                fonte="FUNAI · CNUC/MMA · INCRA · CAR"
                fonteTitulo="Fontes"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Logística</SecLabel>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(
                  [
                    {
                      key: 'ferro',
                      dot: DOT_FERROVIA,
                      textoEsquerda:
                        territorial.nome_ferrovia != null &&
                        territorial.nome_ferrovia !== ''
                          ? `Ferrovia · ${territorial.nome_ferrovia}${
                              territorial.ferrovia_apenas_projeto_em_estudo
                                ? ' (sem operação)'
                                : ''
                            }`
                          : 'Sem ferrovia na região monitorada',
                      km: territorial.distancia_ferrovia_km ?? null,
                      temInfra: (() => {
                        const op = territorial.distancia_ferrovia_operacional_km
                        if (op != null && !Number.isNaN(op)) return true
                        if (territorial.ferrovia_apenas_projeto_em_estudo === true)
                          return false
                        return (
                          territorial.nome_ferrovia != null &&
                          territorial.nome_ferrovia !== ''
                        )
                      })(),
                    },
                    ...(territorial.nome_rodovia != null &&
                    territorial.nome_rodovia !== ''
                      ? [
                          {
                            key: 'rod',
                            dot: DOT_RODOVIA,
                            textoEsquerda: `Rodovia · ${territorial.nome_rodovia}${territorial.tipo_rodovia ? ` · ${territorial.tipo_rodovia}` : ''}`,
                            km:
                              territorial.distancia_rodovia_km != null &&
                              !Number.isNaN(territorial.distancia_rodovia_km)
                                ? territorial.distancia_rodovia_km
                                : null,
                            temInfra: true,
                          },
                        ]
                      : []),
                    {
                      key: 'porto',
                      dot: DOT_PORTO,
                      textoEsquerda:
                        territorial.nome_porto != null &&
                        territorial.nome_porto !== ''
                          ? `Porto · ${territorial.nome_porto}${territorial.uf_porto ? ` (${territorial.uf_porto})` : ''}`
                          : 'Sem porto na região monitorada',
                      km: territorial.distancia_porto_km ?? null,
                      temInfra:
                        territorial.nome_porto != null &&
                        territorial.nome_porto !== '',
                    },
                    {
                      key: 'sede',
                      dot: DOT_SEDE_MUNICIPAL,
                      textoEsquerda: `Sede municipal · ${territorial.nome_sede ?? processo.municipio}`,
                      km:
                        distanciaSedeKm != null &&
                        !Number.isNaN(distanciaSedeKm)
                          ? distanciaSedeKm
                          : null,
                      temInfra: true,
                    },
                  ] as const
                ).map((row, i) => {
                  const corCirculo = row.temInfra
                    ? row.dot
                    : DOT_AUSENCIA_INFRA
                  const distLog =
                    row.km !== null ? distanciaLogisticaLabel(row.km) : null
                  return (
                    <Fragment key={row.key}>
                      {i > 0 ? (
                        <div
                          aria-hidden
                          style={separadorInsetTerritorio}
                        />
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: corCirculo,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: FS.md,
                              color: '#D3D1C7',
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            {row.textoEsquerda}
                          </span>
                        </div>
                        {distLog ? (
                          <span
                            style={{
                              fontSize:
                                row.key === 'ferro' &&
                                territorial.ferrovia_apenas_projeto_em_estudo
                                  ? FS.sm
                                  : FS.md,
                              fontWeight:
                                row.key === 'ferro' &&
                                territorial.ferrovia_apenas_projeto_em_estudo
                                  ? 400
                                  : 500,
                              color:
                                row.key === 'ferro' &&
                                territorial.ferrovia_apenas_projeto_em_estudo
                                  ? '#6B7280'
                                  : distLog.color,
                              flexShrink: 0,
                              marginLeft: 'auto',
                              textAlign: 'right',
                            }}
                          >
                            {distLog.text}
                          </span>
                        ) : row.key === 'sede' ? (
                          <span
                            style={{
                              fontSize: FS.md,
                              fontWeight: 500,
                              color: '#8A8980',
                              flexShrink: 0,
                              marginLeft: 'auto',
                              textAlign: 'right',
                            }}
                          >
                            N/D
                          </span>
                        ) : null}
                      </div>
                    </Fragment>
                  )
                })}
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="DNIT · ANTAQ · IBGE/OSM"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Bioma</SecLabel>
              <p
                style={{
                  fontSize: FS.xl,
                  fontWeight: 500,
                  color: '#F1EFE8',
                  margin: '0 0 8px 0',
                }}
              >
                {territorial.bioma}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {biomaImplicacoes(territorial.bioma)}
              </p>
              <FonteLabel
                dataIso={timestamps.unidades_conservacao}
                fonte="IBGE / Biomas"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              {territorial.nome_aquifero ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                    }}
                  >
                    <SecLabel branco style={{ marginBottom: 0, flex: 1 }}>
                      Aquífero
                    </SecLabel>
                    <CamadaTooltipHover
                      texto={AQUIFERO_HIDROGEO_TOOLTIP}
                      maxWidthPx={300}
                    >
                      <span
                        aria-label="Contexto hidrogeológico"
                        style={{
                          cursor: 'help',
                          fontSize: FS.md,
                          color: '#888780',
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        ⓘ
                      </span>
                    </CamadaTooltipHover>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: DOT_AQUIFERO,
                          flexShrink: 0,
                          marginTop: 6,
                        }}
                        aria-hidden
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            fontSize: FS.lg,
                            color: '#D3D1C7',
                            margin: 0,
                            lineHeight: 1.5,
                          }}
                        >
                          {territorial.nome_aquifero}
                        </p>
                        {territorial.unidade_hidrogeologica ? (
                          <p
                            style={{
                              fontSize: FS.md,
                              color: '#888780',
                              margin: '4px 0 0 0',
                              lineHeight: 1.45,
                            }}
                          >
                            {territorial.unidade_hidrogeologica}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {territorial.distancia_aquifero_km != null &&
                    !Number.isNaN(territorial.distancia_aquifero_km) ? (
                      territorial.distancia_aquifero_km > 0 ? (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: FS.md,
                            fontWeight: 500,
                            color: corDistanciaKm(territorial.distancia_aquifero_km),
                            marginTop: 2,
                          }}
                        >
                          {formatKmPtBr(territorial.distancia_aquifero_km, 1)}
                        </span>
                      ) : (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: FS.sm,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: COR_SOBREPOSTO_AQUIFERO,
                            marginTop: 2,
                          }}
                        >
                          SOBREPOSTO
                        </span>
                      )
                    ) : territorial.sobreposicao_aquifero === true ? (
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: FS.sm,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          color: COR_SOBREPOSTO_AQUIFERO,
                          marginTop: 2,
                        }}
                      >
                        SOBREPOSTO
                      </span>
                    ) : null}
                  </div>
                  <FonteLabel
                    dataIso={timestamps.cadastro_mineiro}
                    fonte="CPRM/SGB"
                    marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                  />
                </>
              ) : (
                <>
                  <SecLabel branco>Aquífero</SecLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_AUSENCIA_POSITIVA,
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <p style={{ fontSize: FS.base, color: '#1D9E75', margin: 0 }}>
                      Nenhum aquífero relevante identificado
                    </p>
                  </div>
                  <FonteLabel
                    dataIso={timestamps.sigmine}
                    fonte="CPRM/SGB"
                    marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                  />
                </>
              )}
            </Card>

            <Card>
              <SecLabel branco>Ambiental</SecLabel>
              {ambientalLoading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 0',
                  }}
                >
                  <Loader2
                    className="h-8 w-8 shrink-0 animate-spin"
                    style={{ color: '#888780' }}
                    aria-hidden
                  />
                </div>
              ) : ambientalError ? (
                <p
                  style={{
                    fontSize: FS.md,
                    color: '#E24B4A',
                    margin: '8px 0 0 0',
                  }}
                >
                  {ambientalError.message}
                </p>
              ) : ambiental ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{ fontSize: FS.md, color: '#D3D1C7', flex: 1 }}
                    >
                      APP Hídrica
                    </span>
                    <span
                      style={{
                        fontSize: FS.md,
                        fontWeight: 500,
                        color: appOverlapTextColor(ambiental.app_hidrica.overlap_pct),
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {ambiental.app_hidrica.overlap_pct > 0
                        ? `${ambiental.app_hidrica.overlap_pct.toFixed(2)}% sobreposto`
                        : `a ${formatDistM(ambiental.app_hidrica.distancia_m)}`}
                    </span>
                  </div>
                  {ambiental.sitios_arqueologicos.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        Sítio: {s.nome?.trim() || s.tipo_bem || '—'}
                      </span>
                      <span
                        style={{
                          fontSize: FS.md,
                          fontWeight: 500,
                          color: '#4ade80',
                          flexShrink: 0,
                        }}
                      >
                        {s.distancia_km.toFixed(2).replace('.', ',')} km
                      </span>
                    </div>
                  ))}
                  {ambiental.massas_agua.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        Massa:{' '}
                        {m.nome?.trim() ||
                          (m.area_ha != null && !Number.isNaN(m.area_ha)
                            ? `${m.area_ha.toFixed(1)} ha`
                            : '—')}
                      </span>
                      <span
                        style={{
                          fontSize: FS.md,
                          fontWeight: 500,
                          color: '#4ade80',
                          flexShrink: 0,
                        }}
                      >
                        {m.distancia_km.toFixed(2).replace('.', ',')} km
                      </span>
                    </div>
                  ))}
                  <span
                    style={{
                      display: 'block',
                      marginTop: FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX,
                      fontSize: 10,
                      lineHeight: 1.45,
                      color: '#5F5E5A',
                    }}
                  >
                    Atualizado em{' '}
                    {formatarDataIsoPtBr(ambiental.calculado_em)} · Fontes: IPHAN ·
                    SNIRH-ANA · TERRADAR
                  </span>
                </>
              ) : null}
            </Card>
              </>
            )}
          </>
        ) : null}

        {aba === 'inteligencia' ? (
          <>
            {dadosInsuficientes ||
            substanciaDesconhecida(processo?.substancia ?? null) ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    marginBottom: 6,
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  Inteligência de mercado indisponível
                </div>
                {dadosInsuficientes
                  ? 'Este processo não tem substância declarada. Sem identificar o mineral, não é possível trazer dados de mercado global, preço, reservas ou demanda projetada.'
                  : 'A substância deste processo não está mapeada na base TERRADAR de mercado. Estamos trabalhando para expandir cobertura.'}
              </div>
            ) : (
              <>
            <Card>
              {isTipoMercadoBrOnly(intel_mineral.tipo_mercado) ? (
                (() => {
                  const anoRef =
                    intel_mineral.ano_referencia_amb != null &&
                    Number.isFinite(intel_mineral.ano_referencia_amb)
                      ? Math.round(intel_mineral.ano_referencia_amb)
                      : 2024
                  const uf = (intel_mineral.top_uf_produtora ?? '').trim()
                  const pctFmt = formatarPctTopUf(intel_mineral.top_uf_pct)
                  const topUfLinha =
                    uf !== ''
                      ? pctFmt !== '—'
                        ? `${uf} ${pctFmt}`
                        : uf
                      : pctFmt
                  return (
                    <>
                      <SecLabel branco style={{ marginBottom: 2 }}>
                        {`CONTEXTO BRASIL · ${processo.substancia.toUpperCase()}`}
                      </SecLabel>
                      <p
                        style={{
                          fontSize: FS.md,
                          color: '#888780',
                          margin: '0 0 16px 0',
                          lineHeight: 1.5,
                        }}
                      >
                        Mineral de consumo majoritariamente doméstico · sem
                        estatística USGS global
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div style={{ marginBottom: 10 }}>
                          <p
                            style={{
                              ...subsecaoTituloStyle,
                              margin: '0 0 4px 0',
                            }}
                          >
                            {`Produção Nacional ${anoRef}`}
                          </p>
                          <p
                            style={{
                              fontSize: FS.lg,
                              fontWeight: 500,
                              color: '#F1EFE8',
                              margin: 0,
                            }}
                          >
                            {formatarProducaoNacionalT(
                              intel_mineral.producao_br_absoluta_t,
                            )}
                          </p>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <p
                            style={{
                              ...subsecaoTituloStyle,
                              margin: '0 0 4px 0',
                            }}
                          >
                            Valor produção BR
                          </p>
                          <p
                            style={{
                              fontSize: FS.lg,
                              fontWeight: 500,
                              color: '#F1EFE8',
                              margin: 0,
                            }}
                          >
                            {formatarValorProducaoBrBrl(
                              intel_mineral.valor_producao_br_brl,
                            )}
                          </p>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <p
                            style={{
                              ...subsecaoTituloStyle,
                              margin: '0 0 4px 0',
                            }}
                          >
                            Preço médio nacional
                          </p>
                          <p
                            style={{
                              fontSize: FS.lg,
                              fontWeight: 500,
                              color: '#F1EFE8',
                              margin: 0,
                            }}
                          >
                            {formatarPrecoMedioBrBrlPorT(
                              intel_mineral.preco_medio_br_brl_t,
                            )}
                          </p>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <p
                            style={{
                              ...subsecaoTituloStyle,
                              margin: '0 0 4px 0',
                            }}
                          >
                            Top UF produtora
                          </p>
                          <p
                            style={{
                              fontSize: FS.lg,
                              fontWeight: 500,
                              color: '#F1EFE8',
                              margin: 0,
                            }}
                          >
                            {topUfLinha}
                          </p>
                        </div>
                      </div>
                      <FonteLabel
                        dataIso=""
                        fonte={`ANM Anuário Mineral Brasileiro ${anoRef}`}
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                })()
              ) : (
                <>
              <SecLabel branco style={{ marginBottom: 2 }}>
                Mercado desta commodity
              </SecLabel>
              <p
                style={{
                  fontSize: FS.xl,
                  fontWeight: 500,
                  color: '#EF9F27',
                  margin: '0 0 12px 0',
                }}
              >
                {processo.substancia.toUpperCase()}
              </p>
              {(() => {
                const mercadoST = commodityMarketState ?? 'BR_PRODUTOR'
                const temPrecoUsd =
                  (intel_mineral.unidade_preco === 'oz' &&
                    intel_mineral.preco_referencia_usd_oz != null &&
                    intel_mineral.preco_referencia_usd_oz > 0) ||
                  intel_mineral.preco_medio_usd_t > 0
                const explicaSemFonte =
                  textoExplicativoFonte(intel_mineral.fonte_preco) ||
                  textoExplicativoFonte(intel_mineral.fonte_res_prod) ||
                  textoAposSemFonteOficial(intel_mineral.fonte_res_prod ?? '')
                if (mercadoST === 'PROIBIDO') {
                  return (
                    <>
                      <div
                        style={{
                          borderLeft: '3px solid #E8A830',
                          padding: '12px 14px 12px 14px',
                          marginBottom: 12,
                          borderRadius: 6,
                          backgroundColor: 'rgba(232, 168, 48, 0.08)',
                        }}
                      >
                        <p
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                            margin: 0,
                            fontSize: FS.md,
                            color: '#D3D1C7',
                            lineHeight: 1.55,
                          }}
                        >
                          <Ban
                            size={18}
                            style={{
                              color: '#E8A830',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                            aria-hidden
                          />
                          <span>
                            <span style={{ color: '#F1EFE8', fontWeight: 600 }}>
                              Produção proibida no Brasil
                            </span>
                            <br />
                            Material regulamentado por Lei 12.635/2012 e decisão
                            STF 2017 (ADI 3406/3470).
                            <br />
                            <br />
                            Reservas geológicas existem mas são inexploráveis
                            legalmente.
                          </span>
                        </p>
                      </div>
                      <FonteLabel
                        dataIso={timestamps.usgs}
                        fonte={
                          intel_mineral.fonte_preco != null &&
                          intel_mineral.fonte_preco.trim() !== ''
                            ? intel_mineral.fonte_preco
                            : 'Fontes curadas TERRADAR'
                        }
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                }
                if (mercadoST === 'SEM_FONTE') {
                  return (
                    <>
                      {temPrecoUsd ? (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#888780',
                            margin: '0 0 12px 0',
                            lineHeight: 1.45,
                          }}
                        >
                          Dados de reservas e produção Brasil indisponíveis em
                          fontes oficiais comparáveis. O preço spot segue na
                          secção «Preço e tendência».
                        </p>
                      ) : null}
                      <div
                        style={{
                          borderLeft: '3px solid #888780',
                          paddingLeft: 12,
                          marginBottom: 12,
                        }}
                      >
                        <p
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'flex-start',
                            margin: 0,
                            fontSize: FS.md,
                            color: '#D3D1C7',
                            lineHeight: 1.55,
                          }}
                        >
                          <Info
                            size={18}
                            style={{
                              color: '#888780',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                            aria-hidden
                          />
                          <span>
                            <span style={{ color: '#F1EFE8', fontWeight: 600 }}>
                              Dados indisponíveis em fontes oficiais
                            </span>
                            {explicaSemFonte ? (
                              <>
                                <br />
                                <br />
                                <span style={{ color: '#888780' }}>
                                  {explicaSemFonte}
                                </span>
                              </>
                            ) : null}
                          </span>
                        </p>
                      </div>
                      <FonteLabel
                        dataIso={timestamps.usgs}
                        fonte={
                          intel_mineral.fonte_res_prod != null &&
                          intel_mineral.fonte_res_prod.trim() !== ''
                            ? intel_mineral.fonte_res_prod
                            : 'USGS Mineral Commodity Summaries'
                        }
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                }
                if (mercadoST === 'BR_NAO_PRODUTOR') {
                  const { brlPorGrama, brlPorTonelada } = drawerPrecoBrl
                  const txtRes =
                    intel_mineral.fonte_res_prod != null &&
                    intel_mineral.fonte_res_prod.trim() !== ''
                      ? textoExplicativoFonte(intel_mineral.fonte_res_prod) ||
                        intel_mineral.fonte_res_prod
                      : ''
                  return (
                    <>
                      {temPrecoUsd ? (
                        <div style={{ marginBottom: 14 }}>
                          {intel_mineral.unidade_preco === 'oz' &&
                          intel_mineral.preco_referencia_usd_oz != null ? (
                            <>
                              <p
                                style={{
                                  fontSize: FS.h2,
                                  fontWeight: 500,
                                  color: '#F1EFE8',
                                  margin: '0 0 6px 0',
                                }}
                              >
                                USD{' '}
                                {intel_mineral.preco_referencia_usd_oz.toLocaleString(
                                  'pt-BR',
                                )}
                                /oz
                              </p>
                              {brlPorGrama != null ? (
                                <p
                                  style={{
                                    fontSize: FS.lg,
                                    color: 'rgba(241, 239, 232, 0.65)',
                                    margin: '0 0 4px 0',
                                  }}
                                >
                                  ≈ R${' '}
                                  {brlPorGrama.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                  /g
                                  {cambioLegendaDrawer != null ? (
                                    <span
                                      style={{
                                        fontSize: FS.min,
                                        color: 'rgba(241,239,232,0.4)',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      {' '}
                                      (câmbio {cambioLegendaDrawer.toFixed(4)}
                                      {cambioStale
                                        ? ' — última cotação disponível'
                                        : ''}
                                      )
                                    </span>
                                  ) : null}
                                </p>
                              ) : cambioLoading ? (
                                <p
                                  style={{
                                    fontSize: FS.sm,
                                    color: '#888780',
                                    margin: 0,
                                  }}
                                >
                                  Obtendo câmbio…
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <p
                                style={{
                                  fontSize: FS.h2,
                                  fontWeight: 500,
                                  color: '#F1EFE8',
                                  margin: '0 0 6px 0',
                                }}
                              >
                                {intel_mineral.preco_medio_usd_t.toLocaleString(
                                  'pt-BR',
                                )}{' '}
                                USD/t
                              </p>
                              {brlPorTonelada != null ? (
                                <p
                                  style={{
                                    fontSize: FS.lg,
                                    color: 'rgba(241, 239, 232, 0.65)',
                                    margin: 0,
                                  }}
                                >
                                  ≈ R${' '}
                                  {brlPorTonelada.toLocaleString('pt-BR', {
                                    maximumFractionDigits: 2,
                                  })}
                                  /t
                                  {cambioLegendaDrawer != null ? (
                                    <span
                                      style={{
                                        fontSize: FS.min,
                                        color: 'rgba(241,239,232,0.4)',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      {' '}
                                      (câmbio {cambioLegendaDrawer.toFixed(4)}
                                      {cambioStale
                                        ? ' — última cotação disponível'
                                        : ''}
                                      )
                                    </span>
                                  ) : null}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                      <div
                        style={{
                          borderLeft: '3px solid #888780',
                          paddingLeft: 12,
                          marginBottom: 12,
                        }}
                      >
                        <p
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'flex-start',
                            margin: 0,
                            fontSize: FS.md,
                            color: '#D3D1C7',
                            lineHeight: 1.55,
                          }}
                        >
                          <Info
                            size={18}
                            style={{ color: '#888780', flexShrink: 0 }}
                            aria-hidden
                          />
                          <span>
                            <span style={{ color: '#F1EFE8', fontWeight: 600 }}>
                              Brasil não é produtor desta commodity
                            </span>
                            {txtRes ? (
                              <>
                                <br />
                                <br />
                                <span style={{ color: '#888780' }}>{txtRes}</span>
                              </>
                            ) : null}
                          </span>
                        </p>
                      </div>
                      <FonteLabel
                        dataIso={timestamps.usgs}
                        fonte="USGS MCS 2026"
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                }
                return (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16,
                      }}
                    >
                      {(() => {
                        const pctR = intel_mineral.reservas_brasil_mundial_pct
                        const corR =
                          pctR > 20
                            ? '#1D9E75'
                            : pctR >= 5
                              ? '#EF9F27'
                              : '#888780'
                        const pctP = intel_mineral.producao_brasil_mundial_pct
                        const corP =
                          pctP > 20
                            ? '#1D9E75'
                            : pctP < 5
                              ? '#E24B4A'
                              : '#EF9F27'
                        return (
                          <>
                            <div>
                              <p
                                style={{
                                  ...subsecaoTituloStyle,
                                  margin: '0 0 2px 0',
                                }}
                              >
                                Reservas Brasil
                              </p>
                              <p
                                style={{
                                  fontSize: FS.display,
                                  fontWeight: 500,
                                  color: corR,
                                  margin: '0 0 6px 0',
                                }}
                              >
                                {pctR}%
                              </p>
                              <div
                                style={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#2C2C2A',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, pctR)}%`,
                                    height: '100%',
                                    backgroundColor: corR,
                                  }}
                                />
                              </div>
                              <p
                                style={{
                                  fontSize: FS.md,
                                  color: SECTION_TITLE,
                                  margin: '6px 0 0 0',
                                }}
                              >
                                das reservas mundiais
                              </p>
                            </div>
                            <div>
                              <p
                                style={{
                                  ...subsecaoTituloStyle,
                                  margin: '0 0 2px 0',
                                }}
                              >
                                Produção Brasil
                              </p>
                              <p
                                style={{
                                  fontSize: FS.display,
                                  fontWeight: 500,
                                  color: corP,
                                  margin: '0 0 6px 0',
                                }}
                              >
                                {pctP}%
                              </p>
                              <div
                                style={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#2C2C2A',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, pctP)}%`,
                                    height: '100%',
                                    backgroundColor: corP,
                                  }}
                                />
                              </div>
                              <p
                                style={{
                                  fontSize: FS.md,
                                  color: SECTION_TITLE,
                                  margin: '6px 0 0 0',
                                }}
                              >
                                da produção mundial
                              </p>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    {(() => {
                      const pctR = intel_mineral.reservas_brasil_mundial_pct
                      const pctP = intel_mineral.producao_brasil_mundial_pct
                      const diff = pctR - pctP
                      const fPg = formatarGapPontosPercentuais(diff)
                      const fX = formatarPctContextoGlobal(pctP)
                      const fY = formatarPctContextoGlobal(pctR)

                      let corGap: string
                      let gapTxt: string
                      let explic: string

                      if (Math.abs(diff) < 0.5) {
                        corGap = '#888780'
                        gapTxt =
                          Math.abs(diff) < 0.05
                            ? 'Gap: 0 p.p.'
                            : `Gap: ${fPg} p.p.`
                        explic = `A participação brasileira na produção mundial (${fX}%) está alinhada à sua proporção de reservas (${fY}%).`
                      } else if (diff > 0) {
                        corGap = '#1D9E75'
                        gapTxt = `Gap: +${fPg} p.p.`
                        explic = `A produção brasileira (${fX}%) está abaixo da proporção de reservas (${fY}%), indicando potencial de expansão de ${fPg} p.p.`
                      } else {
                        corGap = '#E8A830'
                        gapTxt = `Gap: ${fPg} p.p.`
                        explic = `A produção brasileira (${fX}%) supera a proporção de reservas (${fY}%), indicando ritmo de extração acelerado`
                      }

                      return (
                        <>
                          <p
                            style={{
                              fontSize: FS.lg,
                              fontWeight: 500,
                              color: corGap,
                              margin: '16px 0 0 0',
                              lineHeight: 1.45,
                            }}
                          >
                            {gapTxt}
                          </p>
                          <p
                            style={{
                              fontSize: FS.md,
                              color: '#888780',
                              margin: '6px 0 0 0',
                              lineHeight: 1.45,
                            }}
                          >
                            {explic}
                          </p>
                        </>
                      )
                    })()}
                    <FonteLabel
                      dataIso={timestamps.usgs}
                      fonte={
                        intel_mineral.fonte_res_prod != null &&
                        intel_mineral.fonte_res_prod.trim() !== ''
                          ? intel_mineral.fonte_res_prod
                          : 'USGS Mineral Commodity Summaries'
                      }
                      marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                    />
                  </>
                )
              })()}
                </>
              )}
            </Card>

            {commodityMarketState !== 'PROIBIDO' ? (
            <Card>
              <SecLabel branco>Preço e tendência</SecLabel>
              {(() => {
                const { brlPorGrama, brlPorTonelada } = drawerPrecoBrl
                const legendaCambio =
                  cambioLegendaDrawer != null && cambioLegendaDrawer > 0
                    ? cambioLegendaDrawer
                    : null
                const dataCambioFmt = formatarDataIsoPtBr(
                  cambioFetchedAt != null
                    ? cambioFetchedAt.toISOString().slice(0, 10)
                    : intel_mineral.cambio_data ?? metadata?.cambio_data,
                )
                return intel_mineral.unidade_preco === 'oz' &&
                  intel_mineral.preco_referencia_usd_oz != null ? (
                  <>
                    <p
                      style={{
                        fontSize: FS.h2,
                        fontWeight: 500,
                        color: '#F1EFE8',
                        margin: '0 0 10px 0',
                      }}
                    >
                      USD{' '}
                      {intel_mineral.preco_referencia_usd_oz.toLocaleString('pt-BR')}
                      /oz
                    </p>
                    {cambioLoading &&
                    brlPorGrama == null &&
                    intel_mineral.preco_referencia_usd_oz > 0 ? (
                      <p
                        style={{
                          fontSize: FS.sm,
                          color: '#888780',
                          margin: '0 0 10px 0',
                        }}
                      >
                        Obtendo câmbio USD/BRL…
                      </p>
                    ) : null}
                    {brlPorGrama != null ? (
                      <>
                        <p
                          style={{
                            fontSize: FS.h2,
                            fontWeight: 400,
                            color: 'rgba(241, 239, 232, 0.6)',
                            margin: '0 0 4px 0',
                          }}
                        >
                          ≈ R${' '}
                          {brlPorGrama.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          /g
                        </p>
                        <p
                          style={{
                            fontSize: FS.min,
                            color: 'rgba(241, 239, 232, 0.4)',
                            fontStyle: 'italic',
                            margin: '0 0 10px 0',
                            lineHeight: 1.45,
                          }}
                        >
                          (câmbio {legendaCambio != null ? legendaCambio.toFixed(4) : '—'}
                          {cambioStale ? ' — última cotação disponível' : ''}
                          {dataCambioFmt ? ` · ${dataCambioFmt}` : ''})
                        </p>
                      </>
                    ) : null}
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: 'rgba(241, 239, 232, 0.45)',
                        margin: '0 0 10px 0',
                        lineHeight: 1.45,
                      }}
                    >
                      {intel_mineral.preco_medio_usd_t.toLocaleString('pt-BR')} USD/t
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        fontSize: FS.h2,
                        fontWeight: 500,
                        color: '#F1EFE8',
                        margin: '0 0 4px 0',
                      }}
                    >
                      {intel_mineral.preco_medio_usd_t.toLocaleString('pt-BR')} USD/t
                    </p>
                    {cambioLoading &&
                    brlPorTonelada == null &&
                    intel_mineral.preco_medio_usd_t > 0 ? (
                      <p
                        style={{
                          fontSize: FS.sm,
                          color: '#888780',
                          margin: '0 0 8px 0',
                        }}
                      >
                        Obtendo câmbio USD/BRL…
                      </p>
                    ) : null}
                    {brlPorTonelada != null ? (
                      <>
                        <p
                          style={{
                            fontSize: FS.lg,
                            fontWeight: 400,
                            color: 'rgba(241, 239, 232, 0.6)',
                            margin: '0 0 4px 0',
                          }}
                        >
                          ≈ R${' '}
                          {brlPorTonelada.toLocaleString('pt-BR', {
                            maximumFractionDigits: 2,
                          })}
                          /t
                        </p>
                        <p
                          style={{
                            fontSize: FS.min,
                            color: 'rgba(241, 239, 232, 0.4)',
                            fontStyle: 'italic',
                            margin: '0 0 10px 0',
                            lineHeight: 1.45,
                          }}
                        >
                          (câmbio {legendaCambio != null ? legendaCambio.toFixed(4) : '—'}
                          {cambioStale ? ' — última cotação disponível' : ''}
                          {dataCambioFmt ? ` · ${dataCambioFmt}` : ''})
                        </p>
                      </>
                    ) : null}
                  </>
                )
              })()}
              {(() => {
                const t = intel_mineral.tendencia_preco
                const cfg =
                  t === 'alta'
                    ? {
                        bg: 'rgba(29, 158, 117, 0.15)',
                        fg: '#1D9E75',
                        tx: 'Alta',
                        Icon: IconTendenciaAlta,
                      }
                    : t === 'estavel'
                      ? {
                          bg: 'rgba(136, 135, 128, 0.15)',
                          fg: '#B8B5AC',
                          tx: 'Estável',
                          Icon: IconTendenciaEstavel,
                        }
                      : {
                          bg: 'rgba(226, 75, 74, 0.15)',
                          fg: '#E24B4A',
                          tx: 'Queda',
                          Icon: IconTendenciaQueda,
                        }
                const Ic = cfg.Icon
                return (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      borderRadius: 5,
                      padding: '6px 12px',
                      fontSize: FS.lg,
                      fontWeight: 500,
                      backgroundColor: cfg.bg,
                      color: cfg.fg,
                      marginBottom: 18,
                    }}
                  >
                    <Ic />
                    {cfg.tx}
                  </span>
                )
              })()}
              {intel_mineral.var_1a_pct != null ? (
                <p
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    margin: '0 0 14px 0',
                    lineHeight: 1.45,
                  }}
                >
                  Var. 12m:{' '}
                  {intel_mineral.var_1a_pct > 0 ? '+' : ''}
                  {intel_mineral.var_1a_pct}%
                  {intel_mineral.cagr_5a_pct != null ? (
                    <span style={{ marginLeft: 16 }}>
                      CAGR 5a:{' '}
                      {intel_mineral.cagr_5a_pct > 0 ? '+' : ''}
                      {intel_mineral.cagr_5a_pct}%
                    </span>
                  ) : null}
                </p>
              ) : null}
              <div style={{ marginTop: 14 }}>
                <p
                  style={{
                    ...subsecaoTituloStyle,
                    marginBottom: 8,
                  }}
                >
                  Demanda projetada 2030
                </p>
                {intel_mineral.demanda_projetada_estruturada ? (
                  <>
                    <p
                      style={{
                        fontSize: FS.lg,
                        fontWeight: 600,
                        color: '#E8A830',
                        margin: '0 0 10px 0',
                        lineHeight: 1.45,
                      }}
                    >
                      {intel_mineral.demanda_projetada_estruturada.titulo}
                    </p>
                    <div style={{ margin: 0, padding: 0 }}>
                      {intel_mineral.demanda_projetada_estruturada.itens.map(
                        (t, i, arr) => (
                          <p
                            key={i}
                            style={{
                              margin:
                                i < arr.length - 1 ? '0 0 8px 0' : 0,
                              padding: 0,
                              color: '#D3D1C7',
                              fontSize: FS.md,
                              lineHeight: 1.55,
                            }}
                          >
                            {t}
                          </p>
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <p
                    style={{
                      fontSize: FS.lg,
                      color: '#D3D1C7',
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {intel_mineral.demanda_projetada_2030}
                  </p>
                )}
              </div>
              <FonteLabel
                dataIso={
                  metadata?.calculado_em?.slice(0, 10) ?? timestamps.preco_spot
                }
                fonte={fontePrecoTendenciaCard}
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
            ) : null}

            <Card>
              <SecLabel branco>Aplicações</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {intel_mineral.aplicacoes_principais.length > 0 ? (
                  intel_mineral.aplicacoes_principais.map((a) => (
                    <span
                      key={a}
                      style={{
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: FS.sm,
                        backgroundColor: 'rgba(239, 159, 39, 0.15)',
                        color: '#EF9F27',
                      }}
                    >
                      {a}
                    </span>
                  ))
                ) : (
                  <p
                    style={{
                      fontSize: FS.lg,
                      color: '#888780',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    Sem aplicações na master de substâncias para este cadastro.
                  </p>
                )}
              </div>
              <FonteLabel
                dataIso={timestamps.usgs}
                fonte="USGS Mineral Commodity Summaries"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Estratégia nacional</SecLabel>
              <div
                style={{
                  borderLeft: '3px solid #EF9F27',
                  paddingLeft: 12,
                }}
              >
                {intel_mineral.estrategia_nacional_itens &&
                intel_mineral.estrategia_nacional_itens.length > 0 ? (
                  intel_mineral.estrategia_nacional_itens.map((t, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: FS.lg,
                        color: '#D3D1C7',
                        margin: i === 0 ? 0 : '10px 0 0 0',
                        lineHeight: 1.5,
                      }}
                    >
                      {t}
                    </p>
                  ))
                ) : (
                  <BlocoParagrafosMultilinha
                    texto={intel_mineral.estrategia_nacional}
                    styleParagrafo={{
                      fontSize: FS.lg,
                      color: '#D3D1C7',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  />
                )}
              </div>
              <FonteLabel
                dataIso={timestamps.alertas_legislativos}
                fonte="MME / Plano Nacional de Mineração 2030 + Adoo (monitoramento regulatório)"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <div
              style={{
                backgroundColor: '#0D0D0C',
                borderRadius: 8,
                padding: '20px 18px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                Valor in-situ teórico
              </p>
              <p
                style={{
                  fontSize: FS.highlight,
                  fontWeight: 500,
                  color: '#EF9F27',
                  margin:
                    valorReservaBrlBiPorHaEfetivo != null
                      ? '0 0 8px 0'
                      : '0 0 20px 0',
                }}
              >
                {valorReservaUsdMiPorHa != null
                  ? `${formatarUsdMiInteligente(valorReservaUsdMiPorHa)}/ha`
                  : '—'}
              </p>
              {valorReservaBrlBiPorHaEfetivo != null ? (
                <>
                  <p
                    style={{
                      fontSize: FS.display,
                      fontWeight: 500,
                      color: 'rgba(232, 168, 48, 0.7)',
                      margin:
                        cambioLegendaDrawer != null ? '0 0 4px 0' : '0 0 16px 0',
                    }}
                  >
                    ≈ R${' '}
                    {valorReservaBrlBiPorHaEfetivo.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    bi/ha
                  </p>
                  {cambioLegendaDrawer != null ? (
                    <p
                      style={{
                        fontSize: FS.min,
                        color: 'rgba(241, 239, 232, 0.4)',
                        fontStyle: 'italic',
                        margin: '0 0 16px 0',
                        lineHeight: 1.45,
                      }}
                    >
                      (câmbio {cambioLegendaDrawer.toFixed(4)}
                      {cambioStale ? ' — última cotação disponível' : ''}
                      {(() => {
                        const d = formatarDataIsoPtBr(
                          cambioFetchedAt != null
                            ? cambioFetchedAt.toISOString().slice(0, 10)
                            : intel_mineral.cambio_data ?? metadata?.cambio_data,
                        )
                        return d ? ` · ${d}` : ''
                      })()}
                      )
                    </p>
                  ) : null}
                </>
              ) : null}
              <BlocoParagrafosMultilinha
                texto={intel_mineral.metodologia_estimativa}
                styleParagrafo={{
                  fontSize: FS.sm,
                  color: '#A3A29A',
                  fontStyle: 'italic',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  textAlign: 'left',
                }}
              >
                <p
                  style={{
                    fontSize: FS.min,
                    color: 'rgba(241, 239, 232, 0.7)',
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  Estimativa teórica padronizada de valor in-situ por hectare,
                  com premissas fixas de volume e teor.
                </p>
                <p
                  style={{
                    fontSize: FS.min,
                    color: 'rgba(239, 159, 39, 0.7)',
                    margin: '6px 0 0 0',
                    lineHeight: 1.55,
                  }}
                >
                  Não substitui avaliação de recurso (NI 43-101 / JORC). Valor
                  realizável depende de cubagem, viabilidade técnica, recuperação
                  metalúrgica e condições de mercado.
                </p>
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="Estimativa TERRADAR / SIGMINE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </div>

            <Card>
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                Processos vizinhos
              </p>
              <p
                style={{
                  fontSize: FS.min,
                  color: 'rgba(241, 239, 232, 0.4)',
                  margin: '0 0 8px 0',
                  lineHeight: 1.45,
                }}
              >
                111 processos num raio de 25 km · 5 mais relevantes
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: FS.md,
                  }}
                >
                  <thead>
                    <tr>
                      {(
                        [
                          'Nº processo',
                          'Titular',
                          'Substância',
                          'Área (ha)',
                        ] as const
                      ).map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            ...subsecaoTituloStyle,
                            fontSize: FS.min,
                            padding: '0 6px 8px 0',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        style={{
                          textAlign: 'left',
                          ...subsecaoTituloStyle,
                          fontSize: FS.min,
                          padding: '0 6px 8px 0',
                        }}
                      >
                        <CamadaTooltipHover
                          texto="Distância em quilômetros entre os centroides dos dois processos (fonte: SIGMINE/ANM)"
                          maxWidthPx={300}
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            DIST. (km)
                          </span>
                        </CamadaTooltipHover>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...intel_mineral.processos_vizinhos]
                      .sort(
                        (a, b) =>
                          (a.distancia_km ?? 0) - (b.distancia_km ?? 0),
                      )
                      .map((v, i) => (
                        <tr
                          key={v.numero}
                          style={{
                            backgroundColor: i % 2 === 0 ? '#0D0D0C' : '#1A1A18',
                          }}
                        >
                          <td
                            style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}
                          >
                            {v.numero}
                          </td>
                          <td
                            style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}
                          >
                            <span
                              title={v.titular}
                              style={{ display: 'block', minWidth: 0 }}
                            >
                              <TextoTruncadoComTooltip
                                text={v.titular}
                                placement="above"
                                className="block max-w-[100px] terrae-pdf-titular-wrap"
                                style={{ fontSize: FS.md, color: '#D3D1C7' }}
                              />
                            </span>
                          </td>
                          <td
                            style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}
                          >
                            {abreviarSubstanciaVizinho(v.substancia)}
                          </td>
                          <td
                            style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}
                          >
                            {Math.round(v.area_ha).toLocaleString('pt-BR')}
                          </td>
                          <td
                            style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}
                          >
                            {v.distancia_km == null
                              ? 'N/D'
                              : v.distancia_km <= 0
                                ? 'SOBREPOSTO'
                                : `${v.distancia_km.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })} km`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="ANM / SIGMINE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
              </>
            )}
          </>
        ) : null}

        {aba === 'risco' ? (
          scoreIndisponivel ? (
            // Empty state honesto da aba Risco. Evita renderizar "N/A" em
            // cards vazios quando o processo não tem Risk Score (zumbi, sem
            // geom sem score, ou fora de escopo atual). O texto é contextual
            // pelo motivo da ausência — coerente com o banner do topo.
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  marginBottom: 6,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                Risk Score indisponível
              </div>
              {dadosInsuficientes
                ? 'Este processo não possui dados suficientes para cálculo de Risk Score. Substância, município ou geometria não foram declarados na ANM.'
                : semGeom
                  ? 'Este processo não possui polígono georreferenciado no SIGMINE. Sem geometria, a dimensão ambiental não pode ser avaliada e o Risk Score não é calculado.'
                  : 'Risk Score não calculado para este processo. Pode estar em fila de processamento ou fora do escopo atual da base TERRADAR.'}
            </div>
          ) : (
          <>
            <Card>
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  textAlign: 'center',
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                Risk Score
              </p>
              {processo.risk_score === null ? (
                <p
                  style={{
                    fontSize: FS.jumbo,
                    fontWeight: 500,
                    textAlign: 'center',
                    color: '#888780',
                    margin: '0 0 8px 0',
                  }}
                >
                  N/A
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: FS.jumbo,
                      fontWeight: 500,
                      textAlign: 'center',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {riskDecomposicaoMemo ? (
                      <CamadaTooltipHover
                        conteudo={
                          <RiskTotalCalcTooltipContent
                            decomposicao={riskDecomposicaoMemo}
                          />
                        }
                        maxWidthPx={280}
                        preferAbove
                        inlineWrap
                      >
                        <span
                          style={{
                            color: exibicaoScoresRelatorio.rsCorNumero,
                            borderBottom: `1px dotted ${exibicaoScoresRelatorio.rsCorNumero}`,
                            cursor: 'help',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {processo.risk_score}
                        </span>
                      </CamadaTooltipHover>
                    ) : (
                      <span
                        style={{
                          color: exibicaoScoresRelatorio.rsCorNumero,
                        }}
                      >
                        {processo.risk_score}
                      </span>
                    )}
                  </p>
                  <p
                    style={{
                      fontSize: FS.lg,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: exibicaoScoresRelatorio.rsCorRotulo,
                      margin: 0,
                    }}
                  >
                    {exibicaoScoresRelatorio.rsLabel}
                  </p>
                  {isRotuloScoreTerminado(exibicaoScoresRelatorio.rsLabel) ? (
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#5F5E5A',
                        textAlign: 'center',
                        margin: '10px 0 0 0',
                        lineHeight: 1.45,
                        paddingTop: 10,
                        borderTop: '1px solid #2C2C2A',
                      }}
                    >
                      ⛔ Valores numéricos são referência técnica; não indicam
                      risco operacional para processo encerrado ou extinto.
                    </p>
                  ) : null}
                  {processo.risk_breakdown ? (
                    <div
                      style={{
                        marginTop: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                      }}
                    >
                      {(
                        [
                          ['Geológico', processo.risk_breakdown.geologico],
                          ['Ambiental', processo.risk_breakdown.ambiental],
                          ['Social', processo.risk_breakdown.social],
                          ['Regulatório', processo.risk_breakdown.regulatorio],
                        ] as const
                      ).map(([label, val]) => {
                        const cor = corFaixaRisco(val)
                        return (
                          <div
                            key={label}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              minWidth: 0,
                              maxWidth: '100%',
                            }}
                          >
                            <span
                              style={{
                                fontSize: FS.base,
                                color: '#888780',
                                width: 100,
                                flexShrink: 0,
                              }}
                            >
                              {label}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: '#2C2C2A',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, val))}%`,
                                  height: '100%',
                                  backgroundColor: cor,
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: FS.base,
                                fontWeight: 700,
                                color: cor,
                                width: 36,
                                textAlign: 'right',
                                flexShrink: 0,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {val}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </>
              )}
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="Terrae, com dados ANM, FUNAI, ICMBio e IBGE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            {processo.risk_score !== null && riskDecomposicaoMemo ? (
              <Card>
                <RiskDecomposicaoRelatorioPanel
                  decomposicao={riskDecomposicaoMemo}
                />
              </Card>
            ) : null}

            <Card>
              <SecLabel branco>Alertas regulatórios</SecLabel>
              {alertasOrdenados.length === 0 ? (
                <p style={{ fontSize: FS.base, color: '#888780', margin: 0 }}>
                  Nenhum alerta regulatório ativo
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {alertasOrdenados.map((al, idx) => {
                    const metaFonte: CSSProperties = {
                      fontSize: FS.sm,
                      color: '#5F5E5A',
                    }
                    const rotuloFonte = rotuloFontePublicacaoExibicao(
                      al.fonte,
                      al.fonte_diario,
                    )
                    const relevanciaMeta = estiloBadgeRelevancia(
                      al.nivel_impacto,
                      al.tipo_impacto,
                    )
                    return (
                    <div key={al.id}>
                      {idx > 0 ? (
                        <div
                          style={{
                            height: 1,
                            backgroundColor: '#2C2C2A',
                            margin: '16px 0',
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                        }}
                      >
                        <AlertaItemImpactoBar
                          nivel={al.nivel_impacto}
                          tipo_impacto={al.tipo_impacto}
                          textoDetalhe={textoTooltipNivelImpactoLegislativo(
                            al.nivel_impacto,
                          )}
                          zIndexTooltip={CFEM_BAR_TOOLTIP.zIndex + 1}
                          barraAlturaFixaPx={48}
                        />
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingLeft: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'nowrap',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 12,
                            }}
                          >
                            <p
                              style={{
                                flex: 1,
                                minWidth: 0,
                                margin: 0,
                                padding: 0,
                                fontSize: FS.md,
                                color: '#888780',
                                lineHeight: 1.45,
                              }}
                            >
                              {al.titulo}
                            </p>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                console.log('abrir publicação')
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'flex-start',
                                alignSelf: 'flex-start',
                                flexShrink: 0,
                                margin: 0,
                                padding: 0,
                                fontSize: FS.sm,
                                fontWeight: 500,
                                color: '#F1B85A',
                                whiteSpace: 'nowrap',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                lineHeight: 1.45,
                              }}
                            >
                              Ver no Diário
                              <ArrowUpRight
                                size={14}
                                strokeWidth={2}
                                aria-hidden
                                className="shrink-0"
                                style={{ marginLeft: 4, flexShrink: 0 }}
                                color="#F1B85A"
                              />
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'baseline',
                              gap: '6px 8px',
                              marginTop: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: FS.sm,
                                fontWeight: 500,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                                color: relevanciaMeta.cor,
                                display: 'inline-block',
                              }}
                            >
                              {relevanciaMeta.label}
                            </span>
                            <span
                              style={{
                                color: '#5F5E5A',
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              ·
                            </span>
                            <span
                              style={{
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              {rotuloFonte}
                            </span>
                            <span
                              style={{
                                color: '#5F5E5A',
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              ·
                            </span>
                            <span
                              style={{
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              {formatarDataIsoPtBr(al.data)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
              <FonteLabel
                dataIso={timestamps.alertas_legislativos}
                fonte="Adoo"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
          )
        ) : null}

        {aba === 'oportunidade' ? (
          scoreIndisponivel ? (
            // Empty state honesto da aba Oportunidade. Conteúdo (incluindo
            // o card "Análise TERRADAR" em linha ~4705) some automaticamente
            // porque está dentro do branch `oportunidade`. Coerente com o
            // banner do topo e com a aba Risco (empty state do Bloco 3a).
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  marginBottom: 6,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                Opportunity Score indisponível
              </div>
              {dadosInsuficientes
                ? 'Este processo não possui dados suficientes para cálculo de Opportunity Score. Sem substância, município ou geometria, não é possível avaliar atratividade, viabilidade ou segurança.'
                : semGeom
                  ? 'Este processo não possui polígono georreferenciado no SIGMINE. Sem geometria, a análise de viabilidade logística e atratividade não pode ser realizada.'
                  : 'Opportunity Score não calculado para este processo. Pode estar em fila de processamento ou fora do escopo atual.'}
            </div>
          ) : oportunidade ? (
            <>
              <div
                style={{
                  flexShrink: 0,
                  width: '100%',
                  overflow: 'visible',
                  minWidth: 0,
                }}
              >
                <Card style={{ overflow: 'visible' }}>
                  <SecLabel branco>
                    {dados.oportunidade_secao_titulo ?? 'Opportunity Score'}
                  </SecLabel>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 12,
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {(
                      [
                        ['conservador', 'CONSERVADOR'] as const,
                        ['moderado', 'MODERADO'] as const,
                        ['arrojado', 'ARROJADO'] as const,
                      ] as const
                    ).map(([k, titulo]) => {
                      const p = oportunidade.perfis[k]
                      const corFaixa = exibicaoScoresRelatorio.osCor(p.valor)
                      const isAtivo = perfilOportunidadeAtivo === k
                      const opacidadeConteudo = isAtivo
                        ? 1
                        : hoverPerfilOportunidade === k
                          ? 0.75
                          : 0.5
                      return (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={isAtivo}
                          onClick={() => setPerfilOportunidadeAtivo(k)}
                          onMouseEnter={() => setHoverPerfilOportunidade(k)}
                          onMouseLeave={() => setHoverPerfilOportunidade(null)}
                          style={{
                            minWidth: 0,
                            backgroundColor: '#161614',
                            borderRadius: 6,
                            padding: '16px 12px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            border: isAtivo
                              ? `1px solid ${corFaixa}`
                              : '1px solid rgba(255,255,255,0.06)',
                            borderTop: isAtivo
                              ? `3px solid ${corFaixa}`
                              : `3px solid ${hexCorParaRgba(corFaixa, 0.4)}`,
                            transition:
                              'opacity 150ms ease, border-color 150ms ease',
                            appearance: 'none',
                            fontFamily: 'inherit',
                            margin: 0,
                          }}
                        >
                          <div
                            style={{
                              opacity: opacidadeConteudo,
                              transition: 'opacity 150ms ease',
                            }}
                          >
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.8px',
                                textTransform: 'uppercase',
                                color: '#888780',
                                margin: '0 0 10px 0',
                              }}
                            >
                              {titulo}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                lineHeight: 1,
                              }}
                            >
                              <CamadaTooltipHover
                                conteudo={
                                  <OportunidadePerfilCalcTooltipContent
                                    perfil={k}
                                    oportunidade={oportunidade}
                                  />
                                }
                                maxWidthPx={280}
                                preferAbove
                                inlineWrap
                              >
                                <span
                                  style={{
                                    fontSize: 36,
                                    fontWeight: 500,
                                    color: corFaixa,
                                    fontVariantNumeric: 'tabular-nums',
                                    borderBottom: `1px dotted ${corFaixa}`,
                                    cursor: 'help',
                                    display: 'inline-block',
                                  }}
                                >
                                  {p.valor}
                                </span>
                              </CamadaTooltipHover>
                            </p>
                            <p
                              style={{
                                fontSize: FS.md,
                                fontWeight: 600,
                                color: corFaixa,
                                marginTop: 4,
                                marginBottom: 0,
                              }}
                            >
                              {exibicaoScoresRelatorio.osLabel(p.valor)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {isRotuloScoreTerminado(
                    exibicaoScoresRelatorio.osLabel(
                      oportunidade.perfis.conservador.valor,
                    ),
                  ) ? (
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#5F5E5A',
                        textAlign: 'center',
                        margin: '14px 0 0 0',
                        lineHeight: 1.45,
                        paddingTop: 12,
                        borderTop: '1px solid #2C2C2A',
                      }}
                    >
                      ⛔ Valores numéricos são referência técnica; oportunidade
                      operacional não se aplica a processo extinto ou terminal.
                    </p>
                  ) : null}
                  <FonteLabel
                    dataIso={timestamps.cadastro_mineiro}
                    fonte="TERRADAR, com dados ANM, IBGE, Tesouro e USGS"
                    marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                    noWrap
                  />
                </Card>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  width: '100%',
                  overflow: 'visible',
                  minWidth: 0,
                }}
              >
                <Card style={{ overflow: 'visible' }}>
                  <OportunidadeDecomposicaoRelatorioPanel
                    oportunidade={oportunidade}
                    pesosPerfil={
                      PESOS_OS_POR_PERFIL[perfilOportunidadeAtivo]
                    }
                  />
                </Card>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  width: '100%',
                  overflow: 'visible',
                  minWidth: 0,
                }}
              >
                <OportunidadeAnaliseTerradarCard
                  cruzamento={oportunidade.cruzamento}
                />
              </div>
            </>
          ) : (
            <Card>
              <p style={{ fontSize: FS.base, color: '#888780', margin: 0 }}>
                Dados de Opportunity Score não disponíveis para este processo.
              </p>
            </Card>
          )
        ) : null}

        {aba === 'fiscal' ? (
          dadosInsuficientes ? (
            // Empty state da aba Fiscal — aplicado APENAS para zumbis.
            // Processos sem-geom (ex.: 931.006/2022) têm município/UF
            // declarados e continuam renderizando CAPAG, fiscal municipal,
            // CFEM histórico e incentivos UF normalmente. O card "CFEM
            // histórico indisponível" existente já cobre sub-casos sem
            // cobertura CFEM dentro do fluxo normal.
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  marginBottom: 6,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                Dados fiscais indisponíveis
              </div>
              Este processo não tem município declarado. Sem identificar
              o município, não é possível trazer CAPAG, receitas municipais,
              histórico de CFEM ou incentivos estaduais.
            </div>
          ) : (
          <>
            <Card>
              <p
                style={{
                  fontSize: FS.jumbo,
                  fontWeight: 500,
                  textAlign: 'center',
                  color: capagCorExibicao(fiscal.capag),
                  margin: '0 0 8px 0',
                }}
              >
                <CamadaTooltipHover
                  className="inline-block"
                  texto={textoTooltipCapagPublico(fiscal.capag)}
                  maxWidthPx={360}
                  preferBelow
                  bubblePadding="10px 12px"
                  inlineWrap
                >
                  <span
                    style={{
                      cursor: 'help',
                      display: 'inline-block',
                    }}
                  >
                    {fiscal.capag}
                  </span>
                </CamadaTooltipHover>
              </p>
              {fiscal.capag_estruturado ? (
                <>
                  {fiscal.capag_estruturado.resumo
                    .split('\n')
                    .map((linha) => linha.trim())
                    .filter(Boolean)
                    .map((linha, i, arr) => (
                      <p
                        key={i}
                        style={{
                          fontSize: FS.lg,
                          color: '#888780',
                          textAlign: 'center',
                          margin:
                            i === 0
                              ? '0 0 4px 0'
                              : i === arr.length - 1
                                ? '0 0 16px 0'
                                : '0 0 4px 0',
                          lineHeight: 1.5,
                        }}
                      >
                        {linha}
                      </p>
                    ))}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0,
                      margin: '0 0 16px 0',
                    }}
                  >
                    {fiscal.capag_estruturado.indicadores.map((ind, i, arr) => (
                      <div
                        key={ind.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          paddingTop: i === 0 ? 0 : 10,
                          paddingBottom: 10,
                          borderBottom:
                            i < arr.length - 1
                              ? '1px dotted rgba(255,255,255,0.08)'
                              : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontSize: FS.sm,
                            color: SECTION_TITLE,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            lineHeight: 1.35,
                          }}
                        >
                          {ind.label}
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: FS.metric,
                              fontWeight: 500,
                              color: '#F1EFE8',
                              fontVariantNumeric: 'tabular-nums',
                              lineHeight: 1.2,
                            }}
                          >
                            {ind.valor}
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 28,
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: FS.sm,
                              fontWeight: 700,
                              color: capagCorIndicadorLinha(ind.nota),
                              backgroundColor: hexCorParaRgba(
                                capagCorIndicadorLinha(ind.nota),
                                0.15,
                              ),
                            }}
                          >
                            {ind.nota}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {fiscal.capag_estruturado.rodape ? (
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#888780',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        margin: '0 0 8px 0',
                        lineHeight: 1.5,
                      }}
                    >
                      {fiscal.capag_estruturado.rodape}
                    </p>
                  ) : null}
                </>
              ) : (
                <BlocoParagrafosMultilinha
                  texto={fiscal.capag_descricao}
                  styleParagrafo={{
                    fontSize: FS.lg,
                    color: '#888780',
                    textAlign: 'center',
                    margin: '0 0 8px 0',
                    lineHeight: 1.5,
                  }}
                />
              )}
              {fiscal.capag_estruturado &&
              normalizeCapagNotaDisplay(fiscal.capag) === 'n.d.' &&
              fiscal.capag_pior_indicador_letra != null &&
              ['A', 'B', 'C', 'D'].includes(
                fiscal.capag_pior_indicador_letra.toUpperCase(),
              ) &&
              fiscal.capag_pior_indicador_nome != null &&
              fiscal.capag_pior_indicador_nome !== 'indicadores' ? (
                <p
                  style={{
                    fontSize: FS.lg,
                    color: 'var(--amber, #EF9F27)',
                    textAlign: 'center',
                    margin: '0 0 8px 0',
                    lineHeight: 1.5,
                  }}
                >
                  {`Indicadores sugerem classificação equivalente a ${fiscal.capag_pior_indicador_letra} (determinada ${fraseDeterminadaPeloIndicadorCapag(
                    fiscal.capag_pior_indicador_nome,
                  )})`}
                </p>
              ) : null}
              {fiscal.contexto_referencia_fiscal ? (
                <p
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    textAlign: 'center',
                    margin: '0 0 8px 0',
                    lineHeight: 1.45,
                  }}
                >
                  {fiscal.contexto_referencia_fiscal}
                </p>
              ) : null}
              <p
                style={{
                  fontSize: FS.lg,
                  fontWeight: 700,
                  color: '#D3D1C7',
                  textAlign: 'center',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {processo.municipio} / {processo.uf}
              </p>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="STN / CAPAG Municipios"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  columnGap: 20,
                  rowGap: 12,
                }}
              >
                {(() => {
                  const dividaLbl =
                    fiscal.divida_fonte === 'passivo_nao_circulante'
                      ? 'Passivo não circulante'
                      : fiscal.divida_fonte === null
                        ? 'Endividamento'
                        : 'Dívida consolidada'
                  const dividaTxt =
                    fiscal.divida_exibicao != null &&
                    fiscal.divida_exibicao.trim() !== ''
                      ? fiscal.divida_exibicao
                      : formatarRealBrlInteligente(
                          fiscal.divida_consolidada_mi * 1_000_000,
                        )
                  const rows: {
                    key: string
                    l: string
                    v: string
                    nota?: string
                  }[] = [
                    {
                      key: 'rp',
                      l: 'Receita própria',
                      v: formatarRealBrlInteligente(
                        fiscal.receita_propria_mi * 1_000_000,
                      ),
                    },
                    {
                      key: 'div',
                      l: dividaLbl,
                      v: dividaTxt,
                      nota:
                        fiscal.divida_fonte === 'passivo_nao_circulante'
                          ? 'Proxy de endividamento; dívida consolidada não disponível na série atual'
                          : undefined,
                    },
                    {
                      key: 'pib',
                      l: 'PIB municipal',
                      v: formatarRealBrlInteligente(
                        fiscal.pib_municipal_mi * 1_000_000,
                      ),
                    },
                  ]
                  return rows.map((m) => (
                    <div
                      key={m.key}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        padding: '0 4px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <p
                        style={{
                          ...subsecaoTituloStyle,
                          letterSpacing: '0.4px',
                          margin: '0 0 4px 0',
                          minHeight: 46,
                          lineHeight: 1.25,
                          display: 'flex',
                          alignItems: 'flex-end',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          overflowWrap: 'break-word',
                          hyphens: 'auto',
                        }}
                      >
                        {m.l}
                      </p>
                      <p
                        style={{
                          fontSize: FS.metric,
                          fontWeight: 500,
                          color: '#F1EFE8',
                          margin: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {m.v}
                      </p>
                      {m.nota ? (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#888780',
                            margin: '6px 0 0 0',
                            lineHeight: 1.35,
                          }}
                        >
                          {m.nota}
                        </p>
                      ) : null}
                    </div>
                  ))
                })()}
              </div>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '22px 0 0 0',
                  lineHeight: 1.5,
                }}
              >
                Dependência de transferências:{' '}
                <CamadaTooltipHover
                  texto={textoTooltipDependenciaTransferencias(
                    fiscal.dependencia_transferencias_pct,
                  )}
                  maxWidthPx={320}
                  preferAbove
                  inlineWrap
                  bubblePadding="10px 12px"
                >
                  <span
                    style={{
                      color: corDependenciaTransferenciasPct(
                        fiscal.dependencia_transferencias_pct,
                      ),
                      fontWeight: 500,
                      borderBottom: '1px dotted #888780',
                      cursor: 'help',
                    }}
                  >
                    {fiscal.dependencia_transferencias_pct}%
                  </span>
                </CamadaTooltipHover>
              </p>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="STN / SICONFI (DCA)"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            {(fiscal.cfem_num_lancamentos ?? 0) > 0 &&
            fiscal.cfem_por_municipio_tier1 &&
            fiscal.cfem_por_municipio_tier1.length > 0 ? (
              <Card>
                <SecLabel branco style={{ marginBottom: 6 }}>
                  CFEM por município
                </SecLabel>
                <p
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    margin: '0 0 14px 0',
                    lineHeight: 1.45,
                  }}
                >
                  {fiscal.cfem_num_lancamentos} lançamentos ·{' '}
                  {fiscal.cfem_total_historico_brl != null &&
                  Number.isFinite(fiscal.cfem_total_historico_brl)
                    ? formatarRealBrlInteligente(fiscal.cfem_total_historico_brl)
                    : 'Não disponível'}{' '}
                  · último: {fiscal.cfem_ultimo_ano ?? '—'}
                </p>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: FS.sm,
                    color: '#D3D1C7',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(241,239,232,0.15)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>
                        Ano
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>
                        Município
                      </th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>
                        Total anual
                      </th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>
                        Lançamentos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...fiscal.cfem_por_municipio_tier1]
                      .sort((a, b) => {
                        if (b.ano !== a.ano) return b.ano - a.ano
                        return b.total_anual_brl - a.total_anual_brl
                      })
                      .map((r) => (
                        <tr
                          key={`${r.ano}-${r.municipio_nome}`}
                          style={{
                            borderBottom: '1px solid rgba(80,78,72,0.35)',
                          }}
                        >
                          <td style={{ padding: '8px 6px' }}>{r.ano}</td>
                          <td style={{ padding: '8px 6px' }}>{r.municipio_nome}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                            {formatarRealBrlInteligente(r.total_anual_brl)}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                            {r.num_lancamentos}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <FonteLabel
                  dataIso={timestamps.cfem}
                  fonte="ANM Dados Abertos (CFEM)"
                  marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                />
              </Card>
            ) : null}

            {fiscal.autuacoes_anm != null && fiscal.autuacoes_anm.num > 0 ? (
              <Card
                style={{
                  borderColor: 'rgba(217, 165, 91, 0.35)',
                  background: 'rgba(217, 165, 91, 0.06)',
                }}
              >
                <SecLabel branco style={{ marginBottom: 8 }}>
                  Autuações fiscais ANM
                </SecLabel>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: FS.metric,
                        fontWeight: 700,
                        color: '#EF9F27',
                        margin: 0,
                      }}
                    >
                      {fiscal.autuacoes_anm.num}
                    </p>
                    <p style={{ fontSize: FS.sm, color: '#888780', margin: '4px 0 0 0' }}>
                      autuação(ões) históricas
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: FS.metric,
                        fontWeight: 700,
                        color: '#F1EFE8',
                        margin: 0,
                      }}
                    >
                      {fiscal.autuacoes_anm.valor_total_brl != null &&
                      Number.isFinite(fiscal.autuacoes_anm.valor_total_brl)
                        ? formatarRealBrlInteligente(
                            fiscal.autuacoes_anm.valor_total_brl,
                          )
                        : 'Não disponível'}
                    </p>
                    <p style={{ fontSize: FS.sm, color: '#888780', margin: '4px 0 0 0' }}>
                      valor total autuado
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: FS.min, color: '#5F5E5A', margin: 0, lineHeight: 1.45 }}>
                  Fonte: ANM Dados Abertos · CFEM_Autuacao. Não substitui consulta
                  processual direta.
                </p>
              </Card>
            ) : null}

            {fiscal.cfem_processo_status === 'OK' &&
            processo != null &&
            Array.isArray(processo.cfem_por_municipio_breakdown) &&
            processo.cfem_por_municipio_breakdown.length > 0 ? (
              <>
                {processo.cfem_por_municipio_breakdown.map((item) => (
                  <CfemVsMunicipioBreakdownCard
                    key={item.municipio_ibge}
                    item={item}
                    timestamps={timestamps}
                  />
                ))}
                {processo.cfem_por_municipio_breakdown.length > 1 ? (
                  <p
                    style={{
                      fontSize: FS.sm,
                      color: '#888780',
                      margin: '4px 0 16px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    Este processo cruza{' '}
                    {processo.cfem_por_municipio_breakdown.length} municípios
                    (poligonal em divisa). Total consolidado:{' '}
                    {formatarRealBrlInteligente(
                      processo.cfem_por_municipio_breakdown.reduce(
                        (s, b) => s + b.processo_total,
                        0,
                      ),
                    )}
                    .
                  </p>
                ) : null}
              </>
            ) : (
            <Card>
              <SecLabel branco style={{ marginBottom: 4 }}>
                CFEM: processo vs.{' '}
                {processo?.municipio?.trim()
                  ? `${processo.municipio.trim()}/${(processo.uf ?? '').trim() || '—'}`
                  : 'Município'}
              </SecLabel>
              {temCfemHistoricoMunicipal ? (
                <>
                  {(() => {
                  const ANO_ATUAL = new Date().getFullYear()
                  const ANO_MIN_CFEM = ANO_ATUAL - 4
                  const cfemSt = fiscal.cfem_processo_status
                  const cfemComparativoOk = cfemSt === 'OK'
                  const regimeDisplay =
                    REGIME_LABELS[regimeDrawerUi] ?? String(regimeDrawerUi)
                  const cfemCardSubtitle = cfemComparativoOk
                    ? 'Arrecadação deste processo comparada ao total do município'
                    : cfemSt === 'SEM_DADO_INDIVIDUALIZADO'
                      ? 'A CFEM individualizada por processo não está disponível na base atual. O gráfico mostra a CFEM total do município.'
                      : `Este processo está em fase de ${regimeDisplay} e não gera CFEM. O gráfico abaixo mostra a arrecadação de CFEM do município de ${processo.municipio}, como contexto regional.`
                  const cfemProcRaw = fiscal.cfem_processo
                  const cfemMunRaw =
                    fiscal.cfem_municipio.length > 0
                      ? fiscal.cfem_municipio
                      : fiscal.cfem_municipal_historico.map((h) => ({
                          ano: h.ano,
                          valor_recolhido_brl: h.valor_total_municipio_brl,
                        }))
                  const cfemProc = cfemProcRaw.filter(
                    (h) => h.ano >= ANO_MIN_CFEM,
                  )
                  const cfemMun = cfemMunRaw.filter(
                    (h) => h.ano >= ANO_MIN_CFEM,
                  )
                  const cfemProcEffetivo = cfemProc
                  const processoTemCfem =
                    cfemComparativoOk &&
                    cfemProcEffetivo.some((h) => h.valor_recolhido_brl > 0)
                  const procPorAno = new Map(
                    cfemProcEffetivo.map((h) => [h.ano, h.valor_recolhido_brl]),
                  )
                  const munPorAno = new Map(
                    cfemMun.map((h) => [
                      h.ano,
                      valorBrlCfemMunicipalHistorico(h),
                    ]),
                  )
                  const anos = [
                    ...new Set([
                      ...cfemProcEffetivo.map((h) => h.ano),
                      ...cfemMun.map((h) => h.ano),
                    ]),
                  ].sort((a, b) => a - b)
                  const maxProc = Math.max(
                    ...anos.map((y) => procPorAno.get(y) ?? 0),
                    1,
                  )
                  const maxMun = Math.max(
                    ...anos.map((y) => munPorAno.get(y) ?? 0),
                    1,
                  )
                  const trackH = 80
                  const totalProc = cfemProcEffetivo.reduce(
                    (s, h) => s + h.valor_recolhido_brl,
                    0,
                  )
                  const totalMun = cfemMun.reduce(
                    (s, h) => s + valorBrlCfemMunicipalHistorico(h),
                    0,
                  )
                  let linhaPct: ReactNode = null
                  if (cfemComparativoOk) {
                    if (totalProc === 0) {
                      linhaPct = (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#888780',
                            margin: '10px 0 0 0',
                            lineHeight: 1.45,
                          }}
                        >
                          Este processo não gerou CFEM no período 2022-2025
                        </p>
                      )
                    } else if (totalMun > 0) {
                      const pct = (totalProc / totalMun) * 100
                      const muitoBaixa = pct > 0 && pct < 1
                      const pctTexto = muitoBaixa
                        ? '< 1%'
                        : `${pct.toLocaleString('pt-BR', {
                            maximumFractionDigits: 1,
                            minimumFractionDigits: 0,
                          })}%`
                      linhaPct = (
                        <p
                          style={{
                            ...CFEM_CARD_SUBTITLE_STYLE,
                            color: '#D3D1C7',
                            margin: '10px 0 0 0',
                          }}
                        >
                          Este processo representa{' '}
                          <strong
                            style={{
                              fontWeight: 700,
                              color: '#EF9F27',
                            }}
                          >
                            {pctTexto}
                          </strong>{' '}
                          da CFEM municipal
                        </p>
                      )
                    } else {
                      linhaPct = (
                        <p
                          style={{
                            fontSize: FS.min,
                            color: '#5F5E5A',
                            margin: '10px 0 0 0',
                            lineHeight: 1.5,
                          }}
                        >
                          Dados municipais indisponíveis
                        </p>
                      )
                    }
                  }
                  const dataIsoCfem = [
                    timestamps.cfem,
                    timestamps.cfem_municipal,
                  ].reduce((a, b) => (a > b ? a : b))
                  return (
                    <>
                      <p
                        style={{
                          ...CFEM_CARD_SUBTITLE_STYLE,
                          margin: '0 0 28px 0',
                          textTransform: 'none',
                          letterSpacing: 'normal',
                          fontWeight: 400,
                        }}
                      >
                        {cfemCardSubtitle}
                      </p>
                      {cfemMun.length > 0 || processoTemCfem ? (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 16,
                            marginBottom: 18,
                          }}
                        >
                          {processoTemCfem ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 2,
                                  backgroundColor: '#4A90B8',
                                  flexShrink: 0,
                                }}
                                aria-hidden
                              />
                              <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                                Este processo
                              </span>
                            </div>
                          ) : null}
                          {cfemMun.length > 0 ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 2,
                                  backgroundColor: '#EF9F27',
                                  flexShrink: 0,
                                }}
                                aria-hidden
                              />
                              <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                                Município
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <RelatorioCfemBarrasComTooltip
                        processoTemCfem={processoTemCfem}
                        anos={anos}
                        procPorAno={procPorAno}
                        munPorAno={munPorAno}
                        maxProc={maxProc}
                        maxMun={maxMun}
                        trackH={trackH}
                      />
                      {cfemComparativoOk ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          marginTop: 4,
                          marginBottom: 28,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: '#888780',
                              margin: '0 0 6px 0',
                              lineHeight: 1.3,
                            }}
                          >
                            Este processo 5 anos
                          </p>
                          {processoTemCfem ? (
                            <p
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: '#4A90B8',
                                margin: 0,
                                lineHeight: 1.2,
                              }}
                            >
                              {formatarRealBrlInteligente(totalProc)}
                            </p>
                          ) : (
                            <p
                              style={{
                                fontSize: FS.sm,
                                color: '#5F5E5A',
                                margin: 0,
                                lineHeight: 1.2,
                                fontWeight: 400,
                              }}
                            >
                              Sem arrecadação
                            </p>
                          )}
                        </div>
                        <div
                          style={{
                            width: 1,
                            flexShrink: 0,
                            backgroundColor: '#2C2C2A',
                            alignSelf: 'stretch',
                            margin: '0 8px',
                          }}
                          aria-hidden
                        />
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: '#888780',
                              margin: '0 0 6px 0',
                              lineHeight: 1.3,
                            }}
                          >
                            Município 5 anos
                          </p>
                          <p
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: '#EF9F27',
                              margin: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {formatarRealBrlInteligente(totalMun)}
                          </p>
                        </div>
                      </div>
                      ) : (
                      <div
                        style={{
                          marginTop: 4,
                          marginBottom: 28,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            color: '#888780',
                            margin: '0 0 6px 0',
                            lineHeight: 1.3,
                          }}
                        >
                          Município (últimos 5 anos)
                        </p>
                        <p
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: '#EF9F27',
                            margin: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          {formatarRealBrlInteligente(totalMun)}
                        </p>
                      </div>
                      )}
                      {linhaPct}
                      <FonteLabel
                        dataIso={dataIsoCfem}
                        fonte="ANM / CFEM"
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                })()}
                </>
              ) : (
                <div
                  style={{
                    minHeight: 200,
                    margin: '0 0 28px 0',
                    padding: '24px 20px',
                    borderRadius: 8,
                    border: '1px solid rgba(44, 44, 42, 0.9)',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: 12,
                  }}
                >
                  <p
                    style={{
                      fontSize: FS.md,
                      fontWeight: 500,
                      color: '#F1EFE8',
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    Histórico de CFEM do município indisponível
                  </p>
                  <p
                    style={{
                      fontSize: FS.sm,
                      color: '#888780',
                      margin: 0,
                      lineHeight: 1.5,
                      maxWidth: 420,
                    }}
                  >
                    Os dados de arrecadação CFEM para este município ainda não foram indexados na base do TERRADAR. Consulte diretamente o portal ANM Dados Abertos para mais informações.
                  </p>
                </div>
              )}
            </Card>
            )}

            <Card>
              <SecLabel branco>Incentivos estaduais</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fiscal.incentivos_estaduais.map((x) => (
                  <span
                    key={x}
                    style={{
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: FS.md,
                      lineHeight: 1.3,
                      backgroundColor: 'rgba(29, 158, 117, 0.15)',
                      color: '#1D9E75',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="Secretarias estaduais / STN"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Linhas BNDES</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fiscal.linhas_bndes.map((x) => (
                  <span
                    key={x}
                    style={{
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: FS.md,
                      lineHeight: 1.3,
                      backgroundColor: 'rgba(74, 144, 184, 0.15)',
                      color: '#4A90B8',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="BNDES / Linhas de crédito"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Estimativa CFEM em operação</SecLabel>
              {fiscal.cfem_estimada_ha === 0 ? (
                <p
                  style={{
                    fontSize: FS.lg,
                    color: '#5F5E5A',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Sem estimativa disponível
                </p>
              ) : processo.regime === 'bloqueio_permanente' ? (
                <p
                  style={{
                    fontSize: FS.xxl,
                    fontWeight: 500,
                    color: '#5F5E5A',
                    margin: '0 0 8px 0',
                  }}
                >
                  Processo bloqueado permanentemente, sem previsão de operação
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: FS.xxl,
                      fontWeight: 500,
                      color: '#EF9F27',
                      margin: '0 0 8px 0',
                    }}
                  >
                    R$ {fmtCfemEstimadaBrlMiPerHa(fiscal.cfem_estimada_ha)} / ha
                  </p>
                  {processo.regime === 'bloqueio_provisorio' ? (
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#5F5E5A',
                        margin: '0 0 10px 0',
                        lineHeight: 1.5,
                      }}
                    >
                      (projeção condicional ao levantamento do bloqueio)
                    </p>
                  ) : null}
                  <p
                    style={{
                      fontSize: FS.lg,
                      color: SECTION_TITLE,
                      margin: '0 0 10px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    Valor teórico de CFEM por hectare (valor in-situ × alíquota)
                  </p>
                  <p
                    style={{
                      fontSize: FS.lg,
                      color: '#888780',
                      margin: '6px 0 0 0',
                      lineHeight: 1.5,
                    }}
                  >
                    Alíquota aplicável:{' '}
                    <span style={{ color: '#F1EFE8' }}>
                      {fiscal.aliquota_cfem_pct.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })}
                      %
                    </span>
                  </p>
                  {mostrarContextoCfemComparativo ? (
                    <div
                      style={{
                        borderTop: '1px solid #2A2A28',
                        marginTop: 16,
                        paddingTop: 14,
                      }}
                    >
                      <p
                        style={{
                          fontSize: FS.min,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#8E8D87',
                          textAlign: 'left',
                          margin: '0 0 10px 0',
                          lineHeight: 1.35,
                        }}
                      >
                        CONTEXTO COMPARATIVO
                      </p>
                      {mostrarCfemLinha1 ? (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#D3D1C7',
                            lineHeight: 1.5,
                            margin: '0 0 8px 0',
                          }}
                        >
                          <span style={{ color: '#5F5E5A' }}>• </span>
                          {processo.municipio} arrecadou{' '}
                          <span
                            style={{ color: '#EF9F27', fontWeight: 500 }}
                          >
                            {formatarRealBrlInteligente(cfemMunicipalTotalBrl)}
                          </span>{' '}
                          de CFEM nos últimos {anosCfemMunicipal} anos (todas as
                          substâncias)
                        </p>
                      ) : null}
                      {mostrarCfemLinha2 &&
                      cfemMultiplicadorHa != null &&
                      Number.isFinite(cfemMultiplicadorHa) ? (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#D3D1C7',
                            lineHeight: 1.5,
                            margin: '0 0 8px 0',
                          }}
                        >
                          <span style={{ color: '#5F5E5A' }}>• </span>
                          1 hectare deste processo geraria{' '}
                          <span
                            style={{ color: '#EF9F27', fontWeight: 500 }}
                          >
                            ~
                            {cfemMultiplicadorHa >= 1000
                              ? Math.round(cfemMultiplicadorHa).toLocaleString(
                                  'pt-BR',
                                )
                              : cfemMultiplicadorHa.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}
                            x
                          </span>{' '}
                          a média anual de CFEM do município
                        </p>
                      ) : null}
                      {mostrarCfemLinha3 && cfemPctPib != null ? (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#D3D1C7',
                            lineHeight: 1.5,
                            margin: 0,
                          }}
                        >
                          <span style={{ color: '#5F5E5A' }}>• </span>
                          Equivale a{' '}
                          <span
                            style={{ color: '#EF9F27', fontWeight: 500 }}
                          >
                            ~
                            {cfemPctPib.toLocaleString('pt-BR', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}
                            %
                          </span>{' '}
                          do PIB municipal por hectare minerado (
                          <span
                            style={{ color: '#EF9F27', fontWeight: 500 }}
                          >
                            {formatarRealBrlInteligente(
                              fiscal.pib_municipal_mi * 1_000_000,
                            )}
                          </span>
                          )
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {processoCfemDisclaimerHipotetico(processo) ? (
                    <div
                      style={{
                        marginTop: 12,
                        backgroundColor: '#1A1A18',
                        borderRadius: 6,
                        padding: '10px 12px',
                        borderLeft: '3px solid #E8A830',
                      }}
                    >
                      <p
                        style={{
                          fontSize: FS.md,
                          color: '#A3A29A',
                          fontStyle: 'italic',
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        Projeção hipotética. Processo em fase de pesquisa, sem
                        produção ativa. Valores baseados em declaração comercial
                        do titular, não em relatório de lavra aprovado pela ANM.
                      </p>
                    </div>
                  ) : null}
                  <FonteLabel
                    dataIso={timestamps.cfem}
                    fonte="ANM / CFEM · Lei 13.540/2017 · IBGE Cidades"
                    marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                  />
                </>
              )}
            </Card>
          </>
          )
        ) : null}
        </div>
      </div>
    </div>
  )
}
