/**
 * Formatação única para CAPAG (STN) e campos fiscais no drawer e no PDF.
 * Indicadores CAPAG no XLSX podem vir como ratio decimal (ex.: 0,1613 → 16,13%) ou já como percentual.
 */

/** Número pt-BR flexível (ex.: "1.473.296,86", "0,1613", "16,13%", "0.1613" decimal EN). */
export function parsePtBrNumeroFlex(raw: string): number | null {
  const t = String(raw).trim().replace(/%/g, '')
  if (!t || /^n\.?d\.?$/i.test(t) || /^n\.?e\.?$/i.test(t)) return null
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t)
  const s = t.replace(/\s/g, '')
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let norm: string
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      norm = s.replace(/\./g, '').replace(',', '.')
    } else {
      norm = s.replace(/,/g, '')
    }
  } else if (lastComma > -1) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1]!.length <= 2) {
      norm = s.replace(/\./g, '').replace(',', '.')
    } else {
      norm = s.replace(/,/g, '')
    }
  } else {
    norm = s.replace(/\./g, '')
  }
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/**
 * Converte ratio STN ou percentual já elevado para exibição «XX,XX%».
 * Ratios oficiais são &lt; 5 (ex.: 0,1613 ou 0,9992); percentuais já elevados (≥ 5) não multiplicam.
 */
function ratioOuPercentParaExibicao(n: number): number {
  return Math.abs(n) < 5 ? n * 100 : n
}

/**
 * Indicador CAPAG (STN): aceita número (Postgres numeric/json), texto com sufixo (A), ou n.d./n.e.
 */
export function formatCapagIndicadorPercentual(raw: unknown): {
  texto: string
  notaLetra: string
} {
  if (raw === null || raw === undefined) {
    return { texto: 'n.d.', notaLetra: '–' }
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const asPct = ratioOuPercentParaExibicao(raw)
    const texto = `${asPct.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`
    return { texto, notaLetra: '–' }
  }

  const s = String(raw).trim()
  if (!s) return { texto: 'n.d.', notaLetra: '–' }
  const low = s.toLowerCase()
  if (low === 'n.d.' || low === 'n.d' || low === 'nd')
    return { texto: 'n.d.', notaLetra: '–' }
  if (low === 'n.e.' || low === 'n.e' || low === 'ne')
    return { texto: 'n.e.', notaLetra: '–' }

  const notaPar = /\(([ABCD])\)\s*$/i.exec(s)
  const notaLetra = notaPar ? notaPar[1]!.toUpperCase() : '–'
  const semPar = notaPar ? s.slice(0, notaPar.index).trim() : s

  const n = parsePtBrNumeroFlex(semPar)
  if (n == null) return { texto: s, notaLetra }

  const asPct = ratioOuPercentParaExibicao(n)
  const texto = `${asPct.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
  return { texto, notaLetra }
}

/**
 * Usa colunas `indicador_n` (ratio) quando preenchidas; senão `endividamento` / `poupanca` / `liquidez` texto.
 * `nota_n` no BD prevalece sobre o sufixo «(A)» no texto.
 */
export function capagIndicadorResolvido(
  capag: Record<string, unknown> | null | undefined,
  opts: {
    indicadorNum: 'indicador_1' | 'indicador_2' | 'indicador_3'
    indicadorStr: 'endividamento' | 'poupanca' | 'liquidez'
    notaCol: 'nota_1' | 'nota_2' | 'nota_3'
  },
): { texto: string; notaLetra: string } {
  if (!capag) return { texto: 'n.d.', notaLetra: '–' }
  const nRaw = capag[opts.indicadorNum]
  const sRaw = capag[opts.indicadorStr]
  const raw =
    nRaw !== null &&
    nRaw !== undefined &&
    !(typeof nRaw === 'string' && nRaw.trim() === '')
      ? nRaw
      : sRaw

  const formatted = formatCapagIndicadorPercentual(raw)
  const notaExtra = capag[opts.notaCol]
  if (notaExtra !== null && notaExtra !== undefined) {
    const t = String(notaExtra).trim()
    if (t === 'n.d.' || t === 'n.e.') {
      return { texto: formatted.texto, notaLetra: t }
    }
    if (t !== '') {
      const u = t.charAt(0).toUpperCase()
      if (u >= 'A' && u <= 'D') return { texto: formatted.texto, notaLetra: u }
      return { texto: formatted.texto, notaLetra: t }
    }
  }
  return formatted
}

/** Nota CAPAG STN: preserva "n.d." / "n.e."; normaliza grafias. */
export function normalizeCapagNotaDisplay(raw: string | null | undefined): string {
  if (raw === undefined || raw === null) return 'Não disponível'
  const t = String(raw).trim()
  if (!t) return 'Não disponível'
  const low = t.toLowerCase().replace(/\s/g, '')
  if (low === 'nd' || low === 'n.d' || low === 'n.d.' || low.startsWith('n.d'))
    return 'n.d.'
  if (low === 'ne' || low === 'n.e' || low === 'n.e.' || low.startsWith('n.e'))
    return 'n.e.'
  return t
}

/** Primeira letra corrigível para badge colorido; null se não A-D. */
export function capagBadgeLetra(notaNorm: string): 'A' | 'B' | 'C' | 'D' | null {
  const t = notaNorm.trim()
  const m = /^([ABCD])/i.exec(t)
  if (m) return m[1]!.toUpperCase() as 'A' | 'B' | 'C' | 'D'
  return null
}

export function capagIndicadorNotaParaBadge(
  letra: string,
): 'A' | 'B' | 'C' | 'D' {
  const u = letra.trim().toUpperCase()
  if (u === 'A' || u === 'B' || u === 'C' || u === 'D') return u
  return 'D'
}

/** Dívida consolidada: prioriza coluna dedicada (RGF/STN), senão passivo DCA legado. */
export function valorDividaConsolidadaBrl(
  fiscalMun: Record<string, unknown> | null | undefined,
): number | null {
  if (!fiscalMun) return null
  const div = fiscalMun.divida_consolidada
  if (div != null && String(div).trim() !== '') {
    const v = Number(div)
    return Number.isFinite(v) ? v : null
  }
  const p = fiscalMun.passivo_nao_circulante
  if (p != null && String(p).trim() !== '') {
    const v = Number(p)
    return Number.isFinite(v) ? v : null
  }
  return null
}

/** Qual coluna de `fiscal_municipios` alimentou `valorDividaConsolidadaBrl` (exibição/PDF). */
export function fonteDividaExibicao(
  fiscalMun: Record<string, unknown> | null | undefined,
): 'divida_consolidada' | 'passivo_nao_circulante' | null {
  if (!fiscalMun) return null
  const div = fiscalMun.divida_consolidada
  if (div != null && String(div).trim() !== '') return 'divida_consolidada'
  const p = fiscalMun.passivo_nao_circulante
  if (p != null && String(p).trim() !== '') return 'passivo_nao_circulante'
  return null
}

/** Texto para PDF/drawer: Mi ou "Sem dívida". */
export function formatDividaConsolidadaExibicao(
  fiscalMun: Record<string, unknown> | null | undefined,
): string {
  const v = valorDividaConsolidadaBrl(fiscalMun)
  if (v == null) return 'Não disponível'
  if (v <= 0) return 'Sem dívida'
  return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Mi`
}

export function parseReceitaPropriaMiFromTexto(s: string): number {
  const t = s.replace(/R\$\s*/i, '').trim()
  if (/Mi/i.test(t)) {
    const num = t.replace(/Mi/gi, '').replace(/\./g, '').replace(',', '.').trim()
    const n = Number(num)
    return Number.isFinite(n) ? n : 0
  }
  const n = parsePtBrNumeroFlex(t)
  return n != null && n > 0 ? n / 1_000_000 : 0
}

export function parseDividaMiFromTexto(s: string): number {
  if (/sem\s+d[ií]vida/i.test(s)) return 0
  if (/n[aã]o\s+dispon/i.test(s)) return 0
  const t = s.replace(/R\$\s*/i, '').trim()
  if (/Mi/i.test(t)) {
    const num = t.replace(/Mi/gi, '').replace(/\./g, '').replace(',', '.').trim()
    const n = Number(num)
    return Number.isFinite(n) ? n : 0
  }
  const n = parsePtBrNumeroFlex(t)
  return n != null ? n / 1_000_000 : 0
}

export function parsePercentFromDependencia(s: string): number {
  if (/n[aã]o\s+dispon/i.test(s)) return 0
  const head = s.split(/\s+da\s+/i)[0]?.replace('%', '').trim() ?? ''
  const n = parsePtBrNumeroFlex(head)
  return n != null && Number.isFinite(n) ? n : 0
}

/**
 * PIB municipal em milhões de R$ (coerente com `fiscal_municipios.pib_municipal_mi` e texto «R$ X Mi»).
 */
export function parsePibMunicipalMiFromTexto(raw: string): number {
  const s = String(raw).trim()
  if (!s || /n[aã]o\s+dispon/i.test(s)) return 0
  const t = s.replace(/R\$\s*/i, '').trim()
  if (/Mi/i.test(t)) {
    const num = t.replace(/Mi/gi, '').replace(/\./g, '').replace(',', '.').trim()
    const n = Number(num)
    return Number.isFinite(n) ? n : 0
  }
  const n = parsePtBrNumeroFlex(t)
  return n != null && n > 0 ? n / 1_000_000 : 0
}

function textoFiscalAusente(raw: string): boolean {
  const s = String(raw).trim()
  if (!s) return true
  if (/n[aã]o\s+dispon/i.test(s)) return true
  const low = s.toLowerCase().replace(/\s/g, '')
  if (
    low === 'n.d.' ||
    low === 'n.d' ||
    low === 'nd' ||
    low === 'n/e.' ||
    low === 'n/e' ||
    low === 'ne'
  )
    return true
  return false
}

/** `null` quando o PDF/SICONFI não trouxe receita própria (distinto de R$ 0,00 válido). */
export function parseReceitaPropriaMiFromTextoNullable(
  raw: string,
): number | null {
  if (textoFiscalAusente(raw)) return null
  return parseReceitaPropriaMiFromTexto(raw)
}

/** `null` quando indisponível; `0` apenas para «Sem dívida» explícito. */
export function parseDividaMiFromTextoNullable(raw: string): number | null {
  const s = String(raw)
  if (/sem\s+d[ií]vida/i.test(s)) return 0
  if (textoFiscalAusente(s)) return null
  return parseDividaMiFromTexto(s)
}

/** `null` quando PIB municipal não disponível na série. */
export function parsePibMunicipalMiFromTextoNullable(raw: string): number | null {
  if (textoFiscalAusente(raw)) return null
  return parsePibMunicipalMiFromTexto(raw)
}
