// Mini-bar width in percent (0-100) for progress DOM nodes.
export function clampBarPct(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}
