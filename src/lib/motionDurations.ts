/** Durações do motion system (alinhadas a App + Inteligência + Mapa). */

export const MOTION_OVERLAY_INNER_ENTER_DELAY_MS = 60
export const MOTION_OVERLAY_INNER_ENTER_MS = 120
export const MOTION_OVERLAY_INNER_EXIT_MS = 120
/** Desmontagem do overlay após início do fade-out do conteúdo (margem + chrome). */
export const MOTION_OVERLAY_UNMOUNT_MS = 180

export const MOTION_STAGGER_STEP_MS = 60
/** Base do stagger na Inteligência = fim do fade-in do overlay (60 + 120). */
export function motionStaggerBaseMs(reducedMotion: boolean): number {
  return reducedMotion
    ? 0
    : MOTION_OVERLAY_INNER_ENTER_DELAY_MS + MOTION_OVERLAY_INNER_ENTER_MS
}

export const MOTION_TAB_CROSSFADE_OUT_MS = 120
export const MOTION_TAB_CROSSFADE_IN_MS = 180

export const MOTION_GROUP_FADE_MS = 300
export const MOTION_GROUP_TRANSLATE_PX = 16

export const MOTION_BAR_WIDTH_MS = 400
export const MOTION_BAR_STAGGER_MS = 30

export const MOTION_MAP_INTRO_SEARCH_DELAY_MS = 300
export const MOTION_MAP_INTRO_LEGEND_DELAY_MS = 400
export const MOTION_MAP_INTRO_THEME_DELAY_MS = 450
export const MOTION_MAP_INTRO_DURATION_MS = 250

/** Recharts `<Line>` animationBegin por `dataKey` (SUB_KEYS). */
export const MOTION_LINE_ANIMATION_BEGIN_MS: Record<
  'ferro' | 'cobre' | 'ouro' | 'niobio' | 'terras_raras',
  number
> = {
  ferro: 120,
  cobre: 170,
  ouro: 220,
  niobio: 270,
  terras_raras: 320,
}

export function motionMs(d: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : d
}
