import type { AlertaLegislativo, NivelImpacto } from '../types'

export type TipoImpacto = AlertaLegislativo['tipo_impacto']

export type Relevancia =
  | 'favoravel'
  | 'positivo'
  | 'neutro'
  | 'desfavoravel'
  | 'critico'

export interface RelevanciaConfig {
  label: string
  cor: string
  /** 1 = mais crítico, 5 = mais favorável */
  ordem: number
}

export const RELEVANCIA_MAP: Record<Relevancia, RelevanciaConfig> = {
  favoravel: { label: 'FAVORÁVEL', cor: '#1D9E75', ordem: 5 },
  positivo: { label: 'POSITIVO', cor: '#5CBFA0', ordem: 4 },
  neutro: { label: 'NEUTRO', cor: '#888780', ordem: 3 },
  desfavoravel: { label: 'DESFAVORÁVEL', cor: '#E8A830', ordem: 2 },
  critico: { label: 'CRÍTICO', cor: '#E24B4A', ordem: 1 },
}

export function calcularRelevancia(
  nivel_impacto: NivelImpacto,
  tipo_impacto: TipoImpacto,
): Relevancia {
  if (nivel_impacto === 1 && tipo_impacto === 'favoravel') return 'favoravel'
  if (nivel_impacto === 1 && tipo_impacto === 'restritivo') return 'critico'
  if (
    nivel_impacto === 1 &&
    (tipo_impacto === 'neutro' || tipo_impacto === 'incerto')
  )
    return 'neutro'

  if (nivel_impacto === 2 && tipo_impacto === 'favoravel') return 'positivo'
  if (nivel_impacto === 2 && tipo_impacto === 'restritivo') return 'desfavoravel'
  if (
    nivel_impacto === 2 &&
    (tipo_impacto === 'neutro' || tipo_impacto === 'incerto')
  )
    return 'neutro'

  if (nivel_impacto === 3 && tipo_impacto === 'favoravel') return 'positivo'
  if (nivel_impacto === 3 && tipo_impacto === 'restritivo') return 'neutro'
  if (
    nivel_impacto === 3 &&
    (tipo_impacto === 'neutro' || tipo_impacto === 'incerto')
  )
    return 'neutro'

  return 'neutro'
}

export function estiloBadgeRelevancia(
  nivel_impacto: NivelImpacto,
  tipo_impacto: TipoImpacto,
): { cor: string; label: string } {
  const r = calcularRelevancia(nivel_impacto, tipo_impacto)
  const cfg = RELEVANCIA_MAP[r]
  return { cor: cfg.cor, label: cfg.label }
}
