import type { AlertaLegislativo, Processo } from '../types'

export type PerfilRisco = 'conservador' | 'moderado' | 'arrojado'
export type ObjetivoProspeccao = 'investir' | 'novo_requerimento' | 'avaliar_portfolio'

export interface OpportunityResult {
  processoId: string
  scoreTotal: number
  scoreAtratividade: number
  scoreViabilidade: number
  scoreSeguranca: number
  faixa: 'alta' | 'moderada' | 'baixa' | 'desfavoravel'
  fatoresPositivos: string[]
  fatoresAtencao: string[]
}

const RELEVANCIA_SUBSTANCIA: Record<string, number> = {
  DISPRÓSIO: 100,
  NEODÍMIO: 95,
  'TERRAS RARAS': 95,
  LÍTIO: 90,
  NIÓBIO: 85,
  NÍQUEL: 75,
  OURO: 70,
  COBRE: 65,
  FERRO: 45,
  BAUXITA: 40,
  QUARTZO: 25,
}

const GAP_SUBSTANCIA: Record<string, number> = {
  DISPRÓSIO: 22.2,
  NEODÍMIO: 22.2,
  'TERRAS RARAS': 22.2,
  NIÓBIO: 6.0,
  LÍTIO: 3.0,
  NÍQUEL: 6.0,
  FERRO: -5.0,
  OURO: 1.0,
  COBRE: 1.0,
  BAUXITA: -2.0,
  QUARTZO: -2.0,
}

const PRECO_USD_T: Record<string, number> = {
  DISPRÓSIO: 290_000,
  NEODÍMIO: 68_000,
  LÍTIO: 13_000,
  NIÓBIO: 41_000,
  NÍQUEL: 16_000,
  OURO: 62_000,
  COBRE: 8500,
  FERRO: 110,
  BAUXITA: 50,
  QUARTZO: 30,
  'TERRAS RARAS': 68_000,
}

const TENDENCIA_SUBSTANCIA: Record<string, 'alta' | 'estavel' | 'queda'> = {
  DISPRÓSIO: 'alta',
  NEODÍMIO: 'alta',
  'TERRAS RARAS': 'alta',
  LÍTIO: 'alta',
  NIÓBIO: 'estavel',
  NÍQUEL: 'alta',
  OURO: 'estavel',
  COBRE: 'alta',
  FERRO: 'estavel',
  BAUXITA: 'estavel',
  QUARTZO: 'queda',
}

export const PESOS_PERFIL: Record<PerfilRisco, { a: number; b: number; c: number }> = {
  conservador: { a: 0.25, b: 0.3, c: 0.45 },
  moderado: { a: 0.4, b: 0.3, c: 0.3 },
  arrojado: { a: 0.55, b: 0.25, c: 0.2 },
}

function normSubKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function lookup<T>(map: Record<string, T>, substancia: string): T | undefined {
  const n = normSubKey(substancia)
  for (const k of Object.keys(map)) {
    if (normSubKey(k) === n) return map[k]
  }
  return undefined
}

export function normalizeGap(gap: number): number {
  if (gap > 20) return 100
  if (gap >= 10) return 75
  if (gap >= 5) return 50
  if (gap >= 0) return 30
  return 15
}

export function normalizeValorEstimado(v: number): number {
  if (v > 500) return 100
  if (v >= 200) return 80
  if (v >= 50) return 55
  if (v >= 10) return 35
  return 15
}

function normalizeArea(ha: number): number {
  if (ha > 2000) return 100
  if (ha >= 500) return 65
  if (ha >= 100) return 40
  return 20
}

function normalizeAutonomiaFiscal(receita: number, divida: number): number {
  const s = receita + divida
  if (s <= 0) return 50
  return Math.round((receita / s) * 100)
}

function normalizeIncentivos(incentivos: number, bndes: number): number {
  if (incentivos > 0 && bndes > 0) return 100
  if (incentivos > 0 || bndes > 0) return 60
  return 20
}

export function normalizeRecenciaDespacho(dataIso: string): number {
  const t = new Date(`${dataIso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return 50
  const dias = Math.floor((Date.now() - t) / 86400000)
  if (dias <= 30) return 100
  if (dias <= 180) return 70
  if (dias <= 365) return 40
  return 15
}

export function normalizeAlertasRestritivos(alertas: AlertaLegislativo[]): number {
  const count = alertas.filter((a) => a.tipo_impacto === 'restritivo').length
  if (count === 0) return 100
  if (count === 1) return 60
  if (count === 2) return 30
  return 10
}

export function normalizeAlertasFavoraveis(alertas: AlertaLegislativo[]): number {
  const count = alertas.filter((a) => a.tipo_impacto === 'favoravel').length
  if (count === 0) return 40
  if (count === 1) return 70
  return 100
}

function scoreFaseB2(fase: Processo['fase']): number {
  if (fase === 'lavra') return 100
  if (fase === 'concessao') return 80
  if (fase === 'pesquisa') return 50
  if (fase === 'requerimento') return 25
  return 0
}

function scoreB1Capag(capag: Processo['fiscal']['capag']): number {
  if (capag === 'A') return 100
  if (capag === 'B') return 70
  if (capag === 'C') return 35
  return 10
}

function scoreB6Situacao(s: Processo['situacao']): number {
  if (s === 'ativo') return 100
  if (s === 'inativo') return 20
  return 0
}

export function faixaFromScore(score: number): OpportunityResult['faixa'] {
  if (score >= 75) return 'alta'
  if (score >= 50) return 'moderada'
  if (score >= 25) return 'baixa'
  return 'desfavoravel'
}

export function corFaixaOpportunity(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return '#1D9E75'
  if (faixa === 'moderada') return '#E8A830'
  if (faixa === 'baixa') return '#888780'
  return '#E24B4A'
}

export function labelFaixaOpportunity(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return 'ALTA'
  if (faixa === 'moderada') return 'MODERADA'
  if (faixa === 'baixa') return 'BAIXA'
  return 'NÃO RECOMENDADO'
}

/** Cores fixas por dimensão (pesos e identificação visual; independentes do sub-score). */
export const CORES_DIMENSAO = {
  atratividade: '#E8A830',
  viabilidade: '#5CBFA0',
  seguranca: '#1D9E75',
} as const

/** Cor da mini-barra por valor 0–100: ≥70 verde, 40–69 âmbar, &lt;40 vermelho */
export function corMiniBarraValor(v: number): string {
  if (v >= 70) return '#1D9E75'
  if (v >= 40) return '#E8A830'
  return '#E24B4A'
}

/** Qualificador alinhado a `corMiniBarraValor` (mesmos limites). A cor é sempre a da barra. */
export function qualificadorTextoMiniBarra(valor: number): { label: string; color: string } {
  const color = corMiniBarraValor(valor)
  if (valor >= 70) return { label: 'Alto', color }
  if (valor >= 40) return { label: 'Médio', color }
  return { label: 'Baixo', color }
}

type Contrib = { key: string; prod: number; v: number }

function pushContrib(
  out: Contrib[],
  key: string,
  v: number,
  wInterno: number,
  pesoPilar: number,
) {
  out.push({ key, prod: v * wInterno * pesoPilar, v })
}

function textoFatorNegativo(
  key: string,
  _v: number,
  p: Processo,
  ctx: {
    gap: number
    tend: 'alta' | 'estavel' | 'queda'
    recencia: number
    nRest: number
    nFav: number
  },
): string | null {
  const { nRest } = ctx
  switch (key) {
    case 'A1':
      return 'Relevância de mercado da substância abaixo do núcleo estratégico'
    case 'A2':
      return ctx.gap < 0
        ? 'Produção nacional 12% abaixo da reserva estimada (USGS 2024)'
        : 'Dinâmica de oferta/demanda sem folga expressiva'
    case 'A3':
      return 'Preço spot de referência em faixa inferior (commodity pressionada)'
    case 'A4':
      return ctx.tend === 'queda'
        ? 'Tendência de demanda em queda'
        : 'Demanda sem impulso de alta no horizonte recente'
    case 'A5':
      return 'Valor estimado de reservas em faixa inferior'
    case 'B1':
      return p.fiscal.capag === 'C'
        ? 'CAPAG C, município com fragilidade fiscal'
        : 'Nota CAPAG abaixo do ideal para projetos longos'
    case 'B2':
      return 'Fase ainda distante da lavra (maior incerteza de prazo)'
    case 'B3':
      return 'Distância a ferrovia/porto acima da média regional (referência ANM)'
    case 'B4':
      return 'Área útil reduzida para escala industrial'
    case 'B5':
      return 'Autonomia fiscal municipal pressionada (receita vs. dívida)'
    case 'B6':
      return p.situacao === 'bloqueado'
        ? 'Processo bloqueado na ANM'
        : 'Situação inativa reduz previsibilidade operacional'
    case 'B7':
      return 'Poucos incentivos estaduais ou linhas BNDES mapeados'
    case 'C1':
      return p.risk_score != null && p.risk_score >= 75
        ? `Risk Score ${p.risk_score}/100, sobreposições e riscos territoriais elevados (ANM/ICMBio)`
        : `Risk Score ${p.risk_score ?? 0}/100, atenção a sobreposições parciais`
    case 'C2':
      return 'Componente ambiental do risco pressionado'
    case 'C3':
      return 'Trâmite regulatório com indicadores de risco elevados (ANM)'
    case 'C4':
      return ctx.recencia <= 40
        ? 'Último despacho ANM há mais de 1 ano'
        : 'Recência de despachos abaixo do ideal'
    case 'C5':
      return nRest > 0
        ? 'Alerta restritivo recente (licenciamento em APP)'
        : 'Histórico com alertas restritivos no processo'
    case 'C6':
      return 'Poucos drivers regulatórios favoráveis'
    default:
      return null
  }
}

function textoFator(
  key: string,
  p: Processo,
  ctx: {
    gap: number
    preco: number
    tend: 'alta' | 'estavel' | 'queda'
    recencia: number
    nRest: number
    nFav: number
  },
): string | null {
  switch (key) {
    case 'A1':
      return `${p.substancia} com alta relevância estratégica no mercado`
    case 'A2':
      if (ctx.gap > 15)
        return `Mineral estratégico com gap de +${ctx.gap.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`
      if (ctx.gap > 0) return 'Balanço reserva/produção ligeiramente favorável'
      return 'Balanço reserva/produção pressionado no mercado global'
    case 'A3':
      return `Referência de preço spot ~US$ ${Math.round(ctx.preco).toLocaleString('pt-BR')}/t`
    case 'A4':
      if (ctx.tend === 'alta') return 'Tendência de demanda alta'
      if (ctx.tend === 'estavel') return 'Demanda estável no horizonte recente'
      return 'Demanda em queda no referencial de mercado'
    case 'A5':
      return `Valor estimado de reservas ~US$ ${p.valor_estimado_usd_mi.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mi`
    case 'B1':
      return p.fiscal.capag === 'A'
        ? 'Classificação fiscal A (STN/SICONFI), receita própria elevada'
        : p.fiscal.capag === 'B'
          ? 'CAPAG B, ambiente fiscal moderado'
          : 'CAPAG fraca, atenção à autonomia municipal'
    case 'B2':
      return p.fase === 'lavra'
        ? 'Processo em fase de lavra (maduro)'
        : p.fase === 'concessao'
          ? 'Concessão aprovada, caminho operacional claro'
          : 'Fase ainda incipiente no ciclo ANM'
    case 'B3':
      return 'Logística: ferrovia/porto com distância média (referência ANM)'
    case 'B4':
      return `Área de ${p.area_ha.toLocaleString('pt-BR')} ha na faixa típica de escala`
    case 'B5':
      return 'Indicadores de receita própria vs. dívida consolidada equilibrados'
    case 'B6':
      return p.situacao === 'ativo'
        ? 'Situação ativa junto à ANM'
        : 'Situação inativa ou bloqueada reduz previsibilidade'
    case 'B7':
      return p.fiscal.incentivos_estaduais.length > 0 && p.fiscal.linhas_bndes.length > 0
        ? 'CAPAG A, incentivos fiscais ativos'
        : p.fiscal.incentivos_estaduais.length > 0 || p.fiscal.linhas_bndes.length > 0
          ? 'Incentivos estaduais ou linhas BNDES identificados'
          : 'Poucos incentivos explícitos no cadastro'
    case 'C1':
      return p.risk_score != null && p.risk_score >= 75
        ? `Risk Score ${p.risk_score}/100, sobreposições e riscos territoriais elevados (ANM/ICMBio)`
        : `Risk Score ${p.risk_score ?? 0}/100, sem sobreposições territoriais identificadas (ANM/ICMBio)`
    case 'C2':
      return p.risk_breakdown && p.risk_breakdown.ambiental >= 70
        ? 'Componente ambiental do risco pressionado'
        : 'Componente ambiental do risco moderado'
    case 'C3':
      return p.risk_breakdown && p.risk_breakdown.regulatorio >= 70
        ? 'Risco regulatório elevado'
        : 'Trâmite regulatório com folga relativa'
    case 'C4':
      return ctx.recencia <= 40
        ? 'Último despacho ANM há mais de 1 ano'
        : 'Recência de despachos favorável'
    case 'C5':
      return 'Ausência de alertas regulatórios restritivos no processo'
    case 'C6':
      return ctx.nFav >= 2
        ? 'Múltiplos alertas favoráveis vinculados'
        : ctx.nFav === 1
          ? 'Alerta favorável recente no histórico'
          : 'Poucos drivers regulatórios favoráveis'
    default:
      return null
  }
}

export function computeOpportunityForProcesso(
  processo: Processo,
  perfilRisco: PerfilRisco,
  objetivo: ObjetivoProspeccao,
): OpportunityResult {
  const sub = processo.substancia
  const A1 = lookup(RELEVANCIA_SUBSTANCIA, sub) ?? 30
  const gapRaw = lookup(GAP_SUBSTANCIA, sub) ?? 0
  const A2 = normalizeGap(gapRaw)
  const preco = lookup(PRECO_USD_T, sub) ?? 1000
  const A3 = Math.min(
    100,
    Math.round((Math.log10(Math.max(preco, 1)) / Math.log10(300_000)) * 100),
  )
  const tend = lookup(TENDENCIA_SUBSTANCIA, sub) ?? 'estavel'
  const A4 = tend === 'alta' ? 100 : tend === 'estavel' ? 50 : 10
  const A5 = normalizeValorEstimado(processo.valor_estimado_usd_mi)
  const scoreA =
    A1 * 0.25 + A2 * 0.25 + A3 * 0.2 + A4 * 0.15 + A5 * 0.15

  const B1 = scoreB1Capag(processo.fiscal.capag)
  const B2 = scoreFaseB2(processo.fase)
  const B3 = 50
  const B4 = normalizeArea(processo.area_ha)
  const B5 = normalizeAutonomiaFiscal(
    processo.fiscal.receita_propria_mi,
    processo.fiscal.divida_consolidada_mi,
  )
  const B6 = scoreB6Situacao(processo.situacao)
  const B7 = normalizeIncentivos(
    processo.fiscal.incentivos_estaduais.length,
    processo.fiscal.linhas_bndes.length,
  )
  const scoreB =
    B1 * 0.2 +
    B2 * 0.2 +
    B3 * 0.15 +
    B4 * 0.1 +
    B5 * 0.1 +
    B6 * 0.15 +
    B7 * 0.1

  const rb = processo.risk_breakdown
  const C1 = 100 - (processo.risk_score ?? 50)
  const C2 = 100 - (rb?.ambiental ?? 50)
  const C3 = 100 - (rb?.regulatorio ?? 50)
  const C4 = normalizeRecenciaDespacho(processo.ultimo_despacho_data)
  const C5 = normalizeAlertasRestritivos(processo.alertas)
  const C6 = normalizeAlertasFavoraveis(processo.alertas)
  const scoreC = C1 * 0.35 + C2 * 0.2 + C3 * 0.15 + C4 * 0.15 + C5 * 0.1 + C6 * 0.05

  const pesos = PESOS_PERFIL[perfilRisco]
  let score = Math.round(scoreA * pesos.a + scoreB * pesos.b + scoreC * pesos.c)

  if (processo.regime === 'bloqueio_permanente') score = Math.min(score, 10)
  else if (processo.fase === 'encerrado') score = Math.min(score, 20)
  else if (processo.regime === 'bloqueio_provisorio') score = Math.round(score * 0.6)
  else if (processo.situacao === 'bloqueado') score = Math.round(score * 0.7)
  else if ((processo.risk_score ?? 0) >= 90) score = Math.round(score * 0.5)

  score = Math.max(0, Math.min(100, score))

  const faixa = faixaFromScore(score)

  const contribs: Contrib[] = []
  pushContrib(contribs, 'A1', A1, 0.25, pesos.a)
  pushContrib(contribs, 'A2', A2, 0.25, pesos.a)
  pushContrib(contribs, 'A3', A3, 0.2, pesos.a)
  pushContrib(contribs, 'A4', A4, 0.15, pesos.a)
  pushContrib(contribs, 'A5', A5, 0.15, pesos.a)
  pushContrib(contribs, 'B1', B1, 0.2, pesos.b)
  pushContrib(contribs, 'B2', B2, 0.2, pesos.b)
  pushContrib(contribs, 'B3', B3, 0.15, pesos.b)
  pushContrib(contribs, 'B4', B4, 0.1, pesos.b)
  pushContrib(contribs, 'B5', B5, 0.1, pesos.b)
  pushContrib(contribs, 'B6', B6, 0.15, pesos.b)
  pushContrib(contribs, 'B7', B7, 0.1, pesos.b)
  pushContrib(contribs, 'C1', C1, 0.35, pesos.c)
  pushContrib(contribs, 'C2', C2, 0.2, pesos.c)
  pushContrib(contribs, 'C3', C3, 0.15, pesos.c)
  pushContrib(contribs, 'C4', C4, 0.15, pesos.c)
  pushContrib(contribs, 'C5', C5, 0.1, pesos.c)
  pushContrib(contribs, 'C6', C6, 0.05, pesos.c)

  const sortedDesc = [...contribs].sort((a, b) => b.prod - a.prod)
  const sortedAsc = [...contribs].sort((a, b) => a.prod - b.prod)

  const nRest = processo.alertas.filter((a) => a.tipo_impacto === 'restritivo').length
  const nFav = processo.alertas.filter((a) => a.tipo_impacto === 'favoravel').length
  const ctx = {
    gap: gapRaw,
    preco,
    tend,
    recencia: C4,
    nRest,
    nFav,
  }

  const fatoresPositivos: string[] = []
  for (const c of sortedDesc) {
    if (fatoresPositivos.length >= 3) break
    if (c.v < 50) continue
    const t = textoFator(c.key, processo, ctx)
    if (t && !fatoresPositivos.includes(t)) fatoresPositivos.push(t)
  }

  const fatoresAtencao: string[] = []
  for (const c of sortedAsc) {
    if (fatoresAtencao.length >= 2) break
    const t = textoFatorNegativo(c.key, c.v, processo, ctx)
    if (t && !fatoresAtencao.includes(t)) fatoresAtencao.push(t)
  }

  if (objetivo === 'investir' && fatoresPositivos.length < 3) {
    const extra = 'Encaixe com estratégia de investimento em ativo titulado'
    if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)
  }
  if (objetivo === 'novo_requerimento' && fatoresPositivos.length < 3) {
    const extra = 'Benchmark útil para novos requerimentos na mesma região/substância'
    if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)
  }
  if (objetivo === 'avaliar_portfolio' && fatoresPositivos.length < 3) {
    const extra = 'Leitura de benchmarking para revisão de portfólio'
    if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)
  }

  while (fatoresPositivos.length > 3) fatoresPositivos.pop()

  if (fatoresAtencao.length < 2) {
    if (
      processo.risk_breakdown &&
      processo.risk_breakdown.social >= 65 &&
      !fatoresAtencao.some((x) => x.includes('social'))
    ) {
      fatoresAtencao.push('Proximidade a terras indígenas / uso do solo (FUNAI/ICMBio)')
    }
  }
  while (fatoresAtencao.length > 2) fatoresAtencao.pop()

  return {
    processoId: processo.id,
    scoreTotal: score,
    scoreAtratividade: Math.round(scoreA),
    scoreViabilidade: Math.round(scoreB),
    scoreSeguranca: Math.round(scoreC),
    faixa,
    fatoresPositivos: fatoresPositivos.slice(0, 3),
    fatoresAtencao: fatoresAtencao.slice(0, 2),
  }
}

export function runProspeccao(
  processos: Processo[],
  perfil: PerfilRisco,
  objetivo: ObjetivoProspeccao,
): { ranked: OpportunityResult[]; excludedCount: number } {
  const ranked = processos
    .map((p) => computeOpportunityForProcesso(p, perfil, objetivo))
    .sort((a, b) => b.scoreTotal - a.scoreTotal)
  const excludedCount = ranked.filter((r) => r.scoreTotal <= 24).length
  return { ranked, excludedCount }
}
