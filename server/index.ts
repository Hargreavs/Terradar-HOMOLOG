import './env'

import cors from 'cors'
import express from 'express'

import mapRouter from './routes/map'
import processosViewportRouter from './routes/processos-viewport'
import radarRouter from './routes/radar'
import { scoreBreakdownRouter } from './routes/scoreBreakdown'
import { satelliteRouter } from './routes/satellite'
import { POST } from '../app/api/generate-report/route'
import { supabase } from './supabase'
import { pool } from './pool'
import {
  computeScoresAuto,
  getCapag,
  getCfemHistorico,
  getFiscal,
  getIncentivosUf,
  getInfraestrutura,
  getLinhasBndes,
  getProcesso,
  getProcessoEnriquecido,
  getCfemBreakdownPorMunicipio,
  getScores,
  getSubstancia,
  getTerritoralAnalysis,
  getTerritoralLayers,
  type ScoreResult,
} from './db'

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(mapRouter)
app.use(processosViewportRouter)
app.use(radarRouter)
app.use(scoreBreakdownRouter)
app.use(satelliteRouter)

function hasManualRiskScore(
  scores: Record<string, unknown> | null,
): boolean {
  if (scores == null) return false
  const rs = scores.risk_score
  return typeof rs === 'number' && !Number.isNaN(rs)
}

/**
 * Número ANM pode conter "/" (ex.: 864.231/2017). Não usar path `.../:numero`,
 * porque `%2F` vira "/" e o Express parte o path em vários segmentos (404).
 */
/**
 * Busca leve de processo por número — retorna só cadastro + geometria (linha `processos`).
 * Usado pela barra de busca do mapa.
 */
app.get('/api/processo/busca', async (req, res) => {
  const raw = req.query.numero
  const numero =
    typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''
  if (!numero) {
    return res.json({ ok: false, error: 'Número não informado' })
  }
  try {
    const processo = await getProcesso(numero)
    const proc = processo as Record<string, unknown>

    let scores_persistido: Record<string, unknown> | null = null
    try {
      const processoId = proc.id
      if (processoId != null && String(processoId).trim() !== '') {
        const row = await getScores(String(processoId))
        if (row) scores_persistido = row as Record<string, unknown>
      }
    } catch (spErr) {
      console.error('[api/processo/busca] scores_persistido:', spErr)
    }

    let scores_auto: ScoreResult | null = null
    try {
      const processoIdBusca = proc.id
      if (processoIdBusca != null && String(processoIdBusca).trim() !== '') {
        scores_auto = await computeScoresAuto(String(processoIdBusca), {
          persist: false,
        })
      }
    } catch (scoreErr) {
      console.error('[api/processo/busca] scores_auto:', scoreErr)
    }

    return res.json({
      ok: true,
      data: {
        ...(processo as Record<string, unknown>),
        scores_auto,
        scores_persistido,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const notFound =
      msg.includes('não encontrado') ||
      msg.includes('PGRST116') ||
      msg.toLowerCase().includes('not found')
    if (notFound) {
      return res.json({ ok: false, error: 'Processo não encontrado' })
    }
    return res.json({ ok: false, error: msg })
  }
})

/**
 * Lista eventos SCM/ANM de um processo. Usa RPC `fn_processo_eventos_list`
 * que retorna { total, limit, offset, eventos: [...] }.
 *
 * NOTA: Número ANM contém "/" (ex: 864.231/2017). Use query string
 * com encodeURIComponent no client.
 */
app.get('/api/processo/eventos', async (req, res) => {
  const raw = req.query.numero
  const numero =
    typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''

  const limitRaw = Number(req.query.limit ?? 40)
  const offsetRaw = Number(req.query.offset ?? 0)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
    ? Math.floor(limitRaw)
    : 40
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0
    ? Math.floor(offsetRaw)
    : 0

  if (!numero) {
    return res
      .status(400)
      .json({ ok: false, error: 'Parâmetro "numero" é obrigatório.' })
  }

  try {
    const { data, error } = await supabase.rpc('fn_processo_eventos_list', {
      p_processo_numero: numero,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      console.error('[api/processo/eventos] RPC error:', error.message)
      return res.status(500).json({ ok: false, error: error.message })
    }

    // RPC sempre retorna shape válido (mesmo com 0 eventos),
    // mas defensiva pra null:
    const payload = (data ?? { total: 0, limit, offset, eventos: [] }) as {
      total: number
      limit: number
      offset: number
      eventos: unknown[]
    }

    return res.json({ ok: true, data: payload })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[api/processo/eventos] Exception:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
})

/**
 * Busca multi-canal: número ANM, CNPJ do titular, ou nome do titular.
 * Detecta automaticamente pelo formato do input.
 * Retorna até 15 resultados.
 */
app.get('/api/processo/search', async (req, res) => {
  const raw = req.query.q
  const q = typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''
  if (!q || q.length < 2) {
    return res.json({ ok: true, data: [], total: 0, tipo: 'vazio' })
  }

  try {
    const soDigitos = q.replace(/\D/g, '')
    const ehNumeroAnm =
      /^\d{6}\/\d{4}$|^\d{3}\.\d{3}\/\d{4}$/.test(q) ||
      (soDigitos.length === 10 && !q.includes(' '))
    const ehCnpj = soDigitos.length === 14

    let query = supabase
      .from('processos')
      .select(
        'id, numero, titular, cnpj_titular, uf, municipio, substancia, regime, fase, area_ha, ativo_derivado, dados_insuficientes, geom',
        { count: 'exact' },
      )
      .limit(15)

    let tipo: 'numero' | 'cnpj' | 'titular' = 'titular'

    if (ehNumeroAnm) {
      tipo = 'numero'
      let numeroFmt = q
      if (soDigitos.length === 10) {
        numeroFmt = `${soDigitos.slice(0, 3)}.${soDigitos.slice(3, 6)}/${soDigitos.slice(6, 10)}`
      }
      query = query.eq('numero', numeroFmt)
    } else if (ehCnpj) {
      tipo = 'cnpj'
      const cnpjFmt = `${soDigitos.slice(0, 2)}.${soDigitos.slice(2, 5)}.${soDigitos.slice(5, 8)}/${soDigitos.slice(8, 12)}-${soDigitos.slice(12, 14)}`
      query = query.eq('cnpj_titular', cnpjFmt)
    } else {
      tipo = 'titular'
      query = query.ilike('titular', `%${q}%`)
      query = query.order('numero', { ascending: false })
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[api/processo/search] Erro:', error.message)
      return res.status(500).json({ ok: false, error: error.message, tipo })
    }

    // Deriva tem_geom e remove o campo geom do payload (binário pesado).
    const dataWithFlag = (data ?? []).map((row) => {
      const { geom, ...rest } = row as Record<string, unknown>
      return {
        ...rest,
        tem_geom: geom != null,
      }
    })

    return res.json({
      ok: true,
      tipo,
      total: count ?? data?.length ?? 0,
      data: dataWithFlag,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[api/processo/search] Exception:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
})

app.get('/api/processo', async (req, res) => {
  try {
    const raw = req.query.numero
    const numero =
      typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''
    if (!numero) {
      return res.status(400).json({
        ok: false,
        error: 'Parâmetro query "numero" é obrigatório (ex.: ?numero=864.231/2017).',
      })
    }

    const processoRow = await getProcessoEnriquecido(numero)
    const procRow = processoRow as Record<string, unknown>
    const municipioIbge = String(procRow.municipio_ibge ?? '')
    const [cfemPorMunRpc, cfemMunHistRpc] = await Promise.all([
      supabase.rpc('fn_cfem_processo_municipio', { p_numero: numero }),
      municipioIbge
        ? supabase.rpc('fn_cfem_municipio_historico', {
            p_ibge: municipioIbge,
            p_anos_atras: 10,
          })
        : Promise.resolve({ data: null as unknown, error: null }),
    ])
    const cfemPorMunicipio = cfemPorMunRpc.error
      ? []
      : ((cfemPorMunRpc.data ?? []) as unknown[])
    const cfemMunicipioHistorico = cfemMunHistRpc.error
      ? []
      : ((cfemMunHistRpc.data ?? []) as unknown[])
    const cfemPorMunicipioBreakdown = await getCfemBreakdownPorMunicipio(
      numero,
      cfemPorMunicipio,
      String(procRow.uf ?? ''),
    )
    const processo = {
      ...procRow,
      cfem_por_municipio: cfemPorMunicipio,
      cfem_municipio_historico: cfemMunicipioHistorico,
      cfem_por_municipio_breakdown: cfemPorMunicipioBreakdown,
    }
    const proc = processo as Record<string, unknown>
    const processoId = String(proc.id ?? '')
    const substanciaAnm = String(proc.substancia ?? '')

    const [
      scores,
      layers,
      infra,
      cfem,
      capag,
      mercado,
      analise,
      fiscalMun,
      incentivosUfRaw,
      pendenciasRpc,
    ] = await Promise.all([
      getScores(processoId),
      getTerritoralLayers(processoId),
      getInfraestrutura(processoId),
      getCfemHistorico(municipioIbge),
      getCapag(municipioIbge),
      getSubstancia(substanciaAnm),
      getTerritoralAnalysis(numero).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(
          `[/api/processo] análise territorial indisponível (processo ${numero} sem geom?): ${msg}`,
        )
        return null
      }),
      getFiscal(municipioIbge),
      getIncentivosUf(String(proc.uf ?? '')),
      supabase.rpc('fn_pendencias_processo', { p_numero: numero }),
    ])

    const linhasBndesData = await getLinhasBndes(
      Boolean(
        (mercado as Record<string, unknown> | null)?.mineral_critico_2025,
      ),
    )

    // Classificação de arquétipo zumbi (grupamento / fantasma / disponibilidade
    // / trâmite) quando `dados_insuficientes=true`. Chamada serial (não no
    // Promise.all) para evitar overhead em processos normais — a RPC só roda
    // para ~180 zumbis em toda a base. Retorna JSONB com label_regime,
    // label_fase, explicacao_curta e arquetipo.
    const dadosInsuficientesFlag = Boolean(
      (proc as Record<string, unknown>).dados_insuficientes,
    )
    const classificacaoZumbi: Record<string, unknown> | null =
      dadosInsuficientesFlag
        ? await (async (): Promise<Record<string, unknown> | null> => {
            try {
              const r = await supabase.rpc('fn_classificacao_zumbi', {
                p_numero: numero,
              })
              return (r.data as Record<string, unknown> | null) ?? null
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err)
              console.warn(
                `[/api/processo] fn_classificacao_zumbi falhou para ${numero}: ${msg}`,
              )
              return null
            }
          })()
        : null

    const cfemTotal = (cfem as { valor_brl?: unknown }[]).reduce(
      (sum: number, r) => sum + Number(r.valor_brl ?? 0),
      0,
    )

    let scores_auto: ScoreResult | null = null
    let scores_final: Record<string, unknown> | null =
      scores as Record<string, unknown> | null

    try {
      // S31: motor lê camadas e fiscal no Postgres; skip zumbis/dados insuficientes.
      const dadosInsuficientes = Boolean(
        (proc as Record<string, unknown>).dados_insuficientes,
      )
      if (processoId && !dadosInsuficientes) {
        scores_auto = await computeScoresAuto(processoId, { persist: false })
        if (!hasManualRiskScore(scores_final) && scores_auto) {
          scores_final = {
            ...(scores_final ?? {}),
            risk_score: scores_auto.risk_score,
            risk_label: scores_auto.risk_label,
            risk_cor: scores_auto.risk_cor,
            os_conservador: scores_auto.os_conservador,
            os_moderado: scores_auto.os_moderado,
            os_arrojado: scores_auto.os_arrojado,
            os_label: scores_auto.os_label_conservador,
            os_classificacao: scores_auto.os_label_conservador,
            dimensoes_risco: {
              geologico: scores_auto.risk_breakdown.geologico,
              ambiental: scores_auto.risk_breakdown.ambiental,
              social: scores_auto.risk_breakdown.social,
              regulatorio: scores_auto.risk_breakdown.regulatorio,
            },
            dimensoes_oportunidade: {
              mercado: scores_auto.os_breakdown.atratividade,
              atratividade: scores_auto.os_breakdown.atratividade,
              viabilidade: scores_auto.os_breakdown.viabilidade,
              seguranca: scores_auto.os_breakdown.seguranca,
            },
            scores_fonte: 'auto',
          }
        }
      }
    } catch (err) {
      console.error('[computeScoresAuto] Erro:', err)
    }

    if (pendenciasRpc.error) {
      console.error('[fn_pendencias_processo] Erro:', pendenciasRpc.error)
    }
    const pendenciasRaw = (pendenciasRpc.error
      ? []
      : (pendenciasRpc.data ?? [])) as Array<Record<string, unknown>>
    const pendencias = pendenciasRaw.map((row) => ({
      tipo: String(row.out_tipo ?? ''),
      fase: (row.out_fase as string | null) ?? null,
      categoria: (row.out_categoria as string | null) ?? null,
      data_origem: (row.out_data_origem as string | null) ?? null,
      dias_em_aberto: (row.out_dias_em_aberto as number | null) ?? null,
      prazo_original_dias: (row.out_prazo_original_dias as number | null) ?? null,
      status: (row.out_status as string | null) ?? null,
      gravidade: (row.out_gravidade as string | null) ?? null,
      risco_caducidade: (row.out_risco_caducidade as boolean | null) ?? null,
      descricao: (row.out_descricao as string | null) ?? null,
      evento_codigo: (row.out_evento_codigo as number | null) ?? null,
      evento_descricao: (row.out_evento_descricao as string | null) ?? null,
    }))

    res.json({
      ok: true,
      data: {
        processo,
        classificacao_zumbi: classificacaoZumbi,
        scores: scores_final,
        scores_auto,
        territorial: { layers, infra },
        fiscal: {
          cfem_historico: cfem,
          cfem_total_4anos: cfemTotal,
          capag,
        },
        mercado,
        analise_territorial: analise,
        fiscal_municipio: fiscalMun,
        incentivos_uf: incentivosUfRaw,
        linhas_bndes: linhasBndesData,
        pendencias,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao carregar processo'
    const notFound =
      msg.includes('não encontrado') ||
      msg.includes('sem geometria') ||
      msg.toLowerCase().includes('not found') ||
      msg.includes('PGRST116')
    res.status(notFound ? 404 : 500).json({
      ok: false,
      error: notFound
        ? 'Dados ainda não disponíveis para este processo.'
        : msg,
    })
  }
})

/**
 * Análise territorial da dimensão Ambiental (sítios, APP hídrica, massas d’água).
 * GET /api/processo/:numero/territorial-ambiental — use `encodeURIComponent(numero)` no
 * segmento (ex.: 864.231%2F2017). Chama `fn_territorial_analysis_ambiental` no Postgres.
 */
app.get(
  '/api/processo/:numero/territorial-ambiental',
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({ error: 'DATABASE_URL não configurada' })
    }
    const raw = req.params.numero
    const numero = typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''
    if (!numero) {
      return res.status(400).json({ error: 'numero obrigatorio' })
    }
    try {
      const { rows } = await pool.query(
        'SELECT fn_territorial_analysis_ambiental($1) AS resultado',
        [numero],
      )
      const resultado = rows[0]?.resultado
      if (resultado == null) {
        return res.status(404).json({ error: 'Análise ambiental indisponível' })
      }
      res.json(resultado)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const lower = msg.toLowerCase()
      if (
        lower.includes('nao encontrado') ||
        lower.includes('não encontrado') ||
        lower.includes('not found')
      ) {
        return res.status(404).json({ error: msg })
      }
      console.error('[/api/processo/.../territorial-ambiental]', err)
      res.status(500).json({ error: 'erro ao calcular analise ambiental' })
    }
  },
)

app.get('/api/cpt/uf/:uf', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL não configurada' })
  }
  const uf = String(req.params.uf ?? '')
    .trim()
    .toUpperCase()
  if (uf.length !== 2) {
    return res.status(400).json({ error: 'UF inválida' })
  }
  try {
    const { rows } = await pool.query(
      `WITH agregado AS (
        SELECT
          ano,
          SUM(ocorrencias) AS ocorrencias,
          SUM(familias) AS familias
        FROM geo_conflitos_cpt_uf
        WHERE UPPER(TRIM(uf)) = $1 AND categoria = 'terra'
        GROUP BY ano
        ORDER BY ano
      ),
      totais AS (
        SELECT
          COALESCE(SUM(ocorrencias), 0) AS total_ocorrencias_5anos,
          COALESCE(SUM(familias), 0) AS total_familias_5anos,
          MAX(ano) FILTER (WHERE ocorrencias > 0) AS ultimo_ano,
          (SELECT ocorrencias FROM agregado WHERE ano = 2024) AS ocorrencias_2024,
          (SELECT familias FROM agregado WHERE ano = 2024) AS familias_2024,
          (SELECT ocorrencias FROM agregado WHERE ano = 2020) AS ocorrencias_2020,
          (SELECT familias FROM agregado WHERE ano = 2020) AS familias_2020
        FROM agregado
      )
      SELECT
        t.*,
        fn_cpt_multiplicador_uf($1::text) AS multiplicador,
        CASE
          WHEN fn_cpt_multiplicador_uf($1::text) >= 1.30 THEN 'super_critica'
          WHEN fn_cpt_multiplicador_uf($1::text) >= 1.20 THEN 'critica'
          WHEN fn_cpt_multiplicador_uf($1::text) >= 1.10 THEN 'media'
          ELSE 'baixa'
        END AS tier,
        (SELECT json_agg(row_to_json(a)) FROM agregado a) AS serie_anual
      FROM totais t`,
      [uf],
    )
    res.json(rows[0] ?? null)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/cpt/uf]', err)
    res.status(500).json({ error: msg })
  }
})

const UUID_PROCESSO_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Alertas Radar IA por processo (RPC `fn_radar_alertas_processo`).
 * GET /api/processos/:id/alertas — `id` = UUID (`processos.id`).
 */
app.get('/api/processos/:id/alertas', async (req, res) => {
  const rawId = String(req.params.id ?? '').trim()
  if (!UUID_PROCESSO_PATH.test(rawId)) {
    return res.status(400).json({ error: 'UUID de processo inválido.' })
  }
  res.setHeader('Cache-Control', 'public, max-age=60')
  try {
    const { data, error } = await supabase.rpc('fn_radar_alertas_processo', {
      p_processo_id: rawId,
    })
    if (error) {
      console.error('[/api/processos/:id/alertas] Supabase:', error)
      return res.status(500).json({ error: 'Não foi possível carregar os alertas.' })
    }
    if (data === null || data === undefined) {
      return res.json({ total: 0, diretos: [], setoriais: [] })
    }
    return res.json(data as Record<string, unknown>)
  } catch (err: unknown) {
    console.error('[/api/processos/:id/alertas]', err)
    return res.status(500).json({ error: 'Não foi possível carregar os alertas.' })
  }
})

/**
 * Contexto S31 mínimo para subfatores (fiscal, CPT, autuações, master_substância).
 * GET /api/processo/score-context?numero=864.231%2F2017
 */
app.get('/api/processo/score-context', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL não configurada' })
  }
  const raw = req.query.numero
  const numero =
    typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''
  if (!numero) {
    return res.status(400).json({ error: 'query numero obrigatório' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT
        f.idh,
        f.populacao,
        f.pib_municipal_mi,
        f.densidade,
        c.nota AS capag_nota,
        ms.gap_pp,
        ms.preco_brl,
        ms.tendencia,
        ms.val_reserva_brl_ha,
        ms.mineral_critico_2025,
        (SELECT COUNT(*)::int FROM cfem_autuacao a WHERE a.processo_minerario = p.numero) AS aut_qtd,
        (SELECT COALESCE(SUM(a.valor), 0) FROM cfem_autuacao a WHERE a.processo_minerario = p.numero) AS aut_total,
        fn_cpt_multiplicador_uf(p.uf) AS cpt_mult,
        CASE
          WHEN fn_cpt_multiplicador_uf(p.uf) >= 1.30 THEN 'super_critica'
          WHEN fn_cpt_multiplicador_uf(p.uf) >= 1.20 THEN 'critica'
          WHEN fn_cpt_multiplicador_uf(p.uf) >= 1.10 THEN 'media'
          ELSE 'baixa'
        END AS cpt_tier
      FROM processos p
      LEFT JOIN fiscal_municipios f ON f.municipio_ibge = p.municipio_ibge
      LEFT JOIN capag_municipios c ON c.municipio_ibge = p.municipio_ibge
      LEFT JOIN master_substancias ms
        ON UPPER(TRIM(ms.substancia_anm::text)) = UPPER(TRIM(p.substancia::text))
      WHERE p.numero = $1
      LIMIT 1`,
      [numero],
    )
    res.json(rows[0] ?? null)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/processo/score-context]', err)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/generate-report', async (req, res) => {
  const r = new Request(`http://127.0.0.1/api/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body ?? {}),
  })
  const out = await POST(r)
  const text = await out.text()
  res.status(out.status).type('application/json').send(text)
})

const port = Number(process.env.API_PORT ?? 3001)
app.listen(port, () => {
  console.log(`[terrae-api] http://127.0.0.1:${port}`)
})
