import type { CSSProperties } from 'react'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
} from './motionDurations'

/** Grupo com fade + translate (Inteligência, Prospecção resultados). */
export function motionGroupStyle(visible: boolean, reduced: boolean): CSSProperties {
  if (reduced) return { opacity: 1, transform: 'translateY(0)' }
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${MOTION_GROUP_TRANSLATE_PX}px)`,
    transition: `opacity ${MOTION_GROUP_FADE_MS}ms ease-out, transform ${MOTION_GROUP_FADE_MS}ms ease-out`,
  }
}

/** Barra horizontal animada (largura + stagger). */
export function barFillStyle(
  pct: number,
  widthActive: boolean,
  barIndex: number,
  reduced: boolean,
  backgroundColor: string,
): CSSProperties {
  if (reduced) {
    return {
      width: `${pct}%`,
      height: '100%',
      backgroundColor,
      borderRadius: 3,
    }
  }
  return {
    width: widthActive ? `${pct}%` : '0%',
    height: '100%',
    backgroundColor,
    borderRadius: 3,
    transition: `width ${MOTION_BAR_WIDTH_MS}ms ease-out ${barIndex * MOTION_BAR_STAGGER_MS}ms`,
  }
}
