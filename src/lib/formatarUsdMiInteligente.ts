/**
 * Formata valores em milhões de USD (`valor_estimado_usd_mi`) para leitura em bi ou mi.
 * Separador decimal: vírgula (pt-BR), alinhado a `formatarRealBrlInteligente`.
 */
export function formatarUsdMiInteligente(valorMilhoesUsd: number): string {
  if (!Number.isFinite(valorMilhoesUsd) || valorMilhoesUsd < 0) {
    return 'US$ 0'
  }
  const v = valorMilhoesUsd
  if (v >= 1000) {
    const bi = v / 1000
    return `US$ ${bi.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} bi`
  }
  return `US$ ${v.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })} mi`
}
