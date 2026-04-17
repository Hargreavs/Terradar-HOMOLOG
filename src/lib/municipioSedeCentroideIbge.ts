/**
 * Centroides aproximados da sede municipal (IBGE), para fallback de distância
 * quando a análise territorial não retorna camada de sede.
 * Chave: `UF|nome do município` (minúsculas, sem acento extra).
 */
const SEDE_CENTROIDE: Record<string, { lat: number; lng: number }> = {
  'TO|chapada da natividade': { lat: -11.6975, lng: -47.7417 },
  /** IBGE (validado PostGIS; apresentação 13 processos). */
  'TO|jaú do tocantins': { lat: -12.5678, lng: -48.735 },
  /** Mesma sede sem acento no nome (cadastro ANM / normalização). */
  'TO|jau do tocantins': { lat: -12.5678, lng: -48.735 },
  'BA|ourolândia': { lat: -10.9614, lng: -41.0664 },
  'BA|ourolandia': { lat: -10.9614, lng: -41.0664 },
  'GO|amorinópolis': { lat: -16.6075, lng: -51.0944 },
  'GO|amorinopolis': { lat: -16.6075, lng: -51.0944 },
  'GO|iporá': { lat: -16.44, lng: -51.1183 },
  'GO|ipora': { lat: -16.44, lng: -51.1183 },
  'GO|ivolândia': { lat: -16.5825, lng: -50.835 },
  'GO|ivolandia': { lat: -16.5825, lng: -50.835 },
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
