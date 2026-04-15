import type mapboxgl from 'mapbox-gl'
import {
  loadTerritorioSimuladoData,
  type TerritorioSimuladoFeatureCollection,
} from '../data/territorioSimulado'

const TEXT_FONT = ['DIN Pro Medium', 'Arial Unicode MS Bold'] as string[]

/** Ordem de empilhamento (baixo → alto); todas ficam abaixo de `processos-fill`. */
export const TERRITORIO_SIMULADO_LAYER_IDS = [
  'territorio-uc-us-fill',
  'territorio-uc-us-line',
  'territorio-uc-pi-fill',
  'territorio-uc-pi-line',
  'territorio-ti-fill',
  'territorio-ti-line',
  'territorio-quilombola-fill',
  'territorio-quilombola-line',
  'territorio-ferrovia-line-shadow',
  'territorio-ferrovia-line-base',
  'territorio-distancia-line-shadow',
  'territorio-distancia-line',
  'territorio-label-area',
  'territorio-label-ferrovia',
  'territorio-label-dist',
] as const

function addBefore(
  map: mapboxgl.Map,
  layer: mapboxgl.AddLayerObject,
  beforeId: string,
) {
  map.addLayer(layer, beforeId)
}

export function territorioSimuladoLayersPresent(map: mapboxgl.Map): boolean {
  return Boolean(map.getSource('territorio-simulado'))
}

export function addTerritorioSimuladoLayers(
  map: mapboxgl.Map,
  beforeId: string,
  data?: TerritorioSimuladoFeatureCollection,
) {
  if (territorioSimuladoLayersPresent(map)) return

  const fc = data ?? loadTerritorioSimuladoData()
  map.addSource('territorio-simulado', {
    type: 'geojson',
    data: fc as mapboxgl.GeoJSONFeatureCollection,
  })

  const poly = (t: string) =>
    ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'type'], t]] as mapboxgl.ExpressionSpecification

  const ferroviaFilter: mapboxgl.ExpressionSpecification = [
    '==',
    ['get', 'type'],
    'ferrovia',
  ]

  addBefore(map, {
    id: 'territorio-uc-us-fill',
    type: 'fill',
    source: 'territorio-simulado',
    filter: poly('uc_us'),
    paint: {
      'fill-color': 'rgba(0, 180, 80, 0.12)',
      'fill-opacity': 1,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-uc-us-line',
    type: 'line',
    source: 'territorio-simulado',
    filter: poly('uc_us'),
    paint: {
      'line-color': 'rgba(0, 180, 80, 0.8)',
      'line-width': 2,
      'line-dasharray': [8, 4],
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-uc-pi-fill',
    type: 'fill',
    source: 'territorio-simulado',
    filter: poly('uc_pi'),
    paint: {
      'fill-color': 'rgba(0, 180, 80, 0.20)',
      'fill-opacity': 1,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-uc-pi-line',
    type: 'line',
    source: 'territorio-simulado',
    filter: poly('uc_pi'),
    paint: {
      'line-color': 'rgba(0, 180, 80, 0.9)',
      'line-width': 2.5,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-ti-fill',
    type: 'fill',
    source: 'territorio-simulado',
    filter: poly('ti'),
    paint: {
      'fill-color': 'rgba(230, 70, 40, 0.25)',
      'fill-opacity': 1,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-ti-line',
    type: 'line',
    source: 'territorio-simulado',
    filter: poly('ti'),
    paint: {
      'line-color': 'rgba(230, 70, 40, 0.9)',
      'line-width': 2.5,
      'line-dasharray': [6, 3],
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-quilombola-fill',
    type: 'fill',
    source: 'territorio-simulado',
    filter: poly('quilombola'),
    paint: {
      'fill-color': 'rgba(230, 170, 40, 0.20)',
      'fill-opacity': 1,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-quilombola-line',
    type: 'line',
    source: 'territorio-simulado',
    filter: poly('quilombola'),
    paint: {
      'line-color': 'rgba(230, 170, 40, 0.9)',
      'line-width': 2.5,
      'line-dasharray': [5, 3],
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-ferrovia-line-shadow',
    type: 'line',
    source: 'territorio-simulado',
    filter: ferroviaFilter,
    paint: {
      'line-color': 'rgba(0, 0, 0, 0.5)',
      'line-width': 4,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-ferrovia-line-base',
    type: 'line',
    source: 'territorio-simulado',
    filter: ferroviaFilter,
    paint: {
      'line-color': 'rgba(255, 255, 255, 0.7)',
      'line-width': 2,
    },
  }, beforeId)

  const distFilter: mapboxgl.ExpressionSpecification = [
    '==',
    ['get', 'type'],
    'distancia',
  ]

  addBefore(map, {
    id: 'territorio-distancia-line-shadow',
    type: 'line',
    source: 'territorio-simulado',
    filter: distFilter,
    paint: {
      'line-color': 'rgba(0, 0, 0, 0.5)',
      'line-width': 3.5,
      'line-dasharray': [8, 5],
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-distancia-line',
    type: 'line',
    source: 'territorio-simulado',
    filter: distFilter,
    paint: {
      'line-color': 'rgba(255, 255, 255, 0.9)',
      'line-width': 1.5,
      'line-dasharray': [8, 5],
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-label-area',
    type: 'symbol',
    source: 'territorio-simulado',
    filter: ['==', ['get', 'type'], 'label_area'],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-font': TEXT_FONT,
      'text-anchor': 'center',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 2.5,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-label-ferrovia',
    type: 'symbol',
    source: 'territorio-simulado',
    filter: ferroviaFilter,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-size': 10,
      'text-font': TEXT_FONT,
      'text-rotation-alignment': 'map',
      'text-offset': [1.5, 0],
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 2.5,
    },
  }, beforeId)

  addBefore(map, {
    id: 'territorio-label-dist',
    type: 'symbol',
    source: 'territorio-simulado',
    filter: ['==', ['get', 'type'], 'label_dist'],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-font': TEXT_FONT,
      'text-anchor': 'center',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 2.5,
      'text-halo-blur': 0.5,
    },
  }, beforeId)
}

export function syncTerritorioSimuladoVisibility(
  map: mapboxgl.Map,
  visible: boolean,
) {
  const vis = visible ? 'visible' : 'none'
  for (const id of TERRITORIO_SIMULADO_LAYER_IDS) {
    if (!map.getLayer(id)) continue
    map.setLayoutProperty(id, 'visibility', vis)
  }
}
