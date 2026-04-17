import type {
  AlertaLegislativo,
  DadosFiscais,
  Fase,
  GeoJSONPolygon,
  Processo,
  Regime,
  RiskBreakdown,
} from '../types'

const EMPTY_FISCAL: DadosFiscais = {
  capag: 'C',
  receita_propria_mi: 0,
  divida_consolidada_mi: 0,
  incentivos_estaduais: [],
  linhas_bndes: [],
  observacao: '',
}

function anoFromNumeroAnm(numero: string): number {
  const m = /\/(\d{4})$/.exec(numero.trim())
  return m ? parseInt(m[1], 10) : new Date().getFullYear()
}

function outerRingArea(ring: number[][]): number {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[j]
    const p2 = ring[i]
    if (!p1 || !p2 || p1.length < 2 || p2.length < 2) continue
    a += p1[0]! * p2[1]! - p2[0]! * p1[1]!
  }
  return Math.abs(a / 2)
}

function ringCentroidLngLat(ring: number[][]): [number, number] {
  let sx = 0
  let sy = 0
  let n = 0
  for (const p of ring) {
    if (p.length >= 2) {
      sx += p[0]!
      sy += p[1]!
      n++
    }
  }
  return n > 0 ? [sx / n, sy / n] : [0, 0]
}

function coerceRegime(raw: string): Regime {
  const r = raw.toLowerCase().trim()
  if (r === 'requerimento_pesquisa') return 'requerimento_pesquisa'
  if (
    r.includes('garimp') ||
    (r.includes('lavra') && r.includes('garimpeira'))
  ) {
    return 'lavra_garimpeira'
  }
  if (r.includes('concess') && r.includes('lavra')) return 'concessao_lavra'
  if (r.includes('requer') && r.includes('pesquis')) {
    return 'requerimento_pesquisa'
  }
  if (r.includes('reconhec')) return 'requerimento_pesquisa'
  if (r.includes('pesquis')) return 'autorizacao_pesquisa'
  if (r.includes('requer') && r.includes('lavra')) return 'req_lavra'
  if (r.includes('licenci')) return 'licenciamento'
  if (r.includes('registro') && r.includes('extra')) return 'registro_extracao'
  if (r.includes('dispon')) return 'disponibilidade'
  if (r.includes('estratég') || r.includes('estrateg')) {
    return 'mineral_estrategico'
  }
  if (r.includes('bloqueio') && r.includes('prov')) {
    return 'bloqueio_provisorio'
  }
  if (r.includes('bloqueio') && r.includes('perm')) {
    return 'bloqueio_permanente'
  }
  return 'disponibilidade'
}

function coerceFase(raw: string): Fase {
  const r = raw.toLowerCase()
  if (r.includes('lavra')) return 'lavra'
  if (r.includes('pesquis')) return 'pesquisa'
  if (r.includes('concess')) return 'concessao'
  if (r.includes('encerr')) return 'encerrado'
  return 'requerimento'
}

/** Extrai geometria GeoJSON (Polygon/MultiPolygon) de valor PostGIS/GeoJSON do Supabase. */
function extractGeom(
  raw: unknown,
): { type: string; coordinates: unknown } | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as { type?: string; geometry?: unknown }
      if (o.type === 'Feature' && o.geometry && typeof o.geometry === 'object') {
        return o.geometry as { type: string; coordinates: unknown }
      }
      if (o.type && o.type !== 'Feature') {
        return o as { type: string; coordinates: unknown }
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as { type?: string; geometry?: unknown; coordinates?: unknown }
    if (o.type === 'Feature' && o.geometry && typeof o.geometry === 'object') {
      return o.geometry as { type: string; coordinates: unknown }
    }
    if (typeof o.type === 'string' && o.coordinates !== undefined) {
      return o as { type: string; coordinates: unknown }
    }
  }
  return null
}

function polygonCoordsFromGeom(geom: {
  type: string
  coordinates: unknown
}): number[][][] | null {
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    const c = geom.coordinates as number[][][]
    if (!c[0]?.length) return null
    return c
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    const polys = geom.coordinates as number[][][][]
    let best: number[][][] | null = null
    let bestArea = -1
    for (const poly of polys) {
      const ring = poly[0]
      if (!ring?.length) continue
      const ar = outerRingArea(ring)
      if (ar > bestArea) {
        bestArea = ar
        best = poly
      }
    }
    return best
  }
  return null
}

function buildGeojson(id: string, coords: number[][][]): GeoJSONPolygon {
  return {
    type: 'Feature',
    properties: { id },
    geometry: {
      type: 'Polygon',
      coordinates: coords,
    },
  }
}

/**
 * Converte uma linha `processos` do Supabase no formato `Processo` do mapa.
 * Retorna `null` se não houver geometria desenhável (polígono).
 */
export function mapDbRowToMapProcesso(row: Record<string, unknown>): Processo | null {
  const id = String(row.id ?? row.numero ?? '')
  const numero = String(row.numero ?? '').trim()
  if (!numero) return null

  const geom = extractGeom(row.geom)
  if (!geom) return null

  const polyCoords = polygonCoordsFromGeom(geom)
  if (!polyCoords || !polyCoords[0]?.length) return null

  const outer = polyCoords[0]!
  const [lng, lat] = ringCentroidLngLat(outer)

  const regimeStr = String(row.regime ?? '')
  const faseStr = String(row.fase ?? '')
  const regime = regimeStr ? coerceRegime(regimeStr) : 'disponibilidade'
  const fase = faseStr ? coerceFase(faseStr) : 'requerimento'

  const ano_protocolo = Number(row.ano_protocolo)
  const year = Number.isFinite(ano_protocolo)
    ? ano_protocolo
    : anoFromNumeroAnm(numero)
  const anoProtFinal =
    row.ano_protocolo != null && Number.isFinite(Number(row.ano_protocolo))
      ? Number(row.ano_protocolo)
      : year
  const data_protocolo =
    typeof row.data_protocolo === 'string' && row.data_protocolo
      ? row.data_protocolo
      : `${year}-01-01`

  const titular = String(row.titular ?? '').trim() || '—'

  const optStr = (v: unknown): string | undefined => {
    if (v == null) return undefined
    const s = String(v).trim()
    return s === '' ? undefined : s
  }

  const isoDateOnly = (v: unknown): string | undefined => {
    if (v == null) return undefined
    const s = String(v).trim()
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
    return m ? m[1]! : undefined
  }
  const substancia = String(row.substancia ?? '').trim() || '—'
  const uf = String(row.uf ?? '').trim() || '—'
  const municipio = String(row.municipio ?? '').trim() || '—'
  const area_ha = Number(row.area_ha)
  const areaSafe = Number.isFinite(area_ha) ? area_ha : 0

  const sp = row.scores_persistido as
    | {
        risk_score?: number | null
        os_conservador?: number | null
        os_moderado?: number | null
        os_arrojado?: number | null
        os_label?: string | null
        dimensoes_risco?: {
          geologico?: { valor: number; subfatores: unknown[] }
          ambiental?: { valor: number; subfatores: unknown[] }
          social?: { valor: number; subfatores: unknown[] }
          regulatorio?: { valor: number; subfatores: unknown[] }
        } | null
        dimensoes_oportunidade?: Record<string, unknown> | null
      }
    | null
    | undefined

  const sa = row.scores_auto as
    | {
        risk_score: number
        risk_breakdown: {
          geologico: number
          ambiental: number
          social: number
          regulatorio: number
        }
      }
    | null
    | undefined

  let risk_score: number | null = null
  let risk_breakdown: RiskBreakdown | null = null
  if (sp && typeof sp.risk_score === 'number') {
    risk_score = sp.risk_score
    if (sp.dimensoes_risco) {
      const dr = sp.dimensoes_risco
      risk_breakdown = {
        geologico: Number(dr.geologico?.valor ?? 0),
        ambiental: Number(dr.ambiental?.valor ?? 0),
        social: Number(dr.social?.valor ?? 0),
        regulatorio: Number(dr.regulatorio?.valor ?? 0),
      }
    }
  } else if (sa && typeof sa.risk_score === 'number' && sa.risk_breakdown) {
    risk_score = sa.risk_score
    risk_breakdown = {
      geologico: sa.risk_breakdown.geologico,
      ambiental: sa.risk_breakdown.ambiental,
      social: sa.risk_breakdown.social,
      regulatorio: sa.risk_breakdown.regulatorio,
    }
  }

  return {
    id,
    numero,
    regime,
    fase,
    substancia,
    is_mineral_estrategico: false,
    titular,
    cnpj_titular: optStr(row.cnpj_titular),
    cnpj_filial: optStr(row.cnpj_filial),
    nup_sei: optStr(row.nup_sei),
    ultimo_evento_data: isoDateOnly(row.ultimo_evento_data),
    ultimo_evento_descricao: optStr(row.ultimo_evento_descricao),
    ultimo_evento_codigo:
      row.ultimo_evento_codigo != null &&
      Number.isFinite(Number(row.ultimo_evento_codigo))
        ? Number(row.ultimo_evento_codigo)
        : undefined,
    portaria_lavra_data: isoDateOnly(row.portaria_lavra_data),
    portaria_lavra_dou: optStr(row.portaria_lavra_dou),
    licenca_ambiental_data: isoDateOnly(row.licenca_ambiental_data),
    inicio_lavra_data: isoDateOnly(row.inicio_lavra_data),
    plano_fechamento_data: isoDateOnly(row.plano_fechamento_data),
    tah_ultimo_pagamento: isoDateOnly(row.tah_ultimo_pagamento),
    ral_ultimo_data: isoDateOnly(row.ral_ultimo_data),
    exigencia_pendente:
      typeof row.exigencia_pendente === 'boolean'
        ? row.exigencia_pendente
        : undefined,
    total_eventos:
      row.total_eventos != null && Number.isFinite(Number(row.total_eventos))
        ? Number(row.total_eventos)
        : undefined,
    area_ha: areaSafe,
    uf,
    municipio,
    lat,
    lng,
    data_protocolo,
    ano_protocolo: anoProtFinal,
    situacao: 'ativo',
    risk_score,
    risk_breakdown,
    risk_decomposicao: null,
    valor_estimado_usd_mi: 0,
    ultimo_despacho_data: isoDateOnly(row.ultimo_evento_data) || data_protocolo,
    alertas: [] as AlertaLegislativo[],
    fiscal: EMPTY_FISCAL,
    geojson: buildGeojson(id, polyCoords),
    fromApi: true,
    dimensoes_risco_persistido:
      (sp?.dimensoes_risco as Processo['dimensoes_risco_persistido']) ?? null,
    dimensoes_oportunidade_persistido:
      (sp?.dimensoes_oportunidade as Record<string, unknown> | null) ?? null,
    os_conservador_persistido: sp?.os_conservador ?? null,
    os_moderado_persistido: sp?.os_moderado ?? null,
    os_arrojado_persistido: sp?.os_arrojado ?? null,
    os_label_persistido: sp?.os_label ?? null,
  }
}

/**
 * Adaptador: converte uma feature do GeoJSON retornado por
 * /api/processos/viewport em Processo, reusando mapDbRowToMapProcesso.
 *
 * Features da viewport têm shape:
 *   { type: 'Feature', geometry: {...}, properties: { numero, titular, ... } }
 *
 * O SQL expõe scores como campos planos em `properties`; convertemos para
 * `scores_persistido` aninhado antes de delegar a `mapDbRowToMapProcesso`.
 */
export function mapViewportFeatureToProcesso(
  feature: unknown,
): Processo | null {
  if (!feature || typeof feature !== 'object') return null
  const f = feature as { geometry?: unknown; properties?: unknown }
  const geometry = f.geometry
  const properties =
    f.properties && typeof f.properties === 'object'
      ? (f.properties as Record<string, unknown>)
      : {}

  // Viewport retorna scores como campos planos em `properties`
  // (risk_score, risk_label, os_moderado), mas mapDbRowToMapProcesso
  // espera `scores_persistido` como objeto aninhado. Adapta o shape
  // aqui para manter compatibilidade entre ambos os endpoints.
  const riskScore = properties.risk_score
  const riskLabel = properties.risk_label
  const osModerado = properties.os_moderado
  const scoresPersistido =
    typeof riskScore === 'number'
      ? {
          risk_score: riskScore,
          risk_label: typeof riskLabel === 'string' ? riskLabel : null,
          os_moderado: typeof osModerado === 'number' ? osModerado : null,
          os_conservador: null, // não vem no viewport (só /api/processo)
          os_arrojado: null,
          os_label: null,
          dimensoes_risco: null, // idem — breakdown só em /api/processo
          dimensoes_oportunidade: null,
        }
      : null

  return mapDbRowToMapProcesso({
    ...properties,
    geom: geometry,
    scores_persistido: scoresPersistido,
  })
}

/**
 * Helper: mapeia lista de features de uma FeatureCollection para Processo[].
 * Descarta features inválidas (sem numero, sem geometria, etc).
 */
export function mapViewportFeaturesToProcessos(
  features: unknown[],
): Processo[] {
  const out: Processo[] = []
  for (const f of features) {
    const p = mapViewportFeatureToProcesso(f)
    if (p) out.push(p)
  }
  return out
}
