type Poly = GeoJSON.Polygon | GeoJSON.MultiPolygon

function ringToD(
  ring: number[][],
  project: (lon: number, lat: number) => [number, number],
): string {
  if (!ring.length) return ''
  const pts = ring.map(([lon, lat]) => project(lon!, lat!))
  const [x0, y0] = pts[0]!
  const rest = pts.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')
  return `M ${x0} ${y0} ${rest} Z`
}

export function PolygonOverlaySvg({
  geometry,
  bbox_usado,
  imagem_largura,
  imagem_altura,
}: {
  geometry: Poly
  bbox_usado: [number, number, number, number]
  imagem_largura: number
  imagem_altura: number
}) {
  const [west, south, east, north] = bbox_usado
  const W = imagem_largura
  const H = imagem_altura
  const lonSpan = Math.max(east - west, 1e-9)
  const latSpan = Math.max(north - south, 1e-9)

  const toXY = (lon: number, lat: number): [number, number] => {
    const x = ((lon - west) / lonSpan) * W
    const y = ((north - lat) / latSpan) * H
    return [x, y]
  }

  const paths: string[] = []
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      paths.push(ringToD(ring, toXY))
    }
  } else {
    for (const poly of geometry.coordinates) {
      const exterior = poly[0]
      if (exterior) paths.push(ringToD(exterior, toXY))
    }
  }

  const d = paths.filter(Boolean).join(' ')

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <path
        d={d}
        fill="rgba(245, 166, 35, 0.08)"
        stroke="#F5A623"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
