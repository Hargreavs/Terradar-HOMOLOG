import type { MasterSubstancia } from './reportTypes'

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
}

/**
 * Busca leve de processo por número (cadastro + geometria no campo `geom`).
 * Usada pela barra de busca do mapa.
 */
export async function buscarProcessoPorNumero(
  numero: string,
): Promise<Record<string, unknown> | null> {
  try {
    const qs = new URLSearchParams({ numero: numero.trim() })
    const res = await fetch(`/api/processo/busca?${qs}`)
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
