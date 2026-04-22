import mapboxgl from 'mapbox-gl'

import type { CamadaGeoId } from './mapCamadasGeo'

/**
 * Linhas territoriais tracejadas: overlay contextual quando há processo focado.
 * Dados: RPC `fn_territorial_lines` via proxy `/api/map/territorial-lines`.
 * Layers ficam abaixo de `processos-fill` (beforeId) para polígonos de processo
 * permanecerem por cima.
 */

export const TERRITORIAL_LINES_SRC_ID = 'territorial-lines-src'

export const TERRITORIAL_LINES_LAYERS = {
  ti: 'territorial-lines-ti',
  uc_pi: 'territorial-lines-uc-pi',
  uc_us: 'territorial-lines-uc-us',
  quilombola: 'territorial-lines-quilombola',
  ferrovia: 'territorial-lines-ferrovia',
  rodovia: 'territorial-lines-rodovia',
  porto: 'territorial-lines-porto',
  sede: 'territorial-lines-sede',
} as const

export const TERRITORIAL_LINES_LABEL_LAYER = 'territorial-lines-labels'

export type TerritorialLineCategoria = keyof typeof TERRITORIAL_LINES_LAYERS

const BEFORE_LAYER_ID = 'processos-fill'

const CATEGORIAS: { id: TerritorialLineCategoria; cor: string }[] = [
  { id: 'ti', cor: '#E07A5F' },
  { id: 'uc_pi', cor: '#2F7A3E' },
  { id: 'uc_us', cor: '#5FAE6C' },
  { id: 'quilombola', cor: '#C4915A' },
  { id: 'ferrovia', cor: '#B8B8B8' },
  { id: 'rodovia', cor: '#D9A55B' },
  { id: 'porto', cor: '#7EADD4' },
  { id: 'sede', cor: '#9CA3AF' },
]

export async function fetchTerritorialLines(
  numero: string,
): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const resp = await fetch(
      `/api/map/territorial-lines?numero=${encodeURIComponent(numero)}`,
    )
    if (!resp.ok) {
      console.warn('[TerritorialLines] HTTP', resp.status)
      return null
    }
    const fc = (await resp.json()) as GeoJSON.FeatureCollection
    if (!fc?.features || fc.features.length === 0) return null
    return fc
  } catch (err) {
    console.warn('[TerritorialLines] fetch falhou:', err)
    return null
  }
}

/**
 * Registra source + 8 layers de linha + 1 de labels. Idempotente.
 * Todos começam com visibility none e opacity 0 (fade-in depois).
 */
export function addTerritorialLinesLayers(
  map: mapboxgl.Map,
  emptyFc: GeoJSON.FeatureCollection,
): void {
  if (map.getSource(TERRITORIAL_LINES_SRC_ID)) return

  map.addSource(TERRITORIAL_LINES_SRC_ID, {
    type: 'geojson',
    data: emptyFc,
  })

  const beforeId = map.getLayer(BEFORE_LAYER_ID) ? BEFORE_LAYER_ID : undefined

  for (const { id, cor } of CATEGORIAS) {
    const layerId = TERRITORIAL_LINES_LAYERS[id]
    map.addLayer(
      {
        id: layerId,
        type: 'line',
        source: TERRITORIAL_LINES_SRC_ID,
        filter: ['==', ['get', 'categoria'], id],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'none',
        },
        paint: {
          'line-color': cor,
          'line-width': 2.5,
          'line-opacity': 0,
          'line-dasharray': [3, 2],
          'line-opacity-transition': { duration: 300 },
        },
      },
      beforeId,
    )
  }

  map.addLayer(
    {
      id: TERRITORIAL_LINES_LABEL_LAYER,
      type: 'symbol',
      source: TERRITORIAL_LINES_SRC_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 13,
        'symbol-placement': 'line-center',
        'text-keep-upright': true,
        'text-max-angle': 25,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-letter-spacing': 0.02,
        visibility: 'none',
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111110',
        'text-halo-width': 2.5,
        'text-halo-blur': 1,
        'text-opacity': 0,
        'text-opacity-transition': { duration: 300 },
      },
    },
    beforeId,
  )
}

export function updateTerritorialLinesData(
  map: mapboxgl.Map,
  fc: GeoJSON.FeatureCollection,
): void {
  const src = map.getSource(TERRITORIAL_LINES_SRC_ID) as
    | mapboxgl.GeoJSONSource
    | undefined
  if (!src) return
  src.setData(fc)
}

export function setTerritorialLinesVisibility(
  map: mapboxgl.Map,
  visible: boolean,
): void {
  const layerIds = [
    ...Object.values(TERRITORIAL_LINES_LAYERS),
    TERRITORIAL_LINES_LABEL_LAYER,
  ]

  if (visible) {
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'visible')
      }
    }
    requestAnimationFrame(() => {
      for (const layerId of Object.values(TERRITORIAL_LINES_LAYERS)) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-opacity', 1.0)
        }
      }
      if (map.getLayer(TERRITORIAL_LINES_LABEL_LAYER)) {
        map.setPaintProperty(TERRITORIAL_LINES_LABEL_LAYER, 'text-opacity', 1)
      }
    })
  } else {
    for (const layerId of Object.values(TERRITORIAL_LINES_LAYERS)) {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-opacity', 0)
      }
    }
    if (map.getLayer(TERRITORIAL_LINES_LABEL_LAYER)) {
      map.setPaintProperty(TERRITORIAL_LINES_LABEL_LAYER, 'text-opacity', 0)
    }
    setTimeout(() => {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none')
        }
      }
    }, 350)
  }
}

const CATEGORIA_TO_CAMADA_GEO: Record<TerritorialLineCategoria, CamadaGeoId | null> =
  {
    ti: 'terras_indigenas',
    uc_pi: 'unidades_conservacao',
    uc_us: 'unidades_conservacao',
    quilombola: 'quilombolas',
    ferrovia: 'ferrovias',
    rodovia: 'rodovias',
    porto: 'portos',
    sede: null,
  }

/**
 * Lista de `CamadaGeoId` a ativar para exibir no mapa os polígonos/infra
 * correspondentes às categorias presentes nas linhas territoriais.
 */
export function getCamadasParaAtivar(
  fc: GeoJSON.FeatureCollection,
): CamadaGeoId[] {
  const set = new Set<CamadaGeoId>()
  for (const feat of fc.features) {
    const categoria = feat.properties?.categoria as TerritorialLineCategoria | undefined
    if (!categoria) continue
    const camadaId = CATEGORIA_TO_CAMADA_GEO[categoria]
    if (camadaId) set.add(camadaId)
  }
  return Array.from(set)
}

const CATEGORIA_TO_SOURCE_ID: Record<TerritorialLineCategoria, string | null> =
  {
    ti: 'api-ti-src',
    uc_pi: 'api-uc-pi-src',
    uc_us: 'api-uc-us-src',
    quilombola: 'api-quilombola-src',
    ferrovia: 'api-ferrovia-src',
    rodovia: 'api-rodovias-src',
    porto: 'api-porto-src',
    sede: null,
  }

/**
 * Mapa sourceId → Set de feature ids (string) a destacar; alinhado a
 * `fn_map_layer_geojson` (`id::text`).
 */
export function getHighlightedFeatureIds(
  fc: GeoJSON.FeatureCollection,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()

  for (const feat of fc.features) {
    const categoria = feat.properties?.categoria as TerritorialLineCategoria | undefined
    const featureId = feat.properties?.feature_id as unknown
    if (!categoria || featureId === null || featureId === undefined) continue

    const sourceId = CATEGORIA_TO_SOURCE_ID[categoria]
    if (!sourceId) continue

    const idStr = String(featureId)

    let set = result.get(sourceId)
    if (!set) {
      set = new Set<string>()
      result.set(sourceId, set)
    }
    set.add(idStr)
  }

  return result
}

function featureIdMatchesHighlight(
  rawId: string | number | undefined,
  ids: Set<string>,
): boolean {
  if (rawId === undefined || rawId === null) return false
  if (ids.has(String(rawId))) return true
  const n = Number(rawId)
  if (!Number.isNaN(n) && ids.has(String(n))) return true
  return false
}

/**
 * Marca `highlighted: true` nas features alvo e `false` nas demais da mesma
 * source (carregadas no tile), para o paint `== true / == false / neutro` funcionar.
 */
export function applyFeatureHighlights(
  map: mapboxgl.Map,
  highlights: Map<string, Set<string>>,
): void {
  for (const [sourceId, idsToHighlight] of highlights.entries()) {
    if (!map.getSource(sourceId) || idsToHighlight.size === 0) continue

    let features: mapboxgl.GeoJSONFeature[]
    try {
      features = map.querySourceFeatures(sourceId)
    } catch {
      continue
    }

    for (const f of features) {
      const rawId = f.id
      if (rawId === undefined || rawId === null) continue
      const on = featureIdMatchesHighlight(rawId, idsToHighlight)
      const state = { highlighted: on }

      try {
        map.setFeatureState({ source: sourceId, id: rawId }, state)
      } catch {
        try {
          map.setFeatureState({ source: sourceId, id: String(rawId) }, state)
        } catch {
          const n = Number(rawId)
          if (!Number.isNaN(n)) {
            try {
              map.setFeatureState({ source: sourceId, id: n }, state)
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
  }
}

export function clearFeatureHighlights(map: mapboxgl.Map): void {
  const sourceIds = Object.values(CATEGORIA_TO_SOURCE_ID).filter(
    (s): s is string => s !== null,
  )
  for (const sourceId of sourceIds) {
    if (!map.getSource(sourceId)) continue
    try {
      map.removeFeatureState({ source: sourceId })
    } catch {
      /* silencioso */
    }
  }
}
