/**
 * Human-readable labels for JSONB "fonte" keys (TERRADAR). File must be saved as UTF-8.
 */
export const FONTE_LABEL: Record<string, string> = {
  master_substancias: 'USGS / Trading Economics',
  scm_microdados: 'ANM/SIGMINE',
  proceso_eventos: 'ANM/SIGMINE',
  capag: 'STN/SICONFI',
  siconfi: 'STN/SICONFI',
  geo_areas_protegidas: 'FUNAI / ICMBio',
  geo_aquiferos: 'ANA / CPRM',
  geo_app_hidrica: 'ANA / IBAMA',
  geo_biomas: 'IBGE / MMA',
  adoo: 'Adoo (Di\u00E1rios Oficiais)',
}

// Maps technical keys to UI labels. Human-readable values (space, slash, or ALL CAPS) pass through.
const FONTES_PARASITAS_REGEX = new RegExp('^terrae(/.*)?$', 'i')
const FONTES_TERRADAR_MOTOR_REGEX = new RegExp('^terradar(/.*)?$', 'i')

// Internal motor sources: hide parenthesis on card. USGS, ANM, etc. still use labelFonte.
export function mostrarFonte(fonteRaw: string | null | undefined): string | null {
  if (fonteRaw == null || String(fonteRaw).trim() === '') return null
  const t = String(fonteRaw).trim()
  if (FONTES_PARASITAS_REGEX.test(t) || FONTES_TERRADAR_MOTOR_REGEX.test(t)) return null
  const h = labelFonte(fonteRaw)
  return h || null
}

export function labelFonte(fonteRaw: string | null | undefined): string {
  if (fonteRaw == null || String(fonteRaw).trim() === '') return ''
  const t = String(fonteRaw).trim()
  if (/[\s/]/.test(t) || t === t.toUpperCase()) {
    return t.replace(/Terrae/g, 'TERRADAR')
  }
  const mapped = FONTE_LABEL[t.toLowerCase()]
  if (mapped) return mapped.replace(/Terrae/g, 'TERRADAR')
  return t.replace(/Terrae/g, 'TERRADAR')
}

/** @deprecated Use labelFonte; kept for call sites that need empty as em-spaced dash. */
export function displayFonte(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return '\u2014'
  return labelFonte(raw) || '\u2014'
}

export function trocarTerraeEmCopy(s: string): string {
  return s.replace(/Terrae/g, 'TERRADAR')
}
