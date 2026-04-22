import type { Map as MapboxMap } from 'mapbox-gl'
import mapboxgl from 'mapbox-gl'
import { fetchTerritorialLines } from './mapTerritorialLines'
import type { LineString } from 'geojson'

/**
 * Captura snapshot PNG do mapa para embed no PDF da Fase 2.
 *
 * Fluxo:
 * 1. Salva estado atual (center, zoom, bearing, pitch).
 * 2. Busca linhas territoriais do processo via fetchTerritorialLines.
 * 3. Monta bbox envolvendo polígono + endpoints das linhas.
 * 4. Chama fitBounds com padding conservador.
 * 5. Espera 'idle' do Mapbox (render concluído).
 * 6. Captura canvas via toDataURL('image/png').
 * 7. Restaura estado original (jumpTo sem animação).
 *
 * Requer que o Mapbox tenha sido inicializado com preserveDrawingBuffer: true
 * (vide MapView.tsx / mountMap).
 *
 * NOTA P4-C (Fase 2): esta função NÃO mexe em visibilidade de layers de
 * linhas territoriais. Assume-se que o caller focou o processo via
 * selecionarProcesso(...) e que o efeito em MapView já deixou as linhas
 * visíveis antes de chamar captureProcessoMapView. Se a inspeção de
 * MapView mostrar que isso NÃO acontece automaticamente, aplicar P4-B
 * aqui (ler estado atual dos layers, forçar visível pra captura,
 * restaurar no finally junto com o jumpTo).
 */
export interface MapSnapshotResult {
  base64: string // string "iVBORw0KG..." sem prefixo "data:image/png;base64,"
  widthPx: number
  heightPx: number
}

export async function captureProcessoMapView(
  numero: string,
  map: MapboxMap,
  processoGeom: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): Promise<MapSnapshotResult | null> {
  if (!map || !map.isStyleLoaded()) {
    console.warn('[mapSnapshot] Mapa não está pronto (style não carregado)')
    return null
  }

  const prevCenter = map.getCenter()
  const prevZoom = map.getZoom()
  const prevBearing = map.getBearing()
  const prevPitch = map.getPitch()

  try {
    const fc = await fetchTerritorialLines(numero)

    const bounds = new mapboxgl.LngLatBounds()

    addPolygonToBounds(processoGeom, bounds)

    if (fc && Array.isArray(fc.features)) {
      for (const feat of fc.features) {
        if (feat.geometry?.type === 'LineString') {
          for (const coord of (feat.geometry as LineString).coordinates) {
            bounds.extend(coord as [number, number])
          }
        }
      }
    }

    if (bounds.isEmpty()) {
      console.warn('[mapSnapshot] Bounds vazio, abortando captura')
      return null
    }

    map.fitBounds(bounds, {
      padding: 60,
      animate: false,
      maxZoom: 10,
    })

    await waitForIdle(map)
    await sleep(300)

    const canvas = map.getCanvas()
    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')

    return {
      base64,
      widthPx: canvas.width,
      heightPx: canvas.height,
    }
  } catch (err) {
    console.error('[mapSnapshot] Erro na captura:', err)
    return null
  } finally {
    map.jumpTo({
      center: prevCenter,
      zoom: prevZoom,
      bearing: prevBearing,
      pitch: prevPitch,
    })
  }
}

function addPolygonToBounds(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  bounds: mapboxgl.LngLatBounds,
): void {
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) {
      for (const coord of ring) {
        bounds.extend(coord as [number, number])
      }
    }
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        for (const coord of ring) {
          bounds.extend(coord as [number, number])
        }
      }
    }
  }
}

function waitForIdle(map: MapboxMap, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs)
    map.once('idle', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
