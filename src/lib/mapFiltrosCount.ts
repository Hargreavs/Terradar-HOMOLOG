import { REGIME_LAYER_ORDER } from './regimes'
import type { FiltrosState } from '../types'

const REGIMES_TODOS = REGIME_LAYER_ORDER
/** Número de filtros diferentes do padrão (badge na barra de busca). */
export function countFiltrosAlterados(f: FiltrosState): number {
  let n = 0
  for (const r of REGIMES_TODOS) {
    if (f.camadas[r] === false) n++
  }
  if (f.periodo[0] !== 1960 || f.periodo[1] !== 2026) n++
  if (f.uf !== null) n++
  if (f.municipio && f.municipio.trim()) n++
  n += f.substancias.length
  return n
}
