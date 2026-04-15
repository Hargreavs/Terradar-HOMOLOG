import type mapboxgl from 'mapbox-gl'
import {
  appendDistanciaFeatures,
  loadTerritorioSimulado860232Data,
  type Territorio860232FeatureCollection,
} from '../data/territorioSimulado860232'
import { PROCESSO_860232_CENTROIDE_LNG_LAT } from '../data/processo860232Geo'
import { centroidLngLatFromPolygonRing } from '../data/processo864231Geo'

const TEXT_FONT = ['DIN Pro Medium', 'Arial Unicode MS Bold'] as string[]
const TEXT_FONT_BOLD = ['DIN Pro Bold', 'Arial Unicode MS Bold'] as string[]

/** Cores alinhadas às áreas (linhas de ligação + rótulos km). */
const DIST_COLOR_MATCH: mapboxgl.ExpressionSpecification = [
  'match',
  ['get', 'dist_link'],
  'quilombola',
  'rgba(255, 165, 40, 0.98)',
  'rppn',
  'rgba(0, 190, 110, 0.98)',
  'apa',
  'rgba(0, 210, 130, 0.98)',
  'porto',
  'rgba(50, 110, 230, 0.98)',
  'rgba(255, 255, 255, 0.95)',
]

const DIST_LABEL_COLOR_MATCH: mapboxgl.ExpressionSpecification = [
  'match',
  ['get', 'dist_link'],
  'quilombola',
  'rgba(255, 200, 80, 1)',
  'rppn',
  'rgba(40, 255, 160, 1)',
  'apa',
  'rgba(60, 255, 180, 1)',
  'porto',
  'rgba(120, 180, 255, 1)',
  '#ffffff',
]

function addBefore(
  map: mapboxgl.Map,
  layer: mapboxgl.AddLayerObject,
  beforeId: string,
) {
  map.addLayer(layer, beforeId)
}

const poly = (t: string): mapboxgl.ExpressionSpecification => [
  'all',
  ['==', ['geometry-type'], 'Polygon'],
  ['==', ['get', 'type'], t],
]

export const TERRITORIO_SIMULADO_860232_LAYER_IDS = [
  'territorio-apa-fill',
  'territorio-apa-line',
  'territorio-rppn-fill',
  'territorio-rppn-line',
  'territorio-quilombola-fill',
  'territorio-quilombola-line',
  'territorio-ti-fill',
  'territorio-ti-line',
  'territorio-br010-line',
  'territorio-fiol-line',
  'territorio-porto-circle',
  'territorio-labels-line',
  'territorio-labels',
  'territorio-distancia-shadow',
  'territorio-distancia-lines',
  'territorio-distancia-labels',
] as const

export function territorioSimulado860232LayersPresent(map: mapboxgl.Map): boolean {
  return Boolean(map.getSource('territorio-simulado-860232'))
}

function merge860232WithProcessosCentroid(
  map: mapboxgl.Map,
): Territorio860232FeatureCollection {
  const base = loadTerritorioSimulado860232Data()
  let centroid: [number, number] = [...PROCESSO_860232_CENTROIDE_LNG_LAT]
  try {
    const feats = map.querySourceFeatures('processos', {
      filter: ['==', ['get', 'numero'], '860.232/1990'],
    })
    const f = feats[0]
    if (f?.geometry?.type === 'Polygon') {
      const ring = f.geometry.coordinates[0] as [number, number][]
      centroid = centroidLngLatFromPolygonRing(ring)
    }
  } catch {
    /* fallback */
  }
  return appendDistanciaFeatures(base, centroid)
}

export function refreshTerritorioSimulado860232FromProcessos(map: mapboxgl.Map) {
  const src = map.getSource(
    'territorio-simulado-860232',
  ) as mapboxgl.GeoJSONSource | undefined
  if (!src) return
  const fc = merge860232WithProcessosCentroid(map)
  src.setData(fc as mapboxgl.GeoJSONFeatureCollection)
}

export function addTerritorioSimulado860232Layers(
  map: mapboxgl.Map,
  beforeId: string,
) {
  if (territorioSimulado860232LayersPresent(map)) return

  const fc = merge860232WithProcessosCentroid(map)
  map.addSource('territorio-simulado-860232', {
    type: 'geojson',
    data: fc as mapboxgl.GeoJSONFeatureCollection,
  })

  const lineFilter = (
    t: string,
  ): mapboxgl.ExpressionSpecification => [
    'all',
    ['==', ['geometry-type'], 'LineString'],
    ['==', ['get', 'type'], t],
  ]

  const brFiolLabelFilter: mapboxgl.ExpressionSpecification = [
    'all',
    ['==', ['geometry-type'], 'LineString'],
    ['in', ['get', 'type'], ['literal', ['br010', 'fiol']]],
  ]

  const distFilter: mapboxgl.ExpressionSpecification = [
    '==',
    ['get', 'type'],
    'distancia',
  ]

  addBefore(
    map,
    {
      id: 'territorio-apa-fill',
      type: 'fill',
      source: 'territorio-simulado-860232',
      filter: poly('apa'),
      paint: {
        'fill-color': 'rgba(0, 200, 120, 0.28)',
        'fill-opacity': 1,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-apa-line',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: poly('apa'),
      paint: {
        'line-color': 'rgba(0, 180, 100, 0.95)',
        'line-width': 3,
        'line-dasharray': [10, 5],
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-rppn-fill',
      type: 'fill',
      source: 'territorio-simulado-860232',
      filter: poly('rppn'),
      paint: {
        'fill-color': 'rgba(0, 220, 130, 0.32)',
        'fill-opacity': 1,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-rppn-line',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: poly('rppn'),
      paint: {
        'line-color': 'rgba(0, 200, 115, 0.95)',
        'line-width': 3,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-quilombola-fill',
      type: 'fill',
      source: 'territorio-simulado-860232',
      filter: poly('quilombola'),
      paint: {
        'fill-color': 'rgba(255, 180, 40, 0.42)',
        'fill-opacity': 1,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-quilombola-line',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: poly('quilombola'),
      paint: {
        'line-color': 'rgba(255, 150, 0, 0.95)',
        'line-width': 3,
        'line-dasharray': [8, 4],
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-ti-fill',
      type: 'fill',
      source: 'territorio-simulado-860232',
      filter: poly('ti'),
      paint: {
        'fill-color': 'rgba(255, 90, 50, 0.35)',
        'fill-opacity': 1,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-ti-line',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: poly('ti'),
      paint: {
        'line-color': 'rgba(255, 70, 40, 0.95)',
        'line-width': 3,
        'line-dasharray': [6, 4],
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-br010-line',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: lineFilter('br010'),
      paint: {
        'line-color': 'rgba(255, 210, 60, 0.95)',
        'line-width': 3,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-fiol-line',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: lineFilter('fiol'),
      paint: {
        'line-color': 'rgba(210, 210, 210, 0.9)',
        'line-width': 3,
        'line-dasharray': [6, 6],
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-porto-circle',
      type: 'circle',
      source: 'territorio-simulado-860232',
      filter: ['==', ['get', 'type'], 'porto'],
      paint: {
        'circle-radius': 7,
        'circle-color': 'rgba(40, 100, 230, 1)',
        'circle-opacity': 1,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-labels-line',
      type: 'symbol',
      source: 'territorio-simulado-860232',
      filter: brFiolLabelFilter,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'label'],
        'text-size': 13,
        'text-font': TEXT_FONT,
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': 'rgba(0, 0, 0, 0.85)',
        'text-halo-width': 2,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-labels',
      type: 'symbol',
      source: 'territorio-simulado-860232',
      filter: ['==', ['get', 'type'], 'label_area'],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 15,
        'text-font': TEXT_FONT_BOLD,
        'text-anchor': 'center',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': 'rgba(0, 0, 0, 0.85)',
        'text-halo-width': 2.5,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-distancia-shadow',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: distFilter,
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.55)',
        'line-width': 7,
        'line-blur': 1,
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-distancia-lines',
      type: 'line',
      source: 'territorio-simulado-860232',
      filter: distFilter,
      paint: {
        'line-color': DIST_COLOR_MATCH,
        'line-width': 4.5,
        'line-dasharray': [5, 4],
      },
    },
    beforeId,
  )

  addBefore(
    map,
    {
      id: 'territorio-distancia-labels',
      type: 'symbol',
      source: 'territorio-simulado-860232',
      filter: ['==', ['get', 'type'], 'label_dist'],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 14,
        'text-font': TEXT_FONT_BOLD,
        'text-anchor': 'center',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': DIST_LABEL_COLOR_MATCH,
        'text-halo-color': 'rgba(0, 0, 0, 0.75)',
        'text-halo-width': 2.5,
      },
    },
    beforeId,
  )
}

export function syncTerritorioSimulado860232Visibility(
  map: mapboxgl.Map,
  visible: boolean,
) {
  const vis = visible ? 'visible' : 'none'
  for (const id of TERRITORIO_SIMULADO_860232_LAYER_IDS) {
    if (!map.getLayer(id)) continue
    map.setLayoutProperty(id, 'visibility', vis)
  }
}
