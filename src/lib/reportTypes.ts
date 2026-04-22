import type { ReportLang } from './reportLang'
import type { CfemProcessoStatus } from './cfemProcessoStatus'
import type { BloqueadorConstitucional } from './processoStatus'

export type { ReportLang } from './reportLang'
export type { CfemProcessoStatus } from './cfemProcessoStatus'

export interface RiskDimension {
  valor: number
  label: string
  width_pct: number
  color: string
}

export interface LayerData {
  tipo: string
  nome: string
  detalhes: string
  distancia_km: number
  sobreposto: boolean
  tag_class: string
  tag_label: string
}

export interface InfraData {
  tipo: string
  nome: string
  detalhes: string
  distancia_km: number
}

export interface CfemHistoricoItem {
  ano: number
  processo_valor: string
  municipio_valor: string
  substancias: string
}

/** Linha de `master_substancias` em `GET /api/processo` → `data.mercado`. */
export interface MasterSubstancia {
  id: number
  substancia_anm: string
  familia: string
  cfem_pct: number | null
  preco_usd: number | null
  fonte_preco: string | null
  preco_brl: number | null
  unidade_preco: string
  /**
   * Unidade de mercado coloquial (ex.: 'oz' para ouro/prata, 'ct' para gemas,
   * 'kg' para lítio/cobalto, 'lb' para urânio, 'L' para águas, 't' resto).
   * Vem de `master_substancias.unidade_mercado`. Usada pelo helper
   * `exibirPreco` para converter `preco_usd` (sempre USD/t internamente)
   * na unidade apropriada para exibição no PDF.
   */
  unidade_mercado: 'oz' | 'ct' | 'kg' | 'lb' | 't' | 'L' | null
  reservas_br_pct: number | null
  producao_br_pct: number | null
  gap_pp: number | null
  fonte_res_prod: string | null
  tendencia: string | null
  var_1a_pct: number | null
  cagr_5a_pct: number | null
  estrategia_nacional: string | null
  sinal: string | null
  aplicacoes: string | null
  teor_pct: number | null
  val_reserva_usd_ha: number | null
  val_reserva_brl_ha: number | null
  mineral_critico_2025: boolean
  aplicacoes_usgs: string | null
  cresc_demanda_cleantech_2030_pct: number | null
  demanda_projetada_2030: string | null
  cambio_referencia: number
  updated_at: string
}

export interface ReportData {
  // Cadastro
  processo: string
  titular: string
  cnpj: string
  substancia_anm: string
  regime: string
  fase: string
  area_ha: number
  municipio: string
  bioma: string

  // Status regulatório
  alvara_validade: string
  alvara_status: string
  ultimo_despacho: string
  nup_sei: string
  gu_status: string
  gu_pendencia: string
  /** Strings formatadas das pendências ativas do processo (fn_pendencias_processo). */
  pendencias: string[]
  tah_status: string
  /** Dica para PDF quando não há data de pagamento TAH na timeline pública. */
  tah_status_tooltip?: string
  licenca_ambiental: string
  protocolo_anos: number
  /** Cadastro ANM: `ativo_derivado === false` (efeitos regulatórios encerrados). */
  is_terminal: boolean
  /** Sobreposição com impedimento constitucional absoluto (ex.: TI regularizada). */
  bloqueador_constitucional: BloqueadorConstitucional | null

  // Scores
  /**
   * Risk Score consolidado (0–100) ou `null` quando o processo não possui
   * score calculado no banco. Consumidores (drawer, PDF, LLM) devem renderizar
   * um empty state / placeholder quando for `null` — NÃO cair em fallback `|| 0`.
   */
  risk_score: number | null
  rs_classificacao: string
  /** Cor do rótulo Risk Score (hex); preferir valor persistido em `scores.risk_cor` quando existir. */
  rs_cor: string
  rs_geo: RiskDimension
  rs_amb: RiskDimension
  rs_soc: RiskDimension
  rs_reg: RiskDimension
  /** Opportunity Score perfil conservador; `null` quando não há score persistido. */
  os_conservador: number | null
  os_moderado: number | null
  os_arrojado: number | null
  os_classificacao: string
  /** Cor do rótulo OS consolidado; preferir `scores.os_cor` quando existir. */
  os_cor: string
  os_merc: RiskDimension
  os_viab: RiskDimension
  os_seg: RiskDimension

  // Mercado
  /** Preço spot master (USD/t), `master_substancias.preco_usd` — não confundir com valor in-situ /ha. */
  preco_spot_usd_t: number
  /**
   * Preço canônico USD/t vindo de `master_substancias.preco_usd`, preservando
   * `null` quando a substância não tem série publicada. Usado pelo helper
   * `exibirPreco` para conversão de unidades em tempo de renderização.
   */
  preco_usd_por_t: number | null
  /**
   * Unidade de mercado coloquial para exibição (oz/ct/kg/lb/L/t). Vem de
   * `master_substancias.unidade_mercado`. Pareada com `preco_usd_por_t`.
   */
  unidade_mercado: 'oz' | 'ct' | 'kg' | 'lb' | 't' | 'L' | null
  preco_oz_usd: number
  preco_g_brl: number
  ptax: number
  /** Unidade de exibição do preço spot (ex.: 'oz', 't', 'm3') vinda de master_substancias.unidade_preco. */
  preco_unidade_label: string
  /** Sublinha abaixo do preço (só faz sentido para metal precioso, ex.: "R$ X/g · PTAX R$ Y"). null suprime a linha. */
  preco_sub_label: string | null
  var_12m_pct: number | null
  /** Label de mercado (ex.: «Alta») — `master_substancias.tendencia`; não confundir com `var_1a_pct`. */
  mercado_tendencia: string
  cagr_5a_pct: number | null
  demanda_global_t: number
  reservas_mundiais_pct: number
  producao_mundial_pct: number
  /** `master_substancias.fonte_res_prod` (marker `SEM_FONTE_OFICIAL:` = sem estatística comparável). */
  fonte_res_prod: string | null
  /** PNM e políticas setoriais (master_substâncias). */
  estrategia_nacional: string
  /** Lista ou texto da master_substâncias (separadores `;` ou quebra de linha). */
  aplicacoes_substancia?: string | null
  cfem_aliquota_pct: number
  valor_insitu_usd_ha: number
  cfem_estimada_ha: number

  // Territorial
  mapa_base64: string
  layers: LayerData[]
  infraestrutura: InfraData[]
  /** Sede municipal + distância (`fn_territorial_analysis`); opcional para PDF/UI. */
  sede?: {
    nome: string
    uf: string
    distancia_km: number
  } | null

  // Fiscal
  capag_nota: string
  capag_endiv: string
  capag_endiv_nota: string
  capag_poupcorr: string
  capag_poupcorr_nota: string
  capag_liquidez: string
  capag_liquidez_nota: string
  receita_propria: string
  divida: string
  /** Coluna usada para o valor em `divida` (texto); ex.: proxy PNC vs dívida consolidada CAPAG. */
  divida_fonte?: 'divida_consolidada' | 'passivo_nao_circulante' | null
  pib_municipal: string
  dependencia_transf: string
  populacao: string
  idh: string
  /** Uma linha: ano-base CAPAG / exercício fiscal para o PDF e conferência. */
  fiscal_contexto_referencia: string
  incentivos: {
    programa_estadual: string
    linhas_bndes: number
    /** Rótulos das linhas `linhas_bndes` (PDF e cópia). */
    linhas_bndes_nomes?: string[]
  }
  cfem_historico: CfemHistoricoItem[]
  /** Atribuicao CFEM ao processo: nunca OK ate haver fonte por processo na base. */
  cfem_processo_status?: CfemProcessoStatus

  // Maturidade
  estagio: string
  estagio_index: number

  // Meta
  data_relatorio: string
  versao: string

  /** v2.1 — contexto explícito para prompts LLM (espelha fase/regime formatados). */
  fase_processo?: string
  regime_display?: string
  capag_nota_final?: string
  capag_indicadores?: {
    endividamento?: { valor: string; nota: string }
    poupanca_corrente?: { valor: string; nota: string }
    liquidez?: { valor: string; nota: string }
  }
  /** Resumo regulatório para cruzamento SEI nos blocos risco/oportunidade. */
  dados_sei?: {
    nup?: string
    portaria_dou?: string
    licenca_ambiental?: string
    tah_pago?: string
    certidao?: string
    plano_lavra?: string
    plano_fechamento?: string
    ultimo_despacho?: string
  }
  /** Indicador cujo nota define o pior patamar (CAPAG parcial). */
  capag_pior_indicador_nome?: string
  /** Pior nota A-D entre indicadores quando a nota global é n.d. */
  capag_pior_indicador_letra?: string

  /** Idioma do PDF exportado (template + LLM). */
  lang: ReportLang
}

// Tipos de resposta do LLM
export interface SumarioLLM {
  headline: string
  lead: string
  veredito_texto: string
  ponto_atencao: string | null
}

export interface TerritorioLLM {
  headline: string
  lead: string
  logistica_texto: string
  implicacao: string
}

export interface MercadoLLM {
  headline: string
  lead: string
  implicacao: string
}

export interface FiscalLLM {
  headline: string
  lead: string
  cfem_intro: string
  implicacao: string
  /** Uma linha, exibida em destaque âmbar sob o badge CAPAG quando houver nota equivalente. */
  capag_classificacao_equiv?: string | null
}

export interface RiscoLLM {
  headline: string
  lead: string
  dim_geo: string
  dim_amb: string
  dim_soc: string
  dim_reg: string
  leitura: string
}

export interface OportunidadeLLM {
  headline: string
  lead: string
  dim_merc: string
  dim_viab: string
  dim_seg: string
  sintese_p1: string
  sintese_p2: string
  sintese_marcos: string
}

export interface ReportLLMResult {
  sumario: SumarioLLM
  territorio: TerritorioLLM
  mercado: MercadoLLM
  fiscal: FiscalLLM
  risco: RiscoLLM
  oportunidade: OportunidadeLLM
}

/** Alias usado pelo template HTML e pela API. */
export type ReportLLMBlocks = ReportLLMResult
