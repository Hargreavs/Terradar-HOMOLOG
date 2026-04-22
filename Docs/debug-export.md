# MapView.tsx

```tsx
import mapboxgl from 'mapbox-gl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { processosMock } from '../../data/processos.mock'
import { REGIME_COLORS, REGIME_LABELS, REGIME_LAYER_ORDER } from '../../lib/regimes'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import { ProcessoPopup } from './ProcessoPopup'
import { SearchBar } from './SearchBar'

function buildGeoJSON(processos: Processo[]) {
  return {
    type: 'FeatureCollection' as const,
    features: processos.map((p, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: {
        type: 'Polygon' as const,
        coordinates: p.geojson.geometry.coordinates,
      },
      properties: {
        id: p.id,
        regime: p.regime,
        numero: p.numero,
        substancia: p.substancia,
        titular: p.titular,
        area_ha: p.area_ha,
        uf: p.uf,
        municipio: p.municipio,
        risk_score: p.risk_score,
        color: REGIME_COLORS[p.regime] ?? '#888780',
      },
    })),
  }
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const hoveredFidRef = useRef<number | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    numero: '',
    substancia: '',
    area_ha: 0,
  })

  const filtros = useMapStore((s) => s.filtros)
  const processos = useMapStore((s) => s.processos)
  const flyTo = useMapStore((s) => s.flyTo)
  const clearFlyTo = useMapStore((s) => s.clearFlyTo)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (mapRef.current || !el) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.error('VITE_MAPBOX_TOKEN em falta')
      return
    }

    let cancelled = false
    let ro: ResizeObserver | null = null
    let rafId = 0
    let attempts = 0
    const maxAttempts = 200

    const dispose = () => {
      ro?.disconnect()
      ro = null
      const m = mapRef.current
      if (m) {
        m.remove()
        mapRef.current = null
      }
    }

    const mountMap = () => {
      if (cancelled || mapRef.current) return
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 2 || h < 2) {
        attempts += 1
        if (attempts > maxAttempts) {
          console.error(
            'MapView: container sem dimensões após várias tentativas (verifique o layout flex/altura).',
          )
          return
        }
        rafId = requestAnimationFrame(mountMap)
        return
      }

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-52, -14],
        zoom: 4.2,
        /* GL JS v3: globe por defeito pode esconder fills GeoJSON sobre satélite */
        projection: 'mercator',
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

      mapRef.current = map

      ro = new ResizeObserver(() => {
        mapRef.current?.resize()
      })
      ro.observe(el)

      queueMicrotask(() => mapRef.current?.resize())

      map.on('load', () => {
        mapRef.current?.resize()
        requestAnimationFrame(() => {
          mapRef.current?.resize()
          setTimeout(() => mapRef.current?.resize(), 50)
        })

        const geoJSONDebug = buildGeoJSON(processosMock)
        console.log('Total features:', geoJSONDebug.features.length)
        console.log('Primeiro feature:', JSON.stringify(geoJSONDebug.features[0], null, 2))

        const filtrados = useMapStore.getState().getProcessosFiltrados()
        const fc = buildGeoJSON(filtrados)

        map.addSource('processos', {
          type: 'geojson',
          data: fc,
        })

        const firstLabelLayer = map
          .getStyle()
          .layers?.find((layer) => layer.type === 'symbol')?.id
        console.log('firstLabelLayer:', firstLabelLayer)

        map.addLayer(
          {
            id: 'processos-fill',
            type: 'fill',
            source: 'processos',
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#888780'],
              'fill-opacity': 0.45,
            },
          },
          firstLabelLayer,
        )

        map.addLayer(
          {
            id: 'processos-outline',
            type: 'line',
            source: 'processos',
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#888780'],
              'line-width': 1.5,
              'line-opacity': 1,
            },
          },
          firstLabelLayer,
        )

        const clearHover = () => {
          const canvas = map.getCanvas()
          canvas.style.cursor = ''
          if (hoveredFidRef.current !== null) {
            try {
              map.setFeatureState(
                { source: 'processos', id: hoveredFidRef.current },
                { hover: false },
              )
            } catch {
              /* ignore */
            }
          }
          hoveredFidRef.current = null
          setTooltip((t) => ({ ...t, visible: false }))
          useMapStore.getState().setHoveredProcessoId(null)
        }

        map.on('mousemove', (e) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: ['processos-fill'],
          })
          const canvas = map.getCanvas()

          if (!feats.length) {
            clearHover()
            return
          }

          canvas.style.cursor = 'pointer'

          const feature = feats[0]
          const props = feature.properties as Record<string, unknown>
          const fid =
            typeof feature.id === 'number'
              ? feature.id
              : Number(feature.id)

          if (hoveredFidRef.current !== null && hoveredFidRef.current !== fid) {
            try {
              map.setFeatureState(
                { source: 'processos', id: hoveredFidRef.current },
                { hover: false },
              )
            } catch {
              /* ignore */
            }
          }

          hoveredFidRef.current = fid
          try {
            map.setFeatureState({ source: 'processos', id: fid }, { hover: true })
          } catch {
            /* ignore */
          }

          const storeId = String(props.id ?? '')
          useMapStore.getState().setHoveredProcessoId(storeId || null)

          const areaHa =
            typeof props.area_ha === 'number'
              ? props.area_ha
              : Number(props.area_ha) || 0

          setTooltip({
            visible: true,
            x: e.point.x,
            y: e.point.y,
            numero: String(props.numero ?? ''),
            substancia: String(props.substancia ?? ''),
            area_ha: areaHa,
          })
        })

        map.on('click', (e) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: ['processos-fill'],
          })
          const id = feats[0]?.properties?.id as string | undefined
          if (!id) {
            useMapStore.getState().selecionarProcesso(null)
            return
          }
          const proc = useMapStore.getState().processos.find((x) => x.id === id)
          if (proc) {
            useMapStore
              .getState()
              .selecionarProcesso(proc, { x: e.point.x, y: e.point.y })
          }
        })

        if (!cancelled) setMapLoaded(true)
      })
    }

    mountMap()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      dispose()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapLoaded || !map?.isStyleLoaded()) return
    const src = map.getSource('processos') as mapboxgl.GeoJSONSource | undefined
    if (!src) return

    if (hoveredFidRef.current !== null) {
      try {
        map.setFeatureState(
          { source: 'processos', id: hoveredFidRef.current },
          { hover: false },
        )
      } catch {
        /* ignore */
      }
      hoveredFidRef.current = null
    }
    setTooltip((t) => ({ ...t, visible: false }))

    const filtrados = useMapStore.getState().getProcessosFiltrados()
    src.setData(buildGeoJSON(filtrados))
  }, [filtros, processos, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom, essential: true })
    clearFlyTo()
  }, [flyTo, clearFlyTo])

  return (
    <div className="relative isolate h-full min-h-0 w-full bg-dark-primary">
      <div ref={containerRef} className="absolute inset-0 z-0 min-h-0 w-full overflow-hidden" />
      <SearchBar />
      <ProcessoPopup />
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-30 max-w-[280px] text-[12px] leading-snug text-[#F1EFE8] shadow-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 40,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #2C2C2A',
            background: '#1A1A18',
          }}
        >
          <div className="font-medium">{tooltip.numero}</div>
          <div className="text-[#F1EFE8]">{tooltip.substancia}</div>
          <div className="mt-0.5 text-[#F1EFE8]">
            {tooltip.area_ha.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ha
          </div>
        </div>
      )}
      <div
        className="pointer-events-none absolute bottom-10 right-2 z-10 rounded-lg border border-dark-border px-4 py-4 text-[13px] text-[#888780]"
        style={{
          background: 'rgba(17, 17, 16, 0.9)',
          borderRadius: 8,
        }}
      >
        <p className="mb-2.5 text-[12px] font-medium uppercase tracking-[2px] text-[#5F5E5A]">
          Legenda
        </p>
        <ul className="flex flex-col gap-2">
          {REGIME_LAYER_ORDER.map((r) => (
            <li key={r} className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: REGIME_COLORS[r] }}
              />
              <span className="text-[13px] leading-snug text-[#F1EFE8]">
                {REGIME_LABELS[r]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

```

# processos.mock.ts

```tsx
import type { GeoJSONPolygon, Processo } from '../types'

type RawProcesso = Omit<Processo, 'geojson'>

function makePolygon(lat: number, lng: number, id: string): GeoJSONPolygon {
  const w = 0.08
  const h = 0.06
  return {
    type: 'Feature',
    id,
    properties: { id },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng - w, lat - h],
          [lng + w, lat - h],
          [lng + w, lat + h],
          [lng - w, lat + h],
          [lng - w, lat - h],
        ],
      ],
    },
  } as GeoJSONPolygon
}

const rawProcessos: RawProcesso[] = [
  {
    id: 'p1',
    numero: '872.390/2012',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 1240.5,
    uf: 'MG',
    municipio: 'Itabira',
    lat: -19.62,
    lng: -43.22,
    data_protocolo: '2012-03-14',
    ano_protocolo: 2012,
    situacao: 'ativo',
    risk_score: 42,
  },
  {
    id: 'p2',
    numero: '841.102/2008',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 892.3,
    uf: 'MG',
    municipio: 'Nova Lima',
    lat: -19.98,
    lng: -43.85,
    data_protocolo: '2008-07-22',
    ano_protocolo: 2008,
    situacao: 'ativo',
    risk_score: 67,
  },
  {
    id: 'p3',
    numero: '910.445/2019',
    regime: 'concessao_lavra',
    fase: 'concessao',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 2104.0,
    uf: 'MG',
    municipio: 'Poços de Caldas',
    lat: -21.78,
    lng: -46.57,
    data_protocolo: '2019-11-05',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 31,
  },
  {
    id: 'p4',
    numero: '798.201/2001',
    regime: 'concessao_lavra',
    fase: 'encerrado',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 456.7,
    uf: 'MG',
    municipio: 'Curvelo',
    lat: -18.76,
    lng: -44.43,
    data_protocolo: '2001-04-18',
    ano_protocolo: 2001,
    situacao: 'inativo',
    risk_score: 18,
  },
  {
    id: 'p5',
    numero: '883.667/2015',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 334.2,
    uf: 'MG',
    municipio: 'Congonhas',
    lat: -20.5,
    lng: -43.86,
    data_protocolo: '2015-09-30',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 55,
  },
  {
    id: 'p6',
    numero: '756.012/1995',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 982.0,
    uf: 'MG',
    municipio: 'João Monlevade',
    lat: -19.81,
    lng: -43.17,
    data_protocolo: '1995-02-10',
    ano_protocolo: 1995,
    situacao: 'ativo',
    risk_score: 48,
  },
  {
    id: 'p7',
    numero: '901.223/2018',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 1205.4,
    uf: 'MG',
    municipio: 'Mariana',
    lat: -20.38,
    lng: -43.41,
    data_protocolo: '2018-06-12',
    ano_protocolo: 2018,
    situacao: 'ativo',
    risk_score: 72,
  },
  {
    id: 'p8',
    numero: '822.556/2005',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 678.9,
    uf: 'MG',
    municipio: 'Ouro Preto',
    lat: -20.39,
    lng: -43.5,
    data_protocolo: '2005-08-25',
    ano_protocolo: 2005,
    situacao: 'ativo',
    risk_score: 39,
  },
  {
    id: 'p9',
    numero: '934.881/2021',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 445.1,
    uf: 'MG',
    municipio: 'Paracatu',
    lat: -17.22,
    lng: -46.87,
    data_protocolo: '2021-01-19',
    ano_protocolo: 2021,
    situacao: 'ativo',
    risk_score: 61,
  },
  {
    id: 'p10',
    numero: '888.334/2016',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 512.6,
    uf: 'GO',
    municipio: 'Catalão',
    lat: -18.17,
    lng: -47.95,
    data_protocolo: '2016-10-03',
    ano_protocolo: 2016,
    situacao: 'ativo',
    risk_score: 44,
  },
  {
    id: 'p11',
    numero: '845.991/2009',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 1334.8,
    uf: 'GO',
    municipio: 'Cristalina',
    lat: -16.77,
    lng: -47.61,
    data_protocolo: '2009-05-27',
    ano_protocolo: 2009,
    situacao: 'ativo',
    risk_score: 53,
  },
  {
    id: 'p12',
    numero: '912.007/2019',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 721.3,
    uf: 'GO',
    municipio: 'Niquelândia',
    lat: -14.47,
    lng: -48.46,
    data_protocolo: '2019-04-08',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 58,
  },
  {
    id: 'p13',
    numero: '771.448/1998',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 889.0,
    uf: 'GO',
    municipio: 'Mineiros',
    lat: -17.57,
    lng: -52.55,
    data_protocolo: '1998-12-14',
    ano_protocolo: 1998,
    situacao: 'ativo',
    risk_score: 36,
  },
  {
    id: 'p14',
    numero: '925.112/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 1567.2,
    uf: 'PA',
    municipio: 'Parauapebas',
    lat: -6.07,
    lng: -49.9,
    data_protocolo: '2020-08-21',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 74,
  },
  {
    id: 'p15',
    numero: '918.556/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 623.5,
    uf: 'PA',
    municipio: 'Tucumã',
    lat: -6.75,
    lng: -51.16,
    data_protocolo: '2020-03-02',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 81,
  },
  {
    id: 'p16',
    numero: '867.201/2013',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 412.8,
    uf: 'PA',
    municipio: 'Canãa dos Carajás',
    lat: -6.5,
    lng: -49.88,
    data_protocolo: '2013-11-11',
    ano_protocolo: 2013,
    situacao: 'ativo',
    risk_score: 69,
  },
  {
    id: 'p17',
    numero: '806.778/2003',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 2341.0,
    uf: 'PA',
    municipio: 'Marabá',
    lat: -5.37,
    lng: -49.12,
    data_protocolo: '2003-07-07',
    ano_protocolo: 2003,
    situacao: 'ativo',
    risk_score: 77,
  },
  {
    id: 'p18',
    numero: '895.334/2017',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'NIQUEL',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 298.4,
    uf: 'GO',
    municipio: 'Goiânia',
    lat: -16.68,
    lng: -49.25,
    data_protocolo: '2017-02-28',
    ano_protocolo: 2017,
    situacao: 'ativo',
    risk_score: 41,
  },
  {
    id: 'p19',
    numero: '879.901/2015',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 156.2,
    uf: 'GO',
    municipio: 'Rio Verde',
    lat: -17.8,
    lng: -50.92,
    data_protocolo: '2015-12-01',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 29,
  },
  {
    id: 'p20',
    numero: '802.445/2002',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 887.6,
    uf: 'GO',
    municipio: 'Jataí',
    lat: -17.88,
    lng: -51.72,
    data_protocolo: '2002-09-09',
    ano_protocolo: 2002,
    situacao: 'ativo',
    risk_score: 52,
  },
  {
    id: 'p21',
    numero: '940.001/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NEODIMIO',
    is_mineral_estrategico: true,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 198.3,
    uf: 'GO',
    municipio: 'Catalão',
    lat: -18.22,
    lng: -47.88,
    data_protocolo: '2022-05-16',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 84,
  },
  {
    id: 'p22',
    numero: '941.002/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NIOBIO',
    is_mineral_estrategico: true,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 176.5,
    uf: 'MG',
    municipio: 'Araxá',
    lat: -19.6,
    lng: -46.94,
    data_protocolo: '2022-06-20',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 79,
  },
  {
    id: 'p23',
    numero: '942.003/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'LITIO',
    is_mineral_estrategico: true,
    titular: 'St. George Mining Brasil',
    area_ha: 245.0,
    uf: 'MG',
    municipio: 'Araçuaí',
    lat: -16.85,
    lng: -42.07,
    data_protocolo: '2023-01-11',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 87,
  },
  {
    id: 'p24',
    numero: '943.004/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'DISPROSIO',
    is_mineral_estrategico: true,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 132.7,
    uf: 'PA',
    municipio: 'Santarém',
    lat: -2.44,
    lng: -54.71,
    data_protocolo: '2023-08-30',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 82,
  },
  {
    id: 'p25',
    numero: '650.100/1987',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 88.0,
    uf: 'MG',
    municipio: 'Ouro Preto',
    lat: -20.41,
    lng: -43.51,
    data_protocolo: '1987-04-22',
    ano_protocolo: 1987,
    situacao: 'bloqueado',
    risk_score: null,
  },
  {
    id: 'p26',
    numero: '651.101/1991',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 120.4,
    uf: 'PA',
    municipio: 'Itaituba',
    lat: -4.28,
    lng: -55.99,
    data_protocolo: '1991-09-05',
    ano_protocolo: 1991,
    situacao: 'bloqueado',
    risk_score: null,
  },
  {
    id: 'p27',
    numero: '652.102/1994',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 64.2,
    uf: 'GO',
    municipio: 'Formosa',
    lat: -15.54,
    lng: -47.33,
    data_protocolo: '1994-12-18',
    ano_protocolo: 1994,
    situacao: 'bloqueado',
    risk_score: null,
  },
  {
    id: 'p28',
    numero: '960.501/2024',
    regime: 'bloqueio_provisorio',
    fase: 'lavra',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 310.9,
    uf: 'MG',
    municipio: 'Belo Horizonte',
    lat: -19.92,
    lng: -43.94,
    data_protocolo: '2024-02-14',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: null,
  },
  {
    id: 'p29',
    numero: '961.502/2024',
    regime: 'bloqueio_provisorio',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 205.6,
    uf: 'PA',
    municipio: 'Redenção',
    lat: -8.03,
    lng: -50.03,
    data_protocolo: '2024-05-22',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: null,
  },
  {
    id: 'p30',
    numero: '962.503/2024',
    regime: 'bloqueio_provisorio',
    fase: 'requerimento',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 142.1,
    uf: 'GO',
    municipio: 'Águas Lindas de Goiás',
    lat: -15.76,
    lng: -48.28,
    data_protocolo: '2024-10-01',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: null,
  },
]

export const processosMock: Processo[] = rawProcessos.map((p) => ({
  ...p,
  geojson: makePolygon(p.lat, p.lng, p.id),
}))

export const PROCESSOS_MOCK = processosMock

```

# useMapStore.ts

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PROCESSOS_MOCK } from '../data/processos.mock'
import type { FiltrosState, Processo, Regime } from '../types'

const LS_PROCESSOS = 'terrae-processos'

const REGIMES: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
]

function defaultCamadas(): Record<Regime, boolean> {
  return REGIMES.reduce(
    (acc, r) => {
      acc[r] = true
      return acc
    },
    {} as Record<Regime, boolean>,
  )
}

function defaultFiltros(): FiltrosState {
  return {
    camadas: defaultCamadas(),
    substancias: [],
    periodo: [1960, 2026],
    uf: null,
    municipio: null,
    riskScoreMin: 0,
    riskScoreMax: 100,
    searchQuery: '',
  }
}

function loadProcessosFromStorage(): Processo[] {
  try {
    const raw = localStorage.getItem(LS_PROCESSOS)
    if (raw) {
      const parsed = JSON.parse(raw) as Processo[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    /* ignore */
  }
  localStorage.setItem(LS_PROCESSOS, JSON.stringify(PROCESSOS_MOCK))
  return PROCESSOS_MOCK
}

const NUMERO_RX = /\d{3}\.\d{3}\/\d{4}/

export interface MapStore {
  processos: Processo[]
  filtros: FiltrosState
  processoSelecionado: Processo | null
  popupScreenPos: { x: number; y: number } | null
  flyTo: { lat: number; lng: number; zoom: number } | null
  hoveredProcessoId: string | null

  setFiltro: <K extends keyof FiltrosState>(
    key: K,
    value: FiltrosState[K],
  ) => void
  toggleCamada: (regime: Regime) => void
  selecionarProcesso: (
    processo: Processo | null,
    screenPos?: { x: number; y: number } | null,
  ) => void
  setHoveredProcessoId: (id: string | null) => void
  getProcessosFiltrados: () => Processo[]
  requestFlyTo: (lat: number, lng: number, zoom?: number) => void
  clearFlyTo: () => void
}

function applyFilters(processos: Processo[], f: FiltrosState): Processo[] {
  const q = f.searchQuery.trim().toLowerCase()
  const numeroMatch = q.match(NUMERO_RX)?.[0]

  return processos.filter((p) => {
    if (!f.camadas[p.regime]) return false

    const [y0, y1] = f.periodo
    if (p.ano_protocolo < y0 || p.ano_protocolo > y1) return false

    if (f.uf && p.uf !== f.uf) return false

    if (f.municipio) {
      const m = f.municipio.toLowerCase()
      if (!p.municipio.toLowerCase().includes(m)) return false
    }

    if (p.risk_score === null) {
      /* bloqueados: não filtrar por faixa numérica */
    } else if (
      p.risk_score < f.riskScoreMin ||
      p.risk_score > f.riskScoreMax
    ) {
      return false
    }

    if (f.substancias.length > 0) {
      const sub = p.substancia.toUpperCase()
      if (!f.substancias.map((s) => s.toUpperCase()).includes(sub))
        return false
    }

    if (q.length > 0) {
      if (numeroMatch && p.numero.includes(numeroMatch.replace(/\s/g, ''))) {
        /* ok */
      } else if (numeroMatch) {
        return false
      } else {
        const blob = `${p.numero} ${p.titular} ${p.municipio} ${p.uf} ${p.substancia}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
    }

    return true
  })
}

export const useMapStore = create<MapStore>()(
  persist(
    (set, get) => ({
      processos: loadProcessosFromStorage(),
      filtros: defaultFiltros(),
      processoSelecionado: null,
      popupScreenPos: null,
      flyTo: null,
      hoveredProcessoId: null,

      setFiltro: (key, value) =>
        set((s) => ({
          filtros: { ...s.filtros, [key]: value },
        })),

      toggleCamada: (regime) =>
        set((s) => ({
          filtros: {
            ...s.filtros,
            camadas: {
              ...s.filtros.camadas,
              [regime]: !s.filtros.camadas[regime],
            },
          },
        })),

      selecionarProcesso: (processo, screenPos = null) =>
        set({
          processoSelecionado: processo,
          popupScreenPos: screenPos,
        }),

      setHoveredProcessoId: (id) => set({ hoveredProcessoId: id }),

      getProcessosFiltrados: () =>
        applyFilters(get().processos, get().filtros),

      requestFlyTo: (lat, lng, zoom = 9) => set({ flyTo: { lat, lng, zoom } }),

      clearFlyTo: () => set({ flyTo: null }),
    }),
    {
      name: 'terrae-filtros',
      partialize: (s) => ({ filtros: s.filtros }),
      merge: (persistedState, currentState) => {
        const saved = persistedState as { filtros?: Partial<FiltrosState> } | undefined
        const filtros: FiltrosState = {
          ...defaultFiltros(),
          ...saved?.filtros,
          camadas: {
            ...defaultCamadas(),
            ...saved?.filtros?.camadas,
          },
        }
        return {
          ...currentState,
          filtros,
          processos: loadProcessosFromStorage(),
        }
      },
    },
  ),
)

export { REGIMES }

```

# index.ts

```ts
export type Regime =
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'licenciamento'
  | 'mineral_estrategico'
  | 'bloqueio_permanente'
  | 'bloqueio_provisorio'

export type Fase =
  | 'requerimento'
  | 'pesquisa'
  | 'concessao'
  | 'lavra'
  | 'encerrado'

export interface Processo {
  id: string
  numero: string
  regime: Regime
  fase: Fase
  substancia: string
  is_mineral_estrategico: boolean
  titular: string
  area_ha: number
  uf: string
  municipio: string
  lat: number
  lng: number
  data_protocolo: string
  ano_protocolo: number
  situacao: 'ativo' | 'inativo' | 'bloqueado'
  risk_score: number | null
  geojson: GeoJSONPolygon
}

export interface GeoJSONPolygon {
  type: 'Feature'
  properties: { id: string }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export interface FiltrosState {
  camadas: Record<Regime, boolean>
  substancias: string[]
  periodo: [number, number]
  uf: string | null
  municipio: string | null
  riskScoreMin: number
  riskScoreMax: number
  searchQuery: string
}

```
