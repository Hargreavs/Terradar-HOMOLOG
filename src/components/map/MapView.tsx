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
import {
  addTerritorioSimuladoLayers,
  syncTerritorioSimuladoVisibility,
  territorioSimuladoLayersPresent,
} from '../../lib/mapTerritorioSimulado'
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
import { useMapLayer, type BBox } from '../../hooks/useMapLayer'
import { useProcessosViewport } from '../../hooks/useProcessosViewport'
import { mapViewportFeaturesToProcessos } from '../../lib/mapProcessoFromDbRow'
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
import type { RelatorioData } from '../../data/relatorio.mock'
import { relatorioDataFromReportData } from '../../lib/relatorioDataFromReportData'
import { buildReportData } from '../report/reportDataBuilder'
import { ProcessoPopupContent } from './ProcessoPopup'
import { RelatorioCompleto } from './RelatorioCompleto'

/**
 * Limit dinâmico para `useProcessosViewport` baseado no zoom.
 *
 * Em zoom baixo o bbox cobre grande fração da tabela e o planner do
 * Postgres ignora o GIST (Seq Scan paralelo + sort em disco). Além disso,
 * 2000 polígonos em zoom ≤ 5 não são utilizáveis no UI. Escalamos pra
 * preservar performance de backend e responsividade do Mapbox.
 */
function getViewportProcessosLimit(zoom: number): number {
  if (zoom <= 4) return 250
  if (zoom === 5) return 400
  if (zoom === 6) return 700
  if (zoom === 7) return 1100
  if (zoom === 8) return 1500
  return 2000
}

/**
 * Zoom mínimo para ativar busca de processos por viewport.
 *
 * Abaixo deste threshold o bbox cobre grande fração da tabela e o
 * Postgres faz Seq Scan + sort em disco (9-22s), independentemente do
 * limit aplicado. Sort top-N em 123k rows persiste mesmo com limit=1.
 * Nesses zooms o mapa mostra apenas MOCKs/demos; o usuário aproxima
 * para ver densidade real.
 */
const VIEWPORT_ZOOM_MIN = 7

/**
 * Processos de referência carregados do banco real no mount do mapa.
 * Garantem que demos de apresentação (Tocantins) apareçam em qualquer
 * zoom, independentemente do viewport gate (z >= 7). Se editar esta
 * lista, confirmar que os números existem na tabela `processos`.
 */
const DEMO_NUMEROS: readonly string[] = [
  '864.231/2017',
  '860.232/1990',
] as const

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

/** Ignora no máx. um `click` após pan. Mapbox às vezes emite clique fantasma; timeout evita estado preso. */
type MapDragClickGuard = {
  consumeNextClick: boolean
  resetTimeoutId: ReturnType<typeof setTimeout> | null
}

/** Igual à transição do drawer (`RelatorioCompleto` transform 300ms) + margem. */
const DRAWER_CLOSE_ANIM_MS = 320

/**
 * Ignora o próximo `click` do Mapbox (mesma lógica do fim do pan).
 * Ao abrir o relatório a partir do popover, o teardown remove o popup; o mesmo gesto
 * pode ainda disparar `click` no mapa sobre o polígono já selecionado, o que
 * executaria o ramo “segundo clique no mesmo processo” e fecharia o drawer.
 */
function armarConsumoProximoCliqueMapa(
  ref: MutableRefObject<MapDragClickGuard>,
) {
  const g = ref.current
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
    armarConsumoProximoCliqueMapa(dragClickGuardRef)
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

    /* Mapa vazio: não teardown, não limpar seleção, não fechar drawer; pan/zoom/click fora do polígono mantêm o popover. */
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
  const BRASIL_BBOX: BBox = [-74.0, -34.0, -34.0, 5.5]
  const [viewportBbox, setViewportBbox] = useState<BBox | null>(null)
  const [viewportZoom, setViewportZoom] = useState<number>(4)
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
  const processos = useMapStore((s) => s.processos)
  const territorioSimuladoVisivel = useMapStore((s) => s.territorioSimuladoVisivel)
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
    | 'processo'
    | 'territorio'
    | 'inteligencia'
    | 'risco'
    | 'oportunidade'
    | 'fiscal'
  >('processo')
  /** Incrementa ao pedir a aba Risco no drawer (força sync mesmo se `abaInicial` já era `risco`). */
  const [relatorioAbaRiscoRequestId, setRelatorioAbaRiscoRequestId] =
    useState(0)

  const [relatorioDadosApi, setRelatorioDadosApi] =
    useState<RelatorioData | null>(null)
  const [relatorioApiLoading, setRelatorioApiLoading] = useState(false)
  const [relatorioApiErro, setRelatorioApiErro] = useState<string | null>(null)

  useEffect(() => {
    setRelatorioDadosApi(null)
    setRelatorioApiErro(null)
    setRelatorioApiLoading(false)
  }, [processoSelecionado?.id])

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
      armarConsumoProximoCliqueMapa(mapDragClickGuardRef)
      tearDownProcessoPopupRef.current?.()
      setRelatorioAbaInicial('processo')
      const p = st.processoSelecionado
      if (p?.fromApi) {
        setRelatorioApiErro(null)
        setRelatorioDadosApi(null)
        setRelatorioApiLoading(true)
        void (async () => {
          try {
            const rd = await buildReportData(p.numero)
            setRelatorioDadosApi(relatorioDataFromReportData(rd, p))
          } catch (e) {
            setRelatorioApiErro(
              e instanceof Error
                ? e.message
                : 'Não foi possível carregar o relatório.',
            )
          } finally {
            setRelatorioApiLoading(false)
          }
        })()
      } else {
        setRelatorioDadosApi(null)
        setRelatorioApiErro(null)
        setRelatorioApiLoading(false)
      }
      st.setRelatorioDrawerAberto(true)
    }
  }

  const abrirRelatorioAbaRiscoRef = useRef<() => void>(() => {})
  abrirRelatorioAbaRiscoRef.current = () => {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
      pendingFecharProcessoTimeoutRef.current = null
    }
    armarConsumoProximoCliqueMapa(mapDragClickGuardRef)
    tearDownProcessoPopupRef.current?.()
    setRelatorioAbaInicial('risco')
    setRelatorioAbaRiscoRequestId((n) => n + 1)
    const p = useMapStore.getState().processoSelecionado
    if (p?.fromApi) {
      setRelatorioApiErro(null)
      setRelatorioDadosApi(null)
      setRelatorioApiLoading(true)
      void (async () => {
        try {
          const rd = await buildReportData(p.numero)
          setRelatorioDadosApi(relatorioDataFromReportData(rd, p))
        } catch (e) {
          setRelatorioApiErro(
            e instanceof Error
              ? e.message
              : 'Não foi possível carregar o relatório.',
          )
        } finally {
          setRelatorioApiLoading(false)
        }
      })()
    }
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
      if (!territorioSimuladoLayersPresent(map)) {
        addTerritorioSimuladoLayers(map, 'processos-fill')
      }
      syncTerritorioSimuladoVisibility(
        map,
        useMapStore.getState().territorioSimuladoVisivel,
      )
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
  }, [mapLoaded, filtros, modoVisualizacao, intelTitularFilter, processos])

  /**
   * `requestFlyTo` atualiza o store; o `useEffect` nem sempre disparava a tempo (Strict Mode / ordem).
   * Subscrição Zustand corre síncrono quando `flyTo` muda; garante `fitBounds` / `flyTo` no Mapbox.
   */
  const prevFlyToRef = useRef<MapStore['flyTo']>(null)

  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current
    if (!map) return

    const applyCamera = (ft: NonNullable<MapStore['flyTo']>) => {
      const st = useMapStore.getState()
      const proc =
        (ft.processoId && st.processos.find((x) => x.id === ft.processoId)) ||
        st.processoSelecionado

      const bounds = proc ? boundsFromSingleProcesso(proc) : null

      try {
        if (bounds && !bounds.isEmpty()) {
          const padding = {
            top: 120,
            bottom: 120,
            left: getIntelLeftReservePx() + 40,
            right: 40,
          }
          const camera = map.cameraForBounds(bounds, {
            padding,
            maxZoom: 14,
          })
          if (camera && 'center' in camera && 'zoom' in camera) {
            // Navegação intencional por busca: animação direcional de ~3s.
            // prefers-reduced-motion projetado para animações decorativas
            // (parallax, spin, flash), não para navegação funcional.
            map.flyTo({
              center: camera.center,
              zoom: camera.zoom,
              speed: 1.0,
              curve: 1.8,
              essential: true,
            })
          } else {
            // Fallback raro: cameraForBounds falhou.
            console.warn('[flyto] cameraForBounds retornou inválido', camera)
            map.fitBounds(bounds, {
              padding,
              duration: 2500,
              maxZoom: 14,
              essential: true,
            })
          }
        } else {
          map.flyTo({
            center: [ft.lng, ft.lat],
            zoom: Math.max(ft.zoom, 12),
            speed: 1.0,
            curve: 1.8,
            essential: true,
          })
        }
      } finally {
        useMapStore.getState().clearFlyTo()
      }
    }

    const unsub = useMapStore.subscribe((state) => {
      const ft = state.flyTo
      if (ft === prevFlyToRef.current) return
      prevFlyToRef.current = ft
      if (!ft) return
      applyCamera(ft)
    })

    return unsub
  }, [mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.isStyleLoaded()) return
    syncCamadasGeoVisibility(map, camadasGeo)
  }, [mapLoaded, camadasGeo])

  // Viewport tracking para camadas API (bioma/rodovia/hidrovia)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const updateViewport = () => {
      try {
        const b = map.getBounds()
        if (!b) return
        const sw = b.getSouthWest()
        const ne = b.getNorthEast()
        setViewportBbox([sw.lng, sw.lat, ne.lng, ne.lat])
        setViewportZoom(map.getZoom())
      } catch {
        // silently ignore
      }
    }

    updateViewport()
    map.on('moveend', updateViewport)
    map.on('zoomend', updateViewport)

    return () => {
      map.off('moveend', updateViewport)
      map.off('zoomend', updateViewport)
    }
  }, [mapLoaded])

  const biomasData = useMapLayer({
    tipo: 'bioma',
    enabled: !!camadasGeo.biomas && mapLoaded,
    bbox: BRASIL_BBOX,
    zoom: 4,
    limit: 50,
  })

  const rodoviasData = useMapLayer({
    tipo: 'rodovia',
    enabled: !!camadasGeo.rodovias && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 500,
  })

  const hidroviasData = useMapLayer({
    tipo: 'hidrovia',
    enabled: !!camadasGeo.hidrovias && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 500,
  })

  // Camada TI (bbox-aware)
  const tiData = useMapLayer({
    tipo: 'ti',
    enabled: !!camadasGeo.terras_indigenas && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 800,
  })

  // Camada Quilombola (bbox-aware)
  const quilombolaData = useMapLayer({
    tipo: 'quilombola',
    enabled: !!camadasGeo.quilombolas && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 500,
  })

  // Camada UC Proteção Integral (bbox-aware, mesmo toggle unidades_conservacao)
  const ucPiData = useMapLayer({
    tipo: 'uc_pi',
    enabled: !!camadasGeo.unidades_conservacao && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 800,
  })

  // Camada UC Uso Sustentável (bbox-aware, mesmo toggle unidades_conservacao)
  const ucUsData = useMapLayer({
    tipo: 'uc_us',
    enabled: !!camadasGeo.unidades_conservacao && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 800,
  })

  // Camada Aquífero (bbox-aware)
  const aquiferoData = useMapLayer({
    tipo: 'aquifero',
    enabled: !!camadasGeo.aquiferos && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 800,
  })

  // Camada Ferrovia (bbox-aware)
  const ferroviaData = useMapLayer({
    tipo: 'ferrovia',
    enabled: !!camadasGeo.ferrovias && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 500,
  })

  // Camada Porto (bbox-aware)
  const portoData = useMapLayer({
    tipo: 'porto',
    enabled: !!camadasGeo.portos && mapLoaded,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: 500,
  })

  // Processos por viewport (2c) — fetch bbox-aware, merge no store
  const viewportProcessosData = useProcessosViewport({
    enabled: mapLoaded && (viewportZoom ?? 0) >= VIEWPORT_ZOOM_MIN,
    bbox: viewportBbox,
    zoom: viewportZoom,
    limit: getViewportProcessosLimit(viewportZoom ?? 5),
    debounceMs: 800,
  })

  const mergeViewportProcessos = useMapStore((s) => s.mergeViewportProcessos)
  const seedDemoProcessos = useMapStore((s) => s.seedDemoProcessos)

  // Seed de processos-demo do banco real.
  // Dispara 1x quando o mapa termina de carregar. Dedup via store.
  useEffect(() => {
    if (!mapLoaded) return
    void seedDemoProcessos([...DEMO_NUMEROS])
  }, [mapLoaded, seedDemoProcessos])

  useEffect(() => {
    if (!viewportProcessosData) return
    const features = viewportProcessosData.features
    if (!features.length) return
    const processos = mapViewportFeaturesToProcessos(features)
    if (processos.length) {
      mergeViewportProcessos(processos)
    }
  }, [viewportProcessosData, mergeViewportProcessos])

  // Sync Biomas no Mapbox
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-biomas-src'
    const FILL_ID = 'api-biomas-fill'
    const LINE_ID = 'api-biomas-line'

    const fc = biomasData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SRC_ID,
          paint: {
            'fill-color': '#8FA668',
            'fill-opacity': 0.18,
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#8FA668',
            'line-opacity': 0.6,
            'line-width': 1,
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.biomas ? 'visible' : 'none'
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, biomasData, camadasGeo.biomas])

  // Sync Rodovias no Mapbox
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-rodovias-src'
    const LINE_ID = 'api-rodovias-line'

    const fc =
      rodoviasData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#D9A55B',
            'line-opacity': 0.85,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 12, 2.5],
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.rodovias ? 'visible' : 'none'
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, rodoviasData, camadasGeo.rodovias])

  // Sync Hidrovias no Mapbox
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-hidrovias-src'
    const LINE_ID = 'api-hidrovias-line'

    const fc =
      hidroviasData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#5FA8B8',
            'line-opacity': 0.85,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 3],
            'line-dasharray': [2, 1.5],
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.hidrovias ? 'visible' : 'none'
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, hidroviasData, camadasGeo.hidrovias])

  // Sync TI no Mapbox (API)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-ti-src'
    const FILL_ID = 'api-ti-fill'
    const LINE_ID = 'api-ti-line'

    const fc = tiData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SRC_ID,
          paint: {
            'fill-color': '#E07A5F',
            'fill-opacity': 0.28,
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#E07A5F',
            'line-opacity': 0.9,
            'line-width': 1.2,
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const on = !!camadasGeo.terras_indigenas
    const vis = on ? 'visible' : 'none'
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)

    const STATIC_IDS = [
      'geo-terras_indigenas-fill',
      'geo-terras_indigenas-line',
      'geo-terras_indigenas-label',
    ]
    const staticVis = 'none'
    for (const sid of STATIC_IDS) {
      if (map.getLayer(sid)) map.setLayoutProperty(sid, 'visibility', staticVis)
    }
  }, [mapLoaded, tiData, camadasGeo.terras_indigenas])

  // Sync Quilombola no Mapbox (API)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-quilombola-src'
    const FILL_ID = 'api-quilombola-fill'
    const LINE_ID = 'api-quilombola-line'

    const fc =
      quilombolaData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SRC_ID,
          paint: {
            'fill-color': '#C4915A',
            'fill-opacity': 0.3,
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#C4915A',
            'line-opacity': 0.9,
            'line-width': 1.2,
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.quilombolas ? 'visible' : 'none'
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)

    const STATIC_IDS = [
      'geo-quilombolas-fill',
      'geo-quilombolas-line',
      'geo-quilombolas-circle',
      'geo-quilombolas-label',
    ]
    for (const sid of STATIC_IDS) {
      if (map.getLayer(sid)) map.setLayoutProperty(sid, 'visibility', 'none')
    }
  }, [mapLoaded, quilombolaData, camadasGeo.quilombolas])

  // Sync UC Proteção Integral no Mapbox (API)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-uc-pi-src'
    const FILL_ID = 'api-uc-pi-fill'
    const LINE_ID = 'api-uc-pi-line'

    const fc = ucPiData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SRC_ID,
          paint: {
            'fill-color': '#2F7A3E',
            'fill-opacity': 0.32,
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#2F7A3E',
            'line-opacity': 0.9,
            'line-width': 1.2,
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.unidades_conservacao ? 'visible' : 'none'
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, ucPiData, camadasGeo.unidades_conservacao])

  // Sync UC Uso Sustentável no Mapbox (API)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-uc-us-src'
    const FILL_ID = 'api-uc-us-fill'
    const LINE_ID = 'api-uc-us-line'

    const fc = ucUsData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SRC_ID,
          paint: {
            'fill-color': '#5FAE6C',
            'fill-opacity': 0.24,
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#5FAE6C',
            'line-opacity': 0.85,
            'line-width': 1,
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.unidades_conservacao ? 'visible' : 'none'
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, ucUsData, camadasGeo.unidades_conservacao])

  // Sync Aquífero no Mapbox (API) - polígono
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-aquifero-src'
    const FILL_ID = 'api-aquifero-fill'
    const LINE_ID = 'api-aquifero-line'

    const fc =
      aquiferoData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer(
        {
          id: FILL_ID,
          type: 'fill',
          source: SRC_ID,
          paint: {
            'fill-color': '#4A90B8',
            'fill-opacity': 0.22,
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#4A90B8',
            'line-opacity': 0.75,
            'line-width': 0.8,
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.aquiferos ? 'visible' : 'none'
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, aquiferoData, camadasGeo.aquiferos])

  // Sync Ferrovia no Mapbox (API) - linha
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-ferrovia-src'
    const HALO_ID = 'api-ferrovia-halo'
    const LINE_ID = 'api-ferrovia-line'

    const fc =
      ferroviaData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      // Halo branco atrás da linha para contraste
      map.addLayer(
        {
          id: HALO_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#FFFFFF',
            'line-opacity': 0.4,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 12, 4],
          },
        },
        'processos-fill',
      )
      map.addLayer(
        {
          id: LINE_ID,
          type: 'line',
          source: SRC_ID,
          paint: {
            'line-color': '#B8B8B8',
            'line-opacity': 0.95,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 2],
          },
        },
        'processos-fill',
      )
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.ferrovias ? 'visible' : 'none'
    if (map.getLayer(HALO_ID)) map.setLayoutProperty(HALO_ID, 'visibility', vis)
    if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', vis)
  }, [mapLoaded, ferroviaData, camadasGeo.ferrovias])

  // Sync Porto no Mapbox (API) - ponto
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC_ID = 'api-porto-src'
    const CIRCLE_ID = 'api-porto-circle'

    const fc = portoData ?? { type: 'FeatureCollection' as const, features: [] }

    if (!map.getSource(SRC_ID)) {
      map.addSource(SRC_ID, {
        type: 'geojson',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: fc as any,
      })
      map.addLayer({
        id: CIRCLE_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-color': '#7EADD4',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 12, 8],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.95,
        },
      })
    } else {
      const src = map.getSource(SRC_ID) as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      src?.setData(fc as any)
    }

    const vis = camadasGeo.portos ? 'visible' : 'none'
    if (map.getLayer(CIRCLE_ID))
      map.setLayoutProperty(CIRCLE_ID, 'visibility', vis)
  }, [mapLoaded, portoData, camadasGeo.portos])

  // Força camadas estáticas dos tipos migrados para API a ficarem SEMPRE ocultas.
  // Roda a cada mudança em camadasGeo para sobrepor syncCamadasGeoVisibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const STATIC_MIGRATED: string[] = [
      'geo-terras_indigenas-fill',
      'geo-terras_indigenas-line',
      'geo-terras_indigenas-label',
      'geo-quilombolas-fill',
      'geo-quilombolas-line',
      'geo-quilombolas-circle',
      'geo-quilombolas-label',
      'geo-unidades_conservacao-fill',
      'geo-unidades_conservacao-line',
      'geo-unidades_conservacao-label',
      'geo-aquiferos-fill',
      'geo-aquiferos-line',
      'geo-aquiferos-label',
      'geo-ferrovias-halo',
      'geo-ferrovias-line',
      'geo-ferrovias-label',
      'geo-portos-circle',
      'geo-portos-label',
    ]

    for (const id of STATIC_MIGRATED) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'none')
      }
    }
  }, [mapLoaded, camadasGeo])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.isStyleLoaded()) return
    if (!territorioSimuladoLayersPresent(map)) {
      addTerritorioSimuladoLayers(map, 'processos-fill')
    }
    syncTerritorioSimuladoVisibility(map, territorioSimuladoVisivel)
  }, [mapLoaded, territorioSimuladoVisivel])

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

        addTerritorioSimuladoLayers(map, 'processos-fill')
        syncTerritorioSimuladoVisibility(
          map,
          useMapStore.getState().territorioSimuladoVisivel,
        )

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
        abaRiscoRequestId={relatorioAbaRiscoRequestId}
        dadosRelatorioApi={relatorioDadosApi}
        relatorioApiLoading={relatorioApiLoading}
        relatorioApiErro={relatorioApiErro}
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
