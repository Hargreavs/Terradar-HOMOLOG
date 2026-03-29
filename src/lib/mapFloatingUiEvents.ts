/** Evento global disparado ao iniciar pan do mapa (MapView): fecha tooltips portaled. */
export const TERRAE_MAP_CLEAR_FLOATING_UI = 'terrae-map-clear-floating-ui'

export function dispatchTerraeMapClearFloatingUi(): void {
  window.dispatchEvent(new CustomEvent(TERRAE_MAP_CLEAR_FLOATING_UI))
}
