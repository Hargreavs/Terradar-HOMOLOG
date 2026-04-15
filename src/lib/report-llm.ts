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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `Você é o motor de texto do TERRADAR, uma plataforma de inteligência mineral.
Gere APENAS o JSON solicitado, sem markdown, sem preâmbulo, sem explicação.
REGRAS ABSOLUTAS:
1. Linguagem: tom analítico de negócio, investidor institucional
2. NUNCA revelar pesos, fórmulas ou lógica de cálculo dos scores
3. Usar "desenvolvidos e calibrados" + "propriedade intelectual do TERRADAR"
4. NUNCA usar em dash, usar vírgula ou ponto
5. NUNCA inventar dados, usar APENAS os fornecidos no contexto
6. Acentos: português brasileiro correto
7. Implicações: sempre cruzar dados entre páginas (ex: CAPAG vs logística)
8. Máximo 3 frases por parágrafo, diretas e sem floreios
9. FASE DO PROCESSO: O campo fase indica se o processo está em Pesquisa, Lavra, ou outra fase.
   - Se fase = "Lavra" ou regime contém "Concessão de Lavra": a viabilidade geológica já foi comprovada.
     NUNCA usar linguagem de validação inicial ("demandam validação em campo", "confirmar parâmetros preliminares", "estudos complementares").
     USAR linguagem de operação ("continuidade de teores", "reservas remanescentes", "vida útil da reserva", "variabilidade natural").
   - Se fase = "Pesquisa" ou regime contém "Autorização de Pesquisa": a viabilidade ainda não foi comprovada.
     USAR linguagem de validação ("validação em campo", "parâmetros geológicos preliminares", "estudos complementares").
10. CAPAG PARCIAL: Quando capag_nota = "n.d." MAS existem indicadores individuais (capag_endiv, capag_poupcorr, capag_liquidez com valores numéricos e notas A/B/C):
    - NUNCA dizer "CAPAG não disponível impede análise" ou "ausência de dados CAPAG".
    - SEMPRE citar os indicadores que existem com seus valores e notas.
    - Inferir a classificação equivalente: nota final = pior nota entre os indicadores disponíveis.
    - Exemplo correto: "Os indicadores CAPAG parciais revelam endividamento controlado (16,13%, nota A), embora a poupança corrente (99,92%, nota C) sinalize fragilidade na capacidade de investimento municipal."
    - Exemplo ERRADO: "Ausência de dados CAPAG impede análise completa da capacidade de gestão municipal."
11. REFERÊNCIAS CRUZADAS REGULATÓRIAS: Quando dados_sei contém informações regulatórias (portaria, licença ambiental, certidão, TAH, plano de lavra, plano de fechamento de mina):
    - No bloco RISCO REGULATÓRIO: citar documentos específicos com datas (ex: "portaria de lavra publicada no DOU em 09/01/2017", "licença ambiental apresentada em 17/04/2025").
    - No bloco LEITURA INTEGRADA: se todos os documentos estão em dia, usar "regularidade documental completa" em vez de "condicionada à regularização".
    - No bloco SEGURANÇA DO INVESTIMENTO: citar os marcos regulatórios como evidência de conformidade.
    - NUNCA dizer "pendências regulatórias" se portaria, licença e certidão estão vigentes.`

async function callClaude<T>(userPrompt: string, retries = 2): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')

      const clean = textBlock.text.replace(/```json|```/g, '').trim()
      return JSON.parse(clean) as T
    } catch (e: any) {
      console.error(`[CLAUDE ERROR] Tentativa ${i + 1}:`, e.message || e)
      if (i >= retries) return null
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  return null
}

/** Subconjunto estruturado para cruzamento fase, CAPAG parcial e SEI nos prompts v2.1. */
function jsonContextoLLM(d: ReportData): string {
  return JSON.stringify(
    {
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

function buildPromptSumario(d: ReportData): string {
  return `Dados do processo:
- Processo: ${d.processo}, Substância: ${d.substancia_anm}
- Município: ${d.municipio}, Área: ${d.area_ha} ha
- Titular: ${d.titular}, CNPJ: ${d.cnpj}
- Fase: ${d.fase}, Regime: ${d.regime}
- Alvará: ${d.alvara_status}, validade ${d.alvara_validade}
- Risk Score: ${d.risk_score}/100 (${d.rs_classificacao})
- Opportunity Score: ${d.os_conservador}/100 (${d.os_classificacao})
- GU: ${d.gu_status} ${d.gu_pendencia}
- Protocolo: ${d.protocolo_anos} anos de tramitação

Gere JSON:
{
  "headline": "frase curta resumindo RS+OS+fase, max 15 palavras",
  "lead": "parágrafo 3 frases: processo, titular, alvará, horizonte",
  "veredito_texto": "2 frases explicando o estágio atual",
  "ponto_atencao": "se GU vencida, alertar. Se não, null"
}`
}

function buildPromptTerritorio(d: ReportData): string {
  const layersText = d.layers
    .map(
      (l) =>
        `${l.tipo}: ${l.nome} ${l.detalhes}, ${l.distancia_km} km, sobreposto: ${l.sobreposto}`,
    )
    .join('\n')
  const infraText = d.infraestrutura
    .map((i) => `${i.tipo}: ${i.nome} ${i.detalhes}, ${i.distancia_km} km`)
    .join('\n')

  return `Camadas territoriais:
${layersText}

Infraestrutura:
${infraText}

Gere JSON:
{
  "headline": "frase sobre sobreposição (ou ausência), max 12 palavras",
  "lead": "parágrafo descrevendo cruzamento geoespacial realizado",
  "logistica_texto": "1 frase sobre acesso logístico",
  "implicacao": "2-3 frases cruzando risco territorial + logística"
}`
}

function buildPromptMercado(d: ReportData): string {
  return `Dados de mercado da substância ${d.substancia_anm}:
- Preço: USD ${d.preco_oz_usd}/oz (R$ ${d.preco_g_brl}/g)
- Tendência (rótulo master): ${d.mercado_tendencia}
- Variação 12 meses: ${d.var_12m_pct}%
- CAGR 5 anos: ${d.cagr_5a_pct}%
- Demanda global: ${d.demanda_global_t} t
- Reservas Brasil: ${d.reservas_mundiais_pct}% do mundial
- Produção Brasil: ${d.producao_mundial_pct}% do mundial
- CFEM/ha estimada: R$ ${d.cfem_estimada_ha}
- Área do processo: ${d.area_ha} ha

Gere JSON:
{
  "headline": "frase sobre tendência de mercado, max 10 palavras",
  "lead": "parágrafo 3 frases: preço, variação, demanda recorde",
  "implicacao": "3 frases: atratividade + CFEM projetada vs arrecadação atual"
}`
}

function buildPromptFiscal(d: ReportData): string {
  return `REGRAS ESPECÍFICAS PARA FISCAL:

- CAPAG com indicadores parciais: Se capag_nota = "n.d." mas indicadores existem, exibir no campo capag_classificacao_equiv:
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
- Dívida: ${d.divida}
- Dependência transferências: ${d.dependencia_transf}
- Incentivos: ${d.incentivos.programa_estadual}, ${d.incentivos.linhas_bndes} linhas BNDES
- CFEM/ha estimada: R$ ${d.cfem_estimada_ha}

Gere JSON:
{
  "headline": "frase sobre capacidade fiscal, max 10 palavras",
  "lead": "parágrafo: CAPAG nota, determinante, dívida, dependência",
  "cfem_intro": "1 frase: processo ainda não gera CFEM",
  "implicacao": "3 frases: fiscal não impede, infraestrutura pode ser limitada, CFEM projetada",
  "capag_classificacao_equiv": "se capag parcial com nota n.d., uma linha com classificação equivalente e indicador determinante, senão null"
}`
}

function buildPromptRisco(d: ReportData): string {
  const layersText = d.layers
    .map((l) => `${l.tipo}: ${l.nome}, ${l.distancia_km} km, sobreposto: ${l.sobreposto}`)
    .join('\n')

  return `REGRAS ESPECÍFICAS PARA RISCO:

- RISCO GEOLÓGICO: Verificar data.fase antes de redigir.
  Se fase = "Lavra": "viabilidade geológica comprovada, risco concentrado na continuidade de teores em profundidade" + mencionar ausência de NI 43-101/JORC se aplicável.
  Se fase = "Pesquisa": "validação em campo pendente, parâmetros geológicos preliminares".

- RISCO SOCIAL: Verificar data.capag_endiv e data.capag_poupcorr.
  Se existirem valores numéricos: citar valores exatos + notas + implicação (ex: "endividamento controlado mas margem fiscal limitada").
  Se TODOS forem null/n.d.: aí sim dizer "dados CAPAG indisponíveis".
  SEMPRE incluir IDH (data.idh) e distância a comunidades tradicionais se disponíveis nas camadas.

- RISCO REGULATÓRIO: Verificar data.dados_sei.
  Se portaria + licença + certidão existem e estão vigentes: "arcabouço regulatório completo".
  Citar datas específicas dos documentos.
  Mencionar plano de fechamento de mina se existir.

- LEITURA INTEGRADA:
  Se fase = "Lavra" E documentação completa: "regularidade documental completa" (nunca "condicionada à resolução de questões pendentes").
  Se fase = "Pesquisa": "condicionada à confirmação dos parâmetros geológicos".

Contexto JSON (cruzamento fase, CAPAG, SEI):
${jsonContextoLLM(d)}

Dados de risco do processo ${d.processo}:
- Risk Score total: ${d.risk_score}/100 (${d.rs_classificacao})
- Geológico: ${d.rs_geo.valor} (${d.rs_geo.label})
- Ambiental: ${d.rs_amb.valor} (${d.rs_amb.label})
- Social: ${d.rs_soc.valor} (${d.rs_soc.label})
- Regulatório: ${d.rs_reg.valor} (${d.rs_reg.label})
- Fase: ${d.fase}, Regime: ${d.regime}, Alvará: ${d.alvara_status} até ${d.alvara_validade}
- GU: ${d.gu_status}
- CAPAG: ${d.capag_nota}
- Camadas territoriais:
${layersText}

Gere JSON:
{
  "headline": "frase: risco X, principal incerteza Y",
  "lead": "1 frase sobre as 4 dimensões + score obtido",
  "dim_geo": "3 frases: incerteza, substância, tendência",
  "dim_amb": "3 frases: sobreposição, aquífero, diferencial",
  "dim_soc": "3 frases: IDH, densidade, CAPAG como componente",
  "dim_reg": "3 frases: despacho recente, alvará, pendência GU",
  "leitura": "3 frases: perfil dominado por X, nenhum impeditivo, tendência"
}
REGRA: NUNCA mencionar pesos numéricos dos sub-scores.`
}

function buildPromptOportunidade(d: ReportData): string {
  const ferroviaKm =
    d.infraestrutura.find((i) => i.tipo === 'Ferrovia')?.distancia_km ?? 'N/A'

  return `REGRAS ESPECÍFICAS PARA OPORTUNIDADE:

- SEGURANÇA DO INVESTIMENTO: Verificar data.capag_endiv e data.capag_poupcorr.
  Se existirem indicadores parciais: "indicadores CAPAG parciais (endividamento nota X, poupança corrente nota Y) indicam município com dívida controlada mas margem fiscal limitada para investimentos em infraestrutura de apoio."
  Se portaria/licença/certidão vigentes em dados_sei: citar como "confirmação de conformidade plena com o marco regulatório ANM".
  NUNCA "ausência de dados CAPAG" se indicadores parciais existirem.

- SÍNTESE RS×OS:
  Se indicadores CAPAG parciais existirem: "classificação CAPAG equivalente a [pior_nota], com endividamento controlado mas capacidade de investimento municipal restrita."
  NUNCA repetir "ausência de dados CAPAG" se já citou indicadores na segurança.

Contexto JSON:
${jsonContextoLLM(d)}

Dados de oportunidade do processo ${d.processo}:
- OS Conservador: ${d.os_conservador}/100
- OS Moderado: ${d.os_moderado}/100
- OS Arrojado: ${d.os_arrojado}/100
- Classificação: ${d.os_classificacao}
- Mercado: ${d.os_merc.valor} (${d.os_merc.label})
- Viabilidade: ${d.os_viab.valor} (${d.os_viab.label})
- Segurança: ${d.os_seg.valor} (${d.os_seg.label})
- Risk Score: ${d.risk_score} (${d.rs_classificacao})
- Variação preço 12m: ${d.var_12m_pct}%
- Ferrovia mais próxima: ${ferroviaKm} km
- CAPAG: ${d.capag_nota}
- Fase: ${d.fase}, Regime: ${d.regime}

Gere JSON:
{
  "headline": "frase: oportunidade X sustentada por Y",
  "lead": "1 frase: OS avalia potencial em 3 dimensões",
  "dim_merc": "3 frases: valorização, demanda, gap reserva-produção",
  "dim_viab": "3 frases: logística, área, fatores limitantes + incentivos",
  "dim_seg": "3 frases: baixo risco, regularidade, pendência GU",
  "sintese_p1": "3 frases: cruzamento RS x OS, fundamentos + risco territorial",
  "sintese_p2": "2 frases: fatores transitórios, tendência",
  "sintese_marcos": "1 frase: próximos marcos de valorização"
}
REGRA: Labels OS = "Favorável" (não "Moderada"). NUNCA mencionar pesos.`
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
  const [sumario, territorio, mercado, fiscal, risco, oportunidade] =
    await Promise.all([
      callClaude<SumarioLLM>(buildPromptSumario(data)),
      callClaude<TerritorioLLM>(buildPromptTerritorio(data)),
      callClaude<MercadoLLM>(buildPromptMercado(data)),
      callClaude<FiscalLLM>(buildPromptFiscal(data)),
      callClaude<RiscoLLM>(buildPromptRisco(data)),
      callClaude<OportunidadeLLM>(buildPromptOportunidade(data)),
    ])

  return {
    sumario: sumario ?? FALLBACKS.sumario,
    territorio: territorio ?? FALLBACKS.territorio,
    mercado: mercado ?? FALLBACKS.mercado,
    fiscal: fiscal ?? FALLBACKS.fiscal,
    risco: risco ?? FALLBACKS.risco,
    oportunidade: oportunidade ?? FALLBACKS.oportunidade,
  }
}
