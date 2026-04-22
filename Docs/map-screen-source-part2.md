# Exportação de código: tela de mapa (parte 2 de 2)

Voltar: [map-screen-source.md](./map-screen-source.md)

Este ficheiro contém: pills de filtros (MapFiltersOverlay), alternador de estilo do mapa, contagem de filtros, constantes de regimes, tooltip da legenda, e excerto de index.css relevante para Mapbox/popup/range.

## `src/components/map/MapFiltersOverlay.tsx`

```tsx
import {
  Atom,
  Calendar,
  Circle,
  CircleDot,
  Diamond,
  Gem,
  Hexagon,
  MapPin,
  Mountain,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { REGIME_LABELS } from '../../lib/regimes'
import { useMapStore } from '../../store/useMapStore'
import type { Regime } from '../../types'
import { UF_FILTRO_NENHUM } from '../../types'

const MIN_Y = 1960
const MAX_Y = 2026

const REGIME_PILL_ORDER: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

const REGIME_PILL_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

const RARE_KEYS = ['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPRÓSIO'] as const

type SubPillDef = {
  key: string
  label: string
  Icon: typeof Circle
  color: string
  rareGroup?: boolean
}

const SUBSTANCIA_PILLS: SubPillDef[] = [
  { key: 'FERRO', label: 'Ferro', Icon: CircleDot, color: '#7EADD4' },
  { key: 'COBRE', label: 'Cobre', Icon: Hexagon, color: '#C87C5B' },
  { key: 'OURO', label: 'Ouro', Icon: Gem, color: '#D4A843' },
  { key: 'NIOBIO', label: 'Nióbio', Icon: Atom, color: '#5CBFA0' },
  { key: 'RARE', label: 'Terras raras', Icon: Sparkles, color: '#3D8B7A', rareGroup: true },
  { key: 'LITIO', label: 'Lítio', Icon: Zap, color: '#9BB8D0' },
  { key: 'BAUXITA', label: 'Bauxita', Icon: Mountain, color: '#B8917A' },
  { key: 'QUARTZO', label: 'Quartzo', Icon: Diamond, color: '#C4B89A' },
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function usePainelFiltrosAnimation(aberto: boolean) {
  const [montado, setMontado] = useState(false)
  const [animar, setAnimar] = useState(false)

  useEffect(() => {
    if (aberto) {
      setMontado(true)
      setAnimar(false)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimar(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setAnimar(false)
    const t = window.setTimeout(() => setMontado(false), 200)
    return () => clearTimeout(t)
  }, [aberto])

  return { montado, animar }
}

function transitionStyle(
  animar: boolean,
  delayMs: number,
  enter: { opacity: number; transform: string },
  exit: { opacity: number; transform: string },
): CSSProperties {
  return {
    opacity: animar ? enter.opacity : exit.opacity,
    transform: animar ? enter.transform : exit.transform,
    transition: `opacity ${animar ? 300 : 200}ms ${animar ? 'ease-out' : 'ease-in'}, transform ${animar ? 300 : 200}ms ${animar ? 'ease-out' : 'ease-in'}`,
    transitionDelay: `${delayMs}ms`,
    willChange: 'transform, opacity',
  }
}

function pillMotion(
  animar: boolean,
  delayMs: number,
  enterT: string,
  exitT: string,
  filtroAtivo: boolean,
  opacidadeInativo: number,
): CSSProperties {
  return {
    opacity: animar ? (filtroAtivo ? 1 : opacidadeInativo) : 0,
    transform: animar ? enterT : exitT,
    transition: `opacity ${animar ? 300 : 200}ms ${animar ? 'ease-out' : 'ease-in'}, transform ${animar ? 300 : 200}ms ${animar ? 'ease-out' : 'ease-in'}`,
    transitionDelay: `${delayMs}ms`,
    willChange: 'transform, opacity',
  }
}

export function MapFiltersPeriodoPill({
  animar,
  painelAberto,
}: {
  animar: boolean
  painelAberto: boolean
}) {
  const periodo = useMapStore((s) => s.filtros.periodo)
  const setFiltro = useMapStore((s) => s.setFiltro)
  const [lo, hi] = periodo
  const [expandido, setExpandido] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const setLo = (v: number) => {
    const next = Math.min(v, hi - 1)
    setFiltro('periodo', [Math.max(MIN_Y, next), hi])
  }
  const setHi = (v: number) => {
    const next = Math.max(v, lo + 1)
    setFiltro('periodo', [lo, Math.min(MAX_Y, next)])
  }

  useEffect(() => {
    if (!painelAberto) setExpandido(false)
  }, [painelAberto])

  useEffect(() => {
    if (!expandido) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      setExpandido(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [expandido])

  const span = MAX_Y - MIN_Y
  const loPct = ((lo - MIN_Y) / span) * 100
  const hiPct = ((hi - MIN_Y) / span) * 100
  const fillW = Math.max(0, hiPct - loPct)

  const style = transitionStyle(
    animar,
    0,
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-10px)' },
  )

  return (
    <div
      ref={wrapRef}
      className="flex flex-col items-center"
      style={style}
    >
      <div
        className="box-border flex items-center overflow-hidden rounded-[20px] border border-solid border-[#2C2C2A] transition-[width] duration-[250ms] ease-out"
        style={{
          backgroundColor: 'rgba(26, 26, 24, 0.75)',
          width: expandido ? 380 : undefined,
          minWidth: expandido ? 380 : undefined,
        }}
      >
        {!expandido ? (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="flex h-9 cursor-pointer items-center gap-2 border-0 bg-transparent px-4 py-2"
          >
            <Calendar
              size={16}
              className="shrink-0 text-[#888780]"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-[13px] text-[#D3D1C7]">
              {lo} - {hi}
            </span>
          </button>
        ) : (
          <div className="flex w-[380px] shrink-0 items-center gap-2 py-2 pl-5 pr-5">
            <button
              type="button"
              className="shrink-0 border-0 bg-transparent p-0 text-[#888780] hover:text-[#D3D1C7]"
              onClick={() => setExpandido(false)}
              aria-label="Fechar período"
            >
              <Calendar size={16} strokeWidth={2} className="text-[#888780]" aria-hidden />
            </button>
            <span className="shrink-0 tabular-nums text-[13px] text-[#F1EFE8]">{lo}</span>
            <div className="relative min-h-[28px] min-w-0 flex-1">
              <div
                className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-sm"
                style={{ height: 4, background: '#2C2C2A' }}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-sm"
                style={{
                  left: `${loPct}%`,
                  width: `${fillW}%`,
                  height: 4,
                  background: '#EF9F27',
                }}
                aria-hidden
              />
              <input
                type="range"
                data-terrae-period-range
                className="terrae-map-period-lo absolute left-0 top-1/2 z-[2] w-full -translate-y-1/2"
                style={{ height: 28, margin: 0, padding: 0, background: 'transparent', appearance: 'none' as const }}
                min={MIN_Y}
                max={MAX_Y}
                value={lo}
                onChange={(e) => setLo(Number(e.target.value))}
                aria-label="Ano inicial do período"
              />
              <input
                type="range"
                data-terrae-period-range
                className="terrae-map-period-hi absolute left-0 top-1/2 z-[3] w-full -translate-y-1/2"
                style={{ height: 28, margin: 0, padding: 0, background: 'transparent', appearance: 'none' as const }}
                min={MIN_Y}
                max={MAX_Y}
                value={hi}
                onChange={(e) => setHi(Number(e.target.value))}
                aria-label="Ano final do período"
              />
            </div>
            <span className="shrink-0 tabular-nums text-[13px] text-[#F1EFE8]">{hi}</span>
          </div>
        )}
      </div>
      <style>{`
        .terrae-map-period-lo::-webkit-slider-thumb,
        .terrae-map-period-hi::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #EF9F27;
          border: 2px solid #0D0D0C;
          cursor: pointer;
        }
        .terrae-map-period-lo::-moz-range-thumb,
        .terrae-map-period-hi::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #EF9F27;
          border: 2px solid #0D0D0C;
          cursor: pointer;
        }
        .terrae-map-period-lo::-webkit-slider-runnable-track,
        .terrae-map-period-hi::-webkit-slider-runnable-track { height: 4px; background: transparent; }
        .terrae-map-period-lo::-moz-range-track,
        .terrae-map-period-hi::-moz-range-track { height: 4px; background: transparent; }
      `}</style>
    </div>
  )
}

function RegimePills({ animar }: { animar: boolean }) {
  const camadas = useMapStore((s) => s.filtros.camadas)
  const toggleCamada = useMapStore((s) => s.toggleCamada)

  return (
    <div className="pointer-events-auto absolute bottom-[100px] left-4 right-4 z-[8] flex flex-wrap justify-center gap-2">
      {REGIME_PILL_ORDER.map((r, i) => {
        const on = camadas[r] !== false
        const color = REGIME_PILL_COLORS[r]
        const delay = 80 + i * 50
        const st = pillMotion(
          animar,
          delay,
          'translateY(0)',
          'translateY(30px)',
          on,
          0.6,
        )
        return (
          <button
            key={r}
            type="button"
            onClick={() => toggleCamada(r)}
            className="box-border flex h-9 cursor-pointer items-center gap-2 rounded-[20px] border border-solid px-4 py-2 transition-colors duration-200"
            style={{
              ...st,
              backgroundColor: on
                ? hexToRgba(color, 0.1)
                : 'rgba(44, 44, 42, 0.7)',
              borderColor: on ? hexToRgba(color, 0.3) : '#3a3a38',
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: on ? color : '#5F5E5A' }}
              aria-hidden
            />
            <span className={`text-[13px] ${on ? 'text-[#F1EFE8]' : 'text-[#5F5E5A]'}`}>
              {REGIME_LABELS[r]}
            </span>
          </button>
        )
      })}
    </div>
  )
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

function SubstanciaPills({ animar }: { animar: boolean }) {
  const substancias = useMapStore((s) => s.filtros.substancias)
  const setFiltro = useMapStore((s) => s.setFiltro)

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

  const ufDelayBase = 150 + (SUBSTANCIA_PILLS.length - 1) * 50 + 50

  return (
    <>
      <div className="pointer-events-auto absolute left-4 top-1/2 z-[8] flex w-max -translate-y-1/2 flex-col items-stretch">
        <div className="flex flex-col gap-2">
          {SUBSTANCIA_PILLS.map((sp, i) => {
            const on = substanciaAtiva(sp.key, sp.rareGroup, substancias)
            const delay = 150 + i * 50
            const st = pillMotion(
              animar,
              delay,
              'translateX(0)',
              'translateX(-30px)',
              on,
              0.6,
            )
            const Icon = sp.Icon
            return (
              <button
                key={sp.key}
                type="button"
                onClick={() => toggleKey(sp.key, sp.rareGroup)}
                className="box-border flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[20px] border border-solid px-[14px] py-2 transition-colors duration-200"
                style={{
                  ...st,
                  backgroundColor: on
                    ? hexToRgba(sp.color, 0.1)
                    : 'rgba(44, 44, 42, 0.7)',
                  borderColor: on ? hexToRgba(sp.color, 0.3) : '#3a3a38',
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={2}
                  className="shrink-0"
                  style={{ color: on ? sp.color : '#5F5E5A' }}
                  aria-hidden
                />
                <span className={`text-[13px] ${on ? 'text-[#F1EFE8]' : 'text-[#5F5E5A]'}`}>
                  {sp.label}
                </span>
              </button>
            )
          })}
        </div>
        <div
          className="w-full shrink-0 self-stretch"
          style={{
            marginTop: 12,
            marginBottom: 12,
            borderTop: '1px solid rgba(44, 44, 42, 0.5)',
          }}
          aria-hidden
        />
        <UfPill animar={animar} delayMs={ufDelayBase} />
      </div>
    </>
  )
}

function UfPill({ animar, delayMs }: { animar: boolean; delayMs: number }) {
  const processos = useMapStore((s) => s.processos)
  const uf = useMapStore((s) => s.filtros.uf)
  const municipio = useMapStore((s) => s.filtros.municipio)
  const setFiltro = useMapStore((s) => s.setFiltro)
  const [aberto, setAberto] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<{
    top: number
    left: number
    minWidth: number
  } | null>(null)

  const ufs = useMemo(() => {
    const s = new Set<string>()
    for (const p of processos) s.add(p.uf)
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos])

  useLayoutEffect(() => {
    if (!aberto || !btnRef.current) {
      setRect(null)
      return
    }
    const r = btnRef.current.getBoundingClientRect()
    setRect({
      top: r.bottom + 4,
      left: r.left,
      minWidth: Math.max(r.width, 120),
    })
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      const pop = document.getElementById('terrae-uf-popover')
      if (pop?.contains(t)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto])

  useEffect(() => {
    if ((uf === null || uf === UF_FILTRO_NENHUM) && municipio !== null) {
      setFiltro('municipio', null)
    }
  }, [uf, municipio, setFiltro])

  const st = pillMotion(animar, delayMs, 'translateX(0)', 'translateX(-30px)', true, 1)

  const labelUf =
    uf === null ? 'Todos' : uf === UF_FILTRO_NENHUM ? 'Nenhuma' : uf

  const popover =
    aberto && rect ? (
      <div
        id="terrae-uf-popover"
        role="listbox"
        className="box-border max-h-[240px] overflow-y-auto border border-solid border-[#2C2C2A] bg-[#1A1A18] p-2"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          minWidth: rect.minWidth,
          borderRadius: 8,
          zIndex: 2147483000,
        }}
      >
        <button
          type="button"
          role="option"
          className="flex w-full cursor-pointer border-0 bg-transparent px-2 py-2 text-left text-[13px] text-[#D3D1C7] hover:bg-[#2C2C2A]"
          onClick={() => {
            setFiltro('uf', null)
            setFiltro('municipio', null)
            setAberto(false)
          }}
        >
          Todos
        </button>
        {ufs.map((sigla) => (
          <button
            key={sigla}
            type="button"
            role="option"
            className="flex w-full cursor-pointer border-0 bg-transparent px-2 py-2 text-left text-[13px] text-[#D3D1C7] hover:bg-[#2C2C2A]"
            onClick={() => {
              setFiltro('uf', sigla)
              setFiltro('municipio', null)
              setAberto(false)
            }}
          >
            {sigla}
          </button>
        ))}
      </div>
    ) : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="box-border flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[20px] border border-solid border-[#2C2C2A] px-[14px] py-2"
        style={{
          ...st,
          backgroundColor: 'rgba(26, 26, 24, 0.75)',
        }}
      >
        <MapPin size={16} className="shrink-0 text-[#888780]" aria-hidden />
        <span
          className={`text-[13px] ${uf && uf !== UF_FILTRO_NENHUM ? 'text-[#EF9F27]' : 'text-[#D3D1C7]'}`}
        >
          UF: {labelUf}
        </span>
      </button>
      {popover ? createPortal(popover, document.body) : null}
    </>
  )
}

export function MapFiltersFloating({ animar }: { animar: boolean }) {
  return (
    <>
      <RegimePills animar={animar} />
      <SubstanciaPills animar={animar} />
    </>
  )
}

```

## `src/components/map/MapStyleSwitcher.tsx`

```tsx
/** Identificadores Mapbox; também usados no estado do MapView. */
export const MAPBOX_STYLE_SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12'
export const MAPBOX_STYLE_DARK = 'mapbox://styles/mapbox/dark-v11'
export const MAPBOX_STYLE_STREETS = 'mapbox://styles/mapbox/streets-v12'

const ESTILOS = [MAPBOX_STYLE_SATELLITE, MAPBOX_STYLE_DARK, MAPBOX_STYLE_STREETS] as const

function IconSatellite({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4Zm-9 9h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    </svg>
  )
}

/** Lua em crescente; leitura clara em fundos escuros. */
function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.25" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 1.75v4M12 18.25v4M1.75 12h4M18.25 12h4M5.4 5.4l2.83 2.83M15.77 15.77l2.83 2.83M5.4 18.6l2.83-2.83M15.77 8.23l2.83-2.83"
      />
    </svg>
  )
}

const ICONS = [IconSatellite, IconMoon, IconSun] as const

type MapStyleSwitcherProps = {
  estiloAtivo: string
  onTrocar: (identificadorEstilo: string) => void
}

export function MapStyleSwitcher({ estiloAtivo, onTrocar }: MapStyleSwitcherProps) {
  return (
    <div
      className="pointer-events-auto grid w-full min-w-0 grid-cols-3"
      style={{ gap: 6 }}
      role="toolbar"
      aria-label="Estilo do mapa"
    >
      {ESTILOS.map((id, i) => {
        const Icon = ICONS[i]
        const ativo = estiloAtivo === id

        return (
          <div key={id} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (!ativo) onTrocar(id)
              }}
              className="flex h-7 w-full min-w-0 shrink-0 cursor-pointer items-center justify-center border-0 transition-colors"
              style={{
                borderRadius: 6,
                ...(ativo
                  ? {
                      backgroundColor: '#EF9F27',
                      color: '#0D0D0C',
                    }
                  : {
                      backgroundColor: '#2C2C2A',
                      color: '#888780',
                    }),
              }}
              onMouseEnter={(e) => {
                if (ativo) return
                e.currentTarget.style.backgroundColor = '#333331'
              }}
              onMouseLeave={(e) => {
                if (ativo) return
                e.currentTarget.style.backgroundColor = '#2C2C2A'
              }}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

```

## `src/lib/mapFiltrosCount.ts`

```ts
import type { FiltrosState, Regime } from '../types'

const REGIMES_TODOS: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
]

/** Número de filtros diferentes do padrão (badge na barra de busca). */
export function countFiltrosAlterados(f: FiltrosState): number {
  let n = 0
  for (const r of REGIMES_TODOS) {
    if (f.camadas[r] === false) n++
  }
  if (f.periodo[0] !== 1960 || f.periodo[1] !== 2026) n++
  if (f.uf !== null) n++
  if (f.municipio && f.municipio.trim()) n++
  if (f.substancias.length > 0) n++
  return n
}

```

## `src/lib/regimes.ts`

```ts
import type { Regime } from '../types'

export const REGIME_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  mineral_estrategico: '#2D8B70',
  bloqueio_permanente: '#A85C5C',
  bloqueio_provisorio: '#C4915A',
}

export const REGIME_LABELS: Record<Regime, string> = {
  concessao_lavra: 'Concessão de Lavra',
  autorizacao_pesquisa: 'Autorização de Pesquisa',
  req_lavra: 'Req. de Lavra',
  licenciamento: 'Licenciamento',
  mineral_estrategico: 'Mineral Estratégico',
  bloqueio_permanente: 'Bloqueio Permanente',
  bloqueio_provisorio: 'Bloqueio Provisório',
}

/** Ordem de pintura: primeiro = fundo */
export const REGIME_LAYER_ORDER: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

/** Textos explicativos dos badges de regime (popup, relatório, dashboard, legenda). */
export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
  concessao_lavra:
    'Autorização definitiva para exploração mineral, concedida pela ANM após aprovação do plano de aproveitamento econômico. Publicada no DOU. Representa o estágio mais avançado do processo minerário.',
  autorizacao_pesquisa:
    'Permissão para realizar pesquisa mineral na área, concedida pela ANM. Publicada no DOU. O titular tem prazo para apresentar relatório de pesquisa com os resultados. Etapa anterior à requisição de lavra.',
  req_lavra:
    'Pedido de concessão de lavra em análise pela ANM, após aprovação do relatório de pesquisa. Publicada no DOU. Etapa intermediária entre a pesquisa e a concessão definitiva.',
  licenciamento:
    'Regime simplificado para minerais de uso imediato na construção civil (areia, cascalho, argila, brita). A autorização é concedida pela prefeitura municipal, não pela ANM. O titular apenas registra na ANM. Publicada no diário oficial do município.',
  mineral_estrategico:
    'Área com ocorrência de minerais classificados como estratégicos pelo governo federal (nióbio, terras raras, lítio, entre outros). Sujeita a regras especiais de exploração e eventual prioridade governamental.',
  bloqueio_provisorio:
    'Área temporariamente impedida de avançar no processo de titularidade. Pode ser por pendência administrativa, sobreposição com terra indígena ou unidade de conservação, ou disputa judicial. A situação pode ser revertida, representando potencial oportunidade futura para outros investidores.',
  bloqueio_permanente:
    'A ANM indeferiu definitivamente o requerimento para esta área. O bloqueio pode ter sido por irregularidade específica do titular anterior (pendência judicial, questão ambiental) e não necessariamente da área em si. A área pode ficar disponível para novo requerimento por outra empresa.',
}

```

## `src/components/filters/CamadaTooltipHover.tsx`

```tsx
import { createPortal } from 'react-dom'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { TERRAE_MAP_CLEAR_FLOATING_UI } from '../../lib/mapFloatingUiEvents'

const TIP_DELAY_MS = 300
const TIP_Z = 10060

type Place = 'right' | 'left' | 'above' | 'below'

function isUsableTriggerRect(r: DOMRectReadOnly): boolean {
  return (
    r.width >= 2 &&
    r.height >= 2 &&
    Number.isFinite(r.left) &&
    Number.isFinite(r.top) &&
    r.right > r.left + 0.5 &&
    r.bottom > r.top + 0.5
  )
}

/**
 * Tooltip de camada (sidebar): atraso 300 ms, estilo alinhado ao padrão dos riscos no popup.
 */
export function CamadaTooltipHover({
  texto,
  children,
  className = '',
  maxWidthPx = 240,
  bubbleBoxShadow,
  bubbleBackgroundColor = '#2C2C2A',
  bubbleBorder = '1px solid #3a3a38',
  bubblePadding = '6px 10px',
  /** Só acima do alvo (ex.: gatilho centrado no drawer lateral — evita lateral no mapa). */
  preferAbove = false,
  /** Abaixo do alvo, centrado (ex.: letra CAPAG). Ignora `preferAbove`. */
  preferBelow = false,
  /** `span` inline dentro de parágrafos (evita quebra de linha antes do gatilho). */
  inlineWrap = false,
}: {
  texto: string
  children: ReactNode
  className?: string
  /** Largura máxima do bubble (ex.: 300 no relatório do mapa). */
  maxWidthPx?: number
  /** Sombra do bubble (ex.: alertas legislativos). */
  bubbleBoxShadow?: string
  bubbleBackgroundColor?: string
  bubbleBorder?: string
  bubblePadding?: string
  preferAbove?: boolean
  preferBelow?: boolean
  inlineWrap?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement | HTMLSpanElement | null>(null)
  const blockShowUntilLeaveRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{
    left: number
    top: number
    place: Place
  } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openNow = () => {
    const el = wrapRef.current
    if (!el) return

    const applyRect = (r: DOMRectReadOnly) => {
      const gap = 8
      const vw = window.innerWidth
      const needW = Math.min(maxWidthPx, vw - 32)

      let place: Place
      let left: number
      let top: number

      if (preferBelow) {
        place = 'below'
        const half = needW / 2 + 12
        const center = r.left + r.width / 2
        left = Math.max(8 + half, Math.min(center, vw - 8 - half))
        top = r.bottom + gap
      } else if (preferAbove) {
        place = 'above'
        const half = needW / 2 + 12
        const center = r.left + r.width / 2
        left = Math.max(8 + half, Math.min(center, vw - 8 - half))
        top = Math.max(4, r.top - gap)
      } else {
        const spaceRight = vw - r.right - gap
        const spaceLeft = r.left - gap

        if (spaceRight >= needW + 8) {
          place = 'right'
          left = r.right + gap
          top = r.top + r.height / 2
        } else if (spaceLeft >= needW + 8) {
          place = 'left'
          left = r.left - gap
          top = r.top + r.height / 2
        } else {
          place = 'above'
          const half = needW / 2 + 12
          const center = r.left + r.width / 2
          left = Math.max(8 + half, Math.min(center, vw - 8 - half))
          top = Math.max(4, r.top - gap)
        }
      }

      setPos({ place, left, top })
      setOpen(true)
    }

    const tryLayout = (attempt: number) => {
      const r = el.getBoundingClientRect()
      if (!isUsableTriggerRect(r)) {
        if (attempt < 3) {
          requestAnimationFrame(() => tryLayout(attempt + 1))
        }
        return
      }
      applyRect(r)
    }

    tryLayout(0)
  }

  const onEnter = () => {
    if (blockShowUntilLeaveRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (!blockShowUntilLeaveRef.current) openNow()
    }, TIP_DELAY_MS)
  }

  const onLeave = () => {
    blockShowUntilLeaveRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setOpen(false)
    setPos(null)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    const onClear = () => {
      blockShowUntilLeaveRef.current = true
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setOpen(false)
      setPos(null)
    }
    window.addEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, onClear)
    return () => window.removeEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, onClear)
  }, [])

  const minBubbleW = Math.min(220, maxWidthPx)

  const transform =
    pos?.place === 'right'
      ? 'translateY(-50%)'
      : pos?.place === 'left'
        ? 'translate(-100%, -50%)'
        : pos?.place === 'below'
          ? 'translate(-50%, 0)'
          : 'translate(-50%, calc(-100% - 4px))'

  const bubble =
    open && pos
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none"
            style={{
              position: 'fixed',
              zIndex: TIP_Z,
              left: pos.left,
              top: pos.top,
              transform,
              maxWidth: maxWidthPx,
              minWidth: minBubbleW,
              padding: bubblePadding,
              fontSize: 13,
              lineHeight: 1.35,
              color: '#D3D1C7',
              backgroundColor: bubbleBackgroundColor,
              border: bubbleBorder,
              borderRadius: 6,
              boxSizing: 'border-box',
              transition: 'opacity 150ms ease',
              ...(bubbleBoxShadow != null && bubbleBoxShadow !== ''
                ? { boxShadow: bubbleBoxShadow }
                : {}),
            }}
          >
            {texto}
          </div>,
          document.body,
        )
      : null

  if (inlineWrap) {
    return (
      <span
        ref={wrapRef as RefObject<HTMLSpanElement>}
        className={className}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
        {bubble}
      </span>
    )
  }

  return (
    <div
      ref={wrapRef as RefObject<HTMLDivElement>}
      className={className}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {bubble}
    </div>
  )
}

```

## `src/index.css` (linhas 1–162: :root, Mapbox, popup de processo, input range global)

```css
@import 'tailwindcss';
@config '../tailwind.config.ts';

:root {
  --terrae-50: #faeeda;
  --terrae-100: #fac775;
  --terrae-200: #ef9f27;
  --terrae-400: #ba7517;
  --terrae-600: #854f0b;
  --terrae-800: #633806;
  --terrae-900: #412402;

  --bg-primary: #0d0d0c;
  --bg-secondary: #111110;
  --bg-tertiary: #1a1a18;
  --bg-border: #2c2c2a;

  --text-primary: #f1efe8;
  --text-secondary: #888780;
  --text-tertiary: #5f5e5a;

  /* Títulos de secção (sidebar, mapa, popup); alinhado a “Camadas disponíveis” */
  --text-section-title: #b4b2a9;

  /* Chrome do mapa: saída rápida (Mapa → Inteligência), entrada mais suave (volta). */
  --terrae-chrome-exit-ms: 180ms;
  --terrae-chrome-enter-ms: 280ms;
  --terrae-chrome-transition-ms: var(--terrae-chrome-enter-ms);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --terrae-chrome-exit-ms: 1ms;
    --terrae-chrome-enter-ms: 1ms;
  }
}

html,
body,
#root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

/* Mapbox GL: preencher o painel (evita mapa preto com flex / ordem de layout) */
.mapboxgl-map {
  width: 100%;
  height: 100%;
}

.mapboxgl-canvas-container {
  width: 100%;
  height: 100%;
  /* Garantir ordem de pintura: canvas abaixo dos popups (alguns GPUs/compósitos punham o WebGL por cima). */
  position: relative;
  z-index: 0;
}

.mapboxgl-ctrl-logo {
  opacity: 0.35;
}

.mapboxgl-ctrl-attrib {
  font-size: 10px !important;
  color: var(--text-tertiary) !important;
  background: rgba(13, 13, 12, 0.85) !important;
}

.mapboxgl-ctrl-attrib a {
  color: var(--text-secondary) !important;
}

/* Popup de processo: alinhar ao painel Terrae (conteúdo é o card React) */
.terrae-processo-popup.mapboxgl-popup {
  background: transparent;
  box-shadow: none !important;
  /* Acima do canvas (0) e dos controlos Mapbox (2). */
  z-index: 10 !important;
  pointer-events: none;
}

/* Evita flash: âncora só depois de medir o layout do React */
.terrae-processo-popup--layout-pending.mapboxgl-popup {
  opacity: 0;
  pointer-events: none;
}

.terrae-processo-popup .mapboxgl-popup-content {
  padding: 0 !important;
  background: transparent !important;
  border-radius: 10px;
  box-shadow: none !important;
  pointer-events: auto;
}

/* Mapbox: âncora bottom → seta usa border-top; âncora top (card abaixo) → border-bottom */
.terrae-processo-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip,
.terrae-processo-popup.mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip,
.terrae-processo-popup.mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip {
  border-top-color: #1a1a18 !important;
}

.terrae-processo-popup.mapboxgl-popup-anchor-top .mapboxgl-popup-tip,
.terrae-processo-popup.mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip,
.terrae-processo-popup.mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip {
  border-bottom-color: #1a1a18 !important;
}

input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  outline: none;
  cursor: pointer;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--terrae-200);
  cursor: pointer;
  border: 2px solid var(--terrae-400);
}

input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--terrae-200);
  cursor: pointer;
  border: 2px solid var(--terrae-400);
}

input[type='range']::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--terrae-600),
    var(--terrae-200)
  );
}

input[type='range']::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
}
```
