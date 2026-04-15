import { generateReportLLM } from '../../../src/lib/report-llm'
import type { ReportData } from '../../../src/lib/reportTypes'

/**
 * Handler compatível com Request Web (ex.: futura rota Next) e com o servidor Express.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const data = (await request.json()) as ReportData

    if (!data.processo || !data.substancia_anm) {
      return Response.json({ error: 'Dados do processo incompletos' }, { status: 400 })
    }

    const result = await generateReportLLM(data)

    return Response.json({
      ok: true,
      llm: result,
    })
  } catch (error) {
    console.error('Erro na geração do relatório:', error)
    return Response.json(
      { ok: false, error: 'Erro interno na geração do relatório' },
      { status: 500 },
    )
  }
}
