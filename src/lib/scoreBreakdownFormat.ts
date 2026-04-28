/** Formato pt-BR; reduz ruido de float e usa o sinal menos tipografico (U+2212). */
export function formatNumeroPt(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const neg = n < 0
  const vRaw = Math.abs(n)
  if (vRaw < 1e-12) return neg ? "\u22120,0" : "0,0"

  let minimumFractionDigits: number
  let maximumFractionDigits: number
  if (vRaw < 1) {
    minimumFractionDigits = 0
    maximumFractionDigits = 2
  } else if (vRaw < 1000) {
    /** Ponderados no motor: [1, 1000) → sempre "X,Y" (ex.: 16 → 16,0). */
    minimumFractionDigits = 1
    maximumFractionDigits = 1
  } else {
    minimumFractionDigits = 0
    maximumFractionDigits = 2
  }

  const v = vRaw
  let roundedAbs: number
  if (v < 1) {
    roundedAbs = Math.round(v * 100) / 100
  } else if (v < 1000) {
    roundedAbs = Math.round(v * 10) / 10
  } else {
    roundedAbs = Math.round(v * 100) / 100
  }

  const body = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(roundedAbs)
  return (neg ? "\u2212" : "") + body
}

/** Corrige preço legado "1234.56 BRL/t" e similares para moeda pt-BR. */
function fmtBrlPorTonaDoMatch(inteiro: string, frac: string): string {
  const n = Number(`${inteiro}.${frac}`)
  if (!Number.isFinite(n)) return `${inteiro}.${frac} BRL/t`
  return (
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + "/t"
  )
}

/** Ataca ruídos tipo 5,0555555556 e números com ponto em prosa (motor legado / JSON). */
export function sanitizarRuídoDecimalNaProsa(texto: string): string {
  return (
    texto
      /* "2357.21 BRL/t" → "R$ 2.357,21/t" */
      .replace(/\b(\d+)\.(\d{1,4})\s*BRL\/t\b/g, (_, a, b) =>
        fmtBrlPorTonaDoMatch(a, b),
      )
      .replace(/\b\d+,\d{5,}\b/g, (hit) => {
        const n = Number(hit.replace(",", "."))
        return Number.isFinite(n) ? formatNumeroPt(n) : hit
      })
      .replace(/\b\d+\.\d{5,}\b/g, (hit) => {
        const n = Number(hit)
        return Number.isFinite(n) ? formatNumeroPt(n) : hit
      })
  )
}

/** Coeficientes tipo bioma (1–1,3): sem zeros à direita. */
export function formatMultiplierCoefPt(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.round(n * 1000) / 1000)
}

/** Peso na dimensao: motor envia fracoes 0-1 -> "Peso 12,5%". */
export function formatPesoDimensaoLine(pesoFracao: number): string {
  const pct = pesoFracao * 100
  return `Peso ${formatNumeroPt(pct)}%`
}
