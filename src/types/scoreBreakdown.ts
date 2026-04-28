/** Espelho dos tipos `server/scoringS31BreakdownTypes.ts` para o cliente (payload do motor). */

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

/** Quatro dimensões do risk (card mini-barras + cabeçalho), espelha `ScoreResult` do motor. */
export type RiskBreakdownQuatro = {
  geologico: number
  ambiental: number
  social: number
  regulatorio: number
}

/**
 * Payload do GET `/api/processos/:id/score-breakdown` (motor S31 on-demand).
 * Inclui campos de topo do `ScoreResult` além das decomposições.
 */
export type ScoreBreakdownPayload = {
  dimensoes_risco?: S31DimensoesRisco
  dimensoes_oportunidade?: S31DimensoesOportunidade
  risk_score?: number
  risk_label?: string
  risk_cor?: string
  risk_breakdown?: RiskBreakdownQuatro
}
