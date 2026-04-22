import { Router } from 'express'
import { pool } from '../pool'

const router = Router()

const REGIMES_VALIDOS = new Set([
  'requerimento_pesquisa',
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'lavra_garimpeira',
  'registro_extracao',
  'disponibilidade',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
])

router.get('/api/processos/viewport', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL não configurada' })
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

  const parseArr = (q: unknown): string[] | null => {
    if (typeof q !== 'string' || q.length === 0) return null
    return q.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const regimesRaw = parseArr(req.query.regimes)
  const regimes =
    regimesRaw?.filter((r) => REGIMES_VALIDOS.has(r)) ?? null
  const substancias = parseArr(req.query.substancias)

  const parseQueryNum = (q: unknown): number | null => {
    const n = Number(q)
    return Number.isFinite(n) ? n : null
  }

  const anoMin = parseQueryNum(req.query.ano_min)
  const anoMax = parseQueryNum(req.query.ano_max)
  const riskMin = parseQueryNum(req.query.risk_min)
  const riskMax = parseQueryNum(req.query.risk_max)

  try {
    const { rows } = await pool.query(
      `SELECT fn_processos_viewport($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS geojson`,
      [
        minx,
        miny,
        maxx,
        maxy,
        zoom,
        regimes,
        substancias,
        anoMin,
        anoMax,
        riskMin,
        riskMax,
        limit,
      ],
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
    console.error('[/api/processos/viewport]', msg)
    res.status(500).json({
      error: 'Erro ao buscar processos',
      detalhe: msg,
    })
  }
})

export default router
