import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cloneFiltrosState } from '../lib/intelMapDrill'
import { mapDbRowToMapProcesso } from '../lib/mapProcessoFromDbRow'
import { processoEhInativoParaCamadaMapa } from '../lib/processoStatus'
import { buscarProcessoPorNumero } from '../lib/processoApi'
import {
  type CamadaGeoId,
  defaultCamadasGeo,
} from '../lib/mapCamadasGeo'
import { REGIME_LAYER_ORDER } from '../lib/regimes'
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

const REGIMES: Regime[] = REGIME_LAYER_ORDER

/** Alinhado a `DEMO_NUMEROS` em `MapView.tsx` — mantidos fora do lote substitutivo do viewport. */
const NUMEROS_PROCESSO_SEED_MAPA: readonly string[] = [
  '864.231/2017',
  '860.232/1990',
] as const

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
    exibirProcessosAtivos: true,
    exibirProcessosInativos: false,
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

function mergeExibirAtividade(saved: Partial<FiltrosState> | undefined) {
  const d = defaultFiltros()
  const a = saved?.exibirProcessosAtivos
  const i = saved?.exibirProcessosInativos
  let ativos = typeof a === 'boolean' ? a : d.exibirProcessosAtivos
  let inativos = typeof i === 'boolean' ? i : d.exibirProcessosInativos
  if (!ativos && !inativos) {
    ativos = true
    inativos = false
  }
  return {
    exibirProcessosAtivos: ativos,
    exibirProcessosInativos: inativos,
  }
}

function loadProcessos(): Processo[] {
  localStorage.removeItem('terrae-processos')
  return []
}

const NUMERO_RX = /\d{3}\.\d{3}\/\d{4}/

export interface MapStore {
  processos: Processo[]
  filtros: FiltrosState
  processoSelecionado: Processo | null
  /** Pedido de câmara; `processoId` permite fitBounds mesmo se outro efeito limpar a seleção. */
  flyTo: {
    lat: number
    lng: number
    zoom: number
    processoId?: string
  } | null
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
  /** Merge shallow no processo selecionado (ex.: enriquecer RS após fetch). Ignora se `patch.id` ≠ atual. */
  mergeProcessoSelecionado: (patch: Partial<Processo>) => void
  /** Adiciona processo vindo da API (evita duplicar por `numero`). */
  adicionarProcesso: (processo: Processo) => void
  mergeViewportProcessos: (lista: Processo[]) => void
  seedDemoProcessos: (numeros: string[]) => Promise<void>
  setHoveredProcessoId: (id: string | null) => void
  getProcessosFiltrados: () => Processo[]
  requestFlyTo: (
    lat: number,
    lng: number,
    zoom?: number,
    processoId?: string,
  ) => void
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

    const inativoReg = processoEhInativoParaCamadaMapa(p)
    if (inativoReg && !f.exibirProcessosInativos) return false
    if (!inativoReg && !f.exibirProcessosAtivos) return false

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
  | 'camadas'
  | 'periodo'
  | 'riskScoreMin'
  | 'riskScoreMax'
  | 'exibirProcessosAtivos'
  | 'exibirProcessosInativos'
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
        set((s) => {
          const filtros = { ...s.filtros, [key]: value }
          let processos = s.processos
          if (
            (key === 'exibirProcessosInativos' ||
              key === 'exibirProcessosAtivos') &&
            filtros.exibirProcessosAtivos &&
            !filtros.exibirProcessosInativos
          ) {
            processos = s.processos.filter((p) => !processoEhInativoParaCamadaMapa(p))
          }
          return { filtros, processos }
        }),

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

      mergeProcessoSelecionado: (patch) =>
        set((state) => {
          const atual = state.processoSelecionado
          if (!atual) return state
          if (patch.id != null && patch.id !== atual.id) return state
          return { processoSelecionado: { ...atual, ...patch } }
        }),

      adicionarProcesso: (processo) =>
        set((state) => {
          const existe = state.processos.some((p) => p.numero === processo.numero)
          if (existe) return state
          return { processos: [...state.processos, processo] }
        }),

      mergeViewportProcessos: (lista) =>
        set((state) => {
          if (!lista.length) return state
          const { exibirProcessosAtivos: ea, exibirProcessosInativos: ei } =
            state.filtros
          /** RPC já filtra `ativo_derivado`; não acumular tiles de um modo "todos" anterior. */
          const modoTodos = ea && ei
          const numsLista = new Set(lista.map((p) => p.numero))

          if (!modoTodos) {
            const seedsForaDoLote = state.processos.filter(
              (p) =>
                NUMEROS_PROCESSO_SEED_MAPA.includes(p.numero) &&
                !numsLista.has(p.numero),
            )
            const sel = state.processoSelecionado
            const selForaDoLote =
              sel &&
              !numsLista.has(sel.numero) &&
              !seedsForaDoLote.some((p) => p.numero === sel.numero)
                ? [sel]
                : []
            return {
              processos: [...seedsForaDoLote, ...selForaDoLote, ...lista],
            }
          }

          const incomingByNumero = new Map(lista.map((p) => [p.numero, p]))
          let changed = false
          const atualizados = state.processos.map((cur) => {
            const incoming = incomingByNumero.get(cur.numero)
            if (!incoming) return cur
            if (
              cur.ativo_derivado === incoming.ativo_derivado &&
              cur.fase === incoming.fase &&
              cur.risk_label_persistido === incoming.risk_label_persistido &&
              cur.os_label_persistido === incoming.os_label_persistido &&
              cur.risk_score === incoming.risk_score &&
              cur.situacao === incoming.situacao
            ) {
              return cur
            }
            changed = true
            return {
              ...cur,
              ativo_derivado: incoming.ativo_derivado,
              fase: incoming.fase,
              risk_label_persistido: incoming.risk_label_persistido,
              os_label_persistido: incoming.os_label_persistido,
              risk_score: incoming.risk_score,
              situacao: incoming.situacao,
            }
          })
          const existentes = new Set(state.processos.map((p) => p.numero))
          const novos = lista.filter((p) => !existentes.has(p.numero))
          if (novos.length) changed = true
          if (!changed) return state
          return { processos: [...atualizados, ...novos] }
        }),

      seedDemoProcessos: async (numeros) => {
        if (!numeros.length) return
        const resultados = await Promise.all(
          numeros.map(async (numero) => {
            try {
              const row = await buscarProcessoPorNumero(numero)
              if (!row) return null
              return mapDbRowToMapProcesso(row)
            } catch (e) {
              console.warn('[seedDemoProcessos] falha', numero, e)
              return null
            }
          }),
        )
        const validos: Processo[] = resultados.filter(
          (p): p is Processo => p !== null,
        )
        if (!validos.length) return
        set((state) => {
          const existentes = new Set(state.processos.map((p) => p.numero))
          const novos = validos.filter((p) => !existentes.has(p.numero))
          if (!novos.length) return state
          return { processos: [...state.processos, ...novos] }
        })
      },

      setHoveredProcessoId: (id) => set({ hoveredProcessoId: id }),

      getProcessosFiltrados: () =>
        applyFilters(
          get().processos,
          get().filtros,
          get().intelTitularFilter,
        ),

      requestFlyTo: (lat, lng, zoom = 9, processoId?: string) => {
        // Guard defensivo: processos sem geom entram no store via busca remota
        // com `lat = NaN, lng = NaN` (ver `mapDbRowToMapProcesso` com flag
        // `permitirSemGeom`). Callers devem gatiar antes, mas se algum caminho
        // esquecer, evitamos passar NaN pro Mapbox (que crasharia).
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          console.warn(
            '[useMapStore.requestFlyTo] ignorado: lat/lng não finitos',
            { lat, lng, processoId },
          )
          return
        }
        set({ flyTo: { lat, lng, zoom, processoId } })
      },

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
      partialize: (s): { filtros: FiltrosPersistidos } => ({
        filtros: {
          camadas: s.filtros.camadas,
          periodo: s.filtros.periodo,
          riskScoreMin: s.filtros.riskScoreMin,
          riskScoreMax: s.filtros.riskScoreMax,
          exibirProcessosAtivos: s.filtros.exibirProcessosAtivos,
          exibirProcessosInativos: s.filtros.exibirProcessosInativos,
        },
      }),
      merge: (persistedState, currentState) => {
        const box = persistedState as
          | {
              filtros?: Partial<FiltrosState> & Partial<FiltrosPersistidos>
            }
          | undefined
        const s = box?.filtros
        const { riskScoreMin, riskScoreMax } = mergeRiskRange(s)
        const { exibirProcessosAtivos, exibirProcessosInativos } =
          mergeExibirAtividade(s)
        const filtros: FiltrosState = {
          ...defaultFiltros(),
          camadas: mergeCamadas(s?.camadas),
          periodo: mergePeriodo(s?.periodo),
          riskScoreMin,
          riskScoreMax,
          exibirProcessosAtivos,
          exibirProcessosInativos,
        }
        return {
          ...currentState,
          filtros,
          camadasGeo: defaultCamadasGeo(),
          processos: loadProcessos(),
        }
      },
    },
  ),
)

export { REGIMES }
