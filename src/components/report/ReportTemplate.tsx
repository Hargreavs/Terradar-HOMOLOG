import type { ReportLang } from '../../lib/reportLang'
import type { ReportData, ReportLLMBlocks } from '../../lib/reportTypes'
import { escapeHtml } from './reportHtmlUtils'
import { getReportCSS } from './reportCSS'
import { getReportStrings } from './reportL10n'
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

export function buildReportHTML(
  data: ReportData,
  llm: ReportLLMBlocks,
  lang?: ReportLang,
): string {
  const l = lang ?? data.lang ?? 'pt'
  const t = getReportStrings(l)
  const htmlLang = l === 'en' ? 'en-US' : 'pt-BR'
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TERRADAR — ${t.docTitleSuffix} ${escapeAttr(data.processo ?? '')}</title>
  <style>${getReportCSS()}</style>
</head>
<body>
  ${buildPage1_Capa(data, t)}
  ${buildPage2_SumarioVital(data, llm.sumario, t)}
  ${buildPage3_Territorio(data, llm.territorio, t)}
  ${buildPage4_Mercado(data, llm.mercado, t)}
  ${buildPage5_Fiscal(data, llm.fiscal, t)}
  ${buildPage6_Risco(data, llm.risco, t)}
  ${buildPage7_Oportunidade(data, llm.oportunidade, t)}
  ${buildPage8_Metodologia(data, t)}
</body>
</html>`
}

function escapeAttr(s: string | null | undefined): string {
  return escapeHtml(s)
}
