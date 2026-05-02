import { gerarImagemMapbox, type GeradoMapbox } from './mapboxStatic'
import { gerarImagemSentinel2, type GeradoSentinel } from './sentinelHub'

export const THRESHOLD_HA_HIBRIDO = 100

type S2Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

export type GeradoHibrido =
  | (GeradoSentinel & { fonte: 'sentinel-2' })
  | GeradoMapbox

export async function gerarImagemSatelite(
  processoId: string,
  geometry: S2Geometry,
  areaHa: number,
): Promise<GeradoHibrido> {
  if (areaHa < THRESHOLD_HA_HIBRIDO) {
    return await gerarImagemMapbox(processoId, geometry)
  }
  const sentinel = await gerarImagemSentinel2(processoId, geometry)
  return { ...sentinel, fonte: 'sentinel-2' as const }
}
