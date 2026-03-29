import { createContext, useContext } from 'react'

/** Saída do mapa → Inteligência (mais rápida, alinhada ao fade do dashboard). */
export const CHROME_EXIT_MS_DEFAULT = 180

/** Entrada no mapa a partir da Inteligência (sidebar / overlays). */
export const CHROME_ENTER_MS_DEFAULT = 280

/** @deprecated Preferir CHROME_ENTER_MS_DEFAULT */
export const MAP_CHROME_TRANSITION_MS = CHROME_ENTER_MS_DEFAULT

export type MapChromeTransitionValue = {
  mapChromeCollapsed: boolean
  chromeExitMs: number
  chromeEnterMs: number
  /** Duração da transição do chrome neste estado (recolher = exit, expandir = enter). */
  chromeTransitionMs: number
}

const defaultValue: MapChromeTransitionValue = {
  mapChromeCollapsed: false,
  chromeExitMs: CHROME_EXIT_MS_DEFAULT,
  chromeEnterMs: CHROME_ENTER_MS_DEFAULT,
  chromeTransitionMs: CHROME_ENTER_MS_DEFAULT,
}

export const MapChromeTransitionContext =
  createContext<MapChromeTransitionValue>(defaultValue)

export function useMapChromeTransition(): MapChromeTransitionValue {
  return useContext(MapChromeTransitionContext)
}
