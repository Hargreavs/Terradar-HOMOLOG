/** Categorização leve de eventos SCM (alinhada a ingest-eventos-microdados). */
const CATEGORIAS_EVENTO: Record<string, number[]> = {
  PORTARIA_LAVRA: [400, 488, 489, 495, 496, 497, 498, 499],
  LICENCA_AMBIENTAL: [621, 622, 676, 1399, 1400, 1401, 1402],
  PLANO_FECHAMENTO: [1338, 2503, 2504],
  INICIO_LAVRA: [405],
  TAH_PAGAMENTO: [264, 588, 642],
  EXIGENCIA: [3, 27, 131, 250, 350, 470, 550],
  CUMPRIMENTO_EXIGENCIA: [4, 135, 255, 435, 455, 535],
  RAL: [418, 420, 541, 1773],
  ALVARA: [201, 176],
}

export function categorizarEventoScm(idEvento: number): string | null {
  for (const [cat, ids] of Object.entries(CATEGORIAS_EVENTO)) {
    if (ids.includes(idEvento)) return cat
  }
  return null
}
