/**
 * Motor de scores (Risk + Opportunity) — cálculo puro, sem I/O.
 * Pesos e lookups alinhados a TERRADAR-Config-Scores-v2.xlsx (comentários por aba).
 */

import type { S31DimensoesOportunidade, S31DimensoesRisco } from './scoringS31BreakdownTypes'

// ══════════════════════════════════════════════════
// CONSTANTES DE CÁLCULO
// ══════════════════════════════════════════════════

const TONELADAS_POR_HA = 750_000

// ── 1_PESOS_MASTER ──
const PESOS_RS = {
  geologico: 0.25,
  ambiental: 0.3,
  social: 0.25,
  regulatorio: 0.2,
}

const PESOS_RS_GEOLOGICO = {
  substancia: 0.3,
  fase: 0.45,
  qualidade: 0.25,
}

const PESOS_RS_SOCIAL = {
  idh: 0.35,
  densidade: 0.2,
  comunidades: 0.25,
  capag: 0.2,
}

const PESOS_RS_REGULATORIO = {
  tempo: 0.3,
  pendencias: 0.25,
  alertas: 0.25,
  caducidade: 0.2,
}

// ── 6_OS_ATRATIVIDADE ──
const PESOS_OS_ATRATIVIDADE = {
  a1_relevancia: 0.25,
  a2_gap: 0.25,
  a3_preco: 0.2,
  a4_tendencia: 0.15,
  a5_valor: 0.15,
}

// ── 7_OS_VIABILIDADE ──
const PESOS_OS_VIABILIDADE = {
  b1_capag: 0.2,
  b2_fase: 0.2,
  b3_infra: 0.15,
  b4_situacao: 0.15,
  b5_area: 0.1,
  b6_autonomia: 0.1,
  b7_incentivos: 0.1,
}

// ── 8_OS_SEGURANCA ──
const PESOS_OS_SEGURANCA = {
  c1_solidez: 0.35,
  c2_conformidade: 0.2,
  c3_regularidade: 0.15,
  c4_recencia: 0.15,
  c5_ausencia: 0.1,
  c6_favoraveis: 0.05,
}

// ── 9_OS_PERFIS ──
const PERFIS = {
  conservador: { atratividade: 0.25, viabilidade: 0.3, seguranca: 0.45 },
  moderado: { atratividade: 0.4, viabilidade: 0.3, seguranca: 0.3 },
  arrojado: { atratividade: 0.55, viabilidade: 0.25, seguranca: 0.2 },
} as const

// ── 2_RS_GEOLOGICO ──
const SCORE_SUBSTANCIA: Record<string, number> = {
  AREIA: 10,
  'AREIA COMUM': 10,
  CASCALHO: 10,
  SAIBRO: 10,
  ARGILA: 12,
  BASALTO: 12,
  GRANITO: 15,
  'ÁGUA MINERAL': 10,
  CALCÁRIO: 15,
  QUARTZO: 15,
  MÁRMORE: 18,
  CAULIM: 20,
  GIPSITA: 20,
  BENTONITA: 22,
  VERMICULITA: 22,
  CARVÃO: 25,
  FERRO: 25,
  FOSFATO: 28,
  FLUORITA: 30,
  BAUXITA: 30,
  MANGANÊS: 30,
  ESTANHO: 40,
  NIÓBIO: 40,
  ZINCO: 42,
  CHUMBO: 42,
  ILMENITA: 42,
  CROMITA: 45,
  RUTILO: 45,
  COBRE: 45,
  PRATA: 45,
  OURO: 50,
  MOLIBDÊNIO: 50,
  NÍQUEL: 55,
  GRAFITA: 55,
  PLATINA: 55,
  COBALTO: 58,
  BERILO: 60,
  TÂNTALO: 60,
  LÍTIO: 65,
  ESPODUMÊNIO: 65,
  'TERRAS RARAS': 68,
  NEODÍMIO: 70,
  DISPRÓSIO: 75,
  TÉRBIO: 75,
}

const SCORE_SUBSTANCIA_FAMILIA: Record<string, number> = {
  materiais_construcao: 12,
  aguas_minerais: 10,
  rochas_ornamentais: 20,
  minerais_industriais: 25,
  energeticos: 25,
  metais_ferrosos: 28,
  metais_base: 42,
  metais_preciosos: 50,
  minerais_estrategicos: 58,
  gemas_pedras: 50,
  outros: 50,
}

const FASE_MAP: Record<string, string> = {
  // Lavra (eixo mais maduro)
  'CONCESSÃO DE LAVRA': 'lavra',
  'CONCESSAO DE LAVRA': 'lavra',
  LAVRA: 'lavra',
  'LAVRA GARIMPEIRA': 'lavra',
  'REGISTRO DE EXTRAÇÃO': 'lavra',
  'REGISTRO DE EXTRACAO': 'lavra',

  // Concessão (eixo intermediário, processo encaminhado)
  'REQUERIMENTO DE LAVRA': 'concessao',
  'DIREITO DE REQUERER A LAVRA': 'concessao',
  LICENCIAMENTO: 'concessao',

  // Pesquisa (eixo em investigação)
  'AUTORIZAÇÃO DE PESQUISA': 'pesquisa',
  'AUTORIZACAO DE PESQUISA': 'pesquisa',
  PESQUISA: 'pesquisa',
  'RECONHECIMENTO GEOLÓGICO': 'pesquisa',
  'RECONHECIMENTO GEOLOGICO': 'pesquisa',

  // Requerimento (eixo mais precoce, sem dados geológicos)
  'REQUERIMENTO DE PESQUISA': 'requerimento',
  'REQUERIMENTO DE LAVRA GARIMPEIRA': 'requerimento',
  'REQUERIMENTO DE LICENCIAMENTO': 'requerimento',
  'REQUERIMENTO DE REGISTRO DE EXTRAÇÃO': 'requerimento',
  'REQUERIMENTO DE REGISTRO DE EXTRACAO': 'requerimento',

  // Encerrado (processo em estado terminal ou sem titular ativo)
  DISPONIBILIDADE: 'encerrado',
  'APTO PARA DISPONIBILIDADE': 'encerrado',
}

const SCORE_FASE_RS: Record<string, number> = {
  lavra: 15,
  concessao: 25,
  pesquisa: 55,
  requerimento: 75,
  encerrado: 90,
}

// ─────────────────────────────────────────────────
export interface ScoreInput {
  substancia: string
  substancia_familia: string
  fase: string
  regime: string | null
  area_ha: number
  alvara_validade: string | null
  uf: string
  /** Flag derivado por fn_derivar_campos_regulatorios. false = processo terminal. */
  ativo_derivado?: boolean

  areas_protegidas: {
    tipo: string
    nome: string
    categoria: string | null
    orgao: string | null
    distancia_km: number
  }[]
  infraestrutura: {
    tipo: string
    nome: string
    categoria: string | null
    distancia_km: number
  }[]
  portos: {
    nome: string
    uf: string | null
    distancia_km: number
  }[]
  bioma: { nome: string }[]
  aquiferos: { nome: string; tipo: string }[]

  mercado: {
    preco_usd: number | null
    gap_pp: number | null
    tendencia: string | null
    teor_pct: number | null
    mineral_critico_2025: boolean
  } | null

  capag: string | null
  score_incentivo: number | null

  /** Fiscal (`fiscal_municipios` / SICONFI + IBGE) */
  idh: number | null
  populacao: number | null
  area_km2: number | null
  /** Se preenchido (ex.: linha fiscal), evita recalcular pop/área */
  densidade: number | null
  receita_tributaria: number | null
  divida_consolidada: number | null

  /** Dias desde `processos.ultimo_evento_data` (despacho). */
  dias_sem_despacho?: number | null
  /** Contagem `fn_pendencias_processo(numero)`. */
  qtd_pendencias_anm?: number | null
  /** Dias até vencimento do alvará (negativo = vencido). Derivado de `alvara_validade`. */
  dias_ate_caducidade?: number | null
  /** Regime ANM (espelha `regime` quando preenchido pelo batch). */
  regime_anm?: string | null
}

export interface ScoreResult {
  risk_score: number
  risk_label: string
  risk_cor: string
  risk_breakdown: {
    geologico: number
    ambiental: number
    social: number
    regulatorio: number
  }
  /** Preenchido quando o motor S31 roda com `returnSubfatores: true` */
  dimensoes_risco?: S31DimensoesRisco
  dimensoes_oportunidade?: S31DimensoesOportunidade
  os_conservador: number
  os_moderado: number
  os_arrojado: number
  os_label_conservador: string
  os_label_moderado: string
  os_label_arrojado: string
  os_breakdown: {
    atratividade: number
    viabilidade: number
    seguranca: number
  }
  detail: {
    scoreSubstancia: number
    scoreFase: number
    scoreQualidade: number
    scoreComunidades: number
    scoreCAPAG_rs: number
    scoreCaducidade: number
    scoreRegTempo: number
    scoreRegPendencias: number
    scoreRegAlertas: number
    a1: number
    a2: number
    a3: number
    a4: number
    a5: number
    b1: number
    b2: number
    b3: number
    b4: number
    b5: number
    b6: number
    b7: number
    c1: number
    c2: number
    c3: number
    c4: number
    c5: number
    c6: number
  }
  fallbacks_usados: string[]
}

function mapFase(faseSigmine: string): string {
  const normalizada = faseSigmine.toUpperCase().trim()
  return FASE_MAP[normalizada] ?? 'requerimento'
}

function getScoreQualidade(faseTerradar: string): number {
  if (faseTerradar === 'lavra' || faseTerradar === 'concessao') return 20
  if (faseTerradar === 'pesquisa') return 50
  return 80
}

function computeRsAmbiental(input: ScoreInput): number {
  let soma = 0

  const tiIntersecta = input.areas_protegidas.some(
    (ap) => ap.tipo === 'TI' && ap.distancia_km <= 0.5,
  )
  if (tiIntersecta) soma += 40

  // UC Proteção Integral (ICMBio: ex. `PI (ESEC)`, `PI (PARNA)`)
  const ucPiIntersecta = input.areas_protegidas.some((ap) => {
    const c = ap.categoria?.trim()
    return (
      ap.tipo === 'UC' &&
      ap.distancia_km <= 0.5 &&
      (c?.toUpperCase().startsWith('PI') ?? false)
    )
  })
  if (ucPiIntersecta) soma += 35

  const quilombolaIntersecta = input.areas_protegidas.some(
    (ap) => ap.tipo === 'QUILOMBOLA' && ap.distancia_km <= 0.5,
  )
  if (quilombolaIntersecta) soma += 20

  // UC Uso Sustentável (ex. `US (APA)`, `US (FLONA)`)
  const ucUsProxima = input.areas_protegidas.some((ap) => {
    const c = ap.categoria?.trim()
    return (
      ap.tipo === 'UC' &&
      ap.distancia_km <= 5.0 &&
      (c?.toUpperCase().startsWith('US') ?? false)
    )
  })
  if (ucUsProxima) soma += 15

  if (input.aquiferos.length > 0) soma += 10

  const biomas = input.bioma.map((b) => b.nome.toUpperCase())
  if (biomas.some((b) => b.includes('AMAZÔNIA') || b.includes('AMAZONIA')))
    soma += 10
  if (
    biomas.some((b) => b.includes('MATA ATLÂNTICA') || b.includes('MATA ATLANTICA'))
  )
    soma += 8
  if (biomas.some((b) => b.includes('PANTANAL'))) soma += 8

  return Math.min(soma, 100)
}

function computeRsSocial(
  input: ScoreInput,
  fallbacks: string[],
): {
  score: number
  breakdown: { idh: number; densidade: number; comunidades: number; capag: number }
} {
  let scoreIDH: number
  const idh = input.idh
  if (idh == null) {
    scoreIDH = 35
    fallbacks.push('scoreIDH: fallback 35 (sem IDH)')
  } else if (idh < 0.5) scoreIDH = 80
  else if (idh < 0.6) scoreIDH = 60
  else if (idh < 0.7) scoreIDH = 35
  else if (idh < 0.8) scoreIDH = 15
  else scoreIDH = 5

  let densidadeHab =
    input.densidade != null && !Number.isNaN(input.densidade)
      ? input.densidade
      : null
  if (
    densidadeHab == null &&
    input.populacao != null &&
    input.area_km2 != null &&
    input.area_km2 > 0
  ) {
    densidadeHab = input.populacao / input.area_km2
  }

  let scoreDensidade: number
  if (densidadeHab == null) {
    scoreDensidade = 5
    fallbacks.push('scoreDensidade: fallback 5 (sem IBGE)')
  } else if (densidadeHab > 100) scoreDensidade = 60
  else if (densidadeHab > 50) scoreDensidade = 35
  else if (densidadeHab > 10) scoreDensidade = 15
  else scoreDensidade = 5

  const distsTiQuil = input.areas_protegidas
    .filter((ap) => ap.tipo === 'TI' || ap.tipo === 'QUILOMBOLA')
    .map((ap) => ap.distancia_km)
  const minDistComunidade =
    distsTiQuil.length > 0 ? Math.min(...distsTiQuil) : Infinity

  let scoreComunidades: number
  if (minDistComunidade < 5) scoreComunidades = 65
  else if (minDistComunidade < 10) scoreComunidades = 35
  else if (minDistComunidade < 20) scoreComunidades = 15
  else scoreComunidades = 5

  let scoreCAPAG: number
  const capag = input.capag?.toUpperCase()?.trim()
  if (capag === 'D') scoreCAPAG = 60
  else if (capag === 'C') scoreCAPAG = 40
  else if (capag === 'B') scoreCAPAG = 15
  else if (capag === 'A') scoreCAPAG = 5
  else if (capag === 'N.D.' || capag === 'N.E.' || !capag) scoreCAPAG = 30
  else scoreCAPAG = 30

  const score =
    scoreIDH * PESOS_RS_SOCIAL.idh +
    scoreDensidade * PESOS_RS_SOCIAL.densidade +
    scoreComunidades * PESOS_RS_SOCIAL.comunidades +
    scoreCAPAG * PESOS_RS_SOCIAL.capag

  return {
    score: Math.round(score * 10) / 10,
    breakdown: {
      idh: scoreIDH,
      densidade: scoreDensidade,
      comunidades: scoreComunidades,
      capag: scoreCAPAG,
    },
  }
}

/** Regimes típicos sem prazo de alvará de pesquisa (proxy até campo explícito no banco). */
function regimeSemPrazoAlvara(regime: string | null): boolean {
  if (!regime) return false
  const r = regime.toLowerCase().trim()
  if (r.includes('disponibilidade')) return true
  if (r.includes('concessão de lavra') || r.includes('concessao de lavra')) {
    return true
  }
  return false
}

const MS_DIA = 1000 * 60 * 60 * 24

function resolveDiasAteCaducidade(input: ScoreInput): number | null {
  if (input.dias_ate_caducidade != null && !Number.isNaN(input.dias_ate_caducidade)) {
    return input.dias_ate_caducidade
  }
  if (!input.alvara_validade) return null
  const hoje = new Date()
  const validade = new Date(input.alvara_validade)
  if (Number.isNaN(validade.getTime())) return null
  return Math.floor((validade.getTime() - hoje.getTime()) / MS_DIA)
}

/** Faixas aba `5_RS_REGULATORIO` (tempo sem despacho). */
function scoreTempoFromDias(d: number | null | undefined): number {
  if (d == null || Number.isNaN(d)) return 50
  if (d > 365) return 80
  if (d >= 180) return 50
  if (d >= 30) return 20
  return 5
}

/** Faixas aba `5_RS_REGULATORIO` (pendências ANM). */
function scorePendenciasFromQtd(q: number | null | undefined): number {
  if (q == null || Number.isNaN(q)) return 5
  if (q >= 3) return 75
  if (q === 2) return 50
  if (q === 1) return 30
  return 5
}

/** Faixas aba `5_RS_REGULATORIO` (planilha: vencido = faixa única 90). */
function scoreCaducidadeFromDiasAte(
  diasAte: number | null,
  regimeParaSemAlvara: string | null,
): number {
  if (diasAte == null || Number.isNaN(diasAte)) {
    if (regimeSemPrazoAlvara(regimeParaSemAlvara)) return 5
    return 50
  }
  if (diasAte < 0) return 90
  if (diasAte < 180) return 85
  if (diasAte <= 365) return 50
  return 10
}

/** Faixa C4 aba `8_OS_SEGURANCA` (recência despachos). */
function scoreC4RecenciaFromDias(d: number | null | undefined): number {
  if (d == null || Number.isNaN(d)) return 25
  if (d < 30) return 100
  if (d < 90) return 75
  if (d < 180) return 50
  if (d <= 365) return 25
  return 15
}

function computeRsRegulatorio(input: ScoreInput): {
  score: number
  breakdown: { tempo: number; pendencias: number; alertas: number; caducidade: number }
} {
  const scoreTempo = scoreTempoFromDias(input.dias_sem_despacho)
  const scorePendencias = scorePendenciasFromQtd(input.qtd_pendencias_anm)
  const scoreAlertas = 5

  const regimeCad =
    input.regime_anm != null && input.regime_anm !== ''
      ? input.regime_anm
      : input.regime
  const diasAte = resolveDiasAteCaducidade(input)
  const scoreCaducidade = scoreCaducidadeFromDiasAte(diasAte, regimeCad)

  const score =
    scoreTempo * PESOS_RS_REGULATORIO.tempo +
    scorePendencias * PESOS_RS_REGULATORIO.pendencias +
    scoreAlertas * PESOS_RS_REGULATORIO.alertas +
    scoreCaducidade * PESOS_RS_REGULATORIO.caducidade

  return {
    score: Math.round(score * 10) / 10,
    breakdown: {
      tempo: scoreTempo,
      pendencias: scorePendencias,
      alertas: scoreAlertas,
      caducidade: scoreCaducidade,
    },
  }
}

function computeOsAtratividade(
  scoreSubstancia: number,
  input: ScoreInput,
): {
  score: number
  breakdown: { a1: number; a2: number; a3: number; a4: number; a5: number }
} {
  const a1 = scoreSubstancia

  let a2: number
  const gap = input.mercado?.gap_pp
  if (gap == null) a2 = 40
  else if (gap > 15) a2 = 95
  else if (gap >= 10) a2 = 80
  else if (gap >= 5) a2 = 60
  else if (gap >= 1) a2 = 40
  else a2 = 15

  let a3: number
  const preco = input.mercado?.preco_usd
  if (!preco || preco <= 0) {
    a3 = 30
  } else {
    const log10 = Math.log10(preco)
    if (log10 > 4) a3 = 90
    else if (log10 >= 3) a3 = 70
    else if (log10 >= 2) a3 = 50
    else if (log10 >= 1) a3 = 30
    else a3 = 10
  }

  let a4: number
  const tend = input.mercado?.tendencia?.toLowerCase()?.trim()
  if (!tend) a4 = 50
  else if (tend === 'alta' || tend === 'alta (demanda)') a4 = 90
  else if (tend === 'estável' || tend === 'estavel') a4 = 50
  else if (tend === 'queda') a4 = 15
  else a4 = 50

  let a5: number
  const teor = input.mercado?.teor_pct
  const precoUsd = input.mercado?.preco_usd
  if (!teor || !precoUsd || teor <= 0 || precoUsd <= 0) {
    a5 = 10
  } else {
    const valReservaUsdHa =
      TONELADAS_POR_HA * (teor / 100) * precoUsd
    const valTotalMi = (valReservaUsdHa * input.area_ha) / 1_000_000
    if (valTotalMi >= 500) a5 = 95
    else if (valTotalMi >= 100) a5 = 75
    else if (valTotalMi >= 10) a5 = 50
    else if (valTotalMi >= 1) a5 = 25
    else a5 = 10
  }

  const score =
    a1 * PESOS_OS_ATRATIVIDADE.a1_relevancia +
    a2 * PESOS_OS_ATRATIVIDADE.a2_gap +
    a3 * PESOS_OS_ATRATIVIDADE.a3_preco +
    a4 * PESOS_OS_ATRATIVIDADE.a4_tendencia +
    a5 * PESOS_OS_ATRATIVIDADE.a5_valor

  return {
    score: Math.round(score * 10) / 10,
    breakdown: { a1, a2, a3, a4, a5 },
  }
}

function computeOsViabilidade(
  faseTerradar: string,
  input: ScoreInput,
): {
  score: number
  breakdown: {
    b1: number
    b2: number
    b3: number
    b4: number
    b5: number
    b6: number
    b7: number
  }
} {
  let b1: number
  const capag = input.capag?.toUpperCase()?.trim()
  if (capag === 'A') b1 = 90
  else if (capag === 'B') b1 = 70
  else if (capag === 'C') b1 = 40
  else if (capag === 'D') b1 = 15
  else b1 = 25

  const SCORE_FASE_OS: Record<string, number> = {
    lavra: 100,
    concessao: 80,
    pesquisa: 50,
    requerimento: 25,
    encerrado: 5,
  }
  const b2 = SCORE_FASE_OS[faseTerradar] ?? 25

  const ferrovias = input.infraestrutura
    .filter((i) => i.tipo === 'FERROVIA')
    .map((i) => i.distancia_km)
  const minDistFerro =
    ferrovias.length > 0 ? Math.min(...ferrovias) : Infinity

  let b3: number
  if (minDistFerro <= 50) b3 = 90
  else if (minDistFerro <= 100) b3 = 70
  else if (minDistFerro <= 200) b3 = 45
  else b3 = 20

  const portoProximo = input.portos.some((p) => p.distancia_km <= 200)
  if (portoProximo) b3 = Math.min(b3 + 10, 100)

  // b4 Situação: diferencia processo ativo, terminal (fase encerrado ou ativo_derivado=false) e bloqueado.
  // Config_scores aba 7: ativo=90, inativo=30, bloqueado=5.
  // Sem flag de bloqueio administrativo ainda no DB, tratamos: ativo_derivado=false OU fase=encerrado -> 5 (terminal).
  // Processo ativo_derivado=true e fase != encerrado -> 90.
  let b4: number
  if (input.ativo_derivado === false || faseTerradar === 'encerrado') {
    b4 = 5
  } else {
    b4 = 90
  }

  let b5: number
  const area = input.area_ha
  if (area > 2000) b5 = 90
  else if (area >= 500) b5 = 70
  else if (area >= 100) b5 = 50
  else if (area >= 50) b5 = 30
  else b5 = 15

  const receita = input.receita_tributaria
  const divida = input.divida_consolidada
  let b6: number
  if (receita == null && divida == null) {
    b6 = 35
  } else if (divida === 0 || divida == null) {
    b6 = receita != null && receita > 0 ? 85 : 35
  } else if (receita == null || receita === 0) {
    b6 = 15
  } else {
    const ratio = receita / divida
    if (ratio > 2) b6 = 85
    else if (ratio >= 1) b6 = 60
    else if (ratio >= 0.5) b6 = 35
    else b6 = 15
  }

  let b7: number
  const inc = input.score_incentivo
  if (inc == null) b7 = 15
  else if (inc >= 3) b7 = 90
  else if (inc === 2) b7 = 70
  else if (inc === 1) b7 = 45
  else b7 = 15

  const score =
    b1 * PESOS_OS_VIABILIDADE.b1_capag +
    b2 * PESOS_OS_VIABILIDADE.b2_fase +
    b3 * PESOS_OS_VIABILIDADE.b3_infra +
    b4 * PESOS_OS_VIABILIDADE.b4_situacao +
    b5 * PESOS_OS_VIABILIDADE.b5_area +
    b6 * PESOS_OS_VIABILIDADE.b6_autonomia +
    b7 * PESOS_OS_VIABILIDADE.b7_incentivos

  return {
    score: Math.round(score * 10) / 10,
    breakdown: { b1, b2, b3, b4, b5, b6, b7 },
  }
}

function computeOsSeguranca(
  riskScore: number,
  rsAmbiental: number,
  rsRegulatorio: number,
  input: ScoreInput,
): {
  score: number
  breakdown: { c1: number; c2: number; c3: number; c4: number; c5: number; c6: number }
} {
  const c1 = 100 - riskScore
  const c2 = 100 - rsAmbiental
  const c3 = 100 - rsRegulatorio
  const c4 = scoreC4RecenciaFromDias(input.dias_sem_despacho)
  const c5 = 100
  const c6 = 15

  const score =
    c1 * PESOS_OS_SEGURANCA.c1_solidez +
    c2 * PESOS_OS_SEGURANCA.c2_conformidade +
    c3 * PESOS_OS_SEGURANCA.c3_regularidade +
    c4 * PESOS_OS_SEGURANCA.c4_recencia +
    c5 * PESOS_OS_SEGURANCA.c5_ausencia +
    c6 * PESOS_OS_SEGURANCA.c6_favoraveis

  return {
    score: Math.round(score * 10) / 10,
    breakdown: { c1, c2, c3, c4, c5, c6 },
  }
}

function aplicarPenalidades(
  osScore: number,
  faseTerradar: string,
  riskScore: number,
  ativoDerivado: boolean,
): number {
  let resultado = osScore

  // Terminal por fase ANM (Disponibilidade) OU terminal por ativo_derivado=false
  // (processo extinto/cancelado via lookup independente da fase ANM original).
  // Padrao TERRADAR: terminal -> nao recomendado, teto 20.
  if (faseTerradar === 'encerrado' || !ativoDerivado) {
    resultado = Math.min(resultado, 20)
  }

  if (riskScore >= 90) {
    resultado *= 0.5
  }

  return Math.round(resultado * 10) / 10
}

function getRiskLabel(
  score: number,
  ativoDerivado: boolean,
): { label: string; cor: string } {
  // Terminal: rotulo dedicado, cor cinza neutra. Ignora score numerico.
  if (!ativoDerivado) return { label: 'Processo extinto', cor: '#6B7280' }
  if (score <= 39) return { label: 'Risco baixo', cor: '#1D9E75' }
  if (score <= 69) return { label: 'Risco médio', cor: '#E8A830' }
  return { label: 'Risco alto', cor: '#E24B4A' }
}

function getOpportunityLabel(
  score: number,
  ativoDerivado: boolean,
): { label: string; cor: string } {
  // Terminal: rotulo dedicado alinhado com risk_label "Processo extinto".
  if (!ativoDerivado) return { label: 'N/A · Processo extinto', cor: '#6B7280' }
  if (score >= 75) return { label: 'Alta', cor: '#1D9E75' }
  if (score >= 50) return { label: 'Moderada', cor: '#E8A830' }
  if (score >= 25) return { label: 'Baixa', cor: '#888780' }
  return { label: 'Não recomendado', cor: '#E24B4A' }
}

function resolveScoreSubstancia(
  nomeLimpo: string,
  familia: string,
): { value: number; source: 'substancia' | 'familia' | 'default' } {
  if (nomeLimpo in SCORE_SUBSTANCIA) {
    return { value: SCORE_SUBSTANCIA[nomeLimpo], source: 'substancia' }
  }
  const fam = familia.trim().toLowerCase()
  if (fam in SCORE_SUBSTANCIA_FAMILIA) {
    return { value: SCORE_SUBSTANCIA_FAMILIA[fam], source: 'familia' }
  }
  return { value: 50, source: 'default' }
}

export function computeAllScores(input: ScoreInput): ScoreResult {
  const fallbacks: string[] = []

  const nomeSubstancia = input.substancia
    .replace(/^MINÉRIO DE /i, '')
    .replace(/^MINERIO DE /i, '')
    .replace(/^MINERAL DE /i, '')
    .trim()
    .toUpperCase()

  const subRes = resolveScoreSubstancia(
    nomeSubstancia,
    input.substancia_familia,
  )
  const scoreSubstancia = subRes.value
  if (subRes.source === 'familia') {
    fallbacks.push('scoreSubstancia: via família (nome mineral não listado)')
  } else if (subRes.source === 'default') {
    fallbacks.push('scoreSubstancia: fallback 50 (outros)')
  }

  const faseTerradar = mapFase(input.fase)
  const scoreFase = SCORE_FASE_RS[faseTerradar] ?? 50
  if (!(faseTerradar in SCORE_FASE_RS)) {
    fallbacks.push('scoreFase: fase TERRADAR não listada (fallback 50)')
  }

  const scoreQualidade = getScoreQualidade(faseTerradar)
  fallbacks.push('scoreQualidade: inferido pela fase (sem relatório de pesquisa)')

  const rsGeologico =
    scoreSubstancia * PESOS_RS_GEOLOGICO.substancia +
    scoreFase * PESOS_RS_GEOLOGICO.fase +
    scoreQualidade * PESOS_RS_GEOLOGICO.qualidade

  const rsAmbiental = computeRsAmbiental(input)

  const socialResult = computeRsSocial(input, fallbacks)
  const rsSocial = socialResult.score

  const regulatorioResult = computeRsRegulatorio(input)
  const rsRegulatorio = regulatorioResult.score
  if (input.dias_sem_despacho == null) {
    fallbacks.push('RS tempo: sem data de último despacho (fallback 50)')
  }
  if (input.qtd_pendencias_anm == null) {
    fallbacks.push('RS pendências: contagem indisponível (fallback 5)')
  }
  fallbacks.push('RS alertas: Adoo não integrado (valor fixo 5)')

  const riskScoreRaw =
    rsGeologico * PESOS_RS.geologico +
    rsAmbiental * PESOS_RS.ambiental +
    rsSocial * PESOS_RS.social +
    rsRegulatorio * PESOS_RS.regulatorio

  const ativoDerivado = input.ativo_derivado !== false // default true se undefined

  const riskScore = Math.round(riskScoreRaw)
  const riskInfo = getRiskLabel(riskScore, ativoDerivado)

  const atratResult = computeOsAtratividade(scoreSubstancia, input)
  const viabResult = computeOsViabilidade(faseTerradar, input)
  const segResult = computeOsSeguranca(riskScore, rsAmbiental, rsRegulatorio, input)

  if (input.receita_tributaria == null && input.divida_consolidada == null) {
    fallbacks.push('B6: fallback 35 (sem SICONFI)')
  }

  fallbacks.push('B4: situacao via ativo_derivado + fase encerrado (config_scores aba 7)')
  if (input.dias_sem_despacho == null) {
    fallbacks.push('OS C4: sem data de último despacho (fallback 25)')
  }
  fallbacks.push('OS C5/C6: Adoo não integrado (valores fixos)')

  const calcOS = (perfil: keyof typeof PERFIS): number => {
    const pesos = PERFIS[perfil]
    const raw =
      atratResult.score * pesos.atratividade +
      viabResult.score * pesos.viabilidade +
      segResult.score * pesos.seguranca
    return aplicarPenalidades(Math.round(raw), faseTerradar, riskScore, ativoDerivado)
  }

  const osConservador = calcOS('conservador')
  const osModerado = calcOS('moderado')
  const osArrojado = calcOS('arrojado')

  const labC = getOpportunityLabel(osConservador, ativoDerivado)
  const labM = getOpportunityLabel(osModerado, ativoDerivado)
  const labA = getOpportunityLabel(osArrojado, ativoDerivado)

  return {
    risk_score: riskScore,
    risk_label: riskInfo.label,
    risk_cor: riskInfo.cor,
    risk_breakdown: {
      geologico: Math.round(rsGeologico),
      ambiental: rsAmbiental,
      social: Math.round(rsSocial),
      regulatorio: Math.round(rsRegulatorio),
    },
    os_conservador: osConservador,
    os_moderado: osModerado,
    os_arrojado: osArrojado,
    os_label_conservador: labC.label,
    os_label_moderado: labM.label,
    os_label_arrojado: labA.label,
    os_breakdown: {
      atratividade: Math.round(atratResult.score),
      viabilidade: Math.round(viabResult.score),
      seguranca: Math.round(segResult.score),
    },
    detail: {
      scoreSubstancia,
      scoreFase,
      scoreQualidade,
      scoreComunidades: socialResult.breakdown.comunidades,
      scoreCAPAG_rs: socialResult.breakdown.capag,
      scoreCaducidade: regulatorioResult.breakdown.caducidade,
      scoreRegTempo: regulatorioResult.breakdown.tempo,
      scoreRegPendencias: regulatorioResult.breakdown.pendencias,
      scoreRegAlertas: regulatorioResult.breakdown.alertas,
      ...atratResult.breakdown,
      ...viabResult.breakdown,
      ...segResult.breakdown,
    },
    fallbacks_usados: fallbacks,
  }
}
