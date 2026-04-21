import type { Regime } from '../types'

export const REGIME_COLORS: Record<Regime, string> = {
  requerimento_pesquisa: '#A5BE96',
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  req_plg: '#D9A77E',
  licenciamento: '#7A9B5A',
  lavra_garimpeira: '#8B6F47',
  registro_extracao: '#6B8A9A',
  req_registro_extracao: '#AFA0C4',
  requerimento_licenciamento: '#D4C484',
  direito_requerer_lavra: '#B08888',
  apto_disponibilidade: '#7EB8CC',
  reconhecimento_geologico: '#9A9A6E',
  disponibilidade: '#5AB8B8',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

/** Cores mais saturadas/brilhantes só para polígonos no mapa (contraste sobre satellite). */
export const REGIME_COLORS_MAP: Record<Regime, string> = {
  requerimento_pesquisa: '#A5BE96',
  concessao_lavra: '#5AA3D4',
  autorizacao_pesquisa: '#6DBF82',
  req_lavra: '#A08FD4',
  req_plg: '#D9A77E',
  licenciamento: '#8DB86A',
  lavra_garimpeira: '#A3824F',
  registro_extracao: '#7DA4B8',
  req_registro_extracao: '#AFA0C4',
  requerimento_licenciamento: '#D4C484',
  direito_requerer_lavra: '#B08888',
  apto_disponibilidade: '#7EB8CC',
  reconhecimento_geologico: '#9A9A6E',
  disponibilidade: '#68D4D4',
  mineral_estrategico: '#35B88A',
  bloqueio_provisorio: '#E0A96A',
  bloqueio_permanente: '#CC6B6B',
}

export const REGIME_LABELS: Record<Regime, string> = {
  requerimento_pesquisa: 'Requerimento de Pesquisa',
  concessao_lavra: 'Concessão de Lavra',
  autorizacao_pesquisa: 'Autorização de Pesquisa',
  req_lavra: 'Req. de Lavra',
  req_plg: 'Req. de Lavra Garimpeira',
  licenciamento: 'Licenciamento',
  lavra_garimpeira: 'Lavra Garimpeira',
  registro_extracao: 'Registro de Extração',
  req_registro_extracao: 'Req. de Registro de Extração',
  requerimento_licenciamento: 'Requerimento de Licenciamento',
  direito_requerer_lavra: 'Direito de Requerer a Lavra',
  apto_disponibilidade: 'Apto para Disponibilidade',
  reconhecimento_geologico: 'Reconhecimento Geológico',
  disponibilidade: 'Disponibilidade',
  mineral_estrategico: 'Mineral Estratégico',
  bloqueio_provisorio: 'Bloqueio Provisório',
  bloqueio_permanente: 'Bloqueio Permanente',
}

/** Ordem de pintura: primeiro = fundo (alinhada à ordem do sidebar). */
export const REGIME_LAYER_ORDER: Regime[] = [
  'autorizacao_pesquisa',
  'requerimento_pesquisa',
  'reconhecimento_geologico',
  'concessao_lavra',
  'req_lavra',
  'direito_requerer_lavra',
  'licenciamento',
  'requerimento_licenciamento',
  'lavra_garimpeira',
  'req_plg',
  'registro_extracao',
  'req_registro_extracao',
  'apto_disponibilidade',
  'disponibilidade',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

/** Textos explicativos dos badges de regime (popup, relatório, dashboard, legenda). */
export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
  requerimento_pesquisa:
    'Pedido de autorização protocolado, ainda não outorgado pela ANM. Estágio inicial do ciclo minerário.',
  concessao_lavra:
    'Autorização definitiva para exploração mineral, concedida pela ANM após aprovação do plano de aproveitamento econômico. Publicada no DOU. Representa o estágio mais avançado do processo minerário.',
  autorizacao_pesquisa:
    'Permissão para realizar pesquisa mineral na área, concedida pela ANM. Publicada no DOU. O titular tem prazo para apresentar relatório de pesquisa com os resultados.',
  req_lavra:
    'Pedido de concessão de lavra em análise pela ANM, após aprovação do relatório de pesquisa. Publicada no DOU. Etapa intermediária entre a pesquisa e a concessão definitiva.',
  req_plg:
    'Pedido de Permissão de Lavra Garimpeira (PLG), pendente de autorização.',
  licenciamento:
    'Regime simplificado para minerais de uso imediato na construção civil (areia, cascalho, argila, brita). A autorização é concedida pela prefeitura municipal, não pela ANM.',
  lavra_garimpeira:
    'Regime específico para atividade garimpeira, exercida individualmente ou em cooperativas. Regulamentado pela ANM com requisitos simplificados.',
  registro_extracao:
    'Regime para extração de minerais por órgãos da administração pública para uso em obras públicas. Registrado na ANM.',
  req_registro_extracao:
    'Pedido de Registro de Extração para uso próprio em obras públicas, pendente de aprovação.',
  requerimento_licenciamento:
    'Pedido de licenciamento mineral protocolado, pendente de análise pela ANM.',
  direito_requerer_lavra:
    'Titular com direito adquirido de requerer concessão de lavra, geralmente após conclusão da pesquisa.',
  apto_disponibilidade:
    'Área em transição para leilão público. Ainda com titular original, em rota de declaração de disponibilidade.',
  reconhecimento_geologico:
    'Autorização de reconhecimento geológico (regime pré-1996, hoje marginal).',
  disponibilidade:
    'Área devolvida ao patrimônio mineral da União, disponível para novo requerimento por qualquer interessado. Representa oportunidade de aquisição de direitos minerários.',
  mineral_estrategico:
    'Área com ocorrência de minerais classificados como estratégicos pelo governo federal (nióbio, terras raras, lítio, entre outros). Sujeita a regras especiais de exploração e eventual prioridade governamental.',
  bloqueio_provisorio:
    'Área temporariamente impedida de avançar no processo de titularidade. Pode ser por pendência administrativa, sobreposição com terra indígena ou unidade de conservação, ou disputa judicial. A situação pode ser revertida.',
  bloqueio_permanente:
    'A ANM indeferiu definitivamente o requerimento para esta área. O bloqueio pode ter sido por irregularidade específica do titular anterior e não necessariamente da área em si. A área pode ficar disponível para novo requerimento.',
}

/**
 * Mapeamento de texto oficial ANM (cadastro) para chave canônica TERRADAR.
 * Usado para normalizar dados importados do SIGMINE/Cadastro Mineiro.
 */
export const REGIME_ANM_PARA_TERRADAR: Record<string, Regime> = {
  'CONCESSÃO DE LAVRA': 'concessao_lavra',
  'REQUERIMENTO DE LAVRA': 'req_lavra',
  'DIREITO DE REQUERER A LAVRA': 'direito_requerer_lavra',
  'AUTORIZAÇÃO DE PESQUISA': 'autorizacao_pesquisa',
  'REQUERIMENTO DE PESQUISA': 'requerimento_pesquisa',
  'RECONHECIMENTO GEOLÓGICO': 'reconhecimento_geologico',
  LICENCIAMENTO: 'licenciamento',
  'REQUERIMENTO DE LICENCIAMENTO': 'requerimento_licenciamento',
  'LAVRA GARIMPEIRA': 'lavra_garimpeira',
  'REQUERIMENTO DE LAVRA GARIMPEIRA': 'req_plg',
  'REGISTRO DE EXTRAÇÃO': 'registro_extracao',
  'REQUERIMENTO DE REGISTRO DE EXTRAÇÃO': 'req_registro_extracao',
  DISPONIBILIDADE: 'disponibilidade',
  'APTO PARA DISPONIBILIDADE': 'apto_disponibilidade',
  'DADO NÃO CADASTRADO': 'disponibilidade',
}
