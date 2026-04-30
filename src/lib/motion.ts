/**
 * Sistema central de tokens de motion do TERRAE.
 *
 * Agrupa semanticamente DURATION, EASING, STAGGER e LOADING.
 * Novos fluxos devem preferir estes tokens; valores legados continuam expostos
 * por `motionDurations.ts` (retrocompatibilidade sem import circular aqui).
 */

/** Durações nomeadas para hierarquia de timing (instant → deliberate). */
export const MOTION_DURATION = {
  instant: 100,
  fast: 200,
  standard: 300,
  emphasized: 400,
  slow: 500,
  deliberate: 800,
} as const

/** Curvas cubic-bezier nomeadas para entradas, saídas e ênfase. */
export const MOTION_EASING = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
  linear: 'linear',
} as const

/** Passo entre itens em listas escalonadas. */
export const MOTION_STAGGER = {
  tight: 40,
  comfortable: 60,
  relaxed: 100,
} as const

/** Overlay e percepção de loading. */
export const MOTION_LOADING = {
  minVisibleMs: 400,
  fadeOutMs: 200,
} as const

/** Com `prefers-reduced-motion`, todas as durações viram imperceptíveis (1 ms). */
export function motionMs(duration: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : duration
}

/**
 * Monta uma única propriedade de `transition` CSS.
 * Omite o delay final quando omitido ou zero.
 */
export function motionTransition(
  property: string,
  duration: number,
  easing: string,
  delay?: number,
): string {
  if (delay != null && delay > 0) {
    return `${property} ${duration}ms ${easing} ${delay}ms`
  }
  return `${property} ${duration}ms ${easing}`
}

export type MotionDurationKey = keyof typeof MOTION_DURATION
export type MotionEasingKey = keyof typeof MOTION_EASING
export type MotionStaggerKey = keyof typeof MOTION_STAGGER
