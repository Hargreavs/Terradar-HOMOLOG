import { supabase } from '../supabaseClient'
import { faixaFromScore, type OpportunityResult, type PerfilRisco } from '../opportunityScore'

export interface RadarFiltros {
  perfil: PerfilRisco
  substancias: string[] | null
  ufs: string[] | null
  /** Filtro granular de fases processuais; null ou omitido = sem filtro na RPC */
  fases?: string[] | null
}

/** Default page size for `listarOportunidades` and Radar results UI (see Fix D1). */
export const RADAR_OPORTUNIDADES_PAGE_SIZE = 20

/** Opportunity Score máximo aplicado pela RPC conforme perfil (prospecção Radar). */
export const SCORE_MINIMO_POR_PERFIL: Record<PerfilRisco, number> = {
  conservador: 60,
  moderado: 50,
  arrojado: 35,
}

export interface RadarPagina {
  resultados: OpportunityResult[]
  offset: number
  limit: number
  hasMore: boolean
}

type RpcListarRow = {
  processoId: string
  scoreTotal: number
  scoreAtratividade: number
  scoreViabilidade: number
  scoreSeguranca: number
  numero?: string | null
  substancia?: string | null
  titular?: string | null
  uf?: string | null
  municipio?: string | null
  areaHa?: number | null
  fase?: string | null
  regime?: string | null
  cnpjTitular?: string | null
  riskScore?: number | null
  riskLabel?: string | null
  osConservador?: number | null
  osModerado?: number | null
  osArrojado?: number | null
  dimensoesOportunidade?: OpportunityResult['dimensoesOportunidade']
  dimensoesRisco?: OpportunityResult['dimensoesRisco']
  calculatedAt?: string | null
}

function parsePenalidadesFromDimOpp(
  d: OpportunityResult['dimensoesOportunidade'],
): string[] {
  if (d == null || typeof d !== 'object') return []
  const p = (d as { penalidades?: unknown }).penalidades
  if (!Array.isArray(p)) return []
  return p.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

function mapRowToOpportunityResult(row: RpcListarRow): OpportunityResult {
  return {
    processoId: row.processoId,
    scoreTotal: row.scoreTotal,
    scoreAtratividade: row.scoreAtratividade,
    scoreViabilidade: row.scoreViabilidade,
    scoreSeguranca: row.scoreSeguranca,
    faixa: faixaFromScore(row.scoreTotal),
    fatoresPositivos: [],
    fatoresAtencao: [],
    numero: row.numero,
    substancia: row.substancia,
    titular: row.titular,
    uf: row.uf,
    municipio: row.municipio,
    areaHa: row.areaHa,
    fase: row.fase,
    regime: row.regime,
    cnpjTitular: row.cnpjTitular,
    riskScore: row.riskScore,
    riskLabel: row.riskLabel,
    osConservador: row.osConservador,
    osModerado: row.osModerado,
    osArrojado: row.osArrojado,
    dimensoesOportunidade: row.dimensoesOportunidade,
    dimensoesRisco: row.dimensoesRisco,
    penalidades: parsePenalidadesFromDimOpp(row.dimensoesOportunidade),
    calculatedAt: row.calculatedAt,
  }
}

function unwrapListarPayload(
  data: unknown,
): { resultados: RpcListarRow[]; limit?: number; offset?: number } {
  if (data && typeof data === 'object' && 'resultados' in data) {
    const o = data as { resultados?: RpcListarRow[]; limit?: number; offset?: number }
    return { resultados: o.resultados ?? [], limit: o.limit, offset: o.offset }
  }
  if (Array.isArray(data)) {
    return { resultados: data as RpcListarRow[] }
  }
  return { resultados: [] }
}

export async function listarOportunidades(
  filtros: RadarFiltros,
  limit = RADAR_OPORTUNIDADES_PAGE_SIZE,
  offset = 0,
): Promise<RadarPagina> {
  const { data, error } = await supabase.rpc('fn_radar_listar_oportunidades', {
    p_perfil: filtros.perfil,
    p_substancias:
      filtros.substancias && filtros.substancias.length > 0
        ? filtros.substancias.map((s) => s.toUpperCase())
        : null,
    p_ufs: filtros.ufs,
    p_score_minimo: SCORE_MINIMO_POR_PERFIL[filtros.perfil],
    p_fases:
      filtros.fases && filtros.fases.length > 0 ? filtros.fases.map((x) => x.trim()).filter(Boolean) : null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  const { resultados: rows } = unwrapListarPayload(data)
  return {
    resultados: rows.map(mapRowToOpportunityResult),
    offset,
    limit,
    hasMore: rows.length === limit,
  }
}

export async function contarOportunidades(filtros: RadarFiltros): Promise<number> {
  const { data, error } = await supabase.rpc('fn_radar_contar_oportunidades', {
    p_perfil: filtros.perfil,
    p_substancias:
      filtros.substancias && filtros.substancias.length > 0
        ? filtros.substancias.map((s) => s.toUpperCase())
        : null,
    p_ufs: filtros.ufs,
    p_score_minimo: SCORE_MINIMO_POR_PERFIL[filtros.perfil],
    p_fases:
      filtros.fases && filtros.fases.length > 0 ? filtros.fases.map((x) => x.trim()).filter(Boolean) : null,
  })
  if (error) throw error
  return Number(data ?? 0)
}

/** Linha típica de `fn_radar_contar_por_fase`. */
export interface ContagemPorFaseRow {
  fase: string
  total: number
}

/**
 * Distribuição de contagens por fase (sem filtro de fase aplicado nos demais filtros).
 */
export async function contarPorFase(filtros: RadarFiltros): Promise<Map<string, number>> {
  const { perfil, substancias, ufs } = filtros
  const map = new Map<string, number>()
  const { data, error } = await supabase.rpc('fn_radar_contar_por_fase', {
    p_perfil: perfil,
    p_substancias:
      substancias && substancias.length > 0 ? substancias.map((s) => s.toUpperCase()) : null,
    p_ufs: ufs,
    p_score_minimo: SCORE_MINIMO_POR_PERFIL[perfil],
  })
  if (error) throw error
  const rows = (data ?? []) as Array<{ fase?: unknown; total?: unknown }>
  for (const row of rows) {
    const f = typeof row.fase === 'string' ? row.fase : ''
    const tRaw = row.total
    const n = typeof tRaw === 'number' ? tRaw : Number(tRaw ?? 0)
    if (f) map.set(f, Number.isFinite(n) ? n : 0)
  }
  return map
}

export interface SubstanciaItem {
  substancia: string
  qtd: number
  critico?: boolean
  familia?: string
  /** ANM name variants merged under this canonical label (RPC `fn_radar_substancias_disponiveis`). */
  variantes: string[]
}

export interface FamiliaItem {
  familia: string
  qtd: number
  substancias: SubstanciaItem[]
}

export interface SubstanciasResponse {
  totalSubstancias: number
  totalCriticas: number
  criticas: SubstanciaItem[]
  porFamilia: FamiliaItem[]
}

function emptySubstanciasResponse(): SubstanciasResponse {
  return {
    totalSubstancias: 0,
    totalCriticas: 0,
    criticas: [],
    porFamilia: [],
  }
}

function withVariantes(
  it: { substancia: string; qtd: number; critico?: boolean; familia?: string; variantes?: string[] },
): SubstanciaItem {
  const v = it.variantes
  const sub = it.substancia
  return {
    substancia: sub,
    qtd: Number(it.qtd) || 0,
    critico: it.critico,
    familia: it.familia,
    variantes: Array.isArray(v) && v.length > 0 ? v : [sub],
  }
}

function normalizeSubstanciasRpcData(data: unknown): SubstanciasResponse {
  if (data == null) return emptySubstanciasResponse()
  if (Array.isArray(data)) {
    const rows = data as { substancia: string; qtd: number; variantes?: string[] }[]
    const qtd = rows.reduce((s, r) => s + (Number(r.qtd) || 0), 0)
    return {
      totalSubstancias: rows.length,
      totalCriticas: 0,
      criticas: [],
      porFamilia: [
        {
          familia: 'outros',
          qtd,
          substancias: rows.map((r) => withVariantes(r)),
        },
      ],
    }
  }
  if (typeof data === 'object' && 'porFamilia' in (data as object) && 'criticas' in (data as object)) {
    const o = data as SubstanciasResponse
    const criticas = Array.isArray(o.criticas) ? o.criticas.map((c) => withVariantes(c)) : []
    const porFamilia = Array.isArray(o.porFamilia)
      ? o.porFamilia.map((fam) => ({
          ...fam,
          substancias: fam.substancias.map((s) => withVariantes(s)),
        }))
      : []
    return {
      totalSubstancias: Number(o.totalSubstancias) || 0,
      totalCriticas: Number(o.totalCriticas) || 0,
      criticas,
      porFamilia,
    }
  }
  return emptySubstanciasResponse()
}

/**
 * Expands canonical substance keys from Step 2 to all ANM variant strings for `fn_radar_*` RPCs.
 */
export function expandirSubstanciasParaVariantes(
  substanciasCanonicas: string[],
  catalogo: SubstanciasResponse | null,
): string[] {
  if (!catalogo) return substanciasCanonicas
  const mapa = new Map<string, string[]>()
  for (const item of catalogo.criticas) {
    mapa.set(item.substancia, item.variantes)
  }
  for (const fam of catalogo.porFamilia) {
    for (const item of fam.substancias) {
      mapa.set(item.substancia, item.variantes)
    }
  }
  const expandidas = new Set<string>()
  for (const canon of substanciasCanonicas) {
    const variantes = mapa.get(canon) ?? [canon]
    for (const v of variantes) expandidas.add(v)
  }
  return [...expandidas]
}

export async function listarSubstanciasDisponiveis(
  perfil: PerfilRisco = 'moderado',
): Promise<SubstanciasResponse> {
  const { data, error } = await supabase.rpc('fn_radar_substancias_disponiveis', {
    p_perfil: perfil,
  })
  if (error) throw error
  return normalizeSubstanciasRpcData(data)
}

/**
 * Bloco do Step 2 redesign A. Cada bloco e um "card" no UI:
 * o transversal "Minerais Criticos" ou uma familia ANM.
 */
export interface BlocoFamilia {
  /** 'criticos_usgs' (transversal) ou nome de familia ANM (ex: 'metais_preciosos'). */
  chave: string
  /** Ja formatado pra display em PT-BR. Front pode reformatar via labelFamilia(). */
  titulo: string
  /** Descricao curta (presente apenas em 'criticos_usgs'). */
  descricao: string | null
  qtdSubstancias: number
  qtdOportunidades: number
  /** Top 5 substancias canonicas pra preview no card. */
  preview: string[]
  /** Lista completa de substancias canonicas dentro do bloco. */
  substancias: string[]
  /** Lista completa de variantes ANM (ja expandida). Passa direto pra fn_radar_listar/contar. */
  substanciasVariantesAnm: string[]
}

export interface FamiliasResponse {
  totalSubstancias: number
  totalOportunidades: number
  blocos: BlocoFamilia[]
}

function emptyFamiliasResponse(): FamiliasResponse {
  return { totalSubstancias: 0, totalOportunidades: 0, blocos: [] }
}

function normalizeFamiliasRpcData(data: unknown): FamiliasResponse {
  if (!data || typeof data !== 'object') return emptyFamiliasResponse()
  const o = data as Partial<FamiliasResponse>
  return {
    totalSubstancias: Number(o.totalSubstancias) || 0,
    totalOportunidades: Number(o.totalOportunidades) || 0,
    blocos: Array.isArray(o.blocos)
      ? o.blocos.map((b) => ({
          chave: String(b.chave ?? ''),
          titulo: String(b.titulo ?? ''),
          descricao: b.descricao != null && typeof b.descricao === 'string' ? b.descricao : null,
          qtdSubstancias: Number(b.qtdSubstancias) || 0,
          qtdOportunidades: Number(b.qtdOportunidades) || 0,
          preview: Array.isArray(b.preview) ? b.preview.map(String) : [],
          substancias: Array.isArray(b.substancias) ? b.substancias.map(String) : [],
          substanciasVariantesAnm: Array.isArray(b.substanciasVariantesAnm)
            ? b.substanciasVariantesAnm.map(String)
            : [],
        }))
      : [],
  }
}

export async function listarFamiliasDisponiveis(
  perfil: PerfilRisco = 'moderado',
): Promise<FamiliasResponse> {
  const { data, error } = await supabase.rpc('fn_radar_familias_disponiveis', {
    p_perfil: perfil,
  })
  if (error) throw error
  return normalizeFamiliasRpcData(data)
}
