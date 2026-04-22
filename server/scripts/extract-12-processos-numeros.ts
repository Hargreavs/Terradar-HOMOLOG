/** NUPs alvo: 3 originais + 10 Copper (860.899 omitido) = 13 */
export const NUMEROS_LISTA = [
  '864.016/2026',
  '864.026/2026',
  '871.516/2011',
  '860.890/2022',
  '860.891/2022',
  '860.892/2022',
  '860.893/2022',
  '860.894/2022',
  '860.895/2022',
  '860.896/2022',
  '860.897/2022',
  '860.898/2022',
  '860.900/2022',
] as const

export const NUMEROS_ALVO = new Set<string>(NUMEROS_LISTA)
