export type Regime =
  | 'requerimento_pesquisa'
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'req_plg'
  | 'licenciamento'
  | 'lavra_garimpeira'
  | 'registro_extracao'
  | 'req_registro_extracao'
  | 'requerimento_licenciamento'
  | 'direito_requerer_lavra'
  | 'apto_disponibilidade'
  | 'reconhecimento_geologico'
  | 'disponibilidade'
  | 'mineral_estrategico'
  | 'bloqueio_provisorio'
  | 'bloqueio_permanente'

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

/** Subfator de dimensão (persistido em scores.dimensoes_risco no banco). */
export interface SubfatorPersistido {
  nome: string
  label: string
  texto: string
  valor: number
  peso_pct: number
  valor_bruto: number
  dias_sem_movimento?: number
}

export interface DimensaoPersistida {
  valor: number
  subfatores: SubfatorPersistido[]
}

/** Variável que compõe uma dimensão do Risk Score (popover + relatório). */
export interface RiskDimensaoVariavel {
  nome: string
  valor: number
  texto: string
  fonte: string
}

/** Uma dimensão do Risk Score com decomposição para UI. */
export interface RiskDimensaoDetalhe {
  score: number
  variaveis: RiskDimensaoVariavel[]
}

export interface RiskScoreDecomposicao {
  total: number
  geologico: RiskDimensaoDetalhe
  ambiental: RiskDimensaoDetalhe
  social: RiskDimensaoDetalhe
  regulatorio: RiskDimensaoDetalhe
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
  /** Opcional, ex.: CNPJ verificado (processo real SIGMINE). */
  cnpj_titular?: string
  /** CNPJ da filial operacional (fase 2 / BrasilAPI), quando existir. */
  cnpj_filial?: string
  /** NUP SEI (Microdados SCM / cadastro). */
  nup_sei?: string
  /** Resumo de eventos SCM (ingestão 12.13). */
  ultimo_evento_data?: string
  ultimo_evento_descricao?: string
  ultimo_evento_codigo?: number
  portaria_lavra_data?: string
  portaria_lavra_dou?: string
  licenca_ambiental_data?: string
  inicio_lavra_data?: string
  plano_fechamento_data?: string
  tah_ultimo_pagamento?: string
  ral_ultimo_data?: string
  exigencia_pendente?: boolean
  total_eventos?: number
  area_ha: number
  uf: string
  municipio: string
  lat: number
  lng: number
  data_protocolo: string
  ano_protocolo: number
  /** Mês do protocolo (1–12) quando disponível; usado p.ex. para regra SEI pré-2019. */
  mes_protocolo?: number | null
  situacao: 'ativo' | 'inativo' | 'bloqueado'
  /** Quando `false`, processo sem efeitos regulatórios ativos (extinto / terminal). */
  ativo_derivado?: boolean | null
  risk_score: number | null
  risk_breakdown: RiskBreakdown | null
  /** Decomposição por variável (mock/UI). Null quando `risk_score` é null. */
  risk_decomposicao: RiskScoreDecomposicao | null
  /** Incluído dinamicamente pela busca no mapa (API / Supabase). */
  fromApi?: boolean
  /** Valor estimado das reservas (milhões USD). */
  valor_estimado_usd_mi: number
  /** Data do último despacho ANM (YYYY-MM-DD). */
  ultimo_despacho_data: string
  alertas: AlertaLegislativo[]
  fiscal: DadosFiscais
  geojson: GeoJSONPolygon

  /** Subfatores persistidos (batch 15.01/15.02-fix); fonte canônica quando presentes. */
  dimensoes_risco_persistido?: {
    geologico?: DimensaoPersistida
    ambiental?: DimensaoPersistida
    social?: DimensaoPersistida
    regulatorio?: DimensaoPersistida
  } | null

  dimensoes_oportunidade_persistido?: Record<string, unknown> | null

  os_conservador_persistido?: number | null
  os_moderado_persistido?: number | null
  os_arrojado_persistido?: number | null
  os_label_persistido?: string | null
  /** Rótulos persistidos em `scores` (batch/API), prioridade sobre faixa derivada do número. */
  risk_label_persistido?: string | null
  risk_cor_persistido?: string | null
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

/** Dados territoriais do relatório (alias de `DadosTerritoriais` no mock). */
export type { Territorial } from '../data/relatorio.mock'

/** Inteligência mineral (Master-Substâncias); definição canônica em `relatorio.mock.ts`. */
export type {
  DemandaProjetadaEstruturada,
  IntelMineral,
  UnidadePrecoIntel,
} from '../data/relatorio.mock'
