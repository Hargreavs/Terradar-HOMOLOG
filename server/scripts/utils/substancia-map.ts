/** Mapeamento básico substância ANM → família (Master-Substancias-v3 pode expandir). */
export const FAMILIA_MAP: Record<string, string> = {
  'Minério de Ouro': 'Metais Preciosos',
  Ouro: 'Metais Preciosos',
  'Minério de Prata': 'Metais Preciosos',
  'Minério de Ferro': 'Metais Ferrosos',
  'Minério de Manganês': 'Metais Ferrosos',
  'Minério de Cobre': 'Metais Base',
  'Minério de Zinco': 'Metais Base',
  Granito: 'Rochas Ornamentais',
  Mármore: 'Rochas Ornamentais',
  Areia: 'Agregados',
  Calcário: 'Minerais Industriais',
  Lítio: 'Minerais Estratégicos',
}

export function familiaFromSubstancia(substancia: string | null | undefined): string | null {
  if (!substancia) return null
  const t = substancia.trim()
  if (t in FAMILIA_MAP) return FAMILIA_MAP[t]
  const lower = t.toLowerCase()
  for (const [k, v] of Object.entries(FAMILIA_MAP)) {
    if (k.toLowerCase() === lower) return v
  }
  return null
}
