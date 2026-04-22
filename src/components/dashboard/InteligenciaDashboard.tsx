import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipPayloadEntry } from 'recharts'
import { HelpCircle } from 'lucide-react'
import { dashboardMock, type DashboardAlertaRecente } from '../../data/dashboard.mock'
import { PROCESSOS_MOCK } from '../../data/processos.mock'
import BrasilMiniMap from './BrasilMiniMap'
import { estiloBadgeRelevancia } from '../../lib/relevanciaAlerta'
import { estiloBadgeSubstanciaPaletaV2 } from '../../lib/corSubstancia'
import { REGIME_COLORS, REGIME_LABELS } from '../../lib/regimes'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import { AlertaItemImpactoBar } from '../legislativo/AlertaItemImpactoBar'
import { RegimeBadge } from '../ui/RegimeBadge'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Fase, Processo, Regime } from '../../types'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  MOTION_LINE_ANIMATION_BEGIN_MS,
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS,
  MOTION_OVERLAY_INNER_ENTER_MS,
  MOTION_STAGGER_STEP_MS,
} from '../../lib/motionDurations'
import { barFillStyle, motionGroupStyle } from '../../lib/motionStyles'
import { INTEL_FILTER_SELECT_TRIGGER_STYLE, MultiSelectDropdown } from '../ui/MultiSelectDropdown'

const DEFAULT_INTEL_STAGGER_BASE_MS =
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS + MOTION_OVERLAY_INNER_ENTER_MS

/** Páginas 1-indexadas para a UI; inclui reticências quando total > 5. */
function indicadoresNumericosPagina(atual0: number, maxPage: number): Array<number | 'ellipsis'> {
  const total = maxPage + 1
  if (total <= 0) return []
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const cur = atual0 + 1
  if (cur <= 3) return [1, 2, 3, 'ellipsis', total]
  if (cur >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total]
  return [1, 'ellipsis', cur - 1, cur, cur + 1, 'ellipsis', total]
}

function IconBuscaIntel({
  size = 16,
  color,
  style,
}: {
  size?: number
  color: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth={2} />
      <path
        d="m21 21-4.3-4.3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLimparBuscaIntel({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChevronPagina({ dir, size = 16 }: { dir: 'left' | 'right'; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      {dir === 'left' ? (
        <path
          d="m15 18-6-6 6-6"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m9 18 6-6-6-6"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

/** Ícones estilo Lucide (SVG inline; evita dependência lucide-react no bundle). */
type IconTendenciaProps = {
  size?: number
  color?: string
  'aria-hidden'?: boolean
}

function IconTendenciaUp({ size = 12, color, ...rest }: IconTendenciaProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function IconTendenciaMinus({ size = 12, color, ...rest }: IconTendenciaProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M5 12h14" />
    </svg>
  )
}

function IconTendenciaDown({ size = 12, color, ...rest }: IconTendenciaProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  )
}

const FASE_LABELS: Record<Fase, string> = {
  requerimento: 'Requerimento',
  pesquisa: 'Pesquisa',
  concessao: 'Concessão',
  lavra: 'Lavra',
  encerrado: 'Encerrado',
}

const FASE_ORDER: Fase[] = [
  'requerimento',
  'pesquisa',
  'concessao',
  'lavra',
  'encerrado',
]

const SUB_KEYS = [
  { key: 'ferro' as const, label: 'Ferro', color: '#7EADD4' },
  { key: 'cobre' as const, label: 'Cobre', color: '#C87C5B' },
  { key: 'ouro' as const, label: 'Ouro', color: '#D4A843' },
  { key: 'niobio' as const, label: 'Nióbio', color: '#5CBFA0' },
  { key: 'terras_raras' as const, label: 'Terras Raras', color: '#3D8B7A' },
]

export const UFS_INTEL_DASHBOARD = ['MG', 'PA', 'GO', 'BA', 'AM', 'MT'] as const

const REGIMES_ORDEM: Regime[] = [
  'requerimento_pesquisa',
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'lavra_garimpeira',
  'registro_extracao',
  'disponibilidade',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

/** Mapeia substância do processo para série do gráfico (quando filtro de substâncias ativo). */
function chavesGraficoParaSubstancias(selecionadas: string[]): Set<(typeof SUB_KEYS)[number]['key']> {
  const out = new Set<(typeof SUB_KEYS)[number]['key']>()
  for (const raw of selecionadas) {
    const u = raw.toUpperCase()
    if (u === 'FERRO') out.add('ferro')
    else if (u === 'COBRE') out.add('cobre')
    else if (u === 'OURO') out.add('ouro')
    else if (u === 'NIOBIO') out.add('niobio')
    else if (
      /NEODIMIO|PRASEODIMIO|TERBIO|DISPROSIO|LITIO|TERRAS|RARAS|EUROPIO|GADOLINIO|SAMARIO|ITERBIO/i.test(
        normalizarSubstanciaChave(raw),
      )
    ) {
      out.add('terras_raras')
    }
  }
  return out
}

/** Chaves estáveis para contagem única de minerais estratégicos no KPI. */
type ChaveMineralEstrategico = 'nb' | 'li' | 'dy' | 'ni' | 'tr'

const ORDEM_MINERAL_ESTRATEGICO: ChaveMineralEstrategico[] = [
  'nb',
  'li',
  'dy',
  'ni',
  'tr',
]

const LABEL_MINERAL_ESTRATEGICO: Record<ChaveMineralEstrategico, string> = {
  nb: 'Nb',
  li: 'Li',
  dy: 'Dy',
  ni: 'Ni',
  tr: 'TR',
}

function substanciaParaChaveEstrategica(sub: string): ChaveMineralEstrategico | null {
  const u = normalizarSubstanciaChave(sub)
  if (u === 'NIOBIO') return 'nb'
  if (u === 'LITIO') return 'li'
  if (u === 'DISPROSIO') return 'dy'
  if (u === 'NIQUEL') return 'ni'
  if (
    /NEODIMIO|PRASEODIMIO|TERBIO|TERRAS|RARAS|EUROPIO|GADOLINIO|SAMARIO|ITERBIO/i.test(
      u,
    )
  ) {
    return 'tr'
  }
  return null
}

function estiloPillSubstanciaRanking(sub: string) {
  return estiloBadgeSubstanciaPaletaV2(sub)
}

/** Caixa alta para badges de substância (gráfico, tabela, tooltips do gráfico). */
function textoBadgeSubstanciaExibicao(raw: string): string {
  return raw.toLocaleUpperCase('pt-BR')
}

export interface FiltrosDashboard {
  periodo: { inicio: string | null; fim: string | null }
  ufs: string[]
  substancias: string[]
  regime: string | null
}

type OmitFiltro = { skipRegime?: boolean; skipUfs?: boolean }

function ultimoDiaMes(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

function filtrarProcessos(
  processos: Processo[],
  f: FiltrosDashboard,
  omit?: OmitFiltro,
): Processo[] {
  let rows = processos
  if (!omit?.skipRegime && f.regime != null) {
    rows = rows.filter((p) => p.regime === f.regime)
  }
  if (!omit?.skipUfs && f.ufs.length > 0) {
    rows = rows.filter((p) => f.ufs.includes(p.uf))
  }
  if (f.substancias.length > 0) {
    rows = rows.filter((p) => f.substancias.includes(p.substancia))
  }
  if (f.periodo.inicio) {
    rows = rows.filter((p) => p.data_protocolo >= `${f.periodo.inicio}-01`)
  }
  if (f.periodo.fim != null) {
    const fimMes = f.periodo.fim
    rows = rows.filter((p) => p.data_protocolo <= ultimoDiaMes(fimMes))
  }
  return rows
}

/** Retorna processos do mock filtrados por `filtros` (AND). `omit` exclui regime ou UFs do cruzamento. */
function processosFiltratos(f: FiltrosDashboard, omit?: OmitFiltro): Processo[] {
  return filtrarProcessos(PROCESSOS_MOCK, f, omit)
}

function corRisk(v: number | null): string {
  if (v === null) return '#5F5E5A'
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

/** Preenchimento da barra horizontal por faixa de risco médio (alinhado a `corRisk`). */
function corBarraUf(risk: number): string {
  if (risk < 40) return '#1D9E75'
  if (risk <= 69) return '#E8A830'
  return '#E24B4A'
}

function situacaoLabel(s: Processo['situacao']): string {
  if (s === 'ativo') return 'Ativo'
  if (s === 'bloqueado') return 'Bloqueado'
  return 'Inativo'
}

function formatPrecoUsd(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function textoQuantidadeProcessos(n: number): string {
  if (n === 1) return '1 processo'
  return `${n.toLocaleString('pt-BR')} processos`
}

function textoBaseadoEmScoresCalculados(scoredCount: number): string {
  if (scoredCount === 1) return 'baseado em 1 processo com score calculado'
  return `baseado em ${scoredCount.toLocaleString('pt-BR')} processos com score calculado`
}

function normalizarSubstanciaChave(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function formatValorPotencialKpi(somaMi: number): string {
  if (somaMi >= 1000) {
    const b = somaMi / 1000
    return `USD ${b.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}B`
  }
  return `USD ${Math.round(somaMi).toLocaleString('pt-BR')}M`
}

function fmtUltimoDespachoCelula(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(-2)}`
}

function corUltimoDespachoData(iso: string): string {
  const t = new Date(`${iso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return '#D3D1C7'
  const days = (Date.now() - t) / 86400000
  if (days <= 30) return '#1D9E75'
  if (days <= 180) return '#D3D1C7'
  if (days <= 365) return '#EF9F27'
  return '#E24B4A'
}

const INTEL_KPI_TOOLTIP_CORPO_VALOR_POTENCIAL =
  'Estimativa do valor de mercado das reservas minerais dos processos monitorados, calculada com base em dados de produção, reservas estimadas e preço spot internacional (USGS Mineral Commodity Summaries). Valores sujeitos a variação conforme condições de mercado e estágio de exploração.'

const INTEL_TOOLTIP_GAP_PRODUCAO =
  'Diferença entre a participação brasileira nas reservas mundiais e na produção mundial desta substância. Um gap elevado indica potencial subexplorado, representando oportunidade de investimento e desenvolvimento.'

const INTEL_TOOLTIP_ALERTA_LARGURA = 320
const INTEL_TOOLTIP_GAP_LARGURA = 300

const INTEL_TOOLTIP_DEMANDA_LARGURA = 300

type DemandaNivelMineral = 'alta' | 'moderada' | 'baixa'

const INTEL_TOOLTIP_DEMANDA_POR_NIVEL: Record<DemandaNivelMineral, string> = {
  alta: 'Forte oportunidade de investimento. Demanda global crescente com oferta limitada.',
  moderada:
    'Oportunidade moderada. Mercado em equilíbrio entre oferta e demanda.',
  baixa: 'Mercado com excesso de oferta. Avaliar viabilidade antes de investir.',
}

function tooltipTextoDemandaPorNivel(nivel: DemandaNivelMineral): string {
  return INTEL_TOOLTIP_DEMANDA_POR_NIVEL[nivel]
}

const MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/** Colunas do ranking de titulares: cabeçalhos e linhas compartilham a mesma largura. */
/** Mesmo tamanho/cor dos rótulos “Processos” / “Risco médio” em PROCESSOS POR ESTADO. */
const RANKING_TITULARES_HEAD_CELL: CSSProperties = {
  fontSize: 14,
  color: '#5F5E5A',
  fontWeight: 400,
}

const RANKING_TITULARES_COL_SUBSTANCIAS: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 4,
  justifyContent: 'flex-end',
  alignItems: 'center',
  flex: '0 0 168px',
  minWidth: 0,
}

const RANKING_TITULARES_COL_METRICA: CSSProperties = {
  flex: '0 0 100px',
  textAlign: 'right',
  alignSelf: 'center',
}

/** Célula “Risco”: conteúdo encostado à direita (próximo da coluna de ação / padding do card). */
const RANKING_TITULARES_RISCO_NA_GRID: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  minWidth: 0,
}

const RANKING_TITULARES_COL_ACAO: CSSProperties = {
  flex: '0 0 28px',
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
}

/** Mesma trilha das linhas do ranking; alinha toggles às colunas Hectares / Risco. Coluna 5 ≥80px e cresce p/ “Por Processos” numa linha só. */
const RANKING_TITULARES_GRID_TEMPLATE =
  '20px minmax(0,1fr) 168px 100px minmax(80px, max-content) 28px'

/** Ex.: "2026-03" → "Mar/2026" */
export function formatYyyyMmBarra(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return yyyyMm
  return `${MESES_ABREV[m - 1]}/${y}`
}

function corGapOportunidadePp(gapPp: number): string {
  if (gapPp > 15) return '#1D9E75'
  if (gapPp >= 5) return '#E8A830'
  return '#888780'
}

/** Gap positivo com prefixo "+"; inclui sufixo p.p. */
function formatarGapValorComPrefixo(gapPp: number): string {
  const s = gapPp.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  if (gapPp > 0) return `+${s} p.p.`
  return `${s} p.p.`
}

function parseYyyyMm(v: string | null): { y: number; m: number } | null {
  if (!v) return null
  const [y, m] = v.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null
  return { y, m }
}

function yyyyMmFromParts(y: number, month1: number): string {
  return `${y}-${String(month1).padStart(2, '0')}`
}

/** Mês corrente do relógio do cliente (YYYY-MM), para placeholder do filtro “Até”. */
export function yyyyMmMesAtualSistema(): string {
  const d = new Date()
  return yyyyMmFromParts(d.getFullYear(), d.getMonth() + 1)
}

export function mesYmDesabilitadoNoMonthPicker(
  variant: 'de' | 'ate',
  ym: string,
  todayYm: string,
  periodoMinYm: string,
  otherBound: string | null,
): boolean {
  if (ym.localeCompare(periodoMinYm) < 0) return true
  if (ym.localeCompare(todayYm) > 0) return true
  if (variant === 'de' && otherBound != null && ym.localeCompare(otherBound) > 0) {
    return true
  }
  if (variant === 'ate' && otherBound != null && ym.localeCompare(otherBound) < 0) {
    return true
  }
  return false
}

type SortCol = 'area' | 'risk' | 'fase'

function ChevronDown({
  aberto,
  stroke = '#5F5E5A',
  size = 12,
}: {
  aberto: boolean
  stroke?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      style={{
        flexShrink: 0,
        color: stroke,
        transform: aberto ? 'rotate(180deg)' : undefined,
        transition: 'transform 0.15s ease-out',
      }}
      aria-hidden
    >
      <path
        d="M 3 4.5 L 6 7.5 L 9 4.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

type IntelLinhaPortalTooltipState = {
  lineId: string | null
  texto: string | null
  x: number
  y: number
}

const IntelLinhaPortalTooltipSetterContext =
  createContext<React.Dispatch<React.SetStateAction<IntelLinhaPortalTooltipState>> | null>(null)

const INTEL_LINHA_TOOLTIP_WIDTH = 220
const INTEL_LINHA_TOOLTIP_OFFSET = 12

function intelLinhaTooltipLeftPx(mouseX: number): number {
  if (typeof window === 'undefined') {
    return mouseX + INTEL_LINHA_TOOLTIP_OFFSET
  }
  return mouseX + INTEL_LINHA_TOOLTIP_OFFSET + INTEL_LINHA_TOOLTIP_WIDTH > window.innerWidth
    ? mouseX - INTEL_LINHA_TOOLTIP_WIDTH - INTEL_LINHA_TOOLTIP_OFFSET
    : mouseX + INTEL_LINHA_TOOLTIP_OFFSET
}

function IntelLinhaPortalTooltipProvider({ children }: { children: ReactNode }) {
  const [tooltipState, setTooltipState] = useState<IntelLinhaPortalTooltipState>({
    lineId: null,
    texto: null,
    x: 0,
    y: 0,
  })

  const portal =
    tooltipState.lineId != null && tooltipState.texto != null ? (
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: intelLinhaTooltipLeftPx(tooltipState.x),
          top: tooltipState.y - 8,
          zIndex: 200,
          boxSizing: 'border-box',
          width: INTEL_LINHA_TOOLTIP_WIDTH,
          maxWidth: INTEL_LINHA_TOOLTIP_WIDTH,
          whiteSpace: 'normal',
          backgroundColor: '#2C2C2A',
          border: '1px solid #3a3a38',
          borderRadius: 6,
          padding: '6px 10px',
          color: '#D3D1C7',
          fontSize: 13,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        }}
      >
        {tooltipState.texto}
      </div>
    ) : null

  return (
    <IntelLinhaPortalTooltipSetterContext.Provider value={setTooltipState}>
      {children}
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </IntelLinhaPortalTooltipSetterContext.Provider>
  )
}

function IntelLinhaTooltip({
  lineId,
  texto,
  children,
}: {
  lineId: string
  texto: string
  children: ReactNode
}) {
  const setTooltip = useContext(IntelLinhaPortalTooltipSetterContext)

  if (!setTooltip) {
    return <>{children}</>
  }

  return (
    <div
      onMouseEnter={(e) => {
        setTooltip({ lineId, texto, x: e.clientX, y: e.clientY })
      }}
      onMouseMove={(e) => {
        setTooltip({ lineId, texto, x: e.clientX, y: e.clientY })
      }}
      onMouseLeave={() => {
        setTooltip({ lineId: null, texto: null, x: 0, y: 0 })
      }}
    >
      {children}
    </div>
  )
}

const KPI_TOOLTIP_DELAY_MS = 300

type IntelKpiTooltipApi = {
  enter: (titulo: string, corpo: string, clientX: number, clientY: number) => void
  move: (clientX: number, clientY: number) => void
  leave: () => void
}

const IntelKpiTooltipApiContext = createContext<IntelKpiTooltipApi | null>(null)

/** Quando o ícone de ajuda do KPI está em hover, notifica para fechar o tooltip do card (prioridade ao ícone). */
const IntelKpiNestedInfoContext = createContext<((hovering: boolean) => void) | null>(
  null,
)

function IntelKpiPortalTooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    visible: boolean
    titulo: string | null
    corpo: string | null
    x: number
    y: number
  }>({
    visible: false,
    titulo: null,
    corpo: null,
    x: 0,
    y: 0,
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xyRef = useRef({ x: 0, y: 0 })

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    },
    [],
  )

  const api = useMemo<IntelKpiTooltipApi>(
    () => ({
      enter: (titulo, corpo, clientX, clientY) => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        xyRef.current = { x: clientX, y: clientY }
        setState({
          visible: false,
          titulo: null,
          corpo: null,
          x: clientX,
          y: clientY,
        })
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          const { x: lx, y: ly } = xyRef.current
          setState({
            visible: true,
            titulo,
            corpo,
            x: lx,
            y: ly,
          })
        }, KPI_TOOLTIP_DELAY_MS)
      },
      move: (clientX, clientY) => {
        xyRef.current = { x: clientX, y: clientY }
        setState((s) => (s.visible ? { ...s, x: clientX, y: clientY } : s))
      },
      leave: () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setState({
          visible: false,
          titulo: null,
          corpo: null,
          x: 0,
          y: 0,
        })
      },
    }),
    [],
  )

  const portal =
    state.visible && state.titulo != null && state.corpo != null ? (
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: intelLinhaTooltipLeftPx(state.x),
          top: state.y - 8,
          zIndex: 200,
          boxSizing: 'border-box',
          width: INTEL_LINHA_TOOLTIP_WIDTH,
          maxWidth: INTEL_LINHA_TOOLTIP_WIDTH,
          whiteSpace: 'normal',
          backgroundColor: '#2C2C2A',
          border: '1px solid #3a3a38',
          borderRadius: 6,
          padding: '8px 10px',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{ color: '#F1EFE8', fontWeight: 500, marginBottom: 6, fontSize: 13 }}
        >
          {state.titulo}
        </div>
        <div style={{ color: '#D3D1C7', fontSize: 13 }}>{state.corpo}</div>
      </div>
    ) : null

  return (
    <IntelKpiTooltipApiContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </IntelKpiTooltipApiContext.Provider>
  )
}

function IntelKpiTooltip({
  titulo,
  corpo,
  children,
}: {
  titulo: string
  corpo: string
  children: ReactNode
}) {
  const api = useContext(IntelKpiTooltipApiContext)
  const lastMoveRef = useRef({ x: 0, y: 0 })

  const onNestedInfoHover = useCallback(
    (hovering: boolean) => {
      if (!api) return
      if (hovering) {
        api.leave()
      } else {
        const { x, y } = lastMoveRef.current
        api.enter(titulo, corpo, x, y)
      }
    },
    [api, titulo, corpo],
  )

  if (!api) {
    return <>{children}</>
  }

  return (
    <IntelKpiNestedInfoContext.Provider value={onNestedInfoHover}>
      <div
        style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        onMouseEnter={(e) => {
          lastMoveRef.current = { x: e.clientX, y: e.clientY }
          api.enter(titulo, corpo, e.clientX, e.clientY)
        }}
        onMouseMove={(e) => {
          lastMoveRef.current = { x: e.clientX, y: e.clientY }
          api.move(e.clientX, e.clientY)
        }}
        onMouseLeave={() => {
          api.leave()
        }}
      >
        {children}
      </div>
    </IntelKpiNestedInfoContext.Provider>
  )
}

const INTEL_KPI_TOOLTIP_CORPO_PROCESSOS =
  'Total de processos minerários ativos e bloqueados no universo monitorado pelo Terrae. Inclui todos os regimes: Concessão de Lavra, Autorização de Pesquisa, Req. de Lavra, Licenciamento e Mineral Estratégico.'

const INTEL_KPI_TOOLTIP_CORPO_HECTARES =
  'Soma das áreas de todos os processos monitorados, em hectares. Representa a extensão territorial total sob análise pelo Terrae, equivalente à área georreferenciada no SIGMINE/ANM.'

const INTEL_KPI_TOOLTIP_CORPO_RISCO =
  'Média dos Risk Scores de todos os processos com score calculado. O Risk Score varia de 0 a 100 e pondera quatro dimensões: Geológico (25%), Ambiental (30%), Social (25%) e Regulatório (20%).'

const INTEL_KPI_TOOLTIP_CORPO_MINERAIS_ESTRATEGICOS =
  'Quantidade de categorias de minerais estratégicos presentes na carteira após os filtros: nióbio (Nb), lítio (Li), disprósio (Dy), níquel (Ni) e terras raras (TR). Cada categoria conta uma vez se houver pelo menos um processo com essa substância.'

const INTEL_KPI_TOOLTIP_CORPO_PROCESSOS_RISCO_ALTO =
  'Número de processos com Risk Score igual ou superior a 70 (alto risco). A percentagem indica quanto isso representa do total de processos após os filtros ativos.'

const INTEL_INFO_TEXTO_PRODUCAO_GRAFICO =
  'O gráfico usa índice base 100, onde 100 representa a produção de cada substância em 2019. Valores acima de 100 indicam crescimento em relação a 2019; por exemplo, 150 significa 50% a mais que a produção de 2019. Substâncias com produção zero em 2019 são exibidas como \'sem produção\' no ano base.'

const INTEL_INFO_TEXTO_RISCO_KPI =
  'O Risk Score é um indicador proprietário do Terrae que varia de 0 a 100. É calculado ponderando quatro dimensões: Geológico (25%), Ambiental (30%), Social (25%) e Regulatório (20%). Abaixo de 40 é considerado baixo risco, entre 40 e 69 risco médio, acima de 70 alto risco.'

const INTEL_INFO_TEXTO_DISTRIBUICAO_REGIME =
  'Regime é a modalidade jurídica do título minerário outorgado pela ANM. Cada regime tem direitos e obrigações distintos. A Concessão de Lavra é o título definitivo para extração, enquanto a Autorização de Pesquisa permite apenas estudos geológicos.'

const INTEL_INFO_TEXTO_MINERAIS_ESTRATEGICOS =
  'Minerais classificados pelo Decreto MME 11.892/2025 como críticos para a transição energética e segurança nacional brasileira. Recebem tratamento prioritário na ANM e são objeto de acordos internacionais com EUA e União Europeia.'

const INTEL_INFO_TOOLTIP_WIDTH = 260
const INTEL_INFO_TOOLTIP_OFFSET = 12

function intelInfoTooltipLeftPx(mouseX: number): number {
  if (typeof window === 'undefined') {
    return mouseX + INTEL_INFO_TOOLTIP_OFFSET
  }
  return mouseX + INTEL_INFO_TOOLTIP_OFFSET + INTEL_INFO_TOOLTIP_WIDTH > window.innerWidth
    ? mouseX - INTEL_INFO_TOOLTIP_WIDTH - INTEL_INFO_TOOLTIP_OFFSET
    : mouseX + INTEL_INFO_TOOLTIP_OFFSET
}

function InfoTooltip({ texto }: { texto: string }) {
  const notifyKpiCardIconHover = useContext(IntelKpiNestedInfoContext)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xyRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(false)

  const limparTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      limparTimer()
    },
    [limparTimer],
  )

  const portal = visible ? (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: intelInfoTooltipLeftPx(pos.x),
        top: pos.y - 8,
        zIndex: 200,
        boxSizing: 'border-box',
        width: INTEL_INFO_TOOLTIP_WIDTH,
        maxWidth: INTEL_INFO_TOOLTIP_WIDTH,
        whiteSpace: 'normal',
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#D3D1C7',
        fontSize: 13,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {texto}
    </div>
  ) : null

  return (
    <>
      <span
        aria-label="Informação"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: 6,
          flexShrink: 0,
          cursor: 'help',
          color: '#5F5E5A',
          fontSize: 14,
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          notifyKpiCardIconHover?.(true)
          limparTimer()
          xyRef.current = { x: e.clientX, y: e.clientY }
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            const { x, y } = xyRef.current
            setPos({ x, y })
            visibleRef.current = true
            setVisible(true)
          }, KPI_TOOLTIP_DELAY_MS)
        }}
        onMouseMove={(e) => {
          xyRef.current = { x: e.clientX, y: e.clientY }
          if (visibleRef.current) {
            setPos({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseLeave={() => {
          notifyKpiCardIconHover?.(false)
          limparTimer()
          visibleRef.current = false
          setVisible(false)
        }}
      >
        <HelpCircle size={14} color="#5F5E5A" aria-hidden={true} />
      </span>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

function intelTooltipLargoLeftPx(mouseX: number, tooltipWidth: number): number {
  const off = 12
  if (typeof window === 'undefined') return mouseX + off
  return mouseX + off + tooltipWidth > window.innerWidth
    ? mouseX - tooltipWidth - off
    : mouseX + off
}

function TooltipHoverResumo({
  texto,
  maxWidth,
  children,
  wrapperLayout = 'default',
}: {
  texto: string
  maxWidth: number
  children: ReactNode
  /** `inlineRow` / `inlineColumn`: sem width:100%, para uso dentro de flex. */
  wrapperLayout?: 'default' | 'inlineColumn' | 'inlineRow'
}) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xyRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(false)

  const limpar = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      limpar()
    },
    [limpar],
  )

  const portal = visible ? (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: intelTooltipLargoLeftPx(pos.x, maxWidth),
        top: pos.y - 8,
        zIndex: 200,
        maxWidth,
        width: 'max-content',
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#D3D1C7',
        fontSize: 13,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {texto}
    </div>
  ) : null

  return (
    <>
      <div
        style={
          wrapperLayout === 'inlineColumn'
            ? {
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }
            : wrapperLayout === 'inlineRow'
              ? {
                  display: 'inline-flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'help',
                }
              : { display: 'block', width: '100%' }
        }
        onMouseEnter={(e) => {
          limpar()
          xyRef.current = { x: e.clientX, y: e.clientY }
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            setPos(xyRef.current)
            visibleRef.current = true
            setVisible(true)
          }, KPI_TOOLTIP_DELAY_MS)
        }}
        onMouseMove={(e) => {
          xyRef.current = { x: e.clientX, y: e.clientY }
          if (visibleRef.current) setPos({ x: e.clientX, y: e.clientY })
        }}
        onMouseLeave={() => {
          limpar()
          visibleRef.current = false
          setVisible(false)
        }}
      >
        {children}
      </div>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

/** Tooltip padrão Terrae, ancorado ao retângulo do elemento (acima/abaixo conforme espaço). */
function TooltipDemandaPill({
  texto,
  style,
  children,
  hoverBackground,
}: {
  texto: string
  style: CSSProperties
  children: ReactNode
  /** Fundo no hover (ex.: cor da série + sufixo hex de opacidade). */
  hoverBackground?: string
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpar = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      limpar()
    },
    [limpar],
  )

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const tip = tooltipRef.current
    if (!anchor || !tip) return
    const rect = anchor.getBoundingClientRect()
    const th = tip.offsetHeight
    const tw = tip.offsetWidth || INTEL_TOOLTIP_DEMANDA_LARGURA
    const margin = 8
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const preferBelow = spaceBelow >= th + margin || spaceBelow >= spaceAbove

    let top = preferBelow ? rect.bottom + margin : rect.top - th - margin
    if (top + th > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - th - margin)
    }
    if (top < margin) top = margin

    let left = rect.left + rect.width / 2 - tw / 2
    const pad = 8
    if (left < pad) left = pad
    if (left + tw > window.innerWidth - pad) {
      left = window.innerWidth - tw - pad
    }
    setCoords({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!visible) return
    updatePosition()
    const raf = requestAnimationFrame(() => {
      updatePosition()
    })
    return () => cancelAnimationFrame(raf)
  }, [visible, texto, updatePosition])

  useEffect(() => {
    if (!visible) return
    const handler = () => {
      updatePosition()
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [visible, updatePosition])

  const portal = visible && texto ? (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        left: coords.left,
        top: coords.top,
        zIndex: 200,
        maxWidth: INTEL_TOOLTIP_DEMANDA_LARGURA,
        width: 'max-content',
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#D3D1C7',
        fontSize: 13,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {texto}
    </div>
  ) : null

  const mergedStyle: CSSProperties = {
    ...style,
    ...(hover && hoverBackground ? { backgroundColor: hoverBackground } : {}),
  }

  return (
    <>
      <span
        ref={anchorRef}
        style={mergedStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          setHover(true)
          limpar()
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            setVisible(true)
          }, KPI_TOOLTIP_DELAY_MS)
        }}
        onMouseLeave={() => {
          setHover(false)
          limpar()
          setVisible(false)
        }}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && portal
        ? createPortal(portal, document.body)
        : null}
    </>
  )
}

function dataAlertaDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Primeiro item da lista: badge NOVO se a data está nos últimos 7 dias (relógio do cliente). */
function alertaPrimeiroItemMostraNovo(idx: number, dataIso: string): boolean {
  if (idx !== 0) return false
  const t = new Date(`${dataIso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return false
  const now = Date.now()
  if (t > now) return false
  return now - t <= 7 * 86400000
}

function CardUltimosAlertasLegislativos({
  alertas,
}: {
  alertas: readonly DashboardAlertaRecente[]
}) {
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)

  return (
    <div
      className="terrae-intel-hover-panel"
      style={{
        backgroundColor: '#1A1A18',
        borderRadius: 8,
        padding: 20,
        marginTop: 16,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 36,
          justifyContent: 'space-between',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '1.5px',
            color: '#FFFFFF',
          }}
        >
          ALERTAS REGULATÓRIOS
        </p>
        <button
          type="button"
          onClick={() => setTelaAtiva('radar')}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 14,
            color: '#EF9F27',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Ver todos no Radar →
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {alertas.map((a, idx) => {
          const relevanciaMeta = estiloBadgeRelevancia(
            a.nivel_impacto,
            a.tipo_impacto,
          )
          return (
          <li
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderBottom: idx < alertas.length - 1 ? '1px solid #2C2C2A' : undefined,
              paddingBottom: idx < alertas.length - 1 ? 12 : 0,
              marginBottom: idx < alertas.length - 1 ? 12 : 0,
            }}
          >
            <AlertaItemImpactoBar
              nivel={a.nivel_impacto}
              tipo_impacto={a.tipo_impacto}
            />
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
              <TooltipHoverResumo texto={a.ementa} maxWidth={INTEL_TOOLTIP_ALERTA_LARGURA}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    cursor: 'help',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      color: '#D3D1C7',
                      minWidth: 0,
                    }}
                  >
                    {a.titulo}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        color: relevanciaMeta.cor,
                        fontWeight: 400,
                      }}
                    >
                      {relevanciaMeta.label}
                    </span>
                    <span style={{ color: '#888780' }}>·</span>
                    <span style={{ color: '#888780' }}>{a.fonte_publicacao}</span>
                    <span style={{ color: '#888780' }}>·</span>
                    <span style={{ color: '#888780' }}>{dataAlertaDdMmYyyy(a.data)}</span>
                    {alertaPrimeiroItemMostraNovo(idx, a.data) ? (
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          color: '#EF9F27',
                          fontWeight: 400,
                        }}
                      >
                        NOVO
                      </span>
                    ) : null}
                  </div>
                </div>
              </TooltipHoverResumo>
            </div>
          </li>
          )
        })}
      </ul>
    </div>
  )
}

function IconBarrasRegimeVazio() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="14"
        width="4"
        height="7"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="10"
        y="10"
        width="4"
        height="11"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="16"
        y="6"
        width="4"
        height="15"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
    </svg>
  )
}

/** Mesmo pictograma de barras que os empty states internos, 48px para o empty consolidado. */
function IconBarrasEmptyConsolidado() {
  const c = '#5F5E5A'
  return (
    <svg width={48} height={48} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="14"
        width="4"
        height="7"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="10"
        y="10"
        width="4"
        height="11"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="16"
        y="6"
        width="4"
        height="15"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
    </svg>
  )
}

function IconMapaUfVazio() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4 3 6v13l5-2 6 2 5-2V4l-5 2-6-2Z"
        stroke={c}
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 4v13M14 6v13" stroke={c} strokeWidth="1.1" />
    </svg>
  )
}

function IconPodioRankingVazio() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M6 28h8v8H6zM16 22h8v14H16zM26 26h8v10H26z"
        stroke={c}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M20 8v14M16 12h8"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTabelaVazia() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3"
        width="15"
        height="14"
        rx="1"
        fill="none"
        stroke={c}
        strokeWidth="1.2"
      />
      <line x1="2.5" y1="7.5" x2="17.5" y2="7.5" stroke={c} strokeWidth="1" />
      <line x1="2.5" y1="11.5" x2="17.5" y2="11.5" stroke={c} strokeWidth="1" />
      <line x1="8" y1="3" x2="8" y2="17" stroke={c} strokeWidth="1" />
      <line x1="13" y1="3" x2="13" y2="17" stroke={c} strokeWidth="1" />
    </svg>
  )
}

/** Empty states dos cards de conteúdo (Inteligência): ícone 32px + mensagem. */
const INTEL_CARD_EMPTY_WRAP: CSSProperties = {
  minHeight: 120,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

const INTEL_CARD_EMPTY_MSG: CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: '#888780',
  textAlign: 'center',
  lineHeight: 1.4,
}

/** Mesma altura mínima nos cards Minerais + Ranking quando vazios, para alinhar ícone e texto. */
const INTEL_MINERAIS_RANKING_EMPTY_PANEL_MIN_PX = 280

const INTEL_CARD_EMPTY_BODY_GROW: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

type MonthPickerProps = {
  value: string | null
  onChange: (yyyyMm: string | null) => void
  /** Quando vazio: orientação de faixa (ex.: Jan/1987); cor #5F5E5A. */
  rangeHint: string
  /** YYYY-MM: ano/mês inicial do painel quando não há valor selecionado. */
  viewWhenEmptyYm: string
  variant: 'de' | 'ate'
  periodoMinYm: string
  otherBound: string | null
}

export function MonthPicker({
  value,
  onChange,
  rangeHint,
  viewWhenEmptyYm,
  variant,
  periodoMinYm,
  otherBound,
}: MonthPickerProps) {
  const [aberto, setAberto] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    const p = parseYyyyMm(value) ?? parseYyyyMm(viewWhenEmptyYm)
    return p?.y ?? new Date().getFullYear()
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  const now = new Date()
  const yNow = now.getFullYear()
  const mNow = now.getMonth() + 1
  const todayYm = yyyyMmFromParts(yNow, mNow)

  useLayoutEffect(() => {
    if (aberto) {
      const p = parseYyyyMm(value) ?? parseYyyyMm(viewWhenEmptyYm)
      setViewYear(p?.y ?? new Date().getFullYear())
    }
  }, [aberto, value, viewWhenEmptyYm])

  useLayoutEffect(() => {
    if (!aberto) {
      setRect(null)
      return
    }
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const panelW = 220
      let left = r.left
      if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8)
      setRect({
        top: r.bottom + 4,
        left,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto])

  const selecionarMes = (month1: number) => {
    const ym = yyyyMmFromParts(viewYear, month1)
    if (
      mesYmDesabilitadoNoMonthPicker(variant, ym, todayYm, periodoMinYm, otherBound)
    ) {
      return
    }
    onChange(ym)
    setAberto(false)
  }

  const esteMesDesabilitado = mesYmDesabilitadoNoMonthPicker(
    variant,
    todayYm,
    todayYm,
    periodoMinYm,
    otherBound,
  )

  const portal =
    aberto && rect ? (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: 220,
          boxSizing: 'border-box',
          backgroundColor: '#1A1A18',
          border: '1px solid #2C2C2A',
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 2147483647,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            aria-label="Ano anterior"
            onClick={() => setViewYear((y) => y - 1)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#888780',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            {'<'}
          </button>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#F1EFE8',
            }}
          >
            {viewYear}
          </span>
          <button
            type="button"
            aria-label="Próximo ano"
            onClick={() => setViewYear((y) => y + 1)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#888780',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            {'>'}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginBottom: 12,
          }}
        >
          {MESES_ABREV.map((abrev, i) => {
            const month1 = i + 1
            const yyyymm = yyyyMmFromParts(viewYear, month1)
            const sel = value === yyyymm
            const isHoje = viewYear === yNow && month1 === mNow
            const desabilitado = mesYmDesabilitadoNoMonthPicker(
              variant,
              yyyymm,
              todayYm,
              periodoMinYm,
              otherBound,
            )
            if (desabilitado) {
              return (
                <span
                  key={abrev}
                  style={{
                    fontSize: 13,
                    borderRadius: 6,
                    padding: '6px 8px',
                    textAlign: 'center',
                    border: '1px solid transparent',
                    backgroundColor: 'transparent',
                    color: '#5F5E5A',
                    fontWeight: 400,
                    cursor: 'not-allowed',
                    boxSizing: 'border-box',
                  }}
                >
                  {abrev}
                </span>
              )
            }
            return (
              <button
                key={abrev}
                type="button"
                onClick={() => selecionarMes(month1)}
                style={{
                  fontSize: 13,
                  borderRadius: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: sel
                    ? '1px solid #FFFFFF'
                    : isHoje
                      ? '1px solid #2C2C2A'
                      : '1px solid transparent',
                  backgroundColor: sel ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: sel ? '#FFFFFF' : '#888780',
                  fontWeight: sel ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!sel) {
                    e.currentTarget.style.backgroundColor = '#2C2C2A'
                    e.currentTarget.style.color = '#D3D1C7'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!sel) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#888780'
                  } else {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.color = '#FFFFFF'
                    e.currentTarget.style.border = '1px solid #FFFFFF'
                  }
                }}
              >
                {abrev}
              </button>
            )
          })}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #2C2C2A',
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setAberto(false)
            }}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#FFFFFF',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#FFFFFF'
            }}
          >
            Limpar
          </button>
          {esteMesDesabilitado ? (
            <span
              style={{
                fontSize: 12,
                color: '#5F5E5A',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              Este mês
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                onChange(yyyyMmFromParts(yNow, mNow))
                setAberto(false)
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#888780',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F1EFE8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888780'
              }}
            >
              Este mês
            </button>
          )}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="terrae-intel-border-interactive"
        onClick={() => setAberto((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#0D0D0C',
          border: '1px solid #2C2C2A',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 15,
          color: '#D3D1C7',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {value ? (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {formatYyyyMmBarra(value)}
          </span>
        ) : (
          <span
            style={{
              color: '#5F5E5A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {rangeHint}
          </span>
        )}
        <ChevronDown aberto={aberto} stroke="#D3D1C7" size={14} />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

type MineralEstrategicoMockRow = (typeof dashboardMock.minerais_estrategicos)[number]

export function InteligenciaDashboard({
  motionStaggerBaseMs = DEFAULT_INTEL_STAGGER_BASE_MS,
  reducedMotion = false,
}: {
  motionStaggerBaseMs?: number
  reducedMotion?: boolean
} = {}) {
  const gruposVis = useStaggeredEntrance(6, {
    baseDelayMs: motionStaggerBaseMs,
    staggerMs: MOTION_STAGGER_STEP_MS,
    reducedMotion,
  })
  const [g1, g2, g3, g4, g5, g6] = gruposVis
  const barsWidthReady = g2 && !reducedMotion
  const chartLineAnimActive = !reducedMotion && g3

  const { producao_historica } = dashboardMock

  const [filtros, setFiltros] = useState<FiltrosDashboard>({
    periodo: { inicio: null, fim: null },
    ufs: [],
    substancias: [],
    regime: null,
  })

  const [, startTransition] = useTransition()

  const updateFiltros = useCallback((patch: Partial<FiltrosDashboard> | ((f: FiltrosDashboard) => FiltrosDashboard)) => {
    startTransition(() => {
      setFiltros((prev) =>
        typeof patch === 'function' ? patch(prev) : { ...prev, ...patch },
      )
    })
  }, [startTransition])

  const limparFiltros = useCallback(() => {
    startTransition(() => {
      setFiltros({
        periodo: { inicio: null, fim: null },
        ufs: [],
        substancias: [],
        regime: null,
      })
    })
  }, [startTransition])

  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)

  const navigateProcessoMapa = useCallback(
    (id: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'processo',
        payload: id,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateEstadoMapa = useCallback(
    (uf: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'estado',
        payload: uf,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateRegimeMapa = useCallback(
    (regime: Regime) => {
      useMapStore.getState().setPendingNavigation({
        type: 'regime',
        payload: regime,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateTitularMapa = useCallback(
    (titular: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'titular',
        payload: titular,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateSubstanciaMapa = useCallback(
    (substanciaRaw: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'substancia',
        payload: substanciaRaw,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const temFiltroAtivo =
    filtros.ufs.length > 0 ||
    filtros.substancias.length > 0 ||
    filtros.regime !== null ||
    filtros.periodo.inicio !== null ||
    filtros.periodo.fim !== null

  const processosBase = useMemo(() => processosFiltratos(filtros), [filtros])
  const filtrosSemProcessos = processosBase.length === 0

  const mineraisEstrategicosDoFiltro = useMemo((): Array<
    MineralEstrategicoMockRow & { processos: number }
  > => {
    const estrategicos = processosBase.filter((p) => p.is_mineral_estrategico)
    if (estrategicos.length === 0) return []

    const mockByNormal = new Map<string, MineralEstrategicoMockRow>()
    for (const m of dashboardMock.minerais_estrategicos) {
      mockByNormal.set(normalizarSubstanciaChave(m.substancia), m)
    }

    const groups = new Map<string, { mock: MineralEstrategicoMockRow; count: number }>()
    for (const p of estrategicos) {
      const mock = mockByNormal.get(normalizarSubstanciaChave(p.substancia))
      if (!mock) continue
      const prev = groups.get(mock.sigla)
      if (prev) prev.count += 1
      else groups.set(mock.sigla, { mock, count: 1 })
    }

    return [...groups.values()]
      .map(({ mock, count }) => ({ ...mock, processos: count }))
      .sort((a, b) => {
        const gapA = a.reservas_pct - a.producao_pct
        const gapB = b.reservas_pct - b.producao_pct
        if (gapB !== gapA) return gapB - gapA
        return b.preco_usd_t - a.preco_usd_t
      })
  }, [processosBase])

  const processosParaRegime = useMemo(
    () => processosFiltratos(filtros, { skipRegime: true }),
    [filtros],
  )

  const processosParaUf = useMemo(
    () => processosFiltratos(filtros, { skipUfs: true }),
    [filtros],
  )

  const [titularSelecionado, setTitularSelecionado] = useState<string | null>(null)
  const [hoverUfProcessosEstado, setHoverUfProcessosEstado] = useState<string | null>(
    null,
  )
  const [subAtivas, setSubAtivas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SUB_KEYS.map((s) => [s.key, true])),
  )

  useEffect(() => {
    if (filtrosSemProcessos) setHoverUfProcessosEstado(null)
  }, [filtrosSemProcessos])

  useEffect(() => {
    if (filtros.substancias.length === 0) {
      setSubAtivas(Object.fromEntries(SUB_KEYS.map((s) => [s.key, true])))
      return
    }
    const allowed = chavesGraficoParaSubstancias(filtros.substancias)
    setSubAtivas((prev) => {
      const next = { ...prev }
      for (const s of SUB_KEYS) {
        next[s.key] = allowed.has(s.key)
      }
      return next
    })
  }, [filtros.substancias])

  const chartData = useMemo(() => {
    const base = producao_historica[0]!
    return producao_historica.map((row) => ({
      ano: row.ano,
      ferro: base.ferro ? (row.ferro / base.ferro) * 100 : 0,
      cobre: base.cobre ? (row.cobre / base.cobre) * 100 : 0,
      ouro: base.ouro ? (row.ouro / base.ouro) * 100 : 0,
      niobio: base.niobio ? (row.niobio / base.niobio) * 100 : 0,
      /** Base simbólica 8 em 2019 (produção mínima visível); 2020/2021 proporcionais (~12, ~25). */
      terras_raras:
        base.terras_raras > 0
          ? (row.terras_raras * 8) / base.terras_raras
          : row.terras_raras > 0
            ? 100
            : 0,
    }))
  }, [producao_historica])

  const porRegimeCalculado = useMemo(() => {
    const map = new Map<Regime, { count: number; area_ha: number }>()
    for (const r of REGIMES_ORDEM) {
      map.set(r, { count: 0, area_ha: 0 })
    }
    for (const p of processosParaRegime) {
      const cur = map.get(p.regime)!
      cur.count += 1
      cur.area_ha += p.area_ha
    }
    const maxC = Math.max(1, ...[...map.values()].map((v) => v.count))
    return REGIMES_ORDEM.map((regime) => {
      const v = map.get(regime)!
      return {
        regime,
        label: REGIME_LABELS[regime],
        count: v.count,
        area_ha: v.area_ha,
        cor: REGIME_COLORS[regime],
        pct: (v.count / maxC) * 100,
      }
    })
  }, [processosParaRegime])

  const porUfCalculado = useMemo(() => {
    return UFS_INTEL_DASHBOARD.map((uf) => {
      const list = processosParaUf.filter((p) => p.uf === uf)
      const count = list.length
      const withRisk = list.filter((p) => p.risk_score !== null)
      const risk_medio =
        count > 0 && withRisk.length > 0
          ? Math.round(
              withRisk.reduce((s, p) => s + (p.risk_score as number), 0) / withRisk.length,
            )
          : null
      return { uf, count, risk_medio, scoredCount: withRisk.length }
    })
  }, [processosParaUf])

  const maxUfCount = useMemo(
    () => Math.max(1, ...porUfCalculado.map((u) => u.count)),
    [porUfCalculado],
  )

  const totalProcessosCarteiraUf = useMemo(
    () => processosParaUf.length,
    [processosParaUf],
  )

  const substanciasUnicasMock = useMemo(() => {
    const s = new Set<string>()
    for (const p of PROCESSOS_MOCK) s.add(p.substancia)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [])

  const rankingOrdenado = useMemo(() => {
    const map = new Map<
      string,
      { titular: string; processos: number; area_ha: number; substancias: Set<string>; risks: number[] }
    >()
    for (const p of processosBase) {
      let row = map.get(p.titular)
      if (!row) {
        row = {
          titular: p.titular,
          processos: 0,
          area_ha: 0,
          substancias: new Set(),
          risks: [],
        }
        map.set(p.titular, row)
      }
      row.processos += 1
      row.area_ha += p.area_ha
      row.substancias.add(p.substancia)
      if (p.risk_score !== null) row.risks.push(p.risk_score)
    }
    const rows = [...map.values()].map((r) => ({
      titular: r.titular,
      processos: r.processos,
      area_ha: r.area_ha,
      substancias: [...r.substancias].slice(0, 4),
      risk_medio:
        r.risks.length > 0
          ? Math.round(r.risks.reduce((a, b) => a + b, 0) / r.risks.length)
          : null,
    }))
    return rows
  }, [processosBase])

  const [rankPorArea, setRankPorArea] = useState(true)

  const rankingDisplay = useMemo(() => {
    const rows = [...rankingOrdenado]
    rows.sort((a, b) =>
      rankPorArea ? b.area_ha - a.area_ha : b.processos - a.processos,
    )
    return rows
  }, [rankingOrdenado, rankPorArea])

  const rankingConcentracaoTop3Pct = useMemo(() => {
    if (rankingDisplay.length === 0) return null
    const slice = rankingDisplay.slice(0, Math.min(3, rankingDisplay.length))
    if (rankPorArea) {
      const total = rankingDisplay.reduce((s, r) => s + r.area_ha, 0)
      if (total <= 0) return null
      const top = slice.reduce((s, r) => s + r.area_ha, 0)
      return Math.round((top / total) * 100)
    }
    const total = rankingDisplay.reduce((s, r) => s + r.processos, 0)
    if (total <= 0) return null
    const top = slice.reduce((s, r) => s + r.processos, 0)
    return Math.round((top / total) * 100)
  }, [rankingDisplay, rankPorArea])

  const kpiMemo = useMemo(() => {
    const list = processosBase
    const n = list.length
    const ativos = list.filter((p) => p.situacao === 'ativo').length
    const bloqueados = list.filter((p) => p.situacao === 'bloqueado').length
    const somaArea = list.reduce((s, p) => s + p.area_ha, 0)
    const scores = list.map((p) => p.risk_score).filter((x): x is number => x !== null)
    const riskMedio =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null
    const alto = list.filter((p) => p.risk_score !== null && p.risk_score >= 70).length
    const baixo = list.filter((p) => p.risk_score !== null && p.risk_score < 40).length
    const medio = list.filter(
      (p) => p.risk_score !== null && p.risk_score >= 40 && p.risk_score < 70,
    ).length
    const chavesEstrategicas = new Set<ChaveMineralEstrategico>()
    for (const p of list) {
      const ch = substanciaParaChaveEstrategica(p.substancia)
      if (ch) chavesEstrategicas.add(ch)
    }
    const mineraisEstrategicosOrdenados = ORDEM_MINERAL_ESTRATEGICO.filter((k) =>
      chavesEstrategicas.has(k),
    )
    const mineraisEstrategicosCount = mineraisEstrategicosOrdenados.length
    const mineraisEstrategicosSub = mineraisEstrategicosCount
      ? mineraisEstrategicosOrdenados
          .map((k) => LABEL_MINERAL_ESTRATEGICO[k])
          .join(' · ')
      : 'Nenhum nos filtros atuais'

    const processosRiscoAlto = list.filter(
      (p) => p.risk_score !== null && p.risk_score >= 70,
    ).length
    const pctRiscoAltoCarteira =
      n > 0 ? Math.round((processosRiscoAlto / n) * 100) : 0
    const subRiscoAlto =
      n > 0 ? `${pctRiscoAltoCarteira}% da carteira` : '0% da carteira'

    const somaValorMi = list.reduce((s, p) => s + p.valor_estimado_usd_mi, 0)
    return {
      n,
      ativos,
      bloqueados,
      somaArea,
      riskMedio,
      alto,
      baixo,
      medio,
      mineraisEstrategicosCount,
      mineraisEstrategicosSub,
      processosRiscoAlto,
      subRiscoAlto,
      somaValorMi,
    }
  }, [processosBase])

  const [busca, setBusca] = useState('')
  const [buscaFocada, setBuscaFocada] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 10

  const [ufOpen, setUfOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)

  const processosParaTabela = useMemo(() => {
    let rows = processosBase
    if (titularSelecionado) {
      rows = rows.filter((p) => p.titular === titularSelecionado)
    }
    return rows
  }, [processosBase, titularSelecionado])

  const processosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let rows = [...processosParaTabela]
    if (q) {
      rows = rows.filter(
        (p) =>
          p.numero.toLowerCase().includes(q) ||
          p.titular.toLowerCase().includes(q) ||
          p.substancia.toLowerCase().includes(q),
      )
    }
    if (sortCol) {
      const dir = sortAsc ? 1 : -1
      rows.sort((a, b) => {
        if (sortCol === 'area') return (a.area_ha - b.area_ha) * dir
        if (sortCol === 'risk') {
          const ar = a.risk_score ?? -1
          const br = b.risk_score ?? -1
          return (ar - br) * dir
        }
        return (FASE_ORDER.indexOf(a.fase) - FASE_ORDER.indexOf(b.fase)) * dir
      })
    }
    return rows
  }, [busca, sortCol, sortAsc, processosParaTabela])

  const totalFiltrados = processosFiltrados.length
  const maxPage = Math.max(0, Math.ceil(totalFiltrados / pageSize) - 1)

  useEffect(() => {
    setPage((p) => Math.min(p, maxPage))
  }, [maxPage])

  const pageSafe = Math.min(page, maxPage)
  const sliceStart = pageSafe * pageSize
  const sliceEnd = Math.min(sliceStart + pageSize, totalFiltrados)
  const linhasPagina = processosFiltrados.slice(sliceStart, sliceEnd)

  const indicadoresPagina = useMemo(
    () => indicadoresNumericosPagina(pageSafe, maxPage),
    [pageSafe, maxPage],
  )

  const toggleSort = (c: SortCol) => {
    if (sortCol === c) setSortAsc((s) => !s)
    else {
      setSortCol(c)
      setSortAsc(true)
    }
    setPage(0)
  }

  const exportarCsv = useCallback(() => {
    const sep = ';'
    const header = [
      'Processo',
      'Regime',
      'Substância',
      'Titular',
      'UF',
      'Área (ha)',
      'Fase',
      'Último despacho',
      'Risk Score',
      'Situação',
    ]
    const linhas = processosFiltrados.map((p) =>
      [
        p.numero,
        REGIME_LABELS[p.regime],
        p.substancia,
        p.titular.replaceAll(sep, ','),
        p.uf,
        String(p.area_ha).replace('.', ','),
        FASE_LABELS[p.fase],
        p.ultimo_despacho_data,
        p.risk_score === null ? '' : String(p.risk_score),
        situacaoLabel(p.situacao),
      ].join(sep),
    )
    const body = [header.join(sep), ...linhas].join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `terrae_processos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [processosFiltrados])

  const onRowClick = (p: Processo) => {
    navigateProcessoMapa(p.id)
  }

  const hoje = new Date().toLocaleDateString('pt-BR')

  const ufsUnicasFiltrados = useMemo(() => {
    const s = new Set(processosBase.map((p) => p.uf))
    return s.size
  }, [processosBase])

  const periodoDisponivelYm = useMemo(() => {
    let min = '9999-12'
    for (const p of PROCESSOS_MOCK) {
      const ym = p.data_protocolo.slice(0, 7)
      if (ym.localeCompare(min) < 0) min = ym
    }
    return { min }
  }, [])

  const periodoAtePlaceholderYm = yyyyMmMesAtualSistema()

  const textoBadgeResumoHeader = useMemo(() => {
    const n = processosBase.length
    if (!temFiltroAtivo) return ''
    if (n === 0) return 'Nenhum resultado · Filtrado'
    return `${n} de ${PROCESSOS_MOCK.length} processos · ${ufsUnicasFiltrados} estados`
  }, [processosBase.length, ufsUnicasFiltrados, temFiltroAtivo])

  const pillsAtivos = useMemo(() => {
    type PillAtiva = { key: string; text: string; onRemove: () => void }
    if (!temFiltroAtivo) return [] as PillAtiva[]
    const out: PillAtiva[] = []
    for (const uf of [...filtros.ufs].sort((a, b) => a.localeCompare(b))) {
      out.push({
        key: `uf-${uf}`,
        text: uf,
        onRemove: () =>
          updateFiltros((f) => ({ ...f, ufs: f.ufs.filter((u) => u !== uf) })),
      })
    }
    for (const sub of [...filtros.substancias].sort((a, b) => a.localeCompare(b))) {
      const texto = sub.slice(0, 10)
      out.push({
        key: `sub-${sub}`,
        text: texto,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            substancias: f.substancias.filter((s) => s !== sub),
          })),
      })
    }
    if (filtros.regime) {
      const regime = filtros.regime
      out.push({
        key: 'regime',
        text: REGIME_LABELS[regime as Regime],
        onRemove: () => updateFiltros({ regime: null }),
      })
    }
    const { inicio, fim } = filtros.periodo
    if (inicio && fim) {
      out.push({
        key: 'periodo-inicio',
        text: `A partir de ${formatYyyyMmBarra(inicio)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, inicio: null },
          })),
      })
      out.push({
        key: 'periodo-fim',
        text: `Até ${formatYyyyMmBarra(fim)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, fim: null },
          })),
      })
    } else if (inicio) {
      out.push({
        key: 'periodo-inicio',
        text: `A partir de ${formatYyyyMmBarra(inicio)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, inicio: null },
          })),
      })
    } else if (fim) {
      out.push({
        key: 'periodo-fim',
        text: `Até ${formatYyyyMmBarra(fim)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, fim: null },
          })),
      })
    }
    return out
  }, [filtros, temFiltroAtivo, updateFiltros])

  const textoEmptyConsolidado = useMemo(() => {
    const temPeriodo =
      filtros.periodo.inicio !== null || filtros.periodo.fim !== null
    const temUfSubReg =
      filtros.ufs.length > 0 ||
      filtros.substancias.length > 0 ||
      filtros.regime !== null
    if (temUfSubReg) {
      return 'Tente remover alguns filtros ou ajustar a combinação.'
    }
    if (temPeriodo) {
      return 'O período selecionado não contém processos. Tente ampliar o intervalo.'
    }
    return 'Ajuste os filtros acima para visualizar os dados.'
  }, [filtros])

  return (
    <div
      className="terrae-intel-dashboard-scroll box-border h-full min-h-0 flex-1"
      style={{
        backgroundColor: '#0D0D0C',
        padding: 24,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <div style={motionGroupStyle(g1, reducedMotion)}>
      <header style={{ marginBottom: 0 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              color: '#F1EFE8',
            }}
          >
            Inteligência Mineral
          </h1>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: 16,
              color: '#888780',
            }}
          >
            Visão consolidada dos processos minerários monitorados
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
            paddingBottom: 16,
            borderBottom: '1px solid #2C2C2A',
          }}
        >
          <MonthPicker
            value={filtros.periodo.inicio}
            rangeHint={formatYyyyMmBarra(periodoDisponivelYm.min)}
            viewWhenEmptyYm={periodoDisponivelYm.min}
            variant="de"
            periodoMinYm={periodoDisponivelYm.min}
            otherBound={filtros.periodo.fim}
            onChange={(inicio) =>
              updateFiltros({
                periodo: {
                  ...filtros.periodo,
                  inicio,
                },
              })
            }
          />
          <MonthPicker
            value={filtros.periodo.fim}
            rangeHint={formatYyyyMmBarra(periodoAtePlaceholderYm)}
            viewWhenEmptyYm={periodoAtePlaceholderYm}
            variant="ate"
            periodoMinYm={periodoDisponivelYm.min}
            otherBound={filtros.periodo.inicio}
            onChange={(fim) =>
              updateFiltros({
                periodo: {
                  ...filtros.periodo,
                  fim,
                },
              })
            }
          />

          <div
            style={{
              width: 1,
              height: 26,
              backgroundColor: '#2C2C2A',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          <MultiSelectDropdown
            prefix="UF"
            options={UFS_INTEL_DASHBOARD}
            selected={filtros.ufs}
            onChange={(ufs) => updateFiltros({ ufs })}
            aberto={ufOpen}
            setAberto={setUfOpen}
          />

          <MultiSelectDropdown
            prefix="Substância"
            options={substanciasUnicasMock}
            selected={filtros.substancias}
            onChange={(substancias) => updateFiltros({ substancias })}
            aberto={subOpen}
            setAberto={setSubOpen}
          />

          {temFiltroAtivo ? (
            <div
              style={{
                width: 1,
                height: 26,
                backgroundColor: '#2C2C2A',
                margin: '0 4px',
                flexShrink: 0,
              }}
            />
          ) : null}

          <button
            type="button"
            onClick={limparFiltros}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 15,
              color: temFiltroAtivo ? '#F1B85A' : '#888780',
              cursor: temFiltroAtivo ? 'pointer' : 'default',
              opacity: temFiltroAtivo ? 1 : 0,
              pointerEvents: temFiltroAtivo ? 'auto' : 'none',
              transition: 'opacity 0.2s ease-out, color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (temFiltroAtivo) e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              if (temFiltroAtivo) e.currentTarget.style.color = '#F1B85A'
            }}
          >
            Limpar tudo
          </button>

          {temFiltroAtivo ? (
            <span
              className="terrae-intel-stat-badge"
              style={{
                marginLeft: 'auto',
                fontSize: 16,
                color: '#D3D1C7',
                border: '1px solid #2C2C2A',
                borderRadius: 6,
                padding: '10px 16px',
                transition: 'all 0.2s ease-out',
              }}
            >
              {textoBadgeResumoHeader}
            </span>
          ) : null}
        </div>
      </header>

      <div
        style={{
          marginBottom: temFiltroAtivo ? 12 : 0,
          marginTop: temFiltroAtivo ? 12 : 0,
          minHeight: temFiltroAtivo ? undefined : 0,
          maxHeight: temFiltroAtivo ? undefined : 0,
          overflow: temFiltroAtivo ? 'visible' : 'hidden',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {pillsAtivos.map((pill) => (
          <span
            key={pill.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 14,
              color: '#D3D1C7',
              backgroundColor: '#2C2C2A',
              border: '1px solid #3D3D3A',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            {pill.text}
            <button
              type="button"
              aria-label="Remover filtro"
              onClick={pill.onRemove}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F1EFE8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888780'
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: '#888780',
                fontSize: 14,
                lineHeight: 1,
                transition: 'color 0.2s ease',
              }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

        {/* KPIs */}
        <IntelKpiPortalTooltipProvider>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 12,
              marginTop: 16,
              alignItems: 'stretch',
            }}
          >
            <IntelKpiTooltip titulo="Processos monitorados" corpo={INTEL_KPI_TOOLTIP_CORPO_PROCESSOS}>
              <KpiCard
                valor={String(kpiMemo.n)}
                valorColor="#F1EFE8"
                label="Processos monitorados"
                sub={`${kpiMemo.ativos} ativos · ${kpiMemo.bloqueados} bloqueados`}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip titulo="Hectares mapeados" corpo={INTEL_KPI_TOOLTIP_CORPO_HECTARES}>
              <KpiCard
                valor={kpiMemo.somaArea.toLocaleString('pt-BR')}
                valorColor="#EF9F27"
                label="Hectares mapeados"
                sub={`≈ ${(kpiMemo.somaArea / 100).toFixed(0)} km²`}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip titulo="Risco médio da carteira" corpo={INTEL_KPI_TOOLTIP_CORPO_RISCO}>
              <KpiCard
                valor={kpiMemo.riskMedio === null ? 'N/D' : String(kpiMemo.riskMedio)}
                valorColor={
                  kpiMemo.riskMedio === null
                    ? '#5F5E5A'
                    : corRisk(kpiMemo.riskMedio)
                }
                label="Risco médio da carteira"
                sub={
                  <>
                    <span style={{ color: '#1D9E75' }}>{kpiMemo.baixo} baixo</span>
                    <span style={{ color: '#5F5E5A' }}> · </span>
                    <span style={{ color: '#E8A830' }}>{kpiMemo.medio} médio</span>
                    <span style={{ color: '#5F5E5A' }}> · </span>
                    <span style={{ color: '#E24B4A' }}>{kpiMemo.alto} alto</span>
                  </>
                }
                subFontSize={15}
                footer={
                  kpiMemo.riskMedio !== null && !filtrosSemProcessos ? (
                    <KpiRiskFaixaBarra valor={kpiMemo.riskMedio} />
                  ) : null
                }
                emptyFiltros={filtrosSemProcessos}
                infoTexto={INTEL_INFO_TEXTO_RISCO_KPI}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip
              titulo="Minerais estratégicos"
              corpo={INTEL_KPI_TOOLTIP_CORPO_MINERAIS_ESTRATEGICOS}
            >
              <KpiCard
                valor={String(kpiMemo.mineraisEstrategicosCount)}
                valorColor="#3D8B7A"
                label="Minerais estratégicos"
                sub={kpiMemo.mineraisEstrategicosSub}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip
              titulo="Processos em risco alto"
              corpo={INTEL_KPI_TOOLTIP_CORPO_PROCESSOS_RISCO_ALTO}
            >
              <KpiCard
                valor={String(kpiMemo.processosRiscoAlto)}
                valorColor="#E24B4A"
                label="Processos em risco alto"
                sub={kpiMemo.subRiscoAlto}
                subFontSize={15}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip
              titulo="Valor potencial estimado"
              corpo={INTEL_KPI_TOOLTIP_CORPO_VALOR_POTENCIAL}
            >
              <KpiCard
                valor={formatValorPotencialKpi(kpiMemo.somaValorMi)}
                valorColor="#EF9F27"
                label="Valor potencial estimado"
                labelFontSize={14}
                labelColor="#FFFFFF"
                sub="Reservas mapeadas (USGS)"
                subFontSize={15}
                emptyFiltros={filtrosSemProcessos}
                infoTexto={INTEL_KPI_TOOLTIP_CORPO_VALOR_POTENCIAL}
              />
            </IntelKpiTooltip>
          </div>
        </IntelKpiPortalTooltipProvider>

        {filtrosSemProcessos ? (
          <div
            style={{
              boxSizing: 'border-box',
              width: '100%',
              marginTop: 16,
              padding: '80px 24px',
              backgroundColor: '#1A1A18',
              borderRadius: 12,
              border: '1px solid #2C2C2A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <IconBarrasEmptyConsolidado />
            <div style={{ height: 20 }} aria-hidden />
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 500,
                color: '#D3D1C7',
              }}
            >
              Nenhum processo encontrado para os filtros selecionados
            </p>
            <div style={{ height: 8 }} aria-hidden />
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: '#888780',
                maxWidth: 420,
              }}
            >
              {textoEmptyConsolidado}
            </p>
            <div style={{ height: 24 }} aria-hidden />
            <button
              type="button"
              onClick={limparFiltros}
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#5F5E5A',
                borderRadius: 6,
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 500,
                color: '#F1B85A',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#888780'
                e.currentTarget.style.color = '#F1EFE8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#5F5E5A'
                e.currentTarget.style.color = '#F1B85A'
              }}
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : null}
      </div>

        {!filtrosSemProcessos ? (
        <div style={motionGroupStyle(g2, reducedMotion)}>
        <IntelLinhaPortalTooltipProvider>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginTop: 16,
            }}
          >
          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div
              style={
                filtrosSemProcessos
                  ? { marginBottom: 32 }
                  : {
                      display: 'grid',
                      gridTemplateColumns: 'minmax(112px, 1fr) minmax(72px, 2.5fr) auto',
                      columnGap: 8,
                      alignItems: 'center',
                      marginBottom: 32,
                    }
              }
            >
              <div
                style={{
                  ...(filtrosSemProcessos ? {} : { gridColumn: '1 / 3' }),
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#FFFFFF',
                  }}
                >
                  Distribuição por regime
                </p>
              </div>
              {!filtrosSemProcessos ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    flexShrink: 0,
                    color: '#5F5E5A',
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      width: 72,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Processos
                  </span>
                  <span
                    style={{
                      width: 96,
                      textAlign: 'center',
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Hectares
                  </span>
                </div>
              ) : null}
            </div>
            <div style={{ transition: 'opacity 0.2s ease' }}>
              {filtrosSemProcessos ? (
                <div style={INTEL_CARD_EMPTY_WRAP}>
                  <IconBarrasRegimeVazio />
                  <span style={INTEL_CARD_EMPTY_MSG}>Nenhum processo encontrado</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {porRegimeCalculado.map((r, ri) => {
                    const selecionado = filtros.regime === r.regime
                    const outroSelecionado = filtros.regime !== null && !selecionado
                    const op = outroSelecionado ? 0.35 : 1
                    const tooltipRegime = `${textoQuantidadeProcessos(r.count)} de ${r.label} totalizando ${r.area_ha.toLocaleString('pt-BR')} ha de área mapeada.`
                    return (
                      <IntelLinhaTooltip key={r.regime} lineId={`reg:${r.regime}`} texto={tooltipRegime}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => navigateRegimeMapa(r.regime)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigateRegimeMapa(r.regime)
                            }
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(112px, 1fr) minmax(72px, 2.5fr) auto',
                            columnGap: 8,
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: '#D3D1C7',
                              opacity: op,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            {r.label}
                          </span>
                          <div
                            style={{
                              minWidth: 0,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: '#2C2C2A',
                              overflow: 'hidden',
                              opacity: op,
                              filter: 'brightness(1)',
                              borderLeft: selecionado ? `3px solid ${r.cor}` : undefined,
                              boxSizing: 'border-box',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = 'brightness(1.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = 'brightness(1)'
                            }}
                          >
                            <div
                              style={barFillStyle(
                                r.pct,
                                barsWidthReady,
                                ri,
                                reducedMotion,
                                r.cor,
                              )}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 20,
                              flexShrink: 0,
                              fontSize: 14,
                            }}
                          >
                            <span
                              style={{
                                width: 72,
                                textAlign: 'center',
                                color: '#D3D1C7',
                                fontWeight: 500,
                                opacity: op,
                              }}
                            >
                              {r.count}
                            </span>
                            <span
                              style={{
                                width: 96,
                                textAlign: 'center',
                                color: '#888780',
                                opacity: op,
                              }}
                            >
                              {r.area_ha.toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </IntelLinhaTooltip>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div style={{ transition: 'opacity 0.2s ease' }}>
              {filtrosSemProcessos ? (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        color: '#FFFFFF',
                      }}
                    >
                      PROCESSOS POR ESTADO
                    </p>
                  </div>
                  <div style={INTEL_CARD_EMPTY_WRAP}>
                    <IconMapaUfVazio />
                    <span style={INTEL_CARD_EMPTY_MSG}>Nenhum estado com processos</span>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    gap: 0,
                  }}
                >
                  <div
                    style={{
                      flex: '0 0 65%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      paddingRight: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 32,
                        flexShrink: 0,
                      }}
                    >
                      <p
                        style={{
                          flexShrink: 0,
                          margin: 0,
                          fontSize: 13,
                          textTransform: 'uppercase',
                          letterSpacing: '1.5px',
                          color: '#FFFFFF',
                          textAlign: 'left',
                        }}
                      >
                        PROCESSOS POR ESTADO
                      </p>
                      <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 20,
                          flexShrink: 0,
                          color: '#5F5E5A',
                          fontSize: 14,
                        }}
                      >
                        <span
                          style={{
                            width: 72,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Processos
                        </span>
                        <span
                          style={{
                            width: 80,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Risco médio
                        </span>
                      </div>
                    </div>
                    <div
                      className="terrae-uf-scroll"
                      style={{ maxHeight: 280, minHeight: 0 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                      {porUfCalculado.map((u, ui) => {
                        const pct = (u.count / maxUfCount) * 100
                        const barCor =
                          u.count === 0
                            ? '#2C2C2A'
                            : u.risk_medio === null
                              ? '#5F5E5A'
                              : corBarraUf(u.risk_medio)
                        const sel = filtros.ufs.includes(u.uf)
                        const algumUf = filtros.ufs.length > 0
                        const linhaHoverMapa = hoverUfProcessosEstado === u.uf
                        const yRisk =
                          u.risk_medio === null ? 'N/D' : String(u.risk_medio)
                        const tooltipUf = `${textoQuantidadeProcessos(u.count)} em ${u.uf}. Risk Score médio: ${yRisk} (${textoBaseadoEmScoresCalculados(u.scoredCount)}).`
                        return (
                          <IntelLinhaTooltip
                            key={u.uf}
                            lineId={`uf:${u.uf}`}
                            texto={tooltipUf}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (u.count <= 0) return
                                navigateEstadoMapa(u.uf)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  if (u.count <= 0) return
                                  navigateEstadoMapa(u.uf)
                                }
                              }}
                              onMouseEnter={() => {
                                if (u.count > 0) setHoverUfProcessosEstado(u.uf)
                              }}
                              onMouseLeave={() =>
                                setHoverUfProcessosEstado((h) =>
                                  h === u.uf ? null : h,
                                )
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                opacity:
                                  linhaHoverMapa ? 1 : algumUf && !sel ? 0.4 : 1,
                                filter: linhaHoverMapa
                                  ? 'brightness(1.12)'
                                  : undefined,
                                transition:
                                  'opacity 0.15s ease, filter 0.15s ease',
                              }}
                            >
                          <span
                            style={{
                              width: 32,
                              flexShrink: 0,
                              fontSize: 13,
                              fontWeight: 500,
                              color: sel ? '#EF9F27' : '#D3D1C7',
                            }}
                          >
                            {u.uf}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: '#2C2C2A',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={barFillStyle(
                                pct,
                                barsWidthReady,
                                ui,
                                reducedMotion,
                                barCor,
                              )}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 20,
                              flexShrink: 0,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                width: 72,
                                textAlign: 'center',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ color: '#D3D1C7' }}>{u.count}</span>
                              {totalProcessosCarteiraUf > 0 ? (
                                <span style={{ color: '#888780' }}>
                                  {' '}
                                  (
                                  {Math.round(
                                    (u.count / totalProcessosCarteiraUf) * 100,
                                  )}
                                  %)
                                </span>
                              ) : null}
                            </span>
                            <div
                              style={{
                                width: 80,
                                textAlign: 'center',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {u.risk_medio !== null ? (
                                <span
                                  style={{
                                    fontSize: 13,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    backgroundColor: `${corRisk(u.risk_medio)}26`,
                                    color: corRisk(u.risk_medio),
                                    fontWeight: 500,
                                    display: 'inline-block',
                                    boxSizing: 'border-box',
                                    textAlign: 'center',
                                    width: 52,
                                  }}
                                >
                                  {u.risk_medio}
                                </span>
                              ) : (
                                <span style={{ color: '#5F5E5A' }}>N/D</span>
                              )}
                            </div>
                          </div>
                            </div>
                          </IntelLinhaTooltip>
                        )
                      })}
                      </div>
                    </div>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      backgroundColor: '#2C2C2A',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingLeft: 16,
                      overflow: 'hidden',
                    }}
                  >
                    <BrasilMiniMap
                      ufsResumo={porUfCalculado}
                      ufsFiltro={filtros.ufs}
                      highlightedUf={hoverUfProcessosEstado}
                      onHoverUfChange={setHoverUfProcessosEstado}
                      maxHeightPx={220}
                      onNavigateUfToMap={(uf) => navigateEstadoMapa(uf)}
                      onToggleUf={(uf) => {
                        updateFiltros((prev) => {
                          const has = prev.ufs.includes(uf)
                          return {
                            ...prev,
                            ufs: has
                              ? prev.ufs.filter((x) => x !== uf)
                              : [...prev.ufs, uf],
                          }
                        })
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </IntelLinhaPortalTooltipProvider>
        </div>
        ) : null}

        <div style={motionGroupStyle(g3, reducedMotion)}>
        {/* Produção */}
        <div
          className="terrae-intel-hover-panel"
          style={{
            backgroundColor: '#1A1A18',
            borderRadius: 8,
            padding: 20,
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#FFFFFF',
                  minWidth: 0,
                }}
              >
                Produção histórica por substância
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              {SUB_KEYS.map((s) => {
                const on = subAtivas[s.key]
                const lockedByFilter = filtros.substancias.length > 0
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      if (lockedByFilter) {
                        const allowed = chavesGraficoParaSubstancias(filtros.substancias)
                        if (!allowed.has(s.key)) return
                      }
                      setSubAtivas((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                    }}
                    className={on ? undefined : 'terrae-intel-chart-pill-inactive'}
                    style={{
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor:
                        lockedByFilter &&
                        !chavesGraficoParaSubstancias(filtros.substancias).has(s.key)
                          ? 'default'
                          : 'pointer',
                      opacity:
                        lockedByFilter &&
                        !chavesGraficoParaSubstancias(filtros.substancias).has(s.key)
                          ? 0.4
                          : 1,
                      border: on ? `1px solid ${s.color}` : '1px solid #2C2C2A',
                      backgroundColor: on ? `${s.color}26` : '#2C2C2A',
                      color: on ? s.color : '#5F5E5A',
                    }}
                  >
                    {textoBadgeSubstanciaExibicao(s.label)}
                  </button>
                )
              })}
            </div>
          </div>
          <p style={{ margin: '0 0 32px 0', fontSize: 16, color: '#888780' }}>
            Variação da produção desde 2019
          </p>
          <div
            style={{
              width: '100%',
              minWidth: 0,
              height: 240,
              minHeight: 240,
              position: 'relative',
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 800, height: 240 }}
            >
              <LineChart
                key={reducedMotion ? 'still' : g3 ? 'draw' : 'pre'}
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="#2C2C2A"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="ano"
                  tick={{ fill: '#888780', fontSize: 13 }}
                  axisLine={{ stroke: '#2C2C2A' }}
                  tickLine={{ stroke: '#2C2C2A' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  padding={{ top: 0, bottom: 10 }}
                  tick={{ fill: '#888780', fontSize: 13 }}
                  axisLine={{ stroke: '#2C2C2A' }}
                  tickLine={{ stroke: '#2C2C2A' }}
                />
                <Tooltip
                  cursor={{ stroke: '#5F5E5A', strokeDasharray: '4 4' }}
                  content={(props) => (
                    <ProducaoTooltip
                      active={props.active}
                      label={props.label}
                      payload={props.payload}
                      subAtivas={subAtivas}
                    />
                  )}
                />
                {SUB_KEYS.map(
                  (s) =>
                    subAtivas[s.key] ? (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={textoBadgeSubstanciaExibicao(s.label)}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: s.color }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={chartLineAnimActive}
                        animationDuration={reducedMotion ? 1 : 800}
                        animationBegin={
                          reducedMotion ? 0 : MOTION_LINE_ANIMATION_BEGIN_MS[s.key]
                        }
                        animationEasing="ease-out"
                      />
                    ) : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>

        <div style={motionGroupStyle(g4, reducedMotion)}>
        <CardUltimosAlertasLegislativos alertas={dashboardMock.alertas_recentes} />
        </div>

        {!filtrosSemProcessos ? (
        <div style={motionGroupStyle(g5, reducedMotion)}>
        {/* Minerais + ranking */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginTop: 16,
          }}
        >
          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
              ...(mineraisEstrategicosDoFiltro.length === 0
                ? {
                    minHeight: INTEL_MINERAIS_RANKING_EMPTY_PANEL_MIN_PX,
                    display: 'flex',
                    flexDirection: 'column' as const,
                  }
                : {}),
            }}
          >
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#FFFFFF',
                  }}
                >
                  Minerais estratégicos
                </p>
              </div>
              {temFiltroAtivo && mineraisEstrategicosDoFiltro.length > 0 ? (
                <p
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: 11,
                    color: '#5F5E5A',
                  }}
                >
                  Filtrado por processos selecionados
                </p>
              ) : null}
            </div>
            {mineraisEstrategicosDoFiltro.length === 0 ? (
              <div
                style={{
                  ...INTEL_CARD_EMPTY_BODY_GROW,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <IconBarrasRegimeVazio />
                <span style={INTEL_CARD_EMPTY_MSG}>Nenhum mineral estratégico encontrado</span>
              </div>
            ) : (
              mineraisEstrategicosDoFiltro.map((m) => {
                const gapPp = m.reservas_pct - m.producao_pct
                const pctFmt = (x: number) =>
                  x.toLocaleString('pt-BR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  })
                const pillTendencia =
                  m.tendencia === 'alta'
                    ? {
                        bg: '#1D9E7526',
                        cor: '#1D9E75',
                        Icon: IconTendenciaUp,
                      }
                    : m.tendencia === 'estavel'
                      ? {
                          bg: '#2C2C2A',
                          cor: '#888780',
                          Icon: IconTendenciaMinus,
                        }
                      : {
                          bg: '#E24B4A26',
                          cor: '#E24B4A',
                          Icon: IconTendenciaDown,
                        }
                const TendenciaIcon = pillTendencia.Icon
                const tooltipDemanda = tooltipTextoDemandaPorNivel(m.demandaNivel)

                return (
                  <div
                    key={m.sigla}
                    role="button"
                    tabIndex={0}
                    className="terrae-intel-hover-subpanel"
                    onClick={() => navigateSubstanciaMapa(m.substancia)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigateSubstanciaMapa(m.substancia)
                      }
                    }}
                    style={{
                      backgroundColor: '#0D0D0C',
                      borderRadius: 6,
                      padding: '14px 16px',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#EF9F27',
                            flexShrink: 0,
                          }}
                        >
                          {m.sigla}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 400,
                            color: '#D3D1C7',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.substancia}
                        </span>
                      </div>
                      <TooltipDemandaPill
                        texto={tooltipDemanda}
                        hoverBackground={`${pillTendencia.cor}15`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 14,
                          fontWeight: 500,
                          color: pillTendencia.cor,
                          backgroundColor: pillTendencia.bg,
                          borderRadius: 999,
                          padding: '2px 14px',
                          flexShrink: 0,
                          transition: 'background-color 0.15s ease-out',
                        }}
                      >
                        Demanda
                        <TendenciaIcon size={12} color={pillTendencia.cor} aria-hidden={true} />
                      </TooltipDemandaPill>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 13, color: '#888780' }}>Reservas</span>
                      <span style={{ fontSize: 14, color: '#F1EFE8', fontWeight: 500 }}>
                        {pctFmt(m.reservas_pct)}%
                      </span>
                      <span style={{ fontSize: 13, color: '#5F5E5A' }}>·</span>
                      <span style={{ fontSize: 13, color: '#888780' }}>Produção</span>
                      <span style={{ fontSize: 14, color: '#F1EFE8', fontWeight: 500 }}>
                        {pctFmt(m.producao_pct)}%
                      </span>
                      <span style={{ fontSize: 13, color: '#5F5E5A' }}>·</span>
                      <TooltipHoverResumo
                        texto={INTEL_TOOLTIP_GAP_PRODUCAO}
                        maxWidth={INTEL_TOOLTIP_GAP_LARGURA}
                        wrapperLayout="inlineRow"
                      >
                        <>
                          <span style={{ fontSize: 13, color: '#888780' }}>Gap</span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: corGapOportunidadePp(gapPp),
                            }}
                          >
                            {formatarGapValorComPrefixo(gapPp)}
                          </span>
                        </>
                      </TooltipHoverResumo>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#EF9F27',
                        }}
                      >
                        USD {formatPrecoUsd(m.preco_usd_t)}/t
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
              ...(rankingDisplay.length === 0
                ? {
                    minHeight: INTEL_MINERAIS_RANKING_EMPTY_PANEL_MIN_PX,
                    display: 'flex',
                    flexDirection: 'column' as const,
                  }
                : {}),
            }}
          >
            <div style={{ marginBottom: 32 }}>
              {rankingDisplay.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: RANKING_TITULARES_GRID_TEMPLATE,
                    columnGap: 8,
                    alignItems: 'center',
                    width: '100%',
                    borderLeft: '2px solid transparent',
                    paddingLeft: 8,
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ gridColumn: '1 / 2' }} aria-hidden />
                  <div style={{ gridColumn: '2 / 3', minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        color: '#FFFFFF',
                      }}
                    >
                      Ranking de titulares
                    </p>
                    {rankingConcentracaoTop3Pct != null ? (
                      <p style={{ margin: '6px 0 0 0', fontSize: 16, color: '#888780' }}>
                        {rankPorArea
                          ? `Top 3 concentram ${rankingConcentracaoTop3Pct}% da área total`
                          : `Top 3 concentram ${rankingConcentracaoTop3Pct}% dos processos`}
                      </p>
                    ) : null}
                  </div>
                  <span style={{ gridColumn: '3 / 4' }} aria-hidden />
                  <div
                    style={{
                      gridColumn: '4 / 7',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setRankPorArea(true)}
                      className="terrae-intel-rank-toggle"
                      style={{
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        backgroundColor: rankPorArea ? '#2C2C2A' : '#0D0D0C',
                        color: rankPorArea ? '#F1EFE8' : '#888780',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Por Área
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankPorArea(false)}
                      className="terrae-intel-rank-toggle"
                      style={{
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        backgroundColor: !rankPorArea ? '#2C2C2A' : '#0D0D0C',
                        color: !rankPorArea ? '#F1EFE8' : '#888780',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Por Processos
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#FFFFFF',
                  }}
                >
                  Ranking de titulares
                </p>
              )}
            </div>
            <div
              style={
                rankingDisplay.length === 0
                  ? {
                      ...INTEL_CARD_EMPTY_BODY_GROW,
                      transition: 'opacity 0.2s ease',
                    }
                  : { transition: 'opacity 0.2s ease' }
              }
            >
              {rankingDisplay.length === 0 ? (
                <>
                  <IconPodioRankingVazio />
                  <span style={INTEL_CARD_EMPTY_MSG}>Nenhum titular encontrado</span>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: RANKING_TITULARES_GRID_TEMPLATE,
                      columnGap: 8,
                      alignItems: 'center',
                      width: '100%',
                      marginBottom: 8,
                      borderLeft: '2px solid transparent',
                      paddingLeft: 8,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ gridColumn: '1 / 2' }} aria-hidden />
                    <span style={{ gridColumn: '2 / 3' }} aria-hidden />
                    <span
                      style={{
                        gridColumn: '3 / 4',
                        ...RANKING_TITULARES_HEAD_CELL,
                        ...RANKING_TITULARES_COL_SUBSTANCIAS,
                      }}
                    >
                      Substâncias
                    </span>
                    <span
                      style={{
                        gridColumn: '4 / 5',
                        ...RANKING_TITULARES_HEAD_CELL,
                        ...RANKING_TITULARES_COL_METRICA,
                      }}
                    >
                      {rankPorArea ? 'Hectares' : 'Processos'}
                    </span>
                    <span
                      style={{
                        gridColumn: '5 / 6',
                        ...RANKING_TITULARES_HEAD_CELL,
                        ...RANKING_TITULARES_RISCO_NA_GRID,
                      }}
                    >
                      Risco
                    </span>
                    <span
                      style={{ gridColumn: '6 / 7', ...RANKING_TITULARES_COL_ACAO }}
                      aria-hidden
                    />
                  </div>
                  {rankingDisplay.map((r, i) => {
                const sel = titularSelecionado === r.titular
                const temTit = titularSelecionado !== null
                return (
                  <div key={r.titular}>
                    {i > 0 ? (
                      <div style={{ height: 1, backgroundColor: '#2C2C2A', margin: '8px 0' }} />
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateTitularMapa(r.titular)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigateTitularMapa(r.titular)
                        }
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: RANKING_TITULARES_GRID_TEMPLATE,
                        columnGap: 8,
                        alignItems: 'center',
                        width: '100%',
                        cursor: 'pointer',
                        borderLeft: sel ? '2px solid #EF9F27' : '2px solid transparent',
                        backgroundColor: sel ? '#2C2C2A' : 'transparent',
                        marginLeft: 0,
                        paddingLeft: sel ? 6 : 8,
                        paddingTop: 4,
                        paddingBottom: 4,
                        borderRadius: 4,
                        opacity: temTit && !sel ? 0.5 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          gridColumn: '1 / 2',
                          fontSize: 12,
                          color: '#FFFFFF',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          gridColumn: '2 / 3',
                          minWidth: 0,
                          fontSize: 16,
                          color: '#D3D1C7',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.titular}
                      </span>
                      <div
                        style={{
                          gridColumn: '3 / 4',
                          display: 'flex',
                          flexWrap: 'nowrap',
                          gap: 4,
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        {r.substancias.slice(0, 2).map((sub) => {
                          const pill = estiloPillSubstanciaRanking(sub)
                          return (
                            <span
                              key={sub}
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                boxSizing: 'border-box',
                                display: 'inline-block',
                                ...pill,
                              }}
                            >
                              {sub}
                            </span>
                          )
                        })}
                      </div>
                      <span
                        style={{
                          gridColumn: '4 / 5',
                          ...RANKING_TITULARES_COL_METRICA,
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#EF9F27',
                        }}
                      >
                        {rankPorArea
                          ? `${r.area_ha.toLocaleString('pt-BR')} ha`
                          : `${r.processos}`}
                      </span>
                      <span style={{ gridColumn: '5 / 6', ...RANKING_TITULARES_RISCO_NA_GRID }}>
                        {r.risk_medio !== null ? (
                          <span
                            style={{
                              fontSize: 13,
                              padding: '3px 8px',
                              borderRadius: 4,
                              backgroundColor: `${corRisk(r.risk_medio)}26`,
                              color: corRisk(r.risk_medio),
                              fontWeight: 500,
                              display: 'inline-block',
                              boxSizing: 'border-box',
                              textAlign: 'center',
                              width: 52,
                            }}
                          >
                            {r.risk_medio}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 13,
                              padding: '3px 8px',
                              borderRadius: 4,
                              backgroundColor: '#2C2C2A',
                              color: '#5F5E5A',
                              fontWeight: 500,
                              display: 'inline-block',
                              boxSizing: 'border-box',
                              textAlign: 'center',
                              width: 52,
                            }}
                          >
                            N/D
                          </span>
                        )}
                      </span>
                      <span style={{ gridColumn: '6 / 7', ...RANKING_TITULARES_COL_ACAO }}>
                        {sel ? (
                          <button
                            type="button"
                            aria-label="Limpar titular"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTitularSelecionado(null)
                              setPage(0)
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#888780',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: '0 4px',
                            }}
                          >
                            ✕
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </div>
                )
              })}
                </>
              )}
            </div>
          </div>
        </div>
        </div>
        ) : null}

        <div style={motionGroupStyle(g6, reducedMotion)}>
        {!filtrosSemProcessos ? (
        <div
          className="terrae-intel-hover-panel"
          style={{
            backgroundColor: '#1A1A18',
            borderRadius: 8,
            padding: 20,
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: '#FFFFFF',
              }}
            >
              Tabela de processos
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {processosParaTabela.length > 0 || busca.trim() !== '' ? (
                <div
                  style={{
                    position: 'relative',
                    width: 400,
                    flexShrink: 0,
                    height: 36,
                    boxSizing: 'border-box',
                    padding: '8px 12px 8px 36px',
                    backgroundColor: '#111110',
                    border: `1px solid ${buscaFocada ? '#EF9F27' : '#2C2C2A'}`,
                    borderRadius: 6,
                    transition: 'border-color 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconBuscaIntel
                    size={16}
                    color={buscaFocada ? '#EF9F27' : '#888780'}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      transition: 'opacity 0.2s ease',
                    }}
                  />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value)
                      setPage(0)
                    }}
                    onFocus={() => setBuscaFocada(true)}
                    onBlur={() => setBuscaFocada(false)}
                    placeholder="Buscar processo, titular ou substância..."
                    className="terrae-intel-busca-processos"
                    autoComplete="off"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      height: '100%',
                      boxSizing: 'border-box',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: 14,
                      color: '#F1EFE8',
                      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                      paddingRight: busca ? 28 : 12,
                      paddingLeft: 0,
                    }}
                  />
                  {busca ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Limpar busca"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setBusca('')
                        setPage(0)
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 4,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#888780',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#F1EFE8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#888780'
                      }}
                    >
                      <IconLimparBuscaIntel size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                disabled={totalFiltrados === 0}
                onClick={exportarCsv}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxSizing: 'border-box',
                  height: 36,
                  padding: '0 14px',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: totalFiltrados === 0 ? '#5F5E5A' : '#2C2C2A',
                  background: 'transparent',
                  color: totalFiltrados === 0 ? '#5F5E5A' : '#F1EFE8',
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: totalFiltrados === 0 ? 'default' : 'pointer',
                  opacity: totalFiltrados === 0 ? 0.55 : 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (totalFiltrados === 0) return
                  e.currentTarget.style.color = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#888780'
                }}
                onMouseLeave={(e) => {
                  if (totalFiltrados === 0) return
                  e.currentTarget.style.color = '#F1EFE8'
                  e.currentTarget.style.borderColor = '#2C2C2A'
                }}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                Exportar CSV
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', transition: 'opacity 0.2s ease' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
                transition: 'opacity 0.2s ease',
              }}
            >
              {totalFiltrados > 0 ? (
                <thead>
                  <tr style={{ backgroundColor: '#0D0D0C' }}>
                    <Th>Processo</Th>
                    <Th>Regime</Th>
                    <Th>Substância</Th>
                    <Th>Titular</Th>
                    <Th>UF</Th>
                    <ThSort
                      active={sortCol === 'area'}
                      asc={sortAsc}
                      onClick={() => toggleSort('area')}
                    >
                      Área (ha)
                    </ThSort>
                    <ThSort
                      active={sortCol === 'fase'}
                      asc={sortAsc}
                      onClick={() => toggleSort('fase')}
                    >
                      Fase
                    </ThSort>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 10px',
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#888780',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Último desp.
                    </th>
                    <ThSort
                      active={sortCol === 'risk'}
                      asc={sortAsc}
                      onClick={() => toggleSort('risk')}
                    >
                      Risk Score
                    </ThSort>
                    <Th>Situação</Th>
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {totalFiltrados === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, border: 'none', verticalAlign: 'middle' }}>
                      <div
                        style={{
                          ...INTEL_CARD_EMPTY_WRAP,
                          padding: '24px 16px',
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        <IconTabelaVazia />
                        <span style={INTEL_CARD_EMPTY_MSG}>Nenhum processo encontrado</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  linhasPagina.map((p, idx) => (
                    <tr
                      key={p.id}
                      onClick={() => onRowClick(p)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: idx % 2 === 0 ? '#1A1A18' : '#111110',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2C2C2A'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          idx % 2 === 0 ? '#1A1A18' : '#111110'
                      }}
                    >
                      <Td>{p.numero}</Td>
                      <Td>
                        <RegimeBadge regime={p.regime} variant="table" />
                      </Td>
                      <Td>
                        <BadgeSubstancia substancia={p.substancia} variant="intelTable" />
                      </Td>
                      <TdTitularTruncado titular={p.titular} />
                      <Td style={{ color: '#D3D1C7' }}>{p.uf}</Td>
                      <Td style={{ color: '#D3D1C7' }}>
                        {p.area_ha.toLocaleString('pt-BR')}
                      </Td>
                      <Td style={{ color: '#D3D1C7' }}>{FASE_LABELS[p.fase]}</Td>
                      <Td
                        style={{
                          color: corUltimoDespachoData(p.ultimo_despacho_data),
                          fontSize: 14,
                        }}
                      >
                        {fmtUltimoDespachoCelula(p.ultimo_despacho_data)}
                      </Td>
                      <Td>
                        {p.risk_score === null ? (
                          <span style={{ color: '#5F5E5A', fontSize: 14 }}>N/D</span>
                        ) : (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontSize: 13,
                              fontWeight: 500,
                              backgroundColor: `${corRisk(p.risk_score)}26`,
                              color: corRisk(p.risk_score),
                            }}
                          >
                            {p.risk_score}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 500,
                            backgroundColor:
                              p.situacao === 'ativo'
                                ? 'rgba(29, 158, 117, 0.15)'
                                : p.situacao === 'bloqueado'
                                  ? 'rgba(226, 75, 74, 0.15)'
                                  : 'rgba(136, 135, 128, 0.15)',
                            color:
                              p.situacao === 'ativo'
                                ? '#1D9E75'
                                : p.situacao === 'bloqueado'
                                  ? '#E24B4A'
                                  : '#888780',
                          }}
                        >
                          {situacaoLabel(p.situacao)}
                        </span>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalFiltrados > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 16,
              }}
            >
              <span style={{ fontSize: 13, color: '#5F5E5A' }}>
                {`Mostrando ${sliceStart + 1}-${sliceEnd} de ${totalFiltrados}`}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <button
                  type="button"
                  disabled={pageSafe <= 0}
                  aria-label="Página anterior"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    cursor: pageSafe <= 0 ? 'default' : 'pointer',
                    color: pageSafe <= 0 ? '#2C2C2A' : '#888780',
                  }}
                >
                  <IconChevronPagina dir="left" size={16} />
                </button>
                {indicadoresPagina.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span
                      key={`e-${idx}`}
                      style={{
                        minWidth: 28,
                        height: 28,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#888780',
                        userSelect: 'none',
                      }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item - 1)}
                      style={{
                        width: 28,
                        height: 28,
                        boxSizing: 'border-box',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: 13,
                        fontWeight: pageSafe + 1 === item ? 500 : 400,
                        cursor: 'pointer',
                        backgroundColor:
                          pageSafe + 1 === item ? '#EF9F27' : 'transparent',
                        color:
                          pageSafe + 1 === item ? '#0D0D0C' : '#888780',
                      }}
                      onMouseEnter={(e) => {
                        if (pageSafe + 1 === item) return
                        e.currentTarget.style.backgroundColor = '#2C2C2A'
                        e.currentTarget.style.color = '#F1EFE8'
                      }}
                      onMouseLeave={(e) => {
                        if (pageSafe + 1 === item) {
                          e.currentTarget.style.backgroundColor = '#EF9F27'
                          e.currentTarget.style.color = '#0D0D0C'
                          return
                        }
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = '#888780'
                      }}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={pageSafe >= maxPage}
                  aria-label="Próxima página"
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    cursor: pageSafe >= maxPage ? 'default' : 'pointer',
                    color: pageSafe >= maxPage ? '#2C2C2A' : '#888780',
                  }}
                >
                  <IconChevronPagina dir="right" size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        ) : null}

      <footer
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #2C2C2A',
          textAlign: 'center',
          fontSize: 11,
          color: '#5F5E5A',
        }}
      >
        Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo · Atualizado em {hoje}
      </footer>
    </div>
    </div>
  )
}

function KpiRiskFaixaBarra({ valor }: { valor: number }) {
  const v = Math.min(100, Math.max(0, valor))
  return (
    <div
      style={{
        marginTop: 8,
        position: 'relative',
        height: 8,
        width: '100%',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: 4,
          borderRadius: 999,
          background:
            'linear-gradient(to right, #1D9E75 0%, #1D9E75 40%, #E8A830 40%, #E8A830 70%, #E24B4A 70%, #E24B4A 100%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${v}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: '#F1EFE8',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

export function KpiCard({
  valor,
  valorColor,
  label,
  sub,
  emptyFiltros,
  infoTexto,
  footer,
  subFontSize = 15,
  labelFontSize = 15,
  labelColor = '#FFFFFF',
}: {
  valor: string
  valorColor: string
  label: string
  sub: ReactNode
  emptyFiltros?: boolean
  infoTexto?: string
  footer?: ReactNode
  subFontSize?: number
  labelFontSize?: number
  labelColor?: string
}) {
  /** Altura reservada para faixa de risco ou espaçador equivalente (8 + 8px). */
  const KPI_FOOTER_RUNWAY_PX = 16

  const valorExibido = emptyFiltros ? '\u2014' : valor
  const corValorExibido = emptyFiltros ? '#5F5E5A' : valorColor

  return (
    <div
      className="terrae-intel-hover-panel"
      style={{
        backgroundColor: '#1A1A18',
        borderRadius: 8,
        padding: 16,
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        opacity: emptyFiltros ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 500,
          color: corValorExibido,
        }}
      >
        {valorExibido}
      </div>
      <div
        style={{
          fontSize: labelFontSize,
          color: labelColor,
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {label}
        {infoTexto != null && infoTexto !== '' ? <InfoTooltip texto={infoTexto} /> : null}
      </div>
      {emptyFiltros ? (
        <>
          <div
            aria-hidden
            style={{ flex: 1, minHeight: 0, width: '100%' }}
          />
          <div
            style={{
              flexShrink: 0,
              transition: 'opacity 0.2s ease',
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontSize: 13, color: '#5F5E5A' }}>
              Sem resultados para os filtros ativos
            </span>
          </div>
          <div
            style={{
              flexShrink: 0,
              width: '100%',
              minHeight: KPI_FOOTER_RUNWAY_PX,
            }}
          >
            <div
              aria-hidden
              style={{ height: KPI_FOOTER_RUNWAY_PX, width: '100%' }}
            />
          </div>
        </>
      ) : (
        <>
          <div
            aria-hidden
            style={{ flex: 1, minHeight: 0, width: '100%' }}
          />
          <div
            style={{
              fontSize: subFontSize,
              color: '#888780',
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {sub}
          </div>
          <div
            style={{
              flexShrink: 0,
              width: '100%',
              minHeight: KPI_FOOTER_RUNWAY_PX,
            }}
          >
            {footer ?? (
              <div
                aria-hidden
                style={{ height: KPI_FOOTER_RUNWAY_PX, width: '100%' }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

const INTEL_TOOLTIP_TITULAR_LARGURA = 320

function TdTitularTruncado({ titular }: { titular: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncado, setTruncado] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setTruncado(el.scrollWidth > el.clientWidth)
  }, [titular])

  const span = (
    <span
      ref={ref}
      style={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: truncado ? 'help' : undefined,
      }}
    >
      {titular}
    </span>
  )

  return (
    <Td style={{ color: '#D3D1C7', maxWidth: 140 }}>
      {truncado ? (
        <TooltipHoverResumo
          texto={titular}
          maxWidth={INTEL_TOOLTIP_TITULAR_LARGURA}
          wrapperLayout="default"
        >
          {span}
        </TooltipHoverResumo>
      ) : (
        span
      )}
    </Td>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '12px 10px',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: '#FFFFFF',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function ThSort({
  children,
  active,
  asc,
  onClick,
}: {
  children: ReactNode
  active: boolean
  asc: boolean
  onClick: () => void
}) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '12px 10px',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: '#FFFFFF',
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onClick={onClick}
    >
      {children}{' '}
      <span style={{ opacity: active ? 1 : 0.4 }}>{active ? (asc ? '↑' : '↓') : '↑↓'}</span>
    </th>
  )
}

function Td({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <td
      style={{
        padding: '12px 10px',
        fontSize: 14,
        borderBottom: '1px solid #2C2C2A',
        ...style,
      }}
    >
      {children}
    </td>
  )
}

function formatValorTooltip(v: TooltipPayloadEntry['value']): string {
  if (v == null) return 'N/D'
  if (typeof v === 'number') return v.toFixed(1)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(String).join(', ')
  return 'N/D'
}

function formatValorTooltipPtBr(v: TooltipPayloadEntry['value']): string {
  const s = formatValorTooltip(v)
  return s === 'N/D' ? s : s.replace('.', ',')
}

function producaoPayloadNumero(v: TooltipPayloadEntry['value']): number | null | undefined {
  if (v === null || v === undefined) return v
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null
  }
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Índice 100 = 2019; exibir variação % com cor semântica. */
function formatVariacaoProducaoDesde2019(num: number): { text: string; color: string } {
  const v = Math.round(num - 100)
  if (v > 0) return { text: `+${v}%`, color: '#1D9E75' }
  if (v < 0) return { text: `${v}%`, color: '#E24B4A' }
  return { text: '0%', color: '#888780' }
}

function ProducaoTooltip({
  active,
  payload,
  label,
  subAtivas,
}: {
  active?: boolean
  payload?: ReadonlyArray<TooltipPayloadEntry>
  label?: string | number
  subAtivas: Record<string, boolean>
}) {
  if (!active || !payload?.length) return null
  const rows = [...payload].filter((p) => {
    const key = SUB_KEYS.find(
      (s) => textoBadgeSubstanciaExibicao(s.label) === String(p.name),
    )?.key
    return key ? subAtivas[key] : true
  })
  if (!rows.length) return null
  const corSerie = (p: TooltipPayloadEntry) =>
    (typeof p.color === 'string' ? p.color : undefined) ?? '#888780'
  return (
    <div
      style={{
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 8,
        padding: '12px 16px',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#888780' }}>{label}</p>
      {rows.map((p, i) => {
        const num = producaoPayloadNumero(p.value)
        const c = corSerie(p)
        const variacao =
          num !== null && num !== undefined
            ? formatVariacaoProducaoDesde2019(num)
            : null
        const valorFmt = variacao
          ? variacao.text
          : formatValorTooltipPtBr(p.value)
        const valorColor = variacao ? variacao.color : c
        return (
          <div
            key={String(p.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: i === 0 ? 0 : 6,
              fontSize: 13,
              color: '#D3D1C7',
              lineHeight: 1.4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: c,
                flexShrink: 0,
              }}
              aria-hidden
            />
            <span>
              {p.name}:{' '}
              <span style={{ fontWeight: 500, color: valorColor }}>{valorFmt}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
