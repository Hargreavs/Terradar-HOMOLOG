import { Router } from 'express'
import { computeProcessoComBreakdown } from '../scoringMotorS31'

export const scoreBreakdownRouter = Router()

scoreBreakdownRouter.get(
  '/api/processos/:id/score-breakdown',
  async (req, res) => {
    const startTime = Date.now()
    try {
      const result = await computeProcessoComBreakdown(req.params.id)
      const elapsedMs = Date.now() - startTime
      res.setHeader('X-Compute-Time-Ms', String(elapsedMs))
      res.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[score-breakdown] ${req.params.id}:`, msg)
      res.status(500).json({ error: msg })
    }
  },
)
