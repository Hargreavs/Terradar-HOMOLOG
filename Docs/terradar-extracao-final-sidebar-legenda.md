# TERRADAR - Extração Final: Sidebar + Legenda

## 1. Sidebar do Mapa
**Arquivo:** `src/components/map/MapSidebar.tsx`
```tsx
import {
  Anchor,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Droplets,
  Home,
  Leaf,
  Search,
  TrainTrack,
  TreePine,
  Users,
  X,
} from 'lucide-react'
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
  CAMADAS_GEO_ORDER,
  type CamadaGeoId,
} from '../../lib/mapCamadasGeo'
import { countFiltrosAlterados } from '../../lib/mapFiltrosCount'
import { FAMILIA_MINERAL_DEFS } from '../../lib/substanciaFamilias'
import { REGIME_LABELS } from '../../lib/regimes'
import { RARE_KEYS, SUBSTANCIA_DEFS, normalizeSubstanciaKey } from '../../lib/substancias'
import { useMapStore } from '../../store/useMapStore'
import { UF_FILTRO_NENHUM, type Regime } from '../../types'
import {
  MAX_Y,
  MIN_Y,
  REGIME_PILL_COLORS,
  REGIME_PILL_ORDER,
} from './MapFiltersOverlay'

/** Nível 1: cabeçalhos de secção */
const s1: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#D3D1C7',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
}

/** Nível 2: conteúdo principal */
const cActive = 'text-[13px] font-normal text-[#F1EFE8]'
const cInactive = 'text-[13px] font-normal text-[#5F5E5A]'

/** Nível 3: metadata */
const s3: CSSProperties = {
  fontSize: 12,
  fontWeight: 400,
  color: '#888780',
}

function substanciaAtiva(
  key: string,
  rareGroup: boolean | undefined,
  substancias: string[],
): boolean {
  if (substancias.length === 0) return true
  if (rareGroup) {
    return RARE_KEYS.every((k) => substancias.includes(k))
  }
  return substancias.includes(key)
}

type MapSidebarProps = {
  animar: boolean
  onFechar: () => void
  /** MapView: auto-fechamento da sidebar após drill da Inteligência */
  onIntelAutoCloseMouseEnter?: () => void
  onIntelAutoCloseMouseLeave?: () => void
  onIntelAutoClosePointerDownCapture?: () => void
  /** MapView: ao escolher substância no explorador, alinhar legenda ao modo substância */
  onSubstanciaExplorada?: () => void
}

const TOGGLE_ON_TRACK = 'rgba(239, 159, 39, 0.4)'
const TOGGLE_ON_KNOB = '#EF9F27'

const CAMADAS_SUB_LABEL: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#5F5E5A',
  marginTop: 12,
  marginBottom: 4,
}

const CAMADAS_GEO_GROUPS: { title: string; ids: CamadaGeoId[] }[] = [
  {
    title: 'ÁREAS PROTEGIDAS',
    ids: ['terras_indigenas', 'unidades_conservacao', 'quilombolas', 'app_car'],
  },
  { title: 'RECURSOS HÍDRICOS', ids: ['aquiferos'] },
  { title: 'INFRAESTRUTURA', ids: ['ferrovias', 'portos'] },
]

const CAMADAS_GEO_ITEM: Record<
  CamadaGeoId,
  { label: string; color: string; Icon: typeof Users }
> = {
  terras_indigenas: { label: 'Terras Indígenas', color: '#E07A5F', Icon: Users },
  unidades_conservacao: {
    label: 'Unidades de Conservação',
    color: '#4A9E4A',
    Icon: TreePine,
  },
  quilombolas: { label: 'Quilombolas', color: '#C4915A', Icon: Home },
  app_car: { label: 'Áreas de Preservação', color: '#5B9A6F', Icon: Leaf },
  aquiferos: { label: 'Aquíferos', color: '#4A90B8', Icon: Droplets },
  ferrovias: { label: 'Ferrovias', color: '#B8B8B8', Icon: TrainTrack },
  portos: { label: 'Portos', color: '#7EADD4', Icon: Anchor },
}

const REGIME_GROUPS: { title: string; regimes: Regime[] }[] = [
  {
    title: 'CONCESSÕES E AUTORIZAÇÕES',
    regimes: [
      'concessao_lavra',
      'autorizacao_pesquisa',
      'req_lavra',
      'licenciamento',
      'lavra_garimpeira',
      'registro_extracao',
    ],
  },
  {
    title: 'SITUAÇÃO',
    regimes: [
      'disponibilidade',
      'mineral_estrategico',
      'bloqueio_provisorio',
      'bloqueio_permanente',
    ],
  },
]

function clampPeriodo(de: number, ate: number): [number, number] {
  let d = Math.round(Number.isFinite(de) ? de : MIN_Y)
  let a = Math.round(Number.isFinite(ate) ? ate : MAX_Y)
  d = Math.max(MIN_Y, Math.min(MAX_Y, d))
  a = Math.max(MIN_Y, Math.min(MAX_Y, a))
  if (d > a - 1) d = a - 1
  if (a < d + 1) a = d + 1
  return [d, a]
}

export function MapSidebar({
  animar,
  onFechar,
  onIntelAutoCloseMouseEnter,
  onIntelAutoCloseMouseLeave,
  onIntelAutoClosePointerDownCapture,
  onSubstanciaExplorada,
}: MapSidebarProps) {
  const filtros = useMapStore((s) => s.filtros)
  const camadas = filtros.camadas
  const toggleCamada = useMapStore((s) => s.toggleCamada)
  const camadasGeo = useMapStore((s) => s.camadasGeo)
  const toggleCamadaGeo = useMapStore((s) => s.toggleCamadaGeo)
  const substancias = filtros.substancias
  const setFiltro = useMapStore((s) => s.setFiltro)
  const resetFiltros = useMapStore((s) => s.resetFiltros)
  const filtrosAlteradosCount = useMemo(
    () => countFiltrosAlterados(filtros),
    [filtros],
  )
  const periodo = filtros.periodo
  const uf = filtros.uf
  const municipio = filtros.municipio
  const processos = useMapStore((s) => s.processos)

  const [openRegimes, setOpenRegimes] = useState(true)
  const [openSubst, setOpenSubst] = useState(true)
  const [openPeriodo, setOpenPeriodo] = useState(true)
  const [openCamadas, setOpenCamadas] = useState(false)
  const [openLoc, setOpenLoc] = useState(true)
  const [modoExplorador, setModoExplorador] = useState(false)
  const [buscaSubstancia, setBuscaSubstancia] = useState('')
  const [familiasExpandidas, setFamiliasExpandidas] = useState<Set<string>>(new Set())

  const [ufMenuOpen, setUfMenuOpen] = useState(false)
  const [munMenuOpen, setMunMenuOpen] = useState(false)
  const ufWrapRef = useRef<HTMLDivElement>(null)
  const ufTriggerRef = useRef<HTMLButtonElement>(null)
  const ufListRef = useRef<HTMLDivElement>(null)
  const munWrapRef = useRef<HTMLDivElement>(null)
  const munTriggerRef = useRef<HTMLButtonElement>(null)
  const munListRef = useRef<HTMLDivElement>(null)
  const [ufListGeom, setUfListGeom] = useState<{
    left: number
    top: number | null
    bottom: number | null
    width: number
    maxHeight: number
  } | null>(null)
  const [munListGeom, setMunListGeom] = useState<{
    left: number
    top: number | null
    bottom: number | null
    width: number
    maxHeight: number
  } | null>(null)

  const [lo, hi] = periodo

  const commitPeriodo = useCallback(() => {
    setFiltro('periodo', clampPeriodo(lo, hi))
  }, [lo, hi, setFiltro])

  const visiveis = useMemo(
    () => REGIME_PILL_ORDER.filter((r) => camadas[r] !== false).length,
    [camadas],
  )

  const ufs = useMemo(() => {
    const s = new Set<string>()
    for (const p of processos) s.add(p.uf)
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos])

  const municipiosUf = useMemo(() => {
    if (!uf || uf === UF_FILTRO_NENHUM) return []
    const s = new Set<string>()
    for (const p of processos) {
      if (p.uf === uf) s.add(p.municipio)
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos, uf])

  const ufDisabled = !uf || uf === UF_FILTRO_NENHUM

  useEffect(() => {
    if (!ufMenuOpen) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ufWrapRef.current?.contains(t) && !ufListRef.current?.contains(t)) {
        setUfMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ufMenuOpen])

  const syncUfListPosition = useCallback(() => {
    const el = ufTriggerRef.current ?? ufWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const pad = 8
    const vh = window.innerHeight
    const maxPreferred = 360
    const topDown = r.bottom + gap
    const maxHDown = Math.min(maxPreferred, Math.max(1, vh - topDown - pad))
    const spaceAbove = r.top - gap - pad
    const maxHUp = Math.min(maxPreferred, Math.max(1, spaceAbove))
    const minUsableDown = 200
    const openDown = maxHDown >= minUsableDown || maxHDown >= maxHUp
    if (openDown) {
      setUfListGeom({
        left: r.left,
        top: topDown,
        bottom: null,
        width: r.width,
        maxHeight: maxHDown,
      })
    } else {
      setUfListGeom({
        left: r.left,
        top: null,
        bottom: vh - r.top + gap,
        width: r.width,
        maxHeight: maxHUp,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!ufMenuOpen) {
      setUfListGeom(null)
      return
    }
    syncUfListPosition()
    const onScrollOrResize = () => syncUfListPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [ufMenuOpen, syncUfListPosition])

  const syncMunListPosition = useCallback(() => {
    const el = munTriggerRef.current ?? munWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const pad = 8
    const vh = window.innerHeight
    const maxPreferred = 200
    const topDown = r.bottom + gap
    const maxHDown = Math.min(maxPreferred, Math.max(1, vh - topDown - pad))
    const spaceAbove = r.top - gap - pad
    const maxHUp = Math.min(maxPreferred, Math.max(1, spaceAbove))
    const minUsableDown = 80
    const openDown = maxHDown >= minUsableDown || maxHDown >= maxHUp
    if (openDown) {
      setMunListGeom({
        left: r.left,
        top: topDown,
        bottom: null,
        width: r.width,
        maxHeight: maxHDown,
      })
    } else {
      setMunListGeom({
        left: r.left,
        top: null,
        bottom: vh - r.top + gap,
        width: r.width,
        maxHeight: maxHUp,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!munMenuOpen || ufDisabled) {
      setMunListGeom(null)
      return
    }
    syncMunListPosition()
    const onScrollOrResize = () => syncMunListPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [munMenuOpen, ufDisabled, syncMunListPosition])

  useEffect(() => {
    if (!munMenuOpen) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!munWrapRef.current?.contains(t) && !munListRef.current?.contains(t)) {
        setMunMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [munMenuOpen])

  const toggleKey = useCallback(
    (key: string, rareGroup?: boolean) => {
      if (rareGroup) {
        const cur = new Set(substancias)
        const allRareIn = RARE_KEYS.every((k) => cur.has(k))
        if (substancias.length === 0) {
          setFiltro('substancias', [...RARE_KEYS])
          return
        }
        if (allRareIn) {
          RARE_KEYS.forEach((k) => cur.delete(k))
          setFiltro('substancias', [...cur].length ? [...cur] : [])
        } else {
          RARE_KEYS.forEach((k) => cur.add(k))
          setFiltro('substancias', [...cur])
        }
        return
      }
      const cur = new Set(substancias)
      if (cur.has(key)) cur.delete(key)
      else cur.add(key)
      const next = [...cur]
      setFiltro('substancias', next.length === 0 ? [] : next)
    },
    [substancias, setFiltro],
  )

  const todosAtivos = substancias.length === 0

  const camadasGeoAtivasCount = useMemo(
    () => CAMADAS_GEO_ORDER.filter((id) => camadasGeo[id]).length,
    [camadasGeo],
  )

  const ufTriggerLabel =
    uf === null
      ? 'Todos'
      : uf === UF_FILTRO_NENHUM
        ? 'Nenhuma'
        : uf

  const munTriggerLabel = ufDisabled
    ? 'Selecione um estado'
    : municipio
      ? municipio
      : 'Todos os municípios'

  const buscaSubstanciaNorm = normalizeSubstanciaKey(buscaSubstancia)

  const familiasFiltradas = useMemo(() => {
    if (!buscaSubstanciaNorm) return FAMILIA_MINERAL_DEFS
    return FAMILIA_MINERAL_DEFS.map((fam) => ({
      ...fam,
      substancias: fam.substancias.filter((s) => s.includes(buscaSubstanciaNorm)),
    })).filter((fam) => fam.substancias.length > 0)
  }, [buscaSubstanciaNorm])

  const toggleFamiliaExpandida = useCallback((id: string) => {
    setFamiliasExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const formatSubstanciaLabel = (key: string) => {
    const t = key.trim()
    if (!t) return t
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  }

  const principaisKeys = useMemo(() => {
    const s = new Set<string>()
    for (const d of SUBSTANCIA_DEFS) s.add(normalizeSubstanciaKey(d.key))
    for (const k of RARE_KEYS) s.add(normalizeSubstanciaKey(k))
    return s
  }, [])

  const substanciasExtras = useMemo(
    () => substancias.filter((k) => !principaisKeys.has(normalizeSubstanciaKey(k))),
    [substancias, principaisKeys],
  )

  const substanciasExtrasLabels = useMemo(
    () => substanciasExtras.map(formatSubstanciaLabel),
    [substanciasExtras],
  )

  const substanciasNormSet = useMemo(
    () => new Set(substancias.map(normalizeSubstanciaKey)),
    [substancias],
  )

  const familiasComSelecao = useMemo(() => {
    if (substancias.length === 0) return new Set<string>()
    const normAtivas = new Set(substancias.map(normalizeSubstanciaKey))
    const resultado = new Set<string>()
    for (const fam of FAMILIA_MINERAL_DEFS) {
      if (fam.substancias.some((s) => normAtivas.has(s))) {
        resultado.add(fam.id)
      }
    }
    return resultado
  }, [substancias])

  const temSelecaoNoAcordeao = familiasComSelecao.size > 0

  const voltarDoExplorador = useCallback(() => {
    setModoExplorador(false)
    setBuscaSubstancia('')
    setFamiliasExpandidas(new Set())
  }, [])

  const explorerSelectSubstancia = useCallback(
    (key: string, rareGroup?: boolean) => {
      toggleKey(key, rareGroup)
      onSubstanciaExplorada?.()
    },
    [toggleKey, onSubstanciaExplorada],
  )

  return (
    <aside
      data-terrae-map-filter-sidebar
      className="pointer-events-auto absolute bottom-0 left-0 top-0 z-[12] box-border flex shrink-0 flex-col overflow-y-auto"
      style={{
        width: 288,
        minWidth: 288,
        maxWidth: 288,
        background: '#111110',
        borderRight: '1px solid #2C2C2A',
        padding: '20px 16px 192px 16px',
        scrollPaddingBottom: 192,
        boxShadow: '4px 0 16px rgba(0, 0, 0, 0.4)',
        transform: animar ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 200ms ease-out',
        // Reserva a largura do gutter da scrollbar desde o início: o conteúdo não “pula”
        // para a esquerda quando o scroll vertical passa a existir (ex.: CAMADAS expandida).
        scrollbarGutter: 'stable',
      }}
      onMouseEnter={onIntelAutoCloseMouseEnter}
      onMouseLeave={onIntelAutoCloseMouseLeave}
      onPointerDownCapture={onIntelAutoClosePointerDownCapture}
    >
      {modoExplorador ? (
        <>
          <div
            className="flex shrink-0 items-center gap-3"
            style={{ marginBottom: 32 }}
          >
            <button
              type="button"
              onClick={voltarDoExplorador}
              className="cursor-pointer border-0 bg-transparent p-0 text-[#888780] transition-colors hover:text-[#D3D1C7]"
              aria-label="Voltar aos filtros"
            >
              <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            </button>
            <span style={s1}>SUBSTÂNCIAS</span>
          </div>

          <div className="relative mb-3 shrink-0">
            <Search
              size={14}
              strokeWidth={2}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F5E5A]"
              aria-hidden
            />
            <input
              type="text"
              value={buscaSubstancia}
              onChange={(e) => setBuscaSubstancia(e.target.value)}
              placeholder="Buscar substância..."
              autoFocus
              className="box-border w-full rounded-md border border-solid border-[#2C2C2A] bg-[#1A1A18] py-2 pl-8 pr-3 text-[13px] text-[#F1EFE8] outline-none placeholder:text-[#5F5E5A] focus:border-[#EF9F27]"
              style={{ height: 36 }}
            />
          </div>

          <div className="shrink-0">
            <p style={{ ...s1, marginBottom: 16 }}>PRINCIPAIS</p>
            <button
              type="button"
              onClick={() => setFiltro('substancias', [])}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 px-1 py-0 text-left hover:bg-[#1A1A18]"
              style={{ height: 28 }}
            >
              <span
                className="flex shrink-0 items-center justify-center border border-solid"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  borderColor: todosAtivos ? '#EF9F27' : '#5F5E5A',
                  borderWidth: todosAtivos ? 0 : 1.5,
                  backgroundColor: todosAtivos ? '#EF9F27' : 'transparent',
                }}
                aria-hidden
              >
                {todosAtivos ? (
                  <Check size={10} className="text-[#0D0D0C]" strokeWidth={3} aria-hidden />
                ) : null}
              </span>
              <span className={cActive}>Todos</span>
            </button>
            {SUBSTANCIA_DEFS.map((sp) => {
              const on = substanciaAtiva(sp.key, sp.key === 'RARE', substancias)
              const Icon = sp.Icon
              return (
                <button
                  key={sp.key}
                  type="button"
                  onClick={() => explorerSelectSubstancia(sp.key, sp.key === 'RARE')}
                  className="flex w-full cursor-pointer items-center rounded-md border-0 px-1 py-0 text-left hover:bg-[#1A1A18]"
                  style={{ height: 28, gap: 8 }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center border border-solid"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      borderColor: on ? '#EF9F27' : '#5F5E5A',
                      borderWidth: on ? 0 : 1.5,
                      backgroundColor: on ? '#EF9F27' : 'transparent',
                    }}
                    aria-hidden
                  >
                    {on ? (
                      <Check size={10} className="text-[#0D0D0C]" strokeWidth={3} aria-hidden />
                    ) : null}
                  </span>
                  <Icon
                    size={14}
                    strokeWidth={2}
                    className="shrink-0"
                    style={{ color: on ? sp.color : '#5F5E5A' }}
                    aria-hidden
                  />
                  <span className={`min-w-0 flex-1 ${on ? cActive : cInactive}`}>
                    {sp.label}
                  </span>
                  {sp.estrategico ? (
                    <span
                      className="shrink-0 font-medium uppercase"
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.5px',
                        color: '#2D8B70',
                        border: '1px solid rgba(45, 139, 112, 0.3)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'transparent',
                      }}
                    >
                      ESTRATÉGICO
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div
            className="my-3 shrink-0"
            style={{ borderTop: '1px solid #2C2C2A' }}
            aria-hidden
          />

          <div className="w-full shrink-0">
            <div
              className="flex shrink-0 items-center justify-between gap-2"
              style={{ marginBottom: 16 }}
            >
              <p style={s1}>TODAS AS FAMÍLIAS</p>
              {substancias.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFiltro('substancias', [])}
                  className="cursor-pointer shrink-0 border-0 bg-transparent p-0 transition-opacity duration-150 hover:opacity-80"
                  style={{
                    fontSize: s3.fontSize,
                    fontWeight: s3.fontWeight,
                    color: '#F1B85A',
                  }}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
            {familiasFiltradas.map((fam) => {
              const expandida =
                familiasExpandidas.has(fam.id) || buscaSubstanciaNorm.length > 0

              return (
                <div key={fam.id}>
                  <button
                    type="button"
                    onClick={() => toggleFamiliaExpandida(fam.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1 py-0 text-left transition-colors hover:bg-[#1A1A18]"
                    style={{
                      height: 30,
                      opacity:
                        temSelecaoNoAcordeao && !familiasComSelecao.has(fam.id)
                          ? 0.45
                          : 1,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    {expandida ? (
                      <ChevronDown size={12} className="shrink-0 text-[#5F5E5A]" aria-hidden />
                    ) : (
                      <ChevronRight size={12} className="shrink-0 text-[#5F5E5A]" aria-hidden />
                    )}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: fam.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-[12px] font-medium text-[#D3D1C7]">
                      {fam.label}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{
                        color: familiasComSelecao.has(fam.id)
                          ? '#EF9F27'
                          : '#5F5E5A',
                        transition: 'color 200ms ease',
                      }}
                    >
                      ({fam.substancias.length})
                    </span>
                  </button>

                  {expandida ? (
                    <div className="flex flex-col">
                      {fam.substancias.map((subKey) => {
                        const ativa =
                          substancias.length > 0 &&
                          substanciasNormSet.has(subKey)
                        return (
                          <button
                            key={subKey}
                            type="button"
                            onClick={() => explorerSelectSubstancia(subKey)}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-0 text-left transition-colors hover:bg-[#1A1A18]"
                            style={{ height: 26, paddingLeft: 28 }}
                          >
                            <span
                              className="flex shrink-0 items-center justify-center border border-solid"
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 3,
                                borderColor: ativa ? '#EF9F27' : '#5F5E5A',
                                borderWidth: ativa ? 0 : 1.5,
                                backgroundColor: ativa ? '#EF9F27' : 'transparent',
                              }}
                              aria-hidden
                            >
                              {ativa ? (
                                <Check size={8} className="text-[#0D0D0C]" strokeWidth={3} aria-hidden />
                              ) : null}
                            </span>
                            <span
                              className={`min-w-0 flex-1 text-[12px] font-normal ${ativa ? 'text-[#F1EFE8]' : 'text-[#5F5E5A]'}`}
                            >
                              {formatSubstanciaLabel(subKey)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {familiasFiltradas.length === 0 ? (
              <p className="px-1 py-4 text-center text-[12px] text-[#5F5E5A]">
                Nenhuma substância encontrada
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
      <div
        className="flex shrink-0 w-full items-center justify-between gap-2"
        style={{ marginBottom: 20 }}
      >
        <div className="flex min-w-0 flex-1 items-center">
          {filtrosAlteradosCount > 0 ? (
            <button
              type="button"
              onClick={() => resetFiltros()}
              className="cursor-pointer border-0 bg-transparent p-0 text-left transition-opacity duration-150 hover:opacity-80"
              style={{
                fontSize: s3.fontSize,
                fontWeight: s3.fontWeight,
                color: '#F1B85A',
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[#888780] transition-colors hover:text-[#D3D1C7]"
          aria-label="Fechar filtros"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="w-full shrink-0">
        <button
          type="button"
          onClick={() => setOpenRegimes((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
          style={{ padding: '0 0 16px 0' }}
        >
          <span style={s1}>REGIMES</span>
          {openRegimes ? (
            <ChevronDown size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          )}
        </button>
        {openRegimes ? (
          <div className="flex flex-col">
            {REGIME_GROUPS.map((group, groupIndex) => (
              <div key={group.title}>
                <p
                  style={{
                    ...CAMADAS_SUB_LABEL,
                    marginTop: groupIndex === 0 ? 0 : 12,
                  }}
                >
                  {group.title}
                </p>
                {group.regimes.map((r) => {
                  const on = camadas[r] !== false
                  const color = REGIME_PILL_COLORS[r]
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleCamada(r)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-1 py-0 text-left transition-colors duration-200 hover:bg-[#1A1A18]"
                      style={{ height: 32 }}
                    >
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 8,
                          height: 8,
                          backgroundColor: on ? color : '#3a3a38',
                        }}
                        aria-hidden
                      />
                      <span className={`min-w-0 flex-1 ${on ? cActive : cInactive}`}>
                        {REGIME_LABELS[r]}
                      </span>
                      <span
                        className="relative shrink-0 rounded-full transition-colors duration-200"
                        style={{
                          width: 32,
                          height: 16,
                          backgroundColor: on ? TOGGLE_ON_TRACK : '#2C2C2A',
                        }}
                        aria-hidden
                      >
                        <span
                          className="absolute top-1/2 block rounded-full transition-all duration-200 ease-out"
                          style={{
                            width: 12,
                            height: 12,
                            marginTop: -6,
                            left: on ? 'auto' : 2,
                            right: on ? 2 : 'auto',
                            backgroundColor: on ? TOGGLE_ON_KNOB : '#5F5E5A',
                          }}
                        />
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <p style={{ ...s3, marginTop: 8 }}>
              {visiveis} de {REGIME_PILL_ORDER.length} tipos visíveis
            </p>
          </div>
        ) : null}

        <div
          className="my-4"
          style={{ borderTop: '1px solid #2C2C2A' }}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => setOpenSubst((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
          style={{ padding: '0 0 16px 0' }}
        >
          <span style={s1}>SUBSTÂNCIAS</span>
          {openSubst ? (
            <ChevronDown size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          )}
        </button>
        {openSubst ? (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setFiltro('substancias', [])}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 px-1 py-0 text-left hover:bg-[#1A1A18]"
              style={{ height: 32 }}
            >
              <span
                className="flex shrink-0 items-center justify-center border border-solid"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  borderColor: todosAtivos ? '#EF9F27' : '#5F5E5A',
                  borderWidth: todosAtivos ? 0 : 1.5,
                  backgroundColor: todosAtivos ? '#EF9F27' : 'transparent',
                }}
                aria-hidden
              >
                {todosAtivos ? (
                  <Check size={10} className="text-[#0D0D0C]" strokeWidth={3} aria-hidden />
                ) : null}
              </span>
              <span className={cActive}>Todos</span>
            </button>

            {SUBSTANCIA_DEFS.map((sp) => {
              const on = substanciaAtiva(sp.key, sp.key === 'RARE', substancias)
              const Icon = sp.Icon
              return (
                <button
                  key={sp.key}
                  type="button"
                  onClick={() => toggleKey(sp.key, sp.key === 'RARE')}
                  className="flex w-full cursor-pointer items-center rounded-md border-0 px-1 py-0 text-left hover:bg-[#1A1A18]"
                  style={{ height: 32, gap: 8 }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center border border-solid"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      borderColor: on ? '#EF9F27' : '#5F5E5A',
                      borderWidth: on ? 0 : 1.5,
                      backgroundColor: on ? '#EF9F27' : 'transparent',
                    }}
                    aria-hidden
                  >
                    {on ? (
                      <Check size={10} className="text-[#0D0D0C]" strokeWidth={3} aria-hidden />
                    ) : null}
                  </span>
                  <Icon
                    size={14}
                    strokeWidth={2}
                    className="shrink-0"
                    style={{ color: on ? sp.color : '#5F5E5A' }}
                    aria-hidden
                  />
                  <span className={`min-w-0 flex-1 ${on ? cActive : cInactive}`}>
                    {sp.label}
                  </span>
                  {sp.estrategico ? (
                    <span
                      className="shrink-0 font-medium uppercase"
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.5px',
                        color: '#2D8B70',
                        border: '1px solid rgba(45, 139, 112, 0.3)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'transparent',
                      }}
                    >
                      ESTRATÉGICO
                    </span>
                  ) : null}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setModoExplorador(true)}
              className="mt-5 flex w-full cursor-pointer items-center justify-between rounded-md border border-solid px-3 text-left transition-colors hover:border-[#3a3a38]"
              style={{
                height: 36,
                borderColor: '#2C2C2A',
                background: '#1A1A18',
                borderRadius: 6,
              }}
            >
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-normal"
                style={{
                  color: substanciasExtras.length > 0 ? '#EF9F27' : '#888780',
                }}
              >
                {substanciasExtras.length > 0
                  ? substanciasExtrasLabels.length <= 2
                    ? substanciasExtrasLabels.join(', ')
                    : `${substanciasExtrasLabels.slice(0, 2).join(', ')} +${substanciasExtrasLabels.length - 2}`
                  : 'Buscar substância'}
              </span>
              <ChevronRight size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
            </button>
          </div>
        ) : null}

        <div
          className="my-4"
          style={{ borderTop: '1px solid #2C2C2A' }}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => setOpenCamadas((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
          style={{ padding: '0 0 16px 0' }}
        >
          <span style={s1}>CAMADAS</span>
          {openCamadas ? (
            <ChevronDown size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          )}
        </button>
        {openCamadas ? (
          <div className="flex flex-col">
            {CAMADAS_GEO_GROUPS.map((g) => (
              <div key={g.title}>
                <p style={CAMADAS_SUB_LABEL}>{g.title}</p>
                {g.ids.map((id) => {
                  const on = camadasGeo[id]
                  const { label, color, Icon } = CAMADAS_GEO_ITEM[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleCamadaGeo(id)}
                      className="flex w-full cursor-pointer items-center rounded-md border-0 px-1 py-0 text-left hover:bg-[#1A1A18]"
                      style={{ height: 32, gap: 8 }}
                    >
                      <span
                        className="flex shrink-0 items-center justify-center border border-solid"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          borderColor: on ? '#EF9F27' : '#5F5E5A',
                          borderWidth: on ? 0 : 1.5,
                          backgroundColor: on ? '#EF9F27' : 'transparent',
                        }}
                        aria-hidden
                      >
                        {on ? (
                          <Check size={10} className="text-[#0D0D0C]" strokeWidth={3} aria-hidden />
                        ) : null}
                      </span>
                      <Icon
                        size={14}
                        strokeWidth={2}
                        className="shrink-0"
                        style={{ color: on ? color : '#5F5E5A' }}
                        aria-hidden
                      />
                      <span className={`min-w-0 flex-1 ${on ? cActive : cInactive}`}>{label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            <p style={{ ...s3, marginTop: 8 }}>
              {camadasGeoAtivasCount} de 7 camadas ativas
            </p>
          </div>
        ) : null}

        <div
          className="my-4"
          style={{ borderTop: '1px solid #2C2C2A' }}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => setOpenPeriodo((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
          style={{ padding: '0 0 16px 0' }}
        >
          <span style={s1}>PERÍODO</span>
          {openPeriodo ? (
            <ChevronDown size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          )}
        </button>
        {openPeriodo ? (
          <div className="flex" style={{ gap: '4%', marginBottom: 16 }}>
            <div style={{ width: '48%' }}>
              <p style={{ fontSize: 12, color: '#888780', marginBottom: 4 }}>De</p>
              <input
                type="number"
                min={MIN_Y}
                max={MAX_Y}
                step={1}
                value={lo}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') return
                  const n = Number(raw)
                  if (!Number.isFinite(n)) return
                  let d = Math.round(n)
                  d = Math.max(MIN_Y, Math.min(MAX_Y, d))
                  if (d > hi - 1) d = hi - 1
                  setFiltro('periodo', [d, hi])
                }}
                onBlur={commitPeriodo}
                className="box-border w-full border border-solid border-[#2C2C2A] bg-[#1A1A18] text-center tabular-nums text-[#F1EFE8] outline-none transition-colors focus-visible:border-[#EF9F27]"
                style={{ height: 40, borderRadius: 8, fontSize: 13, fontWeight: 500 }}
                aria-label="Ano inicial do período"
              />
            </div>
            <div style={{ width: '48%' }}>
              <p style={{ fontSize: 12, color: '#888780', marginBottom: 4 }}>Até</p>
              <input
                type="number"
                min={MIN_Y}
                max={MAX_Y}
                step={1}
                value={hi}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') return
                  const n = Number(raw)
                  if (!Number.isFinite(n)) return
                  let a = Math.round(n)
                  a = Math.max(MIN_Y, Math.min(MAX_Y, a))
                  if (a < lo + 1) a = lo + 1
                  setFiltro('periodo', [lo, a])
                }}
                onBlur={commitPeriodo}
                className="box-border w-full border border-solid border-[#2C2C2A] bg-[#1A1A18] text-center tabular-nums text-[#F1EFE8] outline-none transition-colors focus-visible:border-[#EF9F27]"
                style={{ height: 40, borderRadius: 8, fontSize: 13, fontWeight: 500 }}
                aria-label="Ano final do período"
              />
            </div>
          </div>
        ) : null}

        <div
          className="my-4"
          style={{ borderTop: '1px solid #2C2C2A' }}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => setOpenLoc((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
          style={{ padding: '0 0 16px 0' }}
        >
          <span style={s1}>LOCALIZAÇÃO</span>
          {openLoc ? (
            <ChevronDown size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#5F5E5A]" aria-hidden />
          )}
        </button>
        {openLoc ? (
          <div>
            <p
              className="font-normal text-[#F1EFE8]"
              style={{ fontSize: 13, marginBottom: 6 }}
            >
              UF
            </p>
            <div ref={ufWrapRef} className="relative w-full">
              <button
                ref={ufTriggerRef}
                type="button"
                onClick={() => setUfMenuOpen((o) => !o)}
                className="box-border flex w-full cursor-pointer items-center justify-between border border-solid border-[#2C2C2A] bg-[#1A1A18] text-left outline-none transition-colors hover:border-[#3a3a38] focus-visible:border-[#EF9F27]"
                style={{
                  height: 40,
                  borderRadius: 8,
                  padding: '0 12px',
                }}
                aria-expanded={ufMenuOpen}
                aria-haspopup="listbox"
              >
                <span
                  className="text-[13px]"
                  style={{
                    color:
                      uf === null
                        ? '#D3D1C7'
                        : uf === UF_FILTRO_NENHUM
                          ? '#D3D1C7'
                          : '#EF9F27',
                  }}
                >
                  {ufTriggerLabel}
                </span>
                <ChevronDown
                  size={14}
                  className="shrink-0 text-[#5F5E5A] transition-transform"
                  style={{ transform: ufMenuOpen ? 'rotate(180deg)' : undefined }}
                  aria-hidden
                />
              </button>
              {ufMenuOpen && ufListGeom && typeof document !== 'undefined'
                ? createPortal(
                    <div
                      ref={ufListRef}
                      role="listbox"
                      className="overflow-y-auto border border-solid border-[#2C2C2A] bg-[#1A1A18] p-1"
                      style={{
                        position: 'fixed',
                        left: ufListGeom.left,
                        width: ufListGeom.width,
                        maxHeight: ufListGeom.maxHeight,
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        zIndex: 200,
                        boxSizing: 'border-box',
                        ...(ufListGeom.bottom != null
                          ? { bottom: ufListGeom.bottom, top: 'auto' }
                          : { top: ufListGeom.top!, bottom: 'auto' }),
                      }}
                    >
                      <button
                        type="button"
                        role="option"
                        className="flex w-full cursor-pointer items-center border-0 text-left text-[13px] text-[#D3D1C7] transition-colors hover:bg-[#2C2C2A]"
                        style={{
                          height: 36,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: uf === null ? '#2C2C2A' : 'transparent',
                          color: uf === null ? '#EF9F27' : '#D3D1C7',
                        }}
                        onClick={() => {
                          setFiltro('uf', null)
                          setFiltro('municipio', null)
                          setUfMenuOpen(false)
                        }}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        role="option"
                        className="flex w-full cursor-pointer items-center border-0 text-left text-[13px] transition-colors hover:bg-[#2C2C2A]"
                        style={{
                          height: 36,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: uf === UF_FILTRO_NENHUM ? '#2C2C2A' : 'transparent',
                          color: uf === UF_FILTRO_NENHUM ? '#EF9F27' : '#D3D1C7',
                        }}
                        onClick={() => {
                          setFiltro('uf', UF_FILTRO_NENHUM)
                          setFiltro('municipio', null)
                          setUfMenuOpen(false)
                        }}
                      >
                        Nenhuma
                      </button>
                      {ufs.map((sigla) => (
                        <button
                          key={sigla}
                          type="button"
                          role="option"
                          className="flex w-full cursor-pointer items-center border-0 text-left text-[13px] transition-colors hover:bg-[#2C2C2A]"
                          style={{
                            height: 36,
                            padding: '0 12px',
                            borderRadius: 6,
                            background: uf === sigla ? '#2C2C2A' : 'transparent',
                            color: uf === sigla ? '#EF9F27' : '#D3D1C7',
                          }}
                          onClick={() => {
                            setFiltro('uf', sigla)
                            setFiltro('municipio', null)
                            setUfMenuOpen(false)
                          }}
                        >
                          {sigla}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )
                : null}
            </div>

            <p
              className="font-normal text-[#F1EFE8]"
              style={{ fontSize: 13, marginTop: 12, marginBottom: 6 }}
            >
              Município
            </p>
            <div ref={munWrapRef} className="relative w-full">
              <button
                ref={munTriggerRef}
                type="button"
                disabled={ufDisabled}
                onClick={() => {
                  if (!ufDisabled) setMunMenuOpen((o) => !o)
                }}
                className="box-border flex w-full items-center justify-between border border-solid text-left outline-none transition-colors enabled:cursor-pointer enabled:hover:border-[#3a3a38] enabled:focus-visible:border-[#EF9F27] disabled:cursor-not-allowed"
                style={{
                  height: 40,
                  borderRadius: 8,
                  padding: '0 12px',
                  borderColor: '#2C2C2A',
                  background: '#1A1A18',
                  opacity: ufDisabled ? 0.6 : 1,
                }}
                aria-expanded={munMenuOpen}
                aria-haspopup="listbox"
                aria-disabled={ufDisabled}
              >
                <span
                  className="text-[13px]"
                  style={{
                    color: ufDisabled
                      ? '#5F5E5A'
                      : municipio
                        ? '#EF9F27'
                        : '#D3D1C7',
                  }}
                >
                  {munTriggerLabel}
                </span>
                <ChevronDown
                  size={14}
                  className="shrink-0 text-[#5F5E5A] transition-transform"
                  style={{
                    transform: munMenuOpen ? 'rotate(180deg)' : undefined,
                    opacity: ufDisabled ? 0.5 : 1,
                  }}
                  aria-hidden
                />
              </button>
              {!ufDisabled &&
              munMenuOpen &&
              munListGeom &&
              typeof document !== 'undefined'
                ? createPortal(
                    <div
                      ref={munListRef}
                      role="listbox"
                      className="overflow-y-auto border border-solid border-[#2C2C2A] bg-[#1A1A18] p-1"
                      style={{
                        position: 'fixed',
                        left: munListGeom.left,
                        width: munListGeom.width,
                        maxHeight: munListGeom.maxHeight,
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        zIndex: 200,
                        boxSizing: 'border-box',
                        ...(munListGeom.bottom != null
                          ? { bottom: munListGeom.bottom, top: 'auto' }
                          : { top: munListGeom.top!, bottom: 'auto' }),
                      }}
                    >
                      <button
                        type="button"
                        role="option"
                        className="flex w-full cursor-pointer items-center border-0 text-left text-[13px] text-[#D3D1C7] transition-colors hover:bg-[#2C2C2A]"
                        style={{
                          height: 36,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: !municipio ? '#2C2C2A' : 'transparent',
                          color: !municipio ? '#EF9F27' : '#D3D1C7',
                        }}
                        onClick={() => {
                          setFiltro('municipio', null)
                          setMunMenuOpen(false)
                        }}
                      >
                        Todos os municípios
                      </button>
                      {municipiosUf.map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="option"
                          className="flex w-full cursor-pointer items-center border-0 text-left text-[13px] transition-colors hover:bg-[#2C2C2A]"
                          style={{
                            height: 36,
                            padding: '0 12px',
                            borderRadius: 6,
                            background: municipio === m ? '#2C2C2A' : 'transparent',
                            color: municipio === m ? '#EF9F27' : '#D3D1C7',
                          }}
                          onClick={() => {
                            setFiltro('municipio', m)
                            setMunMenuOpen(false)
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>
        ) : null}
      </div>
      </>
      )}
    </aside>
  )
}

```

## 2. MapView
**Arquivo:** `src/components/map/MapView.tsx`
```tsx
import mapboxgl from 'mapbox-gl'
import { type Root, createRoot } from 'react-dom/client'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { CAMADAS_GEO_JSON } from '../../data/camadas/geoImport'
import { useMapChromeTransition } from '../../context/MapChromeTransitionContext'
import {
  dispatchTerraeMapClearFloatingUi,
  TERRAE_MAP_CLEAR_FLOATING_UI,
} from '../../lib/mapFloatingUiEvents'
import {
  CAMADA_GEO_HOVER_LAYER_IDS,
  CAMADAS_GEO_COLOR,
  CAMADAS_GEO_LABEL,
  CAMADAS_GEO_LEGEND_ORDER,
  addCamadasGeoLayers,
  formatCamadaGeoTooltip,
  syncCamadasGeoVisibility,
} from '../../lib/mapCamadasGeo'
import { countFiltrosAlterados } from '../../lib/mapFiltrosCount'
import {
  REGIME_BADGE_TOOLTIP,
  REGIME_COLORS,
  REGIME_COLORS_MAP,
  REGIME_LABELS,
} from '../../lib/regimes'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import {
  BRAZIL_BOUNDS_LNG_LAT,
  boundsFromProcessos,
  boundsFromSingleProcesso,
  cloneFiltrosState,
  fingerprintDrillFiltros,
} from '../../lib/intelMapDrill'
import { FAMILIA_MINERAL_DEFS, corPorFamilia } from '../../lib/substanciaFamilias'
import { normalizeSubstanciaKey } from '../../lib/substancias'
import { ufBoundsLngLat, ufNomeOuSigla } from '../../lib/ufBounds'
import { useAppStore } from '../../store/useAppStore'
import {
  REGIMES,
  useMapStore,
  type MapStore,
  type PendingNavigation,
} from '../../store/useMapStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  MOTION_MAP_INTRO_DURATION_MS,
  MOTION_MAP_INTRO_LEGEND_DELAY_MS,
  MOTION_MAP_INTRO_SEARCH_DELAY_MS,
  MOTION_MAP_INTRO_THEME_DELAY_MS,
  motionMs,
} from '../../lib/motionDurations'
import type { AlertaLegislativo, Processo, Regime } from '../../types'
import { radarFeedIdParaAlertaProcesso } from '../../lib/radarFeedIdFromProcessoAlerta'
import {
  MAPBOX_STYLE_SATELLITE,
  MapStyleSwitcher,
} from './MapStyleSwitcher'
import { usePainelFiltrosAnimation } from './MapFiltersOverlay'
import { MapSearchBar } from './MapSearchBar'
import { MapSidebar } from './MapSidebar'
import { ProcessoPopupContent } from './ProcessoPopup'
import { RelatorioCompleto } from './RelatorioCompleto'

type ModoVisualizacao = 'regime' | 'risco' | 'substancia'

/** Largura fixa da sidebar de filtros + margem para o mapa alinhar fitBounds/flyTo. */
const INTEL_SIDEBAR_FALLBACK_WIDTH_PX = 288
const INTEL_SIDEBAR_MAP_MARGIN_PX = 44

function getIntelLeftReservePx(): number {
  const el = document.querySelector('[data-terrae-map-filter-sidebar]')
  if (el instanceof HTMLElement) {
    const w = el.offsetWidth
    if (Number.isFinite(w) && w > 0) {
      return Math.round(w + INTEL_SIDEBAR_MAP_MARGIN_PX)
    }
  }
  return INTEL_SIDEBAR_FALLBACK_WIDTH_PX + INTEL_SIDEBAR_MAP_MARGIN_PX
}

/** Espera layout do painel (após `setPainelFiltrosAberto(true)`) para medir a sidebar. */
function afterFilterSidebarLayout(fn: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}

function corPorRisco(p: Processo): string {
  if (p.risk_score === null) return '#444441'
  const v = p.risk_score
  if (v >= 0 && v <= 39) return '#1D9E75'
  if (v >= 40 && v <= 69) return '#E8A830'
  if (v >= 70 && v <= 100) return '#E24B4A'
  if (v < 0) return '#1D9E75'
  return '#E24B4A'
}

function buildGeoJSON(processos: Processo[], modoVisualizacao: ModoVisualizacao) {
  return {
    type: 'FeatureCollection' as const,
    features: processos
      .filter((p) => (p.geojson?.geometry?.coordinates?.length ?? 0) > 0)
      .map((p, i) => ({
        type: 'Feature' as const,
        id: i,
        geometry: {
          type: 'Polygon' as const,
          coordinates: p.geojson.geometry.coordinates,
        },
        properties: {
          id: p.id,
          regime: p.regime,
          numero: p.numero,
          substancia: p.substancia,
          titular: p.titular,
          area_ha: p.area_ha,
          uf: p.uf,
          municipio: p.municipio,
          risk_score: p.risk_score,
          color:
            modoVisualizacao === 'risco'
              ? corPorRisco(p)
              : modoVisualizacao === 'substancia'
                ? corPorFamilia(p.substancia)
                : (REGIME_COLORS_MAP[p.regime] ?? '#888780'),
        },
      })),
  }
}

const LEGENDA_RISCO_ITEMS: { color: string; label: string }[] = [
  { color: '#1D9E75', label: 'Baixo risco (0–39)' },
  { color: '#E8A830', label: 'Risco médio (40–69)' },
  { color: '#E24B4A', label: 'Alto risco (70–100)' },
  { color: '#444441', label: 'Não calculado' },
]

/** Dessaturação + brilho do satellite; ignorado em dark/streets. */
function applySatelliteRasterAdjustments(map: mapboxgl.Map, styleUrl: string) {
  if (styleUrl !== MAPBOX_STYLE_SATELLITE) return
  const style = map.getStyle()
  if (!style?.layers) return
  for (const layer of style.layers) {
    if (layer.type !== 'raster' || !layer.id) continue
    try {
      map.setPaintProperty(layer.id, 'raster-saturation', -0.45)
      map.setPaintProperty(layer.id, 'raster-brightness-max', 0.87)
      map.setPaintProperty(layer.id, 'raster-contrast', 0.1)
    } catch {
      /* raster sem suporte a alguma propriedade */
    }
  }
}

/** IDs conhecidos em `satellite-streets-v12` (composite / place_label). */
const SATELLITE_ADMIN1_LINE_LAYERS = ['admin-1-boundary'] as const
const SATELLITE_ADMIN0_LINE_LAYERS = [
  'admin-0-boundary',
  'admin-0-boundary-disputed',
] as const
const SATELLITE_PLACE_LABEL_LAYERS = [
  'settlement-subdivision-label',
  'settlement-minor-label',
  'settlement-major-label',
  'state-label',
  'country-label',
] as const

/** `name_pt` quando existir nos tiles; fallback Mapbox padrão. */
const PLACE_LABEL_TEXT_FIELD_PT: mapboxgl.ExpressionSpecification = [
  'coalesce',
  ['get', 'name_pt'],
  ['get', 'name_en'],
  ['get', 'name'],
]

function safeSetPaint(
  map: mapboxgl.Map,
  layerId: string,
  prop: string,
  value: unknown,
) {
  if (!map.getLayer(layerId)) return
  try {
    map.setPaintProperty(layerId, prop, value as never)
  } catch {
    /* propriedade ausente ou incompatível */
  }
}

function safeSetLayout(
  map: mapboxgl.Map,
  layerId: string,
  prop: string,
  value: unknown,
) {
  if (!map.getLayer(layerId)) return
  try {
    map.setLayoutProperty(layerId, prop, value as never)
  } catch {
    /* propriedade ausente ou incompatível */
  }
}

/**
 * Fronteiras, labels e idioma só no satellite (`satellite-streets-v12`).
 * Ordem: raster já aplicado em `applySatelliteRasterAdjustments` → linhas admin → estado → textos PT → negrito país.
 */
function applySatelliteVectorStyleTweaks(map: mapboxgl.Map) {
  for (const id of SATELLITE_ADMIN1_LINE_LAYERS) {
    safeSetPaint(map, id, 'line-dasharray', [3, 2])
    safeSetPaint(map, id, 'line-color', 'rgba(255, 255, 255, 0.5)')
    safeSetPaint(map, id, 'line-width', 1.25)
  }

  for (const id of SATELLITE_ADMIN0_LINE_LAYERS) {
    safeSetPaint(map, id, 'line-dasharray', [1, 0])
    safeSetPaint(map, id, 'line-color', 'rgba(255, 255, 255, 0.7)')
    safeSetPaint(map, id, 'line-width', 1.75)
  }

  safeSetPaint(map, 'state-label', 'text-opacity', 1)
  safeSetPaint(map, 'state-label', 'text-color', 'rgba(255, 255, 255, 0.85)')
  safeSetPaint(map, 'state-label', 'text-halo-color', 'rgba(0, 0, 0, 0.6)')
  safeSetPaint(map, 'state-label', 'text-halo-width', 1.5)

  for (const id of SATELLITE_PLACE_LABEL_LAYERS) {
    safeSetLayout(map, id, 'text-field', PLACE_LABEL_TEXT_FIELD_PT)
  }

  safeSetLayout(map, 'country-label', 'text-font', [
    'DIN Pro Bold',
    'Arial Unicode MS Bold',
  ])
}

function applySatelliteStylePostLoad(map: mapboxgl.Map, styleUrl: string) {
  applySatelliteRasterAdjustments(map, styleUrl)
  if (styleUrl !== MAPBOX_STYLE_SATELLITE) return
  if (!map.isStyleLoaded()) return
  applySatelliteVectorStyleTweaks(map)
}

function addProcessosLayers(
  map: mapboxgl.Map,
  dadosGeoJSON: ReturnType<typeof buildGeoJSON>,
) {
  map.addSource('processos', {
    type: 'geojson',
    data: dadosGeoJSON,
  })

  map.addLayer({
    id: 'processos-fill',
    type: 'fill',
    source: 'processos',
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'fill-opacity': 0.45,
    },
  })

  map.addLayer({
    id: 'processos-halo',
    type: 'line',
    source: 'processos',
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        4,
        8,
        3,
        12,
        3,
      ],
      'line-opacity': 0.12,
      'line-blur': 3,
    },
  })

  map.addLayer({
    id: 'processos-outline',
    type: 'line',
    source: 'processos',
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        1.5,
        8,
        1.5,
        12,
        2,
      ],
      'line-opacity': 1,
    },
  })
}

const PROCESSOS_CLICK_LAYERS = [
  'processos-fill',
  'processos-halo',
  'processos-outline',
] as const

type ProcessosLayerHandlers = {
  onMove: () => void
  onLeave: () => void
  onUnifiedClick: (e: mapboxgl.MapMouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
  onZoomStart: () => void
  onMoveEnd: () => void
}

/** Ignora no máx. um `click` após pan — Mapbox às vezes emite clique fantasma; timeout evita estado preso. */
type MapDragClickGuard = {
  consumeNextClick: boolean
  resetTimeoutId: ReturnType<typeof setTimeout> | null
}

/** Igual à transição do drawer (`RelatorioCompleto` transform 300ms) + margem. */
const DRAWER_CLOSE_ANIM_MS = 320

/** Mesma sequência que o ✕ do popover: teardown + drawer / seleção. */
function fecharProcessoPopupComoBotaoFechar(
  tearDownProcessoPopupDom: () => void,
  pendingFecharProcessoTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
) {
  tearDownProcessoPopupDom()
  const st = useMapStore.getState()
  if (st.relatorioDrawerAberto) {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
    }
    st.setRelatorioDrawerAberto(false)
    pendingFecharProcessoTimeoutRef.current = setTimeout(() => {
      pendingFecharProcessoTimeoutRef.current = null
      useMapStore.getState().selecionarProcesso(null)
    }, DRAWER_CLOSE_ANIM_MS)
  } else {
    st.selecionarProcesso(null)
  }
}

const PROCESSO_POPUP_OFFSET_PX = 10
const PROCESSO_POPUP_MARGEM_BORDA_PX = 12
/** Deve ser removido com `popup.removeClassName(...)`: o Mapbox repõe o `className` do contentor em cada `move`. */
const PROCESSO_POPUP_LAYOUT_PENDING_CLASS = 'terrae-processo-popup--layout-pending'

type ProcessoPopupAnchor = NonNullable<mapboxgl.PopupOptions['anchor']>

/** Ordem: abaixo do ponto → acima → direita → esquerda → cantos (tip sempre no `lngLat`). */
const ANCHOR_PRIORITY: ProcessoPopupAnchor[] = [
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

function boundsAproximadosPopup(
  anchor: ProcessoPopupAnchor,
  pos: { x: number; y: number },
  w: number,
  h: number,
): { left: number; top: number; right: number; bottom: number } {
  switch (anchor) {
    case 'top':
      return {
        left: pos.x - w / 2,
        top: pos.y,
        right: pos.x + w / 2,
        bottom: pos.y + h,
      }
    case 'bottom':
      return {
        left: pos.x - w / 2,
        top: pos.y - h,
        right: pos.x + w / 2,
        bottom: pos.y,
      }
    case 'left':
      return {
        left: pos.x,
        top: pos.y - h / 2,
        right: pos.x + w,
        bottom: pos.y + h / 2,
      }
    case 'right':
      return {
        left: pos.x - w,
        top: pos.y - h / 2,
        right: pos.x,
        bottom: pos.y + h / 2,
      }
    case 'top-left':
      return {
        left: pos.x,
        top: pos.y,
        right: pos.x + w,
        bottom: pos.y + h,
      }
    case 'top-right':
      return {
        left: pos.x - w,
        top: pos.y,
        right: pos.x,
        bottom: pos.y + h,
      }
    case 'bottom-left':
      return {
        left: pos.x,
        top: pos.y - h,
        right: pos.x + w,
        bottom: pos.y,
      }
    case 'bottom-right':
      return {
        left: pos.x - w,
        top: pos.y - h,
        right: pos.x,
        bottom: pos.y,
      }
    default:
      return {
        left: pos.x - w / 2,
        top: pos.y - h / 2,
        right: pos.x + w / 2,
        bottom: pos.y + h / 2,
      }
  }
}

function retanguloCabeNoMapa(
  left: number,
  top: number,
  right: number,
  bottom: number,
  cw: number,
  ch: number,
  m: number,
): boolean {
  return left >= m && top >= m && right <= cw - m && bottom <= ch - m
}

function areaVisivelNoMapa(
  left: number,
  top: number,
  right: number,
  bottom: number,
  cw: number,
  ch: number,
  m: number,
): number {
  const il = Math.max(m, left)
  const it = Math.max(m, top)
  const ir = Math.min(cw - m, right)
  const ib = Math.min(ch - m, bottom)
  if (il >= ir || it >= ib) return 0
  return (ir - il) * (ib - it)
}

function escolherAnchorProcessoPopup(
  pos: { x: number; y: number },
  w: number,
  h: number,
  cw: number,
  ch: number,
): ProcessoPopupAnchor {
  const m = PROCESSO_POPUP_MARGEM_BORDA_PX
  for (const a of ANCHOR_PRIORITY) {
    const b = boundsAproximadosPopup(a, pos, w, h)
    if (retanguloCabeNoMapa(b.left, b.top, b.right, b.bottom, cw, ch, m)) {
      return a
    }
  }
  let melhor: ProcessoPopupAnchor = 'bottom'
  let maxA = 0
  for (const a of ANCHOR_PRIORITY) {
    const b = boundsAproximadosPopup(a, pos, w, h)
    const ar = areaVisivelNoMapa(b.left, b.top, b.right, b.bottom, cw, ch, m)
    if (ar > maxA) {
      maxA = ar
      melhor = a
    }
  }
  return melhor
}

/**
 * Mede o popup após o React pintar e escolhe âncora (top/bottom/left/right/cantos)
 * para o cartão caber no viewport do mapa; a seta do Mapbox continua no `lngLat`.
 */
function agendarAnchorVerticalProcessoPopup(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  lngLat: mapboxgl.LngLatLike,
): void {
  const MAX_TENTATIVAS_LAYOUT = 48
  let tentativas = 0

  const aplicar = () => {
    tentativas += 1
    if (!popup.isOpen()) return

    const el = popup.getElement()
    if (!el) {
      if (tentativas < MAX_TENTATIVAS_LAYOUT)
        requestAnimationFrame(aplicar)
      return
    }

    const h = el.offsetHeight
    const w = el.offsetWidth
    if (h < 16 || w < 16) {
      if (tentativas < MAX_TENTATIVAS_LAYOUT) {
        requestAnimationFrame(aplicar)
        return
      }
      popup.setOffset(PROCESSO_POPUP_OFFSET_PX)
      popup.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
      return
    }

    const container = map.getContainer()
    const cw = container.clientWidth
    const ch = container.clientHeight
    const pos = map.project(lngLat)

    const anchor = escolherAnchorProcessoPopup(pos, w, h, cw, ch)
    popup.options.anchor = anchor
    popup.setOffset(PROCESSO_POPUP_OFFSET_PX)
    popup.setLngLat(popup.getLngLat())
    popup.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(aplicar)
  })
}

function openProcessoPopupOnMap(
  map: mapboxgl.Map,
  proc: Processo,
  tearDownProcessoPopupDom: () => void,
  popupRootRef: MutableRefObject<Root | null>,
  processoPopupRef: MutableRefObject<mapboxgl.Popup | null>,
  pendingFecharProcessoTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
  onToggleRelatorioCompleto: () => void,
  onAbrirRelatorioAbaRisco: () => void,
) {
  if (pendingFecharProcessoTimeoutRef.current) {
    clearTimeout(pendingFecharProcessoTimeoutRef.current)
    pendingFecharProcessoTimeoutRef.current = null
  }

  tearDownProcessoPopupDom()

  const mountEl = document.createElement('div')
  const root = createRoot(mountEl)
  popupRootRef.current = root

  const lngLat: mapboxgl.LngLatLike = [proc.lng, proc.lat]

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    closeOnMove: false,
    anchor: 'bottom',
    offset: PROCESSO_POPUP_OFFSET_PX,
    maxWidth: 'none',
    className: `terrae-processo-popup ${PROCESSO_POPUP_LAYOUT_PENDING_CLASS}`,
  })
    .setLngLat(lngLat)
    .setDOMContent(mountEl)
    .addTo(map)

  processoPopupRef.current = popup

  const closePopup = () =>
    fecharProcessoPopupComoBotaoFechar(
      tearDownProcessoPopupDom,
      pendingFecharProcessoTimeoutRef,
    )

  root.render(
    <ProcessoPopupContent
      processo={proc}
      onClose={closePopup}
      onToggleRelatorioCompleto={onToggleRelatorioCompleto}
      onAbrirRelatorioAbaRisco={onAbrirRelatorioAbaRisco}
      onIrParaRadarAlerta={(al: AlertaLegislativo) => {
        const rid = radarFeedIdParaAlertaProcesso(proc.id, al)
        if (rid) useAppStore.getState().setPendingRadarAlertaId(rid)
        useAppStore.getState().setTelaAtiva('radar')
        closePopup()
      }}
      onVerTodosAlertasRadar={() => {
        useAppStore.getState().setPendingRadarAlertaId(null)
        useAppStore.getState().setRadarAbrirHomeIntent(true)
        closePopup()
        useAppStore.getState().setTelaAtiva('radar')
      }}
    />,
  )

  agendarAnchorVerticalProcessoPopup(map, popup, lngLat)
}

function attachProcessosLayerHandlers(
  map: mapboxgl.Map,
  tearDownProcessoPopupDom: () => void,
  popupRootRef: MutableRefObject<Root | null>,
  processoPopupRef: MutableRefObject<mapboxgl.Popup | null>,
  handlersRef: MutableRefObject<ProcessosLayerHandlers | null>,
  pendingFecharProcessoTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
  dragClickGuardRef: MutableRefObject<MapDragClickGuard>,
  onToggleRelatorioCompleto?: () => void,
  onAbrirRelatorioAbaRisco?: () => void,
) {
  const prev = handlersRef.current
  if (prev) {
    map.off('mousemove', 'processos-fill', prev.onMove)
    map.off('mouseleave', 'processos-fill', prev.onLeave)
    map.off('click', prev.onUnifiedClick)
    map.off('dragstart', prev.onDragStart)
    map.off('dragend', prev.onDragEnd)
    map.off('zoomstart', prev.onZoomStart)
    map.off('moveend', prev.onMoveEnd)
  }

  if (dragClickGuardRef.current.resetTimeoutId != null) {
    clearTimeout(dragClickGuardRef.current.resetTimeoutId)
    dragClickGuardRef.current.resetTimeoutId = null
  }

  const onMove = () => {
    map.getCanvas().style.cursor = 'pointer'
  }

  const onLeave = () => {
    map.getCanvas().style.cursor = ''
  }

  /**
   * Um único `click` no mapa: hit em polígono abre ou troca o popup; segundo clique no mesmo
   * polígono (processo já selecionado) fecha como o ✕; clique no vazio não fecha.
   */
  const onDragStart = () => {
    dispatchTerraeMapClearFloatingUi()
  }

  const onDragEnd = () => {
    const g = dragClickGuardRef.current
    if (g.resetTimeoutId != null) {
      clearTimeout(g.resetTimeoutId)
      g.resetTimeoutId = null
    }
    g.consumeNextClick = true
    g.resetTimeoutId = setTimeout(() => {
      g.consumeNextClick = false
      g.resetTimeoutId = null
    }, 500)
  }

  const onZoomStart = () => {
    /* Roda do rato: não há dragstart; fecha tooltips portaled. */
    dispatchTerraeMapClearFloatingUi()
  }

  const onMoveEnd = () => {
    const p = processoPopupRef.current
    if (!p?.isOpen()) return
    /* Fallback: sincroniza o Set interno do Mapbox por si o layout inicial não chegou a correr. */
    p.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
  }

  const onUnifiedClick = (e: mapboxgl.MapMouseEvent) => {
    const g = dragClickGuardRef.current
    if (g.consumeNextClick) {
      g.consumeNextClick = false
      if (g.resetTimeoutId != null) {
        clearTimeout(g.resetTimeoutId)
        g.resetTimeoutId = null
      }
      return
    }

    const alvo = e.originalEvent?.target
    if (
      alvo instanceof Element &&
      (alvo.closest('.mapboxgl-popup') ||
        alvo.closest('.terrae-processo-popup'))
    ) {
      return
    }

    const hits = map.queryRenderedFeatures(e.point, {
      layers: [...PROCESSOS_CLICK_LAYERS],
    })

    if (hits.length > 0) {
      for (const f of hits) {
        const rawId = f.properties?.id
        if (rawId == null || rawId === '') continue
        const idStr = String(rawId)
        const proc = useMapStore.getState().processos.find((x) => x.id === idStr)
        if (!proc) continue

        const sel = useMapStore.getState().processoSelecionado
        if (sel?.id === proc.id) {
          fecharProcessoPopupComoBotaoFechar(
            tearDownProcessoPopupDom,
            pendingFecharProcessoTimeoutRef,
          )
          return
        }

        if (pendingFecharProcessoTimeoutRef.current) {
          clearTimeout(pendingFecharProcessoTimeoutRef.current)
          pendingFecharProcessoTimeoutRef.current = null
        }

        useMapStore.getState().selecionarProcesso(proc)
        openProcessoPopupOnMap(
          map,
          proc,
          tearDownProcessoPopupDom,
          popupRootRef,
          processoPopupRef,
          pendingFecharProcessoTimeoutRef,
          onToggleRelatorioCompleto ?? (() => {}),
          onAbrirRelatorioAbaRisco ?? (() => {}),
        )
        return
      }
    }

    /* Mapa vazio: não teardown, não limpar seleção, não fechar drawer — pan/zoom/click fora do polígono mantêm o popover. */
    return
  }

  handlersRef.current = {
    onMove,
    onLeave,
    onUnifiedClick,
    onDragStart,
    onDragEnd,
    onZoomStart,
    onMoveEnd,
  }

  map.on('mousemove', 'processos-fill', onMove)
  map.on('mouseleave', 'processos-fill', onLeave)
  map.on('click', onUnifiedClick)
  map.on('dragstart', onDragStart)
  map.on('dragend', onDragEnd)
  map.on('zoomstart', onZoomStart)
  map.on('moveend', onMoveEnd)
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const processoPopupRef = useRef<mapboxgl.Popup | null>(null)
  const processoPopupRootRef = useRef<Root | null>(null)
  const processosLayerHandlersRef = useRef<ProcessosLayerHandlers | null>(null)
  const tearDownProcessoPopupRef = useRef<(() => void) | null>(null)
  const pendingFecharProcessoTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const mapDragClickGuardRef = useRef<MapDragClickGuard>({
    consumeNextClick: false,
    resetTimeoutId: null,
  })
  const applyingIntelDrillRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [introSearch, setIntroSearch] = useState(false)
  const [introLegend, setIntroLegend] = useState(false)
  const [introTheme, setIntroTheme] = useState(false)
  const [estiloAtivo, setEstiloAtivo] = useState(MAPBOX_STYLE_SATELLITE)
  const [modoLegenda, setModoLegenda] = useState<'regime' | 'substancia'>('regime')
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('regime')
  const modoVisualizacaoRef = useRef<ModoVisualizacao>('regime')
  modoVisualizacaoRef.current = modoVisualizacao

  const onMudarModoLegenda = useCallback((modo: 'regime' | 'substancia') => {
    setModoLegenda(modo)
    setModoVisualizacao((m) => (m === 'risco' ? m : modo))
  }, [])

  const onSubstanciaExplorada = useCallback(() => {
    if (modoVisualizacaoRef.current !== 'risco') {
      setModoVisualizacao('substancia')
      setModoLegenda('substancia')
    } else {
      setModoLegenda('substancia')
    }
  }, [])

  const filtros = useMapStore((s) => s.filtros)
  const substanciasFiltro = filtros.substancias

  const familiasAtivasNaLegenda = useMemo(() => {
    if (substanciasFiltro.length === 0) return null
    const normAtivas = new Set(substanciasFiltro.map(normalizeSubstanciaKey))
    const resultado = new Set<string>()
    for (const fam of FAMILIA_MINERAL_DEFS) {
      if (fam.substancias.some((s) => normAtivas.has(s))) {
        resultado.add(fam.id)
      }
    }
    return resultado
  }, [substanciasFiltro])

  const camadasGeo = useMapStore((s) => s.camadasGeo)
  const filtrosAlteradosCount = useMemo(
    () => countFiltrosAlterados(filtros),
    [filtros],
  )
  const [painelFiltrosAberto, setPainelFiltrosAberto] = useState(false)
  const { montado: painelFiltrosMontado, animar: painelFiltrosAnimar } =
    usePainelFiltrosAnimation(painelFiltrosAberto)
  const processoSelecionado = useMapStore((s) => s.processoSelecionado)
  const relatorioDrawerAberto = useMapStore((s) => s.relatorioDrawerAberto)
  const setRelatorioDrawerAberto = useMapStore((s) => s.setRelatorioDrawerAberto)
  const pendingNavigation = useMapStore((s) => s.pendingNavigation)
  const intelTitularFilter = useMapStore((s) => s.intelTitularFilter)
  const telaAtiva = useAppStore((s) => s.telaAtiva)

  const [camadaGeoTip, setCamadaGeoTip] = useState<{
    x: number
    y: number
    title: string
    meta: string
    borderColor: string
  } | null>(null)

  const mapIntelPaddingRestoreRef = useRef<{
    top: number
    right: number
    bottom: number
    left: number
  } | null>(null)

  const intelSidebarAutoCloseSeqActiveRef = useRef(false)
  const intelSidebarAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intelSidebarManualControlRef = useRef(false)
  const intelHoverIntentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearIntelSidebarAutoCloseTimer = useCallback(() => {
    if (intelSidebarAutoCloseTimerRef.current != null) {
      clearTimeout(intelSidebarAutoCloseTimerRef.current)
      intelSidebarAutoCloseTimerRef.current = null
    }
  }, [])

  const clearIntelHoverIntentTimer = useCallback(() => {
    if (intelHoverIntentTimerRef.current != null) {
      clearTimeout(intelHoverIntentTimerRef.current)
      intelHoverIntentTimerRef.current = null
    }
  }, [])

  const startIntelAutoCloseTimerAfterMoveEnd = useCallback(() => {
    if (!intelSidebarAutoCloseSeqActiveRef.current || intelSidebarManualControlRef.current) {
      return
    }
    clearIntelSidebarAutoCloseTimer()
    intelSidebarAutoCloseTimerRef.current = window.setTimeout(() => {
      intelSidebarAutoCloseTimerRef.current = null
      if (!intelSidebarAutoCloseSeqActiveRef.current || intelSidebarManualControlRef.current) {
        return
      }
      intelSidebarAutoCloseSeqActiveRef.current = false
      setPainelFiltrosAberto(false)
    }, 2500)
  }, [clearIntelSidebarAutoCloseTimer])

  const openIntelSidebarForPendingNavigation = useCallback(() => {
    clearIntelSidebarAutoCloseTimer()
    clearIntelHoverIntentTimer()
    intelSidebarManualControlRef.current = false
    intelSidebarAutoCloseSeqActiveRef.current = true
    setPainelFiltrosAberto(true)
  }, [clearIntelSidebarAutoCloseTimer, clearIntelHoverIntentTimer])

  const onIntelSidebarMouseEnter = useCallback(() => {
    if (!intelSidebarAutoCloseSeqActiveRef.current || intelSidebarManualControlRef.current) {
      return
    }
    clearIntelHoverIntentTimer()
    intelHoverIntentTimerRef.current = window.setTimeout(() => {
      intelHoverIntentTimerRef.current = null
      if (!intelSidebarAutoCloseSeqActiveRef.current) return
      intelSidebarManualControlRef.current = true
      clearIntelSidebarAutoCloseTimer()
    }, 300)
  }, [clearIntelHoverIntentTimer, clearIntelSidebarAutoCloseTimer])

  const onIntelSidebarMouseLeave = useCallback(() => {
    clearIntelHoverIntentTimer()
  }, [clearIntelHoverIntentTimer])

  const onIntelSidebarPointerDownCapture = useCallback(() => {
    if (!intelSidebarAutoCloseSeqActiveRef.current) return
    intelSidebarManualControlRef.current = true
    clearIntelSidebarAutoCloseTimer()
  }, [clearIntelSidebarAutoCloseTimer])

  useEffect(() => {
    if (painelFiltrosAberto) return

    clearIntelSidebarAutoCloseTimer()
    clearIntelHoverIntentTimer()
    intelSidebarAutoCloseSeqActiveRef.current = false
    intelSidebarManualControlRef.current = false

    const m = mapRef.current
    const snap = mapIntelPaddingRestoreRef.current
    if (m && snap) {
      mapIntelPaddingRestoreRef.current = null
      m.easeTo({
        padding: {
          top: snap.top,
          right: snap.right,
          bottom: snap.bottom,
          left: snap.left,
        },
        duration: 300,
        essential: true,
      })
    }
  }, [painelFiltrosAberto, clearIntelSidebarAutoCloseTimer, clearIntelHoverIntentTimer])

  useEffect(() => {
    return () => {
      clearIntelSidebarAutoCloseTimer()
      clearIntelHoverIntentTimer()
      intelSidebarAutoCloseSeqActiveRef.current = false
      intelSidebarManualControlRef.current = false
      const m = mapRef.current
      const snap = mapIntelPaddingRestoreRef.current
      if (m && snap) {
        mapIntelPaddingRestoreRef.current = null
        m.setPadding(snap)
      }
    }
  }, [clearIntelSidebarAutoCloseTimer, clearIntelHoverIntentTimer])

  const [relatorioAbaInicial, setRelatorioAbaInicial] = useState<
    'processo' | 'territorio' | 'inteligencia' | 'risco' | 'fiscal'
  >('processo')

  const verRelatorioRef = useRef<() => void>(() => {})
  verRelatorioRef.current = () => {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
      pendingFecharProcessoTimeoutRef.current = null
    }
    const st = useMapStore.getState()
    if (st.relatorioDrawerAberto) {
      st.setRelatorioDrawerAberto(false)
    } else {
      tearDownProcessoPopupRef.current?.()
      setRelatorioAbaInicial('processo')
      st.setRelatorioDrawerAberto(true)
    }
  }

  const abrirRelatorioAbaRiscoRef = useRef<() => void>(() => {})
  abrirRelatorioAbaRiscoRef.current = () => {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
      pendingFecharProcessoTimeoutRef.current = null
    }
    tearDownProcessoPopupRef.current?.()
    setRelatorioAbaInicial('risco')
    useMapStore.getState().setRelatorioDrawerAberto(true)
  }

  useEffect(() => {
    if (!processoSelecionado) setRelatorioDrawerAberto(false)
  }, [processoSelecionado, setRelatorioDrawerAberto])

  useEffect(() => {
    return useMapStore.subscribe((state) => {
      if (!state.intelDrillExpectedFiltrosJson) return
      if (applyingIntelDrillRef.current) return
      const exp = state.intelDrillExpectedFiltrosJson
      if (!exp) return
      const now = fingerprintDrillFiltros(
        state.filtros,
        state.intelTitularFilter,
      )
      if (now !== exp) {
        useMapStore.getState().dismissIntelDrillUi()
      }
    })
  }, [])

  useEffect(() => {
    if (!pendingNavigation || telaAtiva !== 'mapa' || !mapLoaded) return
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const nav: PendingNavigation = pendingNavigation
    const ts = nav.timestamp
    const delayMs = 400

    const timer = window.setTimeout(() => {
      const cur = useMapStore.getState().pendingNavigation
      if (!cur || cur.timestamp !== ts) return

      const tearDown = tearDownProcessoPopupRef.current
      if (!tearDown) return

      useMapStore.getState().setPendingNavigation(null)

      applyingIntelDrillRef.current = true

      const ensureSnapshot = () => {
        const st = useMapStore.getState()
        if (!st.intelDrillRestoreFiltros) {
          useMapStore.setState({
            intelDrillRestoreFiltros: cloneFiltrosState(st.filtros),
          })
        }
      }

      ensureSnapshot()
      useMapStore.getState().applySidebarFiltrosPadrao()

      const commitDrillUi = (patch: Partial<MapStore>) => {
        useMapStore.setState((s) => {
          const nextFiltros = patch.filtros ?? s.filtros
          const nextTitular =
            patch.intelTitularFilter !== undefined
              ? patch.intelTitularFilter
              : s.intelTitularFilter
          return {
            ...patch,
            intelDrillExpectedFiltrosJson: fingerprintDrillFiltros(
              nextFiltros,
              nextTitular,
            ),
          }
        })
      }

      const ensureIntelSnap = () => {
        if (!mapIntelPaddingRestoreRef.current) {
          mapIntelPaddingRestoreRef.current = { ...map.getPadding() }
        }
        return mapIntelPaddingRestoreRef.current
      }
      const intelPad = (uniform: number) => {
        const base = ensureIntelSnap()
        return {
          top: uniform,
          right: uniform,
          bottom: uniform,
          left: base.left + getIntelLeftReservePx(),
        }
      }
      const armAutoCloseOnMoveEnd = () => {
        map.once('moveend', () => {
          startIntelAutoCloseTimerAfterMoveEnd()
        })
      }

      const fitList = (list: Processo[], uniformInset: number) => {
        const b = boundsFromProcessos(list)
        if (b && !b.isEmpty()) {
          map.fitBounds(b, {
            padding: intelPad(uniformInset),
            duration: 1200,
            maxZoom: 12,
          })
        } else {
          map.fitBounds(BRAZIL_BOUNDS_LNG_LAT, {
            padding: intelPad(uniformInset),
            duration: 1000,
          })
        }
      }

      try {
        if (nav.type === 'processo') {
          const proc = useMapStore
            .getState()
            .processos.find((x) => x.id === nav.payload)
          if (!proc) return

          useMapStore.getState().selecionarProcesso(proc)
          openIntelSidebarForPendingNavigation()

          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            const b = boundsFromSingleProcesso(proc)
            let opened = false
            const openPop = () => {
              if (opened) return
              opened = true
              openProcessoPopupOnMap(
                map,
                proc,
                tearDown,
                processoPopupRootRef,
                processoPopupRef,
                pendingFecharProcessoTimeoutRef,
                () => verRelatorioRef.current(),
                () => abrirRelatorioAbaRiscoRef.current(),
              )
            }
            let timerArmed = false
            const armTimerOnce = () => {
              if (timerArmed) return
              timerArmed = true
              startIntelAutoCloseTimerAfterMoveEnd()
            }
            if (b && !b.isEmpty()) {
              map.fitBounds(b, {
                padding: intelPad(100),
                duration: 1000,
                maxZoom: 15,
              })
            } else {
              const padBase = ensureIntelSnap()
              map.flyTo({
                center: [proc.lng, proc.lat],
                zoom: 12,
                duration: 1000,
                essential: true,
                padding: {
                  top: padBase.top,
                  right: padBase.right,
                  bottom: padBase.bottom,
                  left: padBase.left + getIntelLeftReservePx(),
                },
              })
            }
            map.once('moveend', () => {
              openPop()
              armTimerOnce()
            })
            window.setTimeout(() => {
              openPop()
              armTimerOnce()
            }, 1100)
          })
          return
        }

        if (nav.type === 'estado') {
          const uf = nav.payload
          commitDrillUi({
            filtros: {
              ...useMapStore.getState().filtros,
              uf,
            },
            intelTitularFilter: null,
          })
          const list = useMapStore.getState().getProcessosFiltrados()
          const b = boundsFromProcessos(list)
          const manual = ufBoundsLngLat(uf)
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            if (b && !b.isEmpty()) {
              map.fitBounds(b, {
                padding: intelPad(80),
                duration: 1200,
                maxZoom: 10,
              })
            } else if (manual) {
              map.fitBounds(manual, {
                padding: intelPad(80),
                duration: 1200,
              })
            } else {
              map.fitBounds(BRAZIL_BOUNDS_LNG_LAT, {
                padding: intelPad(48),
                duration: 1000,
              })
            }
            armAutoCloseOnMoveEnd()
          })
          return
        }

        if (nav.type === 'regime') {
          const target = nav.payload
          const camadas = REGIMES.reduce(
            (acc, r) => {
              acc[r] = r === target
              return acc
            },
            {} as Record<Regime, boolean>,
          )
          commitDrillUi({
            filtros: {
              ...useMapStore.getState().filtros,
              camadas,
            },
            intelTitularFilter: null,
          })
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            fitList(useMapStore.getState().getProcessosFiltrados(), 80)
            armAutoCloseOnMoveEnd()
          })
          return
        }

        if (nav.type === 'titular') {
          const titular = nav.payload
          commitDrillUi({
            intelTitularFilter: titular,
          })
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            fitList(useMapStore.getState().getProcessosFiltrados(), 80)
            armAutoCloseOnMoveEnd()
          })
          return
        }

        if (nav.type === 'substancia') {
          const key = normalizeSubstanciaKey(nav.payload)
          commitDrillUi({
            filtros: {
              ...useMapStore.getState().filtros,
              substancias: [key],
            },
            intelTitularFilter: null,
          })
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            fitList(useMapStore.getState().getProcessosFiltrados(), 80)
            armAutoCloseOnMoveEnd()
          })
        }
      } finally {
        queueMicrotask(() => {
          applyingIntelDrillRef.current = false
        })
      }
    }, delayMs)

    return () => clearTimeout(timer)
  }, [
    pendingNavigation,
    telaAtiva,
    mapLoaded,
    openIntelSidebarForPendingNavigation,
    startIntelAutoCloseTimerAfterMoveEnd,
  ])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPainelFiltrosAberto(false)
        return
      }
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement
      if (
        el &&
        (el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement ||
          (el as HTMLElement).isContentEditable)
      ) {
        return
      }
      if (el instanceof HTMLInputElement) {
        if (el.type === 'range' || el.hasAttribute('data-terrae-period-range')) {
          return
        }
        return
      }
      e.preventDefault()
      setPainelFiltrosAberto((aberta) => !aberta)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const {
    mapChromeCollapsed,
    chromeTransitionMs,
    chromeExitMs,
    chromeEnterMs,
  } = useMapChromeTransition()
  const chromeEase = `${chromeTransitionMs}ms ease-out`
  const prevChromeCollapsedRef = useRef<boolean | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const introDurMs = motionMs(MOTION_MAP_INTRO_DURATION_MS, reducedMotion)
  const skipMapFirstLoadIntroRef = useRef(
    telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )

  useEffect(() => {
    if (telaAtiva === 'inteligencia' || telaAtiva === 'radar') {
      skipMapFirstLoadIntroRef.current = true
    }
  }, [telaAtiva])

  useEffect(() => {
    if (!mapLoaded) return
    if (reducedMotion) {
      setIntroSearch(true)
      setIntroLegend(true)
      setIntroTheme(true)
      return
    }
    if (skipMapFirstLoadIntroRef.current) {
      setIntroSearch(true)
      setIntroLegend(true)
      setIntroTheme(true)
      return
    }
    setIntroSearch(false)
    setIntroLegend(false)
    setIntroTheme(false)
    const ids = [
      window.setTimeout(() => setIntroSearch(true), MOTION_MAP_INTRO_SEARCH_DELAY_MS),
      window.setTimeout(() => setIntroLegend(true), MOTION_MAP_INTRO_LEGEND_DELAY_MS),
      window.setTimeout(() => setIntroTheme(true), MOTION_MAP_INTRO_THEME_DELAY_MS),
    ]
    return () => {
      for (const id of ids) clearTimeout(id)
    }
  }, [mapLoaded, reducedMotion, telaAtiva])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const prev = prevChromeCollapsedRef.current
    if (prev === null) {
      prevChromeCollapsedRef.current = mapChromeCollapsed
      map.resize()
      return
    }
    if (prev === mapChromeCollapsed) return
    prevChromeCollapsedRef.current = mapChromeCollapsed
    const id = window.setTimeout(() => {
      map.resize()
    }, chromeTransitionMs)
    return () => clearTimeout(id)
  }, [mapChromeCollapsed, mapLoaded, chromeTransitionMs])

  const trocarEstiloMapa = useCallback((novoIdentificador: string) => {
    setEstiloAtivo(novoIdentificador)
    const map = mapRef.current
    if (!map) return

    map.setStyle(novoIdentificador)
    map.once('styledata', () => {
      applySatelliteStylePostLoad(map, novoIdentificador)

      const filtrados = buildGeoJSON(
        useMapStore.getState().getProcessosFiltrados(),
        modoVisualizacaoRef.current,
      )
      if (!map.getSource('processos')) {
        addProcessosLayers(map, filtrados)
      }
      addCamadasGeoLayers(map, 'processos-fill', CAMADAS_GEO_JSON)
      syncCamadasGeoVisibility(map, useMapStore.getState().camadasGeo)
      const td = tearDownProcessoPopupRef.current
      if (td) {
        attachProcessosLayerHandlers(
          map,
          td,
          processoPopupRootRef,
          processoPopupRef,
          processosLayerHandlersRef,
          pendingFecharProcessoTimeoutRef,
          mapDragClickGuardRef,
          () => verRelatorioRef.current(),
          () => abrirRelatorioAbaRiscoRef.current(),
        )
      }
      const src = map.getSource('processos') as mapboxgl.GeoJSONSource | undefined
      src?.setData(filtrados)
    })
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapLoaded || !map?.isStyleLoaded()) return

    const src = map.getSource('processos') as mapboxgl.GeoJSONSource | undefined
    if (!src) return

    const filtrados = useMapStore.getState().getProcessosFiltrados()
    src.setData(buildGeoJSON(filtrados, modoVisualizacao))

    const sel = useMapStore.getState().processoSelecionado
    if (sel && !filtrados.some((p) => p.id === sel.id)) {
      tearDownProcessoPopupRef.current?.()
      useMapStore.getState().selecionarProcesso(null)
    }
  }, [mapLoaded, filtros, modoVisualizacao, intelTitularFilter])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.isStyleLoaded()) return
    syncCamadasGeoVisibility(map, camadasGeo)
  }, [mapLoaded, camadasGeo])

  useEffect(() => {
    const fn = () => setCamadaGeoTip(null)
    window.addEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, fn)
    return () => window.removeEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, fn)
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const onMove = (e: mapboxgl.MapMouseEvent) => {
      const procHits = map.queryRenderedFeatures(e.point, {
        layers: [...PROCESSOS_CLICK_LAYERS],
      })
      if (procHits.length > 0) {
        setCamadaGeoTip(null)
        return
      }
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [...CAMADA_GEO_HOVER_LAYER_IDS],
      })
      if (hits.length === 0) {
        setCamadaGeoTip(null)
        return
      }
      const f = hits[0]
      const lid = f.layer?.id
      if (!lid) {
        setCamadaGeoTip(null)
        return
      }
      const props = f.properties as Record<string, unknown> | undefined
      const fmt = formatCamadaGeoTooltip(lid, props)
      if (!fmt) {
        setCamadaGeoTip(null)
        return
      }
      const rect = map.getContainer().getBoundingClientRect()
      setCamadaGeoTip({
        x: rect.left + e.point.x + 12,
        y: rect.top + e.point.y + 12,
        title: fmt.title,
        meta: fmt.meta,
        borderColor: fmt.borderColor,
      })
    }

    const onLeave = () => setCamadaGeoTip(null)

    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
    }
  }, [mapLoaded])

  const camadasGeoLegendItems = useMemo(
    () => CAMADAS_GEO_LEGEND_ORDER.filter((id) => camadasGeo[id]),
    [camadasGeo],
  )

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.error('VITE_MAPBOX_TOKEN em falta')
      return
    }

    const tearDownProcessoPopupDom = () => {
      processoPopupRootRef.current?.unmount()
      processoPopupRootRef.current = null
      processoPopupRef.current?.remove()
      processoPopupRef.current = null
    }

    tearDownProcessoPopupRef.current = tearDownProcessoPopupDom

    let cancelled = false
    let ro: ResizeObserver | null = null
    let rafId = 0
    let attempts = 0
    const maxAttempts = 200
    let unsubHydration: (() => void) | undefined

    const dispose = () => {
      if (pendingFecharProcessoTimeoutRef.current) {
        clearTimeout(pendingFecharProcessoTimeoutRef.current)
        pendingFecharProcessoTimeoutRef.current = null
      }
      if (mapDragClickGuardRef.current.resetTimeoutId != null) {
        clearTimeout(mapDragClickGuardRef.current.resetTimeoutId)
        mapDragClickGuardRef.current.resetTimeoutId = null
      }
      mapDragClickGuardRef.current.consumeNextClick = false
      tearDownProcessoPopupDom()
      useMapStore.getState().selecionarProcesso(null)
      ro?.disconnect()
      ro = null
      const m = mapRef.current
      if (m) {
        m.remove()
        mapRef.current = null
      }
    }

    const mountMap = () => {
      if (cancelled || mapRef.current) return
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 2 || h < 2) {
        attempts += 1
        if (attempts > maxAttempts) {
          console.error(
            'MapView: container sem dimensões após várias tentativas (verifique o layout flex/altura).',
          )
          return
        }
        rafId = requestAnimationFrame(mountMap)
        return
      }

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: el,
        style: MAPBOX_STYLE_SATELLITE,
        center: [-51.9, -14.2],
        zoom: 4.0,
        projection: 'mercator',
        maxBounds: [
          [-82.0, -58.0],
          [-30.0, 13.0],
        ],
        minZoom: 3.5,
        maxZoom: 18,
      })

      mapRef.current = map

      ro = new ResizeObserver(() => {
        mapRef.current?.resize()
      })
      ro.observe(el)

      queueMicrotask(() => mapRef.current?.resize())

      map.on('load', () => {
        mapRef.current?.resize()

        const geoJSON = buildGeoJSON(
          useMapStore.getState().getProcessosFiltrados(),
          modoVisualizacaoRef.current,
        )
        console.log('features carregadas:', geoJSON.features.length)

        addProcessosLayers(map, geoJSON)
        addCamadasGeoLayers(map, 'processos-fill', CAMADAS_GEO_JSON)
        syncCamadasGeoVisibility(map, useMapStore.getState().camadasGeo)

        applySatelliteStylePostLoad(map, MAPBOX_STYLE_SATELLITE)

        setMapLoaded(true)

        attachProcessosLayerHandlers(
          map,
          tearDownProcessoPopupDom,
          processoPopupRootRef,
          processoPopupRef,
          processosLayerHandlersRef,
          pendingFecharProcessoTimeoutRef,
          mapDragClickGuardRef,
          () => verRelatorioRef.current(),
          () => abrirRelatorioAbaRiscoRef.current(),
        )

        const preSel = useMapStore.getState().processoSelecionado
        if (preSel) {
          openProcessoPopupOnMap(
            map,
            preSel,
            tearDownProcessoPopupDom,
            processoPopupRootRef,
            processoPopupRef,
            pendingFecharProcessoTimeoutRef,
            () => verRelatorioRef.current(),
            () => abrirRelatorioAbaRiscoRef.current(),
          )
          map.flyTo({
            center: [preSel.lng, preSel.lat],
            zoom: 10,
            essential: true,
          })
        }
      })
    }

    const beginAfterHydration = () => {
      if (cancelled) return
      mountMap()
    }

    if (useMapStore.persist.hasHydrated()) {
      beginAfterHydration()
    } else {
      unsubHydration = useMapStore.persist.onFinishHydration(() => {
        beginAfterHydration()
      })
    }

    return () => {
      cancelled = true
      processosLayerHandlersRef.current = null
      tearDownProcessoPopupRef.current = null
      cancelAnimationFrame(rafId)
      unsubHydration?.()
      setMapLoaded(false)
      dispose()
    }
  }, [])

  return (
    <div className="relative isolate h-full min-h-0 w-full bg-dark-primary">
      <div className="absolute inset-0 z-0 min-h-0 w-full">
        <div
          ref={containerRef}
          className="absolute inset-0 min-h-0 w-full overflow-hidden"
        />
      </div>
      <div
        className="pointer-events-none absolute left-0 right-0 top-4 z-10 flex flex-col items-center px-4"
        style={{
          transform: mapChromeCollapsed ? 'translateY(-132px)' : 'translateY(0)',
          opacity: mapChromeCollapsed ? 0 : 1,
          transformOrigin: '50% 0',
          transitionProperty: 'transform, opacity',
          transitionDuration: `${chromeExitMs}ms`,
          transitionTimingFunction: 'ease-out',
          transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs}ms`,
        }}
      >
        <div
          className="pointer-events-auto flex min-w-0 max-w-full flex-col items-center gap-2"
          style={{
            opacity: introSearch ? 1 : 0,
            transform: introSearch ? 'translateY(0)' : 'translateY(-20px)',
            transition: reducedMotion
              ? 'opacity 1ms linear, transform 1ms linear'
              : `opacity ${introDurMs}ms ease-out, transform ${introDurMs}ms ease-out`,
          }}
        >
          <MapSearchBar
            painelFiltrosAberto={painelFiltrosAberto}
            onTogglePainelFiltros={() =>
              setPainelFiltrosAberto((o) => !o)
            }
            filtrosAlteradosCount={filtrosAlteradosCount}
            modoRisco={modoVisualizacao === 'risco'}
            onToggleModoRisco={() =>
              setModoVisualizacao((m) =>
                m === 'risco' ? modoLegenda : 'risco',
              )
            }
          />
        </div>
      </div>
      {painelFiltrosMontado ? (
        <MapSidebar
          animar={painelFiltrosAnimar}
          onFechar={() => setPainelFiltrosAberto(false)}
          onIntelAutoCloseMouseEnter={onIntelSidebarMouseEnter}
          onIntelAutoCloseMouseLeave={onIntelSidebarMouseLeave}
          onIntelAutoClosePointerDownCapture={onIntelSidebarPointerDownCapture}
          onSubstanciaExplorada={onSubstanciaExplorada}
        />
      ) : null}
      {modoVisualizacao === 'risco' ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-solid text-[13px] text-[#888780]"
          style={{
            top: 16,
            right: 12,
            background: 'rgba(17, 17, 16, 0.9)',
            borderColor: '#2C2C2A',
            borderRadius: 8,
            padding: '10px 12px',
            transform: mapChromeCollapsed
              ? 'translateX(calc(100% + 32px))'
              : 'translateX(0)',
            opacity: mapChromeCollapsed ? 0 : 1,
            transition: `transform ${chromeEase}, opacity ${chromeEase}`,
            transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs * 0.5}ms`,
          }}
        >
          <p className="mb-2.5 text-[12px] font-medium uppercase tracking-[2px] text-[var(--text-section-title)]">
            Risk Score
          </p>
          <ul className="flex flex-col gap-2">
            {LEGENDA_RISCO_ITEMS.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[13px] leading-snug text-[#F1EFE8]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute z-10 flex flex-col"
        style={{
          bottom: 24,
          right: 12,
          gap: 8,
          transform: mapChromeCollapsed
            ? 'translateX(calc(100% + 32px))'
            : 'translateX(0)',
          opacity: mapChromeCollapsed ? 0 : 1,
          transition: `transform ${chromeEase}, opacity ${chromeEase}`,
          transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs * 0.5}ms`,
        }}
      >
        <div
          style={{
            opacity: introTheme ? 1 : 0,
            transform: introTheme ? 'translateX(0)' : 'translateX(20px)',
            transition: reducedMotion
              ? 'opacity 1ms linear, transform 1ms linear'
              : `opacity ${introDurMs}ms ease-out, transform ${introDurMs}ms ease-out`,
          }}
        >
          <div
            className="pointer-events-auto rounded-lg border border-solid"
            style={{
              background: 'rgba(17, 17, 16, 0.9)',
              borderColor: '#2C2C2A',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <MapStyleSwitcher estiloAtivo={estiloAtivo} onTrocar={trocarEstiloMapa} />
          </div>
        </div>
        <div
          style={{
            opacity: introLegend ? 1 : 0,
            transform: introLegend ? 'translateX(0)' : 'translateX(20px)',
            transition: reducedMotion
              ? 'opacity 1ms linear, transform 1ms linear'
              : `opacity ${introDurMs}ms ease-out, transform ${introDurMs}ms ease-out`,
          }}
        >
          <div
            className="pointer-events-auto rounded-lg border border-solid text-[13px] text-[#888780]"
            style={{
              background: 'rgba(17, 17, 16, 0.9)',
              borderColor: '#2C2C2A',
              borderRadius: 8,
              padding: '10px 12px',
              opacity:
                modoVisualizacao === 'risco'
                  ? 0.3
                  : painelFiltrosAberto
                    ? 0.5
                    : 1,
              transition: 'opacity 300ms ease',
            }}
          >
          <div
            className="mb-2.5 flex overflow-hidden rounded-md"
            style={{
              background: '#1A1A18',
              border: '1px solid #2C2C2A',
              height: 28,
            }}
          >
            <button
              type="button"
              onClick={() => onMudarModoLegenda('regime')}
              className="flex-1 cursor-pointer border-0 px-3 text-[11px] font-medium uppercase tracking-[1.5px] transition-colors"
              style={{
                background: modoLegenda === 'regime' ? '#2C2C2A' : 'transparent',
                color: modoLegenda === 'regime' ? '#F1EFE8' : '#5F5E5A',
              }}
            >
              Regimes
            </button>
            <button
              type="button"
              onClick={() => onMudarModoLegenda('substancia')}
              className="flex-1 cursor-pointer border-0 px-3 text-[11px] font-medium uppercase tracking-[1.5px] transition-colors"
              style={{
                background: modoLegenda === 'substancia' ? '#2C2C2A' : 'transparent',
                color: modoLegenda === 'substancia' ? '#F1EFE8' : '#5F5E5A',
                borderLeft: '1px solid #2C2C2A',
              }}
            >
              Substâncias
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gridTemplateRows: '1fr',
            }}
          >
            <div
              aria-hidden={modoLegenda !== 'regime'}
              style={{
                gridColumn: 1,
                gridRow: 1,
                minWidth: 0,
                opacity: modoLegenda === 'regime' ? 1 : 0,
                pointerEvents: modoLegenda === 'regime' ? 'auto' : 'none',
                zIndex: modoLegenda === 'regime' ? 1 : 0,
                transition: reducedMotion
                  ? 'opacity 1ms linear'
                  : 'opacity 200ms ease',
              }}
            >
              <ul className="flex flex-col gap-2">
                {(
                  [
                    'concessao_lavra',
                    'autorizacao_pesquisa',
                    'req_lavra',
                    'licenciamento',
                    'lavra_garimpeira',
                    'registro_extracao',
                  ] as Regime[]
                ).map((r) => (
                  <li
                    key={r}
                    className="flex items-center gap-2.5"
                    style={{
                      opacity: filtros.camadas[r] !== false ? 1 : 0.4,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: REGIME_COLORS_MAP[r] }}
                    />
                    <CamadaTooltipHover
                      texto={REGIME_BADGE_TOOLTIP[r]}
                      maxWidthPx={340}
                      bubblePadding="10px 12px"
                      preferBelow
                      className="min-w-0"
                    >
                      <span
                        className="cursor-help text-[13px] leading-snug text-[#F1EFE8]"
                        style={{
                          borderBottom: `1px dotted ${REGIME_COLORS[r]}`,
                        }}
                      >
                        {REGIME_LABELS[r]}
                      </span>
                    </CamadaTooltipHover>
                  </li>
                ))}
              </ul>
              <div
                className="my-2 shrink-0"
                style={{ height: 1, backgroundColor: '#2C2C2A' }}
              />
              <ul className="flex flex-col gap-2">
                {(
                  [
                    'disponibilidade',
                    'mineral_estrategico',
                    'bloqueio_provisorio',
                    'bloqueio_permanente',
                  ] as Regime[]
                ).map((r) => (
                  <li
                    key={r}
                    className="flex items-center gap-2.5"
                    style={{
                      opacity: filtros.camadas[r] !== false ? 1 : 0.4,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: REGIME_COLORS_MAP[r] }}
                    />
                    <CamadaTooltipHover
                      texto={REGIME_BADGE_TOOLTIP[r]}
                      maxWidthPx={340}
                      bubblePadding="10px 12px"
                      preferBelow
                      className="min-w-0"
                    >
                      <span
                        className="cursor-help text-[13px] leading-snug text-[#F1EFE8]"
                        style={{
                          borderBottom: `1px dotted ${REGIME_COLORS[r]}`,
                        }}
                      >
                        {REGIME_LABELS[r]}
                      </span>
                    </CamadaTooltipHover>
                  </li>
                ))}
              </ul>
              {camadasGeoLegendItems.length > 0 ? (
                <>
                  <div
                    className="my-2.5 shrink-0"
                    style={{
                      height: 1,
                      backgroundColor: '#2C2C2A',
                    }}
                  />
                  <ul className="flex flex-col gap-2">
                    {camadasGeoLegendItems.map((id) => (
                      <li key={id} className="flex items-center gap-2.5">
                        {id === 'ferrovias' ? (
                          <span
                            className="h-0.5 w-6 shrink-0 rounded-sm"
                            style={{
                              backgroundColor: CAMADAS_GEO_COLOR[id],
                            }}
                          />
                        ) : (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CAMADAS_GEO_COLOR[id] }}
                          />
                        )}
                        <span className="text-[13px] leading-snug text-[#F1EFE8]">
                          {CAMADAS_GEO_LABEL[id]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div
              aria-hidden={modoLegenda !== 'substancia'}
              style={{
                gridColumn: 1,
                gridRow: 1,
                minWidth: 0,
                opacity: modoLegenda === 'substancia' ? 1 : 0,
                pointerEvents: modoLegenda === 'substancia' ? 'auto' : 'none',
                zIndex: modoLegenda === 'substancia' ? 1 : 0,
                transition: reducedMotion
                  ? 'opacity 1ms linear'
                  : 'opacity 200ms ease',
              }}
            >
              <ul className="flex flex-col gap-2">
                {FAMILIA_MINERAL_DEFS.filter((f) => f.id !== 'outros').map(
                  (fam) => (
                    <li
                      key={fam.id}
                      className="flex items-center gap-2.5"
                      style={{
                        opacity:
                          familiasAtivasNaLegenda === null ||
                          familiasAtivasNaLegenda.has(fam.id)
                            ? 1
                            : 0.4,
                        transition: 'opacity 200ms ease',
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: fam.color }}
                      />
                      <span className="text-[13px] leading-snug text-[#F1EFE8]">
                        {fam.label}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
        </div>
      </div>
      <RelatorioCompleto
        processo={processoSelecionado}
        aberto={relatorioDrawerAberto}
        onFechar={() => setRelatorioDrawerAberto(false)}
        abaInicial={relatorioAbaInicial}
      />
      {camadaGeoTip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[10050]"
              style={{
                left: camadaGeoTip.x,
                top: camadaGeoTip.y,
              }}
            >
              <div
                style={{
                  background: '#2C2C2A',
                  border: `1px solid ${camadaGeoTip.borderColor}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  maxWidth: 280,
                }}
              >
                <div
                  className="font-bold leading-snug"
                  style={{ fontSize: 13, color: '#D3D1C7' }}
                >
                  {camadaGeoTip.title}
                </div>
                {camadaGeoTip.meta ? (
                  <div
                    className="mt-1 leading-snug"
                    style={{ fontSize: 13, color: '#888780' }}
                  >
                    {camadaGeoTip.meta}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

```

## 3. Barra de Busca
**Arquivo:** `src/components/map/MapSearchBar.tsx`
```tsx
import { Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMapStore } from '../../store/useMapStore'

const NUMERO_RX = /\d{3}\.\d{3}\/\d{4}/

type MapSearchBarProps = {
  painelFiltrosAberto: boolean
  onTogglePainelFiltros: () => void
  filtrosAlteradosCount: number
  modoRisco: boolean
  onToggleModoRisco: () => void
}

export function MapSearchBar({
  painelFiltrosAberto,
  onTogglePainelFiltros,
  filtrosAlteradosCount,
  modoRisco,
  onToggleModoRisco,
}: MapSearchBarProps) {
  const searchQuery = useMapStore((s) => s.filtros.searchQuery)
  const [local, setLocal] = useState(searchQuery)
  const [inputFocado, setInputFocado] = useState(false)
  const [badgePulse, setBadgePulse] = useState(false)
  const prevFiltrosCountRef = useRef<number | null>(null)
  const setFiltro = useMapStore((s) => s.setFiltro)
  const processos = useMapStore((s) => s.processos)
  const requestFlyTo = useMapStore((s) => s.requestFlyTo)

  useEffect(() => {
    setLocal(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (prevFiltrosCountRef.current === null) {
      prevFiltrosCountRef.current = filtrosAlteradosCount
      return
    }
    if (prevFiltrosCountRef.current !== filtrosAlteradosCount) {
      prevFiltrosCountRef.current = filtrosAlteradosCount
      setBadgePulse(true)
      const t = window.setTimeout(() => setBadgePulse(false), 300)
      return () => clearTimeout(t)
    }
  }, [filtrosAlteradosCount])

  const onChange = (v: string) => {
    setLocal(v)
    setFiltro('searchQuery', v)
  }

  const tryFlyToNumero = useCallback(() => {
    const m = local.match(NUMERO_RX)
    if (!m) return
    const alvo = processos.find((p) => p.numero.replace(/\s/g, '') === m[0].replace(/\s/g, ''))
    if (alvo) requestFlyTo(alvo.lat, alvo.lng, 10)
  }, [local, processos, requestFlyTo])

  return (
    <div
      className="group pointer-events-auto relative box-border flex h-12 w-[min(680px,50vw)] min-w-[min(600px,100%)] max-w-[100%] shrink-0 items-center rounded-[24px] border border-solid px-0"
      style={{
        backgroundColor: 'rgba(13, 13, 12, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: inputFocado ? '#EF9F27' : 'rgba(95, 94, 90, 0.3)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 200ms ease',
      }}
    >
      <button
        type="button"
        aria-expanded={painelFiltrosAberto}
        aria-label="Filtros do mapa"
        onClick={onTogglePainelFiltros}
        className={`relative box-border flex h-full shrink-0 cursor-pointer items-center border-0 px-3 transition-colors ${
          painelFiltrosAberto
            ? 'text-[#EF9F27] hover:text-[#EF9F27]'
            : 'text-[#888780] hover:text-[#D3D1C7]'
        }`}
        style={{ borderRight: '1px solid #3a3a38', paddingLeft: 12, paddingRight: 12 }}
      >
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
          {filtrosAlteradosCount > 0 ? (
            <span
              className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF9F27] px-1 text-[10px] font-bold leading-none text-[#0D0D0C] ${badgePulse ? 'terrae-badge-pulse' : ''}`}
              aria-hidden
            >
              {filtrosAlteradosCount > 99 ? '99+' : filtrosAlteradosCount}
            </span>
          ) : null}
        </span>
      </button>
      <Search
        size={18}
        strokeWidth={2}
        className="ml-3 shrink-0 text-[#888780]"
        aria-hidden
      />
      <input
        type="search"
        value={local}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setInputFocado(true)}
        onBlur={() => setInputFocado(false)}
        onKeyDown={(e) => e.key === 'Enter' && tryFlyToNumero()}
        placeholder="Buscar endereço, cidade, estado ou número do processo..."
        className="min-w-0 flex-1 border-0 bg-transparent pl-3 text-[15px] text-[#F1EFE8] outline-none placeholder:text-[15px] placeholder:text-[#5F5E5A]"
      />
      <div
        className="flex h-full shrink-0 items-center justify-center self-stretch"
        style={{ borderLeft: '1px solid #3a3a38', paddingLeft: 16, paddingRight: 20 }}
      >
        <button
          type="button"
          aria-pressed={modoRisco}
          onClick={onToggleModoRisco}
          className={`cursor-pointer border-0 bg-transparent px-0 text-[14px] font-normal transition-colors ${
            modoRisco
              ? 'text-[#EF9F27]'
              : 'text-[#888780] hover:text-[#D3D1C7]'
          }`}
        >
          Risk Score
        </button>
      </div>
    </div>
  )
}

```

## 4. Definições de Regimes
**Arquivo:** `src/lib/regimes.ts`
```tsx
import type { Regime } from '../types'

export const REGIME_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  lavra_garimpeira: '#8B6F47',
  registro_extracao: '#6B8A9A',
  disponibilidade: '#5AB8B8',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

/** Cores mais saturadas/brilhantes só para polígonos no mapa (contraste sobre satellite). */
export const REGIME_COLORS_MAP: Record<Regime, string> = {
  concessao_lavra: '#5AA3D4',
  autorizacao_pesquisa: '#6DBF82',
  req_lavra: '#A08FD4',
  licenciamento: '#8DB86A',
  lavra_garimpeira: '#A3824F',
  registro_extracao: '#7DA4B8',
  disponibilidade: '#68D4D4',
  mineral_estrategico: '#35B88A',
  bloqueio_provisorio: '#E0A96A',
  bloqueio_permanente: '#CC6B6B',
}

export const REGIME_LABELS: Record<Regime, string> = {
  concessao_lavra: 'Concessão de Lavra',
  autorizacao_pesquisa: 'Autorização de Pesquisa',
  req_lavra: 'Req. de Lavra',
  licenciamento: 'Licenciamento',
  lavra_garimpeira: 'Lavra Garimpeira',
  registro_extracao: 'Registro de Extração',
  disponibilidade: 'Disponibilidade',
  mineral_estrategico: 'Mineral Estratégico',
  bloqueio_provisorio: 'Bloqueio Provisório',
  bloqueio_permanente: 'Bloqueio Permanente',
}

/** Ordem de pintura: primeiro = fundo */
export const REGIME_LAYER_ORDER: Regime[] = [
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

/** Textos explicativos dos badges de regime (popup, relatório, dashboard, legenda). */
export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
  concessao_lavra:
    'Autorização definitiva para exploração mineral, concedida pela ANM após aprovação do plano de aproveitamento econômico. Publicada no DOU. Representa o estágio mais avançado do processo minerário. Inclui processos em fase de Requerimento de Lavra e Direito de Requerer a Lavra.',
  autorizacao_pesquisa:
    'Permissão para realizar pesquisa mineral na área, concedida pela ANM. Publicada no DOU. O titular tem prazo para apresentar relatório de pesquisa com os resultados. Inclui processos em fase de Requerimento de Pesquisa e Reconhecimento Geológico.',
  req_lavra:
    'Pedido de concessão de lavra em análise pela ANM, após aprovação do relatório de pesquisa. Publicada no DOU. Etapa intermediária entre a pesquisa e a concessão definitiva.',
  licenciamento:
    'Regime simplificado para minerais de uso imediato na construção civil (areia, cascalho, argila, brita). A autorização é concedida pela prefeitura municipal, não pela ANM. Inclui processos em fase de Requerimento de Licenciamento.',
  lavra_garimpeira:
    'Regime específico para atividade garimpeira, exercida individualmente ou em cooperativas. Regulamentado pela ANM com requisitos simplificados. Inclui processos em fase de Requerimento de Lavra Garimpeira.',
  registro_extracao:
    'Regime para extração de minerais por órgãos da administração pública para uso em obras públicas. Registrado na ANM. Inclui processos em fase de Requerimento de Registro de Extração.',
  disponibilidade:
    'Área devolvida ao patrimônio mineral da União, disponível para novo requerimento por qualquer interessado. Representa oportunidade de aquisição de direitos minerários. Inclui processos classificados como Apto para Disponibilidade.',
  mineral_estrategico:
    'Área com ocorrência de minerais classificados como estratégicos pelo governo federal (nióbio, terras raras, lítio, entre outros). Sujeita a regras especiais de exploração e eventual prioridade governamental.',
  bloqueio_provisorio:
    'Área temporariamente impedida de avançar no processo de titularidade. Pode ser por pendência administrativa, sobreposição com terra indígena ou unidade de conservação, ou disputa judicial. A situação pode ser revertida.',
  bloqueio_permanente:
    'A ANM indeferiu definitivamente o requerimento para esta área. O bloqueio pode ter sido por irregularidade específica do titular anterior e não necessariamente da área em si. A área pode ficar disponível para novo requerimento.',
}

/**
 * Mapeamento dos 15 regimes reais da ANM para os 9 grupos do TERRADAR.
 * Usado para normalizar dados importados do SIGMINE/Cadastro Mineiro.
 */
export const REGIME_ANM_PARA_TERRADAR: Record<string, Regime> = {
  'CONCESSÃO DE LAVRA': 'concessao_lavra',
  'REQUERIMENTO DE LAVRA': 'concessao_lavra',
  'DIREITO DE REQUERER A LAVRA': 'concessao_lavra',
  'AUTORIZAÇÃO DE PESQUISA': 'autorizacao_pesquisa',
  'REQUERIMENTO DE PESQUISA': 'autorizacao_pesquisa',
  'RECONHECIMENTO GEOLÓGICO': 'autorizacao_pesquisa',
  LICENCIAMENTO: 'licenciamento',
  'REQUERIMENTO DE LICENCIAMENTO': 'licenciamento',
  'LAVRA GARIMPEIRA': 'lavra_garimpeira',
  'REQUERIMENTO DE LAVRA GARIMPEIRA': 'lavra_garimpeira',
  'REGISTRO DE EXTRAÇÃO': 'registro_extracao',
  'REQUERIMENTO DE REGISTRO DE EXTRAÇÃO': 'registro_extracao',
  DISPONIBILIDADE: 'disponibilidade',
  'APTO PARA DISPONIBILIDADE': 'disponibilidade',
  'DADO NÃO CADASTRADO': 'disponibilidade', // fallback para dados sem regime
}

```

## 5. Definições de Substâncias
**Arquivo:** `src/lib/substancias.ts`
```tsx
import {
  Atom,
  CircleDot,
  Diamond,
  Disc,
  Gem,
  Hexagon,
  Mountain,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Valor sentinela no multi-select de substâncias (“Todas” no UI). */
export const TODAS_SUBST = '__TODAS__'

export type SubstanciaDef = {
  key: string
  label: string
  Icon: LucideIcon
  color: string
  estrategico: boolean
}

export const SUBSTANCIA_DEFS: SubstanciaDef[] = [
  { key: 'FERRO', label: 'Ferro', Icon: CircleDot, color: '#7EADD4', estrategico: false },
  { key: 'COBRE', label: 'Cobre', Icon: Hexagon, color: '#C87C5B', estrategico: false },
  { key: 'OURO', label: 'Ouro', Icon: Gem, color: '#D4A843', estrategico: false },
  { key: 'NIOBIO', label: 'Nióbio', Icon: Atom, color: '#5CBFA0', estrategico: true },
  { key: 'RARE', label: 'Terras Raras', Icon: Sparkles, color: '#3D8B7A', estrategico: true },
  { key: 'LITIO', label: 'Lítio', Icon: Zap, color: '#9BB8D0', estrategico: true },
  { key: 'NIQUEL', label: 'Níquel', Icon: Disc, color: '#8FAA8D', estrategico: true },
  { key: 'BAUXITA', label: 'Bauxita', Icon: Mountain, color: '#B8917A', estrategico: false },
  { key: 'QUARTZO', label: 'Quartzo', Icon: Diamond, color: '#C4B89A', estrategico: false },
]

/** Normaliza para comparar com `key` em SUBSTANCIA_DEFS (sem acentos, maiúsculas). */
export function normalizeSubstanciaKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/** Terras raras e outros nomes fora de SUBSTANCIA_DEFS (chave normalizada). */
const LABEL_SUBSTANCIA_EXTRA: Record<string, string> = {
  NEODIMIO: 'Neodímio',
  PRASEODIMIO: 'Praseodímio',
  TERBIO: 'Térbio',
  DISPROSIO: 'Disprósio',
}

/** Rótulo para exibição no relatório (acentuação correta; ex.: NIQUEL → Níquel). */
export function labelSubstanciaParaExibicao(raw: string): string {
  const key = normalizeSubstanciaKey(raw)
  const def = SUBSTANCIA_DEFS.find((d) => d.key === key)
  if (def) return def.label
  const extra = LABEL_SUBSTANCIA_EXTRA[key]
  if (extra) return extra
  const t = raw.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** Chaves dos elementos de terras raras (para toggle em grupo). */
export const RARE_KEYS = ['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPRÓSIO'] as const

```

## 6. Mapeamento de Famílias Minerais
**Arquivo:** `src/lib/substanciaFamilias.ts`
```tsx
import { normalizeSubstanciaKey } from './substancias'

export type FamiliaMineralId =
  | 'metais_ferrosos'
  | 'metais_preciosos'
  | 'metais_base'
  | 'minerais_estrategicos'
  | 'minerais_industriais'
  | 'rochas_ornamentais'
  | 'materiais_construcao'
  | 'gemas_pedras'
  | 'energeticos'
  | 'aguas_minerais'
  | 'outros'

export interface FamiliaMineralDef {
  id: FamiliaMineralId
  label: string
  color: string
  substancias: string[]
}

type FamiliaMineralRaw = Omit<FamiliaMineralDef, 'substancias'> & {
  substanciasRaw: string[]
}

const RAW: FamiliaMineralRaw[] = [
    {
      id: 'metais_ferrosos',
      label: 'Metais Ferrosos',
      color: '#7EADD4',
      substanciasRaw: [
        'FERRO',
        'FERRO MANGANÊS',
        'HEMATITA',
        'MAGNETITA',
        'ITABIRITO',
        'LATERITA FERRUGINOSA',
        'MANGANÊS',
        'CROMO',
        'CROMITA',
        'MINÉRIO DE FERRO',
        'MINÉRIO DE MANGANÊS',
        'MINÉRIO DE CROMO',
        'TITÂNIO',
        'TITANITA',
        'ILMENITA',
        'RUTILO',
        'MINÉRIO DE TITÂNIO',
        'VANÁDIO',
        'MINÉRIO DE VANÁDIO',
        'CANGA',
      ],
    },
    {
      id: 'metais_preciosos',
      label: 'Metais Preciosos',
      color: '#D4A843',
      substanciasRaw: [
        'OURO',
        'OURO NATIVO',
        'OURO PIGMENTO',
        'PRATA',
        'PLATINA',
        'PALÁDIO',
        'ALUVIÃO AURÍFERO',
        'MINÉRIO DE OURO',
        'MINÉRIO DE PRATA',
        'MINÉRIO DE PLATINA',
        'MINÉRIO DE PALÁDIO',
      ],
    },
    {
      id: 'metais_base',
      label: 'Metais Base',
      color: '#C87C5B',
      substanciasRaw: [
        'COBRE',
        'ZINCO',
        'CHUMBO',
        'ESTANHO',
        'NÍQUEL',
        'CASSITERITA',
        'GALENA',
        'ALUVIÃO ESTANÍFERO',
        'MINÉRIO DE COBRE',
        'MINÉRIO DE ZINCO',
        'MINÉRIO DE CHUMBO',
        'MINÉRIO DE ESTANHO',
        'MINÉRIO DE NÍQUEL',
        'SILICATOS DE NÍQUEL',
        'SULFETOS DE CHUMBO',
        'MOLIBDÊNIO',
        'MOLIBDENITA',
        'MINÉRIO DE MOLIBDÊNIO',
        'BISMUTO',
        'MINÉRIO DE BISMUTO',
        'ARSÊNIO',
        'MINÉRIO DE ARSÊNICO',
        'CÁDMIO',
        'MINÉRIO DE CÁDMIO',
        'ANTIMÔNIO',
        'MINÉRIO DE ANTIMÔNIO',
        'MERCÚRIO',
        'MINÉRIO DE MERCÚRIO',
        'TUNGSTÊNIO',
        'WOLFRAMITA',
        'SCHEELITA',
        'MINÉRIO DE TUNGSTÊNIO',
      ],
    },
    {
      id: 'minerais_estrategicos',
      label: 'Minerais Estratégicos',
      color: '#5CBFA0',
      substanciasRaw: [
        'NIÓBIO',
        'PIROCLORO',
        'COLUMBITA',
        'LÍTIO',
        'ESPODUMÊNIO',
        'LEPIDOLITA',
        'PETALITA',
        'AMBLIGONITA',
        'MINÉRIO DE LÍTIO',
        'MINÉRIO DE NIÓBIO',
        'TERRAS RARAS',
        'MONAZITA',
        'MINÉRIO DE CÉRIO',
        'TÂNTALO',
        'TANTALITA',
        'TANTALITA-COLUMBITA',
        'MINÉRIO DE TÂNTALO',
        'BERÍLIO',
        'BERILO',
        'MINÉRIO DE BERÍLIO',
        'ZIRCÔNIO',
        'ZIRCÃO',
        'ZIRCONITA',
        'MINÉRIO DE ZIRCÔNIO',
        'HÁFNIO',
        'GRAFITA',
        'MINÉRIO DE COBALTO',
        'MINÉRIO DE CÉSIO',
        'POLUCITA',
        'MINÉRIO DE RUBÍDIO',
        'MINÉRIO DE SILÍCIO',
        'MINÉRIO DE URÂNIO',
        'ESTRÔNCIO',
      ],
    },
    {
      id: 'minerais_industriais',
      label: 'Minerais Industriais',
      color: '#9B8EC4',
      substanciasRaw: [
        'QUARTZO',
        'QUARTZO INDUSTRIAL',
        'CRISTAL DE ROCHA',
        'SÍLICA',
        'SÍLEX',
        'BAUXITA',
        'BAUXITA FOSFOROSA',
        'GIBBSITA',
        'HIDRARGILITA',
        'MINÉRIO DE ALUMÍNIO',
        'ALUMÍNIO',
        'FELDSPATO',
        'NEFELINA',
        'NEFELINA SIENITO',
        'CAULIM',
        'CAULIM ARGILOSO',
        'CAULINITA',
        'TALCO',
        'ESTEATITO',
        'PIROFILITA',
        'AGALMATOLITO',
        'MICA',
        'MOSCOVITA',
        'BIOTITA GRANITO',
        'CALCITA',
        'DOLOMITO',
        'MAGNESITA',
        'MAGNÉSIO',
        'MINÉRIO DE MAGNÉSIO',
        'SAIS DE MAGNÉSIO',
        'BARITA',
        'FLUORITA',
        'APATITA',
        'FOSFATO',
        'FOSFORITA (O)',
        'ROCHA FOSFÁTICA',
        'GIPSITA',
        'GIPSO',
        'ANIDRITA',
        'BENTONITA',
        'ARGILA BENTONÍTICA',
        'MONTMORILONITA',
        'SAPONITA',
        'ATAPULGITA',
        'DIATOMITA',
        'DIATOMITO',
        'TRIPOLITO',
        'VERMICULITA',
        'BORATOS',
        'ENXOFRE',
        'PIRITA',
        'SALGEMA',
        'SILVINITA',
        'CARNALITA',
        'SAIS DE POTÁSSIO',
        'NITRATO DE POTÁSSIO',
        'ROCHA POTÁSSICA',
        'SAIS DE SÓDIO',
        'SAIS DE BROMO',
        'LEUCITA',
        'CIANITA',
        'ANDALUZITA',
        'CORDIERITA',
        'CORÍNDON',
        'OLIVINA',
        'ANTOFILITA',
        'ANFIBÓLIO',
        'GRANADA',
        'OCRE',
        'GUANO',
        'ALGAS CALCÁREAS',
        'CONCHAS CALCÁRIAS',
        'PEDRA CALCÁRIA',
        'SAPROPELITO',
        'DIOPSÍDIO',
        'PIROXENITO',
        'DUNITO',
      ],
    },
    {
      id: 'rochas_ornamentais',
      label: 'Rochas Ornamentais',
      color: '#B8917A',
      substanciasRaw: [
        'GRANITO',
        'GRANITO ORNAMENTAL',
        'GRANITO P/ REVESTIMENTO',
        'GRANITO P/ BRITA',
        'GRANITO GNÁISSICO',
        'BIOTITA GRANITO',
        'SIENO GRANITO',
        'MÁRMORE',
        'MÁRMORE DOLOMÍTICO',
        'MÁRMORE P/ REVESTIMENTO',
        'GNAISSE',
        'GNAISSE ORNAMENTAL',
        'GNAISSE P/ REVESTIMENTO',
        'GNAISSE INDUSTRIAL',
        'GNAISSE P/ BRITA',
        'ARDÓSIA',
        'QUARTZITO',
        'QUARTZITO P/ REVESTIMENTO',
        'QUARTZITO INDUSTRIAL',
        'QUARTZITO FRIÁVEL',
        'QUARTZITO SERICITICO',
        'MIGMATITO',
        'MIGMATITO ORNAMENTAL',
        'MIGMATITO P/ BRITA',
        'MIGMATITO INDUSTRIAL',
        'GRANODIORITO',
        'GRANODIORITO INDUSTRIAL',
        'GRANODIORITO P/ REVESTIMENTO',
        'SIENITO',
        'SIENITO ORNAMENTAL',
        'SIENITO INDUSTRIAL',
        'PEDRA ORNAMENTAL',
        'PEDRA CORADA',
        'SODALITA',
        'SODALITA SIENITO',
        'SERPENTINITO',
        'LEUCOFILITO',
      ],
    },
    {
      id: 'materiais_construcao',
      label: 'Materiais de Construção',
      color: '#888780',
      substanciasRaw: [
        'AREIA',
        'AREIA COMUM',
        'AREIA LAVADA',
        'AREIA FLUVIAL',
        'AREIA ALUVIONAR',
        'AREIA INDUSTRIAL',
        'AREIA IN NATURA',
        'AREIA QUARTZOSA',
        'AREIA DE FUNDIÇÃO',
        'AREIA P/ VIDRO',
        'ARGILA',
        'ARGILA COMUM',
        'ARGILA VERMELHA',
        'ARGILA P/CER. VERMELH',
        'ARGILA BRANCA',
        'ARGILA ALUMINOSA',
        'ARGILA CAULÍNICA',
        'ARGILA FERRUGINOSA',
        'ARGILA REFRATÁRIA',
        'ARGILITO',
        'CALCÁRIO',
        'CALCÁRIO CALCÍTICO',
        'CALCÁRIO DOLOMÍTICO',
        'CALCÁRIO MAGNESIANO',
        'CALCÁRIO INDUSTRIAL',
        'CALCÁRIO P/ BRITA',
        'CALCÁRIO CONCHÍFERO',
        'CALCÁRIO CORALÍNEO',
        'BRITA DE GRANITO',
        'CASCALHO',
        'CASCALHO SILICOSO',
        'PEDREGULHO',
        'SEIXOS',
        'SEIXOS ROLADOS',
        'SAIBRO',
        'BASALTO',
        'BASALTO P/ BRITA',
        'BASALTO P/ REVESTIMENTO',
        'DIABÁSIO',
        'DIABÁSIO P/ BRITA',
        'DIABÁSIO P/ REVESTIMENTO',
        'DIORITO',
        'DIORITO P/ BRITA',
        'TONALITO',
        'MONZONITO',
        'ARENITO',
        'ARCÓSIO',
        'SILTITO',
        'CONGLOMERADO',
        'METACONGLOMERADO',
        'FILITO',
        'MICAXISTO',
        'ANFIBOLITO',
        'LATERITA',
        'VARVITO',
        'ANDESITO',
        'ANORTOSITO',
        'CHARNOQUITO',
        'ENDERBITO',
        'DACITO',
        'RIÓLITO',
        'TRAQUITO',
        'FONÓLITO',
        'TINGUAÍTO',
        'TUFO',
        'TUFO VULCÂNICO',
        'GABRO',
        'GRANULITO',
        'KINZIGITO',
        'CATACLASITO',
        'PEGMATITO',
        'XISTO',
        'XISTO ARGILOSO',
      ],
    },
    {
      id: 'gemas_pedras',
      label: 'Gemas e Pedras Preciosas',
      color: '#E07A9E',
      substanciasRaw: [
        'DIAMANTE',
        'DIAMANTE INDUSTRIAL',
        'CASCALHO DIAMANTÍFERO',
        'ESMERALDA',
        'RUBI',
        'SAFIRA',
        'ÁGUA MARINHA',
        'MORGANITA',
        'CRISOBERILO',
        'ALEXANDRITA',
        'TOPÁZIO',
        'TOPÁZIO IMPERIAL',
        'TURMALINA',
        'TURQUESA',
        'AMETISTA',
        'CITRINO',
        'ÁGATA',
        'CALCEDÔNIA',
        'OPALA',
        'CRISOPRÁSIO',
        'KUNZITA',
        'AMAZONITA',
        'GEMA',
      ],
    },
    {
      id: 'energeticos',
      label: 'Energéticos',
      color: '#D4783C',
      substanciasRaw: [
        'CARVÃO',
        'CARVÃO MINERAL',
        'ANTRACITO',
        'LINHITO',
        'TURFA',
        'FOLHELHO',
        'FOLHELHO ARGILOSO',
        'FOLHELHO BETUMINOSO',
        'FOLHELHO PIROBETUMINO',
        'ARENITO BETUMINOSO',
        'ROCHA BETUMINOSA',
        'ROCHA PIROBETUMINOSA',
      ],
    },
    {
      id: 'aguas_minerais',
      label: 'Águas Minerais',
      color: '#4A90B8',
      substanciasRaw: [
        'ÁGUA MINERAL',
        'ÁGUA MINERAL ALC. BIC',
        'ÁGUA MINERAL ALC. TER. CALCI.',
        'ÁGUA MINERAL CARBOGAS',
        'ÁGUA MINERAL RAD. FON',
        'ÁGUA POTÁVEL DE MESA',
        'ÁGUA TERMO MINERAL',
        'ÁGUAS OLIGOMINERAIS',
        'ÁGUAS TERMAIS',
      ],
    },
    {
      id: 'outros',
      label: 'Outros',
      color: '#6B6B65',
      substanciasRaw: ['DADO NÃO CADASTRADO'],
    },
  ]

function uniqNorm(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const k = normalizeSubstanciaKey(s)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

export const FAMILIA_MINERAL_DEFS: FamiliaMineralDef[] = RAW.map((row) => {
  const { substanciasRaw, ...rest } = row
  return {
    ...rest,
    substancias: uniqNorm(substanciasRaw),
  }
})

export function getFamiliaBySubstancia(substanciaKeyNorm: string): FamiliaMineralDef {
  for (const fam of FAMILIA_MINERAL_DEFS) {
    if (fam.substancias.includes(substanciaKeyNorm)) return fam
  }
  return FAMILIA_MINERAL_DEFS[FAMILIA_MINERAL_DEFS.length - 1]
}

export function corPorFamilia(substanciaRaw: string): string {
  const key = normalizeSubstanciaKey(substanciaRaw)
  return getFamiliaBySubstancia(key).color
}

```

## 7. Store do Mapa
**Arquivo:** `src/store/useMapStore.ts`
```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PROCESSOS_MOCK } from '../data/processos.mock'
import { cloneFiltrosState } from '../lib/intelMapDrill'
import {
  type CamadaGeoId,
  defaultCamadasGeo,
  mergeCamadasGeoPersisted,
} from '../lib/mapCamadasGeo'
import {
  UF_FILTRO_NENHUM,
  type FiltrosState,
  type Processo,
  type Regime,
} from '../types'

export type { CamadaGeoId } from '../lib/mapCamadasGeo'

export type PendingNavigation =
  | { type: 'processo'; payload: string; timestamp: number }
  | { type: 'estado'; payload: string; timestamp: number }
  | { type: 'regime'; payload: Regime; timestamp: number }
  | { type: 'titular'; payload: string; timestamp: number }
  | { type: 'substancia'; payload: string; timestamp: number }

const REGIMES: Regime[] = [
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

function defaultCamadas(): Record<Regime, boolean> {
  return REGIMES.reduce(
    (acc, r) => {
      acc[r] = true
      return acc
    },
    {} as Record<Regime, boolean>,
  )
}

function defaultFiltros(): FiltrosState {
  return {
    camadas: defaultCamadas(),
    substancias: [],
    periodo: [1960, 2026],
    uf: null,
    municipio: null,
    riskScoreMin: 0,
    riskScoreMax: 100,
    searchQuery: '',
  }
}

/** Garante todas as chaves de regime; só exclui camada se for explicitamente false no persist. */
function mergeCamadas(
  saved?: Partial<Record<Regime, boolean>>,
): Record<Regime, boolean> {
  const base = defaultCamadas()
  if (!saved || typeof saved !== 'object') return base
  const merged = { ...base }
  for (const r of REGIMES) {
    if (r in saved && typeof saved[r] === 'boolean') {
      merged[r] = saved[r]!
    }
  }
  const todasDesligadas = REGIMES.every((r) => merged[r] === false)
  return todasDesligadas ? base : merged
}

function mergePeriodo(raw: unknown): [number, number] {
  const d = defaultFiltros().periodo
  if (!Array.isArray(raw) || raw.length !== 2) return d
  let a = Number(raw[0])
  let b = Number(raw[1])
  if (!Number.isFinite(a)) a = d[0]
  if (!Number.isFinite(b)) b = d[1]
  if (a > b) [a, b] = [b, a]
  return [Math.max(1800, a), Math.min(2100, b)] as [number, number]
}

function mergeRiskRange(saved: Partial<FiltrosState> | undefined) {
  const d = defaultFiltros()
  let lo = Number(saved?.riskScoreMin)
  let hi = Number(saved?.riskScoreMax)
  if (!Number.isFinite(lo)) lo = d.riskScoreMin
  if (!Number.isFinite(hi)) hi = d.riskScoreMax
  lo = Math.max(0, Math.min(100, lo))
  hi = Math.max(0, Math.min(100, hi))
  if (lo > hi) [lo, hi] = [hi, lo]
  return { riskScoreMin: lo, riskScoreMax: hi }
}

function loadProcessos(): Processo[] {
  localStorage.removeItem('terrae-processos')
  return PROCESSOS_MOCK
}

const NUMERO_RX = /\d{3}\.\d{3}\/\d{4}/

export interface MapStore {
  processos: Processo[]
  filtros: FiltrosState
  processoSelecionado: Processo | null
  flyTo: { lat: number; lng: number; zoom: number } | null
  hoveredProcessoId: string | null
  /** Drawer "Relatório completo" visível (UI transitória, não persistida). */
  relatorioDrawerAberto: boolean

  pendingNavigation: PendingNavigation | null
  /** Filtro extra aplicado após drill por titular (não persistido). */
  intelTitularFilter: string | null
  /** Snapshot de `filtros` antes da primeira drill com banner; restaurado ao ✕ do banner. */
  intelDrillRestoreFiltros: FiltrosState | null
  /** Impressão digital dos filtros após aplicar drill; divergência → banner some. */
  intelDrillExpectedFiltrosJson: string | null

  /** Overlays geoespaciais (não filtram processos; só visualização no mapa). */
  camadasGeo: Record<CamadaGeoId, boolean>
  toggleCamadaGeo: (id: CamadaGeoId) => void

  setFiltro: <K extends keyof FiltrosState>(
    key: K,
    value: FiltrosState[K],
  ) => void
  toggleCamada: (regime: Regime) => void
  selecionarProcesso: (processo: Processo | null) => void
  setHoveredProcessoId: (id: string | null) => void
  getProcessosFiltrados: () => Processo[]
  requestFlyTo: (lat: number, lng: number, zoom?: number) => void
  clearFlyTo: () => void
  setRelatorioDrawerAberto: (aberto: boolean) => void
  /** Volta todos os filtros ao padrão (camadas, período, substâncias, UF, município, risk range, busca). */
  resetFiltros: () => void
  /**
   * Reset só da sidebar (filtros + filtro extra por titular), sem mexer em banner/snapshot.
   * Usado no fluxo `pendingNavigation` da Inteligência antes de aplicar o filtro específico.
   */
  applySidebarFiltrosPadrao: () => void

  setPendingNavigation: (nav: PendingNavigation | null) => void
  setIntelTitularFilter: (titular: string | null) => void
  /** Remove banner e filtro por titular; descarta snapshot (ex.: após mudança manual nos filtros). */
  dismissIntelDrillUi: () => void
  /** Restaura filtros do snapshot, limpa drill e banner (botão ✕). */
  restoreIntelDrillSnapshot: () => void
}

function applyFilters(
  processos: Processo[],
  f: FiltrosState,
  intelTitularFilter: string | null,
): Processo[] {
  const q = f.searchQuery.trim().toLowerCase()
  const numeroMatch = q.match(NUMERO_RX)?.[0]

  return processos.filter((p) => {
    if (intelTitularFilter && p.titular !== intelTitularFilter) return false

    if (f.camadas[p.regime] === false) return false

    const [y0, y1] = f.periodo
    if (p.ano_protocolo < y0 || p.ano_protocolo > y1) return false

    if (f.uf === UF_FILTRO_NENHUM) return false
    if (f.uf && p.uf !== f.uf) return false

    if (f.municipio) {
      const m = f.municipio.toLowerCase()
      if (!p.municipio.toLowerCase().includes(m)) return false
    }

    if (p.risk_score === null) {
      /* bloqueados: não filtrar por faixa numérica */
    } else if (
      p.risk_score < f.riskScoreMin ||
      p.risk_score > f.riskScoreMax
    ) {
      return false
    }

    if (f.substancias.length > 0) {
      const norm = (s: string) =>
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
      const sub = norm(p.substancia)
      if (!f.substancias.map(norm).includes(sub)) return false
    }

    if (q.length > 0) {
      if (numeroMatch && p.numero.includes(numeroMatch.replace(/\s/g, ''))) {
        /* ok */
      } else if (numeroMatch) {
        return false
      } else {
        const blob = `${p.numero} ${p.titular} ${p.municipio} ${p.uf} ${p.substancia}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
    }

    return true
  })
}

/** Só isto vai para o localStorage; evita F5 com busca/UF/etc. que zera o mapa. */
type FiltrosPersistidos = Pick<
  FiltrosState,
  'camadas' | 'periodo' | 'riskScoreMin' | 'riskScoreMax'
>

export const useMapStore = create<MapStore>()(
  persist(
    (set, get) => ({
      processos: loadProcessos(),
      filtros: defaultFiltros(),
      processoSelecionado: null,
      flyTo: null,
      hoveredProcessoId: null,
      relatorioDrawerAberto: false,

      pendingNavigation: null,
      intelTitularFilter: null,
      intelDrillRestoreFiltros: null,
      intelDrillExpectedFiltrosJson: null,

      camadasGeo: defaultCamadasGeo(),

      toggleCamadaGeo: (id) =>
        set((s) => ({
          camadasGeo: { ...s.camadasGeo, [id]: !s.camadasGeo[id] },
        })),

      setFiltro: (key, value) =>
        set((s) => ({
          filtros: { ...s.filtros, [key]: value },
        })),

      toggleCamada: (regime) =>
        set((s) => ({
          filtros: {
            ...s.filtros,
            camadas: {
              ...s.filtros.camadas,
              [regime]: !s.filtros.camadas[regime],
            },
          },
        })),

      selecionarProcesso: (processo) =>
        set({
          processoSelecionado: processo,
        }),

      setHoveredProcessoId: (id) => set({ hoveredProcessoId: id }),

      getProcessosFiltrados: () =>
        applyFilters(
          get().processos,
          get().filtros,
          get().intelTitularFilter,
        ),

      requestFlyTo: (lat, lng, zoom = 9) => set({ flyTo: { lat, lng, zoom } }),

      clearFlyTo: () => set({ flyTo: null }),

      setRelatorioDrawerAberto: (aberto) => set({ relatorioDrawerAberto: aberto }),

      resetFiltros: () =>
        set({
          filtros: defaultFiltros(),
          intelTitularFilter: null,
          intelDrillRestoreFiltros: null,
          intelDrillExpectedFiltrosJson: null,
        }),

      applySidebarFiltrosPadrao: () =>
        set({
          filtros: defaultFiltros(),
          intelTitularFilter: null,
        }),

      setPendingNavigation: (nav) => set({ pendingNavigation: nav }),

      setIntelTitularFilter: (titular) => set({ intelTitularFilter: titular }),

      dismissIntelDrillUi: () =>
        set({
          intelTitularFilter: null,
          intelDrillExpectedFiltrosJson: null,
          intelDrillRestoreFiltros: null,
        }),

      restoreIntelDrillSnapshot: () => {
        const snap = get().intelDrillRestoreFiltros
        if (snap) {
          set({
            filtros: cloneFiltrosState(snap),
            intelTitularFilter: null,
            intelDrillExpectedFiltrosJson: null,
            intelDrillRestoreFiltros: null,
          })
        } else {
          get().dismissIntelDrillUi()
        }
      },
    }),
    {
      name: 'terrae-filtros',
      partialize: (s): { filtros: FiltrosPersistidos; camadasGeo: Record<CamadaGeoId, boolean> } => ({
        filtros: {
          camadas: s.filtros.camadas,
          periodo: s.filtros.periodo,
          riskScoreMin: s.filtros.riskScoreMin,
          riskScoreMax: s.filtros.riskScoreMax,
        },
        camadasGeo: s.camadasGeo,
      }),
      merge: (persistedState, currentState) => {
        const box = persistedState as
          | {
              filtros?: Partial<FiltrosState> & Partial<FiltrosPersistidos>
              camadasGeo?: Partial<Record<CamadaGeoId, boolean>>
            }
          | undefined
        const s = box?.filtros
        const { riskScoreMin, riskScoreMax } = mergeRiskRange(s)
        const filtros: FiltrosState = {
          ...defaultFiltros(),
          camadas: mergeCamadas(s?.camadas),
          periodo: mergePeriodo(s?.periodo),
          riskScoreMin,
          riskScoreMax,
        }
        return {
          ...currentState,
          filtros,
          camadasGeo: mergeCamadasGeoPersisted(box?.camadasGeo),
          processos: loadProcessos(),
        }
      },
    },
  ),
)

export { REGIMES }

```

## 8. Tipos/Interfaces
**Arquivo:** `src/types/index.ts`
```tsx
export type Regime =
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'licenciamento'
  | 'lavra_garimpeira'
  | 'registro_extracao'
  | 'disponibilidade'
  | 'mineral_estrategico'
  | 'bloqueio_provisorio'
  | 'bloqueio_permanente'

export type Fase =
  | 'requerimento'
  | 'pesquisa'
  | 'concessao'
  | 'lavra'
  | 'encerrado'

export interface RiskBreakdown {
  geologico: number
  ambiental: number
  social: number
  regulatorio: number
}

export type NivelImpacto = 1 | 2 | 3 | 4

export interface AlertaLegislativo {
  id: string
  fonte: 'DOU' | 'Câmara' | 'Senado' | 'DOE' | 'IBAMA' | 'ANM'
  /** Diário de publicação de origem (ex.: DOU, DOE-PA, DOM-Parauapebas), exibido como “via …”. */
  fonte_diario: string
  data: string
  titulo: string
  resumo: string
  nivel_impacto: NivelImpacto
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro' | 'incerto'
  urgencia: 'imediata' | 'medio_prazo' | 'longo_prazo'
}

export interface DadosFiscais {
  capag: 'A' | 'B' | 'C' | 'D'
  receita_propria_mi: number
  divida_consolidada_mi: number
  incentivos_estaduais: string[]
  linhas_bndes: string[]
  observacao: string
}

export interface Processo {
  id: string
  numero: string
  regime: Regime
  fase: Fase
  substancia: string
  is_mineral_estrategico: boolean
  titular: string
  area_ha: number
  uf: string
  municipio: string
  lat: number
  lng: number
  data_protocolo: string
  ano_protocolo: number
  situacao: 'ativo' | 'inativo' | 'bloqueado'
  risk_score: number | null
  risk_breakdown: RiskBreakdown | null
  /** Valor estimado das reservas (milhões USD). */
  valor_estimado_usd_mi: number
  /** Data do último despacho ANM (YYYY-MM-DD). */
  ultimo_despacho_data: string
  alertas: AlertaLegislativo[]
  fiscal: DadosFiscais
  geojson: GeoJSONPolygon
}

export interface GeoJSONPolygon {
  type: 'Feature'
  properties: { id: string }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

/** Valor de `filtros.uf` que exclui todos os processos do mapa. */
export const UF_FILTRO_NENHUM = '__TERRAE_UF_NENHUM__' as const

export interface FiltrosState {
  camadas: Record<Regime, boolean>
  substancias: string[]
  periodo: [number, number]
  uf: string | null
  municipio: string | null
  riskScoreMin: number
  riskScoreMax: number
  searchQuery: string
}

```

## 9. Cores e Ordem no Sidebar (Overlay)
**Arquivo:** `src/components/map/MapFiltersOverlay.tsx`
```tsx
import { useEffect, useLayoutEffect, useState } from 'react'
import type { Regime } from '../../types'

export const MIN_Y = 1960
export const MAX_Y = 2026

export const REGIME_PILL_ORDER: Regime[] = [
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

export const REGIME_PILL_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  lavra_garimpeira: '#8B6F47',
  registro_extracao: '#6B8A9A',
  disponibilidade: '#5AB8B8',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const PAINEL_SLIDE_MS = 200

/**
 * Abertura: useLayoutEffect garante commit com o painel fora da tela antes do 1.º paint;
 * dois rAF marcam setAnimar(true) só depois desse frame (transição estável).
 * Fecho: useEffect deixa correr a animação de saída antes de desmontar.
 */
export function usePainelFiltrosAnimation(aberto: boolean) {
  const [montado, setMontado] = useState(false)
  const [animar, setAnimar] = useState(false)

  useLayoutEffect(() => {
    if (!aberto) return
    setMontado(true)
    setAnimar(false)
    let cancelled = false
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (!cancelled) setAnimar(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      if (innerRaf) cancelAnimationFrame(innerRaf)
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) return
    setAnimar(false)
    const t = window.setTimeout(() => setMontado(false), PAINEL_SLIDE_MS)
    return () => clearTimeout(t)
  }, [aberto])

  return { montado, animar }
}

```

