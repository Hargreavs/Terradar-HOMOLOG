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

export type ScoreBreakdownPayload = {
  dimensoes_risco?: S31DimensoesRisco
  dimensoes_oportunidade?: S31DimensoesOportunidade
}
