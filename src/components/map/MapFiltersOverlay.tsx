import { useEffect, useLayoutEffect, useState } from 'react'
import type { Regime } from '../../types'

export const MIN_Y = 1960
export const MAX_Y = 2026

export const REGIME_PILL_ORDER: Regime[] = [
  'requerimento_pesquisa',
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'lavra_garimpeira',
  'registro_extracao',
  'disponibilidade',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

export const REGIME_PILL_COLORS: Record<Regime, string> = {
  requerimento_pesquisa: '#8FB4E0',
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  lavra_garimpeira: '#8B6F47',
  registro_extracao: '#6B8A9A',
  disponibilidade: '#5AB8B8',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

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
