import {
  Anchor,
  Check,
  ChevronDown,
  ChevronRight,
  Droplets,
  Home,
  Leaf,
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
import { REGIME_LABELS } from '../../lib/regimes'
import { RARE_KEYS, SUBSTANCIA_DEFS } from '../../lib/substancias'
import { useMapStore } from '../../store/useMapStore'
import { UF_FILTRO_NENHUM } from '../../types'
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

  const [ufMenuOpen, setUfMenuOpen] = useState(false)
  const [munMenuOpen, setMunMenuOpen] = useState(false)
  const ufWrapRef = useRef<HTMLDivElement>(null)
  const munWrapRef = useRef<HTMLDivElement>(null)
  const munTriggerRef = useRef<HTMLButtonElement>(null)
  const munListRef = useRef<HTMLDivElement>(null)
  const [munListGeom, setMunListGeom] = useState<{
    left: number
    top: number
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
      if (!ufWrapRef.current?.contains(e.target as Node)) setUfMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ufMenuOpen])

  const syncMunListPosition = useCallback(() => {
    const el = munTriggerRef.current ?? munWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const pad = 8
    const vh = window.innerHeight
    const maxPreferred = 200
    /** Sempre abaixo do campo (como UF); o portal pode cobrir o mapa. */
    const topDown = r.bottom + gap
    let maxHDown = Math.min(maxPreferred, Math.max(1, vh - topDown - pad))
    const spaceAbove = r.top - gap - pad
    const maxHUp = Math.min(maxPreferred, Math.max(1, spaceAbove))
    /** Só abre para cima se em baixo quase não há altura útil e em cima há claramente mais. */
    const minUsableDown = 56
    const openDown = maxHDown >= minUsableDown || maxHDown >= maxHUp
    const top = openDown ? topDown : r.top - gap - maxHUp
    const maxH = openDown ? maxHDown : maxHUp
    setMunListGeom({
      left: r.left,
      top,
      width: r.width,
      maxHeight: maxH,
    })
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
        padding: '20px 16px',
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
      <div
        className="flex shrink-0 flex-col items-end gap-2"
        style={{ marginBottom: 20 }}
      >
        <button
          type="button"
          onClick={onFechar}
          className="cursor-pointer border-0 bg-transparent p-0 text-[#888780] transition-colors hover:text-[#D3D1C7]"
          aria-label="Fechar filtros"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
        {filtrosAlteradosCount > 0 ? (
          <button
            type="button"
            onClick={() => resetFiltros()}
            className="cursor-pointer border-0 bg-transparent p-0 transition-opacity duration-150 hover:opacity-80"
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

      <div className="min-h-0 flex-1">
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
            {REGIME_PILL_ORDER.map((r) => {
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
            <p style={{ ...s3, marginTop: 8 }}>
              {visiveis} de 7 tipos visíveis
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
              {ufMenuOpen ? (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 overflow-y-auto border border-solid border-[#2C2C2A] bg-[#1A1A18] p-1"
                  style={{
                    marginTop: 4,
                    maxHeight: 200,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    zIndex: 100,
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
                </div>
              ) : null}
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
                        top: munListGeom.top,
                        width: munListGeom.width,
                        maxHeight: munListGeom.maxHeight,
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        zIndex: 200,
                        boxSizing: 'border-box',
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
    </aside>
  )
}
