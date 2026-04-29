/** Mensagens padronizadas Estados A/B/C nos cards do drawer (Etapa 2.1). */

/** Tipo 1 — estruturalmente não aplicável (gemas / águas). */
export function msgValorInsituTipo1Gemas(): string {
  return `Valor in-situ não aplicável a gemas

Pedras coloridas são avaliadas por pedra individual (cor, claridade, tamanho, origem), não por densidade volumétrica. Estimativas de hectare exigiriam cubagem específica e ensaios gemológicos.`
}

export function msgValorInsituTipo1AguasMinerais(): string {
  return `Valor in-situ não aplicável a águas minerais

Avaliação por volume captado (L/dia) e qualidade físico-química, não por densidade mineral. Cálculo por hectare não é a métrica apropriada.`
}

/** Tipo 2 — sem publicação / sem cubagem média. */
export function msgValorInsituTipo2SemCubagem(substancia: string): string {
  return `Estimativa de reserva por hectare indisponível

${substancia.trim()} não tem cubagem média publicada por USGS/CPRM. Valor in-situ teórico não calculável sem teor referencial.`
}

/** Tipo 3 — em coleta (TERRADAR). */
export function msgAmbientalSensivelTipo3(): string {
  return 'Sem áreas ambientais sensíveis identificadas no raio analisado.'
}

export function msgProcessosVizinhosTipo3(): string {
  return 'Sem processos vizinhos no raio de análise.'
}

/** Tipo 4 — dependência de campo ausente. */
export function msgCalculoCampoAusenteTipo4(campo: string): string {
  return `Cálculo indisponível: ${campo} não informado no cadastro ANM.`
}

export function msgTipo4BrasilProducaoZeroRef(): string {
  return 'Brasil declarou produção zero no ano de referência'
}

/** Preço USD spot ausente mas há BRL oficial na master — nota sob o preço. */
export function notaUsdNaoCotadoOficialmente(): string {
  return 'USD não cotado oficialmente; exibindo preço médio nacional em R$ onde disponível.'
}

/** Gemas master ainda não preenchida como lista — sem preço exibível. */
export function msgPrecoTipo1GemasSemUsd(): string {
  return `Referência USD não cotada para esta commoditie mineral

Mercado de gemas de cor é heterogêneo; cotações internacionais são esparsas. Aguardando consolidação de preços na master para exibição alinhada a R$/carat ou R$/kg.`
}

/** Estimativa CFEM operação indisponível — coleta/anúncia. */
export function msgCfemOperacaoEstimativaIndisponivel(substancia: string): string {
  return `Estimativa indisponível

Produção declarada e/ou preço médio ANM ainda em coleta para ${substancia.trim()}.`
}

export function msgCapagIndisponivelMunicipio(
  municipio: string,
  uf: string,
): string {
  return `Indicadores CAPAG não disponíveis

Tesouro Nacional não publicou CAPAG vigente para ${municipio.trim()}/${uf.trim()}.`
}

export function isPlaceholderEstrategiaNacional(
  s: string | null | undefined,
): boolean {
  const t = (s ?? '').trim()
  if (!t) return true
  const low = t.toLowerCase()
  if (t === 'Não disponível') return true
  if (low.includes('ver fontes do master')) return true
  return false
}
