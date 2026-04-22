/**
 * Normaliza número de processo ANM pro formato canônico NNN.NNN/AAAA
 * com zero-pad à esquerda na parte numérica (6 dígitos sempre).
 *
 * Idempotente: input já formatado passa sem mudança.
 *
 * Exemplos:
 *   "1203/1935"      → "001.203/1935"
 *   "3476/1943"      → "003.476/1943"
 *   "12345/1975"     → "012.345/1975"
 *   "123456/2020"    → "123.456/2020"
 *   "860.366/2014"   → "860.366/2014"  (idempotente)
 *   "001.203/1935"   → "001.203/1935"  (idempotente)
 *   "12345678/2020"  → null            (parte numérica > 6 dígitos, inválido)
 *   ""               → null
 *   "abc"            → null
 *   null/undefined   → null
 */
export function formatNumeroAnm(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d[\d.]*)\s*\/\s*(\d{4})$/)
  if (!match) return null

  const parteLimpa = match[1]!.replace(/\./g, '')
  if (!parteLimpa || parteLimpa.length === 0 || parteLimpa.length > 6)
    return null

  const partePadded = parteLimpa.padStart(6, '0')
  const parteFormatada = `${partePadded.slice(0, 3)}.${partePadded.slice(3)}`

  return `${parteFormatada}/${match[2]}`
}
