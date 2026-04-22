import { useEffect, useLayoutEffect, useState } from 'react'
import type { Regime } from '../../types'
import { REGIME_COLORS, REGIME_LAYER_ORDER } from '../../lib/regimes'

export const MIN_Y = 1960
export const MAX_Y = 2026

/** Ordem canônica dos toggles do sidebar e contador "N de N tipos visíveis". */
export const REGIME_PILL_ORDER: Regime[] = REGIME_LAYER_ORDER

/** Cores das bolinhas do sidebar (alinhadas a `REGIME_COLORS` em `lib/regimes.ts`). */
export const REGIME_PILL_COLORS: Record<Regime, string> = REGIME_COLORS

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const PAINEL_SLIDE_MS = 200

/**
 * Abertura: useLayoutEffect garante commit com o painel fora da tela antes do 1.º paint;
 * dois rAF marcam setAnimar(true) só depois desse frame (transição estável).
 * Fecho: useEffect deixa correr a animação de saída antes de desmontar.
 */
export function usePainelFiltrosAnimation(aberto: boolean) {
  const [montado, setMontado] = useState(false)
  const [animar, setAnimar] = useState(false)

  useLayoutEffect(() => {
    if (!aberto) return
    setMontado(true)
    setAnimar(false)
    let cancelled = false
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (!cancelled) setAnimar(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      if (innerRaf) cancelAnimationFrame(innerRaf)
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) return
    setAnimar(false)
    const t = window.setTimeout(() => setMontado(false), PAINEL_SLIDE_MS)
    return () => clearTimeout(t)
  }, [aberto])

  return { montado, animar }
}
