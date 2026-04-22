# Exportação de código: tela de mapa (parte 1 de 2)

Este documento contém o código-fonte atual dos componentes principais da tela de mapa, para revisão visual direta.

**Parte 2:** ver [`map-screen-source-part2.md`](./map-screen-source-part2.md) (`MapFiltersOverlay`, `MapStyleSwitcher`, libs, `CamadaTooltipHover`, excerto de `index.css`).

---

## Notas

- **Pills de regime, substância, UF e período** estão no mesmo ficheiro `MapFiltersOverlay.tsx` (funções internas `RegimePills`, `SubstanciaPills`, `UfPill`, export `MapFiltersPeriodoPill`, `MapFiltersFloating`).
- **Legenda de regimes** (canto inferior direito) e **legenda Risk Score** estão **inline** no `MapView.tsx` (blocos `div` com `REGIME_LAYER_ORDER` / `LEGENDA_RISCO_ITEMS`), não são componentes separados.
- **Botões de tema** estão em `MapStyleSwitcher.tsx`, importado pelo `MapView`.

---

## `src/components/map/MapView.tsx`

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
import { useMapChromeTransition } from '../../context/MapChromeTransitionContext'
import { dispatchTerraeMapClearFloatingUi } from '../../lib/mapFloatingUiEvents'
import { countFiltrosAlterados } from '../../lib/mapFiltrosCount'
import {
  REGIME_BADGE_TOOLTIP,
  REGIME_COLORS,
  REGIME_LABELS,
  REGIME_LAYER_ORDER,
} from '../../lib/regimes'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import {
  MAPBOX_STYLE_SATELLITE,
  MapStyleSwitcher,
} from './MapStyleSwitcher'
import {
  MapFiltersFloating,
  MapFiltersPeriodoPill,
  usePainelFiltrosAnimation,
} from './MapFiltersOverlay'
import { MapSearchBar } from './MapSearchBar'
import { ProcessoPopupContent } from './ProcessoPopup'
import { RelatorioCompleto } from './RelatorioCompleto'

type ModoVisualizacao = 'regime' | 'risco'

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
              : (REGIME_COLORS[p.regime] ?? '#888780'),
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
      'fill-opacity': 0.3,
    },
  })

  map.addLayer({
    id: 'processos-outline',
    type: 'line',
    source: 'processos',
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'line-width': 2.5,
      'line-opacity': 1,
    },
  })
}

const PROCESSOS_CLICK_LAYERS = ['processos-fill', 'processos-outline'] as const

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

const PROCESSO_POPUP_OFFSET_PX = 10
const PROCESSO_POPUP_MARGEM_BORDA_PX = 12
/** Deve ser removido com `popup.removeClassName(...)`: o Mapbox repõe o `className` do contentor em cada `move`. */
const PROCESSO_POPUP_LAYOUT_PENDING_CLASS = 'terrae-processo-popup--layout-pending'

/**
 * Com âncora `bottom`, o cartão fica acima do ponto; com `top`, abaixo.
 * Mede a altura real do popup após o React pintar e fixa a âncora num único passo
 * (evita o “abre em cima e depois embaixo”).
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
    if (h < 16) {
      if (tentativas < MAX_TENTATIVAS_LAYOUT) {
        requestAnimationFrame(aplicar)
        return
      }
      popup.setOffset(PROCESSO_POPUP_OFFSET_PX)
      popup.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
      return
    }

    const pos = map.project(lngLat)
    const cabeAcima =
      pos.y - h >= PROCESSO_POPUP_MARGEM_BORDA_PX &&
      pos.y >= PROCESSO_POPUP_MARGEM_BORDA_PX

    popup.options.anchor = cabeAcima ? 'bottom' : 'top'
    popup.setOffset(PROCESSO_POPUP_OFFSET_PX)
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

  const closePopup = () => {
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

  root.render(
    <ProcessoPopupContent
      processo={proc}
      onClose={closePopup}
      onToggleRelatorioCompleto={onToggleRelatorioCompleto}
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
   * Um único `click` no mapa: hit em polígono substitui o popup; clique no vazio não fecha nada
   * (só ✕ no popover ou outro polígono alteram/remotam o popup).
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
  const [mapLoaded, setMapLoaded] = useState(false)
  const [estiloAtivo, setEstiloAtivo] = useState(MAPBOX_STYLE_SATELLITE)
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('regime')
  const modoVisualizacaoRef = useRef<ModoVisualizacao>('regime')
  modoVisualizacaoRef.current = modoVisualizacao
  const filtros = useMapStore((s) => s.filtros)
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
      setRelatorioAbaInicial('processo')
      st.setRelatorioDrawerAberto(true)
    }
  }

  useEffect(() => {
    if (!processoSelecionado) setRelatorioDrawerAberto(false)
  }, [processoSelecionado, setRelatorioDrawerAberto])

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
      const filtrados = buildGeoJSON(
        useMapStore.getState().getProcessosFiltrados(),
        modoVisualizacaoRef.current,
      )
      if (!map.getSource('processos')) {
        addProcessosLayers(map, filtrados)
      }
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
  }, [mapLoaded, filtros, modoVisualizacao])

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
          transformOrigin: '50% 0',
          transitionProperty: 'transform',
          transitionDuration: `${chromeExitMs}ms`,
          transitionTimingFunction: 'ease-out',
          transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs}ms`,
        }}
      >
        <div className="pointer-events-auto flex min-w-0 max-w-full flex-col items-center gap-2">
          <MapSearchBar
            painelFiltrosAberto={painelFiltrosAberto}
            onTogglePainelFiltros={() =>
              setPainelFiltrosAberto((o) => !o)
            }
            filtrosAlteradosCount={filtrosAlteradosCount}
            modoRisco={modoVisualizacao === 'risco'}
            onToggleModoRisco={() =>
              setModoVisualizacao((m) => (m === 'risco' ? 'regime' : 'risco'))
            }
          />
          {painelFiltrosMontado ? (
            <MapFiltersPeriodoPill
              animar={painelFiltrosAnimar}
              painelAberto={painelFiltrosAberto}
            />
          ) : null}
        </div>
      </div>
      {painelFiltrosMontado ? (
        <MapFiltersFloating animar={painelFiltrosAnimar} />
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
            transition: `transform ${chromeEase}`,
          }}
        >
          <p className="mb-2.5 text-[12px] font-medium uppercase tracking-[2px] text-[var(--text-section-title)]">
            Risk Score
          </p>
          <ul className="flex flex-col gap-2">
            {LEGENDA_RISCO_ITEMS.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
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
          transition: `transform ${chromeEase}`,
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
        <div
          className="pointer-events-auto rounded-lg border border-solid text-[13px] text-[#888780]"
          style={{
            background: 'rgba(17, 17, 16, 0.9)',
            borderColor: '#2C2C2A',
            borderRadius: 8,
            padding: '10px 12px',
            opacity:
              modoVisualizacao === 'risco'
                ? 0.35
                : painelFiltrosAberto
                  ? 0.15
                  : 1,
            transition: 'opacity 300ms ease',
          }}
        >
          <p className="mb-2.5 text-[12px] font-medium uppercase tracking-[2px] text-[var(--text-section-title)]">
            Legenda
          </p>
          <ul className="flex flex-col gap-2">
            {REGIME_LAYER_ORDER.map((r) => (
              <li key={r} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: REGIME_COLORS[r] }}
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
        </div>
      </div>
      <RelatorioCompleto
        processo={processoSelecionado}
        aberto={relatorioDrawerAberto}
        onFechar={() => setRelatorioDrawerAberto(false)}
        abaInicial={relatorioAbaInicial}
      />
    </div>
  )
}
```

---

## `src/components/map/MapSearchBar.tsx`

```tsx
import { Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
  const setFiltro = useMapStore((s) => s.setFiltro)
  const processos = useMapStore((s) => s.processos)
  const requestFlyTo = useMapStore((s) => s.requestFlyTo)

  useEffect(() => {
    setLocal(searchQuery)
  }, [searchQuery])

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
      className="group pointer-events-auto relative box-border flex h-12 w-[min(680px,50vw)] min-w-[min(600px,100%)] max-w-[100%] shrink-0 items-center rounded-[24px] border border-solid border-[#2C2C2A] bg-[#1A1A18]/95 px-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-[border-color] duration-200 focus-within:border-[#EF9F27]"
      style={{ backgroundColor: 'rgba(26, 26, 24, 0.95)' }}
    >
      <button
        type="button"
        aria-expanded={painelFiltrosAberto}
        aria-label="Filtros do mapa"
        onClick={onTogglePainelFiltros}
        className="relative box-border flex h-full shrink-0 cursor-pointer items-center border-0 px-3 text-[#888780] transition-colors hover:text-[#D3D1C7]"
        style={{ borderRight: '1px solid #2C2C2A', paddingLeft: 12, paddingRight: 12 }}
      >
        <span className="relative inline-flex">
          <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
          {filtrosAlteradosCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF9F27] px-0.5 text-[10px] font-bold leading-none text-[#0D0D0C]"
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
        onKeyDown={(e) => e.key === 'Enter' && tryFlyToNumero()}
        placeholder="Buscar endereço, cidade, estado ou número do processo..."
        className="min-w-0 flex-1 border-0 bg-transparent pl-3 text-[15px] text-[#F1EFE8] outline-none placeholder:text-[15px] placeholder:text-[#5F5E5A]"
      />
      <div
        className="flex h-full shrink-0 items-center justify-center self-stretch"
        style={{ borderLeft: '1px solid #2C2C2A', paddingLeft: 16, paddingRight: 20 }}
      >
        <button
          type="button"
          aria-pressed={modoRisco}
          onClick={onToggleModoRisco}
          className={`cursor-pointer border-0 bg-transparent px-0 text-[13px] transition-colors ${
            modoRisco
              ? 'font-semibold text-[#EF9F27]'
              : 'font-normal text-[#888780] hover:text-[#D3D1C7]'
          }`}
        >
          Risk Score
        </button>
      </div>
    </div>
  )
}
```
