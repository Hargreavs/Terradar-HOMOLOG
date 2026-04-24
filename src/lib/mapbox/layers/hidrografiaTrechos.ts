import type { LineLayerSpecification } from 'mapbox-gl'

export const hidrografiaTrechosLayer: LineLayerSpecification = {
  id: 'api-hidro-trecho-line',
  type: 'line',
  source: 'api-hidro-trecho-src',
  paint: {
    'line-color': '#2E8BC0',
    'line-width': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      ['step', ['get', 'nustrahler'], 0, 7, 0.4, 9, 0.8],
      6,
      ['step', ['get', 'nustrahler'], 0.2, 4, 0.4, 6, 0.8, 8, 1.4],
      8,
      ['step', ['get', 'nustrahler'], 0.3, 3, 0.6, 5, 1.0, 7, 1.8],
      11,
      ['step', ['get', 'nustrahler'], 0.5, 3, 1.0, 5, 1.8, 7, 3.0],
      14,
      ['step', ['get', 'nustrahler'], 1.0, 3, 1.8, 5, 3.0, 7, 5.0],
    ],
    'line-opacity': 0.85,
  },
}
