import { Router } from 'express'
import { pool } from '../pool'

const router = Router()

/** IDs alinhados ao frontend (`TipoCamada` / useMapLayer). */
const VALID_TIPOS = new Set([
  'ti',
  'uc_pi',
  'uc_us',
  'quilombola',
  'aquifero',
  'bioma',
  'ferrovia',
  'rodovia',
  'hidrovia',
  'porto',
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

  try {
    const { rows } = await pool.query(
      `SELECT fn_map_layer_geojson($1::text,$2::float8,$3::float8,$4::float8,$5::float8,$6::int,$7::int) AS geojson`,
      [tipoRaw, minx, miny, maxx, maxy, Math.round(zoom), limit],
    )
    const geojson = rows[0]?.geojson ?? {
      type: 'FeatureCollection',
      count: 0,
      truncated: false,
      features: [],
    }
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(geojson)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/map/layers]', tipoRaw, msg)
    res.status(500).json({ error: 'Erro ao buscar camada', detalhe: msg })
  }
})

export default router
