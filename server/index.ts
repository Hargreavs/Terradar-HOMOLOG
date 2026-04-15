import './env'

import cors from 'cors'
import express from 'express'

import { POST } from '../app/api/generate-report/route'
import {
  computeScoresAuto,
  getCapag,
  getCfemHistorico,
  getFiscal,
  getIncentivosUf,
  getInfraestrutura,
  getLinhasBndes,
  getProcesso,
  getScores,
  getSubstancia,
  getTerritoralAnalysis,
  getTerritoralLayers,
  type ScoreResult,
} from './db'

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

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
    const processoId = String(proc.id ?? '')
    const municipioIbge = String(proc.municipio_ibge ?? '')
    const substanciaAnm = String(proc.substancia ?? '')

    let scores_auto: ScoreResult | null = null
    try {
      const [capag, mercado, analise, fiscalMun] = await Promise.all([
        getCapag(municipioIbge),
        getSubstancia(substanciaAnm),
        getTerritoralAnalysis(numero),
        getFiscal(municipioIbge),
      ])

      const processoParaScore = {
        numero: String(proc.numero ?? numero),
        substancia: String(proc.substancia ?? ''),
        substancia_familia: String(proc.substancia_familia ?? 'outros'),
        fase: String(proc.fase ?? ''),
        regime: proc.regime != null ? String(proc.regime) : null,
        area_ha: Number(proc.area_ha) || 0,
        alvara_validade:
          proc.alvara_validade != null ? String(proc.alvara_validade) : null,
        uf: String(proc.uf ?? ''),
      }

      scores_auto = await computeScoresAuto(
        processoParaScore,
        analise,
        mercado as Record<string, unknown> | null,
        capag as Record<string, unknown> | null,
        fiscalMun,
      )
    } catch (scoreErr) {
      console.error('[api/processo/busca] scores_auto:', scoreErr)
    }

    return res.json({
      ok: true,
      data: {
        ...(processo as Record<string, unknown>),
        scores_auto,
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

    const processo = await getProcesso(numero)
    const proc = processo as Record<string, unknown>
    const processoId = String(proc.id ?? '')
    const municipioIbge = String(proc.municipio_ibge ?? '')
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
    ] = await Promise.all([
      getScores(processoId),
      getTerritoralLayers(processoId),
      getInfraestrutura(processoId),
      getCfemHistorico(municipioIbge),
      getCapag(municipioIbge),
      getSubstancia(substanciaAnm),
      getTerritoralAnalysis(numero),
      getFiscal(municipioIbge),
      getIncentivosUf(String(proc.uf ?? '')),
    ])

    const linhasBndesData = await getLinhasBndes(
      Boolean(
        (mercado as Record<string, unknown> | null)?.mineral_critico_2025,
      ),
    )

    const cfemTotal = (cfem as { valor_brl?: unknown }[]).reduce(
      (sum: number, r) => sum + Number(r.valor_brl ?? 0),
      0,
    )

    let scores_auto: ScoreResult | null = null
    let scores_final: Record<string, unknown> | null =
      scores as Record<string, unknown> | null

    const processoParaScore = {
      numero: String(proc.numero ?? numero),
      substancia: String(proc.substancia ?? ''),
      substancia_familia: String(proc.substancia_familia ?? 'outros'),
      fase: String(proc.fase ?? ''),
      regime: proc.regime != null ? String(proc.regime) : null,
      area_ha: Number(proc.area_ha) || 0,
      alvara_validade:
        proc.alvara_validade != null ? String(proc.alvara_validade) : null,
      uf: String(proc.uf ?? ''),
    }

    try {
      scores_auto = await computeScoresAuto(
        processoParaScore,
        analise,
        mercado as Record<string, unknown> | null,
        capag as Record<string, unknown> | null,
        fiscalMun,
      )
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
    } catch (err) {
      console.error('[computeScoresAuto] Erro:', err)
    }

    res.json({
      ok: true,
      data: {
        processo,
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
