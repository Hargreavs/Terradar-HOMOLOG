/**
 * Taxonomia de exibição do card «Mercado / contexto global» (pós-D6 master_substancias).
 */
export type SubstanceMarketState =
  | 'BR_PRODUTOR'
  | 'PROIBIDO'
  | 'BR_NAO_PRODUTOR'
  | 'SEM_FONTE'

export type SubstanceMarketInputs = {
  fonte_preco: string | null | undefined
  fonte_res_prod: string | null | undefined
  reservas_br_pct: number | null | undefined
  producao_br_pct: number | null | undefined
}

function up(s: string | null | undefined): string {
  return (s ?? '').toUpperCase()
}

function isPctGt0(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(Number(v)) && Number(v) > 0
}

/** Ambos os percentuais oficiais ausentes (distinto de 0 declarado). */
function ambosPctAusentes(
  r: number | null | undefined,
  p: number | null | undefined,
): boolean {
  return (
    !(r != null && Number.isFinite(Number(r))) &&
    !(p != null && Number.isFinite(Number(p)))
  )
}

function isSemFonteMarker(a: string, b: string): boolean {
  return (
    a.startsWith('SEM_FONTE') ||
    b.startsWith('SEM_FONTE') ||
    a.startsWith('SEM_FONTE_OFICIAL') ||
    b.startsWith('SEM_FONTE_OFICIAL')
  )
}

/** Heurística «Brasil não é produtor» a partir do texto curado na master. */
function isNaoProdutorCopy(fonteRes: string): boolean {
  const t = (fonteRes ?? '').toLowerCase()
  const nao = t.includes('não') || t.includes('nao ')
  const produtor = t.includes('produtor')
  return nao && produtor
}

/**
 * Ordem: PROIBIDO → ausência total SEM_FONTE → BR produtor (>0%) → marcadores texto
 * → texto «não é produtor» → BR não produtor.
 */
export function getSubstanceMarketState(
  input: SubstanceMarketInputs,
): SubstanceMarketState {
  const fp = up(input.fonte_preco)
  const fr = up(input.fonte_res_prod)

  if (fp.includes('PROIBIDO')) return 'PROIBIDO'

  const rRaw = input.reservas_br_pct
  const pRaw = input.producao_br_pct

  /** Classificação de mercado só com percentuais crus da master; `null` ≠ `0`. */
  if (ambosPctAusentes(rRaw, pRaw)) {
    return 'SEM_FONTE'
  }

  if (isPctGt0(rRaw) || isPctGt0(pRaw)) {
    return 'BR_PRODUTOR'
  }

  if (isSemFonteMarker(fp, fr)) return 'SEM_FONTE'

  const frRaw = (input.fonte_res_prod ?? '').trim()
  if (frRaw !== '' && isNaoProdutorCopy(frRaw)) return 'BR_NAO_PRODUTOR'

  return 'BR_NAO_PRODUTOR'
}

/** Texto auxiliar após prefixos SEM_FONTE / SEM_FONTE_OFICIAL (mesma ideia que reportFonteResProd). */
export function textoExplicativoFonte(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return ''
  const s = String(raw).trim()
  const prefixes = ['SEM_FONTE_OFICIAL:', 'SEM_FONTE:', 'SEM_FONTE ']
  for (const p of prefixes) {
    if (s.toUpperCase().startsWith(p.toUpperCase())) {
      return s.slice(p.length).trim()
    }
  }
  return s
}
