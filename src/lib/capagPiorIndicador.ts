/**
 * Pior nota entre indicadores CAPAG parciais (TERRADAR, alinhado ao motor do relatório).
 */

export function piorIndicadorCapag(
  endivN: string,
  poupN: string,
  liqN: string,
): { letra: string; indicador: string } {
  const rank: Record<string, number> = { D: 4, C: 3, B: 2, A: 1 }
  const norm = (s: string): string | null => {
    const u = String(s).replace(/[–−]/g, '-').trim().toUpperCase()
    if (!u || u === 'N.D.' || u === 'N.E.' || u === '–' || u === '-') return null
    if (u in rank) return u
    return null
  }
  const items = [
    { name: 'endividamento', letra: norm(endivN) },
    { name: 'poupança corrente', letra: norm(poupN) },
    { name: 'liquidez', letra: norm(liqN) },
  ].filter((x): x is { name: string; letra: string } => Boolean(x.letra))
  if (!items.length) return { letra: 'n.d.', indicador: 'indicadores' }
  let worst = items[0]!
  for (const it of items) {
    if (rank[it.letra]! > rank[worst.letra]!) worst = it
  }
  return { letra: worst.letra, indicador: worst.name }
}

/** Frase gramatical para "(determinada …)" no drawer. */
export function fraseDeterminadaPeloIndicadorCapag(nomeIndicador: string): string {
  const n = nomeIndicador.toLowerCase().trim()
  if (n === 'endividamento') return 'pelo endividamento'
  if (n === 'liquidez') return 'pela liquidez'
  if (n === 'poupança corrente' || n.includes('poupan')) {
    return 'pela poupança corrente'
  }
  return `pela ${nomeIndicador}`
}
