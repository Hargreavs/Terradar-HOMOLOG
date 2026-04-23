import type { FeatureCollectionJson } from '../data/camadas/geoImport'
import type mapboxgl from 'mapbox-gl'

export type CamadaGeoId =
  | 'terras_indigenas'
  | 'unidades_conservacao'
  | 'quilombolas'
  | 'aquiferos'
  | 'ferrovias'
  | 'portos'
  | 'biomas'
  | 'rodovias'
  | 'hidrovias'

/**
 * `app_car` (Áreas de Preservação) — removida temporariamente: sem tabela/ingest no backend.
 * Reintroduzir com ingestão APP (p.ex. ANA BHO) e reativar `geo-src-app_car` + checkboxes.
 */
export const CAMADAS_GEO_ORDER: CamadaGeoId[] = [
  'biomas',
  'aquiferos',
  'terras_indigenas',
  'unidades_conservacao',
  'quilombolas',
  'rodovias',
  'ferrovias',
  'hidrovias',
  'portos',
]

/** Ordem na legenda do mapa (leitura humana; z-order usa `CAMADAS_GEO_ORDER`). */
export const CAMADAS_GEO_LEGEND_ORDER: CamadaGeoId[] = [
  'terras_indigenas',
  'unidades_conservacao',
  'quilombolas',
  'aquiferos',
  'biomas',
  'rodovias',
  'ferrovias',
  'hidrovias',
  'portos',
]

export const CAMADAS_GEO_LABEL: Record<CamadaGeoId, string> = {
  terras_indigenas: 'Terras Indígenas',
  unidades_conservacao: 'Unidades de Conservação',
  quilombolas: 'Quilombolas',
  aquiferos: 'Aquíferos',
  ferrovias: 'Ferrovias',
  portos: 'Portos',
  biomas: 'Biomas',
  rodovias: 'Rodovias',
  hidrovias: 'Hidrovias',
}

export const CAMADAS_GEO_COLOR: Record<CamadaGeoId, string> = {
  terras_indigenas: '#E07A5F',
  unidades_conservacao: '#4A9E4A',
  quilombolas: '#C4915A',
  aquiferos: '#4A90B8',
  ferrovias: '#B8B8B8',
  portos: '#7EADD4',
  biomas: '#8FA668',
  rodovias: '#D9A55B',
  hidrovias: '#5FA8B8',
}

const TEXT_FONT = ['Open Sans Semibold', 'Arial Unicode MS Bold'] as string[]

const POLY_FILTER: mapboxgl.ExpressionSpecification = [
  'any',
  ['==', ['geometry-type'], 'Polygon'],
  ['==', ['geometry-type'], 'MultiPolygon'],
]

const POINT_FILTER: mapboxgl.ExpressionSpecification = ['==', ['geometry-type'], 'Point']

const LINE_FILTER: mapboxgl.ExpressionSpecification = [
  'any',
  ['==', ['geometry-type'], 'LineString'],
  ['==', ['geometry-type'], 'MultiLineString'],
]

function addBefore(
  map: mapboxgl.Map,
  layer: mapboxgl.AddLayerObject,
  beforeId: string,
) {
  map.addLayer(layer, beforeId)
}

/** Layers usados em queryRenderedFeatures para tooltip (sem halo). */
export const CAMADA_GEO_HOVER_LAYER_IDS: string[] = [
  'geo-aquiferos-fill',
  'geo-aquiferos-line',
  'geo-terras_indigenas-fill',
  'geo-terras_indigenas-line',
  'geo-unidades_conservacao-fill',
  'geo-unidades_conservacao-line',
  'geo-quilombolas-fill',
  'geo-quilombolas-line',
  'geo-quilombolas-circle',
  'geo-ferrovias-line',
  'geo-portos-circle',
  // === API layers (16.03 + 16.04a/b/c) ===
  'api-biomas-fill',
  'api-rodovias-line',
  'api-hidrovias-line',
  'api-ti-fill',
  'api-quilombola-fill',
  'api-uc-pi-fill',
  'api-uc-us-fill',
  'api-aquifero-fill',
  'api-ferrovia-line',
  'api-porto-circle',
]

const LAYERS_BY_CAMADA: Record<CamadaGeoId, string[]> = {
  aquiferos: ['geo-aquiferos-fill', 'geo-aquiferos-line', 'geo-aquiferos-label'],
  terras_indigenas: [
    'geo-terras_indigenas-fill',
    'geo-terras_indigenas-line',
    'geo-terras_indigenas-label',
  ],
  unidades_conservacao: [
    'geo-unidades_conservacao-fill',
    'geo-unidades_conservacao-line',
    'geo-unidades_conservacao-label',
  ],
  quilombolas: [
    'geo-quilombolas-fill',
    'geo-quilombolas-line',
    'geo-quilombolas-circle',
    'geo-quilombolas-label',
  ],
  ferrovias: ['geo-ferrovias-halo', 'geo-ferrovias-line', 'geo-ferrovias-label'],
  portos: ['geo-portos-circle', 'geo-portos-label'],
  biomas: [],
  rodovias: [],
  hidrovias: [],
}

export function camadasGeoLayersPresent(map: mapboxgl.Map): boolean {
  return Boolean(map.getSource('geo-src-aquiferos'))
}

export function addCamadasGeoLayers(
  map: mapboxgl.Map,
  beforeId: string,
  data: Record<CamadaGeoId, FeatureCollectionJson>,
) {
  if (camadasGeoLayersPresent(map)) return

  const src = (id: string, fc: FeatureCollectionJson) => {
    map.addSource(id, { type: 'geojson', data: fc as mapboxgl.GeoJSONFeatureCollection })
  }

  const visNone: mapboxgl.Layout = { visibility: 'none' }

  src('geo-src-aquiferos', data.aquiferos)
  addBefore(
    map,
    {
      id: 'geo-aquiferos-fill',
      type: 'fill',
      source: 'geo-src-aquiferos',
      paint: { 'fill-color': '#4A90B8', 'fill-opacity': 0.08 },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-aquiferos-line',
      type: 'line',
      source: 'geo-src-aquiferos',
      paint: {
        'line-color': '#4A90B8',
        'line-opacity': 0.3,
        'line-width': 1,
        'line-dasharray': [8, 4],
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-aquiferos-label',
      type: 'symbol',
      source: 'geo-src-aquiferos',
      filter: ['has', 'nome'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nome'],
        'text-size': 10,
        'text-font': TEXT_FONT,
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#4A90B8',
        'text-halo-color': '#111110',
        'text-halo-width': 1,
      },
    },
    beforeId,
  )

  src('geo-src-terras_indigenas', data.terras_indigenas)
  addBefore(
    map,
    {
      id: 'geo-terras_indigenas-fill',
      type: 'fill',
      source: 'geo-src-terras_indigenas',
      paint: { 'fill-color': '#E07A5F', 'fill-opacity': 0.15 },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-terras_indigenas-line',
      type: 'line',
      source: 'geo-src-terras_indigenas',
      paint: {
        'line-color': '#E07A5F',
        'line-opacity': 0.6,
        'line-width': 1.5,
        'line-dasharray': [4, 2],
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-terras_indigenas-label',
      type: 'symbol',
      source: 'geo-src-terras_indigenas',
      filter: ['has', 'nome'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nome'],
        'text-size': 10,
        'text-font': TEXT_FONT,
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#E07A5F',
        'text-halo-color': '#111110',
        'text-halo-width': 1,
      },
    },
    beforeId,
  )

  src('geo-src-unidades_conservacao', data.unidades_conservacao)
  addBefore(
    map,
    {
      id: 'geo-unidades_conservacao-fill',
      type: 'fill',
      source: 'geo-src-unidades_conservacao',
      paint: { 'fill-color': '#4A9E4A', 'fill-opacity': 0.12 },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-unidades_conservacao-line',
      type: 'line',
      source: 'geo-src-unidades_conservacao',
      paint: {
        'line-color': '#4A9E4A',
        'line-opacity': 0.5,
        'line-width': 1.5,
        'line-dasharray': [6, 3],
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-unidades_conservacao-label',
      type: 'symbol',
      source: 'geo-src-unidades_conservacao',
      filter: ['has', 'nome'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nome'],
        'text-size': 10,
        'text-font': TEXT_FONT,
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#4A9E4A',
        'text-halo-color': '#111110',
        'text-halo-width': 1,
      },
    },
    beforeId,
  )

  src('geo-src-quilombolas', data.quilombolas)
  addBefore(
    map,
    {
      id: 'geo-quilombolas-fill',
      type: 'fill',
      source: 'geo-src-quilombolas',
      filter: POLY_FILTER,
      paint: { 'fill-color': '#C4915A', 'fill-opacity': 0.15 },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-quilombolas-line',
      type: 'line',
      source: 'geo-src-quilombolas',
      filter: POLY_FILTER,
      paint: {
        'line-color': '#C4915A',
        'line-opacity': 0.6,
        'line-width': 1,
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-quilombolas-circle',
      type: 'circle',
      source: 'geo-src-quilombolas',
      filter: POINT_FILTER,
      paint: {
        'circle-radius': 6,
        'circle-color': '#C4915A',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#FFFFFF',
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-quilombolas-label',
      type: 'symbol',
      source: 'geo-src-quilombolas',
      filter: ['has', 'nome'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nome'],
        'text-size': 10,
        'text-font': TEXT_FONT,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
      },
      paint: {
        'text-color': '#C4915A',
        'text-halo-color': '#111110',
        'text-halo-width': 1,
      },
    },
    beforeId,
  )

  src('geo-src-ferrovias', data.ferrovias)
  addBefore(
    map,
    {
      id: 'geo-ferrovias-halo',
      type: 'line',
      source: 'geo-src-ferrovias',
      filter: LINE_FILTER,
      paint: {
        'line-color': '#B8B8B8',
        'line-opacity': 0.15,
        'line-width': 4,
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-ferrovias-line',
      type: 'line',
      source: 'geo-src-ferrovias',
      filter: LINE_FILTER,
      paint: {
        'line-color': '#B8B8B8',
        'line-opacity': 0.7,
        'line-width': 2,
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-ferrovias-label',
      type: 'symbol',
      source: 'geo-src-ferrovias',
      filter: ['has', 'nome'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nome'],
        'text-size': 10,
        'text-font': TEXT_FONT,
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': '#D3D1C7',
        'text-halo-color': '#111110',
        'text-halo-width': 1,
      },
    },
    beforeId,
  )

  src('geo-src-portos', data.portos)
  addBefore(
    map,
    {
      id: 'geo-portos-circle',
      type: 'circle',
      source: 'geo-src-portos',
      paint: {
        'circle-radius': 5,
        'circle-color': '#7EADD4',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#FFFFFF',
      },
      layout: visNone,
    },
    beforeId,
  )
  addBefore(
    map,
    {
      id: 'geo-portos-label',
      type: 'symbol',
      source: 'geo-src-portos',
      filter: ['has', 'nome'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nome'],
        'text-size': 10,
        'text-font': TEXT_FONT,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
      },
      paint: {
        'text-color': '#7EADD4',
        'text-halo-color': '#111110',
        'text-halo-width': 1,
      },
    },
    beforeId,
  )
}

function strProp(p: Record<string, unknown> | null | undefined, k: string): string | null {
  if (!p) return null
  const v = p[k]
  if (v == null) return null
  return String(v)
}

export function camadaGeoIdFromLayerId(layerId: string): CamadaGeoId | null {
  // Camadas API (16.03 / 16.04a-c): prefixo 'api-<tipo>-'
  if (layerId.startsWith('api-')) {
    if (layerId.startsWith('api-ti-')) return 'terras_indigenas'
    if (layerId.startsWith('api-quilombola-')) return 'quilombolas'
    if (layerId.startsWith('api-uc-pi-') || layerId.startsWith('api-uc-us-'))
      return 'unidades_conservacao'
    if (layerId.startsWith('api-aquifero-')) return 'aquiferos'
    if (layerId.startsWith('api-ferrovia-')) return 'ferrovias'
    if (layerId.startsWith('api-porto-')) return 'portos'
    if (layerId.startsWith('api-rodovia-')) return 'rodovias'
    if (layerId.startsWith('api-hidrovia-')) return 'hidrovias'
    if (layerId.startsWith('api-biomas-')) return 'biomas'
    return null
  }

  // Camadas estáticas: prefixo 'geo-<camada>-' (comportamento original, preservado)
  for (const id of CAMADAS_GEO_ORDER) {
    const prefix = `geo-${id}-`
    if (layerId.startsWith(prefix)) return id
  }
  return null
}

export function formatCamadaGeoTooltip(
  layerId: string,
  props: Record<string, unknown> | null | undefined,
): { title: string; meta: string; borderColor: string } | null {
  const camada = camadaGeoIdFromLayerId(layerId)
  if (!camada) return null
  const borderColor = CAMADAS_GEO_COLOR[camada]

  // === RAMO API ===
  // Features vindas de /api/map/layers/:tipo têm contrato { nome, uf, orgao, categoria }
  if (layerId.startsWith('api-')) {
    const nome = strProp(props, 'nome') ?? CAMADAS_GEO_LABEL[camada]
    const uf = strProp(props, 'uf')
    const orgao = strProp(props, 'orgao')
    const categoria = strProp(props, 'categoria')

    const partsApi: string[] = []
    if (categoria) partsApi.push(categoria)
    if (uf) partsApi.push(uf)
    if (orgao) partsApi.push(orgao)

    return {
      title: nome,
      meta: partsApi.join(' · '),
      borderColor,
    }
  }

  // === RAMO ESTÁTICO (código original) ===
  const nome =
    strProp(props, 'nome') ??
    strProp(props, 'tipo') ??
    CAMADAS_GEO_LABEL[camada]
  const parts: string[] = []
  switch (camada) {
    case 'terras_indigenas': {
      const e = strProp(props, 'etnia')
      const s = strProp(props, 'situacao')
      if (e) parts.push(`Etnia: ${e}`)
      if (s) parts.push(s)
      break
    }
    case 'unidades_conservacao': {
      const c = strProp(props, 'categoria')
      const e = strProp(props, 'esfera')
      if (c) parts.push(c)
      if (e) parts.push(e)
      break
    }
    case 'quilombolas': {
      const m = strProp(props, 'municipio')
      const uf = strProp(props, 'uf')
      const s = strProp(props, 'situacao')
      if (m || uf) parts.push([m, uf].filter(Boolean).join(', '))
      if (s) parts.push(s)
      break
    }
    case 'aquiferos': {
      const t = strProp(props, 'tipo')
      const a = strProp(props, 'area_km2')
      if (t) parts.push(t)
      if (a) parts.push(`${Number(a).toLocaleString('pt-BR')} km²`)
      break
    }
    case 'ferrovias': {
      const o = strProp(props, 'operadora')
      const s = strProp(props, 'situacao')
      const ex = strProp(props, 'extensao_km')
      if (o) parts.push(o)
      if (s) parts.push(s)
      if (ex) parts.push(`${ex} km`)
      break
    }
    case 'portos': {
      const m = strProp(props, 'municipio')
      const uf = strProp(props, 'uf')
      const t = strProp(props, 'tipo')
      if (m || uf) parts.push([m, uf].filter(Boolean).join('/'))
      if (t) parts.push(t)
      break
    }
    default:
      break
  }
  return {
    title: nome,
    meta: parts.join(' · '),
    borderColor,
  }
}

export function syncCamadasGeoVisibility(
  map: mapboxgl.Map,
  camadasGeo: Record<CamadaGeoId, boolean>,
) {
  if (!camadasGeoLayersPresent(map)) return
  const vis = (on: boolean) => (on ? 'visible' : 'none')
  for (const id of CAMADAS_GEO_ORDER) {
    const on = camadasGeo[id] === true
    const layers = LAYERS_BY_CAMADA[id]
    for (const lid of layers) {
      if (map.getLayer(lid)) {
        map.setLayoutProperty(lid, 'visibility', vis(on))
      }
    }
  }
}

export function defaultCamadasGeo(): Record<CamadaGeoId, boolean> {
  return {
    terras_indigenas: false,
    unidades_conservacao: false,
    quilombolas: false,
    aquiferos: false,
    ferrovias: false,
    portos: false,
    biomas: false,
    rodovias: false,
    hidrovias: false,
  }
}

export function mergeCamadasGeoPersisted(
  raw: Partial<Record<CamadaGeoId, boolean>> | undefined,
): Record<CamadaGeoId, boolean> {
  const base = defaultCamadasGeo()
  if (!raw || typeof raw !== 'object') return base
  for (const k of CAMADAS_GEO_ORDER) {
    if (typeof raw[k] === 'boolean') base[k] = raw[k]!
  }
  return base
}
