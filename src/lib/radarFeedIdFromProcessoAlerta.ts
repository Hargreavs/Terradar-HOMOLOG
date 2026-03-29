import type { AlertaLegislativo } from '../types'
import { RADAR_ALERTAS_MOCK } from '../data/radar-alertas.mock'

/**
 * Associa um alerta do processo (catálogo) a um item do feed Radar (mock),
 * usando processos afetados e sobreposição fraca de título.
 */
export function radarFeedIdParaAlertaProcesso(
  processoId: string,
  alerta: AlertaLegislativo,
): string | null {
  const affecting = RADAR_ALERTAS_MOCK.filter((r) =>
    r.processos_afetados_ids.includes(processoId),
  )
  if (affecting.length === 0) return null
  const t = alerta.titulo.toLowerCase()
  const words = t.split(/\s+/).filter((w) => w.length > 4)
  for (const r of affecting) {
    const rt = r.titulo.toLowerCase()
    if (words.some((w) => rt.includes(w))) return r.id
  }
  return affecting[0]!.id
}
