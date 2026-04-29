/** Espelho dos tipos do motor S31 para o cliente (payload do score-breakdown). */

export type SubfatorOutput = {
  nome: string
  fonte: string
  label: string
  texto: string
  valor: number
  peso_pct: number | null
  valor_bruto: number
}

export type DimensaoOutput = {
  valor: number
  subfatores: SubfatorOutput[]
}

export type S31DimensoesRisco = {
  geologico: DimensaoOutput
  ambiental: DimensaoOutput
  social: DimensaoOutput
  regulatorio: DimensaoOutput
}

export type S31DimensoesOportunidade = {
  atratividade: DimensaoOutput
  viabilidade: DimensaoOutput
  seguranca: DimensaoOutput
  penalidades: string[]
}

/** Quatro dimensoes do risk (cabecalho + mini-barras). */
export type RiskBreakdownQuatro = {
  geologico: number
  ambiental: number
  social: number
  regulatorio: number
}

/** Tres parcelas atratividade / viabilidade / seguranca (OS). */
export type OsBreakdownTriple = {
  atratividade: number
  viabilidade: number
  seguranca: number
}

/** Payload JSON do endpoint score-breakdown (motor S31 no servidor). */
export type ScoreBreakdownPayload = {
  dimensoes_risco?: S31DimensoesRisco
  dimensoes_oportunidade?: S31DimensoesOportunidade
  risk_score?: number
  risk_label?: string
  risk_cor?: string
  risk_breakdown?: RiskBreakdownQuatro
  os_conservador?: number
  os_moderado?: number
  os_arrojado?: number
  os_label_conservador?: string
  os_label_moderado?: string
  os_label_arrojado?: string
  os_breakdown?: OsBreakdownTriple
}
