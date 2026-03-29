/**
 * Formata valores em reais (BRL absolutos) para leitura humana (bi / mi / mil).
 * Separador decimal: vírgula (pt-BR).
 */
export function formatarRealBrlInteligente(valorBrl: number): string {
  if (!Number.isFinite(valorBrl) || valorBrl < 0) {
    return 'R$ 0'
  }
  const v = valorBrl
  if (v >= 1_000_000_000) {
    const x = v / 1_000_000_000
    return `R$ ${x.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} bi`
  }
  if (v >= 1_000_000) {
    const x = v / 1_000_000
    return `R$ ${x.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} mi`
  }
  if (v >= 1_000) {
    const x = v / 1_000
    return `R$ ${x.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} mil`
  }
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}
