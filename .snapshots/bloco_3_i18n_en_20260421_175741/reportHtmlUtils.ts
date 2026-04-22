import type { ReportL10n } from './reportL10n'

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
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Espaços estreitos / NBSP: em PDF podem parecer «31anos»; normalizar antes do fix de unidades.
    .replace(/[\u00A0\u202F\u2009]+/g, ' ')
    .replace(/\u2014/g, ' · ')
    .replace(/—/g, ' · ')
    .replace(/\bOportunity\b/gi, 'Opportunity')
    // Número colado a «anos» / «anos em» (inclui «31anos em protocolo»).
    .replace(/(\d+)\s*(anos|meses|dias|semanas|horas|minutos)\b/gi, '$1 $2')
    .replace(/(\d+)(anos\s+em\s+protocolo)/gi, '$1 $2')
    .replace(/(\d+)(anos\b)/gi, '$1 $2')
  return escapeHtml(s)
}

/**
 * Célula «Protocolo» do Sumário Vital: monta texto com espaço ASCII explícito (evita «31anos» por i18n/PDF).
 */
export function formatProtocoloVitalCell(
  protocoloAnos: number | string | null | undefined,
  isTerminal: boolean,
  t: ReportL10n,
): string {
  const ext = isTerminal
    ? t.locale.startsWith('en')
      ? ' (defunct)'
      : ' (extinto)'
    : ''
  const mid = t.locale.startsWith('en') ? t.tblProtocoloAnos : 'anos em protocolo'
  let n: number
  if (typeof protocoloAnos === 'number' && Number.isFinite(protocoloAnos)) {
    n = protocoloAnos
  } else {
    const cleaned = String(protocoloAnos ?? '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/anos.*$/i, '')
      .trim()
      .replace(',', '.')
    n = parseFloat(cleaned)
  }
  const head = Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(protocoloAnos ?? '').trim()
  const assembled = `${head}\u0020${mid}${ext}`
  return sanitizeReportText(assembled)
}

export function paragraphsFromLLM(text: string | null | undefined): string {
  const safe = sanitizeReportText(text)
  if (!safe.trim()) return ''
  const parts = safe.split(/\n\n+/).filter(Boolean)
  if (parts.length <= 1) return `<p>${safe}</p>`
  return parts.map((p) => `<p>${p}</p>`).join('')
}

export function fmtUsdOz(n: number, locale: string): string {
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
/**
 * URL da logomarca TERRADAR usada na capa do PDF. Retorna absoluta quando possível para
 * sobreviver à renderização em iframe (document.open/write apaga baseURI em alguns navegadores).
 */
export function terradarLogoDataUri(): string {
  const rel = '/terradar-navbar-dark.png'
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${rel}`
  }
  return rel
}

export function pageFooter(num: number, total: number): string {
  return `<div class="pf"><span class="brand">TERRADAR</span><span>${num}/${total}</span></div>`
}

/**
 * Formata valor numérico para exibição em PDF/prompt. Retorna placeholder
 * seguro (ex: "N/D" ou "—") quando valor é null/undefined/NaN/0.
 *
 * IMPORTANTE: Depois do Bloco 3a, scores podem ser null. Este helper
 * garante que nada renderize como "null" literal ou como "0/100".
 *
 * @param v valor possivelmente nullable
 * @param placeholder texto quando ausente (default "N/D")
 * @returns string formatada ou placeholder
 */
export function nzFmt(v: number | null | undefined, placeholder = 'N/D'): string {
  if (v === null || v === undefined) return placeholder
  if (typeof v !== 'number' || !Number.isFinite(v)) return placeholder
  // Nota: zero é considerado ausente para scores (score=0 é invenção).
  // Se precisar exibir zero legítimo em outro contexto, usar nzFmtAllowZero.
  if (v === 0) return placeholder
  return String(v)
}

/**
 * Variante para valor que pode ser zero legítimo (ex: distâncias, alíquotas).
 * Só retorna placeholder quando null/undefined/NaN.
 */
export function nzFmtAllowZero(v: number | null | undefined, placeholder = 'N/D'): string {
  if (v === null || v === undefined) return placeholder
  if (typeof v !== 'number' || !Number.isFinite(v)) return placeholder
  return String(v)
}

/**
 * Unidade de mercado de uma substância (vinda de master_substancias.unidade_mercado).
 * Canônica interna é sempre USD/t; esta é só para exibição.
 */
export type UnidadeMercado = 'oz' | 'ct' | 'kg' | 'lb' | 't' | 'L'

/**
 * Converte preço canônico USD/t para a unidade de mercado adequada
 * e formata como string.
 *
 * Tabela de conversão:
 * - 1 troy oz = 31,1034768 g → 1 t = 32.150,7466 oz
 * - 1 ct = 0,2 g → 1 t = 5.000.000 ct
 * - 1 kg = 0,001 t → 1 t = 1.000 kg
 * - 1 lb (avoirdupois) = 0,4535924 kg → 1 t = 2.204,6226 lb
 * - 1 L ≈ 1 kg para água pura (simplificação)
 *
 * @param precoUsdPorT preço canônico em USD/t (do DB)
 * @param unidade unidade de mercado de destino
 * @param lang idioma ('pt' usa vírgula decimal, 'en' usa ponto)
 * @returns string tipo "USD 4.862,71/oz" ou "USD 4,862.71/oz"
 */
export function exibirPreco(
  precoUsdPorT: number | null | undefined,
  unidade: UnidadeMercado | null | undefined,
  lang: 'pt' | 'en' = 'pt',
): string {
  if (
    precoUsdPorT === null ||
    precoUsdPorT === undefined ||
    !Number.isFinite(precoUsdPorT) ||
    precoUsdPorT <= 0
  ) {
    return lang === 'en' ? 'N/A' : 'N/D'
  }
  const u = unidade ?? 't'

  let valor: number
  switch (u) {
    case 'oz': valor = precoUsdPorT / 32150.7466; break
    case 'ct': valor = precoUsdPorT / 5000000; break
    case 'kg': valor = precoUsdPorT / 1000; break
    case 'lb': valor = precoUsdPorT / 2204.6226; break
    case 'L':  valor = precoUsdPorT / 1000; break
    case 't':
    default:   valor = precoUsdPorT
  }

  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const fractionDigits = valor < 10000 ? 2 : 0
  const formatted = valor.toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

  return `USD ${formatted}/${u}`
}
