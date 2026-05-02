import Anthropic from '@anthropic-ai/sdk'
import type {
  ReportData,
  SumarioLLM,
  TerritorioLLM,
  MercadoLLM,
  FiscalLLM,
  RiscoLLM,
  OportunidadeLLM,
  ReportLLMResult,
} from './reportTypes'
import type { ReportLang } from './reportLang'
import { isSemFonteOficialReservaProducaoGlobal } from './reportFonteResProd'
import { formatGuStatus } from './formatters/regulatorio'
import { infraestruturaComOperacaoDeclarada } from './processoStatus'
import { nzFmt } from '../components/report/reportHtmlUtils'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `Você é o motor de texto do TERRADAR, uma plataforma de inteligência mineral.
Gere APENAS o JSON solicitado, sem markdown, sem preâmbulo, sem explicação.

REGRAS ABSOLUTAS:

1. TOM: analítico, factual, conciso. Escreva como um analista técnico escrevendo para outro analista técnico. EVITE linguagem de pitch de venda ("robust fundamentals", "oportunidade única", "momentum acelerado"). EVITE adjetivos inflamados ("excepcional", "expressivo", "robusto", "sólido", "favorável em todos os aspectos").

2. SIGILO METODOLÓGICO — PROTEÇÃO DE PROPRIEDADE INTELECTUAL:
   - PDF EXTERNO (DESTINATÁRIO CLIENTE): A saída alimenta relatório exportável. A matemática interna do motor S31 é confidencial — PROIBIDO revelar estrutura de ponderação, pesos percentuais por componente, valores ponderados individuais por linha, fórmulas do tipo "A × 0,25" ou "12,45 pontos", ou qualquer tabela mental linha-a-linha do motor.
   - PERMITIDO no PDF: agregados por dimensão já fornecidos no prompt (Risk Score total, valores por dimensão Geológico/Ambiental/Social/Regulatório e OS), rótulos qualitativos (Alto, Muito alto, Favorável), e fatos concretos nomeados quando constarem em \`subfatores_contexto\` ou camadas (ex.: sítio arqueológico, RESEX, multiplicador de bioma descritivo, conflitos CPT com ordens de grandeza públicas), desde que como prosa — não como coluna de cálculo.
   - NUNCA revelar pesos, percentuais de ponderação, fórmulas, thresholds ou faixas de classificação do Risk Score ou Opportunity Score.
   - NUNCA escrever frases como "peso X%", "alíquota X% × valor", "faixa 0-39 baixo", "solidez calculada como (100 − RS)".
   - NUNCA expor cálculos aritméticos internos de subfatores.
   - NUNCA usar o termo "subfator". Use "componente", "aspecto" ou o nome descritivo.
   - PERMITIDO: descrever O QUE cada dimensão avalia conceitualmente.
     Exemplo OK: "A dimensão ambiental avalia exposição do processo a restrições territoriais e proximidade de áreas sensíveis."
     Exemplo PROIBIDO: "A dimensão ambiental tem peso 30% no Risk Score, calculada sobre sobreposições com UC e aquíferos."
   - PERMITIDO: comentar o RESULTADO qualitativo.
     Exemplo OK: "A proximidade à ferrovia EFVM (2,4 km) contribui favoravelmente para a viabilidade operacional."
     Exemplo PROIBIDO: "A proximidade à ferrovia EFVM gera 13,5 pontos com peso 15%."
   - Use sempre "desenvolvidos e calibrados com dados públicos" + "propriedade intelectual do TERRADAR".

3. PONTUAÇÃO E ORTOGRAFIA: Português brasileiro correto, vírgula decimal (R$ 4.862,71), NUNCA usar travessão (em dash). Use vírgula, ponto ou parênteses.

4. ZERO INVENÇÃO — REGRAS DE NÃO-ESPECULAÇÃO:
   a) NUNCA inventar dados sobre o processo. Use APENAS os fornecidos no user prompt.
   b) NUNCA especular sobre tendências de mercado global (inflação, geopolítica, safe-haven, política monetária, demanda estrutural). Se o master_substancias tiver um campo "tendência" com rótulo ("Alta"/"Baixa"/"Estável"), você pode citar ESSE rótulo; mas não teorizar os motivos.
   c) NUNCA projetar receitas, CFEM anual estimada, arrecadação futura, ou qualquer valor monetário que não seja dado factual histórico do processo.
   d) NUNCA afirmar "could reach", "poderá chegar", "tem potencial de gerar X milhões" sobre valores monetários futuros. Se for preciso mencionar magnitude, diga apenas "o potencial teórico bruto do depósito está estimado com premissas fixas de cubagem".
   e) PERMITIDO: comentar que a alíquota CFEM aplicável é X% do faturamento de lavra realizada (dado factual regulatório, não projeção).

5. IDIOMA: Este prompt responde em português brasileiro.

6. REFERÊNCIAS CRUZADAS: implicações no bloco "leitura integrada" devem cruzar dimensões (ex: CAPAG municipal frágil + infraestrutura logística boa → "capacidade municipal limitada para contrapartidas, mitigada por infraestrutura existente").

7. COMPRIMENTO: Máximo 3 frases por parágrafo. Evite listas dentro de parágrafos.

   CALLOUTS FINAIS (PDF — páginas 3 Território e 5 Fiscal, molduras / leitura integrada no rodapé da página):
   - Nos JSON solicitados pela API, correspondem principalmente ao campo \`implicacao\` do bloco Território (página 3) e aos campos \`cfem_intro\` e \`implicacao\` do bloco Fiscal (página 5; o callout amarelo costuma ser sobretudo \`implicacao\`).
   - **Território (página 3) — EXTRA-CURTO (layout crítico):** o campo \`implicacao\` aparece sob duas tabelas extensas; DEVE ocupar **exatamente 1 ou 2 frases** e **no máximo 200 caracteres no total**. Um único insight sobre territorialidade; **proibido** repetir valores de sobreposição, distâncias ou infra já listadas nas tabelas acima — só síntese. Se os tetos entrarem em conflito, prevaleça o **limite de 200 caracteres**.
   - OBRIGATÓRIO (demais calouts, ex.: Fiscal): \`Fiscal.implicacao\` — no máximo **3 frases**, **≤60 palavras** e **≤400 caracteres** (tetos do item anterior que não são Território \`implicacao\`; não use o extra-curto de 200 caracteres onde não for Território).
   - \`Fiscal.cfem_intro\`: no máximo **2 frases** curtas (~**≤40 palavras** / **≤220 caracteres**) — síntese de CFEM/dados fiscais, sem paralelismo longo com o parágrafo \`lead\`.
   - Se precisar comprimir: mantenha **um único insight central**, elimine redundâncias com tabelas/camadas da mesma página e não repita listagem já exibida em linhas superiores. Tom técnico-institucional preservado.
   - Esta regra aplica-se a qualquer texto de leitura integrada em formato de «caixa destacada» de baixa altura no layout; para blocos já limitados pelo prompt específico (ex.: página 6/7 em três frases por dimensão), continue no mesmo regime — não encha os callouts 3 e 5 com texto extra além destes tetos.

8. FASE REGULATÓRIA vs ESTADO OPERACIONAL: O campo \`fase\` indica a fase regulatória ANM (Pesquisa, Lavra, Suspensão, etc.), NÃO o estado operacional da mina.
   - Se fase = "Lavra" ou regime contém "Concessão de Lavra": a viabilidade geológica já foi comprovada via relatório aprovado.
     USAR linguagem regulatória: "outorga de lavra concedida", "concessão vigente", "tenure formalmente outorgado", "relatório de pesquisa aprovado".
     NUNCA usar linguagem de validação inicial ("demandam validação em campo", "estudos preliminares", "parâmetros geológicos preliminares").
   - OUTORGA NÃO É OPERAÇÃO. Verificar SEMPRE \`gu_status\`, \`tah_ultimo_pagamento\`, \`inicio_lavra_data\` antes de descrever atividade operacional.
     Se \`gu_status\` = "Sem registro" OU vazio E \`tah_ultimo_pagamento\` = null OU "Sem evento publicado": o processo possui outorga MAS não há evidência de operação ativa.
     NESSE CASO, NUNCA escrever: "em operação", "em fase operacional avançada", "lavra ativa", "produção ativa", "mina em produção", "operação consolidada", "operação em andamento", "extração em curso".
     USAR linguagem permitida: "outorga concedida, operação ainda não iniciada/registrada", "concessão vigente sem GU/TAH cadastrados", "tenure outorgado, sem movimentação operacional registrada", "viabilidade técnica documentada, fase pré-operacional".
   - Se fase = "Pesquisa" ou regime contém "Autorização de Pesquisa": a viabilidade ainda não foi comprovada.
     USAR linguagem de validação ("validação em campo pendente", "parâmetros geológicos preliminares", "estudos complementares").

9. CAPAG PARCIAL (regra mantida da versão anterior): Quando capag_nota = "n.d." MAS existem indicadores individuais (capag_endiv, capag_poupcorr, capag_liquidez com valores numéricos e notas A/B/C):
   - NUNCA dizer "CAPAG não disponível impede análise" ou "ausência de dados CAPAG".
   - SEMPRE citar os indicadores que existem com seus valores e notas.
   - Inferir classificação equivalente: nota final = pior nota entre os indicadores disponíveis.
   - Exemplo correto: "Os indicadores CAPAG parciais revelam endividamento controlado (2,43%, nota A), embora a poupança corrente (96,22%, nota C) sinalize fragilidade na capacidade de investimento municipal."
   - Exemplo ERRADO: "Ausência de dados CAPAG impede análise."

10. REFERÊNCIAS CRUZADAS REGULATÓRIAS (regra mantida): Quando há dados_sei no contexto:
    - No bloco RISCO REGULATÓRIO: citar documentos específicos com datas. Quando "Pendências regulatórias ATIVAS" listar itens, listar cada um com tipo e gravidade; NÃO omitir.
    - No bloco LEITURA INTEGRADA: usar "regularidade documental completa" APENAS se TODAS forem verdadeiras: (a) nenhuma pendência ativa, (b) alvará vigente, (c) GU vigente ou não requerida pela fase, (d) TAH pago recentemente.
    - Se qualquer condição falhar, use linguagem contextual específica: "regularidade parcial com pendências abertas", "alvará vencido há X anos", "GU vencida e não renovada".
    - Pendências ativas DEVEM aparecer como fator NEGATIVO na segurança do investimento.
    - NUNCA dizer "regularidade documental completa" com pendências listadas.

11. VALORES AUSENTES (N/D) (regra mantida): Quando um valor vier como "N/D":
    - NÃO inventar número. Use frase neutra: "Risk Score indisponível", "dados fiscais não disponíveis".
    - Nunca escrever "Risk Score 0" ou similar.
    - Melhor dizer que falta dado do que inventar.

12. VALOR IN-SITU E CFEM ESTIMADA — REGRA NOVA:
    - Quando mencionar valor do depósito, use EXCLUSIVAMENTE a expressão "potencial teórico bruto" ou "estimativa indicativa".
    - NUNCA use "valor da reserva", "reservas comprovadas", "estimativa de receita", "projeção de CFEM", "CFEM anual", "arrecadação projetada".
    - Se o dado de entrada tiver CFEM monetária, IGNORE o número. Mencione apenas a alíquota (% regulatório, dado factual) e diga que "a CFEM é devida sobre o faturamento de lavra realizada" — sem cifras projetadas.
    - O potencial teórico bruto é ordem de grandeza derivada de premissas fixas (cubagem universal, teor médio, preço spot). Deixe isso claro quando for citado: "ordem de grandeza com premissas TERRADAR".

13. GLOSSÁRIO DE DIMENSÕES — NOMES FIXOS:
    - Risk Score tem EXATAMENTE 4 dimensões: Geológico, Ambiental, Social, Regulatório.
    - Opportunity Score tem EXATAMENTE 3 dimensões: Atratividade de mercado, Viabilidade operacional, Segurança do investimento.
    - NUNCA misture nomes (ex: "geological viability" é ERRADO — geológico é RS, viabilidade é OS).
    - NUNCA crie dimensões novas (ex: "resilience", "ESG score", "market position" não existem).
    - Ao citar uma dimensão, use APENAS seu nome exato. NUNCA qualifique score de uma dimensão com adjetivos do score de outra.

14. PARALELISMO PT/EN: Este prompt gera em PT. O prompt EN paralelo deve gerar conteúdo conceitualmente IDÊNTICO (mesmos fatos, mesmas implicações, mesmas ênfases) — apenas traduzido. Evite "liberdade criativa" que divirja da narrativa PT: não adicione fatos novos no EN, não remova pontos de atenção.

15. ANTI-ESPECULAÇÃO MACRO: PROIBIDO afirmar tendências, dinâmicas ou fundamentos macroeconômicos que não estejam EXPLICITAMENTE no contexto fornecido.
    LISTA NEGRA — frases proibidas em qualquer narrativa (mesmo parafraseadas):
    - "demanda global mantém trajetória ascendente"
    - "demanda global robusta/sustentada/resiliente"
    - "fundamentos estruturais do setor"
    - "fatores estruturais sustentam"
    - "pressões inflacionárias"
    - "ativo de proteção / safe-haven / reserva de valor"
    - "ciclo favorável da commodity"
    - "momento estrutural do mercado"
    - "fluxos de portfólio de investimento"
    - "demanda por aplicações industriais e portfólios de investimento"
    PERMITIDO citar APENAS:
    - Dados numéricos do contexto (var_12m_pct, cagr_5a_pct, reservas/produção BR)
    - Rótulo qualitativo de tendência fornecido (\`mercado_tendencia\`: Alta/Baixa/Estável)
    - Aplicações se constarem em \`aplicacoes_usgs\` do master
    Se faltar dado, escrever: "tendência de preço classificada como [X] no master TERRADAR" e PARAR. Não inventar narrativa de demanda.
`

/** Prompt paralelo em EN (US), tom mineração institucional — mesmas regras de PI que o PT. */
const SYSTEM_PROMPT_EN = `You are the text engine of TERRADAR, a mineral intelligence platform writing for institutional investors.
Output ONLY the JSON requested, with no markdown, preamble, or explanation.

LANGUAGE RULE (highest priority):
- Respond in PROFESSIONAL US ENGLISH. Use precise mining industry terminology.
- Do NOT include any Portuguese text in your response, EXCEPT for:
  - Proper nouns that are official in Portuguese (company names; municipality names such as "Caeté/MG"; state program names; BNDES line names).
  - Direct quotations from Brazilian regulation (append the English translation in parentheses).
- The data blocks supplied below are labeled in Portuguese (fase, regime, CAPAG, etc.). Read them, but produce English output only.

CLASSIFICATION LABEL MAPPING (use exactly these equivalences):
  - "Alta" / "Em alta"            → "Rising" (price trend) or "High" (risk/score level)
  - "Baixa" / "Em baixa"          → "Falling" (trend) or "Low" (level)
  - "Muito baixo(a)"              → "Very low"
  - "Muito alto(a)"               → "Very high"
  - "Moderado(a)"                 → "Moderate"
  - "Favorável"                   → "Favorable"
  - "Muito favorável"             → "Very favorable"
  - "Desfavorável"                → "Unfavorable"
  - "Conservador"                 → "Conservative"
  - "Arrojado"                    → "Aggressive"
  - "Pesquisa" (fase)             → "Exploration"
  - "Lavra" (fase)                → "Mining" (NEVER "Production" — Lavra is the regulatory tenure stage, not active operation)
  - "Concessão de Lavra" (regime) → "Mining concession" (tenure type)
  - "Autorização de Pesquisa"     → "Exploration permit"

DIMENSION NAME DICTIONARY (mandatory — never mix):
  - Risk Score dimensions: "Geologic", "Environmental", "Social", "Regulatory"
  - Opportunity Score dimensions: "Market appeal", "Operational viability", "Investment security"

ABSOLUTE RULES:

1. TONE: analytical, factual, concise. Write as a technical analyst writing for another technical analyst. AVOID sales-pitch language ("robust fundamentals", "exceptional opportunity"). AVOID inflated adjectives ("outstanding", "significant", "strong", "solid", "favorable across all dimensions").

2. METHODOLOGICAL SECRECY — INTELLECTUAL PROPERTY PROTECTION:
   - NEVER disclose weights, weighting percentages, formulas, thresholds, or classification bands of Risk Score or Opportunity Score.
   - NEVER write phrases like "weight X%", "rate X% × value", "band 0-39 low", "solidity = (100 − RS)".
   - NEVER expose internal arithmetic of subfactors.
   - NEVER use the term "subfactor" in English output. Use "component", "aspect", or the descriptive name.
   - ALLOWED: describe WHAT each dimension evaluates conceptually.
     OK: "The Environmental dimension evaluates process exposure to territorial restrictions and proximity to sensitive areas."
     FORBIDDEN: "The Environmental dimension has 30% weight in Risk Score, computed over overlaps with protected areas and aquifers."
   - ALLOWED: comment on the qualitative RESULT.
     OK: "Proximity to the EFVM railway (2.4 km) contributes favorably to Operational viability."
     FORBIDDEN: "Proximity to EFVM railway generates 13.5 points with 15% weight."
   - Always use "developed and calibrated with public data" + "intellectual property of TERRADAR".

3. PUNCTUATION AND SPELLING: US English. Decimal point (USD 4,862.71). NEVER use em dashes; use commas or periods.

4. ZERO FABRICATION — NON-SPECULATION RULES:
   a) NEVER invent data about the process. Use ONLY what is provided.
   b) NEVER speculate on global market trends (inflation, geopolitics, safe-haven flows, monetary policy, structural demand). If master_substancias has a "trend" label ("Rising"/"Falling"/"Stable"), you may cite THAT label; do not theorize causes.
   c) NEVER project future revenues, estimated annual CFEM, fabricated fiscal contributions, or any forward-looking monetary figure.
   d) NEVER write "could reach", "estimated to generate X millions", "projected revenues" about future monetary values. If you must mention magnitude, say only "the theoretical gross potential of the deposit is estimated with fixed cubage assumptions".
   e) ALLOWED: state the applicable CFEM rate (X% of realized mining revenue — factual regulatory data, not projection).

5. CROSS-REFERENCES: implications in the "integrated read" must cross dimensions (e.g., weak municipal CAPAG + strong logistics → "limited municipal capacity for co-investment, partially mitigated by existing infrastructure").

6. LENGTH: Maximum 3 sentences per paragraph. Avoid lists inside prose.

   FINAL CALLOUTS (PDF — Pages 3 Territory and 5 Fiscal, highlighted integrated-read bands near bottom of fixed pages):
   - In the Territory JSON payload, field \`implicacao\` (page 3); in the Fiscal payload, fields \`cfem_intro\` and \`implicacao\` (page 5; the footer-style box is usually dominated by \`implicacao\`).
   - **Territory (page 3) — ULTRA-SHORT (layout constraint):** \`implicacao\` sits under two large tables; it MUST be **exactly 1–2 sentences** and **≤200 characters total**. One core insight on territoriality; do **not** repeat overlaps, distances, or infrastructure already tabulated above. If rules conflict, **200 characters** wins.
   - MANDATORY for **Fiscal** \`implicacao\` (and other callouts not covered above): **at most 3 sentences**, **≤60 words**, **≤400 characters** — do not apply the 200-character cap to Fiscal unless needed for wrapping.
   - \`fiscal.cfem_intro\`: at most **2 short sentences** (~**≤40 words** / **≤220 characters**) — a tight CFEM/fiscal synopsis, no long parallelism with \`lead\`.
   - If tightening: keep **one core insight**, cut redundancy vs tables/layers on the same page, do not relist data already rendered above — tone stays institutional and technical.

7. REGULATORY PHASE vs OPERATIONAL STATE: The \`fase\` field is the ANM regulatory phase (Pesquisa = Exploration, Lavra = Mining tenure stage, etc.), NOT the operational state of the mine.
   - If fase = "Lavra" or tenure includes "Concessão de Lavra": geological viability is proven via approved exploration report.
     USE regulatory language: "mining concession granted", "tenure formally awarded", "approved exploration report".
     NEVER use early-validation language ("requires field validation", "preliminary parameters").
   - TENURE IS NOT OPERATION. ALWAYS check \`gu_status\`, \`tah_ultimo_pagamento\`, \`inicio_lavra_data\` before describing operational activity.
     If \`gu_status\` = "Sem registro" OR empty AND \`tah_ultimo_pagamento\` = null OR "Sem evento publicado": the process holds tenure BUT there is no evidence of active operation.
     IN THAT CASE, NEVER write: "in operation", "in advanced operational phase", "active mining", "active production", "production-phase", "producing mine", "operational maturity", "consolidated operation", "ongoing extraction".
     USE allowed language: "tenure granted, operation not yet initiated/recorded", "concession in force without GU/TAH on file", "tenure awarded, no operational activity recorded", "technical viability documented, pre-operational stage".
   - If fase = "Pesquisa" or tenure includes "Autorização de Pesquisa": viability not yet proven.
     USE field-validation language.

8. PARTIAL CAPAG: When capag_nota is "n.d." but individual indicators exist:
   - NEVER say CAPAG is unavailable.
   - Cite indicators with their values and letter grades.
   - Infer the equivalent rating from the worst letter.
   - OK: "Partial CAPAG indicators show controlled debt (2.43%, grade A) but constrained current savings (96.22%, grade C), indicating limited fiscal capacity for municipal co-investment."
   - WRONG: "Absence of CAPAG data prevents analysis."

9. REGULATORY CROSS-REFERENCES:
    - In REGULATORY RISK: cite documents with dates. When "Pendências regulatórias ATIVAS" lists items, list each with type and severity; do NOT omit.
    - In INTEGRATED READING: use "full documentary regularity" ONLY if ALL: (a) no pending items, (b) permit valid, (c) GU valid or not required for phase, (d) TAH recently paid.
    - If any fails, use contextual language: "partial regularity with open items", "permit expired N years ago", "GU lapsed and not renewed".
    - Pending items MUST appear as negative factor in INVESTMENT SECURITY.
    - NEVER say "full documentary regularity" when there are items in "Pendências regulatórias ATIVAS".

10. MISSING VALUES (N/D): When a value comes as "N/D":
    - DO NOT invent a number. Use neutral phrasing: "Risk Score unavailable", "Opportunity Score not calculated", "fiscal data unavailable".
    - Never write "Risk Score 0" or estimate.

11. IN-SITU VALUE AND CFEM ESTIMATE — NEW RULE:
    - When mentioning deposit value, use EXCLUSIVELY "theoretical gross potential" or "indicative estimate".
    - NEVER use "reserve value", "proven reserves" (quantified), "revenue estimate", "projected CFEM", "annual CFEM", "projected collection".
    - If input data contains monetary CFEM figures, IGNORE the number. Mention only the applicable rate (regulatory %, factual) and note "CFEM is due on realized mining revenue" — no projected figures.
    - Theoretical gross potential is an order-of-magnitude derived from fixed assumptions (universal cubage, master grade, spot price). State this when citing it: "order-of-magnitude under TERRADAR assumptions".

12. DIMENSION GLOSSARY — FIXED NAMES:
    - Risk Score has EXACTLY 4 dimensions: Geologic, Environmental, Social, Regulatory.
    - Opportunity Score has EXACTLY 3 dimensions: Market appeal, Operational viability, Investment security.
    - NEVER mix names (e.g., "geological viability" is WRONG — Geologic is RS, Viability is OS).
    - NEVER create new dimensions (e.g., "resilience", "ESG score", "market position").
    - When citing a dimension, use ONLY its exact name. NEVER qualify a score of one dimension with adjectives of another.

13. PT/EN PARALLELISM: This prompt generates in EN. The parallel PT prompt must generate conceptually IDENTICAL content (same facts, same implications, same emphases) — only translated. Avoid "creative liberty" that diverges: do not add new facts in EN, do not remove concerns.

14. ANTI-MACRO-SPECULATION: FORBIDDEN to assert macroeconomic trends, dynamics, or fundamentals not EXPLICITLY in the provided context.
    BLACKLIST — forbidden phrases in any narrative (even paraphrased):
    - "global demand remains/maintains [robust/strong/resilient/rising]"
    - "structural demand from industrial applications and investment portfolios"
    - "structural fundamentals of the sector"
    - "structural factors support/sustain"
    - "inflationary pressures"
    - "safe-haven / store of value / hedge asset"
    - "favorable commodity cycle"
    - "structural market moment"
    - "investment portfolio flows"
    - "demand from both industrial applications and investment portfolios"
    PERMITTED to cite ONLY:
    - Numerical data from context (var_12m_pct, cagr_5a_pct, BR reserves/production)
    - Qualitative trend label provided (\`mercado_tendencia\`: Rising/Falling/Stable)
    - Applications if listed in \`aplicacoes_usgs\` from master
    If data is missing, write: "price trend classified as [X] in TERRADAR master" and STOP. Do not invent demand narrative.
`

function systemPromptForLang(lang: ReportLang): string {
  return lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT
}

/**
 * Prefixo imperativo de idioma aplicado a cada user prompt. Reforça a instrução do system
 * prompt mesmo quando o corpo do user prompt está em PT (labels de dados). Crítico para EN:
 * sem este reforço o Claude tende a espelhar o idioma do user prompt.
 */
function langUserPrefix(lang: ReportLang): string {
  if (lang === 'en') {
    return `[LANGUAGE=EN-US] RESPOND EXCLUSIVELY IN US ENGLISH.
The data labels below are in Portuguese for internal compatibility, but ALL prose, headlines,
labels, ratings, and analysis you emit MUST be in professional English. Preserve only proper
nouns (company, municipality, program, and BNDES line names) in Portuguese.

`
  }
  return ''
}

type CptHintForValidation = {
  qtd_total?: number
  nivel?: string
  categorias_causou?: string[]
}

function extrairCptHintMeta(d: ReportData): CptHintForValidation | null {
  const c = d.subfatores_contexto
  if (!c) return null
  const chunks: string[] = []
  const h = c.conflitos_cpt_hint
  if (typeof h === 'string' && h.trim()) chunks.push(h)
  for (const item of c.riscoPorDim?.social ?? []) {
    const t = item.texto?.trim()
    if (t) chunks.push(t)
  }
  const blob = chunks.join('\n')
  if (!blob.trim()) return null

  let qtd_total: number | undefined
  const m1 = blob.match(/\b(\d{1,3})\s+conflitos?\b/i)
  if (m1) qtd_total = parseInt(m1[1], 10)
  if (qtd_total == null) {
    const m2 = blob.match(
      /\bconflitos?\s+(?:CPT|territoriais)?[^.;\d\n]{0,50}(\d{1,3})\b/i,
    )
    if (m2) qtd_total = parseInt(m2[1], 10)
  }
  if (qtd_total == null) {
    const m3 = blob.match(/\b(\d{1,3})\s+(?:casos?|registros?)\b/i)
    if (m3 && /CPT|territorial/i.test(blob)) qtd_total = parseInt(m3[1], 10)
  }

  let nivel: string | undefined
  const mn = blob.match(/\bn[ií]vel\s+(alto|moderad[oa]|baix[oa])\b/i)
  if (mn) nivel = mn[1].toLowerCase()
  if (!nivel) {
    const mn2 = blob.match(
      /\bCPT[^.;\n]{0,120}\b(alto|moderad[oa]|baix[oa])\b/i,
    )
    if (mn2) nivel = mn2[1].toLowerCase()
  }
  if (!nivel) {
    const mn3 = blob.match(
      /\b(alto|moderad[oa]|baix[oa])\s+(?:nível|nivel)\s+CPT\b/i,
    )
    if (mn3) nivel = mn3[1].toLowerCase()
  }

  const categorias_causou: string[] = []
  if (/minerad/i.test(blob)) categorias_causou.push('Mineradora')

  if (
    qtd_total == null &&
    !nivel &&
    categorias_causou.length === 0
  ) {
    return null
  }
  return {
    qtd_total,
    nivel,
    ...(categorias_causou.length ? { categorias_causou } : {}),
  }
}

const NUM_EXTENSO_EN: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
}

function extensoPtVariants(n: number): string[] {
  const words: Record<number, string> = {
    1: 'um',
    2: 'dois',
    3: 'três',
    4: 'quatro',
    5: 'cinco',
    6: 'seis',
    7: 'sete',
    8: 'oito',
    9: 'nove',
    10: 'dez',
    11: 'onze',
    12: 'doze',
  }
  const w = words[n]
  if (!w) return []
  return w === 'três' ? ['três', 'tres'] : [w]
}

function nivelPresenteNoTexto(
  lower: string,
  nivel: string,
  lang: ReportLang,
): boolean {
  const n = nivel.toLowerCase()
  if (lower.includes(n)) return true
  if (n === 'moderado' || n === 'moderada') {
    if (lower.includes('moderad')) return true
  }
  if (lang !== 'en') return false
  const map: Record<string, string[]> = {
    alto: ['high'],
    moderado: ['moderate'],
    moderada: ['moderate'],
    baixo: ['low'],
    baixa: ['low'],
  }
  for (const alt of map[n] ?? []) {
    if (lower.includes(alt)) return true
  }
  return false
}

function validarDimSocCPT(
  dimSoc: string,
  hint: CptHintForValidation | null,
  lang: ReportLang,
  processo: string,
): void {
  if (
    !hint ||
    hint.qtd_total == null ||
    hint.nivel == null ||
    String(hint.nivel).trim() === ''
  ) {
    return
  }
  const missing: string[] = []
  const text = String(dimSoc ?? '')
  const lower = text.toLowerCase()

  const numLiteral = String(hint.qtd_total)
  const extensoCandidates =
    lang === 'en'
      ? ([NUM_EXTENSO_EN[hint.qtd_total]].filter(Boolean) as string[])
      : extensoPtVariants(hint.qtd_total)
  const hasNum =
    lower.includes(numLiteral) ||
    extensoCandidates.some((w) => lower.includes(w.toLowerCase()))
  if (!hasNum) missing.push('qtd_total')

  if (!nivelPresenteNoTexto(lower, hint.nivel, lang)) {
    missing.push('nivel')
  }

  if (
    Array.isArray(hint.categorias_causou) &&
    hint.categorias_causou.some((c) => /minerad/i.test(c)) &&
    !/minerad|mining companies|mining company/i.test(lower)
  ) {
    missing.push('mineradora')
  }

  if (
    /distância segura|distancia segura|safe distance|embora[^.]{0,120}distant|although[^.]{0,120}distant/i.test(
      text,
    )
  ) {
    missing.push('atenuacao_proibida')
  }

  if (missing.length > 0) {
    console.warn(
      '[CPT] dim_soc não conformidade:',
      missing,
      'processo:',
      processo,
    )
  }
}

type ClaudeCallOptions = {
  retries?: number
  temperature?: number
  max_tokens?: number
}

async function callClaude<T>(
  userPrompt: string,
  system: string,
  lang: ReportLang = 'pt',
  options: ClaudeCallOptions = {},
): Promise<T | null> {
  const retries = options.retries ?? 2
  const maxTokens = options.max_tokens ?? 1000
  const finalUser = langUserPrefix(lang) + userPrompt
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        ...(options.temperature != null
          ? { temperature: options.temperature }
          : {}),
        system,
        messages: [{ role: 'user', content: finalUser }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')

      const clean = textBlock.text.replace(/```json|```/g, '').trim()
      return JSON.parse(clean) as T
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[CLAUDE ERROR] Tentativa ${i + 1}:`, msg)
      if (i >= retries) return null
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  return null
}

/** Subconjunto estruturado para cruzamento fase, CAPAG parcial e SEI nos prompts v2.1. */
/** Bloco JSON qualitativo do motor (sem pesos) — só entra no prompt quando não vazio. */
function jsonSubfatoresContextoLLM(d: ReportData): string {
  const c = d.subfatores_contexto
  if (!c || typeof c !== 'object') return ''
  const s = JSON.stringify(c, null, 2)
  return s === '{}' ? '' : s
}

function jsonContextoLLM(d: ReportData): string {
  return JSON.stringify(
    {
      is_terminal: d.is_terminal,
      bloqueador_constitucional: d.bloqueador_constitucional,
      fase: d.fase_processo ?? d.fase,
      regime: d.regime_display ?? d.regime,
      capag_nota: d.capag_nota,
      capag_nota_final: d.capag_nota_final ?? d.capag_nota,
      capag_endiv: d.capag_endiv,
      capag_endiv_nota: d.capag_endiv_nota,
      capag_poupcorr: d.capag_poupcorr,
      capag_poupcorr_nota: d.capag_poupcorr_nota,
      capag_liquidez: d.capag_liquidez,
      capag_liquidez_nota: d.capag_liquidez_nota,
      idh: d.idh,
      capag_indicadores: d.capag_indicadores ?? null,
      capag_pior_indicador: d.capag_pior_indicador_nome ?? null,
      dados_sei: d.dados_sei ?? null,
    },
    null,
    2,
  )
}

/** Instruções condicionais para PDF: processos extintos e bloqueios constitucionais. Documentado para revisão de prompts (Passo 2 Fix D). */
function blocoInstrucoesTerminalPdf(d: ReportData): string {
  if (!d.is_terminal) return ''
  const b = d.bloqueador_constitucional
  if (b?.tipo === 'TI_REGULARIZADA') {
    return `
CONTEXTO ESPECIAL — PROCESSO TERMINAL COM BLOQUEADOR CONSTITUCIONAL (obrigatório):
Flags: is_terminal=true; bloqueador=TI regularizada sobreposta (${b.nome}).
1) Reconheça que o processo está juridicamente extinto e que a área sobrepõe TI em fase Regularizada.
2) Cite explicitamente o Art. 231, §3º da CF: exploração depende de autorização do Congresso Nacional.
3) NÃO sugira reativação via novo requerimento nem captura de potencial na mesma área. Novo requerimento sobre a mesma área seria indeferido pelo mesmo impedimento.
4) Evite linguagem de oportunidade ativa (monetização, escoamento futuro, desenvolvimento do ativo) para esta área.
`
  }
  if (b?.tipo === 'UC_PROTECAO_INTEGRAL') {
    return `
CONTEXTO ESPECIAL — PROCESSO TERMINAL COM UC DE PROTEÇÃO INTEGRAL SOBREPOSTA (${b.nome}):
Não prometa operação futura na mesma área; não sugira reativação como caminho provável.
`
  }
  return `
CONTEXTO — PROCESSO TERMINAL (is_terminal=true) sem bloqueador constitucional detectado neste relatório:
Pode discutir cenários de novo requerimento apenas com ressalvas e dependência de disponibilidade futura da área.
`
}

/**
 * Regras de narrativa para abas Mercado e Fiscal quando o processo está extinto com bloqueio constitucional.
 * Evita linguagem de projeto ativo, lavra futura ou investimento na mesma área.
 */
function terminalComBloqueadorConstitucional(d: ReportData): boolean {
  return Boolean(d.is_terminal && d.bloqueador_constitucional)
}

/** Quando terminal + bloqueador: nunca citar R$, CFEM monetária ou in-situ nos parágrafos (evita ordem de grandeza errada e contradição jurídica). */
function trechoProibicaoMonetariaNarrativaTerminalBloqueador(): string {
  return `
- PROIBIÇÃO NUMÉRICA (OBRIGATÓRIA nos textos narrativos lead/implicacao de MERCADO e cfem_intro/implicacao de FISCAL): NÃO cite valores monetários (R$, US$, milhões, bilhões), montante de CFEM total ou por ha, receita projetada, valor in-situ por ha, área × taxa, nem qualquer conta que pressupõe operação possível nesta área. Esses valores são premissas de projeto ativo; em processo extinto com bloqueio constitucional geram contradição e expõem o relatório a erros de interpretação ou de ordem de grandeza. Limite-se a expressões qualitativas: «CFEM estimada e incentivos fiscais como contexto regional/setorial», «indicadores de mercado como referência de commodity», sem cifras.

`
}

function blocoNarrativaMercadoFiscalTerminalPdf(d: ReportData): string {
  if (!d.is_terminal) return ''
  const b = d.bloqueador_constitucional
  const nome = b?.nome?.trim() ?? ''
  const nomeRef = nome || 'TI sobreposta'
  if (b?.tipo === 'TI_REGULARIZADA') {
    return `
NARRATIVA OBRIGATÓRIA — MERCADO E FISCAL (processo terminal + TI regularizada «${nomeRef}»):
- MERCADO (campos JSON lead e implicacao): Preço, CAGR, tendência e participação são CONTEXTO SETORIAL da commodity. NÃO sugira oportunidade de investimento, aceleração de projeto, «janela» para desenvolvimento, portfólio aurífero/minerário nem margens operacionais para ESTE processo ou esta área. Inclua frase explícita no tom: indicadores de mercado são apresentados como referência setorial e NÃO se aplicam a este ativo específico, juridicamente extinto e indisponível por bloqueador constitucional (Art. 231, §3º CF). Proibido «projetos em desenvolvimento» ou «momentum» como se valessem para a área bloqueada.
- FISCAL (campos JSON cfem_intro e implicacao): CFEM estimada, incentivos e CAPAG são CONTEXTO REGIONAL OU DE CADASTRO. NÃO prometa «aprovação posterior de lavra», receita futura deste processo, nem que investimentos privados compensem limitações para viabilizar mineração nesta área. Inclua frase explícita: CFEM e incentivos são contexto regional; a área deste processo está indisponível por sobreposição constitucional à TI ${nomeRef}; eventual novo requerimento seria indeferido pelo mesmo fundamento.
${trechoProibicaoMonetariaNarrativaTerminalBloqueador()}`
  }
  if (b?.tipo === 'UC_PROTECAO_INTEGRAL') {
    return `
NARRATIVA OBRIGATÓRIA — MERCADO E FISCAL (processo terminal + UC de proteção integral «${nomeRef}»):
- MERCADO (lead, implicacao): Mercado apenas como contexto setorial; não aplicável a ativo extinto na área sobreposta à UC. Sem linguagem de projeto ou oportunidade para esta área.
- FISCAL (cfem_intro, implicacao): CFEM e incentivos como contexto regional; não projete arrecadação nem investimento para exploração nesta área.
${trechoProibicaoMonetariaNarrativaTerminalBloqueador()}`
  }
  return `
NARRATIVA — MERCADO E FISCAL (processo terminal, sem bloqueador detalhado acima):
- Qualifique preços e CFEM como contexto geral; o processo está extinto. Não prometa desenvolvimento futuro do ativo sem ressalvas claras de indisponibilidade.

`
}

/** Rótulo ANM para âncora nos prompts (reduz alucinação de commodity, ex.: ferro em vez de ouro). */
function substanciaDeclarada(d: ReportData): string {
  const s = String(d.substancia_anm ?? '').trim()
  return s || 'a substância declarada no cadastro ANM'
}

/** UF extraída de `municipio` no formato "Cidade/UF" (cadastro / PDF). */
function ufExtraidaDoMunicipioReport(d: ReportData): string {
  const m = String(d.municipio ?? '').match(/\/([A-Z]{2})\s*$/)
  return m ? m[1] : ''
}

function blocoAncoraLocalizacaoProcesso(d: ReportData): string {
  const uf = ufExtraidaDoMunicipioReport(d)
  const loc =
    uf !== ''
      ? `município ${d.municipio}, UF ${uf}`
      : `município ${d.municipio}`
  return `- LOCALIZAÇÃO DO PROCESSO (ÂNCORA OBRIGATÓRIA): ${loc}.
- PROIBIDO citar outras UFs ou estados que não ${uf !== '' ? `«${uf}» (única UF válida neste processo)` : 'a UF indicada no sufixo Cidade/UF do cadastro ANM'}. NUNCA inferir UF pelo nome do município (ex.: "Minaçu" não é Minas Gerais).
- Quando mencionar incentivos regionais, programas estaduais ou contexto territorial dependente de estado, referir-se APENAS ${uf !== '' ? `ao estado da UF ${uf}` : 'à UF do processo conforme cadastro ANM'}.

`
}

function blocoIdiomaObrigatorio(lang: ReportLang): string {
  if (lang === 'en') {
    return `LANGUAGE (mandatory): English (US). The entire response must be in English. Do not use Portuguese or other languages in prose (e.g. "embora", "contudo", "porém"). Use only English connectors such as "while", "however", "although", "whereas".

`
  }
  return `IDIOMA OBRIGATÓRIO: Português brasileiro. A resposta inteira deve estar em português. PROIBIDO usar palavras em inglês ou outros idiomas em prosa (ex.: "while", "however", "although", "whereas", "though"). Use apenas conectores em português: "embora", "contudo", "porém", "enquanto", "ao passo que", "todavia".

`
}

/**
 * Regras compartilhadas: uma única substância; proibir outras commodities; ferrovia ≠ ferro.
 * Inserir no início dos prompts que geram texto sobre geologia, mercado ou recurso mineral.
 */
function blocoRegraSubstanciaUnica(substancia: string): string {
  return `- SUBSTÂNCIA DO PROCESSO (ÂNCORA OBRIGATÓRIA): «${substancia}». Sempre referenciar apenas esta substância quando falar de minério, commodity, teores, recurso mineral, «target» geológico ou valorização de commodity.
- PROIBIDO: usar nomes de outras commodities (ferro, minério de ferro, cobre, níquel, alumínio, zinco, etc.) — apenas «${substancia}» conforme cadastro ANM.
- NOTA: «ferrovia», «modal ferroviário» e distâncias a trilhos referem-se a INFRAESTRUTURA de transporte, não à commodity ferro.

`
}

function buildPromptSumario(d: ReportData): string {
  const substancia = substanciaDeclarada(d)
  const lang: ReportLang = d.lang ?? 'pt'
  return `${blocoIdiomaObrigatorio(lang)}Dados do processo:
${blocoRegraSubstanciaUnica(substancia)}
- Processo: ${d.processo}, Substância: ${d.substancia_anm}
- Município: ${d.municipio}, Área: ${d.area_ha} ha
- Titular: ${d.titular}, CNPJ: ${d.cnpj}
- Fase: ${d.fase}, Regime: ${d.regime}
- Alvará: ${d.alvara_status}, validade ${d.alvara_validade}
- Risk Score: ${nzFmt(d.risk_score)}/100 (${d.rs_classificacao})
- Opportunity Score: ${nzFmt(d.os_conservador)}/100 (${d.os_classificacao})
- GU: ${formatGuStatus(d.gu_status)} ${d.gu_pendencia}
- Protocolo: ${d.protocolo_anos} anos de tramitação (sempre escrever um espaço entre o número e «anos»)${d.is_terminal ? ' (processo extinto)' : ''}
- is_terminal (cadastro): ${d.is_terminal}
- bloqueador_constitucional: ${d.bloqueador_constitucional ? JSON.stringify(d.bloqueador_constitucional) : 'null'}
${blocoInstrucoesTerminalPdf(d)}
Gere JSON:
{
  "headline": "frase curta resumindo RS+OS+fase, max 15 palavras",
  "lead": "parágrafo 3 frases: processo, titular, alvará, horizonte",
  "veredito_texto": "2 frases explicando o estágio atual",
  "ponto_atencao": "se GU vencida, alertar. Se não, null"
}`
}

function buildPromptTerritorio(d: ReportData): string {
  const substancia = substanciaDeclarada(d)
  const lang: ReportLang = d.lang ?? 'pt'
  const layersText = d.layers
    .map(
      (l) =>
        `${l.tipo}: ${l.nome} ${l.detalhes}, ${l.distancia_km} km, sobreposto: ${l.sobreposto}`,
    )
    .join('\n')
  const infraText = d.infraestrutura
    .map((i) => `${i.tipo}: ${i.nome} ${i.detalhes}, ${i.distancia_km} km`)
    .join('\n')

  return `${blocoIdiomaObrigatorio(lang)}
REGRAS ESPECÍFICAS PARA TERRITÓRIO:

${blocoRegraSubstanciaUnica(substancia)}${blocoAncoraLocalizacaoProcesso(d)}- PROSA vs TABELA: Se as camadas abaixo listarem «Sítio arqueológico» ou «APP hídrica», os campos lead, logistica_texto e implicacao devem estar alinhados a essas linhas (não contradizer a tabela).

Camadas territoriais:
${layersText}

Infraestrutura:
${infraText}

Gere JSON:
{
  "headline": "frase sobre sobreposição (ou ausência), max 12 palavras",
  "lead": "parágrafo descrevendo cruzamento geoespacial realizado",
  "logistica_texto": "1 frase sobre acesso logístico",
  "implicacao": "1 ou 2 frases, máximo 200 caracteres: um insight sobre territorialidade e logística sem repetir tabelas desta página"
}`
}

function buildPromptMercado(d: ReportData): string {
  const substancia = substanciaDeclarada(d)
  const lang: ReportLang = d.lang ?? 'pt'
  const tb = terminalComBloqueadorConstitucional(d)
  const semCtxGlobal = isSemFonteOficialReservaProducaoGlobal(d.fonte_res_prod)
  const linhasResProd = semCtxGlobal
    ? `- Participação Brasil em reservas/produção mundiais: não há fonte oficial comparável publicada para esta substância (exibir no PDF apenas disclaimer, sem percentuais).`
    : `- Reservas Brasil: ${d.reservas_mundiais_pct}% do mundial
- Produção Brasil: ${d.producao_mundial_pct}% do mundial`
  const unidadeLabel = d.preco_unidade_label || 't'
  const precoLinha = unidadeLabel === 'oz'
    ? `- Preço: USD ${d.preco_oz_usd}/oz (R$ ${d.preco_g_brl}/g)`
    : `- Preço: USD ${d.preco_oz_usd}/${unidadeLabel}`
  const linhaCfemPrompt = tb
    ? `- Alíquota CFEM aplicável: ${d.cfem_aliquota_pct}% sobre faturamento de lavra realizada (processo terminal + bloqueador constitucional: NÃO projetar cifras, apenas menção qualitativa da alíquota regulatória)`
    : `- Alíquota CFEM aplicável: ${d.cfem_aliquota_pct}% sobre faturamento da lavra realizada (dado regulatório factual; NÃO projetar valor monetário de CFEM futura)`
  const linhaArea = tb
    ? `- Área do processo: ${d.area_ha} ha (não usar para multiplicar CFEM nem projetar receita nos parágrafos narrativos)`
    : `- Área do processo: ${d.area_ha} ha`
  return `${blocoIdiomaObrigatorio(lang)}${blocoRegraSubstanciaUnica(substancia)}${blocoInstrucoesTerminalPdf(d)}${blocoNarrativaMercadoFiscalTerminalPdf(d)}Dados de mercado da substância ${d.substancia_anm}:
${precoLinha}
- Tendência (rótulo master): ${d.mercado_tendencia}
- Variação 12 meses: ${d.var_12m_pct}%
- CAGR 5 anos: ${d.cagr_5a_pct}%
- Demanda global: ${d.demanda_global_t} t
${linhasResProd}
${linhaCfemPrompt}
${linhaArea}
- is_terminal (cadastro): ${d.is_terminal}
- bloqueador_constitucional: ${d.bloqueador_constitucional ? JSON.stringify(d.bloqueador_constitucional) : 'null'}

Contexto JSON (fase, CAPAG, bloqueio — use para coerência com as regras acima):
${jsonContextoLLM(d)}

Gere JSON:
{
  "headline": "frase sobre tendência de mercado, max 10 palavras",
  "lead": "parágrafo 3 frases: preço, variação, demanda — se is_terminal com bloqueador, seguir NARRATIVA OBRIGATÓRIA acima",
  "implicacao": "3 frases: se processo ativo, atratividade de mercado e menção à alíquota CFEM regulatória (SEM projetar cifras); se terminal+bloqueador, apenas disclaimers qualitativos — SEM cifras e SEM projeção de CFEM"
}`
}

function buildPromptFiscal(d: ReportData): string {
  const lang: ReportLang = d.lang ?? 'pt'
  const fonteDivida = d.divida_fonte
  const regraFonteDivida =
    fonteDivida === 'passivo_nao_circulante'
      ? 'O valor municipal abaixo veio do PASSIVO NÃO CIRCULANTE (SICONFI), não da dívida consolidada CAPAG. Não chame de «dívida consolidada»; use «passivo não circulante» ou «proxy de endividamento».'
      : fonteDivida === 'divida_consolidada'
        ? 'O valor municipal é DÍVIDA CONSOLIDADA (fonte CAPAG/RGF).'
        : 'Sem fonte numérica para endividamento municipal (exibir como indisponível).'

  const substancia = substanciaDeclarada(d)
  const tb = terminalComBloqueadorConstitucional(d)
  const linhaCfemFiscal = tb
    ? `- Alíquota CFEM aplicável: ${d.cfem_aliquota_pct}% sobre faturamento de lavra realizada (terminal + bloqueador: NÃO projetar receita monetária; só contexto regional qualitativo)`
    : `- Alíquota CFEM aplicável: ${d.cfem_aliquota_pct}% (não projetar receita monetária; CFEM depende de lavra realizada)`
  return `${blocoIdiomaObrigatorio(lang)}${blocoRegraSubstanciaUnica(substancia)}${blocoInstrucoesTerminalPdf(d)}${blocoNarrativaMercadoFiscalTerminalPdf(d)}REGRAS ESPECÍFICAS PARA FISCAL:

${blocoAncoraLocalizacaoProcesso(d)}- CAPAG com indicadores parciais: Se capag_nota = "n.d." mas indicadores existem, exibir no campo capag_classificacao_equiv:
  "Indicadores sugerem classificação equivalente a [pior_nota] (determinada pela [nome_do_pior_indicador])"
  em destaque narrativo coerente com os dados (o PDF aplica cor âmbar a esse campo).

- Ano-base: Sempre mencionar o ano-base dos dados CAPAG e o exercício fiscal no lead ou cfem_intro quando fizer sentido.
  Formato de referência: "${d.fiscal_contexto_referencia}"

Contexto JSON (use apenas dados fornecidos):
${jsonContextoLLM(d)}

Dados fiscais do município ${d.municipio}:
- CAPAG: ${d.capag_nota}
- Poupança corrente: ${d.capag_poupcorr} (nota ${d.capag_poupcorr_nota})
- Endividamento: ${d.capag_endiv} (nota ${d.capag_endiv_nota})
- Liquidez: ${d.capag_liquidez} (nota ${d.capag_liquidez_nota})
- Pior indicador (metodologia TERRADAR): ${d.capag_pior_indicador_nome ?? 'n/d'}
- População: ${d.populacao}
- IDH: ${d.idh}
- Receita própria: ${d.receita_propria}
- Endividamento municipal (texto): ${d.divida}
- Fonte do valor (metadado): ${fonteDivida ?? 'null'}
- Regra narrativa: ${regraFonteDivida}
- Dependência transferências: ${d.dependencia_transf}
- Incentivos: ${d.incentivos.programa_estadual}, ${d.incentivos.linhas_bndes} linhas BNDES
${linhaCfemFiscal}
- is_terminal (cadastro): ${d.is_terminal}
- bloqueador_constitucional: ${d.bloqueador_constitucional ? JSON.stringify(d.bloqueador_constitucional) : 'null'}

Gere JSON:
{
  "headline": "frase sobre capacidade fiscal, max 10 palavras",
  "lead": "parágrafo: CAPAG nota, determinante, dívida, dependência",
  "cfem_intro": "1 frase: se is_terminal com bloqueador, CFEM/incentivos só como contexto regional e área indisponível; senão, explicar que a geração de CFEM depende de lavra realizada — SEM projetar cifras monetárias",
  "implicacao": "3 frases: se terminal+bloqueador, seguir NARRATIVA OBRIGATÓRIA (sem prometer lavra nem investimento na área); senão, fiscal não impede lavra e incentivos estão disponíveis — SEM projetar valor monetário de CFEM futura",
  "capag_classificacao_equiv": "se capag parcial com nota n.d., uma linha com classificação equivalente e indicador determinante, senão null"
}`
}

function buildPromptRisco(d: ReportData): string {
  const substancia = substanciaDeclarada(d)
  const lang: ReportLang = d.lang ?? 'pt'
  const layersText = d.layers
    .map((l) => `${l.tipo}: ${l.nome}, ${l.distancia_km} km, sobreposto: ${l.sobreposto}`)
    .join('\n')

  const pendenciasContexto =
    d.pendencias && d.pendencias.length > 0
      ? `- Pendências regulatórias ATIVAS (lista literal, não inferir):\n${d.pendencias.map((p) => `  • ${p}`).join('\n')}`
      : `- Pendências regulatórias ativas: nenhuma`

  return `${blocoIdiomaObrigatorio(lang)}${blocoRegraSubstanciaUnica(substancia)}REGRAS ESPECÍFICAS PARA RISCO:

- RISCO GEOLÓGICO (campo JSON dim_geo): Tratar EXCLUSIVAMENTE o «target» e os parâmetros geológicos relativos a «${substancia}». Proibido exemplificar com outra commodity. Verificar data.fase antes de redigir.
  Se fase = "Lavra": "viabilidade geológica comprovada, risco concentrado na continuidade de teores em profundidade" + mencionar ausência de NI 43-101/JORC se aplicável.
  Se fase = "Pesquisa": "validação em campo pendente, parâmetros geológicos preliminares".

- RISCO SOCIAL: Verificar data.capag_endiv e data.capag_poupcorr.
  Se existirem valores numéricos: citar valores exatos + notas + implicação (ex: "endividamento controlado mas margem fiscal limitada").
  Se TODOS forem null/n.d.: aí sim dizer "dados CAPAG indisponíveis".
  SEMPRE incluir IDH (data.idh) e distância a comunidades tradicionais se disponíveis nas camadas.

${
  lang === 'en'
    ? `
- CPT (TERRITORIAL CONFLICTS — CPT) — TEMPLATE TO FILL:
  Use subfatores_contexto (conflitos_cpt_hint prose + riscoPorDim.social) as the only source.
  If a clear CPT signal exists in that JSON (non-empty conflitos_cpt_hint or social text citing CPT with a count and level):
    The field dim_soc MUST contain, in one of its sentences, this structure (filled with real values, in ENGLISH):
    "The municipality records {qtd_total} territorial conflicts according to CPT, at {nivel} level{qualificador_mineradora}."
    Where:
    - {qtd_total} = literal number from the hint (e.g. "9", "2", "12")
    - {nivel} = English level: map alto→high, moderado→moderate, baixo→low (from the Portuguese hint)
    - {qualificador_mineradora} = if the hint mentions mining companies as causers (e.g. "Mineradora"), add ", including mining companies among the registered causing categories" before the final period; otherwise empty string
    Example (qtd=9, level high, mining as causer): "The municipality records 9 territorial conflicts according to CPT, at high level, including mining companies among the registered causing categories."
    FORBIDDEN in dim_soc:
    - Attenuating adverbs tied to CPT ("only", "although", "however, ... safe distance")
    - Subordinating CPT to distance of Indigenous/Quilombola communities
    - Omitting the numeric quantity
    - Omitting the mining-causer qualification when the hint mentions Mineradora / mining as causer
  If NO such hint exists or the block is empty:
    Single sentence: "CPT data were not identified for the municipality in the analyzed period."
`
    : `
- CPT (CONFLITOS TERRITORIAIS) — TEMPLATE A PREENCHER:
  Use apenas o JSON de subfatores_contexto (conflitos_cpt_hint em prosa e, se útil, riscoPorDim.social) como fonte.
  Se existir sinal CPT claro nesse JSON (conflitos_cpt_hint não vazio ou texto social citando CPT com quantidade e nível):
    O campo dim_soc DEVE conter, em uma das suas frases, a seguinte estrutura textual (preenchida com os valores reais):

    "O município registra {qtd_total} conflitos territoriais segundo a CPT, em nível {nivel}{qualificador_mineradora}."

    Onde:
    - {qtd_total} = número literal extraído do hint (ex.: "9", "2", "12")
    - {nivel} = string literal do hint ("alto", "moderado" ou "baixo")
    - {qualificador_mineradora} = se "Mineradora" (ou equivalente claro na prosa) estiver entre causadores, adicionar ", incluindo Mineradora entre os causadores registrados" antes do ponto final. Caso contrário, string vazia.

    Exemplo (qtd=9, nivel=alto, com Mineradora entre causadores):
    "O município registra 9 conflitos territoriais segundo a CPT, em nível alto, incluindo Mineradora entre os causadores registrados."

    PROIBIDO no campo dim_soc:
    - Usar advérbios atenuantes ligados a CPT ("apenas", "embora", "contudo, ...distância segura")
    - Subordinar CPT à distância de TI/Quilombola (ex.: "embora as comunidades estejam distantes")
    - Omitir o quantitativo numérico
    - Omitir a qualificação "Mineradora" quando ela está no hint

  Se o hint NÃO existir ou estiver vazio:
    Frase única: "Dados CPT não foram identificados para o município no período analisado."
`
}

- SÍTIOS ARQUEOLÓGICOS — REGRA OBRIGATÓRIA:
  Se subfatores_contexto.sitios_arqueologicos existir como lista não vazia:
    OBRIGATÓRIO mencionar em dim_amb (distância ou proximidade se constar na prosa do contexto).
    NUNCA mencionar pela primeira vez só na "leitura integrada" sem preparar em dim_amb.

- RISCO REGULATÓRIO: Verificar data.dados_sei.
  Se portaria + licença + certidão existem e estão vigentes: "arcabouço regulatório completo".
  Citar datas específicas dos documentos.
  Mencionar plano de fechamento de mina se existir.

- LEITURA INTEGRADA:
  Se fase = "Lavra" E documentação completa: "regularidade documental completa" (nunca "condicionada à resolução de questões pendentes").
  Se fase = "Pesquisa": "condicionada à confirmação dos parâmetros geológicos".

Contexto JSON (cruzamento fase, CAPAG, SEI):
${jsonContextoLLM(d)}
${blocoInstrucoesTerminalPdf(d)}
${
  jsonSubfatoresContextoLLM(d)
    ? `
CONTEXTO RICO DO MOTOR (subaspectos — use para citar fatos nomeados e geografia; NUNCA exponha matemática, pesos, fórmulas nem valores ponderados por linha; não copie como tabela):
${jsonSubfatoresContextoLLM(d)}
`
    : ''
}
Dados de risco do processo ${d.processo}:
- Substância mineral (única válida para dim_geo e menções a recurso/target): ${substancia}
- Risk Score total: ${nzFmt(d.risk_score)}/100 (${d.rs_classificacao})
- Geológico: ${d.rs_geo.label}
- Ambiental: ${d.rs_amb.label}
- Social: ${d.rs_soc.label}
- Regulatório: ${d.rs_reg.label}
- Fase: ${d.fase}, Regime: ${d.regime}, Alvará (situação derivada da validade): ${d.alvara_status} — validade: ${d.alvara_validade}
- GU: ${formatGuStatus(d.gu_status)}
- CAPAG: ${d.capag_nota}
${pendenciasContexto}
- Camadas territoriais:
${layersText}

Gere JSON:
{
  "headline": "frase: risco X, principal incerteza Y",
  "lead": "1 frase sobre as 4 dimensões + score obtido",
  "dim_geo": "3 frases: incerteza geológica e target apenas em «${substancia}»; teores e continuidade — sem citar outras commodities",
  "dim_amb": "3 frases: sobreposição, aquífero, sítios arqueológicos ou APP quando constarem no contexto rico ou nas camadas, diferencial",
  "dim_soc": "3 frases: incluir OBRIGATORIAMENTE a frase CPT no template acima (quantitativo + nível + Mineradora se no hint); depois IDH; comunidades tradicionais por distância nas camadas; CAPAG. CPT e distância de TI/Quilombola são sinais independentes",
  "dim_reg": "3 frases: despacho recente, alvará, pendência GU",
  "leitura": "3 frases: perfil dominado por X, nenhum impeditivo, tendência"
}
REGRA: NUNCA mencionar pesos numéricos dos sub-scores. Quando o bloco de contexto rico existir, integre pelo menos 2–3 fatos específicos (nomes de áreas, sítios, bioma, CPT, documentos) na dim_amb/dim_soc/dim_geo quando aplicável, sem aritmética.`
}

function buildPromptOportunidade(d: ReportData): string {
  const lang: ReportLang = d.lang ?? 'pt'
  const infraOp = infraestruturaComOperacaoDeclarada(d.infraestrutura)
  const ferroviaOperacional = infraOp.find((i) => i.tipo === 'Ferrovia')
  const ferroviaLinhaPrompt =
    ferroviaOperacional != null
      ? `${ferroviaOperacional.distancia_km} km`
      : 'N/A (sem trecho ferroviário em operação próximo; projetos só em estudo não contam como proximidade logística efetiva)'

  const substancia = substanciaDeclarada(d)
  const tb = terminalComBloqueadorConstitucional(d)

  const pendenciasContexto =
    d.pendencias && d.pendencias.length > 0
      ? `- Pendências regulatórias ATIVAS (lista literal):\n${d.pendencias.map((p) => `  • ${p}`).join('\n')}`
      : `- Pendências regulatórias ativas: nenhuma`

  return `${blocoIdiomaObrigatorio(lang)}REGRAS ESPECÍFICAS PARA OPORTUNIDADE:

${blocoRegraSubstanciaUnica(substancia)}${blocoAncoraLocalizacaoProcesso(d)}- ATRATIVIDADE DE MERCADO (campo JSON dim_merc): narrar APENAS o mercado de «${substancia}» (preço, demanda, gap reserva-produção). Adaptar a gramática («mercado de ${substancia}», etc.).

- SEGURANÇA DO INVESTIMENTO: Verificar data.capag_endiv e data.capag_poupcorr.
  Se existirem indicadores parciais: "indicadores CAPAG parciais (endividamento nota X, poupança corrente nota Y) indicam município com dívida controlada mas margem fiscal limitada para investimentos em infraestrutura de apoio."
  Se portaria/licença/certidão vigentes em dados_sei: citar como "confirmação de conformidade plena com o marco regulatório ANM".
  NUNCA "ausência de dados CAPAG" se indicadores parciais existirem.

- SÍNTESE RS×OS:
  Se indicadores CAPAG parciais existirem: "classificação CAPAG equivalente a [pior_nota], com endividamento controlado mas capacidade de investimento municipal restrita."
  NUNCA repetir "ausência de dados CAPAG" se já citou indicadores na segurança.

Contexto JSON:
${jsonContextoLLM(d)}
${blocoInstrucoesTerminalPdf(d)}
${
  jsonSubfatoresContextoLLM(d)
    ? `
CONTEXTO RICO DO MOTOR (oportunidade — subaspectos e penalidades; use para prosa concreta; PROIBIDO pesos, fórmulas e valores ponderados por linha):
${jsonSubfatoresContextoLLM(d)}
`
    : ''
}
${tb
    ? `
SÍNTESE E HEADLINE — PROCESSO TERMINAL + BLOQUEADOR CONSTITUCIONAL:
- Nos campos headline, lead, sintese_p1, sintese_p2 e sintese_marcos: NÃO qualifique o Opportunity Score como «favorável», «atrativo», «robusto», «sólido» nem «fundamentos sólidos» quando o processo está extinto ou o OS aparece como referência técnica / N/A / Terminal. O rótulo atual do OS neste relatório: «${d.os_classificacao}».
- Prefira linguagem neutra: «Opportunity Score de ${nzFmt(d.os_conservador)}/100 como referência metodológica da plataforma», «OS materialmente neutralizado pelo bloqueio constitucional», ou «cruzamento RS×OS apenas como leitura técnica, sem viabilidade operacional na área».
- PROIBIDO contradizer o painel: não descrever OS como «favorável» se a classificação indica terminal ou indisponibilidade.

`
    : ''}
Dados de oportunidade do processo ${d.processo}:
- Substância mineral (única válida para narrativa de mercado): ${substancia}
- OS Conservador: ${nzFmt(d.os_conservador)}/100
- OS Moderado: ${nzFmt(d.os_moderado)}/100
- OS Arrojado: ${nzFmt(d.os_arrojado)}/100
- Classificação: ${d.os_classificacao}
- Atratividade de mercado: ${d.os_merc.label}
- Viabilidade operacional: ${d.os_viab.label}
- Segurança do investimento: ${d.os_seg.label}
- Risk Score: ${nzFmt(d.risk_score)} (${d.rs_classificacao})
- Variação preço 12m (referente à substância ${substancia}): ${d.var_12m_pct}%
- Distância ao modal ferroviário em operação — apenas logística (não confundir com commodity; exclui categoria "Estudo"): ${ferroviaLinhaPrompt}
- CAPAG: ${d.capag_nota}
${pendenciasContexto}
- Fase: ${d.fase}, Regime: ${d.regime}

Gere JSON:
{
  "headline": "frase: oportunidade X sustentada por Y",
  "lead": "1 frase: OS avalia potencial em 3 dimensões",
  "dim_merc": "3 frases: valorização, demanda, gap reserva-produção — sempre em relação ao mercado de ${substancia} apenas",
  "dim_viab": "3 frases: logística, área, fatores limitantes + incentivos",
  "dim_seg": "3 frases: baixo risco, regularidade, pendência GU",
  "sintese_p1": "3 frases: cruzamento RS x OS, fundamentos + risco territorial",
  "sintese_p2": "2 frases: fatores transitórios, tendência",
  "sintese_marcos": "1 frase: próximos marcos de valorização"
}
REGRA: ${tb ? 'Para este processo, linguagem NEUTRA sobre o OS (não «favorável» nem «sólido»). ' : 'Labels OS = "Favorável" (não "Moderada") quando o processo NÃO for terminal com bloqueador. '}NUNCA mencionar pesos. Quando o contexto rico existir, cite tendência de preço, logística, regime/outorga ou fatores nomeados do JSON sem inventar percentuais de ponderação.`
}

function textoSugereReativacaoInadequadaTerminal(s: string): boolean {
  const t = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return /novo requerimento|reativa|captura do potencial|monetiz|escoamento futuro|potencial identificado|marco inicial para captura|fator transitorio|transit.rio que pode ser revertido|mediante nova solicita|nova solicita/.test(
    t,
  )
}

function precisaFallbackTerminalBloqueador(
  d: ReportData,
  r: ReportLLMResult,
): boolean {
  if (!d.is_terminal || !d.bloqueador_constitucional) return false
  const blob = [
    r.sumario.lead,
    r.sumario.veredito_texto,
    r.risco.leitura,
    r.oportunidade.headline,
    r.oportunidade.lead,
    r.oportunidade.sintese_p1,
    r.oportunidade.dim_viab,
  ].join('\n')
  return textoSugereReativacaoInadequadaTerminal(blob)
}

function aplicarFallbackTerminalBloqueador(
  d: ReportData,
  r: ReportLLMResult,
): ReportLLMResult {
  const b = d.bloqueador_constitucional
  const en = d.lang === 'en'
  const nome = b?.nome?.trim() ?? ''
  const ti =
    b?.tipo === 'TI_REGULARIZADA'
      ? en
        ? `regularized Indigenous Land (${nome})`
        : `terra indígena regularizada (${nome})`
      : b?.tipo === 'UC_PROTECAO_INTEGRAL'
        ? en
          ? `strict protection conservation unit (${nome})`
          : `UC de proteção integral (${nome})`
        : en
          ? 'overlapping protected area'
          : 'área protegida sobreposta'

  return {
    ...r,
    sumario: {
      ...r.sumario,
      headline: en
        ? `Defunct process with constitutional overlap on ${ti}`
        : `Processo extinto com sobreposição constitucional a ${ti}`,
      lead: en
        ? `The ANM record has no active regulatory effects. The area overlaps ${ti}, with a constitutional barrier to mineral exploitation (Art. 231 §3 CF). Reopening the same area through a new filing is not a realistic path.`
        : `O cadastro ANM está sem efeitos regulatórios ativos. A área sobrepõe ${ti}, com impedimento constitucional à exploração mineral (Art. 231, §3º CF). Não há perspectiva realista de reativação na mesma área por este fundamento.`,
      veredito_texto: en
        ? `Regulatory stage closed for this land carve-out; constitutional land restriction prevails over market attractiveness of the commodity.`
        : `Estágio regulatório encerrado para este recorte; a restrição fundiária constitucional prevalece sobre atratividade de mercado da substância.`,
      ponto_atencao: null,
    },
    risco: {
      ...r.risco,
      headline: en
        ? 'Risk dominated by constitutional and land tenure constraints'
        : 'Risco dominado por restrição fundiária e constitucional',
      lead: en
        ? `Before any other driver, risk reflects overlap with ${ti} and the defunct process status.`
        : `Antes de qualquer outro fator, o risco reflete a sobreposição a ${ti} e o encerramento do processo.`,
      leitura: en
        ? `Regulatory and territorial dimensions dominate: overlap with ${ti} at zero distance implies a land tenure block. Art. 231 §3 CF requires Congressional authorization not granted in practice for mining on this Indigenous land. A defunct filing does not reopen a credible path to future operation on the same footprint.`
        : `A dimensão regulatória e territorial domina: sobreposição a ${ti} implica bloqueio fundiário. O Art. 231, §3º da CF exige autorização do Congresso Nacional inexistente na prática para mineração sobre a TI. O processo extinto não reabre, por si, caminho operacional na mesma área.`,
    },
    oportunidade: {
      ...r.oportunidade,
      headline: en
        ? 'Opportunity unavailable — constitutional overlap'
        : 'Oportunidade indisponível · sobreposição constitucional',
      lead: en
        ? `Numeric OS remains a technical platform reference, but operational availability is structural: overlap with ${ti} precludes a mining investment scenario on this footprint.`
        : `O Opportunity Score numérico permanece como referência técnica da plataforma, mas a indisponibilidade operacional é estrutural: a sobreposição a ${ti} impede cenário de investimento minerário na área.`,
      dim_viab: en
        ? `Operational logistics do not project for this land carve-out: the constitutional barrier precedes corridor or haulage analysis. Nearby infrastructure does not cure land unavailability.`
        : `A viabilidade logística não se projeta para este recorte: o impedimento constitucional precede análise de corredor ou escoamento. Infraestrutura próxima não supre a indisponibilidade fundiária.`,
      sintese_p1: en
        ? `With RS and OS shown for methodological reference, the integrated read is unavailability of mining opportunity on the area by constitutional design, not a cyclical market limit.`
        : `Com Risk Score e OS exibidos para referência metodológica, a leitura integrada é de indisponibilidade de oportunidade minerária na área por força do ordenamento constitucional, não por limite conjuntural de mercado.`,
    },
  }
}

const FALLBACKS_EN = {
  sumario: {
    headline: 'Mining asset summary',
    lead: 'Process data under review.',
    veredito_texto: 'Stage under assessment.',
    ponto_atencao: null,
  } satisfies SumarioLLM,
  territorio: {
    headline: 'Territorial integrity analysis',
    lead: 'Geospatial overlay completed with official layers.',
    logistica_texto: 'See infrastructure table.',
    implicacao: 'See table above.',
  } satisfies TerritorioLLM,
  mercado: {
    headline: 'Commodity market data',
    lead: 'Price and demand indicators under review.',
    implicacao: 'See indicators above.',
  } satisfies MercadoLLM,
  fiscal: {
    headline: 'Municipal fiscal context',
    lead: 'Municipal fiscal indicators under review.',
    cfem_intro: 'Exploration phase; no CFEM accrual yet.',
    implicacao: 'See indicators above.',
    capag_classificacao_equiv: null,
  } satisfies FiscalLLM,
  risco: {
    headline: 'Risk analysis',
    lead: 'Risk score computed across four dimensions.',
    dim_geo: 'Geological dimension under review.',
    dim_amb: 'Environmental dimension under review.',
    dim_soc: 'Social dimension under review.',
    dim_reg: 'Regulatory dimension under review.',
    leitura: 'Integrated read in progress.',
  } satisfies RiscoLLM,
  oportunidade: {
    headline: 'Opportunity analysis',
    lead: 'Opportunity score computed across three dimensions.',
    dim_merc: 'Market dimension under review.',
    dim_viab: 'Feasibility dimension under review.',
    dim_seg: 'Security dimension under review.',
    sintese_p1: 'Synthesis in progress.',
    sintese_p2: '',
    sintese_marcos: '',
  } satisfies OportunidadeLLM,
}

const FALLBACKS = {
  sumario: {
    headline: 'Resumo do ativo minerário',
    lead: 'Dados do processo em análise.',
    veredito_texto: 'Estágio em avaliação.',
    ponto_atencao: null,
  } satisfies SumarioLLM,
  territorio: {
    headline: 'Análise de integridade territorial',
    lead: 'Cruzamento geoespacial realizado com camadas oficiais.',
    logistica_texto: 'Consulte os dados de infraestrutura na tabela.',
    implicacao: 'Consulte os dados da tabela acima.',
  } satisfies TerritorioLLM,
  mercado: {
    headline: 'Dados de mercado da substância',
    lead: 'Indicadores de preço e demanda em análise.',
    implicacao: 'Ver indicadores acima.',
  } satisfies MercadoLLM,
  fiscal: {
    headline: 'Contexto fiscal do município',
    lead: 'Indicadores fiscais municipais em análise.',
    cfem_intro: 'Processo em fase de pesquisa, sem arrecadação de CFEM.',
    implicacao: 'Ver indicadores acima.',
    capag_classificacao_equiv: null,
  } satisfies FiscalLLM,
  risco: {
    headline: 'Análise de risco do processo',
    lead: 'Score de risco calculado em 4 dimensões.',
    dim_geo: 'Dimensão geológica em avaliação.',
    dim_amb: 'Dimensão ambiental em avaliação.',
    dim_soc: 'Dimensão social em avaliação.',
    dim_reg: 'Dimensão regulatória em avaliação.',
    leitura: 'Leitura integrada em processamento.',
  } satisfies RiscoLLM,
  oportunidade: {
    headline: 'Análise de oportunidade',
    lead: 'Score de oportunidade calculado em 3 dimensões.',
    dim_merc: 'Dimensão de mercado em avaliação.',
    dim_viab: 'Dimensão de viabilidade em avaliação.',
    dim_seg: 'Dimensão de segurança em avaliação.',
    sintese_p1: 'Síntese em processamento.',
    sintese_p2: '',
    sintese_marcos: '',
  } satisfies OportunidadeLLM,
}

export async function generateReportLLM(data: ReportData): Promise<ReportLLMResult> {
  const lang: ReportLang = data.lang ?? 'pt'
  const sys = systemPromptForLang(lang)
  const fb = lang === 'en' ? FALLBACKS_EN : FALLBACKS

  const [sumario, territorio, mercado, fiscal, risco, oportunidade] =
    await Promise.all([
      callClaude<SumarioLLM>(buildPromptSumario(data), sys, lang),
      callClaude<TerritorioLLM>(buildPromptTerritorio(data), sys, lang),
      callClaude<MercadoLLM>(buildPromptMercado(data), sys, lang),
      callClaude<FiscalLLM>(buildPromptFiscal(data), sys, lang),
      callClaude<RiscoLLM>(buildPromptRisco(data), sys, lang, {
        temperature: 0.3,
        max_tokens: 1500,
      }),
      callClaude<OportunidadeLLM>(buildPromptOportunidade(data), sys, lang),
    ])

  const merged: ReportLLMResult = {
    sumario: sumario ?? fb.sumario,
    territorio: territorio ?? fb.territorio,
    mercado: mercado ?? fb.mercado,
    fiscal: fiscal ?? fb.fiscal,
    risco: risco ?? fb.risco,
    oportunidade: oportunidade ?? fb.oportunidade,
  }

  let out: ReportLLMResult = merged
  if (precisaFallbackTerminalBloqueador(data, merged)) {
    out = aplicarFallbackTerminalBloqueador(data, merged)
  }

  validarDimSocCPT(
    out.risco.dim_soc,
    extrairCptHintMeta(data),
    lang,
    data.processo,
  )

  return out
}
