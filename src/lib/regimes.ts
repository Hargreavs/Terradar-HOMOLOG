import type { Regime } from '../types'

export const REGIME_COLORS: Record<Regime, string> = {
  requerimento_pesquisa: '#8FB4E0',
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  lavra_garimpeira: '#8B6F47',
  registro_extracao: '#6B8A9A',
  disponibilidade: '#5AB8B8',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

/** Cores mais saturadas/brilhantes só para polígonos no mapa (contraste sobre satellite). */
export const REGIME_COLORS_MAP: Record<Regime, string> = {
  requerimento_pesquisa: '#A5C5E8',
  concessao_lavra: '#5AA3D4',
  autorizacao_pesquisa: '#6DBF82',
  req_lavra: '#A08FD4',
  licenciamento: '#8DB86A',
  lavra_garimpeira: '#A3824F',
  registro_extracao: '#7DA4B8',
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
  licenciamento: 'Licenciamento',
  lavra_garimpeira: 'Lavra Garimpeira',
  registro_extracao: 'Registro de Extração',
  disponibilidade: 'Disponibilidade',
  mineral_estrategico: 'Mineral Estratégico',
  bloqueio_provisorio: 'Bloqueio Provisório',
  bloqueio_permanente: 'Bloqueio Permanente',
}

/** Ordem de pintura: primeiro = fundo */
export const REGIME_LAYER_ORDER: Regime[] = [
  'requerimento_pesquisa',
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'lavra_garimpeira',
  'registro_extracao',
  'disponibilidade',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

/** Textos explicativos dos badges de regime (popup, relatório, dashboard, legenda). */
export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
  requerimento_pesquisa:
    'Pedido inicial de autorização para pesquisa mineral, protocolado na ANM e ainda em análise. Fase pré-título mais comum e primeira etapa do ciclo regulatório. Inclui processos com fase Requerimento de Pesquisa e Reconhecimento Geológico antes da autorização.',
  concessao_lavra:
    'Autorização definitiva para exploração mineral, concedida pela ANM após aprovação do plano de aproveitamento econômico. Publicada no DOU. Representa o estágio mais avançado do processo minerário. Inclui processos em fase de Requerimento de Lavra e Direito de Requerer a Lavra.',
  autorizacao_pesquisa:
    'Permissão para realizar pesquisa mineral na área, concedida pela ANM. Publicada no DOU. O titular tem prazo para apresentar relatório de pesquisa com os resultados.',
  req_lavra:
    'Pedido de concessão de lavra em análise pela ANM, após aprovação do relatório de pesquisa. Publicada no DOU. Etapa intermediária entre a pesquisa e a concessão definitiva.',
  licenciamento:
    'Regime simplificado para minerais de uso imediato na construção civil (areia, cascalho, argila, brita). A autorização é concedida pela prefeitura municipal, não pela ANM. Inclui processos em fase de Requerimento de Licenciamento.',
  lavra_garimpeira:
    'Regime específico para atividade garimpeira, exercida individualmente ou em cooperativas. Regulamentado pela ANM com requisitos simplificados. Inclui processos em fase de Requerimento de Lavra Garimpeira.',
  registro_extracao:
    'Regime para extração de minerais por órgãos da administração pública para uso em obras públicas. Registrado na ANM. Inclui processos em fase de Requerimento de Registro de Extração.',
  disponibilidade:
    'Área devolvida ao patrimônio mineral da União, disponível para novo requerimento por qualquer interessado. Representa oportunidade de aquisição de direitos minerários. Inclui processos classificados como Apto para Disponibilidade.',
  mineral_estrategico:
    'Área com ocorrência de minerais classificados como estratégicos pelo governo federal (nióbio, terras raras, lítio, entre outros). Sujeita a regras especiais de exploração e eventual prioridade governamental.',
  bloqueio_provisorio:
    'Área temporariamente impedida de avançar no processo de titularidade. Pode ser por pendência administrativa, sobreposição com terra indígena ou unidade de conservação, ou disputa judicial. A situação pode ser revertida.',
  bloqueio_permanente:
    'A ANM indeferiu definitivamente o requerimento para esta área. O bloqueio pode ter sido por irregularidade específica do titular anterior e não necessariamente da área em si. A área pode ficar disponível para novo requerimento.',
}

/**
 * Mapeamento dos 15 regimes reais da ANM para os 9 grupos do TERRADAR.
 * Usado para normalizar dados importados do SIGMINE/Cadastro Mineiro.
 */
export const REGIME_ANM_PARA_TERRADAR: Record<string, Regime> = {
  'CONCESSÃO DE LAVRA': 'concessao_lavra',
  'REQUERIMENTO DE LAVRA': 'concessao_lavra',
  'DIREITO DE REQUERER A LAVRA': 'concessao_lavra',
  'AUTORIZAÇÃO DE PESQUISA': 'autorizacao_pesquisa',
  'REQUERIMENTO DE PESQUISA': 'requerimento_pesquisa',
  'RECONHECIMENTO GEOLÓGICO': 'requerimento_pesquisa',
  LICENCIAMENTO: 'licenciamento',
  'REQUERIMENTO DE LICENCIAMENTO': 'licenciamento',
  'LAVRA GARIMPEIRA': 'lavra_garimpeira',
  'REQUERIMENTO DE LAVRA GARIMPEIRA': 'lavra_garimpeira',
  'REGISTRO DE EXTRAÇÃO': 'registro_extracao',
  'REQUERIMENTO DE REGISTRO DE EXTRAÇÃO': 'registro_extracao',
  DISPONIBILIDADE: 'disponibilidade',
  'APTO PARA DISPONIBILIDADE': 'disponibilidade',
  'DADO NÃO CADASTRADO': 'disponibilidade', // fallback para dados sem regime
}
