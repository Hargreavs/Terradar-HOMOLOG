import type { FiltrosState, Regime } from '../types'

const REGIMES_TODOS: Regime[] = [
  'requerimento_pesquisa',
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'lavra_garimpeira',
  'registro_extracao',
  'disponibilidade',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
]

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
