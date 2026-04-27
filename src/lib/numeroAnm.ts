/**
 * Número ANM canônico (formato banco) `NNN.NNN/AAAA`.
 */

function digitos(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Converte entradas como `860232/1990` ou `860.232/1990`
 * para o formato canônico ANM `NNN.NNN/AAAA`.
 */
export function normalizarNumeroANM(input: string): string | null {
  const t = input.trim()
  if (/^\d{3}\.\d{3}\/\d{4}$/.test(t)) return t
  const d = digitos(t)
  if (d.length !== 10) return null
  return `${d.slice(0, 3)}.${d.slice(3, 6)}/${d.slice(6)}`
}
