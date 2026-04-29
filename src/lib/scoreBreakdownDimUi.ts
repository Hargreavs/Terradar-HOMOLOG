import type { SubfatorOutput } from '../types/scoreBreakdown'
import { formatNumeroPt, formatMultiplierCoefPt } from './scoreBreakdownFormat'

const NOME_MULTI_BIOMA = 'Multiplicador de bioma'
const NOME_BONUS_MINERAL = 'Bônus mineral crítico'
const NOME_ADJ_SOCIAL = 'Ajuste consolidador social'
const NOME_ADJ_REG = 'Ajuste consolidador regulatório'

export type MultiplicadorBiomaBadge = {
  label: string
  title: string
}

function extrairBiomaDoTexto(texto: string): string {
  const t = texto.trim()
  const m = /^([^:\n]+)\s*:\s*multiplicador/i.exec(t)
  return m ? m[1].trim() : 'Bioma'
}

export function extrairMultiplicadorBiomaBadge(
  subs: SubfatorOutput[],
): MultiplicadorBiomaBadge | null {
  const sf = subs.find((s) => s.nome === NOME_MULTI_BIOMA)
  if (!sf) return null
  const coef = Number(sf.valor_bruto)
  if (!Number.isFinite(coef)) return null
  const bioma = extrairBiomaDoTexto(sf.texto ?? '')
  return {
    label: `× ${formatMultiplierCoefPt(coef)} ${bioma}`,
    title: sf.texto?.trim() ?? '',
  }
}

export function filtrarSubfatoresDimensaoRisco(
  dim:
    | 'geologico'
    | 'ambiental'
    | 'social'
    | 'regulatorio',
  subs: SubfatorOutput[],
): SubfatorOutput[] {
  return subs.filter((s) => {
    if (s.nome === NOME_MULTI_BIOMA) return false
    if (dim === 'social' && s.nome === NOME_ADJ_SOCIAL) return false
    if (dim === 'regulatorio' && s.nome === NOME_ADJ_REG) return false
    return true
  })
}

export function notaConsolidadorRisk(
  dim: 'social' | 'regulatorio',
  subs: SubfatorOutput[],
): string | null {
  const nome = dim === 'social' ? NOME_ADJ_SOCIAL : NOME_ADJ_REG
  const sf = subs.find((s) => s.nome === nome)
  if (!sf || !Number.isFinite(sf.valor)) return null
  if (Math.abs(sf.valor) < 0.1) return null
  return `Diferença de ${formatNumeroPt(sf.valor)} entre soma exata e valor exibido (arredondamento).`
}

export type ParticaoOppAtratividade = {
  linhasSubfatores: SubfatorOutput[]
  bonusBadge: SubfatorOutput | null
}

export function partitionAtratividadeSubs(
  subs: SubfatorOutput[],
): ParticaoOppAtratividade {
  let bonusBadge: SubfatorOutput | null = null
  const linhasSubfatores = subs.filter((s) => {
    if (s.nome !== NOME_BONUS_MINERAL) return true
    if (s.valor <= 0) return false
    bonusBadge = s
    return false
  })
  return { linhasSubfatores, bonusBadge }
}
