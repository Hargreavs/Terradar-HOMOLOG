import { supabase } from './supabase'
import {
  computeAllScores,
  type ScoreInput,
  type ScoreResult,
} from './scoreEngine'

// ── Territorial Analysis (PostGIS automático) ──────────────────
export interface AreaProtegida {
  tipo: 'TI' | 'UC' | 'QUILOMBOLA'
  nome: string
  categoria: string | null
  orgao: string | null
  distancia_km: number
}

export interface Infraestrutura {
  tipo: 'FERROVIA' | 'RODOVIA' | 'HIDROVIA'
  nome: string
  categoria: string | null
  distancia_km: number
}

export interface Porto {
  nome: string
  uf: string | null
  distancia_km: number
}

export interface TerritorialAnalysis {
  processo: string
  areas_protegidas: AreaProtegida[]
  infraestrutura: Infraestrutura[]
  portos: Porto[]
  bioma: { nome: string }[]
  aquiferos: { nome: string; tipo: string }[]
}

/** Busca processo por número (ex: "864.231/2017"). */
export async function getProcesso(numero: string) {
  const { data, error } = await supabase
    .from('processos')
    .select('*')
    .eq('numero', numero)
    .single()
  if (error) throw new Error(`Processo não encontrado: ${numero}`)
  return data
}

/** Busca scores do processo. */
export async function getScores(processoId: string) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('processo_id', processoId)
    .single()
  if (error) return null
  return data
}

/** Busca camadas territoriais do processo. */
export async function getTerritoralLayers(processoId: string) {
  const { data, error } = await supabase
    .from('territorial_layers')
    .select('*')
    .eq('processo_id', processoId)
    .order('distancia_km', { ascending: true })
  if (error) return []
  return data ?? []
}

/** Busca infraestrutura próxima ao processo. */
export async function getInfraestrutura(processoId: string) {
  const { data, error } = await supabase
    .from('infraestrutura')
    .select('*')
    .eq('processo_id', processoId)
    .order('distancia_km', { ascending: true })
  if (error) return []
  return data ?? []
}

/** Busca CFEM histórico do município (por código IBGE). */
export async function getCfemHistorico(municipioIbge: string) {
  const { data, error } = await supabase
    .from('cfem_historico')
    .select('*')
    .eq('municipio_ibge', municipioIbge)
    .order('ano', { ascending: true })
  if (error) return []
  return data ?? []
}

/** Busca CAPAG do município (ano mais recente). */
export async function getCapag(municipioIbge: string) {
  const { data, error } = await supabase
    .from('capag_municipios')
    .select('*')
    .eq('municipio_ibge', municipioIbge)
    .order('ano', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data
}

/** Linha do master de substâncias (substitui commodities + reservas_mundiais). */
export async function getSubstancia(substanciaAnm: string) {
  const trimmed = substanciaAnm.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('master_substancias')
    .select('*')
    .ilike('substancia_anm', trimmed)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar substância:', error.message)
    return null
  }

  if (!data) {
    const termo = trimmed.replace(/^MINÉRIO DE /i, '').trim()
    if (!termo) return null
    const { data: partial, error: err2 } = await supabase
      .from('master_substancias')
      .select('*')
      .ilike('substancia_anm', `%${termo}%`)
      .limit(1)
      .maybeSingle()

    if (err2) {
      console.error('Erro na busca parcial:', err2.message)
      return null
    }
    return partial
  }

  return data
}

/**
 * Análise territorial automática via PostGIS.
 * Substitui getTerritoralLayers + getInfraestrutura (legados).
 * Chama fn_territorial_analysis no Supabase via .rpc()
 */
export async function getTerritoralAnalysis(
  numeroProcesso: string,
): Promise<TerritorialAnalysis> {
  const { data, error } = await supabase.rpc('fn_territorial_analysis', {
    p_numero: numeroProcesso,
  })

  if (error) {
    console.error('[getTerritoralAnalysis] Erro:', error.message)
    throw new Error(`Análise territorial falhou: ${error.message}`)
  }

  return data as TerritorialAnalysis
}

/** Dados fiscais (SICONFI/IBGE) para o município — último exercício na tabela. */
export async function getFiscal(municipioIbge: string) {
  const { data, error } = await supabase
    .from('fiscal_municipios')
    .select('*')
    .eq('municipio_ibge', municipioIbge)
    .order('exercicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as Record<string, unknown>
}

function capagToScoreEngineLetter(
  capagData: Record<string, unknown> | null,
): string | null {
  if (!capagData) return null
  const raw = capagData.nota ?? capagData.capag
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const up = s.toUpperCase()
  if (up.startsWith('N.D') || up.startsWith('N.E')) return up.replace(/\s/g, '')
  const letter = s.match(/[ABCD]/i)
  if (letter) return letter[0].toUpperCase()
  return null
}

/**
 * Computa scores automáticos para um processo (PostGIS + master + CAPAG + incentivos).
 */
export async function computeScoresAuto(
  processo: {
    numero: string
    substancia: string
    substancia_familia: string
    fase: string
    regime: string | null
    area_ha: number
    alvara_validade: string | null
    uf: string
  },
  analise: TerritorialAnalysis,
  mercado: Record<string, unknown> | null,
  capagData: Record<string, unknown> | null,
  fiscalData: Record<string, unknown> | null,
): Promise<ScoreResult> {
  const { data: incentivosRow } = await supabase
    .from('incentivos_uf')
    .select('score_incentivo')
    .eq('uf', processo.uf)
    .maybeSingle()

  const capagStr = capagToScoreEngineLetter(capagData)

  const precoUsd =
    mercado?.preco_usd != null ? Number(mercado.preco_usd) : null
  const gapPp =
    mercado?.gap_pp != null ? Number(mercado.gap_pp) : null
  const teorPct =
    mercado?.teor_pct != null ? Number(mercado.teor_pct) : null

  const f = fiscalData

  const input: ScoreInput = {
    substancia: processo.substancia,
    substancia_familia: processo.substancia_familia || 'outros',
    fase: processo.fase,
    regime: processo.regime,
    area_ha: processo.area_ha,
    alvara_validade: processo.alvara_validade,
    uf: processo.uf,
    areas_protegidas: analise.areas_protegidas,
    infraestrutura: analise.infraestrutura,
    portos: analise.portos,
    bioma: analise.bioma,
    aquiferos: analise.aquiferos,
    mercado: mercado
      ? {
          preco_usd:
            precoUsd != null && !Number.isNaN(precoUsd) ? precoUsd : null,
          gap_pp:
            gapPp != null && !Number.isNaN(gapPp) ? gapPp : null,
          tendencia:
            mercado.tendencia != null
              ? String(mercado.tendencia)
              : null,
          teor_pct:
            teorPct != null && !Number.isNaN(teorPct) ? teorPct : null,
          mineral_critico_2025: Boolean(mercado.mineral_critico_2025),
        }
      : null,
    capag: capagStr,
    score_incentivo:
      incentivosRow?.score_incentivo != null
        ? Number(incentivosRow.score_incentivo)
        : null,

    idh: f?.idh != null ? Number(f.idh) : null,
    populacao: f?.populacao != null ? Number(f.populacao) : null,
    area_km2: f?.area_km2 != null ? Number(f.area_km2) : null,
    densidade: f?.densidade != null ? Number(f.densidade) : null,
    receita_tributaria:
      f?.receita_tributaria != null ? Number(f.receita_tributaria) : null,
    divida_consolidada:
      f?.divida_consolidada != null && String(f.divida_consolidada).trim() !== ''
        ? Number(f.divida_consolidada)
        : f?.passivo_nao_circulante != null
          ? Number(f.passivo_nao_circulante)
          : null,
  }

  return computeAllScores(input)
}

/**
 * Incentivos regionais da UF (`incentivos_uf`).
 */
export async function getIncentivosUf(uf: string) {
  const t = uf.trim()
  if (!t) return null
  const { data, error } = await supabase
    .from('incentivos_uf')
    .select('*')
    .eq('uf', t)
    .maybeSingle()
  if (error) {
    console.error('[getIncentivosUf]', error.message)
    return null
  }
  return data
}

/**
 * Linhas BNDES disponíveis. Fora de mineral estratégico, exclui linha de Minerais Estratégicos.
 * Filtro em memória: `not().ilike()` no PostgREST às vezes não devolve linhas (acentos / collation).
 */
export async function getLinhasBndes(isMineralEstrategico: boolean) {
  const { data, error } = await supabase.from('linhas_bndes').select('*')
  if (error) {
    console.error('[getLinhasBndes]', error.message)
    return []
  }
  const rows = data ?? []
  if (isMineralEstrategico) return rows
  /** Só exclui o registo cuja coluna `linha` refere «Minerais Estratégicos». */
  const isLinhaMineraisEstrategicos = (linhaCol: string) =>
    /minerais\s+estrat[eé]gicos/i.test(linhaCol)

  return rows.filter((r) => {
    const linha = String((r as { linha?: unknown }).linha ?? '').trim()
    return !isLinhaMineraisEstrategicos(linha)
  })
}

export type { ScoreResult } from './scoreEngine'
