# Exportação de código: contador de filtros e badge (barra de busca)

Documento gerado para revisão de bug/visual. Nenhum código foi alterado.

---

## Tipos e constantes relacionados (`src/types/index.ts`)

Trechos de `src/types/index.ts` usados por filtros / contagem.

`Regime`:

```ts
export type Regime =
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'licenciamento'
  | 'mineral_estrategico'
  | 'bloqueio_permanente'
  | 'bloqueio_provisorio'
```

`UF_FILTRO_NENHUM` e `FiltrosState`:

```ts
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

---

## 1. Lógica de contagem — ficheiro completo

**Caminho:** `src/lib/mapFiltrosCount.ts`

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

**Nota:** `riskScoreMin` / `riskScoreMax` e `searchQuery` não entram nesta contagem.

---

## 2. Barra de busca — ficheiro completo

**Caminho:** `src/components/map/MapSearchBar.tsx`

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
      className="group pointer-events-auto relative box-border flex h-12 w-[min(680px,50vw)] min-w-[min(600px,100%)] max-w-[100%] shrink-0 items-center rounded-[24px] border border-solid px-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
      style={{
        backgroundColor: 'rgba(26, 26, 24, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: inputFocado ? '#EF9F27' : '#2C2C2A',
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
        <span className="relative inline-flex">
          <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
          {filtrosAlteradosCount > 0 ? (
            <span
              className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF9F27] px-0.5 text-[11px] font-bold leading-none text-[#0D0D0C] ${badgePulse ? 'terrae-badge-pulse' : ''}`}
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

A animação `terrae-badge-pulse` está definida em `src/index.css` (classe `.terrae-badge-pulse`).

---

## 3. Store — secção de filtros (`src/store/useMapStore.ts`)

Ficheiro completo reproduzido abaixo (inclui `applyFilters`, persistência e merge; a parte de filtros está no início e nas actions `setFiltro` / `toggleCamada`).

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PROCESSOS_MOCK } from '../data/processos.mock'
import {
  UF_FILTRO_NENHUM,
  type FiltrosState,
  type Processo,
  type Regime,
} from '../types'

const REGIMES: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
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
}

function applyFilters(processos: Processo[], f: FiltrosState): Processo[] {
  const q = f.searchQuery.trim().toLowerCase()
  const numeroMatch = q.match(NUMERO_RX)?.[0]

  return processos.filter((p) => {
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
        applyFilters(get().processos, get().filtros),

      requestFlyTo: (lat, lng, zoom = 9) => set({ flyTo: { lat, lng, zoom } }),

      clearFlyTo: () => set({ flyTo: null }),

      setRelatorioDrawerAberto: (aberto) => set({ relatorioDrawerAberto: aberto }),
    }),
    {
      name: 'terrae-filtros',
      partialize: (s): { filtros: FiltrosPersistidos } => ({
        filtros: {
          camadas: s.filtros.camadas,
          periodo: s.filtros.periodo,
          riskScoreMin: s.filtros.riskScoreMin,
          riskScoreMax: s.filtros.riskScoreMax,
        },
      }),
      merge: (persistedState, currentState) => {
        const box = persistedState as
          | { filtros?: Partial<FiltrosState> & Partial<FiltrosPersistidos> }
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
          processos: loadProcessos(),
        }
      },
    },
  ),
)

export { REGIMES }
```

---

## Ligação no `MapView` (referência)

**Caminho:** `src/components/map/MapView.tsx`

O contador é calculado com `useMemo` e passado à barra de busca:

```ts
import { countFiltrosAlterados } from '../../lib/mapFiltrosCount'

// dentro do componente:
const filtrosAlteradosCount = useMemo(
  () => countFiltrosAlterados(filtros),
  [filtros],
)

// na renderização de MapSearchBar:
<MapSearchBar
  ...
  filtrosAlteradosCount={filtrosAlteradosCount}
  ...
/>
```

---

*Documento apenas para revisão; estado do repositório na data de geração.*
