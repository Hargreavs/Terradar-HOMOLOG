/**
 * Mapa do Brasil por macrorregião para animação (wizard Prospecção).
 * Paths derivados dos mesmos dados IBGE que `data/brasil-ufs-paths.ts` (malhas estaduais).
 * Licença: dados de geometria alinhados ao uso já existente no Terrae (BrasilMiniMap).
 */

import {
  BRASIL_MINI_VIEWBOX,
  BRASIL_UF_PATH_D,
  BRASIL_UFS_PAINT_ORDER,
} from '../data/brasil-ufs-paths'

function joinPaths(ufs: readonly string[]): string {
  return ufs
    .map((u) => BRASIL_UF_PATH_D[u])
    .filter(Boolean)
    .join(' ')
}

/** Contorno do país: união dos 27 estados (subpaths concatenados). */
export const BRAZIL_OUTLINE = joinPaths(BRASIL_UFS_PAINT_ORDER)

const UF_NORTE = ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] as const
const UF_NORDESTE = ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] as const
const UF_CENTRO_OESTE = ['DF', 'GO', 'MS', 'MT'] as const
const UF_SUDESTE = ['ES', 'MG', 'RJ', 'SP'] as const
const UF_SUL = ['PR', 'RS', 'SC'] as const

/**
 * Centro aproximado de cada macrorregião (bbox dos estados, coordenadas do viewBox fonte).
 * Calculado a partir dos limites numéricos dos paths.
 */
export const BRAZIL_REGIONS = [
  {
    name: 'Norte',
    label: 'N',
    color: '#35B88A',
    path: joinPaths(UF_NORTE),
    cx: 207.586,
    cy: 286.595,
  },
  {
    name: 'Nordeste',
    label: 'NE',
    color: '#D4A843',
    path: joinPaths(UF_NORDESTE),
    cx: 235.475,
    cy: 295.259,
  },
  {
    name: 'Centro-Oeste',
    label: 'CO',
    color: '#9BB8D0',
    path: joinPaths(UF_CENTRO_OESTE),
    cx: 216.918,
    cy: 304.85,
  },
  {
    name: 'Sudeste',
    label: 'SE',
    color: '#C87C5B',
    path: joinPaths(UF_SUDESTE),
    cx: 228.361,
    cy: 311.324,
  },
  {
    name: 'Sul',
    label: 'S',
    color: '#8FAA8D',
    path: joinPaths(UF_SUL),
    cx: 218.406,
    cy: 325.565,
  },
] as const

/** ViewBox original do SVG fonte (mesmo de `BrasilMiniMap`). */
export const BRAZIL_VIEWBOX = BRASIL_MINI_VIEWBOX

/** Centro do mapa no sistema de coordenadas fonte (para normalização opcional). */
export const BRAZIL_MAP_CENTER = { cx: 216.019, cy: 303.634 } as const

const [, , vbW] = BRASIL_MINI_VIEWBOX.split(/\s+/).map(Number)

/** Escala para largura alvo ~300px mantendo proporção do viewBox fonte. */
export const BRAZIL_SCALE_TO_300W = 300 / vbW
