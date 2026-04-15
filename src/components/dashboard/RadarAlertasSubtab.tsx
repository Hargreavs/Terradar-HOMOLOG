import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import {
  RADAR_ALERTAS_MOCK,
  type RadarAlerta,
} from '../../data/radar-alertas.mock'
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import {
  calcularRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
  type TipoImpacto,
} from '../../lib/relevanciaAlerta'
import { motionMs } from '../../lib/motionDurations'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'
import { TODAS_SUBST } from '../../lib/substancias'

const RELEV_ORDER: Relevancia[] = [
  'critico',
  'desfavoravel',
  'neutro',
  'positivo',
  'favoravel',
]

type PeriodoKey = 'hoje' | '7d' | '30d' | '90d' | 'personalizar'

const PERIODO_OPCOES: { id: PeriodoKey; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'personalizar', label: 'Personalizar' },
]

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

function alertaPassaPeriodo(
  a: RadarAlerta,
  periodo: PeriodoKey,
  customDe: string,
  customAte: string,
): boolean {
  const ms = parseAlertaDateTimeMs(a)
  const day = a.data.slice(0, 10)
  if (periodo === 'hoje') return day === ymdToday()
  if (periodo === '7d')
    return ms >= Date.now() - 7 * 86400000
  if (periodo === '30d')
    return ms >= Date.now() - 30 * 86400000
  if (periodo === '90d')
    return ms >= Date.now() - 90 * 86400000
  if (periodo === 'personalizar') {
    if (!customDe || !customAte) return true
    const t0 = new Date(`${customDe}T00:00:00`).getTime()
    const t1 = new Date(`${customAte}T23:59:59`).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return true
    return ms >= t0 && ms <= t1
  }
  return true
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

function labelRelevResumoPalavra(k: Relevancia, n: number): string {
  const one: Record<Relevancia, string> = {
    critico: 'Crítico',
    desfavoravel: 'Desfavorável',
    neutro: 'Neutro',
    positivo: 'Positivo',
    favoravel: 'Favorável',
  }
  const many: Record<Relevancia, string> = {
    critico: 'Críticos',
    desfavoravel: 'Desfavoráveis',
    neutro: 'Neutros',
    positivo: 'Positivos',
    favoravel: 'Favoráveis',
  }
  return n === 1 ? one[k] : many[k]
}

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

function corRiscoProcesso(score: number | null): string {
  if (score == null) return '#888780'
  if (score < 40) return '#1D9E75'
  if (score < 70) return '#EF9F27'
  return '#E24B4A'
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

const DISCLAIMER_RELEVANCIA: Record<Relevancia, string> = {
  critico:
    'Este alerta foi classificado como crítico porque tem alto impacto restritivo sobre os processos monitorados. Requer atenção imediata e pode exigir ações urgentes de compliance ou revisão de cronogramas.',
  desfavoravel:
    'Este alerta foi classificado como desfavorável porque tem impacto restritivo de nível médio sobre os processos monitorados. Pode afetar cronogramas e exigir ações de compliance.',
  neutro:
    'Este alerta foi classificado como neutro porque tem caráter informativo, sem impacto direto significativo sobre os processos monitorados. Recomenda-se acompanhamento.',
  positivo:
    'Este alerta foi classificado como positivo porque traz impacto favorável moderado para os processos monitorados. Pode representar oportunidades de simplificação ou agilização.',
  favoravel:
    'Este alerta foi classificado como favorável porque tem alto impacto positivo sobre os processos monitorados. Representa oportunidades significativas ou redução de barreiras regulatórias.',
}

function tooltipProcessoRisk(label: string, riskScore: number | null): string {
  if (riskScore == null) {
    return `${label}. Risco não avaliado`
  }
  if (riskScore < 40) {
    return `${label}. Risco: ${riskScore}/100 (Baixo)`
  }
  if (riskScore < 70) {
    return `${label}. Risco: ${riskScore}/100 (Médio)`
  }
  return `${label}. Risco: ${riskScore}/100 (Alto)`
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
  const label = PERIODO_OPCOES.find((o) => o.id === value)?.label ?? 'Hoje'
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

export function RadarAlertasSubtab({
  reducedMotion,
  onToast,
}: {
  reducedMotion: boolean
  onToast?: (msg: string) => void
}) {
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)
  const pendingRadarAlertaId = useAppStore((s) => s.pendingRadarAlertaId)
  const setPendingRadarAlertaId = useAppStore((s) => s.setPendingRadarAlertaId)
  const processos = useMapStore((s) => s.processos)
  const setPendingNavigation = useMapStore((s) => s.setPendingNavigation)

  const processoById = useMemo(() => {
    const m = new Map<string, Processo>()
    for (const p of processos) m.set(p.id, p)
    return m
  }, [processos])

  const substanciasCatalogo = useMemo(() => {
    const s = new Set<string>()
    for (const p of processos) s.add(p.substancia)
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos])

  const [periodo, setPeriodo] = useState<PeriodoKey>('hoje')
  const [customDe, setCustomDe] = useState(ymdToday())
  const [customAte, setCustomAte] = useState(ymdToday())
  const [substSel, setSubstSel] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [buscaFocada, setBuscaFocada] = useState(false)
  const [ddPeriodo, setDdPeriodo] = useState(false)
  const [ddSub, setDdSub] = useState(false)
  const [alertaSelecionadoId, setAlertaSelecionadoId] = useState<string | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [wide, setWide] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1200px)').matches : true,
  )

  const [hoveredSubstancia, setHoveredSubstancia] = useState<string | null>(null)
  const [hoveredRelevancia, setHoveredRelevancia] = useState<Relevancia | null>(null)
  const [feedRowHoveredId, setFeedRowHoveredId] = useState<string | null>(null)

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

  const onSubstChange = useCallback((next: string[]) => {
    setSubstSel((prev) => {
      if (next.includes(TODAS_SUBST)) {
        if (!prev.includes(TODAS_SUBST)) return [TODAS_SUBST]
        return next.filter((x) => x !== TODAS_SUBST)
      }
      return next
    })
  }, [])

  const substOpcoes = useMemo(() => [TODAS_SUBST, ...substanciasCatalogo], [substanciasCatalogo])
  const prefixSub =
    substSel.length === 0 || substSel.includes(TODAS_SUBST)
      ? 'Todas'
      : substSel.length === 1
        ? substSel[0]!
        : `${substSel.length} substâncias`

  const alertasFiltrados = useMemo(() => {
    return RADAR_ALERTAS_MOCK.filter((a) => {
      if (!alertaPassaPeriodo(a, periodo, customDe, customAte)) return false
      const subFiltro = substSel.filter((x) => x !== TODAS_SUBST)
      if (subFiltro.length > 0) {
        const ok = a.substancias_afetadas.some((s) => subFiltro.includes(s))
        if (!ok) return false
      }
      const q = busca.trim().toLowerCase()
      if (q) {
        const blob = `${a.titulo} ${analiseTexto(a)} ${a.ementa}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [periodo, customDe, customAte, substSel, busca])

  const alertasOrdenados = useMemo(() => {
    return [...alertasFiltrados].sort(
      (a, b) => parseAlertaDateTimeMs(b) - parseAlertaDateTimeMs(a),
    )
  }, [alertasFiltrados])

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
  }, [syncRadarFeedBleedWidth, alertasOrdenados.length, wide])

  useEffect(() => {
    if (
      alertaSelecionadoId &&
      !alertasFiltrados.some((a) => a.id === alertaSelecionadoId)
    ) {
      setAlertaSelecionadoId(null)
      setDrawerAberto(false)
    }
  }, [alertasFiltrados, alertaSelecionadoId])

  useEffect(() => {
    if (!pendingRadarAlertaId) return
    setPeriodo('90d')
  }, [pendingRadarAlertaId])

  useEffect(() => {
    if (!pendingRadarAlertaId) return
    if (!alertasFiltrados.some((a) => a.id === pendingRadarAlertaId)) return
    const idParaScroll = pendingRadarAlertaId
    selecionarAlertaParaDetalhe(idParaScroll)
    setPendingRadarAlertaId(null)
    window.requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-radar-alerta-id="${idParaScroll}"]`,
      )
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [pendingRadarAlertaId, alertasFiltrados, selecionarAlertaParaDetalhe, setPendingRadarAlertaId])

  const hojeYmd = ymdToday()

  const alertasHojeResumo = useMemo(
    () => RADAR_ALERTAS_MOCK.filter((a) => a.data.slice(0, 10) === hojeYmd),
    [hojeYmd],
  )

  const resumoDiaStats = useMemo(() => {
    const rel = new Map<Relevancia, number>()
    for (const k of RELEV_ORDER) rel.set(k, 0)
    for (const a of alertasHojeResumo) {
      const r = calcularRelevancia(a.nivel_impacto, tipoParaCalculo(a.tipo_impacto))
      rel.set(r, (rel.get(r) ?? 0) + 1)
    }
    const subCount = new Map<string, number>()
    for (const a of alertasHojeResumo) {
      for (const s of a.substancias_afetadas) {
        subCount.set(s, (subCount.get(s) ?? 0) + 1)
      }
    }
    const topSub = [...subCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    return { rel, topSub, n: alertasHojeResumo.length }
  }, [alertasHojeResumo])

  const alertaSelecionado = useMemo(
    () =>
      alertaSelecionadoId
        ? alertasFiltrados.find((a) => a.id === alertaSelecionadoId) ?? null
        : null,
    [alertaSelecionadoId, alertasFiltrados],
  )

  const navigateProcessoMapa = useCallback(
    (id: string) => {
      setPendingNavigation({
        type: 'processo',
        payload: id,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
      setDrawerAberto(false)
    },
    [setPendingNavigation, setTelaAtiva],
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

  const detalheConteudo = (mobile: boolean) => {
    if (!alertaSelecionado) {
      if (resumoDiaStats.n === 0) {
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
              Sem atividade hoje
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: INTEL_KP_SUB_FS,
                color: INTEL_KP_SUB_COLOR,
                textAlign: 'center',
                maxWidth: 220,
                lineHeight: 1.4,
              }}
            >
              Alertas aparecerão aqui conforme forem publicados
            </div>
          </div>
        )
      }

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
          <p style={INTEL_DIST_REGIME_SECTION_TITLE}>Resumo do dia</p>
          <div
            style={{
              marginTop: 16,
              fontSize: INTEL_KP_LABEL_FS,
              fontWeight: 600,
              color: '#B4B2A9',
              lineHeight: 1.35,
            }}
          >
            {resumoDiaStats.n} alertas publicados hoje
          </div>
          {resumoDiaStats.n > 0 ? (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 1,
                width: '100%',
                height: 8,
                minHeight: 0,
                borderRadius: 4,
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              {(() => {
                const activeKeys = RELEV_ORDER.filter(
                  (rk) => (resumoDiaStats.rel.get(rk) ?? 0) > 0,
                )
                const len = activeKeys.length
                return activeKeys.map((k, i) => {
                  const n = resumoDiaStats.rel.get(k) ?? 0
                  let borderRadius: number | string
                  if (len === 1) borderRadius = 4
                  else if (i === 0) borderRadius = '4px 0 0 4px'
                  else if (i === len - 1) borderRadius = '0 4px 4px 0'
                  else borderRadius = 0
                  const segDim =
                    hoveredSubstancia === null &&
                    hoveredRelevancia !== null &&
                    hoveredRelevancia !== k
                  return (
                    <div
                      key={k}
                      role="presentation"
                      onMouseEnter={() => {
                        setHoveredRelevancia(k)
                        setHoveredSubstancia(null)
                      }}
                      onMouseLeave={() => setHoveredRelevancia(null)}
                      style={{
                        flexGrow: n,
                        flexShrink: 1,
                        flexBasis: 0,
                        minWidth: 0,
                        height: 8,
                        backgroundColor: COR_BOLINHA_RELEV[k],
                        borderRadius,
                        cursor: 'pointer',
                        opacity: segDim ? 0.3 : 1,
                        transition: 'opacity 0.15s ease',
                      }}
                    />
                  )
                })
              })()}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 8,
              fontSize: INTEL_KP_SUB_FS,
              lineHeight: 1.4,
              color: '#888780',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0 4px',
            }}
          >
            {(() => {
              const chunks: ReactNode[] = []
              let first = true
              for (const k of RELEV_ORDER) {
                const n = resumoDiaStats.rel.get(k) ?? 0
                if (n === 0) continue
                const inlineDim =
                  hoveredSubstancia === null &&
                  hoveredRelevancia !== null &&
                  hoveredRelevancia !== k
                if (!first) {
                  chunks.push(
                    <span
                      key={`sep-${k}`}
                      style={{
                        color: '#888780',
                        opacity: inlineDim ? 0.3 : 1,
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      {' '}
                      ·{' '}
                    </span>,
                  )
                }
                first = false
                chunks.push(
                  <span
                    key={k}
                    role="presentation"
                    onMouseEnter={() => {
                      setHoveredRelevancia(k)
                      setHoveredSubstancia(null)
                    }}
                    onMouseLeave={() => setHoveredRelevancia(null)}
                    style={{
                      cursor: 'pointer',
                      opacity: inlineDim ? 0.3 : 1,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <span style={{ color: RELEVANCIA_MAP[k].cor }} aria-hidden>
                      ●
                    </span>
                    <span style={{ color: '#888780' }}>
                      {` ${n} ${labelRelevResumoPalavra(k, n)}`}
                    </span>
                  </span>,
                )
              }
              return chunks
            })()}
          </div>
          <div
            style={{
              marginTop: 16,
              marginLeft: -20,
              marginRight: -20,
              height: 1,
              backgroundColor: '#2C2C2A',
              flexShrink: 0,
            }}
            aria-hidden
          />
          {resumoDiaStats.topSub.length > 0 ? (
            <>
              <div
                style={{
                  marginTop: 16,
                  fontSize: INTEL_KP_SUB_FS,
                  fontWeight: 500,
                  color: '#B4B2A9',
                }}
              >
                Substâncias citadas:
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {resumoDiaStats.topSub.map(([s]) => {
                  const corSub = corSubstanciaOuUndefined(s) ?? '#5F5E5A'
                  const match = normSubStr(s) === normSubStr(hoveredSubstancia ?? '')
                  const badgeDim =
                    hoveredSubstancia !== null && !match
                  return (
                    <span
                      key={s}
                      role="presentation"
                      onMouseEnter={() => {
                        setHoveredSubstancia(s)
                        setHoveredRelevancia(null)
                      }}
                      onMouseLeave={() => setHoveredSubstancia(null)}
                      style={{
                        cursor: 'pointer',
                        display: 'inline-block',
                        opacity: badgeDim ? 0.4 : 1,
                        transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
                        borderRadius: 4,
                        boxShadow:
                          hoveredSubstancia !== null && match
                            ? `0 0 12px ${corSub}66, 0 0 2px ${corSub}`
                            : undefined,
                      }}
                    >
                      <BadgeSubstancia substancia={s} variant="intelTable" />
                    </span>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      )
    }

    const a = alertaSelecionado
    const rel = calcularRelevancia(a.nivel_impacto, tipoParaCalculo(a.tipo_impacto))
    const cfg = RELEVANCIA_MAP[rel]
    const bgRel = `${cfg.cor}1F`

    return (
      <div
        style={{
          padding: 20,
          boxSizing: 'border-box',
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
              margin: '12px 0 0 0',
              fontSize: 15,
              fontWeight: 500,
              color: '#F1EFE8',
              lineHeight: 1.4,
            }}
          >
            {a.titulo}
          </h2>
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                ...LABEL_SECTION_DETAIL,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Análise Terrae
              <Sparkles size={16} color="#F1B85A" style={{ opacity: 0.8, flexShrink: 0 }} />
            </div>
            <div
              style={{
                marginTop: 8,
                borderRadius: 6,
                border: '1px solid #2C2C2A',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#0D0D0C',
                  fontSize: INTEL_KP_SUB_FS,
                  color: INTEL_KP_SUB_COLOR,
                  lineHeight: 1.4,
                }}
              >
                {analiseTexto(a)}
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  backgroundColor: `${cfg.cor}0A`,
                  borderTop: '1px solid #2C2C2A',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: '#888780',
                    lineHeight: 1.5,
                  }}
                >
                  {DISCLAIMER_RELEVANCIA[rel]}
                </p>
              </div>
            </div>
          </div>
          <div
            style={{
              height: 1,
              backgroundColor: '#2C2C2A',
              marginTop: 16,
              marginBottom: 16,
            }}
            aria-hidden
          />
          <div>
            <div style={LABEL_SECTION_DETAIL}>Processos afetados</div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.processos_afetados_ids.map((id) => {
              const p = processoById.get(id)
              const label = p?.numero ?? id
              const riskScore = p?.risk_score ?? null
              const corR = corRiscoProcesso(riskScore)
              const tooltipText = tooltipProcessoRisk(label, riskScore)
              return (
                <button
                  key={id}
                  type="button"
                  title={tooltipText}
                  onClick={() => navigateProcessoMapa(id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#2C2C2A',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#3D3D3A',
                    color: '#D3D1C7',
                    fontSize: 12,
                    borderRadius: 4,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#EF9F27'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#3D3D3A'
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: corR,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  {label}
                </button>
              )
            })}
            </div>
          </div>
          <div
            style={{
              height: 1,
              backgroundColor: '#2C2C2A',
              marginTop: 16,
              marginBottom: 16,
            }}
            aria-hidden
          />
          <div>
            <div style={LABEL_SECTION_DETAIL}>Substâncias afetadas</div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {a.substancias_afetadas.map((s) => (
                <BadgeSubstancia key={s} substancia={s} variant="intelTable" />
              ))}
            </div>
          </div>
          <div
            style={{
              height: 1,
              backgroundColor: '#2C2C2A',
              marginTop: 16,
              marginBottom: 16,
            }}
            aria-hidden
          />
          <div>
            <div style={LABEL_SECTION_DETAIL}>Publicação</div>
            <div
              style={{
                marginTop: 8,
                fontSize: INTEL_KP_LABEL_FS,
                color: '#D3D1C7',
              }}
            >
              {a.fonte_nome_completo}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: INTEL_KP_SUB_FS,
                color: INTEL_KP_SUB_COLOR,
              }}
            >
              {formatDataHoraPublicacaoPainel(a.data, a.hora)}
            </div>
          </div>
        <button
          type="button"
          onClick={() => {
            showToast('Disponível em produção')
          }}
          style={{
            marginTop: 24,
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
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 159, 39, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          Ver no Diário
          <ArrowUpRight size={16} aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", minHeight: 0 }}
    >
      <div
        className="flex min-h-0 flex-1"
        style={{
          marginTop: 20,
          gap: 16,
          minHeight: '50vh',
        }}
      >
        <div
          ref={feedScrollRef}
          className="terrae-intel-dashboard-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
          style={{
            flex: wide ? '7 1 0%' : '1 1 auto',
            minWidth: wide ? 500 : 0,
            minHeight: 0,
            backgroundColor: 'rgba(26, 26, 24, 0.85)',
            backdropFilter: 'blur(34px)',
            WebkitBackdropFilter: 'blur(34px)',
            border: '1px solid #2C2C2A',
            borderRadius: 8,
            position: 'relative',
            zIndex: 1,
          }}
        >
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
                Atualizado há 3 min
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
              {periodo === 'personalizar' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={customDe}
                    onChange={(e) => setCustomDe(e.target.value)}
                    style={{
                      backgroundColor: '#0D0D0C',
                      border: '1px solid #2C2C2A',
                      borderRadius: 6,
                      color: '#D3D1C7',
                      padding: '8px 10px',
                      fontSize: 13,
                    }}
                  />
                  <span style={{ color: '#5F5E5A', fontSize: 12 }}>até</span>
                  <input
                    type="date"
                    value={customAte}
                    onChange={(e) => setCustomAte(e.target.value)}
                    style={{
                      backgroundColor: '#0D0D0C',
                      border: '1px solid #2C2C2A',
                      borderRadius: 6,
                      color: '#D3D1C7',
                      padding: '8px 10px',
                      fontSize: 13,
                    }}
                  />
                </div>
              ) : null}
              <MultiSelectDropdown
                prefix={prefixSub}
                options={substOpcoes}
                selected={substSel}
                onChange={onSubstChange}
                aberto={ddSub}
                setAberto={setDdSub}
                triggerStyle={RADAR_ALERTAS_FILTER_TRIGGER_STYLE}
                formatOption={(o) => (o === TODAS_SUBST ? 'Todas' : o)}
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
            {alertasOrdenados.length === 0 ? (
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
                    onClick={() => {
                      setPeriodo('30d')
                      setDdPeriodo(false)
                    }}
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
                    Ver últimos 30 dias
                  </button>
                </div>
              </div>
            ) : (
              alertasOrdenados.map((a) => {
                const rel = calcularRelevancia(
                  a.nivel_impacto,
                  tipoParaCalculo(a.tipo_impacto),
                )
                const corBolinha = COR_BOLINHA_RELEV[rel]
                const corBordaSel = COR_BOLINHA_RELEV[rel]
                const sel = alertaSelecionadoId === a.id
                const matchSub =
                  hoveredSubstancia !== null &&
                  a.substancias_afetadas.some(
                    (sub) => normSubStr(sub) === normSubStr(hoveredSubstancia),
                  )
                const matchRel =
                  hoveredSubstancia === null &&
                  hoveredRelevancia !== null &&
                  rel === hoveredRelevancia
                const crossHighlight = matchSub || matchRel
                const crossDim =
                  (hoveredSubstancia !== null && !matchSub) ||
                  (hoveredSubstancia === null &&
                    hoveredRelevancia !== null &&
                    rel !== hoveredRelevancia)
                const rowBg = sel
                  ? 'rgba(239, 159, 39, 0.08)'
                  : crossHighlight || feedRowHoveredId === a.id
                    ? '#2C2C2A'
                    : 'transparent'
                return (
                  <button
                    key={a.id}
                    type="button"
                    data-radar-alerta-id={a.id}
                    onClick={() => onSelectAlerta(a.id)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 0,
                      border: 'none',
                      backgroundColor: 'transparent',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      opacity: crossDim ? 0.4 : 1,
                      transition: 'opacity 0.15s ease',
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
                    {/* Fundo full-bleed até a borda direita do cartão (inclui faixa da scrollbar quando existir) */}
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 'var(--radar-feed-bleed-w, 100%)',
                        borderLeft: sel
                          ? `4px solid ${corBordaSel}`
                          : '3px solid transparent',
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
                        transition: 'opacity 0.15s ease',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={() => {
                        if (!sel) setFeedRowHoveredId(a.id)
                      }}
                      onMouseLeave={() => {
                        setFeedRowHoveredId((prev) =>
                          prev === a.id ? null : prev,
                        )
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
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
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
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
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
                          <ChevronRight
                            size={18}
                            color="#F1EFE8"
                            style={{ flexShrink: 0 }}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
        </div>

        {wide ? (
          <div
            className="terrae-intel-dashboard-scroll flex min-h-0 flex-col overflow-y-auto"
            style={{
              flex: '3 1 0%',
              minWidth: 360,
              minHeight: 0,
              backgroundColor: 'rgba(26, 26, 24, 0.85)',
              backdropFilter: 'blur(34px)',
              WebkitBackdropFilter: 'blur(34px)',
              border: '1px solid #2C2C2A',
              borderRadius: 8,
              position: 'relative',
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

    </div>
  )
}
