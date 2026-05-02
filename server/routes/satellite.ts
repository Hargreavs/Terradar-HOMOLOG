import { Router } from 'express'

import { MapboxError } from '../lib/mapboxStatic'
import {
  parseGeometryJsonb,
  SentinelHubError,
  signedUrlFromCachePath,
  type BBoxLonLat,
} from '../lib/sentinelHub'
import { gerarImagemSatelite } from '../lib/satelliteHybrid'
import { pool } from '../pool'
import { supabase } from '../supabase'

export const satelliteRouter = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TRINTA_DIAS_MS = 30 * 86_400_000

function toBbox(v: unknown): BBoxLonLat | null {
  if (!Array.isArray(v) || v.length !== 4) return null
  const [a, b, c, d] = v.map((x) => Number(x))
  if ([a, b, c, d].every((n) => Number.isFinite(n))) {
    return [a!, b!, c!, d!]
  }
  return null
}

function resolveFonte(row: Record<string, unknown>): 'sentinel-2' | 'mapbox' {
  const f = row.fonte
  if (f === 'mapbox' || f === 'sentinel-2') return f
  const path = row.storage_path
  if (typeof path === 'string' && path.endsWith('-mapbox.png')) return 'mapbox'
  return 'sentinel-2'
}

function cacheStillFresh(row: Record<string, unknown>): boolean {
  const fonte = resolveFonte(row)
  const genRaw = row.generated_at
  const genMs = genRaw != null ? new Date(String(genRaw)).getTime() : NaN
  if (fonte === 'mapbox') {
    return Number.isFinite(genMs) && Date.now() - genMs <= TRINTA_DIAS_MS
  }
  const capRaw = row.captured_at
  const capMs =
    capRaw != null && capRaw !== ''
      ? new Date(String(capRaw)).getTime()
      : NaN
  return Number.isFinite(capMs) && Date.now() - capMs <= TRINTA_DIAS_MS
}

satelliteRouter.get('/api/processos/:id/satellite-image', async (req, res) => {
  const id = req.params.id ?? ''
  if (!UUID_RE.test(id)) {
    return res.status(400).json({
      error: 'interno',
      message: 'Identificador de processo invalido',
    })
  }

  if (!pool) {
    return res.status(500).json({
      error: 'interno',
      message: 'Falha temporaria — tente de novo',
    })
  }

  let q: {
    rows: Array<{ g: unknown; area_ha: unknown }>
    rowCount: number | null
  }
  try {
    q = await pool.query<{ g: unknown; area_ha: unknown }>(
      `SELECT ST_AsGeoJSON(geom)::jsonb AS g,
              COALESCE(area_ha, 0)::double precision AS area_ha
       FROM processos WHERE id = $1::uuid`,
      [id],
    )
  } catch (e) {
    console.warn('[satellite] pool query', e)
    return res.status(500).json({
      error: 'interno',
      message: 'Falha temporaria — tente de novo',
    })
  }

  if (q.rowCount === 0) {
    return res.status(404).json({
      error: 'sem_geom',
      message: 'Processo sem polígono cadastrado',
    })
  }

  const row0 = q.rows[0]
  const geometry = parseGeometryJsonb(row0?.g)
  if (!geometry) {
    return res.status(404).json({
      error: 'sem_geom',
      message: 'Processo sem polígono cadastrado',
    })
  }

  const areaHaRaw = row0?.area_ha
  const areaHa =
    typeof areaHaRaw === 'number' && Number.isFinite(areaHaRaw)
      ? areaHaRaw
      : Number(areaHaRaw) || 0

  const { data: cacheRow } = await supabase
    .from('satellite_image_cache')
    .select('*')
    .eq('processo_id', id)
    .maybeSingle()

  if (cacheRow && cacheStillFresh(cacheRow as Record<string, unknown>)) {
    try {
      const cacheRec = cacheRow as Record<string, unknown>
      const url = await signedUrlFromCachePath(String(cacheRec.storage_path))
      const bbox_usado = toBbox(cacheRec.bbox_usado)
      const fonte = resolveFonte(cacheRec)
      if (bbox_usado) {
        if (fonte === 'mapbox') {
          return res.json({
            url,
            fonte: 'mapbox',
            captured_at: null,
            cloud_coverage: null,
            cached: true,
            bbox_usado,
            imagem_largura: Number(cacheRec.imagem_largura),
            imagem_altura: Number(cacheRec.imagem_altura),
          })
        }
        const capRaw = cacheRec.captured_at
        const capMs =
          capRaw != null && capRaw !== ''
            ? new Date(String(capRaw)).getTime()
            : NaN
        if (Number.isFinite(capMs)) {
          return res.json({
            url,
            fonte: 'sentinel-2',
            captured_at: new Date(capMs).toISOString(),
            cloud_coverage: Number(cacheRec.cloud_coverage),
            cached: true,
            bbox_usado,
            imagem_largura: Number(cacheRec.imagem_largura),
            imagem_altura: Number(cacheRec.imagem_altura),
          })
        }
      }
    } catch {
      /* cache stale or object missing — regenerate */
    }
  }

  try {
    const out = await gerarImagemSatelite(id, geometry, areaHa)
    if (out.fonte === 'mapbox') {
      return res.json({
        url: out.url,
        fonte: 'mapbox',
        captured_at: null,
        cloud_coverage: null,
        cached: false,
        bbox_usado: out.bbox_usado,
        imagem_largura: out.imagem_largura,
        imagem_altura: out.imagem_altura,
      })
    }
    return res.json({
      url: out.url,
      fonte: 'sentinel-2',
      captured_at: out.captured_at,
      cloud_coverage: out.cloud_coverage,
      cached: false,
      bbox_usado: out.bbox_usado,
      imagem_largura: out.imagem_largura,
      imagem_altura: out.imagem_altura,
    })
  } catch (e) {
    if (e instanceof SentinelHubError || e instanceof MapboxError) {
      if (e.code === 'sem_imagem_disponivel') {
        return res.status(404).json({
          error: 'sem_imagem_disponivel',
          message:
            'Sem imagem com cobertura de nuvem aceitável nos últimos 90 dias',
        })
      }
      if (e.code === 'rate_limit') {
        return res.status(429).json({
          error: 'rate_limit',
          message: e.message,
        })
      }
      return res.status(502).json({
        error: 'interno',
        message: 'Falha temporaria — tente de novo',
      })
    }
    console.error('[satellite]', e)
    return res.status(500).json({
      error: 'interno',
      message: 'Falha temporaria — tente de novo',
    })
  }
})
