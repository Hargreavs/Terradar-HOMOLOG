import {
  Atom,
  CircleDot,
  Diamond,
  Disc,
  Gem,
  Hexagon,
  Mountain,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Valor sentinela no multi-select de substâncias (“Todas” no UI). */
export const TODAS_SUBST = '__TODAS__'

export type SubstanciaDef = {
  key: string
  label: string
  Icon: LucideIcon
  color: string
  estrategico: boolean
}

export const SUBSTANCIA_DEFS: SubstanciaDef[] = [
  { key: 'FERRO', label: 'Ferro', Icon: CircleDot, color: '#7EADD4', estrategico: false },
  { key: 'COBRE', label: 'Cobre', Icon: Hexagon, color: '#C87C5B', estrategico: false },
  { key: 'OURO', label: 'Ouro', Icon: Gem, color: '#D4A843', estrategico: false },
  { key: 'NIOBIO', label: 'Nióbio', Icon: Atom, color: '#5CBFA0', estrategico: true },
  { key: 'RARE', label: 'Terras Raras', Icon: Sparkles, color: '#3D8B7A', estrategico: true },
  { key: 'LITIO', label: 'Lítio', Icon: Zap, color: '#9BB8D0', estrategico: true },
  { key: 'NIQUEL', label: 'Níquel', Icon: Disc, color: '#8FAA8D', estrategico: true },
  { key: 'BAUXITA', label: 'Bauxita', Icon: Mountain, color: '#B8917A', estrategico: false },
  { key: 'QUARTZO', label: 'Quartzo', Icon: Diamond, color: '#C4B89A', estrategico: false },
]

/** Normaliza para comparar com `key` em SUBSTANCIA_DEFS (sem acentos, maiúsculas). */
export function normalizeSubstanciaKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/** Terras raras e outros nomes fora de SUBSTANCIA_DEFS (chave normalizada). */
const LABEL_SUBSTANCIA_EXTRA: Record<string, string> = {
  NEODIMIO: 'Neodímio',
  PRASEODIMIO: 'Praseodímio',
  TERBIO: 'Térbio',
  DISPROSIO: 'Disprósio',
  'MINERIO DE OURO': 'Minério de ouro',
}

/** Rótulo para exibição no relatório (acentuação correta; ex.: NIQUEL → Níquel). */
export function labelSubstanciaParaExibicao(raw: string): string {
  const key = normalizeSubstanciaKey(raw)
  const def = SUBSTANCIA_DEFS.find((d) => d.key === key)
  if (def) return def.label
  const extra = LABEL_SUBSTANCIA_EXTRA[key]
  if (extra) return extra
  const t = raw.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** Chaves dos elementos de terras raras (para toggle em grupo). */
export const RARE_KEYS = ['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPRÓSIO'] as const

/**
 * Sentinel do campo `processos.substancia` no DB quando a substância não foi
 * declarada no Microdados SCM. Afeta ~251 processos (todos os 180 zumbis + 71
 * outros sem-geom). Não exibir para o usuário.
 */
const SENTINEL_SUBSTANCIA_NAO_INFORMADA = 'SCM_SUBSTANCIA_NAO_INFORMADA'

/**
 * Formata substância para exibição no UI. Resolve o sentinel
 * `SCM_SUBSTANCIA_NAO_INFORMADA` retornando `null` para que o caller possa
 * renderizar travessão ou empty state. Também normaliza casing via
 * `labelSubstanciaParaExibicao`.
 *
 * @returns null quando substância é ausente/sentinel, string formatada caso contrário.
 */
export function formatarSubstancia(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  // Normaliza para comparar com o sentinel ignorando caixa/acentos.
  if (normalizeSubstanciaKey(trimmed) === SENTINEL_SUBSTANCIA_NAO_INFORMADA) {
    return null
  }
  return labelSubstanciaParaExibicao(trimmed)
}

/**
 * True se a substância é o sentinel SCM ou ausente. Útil para renderizar
 * empty states em abas que dependem de substância (Inteligência, Oportunidade).
 */
export function substanciaDesconhecida(
  raw: string | null | undefined,
): boolean {
  return formatarSubstancia(raw) === null
}
