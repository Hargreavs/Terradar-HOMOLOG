import type { AlertaLegislativo, NivelImpacto } from '../types'

/** Menor número = impacto mais grave (1 = mais crítico). Fallback MÉDIO se inválido. */
export function nivelImpactoMaisGrave(
  alertas: readonly Pick<AlertaLegislativo, 'nivel_impacto'>[],
): NivelImpacto {
  if (alertas.length === 0) return 2
  const levels = alertas.map((a) => {
    const n = a.nivel_impacto
    if (n === 1 || n === 2 || n === 3 || n === 4) return n
    return 2 as NivelImpacto
  })
  return Math.min(...levels) as NivelImpacto
}

/**
 * Alerta de maior severidade (menor nivel_impacto); em empate, o mais recente por `data`.
 */
export function alertaMaisGraveParaTituloPopover(
  alertas: readonly AlertaLegislativo[],
): AlertaLegislativo | null {
  if (alertas.length === 0) return null
  const worst = nivelImpactoMaisGrave(alertas)
  const candidatos = alertas.filter((a) => {
    const n = a.nivel_impacto
    const v = n === 1 || n === 2 || n === 3 || n === 4 ? n : 2
    return v === worst
  })
  candidatos.sort((a, b) => b.data.localeCompare(a.data))
  return candidatos[0] ?? null
}

/**
 * Badge outline (popover e relatório aba Risco): mesmo visual do bloco de alertas no ProcessoPopup.
 */
export function estiloImpactoOutlinePorNivel(n: NivelImpacto): {
  label: string
  color: string
  border: string
} {
  if (n === 1) {
    return {
      label: 'IMPACTO ALTO',
      color: '#E24B4A',
      border: '1px solid rgba(226, 75, 74, 0.3)',
    }
  }
  if (n === 2) {
    return {
      label: 'IMPACTO MÉDIO',
      color: '#E8A830',
      border: '1px solid rgba(232, 168, 48, 0.3)',
    }
  }
  if (n === 3) {
    return {
      label: 'IMPACTO BAIXO',
      color: '#1D9E75',
      border: '1px solid rgba(29, 158, 117, 0.3)',
    }
  }
  return {
    label: 'INFORMATIVO',
    color: '#888780',
    border: '1px solid rgba(136, 135, 128, 0.3)',
  }
}

/** Badge resumido no popover do mapa (outline): pior nível entre os alertas do processo. */
export function estiloImpactoAgregadoPopover(
  worst: NivelImpacto,
): ReturnType<typeof estiloImpactoOutlinePorNivel> {
  return estiloImpactoOutlinePorNivel(worst)
}

/** Badge de nível de impacto: Dashboard e mapa (popup + relatório). */
export function estiloBadgeNivelImpacto(n: NivelImpacto): {
  texto: string
  backgroundColor: string
  color: string
} {
  if (n === 1) {
    return {
      texto: 'IMPACTO ALTO',
      backgroundColor: '#E24B4A26',
      color: '#E24B4A',
    }
  }
  if (n === 2) {
    return {
      texto: 'IMPACTO MÉDIO',
      backgroundColor: '#E8A83026',
      color: '#E8A830',
    }
  }
  if (n === 3) {
    return {
      texto: 'IMPACTO BAIXO',
      backgroundColor: '#1D9E7526',
      color: '#1D9E75',
    }
  }
  return { texto: 'INFORMATIVO', backgroundColor: '#2C2C2A', color: '#888780' }
}

export {
  calcularRelevancia,
  estiloBadgeRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
  type RelevanciaConfig,
} from './relevanciaAlerta'
