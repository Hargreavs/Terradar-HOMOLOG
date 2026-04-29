/** Payload de `fn_radar_alertas_processo` (Radar IA) + consumo no drawer. */

export type AlertaRadarCategoria =
  | 'FAVORAVEL'
  | 'DESFAVORAVEL'
  | 'NEUTRO'
  | 'POSITIVO'
  | 'CRITICO'

export type AlertaRadarMatchMotivo =
  | 'CITADO_DIRETAMENTE'
  | 'CNPJ'
  | 'COMBINADO'
  | 'UF'
  | 'SUBSTANCIA'

export type AlertaRadar = {
  id: number
  categoria: AlertaRadarCategoria
  tipo_ato: string | null
  numero_ato: string | null
  orgao_emissor: string | null
  data_evento: string
  titulo: string
  resumo: string
  analise_terradar: string | null
  flags_atencao: string[] | null
  confianca: number | null
  publicado_em: string | null
  /** Às vezes varia casing na RPC; normalize no UI. */
  match_motivo: string
  match_score: number
}

export type AlertasProcessoResponse = {
  total: number
  diretos: AlertaRadar[]
  setoriais: AlertaRadar[]
}
