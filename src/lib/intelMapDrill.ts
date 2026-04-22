import mapboxgl from 'mapbox-gl'
import type { FiltrosState, Processo } from '../types'

export function fingerprintDrillFiltros(
  f: FiltrosState,
  intelTitularFilter: string | null,
): string {
  const regimeKeys = Object.keys(f.camadas).sort() as (keyof typeof f.camadas)[]
  const cam: Record<string, boolean> = {}
  for (const k of regimeKeys) {
    cam[String(k)] = f.camadas[k]
  }
  return JSON.stringify({
    cam,
    substancias: [...f.substancias].sort(),
    uf: f.uf,
    municipio: f.municipio,
    periodo: f.periodo,
    riskScoreMin: f.riskScoreMin,
    riskScoreMax: f.riskScoreMax,
    searchQuery: f.searchQuery,
    exibirProcessosAtivos: f.exibirProcessosAtivos,
    exibirProcessosInativos: f.exibirProcessosInativos,
    intelTitularFilter: intelTitularFilter ?? '',
  })
}

export function cloneFiltrosState(f: FiltrosState): FiltrosState {
  return {
    ...f,
    camadas: { ...f.camadas },
    substancias: [...f.substancias],
    periodo: [f.periodo[0], f.periodo[1]],
  }
}

/** Brasil continental aproximado (alinha a maxBounds do MapView). */
export const BRAZIL_BOUNDS_LNG_LAT: [[number, number], [number, number]] = [
  [-73.5, -33.75],
  [-34.8, 5.3],
]

export function boundsFromProcessos(processos: Processo[]): mapboxgl.LngLatBounds | null {
  const b = new mapboxgl.LngLatBounds()
  let n = 0
  for (const p of processos) {
    const coords = p.geojson?.geometry?.coordinates?.[0]
    if (!coords?.length) continue
    for (const pt of coords) {
      const lng = pt[0]
      const lat = pt[1]
      if (typeof lng === 'number' && typeof lat === 'number') {
        b.extend([lng, lat])
        n++
      }
    }
  }
  return n > 0 ? b : null
}

export function boundsFromSingleProcesso(p: Processo): mapboxgl.LngLatBounds | null {
  return boundsFromProcessos([p])
}
