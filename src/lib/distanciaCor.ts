/**
 * Única fonte de cor para distância × tipo de área sensível (S31 + drawer).
 * `yellow` = âmbar na paleta TERRADAR.
 */
export type TipoAreaSensivel =
  | 'TI'
  | 'QUILOMBOLA'
  | 'UC_PI'
  | 'UC_US'
  | 'SITIO_ARQ'
  | 'AQUIFERO'
  | 'CORPO_AGUA'
  | 'APP'
  | 'ASSENTAMENTO'
  | 'CAVERNA'

export type CorRisco = 'red' | 'yellow' | 'green'

export const CORES_DISTANCIA: Record<
  CorRisco,
  { texto: string; bg: string; border: string }
> = {
  red: {
    texto: '#E24B4A',
    bg: 'rgba(226,75,74,0.10)',
    border: 'rgba(226,75,74,0.40)',
  },
  yellow: {
    texto: '#E8A830',
    bg: 'rgba(232,168,48,0.10)',
    border: 'rgba(232,168,48,0.40)',
  },
  green: {
    texto: '#1D9E75',
    bg: 'rgba(29,158,117,0.10)',
    border: 'rgba(29,158,117,0.40)',
  },
}

export function corDistancia(
  tipo: TipoAreaSensivel,
  distanciaKm: number,
  sobrepoe?: boolean,
): CorRisco {
  if (sobrepoe === true) {
    if (tipo === 'UC_US') return 'yellow'
    if (
      tipo === 'AQUIFERO' ||
      tipo === 'CORPO_AGUA' ||
      tipo === 'APP' ||
      tipo === 'CAVERNA'
    ) {
      return 'yellow'
    }
    return 'red'
  }

  const d = Math.max(0, distanciaKm)

  switch (tipo) {
    case 'TI':
    case 'QUILOMBOLA':
    case 'UC_PI':
      if (d <= 5) return 'red'
      if (d <= 10) return 'yellow'
      return 'green'

    case 'UC_US':
      if (d <= 0.001) return 'red'
      if (d <= 5) return 'yellow'
      return 'green'

    case 'ASSENTAMENTO':
      // Proximidade a comunidades de assentamento: faixas ESG (ruído, pó, tráfego, água).
      // ≤5 km crítico; 5–20 km atenção; >20 km sem impacto direto nesta régua.
      if (d <= 5) return 'red'
      if (d <= 20) return 'yellow'
      return 'green'

    case 'SITIO_ARQ':
      if (d <= 1) return 'red'
      if (d <= 5) return 'yellow'
      return 'green'

    case 'AQUIFERO':
    case 'CORPO_AGUA':
    case 'APP':
    case 'CAVERNA':
      if (d <= 0.001) return 'red'
      if (d <= 1) return 'yellow'
      return 'green'

    default:
      return 'green'
  }
}

/** Rótulo pt-BR + cor única (Território + Risco). */
export function textoCorDistS31(
  tipo: TipoAreaSensivel,
  km: number,
  sobrepoe?: boolean,
): { text: string; color: string } {
  if (km <= 0) {
    return {
      text: 'SOBREPOSTO',
      color: CORES_DISTANCIA[corDistancia(tipo, km, true)].texto,
    }
  }
  return {
    text: `${km.toFixed(1).replace('.', ',')} km`,
    color: CORES_DISTANCIA[corDistancia(tipo, km, sobrepoe)].texto,
  }
}
