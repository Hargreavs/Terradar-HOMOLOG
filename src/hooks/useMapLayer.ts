import { useEffect, useRef, useState } from 'react'

export type TipoCamada =
  | 'ti'
  | 'uc_pi'
  | 'uc_us'
  | 'quilombola'
  | 'aquifero'
  | 'bioma'
  | 'ferrovia'
  | 'rodovia'
  | 'hidrovia'
  | 'porto'

export type BBox = [number, number, number, number]

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: Array<Record<string, unknown>>
}

const EMPTY_FC: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

interface UseMapLayerOptions {
  tipo: TipoCamada
  enabled: boolean
  bbox: BBox | null
  zoom: number
  limit?: number
}

/**
 * Fetch bbox-aware do endpoint /api/map/layers/:tipo.
 * - Aborta fetch anterior quando bbox/zoom muda.
 * - Retorna FeatureCollection vazia quando disabled ou bbox nulo.
 * - Não lança erro; em falha retorna null (chamador decide).
 */
export function useMapLayer({
  tipo,
  enabled,
  bbox,
  zoom,
  limit = 500,
}: UseMapLayerOptions): GeoJSONFeatureCollection | null {
  const [data, setData] = useState<GeoJSONFeatureCollection | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !bbox) {
      setData(EMPTY_FC)
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const qs = new URLSearchParams({
      bbox: bbox.join(','),
      zoom: String(Math.round(zoom)),
      limit: String(limit),
    })

    fetch(`/api/map/layers/${tipo}?${qs.toString()}`, { signal: ctrl.signal })
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
        console.warn(`[useMapLayer:${tipo}] fetch falhou`, e)
        setData(null)
      })

    return () => ctrl.abort()
  }, [tipo, enabled, bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], zoom, limit])

  return data
}

