/** Cores por substância: alinhadas ao dashboard (badges / tabela). */

export const COR_SUBSTANCIA: Record<string, string> = {
  FERRO: '#7EADD4',
  OURO: '#D4A843',
  'MINERIO DE OURO': '#D4A843',
  COBRE: '#C87C5B',
  NIOBIO: '#5CBFA0',
  'TERRAS RARAS': '#3D8B7A',
  NEODIMIO: '#3D8B7A',
  LITIO: '#9BB8D0',
  NIQUEL: '#8FAA8D',
  DISPRÓSIO: '#3D8B7A',
  DISPROSIO: '#3D8B7A',
  PRASEODIMIO: '#3D8B7A',
  TERBIO: '#3D8B7A',
  GRAFITE: '#7A9B5A',
  VANADIO: '#7EADD4',
  BAUXITA: '#B8917A',
  QUARTZO: '#C4B89A',
}

function chaveSubstancia(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/** Cor principal da substância, se existir no mapa. */
export function corSubstanciaOuUndefined(raw: string): string | undefined {
  return COR_SUBSTANCIA[chaveSubstancia(raw)]
}

/**
 * Badge v2: fundo transparente, borda 1px na cor da substância (paleta dashboard).
 * Substâncias fora da paleta: texto #D3D1C7, borda #5F5E5A.
 */
export function estiloBadgeSubstanciaPaletaV2(raw: string): {
  backgroundColor: 'transparent'
  color: string
  border: string
} {
  const cor = corSubstanciaOuUndefined(raw)
  if (!cor) {
    return {
      backgroundColor: 'transparent',
      color: '#D3D1C7',
      border: '1px solid #5F5E5A',
    }
  }
  return {
    backgroundColor: 'transparent',
    color: cor,
    border: `1px solid ${cor}`,
  }
}

/**
 * Estilo de badge (fundo 15% + texto na cor principal).
 * Fallback quando não houver mapeamento: fundo #2C2C2A, texto #888780.
 */
export function estiloBadgeSubstancia(raw: string): {
  backgroundColor: string
  color: string
} {
  const cor = corSubstanciaOuUndefined(raw)
  if (!cor) {
    return { backgroundColor: '#2C2C2A', color: '#888780' }
  }
  return { backgroundColor: `${cor}26`, color: cor }
}
