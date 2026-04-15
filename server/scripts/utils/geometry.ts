/**
 * Converte `geometry.rings` do ArcGIS (SRID 4326) para GeoJSON Polygon.
 * Primeiro anel = exterior; demais = buracos.
 */
export function arcgisRingsToGeoJsonPolygon(
  rings: number[][][] | undefined | null,
): { type: 'Polygon'; coordinates: number[][][] } | null {
  if (!rings?.length) return null
  const coords = rings.map((ring) => {
    if (ring.length === 0) return ring
    const first = ring[0]
    const last = ring[ring.length - 1]
    const closed =
      first &&
      last &&
      first[0] === last[0] &&
      first[1] === last[1]
    const r = closed ? ring : [...ring, first]
    return r.map(([x, y]) => [x, y])
  })
  return { type: 'Polygon', coordinates: coords }
}

/** WKT POLYGON para depuração ou RPC SQL (SRID=4326). */
export function ringsToWKT(rings: number[][][]): string {
  const parts = rings.map((ring) => {
    if (ring.length === 0) return ''
    const first = ring[0]
    const last = ring[ring.length - 1]
    const isClosed =
      ring.length >= 2 && first[0] === last[0] && first[1] === last[1]
    const r = isClosed ? ring : [...ring, first]
    return r.map(([lng, lat]) => `${lng} ${lat}`).join(', ')
  })
  return `POLYGON(${parts.map((p) => `(${p})`).join(', ')})`
}
