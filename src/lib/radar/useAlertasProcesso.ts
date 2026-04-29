import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AlertasProcessoResponse } from '../../types/alertasRadar'

/** Cache por `processos.id` (UUID). Evita refetch ao reabrir o drawer. */
const cacheMemoria = new Map<string, AlertasProcessoResponse>()

function extrairErroServidor(payload: unknown): string | null {
  if (
    payload != null &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string'
  )
    return (payload as { error: string }).error
  return null
}

function normalizaResposta(j: unknown): AlertasProcessoResponse {
  const o =
    j != null && typeof j === 'object' ? (j as Record<string, unknown>) : {}
  const total =
    typeof o.total === 'number' && Number.isFinite(o.total) ? Math.max(0, o.total) : 0
  const diretos = Array.isArray(o.diretos) ? (o.diretos as AlertasProcessoResponse['diretos']) : []
  const setoriais = Array.isArray(o.setoriais)
    ? (o.setoriais as AlertasProcessoResponse['setoriais'])
    : []
  return { total, diretos, setoriais }
}

async function fetchAlertasParaId(
  processoId: string,
  signal: AbortSignal,
): Promise<AlertasProcessoResponse> {
  const r = await fetch(
    `/api/processos/${encodeURIComponent(processoId)}/alertas`,
    { signal },
  )
  const body: unknown = await r.json().catch(() => ({}))
  if (!r.ok) {
    const srv = extrairErroServidor(body)
    throw new Error(srv ?? 'Não foi possível carregar alertas.')
  }
  const normalized = normalizaResposta(body)
  cacheMemoria.set(processoId, normalized)
  return normalized
}

export function useAlertasProcesso(processoId: string | null) {
  const [data, setData] = useState<AlertasProcessoResponse | null>(null)
  const [isLoading, setIsLoading] = useState(() =>
    Boolean(processoId && !cacheMemoria.has(processoId)),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!processoId) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    if (cacheMemoria.has(processoId)) {
      setData(cacheMemoria.get(processoId) ?? null)
      setIsLoading(false)
      setError(null)
      return
    }

    const ac = new AbortController()
    setData(null)
    setIsLoading(true)
    setError(null)

    void fetchAlertasParaId(processoId, ac.signal)
      .then((d) => {
        if (ac.signal.aborted) return
        setData(d)
        setIsLoading(false)
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        const msg =
          e instanceof Error ? e.message : 'Não foi possível carregar alertas.'
        setError(msg)
        setIsLoading(false)
      })

    return () => ac.abort()
  }, [processoId])

  const refetch = useCallback(() => {
    if (!processoId) return
    cacheMemoria.delete(processoId)
    setIsLoading(true)
    setError(null)

    void fetch(`/api/processos/${encodeURIComponent(processoId)}/alertas`)
      .then(async (r) => {
        const body: unknown = await r.json().catch(() => ({}))
        if (!r.ok) {
          const srv = extrairErroServidor(body)
          throw new Error(srv ?? 'Não foi possível carregar alertas.')
        }
        const normalized = normalizaResposta(body)
        cacheMemoria.set(processoId, normalized)
        setData(normalized)
        setIsLoading(false)
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : 'Não foi possível carregar alertas.'
        setError(msg)
        setIsLoading(false)
      })
  }, [processoId])

  return useMemo(
    () => ({ data, isLoading, error, refetch }),
    [data, isLoading, error, refetch],
  )
}
