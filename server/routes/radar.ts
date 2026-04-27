import { Router } from 'express'
import { pool } from '../pool'

const router = Router()

router.get('/api/radar/eventos', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL nao configurada' })
  }
  try {
    const hoje = new Date().toISOString().slice(0, 10)
    const q = req.query as Record<string, string | undefined>
    const dataAteEff = q.data_ate || hoje
    const dataDeEff = q.data_de || hoje
    const limite = Math.min(200, Math.max(1, parseInt(String(q.limite || '50'), 10) || 50))
    const offset = Math.max(0, parseInt(String(q.offset || '0'), 10) || 0)
    const categoria = q.categoria
    const orgao = q.orgao
    const uf = q.uf
    const substancia = q.substancia
    const urgente = q.urgente
    const busca = q.q

    const conds: string[] = ['data_evento::date >= $1::date', 'data_evento::date <= $2::date']
    const values: unknown[] = [dataDeEff, dataAteEff]
    let n = 3
    if (categoria) {
      conds.push(`categoria = ANY($${n}::text[])`)
      values.push(categoria.split(',').map((s) => s.trim().toUpperCase()))
      n++
    }
    if (orgao) {
      conds.push(`orgao_emissor = ANY($${n}::text[])`)
      values.push(orgao.split(',').map((s) => s.trim().toUpperCase()))
      n++
    }
    if (uf) {
      conds.push(`ufs_afetadas && $${n}::text[]`)
      values.push(uf.split(',').map((s) => s.trim().toUpperCase()))
      n++
    }
    if (substancia) {
      conds.push(`substancias_minerais && $${n}::text[]`)
      values.push(substancia.split(',').map((s) => s.trim().toUpperCase()))
      n++
    }
    if (urgente === 'true') {
      conds.push('urgente = TRUE')
    }
    if (busca) {
      conds.push(`(titulo ILIKE $${n} OR resumo ILIKE $${n})`)
      values.push(`%${busca}%`)
      n++
    }
    const whereClause = conds.join(' AND ')
    const listSql = `SELECT * FROM v_radar_eventos_full
      WHERE ${whereClause}
      ORDER BY publicado_em DESC
      LIMIT $${n} OFFSET $${n + 1}`
    const listParams = [...values, limite, offset]
    const countSql = `SELECT COUNT(*)::bigint AS total FROM v_radar_eventos_full WHERE ${whereClause}`

    const [eventos, resumoCategoria, substanciasCitadas, totalCount] = await Promise.all([
      pool.query(listSql, listParams),
      pool.query(
        `SELECT categoria, COUNT(*)::int AS qtd
         FROM v_radar_eventos_full
         WHERE data_evento::date >= $1::date AND data_evento::date <= $2::date
         GROUP BY categoria`,
        [dataDeEff, dataAteEff],
      ),
      pool.query(
        `SELECT subs AS substancia, COUNT(*)::int AS qtd
         FROM v_radar_eventos_full, unnest(substancias_minerais) AS subs
         WHERE data_evento::date >= $1::date AND data_evento::date <= $2::date
         GROUP BY subs
         ORDER BY 2 DESC
         LIMIT 20`,
        [dataDeEff, dataAteEff],
      ),
      pool.query(countSql, values),
    ])

    const acc: Record<string, number> = {}
    for (const row of resumoCategoria.rows as { categoria: string; qtd: string }[]) {
      acc[row.categoria] = parseInt(String(row.qtd), 10)
    }

    res.json({
      eventos: eventos.rows,
      resumo: {
        total: parseInt(String((totalCount.rows[0] as { total: string } | undefined)?.total ?? '0'), 10),
        por_categoria: acc,
        substancias_citadas: substanciasCitadas.rows,
      },
      paginacao: { limite, offset },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/radar/eventos]', err)
    res.status(500).json({ error: msg })
  }
})

router.get('/api/radar/eventos/:id', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL nao configurada' })
  }
  const eventoId = parseInt(req.params.id, 10)
  if (!Number.isFinite(eventoId)) {
    return res.status(400).json({ error: 'id invalido' })
  }
  try {
    const [ev, processos] = await Promise.all([
      pool.query('SELECT * FROM v_radar_eventos_full WHERE id = $1', [eventoId]),
      pool.query(
        `SELECT
          p.id, p.numero, p.uf, p.substancia, p.titular, p.fase,
          s.risk_score, s.risk_label,
          ep.match_motivo, ep.match_score
         FROM radar_eventos_processos ep
         JOIN processos p ON p.id = ep.processo_id
         LEFT JOIN scores s ON s.processo_id = p.id
         WHERE ep.evento_id = $1
         ORDER BY ep.match_score DESC NULLS LAST, p.numero
         LIMIT 200`,
        [eventoId],
      ),
    ])
    if (!ev.rows[0]) {
      return res.status(404).json({ error: 'evento nao encontrado' })
    }
    return res.json({
      ...(ev.rows[0] as Record<string, unknown>),
      processos_afetados: processos.rows,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/radar/eventos/:id]', err)
    res.status(500).json({ error: msg })
  }
})

export default router
