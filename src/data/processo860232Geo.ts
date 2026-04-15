/**
 * Geometria aproximada do processo 860.232/1990 (Chapada da Natividade/TO).
 * [lng, lat] EPSG:4674; alinhado ao centro aproximado -11.55, -47.75 (Fazenda Pequizeiro, BR-010 km 208).
 */

import { centroidLngLatFromPolygonRing } from './processo864231Geo'

/** Anel exterior [lng, lat]; primeiro e último vértices coincidem. */
export const POLIGONO_860232_RING: [number, number][] = [
  [-47.82, -11.48],
  [-47.68, -11.48],
  [-47.68, -11.62],
  [-47.82, -11.62],
  [-47.82, -11.48],
]

/** Centróide do polígono (fallback quando a source `processos` ainda não tem o processo). */
export const PROCESSO_860232_CENTROIDE_LNG_LAT: [number, number] =
  centroidLngLatFromPolygonRing(POLIGONO_860232_RING)
