import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * Singleton ref para a instância ativa do Mapbox GL Map.
 *
 * Preenchida pelo MapView no mount e limpa no unmount. Consumida pelo
 * ExportReportButton para orquestrar a captura de snapshot na Fase 2
 * (mapa no PDF).
 *
 * Deliberadamente um objeto ref simples — sem contexto React e sem Zustand —
 * porque só existe um consumidor (export de PDF) e nenhum componente precisa
 * re-renderizar quando a instância do mapa aparece/some.
 *
 * Uso:
 *   // em MapView, após new mapboxgl.Map(...):
 *   mapInstanceRef.current = map
 *
 *   // no cleanup do effect:
 *   mapInstanceRef.current = null
 *
 *   // no consumidor (ExportReportButton):
 *   const map = mapInstanceRef.current
 *   if (map) { ... }
 */
export const mapInstanceRef: { current: MapboxMap | null } = {
  current: null,
}
