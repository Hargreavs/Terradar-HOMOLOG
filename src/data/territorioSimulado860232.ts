/**
 * Overlays territoriais simulados para o processo 860.232/1990 (TERRADAR).
 * Persistência base em `localStorage` (`terradar_territorio_860232`).
 * Linhas de distância são calculadas em runtime a partir do centróide do polígono na source `processos`.
 */

import type { Feature, FeatureCollection, Geometry } from 'geojson'

import { createRectanglePolygon } from './territorioSimulado'

/** Bump quando mudar geometria (retângulos vs círculos, etc.). */
export const TERRADAR_TERRITORIO_860232_KEY = 'terradar_territorio_860232_v2'

export type Territorio860232GeomType =
  | 'apa'
  | 'rppn'
  | 'quilombola'
  | 'ti'
  | 'br010'
  | 'fiol'
  | 'porto'
  | 'distancia'

export type Territorio860232LabelType = 'label_area' | 'label_dist'

export type Territorio860232FeatureType =
  | Territorio860232GeomType
  | Territorio860232LabelType

export type Territorio860232DistLink = 'quilombola' | 'rppn' | 'apa' | 'porto'

export interface Territorio860232Props {
  type: Territorio860232FeatureType
  name: string
  distancia_km: number
  label: string
  /** Cor das linhas de distância / rótulos km (ligação ao destino). */
  dist_link?: Territorio860232DistLink
}

export type Territorio860232FeatureCollection = FeatureCollection<
  Geometry,
  Territorio860232Props
>

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): [number, number] {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-22) return [ax, ay]
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return [ax + t * dx, ay + t * dy]
}

/** Ponto na borda do retângulo (widthKm E-W, heightKm N-S) mais próximo do processo. */
export function nearestPointOnRectangleBorderKm(
  centerLat: number,
  centerLng: number,
  widthKm: number,
  heightKm: number,
  procLat: number,
  procLng: number,
): [number, number] {
  const KM_PER_DEG_LAT = 111.32
  const latRad = (centerLat * Math.PI) / 180
  const halfLat = heightKm / 2 / KM_PER_DEG_LAT
  const halfLng = widthKm / 2 / (KM_PER_DEG_LAT * Math.cos(latRad))
  const north = centerLat + halfLat
  const south = centerLat - halfLat
  const east = centerLng + halfLng
  const west = centerLng - halfLng
  const edges: [number, number, number, number][] = [
    [west, north, east, north],
    [east, north, east, south],
    [east, south, west, south],
    [west, south, west, north],
  ]
  let bestLng = west
  let bestLat = north
  let bestD2 = Infinity
  for (const [ax, ay, bx, by] of edges) {
    const [qx, qy] = closestPointOnSegment(procLng, procLat, ax, ay, bx, by)
    const d2 = (qx - procLng) ** 2 + (qy - procLat) ** 2
    if (d2 < bestD2) {
      bestD2 = d2
      bestLng = qx
      bestLat = qy
    }
  }
  return [bestLng, bestLat]
}

function poly(
  ring: number[][],
  type: Territorio860232GeomType,
  name: string,
  distancia_km: number,
  label: string,
): Feature<Geometry, Territorio860232Props> {
  return {
    type: 'Feature',
    properties: { type, name, distancia_km, label },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

function line(
  coordinates: [number, number][],
  type: Territorio860232GeomType,
  name: string,
  distancia_km: number,
  label: string,
): Feature<Geometry, Territorio860232Props> {
  return {
    type: 'Feature',
    properties: { type, name, distancia_km, label },
    geometry: { type: 'LineString', coordinates },
  }
}

function point(
  lng: number,
  lat: number,
  type: Territorio860232GeomType | Territorio860232LabelType,
  name: string,
  distancia_km: number,
  label: string,
): Feature<Geometry, Territorio860232Props> {
  return {
    type: 'Feature',
    properties: { type, name, distancia_km, label },
    geometry: { type: 'Point', coordinates: [lng, lat] },
  }
}

function midPoint(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function fmtKm(n: number): string {
  return n.toFixed(1).replace('.', ',') + ' km'
}

/**
 * Base persistível (sem linhas `distancia` nem `label_dist`).
 * O anel do processo é incluído só para referência; o mapa usa o polígono real em `processos`.
 */
export function buildTerritorioSimulado860232Base(): Territorio860232FeatureCollection {
  /** Equivalente visual ~ao raio anterior: caixas E-W × N-S em km. */
  const quilRing = createRectanglePolygon(-12.1, -47.5, 30, 30).coordinates[0]
  const rppnRing = createRectanglePolygon(-11.2, -47.05, 16, 16).coordinates[0]
  const apaRing = createRectanglePolygon(-12.05, -48.55, 50, 50).coordinates[0]
  const tiRing = createRectanglePolygon(-9.9, -48.3, 60, 60).coordinates[0]

  const br010: [number, number][] = [
    [-47.8, -11.0],
    [-47.76, -11.4],
    [-47.75, -11.55],
    [-47.7, -12.0],
  ]

  const fiol: [number, number][] = [
    [-49.0, -12.2],
    [-47.8, -12.0],
    [-46.9, -11.8],
  ]

  const portoLng = -48.42
  const portoLat = -10.71

  const features: Feature<Geometry, Territorio860232Props>[] = [
    poly(
      quilRing,
      'quilombola',
      'Quilombola LAJEADO',
      67.3,
      'Quilombola LAJEADO',
    ),
    poly(
      rppnRing,
      'rppn',
      'RPPN Fazenda Minnehaha',
      75.8,
      'RPPN Fazenda Minnehaha',
    ),
    poly(
      apaRing,
      'apa',
      'APA Lago de Peixe/Angical',
      81.1,
      'APA Lago de Peixe/Angical',
    ),
    poly(tiRing, 'ti', 'TI Xerente', 203.2, 'TI Xerente'),
    line(
      br010,
      'br010',
      'BR-010',
      0,
      'BR-010',
    ),
    line(
      fiol,
      'fiol',
      'FIOL',
      82.9,
      'FIOL (Estudo) - 82,9 km',
    ),
    point(portoLng, portoLat, 'porto', 'Porto Nacional', 123.5, 'Porto Nacional'),
    point(-47.5, -12.1, 'label_area', 'Quilombola LAJEADO', 67.3, 'Quilombola LAJEADO'),
    point(-47.05, -11.2, 'label_area', 'RPPN Fazenda Minnehaha', 75.8, 'RPPN Fazenda Minnehaha'),
    point(-48.55, -12.05, 'label_area', 'APA Lago de Peixe/Angical', 81.1, 'APA Lago de Peixe/Angical'),
    point(-48.3, -9.9, 'label_area', 'TI Xerente', 203.2, 'TI Xerente'),
    point(
      portoLng,
      portoLat,
      'label_area',
      'Porto Nacional',
      123.5,
      'Porto Nacional - 123,5 km',
    ),
  ]

  return { type: 'FeatureCollection', features }
}

export function appendDistanciaFeatures(
  base: Territorio860232FeatureCollection,
  centroidLngLat: [number, number],
): Territorio860232FeatureCollection {
  const [procLng, procLat] = centroidLngLat

  const portoLng = -48.42
  const portoLat = -10.71

  const bQuil = nearestPointOnRectangleBorderKm(
    -12.1,
    -47.5,
    30,
    30,
    procLat,
    procLng,
  )
  const bRppn = nearestPointOnRectangleBorderKm(
    -11.2,
    -47.05,
    16,
    16,
    procLat,
    procLng,
  )
  const bApa = nearestPointOnRectangleBorderKm(
    -12.05,
    -48.55,
    50,
    50,
    procLat,
    procLng,
  )

  const distSpecs: {
    dest: [number, number]
    km: number
    name: string
    dist_link: Territorio860232DistLink
  }[] = [
    { dest: bQuil, km: 67.3, name: 'Quilombola LAJEADO', dist_link: 'quilombola' },
    { dest: bRppn, km: 75.8, name: 'RPPN Minnehaha', dist_link: 'rppn' },
    { dest: bApa, km: 81.1, name: 'APA Lago Peixe/Angical', dist_link: 'apa' },
    { dest: [portoLng, portoLat], km: 123.5, name: 'Porto Nacional', dist_link: 'porto' },
  ]

  const origin: [number, number] = [procLng, procLat]
  const extra: Feature<Geometry, Territorio860232Props>[] = []

  for (const s of distSpecs) {
    const coords: [number, number][] = [origin, s.dest]
    extra.push({
      type: 'Feature',
      properties: {
        type: 'distancia',
        name: s.name,
        distancia_km: s.km,
        label: fmtKm(s.km),
        dist_link: s.dist_link,
      },
      geometry: { type: 'LineString', coordinates: coords },
    })
    const m = midPoint(origin, s.dest)
    extra.push({
      type: 'Feature',
      properties: {
        type: 'label_dist',
        name: s.name,
        distancia_km: s.km,
        label: fmtKm(s.km),
        dist_link: s.dist_link,
      },
      geometry: { type: 'Point', coordinates: [m[0], m[1]] },
    })
  }

  const withoutOld = base.features.filter(
    (f) =>
      (f.properties as Territorio860232Props | undefined)?.type !==
        'distancia' &&
      (f.properties as Territorio860232Props | undefined)?.type !== 'label_dist',
  )

  return {
    type: 'FeatureCollection',
    features: [...withoutOld, ...extra],
  }
}

export function loadTerritorioSimulado860232Data(): Territorio860232FeatureCollection {
  if (typeof window === 'undefined' || !window.localStorage) {
    return buildTerritorioSimulado860232Base()
  }
  try {
    const raw = window.localStorage.getItem(TERRADAR_TERRITORIO_860232_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Territorio860232FeatureCollection
      if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed
      }
    }
  } catch {
    /* fallback */
  }
  const built = buildTerritorioSimulado860232Base()
  try {
    window.localStorage.setItem(
      TERRADAR_TERRITORIO_860232_KEY,
      JSON.stringify(built),
    )
  } catch {
    /* ignore */
  }
  return built
}
