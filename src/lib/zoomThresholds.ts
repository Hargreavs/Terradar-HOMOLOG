/**
 * Escala o nível mínimo de detalhe por zoom do mapa.
 * Viewport amplo = só objetos relevantes. Viewport fechado = tudo.
 */
export function zoomThresholds(zoom: number) {
  if (zoom < 5) {
    return { minStrahler: 5, minFaixa: 200, minAreaHa: 100 }
  }
  if (zoom < 7) {
    return { minStrahler: 4, minFaixa: 100, minAreaHa: 20 }
  }
  if (zoom < 9) {
    return { minStrahler: 3, minFaixa: 50, minAreaHa: 5 }
  }
  if (zoom < 11) {
    return { minStrahler: 2, minFaixa: 30, minAreaHa: 2 }
  }
  return { minStrahler: 1, minFaixa: 30, minAreaHa: 0 }
}
