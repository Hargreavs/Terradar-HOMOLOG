import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  FileText,
  Search,
  X,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { RadarAlerta } from '../../data/radar-alertas.mock'
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import {
  calcularRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
  type TipoImpacto,
} from '../../lib/relevanciaAlerta'
import { motionMs } from '../../lib/motionDurations'
import { type RadarEventoEnriquecido } from '../../lib/radar/eventoAdapter'
import {
  useRadarEventoDetalhe,
  useRadarEventos,
  type RadarResumo,
} from '../../lib/radar/useRadarEventos'
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip'

type PeriodoKey = '7d' | '30d' | '90d'

const PERIODO_OPCOES: { id: PeriodoKey; label: string }[] = [
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
]

/** Limite por página na API (top UFs são amostrados neste conjunto quando há corte por limite). */
const RADAR_FETCH_LIMITE = 100

const BR_UFS_ALL: readonly string[] = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

const CATEGORIAS_FILTRO_API: readonly string[] = [
  'CRITICO',
  'DESFAVORAVEL',
  'NEUTRO',
  'POSITIVO',
  'FAVORAVEL',
]

const BORDA_URGENTE_FEED = '#F59E0B'

function isAlertaRowUrgenteVisual(a: RadarEventoEnriquecido): boolean {
  if (a.urgente === true) return true
  const f = a.flags_atencao
  if (!Array.isArray(f)) return false
  return f.some((x) => String(x).toUpperCase().includes('URGENTE'))
}

/** Intervalo de datas exclusivo Radar Alertas (7 / 30 / 90 dias). */
export function computePeriodoRange(periodo: PeriodoKey): {
  dataDe: string
  dataAte: string
} {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const hoje = new Date()
  const dataAte = ymd(hoje)
  const days = periodo === '7d' ? 7 : periodo === '90d' ? 90 : 30
  const de = new Date(hoje)
  de.setDate(de.getDate() - days)
  return { dataDe: ymd(de), dataAte }
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ymdToday(): string {
  return ymdFromDate(new Date())
}

function parseAlertaDateTimeMs(a: RadarAlerta): number {
  const t = `${a.data}T${a.hora}:00`
  const ms = new Date(t).getTime()
  return Number.isFinite(ms) ? ms : new Date(`${a.data}T12:00:00`).getTime()
}

const MESES_PT_CURTO = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

/** Painel detalhe e feed: "23 mar 2026 às 09:15" */
function formatDataHoraPublicacaoPainel(iso: string, hora: string): string {
  const [ys, ms, ds] = iso.split('-')
  const y = Number(ys)
  const mo = Number(ms)
  const d = Number(ds)
  if (!y || !mo || !d || mo < 1 || mo > 12) return `${iso} às ${hora}`
  return `${d} ${MESES_PT_CURTO[mo - 1]} ${y} às ${hora}`
}

/** Cores da bolinha de relevância no feed (esp. explícitas). */
const COR_BOLINHA_RELEV: Record<Relevancia, string> = {
  critico: '#E24B4A',
  desfavoravel: '#E8A830',
  neutro: '#888780',
  positivo: '#5CBFA0',
  favoravel: '#1D9E75',
}

/** Título de cartão, alinhado ao bloco "Resumo do dia" / cabeçalho do feed de alertas. */
const INTEL_DIST_REGIME_SECTION_TITLE: CSSProperties = {
  margin: 0,
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  color: '#FFFFFF',
}

/** KpiCard: label "Valor potencial estimado" (labelFontSize 14, labelColor #FFFFFF). */
const INTEL_KP_LABEL_FS = 14
const INTEL_KP_LABEL_COLOR = '#FFFFFF'

/** KpiCard: sub "Reservas mapeadas (USGS)" (subFontSize 15, color #888780). */
const INTEL_KP_SUB_FS = 15
const INTEL_KP_SUB_COLOR = '#888780'

/**
 * Filtros da sub-aba Alertas: mesma paleta/cantos que UF/Subst. na Inteligência,
 * com padding vertical menor para alinhar à linha (sem alterar o componente na aba Intel).
 */
const RADAR_ALERTAS_FILTER_TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#0D0D0C',
  border: '1px solid #2C2C2A',
  borderRadius: 6,
  padding: '7px 12px',
  fontSize: 14,
  color: '#D3D1C7',
  cursor: 'pointer',
  outline: 'none',
}

function isNovo7d(iso: string): boolean {
  const t = new Date(`${iso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return false
  if (t > Date.now()) return false
  return Date.now() - t <= 7 * 86400000
}

function tipoParaCalculo(t: RadarAlerta['tipo_impacto']): TipoImpacto {
  return t as TipoImpacto
}

function normSubStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

function toggleUfNaLista(prev: string[], uf: string): string[] {
  const u = uf.trim().toUpperCase()
  if (!u) return prev
  return prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
}

function substJaSelecionada(lista: string[], raw: string): boolean {
  const k = normSubStr(raw)
  return lista.some((p) => normSubStr(p) === k)
}

function toggleSubstNaLista(prev: string[], raw: string): string[] {
  const k = normSubStr(raw)
  const has = prev.some((p) => normSubStr(p) === k)
  if (has) return prev.filter((p) => normSubStr(p) !== k)
  return [...prev, raw]
}

function analiseTexto(a: RadarAlerta): string {
  return (a.analise ?? a.ementa).trim()
}

const LABEL_SECTION: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#5F5E5A',
  fontWeight: 600,
}

const LABEL_SECTION_DETAIL: CSSProperties = {
  ...LABEL_SECTION,
  fontSize: 12,
  color: '#888780',
}

function labelCategoriaFiltro(id: string): string {
  const m: Record<string, string> = {
    CRITICO: 'Crítico',
    DESFAVORAVEL: 'Desfavorável',
    NEUTRO: 'Neutro',
    POSITIVO: 'Positivo',
    FAVORAVEL: 'Favorável',
  }
  return m[id] ?? id
}

/** Ordem visual do painel "Resumo do período" (alinhado à API). */
const RESUMO_PERIODO_CAT: readonly {
  api: string
  rel: Relevancia
  label: string
}[] = [
  { api: 'FAVORAVEL', rel: 'favoravel', label: 'Favorável' },
  { api: 'DESFAVORAVEL', rel: 'desfavoravel', label: 'Desfavorável' },
  { api: 'NEUTRO', rel: 'neutro', label: 'Neutro' },
  { api: 'POSITIVO', rel: 'positivo', label: 'Positivo' },
  { api: 'CRITICO', rel: 'critico', label: 'Crítico' },
]

function contagemPorCategoriaApi(
  por: Record<string, number> | undefined,
  code: string,
): number {
  if (!por) return 0
  const up = code.toUpperCase()
  for (const [k, v] of Object.entries(por)) {
    if (k.replace(/\s+/g, '').toUpperCase() === up.replace(/\s+/g, '')) {
      return v
    }
  }
  return 0
}

function urlDouPublicacao(a: RadarAlerta): string | null {
  const u = (a as RadarEventoEnriquecido).url_dou?.trim()
  if (u && /^https?:\/\//i.test(u)) return u
  return null
}

const ITENS_POR_PAGINA_FEED = 25
const ITENS_MODAL_PROCESSOS = 50

type RadarLinhaProc = {
  id: string
  numero: string
}

function strRadarDet(k: Record<string, unknown> | null, campo: string): string {
  if (!k) return ''
  const v = k[campo]
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

function extrairProcessosRadarDetalhe(
  det: Record<string, unknown> | null,
): RadarLinhaProc[] {
  const raw = det?.processos_afetados
  if (!Array.isArray(raw)) return []
  const out: RadarLinhaProc[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = o.id != null ? String(o.id).trim() : ''
    let num =
      typeof o.numero === 'string'
        ? o.numero.trim()
        : o.numero != null && o.numero !== ''
          ? String(o.numero).trim()
          : ''
    num = num || id
    if (num || id) out.push({ id: id || num, numero: num })
  }
  return out
}

function totalAfetadosDoDetalhe(
  det: Record<string, unknown> | null,
  amostraLen: number,
): number {
  const raw = det?.total_processos_afetados
  let n: number
  if (typeof raw === 'number' && Number.isFinite(raw)) n = raw
  else if (typeof raw === 'string') {
    const p = parseInt(raw.replace(/\D/g, ''), 10)
    n = Number.isFinite(p) ? p : NaN
  } else {
    n = NaN
  }
  if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  return amostraLen
}

function textoLinhaPublicacaoDet(
  det: Record<string, unknown> | null,
  fall: RadarAlerta,
): string {
  if (!det) return fall.fonte_nome_completo
  const org = strRadarDet(det, 'orgao_emissor').trim()
  const tipo = strRadarDet(det, 'tipo_ato').trim()
  const numero = strRadarDet(det, 'numero_ato').trim()
  const parts = [org, tipo, numero].filter(Boolean)
  return parts.length ? parts.join(' · ') : fall.fonte_nome_completo
}

function formatoDataEvtDetalhe(iso: unknown): string {
  if (typeof iso !== 'string' || !iso.trim()) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return `${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString(
    'pt-BR',
    { hour: '2-digit', minute: '2-digit' },
  )}`
}

function parseUfArray(field: unknown): string[] {
  if (!Array.isArray(field)) return []
  return field
    .map((u) => (typeof u === 'string' ? u.trim().toUpperCase() : ''))
    .filter(Boolean)
}

/** LLM (`ufs_afetadas`) com fallback para pipeline (`ufs_afetadas_real`) na view. */
function ufsDoDetalhe(det: Record<string, unknown> | null): string[] {
  if (!det) return []
  const llm = parseUfArray(det.ufs_afetadas)
  if (llm.length > 0) return llm
  return parseUfArray(det.ufs_afetadas_real)
}

function parseSubstArray(field: unknown): string[] {
  if (!Array.isArray(field)) return []
  return field
    .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
    .filter(Boolean)
}

/**
 * LLM (`substancias_minerais`) → pipeline (`substancias_afetadas_real`) → item do feed.
 */
function subsDoDetalhe(
  det: Record<string, unknown> | null,
  fallback: RadarAlerta,
): string[] {
  if (!det) return parseSubstArray(fallback.substancias_afetadas)
  const llm = parseSubstArray(det.substancias_minerais)
  if (llm.length > 0) return llm
  const real = parseSubstArray(det.substancias_afetadas_real)
  if (real.length > 0) return real
  return parseSubstArray(fallback.substancias_afetadas)
}

function analiseTextoPreferDet(
  det: Record<string, unknown> | null,
  listaItem: RadarAlerta,
): string {
  const t = strRadarDet(det, 'analise_terradar').trim()
  if (t) return t
  const r = strRadarDet(det, 'resumo').trim()
  if (r) return r
  return analiseTexto(listaItem)
}

type IndiceRadarPg = number | 'ellipsis'

function indicesPaginasNumeradas(total: number, atual: number): IndiceRadarPg[] {
  const t = Math.max(1, total)
  const cur = Math.min(Math.max(1, atual), t)
  if (t <= 7) {
    return Array.from({ length: t }, (_, i) => i + 1)
  }
  const s = new Set<number>([
    1,
    t,
    cur - 2,
    cur - 1,
    cur,
    cur + 1,
    cur + 2,
  ])
  const ord = [...s].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b)
  const out: IndiceRadarPg[] = []
  for (let i = 0; i < ord.length; i++) {
    const p = ord[i]
    if (p === undefined) continue
    if (i > 0) {
      const prev = ord[i - 1]
      if (prev !== undefined && p - prev > 1) out.push('ellipsis')
    }
    out.push(p)
  }
  return out
}

function PeriodoSingleDropdown({
  value,
  onChange,
  aberto,
  setAberto,
  reducedMotion,
  triggerStyle = RADAR_ALERTAS_FILTER_TRIGGER_STYLE,
}: {
  value: PeriodoKey
  onChange: (p: PeriodoKey) => void
  aberto: boolean
  setAberto: (v: boolean) => void
  reducedMotion: boolean
  triggerStyle?: CSSProperties
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{
    top: number
    left: number
    width: number
    maxH: number
  } | null>(null)
  const label = PERIODO_OPCOES.find((o) => o.id === value)?.label ?? 'Últimos 30 dias'
  const tMs = motionMs(150, reducedMotion)

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
      const vh = document.documentElement.clientHeight
      const gap = 4
      const maxH = Math.min(280, vh - r.bottom - gap - 16)
      setRect({
        top: r.bottom + gap,
        left: Math.min(r.left, vw - 220),
        width: Math.max(r.width, 200),
        maxH: Math.max(80, maxH),
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
  }, [aberto, setAberto])

  const portal =
    aberto && rect ? (
      <div
        ref={panelRef}
        role="listbox"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxH,
          boxSizing: 'border-box',
          backgroundColor: '#1A1A18',
          border: '1px solid #2C2C2A',
          borderRadius: 8,
          padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 2147483647,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="terrae-dropdown-scroll min-h-0 flex-1 overflow-y-auto">
          {PERIODO_OPCOES.map((opt) => {
            const on = value === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(opt.id)
                  setAberto(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: on ? '#2C2C2A' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 4,
                  transition: `background-color ${tMs}ms ease`,
                }}
              >
                <span style={{ fontSize: 13, color: '#D3D1C7' }}>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="terrae-intel-border-interactive"
        onClick={() => setAberto(!aberto)}
        style={triggerStyle}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {label}
        </span>
        <ChevronDown
          size={12}
          color="#D3D1C7"
          style={{
            flexShrink: 0,
            transform: aberto ? 'rotate(180deg)' : 'none',
            transition: `transform ${tMs}ms ease`,
          }}
          aria-hidden
        />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

const CAIXA_ALERTA_RADAR: CSSProperties = {
  border: '1px solid #E8A830',
  borderRadius: 8,
  padding: '12px 14px',
  backgroundColor: 'rgba(232,168,48,0.08)',
}

function PilulaProcessoNeutral({ numero }: { numero: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 4,
        border: '1px solid #3D3D3A',
        backgroundColor: '#2C2C2A',
        color: '#D3D1C7',
        fontSize: 12,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {numero}
    </span>
  )
}

function SecaoProcAfetRadar({
  total,
  amostraLinhas,
  onAbrirModal,
}: {
  total: number
  amostraLinhas: RadarLinhaProc[]
  onAbrirModal: (titulo: string) => void
}) {
  const nShow = Math.min(10, amostraLinhas.length)
  const pilhas = () =>
    nShow > 0 ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {amostraLinhas.slice(0, nShow).map((row) => (
          <PilulaProcessoNeutral
            key={row.id || row.numero}
            numero={row.numero || row.id}
          />
        ))}
      </div>
    ) : null

  if (total === 0) {
    return (
      <p style={{ margin: 0, fontSize: INTEL_KP_SUB_FS, color: INTEL_KP_SUB_COLOR }}>
        Nenhum processo vinculado.
      </p>
    )
  }

  if (total >= 1 && total <= 10) return pilhas()

  if (total >= 11 && total <= 100) {
    const restantes = Math.max(0, total - 10)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pilhas()}
        {restantes > 0 ? (
          <button
            type="button"
            onClick={() => onAbrirModal('Processos afetados')}
            style={{
              alignSelf: 'flex-start',
              border: '1px solid #5F5E5A',
              background: 'transparent',
              color: '#D3D1C7',
              fontSize: 13,
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            + {restantes} outros · Ver todos
          </button>
        ) : null}
      </div>
    )
  }

  if (total >= 101 && total <= 10000) {
    return (
      <div style={{ ...CAIXA_ALERTA_RADAR }}>
        <div style={{ fontSize: 13, color: '#E8A830', fontWeight: 600 }}>
          ⚠ Este ato tem alcance amplo
        </div>
        <div style={{ marginTop: 6, fontSize: INTEL_KP_SUB_FS, color: INTEL_KP_SUB_COLOR }}>
          Afeta {total.toLocaleString('pt-BR')} processos minerários
        </div>
        <button
          type="button"
          onClick={() => onAbrirModal('Lista de processos afetados')}
          style={{
            marginTop: 10,
            border: '1px solid #EF9F27',
            backgroundColor: 'transparent',
            color: '#EF9F27',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          Ver lista completa
        </button>
      </div>
    )
  }

  return (
    <div style={{ ...CAIXA_ALERTA_RADAR }}>
      <div style={{ fontSize: 13, color: '#E8A830', fontWeight: 600 }}>🌎 Ato de escopo nacional</div>
      <div style={{ marginTop: 6, fontSize: INTEL_KP_SUB_FS, color: INTEL_KP_SUB_COLOR }}>
        Afeta {total.toLocaleString('pt-BR')} processos no Brasil
      </div>
      <button
        type="button"
        title="Em breve"
        disabled
        style={{
          marginTop: 10,
          border: '1px solid #5F5E5A',
          backgroundColor: 'transparent',
          color: '#5F5E5A',
          fontSize: 13,
          borderRadius: 6,
          padding: '8px 14px',
          cursor: 'not-allowed',
        }}
      >
        Filtrar no mapa
      </button>
    </div>
  )
}

export function RadarAlertasSubtab({
  reducedMotion,
  onToast,
}: {
  reducedMotion: boolean
  onToast?: (msg: string) => void
}) {
  const pendingRadarAlertaId = useAppStore((s) => s.pendingRadarAlertaId)
  const setPendingRadarAlertaId = useAppStore((s) => s.setPendingRadarAlertaId)

  const [periodo, setPeriodo] = useState<PeriodoKey>('30d')
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([])
  const [ufsSelecionadas, setUfsSelecionadas] = useState<string[]>([])
  const [substanciasSelecionadas, setSubstanciasSelecionadas] = useState<string[]>(
    [],
  )
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [buscaFocada, setBuscaFocada] = useState(false)
  const [ddPeriodo, setDdPeriodo] = useState(false)
  const [ddCat, setDdCat] = useState(false)
  const [ddUf, setDdUf] = useState(false)
  const [alertaSelecionadoId, setAlertaSelecionadoId] = useState<string | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [wide, setWide] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1200px)').matches : true,
  )

  const [paginaFeed, setPaginaFeed] = useState(1)
  const [modalProcAberto, setModalProcAberto] = useState(false)
  const [modalProcTitulo, setModalProcTitulo] = useState('')
  const [modalProcLista, setModalProcLista] = useState<RadarLinhaProc[]>([])
  const [modalProcPagIdx, setModalProcPagIdx] = useState(1)

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(busca.trim()), 300)
    return () => window.clearTimeout(t)
  }, [busca])

  const { dataDe, dataAte } = useMemo(() => computePeriodoRange(periodo), [periodo])

  const categoriaCsv = useMemo(
    () =>
      categoriasSelecionadas.length > 0
        ? categoriasSelecionadas.join(',')
        : undefined,
    [categoriasSelecionadas],
  )

  const ufCsv = useMemo(
    () =>
      ufsSelecionadas.length > 0 ? ufsSelecionadas.join(',') : undefined,
    [ufsSelecionadas],
  )

  const substanciaCsv = useMemo(
    () =>
      substanciasSelecionadas.length > 0
        ? substanciasSelecionadas.join(',')
        : undefined,
    [substanciasSelecionadas],
  )

  const {
    eventos: alertas,
    resumo,
    ufsTopSample,
    carregando,
    erro,
    updatedAtMs,
  } = useRadarEventos({
    data_de: dataDe,
    data_ate: dataAte,
    categoria: categoriaCsv,
    uf: ufCsv,
    substancia: substanciaCsv,
    q: buscaDebounced || undefined,
    limite: RADAR_FETCH_LIMITE,
  })

  const limparFiltros = useCallback(() => {
    setPeriodo('30d')
    setCategoriasSelecionadas([])
    setUfsSelecionadas([])
    setSubstanciasSelecionadas([])
    setBusca('')
    setBuscaDebounced('')
    setDdPeriodo(false)
    setDdCat(false)
    setDdUf(false)
    setPaginaFeed(1)
  }, [])

  const prefixCat =
    categoriasSelecionadas.length === 0
      ? 'Categoria'
      : categoriasSelecionadas.length === 1
        ? labelCategoriaFiltro(categoriasSelecionadas[0]!)
        : `${categoriasSelecionadas.length} categorias`

  const prefixUf =
    ufsSelecionadas.length === 0
      ? 'UF'
      : ufsSelecionadas.length === 1
        ? ufsSelecionadas[0]!
        : `${ufsSelecionadas.length} UFs`

  const atualizadoLabel = useMemo(() => {
    if (updatedAtMs == null) return '—'
    try {
      return new Date(updatedAtMs).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }, [updatedAtMs])

  const urgentesNoFetch = useMemo(
    () => alertas.filter((x) => isAlertaRowUrgenteVisual(x)).length,
    [alertas],
  )

  const feedScrollRef = useRef<HTMLDivElement>(null)

  const syncRadarFeedBleedWidth = useCallback(() => {
    const el = feedScrollRef.current
    if (!el) return
    // Largura total do cartão (inclui faixa da scrollbar); usada para linhas full-bleed e fundo de hover
    el.style.setProperty('--radar-feed-bleed-w', `${el.offsetWidth}px`)
    // Só reserva largura de scrollbar quando há overflow vertical real (evita falso positivo sem barra visível)
    const overflowY = el.scrollHeight > el.clientHeight + 1
    const sbw = overflowY ? Math.max(0, el.offsetWidth - el.clientWidth) : 0
    el.style.setProperty('--radar-feed-scrollbar-w', `${sbw}px`)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1200px)')
    const fn = () => {
      setWide(mq.matches)
      if (mq.matches) setDrawerAberto(false)
    }
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const alertasOrdenados = useMemo(() => {
    return [...alertas].sort(
      (a, b) => parseAlertaDateTimeMs(b) - parseAlertaDateTimeMs(a),
    )
  }, [alertas])

  const alertasFiltrados = alertasOrdenados

  const totalPaginasFeed =
    alertasFiltrados.length === 0
      ? 1
      : Math.max(1, Math.ceil(alertasFiltrados.length / ITENS_POR_PAGINA_FEED))

  const alertasPaginados = useMemo(
    () =>
      alertasFiltrados.slice(
        (paginaFeed - 1) * ITENS_POR_PAGINA_FEED,
        paginaFeed * ITENS_POR_PAGINA_FEED,
      ),
    [alertasFiltrados, paginaFeed],
  )

  const idxRodapePaginas = useMemo(
    () => indicesPaginasNumeradas(totalPaginasFeed, paginaFeed),
    [totalPaginasFeed, paginaFeed],
  )

  const primeiroIdxAlertaRodape =
    alertasPaginados.length === 0
      ? 0
      : (paginaFeed - 1) * ITENS_POR_PAGINA_FEED + 1
  const ultimoIdxAlertaRodape =
    primeiroIdxAlertaRodape === 0
      ? 0
      : primeiroIdxAlertaRodape + alertasPaginados.length - 1

  useEffect(() => {
    setPaginaFeed(1)
  }, [
    periodo,
    categoriasSelecionadas,
    ufsSelecionadas,
    substanciasSelecionadas,
    buscaDebounced,
  ])

  useEffect(() => {
    setPaginaFeed((p) => Math.min(p, Math.max(1, totalPaginasFeed)))
  }, [totalPaginasFeed])

  useEffect(() => {
    feedScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [paginaFeed])

  const { detalhe: detRadarEv, carregando: cargDetRadarEv } =
    useRadarEventoDetalhe(alertaSelecionadoId)

  /** Seleciona o alerta e abre o detalhe (sem alternar desseleção). */
  const selecionarAlertaParaDetalhe = useCallback(
    (id: string) => {
      setAlertaSelecionadoId(id)
      if (!wide) setDrawerAberto(true)
    },
    [wide],
  )

  useLayoutEffect(() => {
    const el = feedScrollRef.current
    if (!el) return
    syncRadarFeedBleedWidth()
    const ro = new ResizeObserver(() => syncRadarFeedBleedWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncRadarFeedBleedWidth, alertasPaginados.length, wide])

  useEffect(() => {
    if (
      alertaSelecionadoId &&
      !alertas.some((a) => a.id === alertaSelecionadoId)
    ) {
      setAlertaSelecionadoId(null)
      setDrawerAberto(false)
    }
  }, [alertas, alertaSelecionadoId])

  useEffect(() => {
    if (!pendingRadarAlertaId) return
    setPeriodo('90d')
  }, [pendingRadarAlertaId])

  useEffect(() => {
    if (!pendingRadarAlertaId) return
    if (!alertas.some((a) => a.id === pendingRadarAlertaId)) return
    const idParaScroll = pendingRadarAlertaId
    selecionarAlertaParaDetalhe(idParaScroll)
    setPendingRadarAlertaId(null)
    window.requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-radar-alerta-id="${idParaScroll}"]`,
      )
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [pendingRadarAlertaId, alertas, selecionarAlertaParaDetalhe, setPendingRadarAlertaId])

  const alertaSelecionado = useMemo(
    () =>
      alertaSelecionadoId
        ? alertas.find((a) => a.id === alertaSelecionadoId) ?? null
        : null,
    [alertaSelecionadoId, alertas],
  )

  const onSelectAlerta = (id: string) => {
    if (alertaSelecionadoId === id) {
      setAlertaSelecionadoId(null)
      if (!wide) setDrawerAberto(false)
    } else {
      setAlertaSelecionadoId(id)
      if (!wide) setDrawerAberto(true)
    }
  }

  const showToast = (msg: string) => {
    onToast?.(msg)
  }

  const abrirModalListaProcessos = useCallback((titulo: string, lista: RadarLinhaProc[]) => {
    setModalProcTitulo(titulo)
    setModalProcLista(lista)
    setModalProcPagIdx(1)
    setModalProcAberto(true)
  }, [])

  useEffect(() => {
    const t = Math.max(
      1,
      Math.ceil(modalProcLista.length / ITENS_MODAL_PROCESSOS),
    )
    setModalProcPagIdx((p) => Math.min(p, t))
  }, [modalProcLista])

  const modalListaPaginas = Math.max(
    1,
    Math.ceil(modalProcLista.length / ITENS_MODAL_PROCESSOS),
  )
  const modalProcSliceLista = modalProcLista.slice(
    (modalProcPagIdx - 1) * ITENS_MODAL_PROCESSOS,
    modalProcPagIdx * ITENS_MODAL_PROCESSOS,
  )

  const detalheConteudo = (mobile: boolean) => {
    if (!alertaSelecionado) {
      const totalPeriodo = resumo?.total ?? 0

      if (totalPeriodo === 0) {
        return (
          <div
            style={{
              flex: mobile ? undefined : 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
              minHeight: mobile ? 280 : 0,
              width: '100%',
            }}
          >
            <FileText size={36} color="#5F5E5A" aria-hidden />
            <div
              style={{
                marginTop: 12,
                fontSize: INTEL_KP_SUB_FS,
                fontWeight: 500,
                color: INTEL_KP_SUB_COLOR,
                textAlign: 'center',
              }}
            >
              Nenhum evento no período selecionado.
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: INTEL_KP_SUB_FS,
                color: INTEL_KP_SUB_COLOR,
                textAlign: 'center',
                maxWidth: 280,
                lineHeight: 1.4,
              }}
            >
              Tente ampliar o período ou limpar filtros.
            </div>
            <button
              type="button"
              onClick={limparFiltros}
              style={{
                marginTop: 20,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#EF9F27',
                backgroundColor: 'transparent',
                color: '#EF9F27',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 8,
                padding: '10px 20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Limpar filtros
            </button>
          </div>
        )
      }

      const porSub = resumo?.substancias_citadas ?? []
      const topSubst = porSub.slice(0, 5)
      const maxCatN = Math.max(
        1,
        ...RESUMO_PERIODO_CAT.map((c) =>
          contagemPorCategoriaApi(resumo?.por_categoria, c.api),
        ),
      )

      return (
        <div
          style={{
            padding: 20,
            boxSizing: 'border-box',
            minHeight: mobile ? undefined : '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p style={INTEL_DIST_REGIME_SECTION_TITLE}>Resumo do período</p>
          <div
            style={{
              marginTop: 16,
              fontSize: INTEL_KP_LABEL_FS,
              fontWeight: 600,
              color: '#B4B2A9',
              lineHeight: 1.35,
            }}
          >
            {totalPeriodo} {totalPeriodo === 1 ? 'evento' : 'eventos'}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: INTEL_KP_SUB_FS,
              color: INTEL_KP_SUB_COLOR,
            }}
          >
            {urgentesNoFetch}{' '}
            {urgentesNoFetch === 1 ? 'urgente' : 'urgentes'} (entre os{' '}
            {alertas.length} mais recentes)
          </div>

          <p
            style={{
              ...LABEL_SECTION,
              marginTop: 18,
              marginBottom: 0,
            }}
          >
            Por categoria
          </p>
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {RESUMO_PERIODO_CAT.map(({ api, rel, label }) => {
              const n = contagemPorCategoriaApi(resumo?.por_categoria, api)
              const wPct = (n / maxCatN) * 100
              return (
                <div
                  key={api}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#2C2C2A',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: `${wPct}%`,
                        height: '100%',
                        backgroundColor: COR_BOLINHA_RELEV[rel],
                      }}
                    />
                  </div>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: INTEL_KP_SUB_FS,
                      color: '#B4B2A9',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: INTEL_KP_SUB_FS,
                      fontWeight: 600,
                      color: '#D3D1C7',
                      flexShrink: 0,
                    }}
                  >
                    {n}
                  </span>
                </div>
              )
            })}
          </div>

          <p
            style={{
              ...LABEL_SECTION,
              marginTop: 20,
              marginBottom: 0,
            }}
          >
            UFs mais ativas
          </p>
          <div
            style={{
              marginTop: 6,
              fontSize: INTEL_KP_SUB_FS,
              color: INTEL_KP_SUB_COLOR,
              lineHeight: 1.35,
            }}
          >
            UFs com mais atos regulatórios no período
          </div>
          {totalPeriodo > 100 ? (
            <p
              className="terrae-radar-amostra-disclaimer"
              style={{
                margin: '8px 0 0',
                fontSize: 11,
                color: '#5F5E5A',
                lineHeight: 1.35,
              }}
            >
              Calculado sobre amostra de {alertas.length} eventos mais recentes
            </p>
          ) : null}
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {ufsTopSample.length === 0 ? (
              <span style={{ fontSize: INTEL_KP_SUB_FS, color: INTEL_KP_SUB_COLOR }}>—</span>
            ) : (
              ufsTopSample.map(({ uf, n }) => {
                const sel = ufsSelecionadas.includes(uf)
                return (
                  <button
                    key={uf}
                    type="button"
                    aria-pressed={sel}
                    onClick={() =>
                      setUfsSelecionadas((prev) => toggleUfNaLista(prev, uf))
                    }
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: `1px solid ${sel ? '#F59E0B' : '#3D3D3A'}`,
                      backgroundColor: sel ? 'rgba(245, 158, 11, 0.12)' : '#2C2C2A',
                      color: '#D3D1C7',
                      fontSize: INTEL_KP_SUB_FS,
                      fontFamily: 'inherit',
                      lineHeight: 1.2,
                      boxShadow: sel ? '0 0 0 1px rgba(245, 158, 11, 0.35)' : undefined,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{uf}</span>
                    <span style={{ color: '#888780', fontWeight: 500 }}>·</span>
                    <span style={{ color: '#888780', fontWeight: 500 }}>{n}</span>
                  </button>
                )
              })
            )}
          </div>

          <p
            style={{
              ...LABEL_SECTION,
              marginTop: 20,
              marginBottom: 0,
            }}
          >
            Substâncias mais citadas
          </p>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {topSubst.length === 0 ? (
              <span style={{ fontSize: INTEL_KP_SUB_FS, color: INTEL_KP_SUB_COLOR }}>—</span>
            ) : (
              topSubst.map((row) => {
                const s = row.substancia
                const sel = substJaSelecionada(substanciasSelecionadas, s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sel}
                    onClick={() =>
                      setSubstanciasSelecionadas((prev) =>
                        toggleSubstNaLista(prev, s),
                      )
                    }
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${sel ? '#F59E0B' : '#3D3D3A'}`,
                      backgroundColor: sel ? 'rgba(245, 158, 11, 0.12)' : '#2C2C2A',
                      maxWidth: '100%',
                      fontFamily: 'inherit',
                      boxShadow: sel ? '0 0 0 1px rgba(245, 158, 11, 0.35)' : undefined,
                    }}
                  >
                    <BadgeSubstancia substancia={s} variant="intelTable" />
                    <span style={{ fontSize: 12, color: '#888780', fontWeight: 500 }}>
                      ·
                    </span>
                    <span style={{ fontSize: 12, color: '#888780' }}>{row.qtd}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )
    }

    const a = alertaSelecionado

    if (alertaSelecionadoId && cargDetRadarEv && !detRadarEv) {
      return (
        <div
          style={{
            padding: mobile ? 16 : 20,
            boxSizing: 'border-box',
            color: INTEL_KP_SUB_COLOR,
            fontSize: INTEL_KP_SUB_FS,
          }}
        >
          Carregando detalhe...
        </div>
      )
    }

    const detOk = detRadarEv ?? null
    const listaProcLinhas = extrairProcessosRadarDetalhe(detOk)
    const totalProc = totalAfetadosDoDetalhe(detOk, listaProcLinhas.length)
    const rel = calcularRelevancia(a.nivel_impacto, tipoParaCalculo(a.tipo_impacto))
    const cfg = RELEVANCIA_MAP[rel]
    const bgRel = `${cfg.cor}1F`
    const tituloPainel =
      detOk &&
      typeof detOk.titulo === 'string' &&
      detOk.titulo.trim().length > 0
        ? detOk.titulo.trim()
        : a.titulo
    const textoAnalise = analiseTextoPreferDet(detOk, a)
    const textoPubLinha = textoLinhaPublicacaoDet(detOk, a)
    const quandoPubLinha =
      detOk &&
      typeof detOk.publicado_em === 'string' &&
      detOk.publicado_em.trim().length > 0
        ? formatoDataEvtDetalhe(detOk.publicado_em)
        : formatDataHoraPublicacaoPainel(a.data, a.hora)

    let douHrefFinal: string | null = null
    if (detOk) {
      const uRaw = strRadarDet(detOk, 'url_dou').trim()
      if (uRaw && /^https?:\/\//i.test(uRaw)) douHrefFinal = uRaw
    }
    if (!douHrefFinal) douHrefFinal = urlDouPublicacao(a)

    const subsPainel = subsDoDetalhe(detOk, a)
    const ufsPainel = ufsDoDetalhe(detOk)

    return (
      <div
        style={{
          padding: mobile ? 16 : 20,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: mobile ? undefined : 1,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: cfg.cor,
            backgroundColor: bgRel,
            padding: '3px 10px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          {cfg.label}
        </div>

        <h2
          style={{
            margin: '14px 0 0',
            fontSize: 18,
            fontWeight: 600,
            color: '#F1EFE8',
            lineHeight: 1.35,
          }}
        >
          {tituloPainel}
        </h2>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...LABEL_SECTION_DETAIL, letterSpacing: 0.8 }}>
            ANÁLISE TERRADAR
          </div>
          <div
            style={{
              marginTop: 8,
              borderRadius: 6,
              border: '1px solid #2C2C2A',
              overflow: 'hidden',
              backgroundColor: '#0D0D0C',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                fontSize: INTEL_KP_SUB_FS,
                color: INTEL_KP_SUB_COLOR,
                lineHeight: 1.45,
              }}
            >
              {textoAnalise}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...LABEL_SECTION_DETAIL, letterSpacing: 0.8 }}>
            PROCESSOS AFETADOS
          </div>
          <div style={{ marginTop: 8 }}>
            <SecaoProcAfetRadar
              total={totalProc}
              amostraLinhas={listaProcLinhas}
              onAbrirModal={(tit) =>
                abrirModalListaProcessos(tit, listaProcLinhas)
              }
            />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...LABEL_SECTION_DETAIL, letterSpacing: 0.8 }}>
            SUBSTÂNCIAS AFETADAS
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {subsPainel.length > 0 ? (
              subsPainel.map((s) => (
                <BadgeSubstancia key={s} substancia={s} variant="intelTable" />
              ))
            ) : (
              <span
                style={{
                  fontSize: INTEL_KP_SUB_FS,
                  color: '#5F5E5A',
                  fontStyle: 'italic',
                }}
              >
                Não especificado
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...LABEL_SECTION_DETAIL, letterSpacing: 0.8 }}>
            UFS AFETADAS
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ufsPainel.length > 0 ? (
              ufsPainel.map((uf) => (
                <span
                  key={uf}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid #3D3D3A',
                    backgroundColor: '#2C2C2A',
                    color: '#D3D1C7',
                    fontSize: 12,
                  }}
                >
                  {uf}
                </span>
              ))
            ) : (
              <span
                style={{
                  fontSize: INTEL_KP_SUB_FS,
                  color: '#5F5E5A',
                  fontStyle: 'italic',
                }}
              >
                Não especificado
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...LABEL_SECTION_DETAIL, letterSpacing: 0.8 }}>Publicação</div>
          <div style={{ marginTop: 8, fontSize: INTEL_KP_LABEL_FS, color: '#D3D1C7' }}>
            {textoPubLinha}
          </div>
          <div
            style={{ marginTop: 4, fontSize: INTEL_KP_SUB_FS, color: INTEL_KP_SUB_COLOR }}
          >
            {quandoPubLinha}
          </div>
        </div>

        {douHrefFinal ? (
          <a
            href={douHrefFinal}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 22,
              marginBottom: mobile ? 8 : 0,
              width: '100%',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: 'transparent',
              border: '1px solid #EF9F27',
              color: '#EF9F27',
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 8,
              padding: '12px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Ver no Diário Oficial <ArrowUpRight size={16} aria-hidden />
          </a>
        ) : (
          <button
            type="button"
            disabled
            style={{
              marginTop: 22,
              width: '100%',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: 'transparent',
              border: '1px solid #5F5E5A',
              color: '#5F5E5A',
              fontSize: 15,
              borderRadius: 8,
              padding: '12px',
              cursor: 'not-allowed',
              opacity: 0.65,
            }}
          >
            Ver no Diário Oficial <ArrowUpRight size={16} aria-hidden />
          </button>
        )}
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" style={{ color: '#D3D1C7', padding: 24 }}>
        Erro: {erro}
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        minHeight: 0,
        height: 'calc(100vh - 280px)',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="flex min-h-0 flex-1"
        style={{
          marginTop: 20,
          gap: 16,
          minHeight: 0,
          flex: 1,
          alignItems: 'stretch',
        }}
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{
            flex: wide ? '1 1 0%' : '1 1 auto',
            minWidth: wide ? 360 : 0,
            minHeight: 0,
            backgroundColor: 'rgba(26, 26, 24, 0.85)',
            backdropFilter: 'blur(34px)',
            WebkitBackdropFilter: 'blur(34px)',
            border: '1px solid #2C2C2A',
            borderRadius: 8,
            position: 'relative',
            zIndex: 1,
            overflow: 'hidden',
          }}
        >
          {carregando ? (
            <div
              aria-hidden
              className="terrae-radar-feed-loading-strip"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 20,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            />
          ) : null}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              flexShrink: 0,
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 'var(--radar-feed-bleed-w, 100%)',
                backgroundColor: 'rgba(26, 26, 24, 0.95)',
                backdropFilter: 'blur(34px)',
                WebkitBackdropFilter: 'blur(34px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding:
                  '16px max(10px, calc(20px - var(--radar-feed-scrollbar-w, 0px))) 16px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  ...INTEL_DIST_REGIME_SECTION_TITLE,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  fontWeight: 600,
                  lineHeight: 1.25,
                }}
              >
                {alertasFiltrados.length}{' '}
                {alertasFiltrados.length === 1 ? 'Alerta' : 'Alertas'}
                {resumo != null && resumo.total > alertasFiltrados.length ? (
                  <span style={{ color: '#5F5E5A', fontWeight: 400 }}>
                    {' '}
                    (de {resumo.total} no período)
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  color: '#5F5E5A',
                  userSelect: 'none',
                  fontSize: INTEL_DIST_REGIME_SECTION_TITLE.fontSize,
                  lineHeight: 1.25,
                }}
              >
                {' '}
                ·{' '}
              </span>
              <span
                style={{
                  fontWeight: 400,
                  color: '#888780',
                  fontSize: INTEL_DIST_REGIME_SECTION_TITLE.fontSize,
                  lineHeight: 1.25,
                }}
              >
                Atualizado {atualizadoLabel}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <PeriodoSingleDropdown
                value={periodo}
                onChange={setPeriodo}
                aberto={ddPeriodo}
                setAberto={setDdPeriodo}
                reducedMotion={reducedMotion}
              />
              <MultiSelectDropdown
                prefix={prefixCat}
                options={CATEGORIAS_FILTRO_API as unknown as string[]}
                selected={categoriasSelecionadas}
                onChange={setCategoriasSelecionadas}
                aberto={ddCat}
                setAberto={setDdCat}
                triggerStyle={RADAR_ALERTAS_FILTER_TRIGGER_STYLE}
                formatOption={(o) => labelCategoriaFiltro(o)}
              />
              <MultiSelectDropdown
                prefix={prefixUf}
                options={BR_UFS_ALL as unknown as string[]}
                selected={ufsSelecionadas}
                onChange={setUfsSelecionadas}
                aberto={ddUf}
                setAberto={setDdUf}
                triggerStyle={RADAR_ALERTAS_FILTER_TRIGGER_STYLE}
              />
              <div
                style={{
                  position: 'relative',
                  width: 180,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  height: 36,
                  padding: '0 12px 0 34px',
                  backgroundColor: '#111110',
                  border: `1px solid ${buscaFocada ? '#EF9F27' : '#2C2C2A'}`,
                  borderRadius: 6,
                  transition: 'border-color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={14}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: buscaFocada ? '#EF9F27' : '#888780',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onFocus={() => setBuscaFocada(true)}
                  onBlur={() => setBuscaFocada(false)}
                  placeholder="Buscar..."
                  autoComplete="off"
                  className="terrae-intel-busca-processos"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: 14,
                    lineHeight: 1.25,
                    color: '#F1EFE8',
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  }}
                />
              </div>
            </div>
            {substanciasSelecionadas.length > 0 ? (
              <div
                style={{
                  width: '100%',
                  flexBasis: '100%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                  paddingTop: 8,
                  borderTop: '1px solid #2C2C2A',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#888780',
                    marginRight: 4,
                  }}
                >
                  Filtros ativos:
                </span>
                {substanciasSelecionadas.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() =>
                      setSubstanciasSelecionadas((prev) =>
                        prev.filter((s) => s !== sub),
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #EF9F27',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      color: '#FCD34D',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      lineHeight: 1.2,
                      maxWidth: '100%',
                    }}
                    aria-label={`Remover filtro Substância: ${sub}`}
                  >
                    <span aria-hidden style={{ opacity: 0.85 }}>
                      ×
                    </span>
                    Substância: {sub}
                  </button>
                ))}
              </div>
            ) : null}
            </div>
          </div>
          <div
            style={{
              height: 1,
              backgroundColor: '#2C2C2A',
              width: 'var(--radar-feed-bleed-w, 100%)',
              maxWidth: 'var(--radar-feed-bleed-w, none)',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <div
            ref={feedScrollRef}
            className="terrae-intel-dashboard-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              position: 'relative',
              opacity: carregando ? 0.7 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            {carregando && alertasFiltrados.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  boxSizing: 'border-box',
                  color: INTEL_KP_SUB_COLOR,
                  fontSize: INTEL_KP_SUB_FS,
                }}
              >
                Carregando alertas...
              </div>
            ) : alertasFiltrados.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    maxWidth: 320,
                  }}
                >
                  <Bell size={40} color="#5F5E5A" aria-hidden />
                  <div
                    style={{
                      marginTop: 16,
                      fontSize: INTEL_KP_LABEL_FS,
                      fontWeight: 500,
                      color: INTEL_KP_LABEL_COLOR,
                    }}
                  >
                    Nenhum alerta para o período
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: INTEL_KP_SUB_FS,
                      color: INTEL_KP_SUB_COLOR,
                    }}
                  >
                    Tente ampliar o período ou ajustar os filtros
                  </div>
                  <button
                    type="button"
                    onClick={limparFiltros}
                    style={{
                      marginTop: 20,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: '#5F5E5A',
                      backgroundColor: 'transparent',
                      color: '#D3D1C7',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 6,
                      padding: '8px 20px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.15s ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#EF9F27'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#5F5E5A'
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            ) : (
              alertasPaginados.map((a) => {
                const rel = calcularRelevancia(
                  a.nivel_impacto,
                  tipoParaCalculo(a.tipo_impacto),
                )
                const corBolinha = COR_BOLINHA_RELEV[rel]
                const corBordaSel = COR_BOLINHA_RELEV[rel]
                const sel = alertaSelecionadoId === a.id
                const rowEnr = a as RadarEventoEnriquecido
                const urgenteRow = isAlertaRowUrgenteVisual(rowEnr)

                const rowBg = sel ? 'rgba(239, 159, 39, 0.08)' : 'transparent'

                const bordaEsquerda = sel
                  ? `4px solid ${corBordaSel}`
                  : urgenteRow
                    ? `4px solid ${BORDA_URGENTE_FEED}`
                    : `3px solid transparent`

                const corpoLinha = (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: corBolinha,
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: INTEL_KP_LABEL_FS,
                          fontWeight: 500,
                          color: INTEL_KP_LABEL_COLOR,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {a.titulo}
                      </span>
                      {isNovo7d(a.data) ? (
                        <span
                          style={{
                            backgroundColor: 'rgba(239,159,39,0.12)',
                            color: '#EF9F27',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            flexShrink: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          NOVO
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        marginLeft: 16,
                        fontSize: INTEL_KP_SUB_FS,
                        color: INTEL_KP_SUB_COLOR,
                        lineHeight: 1.4,
                      }}
                    >
                      {a.fonte_nome_completo}
                      <span> · </span>
                      {formatDataHoraPublicacaoPainel(a.data, a.hora)}
                    </div>
                  </div>
                )

                return (
                  <button
                    key={a.id}
                    type="button"
                    data-radar-alerta-id={a.id}
                    aria-current={sel ? 'true' : undefined}
                    onClick={() => onSelectAlerta(a.id)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      display: 'block',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      boxSizing: 'border-box',
                      textAlign: 'left',
                      opacity: 1,
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        height: 1,
                        width: 'var(--radar-feed-bleed-w, 100%)',
                        backgroundColor: '#2C2C2A',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 'var(--radar-feed-bleed-w, 100%)',
                        borderLeft: bordaEsquerda,
                        borderTop: sel ? '1px solid rgba(239, 159, 39, 0.15)' : 'none',
                        borderRight: sel
                          ? '1px solid rgba(239, 159, 39, 0.15)'
                          : 'none',
                        borderBottom: sel
                          ? '1px solid rgba(239, 159, 39, 0.15)'
                          : 'none',
                        backgroundColor: rowBg,
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                        zIndex: 0,
                        transition:
                          'background-color 0.15s ease, border-color 0.15s ease',
                      }}
                    />
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        padding:
                          '12px max(10px, calc(20px - var(--radar-feed-scrollbar-w, 0px))) 12px 17px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {corpoLinha}
                    </div>
                  </button>
                )
              })
            )}
          </div>
          {alertasFiltrados.length > 0 ? (
            <div
              style={{
                flexShrink: 0,
                borderTop: '1px solid #2C2C2A',
                padding:
                  '10px max(12px, calc(16px - var(--radar-feed-scrollbar-w, 0px)))',
                backgroundColor: 'rgba(26, 26, 24, 0.98)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#888780',
                  lineHeight: 1.35,
                }}
              >
                Página {paginaFeed} de {totalPaginasFeed} ·{' '}
                {primeiroIdxAlertaRodape > 0 && ultimoIdxAlertaRodape > 0
                  ? `${primeiroIdxAlertaRodape}–${ultimoIdxAlertaRodape} de `
                  : null}
                {alertasFiltrados.length}{' '}
                {alertasFiltrados.length === 1 ? 'alerta' : 'alertas'}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                  rowGap: 8,
                  justifyContent: 'space-between',
                }}
              >
                <button
                  type="button"
                  disabled={paginaFeed <= 1}
                  aria-label="Página anterior"
                  onClick={() => setPaginaFeed((p) => Math.max(1, p - 1))}
                  style={{
                    border: '1px solid #3D3D3A',
                    background: paginaFeed <= 1 ? '#1E1E1C' : 'transparent',
                    color: paginaFeed <= 1 ? '#5F5E5A' : '#D3D1C7',
                    fontSize: 12,
                    borderRadius: 6,
                    padding: '6px 10px',
                    cursor: paginaFeed <= 1 ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ‹ Anterior
                </button>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {idxRodapePaginas.map((ix, ki) =>
                    ix === 'ellipsis' ? (
                      <span
                        key={`e-${ki}`}
                        style={{ color: '#5F5E5A', fontSize: 12, padding: '0 4px' }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={ix}
                        type="button"
                        aria-label={`Página ${ix}`}
                        aria-current={ix === paginaFeed ? 'page' : undefined}
                        onClick={() => setPaginaFeed(ix)}
                        style={{
                          minWidth: 30,
                          height: 30,
                          borderRadius: 4,
                          border:
                            ix === paginaFeed
                              ? '1px solid #EF9F27'
                              : '1px solid #3D3D3A',
                          background:
                            ix === paginaFeed
                              ? 'rgba(239,159,39,0.14)'
                              : 'transparent',
                          color: ix === paginaFeed ? '#EF9F27' : '#D3D1C7',
                          fontSize: 13,
                          fontWeight: ix === paginaFeed ? 600 : 400,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          padding: '0 4px',
                        }}
                      >
                        {ix}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  disabled={paginaFeed >= totalPaginasFeed}
                  aria-label="Próxima página"
                  onClick={() =>
                    setPaginaFeed((p) =>
                      Math.min(totalPaginasFeed, p + 1),
                    )
                  }
                  style={{
                    border: '1px solid #3D3D3A',
                    background:
                      paginaFeed >= totalPaginasFeed ? '#1E1E1C' : 'transparent',
                    color:
                      paginaFeed >= totalPaginasFeed ? '#5F5E5A' : '#D3D1C7',
                    fontSize: 12,
                    borderRadius: 6,
                    padding: '6px 10px',
                    cursor:
                      paginaFeed >= totalPaginasFeed ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Próximo ›
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {wide ? (
          <div
            className="terrae-intel-dashboard-scroll flex min-h-0 flex-col overflow-y-auto"
            style={{
              flex: wide ? '0 0 420px' : '3 1 0%',
              width: wide ? 420 : undefined,
              maxWidth: wide ? 420 : undefined,
              minWidth: wide ? 300 : 360,
              minHeight: 0,
              alignSelf: 'stretch',
              backgroundColor: 'rgba(26, 26, 24, 0.85)',
              backdropFilter: 'blur(34px)',
              WebkitBackdropFilter: 'blur(34px)',
              border: '1px solid #2C2C2A',
              borderRadius: 8,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {detalheConteudo(false)}
          </div>
        ) : null}
      </div>

      {!wide && drawerAberto && alertaSelecionado ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          role="presentation"
          onClick={() => setDrawerAberto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="terrae-intel-dashboard-scroll overflow-y-auto"
            style={{
              width: 'min(400px, 100vw)',
              maxWidth: '100%',
              height: '100%',
              backgroundColor: 'rgba(26, 26, 24, 0.85)',
              backdropFilter: 'blur(34px)',
              WebkitBackdropFilter: 'blur(34px)',
              borderLeft: '1px solid #2C2C2A',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
              animation: reducedMotion ? undefined : 'terraeRadarDrawerIn 220ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: 12,
                borderBottom: '1px solid #2C2C2A',
              }}
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => {
                  setDrawerAberto(false)
                  setAlertaSelecionadoId(null)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#888780',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={22} />
              </button>
            </div>
            {detalheConteudo(true)}
          </div>
        </div>
      ) : null}

      {typeof document !== 'undefined' && modalProcAberto
        ? createPortal(
            <TooltipProvider delayDuration={400}>
              <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 140,
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                boxSizing: 'border-box',
              }}
              onClick={() => setModalProcAberto(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="radar-modal-proc-titulo"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'min(560px, 100%)',
                  maxHeight: 'min(580px, 88vh)',
                  backgroundColor: '#1A1A18',
                  borderRadius: 8,
                  border: '1px solid #2C2C2A',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderBottom: '1px solid #2C2C2A',
                  }}
                >
                  <div
                    id="radar-modal-proc-titulo"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#F1EFE8',
                      minWidth: 0,
                    }}
                  >
                    {modalProcTitulo}
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar"
                    onClick={() => setModalProcAberto(false)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#888780',
                      cursor: 'pointer',
                      padding: 4,
                      flexShrink: 0,
                    }}
                  >
                    <X size={22} />
                  </button>
                </div>
                <div
                  className="terrae-intel-dashboard-scroll"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    padding: '12px 16px 16px',
                    boxSizing: 'border-box',
                  }}
                >
                  {modalProcSliceLista.length === 0 ? (
                    <div
                      style={{
                        fontSize: INTEL_KP_SUB_FS,
                        color: INTEL_KP_SUB_COLOR,
                      }}
                    >
                      Nenhum processo na lista.
                    </div>
                  ) : (
                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {modalProcSliceLista.map((row) => (
                        <li
                          key={row.id || row.numero}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #2C2C2A',
                            backgroundColor: '#0D0D0C',
                            cursor: 'default',
                            listStyle: 'none',
                          }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  maxWidth: '100%',
                                  cursor: 'default',
                                }}
                              >
                                {/* TODO Frente 2.E: click na pílula deve abrir processo no mapa com drawer */}
                                <PilulaProcessoNeutral
                                  numero={row.numero || row.id}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Em breve: clique para abrir processo no mapa
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {modalListaPaginas > 1 ? (
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '10px 16px',
                      borderTop: '1px solid #2C2C2A',
                      fontSize: 12,
                      color: '#888780',
                    }}
                  >
                    <span>
                      Página {modalProcPagIdx} de {modalListaPaginas} ·{' '}
                      {modalProcLista.length}{' '}
                      {modalProcLista.length === 1 ? 'processo' : 'processos'}
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        disabled={modalProcPagIdx <= 1}
                        onClick={() =>
                          setModalProcPagIdx((p) => Math.max(1, p - 1))
                        }
                        style={{
                          border: '1px solid #3D3D3A',
                          background: 'transparent',
                          color: modalProcPagIdx <= 1 ? '#5F5E5A' : '#D3D1C7',
                          fontSize: 12,
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: modalProcPagIdx <= 1 ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={modalProcPagIdx >= modalListaPaginas}
                        onClick={() =>
                          setModalProcPagIdx((p) =>
                            Math.min(modalListaPaginas, p + 1),
                          )
                        }
                        style={{
                          border: '1px solid #3D3D3A',
                          background: 'transparent',
                          color:
                            modalProcPagIdx >= modalListaPaginas
                              ? '#5F5E5A'
                              : '#D3D1C7',
                          fontSize: 12,
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor:
                            modalProcPagIdx >= modalListaPaginas
                              ? 'not-allowed'
                              : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            </TooltipProvider>,
            document.body,
          )
        : null}

    </div>
  )
}
