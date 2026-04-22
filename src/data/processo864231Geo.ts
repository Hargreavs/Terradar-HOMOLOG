/**
 * Geometria única do processo 864.231/2017 (SIGMINE REST API, EPSG:4674).
 * Usada pelo mapa (polígono verde) e pelas linhas de território simulado (origem = centróide).
 */

/** Anel exterior [lng, lat]; primeiro e último vértices coincidem. */
export const POLIGONO_864231_RING: [number, number][] = [
  [-48.797193332999939, -12.826651666999908],
  [-48.797193332999939, -12.862808610999934],
  [-48.834044721999931, -12.862805832999925],
  [-48.834039443999927, -12.826648888999955],
  [-48.797193332999939, -12.826651666999908],
]

/**
 * Centróide simples (média dos vértices únicos do anel; exclui fecho duplicado).
 */
export function centroidLngLatFromPolygonRing(
  ring: [number, number][],
): [number, number] {
  const n = ring.length
  if (n < 3) {
    return ring[0] ?? [0, 0]
  }
  const last = ring[n - 1]
  const first = ring[0]
  const closedDup =
    Math.abs(last[0] - first[0]) < 1e-12 &&
    Math.abs(last[1] - first[1]) < 1e-12
  const count = closedDup ? n - 1 : n
  let slng = 0
  let slat = 0
  for (let i = 0; i < count; i++) {
    slng += ring[i][0]
    slat += ring[i][1]
  }
  return [slng / count, slat / count]
}

/** Centro do polígono real do 864.231/2017 — origem das linhas de distância (mesmo que o mapa). */
export const PROCESSO_864231_CENTROIDE_LNG_LAT: [number, number] =
  centroidLngLatFromPolygonRing(POLIGONO_864231_RING)
