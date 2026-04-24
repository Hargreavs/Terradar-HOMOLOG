import { Router } from 'express'
import {
  fetchMapLayerAppHidrica,
  fetchMapLayerAquifero,
  fetchMapLayerBioma,
  fetchMapLayerHidroMassa,
  fetchMapLayerHidroTrecho,
  fetchMapLayerHidrovia,
  fetchMapLayerPorto,
  fetchMapLayerQuilombola,
  fetchMapLayerRodovia,
  fetchMapLayerSitio,
  fetchMapLayerTi,
  fetchMapLayerUc,
  fetchMapLayerUcPi,
  fetchMapLayerUcUs,
} from '../lib/mapLayerGeojson'
import { pool } from '../pool'
import { supabase } from '../supabase'

const router = Router()

/** NUP ANM canônico: 3 dígitos + "." + 3 dígitos + "/" + 4 dígitos (ex.: 871.516/2011). */
const NUP_ANM_REGEX = /^\d{3}\.\d{3}\/\d{4}$/

/** IDs alinhados ao frontend (`TipoCamada` / useMapLayer). */
const VALID_TIPOS = new Set([
  'ti',
  'uc',
  'uc_pi',
  'uc_us',
  'quilombola',
  'aquifero',
  'bioma',
  'ferrovia',
  'rodovia',
  'hidrovia',
  'porto',
  'sitio',
  'hidro_massa',
  'hidro_trecho',
  'app',
])

router.get('/api/map/layers/:tipo', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL não configurada' })
  }

  const tipoRaw = String(req.params.tipo ?? '').trim().toLowerCase()
  if (!tipoRaw || !VALID_TIPOS.has(tipoRaw)) {
    return res.status(400).json({ error: `tipo de camada inválido: ${req.params.tipo}` })
  }

  const bboxStr = (req.query.bbox as string) ?? '-74,-34,-34,6'
  const bboxParts = bboxStr.split(',').map(Number)
  if (bboxParts.length !== 4 || bboxParts.some((n) => !Number.isFinite(n))) {
    return res
      .status(400)
      .json({ error: 'bbox inválido. Formato: minx,miny,maxx,maxy' })
  }
  const [minx, miny, maxx, maxy] = bboxParts

  const zoom = Number(req.query.zoom ?? 5)
  const limit = Math.min(Number(req.query.limit ?? 2000), 5000)
  const minStrahler = (() => {
    const n = parseInt(String(req.query.min_strahler ?? '3'), 10)
    if (!Number.isFinite(n)) return 3
    return Math.min(12, Math.max(0, n))
  })()
  const minFaixa = (() => {
    const n = parseInt(String(req.query.min_faixa ?? '50'), 10)
    if (!Number.isFinite(n)) return 50
    return Math.min(1000, Math.max(0, n))
  })()

  try {
    let geojson: unknown
    // fn_map_layer_geojson (não no repo) falhava: porto não está em
    // geo_infraestrutura; rodovia exige tabela+SRID alinhados. Ver mapLayerGeojson.ts + Doc F6a.
    if (tipoRaw === 'porto') {
      geojson = await fetchMapLayerPorto(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'rodovia') {
      geojson = await fetchMapLayerRodovia(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        limit,
      )
    } else if (tipoRaw === 'sitio') {
      geojson = await fetchMapLayerSitio(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'hidro_massa') {
      geojson = await fetchMapLayerHidroMassa(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        limit,
      )
    } else if (tipoRaw === 'hidro_trecho') {
      geojson = await fetchMapLayerHidroTrecho(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        minStrahler,
        limit,
      )
    } else if (tipoRaw === 'app') {
      geojson = await fetchMapLayerAppHidrica(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        minFaixa,
        limit,
      )
    } else if (tipoRaw === 'ti') {
      geojson = await fetchMapLayerTi(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'uc') {
      geojson = await fetchMapLayerUc(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'uc_pi') {
      geojson = await fetchMapLayerUcPi(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'uc_us') {
      geojson = await fetchMapLayerUcUs(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'quilombola') {
      geojson = await fetchMapLayerQuilombola(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        limit,
      )
    } else if (tipoRaw === 'aquifero') {
      geojson = await fetchMapLayerAquifero(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        limit,
      )
    } else if (tipoRaw === 'bioma') {
      geojson = await fetchMapLayerBioma(pool, minx, miny, maxx, maxy, limit)
    } else if (tipoRaw === 'hidrovia') {
      geojson = await fetchMapLayerHidrovia(
        pool,
        minx,
        miny,
        maxx,
        maxy,
        limit,
      )
    } else {
      const { rows } = await pool.query(
        `SELECT fn_map_layer_geojson($1::text,$2::float8,$3::float8,$4::float8,$5::float8,$6::int,$7::int) AS geojson`,
        [tipoRaw, minx, miny, maxx, maxy, Math.round(zoom), limit],
      )
      geojson = rows[0]?.geojson ?? {
        type: 'FeatureCollection',
        count: 0,
        truncated: false,
        features: [],
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(geojson)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/map/layers]', tipoRaw, msg)
    res.status(500).json({ error: 'Erro ao buscar camada', detalhe: msg })
  }
})

/**
 * Linhas tracejadas entre centróide do processo e 8 categorias territoriais.
 * Backend: RPC `fn_territorial_lines(p_numero text) -> jsonb` (features com
 * distância < 1 km já filtradas no banco). Sem cache: o resultado depende de
 * CTEs dinâmicas em `fn_territorial_analysis`.
 */
router.get('/api/map/territorial-lines', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')

  const raw = req.query.numero
  const numero = typeof raw === 'string' ? raw.trim() : ''
  if (!numero) {
    return res.status(400).json({ error: 'numero é obrigatório' })
  }
  if (!NUP_ANM_REGEX.test(numero)) {
    return res.status(400).json({ error: 'formato inválido' })
  }

  try {
    const { data, error } = await supabase.rpc('fn_territorial_lines', {
      p_numero: numero,
    })

    if (error) {
      console.error('[/api/map/territorial-lines] rpc error:', error.message)
      return res.status(500).json({ error: 'Erro ao buscar linhas territoriais' })
    }

    const fc = data as {
      type?: string
      features?: unknown[]
      metadata?: Record<string, unknown>
    } | null

    if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        metadata: {
          processo: numero,
          total_linhas: 0,
          generated_at: new Date().toISOString(),
        },
      })
    }

    return res.json(fc)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/map/territorial-lines]', numero, msg)
    return res.status(500).json({ error: 'Erro ao buscar linhas territoriais' })
  }
})

export default router
