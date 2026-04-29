import type { TerritorialAmbientalResponse } from "../types/territorialAmbiental"

/** True quando não há elementos significativos a listar no card Ambiental. */
export function ambientalDrawerSensivelAusente(
  a: TerritorialAmbientalResponse,
): boolean {
  const ov = Number(a.app_hidrica?.overlap_pct ?? 0)
  const sitios = a.sitios_arqueologicos?.length ?? 0
  const massas = a.massas_agua?.length ?? 0
  return ov <= 0 && sitios === 0 && massas === 0
}
