/** Formato pt-BR; reduz ruido de float e usa o sinal menos tipografico (U+2212). */
export function formatNumeroPt(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const clean = Number.parseFloat(Number(n).toPrecision(12))
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  })
    .format(clean)
    .replace(/^-/, "\u2212")
}

/** Peso na dimensao: motor envia fracoes 0-1 -> "Peso 12,5%". */
export function formatPesoDimensaoLine(pesoFracao: number): string {
  const pct = pesoFracao * 100
  return `Peso ${formatNumeroPt(pct)}%`
}
