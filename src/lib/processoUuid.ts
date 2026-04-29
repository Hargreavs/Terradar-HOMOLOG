/** UUID de processo (Postgres tipo `uuid` em texto). */
export const PROCESSO_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Devolve o ID só se for UUID válido; caso contrário `null` (evita RPCs com número ANM). */
export function parseProcessoUuid(s: unknown): string | null {
  if (s == null) return null
  const t =
    typeof s === 'string' ? s.trim() : typeof s === 'number' ? String(s) : ''
  if (!t) return null
  return PROCESSO_UUID_RE.test(t) ? t : null
}
