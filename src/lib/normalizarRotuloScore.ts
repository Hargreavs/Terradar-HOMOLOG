// Normalizes DB labels for UI/PDF: em-dash and stray commas after N/A.
export function normalizarSeparadoresRotuloDb(s: string | null | undefined): string {
  let t = String(s ?? '').trim()
  if (t === '') return t
  t = t.replace(/\u2014/g, ' \u00b7 ')
  t = t.replace(/N\/A\s*,\s*/gi, 'N/A \u00b7 ')
  t = t.replace(/\s+,(\s*,)+/g, ',')
  return t.trim()
}
