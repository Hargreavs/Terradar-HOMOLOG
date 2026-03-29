import { useEffect, useState } from 'react'

/**
 * Cada grupo passa a `true` após `baseDelayMs + índice * staggerMs`.
 * Com reduced motion, todos `true` imediatamente.
 */
export function useStaggeredEntrance(
  groupCount: number,
  options: {
    baseDelayMs: number
    staggerMs: number
    reducedMotion: boolean
    /** Ex.: voltar do Mapa para resultados já vistos, sem stagger. */
    skipAnimation?: boolean
  },
): boolean[] {
  const { baseDelayMs, staggerMs, reducedMotion, skipAnimation } = options

  const [visible, setVisible] = useState<boolean[]>(() =>
    Array.from({ length: groupCount }, () => reducedMotion || skipAnimation),
  )

  useEffect(() => {
    if (reducedMotion || skipAnimation) {
      setVisible(Array.from({ length: groupCount }, () => true))
      return
    }

    setVisible(Array.from({ length: groupCount }, () => false))
    const ids: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < groupCount; i++) {
      const id = window.setTimeout(() => {
        setVisible((prev) => {
          const next = [...prev]
          if (i < next.length) next[i] = true
          return next
        })
      }, baseDelayMs + i * staggerMs)
      ids.push(id)
    }
    return () => {
      for (const id of ids) clearTimeout(id)
    }
  }, [groupCount, baseDelayMs, staggerMs, reducedMotion, skipAnimation])

  return visible
}
