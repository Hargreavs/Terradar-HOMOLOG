import type { ReportLang } from '../../lib/reportLang'

/**
 * Strings fixas do relatório PDF (PT/EN). LLM cobre apenas blocos analíticos.
 */
export const REPORT_L10N_PT = {
  docTitleSuffix: 'Relatório',

  locale: 'pt-BR',
  nd: 'N/D',

  mercadoTendenciaNd: 'N/D',
  tagSobreposto: 'Sobreposto',
  tagNao: 'Não',

  fiscalRefTpl: (anoBaseCapag: string, exercicioFiscal: string) =>
    `Indicadores CAPAG: referência ANCT ${anoBaseCapag} · exercício fiscal municipal ${exercicioFiscal}.`,

  maturidade: [
    'Pesquisa',
    'Requerimento',
    'Lavra',
    'Suspensão',
    'Encerramento',
  ] as const,

  capaConf: 'Confidencial',
  capaTipo: 'Relatório de inteligência mineral',
  capaEngLabel: 'Engenharia de dados',
  capaEngVal: 'Share Tecnologia',
  capaRegLabel: 'Inteligência regulatória',
  capaRegVal: 'LexMine',
  capaVersao: 'Versão',
  capaFooterRight: 'Uso interno',

  pontoAtencao: 'Ponto de atenção:',
  tendenciaSub: 'var. 12 meses (spot)',

  p2Tag: 'Sumário vital',
  riskScore: 'Risk Score',
  opportunityScore: 'Opportunity Score',
  valorInsitu: 'Valor in-situ (est.)',
  valorInsituSub: 'Teor × massa/ha × preço (premissas TERRADAR)',
  tendenciaPreco: 'Tendência de preço',
  vereditoMaturidade: 'Veredito de maturidade',

  identificacaoAtivo: 'Identificação do ativo',
  tblTitular: 'Titular',
  tblCnpj: 'CNPJ',
  tblSubstancia: 'Substância',
  tblRegime: 'Regime',
  tblFase: 'Fase',
  tblArea: 'Área',
  tblMunicipio: 'Município',
  tblBioma: 'Bioma',

  statusRegulatorio: 'Status regulatório',
  tblAlvara: 'Alvará',
  alvaraAte: 'até',
  tblUltimoDespacho: 'Último despacho',
  tblNupSei: 'NUP SEI',
  tblGu: 'GU',
  tblTah: 'TAH',
  tahEmDia: 'em dia',
  tblLicenca: 'Licença ambiental',
  tblProtocolo: 'Protocolo',
  tblProtocoloAnos: 'anos em protocolo',

  fontesP2: 'Fontes: cadastro ANM/SEI, análise territorial e master de substância ·',

  mapaLegenda: 'Legenda: camadas e distâncias a partir do perímetro do processo.',
  mapaIndisponivel: 'Mapa territorial indisponível nesta versão.',

  p3Tag: 'Território e logística',
  sobreposicoes: 'Sobreposições',
  thAreaProt: 'Área protegida',
  thMaisProxima: 'Unidade / nome',
  thDistancia: 'Distância',
  thSobreposicao: 'Sobreposição',

  logisticaTitulo: 'Infraestrutura e logística',
  thInfra: 'Tipo',
  thNome: 'Nome',
  thDetalhes: 'Detalhes',

  fontesP3:
    'Fontes: PostGIS territorial, bases federais (ICMBio, FUNAI) e malha viária.',

  tblGapPotencial: 'do potencial brasileiro (reservas vs. produção)',

  p4Tag: 'Mercado e valor',
  precoSpot: 'Preço spot (ref.)',
  var12m: 'Var. 12 meses',
  refSpot: 'Referência master / fonte de preço',
  cresc5a: 'Crescimento 5 anos',
  cagrLbl: 'CAGR (master)',
  demandaGlobal: 'Demanda global',
  refMercado: 'Projeções / cenários (master)',

  posicaoBrasil: 'Posição do Brasil',
  tblReservasMundiais: 'Reservas mundiais (BR)',
  tblProducaoMundial: 'Produção mundial (BR)',
  tblGap: 'Gap reservas vs. produção',
  tblAplicacoes: 'Principais aplicações',
  tblAplicacoesVal: 'Ver PNM / USGS (master)',
  doTotalGlobal: 'do total global',

  aspectosReg: 'Aspectos regulatórios e CFEM',
  tblEstrategiaPnm: 'Estratégia nacional (PNM)',
  tblCfemRoyalty: 'Alíquota CFEM',
  tblCfemPct: 'sobre faturamento da lavra',
  tblMineralEstrategico: 'Mineral estratégico',
  tblMineralEstrategicoVal: 'Conforme catálogo ANM',
  tblCfemHa: 'CFEM estimada (in-situ)',
  tblCfemHaRef: 'sobre valor in-situ estimado',

  valorEstimadoReserva: 'Valor estimado da reserva (premissas)',
  valorInsituKpi: 'Valor in-situ',
  refMercado2: 'Teor × massa/ha × preço USD (master)',
  cfemEstKpi: 'CFEM estimada',
  cfemEstSub: 'Alíquota',
  cfemEstSubSobre: 'sobre valor in-situ',

  notaMetodologica:
    'Nota metodológica: valores indicativos; não constituem avaliação contábil ou garantia de receita.',

  fontesP4: 'Fontes: master de substância, ANM, IBGE e referências de mercado.',

  contextoGlobalTitulo: 'Contexto Global',
  disclaimerSemFonteResProd:
    'Não há fonte oficial publicada para reservas ou produção mundial desta substância.',
  contextoGlobalIndisponivelRodape:
    'Contexto global indisponível para esta substância.',

  tblLinhasBndesEleg: 'linhas elegíveis (cadastro)',

  p5Tag: 'Fiscal e incentivos',
  capagRef: 'Quadro CAPAG (município)',
  thIndicador: 'Indicador',
  thValor: 'Valor',
  thNota: 'Nota',

  endividamento: 'Endividamento',
  poupancaCorrente: 'Poupança corrente',
  liquidez: 'Liquidez',
  capagNotaFinal: 'Nota consolidada CAPAG (referência).',

  indicadoresMun: 'Indicadores municipais',
  tblReceitaPropria: 'Receita própria',
  tblDivida: 'Dívida consolidada',
  tblPib: 'PIB municipal',
  tblDepTransf: 'Dependência de transferências',
  tblDepTransfSuffix: 'da receita corrente',
  tblPop: 'População',
  tblIdh: 'IDH',

  incentivosDisp: 'Incentivos disponíveis',
  tblProgEstadual: 'Programa estadual',
  tblLinhasBndes: 'Linhas BNDES',

  arrecadacaoCfem: 'Arrecadação CFEM (histórico)',
  thAno: 'Ano',
  thCfemProcesso: 'Processo (R$)',
  thCfemMunicipio: 'Município (R$)',
  thCfemSubst: 'Substâncias',

  fontesP5:
    'Fontes: CAPAG/Tesouro, fiscal municipal (API), ANM/CFEM e programas de incentivo.',

  riscoGeologico: 'Geológico',
  riscoAmbiental: 'Ambiental',
  riscoSocial: 'Social',
  riscoRegulatorio: 'Regulatório',

  p6Tag: 'Risco',
  rsEscopo:
    'Escopo: decomposição automática + texto analítico (não substitui due diligence).',
  leituraIntegrada: 'Leitura integrada:',
  fontesP6: 'Fontes: modelo TERRADAR, dados cadastrais e territoriais ·',

  dimMercado: 'Atratividade de mercado',
  dimViab: 'Viabilidade operacional',
  dimSeg: 'Segurança do investimento',

  p7Tag: 'Oportunidade',
  oportunidadePerfilCons: '(perfil conservador)',
  osEscopo:
    'Escopo: scores por dimensão; classificação alinhada ao perfil conservador.',
  perfilInvestidor: 'Perfis de investidor (ilustrativo)',
  thPerfil: 'Perfil',
  thScore: 'Score',
  thClassificacao: 'Classificação',

  perfilCons: 'Conservador',
  perfilConsSub: 'menor volatilidade',
  perfilMod: 'Moderado',
  perfilModSub: 'balanço risco/retorno',
  perfilArr: 'Arrojado',
  perfilArrSub: 'maior exposição',

  sinteseTerradar: 'Síntese TERRADAR',
  fontesP7: 'Fontes: modelo TERRADAR e master de substância ·',

  p8Tag: 'Metodologia e fontes',
  p8Hl: 'Como interpretar este relatório',
  p8Intro:
    'O TERRADAR utiliza uma metodologia proprietária de cálculo e análise que avalia processos minerários em múltiplas dimensões a partir de dados extraídos exclusivamente de fontes oficiais públicas brasileiras e internacionais. Os algoritmos de pontuação, normalização e ponderação foram desenvolvidos e calibrados considerando vários aspectos da regulação minerária, análise de risco e inteligência de mercado. A estrutura de pesos, faixas de classificação e regras de fallback são propriedade intelectual do TERRADAR e não são divulgadas neste relatório.',

  cboxRs: 'Risk Score (0-100)',
  cboxRsTxt:
    'Avalia vulnerabilidades em 4 dimensões: geológica, ambiental, social e regulatória. Menor é melhor. Faixas: 0-39 baixo, 40-69 médio, 70-100 alto. Cálculo proprietário baseado em dados públicos.',
  cboxMat: 'Veredito de maturidade',
  cboxMatTxt:
    '5 níveis: Exploratório, Inicial, Intermediário, Avançado, Maduro. Baseado na fase, documentos e status do alvará.',
  cboxOs: 'Opportunity Score (0-100)',
  cboxOsTxt:
    'Avalia potencial de retorno em 3 dimensões: atratividade, viabilidade e segurança. Pesos ajustados ao perfil do investidor. Maior é melhor. Cálculo proprietário.',
  cboxVi: 'Valor in-situ teórico',
  cboxViTxt:
    'Estimativa com premissas conservadoras por hectare. Não constitui NI 43-101 / JORC. Referência indicativa.',

  fontesDadosTitulo: 'Fontes de dados utilizadas',
  thCategoria: 'Categoria',
  thFontes: 'Fontes',

  catCadastro: 'Cadastro minerário',
  catCadastroVal: 'ANM/SIGMINE (API REST), SEI-ANM',
  catCfem: 'Arrecadação mineral',
  catCfemVal: 'ANM/CFEM (Dados Abertos)',
  catTerr: 'Dados territoriais',
  catTerrVal: 'FUNAI (TIs), CNUC/MMA (UCs), INCRA, CAR/SICAR, CPRM/SGB',
  catInfra: 'Infraestrutura',
  catInfraVal: 'DNIT (ferrovias/rodovias), ANTAQ (portos), IBGE',
  catSocio: 'Socioeconômicos',
  catSocioVal: 'IBGE (PIB, população, IDH, biomas)',
  catFiscal: 'Dados fiscais',
  catFiscalVal: 'STN (CAPAG, SICONFI), Banco Central (PTAX)',
  catMercado: 'Inteligência de mercado',
  catMercadoVal: 'FMI (preços), USGS (reservas/produção), World Gold Council',
  catLeg: 'Legislação',
  catLegVal: 'Código de Mineração, Lei 13.540/2017, Decreto 10.657/2021',

  p8NotaRodape: 'Sobre este relatório: gerado pela plataforma TERRADAR em',
  p8NotaRodape2:
    '. Os dados foram verificados em múltiplas auditorias cruzadas, com consultas diretas a APIs oficiais (SICONFI, IBGE SIDRA), processamento de shapefiles geoespaciais e verificação processual no SEI-ANM. Nenhum dado foi inventado, inferido ou estimado sem base documental explícita.',
  p8ShareSite: 'Brasília/DF · sharetecnologia.com.br',
} as const

export const REPORT_L10N_EN = {
  docTitleSuffix: 'Report',

  locale: 'en-US',
  nd: 'N/A',

  mercadoTendenciaNd: 'N/A',
  tagSobreposto: 'Overlapping',
  tagNao: 'No',

  fiscalRefTpl: (anoBaseCapag: string, exercicioFiscal: string) =>
    `CAPAG indicators: ANCT reference ${anoBaseCapag} · municipal fiscal year ${exercicioFiscal}.`,

  maturidade: [
    'Exploration',
    'Application',
    'Mining',
    'Suspension',
    'Closure',
  ] as const,

  capaConf: 'Confidential',
  capaTipo: 'Mineral intelligence report',
  capaEngLabel: 'Engineering',
  capaEngVal: 'Share Tecnologia',
  capaRegLabel: 'Regulatory intelligence',
  capaRegVal: 'LexMine',
  capaVersao: 'Version',
  capaFooterRight: 'Internal use',

  pontoAtencao: 'Attention:',
  tendenciaSub: '12-month change (spot)',

  p2Tag: 'Executive snapshot',
  riskScore: 'Risk Score',
  opportunityScore: 'Opportunity Score',
  valorInsitu: 'In-situ value (est.)',
  valorInsituSub: 'Grade × mass/ha × price (TERRADAR assumptions)',
  tendenciaPreco: 'Price trend',
  vereditoMaturidade: 'Maturity verdict',

  identificacaoAtivo: 'Asset identification',
  tblTitular: 'Operator / titleholder',
  tblCnpj: 'Tax ID (CNPJ)',
  tblSubstancia: 'Commodity',
  tblRegime: 'Tenure',
  tblFase: 'Phase',
  tblArea: 'Area',
  tblMunicipio: 'Municipality',
  tblBioma: 'Biome',

  statusRegulatorio: 'Regulatory status',
  tblAlvara: 'Permit',
  alvaraAte: 'through',
  tblUltimoDespacho: 'Latest filing',
  tblNupSei: 'SEI case no.',
  tblGu: 'GU',
  tblTah: 'TAH',
  tahEmDia: 'current',
  tblLicenca: 'Environmental license',
  tblProtocolo: 'Docket',
  tblProtocoloAnos: 'years in process',

  fontesP2: 'Sources: ANM/SEI cadastre, territorial analysis, commodity master ·',

  mapaLegenda: 'Legend: layers and distances from the process perimeter.',
  mapaIndisponivel: 'Territorial map unavailable in this build.',

  p3Tag: 'Territory and logistics',
  sobreposicoes: 'Overlaps',
  thAreaProt: 'Protected area',
  thMaisProxima: 'Unit / name',
  thDistancia: 'Distance',
  thSobreposicao: 'Overlap',

  logisticaTitulo: 'Infrastructure and logistics',
  thInfra: 'Type',
  thNome: 'Name',
  thDetalhes: 'Details',

  fontesP3:
    'Sources: PostGIS territorial stack, federal layers (ICMBio, FUNAI), transport network.',

  tblGapPotencial: 'of Brazil’s potential (reserves vs. production)',

  p4Tag: 'Market and value',
  precoSpot: 'Spot (ref.)',
  var12m: '12-month chg.',
  refSpot: 'Master / price source',
  cresc5a: '5-year growth',
  cagrLbl: 'CAGR (master)',
  demandaGlobal: 'Global demand',
  refMercado: 'Projections / scenarios (master)',

  posicaoBrasil: 'Brazil’s position',
  tblReservasMundiais: 'World reserves (BR)',
  tblProducaoMundial: 'World production (BR)',
  tblGap: 'Reserves vs. production gap',
  tblAplicacoes: 'Key applications',
  tblAplicacoesVal: 'See PNM / USGS (master)',
  doTotalGlobal: 'of global total',

  aspectosReg: 'Regulatory and CFEM',
  tblEstrategiaPnm: 'National strategy (PNM)',
  tblCfemRoyalty: 'CFEM rate',
  tblCfemPct: 'of mining revenue',
  tblMineralEstrategico: 'Strategic mineral',
  tblMineralEstrategicoVal: 'Per ANM catalog',
  tblCfemHa: 'Estimated CFEM (in-situ)',
  tblCfemHaRef: 'on estimated in-situ value',

  valorEstimadoReserva: 'Estimated reserve value (assumptions)',
  valorInsituKpi: 'In-situ value',
  refMercado2: 'Grade × mass/ha × USD price (master)',
  cfemEstKpi: 'Estimated CFEM',
  cfemEstSub: 'Rate',
  cfemEstSubSobre: 'on in-situ value',

  notaMetodologica:
    'Method note: indicative figures; not accounting advice or revenue assurance.',

  fontesP4: 'Sources: commodity master, ANM, IBGE, market references.',

  contextoGlobalTitulo: 'Global context',
  disclaimerSemFonteResProd:
    'No official public source exists for global reserves or production of this commodity.',
  contextoGlobalIndisponivelRodape:
    'Global context unavailable for this commodity.',

  tblLinhasBndesEleg: 'eligible lines (registry)',

  p5Tag: 'Fiscal and incentives',
  capagRef: 'CAPAG snapshot (municipality)',
  thIndicador: 'Indicator',
  thValor: 'Value',
  thNota: 'Grade',

  endividamento: 'Indebtedness',
  poupancaCorrente: 'Current savings',
  liquidez: 'Liquidity',
  capagNotaFinal: 'Consolidated CAPAG grade (reference).',

  indicadoresMun: 'Municipal indicators',
  tblReceitaPropria: 'Own revenue',
  tblDivida: 'Consolidated debt',
  tblPib: 'Municipal GDP',
  tblDepTransf: 'Transfer dependence',
  tblDepTransfSuffix: 'of current revenue',
  tblPop: 'Population',
  tblIdh: 'HDI',

  incentivosDisp: 'Available incentives',
  tblProgEstadual: 'State program',
  tblLinhasBndes: 'BNDES lines',

  arrecadacaoCfem: 'CFEM collections (history)',
  thAno: 'Year',
  thCfemProcesso: 'Process (BRL)',
  thCfemMunicipio: 'Municipality (BRL)',
  thCfemSubst: 'Commodities',

  fontesP5:
    'Sources: CAPAG/Treasury, municipal fiscal API, ANM/CFEM, incentive programs.',

  riscoGeologico: 'Geologic',
  riscoAmbiental: 'Environmental',
  riscoSocial: 'Social',
  riscoRegulatorio: 'Regulatory',

  p6Tag: 'Risk',
  rsEscopo:
    'Scope: automated breakdown + narrative (not a substitute for due diligence).',
  leituraIntegrada: 'Integrated read:',
  fontesP6: 'Sources: TERRADAR model, cadastral and territorial data ·',

  dimMercado: 'Market appeal',
  dimViab: 'Operational viability',
  dimSeg: 'Investment security',

  p7Tag: 'Opportunity',
  oportunidadePerfilCons: '(conservative profile)',
  osEscopo:
    'Scope: dimension scores; classification aligned to the conservative profile.',
  perfilInvestidor: 'Investor profiles (illustrative)',
  thPerfil: 'Profile',
  thScore: 'Score',
  thClassificacao: 'Rating',

  perfilCons: 'Conservative',
  perfilConsSub: 'lower volatility',
  perfilMod: 'Moderate',
  perfilModSub: 'risk/return balance',
  perfilArr: 'Aggressive',
  perfilArrSub: 'higher exposure',

  sinteseTerradar: 'TERRADAR synthesis',
  fontesP7: 'Sources: TERRADAR model and commodity master ·',

  p8Tag: 'Methodology and sources',
  p8Hl: 'How to read this report',
  p8Intro:
    'TERRADAR applies a proprietary methodology that evaluates mining processes across multiple dimensions, drawing exclusively from official public Brazilian and international data sources. Its scoring, normalization and weighting algorithms were developed and calibrated taking into account regulatory, risk and market intelligence aspects of mining. Weight structures, classification bands and fallback rules are TERRADAR intellectual property and are not disclosed in this report.',

  cboxRs: 'Risk Score (0-100)',
  cboxRsTxt:
    'Scores vulnerabilities across 4 dimensions: geologic, environmental, social and regulatory. Lower is better. Bands: 0-39 low, 40-69 medium, 70-100 high. Proprietary calculation based on public data.',
  cboxMat: 'Maturity verdict',
  cboxMatTxt:
    '5 levels: Exploratory, Initial, Intermediate, Advanced, Mature. Based on phase, documents and permit status.',
  cboxOs: 'Opportunity Score (0-100)',
  cboxOsTxt:
    'Scores return potential across 3 dimensions: market appeal, viability and security. Weights tuned to the investor profile. Higher is better. Proprietary calculation.',
  cboxVi: 'Theoretical in-situ value',
  cboxViTxt:
    'Estimate with conservative per-hectare assumptions. Does not constitute NI 43-101 / JORC. Indicative reference only.',

  fontesDadosTitulo: 'Data sources used',
  thCategoria: 'Category',
  thFontes: 'Sources',

  catCadastro: 'Mining cadastre',
  catCadastroVal: 'ANM/SIGMINE (REST API), SEI-ANM',
  catCfem: 'Mineral royalties',
  catCfemVal: 'ANM/CFEM (Open Data)',
  catTerr: 'Territorial data',
  catTerrVal: 'FUNAI (ILs), CNUC/MMA (PAs), INCRA, CAR/SICAR, CPRM/SGB',
  catInfra: 'Infrastructure',
  catInfraVal: 'DNIT (rail/road), ANTAQ (ports), IBGE',
  catSocio: 'Socioeconomic',
  catSocioVal: 'IBGE (GDP, population, HDI, biomes)',
  catFiscal: 'Fiscal data',
  catFiscalVal: 'STN (CAPAG, SICONFI), Central Bank (PTAX)',
  catMercado: 'Market intelligence',
  catMercadoVal: 'IMF (prices), USGS (reserves/production), World Gold Council',
  catLeg: 'Legal framework',
  catLegVal: 'Mining Code, Law 13,540/2017, Decree 10,657/2021',

  p8NotaRodape: 'About this report: generated by the TERRADAR platform on',
  p8NotaRodape2:
    '. All data points were cross-audited through direct queries to official APIs (SICONFI, IBGE SIDRA), processing of geospatial shapefiles and case review on SEI-ANM. No figure was fabricated, inferred or estimated without explicit documentary basis.',
  p8ShareSite: 'Brasília/DF · sharetecnologia.com.br',
} as const

export type ReportL10n = typeof REPORT_L10N_PT

export function getReportStrings(lang: ReportLang): ReportL10n {
  return (lang === 'en' ? REPORT_L10N_EN : REPORT_L10N_PT) as ReportL10n
}
