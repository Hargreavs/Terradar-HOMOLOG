/** Tokens Opportunity Score, alinhado a TERRADAR-Design-System-Scores / Config-Scores. */

import { getOpportunityLabel } from './opportunityScore'

export const CORES_DIMENSAO_OS = {
  atratividade: '#D4A843',
  viabilidade: '#5B8CB8',
  seguranca: '#1D9E75',
} as const

export const PESOS_OS_CONSERVADOR = {
  atratividade: 0.25,
  viabilidade: 0.3,
  seguranca: 0.45,
} as const

/** Pesos por perfil (Config-Scores). */
export const PESOS_OS_POR_PERFIL = {
  conservador: { atratividade: 0.25, viabilidade: 0.3, seguranca: 0.45 },
  moderado: { atratividade: 0.4, viabilidade: 0.3, seguranca: 0.3 },
  arrojado: { atratividade: 0.55, viabilidade: 0.25, seguranca: 0.2 },
} as const

export type PerfilOportunidadeOSKey = keyof typeof PESOS_OS_POR_PERFIL

export type DimensaoOSKey = keyof typeof CORES_DIMENSAO_OS

export function corFaixaOS(v: number): string {
  if (v >= 75) return '#1D9E75'
  if (v >= 50) return '#E8A830'
  if (v >= 25) return '#888780'
  return '#E24B4A'
}

/** Escala de cor para subfatores de OS: alto = bom (inverso do Risk Score). */
export function corFaixaOportunidadeValor(valorBruto: number): string {
  if (valorBruto >= 75) return '#1D9E75'
  if (valorBruto >= 50) return '#E8A830'
  if (valorBruto >= 25) return '#888780'
  return '#E24B4A'
}

export function labelFaixaOS(v: number): string {
  return getOpportunityLabel(v)
}

export function qualificadorOS(v: number): { texto: string; cor: string } {
  const cor = corFaixaOS(v)
  if (v >= 90) return { texto: 'Oportunidade excepcional', cor }
  if (v >= 75) return { texto: 'Oportunidade muito favorável', cor }
  if (v >= 60) return { texto: 'Oportunidade favorável', cor }
  if (v >= 40) return { texto: 'Oportunidade razoável', cor }
  return { texto: 'Oportunidade limitada', cor }
}

/** Texto neutro para o card de cruzamento (sem recomendação de investimento). */
export function textoAnalise(rs: number, os_conservador: number): string {
  const rsLabel = rs < 40 ? 'baixo' : rs <= 69 ? 'médio' : 'alto'
  const osLabel = getOpportunityLabel(os_conservador).toLowerCase()

  return `O processo apresenta risco ${rsLabel} (Risk Score ${rs}) com oportunidade classificada como ${osLabel} no perfil conservador (Opportunity Score ${os_conservador}).`
}
