/** Bbox aproximado por UF: SW (lat,lng) e NE (lat,lng) → Mapbox [[west,south],[east,north]] */

export const UF_NOME_COMPLETO: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
}

/** [[west, south], [east, north]] em lng/lat */
const UF_BOUNDS_LNG_LAT: Record<string, [[number, number], [number, number]]> = {
  MG: [
    [-51.05, -22.92],
    [-39.86, -14.23],
  ],
  PA: [
    [-58.9, -9.84],
    [-46.06, 2.59],
  ],
  GO: [
    [-53.25, -19.5],
    [-45.91, -12.39],
  ],
  BA: [
    [-46.62, -18.35],
    [-37.34, -8.53],
  ],
  AM: [
    [-73.79, -9.82],
    [-56.1, 2.21],
  ],
  MT: [
    [-61.63, -18.04],
    [-50.22, -7.35],
  ],
}

export function ufBoundsLngLat(uf: string): [[number, number], [number, number]] | null {
  return UF_BOUNDS_LNG_LAT[uf] ?? null
}

export function ufNomeOuSigla(uf: string): string {
  return UF_NOME_COMPLETO[uf] ?? uf
}
