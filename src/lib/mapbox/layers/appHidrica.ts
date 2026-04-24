import type { FillLayerSpecification, LineLayerSpecification } from 'mapbox-gl'

export const appHidricaFillLayer: FillLayerSpecification = {
  id: 'api-app-fill',
  type: 'fill',
  source: 'api-app-src',
  paint: {
    'fill-color': '#2E7D5B',
    'fill-opacity': 0.12,
  },
}

export const appHidricaLineLayer: LineLayerSpecification = {
  id: 'api-app-line',
  type: 'line',
  source: 'api-app-src',
  paint: {
    'line-color': '#1B5E3F',
    'line-width': 0.4,
    'line-opacity': 0.4,
  },
}
