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
  const r = raw.toLowerCase()
  if (
    r.includes('garimp') ||
    (r.includes('lavra') && r.includes('garimpeira'))
  ) {
    return 'lavra_garimpeira'
  }
  if (r.includes('concess') && r.includes('lavra')) return 'concessao_lavra'
  if (r.includes('pesquis') || r.includes('reconhec')) {
    return 'autorizacao_pesquisa'
  }
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
  const data_protocolo =
    typeof row.data_protocolo === 'string' && row.data_protocolo
      ? row.data_protocolo
      : `${year}-01-01`

  const titular = String(row.titular ?? '').trim() || '—'
  const substancia = String(row.substancia ?? '').trim() || '—'
  const uf = String(row.uf ?? '').trim() || '—'
  const municipio = String(row.municipio ?? '').trim() || '—'
  const area_ha = Number(row.area_ha)
  const areaSafe = Number.isFinite(area_ha) ? area_ha : 0

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
  if (sa && typeof sa.risk_score === 'number' && sa.risk_breakdown) {
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
    area_ha: areaSafe,
    uf,
    municipio,
    lat,
    lng,
    data_protocolo,
    ano_protocolo: year,
    situacao: 'ativo',
    risk_score,
    risk_breakdown,
    risk_decomposicao: null,
    valor_estimado_usd_mi: 0,
    ultimo_despacho_data: data_protocolo,
    alertas: [] as AlertaLegislativo[],
    fiscal: EMPTY_FISCAL,
    geojson: buildGeojson(id, polyCoords),
    fromApi: true,
  }
}
