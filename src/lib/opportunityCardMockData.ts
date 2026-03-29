import type { Processo } from '../types'
import type { OpportunityResult } from './opportunityScore'
import {
  gerarVariaveisAutomaticas,
  type OpportunityCardVariaveis,
} from './opportunityCardCopy'

/**
 * Dados concretos (texto + fonte) por processo para cards de oportunidade.
 * Chaves: ids estáveis em `processos.mock` (p3, p23, p22, p21).
 */
export const OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID: Record<string, OpportunityCardVariaveis> = {
  p3: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 21,
        texto: 'Bauxita: demanda estável, baixa criticidade',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 32,
        texto: 'Reserva nacional 2.8x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 28,
        texto: 'US$ 38/t, estável (-0.5% a.a.)',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 62,
        texto: 'Demanda global +1.8% a.a.',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 52,
        texto: 'Reserva estimada em US$ 8.2M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 92,
        texto: 'CAPAG A, receita própria elevada',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 88,
        texto: 'Concessão de Lavra ativa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 85,
        texto: 'Ferrovia a 12 km, rodovia federal a 3 km',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 72,
        texto: '2.104 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 78,
        texto: 'Autonomia fiscal 71%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 91,
        texto: 'Processo ativo, sem pendências',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 85,
        texto: 'Incentivos estaduais, linhas BNDES e Sudene alinhados ao projeto',
        fonte: 'BNDES',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 69,
        texto: 'Risk Score 31/100 (baixo)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 82,
        texto: 'Sem sobreposição com UCs ou TIs',
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 74,
        texto: '0 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 65,
        texto: 'Último despacho há 38 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 76,
        texto: 'Nenhuma restrição publicada em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 58,
        texto: '3 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p23: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 94,
        texto: 'Lítio: mineral crítico, alta demanda global',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 82,
        texto: 'Reserva nacional 6.1x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 45,
        texto: 'US$ 12.400/t, volatilidade alta',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 91,
        texto: 'Demanda global +14% a.a. (eletrificação)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 68,
        texto: 'Reserva estimada em US$ 94M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 48,
        texto: 'CAPAG C, capacidade fiscal limitada',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 55,
        texto: 'Fase de Pesquisa (autorizada)',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 35,
        texto: 'Ferrovia a 210 km, acesso por estrada vicinal',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 61,
        texto: '487 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 29,
        texto: 'Autonomia fiscal 22%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 72,
        texto: 'Processo ativo, relatório pendente',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 65,
        texto: 'Área de atuação Sudene',
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 52,
        texto: 'Risk Score 48/100 (médio)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 56,
        texto: 'Proximidade com APP (2.3 km)',
        fonte: 'ICMBio, CAR/SICAR',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 61,
        texto: '1 alerta restritivo em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 71,
        texto: 'Último despacho há 22 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 55,
        texto: '1 restrição publicada em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 68,
        texto: '5 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p22: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 97,
        texto: 'Nióbio: Brasil detém 98% das reservas globais',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 88,
        texto: 'Reserva nacional 12x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 76,
        texto: 'US$ 41.000/t, tendência de alta',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 85,
        texto: 'Demanda global +3.2% a.a. (aços especiais)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 92,
        texto: 'Reserva estimada em US$ 680M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 85,
        texto: 'CAPAG A, superávit fiscal',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 90,
        texto: 'Concessão de Lavra ativa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 88,
        texto: 'Ferrovia a 8 km, rodovia a 2 km',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 64,
        texto: '312 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 82,
        texto: 'Autonomia fiscal 74%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 85,
        texto: 'Processo ativo, sem pendências',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 55,
        texto: 'Fora de área prioritária',
        fonte: 'BNDES',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 84,
        texto: 'Risk Score 12/100 (baixo)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 91,
        texto: 'Sem sobreposição territorial identificada',
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 85,
        texto: '0 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 78,
        texto: 'Último despacho há 15 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 82,
        texto: 'Nenhuma restrição em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 74,
        texto: '7 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p21: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 78,
        texto: 'Grafita: mineral crítico para baterias',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 71,
        texto: 'Reserva nacional 4.5x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 52,
        texto: 'US$ 1.200/t, recuperação após queda',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 74,
        texto: 'Demanda global +8% a.a. (baterias Li-ion)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 38,
        texto: 'Reserva estimada em US$ 4.1M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 32,
        texto: 'CAPAG D, endividamento elevado',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 38,
        texto: 'Requerimento de Pesquisa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 28,
        texto: 'Ferrovia a 340 km, acesso precário',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 55,
        texto: '1.850 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 18,
        texto: 'Autonomia fiscal 11%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 62,
        texto: 'Processo ativo, documentação pendente',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 72,
        texto: 'Área de atuação Sudene',
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 42,
        texto: 'Risk Score 58/100 (médio)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 35,
        texto: 'Sobreposição parcial com APP (0.8 km)',
        fonte: 'ICMBio, CAR/SICAR',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 51,
        texto: '2 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 55,
        texto: 'Último despacho há 92 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 38,
        texto: '2 restrições publicadas em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 62,
        texto: '4 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
}

export function getOpportunityCardVariaveis(processoId: string): OpportunityCardVariaveis | null {
  return OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID[processoId] ?? null
}

export type OpportunityCardFonte = 'manual' | 'auto'

/** Dados curados (p3, p23, p22, p21) ou cópia automática derivada do processo e dos scores. */
export function resolveOpportunityCardVariaveis(
  processo: Processo,
  scores: OpportunityResult,
): { card: OpportunityCardVariaveis; fonte: OpportunityCardFonte } {
  const manual = getOpportunityCardVariaveis(processo.id)
  if (manual) return { card: manual, fonte: 'manual' }
  return { card: gerarVariaveisAutomaticas(processo, scores), fonte: 'auto' }
}
