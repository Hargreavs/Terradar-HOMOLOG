import type { Processo } from '../types'
import type { OpportunityResult, PerfilRisco } from './opportunityScore'
import { PESOS_PERFIL } from './opportunityScore'

/** Variável de uma dimensão da pontuação de oportunidade (valor 0–100 + cópia legível). */
export interface VariavelPontuacao {
  nome: string
  valor: number
  texto: string
  fonte: string
}

export interface OpportunityCardVariaveis {
  atratividade: VariavelPontuacao[]
  viabilidade: VariavelPontuacao[]
  seguranca: VariavelPontuacao[]
}

export type FatorDestacado = {
  tipo: 'positivo' | 'atencao'
  variavel: VariavelPontuacao
}

/** Pesos internos por dimensão (mesmos de `computeOpportunityForProcesso` em `opportunityScore.ts`). */
export const PESOS_INTERNOS_ATRATIVIDADE = [0.25, 0.25, 0.2, 0.15, 0.15] as const
export const PESOS_INTERNOS_VIABILIDADE = [0.2, 0.2, 0.15, 0.1, 0.1, 0.15, 0.1] as const
export const PESOS_INTERNOS_SEGURANCA = [0.35, 0.2, 0.15, 0.15, 0.1, 0.05] as const

function roundScore(weighted: number): number {
  return Math.max(0, Math.min(100, Math.round(weighted)))
}

export function scoreDimensaoFromVariaveis(
  variaveis: VariavelPontuacao[],
  pesos: readonly number[],
): number {
  const n = Math.min(variaveis.length, pesos.length)
  let s = 0
  for (let i = 0; i < n; i++) {
    const v = variaveis[i]
    if (v) s += v.valor * (pesos[i] ?? 0)
  }
  return roundScore(s)
}

export function computeDimScoresFromCard(cv: OpportunityCardVariaveis): {
  a: number
  v: number
  s: number
} {
  return {
    a: scoreDimensaoFromVariaveis(cv.atratividade, PESOS_INTERNOS_ATRATIVIDADE),
    v: scoreDimensaoFromVariaveis(cv.viabilidade, PESOS_INTERNOS_VIABILIDADE),
    s: scoreDimensaoFromVariaveis(cv.seguranca, PESOS_INTERNOS_SEGURANCA),
  }
}

export function scoreTotalFromDimScores(
  dims: { a: number; v: number; s: number },
  perfil: PerfilRisco,
): number {
  const { a, b, c } = PESOS_PERFIL[perfil]
  return roundScore(dims.a * a + dims.v * b + dims.s * c)
}

function stripPontoFinal(s: string): string {
  return s.replace(/\.\s*$/, '').trim()
}

function minMaxVariaveis(variaveis: VariavelPontuacao[]): {
  gargalo: VariavelPontuacao
  destaque: VariavelPontuacao
} {
  const sorted = [...variaveis].sort((a, b) => a.valor - b.valor)
  const gargalo = sorted[0]!
  const destaque = sorted[sorted.length - 1]!
  return { gargalo, destaque }
}

/**
 * Gera 1 linha de descrição abaixo da barra da dimensão (regra Seção 2).
 */
export function gerarDescricaoDimensao(
  variaveis: VariavelPontuacao[],
  scoreDimensao: number,
): string {
  if (variaveis.length === 0) return ''
  const { gargalo, destaque } = minMaxVariaveis(variaveis)

  let out: string
  if (scoreDimensao < 40) {
    out = `${gargalo.texto} (${gargalo.fonte})`
  } else if (scoreDimensao >= 70) {
    out = `${destaque.texto} (${destaque.fonte})`
  } else {
    out = `${destaque.texto}, porém ${gargalo.nome} limitado (${gargalo.fonte})`
  }
  return stripPontoFinal(out)
}

function textoApareceEmDescricoes(texto: string, descricoes: string[]): boolean {
  const t = texto.trim()
  if (!t) return false
  return descricoes.some((d) => d.includes(t))
}

/**
 * Fatores inferiores do card (Seção 3). `descricoesBarras` = [A, V, S].
 */
export function gerarFatoresDestacados(
  todasVariaveis: VariavelPontuacao[],
  descricoesBarras: [string, string, string],
): FatorDestacado[] {
  const desc = descricoesBarras
  const pool = todasVariaveis.filter((v) => !textoApareceEmDescricoes(v.texto, desc))

  const pos = [...pool].filter((v) => v.valor >= 60).sort((a, b) => b.valor - a.valor)
  const neg = [...pool].filter((v) => v.valor < 50).sort((a, b) => a.valor - b.valor)

  const out: FatorDestacado[] = []

  if (pos.length >= 2) {
    for (const v of pos.slice(0, 2)) {
      out.push({ tipo: 'positivo', variavel: v })
    }
  } else if (pos.length === 1) {
    out.push({ tipo: 'positivo', variavel: pos[0]! })
  } else {
    const sortedAll = [...pool].sort((a, b) => b.valor - a.valor)
    if (sortedAll[0]) out.push({ tipo: 'positivo', variavel: sortedAll[0] })
  }

  if (neg.length > 0) {
    out.push({ tipo: 'atencao', variavel: neg[0]! })
  }

  return out
}

export function corBolinhaAtencao(valor: number): '#E8A830' | '#E24B4A' {
  if (valor < 30) return '#E24B4A'
  return '#E8A830'
}

export function flattenVariaveis(cv: OpportunityCardVariaveis): VariavelPontuacao[] {
  return [...cv.atratividade, ...cv.viabilidade, ...cv.seguranca]
}

export function buildDescricoesBarras(
  cv: OpportunityCardVariaveis,
  scores: { a: number; v: number; s: number },
): [string, string, string] {
  return [
    gerarDescricaoDimensao(cv.atratividade, scores.a),
    gerarDescricaoDimensao(cv.viabilidade, scores.v),
    gerarDescricaoDimensao(cv.seguranca, scores.s),
  ]
}

/** Valores mock das variáveis do accordion, orbitando o sub-score da dimensão (mantido até integração real). */
export function mockVarValor(subScore: number, varIndex: number): number {
  const offsets = [-15, -8, 0, 8, 15, -5, 5]
  const offset = offsets[varIndex % offsets.length] ?? 0
  const val = Math.round(subScore + offset + Math.sin(varIndex * 2.7) * 10)
  return Math.max(5, Math.min(100, val))
}

function normSubKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function textoRelevanciaSubstancia(sub: string): string {
  const n = normSubKey(sub)
  if (
    ['OURO', 'COBRE', 'LITIO', 'NIQUEL', 'NIOBIO', 'NEODIMIO', 'DISPROSIO'].includes(n)
  ) {
    return 'mineral crítico, alta demanda global'
  }
  if (n === 'FERRO') return 'commodity de base, demanda estável'
  if (n === 'BAUXITA') return 'demanda estável, baixa criticidade'
  if (n === 'QUARTZO') return 'baixa criticidade, mercado de nicho'
  return 'relevância setorial moderada'
}

function textoPrecoUsdT(sub: string): string {
  const n = normSubKey(sub)
  const m: Record<string, string> = {
    OURO: 'US$ 62.000/t, tendência de alta',
    COBRE: 'US$ 8.500/t, volatilidade moderada',
    LITIO: 'US$ 12.400/t, volatilidade alta',
    FERRO: 'US$ 110/t, estável',
    BAUXITA: 'US$ 38/t, estável (-0.5% a.a.)',
    NIOBIO: 'US$ 41.000/t, tendência de alta',
    NIQUEL: 'US$ 16.000/t, oscilação recente',
    QUARTZO: 'US$ 50/t, mercado estável',
    NEODIMIO: 'US$ 68.000/t, demanda crescente',
    DISPROSIO: 'US$ 290.000/t, oferta restrita',
  }
  return m[n] ?? 'Preço de referência não disponível'
}

function textoGapReservaProducao(valor: number): string {
  const mult = Math.round(valor / 10)
  if (valor >= 70) return `Reserva nacional ${mult}x produção anual`
  if (valor >= 40) return `Gap reserva/produção moderado (${mult}x)`
  return 'Gap reduzido, produção próxima da reserva'
}

function textoTendenciaDemanda(valor: number): string {
  if (valor >= 70) return 'Demanda global em alta (minerais críticos)'
  if (valor >= 40) return 'Demanda global estável'
  return 'Demanda em retração ou substituição tecnológica'
}

function textoCapagMunicipio(valor: number): string {
  if (valor >= 80) return 'CAPAG A, receita própria elevada'
  if (valor >= 60) return 'CAPAG B, ambiente fiscal moderado'
  if (valor >= 40) return 'CAPAG C, capacidade fiscal limitada'
  return 'CAPAG D, endividamento elevado'
}

function textoFaseProcesso(fase: Processo['fase']): string {
  if (fase === 'lavra') return 'Concessão de Lavra ativa'
  if (fase === 'concessao') return 'Concessão aprovada, caminho operacional claro'
  if (fase === 'pesquisa') return 'Fase de Pesquisa (autorizada)'
  if (fase === 'requerimento') return 'Requerimento de Pesquisa'
  if (fase === 'encerrado') return 'Processo encerrado'
  return 'Processo encerrado'
}

function textoInfraLogistica(valor: number): string {
  if (valor >= 70) return 'Ferrovia e rodovia próximas, logística favorável'
  if (valor >= 40) return 'Infraestrutura disponível, distância moderada'
  return 'Acesso precário, infraestrutura distante'
}

function textoAutonomiaFiscal(valor: number): string {
  if (valor >= 70) return `Autonomia fiscal ${valor}%`
  if (valor >= 40) return `Autonomia fiscal moderada (${valor}%)`
  return `Autonomia fiscal baixa (${valor}%)`
}

function textoSituacaoProcesso(s: Processo['situacao']): string {
  if (s === 'ativo') return 'Processo ativo, sem pendências'
  if (s === 'inativo') return 'Processo inativo na ANM'
  if (s === 'bloqueado') return 'Processo bloqueado na ANM'
  return `Situação: ${s}`
}

function textoIncentivosRegionais(valor: number): string {
  if (valor >= 60) return 'Área de atuação Sudene/Sudam ou incentivos estaduais'
  if (valor >= 40) return 'Fora de área prioritária'
  return 'Sem incentivos regionais identificados'
}

function qualificadorRiskScore(risk: number): 'baixo' | 'médio' | 'alto' {
  if (risk < 40) return 'baixo'
  if (risk < 70) return 'médio'
  return 'alto'
}

function textoConformidadeAmbiental(valor: number): string {
  if (valor >= 70) return 'Sem sobreposição com UCs ou TIs'
  if (valor >= 40) return 'Proximidade com área protegida'
  return 'Sobreposição parcial com APP ou UC'
}

function textoRegularidadeRegulatoria(valor: number): string {
  if (valor >= 70) return '0 alertas restritivos em 12 meses'
  if (valor >= 40) return '1-2 alertas restritivos em 12 meses'
  return '3+ alertas restritivos em 12 meses'
}

function textoHistoricoDespachos(valor: number): string {
  if (valor >= 70) return 'Último despacho recente (< 30 dias)'
  if (valor >= 40) return `Último despacho há ${Math.round(180 - valor * 1.5)} dias`
  return 'Último despacho há mais de 6 meses'
}

function textoAusenciaRestricoes(valor: number): string {
  if (valor >= 70) return 'Nenhuma restrição publicada em 12 meses'
  if (valor >= 40) return '1-2 restrições publicadas em 6 meses'
  return '3+ restrições publicadas em 6 meses'
}

function textoAlertasFavoraveis(valor: number): string {
  if (valor >= 70) return `${Math.round(valor / 10)} alertas favoráveis em 12 meses`
  if (valor >= 40) return `${Math.round(valor / 15)} alertas favoráveis em 12 meses`
  return 'Poucos alertas favoráveis recentes'
}

/**
 * Gera texto e fonte por variável a partir de `Processo` + scores; `valor` segue `mockVarValor` por dimensão.
 */
export function gerarVariaveisAutomaticas(
  processo: Processo,
  scores: OpportunityResult,
): OpportunityCardVariaveis {
  const sub = processo.substancia
  const a = scores.scoreAtratividade
  const v = scores.scoreViabilidade
  const s = scores.scoreSeguranca

  const va0 = mockVarValor(a, 0)
  const va1 = mockVarValor(a, 1)
  const va2 = mockVarValor(a, 2)
  const va3 = mockVarValor(a, 3)
  const va4 = mockVarValor(a, 4)

  const vb0 = mockVarValor(v, 0)
  const vb1 = mockVarValor(v, 1)
  const vb2 = mockVarValor(v, 2)
  const vb3 = mockVarValor(v, 3)
  const vb4 = mockVarValor(v, 4)
  const vb5 = mockVarValor(v, 5)
  const vb6 = mockVarValor(v, 6)

  const vc0 = mockVarValor(s, 0)
  const vc1 = mockVarValor(s, 1)
  const vc2 = mockVarValor(s, 2)
  const vc3 = mockVarValor(s, 3)
  const vc4 = mockVarValor(s, 4)
  const vc5 = mockVarValor(s, 5)

  const rs = processo.risk_score ?? 0

  const valorReservaTexto =
    processo.valor_estimado_usd_mi === 0
      ? 'Valor de reserva não estimado'
      : `Reserva estimada em US$ ${processo.valor_estimado_usd_mi}M`

  return {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: va0,
        texto: `${sub}: ${textoRelevanciaSubstancia(sub)}`,
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: va1,
        texto: textoGapReservaProducao(va1),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: va2,
        texto: textoPrecoUsdT(sub),
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: va3,
        texto: textoTendenciaDemanda(va3),
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: va4,
        texto: valorReservaTexto,
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: vb0,
        texto: textoCapagMunicipio(vb0),
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: vb1,
        texto: textoFaseProcesso(processo.fase),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: vb2,
        texto: textoInfraLogistica(vb2),
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: vb3,
        texto: `${processo.area_ha.toLocaleString('pt-BR')} ha`,
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: vb4,
        texto: textoAutonomiaFiscal(vb4),
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: vb5,
        texto: textoSituacaoProcesso(processo.situacao),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: vb6,
        texto: textoIncentivosRegionais(vb6),
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: vc0,
        texto: `Risk Score ${rs}/100 (${qualificadorRiskScore(rs)})`,
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: vc1,
        texto: textoConformidadeAmbiental(vc1),
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: vc2,
        texto: textoRegularidadeRegulatoria(vc2),
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: vc3,
        texto: textoHistoricoDespachos(vc3),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: vc4,
        texto: textoAusenciaRestricoes(vc4),
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: vc5,
        texto: textoAlertasFavoraveis(vc5),
        fonte: 'Adoo',
      },
    ],
  }
}
