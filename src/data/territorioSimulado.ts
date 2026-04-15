/**
 * Overlays territoriais simulados para screenshot / relatório (processo 864.231/2017).
 * Persistidos em `localStorage` pela chave `terradar_territorio_simulado`.
 */

import { PROCESSO_864231_CENTROIDE_LNG_LAT } from './processo864231Geo'

/** Bump ao mudar geometria ou ao desativar overlays simulados (v5: só polígono do processo no mapa). */
export const TERRADAR_TERRITORIO_SIMULADO_KEY = 'terradar_territorio_simulado_v5'

const [PROC_864231_LNG, PROC_864231_LAT] = PROCESSO_864231_CENTROIDE_LNG_LAT

/** Centro do polígono 864.231/2017 (média dos vértices; alinhado ao quadrado verde do mapa). */
export const PROCESSO_864231_REF = {
  lat: PROC_864231_LAT,
  lng: PROC_864231_LNG,
}

export type TerritorioSimuladoGeomType =
  | 'ti'
  | 'uc_pi'
  | 'uc_us'
  | 'quilombola'
  | 'ferrovia'
  | 'distancia'

/** Pontos de rótulo (polígonos / distâncias). */
export type TerritorioSimuladoLabelType = 'label_area' | 'label_dist'

export type TerritorioSimuladoFeatureType =
  | TerritorioSimuladoGeomType
  | TerritorioSimuladoLabelType

export interface TerritorioSimuladoProps {
  type: TerritorioSimuladoFeatureType
  name: string
  distancia_km: number
  label: string
}

export type TerritorioSimuladoFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  TerritorioSimuladoProps
>

/** ~km por grau de latitude (aprox.). */
const KM_PER_DEG_LAT = 111.32

/**
 * Retângulo eixo N-S / L-W (áreas retas; sem círculos).
 * `widthKm` = leste-oeste, `heightKm` = norte-sul.
 */
export function createRectanglePolygon(
  centerLat: number,
  centerLng: number,
  widthKm: number,
  heightKm: number,
): GeoJSON.Polygon {
  const latRad = (centerLat * Math.PI) / 180
  const halfLat = heightKm / 2 / KM_PER_DEG_LAT
  const halfLng = widthKm / 2 / (KM_PER_DEG_LAT * Math.cos(latRad))
  const north = centerLat + halfLat
  const south = centerLat - halfLat
  const east = centerLng + halfLng
  const west = centerLng - halfLng
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
        [west, north],
      ],
    ],
  }
}

// Polígono circular (createCirclePolygon) removido do fluxo — usar createRectanglePolygon para screenshot.

function midPoint(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

/**
 * Garante que toda linha `distancia` parte do centróide do polígono 864.231/2017
 * e realinha rótulos `label_dist` ao ponto médio (útil para dados antigos no localStorage).
 */
function patchDistanciaOrigemCentroide(
  fc: TerritorioSimuladoFeatureCollection,
): TerritorioSimuladoFeatureCollection {
  const origem = PROCESSO_864231_CENTROIDE_LNG_LAT
  const distLines: GeoJSON.LineString[] = []
  for (const f of fc.features) {
    if (f.geometry?.type !== 'LineString') continue
    const props = f.properties as TerritorioSimuladoProps | undefined
    if (props?.type !== 'distancia') continue
    const coords = f.geometry.coordinates
    if (coords.length >= 2) {
      coords[0] = [origem[0], origem[1]]
      distLines.push(f.geometry as GeoJSON.LineString)
    }
  }
  let idx = 0
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Point') continue
    const props = f.properties as TerritorioSimuladoProps | undefined
    if (props?.type !== 'label_dist') continue
    const line = distLines[idx]
    if (line?.coordinates.length >= 2) {
      const m = midPoint(
        line.coordinates[0] as [number, number],
        line.coordinates[1] as [number, number],
      )
      ;(f.geometry as GeoJSON.Point).coordinates = m
    }
    idx += 1
  }
  return fc
}

export function buildTerritorioSimuladoDefault(): TerritorioSimuladoFeatureCollection {
  /**
   * Overlays inventados para screenshot (retângulos TI / UC / quilombola, ferrovia, linhas
   * tracejadas e rótulos de km) — desativados: no mapa fica só o polígono real do processo
   * 864.231/2017 (`POLIGONO_864231_RING` em `processo864231Geo.ts`).
   *
   * Código legado (repor no `features` se precisar de novo):
   *
   * const proc: [number, number] = [...PROCESSO_864231_CENTROIDE_LNG_LAT]
   * const ti = createRectanglePolygon(-13.68, -48.55, 30, 30)
   * const ucPi = createRectanglePolygon(-14.1, -47.65, 60, 60)
   * const ucUs = createRectanglePolygon(-13.1, -50.15, 80, 80)
   * const quil = createRectanglePolygon(-12.75, -47.25, 40, 40)
   * const bordaTi: [number, number] = [-48.55, -13.54]
   * const bordaPn: [number, number] = [-47.82, -13.83]
   * const bordaApa: [number, number] = [-49.79, -12.95]
   * const bordaQuil: [number, number] = [-47.43, -12.73]
   * const ferrovia = ferroviaLineFeature([[-48.38,-12.2], ...])
   * const distancias = [ lineFeature(proc, bordaTi, ...), ... ]
   * features: [
   *   polyFeature(ti, 'ti', 'TI Avá-Canoeiro', ...),
   *   polyFeature(ucPi, 'uc_pi', 'PN Chapada dos Veadeiros', ...),
   *   polyFeature(ucUs, 'uc_us', 'APA Meandros do Rio Araguaia', ...),
   *   polyFeature(quil, 'quilombola', 'Kalunga do Mimoso', ...),
   *   ferrovia, ...label_area..., ...distancias, ...distLabelPoints
   * ]
   */
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

export function loadTerritorioSimuladoData(): TerritorioSimuladoFeatureCollection {
  if (typeof window === 'undefined' || !window.localStorage) {
    return patchDistanciaOrigemCentroide(buildTerritorioSimuladoDefault())
  }
  try {
    const raw = window.localStorage.getItem(TERRADAR_TERRITORIO_SIMULADO_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TerritorioSimuladoFeatureCollection
      if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return patchDistanciaOrigemCentroide(parsed)
      }
    }
  } catch {
    /* fallback */
  }
  const built = patchDistanciaOrigemCentroide(buildTerritorioSimuladoDefault())
  try {
    window.localStorage.setItem(
      TERRADAR_TERRITORIO_SIMULADO_KEY,
      JSON.stringify(built),
    )
  } catch {
    /* ignore quota */
  }
  return built
}
