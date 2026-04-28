import { useEffect, useState } from 'react'
import type { ScoreBreakdownPayload } from '../types/scoreBreakdown'

const scoreBreakdownCache = new Map<string, ScoreBreakdownPayload>()

type Failure = { processoId: string; msg: string }

export function useScoreBreakdown(processoId: string | null | undefined) {
  const id =
    typeof processoId === 'string' && processoId.trim() !== ''
      ? processoId.trim()
      : null

  const [, bumpRender] = useState(0)
  const [failure, setFailure] = useState<Failure | null>(null)

  /** Leituras diretas ao Map garantem segundo consumidor sempre sincronizado. */
  const data = id ? scoreBreakdownCache.get(id) ?? null : null
  const [fetching, setFetching] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- estado de rede + cache sincrono em Map */
  useEffect(() => {
    if (!id || scoreBreakdownCache.has(id)) {
      return
    }

    let cancelled = false
    setFetching(true)
    fetch(`/api/processos/${encodeURIComponent(id)}/score-breakdown`)
      .then(async (r) => {
        const json = (await r.json()) as ScoreBreakdownPayload & { error?: string }
        if (!r.ok) {
          throw new Error(
            typeof json.error === 'string' ? json.error : `HTTP ${r.status}`,
          )
        }
        return json
      })
      .then((json) => {
        if (cancelled) return
        scoreBreakdownCache.set(id, json)
        setFailure((f) => (f?.processoId === id ? null : f))
        bumpRender((n) => n + 1)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure({
          processoId: id,
          msg: e instanceof Error ? e.message : String(e),
        })
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })

    return () => {
      cancelled = true
      setFetching(false)
    }
  }, [id])
  /* eslint-enable react-hooks/set-state-in-effect */

  const loading = Boolean(id && !data && fetching)
  const error = failure?.processoId === id ? failure.msg : ''

  return {
    data,
    loading,
    error,
  }
}

export type ScoreBreakdownView = ReturnType<typeof useScoreBreakdown>
