import { useEffect, useRef, useState } from 'react'
import type { BBox, GeoJSONFeatureCollection } from './useMapLayer'

const EMPTY_FC: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

export interface ProcessoViewportProperties {
  numero: string
  titular: string | null
  cnpj_titular: string | null
  area_ha: number | null
  regime: string | null
  fase: string | null
  uf: string | null
  municipio: string | null
  substancia: string | null
  substancia_familia: string | null
  risk_score: number | null
  risk_label: string | null
  os_moderado: number | null
  ano_protocolo: number | null
  exigencia_pendente: boolean | null
  ultimo_evento_data: string | null
}

export interface UseProcessosViewportOptions {
  enabled: boolean
  bbox: BBox | null
  zoom: number
  limit?: number
  /** Debounce ms aplicado ao bbox/zoom (evita spam em pan contínuo). */
  debounceMs?: number
  /** Alinhado à sidebar; entra na query string e no RPC `situacao_regulatoria`. */
  exibirProcessosAtivos: boolean
  exibirProcessosInativos: boolean
}

/**
 * Fetch bbox-aware do endpoint /api/processos/viewport.
 * - Debounce padrão 200ms pra pan suave não disparar 20 requests.
 * - Aborta fetch anterior ao mudar bbox/zoom.
 * - Retorna FeatureCollection vazia quando disabled ou bbox nulo.
 * - Em falha, retorna null (chamador decide).
 */
export function useProcessosViewport({
  enabled,
  bbox,
  zoom,
  limit = 5000,
  debounceMs = 200,
  exibirProcessosAtivos,
  exibirProcessosInativos,
}: UseProcessosViewportOptions): GeoJSONFeatureCollection | null {
  const [data, setData] = useState<GeoJSONFeatureCollection | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !bbox) {
      abortRef.current?.abort()
      abortRef.current = null
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setData(EMPTY_FC)
      return
    }

    // debounce
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const qs = new URLSearchParams({
        bbox: bbox.join(','),
        zoom: String(Math.round(zoom)),
        limit: String(limit),
        exibirProcessosAtivos: String(exibirProcessosAtivos),
        exibirProcessosInativos: String(exibirProcessosInativos),
      })

      fetch(`/api/processos/viewport?${qs.toString()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((body: unknown) => {
          if (
            body &&
            typeof body === 'object' &&
            (body as GeoJSONFeatureCollection).type === 'FeatureCollection'
          ) {
            setData(body as GeoJSONFeatureCollection)
          } else {
            setData(EMPTY_FC)
          }
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') return
          console.warn('[useProcessosViewport] fetch falhou', e)
          setData(null)
        })
    }, debounceMs)

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [
    enabled,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
    zoom,
    limit,
    debounceMs,
    exibirProcessosAtivos,
    exibirProcessosInativos,
  ])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return data
}
