# TERRADAR - Extração: Popover + Risk Score Decomposição

**Onde foi gerado:** pasta `Docs/` — `Docs/terradar-extracao-popover-riskscore.md` (caminho absoluto: `C:\Users\alex-\Terrae\Docs\terradar-extracao-popover-riskscore.md`).

**Conteúdo:** (1) `ProcessoPopup.tsx` — UI do popover; (1b) `MapView.tsx` — integração Mapbox + `createRoot` no popup; (2) `RelatorioCompleto.tsx` na íntegra; (3) painel de decomposição + tooltips; (4) `riskScoreDecomposicao.ts` + `processos.mock.ts`; (5) `src/types/index.ts`. Conteúdo copiado sem edição; fences markdown usam linguagem `tsx` também para `.ts`.

## 1. Popover do Processo
**Arquivo:** `src/components/map/ProcessoPopup.tsx`
```tsx
import { useEffect, useState, type ReactNode } from 'react'
import {
  Building2,
  ChevronRight,
  Circle,
  MapPin,
  Scan,
  type LucideIcon,
} from 'lucide-react'
import { normalizeSubstanciaKey, SUBSTANCIA_DEFS } from '../../lib/substancias'
import { useMapStore } from '../../store/useMapStore'
import type { AlertaLegislativo, Processo } from '../../types'
import { TerraTooltipWrap } from '../ui/TerraSideTooltip'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import { RegimeBadge } from '../ui/RegimeBadge'

const POPUP_W = 300
const POPUP_Z = 1

const ICON_POPUP = { size: 16, color: '#888780' as const, strokeWidth: 1.5 }

/** Faixas: menor que 40 verde, 40 a 69 âmbar, 70 ou mais vermelho (barras e números). */
function riskTierColor(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v < 70) return '#E8A830'
  return '#E24B4A'
}

function substanciaIconForPopup(substancia: string): {
  Icon: LucideIcon
  color: string
} {
  const key = normalizeSubstanciaKey(substancia)
  const def = SUBSTANCIA_DEFS.find((d) => d.key === key)
  if (def) return { Icon: def.Icon, color: def.color }
  return { Icon: Circle, color: '#D3D1C7' }
}

function mensagemTooltipRiskScoreTotal(valor: number): string {
  const v = valor
  if (v < 40)
    return 'Risco baixo. Indicadores favoráveis nas principais dimensões. Área com bom perfil para investimento.'
  if (v <= 69)
    return 'Risco moderado. Nenhuma dimensão isolada é crítica, mas a combinação requer análise detalhada antes de investir.'
  return 'Risco elevado. Uma ou mais dimensões apresentam indicadores críticos. Recomenda-se análise aprofundada no relatório completo.'
}

function mensagemTooltipDimensao(
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio',
  valor: number,
): string {
  const v = valor
  if (dim === 'geologico') {
    if (v < 40)
      return 'Região com perfil geológico favorável e histórico de pesquisa ativo'
    if (v <= 69)
      return 'Potencial geológico moderado: dados de pesquisa mineral incompletos'
    return 'Risco geológico elevado: ausência de relatórios de pesquisa recentes'
  }
  if (dim === 'ambiental') {
    if (v < 40)
      return 'Sem sobreposição com áreas protegidas: licenciamento simplificado'
    if (v <= 69)
      return 'Área próxima a unidades de conservação: EIA/RIMA pode ser exigido'
    return 'Sobreposição com Terra Indígena ou UC de proteção integral identificada'
  }
  if (dim === 'social') {
    if (v < 40)
      return 'Município com baixo índice de conflitos fundiários registrados'
    if (v <= 69)
      return 'Histórico de conflitos rurais na região: monitoramento recomendado'
    return 'Alto índice de conflitos rurais (CPT) e criminalidade na região'
  }
  if (v < 40)
    return 'Processo sem pendências na ANM: legislação favorável para o regime'
  if (v <= 69)
    return 'Alertas regulatórios ativos podem impactar o cronograma do processo'
  return 'Múltiplas restrições regulatórias ativas: processo com alto risco de bloqueio'
}

function RiskBreakdownRowComTooltip({
  dim,
  val,
  children,
}: {
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio'
  val: number
  children: ReactNode
}) {
  return (
    <TerraTooltipWrap
      texto={mensagemTooltipDimensao(dim, val)}
      className="flex w-full min-w-0 cursor-default items-center gap-2"
    >
      {children}
    </TerraTooltipWrap>
  )
}

function RiskScoreBarraTotalComTooltip({
  valor,
  children,
}: {
  valor: number
  children: ReactNode
}) {
  return (
    <TerraTooltipWrap
      texto={mensagemTooltipRiskScoreTotal(valor)}
      className="min-w-0 flex-1 cursor-default"
    >
      {children}
    </TerraTooltipWrap>
  )
}

export type ProcessoPopupContentProps = {
  processo: Processo
  onClose: () => void
  onToggleRelatorioCompleto?: () => void
  /** Abre o relatório na aba Risco (alertas regulatórios). */
  onAbrirRelatorioAbaRisco?: () => void
  /** Navega para o Radar com o alerta selecionado no feed (Mapa). */
  onIrParaRadarAlerta?: (alerta: AlertaLegislativo) => void
  /** Mapa: fecha o popover e abre o Radar em home (ver todos os alertas). */
  onVerTodosAlertasRadar?: () => void
}

/** Conteúdo do popup (montado via ReactDOM.createRoot dentro de mapboxgl.Popup). */
export function ProcessoPopupContent({
  processo,
  onClose,
  onToggleRelatorioCompleto,
  onAbrirRelatorioAbaRisco,
  onVerTodosAlertasRadar,
}: ProcessoPopupContentProps) {
  const relatorioDrawerAberto = useMapStore((s) => s.relatorioDrawerAberto)
  const processoSelId = useMapStore((s) => s.processoSelecionado?.id)
  const relatorioAtivo =
    relatorioDrawerAberto && processoSelId === processo.id

  const r = processo.risk_score
  const { Icon: SubstIcon, color: substIconColor } = substanciaIconForPopup(
    processo.substancia,
  )

  const totalAlertas = processo.alertas.length

  const [riskScoreDetalheAberto, setRiskScoreDetalheAberto] = useState(false)
  useEffect(() => {
    setRiskScoreDetalheAberto(false)
  }, [processo.id])

  return (
    <div className="pointer-events-auto relative" style={{ width: POPUP_W }}>
      <div
        className="box-border overflow-hidden rounded-[10px] text-left"
        style={{
          position: 'relative',
          zIndex: POPUP_Z,
          width: POPUP_W,
          backgroundColor: '#1A1A18',
          border: '1px solid rgba(241, 239, 232, 0.12)',
          boxShadow:
            '0 4px 14px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="px-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[17px] font-bold leading-snug text-[#F1EFE8]">
              {processo.numero}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[18px] leading-none text-[#888780] transition-colors hover:text-[#D3D1C7]"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <RegimeBadge regime={processo.regime} variant="popup" className="mt-3" />
        </div>

        <div className="my-3 h-px w-full shrink-0 bg-[#2C2C2A]" aria-hidden />

        <div className="space-y-[10px] px-4">
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <MapPin
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={ICON_POPUP.color}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="leading-snug">
              {processo.uf} / {processo.municipio}
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <SubstIcon
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={substIconColor}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="inline-block leading-snug">
              <BadgeSubstancia substancia={processo.substancia} variant="popup" />
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <Scan
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={ICON_POPUP.color}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="leading-snug">
              {processo.area_ha.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ha
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <Building2
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={ICON_POPUP.color}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="leading-snug">{processo.titular}</span>
          </div>
        </div>

        <div className="my-3 h-px w-full shrink-0 bg-[#2C2C2A]" aria-hidden />

        <div className="px-4 pb-4">
          {r === null ? (
            <>
              <p className="mt-4 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]">
                Risk Score
              </p>
              <p className="text-[15px] font-medium text-[#E8E6DF]">N/A</p>
            </>
          ) : (
            <>
              <p className="mt-4 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]">
                Risk Score
              </p>
              <div className="flex w-full min-w-0 items-center gap-2">
                <RiskScoreBarraTotalComTooltip valor={r}>
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <div
                      className="min-w-0 flex-1 overflow-hidden rounded-sm"
                      style={{ height: 5, backgroundColor: '#2C2C2A' }}
                    >
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${Math.min(100, Math.max(0, r))}%`,
                          backgroundColor: riskTierColor(r),
                        }}
                      />
                    </div>
                    <span
                      className="w-[40px] shrink-0 text-right tabular-nums text-[15px] font-bold leading-none"
                      style={{ color: riskTierColor(r) }}
                    >
                      {r}
                    </span>
                  </div>
                </RiskScoreBarraTotalComTooltip>
                {processo.risk_breakdown ? (
                  <button
                    type="button"
                    className="flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent py-0 pr-1.5 pl-0 text-[#F1EFE8] transition-opacity hover:opacity-80"
                    aria-expanded={riskScoreDetalheAberto}
                    aria-label={
                      riskScoreDetalheAberto
                        ? 'Ocultar dimensões do Risk Score'
                        : 'Mostrar dimensões do Risk Score'
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setRiskScoreDetalheAberto((v) => !v)
                    }}
                  >
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                      className="transition-transform duration-150 ease-out"
                      style={{
                        transform: riskScoreDetalheAberto
                          ? 'rotate(90deg)'
                          : 'rotate(0deg)',
                      }}
                    />
                  </button>
                ) : null}
              </div>
              {processo.risk_breakdown && riskScoreDetalheAberto ? (
                <div
                  className={`mt-5 space-y-1.5 ${processo.alertas.length > 0 ? 'mb-5' : ''}`}
                >
                  {(
                    [
                      ['geologico', 'Geológico', processo.risk_breakdown.geologico],
                      ['ambiental', 'Ambiental', processo.risk_breakdown.ambiental],
                      ['social', 'Social', processo.risk_breakdown.social],
                      ['regulatorio', 'Regulatório', processo.risk_breakdown.regulatorio],
                    ] as const
                  ).map(([dim, label, val]) => {
                    const v = Math.min(100, Math.max(0, val))
                    const corVal = riskTierColor(val)
                    return (
                      <RiskBreakdownRowComTooltip key={dim} dim={dim} val={val}>
                        <span className="w-[112px] shrink-0 text-[15px] text-[#888780]">
                          {label}
                        </span>
                        <div
                          className="min-w-0 flex-1 overflow-hidden rounded-sm"
                          style={{ height: 3, backgroundColor: '#2C2C2A' }}
                        >
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${v}%`,
                              backgroundColor: corVal,
                            }}
                          />
                        </div>
                        <span
                          className="w-[40px] shrink-0 text-right tabular-nums text-[15px] font-medium"
                          style={{ color: corVal }}
                        >
                          {val}
                        </span>
                      </RiskBreakdownRowComTooltip>
                    )
                  })}
                  {onAbrirRelatorioAbaRisco ? (
                    <button
                      type="button"
                      className="mt-3 box-border w-full cursor-pointer border-0 bg-transparent p-0 text-center text-[15px] transition-opacity hover:opacity-80"
                      style={{ color: '#F1B85A' }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onAbrirRelatorioAbaRisco()
                      }}
                    >
                      Ver decomposição completa
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          {totalAlertas > 0 && onVerTodosAlertasRadar ? (
            <>
              <div
                className="-mx-4 my-3 h-px shrink-0 bg-[#2C2C2A]"
                aria-hidden
              />
              <div className="flex min-w-0 flex-col">
                <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]">
                  Alertas regulatórios
                </span>
                <button
                  type="button"
                  className="mt-2 flex w-full cursor-pointer items-center justify-between border-0 bg-transparent py-0 pl-0 pr-1.5 text-left text-[15px] transition-opacity hover:opacity-80"
                  style={{ color: '#F1B85A' }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onVerTodosAlertasRadar()
                  }}
                  aria-label={`Ver todos os ${totalAlertas} alertas no Radar`}
                >
                  <span className="min-w-0" style={{ color: '#F1B85A' }}>
                    {`Ver todos os ${totalAlertas} alertas`}
                  </span>
                  <ChevronRight
                    size={14}
                    strokeWidth={2}
                    className="shrink-0"
                    style={{ color: '#F1B85A' }}
                    aria-hidden
                  />
                </button>
              </div>
            </>
          ) : null}

          <button
            type="button"
            className="mt-5 w-full cursor-pointer rounded-lg border-0 px-0 py-3 text-[14px] font-semibold transition-[background-color] duration-200 ease-in-out"
            style={{
              color: '#0D0D0C',
              backgroundColor: relatorioAtivo ? '#F1B85A' : '#EF9F27',
            }}
            onMouseEnter={(e) => {
              if (!relatorioAtivo) e.currentTarget.style.backgroundColor = '#F1B85A'
            }}
            onMouseLeave={(e) => {
              if (!relatorioAtivo) e.currentTarget.style.backgroundColor = '#EF9F27'
            }}
            onClick={() => onToggleRelatorioCompleto?.()}
          >
            Ver relatório completo
          </button>
        </div>
      </div>
    </div>
  )
}
```

## 1b. Integração Mapbox — popup de processo (candidato adicional)
**Arquivo:** `src/components/map/MapView.tsx`

```tsx
import mapboxgl from 'mapbox-gl'
import { type Root, createRoot } from 'react-dom/client'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { CAMADAS_GEO_JSON } from '../../data/camadas/geoImport'
import { useMapChromeTransition } from '../../context/MapChromeTransitionContext'
import {
  dispatchTerraeMapClearFloatingUi,
  TERRAE_MAP_CLEAR_FLOATING_UI,
} from '../../lib/mapFloatingUiEvents'
import {
  CAMADA_GEO_HOVER_LAYER_IDS,
  CAMADAS_GEO_COLOR,
  CAMADAS_GEO_LABEL,
  CAMADAS_GEO_LEGEND_ORDER,
  addCamadasGeoLayers,
  formatCamadaGeoTooltip,
  syncCamadasGeoVisibility,
} from '../../lib/mapCamadasGeo'
import { countFiltrosAlterados } from '../../lib/mapFiltrosCount'
import {
  REGIME_BADGE_TOOLTIP,
  REGIME_COLORS,
  REGIME_COLORS_MAP,
  REGIME_LABELS,
} from '../../lib/regimes'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import {
  BRAZIL_BOUNDS_LNG_LAT,
  boundsFromProcessos,
  boundsFromSingleProcesso,
  cloneFiltrosState,
  fingerprintDrillFiltros,
} from '../../lib/intelMapDrill'
import { FAMILIA_MINERAL_DEFS, corPorFamilia } from '../../lib/substanciaFamilias'
import { normalizeSubstanciaKey } from '../../lib/substancias'
import { ufBoundsLngLat, ufNomeOuSigla } from '../../lib/ufBounds'
import { useAppStore } from '../../store/useAppStore'
import {
  REGIMES,
  useMapStore,
  type MapStore,
  type PendingNavigation,
} from '../../store/useMapStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  MOTION_MAP_INTRO_DURATION_MS,
  MOTION_MAP_INTRO_LEGEND_DELAY_MS,
  MOTION_MAP_INTRO_SEARCH_DELAY_MS,
  MOTION_MAP_INTRO_THEME_DELAY_MS,
  motionMs,
} from '../../lib/motionDurations'
import type { AlertaLegislativo, Processo, Regime } from '../../types'
import { radarFeedIdParaAlertaProcesso } from '../../lib/radarFeedIdFromProcessoAlerta'
import {
  MAPBOX_STYLE_SATELLITE,
  MapStyleSwitcher,
} from './MapStyleSwitcher'
import { usePainelFiltrosAnimation } from './MapFiltersOverlay'
import { MapSearchBar } from './MapSearchBar'
import { MapSidebar } from './MapSidebar'
import { ProcessoPopupContent } from './ProcessoPopup'
import { RelatorioCompleto } from './RelatorioCompleto'

type ModoVisualizacao = 'regime' | 'risco' | 'substancia'

/** Largura fixa da sidebar de filtros + margem para o mapa alinhar fitBounds/flyTo. */
const INTEL_SIDEBAR_FALLBACK_WIDTH_PX = 288
const INTEL_SIDEBAR_MAP_MARGIN_PX = 44

function getIntelLeftReservePx(): number {
  const el = document.querySelector('[data-terrae-map-filter-sidebar]')
  if (el instanceof HTMLElement) {
    const w = el.offsetWidth
    if (Number.isFinite(w) && w > 0) {
      return Math.round(w + INTEL_SIDEBAR_MAP_MARGIN_PX)
    }
  }
  return INTEL_SIDEBAR_FALLBACK_WIDTH_PX + INTEL_SIDEBAR_MAP_MARGIN_PX
}

/** Espera layout do painel (após `setPainelFiltrosAberto(true)`) para medir a sidebar. */
function afterFilterSidebarLayout(fn: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}

function corPorRisco(p: Processo): string {
  if (p.risk_score === null) return '#444441'
  const v = p.risk_score
  if (v >= 0 && v <= 39) return '#1D9E75'
  if (v >= 40 && v <= 69) return '#E8A830'
  if (v >= 70 && v <= 100) return '#E24B4A'
  if (v < 0) return '#1D9E75'
  return '#E24B4A'
}

function buildGeoJSON(processos: Processo[], modoVisualizacao: ModoVisualizacao) {
  return {
    type: 'FeatureCollection' as const,
    features: processos
      .filter((p) => (p.geojson?.geometry?.coordinates?.length ?? 0) > 0)
      .map((p, i) => ({
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
          color:
            modoVisualizacao === 'risco'
              ? corPorRisco(p)
              : modoVisualizacao === 'substancia'
                ? corPorFamilia(p.substancia)
                : (REGIME_COLORS_MAP[p.regime] ?? '#888780'),
        },
      })),
  }
}

const LEGENDA_RISCO_ITEMS: { color: string; label: string }[] = [
  { color: '#1D9E75', label: 'Baixo risco (0–39)' },
  { color: '#E8A830', label: 'Risco médio (40–69)' },
  { color: '#E24B4A', label: 'Alto risco (70–100)' },
  { color: '#444441', label: 'Não calculado' },
]

/** Dessaturação + brilho do satellite; ignorado em dark/streets. */
function applySatelliteRasterAdjustments(map: mapboxgl.Map, styleUrl: string) {
  if (styleUrl !== MAPBOX_STYLE_SATELLITE) return
  const style = map.getStyle()
  if (!style?.layers) return
  for (const layer of style.layers) {
    if (layer.type !== 'raster' || !layer.id) continue
    try {
      map.setPaintProperty(layer.id, 'raster-saturation', -0.45)
      map.setPaintProperty(layer.id, 'raster-brightness-max', 0.87)
      map.setPaintProperty(layer.id, 'raster-contrast', 0.1)
    } catch {
      /* raster sem suporte a alguma propriedade */
    }
  }
}

/** IDs conhecidos em `satellite-streets-v12` (composite / place_label). */
const SATELLITE_ADMIN1_LINE_LAYERS = ['admin-1-boundary'] as const
const SATELLITE_ADMIN0_LINE_LAYERS = [
  'admin-0-boundary',
  'admin-0-boundary-disputed',
] as const
const SATELLITE_PLACE_LABEL_LAYERS = [
  'settlement-subdivision-label',
  'settlement-minor-label',
  'settlement-major-label',
  'state-label',
  'country-label',
] as const

/** `name_pt` quando existir nos tiles; fallback Mapbox padrão. */
const PLACE_LABEL_TEXT_FIELD_PT: mapboxgl.ExpressionSpecification = [
  'coalesce',
  ['get', 'name_pt'],
  ['get', 'name_en'],
  ['get', 'name'],
]

function safeSetPaint(
  map: mapboxgl.Map,
  layerId: string,
  prop: string,
  value: unknown,
) {
  if (!map.getLayer(layerId)) return
  try {
    map.setPaintProperty(layerId, prop, value as never)
  } catch {
    /* propriedade ausente ou incompatível */
  }
}

function safeSetLayout(
  map: mapboxgl.Map,
  layerId: string,
  prop: string,
  value: unknown,
) {
  if (!map.getLayer(layerId)) return
  try {
    map.setLayoutProperty(layerId, prop, value as never)
  } catch {
    /* propriedade ausente ou incompatível */
  }
}

/**
 * Fronteiras, labels e idioma só no satellite (`satellite-streets-v12`).
 * Ordem: raster já aplicado em `applySatelliteRasterAdjustments` → linhas admin → estado → textos PT → negrito país.
 */
function applySatelliteVectorStyleTweaks(map: mapboxgl.Map) {
  for (const id of SATELLITE_ADMIN1_LINE_LAYERS) {
    safeSetPaint(map, id, 'line-dasharray', [3, 2])
    safeSetPaint(map, id, 'line-color', 'rgba(255, 255, 255, 0.5)')
    safeSetPaint(map, id, 'line-width', 1.25)
  }

  for (const id of SATELLITE_ADMIN0_LINE_LAYERS) {
    safeSetPaint(map, id, 'line-dasharray', [1, 0])
    safeSetPaint(map, id, 'line-color', 'rgba(255, 255, 255, 0.7)')
    safeSetPaint(map, id, 'line-width', 1.75)
  }

  safeSetPaint(map, 'state-label', 'text-opacity', 1)
  safeSetPaint(map, 'state-label', 'text-color', 'rgba(255, 255, 255, 0.85)')
  safeSetPaint(map, 'state-label', 'text-halo-color', 'rgba(0, 0, 0, 0.6)')
  safeSetPaint(map, 'state-label', 'text-halo-width', 1.5)

  for (const id of SATELLITE_PLACE_LABEL_LAYERS) {
    safeSetLayout(map, id, 'text-field', PLACE_LABEL_TEXT_FIELD_PT)
  }

  safeSetLayout(map, 'country-label', 'text-font', [
    'DIN Pro Bold',
    'Arial Unicode MS Bold',
  ])
}

function applySatelliteStylePostLoad(map: mapboxgl.Map, styleUrl: string) {
  applySatelliteRasterAdjustments(map, styleUrl)
  if (styleUrl !== MAPBOX_STYLE_SATELLITE) return
  if (!map.isStyleLoaded()) return
  applySatelliteVectorStyleTweaks(map)
}

function addProcessosLayers(
  map: mapboxgl.Map,
  dadosGeoJSON: ReturnType<typeof buildGeoJSON>,
) {
  map.addSource('processos', {
    type: 'geojson',
    data: dadosGeoJSON,
  })

  map.addLayer({
    id: 'processos-fill',
    type: 'fill',
    source: 'processos',
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'fill-opacity': 0.45,
    },
  })

  map.addLayer({
    id: 'processos-halo',
    type: 'line',
    source: 'processos',
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        4,
        8,
        3,
        12,
        3,
      ],
      'line-opacity': 0.12,
      'line-blur': 3,
    },
  })

  map.addLayer({
    id: 'processos-outline',
    type: 'line',
    source: 'processos',
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#FF0000'],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        1.5,
        8,
        1.5,
        12,
        2,
      ],
      'line-opacity': 1,
    },
  })
}

const PROCESSOS_CLICK_LAYERS = [
  'processos-fill',
  'processos-halo',
  'processos-outline',
] as const

type ProcessosLayerHandlers = {
  onMove: () => void
  onLeave: () => void
  onUnifiedClick: (e: mapboxgl.MapMouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
  onZoomStart: () => void
  onMoveEnd: () => void
}

/** Ignora no máx. um `click` após pan — Mapbox às vezes emite clique fantasma; timeout evita estado preso. */
type MapDragClickGuard = {
  consumeNextClick: boolean
  resetTimeoutId: ReturnType<typeof setTimeout> | null
}

/** Igual à transição do drawer (`RelatorioCompleto` transform 300ms) + margem. */
const DRAWER_CLOSE_ANIM_MS = 320

/** Mesma sequência que o ✕ do popover: teardown + drawer / seleção. */
function fecharProcessoPopupComoBotaoFechar(
  tearDownProcessoPopupDom: () => void,
  pendingFecharProcessoTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
) {
  tearDownProcessoPopupDom()
  const st = useMapStore.getState()
  if (st.relatorioDrawerAberto) {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
    }
    st.setRelatorioDrawerAberto(false)
    pendingFecharProcessoTimeoutRef.current = setTimeout(() => {
      pendingFecharProcessoTimeoutRef.current = null
      useMapStore.getState().selecionarProcesso(null)
    }, DRAWER_CLOSE_ANIM_MS)
  } else {
    st.selecionarProcesso(null)
  }
}

const PROCESSO_POPUP_OFFSET_PX = 10
const PROCESSO_POPUP_MARGEM_BORDA_PX = 12
/** Deve ser removido com `popup.removeClassName(...)`: o Mapbox repõe o `className` do contentor em cada `move`. */
const PROCESSO_POPUP_LAYOUT_PENDING_CLASS = 'terrae-processo-popup--layout-pending'

type ProcessoPopupAnchor = NonNullable<mapboxgl.PopupOptions['anchor']>

/** Ordem: abaixo do ponto → acima → direita → esquerda → cantos (tip sempre no `lngLat`). */
const ANCHOR_PRIORITY: ProcessoPopupAnchor[] = [
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

function boundsAproximadosPopup(
  anchor: ProcessoPopupAnchor,
  pos: { x: number; y: number },
  w: number,
  h: number,
): { left: number; top: number; right: number; bottom: number } {
  switch (anchor) {
    case 'top':
      return {
        left: pos.x - w / 2,
        top: pos.y,
        right: pos.x + w / 2,
        bottom: pos.y + h,
      }
    case 'bottom':
      return {
        left: pos.x - w / 2,
        top: pos.y - h,
        right: pos.x + w / 2,
        bottom: pos.y,
      }
    case 'left':
      return {
        left: pos.x,
        top: pos.y - h / 2,
        right: pos.x + w,
        bottom: pos.y + h / 2,
      }
    case 'right':
      return {
        left: pos.x - w,
        top: pos.y - h / 2,
        right: pos.x,
        bottom: pos.y + h / 2,
      }
    case 'top-left':
      return {
        left: pos.x,
        top: pos.y,
        right: pos.x + w,
        bottom: pos.y + h,
      }
    case 'top-right':
      return {
        left: pos.x - w,
        top: pos.y,
        right: pos.x,
        bottom: pos.y + h,
      }
    case 'bottom-left':
      return {
        left: pos.x,
        top: pos.y - h,
        right: pos.x + w,
        bottom: pos.y,
      }
    case 'bottom-right':
      return {
        left: pos.x - w,
        top: pos.y - h,
        right: pos.x,
        bottom: pos.y,
      }
    default:
      return {
        left: pos.x - w / 2,
        top: pos.y - h / 2,
        right: pos.x + w / 2,
        bottom: pos.y + h / 2,
      }
  }
}

function retanguloCabeNoMapa(
  left: number,
  top: number,
  right: number,
  bottom: number,
  cw: number,
  ch: number,
  m: number,
): boolean {
  return left >= m && top >= m && right <= cw - m && bottom <= ch - m
}

function areaVisivelNoMapa(
  left: number,
  top: number,
  right: number,
  bottom: number,
  cw: number,
  ch: number,
  m: number,
): number {
  const il = Math.max(m, left)
  const it = Math.max(m, top)
  const ir = Math.min(cw - m, right)
  const ib = Math.min(ch - m, bottom)
  if (il >= ir || it >= ib) return 0
  return (ir - il) * (ib - it)
}

function escolherAnchorProcessoPopup(
  pos: { x: number; y: number },
  w: number,
  h: number,
  cw: number,
  ch: number,
): ProcessoPopupAnchor {
  const m = PROCESSO_POPUP_MARGEM_BORDA_PX
  for (const a of ANCHOR_PRIORITY) {
    const b = boundsAproximadosPopup(a, pos, w, h)
    if (retanguloCabeNoMapa(b.left, b.top, b.right, b.bottom, cw, ch, m)) {
      return a
    }
  }
  let melhor: ProcessoPopupAnchor = 'bottom'
  let maxA = 0
  for (const a of ANCHOR_PRIORITY) {
    const b = boundsAproximadosPopup(a, pos, w, h)
    const ar = areaVisivelNoMapa(b.left, b.top, b.right, b.bottom, cw, ch, m)
    if (ar > maxA) {
      maxA = ar
      melhor = a
    }
  }
  return melhor
}

/**
 * Mede o popup após o React pintar e escolhe âncora (top/bottom/left/right/cantos)
 * para o cartão caber no viewport do mapa; a seta do Mapbox continua no `lngLat`.
 */
function agendarAnchorVerticalProcessoPopup(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  lngLat: mapboxgl.LngLatLike,
): void {
  const MAX_TENTATIVAS_LAYOUT = 48
  let tentativas = 0

  const aplicar = () => {
    tentativas += 1
    if (!popup.isOpen()) return

    const el = popup.getElement()
    if (!el) {
      if (tentativas < MAX_TENTATIVAS_LAYOUT)
        requestAnimationFrame(aplicar)
      return
    }

    const h = el.offsetHeight
    const w = el.offsetWidth
    if (h < 16 || w < 16) {
      if (tentativas < MAX_TENTATIVAS_LAYOUT) {
        requestAnimationFrame(aplicar)
        return
      }
      popup.setOffset(PROCESSO_POPUP_OFFSET_PX)
      popup.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
      return
    }

    const container = map.getContainer()
    const cw = container.clientWidth
    const ch = container.clientHeight
    const pos = map.project(lngLat)

    const anchor = escolherAnchorProcessoPopup(pos, w, h, cw, ch)
    popup.options.anchor = anchor
    popup.setOffset(PROCESSO_POPUP_OFFSET_PX)
    popup.setLngLat(popup.getLngLat())
    popup.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(aplicar)
  })
}

function openProcessoPopupOnMap(
  map: mapboxgl.Map,
  proc: Processo,
  tearDownProcessoPopupDom: () => void,
  popupRootRef: MutableRefObject<Root | null>,
  processoPopupRef: MutableRefObject<mapboxgl.Popup | null>,
  pendingFecharProcessoTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
  onToggleRelatorioCompleto: () => void,
  onAbrirRelatorioAbaRisco: () => void,
) {
  if (pendingFecharProcessoTimeoutRef.current) {
    clearTimeout(pendingFecharProcessoTimeoutRef.current)
    pendingFecharProcessoTimeoutRef.current = null
  }

  tearDownProcessoPopupDom()

  const mountEl = document.createElement('div')
  const root = createRoot(mountEl)
  popupRootRef.current = root

  const lngLat: mapboxgl.LngLatLike = [proc.lng, proc.lat]

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    closeOnMove: false,
    anchor: 'bottom',
    offset: PROCESSO_POPUP_OFFSET_PX,
    maxWidth: 'none',
    className: `terrae-processo-popup ${PROCESSO_POPUP_LAYOUT_PENDING_CLASS}`,
  })
    .setLngLat(lngLat)
    .setDOMContent(mountEl)
    .addTo(map)

  processoPopupRef.current = popup

  const closePopup = () =>
    fecharProcessoPopupComoBotaoFechar(
      tearDownProcessoPopupDom,
      pendingFecharProcessoTimeoutRef,
    )

  root.render(
    <ProcessoPopupContent
      processo={proc}
      onClose={closePopup}
      onToggleRelatorioCompleto={onToggleRelatorioCompleto}
      onAbrirRelatorioAbaRisco={onAbrirRelatorioAbaRisco}
      onIrParaRadarAlerta={(al: AlertaLegislativo) => {
        const rid = radarFeedIdParaAlertaProcesso(proc.id, al)
        if (rid) useAppStore.getState().setPendingRadarAlertaId(rid)
        useAppStore.getState().setTelaAtiva('radar')
        closePopup()
      }}
      onVerTodosAlertasRadar={() => {
        useAppStore.getState().setPendingRadarAlertaId(null)
        useAppStore.getState().setRadarAbrirHomeIntent(true)
        closePopup()
        useAppStore.getState().setTelaAtiva('radar')
      }}
    />,
  )

  agendarAnchorVerticalProcessoPopup(map, popup, lngLat)
}

function attachProcessosLayerHandlers(
  map: mapboxgl.Map,
  tearDownProcessoPopupDom: () => void,
  popupRootRef: MutableRefObject<Root | null>,
  processoPopupRef: MutableRefObject<mapboxgl.Popup | null>,
  handlersRef: MutableRefObject<ProcessosLayerHandlers | null>,
  pendingFecharProcessoTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
  dragClickGuardRef: MutableRefObject<MapDragClickGuard>,
  onToggleRelatorioCompleto?: () => void,
  onAbrirRelatorioAbaRisco?: () => void,
) {
  const prev = handlersRef.current
  if (prev) {
    map.off('mousemove', 'processos-fill', prev.onMove)
    map.off('mouseleave', 'processos-fill', prev.onLeave)
    map.off('click', prev.onUnifiedClick)
    map.off('dragstart', prev.onDragStart)
    map.off('dragend', prev.onDragEnd)
    map.off('zoomstart', prev.onZoomStart)
    map.off('moveend', prev.onMoveEnd)
  }

  if (dragClickGuardRef.current.resetTimeoutId != null) {
    clearTimeout(dragClickGuardRef.current.resetTimeoutId)
    dragClickGuardRef.current.resetTimeoutId = null
  }

  const onMove = () => {
    map.getCanvas().style.cursor = 'pointer'
  }

  const onLeave = () => {
    map.getCanvas().style.cursor = ''
  }

  /**
   * Um único `click` no mapa: hit em polígono abre ou troca o popup; segundo clique no mesmo
   * polígono (processo já selecionado) fecha como o ✕; clique no vazio não fecha.
   */
  const onDragStart = () => {
    dispatchTerraeMapClearFloatingUi()
  }

  const onDragEnd = () => {
    const g = dragClickGuardRef.current
    if (g.resetTimeoutId != null) {
      clearTimeout(g.resetTimeoutId)
      g.resetTimeoutId = null
    }
    g.consumeNextClick = true
    g.resetTimeoutId = setTimeout(() => {
      g.consumeNextClick = false
      g.resetTimeoutId = null
    }, 500)
  }

  const onZoomStart = () => {
    /* Roda do rato: não há dragstart; fecha tooltips portaled. */
    dispatchTerraeMapClearFloatingUi()
  }

  const onMoveEnd = () => {
    const p = processoPopupRef.current
    if (!p?.isOpen()) return
    /* Fallback: sincroniza o Set interno do Mapbox por si o layout inicial não chegou a correr. */
    p.removeClassName(PROCESSO_POPUP_LAYOUT_PENDING_CLASS)
  }

  const onUnifiedClick = (e: mapboxgl.MapMouseEvent) => {
    const g = dragClickGuardRef.current
    if (g.consumeNextClick) {
      g.consumeNextClick = false
      if (g.resetTimeoutId != null) {
        clearTimeout(g.resetTimeoutId)
        g.resetTimeoutId = null
      }
      return
    }

    const alvo = e.originalEvent?.target
    if (
      alvo instanceof Element &&
      (alvo.closest('.mapboxgl-popup') ||
        alvo.closest('.terrae-processo-popup'))
    ) {
      return
    }

    const hits = map.queryRenderedFeatures(e.point, {
      layers: [...PROCESSOS_CLICK_LAYERS],
    })

    if (hits.length > 0) {
      for (const f of hits) {
        const rawId = f.properties?.id
        if (rawId == null || rawId === '') continue
        const idStr = String(rawId)
        const proc = useMapStore.getState().processos.find((x) => x.id === idStr)
        if (!proc) continue

        const sel = useMapStore.getState().processoSelecionado
        if (sel?.id === proc.id) {
          fecharProcessoPopupComoBotaoFechar(
            tearDownProcessoPopupDom,
            pendingFecharProcessoTimeoutRef,
          )
          return
        }

        if (pendingFecharProcessoTimeoutRef.current) {
          clearTimeout(pendingFecharProcessoTimeoutRef.current)
          pendingFecharProcessoTimeoutRef.current = null
        }

        useMapStore.getState().selecionarProcesso(proc)
        openProcessoPopupOnMap(
          map,
          proc,
          tearDownProcessoPopupDom,
          popupRootRef,
          processoPopupRef,
          pendingFecharProcessoTimeoutRef,
          onToggleRelatorioCompleto ?? (() => {}),
          onAbrirRelatorioAbaRisco ?? (() => {}),
        )
        return
      }
    }

    /* Mapa vazio: não teardown, não limpar seleção, não fechar drawer — pan/zoom/click fora do polígono mantêm o popover. */
    return
  }

  handlersRef.current = {
    onMove,
    onLeave,
    onUnifiedClick,
    onDragStart,
    onDragEnd,
    onZoomStart,
    onMoveEnd,
  }

  map.on('mousemove', 'processos-fill', onMove)
  map.on('mouseleave', 'processos-fill', onLeave)
  map.on('click', onUnifiedClick)
  map.on('dragstart', onDragStart)
  map.on('dragend', onDragEnd)
  map.on('zoomstart', onZoomStart)
  map.on('moveend', onMoveEnd)
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const processoPopupRef = useRef<mapboxgl.Popup | null>(null)
  const processoPopupRootRef = useRef<Root | null>(null)
  const processosLayerHandlersRef = useRef<ProcessosLayerHandlers | null>(null)
  const tearDownProcessoPopupRef = useRef<(() => void) | null>(null)
  const pendingFecharProcessoTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const mapDragClickGuardRef = useRef<MapDragClickGuard>({
    consumeNextClick: false,
    resetTimeoutId: null,
  })
  const applyingIntelDrillRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [introSearch, setIntroSearch] = useState(false)
  const [introLegend, setIntroLegend] = useState(false)
  const [introTheme, setIntroTheme] = useState(false)
  const [estiloAtivo, setEstiloAtivo] = useState(MAPBOX_STYLE_SATELLITE)
  const [modoLegenda, setModoLegenda] = useState<'regime' | 'substancia'>('regime')
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('regime')
  const modoVisualizacaoRef = useRef<ModoVisualizacao>('regime')
  modoVisualizacaoRef.current = modoVisualizacao

  const onMudarModoLegenda = useCallback((modo: 'regime' | 'substancia') => {
    setModoLegenda(modo)
    setModoVisualizacao((m) => (m === 'risco' ? m : modo))
  }, [])

  const onSubstanciaExplorada = useCallback(() => {
    if (modoVisualizacaoRef.current !== 'risco') {
      setModoVisualizacao('substancia')
      setModoLegenda('substancia')
    } else {
      setModoLegenda('substancia')
    }
  }, [])

  const filtros = useMapStore((s) => s.filtros)
  const substanciasFiltro = filtros.substancias

  const familiasAtivasNaLegenda = useMemo(() => {
    if (substanciasFiltro.length === 0) return null
    const normAtivas = new Set(substanciasFiltro.map(normalizeSubstanciaKey))
    const resultado = new Set<string>()
    for (const fam of FAMILIA_MINERAL_DEFS) {
      if (fam.substancias.some((s) => normAtivas.has(s))) {
        resultado.add(fam.id)
      }
    }
    return resultado
  }, [substanciasFiltro])

  const camadasGeo = useMapStore((s) => s.camadasGeo)
  const filtrosAlteradosCount = useMemo(
    () => countFiltrosAlterados(filtros),
    [filtros],
  )
  const [painelFiltrosAberto, setPainelFiltrosAberto] = useState(false)
  const { montado: painelFiltrosMontado, animar: painelFiltrosAnimar } =
    usePainelFiltrosAnimation(painelFiltrosAberto)
  const processoSelecionado = useMapStore((s) => s.processoSelecionado)
  const relatorioDrawerAberto = useMapStore((s) => s.relatorioDrawerAberto)
  const setRelatorioDrawerAberto = useMapStore((s) => s.setRelatorioDrawerAberto)
  const pendingNavigation = useMapStore((s) => s.pendingNavigation)
  const intelTitularFilter = useMapStore((s) => s.intelTitularFilter)
  const telaAtiva = useAppStore((s) => s.telaAtiva)

  const [camadaGeoTip, setCamadaGeoTip] = useState<{
    x: number
    y: number
    title: string
    meta: string
    borderColor: string
  } | null>(null)

  const mapIntelPaddingRestoreRef = useRef<{
    top: number
    right: number
    bottom: number
    left: number
  } | null>(null)

  const intelSidebarAutoCloseSeqActiveRef = useRef(false)
  const intelSidebarAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intelSidebarManualControlRef = useRef(false)
  const intelHoverIntentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearIntelSidebarAutoCloseTimer = useCallback(() => {
    if (intelSidebarAutoCloseTimerRef.current != null) {
      clearTimeout(intelSidebarAutoCloseTimerRef.current)
      intelSidebarAutoCloseTimerRef.current = null
    }
  }, [])

  const clearIntelHoverIntentTimer = useCallback(() => {
    if (intelHoverIntentTimerRef.current != null) {
      clearTimeout(intelHoverIntentTimerRef.current)
      intelHoverIntentTimerRef.current = null
    }
  }, [])

  const startIntelAutoCloseTimerAfterMoveEnd = useCallback(() => {
    if (!intelSidebarAutoCloseSeqActiveRef.current || intelSidebarManualControlRef.current) {
      return
    }
    clearIntelSidebarAutoCloseTimer()
    intelSidebarAutoCloseTimerRef.current = window.setTimeout(() => {
      intelSidebarAutoCloseTimerRef.current = null
      if (!intelSidebarAutoCloseSeqActiveRef.current || intelSidebarManualControlRef.current) {
        return
      }
      intelSidebarAutoCloseSeqActiveRef.current = false
      setPainelFiltrosAberto(false)
    }, 2500)
  }, [clearIntelSidebarAutoCloseTimer])

  const openIntelSidebarForPendingNavigation = useCallback(() => {
    clearIntelSidebarAutoCloseTimer()
    clearIntelHoverIntentTimer()
    intelSidebarManualControlRef.current = false
    intelSidebarAutoCloseSeqActiveRef.current = true
    setPainelFiltrosAberto(true)
  }, [clearIntelSidebarAutoCloseTimer, clearIntelHoverIntentTimer])

  const onIntelSidebarMouseEnter = useCallback(() => {
    if (!intelSidebarAutoCloseSeqActiveRef.current || intelSidebarManualControlRef.current) {
      return
    }
    clearIntelHoverIntentTimer()
    intelHoverIntentTimerRef.current = window.setTimeout(() => {
      intelHoverIntentTimerRef.current = null
      if (!intelSidebarAutoCloseSeqActiveRef.current) return
      intelSidebarManualControlRef.current = true
      clearIntelSidebarAutoCloseTimer()
    }, 300)
  }, [clearIntelHoverIntentTimer, clearIntelSidebarAutoCloseTimer])

  const onIntelSidebarMouseLeave = useCallback(() => {
    clearIntelHoverIntentTimer()
  }, [clearIntelHoverIntentTimer])

  const onIntelSidebarPointerDownCapture = useCallback(() => {
    if (!intelSidebarAutoCloseSeqActiveRef.current) return
    intelSidebarManualControlRef.current = true
    clearIntelSidebarAutoCloseTimer()
  }, [clearIntelSidebarAutoCloseTimer])

  useEffect(() => {
    if (painelFiltrosAberto) return

    clearIntelSidebarAutoCloseTimer()
    clearIntelHoverIntentTimer()
    intelSidebarAutoCloseSeqActiveRef.current = false
    intelSidebarManualControlRef.current = false

    const m = mapRef.current
    const snap = mapIntelPaddingRestoreRef.current
    if (m && snap) {
      mapIntelPaddingRestoreRef.current = null
      m.easeTo({
        padding: {
          top: snap.top,
          right: snap.right,
          bottom: snap.bottom,
          left: snap.left,
        },
        duration: 300,
        essential: true,
      })
    }
  }, [painelFiltrosAberto, clearIntelSidebarAutoCloseTimer, clearIntelHoverIntentTimer])

  useEffect(() => {
    return () => {
      clearIntelSidebarAutoCloseTimer()
      clearIntelHoverIntentTimer()
      intelSidebarAutoCloseSeqActiveRef.current = false
      intelSidebarManualControlRef.current = false
      const m = mapRef.current
      const snap = mapIntelPaddingRestoreRef.current
      if (m && snap) {
        mapIntelPaddingRestoreRef.current = null
        m.setPadding(snap)
      }
    }
  }, [clearIntelSidebarAutoCloseTimer, clearIntelHoverIntentTimer])

  const [relatorioAbaInicial, setRelatorioAbaInicial] = useState<
    'processo' | 'territorio' | 'inteligencia' | 'risco' | 'fiscal'
  >('processo')
  /** Incrementa ao pedir a aba Risco no drawer (força sync mesmo se `abaInicial` já era `risco`). */
  const [relatorioAbaRiscoRequestId, setRelatorioAbaRiscoRequestId] =
    useState(0)

  const verRelatorioRef = useRef<() => void>(() => {})
  verRelatorioRef.current = () => {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
      pendingFecharProcessoTimeoutRef.current = null
    }
    const st = useMapStore.getState()
    if (st.relatorioDrawerAberto) {
      st.setRelatorioDrawerAberto(false)
    } else {
      tearDownProcessoPopupRef.current?.()
      setRelatorioAbaInicial('processo')
      st.setRelatorioDrawerAberto(true)
    }
  }

  const abrirRelatorioAbaRiscoRef = useRef<() => void>(() => {})
  abrirRelatorioAbaRiscoRef.current = () => {
    if (pendingFecharProcessoTimeoutRef.current) {
      clearTimeout(pendingFecharProcessoTimeoutRef.current)
      pendingFecharProcessoTimeoutRef.current = null
    }
    tearDownProcessoPopupRef.current?.()
    setRelatorioAbaInicial('risco')
    setRelatorioAbaRiscoRequestId((n) => n + 1)
    useMapStore.getState().setRelatorioDrawerAberto(true)
  }

  useEffect(() => {
    if (!processoSelecionado) setRelatorioDrawerAberto(false)
  }, [processoSelecionado, setRelatorioDrawerAberto])

  useEffect(() => {
    return useMapStore.subscribe((state) => {
      if (!state.intelDrillExpectedFiltrosJson) return
      if (applyingIntelDrillRef.current) return
      const exp = state.intelDrillExpectedFiltrosJson
      if (!exp) return
      const now = fingerprintDrillFiltros(
        state.filtros,
        state.intelTitularFilter,
      )
      if (now !== exp) {
        useMapStore.getState().dismissIntelDrillUi()
      }
    })
  }, [])

  useEffect(() => {
    if (!pendingNavigation || telaAtiva !== 'mapa' || !mapLoaded) return
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const nav: PendingNavigation = pendingNavigation
    const ts = nav.timestamp
    const delayMs = 400

    const timer = window.setTimeout(() => {
      const cur = useMapStore.getState().pendingNavigation
      if (!cur || cur.timestamp !== ts) return

      const tearDown = tearDownProcessoPopupRef.current
      if (!tearDown) return

      useMapStore.getState().setPendingNavigation(null)

      applyingIntelDrillRef.current = true

      const ensureSnapshot = () => {
        const st = useMapStore.getState()
        if (!st.intelDrillRestoreFiltros) {
          useMapStore.setState({
            intelDrillRestoreFiltros: cloneFiltrosState(st.filtros),
          })
        }
      }

      ensureSnapshot()
      useMapStore.getState().applySidebarFiltrosPadrao()

      const commitDrillUi = (patch: Partial<MapStore>) => {
        useMapStore.setState((s) => {
          const nextFiltros = patch.filtros ?? s.filtros
          const nextTitular =
            patch.intelTitularFilter !== undefined
              ? patch.intelTitularFilter
              : s.intelTitularFilter
          return {
            ...patch,
            intelDrillExpectedFiltrosJson: fingerprintDrillFiltros(
              nextFiltros,
              nextTitular,
            ),
          }
        })
      }

      const ensureIntelSnap = () => {
        if (!mapIntelPaddingRestoreRef.current) {
          mapIntelPaddingRestoreRef.current = { ...map.getPadding() }
        }
        return mapIntelPaddingRestoreRef.current
      }
      const intelPad = (uniform: number) => {
        const base = ensureIntelSnap()
        return {
          top: uniform,
          right: uniform,
          bottom: uniform,
          left: base.left + getIntelLeftReservePx(),
        }
      }
      const armAutoCloseOnMoveEnd = () => {
        map.once('moveend', () => {
          startIntelAutoCloseTimerAfterMoveEnd()
        })
      }

      const fitList = (list: Processo[], uniformInset: number) => {
        const b = boundsFromProcessos(list)
        if (b && !b.isEmpty()) {
          map.fitBounds(b, {
            padding: intelPad(uniformInset),
            duration: 1200,
            maxZoom: 12,
          })
        } else {
          map.fitBounds(BRAZIL_BOUNDS_LNG_LAT, {
            padding: intelPad(uniformInset),
            duration: 1000,
          })
        }
      }

      try {
        if (nav.type === 'processo') {
          const proc = useMapStore
            .getState()
            .processos.find((x) => x.id === nav.payload)
          if (!proc) return

          useMapStore.getState().selecionarProcesso(proc)
          openIntelSidebarForPendingNavigation()

          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            const b = boundsFromSingleProcesso(proc)
            let opened = false
            const openPop = () => {
              if (opened) return
              opened = true
              openProcessoPopupOnMap(
                map,
                proc,
                tearDown,
                processoPopupRootRef,
                processoPopupRef,
                pendingFecharProcessoTimeoutRef,
                () => verRelatorioRef.current(),
                () => abrirRelatorioAbaRiscoRef.current(),
              )
            }
            let timerArmed = false
            const armTimerOnce = () => {
              if (timerArmed) return
              timerArmed = true
              startIntelAutoCloseTimerAfterMoveEnd()
            }
            if (b && !b.isEmpty()) {
              map.fitBounds(b, {
                padding: intelPad(100),
                duration: 1000,
                maxZoom: 15,
              })
            } else {
              const padBase = ensureIntelSnap()
              map.flyTo({
                center: [proc.lng, proc.lat],
                zoom: 12,
                duration: 1000,
                essential: true,
                padding: {
                  top: padBase.top,
                  right: padBase.right,
                  bottom: padBase.bottom,
                  left: padBase.left + getIntelLeftReservePx(),
                },
              })
            }
            map.once('moveend', () => {
              openPop()
              armTimerOnce()
            })
            window.setTimeout(() => {
              openPop()
              armTimerOnce()
            }, 1100)
          })
          return
        }

        if (nav.type === 'estado') {
          const uf = nav.payload
          commitDrillUi({
            filtros: {
              ...useMapStore.getState().filtros,
              uf,
            },
            intelTitularFilter: null,
          })
          const list = useMapStore.getState().getProcessosFiltrados()
          const b = boundsFromProcessos(list)
          const manual = ufBoundsLngLat(uf)
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            if (b && !b.isEmpty()) {
              map.fitBounds(b, {
                padding: intelPad(80),
                duration: 1200,
                maxZoom: 10,
              })
            } else if (manual) {
              map.fitBounds(manual, {
                padding: intelPad(80),
                duration: 1200,
              })
            } else {
              map.fitBounds(BRAZIL_BOUNDS_LNG_LAT, {
                padding: intelPad(48),
                duration: 1000,
              })
            }
            armAutoCloseOnMoveEnd()
          })
          return
        }

        if (nav.type === 'regime') {
          const target = nav.payload
          const camadas = REGIMES.reduce(
            (acc, r) => {
              acc[r] = r === target
              return acc
            },
            {} as Record<Regime, boolean>,
          )
          commitDrillUi({
            filtros: {
              ...useMapStore.getState().filtros,
              camadas,
            },
            intelTitularFilter: null,
          })
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            fitList(useMapStore.getState().getProcessosFiltrados(), 80)
            armAutoCloseOnMoveEnd()
          })
          return
        }

        if (nav.type === 'titular') {
          const titular = nav.payload
          commitDrillUi({
            intelTitularFilter: titular,
          })
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            fitList(useMapStore.getState().getProcessosFiltrados(), 80)
            armAutoCloseOnMoveEnd()
          })
          return
        }

        if (nav.type === 'substancia') {
          const key = normalizeSubstanciaKey(nav.payload)
          commitDrillUi({
            filtros: {
              ...useMapStore.getState().filtros,
              substancias: [key],
            },
            intelTitularFilter: null,
          })
          openIntelSidebarForPendingNavigation()
          afterFilterSidebarLayout(() => {
            ensureIntelSnap()
            fitList(useMapStore.getState().getProcessosFiltrados(), 80)
            armAutoCloseOnMoveEnd()
          })
        }
      } finally {
        queueMicrotask(() => {
          applyingIntelDrillRef.current = false
        })
      }
    }, delayMs)

    return () => clearTimeout(timer)
  }, [
    pendingNavigation,
    telaAtiva,
    mapLoaded,
    openIntelSidebarForPendingNavigation,
    startIntelAutoCloseTimerAfterMoveEnd,
  ])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPainelFiltrosAberto(false)
        return
      }
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement
      if (
        el &&
        (el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement ||
          (el as HTMLElement).isContentEditable)
      ) {
        return
      }
      if (el instanceof HTMLInputElement) {
        if (el.type === 'range' || el.hasAttribute('data-terrae-period-range')) {
          return
        }
        return
      }
      e.preventDefault()
      setPainelFiltrosAberto((aberta) => !aberta)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const {
    mapChromeCollapsed,
    chromeTransitionMs,
    chromeExitMs,
    chromeEnterMs,
  } = useMapChromeTransition()
  const chromeEase = `${chromeTransitionMs}ms ease-out`
  const prevChromeCollapsedRef = useRef<boolean | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const introDurMs = motionMs(MOTION_MAP_INTRO_DURATION_MS, reducedMotion)
  const skipMapFirstLoadIntroRef = useRef(
    telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )

  useEffect(() => {
    if (telaAtiva === 'inteligencia' || telaAtiva === 'radar') {
      skipMapFirstLoadIntroRef.current = true
    }
  }, [telaAtiva])

  useEffect(() => {
    if (!mapLoaded) return
    if (reducedMotion) {
      setIntroSearch(true)
      setIntroLegend(true)
      setIntroTheme(true)
      return
    }
    if (skipMapFirstLoadIntroRef.current) {
      setIntroSearch(true)
      setIntroLegend(true)
      setIntroTheme(true)
      return
    }
    setIntroSearch(false)
    setIntroLegend(false)
    setIntroTheme(false)
    const ids = [
      window.setTimeout(() => setIntroSearch(true), MOTION_MAP_INTRO_SEARCH_DELAY_MS),
      window.setTimeout(() => setIntroLegend(true), MOTION_MAP_INTRO_LEGEND_DELAY_MS),
      window.setTimeout(() => setIntroTheme(true), MOTION_MAP_INTRO_THEME_DELAY_MS),
    ]
    return () => {
      for (const id of ids) clearTimeout(id)
    }
  }, [mapLoaded, reducedMotion, telaAtiva])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const prev = prevChromeCollapsedRef.current
    if (prev === null) {
      prevChromeCollapsedRef.current = mapChromeCollapsed
      map.resize()
      return
    }
    if (prev === mapChromeCollapsed) return
    prevChromeCollapsedRef.current = mapChromeCollapsed
    const id = window.setTimeout(() => {
      map.resize()
    }, chromeTransitionMs)
    return () => clearTimeout(id)
  }, [mapChromeCollapsed, mapLoaded, chromeTransitionMs])

  const trocarEstiloMapa = useCallback((novoIdentificador: string) => {
    setEstiloAtivo(novoIdentificador)
    const map = mapRef.current
    if (!map) return

    map.setStyle(novoIdentificador)
    map.once('styledata', () => {
      applySatelliteStylePostLoad(map, novoIdentificador)

      const filtrados = buildGeoJSON(
        useMapStore.getState().getProcessosFiltrados(),
        modoVisualizacaoRef.current,
      )
      if (!map.getSource('processos')) {
        addProcessosLayers(map, filtrados)
      }
      addCamadasGeoLayers(map, 'processos-fill', CAMADAS_GEO_JSON)
      syncCamadasGeoVisibility(map, useMapStore.getState().camadasGeo)
      const td = tearDownProcessoPopupRef.current
      if (td) {
        attachProcessosLayerHandlers(
          map,
          td,
          processoPopupRootRef,
          processoPopupRef,
          processosLayerHandlersRef,
          pendingFecharProcessoTimeoutRef,
          mapDragClickGuardRef,
          () => verRelatorioRef.current(),
          () => abrirRelatorioAbaRiscoRef.current(),
        )
      }
      const src = map.getSource('processos') as mapboxgl.GeoJSONSource | undefined
      src?.setData(filtrados)
    })
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapLoaded || !map?.isStyleLoaded()) return

    const src = map.getSource('processos') as mapboxgl.GeoJSONSource | undefined
    if (!src) return

    const filtrados = useMapStore.getState().getProcessosFiltrados()
    src.setData(buildGeoJSON(filtrados, modoVisualizacao))

    const sel = useMapStore.getState().processoSelecionado
    if (sel && !filtrados.some((p) => p.id === sel.id)) {
      tearDownProcessoPopupRef.current?.()
      useMapStore.getState().selecionarProcesso(null)
    }
  }, [mapLoaded, filtros, modoVisualizacao, intelTitularFilter])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.isStyleLoaded()) return
    syncCamadasGeoVisibility(map, camadasGeo)
  }, [mapLoaded, camadasGeo])

  useEffect(() => {
    const fn = () => setCamadaGeoTip(null)
    window.addEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, fn)
    return () => window.removeEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, fn)
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const onMove = (e: mapboxgl.MapMouseEvent) => {
      const procHits = map.queryRenderedFeatures(e.point, {
        layers: [...PROCESSOS_CLICK_LAYERS],
      })
      if (procHits.length > 0) {
        setCamadaGeoTip(null)
        return
      }
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [...CAMADA_GEO_HOVER_LAYER_IDS],
      })
      if (hits.length === 0) {
        setCamadaGeoTip(null)
        return
      }
      const f = hits[0]
      const lid = f.layer?.id
      if (!lid) {
        setCamadaGeoTip(null)
        return
      }
      const props = f.properties as Record<string, unknown> | undefined
      const fmt = formatCamadaGeoTooltip(lid, props)
      if (!fmt) {
        setCamadaGeoTip(null)
        return
      }
      const rect = map.getContainer().getBoundingClientRect()
      setCamadaGeoTip({
        x: rect.left + e.point.x + 12,
        y: rect.top + e.point.y + 12,
        title: fmt.title,
        meta: fmt.meta,
        borderColor: fmt.borderColor,
      })
    }

    const onLeave = () => setCamadaGeoTip(null)

    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
    }
  }, [mapLoaded])

  const camadasGeoLegendItems = useMemo(
    () => CAMADAS_GEO_LEGEND_ORDER.filter((id) => camadasGeo[id]),
    [camadasGeo],
  )

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.error('VITE_MAPBOX_TOKEN em falta')
      return
    }

    const tearDownProcessoPopupDom = () => {
      processoPopupRootRef.current?.unmount()
      processoPopupRootRef.current = null
      processoPopupRef.current?.remove()
      processoPopupRef.current = null
    }

    tearDownProcessoPopupRef.current = tearDownProcessoPopupDom

    let cancelled = false
    let ro: ResizeObserver | null = null
    let rafId = 0
    let attempts = 0
    const maxAttempts = 200
    let unsubHydration: (() => void) | undefined

    const dispose = () => {
      if (pendingFecharProcessoTimeoutRef.current) {
        clearTimeout(pendingFecharProcessoTimeoutRef.current)
        pendingFecharProcessoTimeoutRef.current = null
      }
      if (mapDragClickGuardRef.current.resetTimeoutId != null) {
        clearTimeout(mapDragClickGuardRef.current.resetTimeoutId)
        mapDragClickGuardRef.current.resetTimeoutId = null
      }
      mapDragClickGuardRef.current.consumeNextClick = false
      tearDownProcessoPopupDom()
      useMapStore.getState().selecionarProcesso(null)
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
        style: MAPBOX_STYLE_SATELLITE,
        center: [-51.9, -14.2],
        zoom: 4.0,
        projection: 'mercator',
        maxBounds: [
          [-82.0, -58.0],
          [-30.0, 13.0],
        ],
        minZoom: 3.5,
        maxZoom: 18,
      })

      mapRef.current = map

      ro = new ResizeObserver(() => {
        mapRef.current?.resize()
      })
      ro.observe(el)

      queueMicrotask(() => mapRef.current?.resize())

      map.on('load', () => {
        mapRef.current?.resize()

        const geoJSON = buildGeoJSON(
          useMapStore.getState().getProcessosFiltrados(),
          modoVisualizacaoRef.current,
        )
        console.log('features carregadas:', geoJSON.features.length)

        addProcessosLayers(map, geoJSON)
        addCamadasGeoLayers(map, 'processos-fill', CAMADAS_GEO_JSON)
        syncCamadasGeoVisibility(map, useMapStore.getState().camadasGeo)

        applySatelliteStylePostLoad(map, MAPBOX_STYLE_SATELLITE)

        setMapLoaded(true)

        attachProcessosLayerHandlers(
          map,
          tearDownProcessoPopupDom,
          processoPopupRootRef,
          processoPopupRef,
          processosLayerHandlersRef,
          pendingFecharProcessoTimeoutRef,
          mapDragClickGuardRef,
          () => verRelatorioRef.current(),
          () => abrirRelatorioAbaRiscoRef.current(),
        )

        const preSel = useMapStore.getState().processoSelecionado
        if (preSel) {
          openProcessoPopupOnMap(
            map,
            preSel,
            tearDownProcessoPopupDom,
            processoPopupRootRef,
            processoPopupRef,
            pendingFecharProcessoTimeoutRef,
            () => verRelatorioRef.current(),
            () => abrirRelatorioAbaRiscoRef.current(),
          )
          map.flyTo({
            center: [preSel.lng, preSel.lat],
            zoom: 10,
            essential: true,
          })
        }
      })
    }

    const beginAfterHydration = () => {
      if (cancelled) return
      mountMap()
    }

    if (useMapStore.persist.hasHydrated()) {
      beginAfterHydration()
    } else {
      unsubHydration = useMapStore.persist.onFinishHydration(() => {
        beginAfterHydration()
      })
    }

    return () => {
      cancelled = true
      processosLayerHandlersRef.current = null
      tearDownProcessoPopupRef.current = null
      cancelAnimationFrame(rafId)
      unsubHydration?.()
      setMapLoaded(false)
      dispose()
    }
  }, [])

  return (
    <div className="relative isolate h-full min-h-0 w-full bg-dark-primary">
      <div className="absolute inset-0 z-0 min-h-0 w-full">
        <div
          ref={containerRef}
          className="absolute inset-0 min-h-0 w-full overflow-hidden"
        />
      </div>
      <div
        className="pointer-events-none absolute left-0 right-0 top-4 z-10 flex flex-col items-center px-4"
        style={{
          transform: mapChromeCollapsed ? 'translateY(-132px)' : 'translateY(0)',
          opacity: mapChromeCollapsed ? 0 : 1,
          transformOrigin: '50% 0',
          transitionProperty: 'transform, opacity',
          transitionDuration: `${chromeExitMs}ms`,
          transitionTimingFunction: 'ease-out',
          transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs}ms`,
        }}
      >
        <div
          className="pointer-events-auto flex min-w-0 max-w-full flex-col items-center gap-2"
          style={{
            opacity: introSearch ? 1 : 0,
            transform: introSearch ? 'translateY(0)' : 'translateY(-20px)',
            transition: reducedMotion
              ? 'opacity 1ms linear, transform 1ms linear'
              : `opacity ${introDurMs}ms ease-out, transform ${introDurMs}ms ease-out`,
          }}
        >
          <MapSearchBar
            painelFiltrosAberto={painelFiltrosAberto}
            onTogglePainelFiltros={() =>
              setPainelFiltrosAberto((o) => !o)
            }
            filtrosAlteradosCount={filtrosAlteradosCount}
            modoRisco={modoVisualizacao === 'risco'}
            onToggleModoRisco={() =>
              setModoVisualizacao((m) =>
                m === 'risco' ? modoLegenda : 'risco',
              )
            }
          />
        </div>
      </div>
      {painelFiltrosMontado ? (
        <MapSidebar
          animar={painelFiltrosAnimar}
          onFechar={() => setPainelFiltrosAberto(false)}
          onIntelAutoCloseMouseEnter={onIntelSidebarMouseEnter}
          onIntelAutoCloseMouseLeave={onIntelSidebarMouseLeave}
          onIntelAutoClosePointerDownCapture={onIntelSidebarPointerDownCapture}
          onSubstanciaExplorada={onSubstanciaExplorada}
        />
      ) : null}
      {modoVisualizacao === 'risco' ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-solid text-[13px] text-[#888780]"
          style={{
            top: 16,
            right: 12,
            background: 'rgba(17, 17, 16, 0.9)',
            borderColor: '#2C2C2A',
            borderRadius: 8,
            padding: '10px 12px',
            transform: mapChromeCollapsed
              ? 'translateX(calc(100% + 32px))'
              : 'translateX(0)',
            opacity: mapChromeCollapsed ? 0 : 1,
            transition: `transform ${chromeEase}, opacity ${chromeEase}`,
            transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs * 0.5}ms`,
          }}
        >
          <p className="mb-2.5 text-[12px] font-medium uppercase tracking-[2px] text-[var(--text-section-title)]">
            Risk Score
          </p>
          <ul className="flex flex-col gap-2">
            {LEGENDA_RISCO_ITEMS.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[13px] leading-snug text-[#F1EFE8]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute z-10 flex flex-col"
        style={{
          bottom: 24,
          right: 12,
          gap: 8,
          transform: mapChromeCollapsed
            ? 'translateX(calc(100% + 32px))'
            : 'translateX(0)',
          opacity: mapChromeCollapsed ? 0 : 1,
          transition: `transform ${chromeEase}, opacity ${chromeEase}`,
          transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs * 0.5}ms`,
        }}
      >
        <div
          style={{
            opacity: introTheme ? 1 : 0,
            transform: introTheme ? 'translateX(0)' : 'translateX(20px)',
            transition: reducedMotion
              ? 'opacity 1ms linear, transform 1ms linear'
              : `opacity ${introDurMs}ms ease-out, transform ${introDurMs}ms ease-out`,
          }}
        >
          <div
            className="pointer-events-auto rounded-lg border border-solid"
            style={{
              background: 'rgba(17, 17, 16, 0.9)',
              borderColor: '#2C2C2A',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <MapStyleSwitcher estiloAtivo={estiloAtivo} onTrocar={trocarEstiloMapa} />
          </div>
        </div>
        <div
          style={{
            opacity: introLegend ? 1 : 0,
            transform: introLegend ? 'translateX(0)' : 'translateX(20px)',
            transition: reducedMotion
              ? 'opacity 1ms linear, transform 1ms linear'
              : `opacity ${introDurMs}ms ease-out, transform ${introDurMs}ms ease-out`,
          }}
        >
          <div
            className="pointer-events-auto rounded-lg border border-solid text-[13px] text-[#888780]"
            style={{
              background: 'rgba(17, 17, 16, 0.9)',
              borderColor: '#2C2C2A',
              borderRadius: 8,
              padding: '10px 12px',
              opacity:
                modoVisualizacao === 'risco'
                  ? 0.3
                  : painelFiltrosAberto
                    ? 0.5
                    : 1,
              transition: 'opacity 300ms ease',
            }}
          >
          <div
            className="mb-2.5 flex overflow-hidden rounded-md"
            style={{
              background: '#1A1A18',
              border: '1px solid #2C2C2A',
              height: 28,
            }}
          >
            <button
              type="button"
              onClick={() => onMudarModoLegenda('regime')}
              className="flex-1 cursor-pointer border-0 px-3 text-[11px] font-medium uppercase tracking-[1.5px] transition-colors"
              style={{
                background: modoLegenda === 'regime' ? '#2C2C2A' : 'transparent',
                color: modoLegenda === 'regime' ? '#F1EFE8' : '#5F5E5A',
              }}
            >
              Regimes
            </button>
            <button
              type="button"
              onClick={() => onMudarModoLegenda('substancia')}
              className="flex-1 cursor-pointer border-0 px-3 text-[11px] font-medium uppercase tracking-[1.5px] transition-colors"
              style={{
                background: modoLegenda === 'substancia' ? '#2C2C2A' : 'transparent',
                color: modoLegenda === 'substancia' ? '#F1EFE8' : '#5F5E5A',
                borderLeft: '1px solid #2C2C2A',
              }}
            >
              Substâncias
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gridTemplateRows: '1fr',
            }}
          >
            <div
              aria-hidden={modoLegenda !== 'regime'}
              style={{
                gridColumn: 1,
                gridRow: 1,
                minWidth: 0,
                opacity: modoLegenda === 'regime' ? 1 : 0,
                pointerEvents: modoLegenda === 'regime' ? 'auto' : 'none',
                zIndex: modoLegenda === 'regime' ? 1 : 0,
                transition: reducedMotion
                  ? 'opacity 1ms linear'
                  : 'opacity 200ms ease',
              }}
            >
              <ul className="flex flex-col gap-2">
                {(
                  [
                    'concessao_lavra',
                    'autorizacao_pesquisa',
                    'req_lavra',
                    'licenciamento',
                    'lavra_garimpeira',
                    'registro_extracao',
                  ] as Regime[]
                ).map((r) => (
                  <li
                    key={r}
                    className="flex items-center gap-2.5"
                    style={{
                      opacity: filtros.camadas[r] !== false ? 1 : 0.4,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: REGIME_COLORS_MAP[r] }}
                    />
                    <CamadaTooltipHover
                      texto={REGIME_BADGE_TOOLTIP[r]}
                      maxWidthPx={340}
                      bubblePadding="10px 12px"
                      preferBelow
                      className="min-w-0"
                    >
                      <span
                        className="cursor-help text-[13px] leading-snug text-[#F1EFE8]"
                        style={{
                          borderBottom: `1px dotted ${REGIME_COLORS[r]}`,
                        }}
                      >
                        {REGIME_LABELS[r]}
                      </span>
                    </CamadaTooltipHover>
                  </li>
                ))}
              </ul>
              <div
                className="my-2 shrink-0"
                style={{ height: 1, backgroundColor: '#2C2C2A' }}
              />
              <ul className="flex flex-col gap-2">
                {(
                  [
                    'disponibilidade',
                    'mineral_estrategico',
                    'bloqueio_provisorio',
                    'bloqueio_permanente',
                  ] as Regime[]
                ).map((r) => (
                  <li
                    key={r}
                    className="flex items-center gap-2.5"
                    style={{
                      opacity: filtros.camadas[r] !== false ? 1 : 0.4,
                      transition: 'opacity 200ms ease',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: REGIME_COLORS_MAP[r] }}
                    />
                    <CamadaTooltipHover
                      texto={REGIME_BADGE_TOOLTIP[r]}
                      maxWidthPx={340}
                      bubblePadding="10px 12px"
                      preferBelow
                      className="min-w-0"
                    >
                      <span
                        className="cursor-help text-[13px] leading-snug text-[#F1EFE8]"
                        style={{
                          borderBottom: `1px dotted ${REGIME_COLORS[r]}`,
                        }}
                      >
                        {REGIME_LABELS[r]}
                      </span>
                    </CamadaTooltipHover>
                  </li>
                ))}
              </ul>
              {camadasGeoLegendItems.length > 0 ? (
                <>
                  <div
                    className="my-2.5 shrink-0"
                    style={{
                      height: 1,
                      backgroundColor: '#2C2C2A',
                    }}
                  />
                  <ul className="flex flex-col gap-2">
                    {camadasGeoLegendItems.map((id) => (
                      <li key={id} className="flex items-center gap-2.5">
                        {id === 'ferrovias' ? (
                          <span
                            className="h-0.5 w-6 shrink-0 rounded-sm"
                            style={{
                              backgroundColor: CAMADAS_GEO_COLOR[id],
                            }}
                          />
                        ) : (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CAMADAS_GEO_COLOR[id] }}
                          />
                        )}
                        <span className="text-[13px] leading-snug text-[#F1EFE8]">
                          {CAMADAS_GEO_LABEL[id]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div
              aria-hidden={modoLegenda !== 'substancia'}
              style={{
                gridColumn: 1,
                gridRow: 1,
                minWidth: 0,
                opacity: modoLegenda === 'substancia' ? 1 : 0,
                pointerEvents: modoLegenda === 'substancia' ? 'auto' : 'none',
                zIndex: modoLegenda === 'substancia' ? 1 : 0,
                transition: reducedMotion
                  ? 'opacity 1ms linear'
                  : 'opacity 200ms ease',
              }}
            >
              <ul className="flex flex-col gap-2">
                {FAMILIA_MINERAL_DEFS.filter((f) => f.id !== 'outros').map(
                  (fam) => (
                    <li
                      key={fam.id}
                      className="flex items-center gap-2.5"
                      style={{
                        opacity:
                          familiasAtivasNaLegenda === null ||
                          familiasAtivasNaLegenda.has(fam.id)
                            ? 1
                            : 0.4,
                        transition: 'opacity 200ms ease',
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: fam.color }}
                      />
                      <span className="text-[13px] leading-snug text-[#F1EFE8]">
                        {fam.label}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
        </div>
      </div>
      <RelatorioCompleto
        processo={processoSelecionado}
        aberto={relatorioDrawerAberto}
        onFechar={() => setRelatorioDrawerAberto(false)}
        abaInicial={relatorioAbaInicial}
        abaRiscoRequestId={relatorioAbaRiscoRequestId}
      />
      {camadaGeoTip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[10050]"
              style={{
                left: camadaGeoTip.x,
                top: camadaGeoTip.y,
              }}
            >
              <div
                style={{
                  background: '#2C2C2A',
                  border: `1px solid ${camadaGeoTip.borderColor}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  maxWidth: 280,
                }}
              >
                <div
                  className="font-bold leading-snug"
                  style={{ fontSize: 13, color: '#D3D1C7' }}
                >
                  {camadaGeoTip.title}
                </div>
                {camadaGeoTip.meta ? (
                  <div
                    className="mt-1 leading-snug"
                    style={{ fontSize: 13, color: '#888780' }}
                  >
                    {camadaGeoTip.meta}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
```

## 2. Relatorio Completo
**Arquivo:** `src/components/map/RelatorioCompleto.tsx`
```tsx
import { createPortal, flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ArrowUpRight } from 'lucide-react'
import { relatoriosMock } from '../../data/relatorio.mock'
import type { RelatorioData } from '../../data/relatorio.mock'
import {
  rotuloFontePublicacaoExibicao,
  textoTooltipNivelImpactoLegislativo,
} from '../../lib/alertaImpactoLegislativo'
import { estiloBadgeRelevancia } from '../../lib/relevanciaAlerta'
import { formatarRealBrlInteligente } from '../../lib/formatarRealBrlInteligente'
import { formatarUsdMiInteligente } from '../../lib/formatarUsdMiInteligente'
import { labelSubstanciaParaExibicao } from '../../lib/substancias'
import { REGIME_COLORS, REGIME_LABELS } from '../../lib/regimes'
import { RegimeBadge } from '../ui/RegimeBadge'
import { AlertaItemImpactoBar } from '../legislativo/AlertaItemImpactoBar'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import { TextoTruncadoComTooltip } from '../ui/TextoTruncadoComTooltip'
import { gerarRiskDecomposicaoParaProcesso } from '../../lib/riskScoreDecomposicao'
import type { Fase, Processo, Regime } from '../../types'
import { RiskDecomposicaoRelatorioPanel } from './RiskDecomposicaoRelatorioPanel'
import { RiskTotalCalcTooltipContent } from './RiskScoreCalcTooltipContent'

type AbaId = 'processo' | 'territorio' | 'inteligencia' | 'risco' | 'fiscal'

type JsPdfDoc = InstanceType<typeof jsPDF>

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'processo', label: 'Processo' },
  { id: 'territorio', label: 'Território' },
  { id: 'inteligencia', label: 'Inteligência' },
  { id: 'risco', label: 'Risco' },
  { id: 'fiscal', label: 'Fiscal' },
]

/** Mesma cor de "Camadas disponíveis" na sidebar (`index.css` --text-section-title) */
const SECTION_TITLE = 'var(--text-section-title)'

/** Escala tipográfica do drawer (mínimo 12px) */
const FS = {
  min: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  metric: 17,
  xl: 18,
  xxl: 21,
  h2: 23,
  display: 26,
  hero: 56,
  jumbo: 58,
  highlight: 32,
} as const

const RX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Espaço vertical entre o último conteúdo do card e o rodapé "Atualizado em…". */
const FONTE_LABEL_MARGIN_TOP_PX = 20

/** Reforço antes de "Atualizado em…" nas abas Inteligência, Território, Risco e Fiscal. */
const FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX = 32

/** Espaço abaixo dos títulos de secção do drawer (alinhado ao cabeçalho número do processo + badge). */
const TITULO_SECAO_MARGIN_BOTTOM_PX = 30

function formatarDataIsoPtBr(iso: string | null | undefined): string {
  if (iso == null || iso === '') return ''
  if (!RX_DATA_ISO.test(iso)) return iso
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Rótulo da substância com acentuação correta (ex.: NIQUEL → Níquel). */
function apresentarSubstanciaLabel(s: string): string {
  return labelSubstanciaParaExibicao(s)
}

/** Destaca em negrito trechos de ha e município/UF no texto das observações. */
function observacoesComNegritoHaLocal(texto: string, p: Processo): ReactNode {
  const loc = `${p.municipio}/${p.uf}`
  const areaForms = new Set<string>([
    `${p.area_ha.toLocaleString('pt-BR')} ha`,
    `${p.area_ha.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} ha`,
  ])
  const needles = [...areaForms, loc].filter((n) => texto.includes(n))
  if (needles.length === 0) return texto

  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < texto.length) {
    let nextIdx = -1
    let found = ''
    for (const n of needles) {
      const j = texto.indexOf(n, i)
      if (j !== -1 && (nextIdx === -1 || j < nextIdx)) {
        nextIdx = j
        found = n
      }
    }
    if (nextIdx === -1) {
      out.push(<span key={k++}>{texto.slice(i)}</span>)
      break
    }
    if (nextIdx > i) {
      out.push(<span key={k++}>{texto.slice(i, nextIdx)}</span>)
    }
    out.push(
      <strong key={k++} style={{ fontWeight: 700 }}>
        {found}
      </strong>,
    )
    i = nextIdx + found.length
  }
  return <>{out}</>
}

/** Títulos de subseção no drawer (16px / 700); rótulos do grid Processo usam FS.md / 600. */
const subsecaoTituloStyle = {
  fontSize: FS.lg,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  color: SECTION_TITLE,
}

const FASE_LABELS: Record<Fase, string> = {
  requerimento: 'Requerimento',
  pesquisa: 'Pesquisa',
  concessao: 'Concessão',
  lavra: 'Lavra',
  encerrado: 'Encerrado',
}

function corFaixaRisco(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

function classificacaoRiscoTotal(r: number): string {
  if (r < 40) return 'Baixo risco'
  if (r <= 69) return 'Risco médio'
  return 'Alto risco'
}

/** Ícones de tendência de preço (subaba Inteligência). */
function IconTendenciaAlta({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 16L9.5 10.5 14 14 20 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 6h5v5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTendenciaEstavel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 12h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 9v6M17 9v6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTendenciaQueda({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 8L9.5 13.5 14 10 20 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 18h5v-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Cor semântica para o valor numérico em km (proximidade territorial / logística). */
function corDistanciaKm(km: number): string {
  if (km < 10) return '#E24B4A'
  if (km < 30) return '#E8A830'
  if (km <= 50) return '#D3D1C7'
  return '#1D9E75'
}

const GLOSSARIO_APP =
  'Área de Preservação Permanente (APP): faixa de proteção ao longo de rios, nascentes e topos de morro. Vedada a supressão de vegetação salvo em casos de utilidade pública (Código Florestal, Lei 12.651/2012).'

const GLOSSARIO_QUILOMBOLA =
  'Comunidade remanescente de quilombo com território reconhecido pelo INCRA. Exige consulta prévia conforme Convenção 169 da OIT.'

const AREAS_SENSIVEIS_DIST_TOOLTIP =
  'As distâncias são calculadas entre o centroide do processo minerário e o limite mais próximo de cada área sensível (FUNAI/ICMBio/INCRA). Cores indicam proximidade: vermelho (< 10 km, zona de influência direta), âmbar (10-30 km, zona de atenção), neutro (30-50 km), verde (> 50 km, distância segura). Referência: zonas de amortecimento conforme SNUC e normas específicas de cada UC.'

const SIGLAS_UC_COMUNS = [
  'APA',
  'FLONA',
  'REBIO',
  'ESEC',
  'PARNA',
  'RDS',
  'RPPN',
  'MONA',
] as const

function normalizarAsciiUpper(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function siglasPresentesNoNomeUc(nome: string): Set<string> {
  const u = normalizarAsciiUpper(nome)
  const set = new Set<string>()
  for (const sig of SIGLAS_UC_COMUNS) {
    if (new RegExp(`\\b${sig}\\b`).test(u)) set.add(sig)
  }
  return set
}

function extrairSiglaEntreParentesesUc(tipo: string): string | null {
  const m = tipo.match(/\(\s*([A-Za-zÀ-ÿ]{2,8})\s*\)/)
  if (!m) return null
  return normalizarAsciiUpper(m[1])
}

function extrairSiglaDoTipoUc(tipo: string): string | null {
  const sigs = SIGLAS_UC_COMUNS as readonly string[]
  const p = extrairSiglaEntreParentesesUc(tipo)
  if (p && sigs.includes(p)) return p
  const t = normalizarAsciiUpper(tipo.trim())
  if (sigs.includes(t)) return t
  return null
}

/** Uma linha: nome da UC, sem repetir tipo por extenso se a sigla já está no nome. */
function rotuloUcUmaLinha(nome: string, tipo: string | null): string {
  const n = nome.trim()
  if (!tipo) return n
  const sigTipo = extrairSiglaDoTipoUc(tipo)
  const noNome = siglasPresentesNoNomeUc(n)
  if (sigTipo && noNome.has(sigTipo)) return n
  if (sigTipo && !noNome.has(sigTipo)) return `${sigTipo} ${n}`
  if (/protec[aã]o\s+integral/i.test(tipo)) {
    if (/\bPI\b/i.test(n)) return n
    return `PI ${n}`
  }
  if (/\bUC\s+/i.test(n)) return n
  return `UC ${n}`
}

function tooltipTextoUcCompleto(nome: string, tipo: string | null): string {
  const n = nome.trim()
  if (!tipo) return n
  return `${n} — ${tipo}`
}

const SEI_ANM_PESQUISA_URL =
  'https://sei.anm.gov.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=pesquisa_processo&id_orgao_acesso_externo=0'

/** Gap em p.p.: inteiro se |gap| ≥ 1; senão uma casa decimal. */
function formatarGapPontosPercentuais(gap: number): string {
  if (Math.abs(gap) >= 1) {
    return Math.round(gap).toLocaleString('pt-BR')
  }
  return gap.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })
}

function formatarPctContextoGlobal(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function textoTooltipDependenciaTransferencias(pct: number): string {
  const s = String(pct)
  if (pct <= 40) {
    return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Baixa dependência indica boa capacidade de arrecadação própria.`
  }
  if (pct <= 70) {
    return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Dependência moderada, comum em municípios de médio porte.`
  }
  return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Alta dependência indica vulnerabilidade fiscal, o município gera pouca receita própria.`
}

function prazoVencimentoExibicaoRelatorio(
  prazo: string | null,
  regime: Regime,
): { texto: string; corValor: string } {
  if (prazo != null && prazo !== '' && RX_DATA_ISO.test(prazo)) {
    return { texto: formatarDataIsoPtBr(prazo), corValor: '#D3D1C7' }
  }
  if (regime === 'bloqueio_permanente') {
    return { texto: 'Indeterminado (bloqueio)', corValor: '#5F5E5A' }
  }
  if (regime === 'bloqueio_provisorio') {
    return { texto: 'Pendente de decisão', corValor: '#E8A830' }
  }
  const semPrazo =
    prazo == null || prazo === '' || prazo.trim() === 'Não definido'
  if (semPrazo) {
    return { texto: 'Não informado pela ANM', corValor: '#5F5E5A' }
  }
  return { texto: prazo, corValor: '#D3D1C7' }
}

/** Dots em “Áreas sensíveis” — paleta v2 território. */
const DOT_TI = '#D4785A'
const DOT_UC = '#4A8C5E'
const DOT_APP = '#6BAF7B'
const DOT_QUILOMBOLA = '#B8785C'
/** Ausência positiva (sem TI na região monitorada). */
const DOT_AUSENCIA_POSITIVA = '#1D9E75'

/** Logística v2: ferrovia, porto, sede; ausência de infra usa cinza terciário. */
const DOT_FERROVIA = '#8B7A6A'
const DOT_PORTO = '#5A8AA0'
const DOT_SEDE_MUNICIPAL = '#9E958A'
const DOT_AUSENCIA_INFRA = '#5F5E5A'

const DOT_AQUIFERO = '#4A8FB8'

function corTramitacaoAnos(anos: number): string {
  if (anos <= 5) return '#1D9E75'
  if (anos <= 15) return '#D3D1C7'
  if (anos <= 30) return '#E8A830'
  return '#E24B4A'
}

function corDependenciaTransferenciasPct(pct: number): string {
  if (pct <= 40) return '#1D9E75'
  if (pct <= 60) return '#D3D1C7'
  if (pct <= 80) return '#E8A830'
  return '#E24B4A'
}

function biomaImplicacoes(bioma: string): string {
  if (bioma.includes('Amazônia') && !bioma.includes('Cerrado'))
    return 'Exige licenciamento federal, IBAMA. Alta sensibilidade ambiental e social. Consulta FUNAI obrigatória para processos em TIs.'
  if (bioma.includes('Amazônia') && bioma.includes('Cerrado'))
    return 'Transição Amazônia/Cerrado, atenção a competências federal e estadual e a corredores ecológicos.'
  if (bioma.includes('Cerrado'))
    return 'Licenciamento estadual na maioria dos casos. Biodiversidade crítica mas processo mais ágil que Amazônia.'
  if (bioma.includes('Caatinga'))
    return 'Menor complexidade ambiental relativa. Atenção especial a recursos hídricos.'
  if (bioma.includes('Mata Atlântica'))
    return 'Bioma prioritário, restrições severas de supressão de vegetação. Lei da Mata Atlântica (11.428/2006).'
  if (bioma.includes('Pampa'))
    return 'Paisagem de campos, licenciamento estadual e zoneamento rural relevantes.'
  if (bioma.includes('Pantanal'))
    return 'Patrimônio hidrológico sensível, restrições a obras e supressão em áreas úmidas.'
  return 'Verificar legislação federal e estadual aplicável ao bioma e ao uso do solo.'
}

function capagCor(letra: 'A' | 'B' | 'C' | 'D'): string {
  switch (letra) {
    case 'A':
      return '#5B9A6F'
    case 'B':
      return '#7A9B5A'
    case 'C':
      return '#C4915A'
    case 'D':
      return '#A85C5C'
  }
}

function textoTooltipCapag(letra: 'A' | 'B' | 'C' | 'D'): string {
  switch (letra) {
    case 'A':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota A indica excelente saúde fiscal, com bom equilíbrio entre endividamento, poupança corrente e liquidez.'
    case 'B':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota B indica saúde fiscal adequada, com indicadores dentro dos limites aceitáveis.'
    case 'C':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota C indica fragilidade fiscal em pelo menos um dos indicadores avaliados. Requer atenção.'
    case 'D':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota D indica situação fiscal comprometida, o município não possui condições de receber garantia da União.'
  }
}

/**
 * Largura do HTML na captura ≈ folha A4 em px (~96dpi), para colunas/tabelas respirarem;
 * a imagem continua a ser escalada para a área útil (170mm) no jsPDF.
 */
const PDF_LARGURA_CONTEUDO_PX = Math.round(210 * (96 / 25.4))

/**
 * Largura fixa temporária para html2canvas: o conteúdo reflowa como na área útil do PDF
 * (tabelas menos truncadas). Repõe estilos ao terminar.
 */
function definirLarguraCapturaPdf(el: HTMLElement, larguraPx: number): () => void {
  const s = el.style
  const prev = {
    width: s.width,
    minWidth: s.minWidth,
    maxWidth: s.maxWidth,
    boxSizing: s.boxSizing,
  }
  s.boxSizing = 'border-box'
  s.width = `${larguraPx}px`
  s.minWidth = `${larguraPx}px`
  s.maxWidth = `${larguraPx}px`
  return () => {
    s.width = prev.width
    s.minWidth = prev.minWidth
    s.maxWidth = prev.maxWidth
    s.boxSizing = prev.boxSizing
  }
}

/**
 * html2canvas só pinta a região visível de elementos com scroll. Expande o contentor para
 * altura total do conteúdo e remove o clip; devolve função que repõe os estilos inline.
 */
function expandirAreaScrollRelatorioParaPdf(el: HTMLElement): () => void {
  const s = el.style
  const prev = {
    overflow: s.overflow,
    overflowY: s.overflowY,
    overflowX: s.overflowX,
    height: s.height,
    maxHeight: s.maxHeight,
    minHeight: s.minHeight,
    flex: s.flex,
    flexGrow: s.flexGrow,
    flexShrink: s.flexShrink,
    flexBasis: s.flexBasis,
  }

  el.scrollTop = 0
  /* Ceil + margem: scrollHeight por vezes fica ligeiramente abaixo do que o canvas pinta (subpixel). */
  const alturaTotal = Math.ceil(el.scrollHeight) + 12

  s.overflow = 'visible'
  s.overflowY = 'visible'
  s.overflowX = 'visible'
  s.maxHeight = 'none'
  s.flex = '0 0 auto'
  s.flexGrow = '0'
  s.flexShrink = '0'
  s.flexBasis = 'auto'
  s.height = alturaTotal > 0 ? `${alturaTotal}px` : 'auto'

  return () => {
    s.overflow = prev.overflow
    s.overflowY = prev.overflowY
    s.overflowX = prev.overflowX
    s.height = prev.height
    s.maxHeight = prev.maxHeight
    s.minHeight = prev.minHeight
    s.flex = prev.flex
    s.flexGrow = prev.flexGrow
    s.flexShrink = prev.flexShrink
    s.flexBasis = prev.flexBasis
  }
}

/** Igual ao parágrafo "Alíquota aplicável:" na subaba Fiscal (tamanho e cor do texto base). */
const CFEM_CARD_SUBTITLE_STYLE: CSSProperties = {
  fontSize: FS.lg,
  color: '#888780',
  lineHeight: 1.5,
}

/** Alinhado a `CamadaTooltipHover` (variante Fiscal: fundo escuro + borda #3a3a38). */
const CFEM_BAR_TOOLTIP = {
  maxWidthPx: 280,
  padding: '10px 12px',
  backgroundColor: '#2C2C2A',
  border: '1px solid #3a3a38',
  borderRadius: 6,
  fontLine: 1.4 as const,
  /** Ano (legenda do período) */
  fontCaption: FS.sm,
  colorCaption: '#C4C2BB',
  /** Linhas de série */
  fontBody: FS.md,
  colorLabelProcesso: '#8BC5E8',
  colorLabelMunicipio: '#F0B85C',
  colorValue: '#F1EFE8',
  colorMuted: '#9E9C96',
  zIndex: 10060,
} as const

const CFEM_BAR_TOOLTIP_OPACITY_MS = 150

type CfemBarTooltipAnchor = {
  ano: number
  vp: number
  vm: number
  left: number
  top: number
  transform: string
}

function RelatorioCfemBarrasComTooltip({
  processoTemCfem,
  anos,
  procPorAno,
  munPorAno,
  maxProc,
  maxMun,
  trackH,
}: {
  processoTemCfem: boolean
  anos: number[]
  procPorAno: Map<number, number>
  munPorAno: Map<number, number>
  maxProc: number
  maxMun: number
  trackH: number
}) {
  const [tip, setTip] = useState<CfemBarTooltipAnchor | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const positionFromRect = useCallback((r: DOMRect) => {
    const cx = r.left + r.width / 2
    const vw = window.innerWidth
    const margin = 8
    const halfW = CFEM_BAR_TOOLTIP.maxWidthPx / 2 + margin
    const left = Math.max(halfW, Math.min(cx, vw - halfW))
    const showBelow = r.top < 100
    return {
      left,
      top: showBelow ? r.bottom : r.top,
      transform: showBelow
        ? 'translate(-50%, 8px)'
        : 'translate(-50%, calc(-100% - 8px))',
    }
  }, [])

  const showTip = useCallback(
    (
      ano: number,
      vp: number,
      vm: number,
      el: HTMLElement,
    ) => {
      clearHideTimer()
      const pos = positionFromRect(el.getBoundingClientRect())
      setTip({ ano, vp, vm, ...pos })
      requestAnimationFrame(() => setTipVisible(true))
    },
    [clearHideTimer, positionFromRect],
  )

  const hideTip = useCallback(() => {
    setTipVisible(false)
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      setTip(null)
      hideTimerRef.current = null
    }, CFEM_BAR_TOOLTIP_OPACITY_MS)
  }, [clearHideTimer])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  const tooltipPortal =
    tip != null
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none"
            style={{
              position: 'fixed',
              zIndex: CFEM_BAR_TOOLTIP.zIndex,
              left: tip.left,
              top: tip.top,
              transform: tip.transform,
              maxWidth: CFEM_BAR_TOOLTIP.maxWidthPx,
              minWidth: 200,
              padding: CFEM_BAR_TOOLTIP.padding,
              backgroundColor: CFEM_BAR_TOOLTIP.backgroundColor,
              border: CFEM_BAR_TOOLTIP.border,
              borderRadius: CFEM_BAR_TOOLTIP.borderRadius,
              boxSizing: 'border-box',
              opacity: tipVisible ? 1 : 0,
              transition: `opacity ${CFEM_BAR_TOOLTIP_OPACITY_MS}ms ease`,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: CFEM_BAR_TOOLTIP.fontCaption,
                color: CFEM_BAR_TOOLTIP.colorCaption,
                lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                fontWeight: 500,
                marginBottom: 8,
                letterSpacing: '0.02em',
              }}
            >
              {tip.ano}
            </div>
            {processoTemCfem ? (
              <div
                style={{
                  fontSize: CFEM_BAR_TOOLTIP.fontBody,
                  lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                }}
              >
                <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelProcesso }}>
                  Este processo:{' '}
                </span>
                <span
                  style={{
                    color: CFEM_BAR_TOOLTIP.colorValue,
                    fontWeight: 500,
                  }}
                >
                  {formatarRealBrlInteligente(tip.vp)}
                </span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: CFEM_BAR_TOOLTIP.fontBody,
                  lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                }}
              >
                <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelProcesso }}>
                  Este processo:{' '}
                </span>
                <span
                  style={{
                    color: CFEM_BAR_TOOLTIP.colorMuted,
                    fontWeight: 500,
                  }}
                >
                  sem arrecadação
                </span>
              </div>
            )}
            <div
              style={{
                fontSize: CFEM_BAR_TOOLTIP.fontBody,
                lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                marginTop: 6,
              }}
            >
              <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelMunicipio }}>
                Município:{' '}
              </span>
              <span
                style={{
                  color: CFEM_BAR_TOOLTIP.colorValue,
                  fontWeight: 500,
                }}
              >
                {formatarRealBrlInteligente(tip.vm)}
              </span>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {tooltipPortal}
      {processoTemCfem ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginBottom: 22,
          }}
        >
          {anos.map((ano) => {
            const vp = procPorAno.get(ano) ?? 0
            const vm = munPorAno.get(ano) ?? 0
            const hP =
              maxProc > 0 && vp > 0
                ? Math.max(4, (vp / maxProc) * trackH)
                : 0
            const hM =
              maxMun > 0 && vm > 0
                ? Math.max(4, (vm / maxMun) * trackH)
                : 0
            return (
              <div
                key={ano}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 4,
                    width: '100%',
                  }}
                  onMouseEnter={(e) => showTip(ano, vp, vm, e.currentTarget)}
                  onMouseLeave={hideTip}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: trackH,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      {hP > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            height: hP,
                            backgroundColor: '#4A90B8',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: trackH,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      {hM > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            height: hM,
                            backgroundColor: '#EF9F27',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {ano}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginTop: 18,
            marginBottom: 22,
          }}
        >
          {anos.map((ano) => {
            const vm = munPorAno.get(ano) ?? 0
            const vp = 0
            const hM =
              maxMun > 0 && vm > 0
                ? Math.max(4, (vm / maxMun) * trackH)
                : 0
            return (
              <div
                key={ano}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    height: trackH,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => showTip(ano, vp, vm, e.currentTarget)}
                  onMouseLeave={hideTip}
                >
                  {hM > 0 ? (
                    <div
                      style={{
                        width: '100%',
                        height: hM,
                        backgroundColor: '#EF9F27',
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 1,
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {ano}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#1E1E1C',
        borderRadius: 8,
        padding: '20px 18px',
      }}
    >
      {children}
    </div>
  )
}

function SecLabel({
  children,
  branco = false,
  style,
}: {
      children: ReactNode
      branco?: boolean
      style?: CSSProperties
    }) {
  return (
    <p
      style={{
        ...subsecaoTituloStyle,
        color: branco ? '#F1EFE8' : SECTION_TITLE,
        margin: 0,
        marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

function FonteLabel({
  dataIso,
  fonte,
  marginTopPx = FONTE_LABEL_MARGIN_TOP_PX,
}: {
  dataIso: string
  fonte: string
  marginTopPx?: number
}) {
  const [y, m, d] = dataIso.split('-')
  const linha =
    d && m && y
      ? `Atualizado em ${d}/${m}/${y} · Fonte: ${fonte}`
      : `Fonte: ${fonte}`
  return (
    <span
      style={{
        display: 'block',
        textAlign: 'right',
        marginTop: marginTopPx,
        fontSize: 11,
        lineHeight: 1.45,
        color: '#5F5E5A',
      }}
    >
      {linha}
    </span>
  )
}

function IconePdfExportar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4h4M9 12h6M9 15.5h6M9 19h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** PNG estático em public/ (ex.: logo completo da capa). */
async function carregarDataUrlAsset(caminhoRelativo: string): Promise<string | null> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  try {
    const res = await fetch(`${base}${caminhoRelativo}`)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve: (v: string | null) => void) => {
      const fr = new FileReader()
      fr.onload = () =>
        resolve(typeof fr.result === 'string' ? fr.result : null)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function carregarDataUrlPrimeiroDisponivel(
  caminhos: string[],
): Promise<string | null> {
  for (const c of caminhos) {
    const u = await carregarDataUrlAsset(c)
    if (u) return u
  }
  return null
}

function medirImagemDataUrl(
  dataUrl: string,
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0)
        resolve({ w: img.naturalWidth, h: img.naturalHeight })
      else resolve(null)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Mesmo RGB de `desenharCapaPdf` / header do drawer (#0D0D0C). */
const PDF_CAPA_FUNDO_RGB: [number, number, number] = [13, 13, 12]

function pixelEhFundoNeutroEscuro(r: number, g: number, b: number): boolean {
  if (r > 130 && g > 128 && b > 122) return false
  if (r > 50 && b < 55 && r - b > 15) return false
  if (r > 80 && g > 50 && b < 50) return false
  const avg = (r + g + b) / 3
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return avg < 58 && spread < 40
}

/** Troca o preto/cinza do PNG da logo pelo hex exato da capa, sem apagar dourados/marrons. */
async function uniformizarFundoLogoCapaPng(
  dataUrl: string,
): Promise<string | null> {
  const [br, bg, bb] = PDF_CAPA_FUNDO_RGB
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      if (iw <= 0 || ih <= 0) {
        resolve(null)
        return
      }
      const c = document.createElement('canvas')
      c.width = iw
      c.height = ih
      const ctx = c.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, iw, ih)
      const d = imageData.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!
        const gch = d[i + 1]!
        const b = d[i + 2]!
        if (pixelEhFundoNeutroEscuro(r, gch, b)) {
          d[i] = br
          d[i + 1] = bg
          d[i + 2] = bb
          d[i + 3] = 255
        }
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Rasteriza o SVG do símbolo para PNG; cabeçalho das páginas de conteúdo. */
async function carregarPdfSymbolPngRaster(): Promise<string | null> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  const urls = [
    `${base}assets/terradar-pdf-symbol.svg`,
    `${base}assets/terradar-primary-dark.svg`,
    `${base}assets/terrae-pdf-symbol.svg`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const svg = await res.text()
      const png = await new Promise<string | null>((resolve) => {
        const img = new Image()
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
        const u = URL.createObjectURL(blob)
        img.onload = () => {
          const w = img.naturalWidth || 120
          const h = img.naturalHeight || 124
          const c = document.createElement('canvas')
          const dpr = 2
          c.width = w * dpr
          c.height = h * dpr
          const ctx = c.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(u)
            resolve(null)
            return
          }
          ctx.scale(dpr, dpr)
          ctx.drawImage(img, 0, 0, w, h)
          URL.revokeObjectURL(u)
          resolve(c.toDataURL('image/png'))
        }
        img.onerror = () => {
          URL.revokeObjectURL(u)
          resolve(null)
        }
        img.src = u
      })
      if (png) return png
    } catch {
      /* tenta próximo asset */
    }
  }
  return null
}

/** Wordmark TERRADAR em fundo escuro (#1A1A18): TERRA #F1EFE8, DAR #D4A84B. */
function desenharWordmarkTerradarCapaPdf(pdf: JsPdfDoc, x: number, y: number) {
  pdf.setFontSize(26)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(241, 239, 232)
  pdf.text('TERRA', x, y)
  const xDar = x + pdf.getTextWidth('TERRA')
  pdf.setTextColor(212, 168, 75)
  pdf.text('DAR', xDar, y)
}

function desenharWordmarkTerradarRodapePdf(pdf: JsPdfDoc, x: number, y: number) {
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  let xw = x
  pdf.setTextColor(241, 239, 232)
  pdf.text('TERRA', xw, y)
  xw += pdf.getTextWidth('TERRA')
  pdf.setTextColor(212, 168, 75)
  pdf.text('DAR', xw, y)
  xw += pdf.getTextWidth('DAR')
  pdf.setTextColor(136, 135, 128)
  pdf.text(' · Mineral Intelligence', xw, y)
}

/** Ícone de barras verticais (gradiente ouro → bronze); capa e cabeçalho do PDF. */
function desenharLogoSimboloPdf(
  pdf: JsPdfDoc,
  x: number,
  y: number,
  escala: number,
) {
  const cores: [number, number, number][] = [
    [255, 224, 160],
    [252, 200, 115],
    [239, 159, 39],
    [186, 117, 23],
    [99, 56, 15],
  ]
  const largura = 2.8 * escala
  const alturas = [3.5, 5, 6.5, 8, 9.5].map((h) => h * escala)
  const hMax = Math.max(...alturas)
  let cx = x
  for (let i = 0; i < 5; i++) {
    const [r, g, b] = cores[i]!
    pdf.setFillColor(r, g, b)
    const hb = alturas[i]!
    pdf.rect(cx, y + (hMax - hb), largura, hb, 'F')
    cx += largura + 0.55 * escala
  }
}

function desenharCapaPdf(
  pdf: JsPdfDoc,
  processo: Processo,
  regimeColor: string,
  coverLogoPng: string | null,
  coverLogoPx: { w: number; h: number } | null,
  fallbackSymbolPng: string | null,
) {
  const w = 210
  const h = 297
  pdf.setFillColor(13, 13, 12)
  pdf.rect(0, 0, w, h, 'F')

  let yAposLogo = 46.5

  if (coverLogoPng && coverLogoPx) {
    const maxW = 155
    const maxH = 28
    const ar = coverLogoPx.h / coverLogoPx.w
    let dw = maxW
    let dh = dw * ar
    if (dh > maxH) {
      dh = maxH
      dw = dh / ar
    }
    const x = (w - dw) / 2
    const y = 22
    pdf.addImage(coverLogoPng, 'PNG', x, y, dw, dh)
    yAposLogo = y + dh + 10
  } else {
    let textoLogoX: number
    if (fallbackSymbolPng) {
      const logoWmm = 16
      const logoHmm = logoWmm * (124 / 120)
      pdf.addImage(fallbackSymbolPng, 'PNG', 22, 20, logoWmm, logoHmm)
      textoLogoX = 22 + logoWmm + 5
    } else {
      desenharLogoSimboloPdf(pdf, 22, 24.5, 1)
      textoLogoX = 48
    }

    desenharWordmarkTerradarCapaPdf(pdf, textoLogoX, 35.5)
    pdf.setFontSize(9.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(186, 117, 23)
    pdf.text('MINERAL INTELLIGENCE', textoLogoX, 41.5)
    yAposLogo = 46.5
  }

  pdf.setDrawColor(239, 159, 39)
  pdf.setLineWidth(0.35)
  pdf.line(22, yAposLogo, w - 22, yAposLogo)

  const yNumero = yAposLogo + 72
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(32)
  pdf.setTextColor(241, 239, 232)
  pdf.text(processo.numero, w / 2, yNumero, { align: 'center' })

  const [rr, gg, bb] = hexParaRgb(regimeColor)
  pdf.setFontSize(14)
  pdf.setTextColor(rr, gg, bb)
  pdf.text(REGIME_LABELS[processo.regime], w / 2, yNumero + 18, {
    align: 'center',
  })

  pdf.setTextColor(211, 209, 199)
  pdf.setFontSize(14)
  const titLines = pdf.splitTextToSize(processo.titular, 166)
  let yTit = yNumero + 28
  for (const line of titLines) {
    pdf.text(line, w / 2, yTit, { align: 'center' })
    yTit += 5.2
  }

  const now = new Date()
  const ds = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  pdf.setFontSize(9)
  pdf.setTextColor(95, 94, 90)
  pdf.text(`Gerado em ${ds}`, w / 2, h - 30, { align: 'center' })
  pdf.text(
    'Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo',
    w / 2,
    h - 24,
    { align: 'center' },
  )
}

function desenharHeaderFooterPaginaConteudo(
  pdf: JsPdfDoc,
  numeroProcesso: string,
  paginaAtual: number,
  totalPaginas: number,
  logoSymbolPng: string | null,
) {
  const m = 20
  pdf.setDrawColor(239, 159, 39)
  pdf.setLineWidth(0.25)
  pdf.line(m, 14, 210 - m, 14)
  if (logoSymbolPng) {
    const hmm = 5.2
    const wmm = hmm * (120 / 124)
    pdf.addImage(logoSymbolPng, 'PNG', m, 3.5, wmm, hmm)
  } else {
    desenharLogoSimboloPdf(pdf, m, 4, 0.32)
  }
  pdf.setFontSize(9)
  pdf.setTextColor(136, 135, 128)
  pdf.setFont('helvetica', 'normal')
  pdf.text(numeroProcesso, 210 - m, 12, { align: 'right' })

  const footY = 289
  pdf.setDrawColor(44, 44, 42)
  pdf.line(m, footY - 10, 210 - m, footY - 10)
  desenharWordmarkTerradarRodapePdf(pdf, m, footY)
  pdf.text(`${paginaAtual} / ${totalPaginas}`, 210 - m, footY, {
    align: 'right',
  })
}

export interface RelatorioCompletoProps {
  processo: Processo | null
  aberto: boolean
  onFechar: () => void
  abaInicial?: AbaId
  /** Quando incrementa (ex.: «Ver decomposição completa» no mapa), força a aba ativa = `abaInicial`. */
  abaRiscoRequestId?: number
}

export function RelatorioCompleto({
  processo,
  aberto,
  onFechar,
  abaInicial = 'processo',
  abaRiscoRequestId = 0,
}: RelatorioCompletoProps) {
  const dados: RelatorioData | undefined = processo
    ? relatoriosMock[processo.id]
    : undefined

  const [aba, setAba] = useState<AbaId>(abaInicial)
  const [pdfGerando, setPdfGerando] = useState(false)
  const pdfCaptureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aberto) setAba(abaInicial)
  }, [aberto, abaInicial, abaRiscoRequestId])

  const regimeColor = processo
    ? (REGIME_COLORS[processo.regime] ?? '#888780')
    : '#888780'

  const alertasOrdenados = useMemo(() => {
    if (!processo) return []
    return [...processo.alertas].sort(
      (a, b) => a.nivel_impacto - b.nivel_impacto,
    )
  }, [processo])

  const riskDecomposicaoMemo = useMemo(() => {
    if (!processo) return null
    return (
      processo.risk_decomposicao ?? gerarRiskDecomposicaoParaProcesso(processo)
    )
  }, [processo])

  const exportarPDF = useCallback(async () => {
    if (!processo || !dados || pdfGerando || !pdfCaptureRef.current) return
    const abaAntes = aba
    setPdfGerando(true)
    try {
      let coverLogoPng: string | null = null
      const pathsLogoCapa = [
        'assets/terradar-primary-dark.png',
        'assets/terradar-pdf-cover-logo.png',
        'assets/terrae-pdf-cover-logo.png',
      ] as const
      for (const p of pathsLogoCapa) {
        const u = await carregarDataUrlAsset(p)
        if (u) {
          coverLogoPng = u
          break
        }
      }
      /* Alinha o fundo do PNG (#000 ou cinza escuro neutro) ao mesmo RGB da capa (`PDF_CAPA_FUNDO_RGB`). */
      if (coverLogoPng) {
        const uniformizado = await uniformizarFundoLogoCapaPng(coverLogoPng)
        if (uniformizado) coverLogoPng = uniformizado
      }
      const coverLogoPx = coverLogoPng
        ? await medirImagemDataUrl(coverLogoPng)
        : null
      const logoSymbolPng = await carregarPdfSymbolPngRaster()
      const totalPaginas = 1 + ABAS.length
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      desenharCapaPdf(
        pdf,
        processo,
        regimeColor,
        coverLogoPng,
        coverLogoPx,
        logoSymbolPng,
      )

      for (let i = 0; i < ABAS.length; i++) {
        const id = ABAS[i]!.id
        flushSync(() => setAba(id))
        await new Promise<void>((r) => setTimeout(r, 120))
        const el = pdfCaptureRef.current
        if (!el) continue

        const restaurarLargura = definirLarguraCapturaPdf(
          el,
          PDF_LARGURA_CONTEUDO_PX,
        )
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        const restaurarScroll = expandirAreaScrollRelatorioParaPdf(el)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        let canvas: HTMLCanvasElement
        try {
          canvas = await html2canvas(el, {
            scale: 1.75,
            useCORS: true,
            logging: false,
            backgroundColor: '#111110',
          })
        } finally {
          restaurarScroll()
          restaurarLargura()
        }
        const img = canvas.toDataURL('image/png', 1)
        pdf.addPage()
        desenharHeaderFooterPaginaConteudo(
          pdf,
          processo.numero,
          2 + i,
          totalPaginas,
          logoSymbolPng,
        )
        const m = 20
        const topReserve = 16
        const botReserve = 14
        const imgMaxW = 210 - 2 * m
        const imgMaxH = 297 - m - topReserve - m - botReserve
        const ratio = canvas.width / canvas.height
        let dw = imgMaxW
        let dh = dw / ratio
        if (dh > imgMaxH) {
          dh = imgMaxH
          dw = dh * ratio
        }
        const xOff = m + (imgMaxW - dw) / 2
        pdf.addImage(img, 'PNG', xOff, m + topReserve, dw, dh)
      }

      const hoje = new Date()
      const d = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`
      const safeNum = processo.numero.replace(/\//g, '_').replace(/\s/g, '_')
      pdf.save(`TERRADAR_${safeNum}_${d}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      flushSync(() => setAba(abaAntes))
      setPdfGerando(false)
    }
  }, [aba, processo, dados, pdfGerando, regimeColor])

  if (!processo || !dados) return null

  const { dados_anm, territorial, intel_mineral, fiscal, timestamps } = dados

  const prazoVencimentoCard = prazoVencimentoExibicaoRelatorio(
    dados_anm.prazo_vencimento,
    processo.regime,
  )

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: 48,
        right: 0,
        width: 520,
        height: 'calc(100vh - 48px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111110',
        borderLeft: '1px solid #2C2C2A',
        transform: aberto ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          height: 56,
          flexShrink: 0,
          backgroundColor: '#0D0D0C',
          borderBottom: '1px solid #2C2C2A',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <TextoTruncadoComTooltip
            text={processo.numero}
            placement="above"
            className="block min-w-0"
            style={{
              fontSize: FS.base,
              fontWeight: 500,
              color: '#F1EFE8',
              flexShrink: 1,
            }}
          />
          <RegimeBadge regime={processo.regime} variant="drawer" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => void exportarPDF()}
            disabled={pdfGerando}
            className="cursor-pointer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxSizing: 'border-box',
              minHeight: 28,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#5F5E5A',
              borderRadius: 6,
              padding: '4px 12px',
              backgroundColor: 'transparent',
              fontSize: FS.md,
              fontWeight: 400,
              color: pdfGerando ? '#5F5E5A' : '#B4B2A9',
              cursor: pdfGerando ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (pdfGerando) return
              e.currentTarget.style.color = '#F1EFE8'
              e.currentTarget.style.borderColor = '#888780'
              e.currentTarget.style.backgroundColor = 'rgba(241, 239, 232, 0.08)'
            }}
            onMouseLeave={(e) => {
              if (pdfGerando) return
              e.currentTarget.style.color = '#B4B2A9'
              e.currentTarget.style.borderColor = '#5F5E5A'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <IconePdfExportar />
            {pdfGerando ? 'Exportando...' : 'Exportar PDF'}
          </button>
          <div
            style={{
              width: 1,
              height: 16,
              backgroundColor: '#2C2C2A',
              margin: '0 12px',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar relatório"
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{
              fontSize: 18,
              lineHeight: 1,
              color: '#888780',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D3D1C7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            ✕
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {pdfGerando ? (
          <div
            className="terrae-relatorio-pdf-export-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="terrae-relatorio-pdf-export-spinner"
              aria-hidden
            />
            <span
              style={{
                fontSize: FS.base,
                fontWeight: 500,
                color: '#F1EFE8',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              Exportando relatório...
            </span>
          </div>
        ) : null}

        <nav
          style={{
            height: 44,
            flexShrink: 0,
            backgroundColor: '#0D0D0C',
            borderBottom: '1px solid #2C2C2A',
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
          }}
        >
        {ABAS.map((t) => {
          const ativo = aba === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAba(t.id)}
              className="cursor-pointer border-0 bg-transparent whitespace-nowrap"
              style={{
                fontSize: FS.md,
                padding: '0 8px',
                height: '100%',
                fontWeight: 600,
                color: ativo ? '#F1EFE8' : '#888780',
                borderBottom: ativo ? '2px solid #EF9F27' : '2px solid transparent',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!ativo) e.currentTarget.style.color = '#B4B2A9'
              }}
              onMouseLeave={(e) => {
                if (!ativo) e.currentTarget.style.color = '#888780'
              }}
            >
              {t.label}
            </button>
          )
        })}
        </nav>

        <div
          ref={pdfCaptureRef}
          className={`terrae-relatorio-drawer-scroll min-h-0 flex-1 overflow-y-auto ${pdfGerando ? 'terrae-relatorio--pdf-export' : ''}`}
          style={{
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
        {aba === 'processo' ? (
          <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                <p
                  style={{
                    fontSize: FS.display,
                    fontWeight: 500,
                    color: '#F1EFE8',
                    margin: 0,
                    lineHeight: 1.25,
                  }}
                >
                  {processo.numero}
                </p>
                {(() => {
                  const sit = processo.situacao
                  const cfg =
                    sit === 'ativo'
                      ? {
                          bg: 'rgba(74, 144, 184, 0.15)',
                          fg: '#4A90B8',
                          l: 'Ativo',
                        }
                      : sit === 'bloqueado'
                        ? {
                            bg: 'rgba(226, 75, 74, 0.15)',
                            fg: '#E24B4A',
                            l: 'Bloqueado',
                          }
                        : {
                            bg: 'rgba(136, 135, 128, 0.15)',
                            fg: '#888780',
                            l: 'Inativo',
                          }
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: FS.sm,
                        fontWeight: 700,
                        backgroundColor: cfg.bg,
                        color: cfg.fg,
                      }}
                    >
                      {cfg.l}
                    </span>
                  )
                })()}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: 16,
                  rowGap: 20,
                  marginTop: 0,
                }}
              >
                {[
                  { label: 'Titular', value: processo.titular, span: 2 },
                  {
                    label: 'Substância',
                    value: apresentarSubstanciaLabel(processo.substancia),
                  },
                  { label: 'Regime', value: REGIME_LABELS[processo.regime] },
                  { label: 'Área', value: `${processo.area_ha.toLocaleString('pt-BR')} ha` },
                  { label: 'UF', value: processo.uf },
                  { label: 'Município', value: processo.municipio },
                  { label: 'Fase', value: FASE_LABELS[processo.fase] },
                  {
                    label: 'Data Protocolo',
                    value: formatarDataIsoPtBr(dados_anm.data_protocolo),
                  },
                  {
                    label: 'Prazo Vencimento',
                    value: prazoVencimentoCard.texto,
                    valueColor: prazoVencimentoCard.corValor,
                  },
                  {
                    label: 'Tempo de Tramitação',
                    value: `${dados_anm.tempo_tramitacao_anos} anos`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      gridColumn: row.span === 2 ? 'span 2' : undefined,
                    }}
                  >
                    <p
                      style={{
                        fontSize: FS.md,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: '#F1EFE8',
                        margin: '0 0 6px 0',
                      }}
                    >
                      {row.label}
                    </p>
                    <p
                      style={{
                        fontSize: FS.base,
                        color:
                          'valueColor' in row && row.valueColor != null
                            ? row.valueColor
                            : '#D3D1C7',
                        margin: 0,
                        lineHeight: 1.35,
                      }}
                    >
                      {row.label === 'Tempo de Tramitação' ? (
                        <span
                          style={{
                            color: corTramitacaoAnos(
                              dados_anm.tempo_tramitacao_anos,
                            ),
                          }}
                        >
                          {`${dados_anm.tempo_tramitacao_anos} anos`}
                        </span>
                      ) : (
                        row.value
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="ANM / Cadastro Mineiro"
              />
            </Card>

            <Card>
              <SecLabel branco>Último despacho ANM</SecLabel>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '0 0 6px 0',
                  lineHeight: 1.5,
                }}
              >
                {formatarDataIsoPtBr(dados_anm.data_ultimo_despacho)}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#D3D1C7',
                  margin: '0 0 8px 0',
                  lineHeight: 1.5,
                }}
              >
                {dados_anm.ultimo_despacho}
              </p>
              <a
                href={SEI_ANM_PESQUISA_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: FS.lg,
                  color: '#EF9F27',
                  margin: 0,
                  lineHeight: 1.5,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none'
                }}
              >
                SEI: {dados_anm.numero_sei}
              </a>
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="SEI-ANM"
              />
            </Card>

            {dados_anm.pendencias.length > 0 ? (
              <Card>
                <SecLabel branco>Pendências</SecLabel>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {dados_anm.pendencias.map((p, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        marginBottom: i < dados_anm.pendencias.length - 1 ? 10 : 0,
                      }}
                    >
                      <span style={{ color: '#E24B4A', fontSize: FS.md, lineHeight: 1.4 }}>
                        ▲
                      </span>
                      <span style={{ fontSize: FS.md, color: '#D3D1C7', lineHeight: 1.4 }}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
                <FonteLabel
                  dataIso={timestamps.cadastro_mineiro}
                  fonte="ANM / Cadastro Mineiro"
                />
              </Card>
            ) : null}

            {dados_anm.observacoes_tecnicas.trim() ? (
              <Card>
                <SecLabel branco>Observações técnicas</SecLabel>
                <p
                  style={{
                    fontSize: FS.lg,
                    color: '#888780',
                    fontStyle: 'italic',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {observacoesComNegritoHaLocal(
                    dados_anm.observacoes_tecnicas,
                    processo,
                  )}
                </p>
                <FonteLabel
                  dataIso={timestamps.cadastro_mineiro}
                  fonte="Terrae / Análise Técnica"
                />
              </Card>
            ) : null}
          </>
        ) : null}

        {aba === 'territorio' ? (
          <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                <SecLabel branco style={{ marginBottom: 0, flex: 1 }}>
                  Áreas sensíveis
                </SecLabel>
                <CamadaTooltipHover texto={AREAS_SENSIVEIS_DIST_TOOLTIP} maxWidthPx={300}>
                  <span
                    aria-label="Sobre cores de distância"
                    style={{
                      cursor: 'help',
                      fontSize: FS.md,
                      color: '#888780',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ⓘ
                  </span>
                </CamadaTooltipHover>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    dot: DOT_TI,
                    nome: territorial.nome_ti_proxima,
                    tipo: 'Terra Indígena',
                    km: territorial.distancia_ti_km,
                    semIdTexto: 'Sem terra indígena na região',
                  },
                  {
                    dot: DOT_UC,
                    nome: territorial.nome_uc_proxima,
                    tipo: territorial.tipo_uc,
                    km: territorial.distancia_uc_km,
                    semIdTexto:
                      'Sem unidade de conservação identificada na região monitorada',
                  },
                ].map((row, i) => {
                  const semDado = row.km === null || row.nome == null
                  const ausenciaTiPositiva =
                    row.tipo === 'Terra Indígena' && semDado
                  const corCirculo = ausenciaTiPositiva
                    ? DOT_AUSENCIA_POSITIVA
                    : semDado
                      ? '#444441'
                      : row.dot
                  const corTextoEsquerda = ausenciaTiPositiva
                    ? DOT_AUSENCIA_POSITIVA
                    : '#D3D1C7'
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: corCirculo,
                            flexShrink: 0,
                          }}
                        />
                        {row.nome && row.dot === DOT_UC ? (
                          <TextoTruncadoComTooltip
                            text={rotuloUcUmaLinha(row.nome, row.tipo ?? null)}
                            textoTooltip={tooltipTextoUcCompleto(
                              row.nome,
                              row.tipo ?? null,
                            )}
                            placement="side"
                            className="min-w-0 flex-1"
                            style={{ fontSize: FS.md, color: corTextoEsquerda }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: FS.md,
                              color: corTextoEsquerda,
                              minWidth: 0,
                            }}
                          >
                            {row.nome ? row.nome : row.semIdTexto}
                          </span>
                        )}
                      </div>
                      {row.km !== null ? (
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 500,
                            color: corDistanciaKm(row.km),
                          }}
                        >
                          {`${row.km.toFixed(1)} km`}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_APP,
                        flexShrink: 0,
                      }}
                    />
                    <CamadaTooltipHover texto={GLOSSARIO_APP} maxWidthPx={300}>
                      <span
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          cursor: 'help',
                          textDecoration: 'underline dotted',
                          textUnderlineOffset: 2,
                        }}
                      >
                        APP
                      </span>
                    </CamadaTooltipHover>
                  </div>
                  <span
                    style={{
                      fontSize: FS.md,
                      fontWeight: 500,
                      color: territorial.sobreposicao_app
                        ? '#E24B4A'
                        : '#1D9E75',
                    }}
                  >
                    {territorial.sobreposicao_app ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_QUILOMBOLA,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: FS.md, color: '#D3D1C7' }}>
                      <CamadaTooltipHover texto={GLOSSARIO_QUILOMBOLA} maxWidthPx={300}>
                        <span
                          style={{
                            cursor: 'help',
                            textDecoration: 'underline dotted',
                            textUnderlineOffset: 2,
                          }}
                        >
                          Quilombola
                        </span>
                      </CamadaTooltipHover>
                      {territorial.nome_quilombola
                        ? ` (${territorial.nome_quilombola})`
                        : ''}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: FS.md,
                      fontWeight: 500,
                      color: territorial.sobreposicao_quilombola
                        ? '#E24B4A'
                        : '#1D9E75',
                    }}
                  >
                    {territorial.sobreposicao_quilombola ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
              <FonteLabel
                dataIso={timestamps.terras_indigenas}
                fonte="FUNAI / ICMBio"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Logística</SecLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    nome: territorial.nome_ferrovia,
                    km: territorial.distancia_ferrovia_km,
                    l: 'Ferrovia',
                    semTexto: 'Sem ferrovia na região monitorada',
                  },
                  {
                    nome: territorial.nome_porto,
                    km: territorial.distancia_porto_km,
                    l: 'Porto',
                    semTexto: 'Sem porto na região monitorada',
                  },
                  {
                    nome: 'Sede municipal',
                    km: territorial.distancia_sede_municipal_km,
                    l: 'Sede municipal',
                    semTexto: '',
                  },
                ].map((row, i) => {
                  const isSede = row.l === 'Sede municipal'
                  const isFerrovia = row.l === 'Ferrovia'
                  const isPorto = row.l === 'Porto'
                  const temInfra =
                    isSede || (row.nome != null && row.nome !== '')
                  const corCirculo = !temInfra
                    ? DOT_AUSENCIA_INFRA
                    : isSede
                      ? DOT_SEDE_MUNICIPAL
                      : isFerrovia
                        ? DOT_FERROVIA
                        : isPorto
                          ? DOT_PORTO
                          : DOT_AUSENCIA_INFRA
                  const textoEsquerda = isSede
                    ? `${row.l} · ${processo.municipio}`
                    : row.nome
                      ? `${row.l} · ${row.nome}`
                      : row.semTexto
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: corCirculo,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: FS.md, color: '#D3D1C7' }}>
                          {textoEsquerda}
                        </span>
                      </div>
                      {row.km !== null ? (
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 500,
                            color: corDistanciaKm(row.km),
                          }}
                        >
                          {`${row.km.toFixed(1)} km`}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="DNIT / Antaq"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Bioma</SecLabel>
              <p
                style={{
                  fontSize: FS.xl,
                  fontWeight: 500,
                  color: '#F1EFE8',
                  margin: '0 0 8px 0',
                }}
              >
                {territorial.bioma}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {biomaImplicacoes(territorial.bioma)}
              </p>
              <FonteLabel
                dataIso={timestamps.unidades_conservacao}
                fonte="IBGE / Biomas"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Aquífero</SecLabel>
              {territorial.nome_aquifero ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_AQUIFERO,
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                      aria-hidden
                    />
                    <p
                      style={{
                        fontSize: FS.lg,
                        color: '#D3D1C7',
                        margin: 0,
                        lineHeight: 1.5,
                        flex: 1,
                      }}
                    >
                      {territorial.nome_aquifero}
                    </p>
                  </div>
                  <p
                    style={{
                      fontSize: FS.lg,
                      color: '#888780',
                      margin: 0,
                      lineHeight: 1.5,
                      paddingLeft: 16,
                    }}
                  >
                    {territorial.distancia_aquifero_km !== null ? (
                      <>
                        Distância aproximada:{' '}
                        <span
                          style={{
                            color: corDistanciaKm(territorial.distancia_aquifero_km),
                          }}
                        >
                          {`${territorial.distancia_aquifero_km.toFixed(1)} km`}
                        </span>
                      </>
                    ) : null}
                  </p>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: DOT_AUSENCIA_POSITIVA,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <p style={{ fontSize: FS.base, color: '#1D9E75', margin: 0 }}>
                    Nenhum aquífero relevante identificado
                  </p>
                </div>
              )}
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="CPRM / SGB"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}

        {aba === 'inteligencia' ? (
          <>
            <Card>
              <SecLabel branco style={{ marginBottom: 2 }}>
                Contexto global
              </SecLabel>
              <p
                style={{
                  fontSize: FS.xl,
                  fontWeight: 500,
                  color: '#EF9F27',
                  margin: '0 0 12px 0',
                }}
              >
                {processo.substancia.toUpperCase()}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                }}
              >
                {(() => {
                  const pctR = intel_mineral.reservas_brasil_mundial_pct
                  const corR =
                    pctR > 20 ? '#1D9E75' : pctR >= 5 ? '#EF9F27' : '#888780'
                  const pctP = intel_mineral.producao_brasil_mundial_pct
                  const corP =
                    pctP > 20 ? '#1D9E75' : pctP < 5 ? '#E24B4A' : '#EF9F27'
                  return (
                    <>
                      <div>
                        <p
                          style={{
                            ...subsecaoTituloStyle,
                            margin: '0 0 2px 0',
                          }}
                        >
                          Reservas Brasil
                        </p>
                        <p
                          style={{
                            fontSize: FS.display,
                            fontWeight: 500,
                            color: corR,
                            margin: '0 0 6px 0',
                          }}
                        >
                          {pctR}%
                        </p>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#2C2C2A',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pctR)}%`,
                              height: '100%',
                              backgroundColor: corR,
                            }}
                          />
                        </div>
                        <p
                          style={{
                            fontSize: FS.md,
                            color: SECTION_TITLE,
                            margin: '6px 0 0 0',
                          }}
                        >
                          das reservas mundiais
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            ...subsecaoTituloStyle,
                            margin: '0 0 2px 0',
                          }}
                        >
                          Produção Brasil
                        </p>
                        <p
                          style={{
                            fontSize: FS.display,
                            fontWeight: 500,
                            color: corP,
                            margin: '0 0 6px 0',
                          }}
                        >
                          {pctP}%
                        </p>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#2C2C2A',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pctP)}%`,
                              height: '100%',
                              backgroundColor: corP,
                            }}
                          />
                        </div>
                        <p
                          style={{
                            fontSize: FS.md,
                            color: SECTION_TITLE,
                            margin: '6px 0 0 0',
                          }}
                        >
                          da produção mundial
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
              {(() => {
                const pctR = intel_mineral.reservas_brasil_mundial_pct
                const pctP = intel_mineral.producao_brasil_mundial_pct
                const diff = pctR - pctP
                const fPg = formatarGapPontosPercentuais(diff)
                const fX = formatarPctContextoGlobal(pctP)
                const fY = formatarPctContextoGlobal(pctR)

                let corGap: string
                let gapTxt: string
                let explic: string

                if (Math.abs(diff) < 0.5) {
                  corGap = '#888780'
                  gapTxt =
                    Math.abs(diff) < 0.05
                      ? 'Gap: 0 p.p.'
                      : `Gap: ${fPg} p.p.`
                  explic = `A participação brasileira na produção mundial (${fX}%) está alinhada à sua proporção de reservas (${fY}%).`
                } else if (diff > 0) {
                  corGap = '#1D9E75'
                  gapTxt = `Gap: +${fPg} p.p.`
                  explic = `A produção brasileira (${fX}%) está abaixo da proporção de reservas (${fY}%), indicando potencial de expansão de ${fPg} p.p.`
                } else {
                  corGap = '#E8A830'
                  gapTxt = `Gap: ${fPg} p.p.`
                  explic = `A produção brasileira (${fX}%) supera a proporção de reservas (${fY}%), indicando ritmo de extração acelerado`
                }

                return (
                  <>
                    <p
                      style={{
                        fontSize: FS.lg,
                        fontWeight: 500,
                        color: corGap,
                        margin: '16px 0 0 0',
                        lineHeight: 1.45,
                      }}
                    >
                      {gapTxt}
                    </p>
                    <p
                      style={{
                        fontSize: FS.md,
                        color: '#888780',
                        margin: '6px 0 0 0',
                        lineHeight: 1.45,
                      }}
                    >
                      {explic}
                    </p>
                  </>
                )
              })()}
              <FonteLabel
                dataIso={timestamps.usgs}
                fonte="USGS Mineral Commodity Summaries"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Preço e tendência</SecLabel>
              {intel_mineral.unidade_preco === 'oz' &&
              intel_mineral.preco_referencia_usd_oz != null ? (
                <>
                  <p
                    style={{
                      fontSize: FS.h2,
                      fontWeight: 500,
                      color: '#F1EFE8',
                      margin: '0 0 10px 0',
                    }}
                  >
                    USD{' '}
                    {intel_mineral.preco_referencia_usd_oz.toLocaleString('pt-BR')}
                    /oz
                  </p>
                  <p
                    style={{
                      fontSize: FS.sm,
                      color: '#888780',
                      margin: '0 0 4px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    (≈ USD{' '}
                    {intel_mineral.preco_medio_usd_t.toLocaleString('pt-BR')}/t)
                  </p>
                </>
              ) : (
                <p
                  style={{
                    fontSize: FS.h2,
                    fontWeight: 500,
                    color: '#F1EFE8',
                    margin: '0 0 4px 0',
                  }}
                >
                  {intel_mineral.preco_medio_usd_t.toLocaleString('pt-BR')} USD/t
                </p>
              )}
              {(() => {
                const t = intel_mineral.tendencia_preco
                const cfg =
                  t === 'alta'
                    ? {
                        bg: 'rgba(29, 158, 117, 0.15)',
                        fg: '#1D9E75',
                        tx: 'Alta',
                        Icon: IconTendenciaAlta,
                      }
                    : t === 'estavel'
                      ? {
                          bg: 'rgba(136, 135, 128, 0.15)',
                          fg: '#B8B5AC',
                          tx: 'Estável',
                          Icon: IconTendenciaEstavel,
                        }
                      : {
                          bg: 'rgba(226, 75, 74, 0.15)',
                          fg: '#E24B4A',
                          tx: 'Queda',
                          Icon: IconTendenciaQueda,
                        }
                const Ic = cfg.Icon
                return (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      borderRadius: 5,
                      padding: '6px 12px',
                      fontSize: FS.lg,
                      fontWeight: 500,
                      backgroundColor: cfg.bg,
                      color: cfg.fg,
                      marginBottom: 18,
                    }}
                  >
                    <Ic />
                    {cfg.tx}
                  </span>
                )
              })()}
              <p style={{ fontSize: FS.lg, color: '#888780', margin: 0, lineHeight: 1.5 }}>
                Demanda projetada 2030: {intel_mineral.demanda_projetada_2030}
              </p>
              <FonteLabel
                dataIso={timestamps.preco_spot}
                fonte="Trading Economics / LME · Projeção: IEA Critical Minerals Report 2025"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Aplicações</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {intel_mineral.aplicacoes_principais.map((a) => (
                  <span
                    key={a}
                    style={{
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: FS.sm,
                      backgroundColor: 'rgba(239, 159, 39, 0.15)',
                      color: '#EF9F27',
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.usgs}
                fonte="USGS Mineral Commodity Summaries"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Estratégia nacional</SecLabel>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#D3D1C7',
                  margin: 0,
                  lineHeight: 1.5,
                  borderLeft: '3px solid #EF9F27',
                  paddingLeft: 12,
                }}
              >
                {intel_mineral.estrategia_nacional}
              </p>
              <FonteLabel
                dataIso={timestamps.alertas_legislativos}
                fonte="MME / Plano Nacional de Mineração 2030 + Adoo (monitoramento regulatório)"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <div
              style={{
                backgroundColor: '#0D0D0C',
                borderRadius: 8,
                padding: '20px 18px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                Valor estimado da reserva
              </p>
              <p
                style={{
                  fontSize: FS.highlight,
                  fontWeight: 500,
                  color: '#EF9F27',
                  margin: '0 0 20px 0',
                }}
              >
                {formatarUsdMiInteligente(intel_mineral.valor_estimado_usd_mi)}
              </p>
              <p
                style={{
                  fontSize: FS.sm,
                  color: '#A3A29A',
                  fontStyle: 'italic',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {intel_mineral.metodologia_estimativa}
              </p>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="Estimativa Terrae / SIGMINE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </div>

            <Card>
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  margin: 0,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                Processos vizinhos
              </p>
              <div
                style={
                  pdfGerando
                    ? { overflow: 'visible' }
                    : { overflowX: 'auto' }
                }
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: FS.md,
                  }}
                >
                  <thead>
                    <tr>
                      {(['Nº processo', 'Titular', 'Fase'] as const).map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            ...subsecaoTituloStyle,
                            fontSize: FS.min,
                            padding: '0 6px 8px 0',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        style={{
                          textAlign: 'left',
                          ...subsecaoTituloStyle,
                          fontSize: FS.min,
                          padding: '0 6px 8px 0',
                        }}
                      >
                        <CamadaTooltipHover
                          texto="Distância em quilômetros entre os centroides dos dois processos (fonte: SIGMINE/ANM)"
                          maxWidthPx={300}
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            DIST. (km)
                          </span>
                        </CamadaTooltipHover>
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          ...subsecaoTituloStyle,
                          fontSize: FS.min,
                          padding: '0 6px 8px 0',
                        }}
                      >
                        <CamadaTooltipHover
                          texto="Risk Score do processo vizinho (0-100, calculado pelo modelo de risco Terrae)"
                          maxWidthPx={300}
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            RISK
                          </span>
                        </CamadaTooltipHover>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {intel_mineral.processos_vizinhos.map((v, i) => (
                      <tr
                        key={v.numero}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#0D0D0C' : '#1A1A18',
                        }}
                      >
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          {v.numero}
                        </td>
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          <TextoTruncadoComTooltip
                            text={v.titular}
                            placement="above"
                            className="block max-w-[100px] terrae-pdf-titular-wrap"
                            style={{ fontSize: FS.md, color: '#D3D1C7' }}
                          />
                        </td>
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          {v.fase}
                        </td>
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          {v.distancia_km} km
                        </td>
                        <td
                          style={{
                            padding: '8px 0',
                            fontWeight: 500,
                            color: corFaixaRisco(v.risk_score),
                          }}
                        >
                          {v.risk_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="ANM / SIGMINE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}

        {aba === 'risco' ? (
          <>
            <Card>
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  textAlign: 'center',
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                Risk Score
              </p>
              {processo.risk_score === null ? (
                <p
                  style={{
                    fontSize: FS.jumbo,
                    fontWeight: 500,
                    textAlign: 'center',
                    color: '#888780',
                    margin: '0 0 8px 0',
                  }}
                >
                  N/A
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: FS.jumbo,
                      fontWeight: 500,
                      textAlign: 'center',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {riskDecomposicaoMemo ? (
                      <CamadaTooltipHover
                        conteudo={
                          <RiskTotalCalcTooltipContent
                            decomposicao={riskDecomposicaoMemo}
                          />
                        }
                        maxWidthPx={280}
                        preferAbove
                        inlineWrap
                      >
                        <span
                          style={{
                            color: corFaixaRisco(processo.risk_score),
                            borderBottom: `1px dotted ${corFaixaRisco(processo.risk_score)}`,
                            cursor: 'help',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {processo.risk_score}
                        </span>
                      </CamadaTooltipHover>
                    ) : (
                      <span
                        style={{ color: corFaixaRisco(processo.risk_score) }}
                      >
                        {processo.risk_score}
                      </span>
                    )}
                  </p>
                  <p
                    style={{
                      fontSize: FS.lg,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: '#D3D1C7',
                      margin: 0,
                    }}
                  >
                    {classificacaoRiscoTotal(processo.risk_score)}
                  </p>
                  {processo.risk_breakdown ? (
                    <div
                      style={{
                        marginTop: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                      }}
                    >
                      {(
                        [
                          ['Geológico', processo.risk_breakdown.geologico],
                          ['Ambiental', processo.risk_breakdown.ambiental],
                          ['Social', processo.risk_breakdown.social],
                          ['Regulatório', processo.risk_breakdown.regulatorio],
                        ] as const
                      ).map(([label, val]) => {
                        const cor = corFaixaRisco(val)
                        return (
                          <div
                            key={label}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              minWidth: 0,
                              maxWidth: '100%',
                            }}
                          >
                            <span
                              style={{
                                fontSize: FS.base,
                                color: '#888780',
                                width: 100,
                                flexShrink: 0,
                              }}
                            >
                              {label}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: '#2C2C2A',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, val))}%`,
                                  height: '100%',
                                  backgroundColor: cor,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: FS.base,
                                fontWeight: 700,
                                color: cor,
                                width: 36,
                                textAlign: 'right',
                                flexShrink: 0,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {val}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </>
              )}
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="Terrae, com dados ANM, FUNAI, ICMBio e IBGE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            {processo.risk_score !== null && riskDecomposicaoMemo ? (
              <Card>
                <RiskDecomposicaoRelatorioPanel
                  decomposicao={riskDecomposicaoMemo}
                />
              </Card>
            ) : null}

            <Card>
              <SecLabel branco>Alertas regulatórios</SecLabel>
              {alertasOrdenados.length === 0 ? (
                <p style={{ fontSize: FS.base, color: '#888780', margin: 0 }}>
                  Nenhum alerta regulatório ativo
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {alertasOrdenados.map((al, idx) => {
                    const metaFonte: CSSProperties = {
                      fontSize: FS.sm,
                      color: '#5F5E5A',
                    }
                    const rotuloFonte = rotuloFontePublicacaoExibicao(
                      al.fonte,
                      al.fonte_diario,
                    )
                    const relevanciaMeta = estiloBadgeRelevancia(
                      al.nivel_impacto,
                      al.tipo_impacto,
                    )
                    return (
                    <div key={al.id}>
                      {idx > 0 ? (
                        <div
                          style={{
                            height: 1,
                            backgroundColor: '#2C2C2A',
                            margin: '16px 0',
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                        }}
                      >
                        <AlertaItemImpactoBar
                          nivel={al.nivel_impacto}
                          tipo_impacto={al.tipo_impacto}
                          textoDetalhe={textoTooltipNivelImpactoLegislativo(
                            al.nivel_impacto,
                          )}
                          zIndexTooltip={CFEM_BAR_TOOLTIP.zIndex + 1}
                          barraAlturaFixaPx={48}
                        />
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingLeft: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'nowrap',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 12,
                            }}
                          >
                            <p
                              style={{
                                flex: 1,
                                minWidth: 0,
                                margin: 0,
                                padding: 0,
                                fontSize: FS.md,
                                color: '#888780',
                                lineHeight: 1.45,
                              }}
                            >
                              {al.titulo}
                            </p>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                console.log('abrir publicação')
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'flex-start',
                                alignSelf: 'flex-start',
                                flexShrink: 0,
                                margin: 0,
                                padding: 0,
                                fontSize: FS.sm,
                                fontWeight: 500,
                                color: '#F1B85A',
                                whiteSpace: 'nowrap',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                lineHeight: 1.45,
                              }}
                            >
                              Ver no Diário
                              <ArrowUpRight
                                size={14}
                                strokeWidth={2}
                                aria-hidden
                                className="shrink-0"
                                style={{ marginLeft: 4, flexShrink: 0 }}
                                color="#F1B85A"
                              />
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'baseline',
                              gap: '6px 8px',
                              marginTop: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: FS.sm,
                                fontWeight: 500,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                                color: relevanciaMeta.cor,
                                display: 'inline-block',
                              }}
                            >
                              {relevanciaMeta.label}
                            </span>
                            <span
                              style={{
                                color: '#5F5E5A',
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              ·
                            </span>
                            <span
                              style={{
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              {rotuloFonte}
                            </span>
                            <span
                              style={{
                                color: '#5F5E5A',
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              ·
                            </span>
                            <span
                              style={{
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              {formatarDataIsoPtBr(al.data)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
              <FonteLabel
                dataIso={timestamps.alertas_legislativos}
                fonte="Adoo"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}

        {aba === 'fiscal' ? (
          <>
            <Card>
              <p
                style={{
                  fontSize: FS.jumbo,
                  fontWeight: 500,
                  textAlign: 'center',
                  color: capagCor(fiscal.capag),
                  margin: '0 0 8px 0',
                }}
              >
                <CamadaTooltipHover
                  className="inline-block"
                  texto={textoTooltipCapag(fiscal.capag)}
                  maxWidthPx={360}
                  preferBelow
                  bubblePadding="10px 12px"
                  inlineWrap
                >
                  <span
                    style={{
                      cursor: 'help',
                      display: 'inline-block',
                    }}
                  >
                    {fiscal.capag}
                  </span>
                </CamadaTooltipHover>
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  textAlign: 'center',
                  margin: '0 0 8px 0',
                  lineHeight: 1.5,
                }}
              >
                {fiscal.capag_descricao}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  fontWeight: 700,
                  color: '#D3D1C7',
                  textAlign: 'center',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {processo.municipio} / {processo.uf}
              </p>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="STN / SICONFI"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                {[
                  {
                    l: 'Receita própria',
                    v: fiscal.receita_propria_mi,
                  },
                  {
                    l: 'Dívida consolidada',
                    v: fiscal.divida_consolidada_mi,
                  },
                  {
                    l: 'PIB municipal',
                    v: fiscal.pib_municipal_mi,
                  },
                ].map((m) => (
                  <div
                    key={m.l}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                    }}
                  >
                    <p
                      style={{
                        ...subsecaoTituloStyle,
                        margin: '0 0 4px 0',
                        minHeight: 46,
                        lineHeight: 1.25,
                        display: 'flex',
                        alignItems: 'flex-end',
                      }}
                    >
                      {m.l}
                    </p>
                    <p
                      style={{
                        fontSize: FS.metric,
                        fontWeight: 500,
                        color: '#F1EFE8',
                        margin: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {formatarRealBrlInteligente(m.v * 1_000_000)}
                    </p>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '22px 0 0 0',
                  lineHeight: 1.5,
                }}
              >
                Dependência de transferências:{' '}
                <CamadaTooltipHover
                  texto={textoTooltipDependenciaTransferencias(
                    fiscal.dependencia_transferencias_pct,
                  )}
                  maxWidthPx={320}
                  preferAbove
                  inlineWrap
                  bubblePadding="10px 12px"
                >
                  <span
                    style={{
                      color: corDependenciaTransferenciasPct(
                        fiscal.dependencia_transferencias_pct,
                      ),
                      fontWeight: 500,
                      borderBottom: '1px dotted #888780',
                      cursor: 'help',
                    }}
                  >
                    {fiscal.dependencia_transferencias_pct}%
                  </span>
                </CamadaTooltipHover>
              </p>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="STN / FINBRA"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            {fiscal.cfem_historico.length > 0 ||
            fiscal.cfem_municipal_historico.length > 0 ? (
              <Card>
                <SecLabel branco style={{ marginBottom: 4 }}>
                  CFEM: processo vs. município
                </SecLabel>
                <p
                  style={{
                    ...CFEM_CARD_SUBTITLE_STYLE,
                    margin: '0 0 28px 0',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    fontWeight: 400,
                  }}
                >
                  Arrecadação deste processo comparada ao total do município
                </p>
                {fiscal.cfem_historico.some(
                  (h) => h.valor_recolhido_brl > 0,
                ) ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 16,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: '#4A90B8',
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                        Este processo
                      </span>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: '#EF9F27',
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                        Município
                      </span>
                    </div>
                  </div>
                ) : null}
                {(() => {
                  const processoTemCfem = fiscal.cfem_historico.some(
                    (h) => h.valor_recolhido_brl > 0,
                  )
                  const procPorAno = new Map(
                    fiscal.cfem_historico.map((h) => [
                      h.ano,
                      h.valor_recolhido_brl,
                    ]),
                  )
                  const munPorAno = new Map(
                    fiscal.cfem_municipal_historico.map((h) => [
                      h.ano,
                      h.valor_total_municipio_brl,
                    ]),
                  )
                  const anos = [
                    ...new Set([
                      ...fiscal.cfem_historico.map((h) => h.ano),
                      ...fiscal.cfem_municipal_historico.map((h) => h.ano),
                    ]),
                  ].sort((a, b) => a - b)
                  const maxProc = Math.max(
                    ...anos.map((y) => procPorAno.get(y) ?? 0),
                    1,
                  )
                  const maxMun = Math.max(
                    ...anos.map((y) => munPorAno.get(y) ?? 0),
                    1,
                  )
                  const trackH = 80
                  const totalProc = fiscal.cfem_historico.reduce(
                    (s, h) => s + h.valor_recolhido_brl,
                    0,
                  )
                  const totalMun = fiscal.cfem_municipal_historico.reduce(
                    (s, h) => s + h.valor_total_municipio_brl,
                    0,
                  )
                  const pctRep =
                    totalMun > 0 ? (100 * totalProc) / totalMun : null
                  let linhaPct: ReactNode = null
                  if (!processoTemCfem) {
                    linhaPct = (
                      <p
                        style={{
                          fontSize: FS.sm,
                          color: '#888780',
                          margin: '10px 0 0 0',
                          lineHeight: 1.45,
                        }}
                      >
                        Este processo não gerou CFEM no período 2020-2024
                      </p>
                    )
                  } else if (pctRep != null && totalMun > 0) {
                    const muitoBaixa = pctRep > 0 && pctRep < 1
                    const pctTexto = muitoBaixa
                      ? '< 1%'
                      : `${pctRep.toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                          minimumFractionDigits: 0,
                        })}%`
                    linhaPct = (
                      <p
                        style={{
                          ...CFEM_CARD_SUBTITLE_STYLE,
                          color: '#D3D1C7',
                          margin: '10px 0 0 0',
                        }}
                      >
                        Este processo representa{' '}
                        <strong
                          style={{
                            fontWeight: 700,
                            color: '#EF9F27',
                          }}
                        >
                          {pctTexto}
                        </strong>{' '}
                        da CFEM municipal
                      </p>
                    )
                  }
                  const dataIsoCfem = [
                    timestamps.cfem,
                    timestamps.cfem_municipal,
                  ].reduce((a, b) => (a > b ? a : b))
                  return (
                    <>
                      <RelatorioCfemBarrasComTooltip
                        processoTemCfem={processoTemCfem}
                        anos={anos}
                        procPorAno={procPorAno}
                        munPorAno={munPorAno}
                        maxProc={maxProc}
                        maxMun={maxMun}
                        trackH={trackH}
                      />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          marginTop: 4,
                          marginBottom: 28,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: '#888780',
                              margin: '0 0 6px 0',
                              lineHeight: 1.3,
                            }}
                          >
                            Este processo 5 anos
                          </p>
                          {processoTemCfem ? (
                            <p
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: '#4A90B8',
                                margin: 0,
                                lineHeight: 1.2,
                              }}
                            >
                              {formatarRealBrlInteligente(totalProc)}
                            </p>
                          ) : (
                            <p
                              style={{
                                fontSize: FS.sm,
                                color: '#5F5E5A',
                                margin: 0,
                                lineHeight: 1.2,
                                fontWeight: 400,
                              }}
                            >
                              Sem arrecadação
                            </p>
                          )}
                        </div>
                        <div
                          style={{
                            width: 1,
                            flexShrink: 0,
                            backgroundColor: '#2C2C2A',
                            alignSelf: 'stretch',
                            margin: '0 8px',
                          }}
                          aria-hidden
                        />
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: '#888780',
                              margin: '0 0 6px 0',
                              lineHeight: 1.3,
                            }}
                          >
                            Município 5 anos
                          </p>
                          <p
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: '#EF9F27',
                              margin: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {formatarRealBrlInteligente(totalMun)}
                          </p>
                        </div>
                      </div>
                      {linhaPct}
                      <FonteLabel
                        dataIso={dataIsoCfem}
                        fonte="ANM / CFEM"
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                })()}
              </Card>
            ) : null}

            <Card>
              <SecLabel branco>Incentivos estaduais</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fiscal.incentivos_estaduais.map((x) => (
                  <span
                    key={x}
                    style={{
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: FS.md,
                      lineHeight: 1.3,
                      backgroundColor: 'rgba(29, 158, 117, 0.15)',
                      color: '#1D9E75',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="Secretarias estaduais / STN"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Linhas BNDES</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fiscal.linhas_bndes.map((x) => (
                  <span
                    key={x}
                    style={{
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: FS.md,
                      lineHeight: 1.3,
                      backgroundColor: 'rgba(74, 144, 184, 0.15)',
                      color: '#4A90B8',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="BNDES / Linhas de crédito"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Estimativa CFEM em operação</SecLabel>
              {processo.regime === 'bloqueio_permanente' ? (
                <p
                  style={{
                    fontSize: FS.xxl,
                    fontWeight: 500,
                    color: '#5F5E5A',
                    margin: '0 0 8px 0',
                  }}
                >
                  Processo bloqueado permanentemente, sem previsão de operação
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: FS.xxl,
                      fontWeight: 500,
                      color: '#EF9F27',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {formatarRealBrlInteligente(
                      fiscal.estimativa_cfem_anual_operacao_mi * 1_000_000,
                    )}{' '}
                    / ano
                  </p>
                  {processo.regime === 'bloqueio_provisorio' ? (
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#5F5E5A',
                        margin: '0 0 10px 0',
                        lineHeight: 1.5,
                      }}
                    >
                      (projeção condicional ao levantamento do bloqueio)
                    </p>
                  ) : null}
                </>
              )}
              <p
                style={{
                  fontSize: FS.lg,
                  color: SECTION_TITLE,
                  margin: '0 0 10px 0',
                  lineHeight: 1.5,
                }}
              >
                Estimativa de CFEM anual em fase de operação
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '6px 0 0 0',
                  lineHeight: 1.5,
                }}
              >
                Alíquota aplicável:{' '}
                <span style={{ color: '#F1EFE8' }}>
                  {fiscal.aliquota_cfem_pct}%
                </span>
              </p>
              <FonteLabel
                dataIso={timestamps.cfem}
                fonte="ANM / CFEM · Alíquotas"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}
        </div>
      </div>
    </div>
  )
}
```

## 3. Sub-aba Risco — Decomposicao (painel)
**Arquivo:** `src/components/map/RiskDecomposicaoRelatorioPanel.tsx`
```tsx
import { ChevronRight } from 'lucide-react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RiskScoreDecomposicao } from '../../types'
import {
  CORES_DIMENSAO_RISK,
  PESOS_RISK_DIMENSAO,
  corFaixaRiscoValor,
  qualificadorRiscoVariavel,
} from '../../lib/riskScoreDecomposicao'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import { RiskDimensionCalcTooltipContent } from './RiskScoreCalcTooltipContent'

/** Escala tipográfica alinhada ao drawer (`RelatorioCompleto` FS). */
const FS = {
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
} as const

type DimKey = 'geologico' | 'ambiental' | 'social' | 'regulatorio'

/** Abre/fecha com altura medida (evita `max-height: 2000px`, que deixa a transição artificial). */
function PainelDetalheDimensaoAnimado({
  isExp,
  corBar,
  children,
}: {
  isExp: boolean
  corBar: string
  children: ReactNode
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [maxPx, setMaxPx] = useState(0)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return

    if (!isExp) {
      setMaxPx(0)
      return
    }

    const measure = () => setMaxPx(el.scrollHeight)

    measure()
    const ro = new ResizeObserver(() => {
      measure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isExp])

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const transition = reduceMotion
    ? 'none'
    : 'max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.32s cubic-bezier(0.4, 0, 0.2, 1)'

  return (
    <div
      aria-hidden={!isExp}
      style={{
        maxHeight: maxPx,
        overflow: 'hidden',
        transition,
        marginTop: isExp ? 10 : 0,
        marginLeft: 20,
        paddingLeft: 12,
        borderLeft: `2px solid ${corBar}30`,
        boxSizing: 'border-box',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

function RiskPesosBarraQuatro() {
  const w = PESOS_RISK_DIMENSAO
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: w.geologico,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.geologico,
        }}
      />
      <div
        style={{
          flex: w.ambiental,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.ambiental,
        }}
      />
      <div
        style={{
          flex: w.social,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.social,
        }}
      />
      <div
        style={{
          flex: w.regulatorio,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.regulatorio,
        }}
      />
    </div>
  )
}

export function RiskDecomposicaoRelatorioPanel({
  decomposicao,
}: {
  decomposicao: RiskScoreDecomposicao
}) {
  const [aberto, setAberto] = useState<DimKey | null>(null)

  const dims = useMemo(
    () =>
      (
        [
          ['geologico', 'Geológico', 'Geo.', decomposicao.geologico],
          ['ambiental', 'Ambiental', 'Amb.', decomposicao.ambiental],
          ['social', 'Social', 'Soc.', decomposicao.social],
          ['regulatorio', 'Regulatório', 'Reg.', decomposicao.regulatorio],
        ] as const
      ).map(([key, label, labelPeso, det]) => ({
        key: key as DimKey,
        label,
        labelPeso,
        peso:
          key === 'geologico'
            ? PESOS_RISK_DIMENSAO.geologico
            : key === 'ambiental'
              ? PESOS_RISK_DIMENSAO.ambiental
              : key === 'social'
                ? PESOS_RISK_DIMENSAO.social
                : PESOS_RISK_DIMENSAO.regulatorio,
        det,
      })),
    [decomposicao],
  )

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 24 }}>
        <RiskPesosBarraQuatro />
        <div
          style={{
            display: 'flex',
            gap: 3,
            marginTop: 6,
            marginBottom: 16,
            maxWidth: '100%',
          }}
        >
          {dims.map((d) => (
            <div
              key={d.key}
              style={{
                flex: d.peso,
                minWidth: 0,
                fontSize: FS.sm,
                fontWeight: 400,
                color: '#888780',
                textAlign: 'center',
                lineHeight: 1.25,
              }}
            >
              {d.labelPeso} {d.peso}%
            </div>
          ))}
        </div>
      </div>

      {dims.map((d, di) => {
        const isExp = aberto === d.key
        const corBar = corFaixaRiscoValor(d.det.score)
        const varsMostrar =
          d.key === 'ambiental'
            ? d.det.variaveis.filter((v) => v.valor > 0 || v.nome === 'Resumo')
            : d.det.variaveis

        return (
          <div
            key={d.key}
            style={{ marginBottom: di === dims.length - 1 ? 12 : 14, minWidth: 0 }}
          >
            <button
              type="button"
              onClick={() => setAberto(isExp ? null : d.key)}
              className="group outline-none ring-0 ring-offset-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              style={{
                width: '100%',
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                padding: '6px 0',
                cursor: 'pointer',
                boxSizing: 'border-box',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <ChevronRight
                  size={14}
                  className={`shrink-0 transition-colors duration-150 ease-out ${
                    isExp
                      ? 'text-[#F1EFE8]'
                      : 'text-[#5F5E5A] group-hover:text-[#F1EFE8]'
                  }`}
                  style={{
                    transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition:
                      'transform 0.15s ease, color 0.15s ease-out',
                    flexShrink: 0,
                  }}
                  strokeWidth={2}
                  aria-hidden
                />
                <span
                  className={`transition-colors duration-150 ease-out ${
                    isExp
                      ? 'text-[#F1EFE8]'
                      : 'text-[#888780] group-hover:text-[#F1EFE8]'
                  }`}
                  style={{
                    fontSize: FS.md,
                    fontWeight: 700,
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 72,
                    maxWidth: '22vw',
                    height: 5,
                    backgroundColor: '#2C2C2A',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, d.det.score))}%`,
                      backgroundColor: corBar,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <CamadaTooltipHover
                  conteudo={
                    <RiskDimensionCalcTooltipContent dim={d.key} det={d.det} />
                  }
                  maxWidthPx={280}
                  preferAbove
                >
                  <span
                    style={{
                      fontSize: FS.lg,
                      fontWeight: 700,
                      color: corBar,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                      borderBottom: `1px dotted ${corBar}`,
                      cursor: 'help',
                    }}
                  >
                    {d.det.score}
                  </span>
                </CamadaTooltipHover>
              </div>
            </button>

            <PainelDetalheDimensaoAnimado isExp={isExp} corBar={corBar}>
              {varsMostrar.map((vrow, vi) => {
                const q = qualificadorRiscoVariavel(vrow.valor)
                const corV = corFaixaRiscoValor(vrow.valor)
                const fonteTitle = `Fonte: ${vrow.fonte}`
                return (
                  <div key={`${vrow.nome}-${vi}`} style={{ marginTop: vi > 0 ? 12 : 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        title={fonteTitle}
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          lineHeight: 1.35,
                          minWidth: 0,
                          flex: '1 1 120px',
                          cursor: 'default',
                        }}
                      >
                        {vrow.nome}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          flexShrink: 0,
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 600,
                            color: corV,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {vrow.valor}
                        </span>
                        <span style={{ fontSize: FS.md, color: q.color }}>{q.label}</span>
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        backgroundColor: '#2C2C2A',
                        borderRadius: 2,
                        overflow: 'hidden',
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(0, vrow.valor))}%`,
                          backgroundColor: corV,
                          borderRadius: 2,
                          opacity: vrow.valor > 0 ? 0.85 : 0.35,
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#888780',
                        margin: '6px 0 0 0',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {vrow.texto}
                    </p>
                  </div>
                )
              })}
            </PainelDetalheDimensaoAnimado>
          </div>
        )
      })}
    </div>
  )
}
```

## 3b. Tooltips de calculo Risk Score
**Arquivo:** `src/components/map/RiskScoreCalcTooltipContent.tsx`
```tsx
import type { CSSProperties, ReactNode } from 'react'
import type { RiskDimensaoDetalhe, RiskScoreDecomposicao } from '../../types'
import { corFaixaRiscoValor } from '../../lib/riskScoreDecomposicao'

/** Secundário: percentuais, fórmulas e notas (contraste melhor sobre o bubble #2C2C2A). */
const META = '#B5B3AB'
const LABEL = '#D3D1C7'
const SEP = '#2C2C2A'
const DOT = '#8E8C84'

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 0,
  width: '100%',
  fontVariantNumeric: 'tabular-nums',
}

function linhaPontilhada() {
  return (
    <span
      aria-hidden
      style={{
        flex: 1,
        minWidth: 6,
        margin: '0 5px',
        borderBottom: `1px dotted ${DOT}`,
        opacity: 0.75,
        transform: 'translateY(-2px)',
      }}
    />
  )
}

function rowWeighted(label: string, pct: number, valor: number): ReactNode {
  const corV = corFaixaRiscoValor(valor)
  return (
    <div key={`${label}-${pct}`} style={rowStyle}>
      <span style={{ color: LABEL, flexShrink: 0, maxWidth: '62%' }}>
        {label}{' '}
        <span style={{ color: META }}>({pct}%)</span>
      </span>
      {linhaPontilhada()}
      <span style={{ color: corV, flexShrink: 0, fontWeight: 600 }}>{valor}</span>
    </div>
  )
}

function rowAmbient(nomeCurto: string, valor: number): ReactNode {
  const corV = corFaixaRiscoValor(valor)
  return (
    <div key={nomeCurto} style={rowStyle}>
      <span style={{ color: LABEL, flexShrink: 0, maxWidth: '62%' }}>{nomeCurto}</span>
      {linhaPontilhada()}
      <span style={{ color: corV, flexShrink: 0, fontWeight: 600 }}>+{valor}</span>
    </div>
  )
}

function separadora() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: SEP,
        margin: '8px 0',
      }}
    />
  )
}

const AMB_NOME_CURTO: Record<string, string> = {
  'Sobreposição com TI': 'Sobrepos. TI',
  'Sobreposição com UC PI': 'Sobrepos. UC PI',
  'Sobreposição com APP': 'Sobrepos. APP',
  'Proximidade a quilombola': 'Proxim. quilombola',
  'Proximidade a UC US': 'Proximidade UC US',
  'Proximidade a aquífero': 'Proximidade aquífero',
  'Bioma Amazônia': 'Bioma Amazônia',
  'Bioma Mata Atlântica': 'Bioma Mata Atlântica',
  'Bioma Pantanal': 'Bioma Pantanal',
}

function vGeo(det: RiskDimensaoDetalhe, nome: string): number {
  return det.variaveis.find((v) => v.nome === nome)?.valor ?? 0
}

function linhaResultado(score: number) {
  const corResult = corFaixaRiscoValor(score)
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        width: '100%',
        fontWeight: 700,
        marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ color: LABEL }}>=</span>
      <span style={{ color: corResult }}>{score}</span>
    </div>
  )
}

/** Conteúdo rico do tooltip de cálculo por dimensão (Risk Score). */
export function RiskDimensionCalcTooltipContent({
  dim,
  det,
}: {
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio'
  det: RiskDimensaoDetalhe
}): ReactNode {
  const scoreDim = det.score

  if (dim === 'geologico') {
    const s = vGeo(det, 'Substância')
    const f = vGeo(det, 'Fase do processo')
    const q = vGeo(det, 'Qualidade da informação')
    return (
      <div style={{ maxWidth: 280 }}>
        {rowWeighted('Substância', 30, s)}
        {rowWeighted('Fase', 45, f)}
        {rowWeighted('Qualidade', 25, q)}
        {separadora()}
        {linhaResultado(scoreDim)}
        <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
          Geológico = Substância × 0.30 + Fase × 0.45 + Qualidade × 0.25
        </div>
      </div>
    )
  }

  if (dim === 'ambiental') {
    const fatores = det.variaveis.filter(
      (v) => v.valor > 0 && v.nome !== 'Resumo',
    )
    if (fatores.length === 0) {
      return (
        <div style={{ maxWidth: 280 }}>
          <div style={{ color: LABEL }}>Nenhuma restrição = 0</div>
          {separadora()}
          {linhaResultado(scoreDim)}
          <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
            Ambiental = soma dos fatores (teto 100)
          </div>
        </div>
      )
    }
    const soma = fatores.reduce((acc, v) => acc + v.valor, 0)
    return (
      <div style={{ maxWidth: 280 }}>
        {fatores.map((v) =>
          rowAmbient(AMB_NOME_CURTO[v.nome] ?? v.nome, v.valor),
        )}
        {separadora()}
        {soma > 100 ? (
          <div style={{ color: META, marginBottom: 6, lineHeight: 1.35 }}>
            Soma: {soma} → Teto: 100
          </div>
        ) : null}
        {linhaResultado(scoreDim)}
        <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
          Ambiental = soma dos fatores (teto 100)
        </div>
      </div>
    )
  }

  if (dim === 'social') {
    const idh = det.variaveis.find((v) => v.nome === 'IDH-M')?.valor ?? 0
    const dens =
      det.variaveis.find((v) => v.nome === 'Densidade populacional')?.valor ?? 0
    const com =
      det.variaveis.find((v) => v.nome === 'Comunidades tradicionais')?.valor ?? 0
    const cap = det.variaveis.find((v) => v.nome === 'CAPAG município')?.valor ?? 0
    return (
      <div style={{ maxWidth: 280 }}>
        {rowWeighted('IDH-M', 35, idh)}
        {rowWeighted('Densidade', 20, dens)}
        {rowWeighted('Comunidades', 25, com)}
        {rowWeighted('CAPAG', 20, cap)}
        {separadora()}
        {linhaResultado(scoreDim)}
        <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
          Social = IDH × 0.35 + Densidade × 0.20 + Comunidades × 0.25 + CAPAG ×
          0.20
        </div>
      </div>
    )
  }

  const t = det.variaveis.find((v) => v.nome === 'Tempo sem despacho')?.valor ?? 0
  const p = det.variaveis.find((v) => v.nome === 'Pendências')?.valor ?? 0
  const a = det.variaveis.find((v) => v.nome === 'Alertas restritivos')?.valor ?? 0
  const c =
    det.variaveis.find((v) => v.nome === 'Proximidade de caducidade')?.valor ?? 0
  return (
    <div style={{ maxWidth: 280 }}>
      {rowWeighted('Tempo s/ despacho', 30, t)}
      {rowWeighted('Pendências', 25, p)}
      {rowWeighted('Alertas restrit.', 25, a)}
      {rowWeighted('Caducidade', 20, c)}
      {separadora()}
      {linhaResultado(scoreDim)}
      <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
        Regulatório = Tempo × 0.30 + Pendências × 0.25 + Alertas × 0.25 +
        Caducidade × 0.20
      </div>
    </div>
  )
}

/** Tooltip do score total (4 dimensões × pesos do modelo). */
export function RiskTotalCalcTooltipContent({
  decomposicao,
}: {
  decomposicao: RiskScoreDecomposicao
}): ReactNode {
  const g = decomposicao.geologico.score
  const a = decomposicao.ambiental.score
  const s = decomposicao.social.score
  const r = decomposicao.regulatorio.score
  const total = decomposicao.total
  return (
    <div style={{ maxWidth: 280 }}>
      {rowWeighted('Geológico', 25, g)}
      {rowWeighted('Ambiental', 30, a)}
      {rowWeighted('Social', 25, s)}
      {rowWeighted('Regulatório', 20, r)}
      {separadora()}
      {linhaResultado(total)}
      <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
        Risk Score = Geo × 0.25 + Amb × 0.30 + Soc × 0.25 + Reg × 0.20
      </div>
    </div>
  )
}
```

## 4. Dados e helpers de decomposicao (lib)
**Arquivo:** `src/lib/riskScoreDecomposicao.ts`
```tsx
import { normalizeSubstanciaKey } from './substancias'
import type {
  Fase,
  Processo,
  RiskDimensaoDetalhe,
  RiskDimensaoVariavel,
  RiskScoreDecomposicao,
} from '../types'

/** Faixa de risco (alto score = ruim). */
export function corFaixaRiscoValor(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

export function qualificadorRiscoVariavel(
  valor: number,
): { label: string; color: string } {
  if (valor <= 0) return { label: '-', color: '#5F5E5A' }
  if (valor < 40) return { label: 'Risco baixo', color: '#1D9E75' }
  if (valor <= 69) return { label: 'Risco médio', color: '#E8A830' }
  return { label: 'Risco alto', color: '#E24B4A' }
}

/** Identidade visual das dimensões no gráfico de pesos (independente do valor). */
export const CORES_DIMENSAO_RISK = {
  geologico: '#7EADD4',
  ambiental: '#4A9E4A',
  social: '#C87C5B',
  regulatorio: '#E8A830',
} as const

export const PESOS_RISK_DIMENSAO = {
  geologico: 25,
  ambiental: 30,
  social: 25,
  regulatorio: 20,
} as const

export const SUBSTANCIA_RISK_LOOKUP: Record<string, number> = {
  QUARTZO: 15,
  FERRO: 25,
  BAUXITA: 30,
  MANGANES: 35,
  NIOBIO: 40,
  COBRE: 45,
  OURO: 50,
  NIQUEL: 55,
  GRAFITA: 55,
  ESTANHO: 45,
  LITIO: 65,
  NEODIMIO: 70,
  DISPROSIO: 75,
  DIAMANTE: 50,
}

const FASE_RISK_LOOKUP: Record<Fase, number> = {
  lavra: 15,
  concessao: 25,
  pesquisa: 55,
  requerimento: 75,
  encerrado: 90,
}

const FASE_LABEL_POPOVER: Record<Fase, string> = {
  requerimento: 'requerimento',
  pesquisa: 'pesquisa em andamento',
  concessao: 'concessão',
  lavra: 'lavra ativa',
  encerrado: 'processo encerrado',
}

const TI_NOMES = [
  'Xingu',
  'Yanomami',
  'Kayapó',
  'Munduruku',
  'Apyterewa',
  'Cachoeira Seca',
]

const UC_PI_NOMES = [
  'Serra da Capivara',
  'Chapada dos Veadeiros',
  'Jaú',
  'Amazonas',
]

const UC_US_NOMES = [
  'Triunfo do Xingu',
  'Tapajós',
  'Gurupi',
]

const QUILOMBOS = ['Quilombo Rio dos Macacos', 'Quilombo Kalunga', 'Quilombo Ivaporunduva']

const AQUIFEROS = ['Alter do Chão', 'Bambuí', 'Urucuia', 'Guarani']

function hashUnit(id: string, salt: number): number {
  let h = 0
  const payload = `${id}\0${salt}`
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0
  }
  return (h >>> 0) / 0x1_0000_0000
}

function idhProxyUf(uf: string): number {
  const t: Record<string, number> = {
    SP: 0.83,
    SC: 0.81,
    PR: 0.8,
    RS: 0.79,
    DF: 0.85,
    GO: 0.77,
    MG: 0.78,
    RJ: 0.76,
    ES: 0.75,
    MT: 0.76,
    MS: 0.75,
    BA: 0.66,
    CE: 0.72,
    PE: 0.71,
    PA: 0.69,
    AM: 0.67,
    RO: 0.69,
    AP: 0.71,
    RR: 0.71,
    TO: 0.73,
    PI: 0.66,
    MA: 0.65,
    RN: 0.72,
    PB: 0.71,
    SE: 0.69,
    AL: 0.68,
    AC: 0.7,
  }
  return t[uf] ?? 0.68
}

function diasDesdeIso(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 120
  const now = Date.now()
  return Math.max(0, Math.round((now - t) / 86400000))
}

function pick<T>(arr: T[], id: string, salt: number): T {
  return arr[Math.floor(hashUnit(id, salt) * arr.length) % arr.length]!
}

export function gerarDescricaoRiskDimensao(
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio',
  detalhe: RiskDimensaoDetalhe,
  ctx: { fase: Fase; fiscalCapag: string },
): string {
  const s = detalhe.score
  const vars = detalhe.variaveis
  const dom =
    vars.length === 0
      ? null
      : [...vars].sort((a, b) => b.valor - a.valor)[0]

  const fasePhr = FASE_LABEL_POPOVER[ctx.fase]

  if (dim === 'geologico') {
    const subV = vars.find((v) => v.nome === 'Substância')
    const geoComplexa =
      (subV?.valor ?? 0) >= 55 ? 'complexa' : 'incerta'
    if (s >= 70) {
      return `Fase de ${fasePhr}, substância com geologia ${geoComplexa}`
    }
    if (s < 40) {
      if (ctx.fase === 'lavra') {
        return 'Lavra ativa, substância bem mapeada'
      }
      return 'Concessão consolidada, substância bem mapeada'
    }
    const qualSub =
      (subV?.valor ?? 0) >= 55 ? 'de maior complexidade' : 'com perfil intermediário'
    return `${fasePhr.charAt(0).toUpperCase() + fasePhr.slice(1)}, substância ${qualSub}`
  }

  if (dim === 'ambiental') {
    if (s === 0) {
      return 'Nenhuma restrição ambiental identificada'
    }
    if (s < 40) {
      return 'Sem sobreposições com áreas protegidas'
    }
    if (s >= 70 && dom) {
      return dom.texto.length > 52 ? `${dom.texto.slice(0, 49)}...` : dom.texto
    }
    const prox = vars.find(
      (v) =>
        v.valor > 0 &&
        (v.nome === 'Proximidade a aquífero' || v.nome === 'Proximidade a quilombola'),
    )
    if (prox) {
      const km = prox.texto.match(/(\d+\.?\d*)\s*km/)
      const tipo =
        prox.nome === 'Proximidade a aquífero' ? 'aquífero' : 'quilombo'
      return `Proximidade a ${tipo}${km ? ` (${km[1]}km)` : ''}`
    }
    return dom ? (dom.texto.length > 52 ? `${dom.texto.slice(0, 49)}...` : dom.texto) : 'Restrições ambientais moderadas'
  }

  if (dim === 'social') {
    const idhV = vars.find((v) => v.nome === 'IDH-M')
    const idhTxt = idhV?.texto.match(/([\d.]+)/)
    const idhVal = idhTxt ? idhTxt[1] : '0,66'
    if (s >= 70) {
      const sec = vars.find((v) => v.nome === 'Comunidades tradicionais' && v.valor > 30)
      const sec2 = vars.find((v) => v.nome === 'CAPAG município' && v.valor > 40)
      const tail = sec
        ? sec.texto.toLowerCase().includes('comunidade')
          ? sec.texto.replace(/\(.*\)/, '').trim()
          : `CAPAG ${ctx.fiscalCapag}`
        : sec2
          ? `CAPAG ${ctx.fiscalCapag} frágil`
          : 'densidade populacional moderada'
      return `IDH municipal ${idhVal}, ${tail}`
    }
    if (s < 40) {
      return `Município com bom desenvolvimento (IDH ${idhVal})`
    }
    const cap = vars.find((v) => v.nome === 'CAPAG município')
    const com = vars.find((v) => v.nome === 'Comunidades tradicionais')
    const bit =
      (com?.valor ?? 0) >= (cap?.valor ?? 0)
        ? com?.texto ?? 'perfil social intermediário'
        : `CAPAG ${ctx.fiscalCapag}`
    return `IDH ${idhVal}, ${bit}`
  }

  /* regulatorio */
  const tempo = vars.find((v) => v.nome === 'Tempo sem despacho')
  const pend = vars.find((v) => v.nome === 'Pendências')
  if (s >= 70) {
    const dias = tempo?.texto.match(/(\d+)\s*dias/)
    const n = dias ? dias[1] : '180'
    const p = pend?.valor && pend.valor > 50 ? 'com pendências' : 'risco de caducidade'
    return `Sem despacho há ${n} dias, ${p}`
  }
  if (s < 40) {
    return 'Despacho recente, sem pendências'
  }
  const a = dom?.texto ?? 'cronograma moderado'
  const b =
    vars.find((v) => v !== dom && v.valor > 35)?.texto ?? 'acompanhar alertas'
  return `${a}, ${b}`
}

function variaveisGeologicas(p: Processo, gScore: number): RiskDimensaoVariavel[] {
  const key = normalizeSubstanciaKey(p.substancia)
  const subScore =
    SUBSTANCIA_RISK_LOOKUP[key] ??
    SUBSTANCIA_RISK_LOOKUP[key.split(/\s+/)[0] ?? ''] ??
    50
  const fScore = FASE_RISK_LOOKUP[p.fase] ?? 50
  const qScore = p.fase === 'lavra' ? 20 : p.fase === 'pesquisa' ? 50 : 80

  const substLabel = p.substancia.trim() || 'Substância'
  const subTextoHigh = `${substLabel}, geologia complexa e pouco explorada`
  const subTextoLow = `${substLabel.split(/\s+/)[0]}, geologia bem mapeada no Brasil`

  const faseTextoHigh =
    p.fase === 'requerimento'
      ? 'Requerimento de pesquisa, sem dados geológicos'
      : 'Pesquisa em andamento, dados incompletos'
  const faseTextoLow =
    p.fase === 'lavra'
      ? 'Concessão de lavra, reserva comprovada'
      : 'Concessão consolidada, dados consistentes'

  const qualTextoHigh = 'Sem relatório de pesquisa aprovado'
  const qualTextoLow = 'Relatório de pesquisa aprovado pela ANM'

  return [
    {
      nome: 'Substância',
      valor: Math.min(100, Math.max(0, subScore)),
      texto: subScore >= 55 ? subTextoHigh : subTextoLow,
      fonte: 'ANM/SIGMINE',
    },
    {
      nome: 'Fase do processo',
      valor: Math.min(100, Math.max(0, fScore)),
      texto: fScore >= 55 ? faseTextoHigh : faseTextoLow,
      fonte: 'ANM/SIGMINE',
    },
    {
      nome: 'Qualidade da informação',
      valor: Math.min(100, Math.max(0, qScore)),
      texto: qScore >= 55 ? qualTextoHigh : qualTextoLow,
      fonte: 'ANM/Cadastro Mineiro',
    },
  ]
}

/** Semente determinística inteira a partir do id (para presença binária dos fatores). */
function seedIntFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Mock ambiental: fatores binários com pesos fixos; score = min(100, soma).
 * Deve ser a única fonte de `risk_breakdown.ambiental` e da decomposição ambiental.
 */
export function ambientalDetalheMockFromId(id: string): RiskDimensaoDetalhe {
  const seed = seedIntFromId(id)

  const temTI = seed % 3 === 0
  const temUCPI = seed % 5 === 0
  const temAPP = seed % 4 === 0
  const temQuilombola = seed % 7 === 0
  const temUCUS = seed % 6 === 0
  const temAquifero = seed % 2 === 0
  const biomas = [
    'cerrado',
    'amazonia',
    'mata_atlantica',
    'pantanal',
    'caatinga',
  ] as const
  const bioma = biomas[seed % biomas.length]

  const tiNome = pick(TI_NOMES, id, 208)
  const ucPiNome = pick(UC_PI_NOMES, id, 209)
  const ucUsNome = pick(UC_US_NOMES, id, 210)
  const quil = pick(QUILOMBOS, id, 211)
  const aqu = pick(AQUIFEROS, id, 212)

  const tiPct = (seed % 30) + 5
  const ucPiPct = (seed % 20) + 5
  const ucUsPct = (seed % 12) + 3
  const appPct = (seed % 15) + 3
  const quarKm = (seed % 15) + 2
  const aquKm = (seed % 4) + 1

  const variaveis: RiskDimensaoVariavel[] = []

  if (temTI) {
    variaveis.push({
      nome: 'Sobreposição com TI',
      valor: 40,
      texto: `TI ${tiNome} (${tiPct}% da área do processo)`,
      fonte: 'FUNAI',
    })
  }
  if (temUCPI) {
    variaveis.push({
      nome: 'Sobreposição com UC PI',
      valor: 35,
      texto: `Parque Nacional ${ucPiNome} (${ucPiPct}% da área)`,
      fonte: 'ICMBio/MMA (CNUC)',
    })
  }
  if (temAPP) {
    variaveis.push({
      nome: 'Sobreposição com APP',
      valor: 25,
      texto: `APP margem de rio (${appPct}% da área)`,
      fonte: 'CAR/SICAR',
    })
  }
  if (temQuilombola) {
    variaveis.push({
      nome: 'Proximidade a quilombola',
      valor: 20,
      texto: `${quil} a ${quarKm}km`,
      fonte: 'INCRA',
    })
  }
  if (temUCUS) {
    variaveis.push({
      nome: 'Proximidade a UC US',
      valor: 15,
      texto: `APA ${ucUsNome} (${ucUsPct}% da área)`,
      fonte: 'ICMBio/MMA (CNUC)',
    })
  }
  if (temAquifero) {
    variaveis.push({
      nome: 'Proximidade a aquífero',
      valor: 10,
      texto: `Aquífero ${aqu} a ${aquKm}km`,
      fonte: 'ANA/CPRM',
    })
  }
  if (bioma === 'amazonia') {
    variaveis.push({
      nome: 'Bioma Amazônia',
      valor: 10,
      texto: 'Amazônia',
      fonte: 'IBGE',
    })
  } else if (bioma === 'mata_atlantica') {
    variaveis.push({
      nome: 'Bioma Mata Atlântica',
      valor: 8,
      texto: 'Mata Atlântica',
      fonte: 'IBGE',
    })
  } else if (bioma === 'pantanal') {
    variaveis.push({
      nome: 'Bioma Pantanal',
      valor: 8,
      texto: 'Pantanal',
      fonte: 'IBGE',
    })
  }

  const soma = variaveis.reduce((acc, v) => acc + v.valor, 0)
  const score = Math.min(100, soma)

  if (variaveis.length === 0) {
    return {
      score: 0,
      variaveis: [
        {
          nome: 'Resumo',
          valor: 0,
          texto: 'Nenhuma restrição ambiental identificada',
          fonte: 'Terrae',
        },
      ],
    }
  }

  return { score, variaveis }
}

function variaveisSociais(p: Processo, alvo: number): RiskDimensaoVariavel[] {
  const idh = idhProxyUf(p.uf)
  const u = hashUnit(p.id, 301)
  const idhRisk = Math.round((1 - idh) * 100)
  const dens = Math.round(15 + u * 50)
  const com = Math.round(10 + hashUnit(p.id, 302) * 45)
  const capMap: Record<string, number> = { A: 12, B: 28, C: 55, D: 85 }
  const capScore = capMap[p.fiscal.capag] ?? 40

  const idhStr = idh.toFixed(2)
  const densN = Math.round(8 + hashUnit(p.id, 303) * 45)
  const comKm = Math.round(4 + hashUnit(p.id, 304) * 15)

  const vars: RiskDimensaoVariavel[] = [
    {
      nome: 'IDH-M',
      valor: idhRisk,
      texto: `IDH ${idhStr} (${idhRisk >= 50 ? 'baixo desenvolvimento' : 'desenvolvimento moderado'})`,
      fonte: 'PNUD/Atlas Brasil',
    },
    {
      nome: 'Densidade populacional',
      valor: dens,
      texto: `${densN} hab/km² (${dens >= 45 ? 'média-alta' : 'baixa densidade'})`,
      fonte: 'IBGE/Censo',
    },
    {
      nome: 'Comunidades tradicionais',
      valor: com,
      texto:
        com > 25
          ? `Comunidade a ${comKm}km`
          : 'Nenhuma próxima',
      fonte: 'FUNAI, INCRA',
    },
    {
      nome: 'CAPAG município',
      valor: capScore,
      texto: `CAPAG ${p.fiscal.capag} (${p.fiscal.capag === 'A' || p.fiscal.capag === 'B' ? 'situação fiscal estável' : 'situação fiscal frágil'})`,
      fonte: 'STN/SICONFI',
    },
  ]
  const cur = vars.reduce((a, v) => a + v.valor, 0) / vars.length
  const factor = cur > 0 ? alvo / cur : 1
  return vars.map((v) => ({
    ...v,
    valor: Math.min(100, Math.max(0, Math.round(v.valor * factor))),
  }))
}

function variaveisRegulatorias(p: Processo, alvo: number): RiskDimensaoVariavel[] {
  const dias = diasDesdeIso(p.ultimo_despacho_data)
  const tempoScore = Math.min(100, Math.round((dias / 360) * 55))
  const pendN =
    p.situacao === 'bloqueado' ? 2 : p.situacao === 'inativo' ? 1 : 0
  const pendScore = pendN === 0 ? 15 : pendN === 1 ? 55 : 85
  const restritivos = p.alertas.filter((a) => a.tipo_impacto === 'restritivo').length
  const alertScore = Math.min(100, restritivos * 28 + hashUnit(p.id, 401) * 15)
  const cadScore =
    p.regime === 'concessao_lavra' && p.situacao === 'ativo'
      ? Math.round(25 + hashUnit(p.id, 402) * 35)
      : Math.round(hashUnit(p.id, 403) * 30)

  const vars: RiskDimensaoVariavel[] = [
    {
      nome: 'Tempo sem despacho',
      valor: tempoScore,
      texto:
        dias > 120
          ? `Último despacho há ${dias} dias`
          : `Despacho há ${dias} dias`,
      fonte: 'ANM/SEI',
    },
    {
      nome: 'Pendências',
      valor: pendScore,
      texto:
        pendN === 0
          ? 'Sem pendências'
          : `${pendN} pendência${pendN > 1 ? 's' : ''} não cumprida${pendN > 1 ? 's' : ''}`,
      fonte: 'ANM/SEI',
    },
    {
      nome: 'Alertas restritivos',
      valor: Math.round(alertScore),
      texto:
        restritivos === 0
          ? 'Nenhum em 12 meses'
          : `${restritivos} alertas restritivos em 12 meses`,
      fonte: 'Adoo',
    },
    {
      nome: 'Proximidade de caducidade',
      valor: cadScore,
      texto:
        cadScore > 45
          ? `Vence em ${6 + Math.floor(hashUnit(p.id, 404) * 10)} meses`
          : 'Sem prazo definido',
      fonte: 'ANM/Cadastro Mineiro',
    },
  ]

  const cur = vars.reduce((a, v) => a + v.valor, 0) / vars.length
  const factor = cur > 0 ? alvo / cur : 1
  return vars.map((v) => ({
    ...v,
    valor: Math.min(100, Math.max(0, Math.round(v.valor * factor))),
  }))
}

/** Constrói a decomposição mock alinhada ao `risk_breakdown` do processo. */
export function gerarRiskDecomposicaoParaProcesso(
  p: Processo,
): RiskScoreDecomposicao | null {
  if (p.risk_score === null || !p.risk_breakdown) return null

  const rb = p.risk_breakdown
  const geo = variaveisGeologicas(p, rb.geologico)
  const ambFinal = ambientalDetalheMockFromId(p.id)

  const soc = variaveisSociais(p, rb.social)
  const reg = variaveisRegulatorias(p, rb.regulatorio)

  return {
    total: p.risk_score,
    geologico: { score: rb.geologico, variaveis: geo },
    ambiental: ambFinal,
    social: { score: rb.social, variaveis: soc },
    regulatorio: { score: rb.regulatorio, variaveis: reg },
  }
}
```

## 4b. Processos mock
**Arquivo:** `src/data/processos.mock.ts`
```tsx
import {
  ambientalDetalheMockFromId,
  gerarRiskDecomposicaoParaProcesso,
} from '../lib/riskScoreDecomposicao'
import type {
  AlertaLegislativo,
  DadosFiscais,
  GeoJSONPolygon,
  Processo,
  RiskBreakdown,
} from '../types'

type RawProcesso = Omit<Processo, 'geojson' | 'risk_decomposicao'>
type ProcessoSeed = Omit<
  RawProcesso,
  | 'risk_breakdown'
  | 'alertas'
  | 'fiscal'
  | 'valor_estimado_usd_mi'
  | 'ultimo_despacho_data'
>

/** [0, 1) determinístico a partir do id (hash simples). */
function hashUnit(id: string, salt: number): number {
  let h = 0
  const payload = `${id}\0${salt}`
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0
  }
  return (h >>> 0) / 0x1_0000_0000
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Converte vértices em offset (Δlng, Δlat) relativos ao centro para [lng, lat]. Fecha o anel. */
function closeRingLatLng(
  lat: number,
  lng: number,
  rel: [number, number][],
): [number, number][] {
  const ring = rel.map(([dx, dy]) => [lng + dx, lat + dy] as [number, number])
  const first = ring[0]!
  ring.push([first[0], first[1]])
  return ring
}

function rectRel(we: number, he: number): [number, number][] {
  return [
    [-we, -he],
    [we, -he],
    [we, he],
    [-we, he],
  ]
}

const N_SHAPE_KINDS = 12

/** Garante que cada `p1`…`p30` usa um tipo diferente em ciclo (não só hash → variância fraca). */
function shapeKindFromId(id: string): number {
  const m = /^p(\d+)$/.exec(id)
  const n = m ? parseInt(m[1], 10) : 1
  return ((n - 1) % N_SHAPE_KINDS + N_SHAPE_KINDS) % N_SHAPE_KINDS
}

/**
 * Ortogonal, simples, estável por id.
 * ~12 plantas + escala (we/he). Tipo vem do índice do id; parâmetros do hash.
 * Entalhes com amplitude forte para leitura ao zoom ~4–5.
 */
function makePolygon(lat: number, lng: number, id: string): GeoJSONPolygon {
  const u = (salt: number) => hashUnit(id, salt)

  const aspW = lerp(0.58, 1.42, u(10))
  const aspH = lerp(0.58, 1.42, u(11))
  const we = 0.25 * aspW
  const he = 0.2 * aspH

  const kind = shapeKindFromId(id)
  let rel: [number, number][]

  switch (kind) {
    case 0: {
      /* retângulo com proporção já dada por aspW/aspH */
      rel = rectRel(we, he)
      break
    }
    case 1: {
      /* L: entalhe à direita (x1 bem à esquerda de we → degrau visível) */
      const y1 = lerp(-0.45 * he, 0.48 * he, u(1))
      const x1 = lerp(-0.35 * we, 0.42 * we, u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, y1],
        [x1, y1],
        [x1, he],
        [-we, he],
      ]
      break
    }
    case 2: {
      /* escadinha na base: patamar alto o suficiente */
      const xb = lerp(-0.48 * we, 0.12 * we, u(1))
      const yt = lerp(0.12 * he, 0.62 * he, u(2))
      const spanCore = lerp(0.22 * (2 * we), 0.48 * (2 * we), u(3))
      const xc = Math.min(we - 0.06 * we, xb + spanCore)
      rel = [
        [-we, -he],
        [xb, -he],
        [xb, yt],
        [xc, yt],
        [xc, -he],
        [we, -he],
        [we, he],
        [-we, he],
      ]
      break
    }
    case 3: {
      /* entalhe no topo */
      const xt = lerp(0.08 * we, 0.68 * we, u(1))
      const yt = lerp(-0.28 * he, 0.58 * he, u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, he],
        [xt, he],
        [xt, yt],
        [-we, yt],
      ]
      break
    }
    case 4: {
      /* L espelhado: recorte na zona NW-interna */
      const xr = lerp(-0.08 * we, 0.58 * we, u(1))
      const ym = lerp(-0.42 * he, 0.52 * he, u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, he],
        [xr, he],
        [xr, ym],
        [-we, ym],
      ]
      break
    }
    case 5: {
      /* duplo degrau na base: patamares bem separados */
      const p1 = -we + lerp(0.1 * (2 * we), 0.28 * (2 * we), u(1))
      const t1 = lerp(0.05 * he, 0.38 * he, u(2))
      const p2 = Math.min(
        we - 0.1 * we,
        p1 + lerp(0.16 * (2 * we), 0.32 * (2 * we), u(3)),
      )
      const t2 = Math.min(
        he - 0.1 * he,
        t1 + lerp(0.12 * (2 * he), 0.28 * (2 * he), u(4)),
      )
      const p3 = Math.min(
        we - 0.06 * we,
        p2 + lerp(0.12 * (2 * we), 0.3 * (2 * we), u(5)),
      )
      rel = [
        [-we, -he],
        [p1, -he],
        [p1, t1],
        [p2, t1],
        [p2, t2],
        [p3, t2],
        [p3, -he],
        [we, -he],
        [we, he],
        [-we, he],
      ]
      break
    }
    case 6: {
      /* quase quadrado: lado único (escala alinhada a we/he ~0,25) */
      const s = lerp(0.17, 0.3, u(12))
      rel = rectRel(s, s)
      break
    }
    case 7: {
      /* faixa horizontal larga e baixa */
      const ww = lerp(0.32, 0.42, u(13))
      const hh = lerp(0.065, 0.125, u(14))
      rel = rectRel(ww, hh)
      break
    }
    case 8: {
      /* faixa vertical alta e estreita */
      const ww = lerp(0.08, 0.14, u(15))
      const hh = lerp(0.28, 0.4, u(16))
      rel = rectRel(ww, hh)
      break
    }
    case 9: {
      /* escadinha no lado direito (degraus verticais) */
      const y1 = lerp(-0.32 * he, 0.12 * he, u(1))
      const dy = lerp(0.14 * (2 * he), 0.32 * (2 * he), u(2))
      const y2 = Math.min(he - 0.05 * he, y1 + dy)
      const x1 = lerp(0.22 * we, 0.55 * we, u(3))
      rel = [
        [-we, -he],
        [we, -he],
        [we, y1],
        [x1, y1],
        [x1, y2],
        [we, y2],
        [we, he],
        [-we, he],
      ]
      break
    }
    case 10: {
      /* “corte” num canto (bite retangular no NE) */
      const j = lerp(0.12 * (2 * we), 0.38 * (2 * we), u(1))
      const k = lerp(0.12 * (2 * he), 0.38 * (2 * he), u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, he - k],
        [we - j, he - k],
        [we - j, he],
        [-we, he],
      ]
      break
    }
    default: {
      /* escadinha duplo no topo */
      const xa = lerp(-we + 0.02 * we, -we + 0.52 * (2 * we), u(17))
      const yu = lerp(0.22 * he, 0.78 * he, u(18))
      const xb = Math.min(
        we - 0.06 * we,
        xa + lerp(0.18 * (2 * we), 0.38 * (2 * we), u(19)),
      )
      const yv = Math.min(he - 0.06 * he, yu + lerp(0.1 * he, 0.26 * he, u(20)))
      if (xb <= xa + 1e-6 || yv <= yu + 1e-6) {
        rel = rectRel(we, he)
        break
      }
      rel = [
        [-we, -he],
        [we, -he],
        [we, he],
        [xb, he],
        [xb, yv],
        [xa, yv],
        [xa, yu],
        [-we, yu],
      ]
      break
    }
  }

  const ring = closeRingLatLng(lat, lng, rel)
  return {
    type: 'Feature' as const,
    id,
    properties: { id },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
  } as GeoJSONPolygon
}

const CATALOGO_ALERTAS: Record<string, AlertaLegislativo> = {
  anm412: {
    id: 'anm-412-2025',
    fonte: 'ANM',
    fonte_diario: 'DOU',
    data: '2025-03-12',
    titulo: 'Portaria ANM nº 412/2025: lavra de minerais estratégicos',
    resumo:
      'Altera procedimentos para concessão de lavra de minerais estratégicos, com etapas adicionais de análise e documentação.',
    nivel_impacto: 1,
    tipo_impacto: 'restritivo',
    urgencia: 'imediata',
  },
  anm89: {
    id: 'anm-89-2025',
    fonte: 'ANM',
    fonte_diario: 'DOU',
    data: '2025-02-04',
    titulo: 'Resolução ANM nº 89/2025: área mínima em autorização de pesquisa',
    resumo:
      'Redefine critérios de área mínima e sobreposição para requerimentos de autorização de pesquisa mineral.',
    nivel_impacto: 1,
    tipo_impacto: 'neutro',
    urgencia: 'medio_prazo',
  },
  decretoMME: {
    id: 'mme-11892-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-01-28',
    titulo: 'Decreto MME 11.892/2025: minerais críticos',
    resumo:
      'Inclui cobre e bauxita na lista nacional de minerais críticos, com prioridade em políticas de suprimento e pesquisa.',
    nivel_impacto: 1,
    tipo_impacto: 'favoravel',
    urgencia: 'medio_prazo',
  },
  pec48: {
    id: 'pec-48-2023',
    fonte: 'Senado',
    fonte_diario: 'Senado',
    data: '2023-08-14',
    titulo: 'PEC 48/2023: marco temporal de terras indígenas',
    resumo:
      'Proposta em tramitação que restringe novos títulos minerários em áreas com sobreposição a terras indígenas não homologadas.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    urgencia: 'longo_prazo',
  },
  lei15190: {
    id: 'lei-15190-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-04-02',
    titulo: 'Lei 15.190/2025: Lei Geral do Licenciamento',
    resumo:
      'Altera regras de consulta à FUNAI e licenciamento ambiental quando há sobreposição com TIs não homologadas.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    urgencia: 'imediata',
  },
  ibama1234: {
    id: 'ibama-1234-2025',
    fonte: 'IBAMA',
    fonte_diario: 'DOU',
    data: '2025-05-18',
    titulo: 'Portaria IBAMA nº 1.234/2025: zona de amortecimento de UC',
    resumo:
      'Exige novo EIA ou complementação para empreendimentos em zona de amortecimento de unidades de conservação.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    urgencia: 'medio_prazo',
  },
  pl2197: {
    id: 'pl-2197-2025',
    fonte: 'Câmara',
    fonte_diario: 'Câmara',
    data: '2025-03-25',
    titulo: 'PL 2.197/2025: Política Nacional de Minerais Críticos',
    resumo:
      'Prevê benefícios fiscais e linhas de crédito preferenciais para projetos de minerais críticos e cadeias de valor associadas.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    urgencia: 'medio_prazo',
  },
  confaz88: {
    id: 'confaz-88-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-02-20',
    titulo: 'Convênio CONFAZ 88/2025: ICMS e terras raras (GO/MG)',
    resumo:
      'Redução de base de ICMS para exportação de concentrados de terras raras em operações sediadas em Goiás e Minas Gerais.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    urgencia: 'imediata',
  },
  bndesFinep: {
    id: 'bndes-finep-2025-03',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-03-05',
    titulo: 'Chamada pública BNDES/Finep: beneficiamento de minerais estratégicos',
    resumo:
      'Financiamento não reembolsável e subvenção para plantas de beneficiamento de minerais estratégicos e terras raras.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    urgencia: 'imediata',
  },
  ferroviaNorteSul: {
    id: 'antt-norte-sul-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-06-10',
    titulo: 'Edital ANTT: Ferrovia Norte-Sul (Palmas–Anápolis)',
    resumo:
      'Concessão do trecho Palmas–Anápolis, com impacto positivo no escoamento de carga a granel nos entornos de GO e PA.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    urgencia: 'longo_prazo',
  },
  aneelPA: {
    id: 'aneel-500kv-pa-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-04-30',
    titulo: 'Leilão ANEEL: linha de transmissão 500 kV no Pará',
    resumo:
      'Projeto de TLT em corredor estratégico no Pará, relevante para energização de projetos minerários e industriais.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    urgencia: 'medio_prazo',
  },
}

/**
 * Sub-scores para o mock. O campo `ambiental` desta tabela é ignorado:
 * o valor usado é sempre `ambientalDetalheMockFromId(p.id).score` (soma binária com teto 100).
 */
const RISK_BY_ID: Record<string, RiskBreakdown> = {
  p1: { geologico: 35, ambiental: 45, social: 40, regulatorio: 48 },
  p2: { geologico: 44, ambiental: 80, social: 74, regulatorio: 68 },
  p3: { geologico: 30, ambiental: 35, social: 28, regulatorio: 32 },
  p4: { geologico: 22, ambiental: 16, social: 15, regulatorio: 18 },
  p5: { geologico: 40, ambiental: 64, social: 58, regulatorio: 60 },
  p6: { geologico: 34, ambiental: 54, social: 48, regulatorio: 56 },
  p7: { geologico: 38, ambiental: 86, social: 82, regulatorio: 78 },
  p8: { geologico: 28, ambiental: 42, social: 38, regulatorio: 50 },
  p9: { geologico: 48, ambiental: 72, social: 70, regulatorio: 52 },
  p10: { geologico: 10, ambiental: 72, social: 70, regulatorio: 12 },
  p11: { geologico: 42, ambiental: 64, social: 68, regulatorio: 34 },
  p12: { geologico: 36, ambiental: 78, social: 80, regulatorio: 24 },
  p13: { geologico: 4, ambiental: 62, social: 60, regulatorio: 8 },
  p14: { geologico: 56, ambiental: 85, social: 88, regulatorio: 62 },
  p15: { geologico: 75, ambiental: 84, social: 82, regulatorio: 84 },
  p16: { geologico: 65, ambiental: 72, social: 68, regulatorio: 72 },
  p17: { geologico: 72, ambiental: 82, social: 78, regulatorio: 78 },
  p18: { geologico: 48, ambiental: 44, social: 38, regulatorio: 35 },
  p19: { geologico: 35, ambiental: 28, social: 26, regulatorio: 28 },
  p20: { geologico: 55, ambiental: 50, social: 48, regulatorio: 54 },
  p21: { geologico: 96, ambiental: 97, social: 94, regulatorio: 40 },
  p22: { geologico: 95, ambiental: 93, social: 91, regulatorio: 24 },
  p23: { geologico: 100, ambiental: 100, social: 98, regulatorio: 39 },
  p24: { geologico: 97, ambiental: 93, social: 91, regulatorio: 37 },
  /* AM, bloqueio permanente: risco 85–95, TIs/UCs */
  p25: { geologico: 60, ambiental: 96, social: 92, regulatorio: 90 },
  p26: { geologico: 62, ambiental: 97, social: 93, regulatorio: 91 },
  p27: { geologico: 60, ambiental: 97, social: 94, regulatorio: 90 },
  /* MT, bloqueio provisório: 70–72 (cruza faixa MT 55–72 e provisório 70–82) */
  p28: { geologico: 56, ambiental: 83, social: 66, regulatorio: 73 },
  p29: { geologico: 56, ambiental: 85, social: 66, regulatorio: 74 },
  p30: { geologico: 58, ambiental: 85, social: 67, regulatorio: 76 },
}

function pontuacaoRiscoMedia(b: RiskBreakdown): number {
  return Math.round(
    b.geologico * 0.25 + b.ambiental * 0.3 + b.social * 0.25 + b.regulatorio * 0.2,
  )
}

function processoBloqueadoParaRisco(p: ProcessoSeed): boolean {
  return (
    p.situacao === 'bloqueado' ||
    p.regime === 'bloqueio_permanente' ||
    p.regime === 'bloqueio_provisorio'
  )
}

function riskBreakdownPara(p: ProcessoSeed): RiskBreakdown {
  const b = RISK_BY_ID[p.id]
  const ambScore = ambientalDetalheMockFromId(p.id).score
  if (b) return { ...b, ambiental: ambScore }
  return { geologico: 50, ambiental: ambScore, social: 50, regulatorio: 50 }
}

function pickAlertas(p: ProcessoSeed): AlertaLegislativo[] {
  const C = CATALOGO_ALERTAS

  if (p.regime === 'bloqueio_permanente') {
    return [C.lei15190, C.ibama1234, C.anm89]
  }
  if (p.regime === 'bloqueio_provisorio') {
    return [C.pec48, C.decretoMME]
  }

  if (processoBloqueadoParaRisco(p)) return []

  const pool: AlertaLegislativo[] = []

  pool.push(C.anm89, C.lei15190)

  if (p.uf === 'PA' || p.uf === 'AM') pool.push(C.pec48, C.ibama1234)
  if (p.uf === 'PA') pool.push(C.aneelPA)
  if (p.uf === 'PA' || p.uf === 'GO') pool.push(C.ferroviaNorteSul)
  if (p.uf === 'GO' || p.uf === 'MG') pool.push(C.confaz88)

  if (p.regime === 'mineral_estrategico' || p.is_mineral_estrategico) {
    pool.push(C.anm412, C.decretoMME, C.pl2197, C.bndesFinep)
  } else {
    pool.push(C.pl2197, C.bndesFinep)
  }

  if (p.uf === 'BA') pool.push(C.decretoMME)

  const seen = new Set<string>()
  const unique = pool.filter((a) =>
    seen.has(a.id) ? false : (seen.add(a.id), true),
  )

  unique.sort(
    (a, b) => hashUnit(`${p.id}:${a.id}`, 0) - hashUnit(`${p.id}:${b.id}`, 0),
  )

  const count = 1 + Math.floor(hashUnit(p.id, 88) * 4)
  return unique.slice(0, Math.min(count, unique.length))
}

function lerpMi(lo: number, hi: number, t: number): number {
  return Math.round((lo + (hi - lo) * t) * 10) / 10
}

function fiscalPara(p: ProcessoSeed): DadosFiscais {
  const u = (s: number) => hashUnit(p.id, s)
  const m = p.municipio

  const base = (
    capag: DadosFiscais['capag'],
    rLo: number,
    rHi: number,
    incentivos: string[],
    linhas: string[],
    observacao: string,
  ): DadosFiscais => {
    const receita = lerpMi(rLo, rHi, u(40))
    const divida = lerpMi(receita * 0.35, receita * 1.15, u(41))
    return {
      capag,
      receita_propria_mi: receita,
      divida_consolidada_mi: divida,
      incentivos_estaduais: [...incentivos],
      linhas_bndes: [...linhas],
      observacao,
    }
  }

  if (
    ['Marabá', 'Parauapebas', 'Redenção', 'Altamira', 'Tucuruí', 'Santarém'].includes(
      m,
    )
  ) {
    return base(
      u(42) < 0.55 ? 'B' : 'C',
      180,
      420,
      [
        'Redução de 60% na base de ICMS para mineração (programa estadual)',
        'Isenção de IPTU para instalações industriais vinculadas ao polo mineral',
      ],
      ['Finem Mineração', 'Nova Indústria Brasil', 'Finame Equipamentos'],
      'Município paraense com forte dependência de royalties de mineração e ferrovia; monitorar repasse de FPM e FEX.',
    )
  }

  if (
    ['Catalão', 'Minaçu', 'Niquelândia', 'Alto Horizonte', 'Barro Alto', 'Goiás'].includes(
      m,
    )
  ) {
    return base(
      u(42) < 0.45 ? 'A' : 'B',
      85,
      340,
      [
        'Convênio CONFAZ 88/2025: redução de ICMS para cadeia de terras raras',
        'PRODUZIR GO: apoio a projetos industriais com minerais metálicos',
      ],
      ['Finem Mineração', 'Finame', 'Nova Indústria Brasil'],
      'Capacidade fiscal estável; terras raras e níquel concentram incentivos estaduais e demanda por Finem.',
    )
  }

  if (
    [
      'Itabira',
      'Araxá',
      'Poços de Caldas',
      'Montes Claros',
      'Diamantina',
      'Paracatu',
      'Governador Valadares',
      'Uberlândia',
    ].includes(m)
  ) {
    return base(
      u(42) < 0.5 ? 'A' : 'B',
      120,
      890,
      [
        'ICMS Ecológico: redução para projetos com certificação ambiental',
        'Isenção parcial de ICMS para minerais estratégicos (convênio estadual)',
        'Linha BDMG mineração: garantias para capex de lavra e beneficiamento',
      ],
      ['Finem', 'Finame', 'Proesco', 'Nova Indústria Brasil'],
      'Base industrial madura; dívida consolidada histórica exige disciplina com novos incentivos.',
    )
  }

  if (['Irecê', 'Jacobina', 'Brumado', 'Caetité'].includes(m)) {
    return base(
      u(42) < 0.5 ? 'B' : 'C',
      65,
      180,
      [
        'DESENVOLVE BA: subvenção a investimentos em mineração e logística',
        'Redução de ICMS na exportação de minérios e concentrados',
      ],
      ['Finem Mineração', 'Nova Indústria Brasil'],
      'Receita própria sensível a commodities; minerais críticos ampliam janela de incentivos estaduais.',
    )
  }

  if (
    ['Presidente Figueiredo', 'Itacoatiara', 'Barcelos'].includes(m)
  ) {
    return base(
      u(42) < 0.4 ? 'C' : 'D',
      40,
      120,
      [
        'Zona Franca de Manaus: isenção de IPI e II para equipamentos importados',
        'Redução de ICMS estadual (55–100%) para insumos industriais na cadeia mineral',
      ],
      ['Finem', 'Finame', 'FNO Amazônia'],
      'Capacidade de pagamento limitada; projetos dependem de FNO e de garantias federais.',
    )
  }

  if (
    ['Guarantã do Norte', 'Peixoto de Azevedo', 'Alta Floresta'].includes(m)
  ) {
    return base(
      u(42) < 0.5 ? 'B' : 'C',
      75,
      160,
      [
        'PRODEI MT: apoio a instalações industriais no interior',
        'Redução de base de ICMS para mineração e logística associada',
      ],
      ['Finem Mineração', 'FCO Industrial', 'Finame'],
      'Municípios de fronteira agrícola-mineral; FCO é canal relevante para PME da cadeia.',
    )
  }

  return base(
    'B',
    90,
    280,
    ['Programas estaduais de apoio à mineração (genérico)'],
    ['Finem Mineração', 'Finame'],
    'Perfil fiscal genérico para município fora das matrizes regionais do mock.',
  )
}

const processosSeed: ProcessoSeed[] = [
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
    municipio: 'Araxá',
    lat: -19.59,
    lng: -46.94,
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
    lat: -21.84,
    lng: -46.56,
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
    municipio: 'Montes Claros',
    lat: -16.73,
    lng: -43.86,
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
    municipio: 'Diamantina',
    lat: -18.24,
    lng: -43.6,
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
    municipio: 'Paracatu',
    lat: -17.22,
    lng: -46.87,
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
    municipio: 'Governador Valadares',
    lat: -18.86,
    lng: -41.94,
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
    municipio: 'Uberlândia',
    lat: -18.92,
    lng: -48.28,
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
    uf: 'PA',
    municipio: 'Marabá',
    lat: -5.37,
    lng: -49.12,
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
    uf: 'PA',
    municipio: 'Parauapebas',
    lat: -6.07,
    lng: -49.9,
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
    uf: 'PA',
    municipio: 'Redenção',
    lat: -8.03,
    lng: -50.03,
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
    uf: 'PA',
    municipio: 'Altamira',
    lat: -3.2,
    lng: -52.21,
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
    uf: 'PA',
    municipio: 'Tucuruí',
    lat: -3.77,
    lng: -49.67,
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
    municipio: 'Santarém',
    lat: -2.44,
    lng: -54.71,
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
    uf: 'GO',
    municipio: 'Catalão',
    lat: -18.17,
    lng: -47.95,
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
    uf: 'GO',
    municipio: 'Minaçu',
    lat: -13.53,
    lng: -48.22,
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
    uf: 'GO',
    municipio: 'Niquelândia',
    lat: -14.47,
    lng: -48.46,
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
    substancia: 'NÍQUEL',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 298.4,
    uf: 'GO',
    municipio: 'Alto Horizonte',
    lat: -14.2,
    lng: -49.34,
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
    municipio: 'Barro Alto',
    lat: -14.97,
    lng: -48.91,
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
    municipio: 'Goiás',
    lat: -15.93,
    lng: -50.14,
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
    substancia: 'NEODÍMIO',
    is_mineral_estrategico: true,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 198.3,
    uf: 'BA',
    municipio: 'Irecê',
    lat: -11.3,
    lng: -41.86,
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
    substancia: 'NÍOBIO',
    is_mineral_estrategico: true,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 176.5,
    uf: 'BA',
    municipio: 'Jacobina',
    lat: -11.41,
    lng: -40.52,
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
    substancia: 'LÍTIO',
    is_mineral_estrategico: true,
    titular: 'St. George Mining Brasil',
    area_ha: 245.0,
    uf: 'BA',
    municipio: 'Brumado',
    lat: -14.2,
    lng: -41.67,
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
    substancia: 'DISPRÓSIO',
    is_mineral_estrategico: true,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 132.7,
    uf: 'BA',
    municipio: 'Caetité',
    lat: -14.07,
    lng: -42.49,
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
    uf: 'AM',
    municipio: 'Presidente Figueiredo',
    lat: -2.03,
    lng: -60.01,
    data_protocolo: '1987-04-22',
    ano_protocolo: 1987,
    situacao: 'bloqueado',
    risk_score: 85,
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
    uf: 'AM',
    municipio: 'Itacoatiara',
    lat: -3.14,
    lng: -58.44,
    data_protocolo: '1991-09-05',
    ano_protocolo: 1991,
    situacao: 'bloqueado',
    risk_score: 86,
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
    uf: 'AM',
    municipio: 'Barcelos',
    lat: -0.97,
    lng: -62.93,
    data_protocolo: '1994-12-18',
    ano_protocolo: 1994,
    situacao: 'bloqueado',
    risk_score: 86,
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
    uf: 'MT',
    municipio: 'Guarantã do Norte',
    lat: -10.9,
    lng: -54.9,
    data_protocolo: '2024-02-14',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 70,
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
    uf: 'MT',
    municipio: 'Peixoto de Azevedo',
    lat: -10.22,
    lng: -54.98,
    data_protocolo: '2024-05-22',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 71,
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
    uf: 'MT',
    municipio: 'Alta Floresta',
    lat: -9.87,
    lng: -56.08,
    data_protocolo: '2024-10-01',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 72,
  },
  {
    id: 'p-garimpo-1',
    numero: '935.210/2021',
    regime: 'lavra_garimpeira',
    fase: 'lavra',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Cooperativa Garimpeira do Tapajós',
    area_ha: 48.2,
    uf: 'PA',
    municipio: 'Itaituba',
    lat: -4.28,
    lng: -55.98,
    data_protocolo: '2021-06-14',
    ano_protocolo: 2021,
    situacao: 'ativo',
    risk_score: 78,
  },
  {
    id: 'p-disponibilidade-1',
    numero: '800.015/2005',
    regime: 'disponibilidade',
    fase: 'encerrado',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'Área disponível (sem titular)',
    area_ha: 520,
    uf: 'PA',
    municipio: 'Canaã dos Carajás',
    lat: -6.5,
    lng: -49.87,
    data_protocolo: '2005-02-10',
    ano_protocolo: 2005,
    situacao: 'inativo',
    risk_score: null,
  },
  {
    id: 'p-registro-ext-1',
    numero: '960.880/2023',
    regime: 'registro_extracao',
    fase: 'lavra',
    substancia: 'AREIA',
    is_mineral_estrategico: false,
    titular: 'Prefeitura Municipal de Uberlândia',
    area_ha: 15.8,
    uf: 'MG',
    municipio: 'Uberlândia',
    lat: -18.92,
    lng: -48.28,
    data_protocolo: '2023-09-01',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 15,
  },
]

function valorEstimadoUsdMiPara(p: ProcessoSeed): number {
  const u = hashUnit(p.id, 77)
  switch (p.regime) {
    case 'concessao_lavra':
      return Math.round(150 + u * 650)
    case 'autorizacao_pesquisa':
      return Math.round(20 + u * 180)
    case 'req_lavra':
      return Math.round(80 + u * 320)
    case 'licenciamento':
      return Math.round(10 + u * 40)
    case 'lavra_garimpeira':
      return Math.round(15 + u * 90)
    case 'registro_extracao':
      return Math.round(2 + u * 15)
    case 'disponibilidade':
      return Math.round(40 + u * 120)
    case 'mineral_estrategico':
      return Math.round(200 + u * 1000)
    case 'bloqueio_permanente':
      return 0
    case 'bloqueio_provisorio':
      return Math.round(5 + u * 25)
    default:
      return 0
  }
}

/** YYYY-MM-DD plausível conforme regime, fase e situação. */
function ultimoDespachoDataPara(p: ProcessoSeed): string {
  const u = hashUnit(p.id, 99)
  const d = (salt: number, mx: number) =>
    1 + Math.floor(hashUnit(p.id, salt) * mx)

  if (p.regime === 'bloqueio_permanente' || p.regime === 'bloqueio_provisorio') {
    const y = u < 0.55 ? 2023 : 2024
    const m = 4 + Math.floor(hashUnit(p.id, 44) * 8)
    return `${y}-${String(m).padStart(2, '0')}-${String(d(45, 26)).padStart(2, '0')}`
  }

  if (p.situacao === 'inativo' || p.fase === 'encerrado') {
    const y = 2022 + Math.floor(hashUnit(p.id, 46) * 2)
    const m = 1 + Math.floor(hashUnit(p.id, 47) * 12)
    return `${y}-${String(m).padStart(2, '0')}-${String(d(48, 27)).padStart(2, '0')}`
  }

  if (p.regime === 'concessao_lavra' && p.situacao === 'ativo') {
    const m = 1 + Math.floor(u * 3)
    return `2026-${String(m).padStart(2, '0')}-${String(3 + Math.floor(u * 25)).padStart(2, '0')}`
  }

  if (p.regime === 'autorizacao_pesquisa' && p.situacao === 'ativo') {
    if (hashUnit(p.id, 50) < 0.55) {
      const m = 10 + Math.floor(hashUnit(p.id, 51) * 3)
      const mo = m > 12 ? m - 12 : m
      const yr = m > 12 ? 2026 : 2025
      return `${yr}-${String(mo).padStart(2, '0')}-${String(d(52, 26)).padStart(2, '0')}`
    }
    const m = 1 + Math.floor(u * 3)
    return `2026-${String(m).padStart(2, '0')}-${String(d(53, 25)).padStart(2, '0')}`
  }

  const m = 1 + Math.floor(hashUnit(p.id, 54) * 12)
  return `2025-${String(m).padStart(2, '0')}-${String(d(55, 26)).padStart(2, '0')}`
}

const rawProcessos: RawProcesso[] = processosSeed.map((p) => {
  const risk_breakdown = riskBreakdownPara(p)
  return {
    ...p,
    risk_breakdown,
    risk_score:
      p.risk_score === null
        ? null
        : pontuacaoRiscoMedia(risk_breakdown),
    valor_estimado_usd_mi: valorEstimadoUsdMiPara(p),
    ultimo_despacho_data: ultimoDespachoDataPara(p),
    alertas: pickAlertas(p),
    fiscal: fiscalPara(p),
  }
})

export const processosMock: Processo[] = rawProcessos.map((p) => {
  const base: Processo = {
    ...p,
    geojson: makePolygon(p.lat, p.lng, p.id),
    risk_decomposicao: null,
  }
  return {
    ...base,
    risk_decomposicao: gerarRiskDecomposicaoParaProcesso(base),
  }
})

export const PROCESSOS_MOCK = processosMock
```

## 5. Tipos (src/types/index.ts)
**Arquivo:** `src/types/index.ts`
```tsx
export type Regime =
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'licenciamento'
  | 'lavra_garimpeira'
  | 'registro_extracao'
  | 'disponibilidade'
  | 'mineral_estrategico'
  | 'bloqueio_provisorio'
  | 'bloqueio_permanente'

export type Fase =
  | 'requerimento'
  | 'pesquisa'
  | 'concessao'
  | 'lavra'
  | 'encerrado'

export interface RiskBreakdown {
  geologico: number
  ambiental: number
  social: number
  regulatorio: number
}

/** Variável que compõe uma dimensão do Risk Score (popover + relatório). */
export interface RiskDimensaoVariavel {
  nome: string
  valor: number
  texto: string
  fonte: string
}

/** Uma dimensão do Risk Score com decomposição para UI. */
export interface RiskDimensaoDetalhe {
  score: number
  variaveis: RiskDimensaoVariavel[]
}

export interface RiskScoreDecomposicao {
  total: number
  geologico: RiskDimensaoDetalhe
  ambiental: RiskDimensaoDetalhe
  social: RiskDimensaoDetalhe
  regulatorio: RiskDimensaoDetalhe
}

export type NivelImpacto = 1 | 2 | 3 | 4

export interface AlertaLegislativo {
  id: string
  fonte: 'DOU' | 'Câmara' | 'Senado' | 'DOE' | 'IBAMA' | 'ANM'
  /** Diário de publicação de origem (ex.: DOU, DOE-PA, DOM-Parauapebas), exibido como “via …”. */
  fonte_diario: string
  data: string
  titulo: string
  resumo: string
  nivel_impacto: NivelImpacto
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro' | 'incerto'
  urgencia: 'imediata' | 'medio_prazo' | 'longo_prazo'
}

export interface DadosFiscais {
  capag: 'A' | 'B' | 'C' | 'D'
  receita_propria_mi: number
  divida_consolidada_mi: number
  incentivos_estaduais: string[]
  linhas_bndes: string[]
  observacao: string
}

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
  risk_breakdown: RiskBreakdown | null
  /** Decomposição por variável (mock/UI). Null quando `risk_score` é null. */
  risk_decomposicao: RiskScoreDecomposicao | null
  /** Valor estimado das reservas (milhões USD). */
  valor_estimado_usd_mi: number
  /** Data do último despacho ANM (YYYY-MM-DD). */
  ultimo_despacho_data: string
  alertas: AlertaLegislativo[]
  fiscal: DadosFiscais
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

/** Valor de `filtros.uf` que exclui todos os processos do mapa. */
export const UF_FILTRO_NENHUM = '__TERRAE_UF_NENHUM__' as const

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

