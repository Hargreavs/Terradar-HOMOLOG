/**
 * Mock rico para o Relatório Completo por processo (p1…p30).
 * Alinhado a `processos.mock.ts`: não importa esse ficheiro para manter o módulo isolado.
 */

import type { ClassificacaoZumbi } from '../types'

/** Chave-valor para card Observações técnicas (SIGMINE / SEI-ANM; Config-Scores v5). */
export interface ObservacoesTecnicasItem {
  label: string
  valor: string | null
}

export interface ObservacoesTecnicas {
  ciclo_regulatorio: ObservacoesTecnicasItem[]
  identificacao: ObservacoesTecnicasItem[]
}

export interface DadosANM {
  fase_atual: string
  data_protocolo: string
  /** Ano do protocolo (SIGMINE pode expor só o ano); prioridade no card. */
  ano_protocolo?: number
  tempo_tramitacao_anos: number
  /** Quando definido (ex.: processo extinto), substitui `tempo_tramitacao_anos` + «anos» na UI. */
  tempo_tramitacao_texto?: string | null
  pendencias: string[]
  ultimo_despacho: string
  data_ultimo_despacho: string
  numero_sei: string
  /** Campos SEI-ANM (processo 864.231/2017 e similares). */
  alvara_vencimento?: string
  alvara_prorrogado_em?: string
  alvara_duracao_anos?: number
  gu_vencida?: boolean
  gu_vencimento?: string
  gu_renovacao_pedido?: string
  gu_renovacao_status?: string
  ral_ultimo_apresentado?: string
  ral_pendente?: string
  taxa_anual_paga?: string
  licenca_ambiental?: string
  /**
   * Quando true, processo é requerimento de grupamento mineiro pendente:
   * sem geom, sem substância e sem município (180 casos). Drawer deve
   * renderizar banner vermelho + ocultar abas que dependem desses dados.
   * Backend preenche via coluna `processos.dados_insuficientes`.
   */
  dados_insuficientes?: boolean
  /**
   * Arquétipo do processo quando `dados_insuficientes=true`. Usado no
   * banner vermelho (copy dinâmica) e nos campos Regime/Fase da aba
   * Processo. NULL para processos normais.
   */
  classificacao_zumbi?: ClassificacaoZumbi | null
}

export type BiomaRelatorio =
  | 'Amazônia'
  | 'Cerrado'
  | 'Caatinga'
  | 'Mata Atlântica'
  | 'Pampa'
  | 'Pantanal'

/** Territorial v6 (PostGIS + shapefiles oficiais; Config-Scores). */
export interface DadosTerritoriais {
  distancia_ti_km: number | null
  nome_ti_proxima: string | null
  /** Fase FUNAI (ex.: Regularizada); habilita rótulo TI Nome (Fase). */
  fase_ti?: string | null
  modalidade_ti?: string | null
  etnia_ti?: string | null
  uf_ti?: string | null
  municipios_ti?: string | null
  superficie_ti_ha?: number | null
  distancia_uc_km?: number | null
  nome_uc_proxima?: string | null
  tipo_uc?: string | null
  /** UC uso sustentável (explícito; fallback: `nome_uc_proxima` / `tipo_uc` / `distancia_uc_km`). */
  nome_uc_us_proxima?: string | null
  tipo_uc_us?: string | null
  categoria_uc_us?: string | null
  esfera_uc_us?: string | null
  uf_uc_us?: string | null
  municipios_uc_us?: string | null
  area_uc_us_ha?: number | null
  ano_criacao_uc_us?: number | null
  distancia_uc_us_km?: number | null
  /** UC proteção integral mais próxima (linha extra no card Áreas sensíveis). */
  nome_uc_pi_proxima?: string | null
  tipo_uc_pi?: string | null
  categoria_uc_pi?: string | null
  esfera_uc_pi?: string | null
  uf_uc_pi?: string | null
  municipios_uc_pi?: string | null
  area_uc_pi_ha?: number | null
  ano_criacao_uc_pi?: number | null
  distancia_uc_pi_km?: number | null
  distancia_aquifero_km?: number | null
  nome_aquifero?: string | null
  unidade_hidrogeologica?: string | null
  /** @deprecated v6: não exibir no relatório */
  litologia_aquifero?: string | null
  espessura_aquifero?: string | null
  vazao_aquifero?: string | null
  produtividade_aquifero?: string | null
  /** Quando true, polígono sobrepõe o aquífero (card enriquecido). */
  sobreposicao_aquifero?: boolean
  bioma: BiomaRelatorio | string
  /** @deprecated Preferir `distancia_sede_km` + `nome_sede`. */
  distancia_sede_municipal_km?: number
  distancia_sede_km?: number
  nome_sede?: string
  uf_sede?: string
  distancia_ferrovia_km?: number | null
  nome_ferrovia?: string | null
  /** Ferrovia mais próxima é apenas projeto em estudo (sem operação). */
  ferrovia_apenas_projeto_em_estudo?: boolean
  /** Menor distância entre ferrovias com operação declarada (exclui categoria "Estudo"). */
  distancia_ferrovia_operacional_km?: number | null
  situacao_ferrovia?: string
  bitola_ferrovia?: string
  uf_ferrovia?: string
  nome_rodovia?: string
  tipo_rodovia?: string
  uf_rodovia?: string
  distancia_rodovia_km?: number
  distancia_porto_km?: number | null
  nome_porto?: string | null
  tipo_porto?: string
  uf_porto?: string
  rio_porto?: string
  sobreposicao_app: boolean
  /** Ex.: contexto quando APP não foi identificada no polígono. */
  observacao_app?: string | null
  sobreposicao_quilombola: boolean
  nome_quilombola?: string | null
  /** Nome do quilombo sem distância embutida (card padronizado). */
  nome_quilombola_proximo?: string | null
  uf_quilombola?: string | null
  municipios_quilombola?: string | null
  area_ha_quilombola?: number | null
  familias_quilombola?: number | null
  fase_quilombola?: string | null
  responsavel_quilombola?: string | null
  esfera_quilombola?: string | null
  distancia_quilombola_km?: number | null
}

/** Alias documental (Config-Scores / prompts territoriais). */
export type Territorial = DadosTerritoriais

export interface ProcessoVizinho {
  numero: string
  titular: string
  substancia: string
  fase: string
  distancia_km: number | null
  area_ha: number
  /** Opcional (tabela 864.231/2017 não exibe RISK). */
  risk_score?: number | null
}

/** Unidade de cotação da substância (Master-Substâncias). */
export type UnidadePrecoIntel = 'oz' | 'lb' | 'ct' | 'L' | 't'

/** Demanda 2030 com título e itens; rodapé de fonte no `FonteLabel` do card. */
export interface DemandaProjetadaEstruturada {
  titulo: string
  itens: string[]
}

export interface IntelMineral {
  substancia_contexto: string
  /** `master_substancias.fonte_res_prod`; `SEM_FONTE_OFICIAL:` desativa percentuais no card Contexto global. */
  fonte_res_prod?: string | null
  reservas_brasil_mundial_pct: number
  producao_brasil_mundial_pct: number
  demanda_projetada_2030: string
  /**
   * Quando presente, a UI exibe lista estruturada em vez do parágrafo único
   * em `demanda_projetada_2030` (mantido para compatibilidade / busca).
   */
  demanda_projetada_estruturada?: DemandaProjetadaEstruturada
  preco_medio_usd_t: number
  /**
   * Unidade de cotação exibida no card de preço (`oz` ouro/prata; `ct` diamantes; `L` águas; `t` padrão).
   * Se omitido, a UI assume `t`.
   */
  unidade_preco?: UnidadePrecoIntel
  /** USD/oz quando `unidade_preco === 'oz'`. */
  preco_referencia_usd_oz?: number
  tendencia_preco: 'alta' | 'estavel' | 'queda'
  aplicacoes_principais: string[]
  paises_concorrentes: string[] | null
  estrategia_nacional: string
  /** Parágrafos separados (opcional); se ausente, usa `estrategia_nacional` ou quebras `\n\n`. */
  estrategia_nacional_itens?: string[]
  potencial_reserva_estimado_t: number | null
  /** Total in-situ legado (Mi USD); ainda usado em scores / agregados. O card Inteligência usa `valor_estimado_usd_ha` por hectare. */
  valor_estimado_usd_mi: number
  /** USD/ha — valor in-situ teórico por hectare (exibição principal do card; não multiplicar pela área). */
  valor_estimado_usd_ha?: number
  /** BRL/ha (valor absoluto por hectare; ex.: geo.fiscal.val_reserva_brl_ha). Quando presente, o card BRL usa direto (÷ 1e9 → bi/ha). */
  valor_estimado_brl_ha?: number
  /** Trilhões BRL (estimativa in-situ total); legado / compatível; BRL/ha no UI deriva de USD/ha × câmbio ou deste total ÷ área. */
  valor_estimado_brl_tri?: number
  metodologia_estimativa: string
  processos_vizinhos: ProcessoVizinho[]
  /** Complemento local (ouro): ≈ R$ / g a partir de USD/oz e câmbio. */
  preco_referencia_brl_g?: number
  /** Câmbio BRL/USD para legenda (ex. PTAX futuro). */
  cambio_brl_usd?: number
  cambio_data?: string
  cambio_nota?: string
  /** Variação 1 ano (%). Fonte: IMF PCPS ou USGS MCS. */
  var_1a_pct?: number
  /** CAGR 5 anos (%). Fonte: IMF PCPS ou USGS MCS. */
  cagr_5a_pct?: number
  /** `master_substancias.tipo_mercado` — `BR_ONLY` → card «Contexto Brasil». */
  tipo_mercado?: string | null
  producao_br_absoluta_t?: number | null
  valor_producao_br_brl?: number | null
  preco_medio_br_brl_t?: number | null
  top_uf_produtora?: string | null
  top_uf_pct?: number | null
  ano_referencia_amb?: number | null
}

export interface CfemHistorico {
  ano: number
  valor_recolhido_brl: number
}

/** CFEM total recebido pelo município (todos os processos minerários), por ano. */
export interface CfemMunicipalHistorico {
  ano: number
  valor_total_municipio_brl: number
  /** Referência ANM (substâncias no total municipal). */
  substancias?: string
}

/** Indicador CAPAG (STN) para exibição em linhas no card fiscal. */
export interface CapagIndicadorFiscal {
  label: string
  valor: string
  nota: string
}

/** Layout estruturado do card CAPAG (opcional; senão usa só `capag_descricao`). */
export interface CapagEstruturado {
  resumo: string
  indicadores: CapagIndicadorFiscal[]
  rodape?: string
}

export interface DadosFiscaisRicos {
  /** Nota global CAPAG (A–D) ou textos STN como «n.d.» / «n.e.». */
  capag: string
  capag_descricao: string
  capag_estruturado?: CapagEstruturado
  receita_propria_mi: number
  divida_consolidada_mi: number
  /** Texto alinhado ao PDF (`ReportData.divida`), ex.: «R$ 7,47 Mi» ou «Não disponível». */
  divida_exibicao?: string
  /** Coluna de origem em `fiscal_municipios` para o valor da dívida. */
  divida_fonte?: 'divida_consolidada' | 'passivo_nao_circulante' | null
  pib_municipal_mi: number
  dependencia_transferencias_pct: number
  /** IDH municipal (IBGE), texto pt-BR ex.: «0,620»; opcional quando só há mock. */
  idh_municipal?: string
  /** CFEM recolhida pelo processo (ANM), por ano. */
  cfem_processo: CfemHistorico[]
  /** CFEM total do município (todas as substâncias), por ano. */
  cfem_municipio: CfemHistorico[]
  /** Legado: espelho de `cfem_processo` (compat). */
  cfem_historico: CfemHistorico[]
  /** Atribuição de CFEM ao processo: só `OK` quando houver fonte por processo na base. */
  cfem_processo_status?:
    | 'PROCESSO_NAO_PRODUTIVO'
    | 'SEM_DADO_INDIVIDUALIZADO'
    | 'OK'
    | null
  cfem_total_5anos_mi: number
  cfem_municipal_historico: CfemMunicipalHistorico[]
  incentivos_estaduais: string[]
  linhas_bndes: string[]
  aliquota_cfem_pct: number
  /** CFEM teórica por hectare (BRL absoluto; ex.: 44_200_000 ≈ R$ 44,2 Mi/ha). */
  cfem_estimada_ha: number
  observacao: string
  /** Linha opcional: ano-base CAPAG / exercício SICONFI (TERRADAR 12.05). */
  contexto_referencia_fiscal?: string
  /** Pior nota entre indicadores (A-D), para classificação equivalente quando nota global é n.d. */
  capag_pior_indicador_letra?: string
  /** Nome do indicador limitante (ex.: poupança corrente). */
  capag_pior_indicador_nome?: string
  /** Tier 1: totais da view (para subtítulo do painel). */
  cfem_num_lancamentos?: number
  cfem_total_historico_brl?: number | null
  cfem_ultimo_ano?: number | null
  /** Tier 1: detalhe CFEM por município (ANM dados abertos), quando houver lançamentos. */
  cfem_por_municipio_tier1?: Array<{
    ano: number
    municipio_nome: string
    total_anual_brl: number
    num_lancamentos: number
  }>
  /** Tier 1: autuações fiscais ANM agregadas ao processo. */
  autuacoes_anm?: {
    num: number
    valor_total_brl: number | null
  } | null
}

export interface Timestamps {
  cadastro_mineiro: string
  sigmine: string
  cfem: string
  terras_indigenas: string
  unidades_conservacao: string
  siconfi: string
  cfem_municipal: string
  usgs: string
  preco_spot: string
  alertas_legislativos: string
}

/** Metadados de auditoria (processo 864.231/2017 e similares). */
export interface RelatorioMetadata {
  fonte_sigmine?: string
  fonte_precos?: string
  fonte_reservas?: string
  fonte_territorial?: string
  fonte_fiscal?: string
  fonte_car?: string
  fonte_demanda?: string
  cambio?: number
  cambio_data?: string
  cambio_nota?: string
  calculado_em?: string
  versao_config?: string
  nota_alertas?: string
  nota_postgis?: string
}

export type PerfilOportunidadeId = 'conservador' | 'moderado' | 'arrojado'

export interface PerfilOportunidadeMock {
  /** `null` quando o processo não tem Opportunity Score calculado (drawer exibe empty state). */
  valor: number | null
  label: string
  cor: string
  pesos: { atratividade: number; viabilidade: number; seguranca: number }
}

export interface DimensaoOSMock {
  valor: number
  cor: string
}

export interface VariavelOportunidadeMock {
  nome: string
  valor: number
  peso: number
  dado?: string
  texto: string
  /** Bruto antes do peso; define faixa de cor na decomposição (alto = bom). */
  valor_bruto?: number
  /** Valor baixo com leitura neutra (ex.: ausência de alertas favoráveis com peso pequeno). */
  impacto_neutro?: boolean
}

export interface RelatorioOportunidadeData {
  perfis: Record<PerfilOportunidadeId, PerfilOportunidadeMock>
  dimensoes: {
    atratividade: DimensaoOSMock
    viabilidade: DimensaoOSMock
    seguranca: DimensaoOSMock
  }
  decomposicao: {
    atratividade: VariavelOportunidadeMock[]
    viabilidade: VariavelOportunidadeMock[]
    seguranca: VariavelOportunidadeMock[]
  }
  cruzamento: {
    tipo: 'analise'
    /** Parágrafo de abertura. */
    abertura: string
    /** Parágrafo com Risk Score e Opportunity Score; números destacados via `rs` e `os`. */
    explicacao: string
    /** Contexto regional e técnico. */
    contexto: string
    /** Data da assinatura (ex.: DD/MM/AAAA). */
    data: string
    /** `null` quando não há Risk Score calculado (empty state assume o drawer). */
    rs: number | null
    /** `null` quando não há Opportunity Score calculado. */
    os: number | null
  }
}

/** Rótulos/cores de scores alinhados ao `ReportData` / banco (substituem faixa só pelo número). */
export interface RelatorioScoresExibicaoApi {
  rs_label: string
  rs_cor: string
  os_label: string
  os_cor: string
}

export interface RelatorioData {
  processo_id: string
  dados_anm: DadosANM
  observacoes_tecnicas: ObservacoesTecnicas
  territorial: DadosTerritoriais
  intel_mineral: IntelMineral
  fiscal: DadosFiscaisRicos
  timestamps: Timestamps
  metadata?: RelatorioMetadata
  oportunidade?: RelatorioOportunidadeData
  /** Preenchido por `relatorioDataFromReportData` quando o relatório vem da API. */
  scores_exibicao_api?: RelatorioScoresExibicaoApi
  /** Título do card principal da aba Oportunidade (substitui "Opportunity Score" quando definido). */
  oportunidade_secao_titulo?: string
}

const PROF_M = 30
const DENS_T_M3 = 2.5
/** Fração da reserva assumida como produzida por ano (mock CFEM). */
const PRODUCAO_ANUAL_PCT = 0.08

function substChaveNormalizada(subst: string): string {
  return subst
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/**
 * Teor em massa (fração): terras raras (Nd, Pr, Tb, Dy) 0,08%; nióbio 0,3%; ferro 12%;
 * cobre 0,8%; ouro 0,0015%; quartzo 8%; bauxita 15%; níquel 1%; lítio 0,008% (mock).
 */
function teorDecimal(subst: string): number {
  const u = substChaveNormalizada(subst)
  if (u.includes('OURO')) return 0.000015
  if (['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO'].includes(u)) return 0.0008
  if (u === 'LITIO') return 0.00008
  if (u === 'NIOBIO') return 0.003
  if (u === 'FERRO') return 0.12
  if (u === 'COBRE') return 0.008
  if (u === 'QUARTZO') return 0.08
  if (u === 'BAUXITA') return 0.15
  if (u === 'NIQUEL') return 0.01
  return 0.01
}

/** volume_m3 × densidade × teor (t). */
function potencialReservaT(areaHa: number, subst: string): number {
  const volumeM3 = areaHa * 10_000 * PROF_M
  return volumeM3 * DENS_T_M3 * teorDecimal(subst)
}

/**
 * valor_estimado_usd_mi = (pot × preço) / 1e6; REE enquadrados 5–80 Mi (pesquisa).
 */
function valorEstimadoUsdMi(pot: number, precoUsdT: number, subst: string): number {
  const raw = (pot * precoUsdT) / 1_000_000
  const v = Math.round(raw)
  const u = substChaveNormalizada(subst)
  if (['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO'].includes(u)) {
    return Math.min(80, Math.max(5, v))
  }
  if (u === 'LITIO' || u === 'NIOBIO') {
    return Math.min(80, Math.max(1, v))
  }
  return v
}

/** Valores em milhões de R$ por ano; convertidos para BRL absoluto no mock. */
const CFEM_MUNICIPAL_MI_POR_UF: Record<string, number[]> = {
  MG: [28.5, 32.1, 38.7, 41.2, 36.8],
  PA: [15.2, 18.9, 24.3, 27.1, 25.6],
  GO: [8.4, 9.1, 11.5, 12.8, 11.9],
  BA: [5.1, 6.3, 8.7, 9.4, 10.2],
  AM: [22.0, 25.3, 30.1, 38.5, 42.0],
  MT: [3.2, 4.1, 5.8, 7.2, 8.5],
  TO: [0.6, 0.72, 0.85, 0.91, 1.05],
}

function cfemMunicipalHistoricoPara(uf: string): CfemMunicipalHistorico[] {
  const anos = [2020, 2021, 2022, 2023, 2024]
  const miPorAno = CFEM_MUNICIPAL_MI_POR_UF[uf] ?? CFEM_MUNICIPAL_MI_POR_UF.MG!
  return anos.map((ano, i) => ({
    ano,
    valor_total_municipio_brl: Math.round(miPorAno[i]! * 1_000_000),
  }))
}

function capagDescricao(c: DadosFiscaisRicos['capag']): string {
  const m: Record<DadosFiscaisRicos['capag'], string> = {
    A: 'Município com finanças equilibradas: baixo risco de inadimplência e capacidade de honrar incentivos fiscais',
    B: 'Situação fiscal satisfatória: pequenas restrições de endividamento sem impacto significativo',
    C: 'Capacidade de pagamento comprometida: incentivos fiscais sujeitos a revisão orçamentária',
    D: 'Município em situação fiscal crítica: alto risco de descontinuidade de incentivos prometidos',
  }
  return m[c]
}

function territorialPorUf(uf: string, seed: number): DadosTerritoriais {
  const r = (a: number, b: number) => a + (seed % 1000) * ((b - a) / 1000)

  switch (uf) {
    case 'PA':
      return {
        distancia_ti_km: r(15, 80),
        nome_ti_proxima: seed % 3 === 0 ? 'TI Kayapó' : 'TI Munduruku',
        distancia_uc_km: r(25, 95),
        nome_uc_proxima:
          seed % 2 === 0
            ? 'Parque Nacional da Serra do Pardo'
            : 'Floresta Nacional do Tapirapé-Aquiri',
        tipo_uc: seed % 2 === 0 ? 'Proteção integral' : 'Uso sustentável',
        distancia_aquifero_km: r(8, 45),
        nome_aquifero: 'Aquífero Alter do Chão',
        bioma: 'Amazônia',
        distancia_sede_municipal_km: r(12, 68),
        distancia_ferrovia_km: r(20, 150),
        nome_ferrovia: 'EF Carajás',
        distancia_porto_km: r(180, 420),
        nome_porto: 'Porto de Vila do Conde',
        sobreposicao_app: seed % 4 !== 0,
        sobreposicao_quilombola: seed % 5 === 0,
        nome_quilombola: seed % 5 === 0 ? 'Território quilombola Rio Acará' : null,
      }
    case 'GO':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(40, 120),
        nome_uc_proxima: 'APA dos Pirineus',
        tipo_uc: 'Área de Proteção Ambiental (APA)',
        distancia_aquifero_km: null,
        nome_aquifero: null,
        bioma: 'Cerrado',
        distancia_sede_municipal_km: r(8, 55),
        distancia_ferrovia_km: r(30, 120),
        nome_ferrovia: 'Ferrovia Norte-Sul',
        distancia_porto_km: r(900, 1100),
        nome_porto: 'Porto de Santos',
        sobreposicao_app: seed % 3 === 0,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
    case 'MG':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(15, 90),
        nome_uc_proxima:
          seed % 2 === 0
            ? 'APA Serra da Gandarela'
            : 'Parque Estadual do Rio Doce',
        tipo_uc: seed % 2 === 0 ? 'APA' : 'Parque Estadual',
        distancia_aquifero_km: seed % 2 === 0 ? r(20, 80) : null,
        nome_aquifero: seed % 2 === 0 ? 'Aquífero Bambuí' : null,
        bioma: seed % 2 === 0 ? 'Cerrado' : 'Mata Atlântica / Cerrado',
        distancia_sede_municipal_km: r(10, 45),
        distancia_ferrovia_km: r(10, 80),
        nome_ferrovia: seed % 2 === 0 ? 'EF Vitória a Minas' : 'MRS Logística',
        distancia_porto_km: r(200, 600),
        nome_porto: 'Porto de Tubarão (Vitória)',
        sobreposicao_app: seed % 4 === 0,
        sobreposicao_quilombola: seed % 7 === 0,
        nome_quilombola: seed % 7 === 0 ? 'Quilombo do Campinho' : null,
      }
    case 'BA':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(35, 100),
        nome_uc_proxima: 'APA Chapada Diamantina',
        tipo_uc: 'APA',
        distancia_aquifero_km: null,
        nome_aquifero: null,
        bioma: 'Caatinga',
        distancia_sede_municipal_km: r(6, 40),
        distancia_ferrovia_km: null,
        nome_ferrovia: null,
        distancia_porto_km: r(300, 600),
        nome_porto: 'Porto de Salvador',
        sobreposicao_app: seed % 3 !== 0,
        sobreposicao_quilombola: seed % 6 === 0,
        nome_quilombola: seed % 6 === 0 ? 'Território quilombola Brejões' : null,
      }
    case 'AM':
      return {
        distancia_ti_km: r(5, 40),
        nome_ti_proxima: seed % 2 === 0 ? 'TI Waimiri-Atroari' : 'TI Uatumã',
        distancia_uc_km: r(12, 55),
        nome_uc_proxima: 'UC de proteção integral: entorno de manancial',
        tipo_uc: 'Unidade de Conservação: proteção integral',
        distancia_aquifero_km: r(5, 35),
        nome_aquifero: 'Sistema Aquífero Alter do Chão',
        bioma: 'Amazônia',
        distancia_sede_municipal_km: r(25, 95),
        distancia_ferrovia_km: null,
        nome_ferrovia: null,
        distancia_porto_km: r(80, 300),
        nome_porto: 'Porto de Manaus',
        sobreposicao_app: true,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
    case 'MT':
      return {
        distancia_ti_km: r(30, 100),
        nome_ti_proxima: seed % 2 === 0 ? 'TI Kayabi' : 'TI Munduruku',
        distancia_uc_km: r(28, 85),
        nome_uc_proxima: 'APA Cristalino',
        tipo_uc: 'APA',
        distancia_aquifero_km: r(15, 70),
        nome_aquifero: 'Aquífero Guarani (margem setentrional)',
        bioma: 'Amazônia / Cerrado',
        distancia_sede_municipal_km: r(15, 55),
        distancia_ferrovia_km: null,
        nome_ferrovia: null,
        distancia_porto_km: r(1400, 1600),
        nome_porto: 'Porto de Santos (corredor rodoviário)',
        sobreposicao_app: seed % 2 === 0,
        sobreposicao_quilombola: seed % 5 === 0,
        nome_quilombola: seed % 5 === 0 ? 'Quilombo Rio Arinos' : null,
      }
    case 'TO':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: 12.5,
        nome_uc_proxima: 'UC de uso sustentável (referência regional)',
        tipo_uc: 'Uso sustentável',
        distancia_aquifero_km: 3.2,
        nome_aquifero: 'Bacia do Parnaíba / Grupo Bambuí',
        bioma: 'Cerrado',
        distancia_sede_municipal_km: 15,
        distancia_ferrovia_km: 150,
        nome_ferrovia: 'Ferrovia Norte-Sul (FNS)',
        distancia_porto_km: 1200,
        nome_porto: 'Porto de Itaqui (MA)',
        sobreposicao_app: false,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
    default:
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(20, 80),
        nome_uc_proxima: 'UC genérica estadual',
        tipo_uc: 'APA',
        distancia_aquifero_km: null,
        nome_aquifero: null,
        bioma: 'Cerrado',
        distancia_sede_municipal_km: 25,
        distancia_ferrovia_km: 40,
        nome_ferrovia: 'Malha ferroviária regional',
        distancia_porto_km: 500,
        nome_porto: 'Porto costeiro',
        sobreposicao_app: false,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
  }
}

function pendenciasPorRegime(
  regime: string,
  situacao: string,
): string[] {
  if (situacao === 'bloqueado') {
    if (regime === 'bloqueio_permanente') {
      return [
        'Determinação judicial de suspensão de atividades',
        'Sobreposição com TI não homologada: análise jurídica em curso',
      ]
    }
    return [
      'Bloqueio provisório: determinação administrativa em vigor',
      'Sobreposição com área sensível aguardando deslinde',
    ]
  }
  switch (regime) {
    case 'autorizacao_pesquisa':
      return [
        'Relatório Final de Pesquisa não entregue no prazo regulamentar',
        'DIPEM em atraso: exercício 2024',
        'Vistoria de campo pendente de homologação',
      ]
    case 'concessao_lavra':
      return [
        'RAL 2024 não entregue ou com pendências de esclarecimento',
        'TAH com débito em aberto: regularização junto à ANM',
        'Plano de Fechamento de Mina desatualizado face ao cronograma real',
      ]
    case 'req_lavra':
      return [
        'Aguardando parecer conclusivo do IBAMA',
        'Documentação ambiental incompleta: complementação solicitada',
      ]
    case 'licenciamento':
      return [
        'EIA/RIMA em análise técnica conjunta',
        'Audiência pública agendada: condicionante ao licenciamento',
      ]
    case 'mineral_estrategico':
      return ['Pendência administrativa menor: atualização cadastral SEI']
    default:
      return ['Acompanhamento de exigências normativas em trâmite']
  }
}

function aliquotaCfemPct(subst: string): number {
  const u = substChaveNormalizada(subst)
  if (['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO', 'LITIO'].includes(u))
    return 3
  if (u === 'FERRO') return 3.5
  if (u === 'OURO' || u.includes('OURO')) return 1.5
  return 2
}

function cfemHistorico(
  areaHa: number,
  subst: string,
  regime: string,
  incluir: boolean,
): { historico: CfemHistorico[]; totalMi: number; aliquota: number } {
  const aliquota = aliquotaCfemPct(subst)
  if (!incluir) {
    return { historico: [], totalMi: 0, aliquota }
  }
  const anos = [2020, 2021, 2022, 2023, 2024]
  const u = substChaveNormalizada(subst)
  const mineralEstrategicoRegime = regime === 'mineral_estrategico'
  const tr =
    mineralEstrategicoRegime ||
    ['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO', 'NIOBIO', 'LITIO'].includes(
      u,
    )

  let valores: number[]
  if (u === 'FERRO' && areaHa > 800) {
    valores = [2_800_000, 3_100_000, 3_400_000, 3_900_000, 4_200_000]
  } else if (u === 'FERRO') {
    valores = [890_000, 1_100_000, 1_300_000, 1_500_000, 1_700_000]
  } else if (tr) {
    valores = [340_000, 410_000, 520_000, 680_000, 890_000]
  } else {
    valores = [120_000, 145_000, 180_000, 210_000, 260_000]
  }

  const historico = anos.map((ano, i) => ({
    ano,
    valor_recolhido_brl: valores[i]!,
  }))
  const totalMi =
    Math.round(
      (historico.reduce((s, h) => s + h.valor_recolhido_brl, 0) / 1_000_000) *
        10,
    ) / 10
  return { historico, totalMi, aliquota }
}

function intelPorSubstancia(
  subst: string,
  areaHa: number,
  _processoId: string,
): Omit<IntelMineral, 'processos_vizinhos'> {
  const pot = potencialReservaT(areaHa, subst)

  const rareEarth = (): Omit<IntelMineral, 'processos_vizinhos'> => {
    const u = substChaveNormalizada(subst)
    const preco =
      u === 'DISPROSIO'
        ? 290_000
        : u === 'NEODIMIO'
          ? 68_000
          : u === 'PRASEODIMIO'
            ? 82_000
            : u === 'TERBIO'
              ? 1_200_000
              : 68_000
    const estrategiaMME =
      'Decreto MME 11.892/2025: mineral crítico prioritário. Brasil negocia fornecimento processado para EUA e UE.'
    let aplicacoes: string[]
    if (u === 'NEODIMIO') {
      aplicacoes = [
        'Veículos elétricos',
        'Turbinas eólicas',
        'Defesa e aeroespacial',
        'Eletrônicos de consumo',
      ]
    } else if (u === 'PRASEODIMIO') {
      aplicacoes = ['Ímãs permanentes', 'Ligas de alta resistência', 'Catalisadores']
    } else if (u === 'TERBIO') {
      aplicacoes = [
        'Displays OLED',
        'Lâmpadas de eficiência energética',
        'Sonar militar',
      ]
    } else if (u === 'DISPROSIO') {
      aplicacoes = [
        'Motores de veículos elétricos',
        'Turbinas eólicas offshore',
        'Equipamentos militares',
      ]
    } else {
      aplicacoes = [
        'Veículos elétricos',
        'Turbinas eólicas',
        'Defesa e aeroespacial',
        'Eletrônicos de consumo',
      ]
    }
    return {
      substancia_contexto: `${subst}: terras raras de interesse estratégico para cadeias de magnetos e eletrônica.`,
      reservas_brasil_mundial_pct: 23,
      producao_brasil_mundial_pct: 0.8,
      demanda_projetada_2030:
        'Demanda global projetada +12–18% a.a. até 2030, puxada por VE, eólica e defesa.',
      preco_medio_usd_t: preco,
      unidade_preco: 't',
      tendencia_preco: 'alta',
      aplicacoes_principais: aplicacoes,
      paises_concorrentes: [
        'China (~60% da produção mundial)',
        'Austrália',
        'Estados Unidos',
      ],
      estrategia_nacional: estrategiaMME,
      potencial_reserva_estimado_t: Math.round(pot),
      valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
      metodologia_estimativa:
        'Volume = área (ha)×10⁴×profundidade (30 m)×densidade (2,5 t/m³)×teor; massa mineral = volume×densidade×teor; valor USD (Mi) = potencial×preço/10⁶; REE enquadrados 5–80 Mi em fase de pesquisa.',
    }
  }

  switch (substChaveNormalizada(subst)) {
    case 'NEODIMIO':
    case 'PRASEODIMIO':
    case 'TERBIO':
    case 'DISPROSIO':
      return rareEarth()
    case 'NIOBIO': {
      const preco = 41_000
      return {
        substancia_contexto:
          'Nióbio: Brasil detém posição dominante em reservas; foco em aços especiais e ligas.',
        reservas_brasil_mundial_pct: 94,
        producao_brasil_mundial_pct: 88,
        demanda_projetada_2030:
          'Demanda estável a moderadamente crescente em infraestrutura e baterias avançadas.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'estavel',
        aplicacoes_principais: [
          'Aço de alta resistência',
          'Superligas aeroespaciais',
          'Baterias de nova geração',
        ],
        paises_concorrentes: ['Brasil', 'Canadá'],
        estrategia_nacional:
          'Brasil domina 94% das reservas e 88% da produção mundial. CBMM referência global.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Volume 30 m, densidade 2,5 t/m³, teor 0,3% Nb; valor = potencial×preço/10⁶ (teto 80 Mi USD no mock).',
      }
    }
    case 'FERRO': {
      const preco = 110
      return {
        substancia_contexto: 'Minério de ferro: commodity global com pricing benchmark 62% Fe.',
        reservas_brasil_mundial_pct: 12,
        producao_brasil_mundial_pct: 15,
        demanda_projetada_2030:
          'Crescimento moderado ligado a China e infraestrutura emergente; volatilidade cíclica.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'queda',
        aplicacoes_principais: [
          'Siderurgia',
          'Construção civil',
          'Manufatura industrial',
        ],
        paises_concorrentes: ['Austrália', 'Brasil', 'África do Sul'],
        estrategia_nacional:
          'Política de valor agregado e logística ferroviária/portuária; CPAs e desmatamento zero na mira regulatória.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 12% Fe em massa; volume útil 30 m; massa = volume×2,5×teor; valor = potencial×preço/10⁶.',
      }
    }
    case 'COBRE': {
      const preco = 9200
      return {
        substancia_contexto:
          'Cobre: metal da transição energética (cabeamento, VE, renováveis).',
        reservas_brasil_mundial_pct: 4,
        producao_brasil_mundial_pct: 3,
        demanda_projetada_2030:
          'Projeção IEA: déficit estrutural possível após 2028 sem novos projetos greenfield.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Energia elétrica',
          'Veículos elétricos',
          'Telecomunicações',
          'Construção civil',
        ],
        paises_concorrentes: ['Chile', 'Peru', 'Congo', 'China'],
        estrategia_nacional:
          'Programas de mapeamento mineral e incentivo a estudos de viabilidade em províncias polimetálicas.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 0,8% Cu; profundidade 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'MINERIO DE OURO':
    case 'OURO': {
      const preco = 62_000
      const isMinerioOuro = substChaveNormalizada(subst) === 'MINERIO DE OURO'
      return {
        substancia_contexto: isMinerioOuro
          ? 'Minério de ouro: reserva de valor e insumo eletrônico (referência SIGMINE / TERRADAR 864.231/2017).'
          : 'Ouro: reserva de valor e insumo eletrônico de alta pureza.',
        reservas_brasil_mundial_pct: isMinerioOuro ? 3.8 : 3,
        producao_brasil_mundial_pct: isMinerioOuro ? 2.4 : 3,
        demanda_projetada_2030: isMinerioOuro
          ? 'Brasil detém 3,8% das reservas mundiais de ouro mas produz apenas 2,4%. Gap positivo de +1,4 p.p. indica potencial de expansão (USGS MCS 2026, referência auditada).'
          : 'Demanda firme de joias e ETFs; componente industrial estável.',
        preco_medio_usd_t: preco,
        unidade_preco: 'oz',
        preco_referencia_usd_oz: isMinerioOuro ? 4862.76 : 2050,
        tendencia_preco: isMinerioOuro ? 'estavel' : 'alta',
        aplicacoes_principais: [
          'Reserva de valor',
          'Eletrônicos',
          'Joalheria',
          'Medicina',
        ],
        paises_concorrentes: ['China', 'Austrália', 'Rússia', 'Canadá'],
        estrategia_nacional:
          'Rastreabilidade da cadeia produtiva (LGPD e compliance LBMA) e combate ao garimpo ilegal. Formalização de pequenos produtores via cooperativas (PNM 2030 / Decreto 10.966/2022).',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: isMinerioOuro
          ? 938_047
          : valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa: isMinerioOuro
          ? 'Estimativa in-situ conservadora: 5 g/t Au; 1 ha × 30 m × 2,5 t/m³ × teor × preço (IMF PCPS 2026-M03). Valor econômico real depende de cubagem, recuperação e custos.'
          : 'Teor 0,0015% Au; volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'QUARTZO': {
      const preco = 45
      return {
        substancia_contexto:
          'Quartzo / sílica: insumo para vidro, fundição e silício metalúrgico.',
        reservas_brasil_mundial_pct: 8,
        producao_brasil_mundial_pct: 5,
        demanda_projetada_2030:
          'Crescimento com painéis solares e fundições; pressão de custo em logística.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'estavel',
        aplicacoes_principais: ['Semicondutores', 'Vidro', 'Cerâmica industrial'],
        paises_concorrentes: ['China', 'Estados Unidos', 'Turquia'],
        estrategia_nacional:
          'Integração com parque solar e cerâmica; exigências de licenciamento ambiental municipal.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 8% em massa (produto sílica); volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'BAUXITA': {
      const preco = 32
      return {
        substancia_contexto: 'Bauxita: matéria-prima da alumina e alumínio.',
        reservas_brasil_mundial_pct: 11,
        producao_brasil_mundial_pct: 9,
        demanda_projetada_2030:
          'Demanda acompanha construção civil e embalagens; ciclo ligado ao PIB chinês.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'estavel',
        aplicacoes_principais: ['Alumínio', 'Refratários', 'Abrasivos'],
        paises_concorrentes: ['Guiné', 'Austrália', 'Brasil', 'Jamaica'],
        estrategia_nacional:
          'Expansão de refinarias costeiras e logística mineral; atenção a licenças de supressão em Cerrado.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 15% em massa (Al2O3 equivalente); volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'LITIO': {
      const preco = 18_000
      return {
        substancia_contexto:
          'Lítio: insumo crítico para baterias de íon-lítio e armazenamento.',
        reservas_brasil_mundial_pct: 1.5,
        producao_brasil_mundial_pct: 0.2,
        demanda_projetada_2030:
          'Crescimento acelerado 15–25% a.a. até 2030 em baterias e estacionárias.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Baterias para VE',
          'Armazenamento em rede',
          'Cerâmica técnica',
        ],
        paises_concorrentes: ['Chile', 'Austrália', 'Argentina', 'China'],
        estrategia_nacional:
          'Inserção em rota estratégica de minerais críticos; prioridade a estudos de salar e pegmatitos com ESG reforçado.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 0,008% Li2O equivalente (mock); volume 30 m; valor = potencial×preço/10⁶ (teto 80 Mi USD).',
      }
    }
    case 'NIQUEL': {
      const preco = 16_000
      return {
        substancia_contexto:
          'Níquel: aço inoxidável e precursores de cátodos para baterias.',
        reservas_brasil_mundial_pct: 12,
        producao_brasil_mundial_pct: 5,
        demanda_projetada_2030:
          'Forte tração de baterias NMC/NCA; oferta Indonesia domina short run.',
        preco_medio_usd_t: preco,
        unidade_preco: 't',
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Baterias de veículos elétricos',
          'Aço inoxidável',
          'Ligas especiais',
        ],
        paises_concorrentes: ['Indonésia', 'Filipinas', 'Rússia', 'Nova Caledónia'],
        estrategia_nacional:
          'Integração com polo de Goiás/Tocantins e incentivos à metalurgia de primeira transformação.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 1% Ni em massa; volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    default:
      return {
        substancia_contexto: `${subst}: commodity mineral com perfil de mercado regional.`,
        reservas_brasil_mundial_pct: 5,
        producao_brasil_mundial_pct: 2,
        demanda_projetada_2030: 'Demanda moderada vinculada ao ciclo industrial.',
        preco_medio_usd_t: 500,
        unidade_preco: 't',
        tendencia_preco: 'estavel',
        aplicacoes_principais: ['Indústria geral'],
        paises_concorrentes: ['Brasil', 'Global'],
        estrategia_nacional: 'Acompanhamento setorial ANM e política mineral.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, 500, subst),
        metodologia_estimativa:
          'Parâmetros genéricos: profundidade 30 m, densidade 2,5 t/m³, teor 1%.',
      }
  }
}

function vizinhosFicticios(
  subst: string,
  _uf: string,
  faseAtual: string,
  risk: number | null,
  id: string,
): ProcessoVizinho[] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const n = 2 + (id.charCodeAt(1) % 3)
  const titulares = [
    'Mineração Horizonte Verde Ltda.',
    'Pedra Branca Mineração SPE',
    'Cerrado Minerais S.A.',
    'Norte Logística Mineral Ltda.',
  ]
  const norm = faseAtual.toLowerCase()
  const fasesAlt = ['pesquisa', 'lavra', 'concessao', 'requerimento'].filter(
    (f) => f !== norm,
  )
  const out: ProcessoVizinho[] = []
  for (let i = 0; i < n; i++) {
    const d = 5 + ((hash + i * 11) % 31)
    const baseRisk = risk ?? 50 + (hash % 31)
    const rs = Math.max(
      12,
      Math.min(92, baseRisk + (i % 2 === 0 ? -9 : 11)),
    )
    const faseV =
      fasesAlt[i % fasesAlt.length] === 'concessao'
        ? 'Concessão'
        : fasesAlt[i % fasesAlt.length] === 'requerimento'
          ? 'Requerimento'
          : fasesAlt[i % fasesAlt.length] === 'lavra'
            ? 'Lavra'
            : 'Pesquisa'
    const ano = 2008 + ((hash + i * 7) % 16)
    const n1 = 200 + ((hash + i * 53) % 800)
    const n2 = 100 + ((hash + i * 41) % 900)
    const numero = `${String(n1).padStart(3, '0')}.${String(n2).padStart(3, '0')}/${ano}`
    out.push({
      numero,
      titular: titulares[i % titulares.length]!,
      substancia: subst,
      fase: faseV,
      distancia_km: d,
      area_ha: Math.round(80 + i * 120 + (id.charCodeAt(2) % 50)),
      risk_score: rs,
    })
  }
  return out
}

type Seed = {
  id: string
  numero: string
  regime: string
  fase: string
  substancia: string
  titular: string
  area_ha: number
  uf: string
  municipio: string
  data_protocolo: string
  ano_protocolo: number
  situacao: string
  risk_score: number | null
}

const SEEDS: Seed[] = [
  {
    id: 'p1',
    numero: '872.390/2012',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'FERRO',
    titular: 'Vale Mineração S.A.',
    area_ha: 1240.5,
    uf: 'MG',
    municipio: 'Itabira',
    data_protocolo: '2012-03-14',
    ano_protocolo: 2012,
    situacao: 'ativo',
    risk_score: 42,
  },
  {
    id: 'p2',
    numero: '841.102/2008',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'OURO',
    titular: 'St. George Mining Brasil',
    area_ha: 892.3,
    uf: 'MG',
    municipio: 'Araxá',
    data_protocolo: '2008-07-22',
    ano_protocolo: 2008,
    situacao: 'ativo',
    risk_score: 67,
  },
  {
    id: 'p3',
    numero: '910.445/2019',
    regime: 'concessao_lavra',
    fase: 'concessao',
    substancia: 'BAUXITA',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 2104.0,
    uf: 'MG',
    municipio: 'Poços de Caldas',
    data_protocolo: '2019-11-05',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 31,
  },
  {
    id: 'p4',
    numero: '798.201/2001',
    regime: 'concessao_lavra',
    fase: 'encerrado',
    substancia: 'COBRE',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 456.7,
    uf: 'MG',
    municipio: 'Montes Claros',
    data_protocolo: '2001-04-18',
    ano_protocolo: 2001,
    situacao: 'inativo',
    risk_score: 18,
  },
  {
    id: 'p5',
    numero: '883.667/2015',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'QUARTZO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 334.2,
    uf: 'MG',
    municipio: 'Diamantina',
    data_protocolo: '2015-09-30',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 55,
  },
  {
    id: 'p6',
    numero: '756.012/1995',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 982.0,
    uf: 'MG',
    municipio: 'Paracatu',
    data_protocolo: '1995-02-10',
    ano_protocolo: 1995,
    situacao: 'ativo',
    risk_score: 48,
  },
  {
    id: 'p7',
    numero: '901.223/2018',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    titular: 'Vale Mineração S.A.',
    area_ha: 1205.4,
    uf: 'MG',
    municipio: 'Governador Valadares',
    data_protocolo: '2018-06-12',
    ano_protocolo: 2018,
    situacao: 'ativo',
    risk_score: 72,
  },
  {
    id: 'p8',
    numero: '822.556/2005',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 678.9,
    uf: 'MG',
    municipio: 'Uberlândia',
    data_protocolo: '2005-08-25',
    ano_protocolo: 2005,
    situacao: 'ativo',
    risk_score: 39,
  },
  {
    id: 'p9',
    numero: '934.881/2021',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'COBRE',
    titular: 'St. George Mining Brasil',
    area_ha: 445.1,
    uf: 'PA',
    municipio: 'Marabá',
    data_protocolo: '2021-01-19',
    ano_protocolo: 2021,
    situacao: 'ativo',
    risk_score: 61,
  },
  {
    id: 'p10',
    numero: '888.334/2016',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 512.6,
    uf: 'PA',
    municipio: 'Parauapebas',
    data_protocolo: '2016-10-03',
    ano_protocolo: 2016,
    situacao: 'ativo',
    risk_score: 44,
  },
  {
    id: 'p11',
    numero: '845.991/2009',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 1334.8,
    uf: 'PA',
    municipio: 'Redenção',
    data_protocolo: '2009-05-27',
    ano_protocolo: 2009,
    situacao: 'ativo',
    risk_score: 53,
  },
  {
    id: 'p12',
    numero: '912.007/2019',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 721.3,
    uf: 'PA',
    municipio: 'Altamira',
    data_protocolo: '2019-04-08',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 58,
  },
  {
    id: 'p13',
    numero: '771.448/1998',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    titular: 'Vale Mineração S.A.',
    area_ha: 889.0,
    uf: 'PA',
    municipio: 'Tucuruí',
    data_protocolo: '1998-12-14',
    ano_protocolo: 1998,
    situacao: 'ativo',
    risk_score: 36,
  },
  {
    id: 'p14',
    numero: '925.112/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'FERRO',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 1567.2,
    uf: 'PA',
    municipio: 'Santarém',
    data_protocolo: '2020-08-21',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 74,
  },
  {
    id: 'p15',
    numero: '918.556/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'OURO',
    titular: 'St. George Mining Brasil',
    area_ha: 623.5,
    uf: 'GO',
    municipio: 'Catalão',
    data_protocolo: '2020-03-02',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 81,
  },
  /* TEMP: alinhado a processos.mock — oculto para screenshot território simulado.
  {
    id: 'p16',
    numero: '867.201/2013',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'COBRE',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 412.8,
    uf: 'GO',
    municipio: 'Minaçu',
    data_protocolo: '2013-11-11',
    ano_protocolo: 2013,
    situacao: 'ativo',
    risk_score: 69,
  },
  {
    id: 'p17',
    numero: '806.778/2003',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'BAUXITA',
    titular: 'Vale Mineração S.A.',
    area_ha: 2341.0,
    uf: 'GO',
    municipio: 'Niquelândia',
    data_protocolo: '2003-07-07',
    ano_protocolo: 2003,
    situacao: 'ativo',
    risk_score: 77,
  },
  {
    id: 'p18',
    numero: '895.334/2017',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'NÍQUEL',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 298.4,
    uf: 'GO',
    municipio: 'Alto Horizonte',
    data_protocolo: '2017-02-28',
    ano_protocolo: 2017,
    situacao: 'ativo',
    risk_score: 41,
  },
  {
    id: 'p19',
    numero: '879.901/2015',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'QUARTZO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 156.2,
    uf: 'GO',
    municipio: 'Barro Alto',
    data_protocolo: '2015-12-01',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 29,
  },
  */
  {
    id: 'p20',
    numero: '802.445/2002',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'FERRO',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 887.6,
    uf: 'GO',
    municipio: 'Goiás',
    data_protocolo: '2002-09-09',
    ano_protocolo: 2002,
    situacao: 'ativo',
    risk_score: 52,
  },
  {
    id: 'p21',
    numero: '940.001/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NEODIMIO',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 198.3,
    uf: 'BA',
    municipio: 'Irecê',
    data_protocolo: '2022-05-16',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 84,
  },
  {
    id: 'p22',
    numero: '941.002/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NIOBIO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 176.5,
    uf: 'BA',
    municipio: 'Jacobina',
    data_protocolo: '2022-06-20',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 79,
  },
  {
    id: 'p23',
    numero: '942.003/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'LITIO',
    titular: 'St. George Mining Brasil',
    area_ha: 245.0,
    uf: 'BA',
    municipio: 'Brumado',
    data_protocolo: '2023-01-11',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 87,
  },
  {
    id: 'p24',
    numero: '943.004/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'DISPRÓSIO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 132.7,
    uf: 'BA',
    municipio: 'Caetité',
    data_protocolo: '2023-08-30',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 82,
  },
  {
    id: 'p25',
    numero: '650.100/1987',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'OURO',
    titular: 'Vale Mineração S.A.',
    area_ha: 88.0,
    uf: 'AM',
    municipio: 'Presidente Figueiredo',
    data_protocolo: '1987-04-22',
    ano_protocolo: 1987,
    situacao: 'bloqueado',
    risk_score: 85,
  },
  {
    id: 'p26',
    numero: '651.101/1991',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'FERRO',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 120.4,
    uf: 'AM',
    municipio: 'Itacoatiara',
    data_protocolo: '1991-09-05',
    ano_protocolo: 1991,
    situacao: 'bloqueado',
    risk_score: 86,
  },
  {
    id: 'p27',
    numero: '652.102/1994',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'BAUXITA',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 64.2,
    uf: 'AM',
    municipio: 'Barcelos',
    data_protocolo: '1994-12-18',
    ano_protocolo: 1994,
    situacao: 'bloqueado',
    risk_score: 86,
  },
  {
    id: 'p28',
    numero: '960.501/2024',
    regime: 'bloqueio_provisorio',
    fase: 'lavra',
    substancia: 'COBRE',
    titular: 'St. George Mining Brasil',
    area_ha: 310.9,
    uf: 'MT',
    municipio: 'Guarantã do Norte',
    data_protocolo: '2024-02-14',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 70,
  },
  {
    id: 'p29',
    numero: '961.502/2024',
    regime: 'bloqueio_provisorio',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 205.6,
    uf: 'MT',
    municipio: 'Peixoto de Azevedo',
    data_protocolo: '2024-05-22',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 71,
  },
  {
    id: 'p30',
    numero: '962.503/2024',
    regime: 'bloqueio_provisorio',
    fase: 'requerimento',
    substancia: 'OURO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 142.1,
    uf: 'MT',
    municipio: 'Alta Floresta',
    data_protocolo: '2024-10-01',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 72,
  },
  {
    id: 'p_864231',
    numero: '864.231/2017',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'MINÉRIO DE OURO',
    titular: 'M P Lanca Mineradora',
    area_ha: 1600,
    uf: 'TO',
    municipio: 'Jaú do Tocantins',
    data_protocolo: '2017-12-01',
    ano_protocolo: 2017,
    situacao: 'ativo',
    risk_score: 25,
  },
]

function pibMunicipioMi(municipio: string): number {
  const fix: Record<string, number> = {
    Itabira: 4200,
    Araxá: 8900,
    Parauapebas: 28000,
    Catalão: 12400,
    Marabá: 9800,
    'Jaú do Tocantins': 110.8,
  }
  if (fix[municipio] != null) return fix[municipio]!
  let h = 0
  for (let i = 0; i < municipio.length; i++) h += municipio.charCodeAt(i)
  return 800 + (h % 5201)
}

function dependenciaTransferenciasPct(uf: string, seed: number): number {
  const r = seed % 100
  if (uf === 'AM' || uf === 'PA') return Math.round(75 + (r * 17) / 100)
  if (uf === 'MG') return Math.round(35 + (r * 20) / 100)
  if (uf === 'GO') return Math.round(40 + (r * 20) / 100)
  if (uf === 'BA') return Math.round(65 + (r * 15) / 100)
  if (uf === 'MT') return Math.round(45 + (r * 20) / 100)
  if (uf === 'TO') return Math.round(68 + (r * 10) / 100)
  return Math.round(50 + (r * 15) / 100)
}

function fiscalRicoPara(
  s: Seed,
  valorEstimadoUsdMi: number,
): DadosFiscaisRicos {
  const cfemIncluir =
    s.situacao !== 'bloqueado' &&
    (s.fase === 'lavra' || s.fase === 'concessao')
  const { historico, totalMi, aliquota } = cfemHistorico(
    s.area_ha,
    s.substancia,
    s.regime,
    cfemIncluir,
  )
  const seed = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pibMi = pibMunicipioMi(s.municipio)
  const depPct = dependenciaTransferenciasPct(s.uf, seed)
  const matriz: Record<
    string,
    Pick<
      DadosFiscaisRicos,
      | 'capag'
      | 'receita_propria_mi'
      | 'divida_consolidada_mi'
      | 'pib_municipal_mi'
      | 'dependencia_transferencias_pct'
      | 'incentivos_estaduais'
      | 'linhas_bndes'
      | 'observacao'
    >
  > = {
    MG: {
      capag: 'A',
      receita_propria_mi: 420,
      divida_consolidada_mi: 280,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'ICMS Ecológico: redução para projetos certificados',
        'Isenção parcial ICMS minerais estratégicos',
      ],
      linhas_bndes: ['Finem', 'Finame', 'Proesco', 'Nova Indústria Brasil'],
      observacao:
        'Base industrial consolidada em MG; disciplina fiscal com novos capex de lavra.',
    },
    PA: {
      capag: 'B',
      receita_propria_mi: 310,
      divida_consolidada_mi: 195,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'Redução de base ICMS mineração e ferrovia',
        'Programa de royalties municipais renegociado',
      ],
      linhas_bndes: ['Finem Mineração', 'Nova Indústria Brasil', 'Finame'],
      observacao:
        'Dependência de CFEM e FPM; sensível a ciclo do minério de ferro e logística hidroviária.',
    },
    GO: {
      capag: 'A',
      receita_propria_mi: 265,
      divida_consolidada_mi: 142,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'CONFAZ 88/2025: cadeia de terras raras e níquel',
        'PRODUZIR GO',
      ],
      linhas_bndes: ['Finem Mineração', 'Finame', 'Nova Indústria Brasil'],
      observacao:
        'Capacidade confortável; polo de terras raras eleva atratividade de Finem.',
    },
    BA: {
      capag: 'B',
      receita_propria_mi: 118,
      divida_consolidada_mi: 72,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'DESENVOLVE BA: mineração e logística',
        'Redução ICMS exportação de minérios',
      ],
      linhas_bndes: ['Finem Mineração', 'Nova Indústria Brasil'],
      observacao:
        'Receita própria volátil; minerais críticos ampliam janela de incentivos.',
    },
    AM: {
      capag: 'C',
      receita_propria_mi: 62,
      divida_consolidada_mi: 48,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'Zona Franca de Manaus: equipamentos importados',
        'Redução ICMS insumos industriais',
      ],
      linhas_bndes: ['Finem', 'Finame', 'FNO Amazônia'],
      observacao:
        'Capacidade limitada; projetos dependem de garantias federais e FNO.',
    },
    MT: {
      capag: 'B',
      receita_propria_mi: 95,
      divida_consolidada_mi: 58,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'PRODEI MT: instalações industriais no interior',
        'Redução base ICMS mineração',
      ],
      linhas_bndes: ['Finem Mineração', 'FCO Industrial', 'Finame'],
      observacao:
        'Fronteira agrícola-mineral; FCO relevante para PME da cadeia.',
    },
    TO: {
      capag: 'C',
      receita_propria_mi: 5,
      divida_consolidada_mi: 2,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'Prospera Tocantins: polo mineral norte',
        'Redução de ICMS na exportação de minérios (consulta SEFAZ-TO)',
      ],
      linhas_bndes: ['Finem Mineração', 'Finame', 'Nova Indústria Brasil'],
      observacao:
        'Município de porte reduzido; CAPAG C no mock (SICONFI). Incentivos estaduais indicativos para ouro e polimetálicos.',
    },
  }

  const base = matriz[s.uf] ?? matriz.MG!
  const capag =
    s.situacao === 'bloqueado'
      ? ('D' as const)
      : s.regime === 'mineral_estrategico'
        ? ('A' as const)
        : base.capag

  const cfemMunicipalHistorico = cfemMunicipalHistoricoPara(s.uf)
  const cfem_municipio: CfemHistorico[] = cfemMunicipalHistorico.map((h) => ({
    ano: h.ano,
    valor_recolhido_brl: h.valor_total_municipio_brl,
  }))

  return {
    ...base,
    capag,
    capag_descricao: capagDescricao(capag),
    pib_municipal_mi: pibMi,
    dependencia_transferencias_pct: depPct,
    cfem_processo: historico,
    cfem_municipio,
    cfem_historico: historico,
    cfem_total_5anos_mi: totalMi,
    cfem_municipal_historico: cfemMunicipalHistorico,
    aliquota_cfem_pct: aliquota,
    cfem_estimada_ha:
      s.regime === 'bloqueio_permanente'
        ? 0
        : 18_000_000 + (seed % 25) * 400_000,
  }
}

/** Datas ISO YYYY-MM-DD no intervalo [min, max] (determinístico por seed). */
function dataIsoEntre(seed: number, minIso: string, maxIso: string): string {
  const t0 = new Date(minIso + 'T12:00:00.000Z').getTime()
  const t1 = new Date(maxIso + 'T12:00:00.000Z').getTime()
  const span = Math.max(0, Math.floor((t1 - t0) / 86_400_000))
  const dayOff = span > 0 ? seed % (span + 1) : 0
  const d = new Date(t0 + dayOff * 86_400_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Frequências distintas por fonte; coerente com 2025-11-01 … 2026-03-24. */
function timestampsPara(s: Seed): Timestamps {
  const h = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const h2 = h * 31 + s.ano_protocolo

  const sigmine = dataIsoEntre(h, '2026-03-18', '2026-03-24')
  const cadastro_mineiro = dataIsoEntre(h + 11, '2026-02-01', '2026-03-22')
  const cfem = dataIsoEntre(h + 19, '2026-02-10', '2026-03-20')
  const terras_indigenas = dataIsoEntre(h + 3, '2025-12-02', '2026-03-15')
  const unidades_conservacao = dataIsoEntre(h + 7, '2025-11-20', '2026-03-10')
  const cfem_municipal = dataIsoEntre(h2, '2026-01-08', '2026-03-18')
  /* Preço spot: data fixa para alinhar ao exemplo de rodapé (16/03/2026 + fonte IEA na UI). */
  const preco_spot = '2026-03-16'
  const alertas_legislativos = dataIsoEntre(h + 41, '2026-02-18', '2026-03-24')

  const diaUsgs = 8 + (h % 14)
  const usgs = `2026-01-${String(diaUsgs).padStart(2, '0')}`

  const diaSiconfi = 12 + (h % 17)
  const siconfi = `2025-08-${String(diaSiconfi).padStart(2, '0')}`

  return {
    cadastro_mineiro,
    sigmine,
    cfem,
    terras_indigenas,
    unidades_conservacao,
    siconfi,
    cfem_municipal,
    usgs,
    preco_spot,
    alertas_legislativos,
  }
}

function isoParaBrObs(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function faseLabelObs(fase: string): string {
  const m: Record<string, string> = {
    pesquisa: 'Autorização de Pesquisa',
    lavra: 'Lavra',
    concessao: 'Concessão de Lavra',
    requerimento: 'Requerimento',
    encerrado: 'Encerrado',
  }
  return m[fase] ?? fase
}

function formatAnosTramObs(anosTram: number): string {
  const t = Math.round(anosTram * 10) / 10
  const s = t % 1 === 0 ? String(t) : String(t).replace('.', ',')
  return `${s} anos`
}

function observacoesTecnicasParaSeed(
  s: Seed,
  dataUltimoDespachoIso: string,
  anosTram: number,
  textoUltimoDespacho: string,
  numeroSei: string,
): ObservacoesTecnicas {
  const ciclo_regulatorio: ObservacoesTecnicasItem[] = [
    { label: 'Ano de protocolo', valor: String(s.ano_protocolo) },
    {
      label: 'Tempo de tramitação',
      valor: `~${formatAnosTramObs(anosTram)}`,
    },
    { label: 'Fase atual', valor: faseLabelObs(s.fase) },
    { label: 'Último evento', valor: isoParaBrObs(dataUltimoDespachoIso) },
    { label: 'Código do evento', valor: textoUltimoDespacho },
  ]

  const identificacao: ObservacoesTecnicasItem[] = [
    { label: 'Titular', valor: s.titular },
    { label: 'CNPJ', valor: null },
    { label: 'Processo SEI', valor: numeroSei },
  ]

  return { ciclo_regulatorio, identificacao }
}

function buildRelatorio(s: Seed): RelatorioData {
  const anoAtual = new Date().getFullYear()
  const anosTram = Math.max(0, anoAtual - s.ano_protocolo)
  const anosTramR = Math.round(anosTram * 10) / 10
  const hash = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  const pend = pendenciasPorRegime(s.regime, s.situacao)
  const intelBase = intelPorSubstancia(s.substancia, s.area_ha, s.id)
  const intel_mineral: IntelMineral = {
    ...intelBase,
    processos_vizinhos: vizinhosFicticios(
      s.substancia,
      s.uf,
      s.fase,
      s.risk_score,
      s.id,
    ),
  }
  const fiscal = fiscalRicoPara(s, intelBase.valor_estimado_usd_mi)
  const dataUltimoDespacho = `${anoAtual - (hash % 2)}-${String((hash % 11) + 1).padStart(2, '0')}-${String((hash % 27) + 1).padStart(2, '0')}`
  const textoUltimoDespacho =
    s.situacao === 'bloqueado'
      ? 'Despacho de suspensão e arquivamento provisório'
      : 'Despacho de ofício complementar à documentação técnica'
  const numeroSei = `${(hash % 9000000) + 1000000}.${hash % 99}/${anoAtual}`
  const observacoes_tecnicas = observacoesTecnicasParaSeed(
    s,
    dataUltimoDespacho,
    anosTramR,
    textoUltimoDespacho,
    numeroSei,
  )

  return {
    processo_id: s.id,
    timestamps: timestampsPara(s),
    dados_anm: {
      fase_atual: `${s.fase}: regime ${s.regime.replace(/_/g, ' ')}`,
      data_protocolo: s.data_protocolo,
      ano_protocolo: s.ano_protocolo,
      tempo_tramitacao_anos: anosTramR,
      pendencias: pend,
      ultimo_despacho: textoUltimoDespacho,
      data_ultimo_despacho: dataUltimoDespacho,
      numero_sei: numeroSei,
    },
    observacoes_tecnicas,
    territorial: territorialPorUf(s.uf, hash),
    intel_mineral,
    fiscal,
  }
}

/** Cinco vizinhos estratégicos 864.231/2017, ordenados por `distancia_km` crescente. */
const PROCESSOS_VIZINHOS_864231: ProcessoVizinho[] = [
  {
    numero: '861.532/2024',
    titular: 'DJ Participações Ltda',
    fase: 'Autorização de Pesquisa',
    substancia: 'MINÉRIO DE OURO',
    area_ha: 1796.41,
    distancia_km: 5.5,
  },
  {
    numero: '864.100/2023',
    titular: 'Mineradora Serra Geral Ltda',
    fase: 'Autorização de Pesquisa',
    substancia: 'MINÉRIO DE LÍTIO',
    area_ha: 8978.37,
    distancia_km: 6.0,
  },
  {
    numero: '864.429/2022',
    titular: 'Engegold Mineração Ltda',
    fase: 'Autorização de Pesquisa',
    substancia: 'MINÉRIO DE OURO',
    area_ha: 9035.72,
    distancia_km: 10.7,
  },
  {
    numero: '864.007/2025',
    titular: 'ETRA Pesquisa Mineral Ltda',
    fase: 'Autorização de Pesquisa',
    substancia: 'TERRAS RARAS',
    area_ha: 5986.73,
    distancia_km: 14.5,
  },
  {
    numero: '861.022/2013',
    titular: 'CEFAS Mineração Ltda',
    fase: 'Concessão de Lavra',
    substancia: 'GRANITO',
    area_ha: 155.29,
    distancia_km: 24.0,
  },
]

/** Relatório 864.231/2017: dados verificados 12/04/2026 (substitui mock genérico). */
function relatorio864231V2(): RelatorioData {
  return {
    processo_id: 'p_864231',
    dados_anm: {
      fase_atual: 'Autorização de Pesquisa',
      data_protocolo: '2017-12-01',
      ano_protocolo: 2017,
      tempo_tramitacao_anos: 9,
      data_ultimo_despacho: '2026-03-13',
      ultimo_despacho:
        '541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026',
      numero_sei: '48417.864231/2017-35',
      pendencias: [
        'Guia de Utilização vencida em 12/07/2025. Pedido de renovação em 10/05/2025 aguardando análise da ANM.',
      ],
      alvara_vencimento: '2028-11-24',
      alvara_prorrogado_em: '2025-11-24',
      alvara_duracao_anos: 3,
      gu_vencida: true,
      gu_vencimento: '2025-07-12',
      gu_renovacao_pedido: '2025-05-10',
      gu_renovacao_status: 'Aguardando análise da ANM',
      ral_ultimo_apresentado: '2024 (ano base), em 10/03/2025',
      ral_pendente: '2025 (ano base), ainda não apresentado',
      taxa_anual_paga: '2026-01-30',
      licenca_ambiental: '2023-12-04',
    },
    observacoes_tecnicas: {
      ciclo_regulatorio: [
        { label: 'Ano de protocolo', valor: '2017' },
        { label: 'Tempo de tramitação', valor: '~9 anos' },
        { label: 'Fase atual', valor: 'Autorização de Pesquisa' },
        {
          label: 'Último evento',
          valor:
            '13/03/2026 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026',
        },
        {
          label: 'Código do evento',
          valor:
            '541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026',
        },
      ],
      identificacao: [
        { label: 'Titular', valor: 'M P Lanca Mineradora' },
        { label: 'CNPJ', valor: '21.515.445/0001-84' },
        { label: 'Processo SEI', valor: '48417.864231/2017-35' },
      ],
    },
    territorial: {
      nome_ti_proxima: 'Avá-Canoeiro',
      fase_ti: 'Regularizada',
      uf_ti: 'GO',
      municipios_ti: 'Minaçu, Colinas do Sul',
      distancia_ti_km: 109.7,

      nome_uc_pi_proxima: 'Parque Nacional da Chapada dos Veadeiros',
      tipo_uc_pi: 'Proteção Integral (Federal/GO)',
      distancia_uc_pi_km: 167.6,

      nome_uc_us_proxima: 'APA dos Meandros do Rio Araguaia',
      tipo_uc_us: 'Uso Sustentável (Federal)',
      distancia_uc_us_km: 146.5,

      nome_quilombola_proximo: 'Kalunga do Mimoso',
      uf_quilombola: 'TO',
      municipios_quilombola: 'Arraias, Paranã',
      distancia_quilombola_km: 125.8,
      nome_quilombola: 'Kalunga do Mimoso',

      sobreposicao_app: false,
      observacao_app:
        'Não verificada.\n\nVerificação completa requer cruzamento com hidrografia ANA e altimetria SRTM.',

      nome_aquifero: 'Depósito Aluvionar (Qa)',
      unidade_hidrogeologica: 'Granular (Gr)',
      distancia_aquifero_km: 0,
      sobreposicao_aquifero: true,

      bioma: 'Cerrado',

      nome_ferrovia: 'EF-151 Rumo Malha Central (RMC)',
      situacao_ferrovia: 'Em Operação',
      bitola_ferrovia: 'Larga',
      uf_ferrovia: 'TO',
      distancia_ferrovia_km: 23.9,

      nome_rodovia: 'BR-153',
      tipo_rodovia: 'Eixo Principal',
      uf_rodovia: 'TO',
      distancia_rodovia_km: 28.3,

      nome_porto: 'Santa Terezinha',
      tipo_porto: 'Porto Público (fluvial)',
      uf_porto: 'MT',
      rio_porto: 'Rio Araguaia',
      distancia_porto_km: 317.9,

      nome_sede: 'Jaú do Tocantins',
      uf_sede: 'TO',
      distancia_sede_km: 29.3,

      nome_uc_proxima: 'APA dos Meandros do Rio Araguaia',
      tipo_uc: 'Uso Sustentável (Federal)',
      distancia_uc_km: 146.5,

      sobreposicao_quilombola: false,
    },
    intel_mineral: {
      substancia_contexto:
        'Minério de ouro: reserva de valor e insumo eletrônico (referência SIGMINE / TERRADAR 864.231/2017).',
      reservas_brasil_mundial_pct: 3.8,
      producao_brasil_mundial_pct: 2.4,
      demanda_projetada_2030:
        'WGC Q2/2025: demanda total de ouro +3% a/a (1.249 t), valor recorde de USD 132 bi. Investimento (ETFs + barras/moedas) +78% a/a, principal driver. Bancos centrais compraram 166 t no trimestre. Joalheria -14% a/a (precos recordes reduzem acessibilidade). Tecnologia -2% a/a, mas demanda de IA segue forte. Producao de minas no Brasil +13% a/a (ramp-up Tocantinzinho/G Mining). Perspectiva: ETFs com potencial de alta, investimento institucional solido, joalheria pressionada por precos.',
      demanda_projetada_estruturada: {
        titulo: 'WGC Q2/2025',
        itens: [
          'Demanda total de ouro +3% a/a (1.249 t); valor recorde de USD 132 bi.',
          'Investimento (ETFs + barras/moedas) +78% a/a; principal driver.',
          'Bancos centrais compraram 166 t no trimestre.',
          'Joalheria −14% a/a (preços recordes reduzem acessibilidade).',
          'Tecnologia −2% a/a; demanda de IA segue forte.',
          'Produção de minas no Brasil +13% a/a (ramp-up Tocantinzinho/G Mining).',
          'Perspectiva: ETFs com potencial de alta; investimento institucional sólido; joalheria pressionada por preços.',
        ],
      },
      preco_medio_usd_t: 156_341_123,
      unidade_preco: 'oz',
      preco_referencia_usd_oz: 4862.76,
      tendencia_preco: 'alta',
      cambio_brl_usd: 5.0229,
      cambio_data: '2026-04-10',
      cambio_nota: 'BCB PTAX oficial (venda), 10/04/2026 13:04:25',
      preco_referencia_brl_g: 785.29,
      var_1a_pct: 62.8,
      cagr_5a_pct: 23.1,
      aplicacoes_principais: [
        'Reserva de valor',
        'Eletrônicos',
        'Joalheria',
        'Medicina',
      ],
      paises_concorrentes: null,
      estrategia_nacional:
        'PNM 2030: rastreabilidade da cadeia produtiva e combate ao garimpo ilegal. Certificação de origem para exportação (compliance LBMA). Formalização e fortalecimento de MPEs e cooperativas garimpeiras.',
      estrategia_nacional_itens: [
        'PNM 2030: rastreabilidade da cadeia produtiva e combate ao garimpo ilegal.',
        'Certificação de origem para exportação (compliance LBMA). Formalização e fortalecimento de MPEs e cooperativas garimpeiras.',
      ],
      potencial_reserva_estimado_t: null,
      /** USD/ha (Master). 586_279_375 × 1600 ha / 1e6 = 938_047 Mi USD. */
      valor_estimado_usd_ha: 586_279_375,
      valor_estimado_usd_mi: 938_047,
      valor_estimado_brl_tri: 4.71,
      metodologia_estimativa:
        '1ha × 750.000t (30m prof. × 2,5 t/m³) × teor 0,0005% (5 g/t)\n\n× US$ 156.341.123/t',
      processos_vizinhos: PROCESSOS_VIZINHOS_864231,
    },
    fiscal: {
      capag: 'C',
      capag_descricao:
        'Capacidade de pagamento. (ano base 2023). Endividamento: 0,00% (nota A). Poupança Corrente: 95,73% (nota C). Liquidez: 0,79% (nota B). Nota C determinada pela poupança corrente.',
      capag_estruturado: {
        resumo: 'Capacidade de pagamento.\n(ano base 2023)',
        indicadores: [
          { label: 'Endividamento', valor: '0,00%', nota: 'A' },
          { label: 'Poupança Corrente', valor: '95,73%', nota: 'C' },
          { label: 'Liquidez', valor: '0,79%', nota: 'B' },
        ],
        rodape: 'Nota C determinada pela poupança corrente.',
      },
      receita_propria_mi: 2.19,
      divida_consolidada_mi: 1.75,
      pib_municipal_mi: 110.8,
      dependencia_transferencias_pct: 93.3,
      cfem_processo: [
        { ano: 2022, valor_recolhido_brl: 0 },
        { ano: 2023, valor_recolhido_brl: 0 },
        { ano: 2024, valor_recolhido_brl: 0 },
        { ano: 2025, valor_recolhido_brl: 0 },
      ],
      cfem_municipio: [
        { ano: 2022, valor_recolhido_brl: 21_289 },
        { ano: 2023, valor_recolhido_brl: 6824 },
        { ano: 2024, valor_recolhido_brl: 3492 },
        { ano: 2025, valor_recolhido_brl: 33_767 },
      ],
      cfem_historico: [
        { ano: 2022, valor_recolhido_brl: 0 },
        { ano: 2023, valor_recolhido_brl: 0 },
        { ano: 2024, valor_recolhido_brl: 0 },
        { ano: 2025, valor_recolhido_brl: 0 },
      ],
      /** Soma municipal 2022–2025 (ANM) / 1e6; alinhado a `cfem_municipio`. */
      cfem_total_5anos_mi: 0.065372,
      cfem_municipal_historico: [
        {
          ano: 2022,
          valor_total_municipio_brl: 21_289,
          substancias: 'Zircônio, Granito, Areia',
        },
        {
          ano: 2023,
          valor_total_municipio_brl: 6824,
          substancias: 'Zircônio, Areia',
        },
        {
          ano: 2024,
          valor_total_municipio_brl: 3492,
          substancias: 'Zircônio, Areia',
        },
        {
          ano: 2025,
          valor_total_municipio_brl: 33_767,
          substancias: 'Zircônio, Areia',
        },
      ],
      incentivos_estaduais: ['Prospera Tocantins (score 2/3)'],
      linhas_bndes: [
        'BNDES Finem - Mineracao',
        'BNDES Finame',
        'BNDES Credito PME',
        'BNDES Finem - Meio Ambiente',
      ],
      aliquota_cfem_pct: 1.5,
      cfem_estimada_ha: 44_200_000,
      observacao:
        'Valores de exemplo alinhados a auditoria anterior (sedes com IBGE incorreto). TERRADAR 12.14: processo sediado em Jaú do Tocantins (IBGE 1711506); após correção no Supabase, re-ingerir SICONFI/CAPAG/CFEM municipal para 1711506 quando disponível.',
    },
    timestamps: {
      cadastro_mineiro: '2026-04-12',
      sigmine: '2026-04-12',
      terras_indigenas: '2026-04-12',
      unidades_conservacao: '2026-04-12',
      usgs: '2026-01-15',
      preco_spot: '2026-03-31',
      alertas_legislativos: '2026-04-12',
      siconfi: '2025-02-19',
      cfem: '2026-04-12',
      cfem_municipal: '2026-04-12',
    },
    metadata: {
      fonte_sigmine: 'REST API SIGMINE, consultado em 12/04/2026',
      fonte_precos: 'IMF PCPS Mar/2026 + USGS MCS 2026',
      fonte_reservas: 'USGS Mineral Commodity Summaries 2026',
      fonte_territorial:
        'Shapefiles oficiais processados em 12/04/2026 (geopandas, EPSG:5880 Brasil Polyconic): FUNAI (TIs), CNUC/MMA (UCs), INCRA (quilombolas), CAR/SICAR (APP), CPRM/SGB (aquíferos)',
      fonte_fiscal:
        'STN CAPAG Municípios (fev/2025, ano base 2023), SICONFI DCA I-C e I-AB (exercício 2024), IBGE API Agregados (PIB 2023), ANM Dados Abertos CFEM (2022-2025). TERRADAR 12.14: sede IBGE 1711506 (Jaú do Tocantins); revalidar após ingestão fiscal deste código.',
      fonte_car:
        'GeoServer SICAR: 5 imóveis rurais sobrepõem o processo (~72% da área), todos "Aguardando análise"',
      fonte_demanda: 'World Gold Council, Gold Demand Trends Q2 2025',
      cambio: 5.0229,
      cambio_data: '2026-04-10',
      cambio_nota: 'BCB PTAX oficial (venda), 10/04/2026 13:04:25',
      calculado_em: '2026-04-12T19:00:00Z',
      versao_config: 'Config-Scores v1 + Master-Substancias v10',
      nota_alertas:
        'Alertas definidos como default 0 (Adoo não integrado). Scores de pendências e alertas regulatórios são artificialmente baixos.',
      nota_postgis:
        'Dados territoriais calculados via shapefiles Python (geopandas + pyproj). Em produção usar PostGIS com ST_Distance(::geography).',
    },
    oportunidade: {
      perfis: {
        conservador: {
          valor: 72,
          label: 'Favorável',
          cor: '#E8A830',
          pesos: { atratividade: 0.25, viabilidade: 0.3, seguranca: 0.45 },
        },
        moderado: {
          valor: 70,
          label: 'Favorável',
          cor: '#E8A830',
          pesos: { atratividade: 0.4, viabilidade: 0.3, seguranca: 0.3 },
        },
        arrojado: {
          valor: 70,
          label: 'Favorável',
          cor: '#E8A830',
          pesos: { atratividade: 0.55, viabilidade: 0.25, seguranca: 0.2 },
        },
      },
      dimensoes: {
        atratividade: { valor: 68, cor: '#D4A843' },
        viabilidade: { valor: 65, cor: '#5B8CB8' },
        seguranca: { valor: 79, cor: '#E8A830' },
      },
      decomposicao: {
        atratividade: [
          {
            nome: 'A1 Relevância',
            valor: 50,
            peso: 0.25,
            texto: 'OURO (scoreSubstancia)',
          },
          {
            nome: 'A2 Gap',
            valor: 40,
            peso: 0.25,
            texto: '1.4 p.p. (reservas 3.8% - produção 2.4%)',
          },
          {
            nome: 'A3 Preço',
            valor: 90,
            peso: 0.2,
            texto: 'log10(156M USD/t) = 8.2 (>4)',
          },
          {
            nome: 'A4 Tendência',
            valor: 90,
            peso: 0.15,
            texto: 'Alta (IMF +62.8% a/a, CAGR 23.1%)',
          },
          {
            nome: 'A5 Valor',
            valor: 95,
            peso: 0.15,
            texto: 'USD 938K Mi (>= 500 Mi)',
          },
        ],
        viabilidade: [
          {
            nome: 'B1 CAPAG',
            valor: 40,
            peso: 0.2,
            texto: 'CAPAG C (STN, ano base 2023)',
          },
          {
            nome: 'B2 Fase',
            valor: 50,
            peso: 0.2,
            texto: 'Pesquisa',
          },
          {
            nome: 'B3 Infra',
            valor: 90,
            peso: 0.15,
            texto: 'Ferrovia EF-151 a 23.9km',
          },
          {
            nome: 'B4 Situação',
            valor: 90,
            peso: 0.15,
            texto: 'Ativo',
          },
          {
            nome: 'B5 Área',
            valor: 70,
            peso: 0.1,
            texto: '1.600 ha (faixa 500-2000)',
          },
          {
            nome: 'B6 Autonomia',
            valor: 60,
            peso: 0.1,
            texto: 'Receita/Dívida = 2.19/1.75 = 1.25',
          },
          {
            nome: 'B7 Incentivos',
            valor: 70,
            peso: 0.1,
            texto: 'Prospera Tocantins (score 2/3)',
          },
        ],
        seguranca: [
          {
            nome: 'C1 Solidez',
            valor: 75,
            peso: 0.35,
            texto: '100 − RS(25) = 75',
          },
          {
            nome: 'C2 Ambiental',
            valor: 90,
            peso: 0.2,
            texto: '100 − ambiental(10) = 90',
          },
          {
            nome: 'C3 Regulatório',
            valor: 83,
            peso: 0.15,
            texto: '100 − regulatorio(17) = 83',
          },
          {
            nome: 'C4 Recência',
            valor: 75,
            peso: 0.15,
            texto: '30 dias desde despacho (13/03/2026)',
          },
          {
            nome: 'C5 Restrições',
            valor: 100,
            peso: 0.1,
            texto: '0 alertas restritivos (neutro)',
            impacto_neutro: true,
          },
          {
            nome: 'C6 Favoráveis',
            valor: 15,
            peso: 0.05,
            texto: '0 alertas favoráveis (neutro)',
            impacto_neutro: true,
          },
        ],
      },
      cruzamento: {
        tipo: 'analise',
        abertura: 'Este processo combina dois fatores favoráveis.',
        explicacao:
          'Com Risk Score de 25 (risco baixo) e Opportunity Score de 72 no perfil conservador (favorável), o processo 864.231/2017 apresenta uma relação risco-retorno favorável. A tendência de preço em alta (+62,8% a/a) e a infraestrutura próxima (ferrovia a 23,9 km) compensam parcialmente a capacidade fiscal limitada do município (CAPAG C, poupança corrente 95,73%). Há uma pendência ativa (GU vencida aguardando renovação pela ANM) que contribui para o score regulatório.',
        contexto:
          'A região conta com 4 processos vizinhos de minerais estratégicos (ouro, lítio, terras raras) em fase de pesquisa, sinalizando interesse geológico crescente. A CFEM municipal atual é modesta (R$ 65 mil em 4 anos, majoritariamente zircônio), mas a estimativa em operação é de R$ 3,6 Mi/ano.',
        data: '12/04/2026',
        rs: 25,
        os: 72,
      },
    },
  }
}

const relatoriosFromSeeds = Object.fromEntries(
  SEEDS.map((s) => [s.id, buildRelatorio(s)]),
) as Record<string, RelatorioData>

const relatoriosMock: Record<string, RelatorioData> = {
  ...relatoriosFromSeeds,
  p_864231: relatorio864231V2(),
}

export { relatoriosMock }
