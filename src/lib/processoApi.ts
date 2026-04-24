import type { MasterSubstancia } from './reportTypes'
import type { RespostaBusca } from '../types/busca'
import type { TerritorialAmbientalResponse } from '../types/territorialAmbiental'

// ── Tipos do scores_auto (do scoreEngine) ──
export interface ScoreAutoResult {
  risk_score: number
  risk_label: string
  risk_cor: string
  risk_breakdown: {
    geologico: number
    ambiental: number
    social: number
    regulatorio: number
  }
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
  detail: Record<string, number>
  fallbacks_usados: string[]
}

// ── Tipos do analise_territorial (PostGIS) ──
export interface AnaliseAreaProtegida {
  tipo: string
  nome: string
  categoria: string | null
  orgao: string | null
  distancia_km: number
}

export interface AnaliseInfraestrutura {
  tipo: string
  nome: string
  categoria: string | null
  distancia_km: number
}

export interface AnalisePorto {
  nome: string
  uf: string | null
  distancia_km: number
}

export interface AnaliseTerritorial {
  processo: string
  areas_protegidas: AnaliseAreaProtegida[]
  infraestrutura: AnaliseInfraestrutura[]
  portos: AnalisePorto[]
  bioma: { nome: string }[]
  aquiferos: { nome: string; tipo: string }[]
  /** `fn_territorial_analysis` — prioridade para distância/nome da sede no relatório. */
  sede?: {
    nome: string
    uf: string
    municipio_ibge: string
    distancia_km: number
    fonte?: string
  } | null
}

export interface Pendencia {
  tipo: string
  fase: string | null
  categoria: string | null
  data_origem: string | null
  dias_em_aberto: number | null
  prazo_original_dias: number | null
  status: string | null
  gravidade: string | null
  risco_caducidade: boolean | null
  descricao: string | null
  evento_codigo: number | null
  evento_descricao: string | null
}

export interface ProcessoCompleto {
  processo: Record<string, unknown>
  scores: Record<string, unknown> | null
  scores_auto: ScoreAutoResult | null
  territorial: { layers: Record<string, unknown>[]; infra: Record<string, unknown>[] }
  analise_territorial: AnaliseTerritorial | null
  fiscal: {
    cfem_historico: Record<string, unknown>[]
    cfem_total_4anos: number
    capag: Record<string, unknown> | null
  }
  /** Registo único `master_substancias` ou `null` (sem match). */
  mercado: MasterSubstancia | null
  /** `fiscal_municipios` / SICONFI por `municipio_ibge`. */
  fiscal_municipio: Record<string, unknown> | null
  incentivos_uf: Record<string, unknown> | null
  linhas_bndes: Record<string, unknown>[] | null
  /** Pendências ativas via RPC `fn_pendencias_processo`. Array vazio se sem match ou falha. */
  pendencias: Pendencia[]
}

/**
 * Busca leve de processo por número (cadastro + geometria no campo `geom`).
 * Usada pela barra de busca do mapa.
 */
export async function buscarProcessoPorNumero(
  numero: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  try {
    const qs = new URLSearchParams({ numero: numero.trim() })
    const res = await fetch(`/api/processo/busca?${qs}`, { signal })
    const json = (await res.json()) as {
      ok?: boolean
      data?: Record<string, unknown>
      error?: string
    }
    if (!json.ok || !json.data) return null
    return json.data
  } catch {
    return null
  }
}

export async function fetchProcessoCompleto(
  numero: string,
): Promise<ProcessoCompleto> {
  const qs = new URLSearchParams({ numero })
  const res = await fetch(`/api/processo?${qs}`)
  const json = (await res.json()) as {
    ok?: boolean
    error?: string
    data?: ProcessoCompleto
  }
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(
      json.error ?? 'Dados ainda não disponíveis para este processo.',
    )
  }
  return json.data
}

// ── Histórico da busca no mapa (localStorage, UTF-8) ──
const MAP_SEARCH_HISTORY_KEY = 'terrae-map-search-history'
const MAP_SEARCH_HISTORY_MAX = 5

export function readSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(MAP_SEARCH_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, MAP_SEARCH_HISTORY_MAX)
  } catch {
    return []
  }
}

export function pushSearchHistory(numero: string): void {
  const canon = numero.trim()
  if (!canon) return
  const prev = readSearchHistory()
  const next = [canon, ...prev.filter((n) => n !== canon)].slice(
    0,
    MAP_SEARCH_HISTORY_MAX,
  )
  try {
    localStorage.setItem(MAP_SEARCH_HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

/**
 * Busca multi-canal: detecta automaticamente número ANM, CNPJ ou nome do
 * titular. Retorna até 15 resultados (shape `ResultadoBuscaItem`).
 */
export async function buscarProcessos(
  query: string,
  signal?: AbortSignal,
): Promise<RespostaBusca> {
  try {
    const qs = new URLSearchParams({ q: query.trim() })
    const res = await fetch(`/api/processo/search?${qs}`, { signal })
    const json = (await res.json()) as RespostaBusca
    return json
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, tipo: 'vazio', total: 0, data: [], error: 'aborted' }
    }
    return { ok: false, tipo: 'vazio', total: 0, data: [], error: String(e) }
  }
}

export async function fetchTerritorialAmbiental(
  numero: string,
  signal?: AbortSignal,
): Promise<TerritorialAmbientalResponse> {
  const encoded = encodeURIComponent(numero.trim())
  const res = await fetch(
    `/api/processo/${encoded}/territorial-ambiental`,
    { signal },
  )
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Processo ${numero} nao encontrado`)
    }
    throw new Error(`HTTP ${res.status} em territorial-ambiental`)
  }
  return (await res.json()) as TerritorialAmbientalResponse
}
