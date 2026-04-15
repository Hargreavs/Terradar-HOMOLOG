import type { ReportData, ReportLLMBlocks } from '../../lib/reportTypes'
import { escapeHtml } from './reportHtmlUtils'
import { getReportCSS } from './reportCSS'
import {
  buildPage1_Capa,
  buildPage2_SumarioVital,
  buildPage3_Territorio,
  buildPage4_Mercado,
  buildPage5_Fiscal,
  buildPage6_Risco,
  buildPage7_Oportunidade,
  buildPage8_Metodologia,
} from './reportPages'

export function buildReportHTML(data: ReportData, llm: ReportLLMBlocks): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TERRADAR - Relatório ${escapeAttr(data.processo ?? '')}</title>
  <style>${getReportCSS()}</style>
</head>
<body>
  ${buildPage1_Capa(data)}
  ${buildPage2_SumarioVital(data, llm.sumario)}
  ${buildPage3_Territorio(data, llm.territorio)}
  ${buildPage4_Mercado(data, llm.mercado)}
  ${buildPage5_Fiscal(data, llm.fiscal)}
  ${buildPage6_Risco(data, llm.risco)}
  ${buildPage7_Oportunidade(data, llm.oportunidade)}
  ${buildPage8_Metodologia(data)}
</body>
</html>`
}

function escapeAttr(s: string | null | undefined): string {
  return escapeHtml(s)
}
