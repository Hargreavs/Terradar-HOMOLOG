# Exportar relatorio PDF - documentacao TERRADAR

Documentacao derivada do codigo para ajustar o fluxo de exportacao (UI, dados, API, LLM, HTML e impressao).

## Indice

- **01-fluxo-end-to-end.md** - Sequencia do clique ate print(), ficheiros tocados
- **02-frontend-e-ui.md** - ExportReportButton, estados, iframe, onde o botao e montado
- **03-buildReportData-e-tipos.md** - fetchProcessoCompleto, ReportData, reportDataBuilder
- **04-rede-api-servidor.md** - Vite proxy, Express, POST em app/api/generate-report/route
- **05-llm-prompts-e-modelo.md** - report-llm.ts, Claude, prompts por seccao, fallbacks
- **06-html-template-e-paginas.md** - buildReportHTML, reportPages, CSS
- **07-anexos-referencias-codigo.md** - ficheiros-chave no repositorio

## Variaveis de ambiente (LLM)

- ANTHROPIC_API_KEY - obrigatoria no processo que executa generateReportLLM (servidor Express em dev carrega env via server/).

## Referencia rapida de ficheiros

- Botao e handler: src/components/report/ExportReportButton.tsx
- Montagem de payload: src/components/report/reportDataBuilder.ts (buildReportData)
- Cliente HTTP ao LLM: src/lib/reportApi.ts (callGenerateReportAPI)
- Handler HTTP: app/api/generate-report/route.ts (POST)
- Motor LLM: src/lib/report-llm.ts (generateReportLLM)
- HTML do relatorio: src/components/report/ReportTemplate.tsx e reportPages.ts
- Uso no drawer: src/components/map/RelatorioCompleto.tsx (ExportReportButton)