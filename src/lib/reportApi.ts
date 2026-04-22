import type { ReportData, ReportLLMResult } from './reportTypes'

export interface GenerateReportAPIResponse {
  ok: boolean
  llm?: ReportLLMResult
  error?: string
}

export async function callGenerateReportAPI(
  data: ReportData,
): Promise<ReportLLMResult> {
  const res = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const json = (await res.json()) as GenerateReportAPIResponse

  if (!res.ok || !json.ok || !json.llm) {
    throw new Error(json.error ?? 'Falha ao gerar relatório')
  }

  return json.llm
}
