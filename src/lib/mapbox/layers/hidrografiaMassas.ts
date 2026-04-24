import type { FillLayerSpecification, LineLayerSpecification } from 'mapbox-gl'

export const hidrografiaMassasFillLayer: FillLayerSpecification = {
  id: 'api-hidro-massa-fill',
  type: 'fill',
  source: 'api-hidro-massa-src',
  paint: {
    'fill-color': '#5AB4E8',
    'fill-opacity': 0.25,
  },
}

export const hidrografiaMassasLineLayer: LineLayerSpecification = {
  id: 'api-hidro-massa-line',
  type: 'line',
  source: 'api-hidro-massa-src',
  paint: {
    'line-color': '#1E6091',
    'line-width': 0.8,
    'line-opacity': 0.7,
  },
}
