import type { Regime } from '../types'

export const REGIME_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  mineral_estrategico: '#2D8B70',
  bloqueio_permanente: '#A85C5C',
  bloqueio_provisorio: '#C4915A',
}

/** Cores mais saturadas/brilhantes só para polígonos no mapa (contraste sobre satellite). */
export const REGIME_COLORS_MAP: Record<Regime, string> = {
  concessao_lavra: '#5AA3D4',
  autorizacao_pesquisa: '#6DBF82',
  req_lavra: '#A08FD4',
  licenciamento: '#8DB86A',
  mineral_estrategico: '#35B88A',
  bloqueio_provisorio: '#E0A96A',
  bloqueio_permanente: '#CC6B6B',
}

export const REGIME_LABELS: Record<Regime, string> = {
  concessao_lavra: 'Concessão de Lavra',
  autorizacao_pesquisa: 'Autorização de Pesquisa',
  req_lavra: 'Req. de Lavra',
  licenciamento: 'Licenciamento',
  mineral_estrategico: 'Mineral Estratégico',
  bloqueio_permanente: 'Bloqueio Permanente',
  bloqueio_provisorio: 'Bloqueio Provisório',
}

/** Ordem de pintura: primeiro = fundo */
export const REGIME_LAYER_ORDER: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

/** Textos explicativos dos badges de regime (popup, relatório, dashboard, legenda). */
export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
  concessao_lavra:
    'Autorização definitiva para exploração mineral, concedida pela ANM após aprovação do plano de aproveitamento econômico. Publicada no DOU. Representa o estágio mais avançado do processo minerário.',
  autorizacao_pesquisa:
    'Permissão para realizar pesquisa mineral na área, concedida pela ANM. Publicada no DOU. O titular tem prazo para apresentar relatório de pesquisa com os resultados. Etapa anterior à requisição de lavra.',
  req_lavra:
    'Pedido de concessão de lavra em análise pela ANM, após aprovação do relatório de pesquisa. Publicada no DOU. Etapa intermediária entre a pesquisa e a concessão definitiva.',
  licenciamento:
    'Regime simplificado para minerais de uso imediato na construção civil (areia, cascalho, argila, brita). A autorização é concedida pela prefeitura municipal, não pela ANM. O titular apenas registra na ANM. Publicada no diário oficial do município.',
  mineral_estrategico:
    'Área com ocorrência de minerais classificados como estratégicos pelo governo federal (nióbio, terras raras, lítio, entre outros). Sujeita a regras especiais de exploração e eventual prioridade governamental.',
  bloqueio_provisorio:
    'Área temporariamente impedida de avançar no processo de titularidade. Pode ser por pendência administrativa, sobreposição com terra indígena ou unidade de conservação, ou disputa judicial. A situação pode ser revertida, representando potencial oportunidade futura para outros investidores.',
  bloqueio_permanente:
    'A ANM indeferiu definitivamente o requerimento para esta área. O bloqueio pode ter sido por irregularidade específica do titular anterior (pendência judicial, questão ambiental) e não necessariamente da área em si. A área pode ficar disponível para novo requerimento por outra empresa.',
}
