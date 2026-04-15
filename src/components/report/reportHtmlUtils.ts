/** Escape HTML e remove em dash tipográfico da UI (substitui por vírgula). */
export function escapeHtml(raw: string | null | undefined): string {
  const base = raw == null ? '' : String(raw)
  return base
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sanitizeReportText(raw: string | null | undefined): string {
  const base = raw == null ? '' : String(raw)
  const s = base
    .replace(/\u2014/g, ', ')
    .replace(/—/g, ', ')
    .replace(/\bOportunity\b/gi, 'Opportunity')
  return escapeHtml(s)
}

export function paragraphsFromLLM(text: string | null | undefined): string {
  const safe = sanitizeReportText(text)
  if (!safe.trim()) return ''
  const parts = safe.split(/\n\n+/).filter(Boolean)
  if (parts.length <= 1) return `<p>${safe}</p>`
  return parts.map((p) => `<p>${p}</p>`).join('')
}

export function fmtUsdOz(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function fmtMiUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} Mi`
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/**
 * Valor in-situ (interno em USD/ha em escala absoluta) → exibição US$ X Mi/ha.
 * Alinha-se ao motor `buildReportData` (ex.: ~5,86e8 → «586 Mi»).
 */
export function fmtValorInsituUsdMiPerHa(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 Mi'
  return `${(n / 1_000_000).toFixed(0)} Mi`
}

/**
 * CFEM estimada / ha (BRL interno em escala absoluta) → «R$ X,X Mi/ha».
 */
export function fmtCfemEstimadaBrlMiPerHa(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  return `${(n / 1_000_000).toFixed(1)} Mi`
}

/** Logo TERRADAR inline (SVG) para capa, sem dependência de assets externos. */
export function terradarLogoDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48" viewBox="0 0 200 48"><text x="0" y="34" font-family="Georgia,serif" font-size="28" font-weight="600" fill="#D4A843">TERRADAR</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function pageFooter(num: number, total: number): string {
  return `<div class="pf"><span class="brand">TERRADAR</span><span>${num}/${total}</span></div>`
}
