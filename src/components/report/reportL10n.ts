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

  dimMercado: 'Mercado',
  dimViab: 'Viabilidade',
  dimSeg: 'Segurança jurídica',

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
    'O TERRADAR integra cadastro ANM, camadas territoriais, indicadores fiscais e mercado para apoiar decisão — sempre com validação técnica e jurídica adicional.',

  cboxRs: 'Risk Score (RS)',
  cboxRsTxt:
    'Compõe risco geológico, ambiental, social e regulatório em escala 0–100.',
  cboxMat: 'Maturidade',
  cboxMatTxt: 'Aproxima o estágio do processo ao longo do ciclo mineral.',
  cboxOs: 'Opportunity Score (OS)',
  cboxOsTxt: 'Combina atratividade de mercado, viabilidade e segurança jurídica.',
  cboxVi: 'Valor in-situ',
  cboxViTxt: 'Estimativa indicativa a partir de teor, densidade e preço.',

  fontesDadosTitulo: 'Fontes de dados',
  thCategoria: 'Categoria',
  thFontes: 'Fontes',

  catCadastro: 'Cadastro ANM / SEI',
  catCadastroVal: 'API processo, eventos e documentos.',
  catCfem: 'CFEM',
  catCfemVal: 'Dados de arrecadação ANM.',
  catTerr: 'Territorial',
  catTerrVal: 'PostGIS, ICMBio, FUNAI, infraestrutura.',
  catInfra: 'Infraestrutura',
  catInfraVal: 'Malha viária e ativos próximos.',
  catSocio: 'Socioambiental',
  catSocioVal: 'Camadas de restrição e proximidade.',
  catFiscal: 'Fiscal',
  catFiscalVal: 'CAPAG, IBGE, receitas municipais.',
  catMercado: 'Mercado',
  catMercadoVal: 'Master de substância, câmbio e benchmarks.',
  catLeg: 'Legislação',
  catLegVal: 'PNM, CFEM, marco regulatório mineral.',

  p8NotaRodape: 'Documento gerado automaticamente em',
  p8NotaRodape2:
    ' — pode conter arredondamentos; não dispensa parecer profissional.',
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

  dimMercado: 'Market',
  dimViab: 'Viability',
  dimSeg: 'Legal certainty',

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
    'TERRADAR blends ANM cadastre, territorial layers, fiscal indicators, and market data to support decisions — always subject to additional technical and legal validation.',

  cboxRs: 'Risk Score (RS)',
  cboxRsTxt:
    'Combines geologic, environmental, social, and regulatory risk on a 0–100 scale.',
  cboxMat: 'Maturity',
  cboxMatTxt: 'Places the process stage along the mining lifecycle.',
  cboxOs: 'Opportunity Score (OS)',
  cboxOsTxt: 'Combines market appeal, viability, and legal certainty.',
  cboxVi: 'In-situ value',
  cboxViTxt: 'Indicative estimate from grade, tonnage, and price.',

  fontesDadosTitulo: 'Data sources',
  thCategoria: 'Category',
  thFontes: 'Sources',

  catCadastro: 'ANM / SEI cadastre',
  catCadastroVal: 'Process API, events, documents.',
  catCfem: 'CFEM',
  catCfemVal: 'ANM collection data.',
  catTerr: 'Territorial',
  catTerrVal: 'PostGIS, ICMBio, FUNAI, infrastructure.',
  catInfra: 'Infrastructure',
  catInfraVal: 'Road network and nearby assets.',
  catSocio: 'Socio-environmental',
  catSocioVal: 'Restriction layers and proximity.',
  catFiscal: 'Fiscal',
  catFiscalVal: 'CAPAG, IBGE, municipal revenues.',
  catMercado: 'Market',
  catMercadoVal: 'Commodity master, FX, benchmarks.',
  catLeg: 'Legal',
  catLegVal: 'PNM, CFEM, mining policy.',

  p8NotaRodape: 'Auto-generated on',
  p8NotaRodape2:
    ' — figures may be rounded; does not replace professional advice.',
  p8ShareSite: 'Brasília/DF · sharetecnologia.com.br',
} as const

export type ReportL10n = typeof REPORT_L10N_PT

export function getReportStrings(lang: ReportLang): ReportL10n {
  return (lang === 'en' ? REPORT_L10N_EN : REPORT_L10N_PT) as ReportL10n
}
