import type { Processo } from '../types'

/** Fractional padding around bbox (~17.5% each side). */
const BBOX_PAD = 0.175

const STROKE = '#F5A623'
const MAPBOX_STATIC_MAX = 1280

function flattenCoords(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): [number, number][] {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    if (!ring?.length) return []
    return ring.map((c) => [c[0]!, c[1]!] as [number, number])
  }
  const out: [number, number][] = []
  for (const polygon of geometry.coordinates) {
    const exterior = polygon[0]
    if (!exterior?.length) continue
    for (const c of exterior) {
      out.push([c[0]!, c[1]!] as [number, number])
    }
  }
  return out
}

function bboxForCoords(
  coords: [number, number][],
): [number, number, number, number] | null {
  if (!coords.length) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of coords) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }
  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return null
  }
  return [minLon, minLat, maxLon, maxLat]
}

function expandBbox(
  box: [number, number, number, number],
  pad: number,
): [number, number, number, number] {
  const [minLon, minLat, maxLon, maxLat] = box
  let w = maxLon - minLon
  let h = maxLat - minLat
  if (w <= 0) w = 1e-6
  if (h <= 0) h = 1e-6
  const px = w * pad
  const py = h * pad
  return [minLon - px, minLat - py, maxLon + px, maxLat + py]
}

function pickImageSize(
  box: [number, number, number, number],
): { w: number; h: number } {
  const [minLon, minLat, maxLon, maxLat] = box
  const bw = Math.max(maxLon - minLon, 1e-8)
  const bh = Math.max(maxLat - minLat, 1e-8)
  const ar = bw / bh
  let w: number
  let h: number
  if (ar >= 1024 / 768) {
    w = Math.min(1024, MAPBOX_STATIC_MAX)
    h = Math.round(w / ar)
  } else {
    h = Math.min(768, MAPBOX_STATIC_MAX)
    h = Math.max(h, 1)
    w = Math.round(h * ar)
  }
  w = Math.min(Math.max(w, 1), MAPBOX_STATIC_MAX)
  h = Math.min(Math.max(h, 1), MAPBOX_STATIC_MAX)
  return { w, h }
}

/**
 * Mapbox Static Images API (satellite-v9) with GeoJSON overlay.
 * @returns null if geometry or token invalid.
 */
export function gerarUrlSateliteParaProcesso(
  processo: Pick<Processo, 'geojson'>,
  options?: { accessToken?: string; cacheBust?: string },
): string | null {
  const token =
    options?.accessToken ??
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)
  if (token == null || String(token).trim() === '') return null

  const rawWide = processo.geojson?.geometry as
    | GeoJSON.Polygon
    | GeoJSON.MultiPolygon
    | undefined
    | null
  if (rawWide == null) return null
  if (rawWide.type !== 'Polygon' && rawWide.type !== 'MultiPolygon') {
    return null
  }
  const raw = rawWide

  const coords = flattenCoords(raw)
  const rawBox = bboxForCoords(coords)
  if (!rawBox) return null

  const box = expandBbox(rawBox, BBOX_PAD)
  const { w, h } = pickImageSize(box)

  const feature: GeoJSON.Feature = {
    type: 'Feature',
    properties: {
      stroke: STROKE,
      'stroke-width': 3,
      fill: STROKE,
      'fill-opacity': 0.2,
    },
    geometry: raw,
  }

  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [feature],
  }

  const encoded = encodeURIComponent(JSON.stringify(collection))
  const overlay = `geojson(${encoded})`
  const [west, south, east, north] = box
  const bboxPath = `[${west},${south},${east},${north}]`

  let url =
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${overlay}/${bboxPath}/${w}x${h}?access_token=${encodeURIComponent(token)}`

  if (options?.cacheBust != null && options.cacheBust !== '') {
    url += `&_=${encodeURIComponent(options.cacheBust)}`
  }
  return url
}
