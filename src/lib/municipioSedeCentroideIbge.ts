/**
 * Centroides aproximados da sede municipal (IBGE), para fallback de distância
 * quando a análise territorial não retorna camada de sede.
 * Chave: `UF|nome do município` (minúsculas, sem acento extra).
 */
const SEDE_CENTROIDE: Record<string, { lat: number; lng: number }> = {
  'TO|chapada da natividade': { lat: -11.6975, lng: -47.7417 },
  'TO|jaú do tocantins': { lat: -12.7983, lng: -48.6283 },
  /** Mesma sede sem acento no nome (cadastro ANM / normalização). */
  'TO|jau do tocantins': { lat: -12.7983, lng: -48.6283 },
}

function chaveMunicipioUf(municipio: string, uf: string): string {
  return `${uf.trim().toUpperCase()}|${municipio.trim().toLowerCase()}`
}

export function centroideMunicipioSedeIbge(
  municipio: string,
  uf: string,
): { lat: number; lng: number } | null {
  const k = chaveMunicipioUf(municipio, uf)
  return SEDE_CENTROIDE[k] ?? null
}
