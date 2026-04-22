// Formatting helpers: Inteligencia Contexto Brasil when tipo_mercado is BR_ONLY.

export const TIPO_MERCADO_BR_ONLY = 'BR_ONLY'

export function isTipoMercadoBrOnly(
  tipo: string | null | undefined,
): boolean {
  return String(tipo ?? '').trim() === TIPO_MERCADO_BR_ONLY
}

const EM_DASH = '\u2014'

export function formatarProducaoNacionalT(ton: number | null | undefined): string {
  if (ton == null || !Number.isFinite(ton) || ton < 0) return EM_DASH
  if (ton >= 1_000_000) {
    const mi = ton / 1_000_000
    return `${mi.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} Mi t`
  }
  if (ton >= 1000) {
    const mil = ton / 1000
    return `${mil.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mil t`
  }
  return `${ton.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} t`
}

export function formatarValorProducaoBrBrl(
  v: number | null | undefined,
): string {
  if (v == null || !Number.isFinite(v) || v < 0) return EM_DASH
  if (v >= 1_000_000_000) {
    const bi = v / 1_000_000_000
    return `R$ ${bi.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} bi`
  }
  if (v >= 1_000_000) {
    const mi = v / 1_000_000
    return `R$ ${mi.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mi`
  }
  if (v >= 1000) {
    const mil = v / 1000
    return `R$ ${mil.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mil`
  }
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export function formatarPrecoMedioBrBrlPorT(
  v: number | null | undefined,
): string {
  if (v == null || !Number.isFinite(v) || v < 0) return EM_DASH
  const s = v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `R$ ${s}` + '/t'
}

export function formatarPctTopUf(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return EM_DASH
  const x = pct > 0 && pct <= 1 ? pct * 100 : pct
  return `${x.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}
