export type Regime =
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'licenciamento'
  | 'mineral_estrategico'
  | 'bloqueio_permanente'
  | 'bloqueio_provisorio'

export type Fase =
  | 'requerimento'
  | 'pesquisa'
  | 'concessao'
  | 'lavra'
  | 'encerrado'

export interface RiskBreakdown {
  geologico: number
  ambiental: number
  social: number
  regulatorio: number
}

export type NivelImpacto = 1 | 2 | 3 | 4

export interface AlertaLegislativo {
  id: string
  fonte: 'DOU' | 'Câmara' | 'Senado' | 'DOE' | 'IBAMA' | 'ANM'
  /** Diário de publicação de origem (ex.: DOU, DOE-PA, DOM-Parauapebas), exibido como “via …”. */
  fonte_diario: string
  data: string
  titulo: string
  resumo: string
  nivel_impacto: NivelImpacto
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro' | 'incerto'
  urgencia: 'imediata' | 'medio_prazo' | 'longo_prazo'
}

export interface DadosFiscais {
  capag: 'A' | 'B' | 'C' | 'D'
  receita_propria_mi: number
  divida_consolidada_mi: number
  incentivos_estaduais: string[]
  linhas_bndes: string[]
  observacao: string
}

export interface Processo {
  id: string
  numero: string
  regime: Regime
  fase: Fase
  substancia: string
  is_mineral_estrategico: boolean
  titular: string
  area_ha: number
  uf: string
  municipio: string
  lat: number
  lng: number
  data_protocolo: string
  ano_protocolo: number
  situacao: 'ativo' | 'inativo' | 'bloqueado'
  risk_score: number | null
  risk_breakdown: RiskBreakdown | null
  /** Valor estimado das reservas (milhões USD). */
  valor_estimado_usd_mi: number
  /** Data do último despacho ANM (YYYY-MM-DD). */
  ultimo_despacho_data: string
  alertas: AlertaLegislativo[]
  fiscal: DadosFiscais
  geojson: GeoJSONPolygon
}

export interface GeoJSONPolygon {
  type: 'Feature'
  properties: { id: string }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

/** Valor de `filtros.uf` que exclui todos os processos do mapa. */
export const UF_FILTRO_NENHUM = '__TERRAE_UF_NENHUM__' as const

export interface FiltrosState {
  camadas: Record<Regime, boolean>
  substancias: string[]
  periodo: [number, number]
  uf: string | null
  municipio: string | null
  riskScoreMin: number
  riskScoreMax: number
  searchQuery: string
}
