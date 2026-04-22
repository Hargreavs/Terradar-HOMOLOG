
# TERRADAR - ExportaÃ§Ã£o da estrutura de cÃ³digo

Gerado em: 2026-03-29 01:36:45


## 1. Tree com contagem de linhas (src/components/dashboard, src/lib, src/data)

```text
130 src/components/dashboard/animations/GridBreathingResultadosAnimation.tsx
472 src/components/dashboard/animations/RadarSweepAnimation.tsx
420 src/components/dashboard/animations/RegionFocusAnimation.tsx
466 src/components/dashboard/animations/RiskCalibrationAnimation.tsx
504 src/components/dashboard/animations/SubstanciasRadarAnimation.tsx
89 src/components/dashboard/animations/TerraeLogoLoading.tsx
274 src/components/dashboard/BrasilMiniMap.tsx
5354 src/components/dashboard/InteligenciaDashboard.tsx
55 src/components/dashboard/ProspeccaoAnimations.tsx
258 src/components/dashboard/ProspeccaoCards.tsx
1679 src/components/dashboard/ProspeccaoResultados.tsx
486 src/components/dashboard/ProspeccaoWizard.tsx
1717 src/components/dashboard/RadarAlertasSubtab.tsx
434 src/components/dashboard/RadarBackgroundAnimation.tsx
927 src/components/dashboard/RadarDashboard.tsx
66 src/data/brasil-ufs-paths.ts
36 src/data/camadas/geoImport.ts
239 src/data/dashboard.mock.ts
1266 src/data/processos.mock.ts
343 src/data/radar-alertas.mock.ts
1553 src/data/relatorio.mock.ts
112 src/lib/alertaImpactoLegislativo.ts
112 src/lib/alertaNivelImpactoBadge.ts
85 src/lib/brazilMapPaths.ts
5 src/lib/camadasTooltips.ts
71 src/lib/corSubstancia.ts
32 src/lib/formatarRealBrlInteligente.ts
21 src/lib/formatarUsdMiInteligente.ts
61 src/lib/intelMapDrill.ts
639 src/lib/mapCamadasGeo.ts
24 src/lib/mapFiltrosCount.ts
6 src/lib/mapFloatingUiEvents.ts
45 src/lib/motionDurations.ts
451 src/lib/opportunityCardCopy.ts
493 src/lib/opportunityCardMockData.ts
545 src/lib/opportunityScore.ts
23 src/lib/radarFeedIdFromProcessoAlerta.ts
61 src/lib/regimes.ts
65 src/lib/relevanciaAlerta.ts
63 src/lib/substancias.ts
67 src/lib/ufBounds.ts
```


## 2. Primeiras 80 linhas dos arquivos com mais de 500 linhas


### ========== src/components/dashboard/animations/SubstanciasRadarAnimation.tsx (504 linhas) ==========

```typescript
import { useEffect, useRef, useState } from 'react'

const COLORS = {
  ambar: '#EF9F27',
  ambarLight: '#F1B85A',
  verde: '#1D9E75',
  textSecondary: '#888780',
  bgPrimary: '#0D0D0C',
  border: '#2C2C2A',
}

const MINERALS = [
  { label: 'Fe', name: 'Ferro', color: '#7EADD4', x: 100, y: -160 },
  { label: 'Cu', name: 'Cobre', color: '#C87C5B', x: -80, y: -110 },
  { label: 'Au', name: 'Ouro', color: '#D4A843', x: 166, y: 72 },
  { label: 'Nb', name: 'Nióbio', color: '#5CBFA0', x: -137, y: 144 },
  { label: 'TR', name: 'Terras Raras', color: '#3D8B7A', x: 58, y: 230 },
  { label: 'Li', name: 'Lítio', color: '#9BB8D0', x: -173, y: -58 },
  { label: 'Ni', name: 'Níquel', color: '#8FAA8D', x: 122, y: -252 },
  { label: 'Bx', name: 'Bauxita', color: '#B8917A', x: -43, y: 288 },
  { label: 'Qz', name: 'Quartzo', color: '#C4B89A', x: 144, y: -36 },
]

const W = 800
const H = 800
const CX = 400
const CY = 400
const RADII = [80, 160, 240, 320]

function angleBetween(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI
}

function angleDiff(a: number, b: number): number {
  let d = ((b - a + 180) % 360) - 180
  if (d < -180) d += 360
  return d
}

export function SubstanciasRadarAnimation() {
  const [elapsed, setElapsed] = useState(0)
  const raf = useRef<number | null>(null)
  const t0 = useRef<number | null>(null)

  useEffect(() => {
    const tick = (ts: number) => {
      if (t0.current == null) t0.current = ts
      setElapsed((ts - t0.current!) / 1000)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const sweepAngle = (elapsed * 90) % 360
  const pulseScale = 1 + 0.25 * Math.abs(Math.sin(elapsed * Math.PI * 0.67))
  const rp1 = (elapsed * 0.5) % 1
  const rp2 = ((elapsed + 0.9) * 0.5) % 1

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
```


### ========== src/components/dashboard/InteligenciaDashboard.tsx (5354 linhas) ==========

```typescript
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipPayloadEntry } from 'recharts'
import { HelpCircle } from 'lucide-react'
import { dashboardMock, type DashboardAlertaRecente } from '../../data/dashboard.mock'
import { PROCESSOS_MOCK } from '../../data/processos.mock'
import BrasilMiniMap from './BrasilMiniMap'
import { estiloBadgeRelevancia } from '../../lib/relevanciaAlerta'
import { estiloBadgeSubstanciaPaletaV2 } from '../../lib/corSubstancia'
import { REGIME_COLORS, REGIME_LABELS } from '../../lib/regimes'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import { AlertaItemImpactoBar } from '../legislativo/AlertaItemImpactoBar'
import { RegimeBadge } from '../ui/RegimeBadge'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Fase, Processo, Regime } from '../../types'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
  MOTION_LINE_ANIMATION_BEGIN_MS,
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS,
  MOTION_OVERLAY_INNER_ENTER_MS,
  MOTION_STAGGER_STEP_MS,
} from '../../lib/motionDurations'

const DEFAULT_INTEL_STAGGER_BASE_MS =
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS + MOTION_OVERLAY_INNER_ENTER_MS

function intelMotionGroupStyle(visible: boolean, reduced: boolean): CSSProperties {
  if (reduced) return { opacity: 1, transform: 'translateY(0)' }
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${MOTION_GROUP_TRANSLATE_PX}px)`,
    transition: `opacity ${MOTION_GROUP_FADE_MS}ms ease-out, transform ${MOTION_GROUP_FADE_MS}ms ease-out`,
  }
}

function intelBarFillStyle(
  pct: number,
  widthActive: boolean,
  barIndex: number,
  reduced: boolean,
  backgroundColor: string,
): CSSProperties {
  if (reduced) {
    return {
      width: `${pct}%`,
      height: '100%',
      backgroundColor,
      borderRadius: 3,
    }
  }
  return {
    width: widthActive ? `${pct}%` : '0%',
    height: '100%',
    backgroundColor,
```


### ========== src/components/dashboard/ProspeccaoResultados.tsx (1679 linhas) ==========

```typescript
import { ArrowLeft, ChevronRight, Info, SearchX } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { Processo } from '../../types'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
} from '../../lib/motionDurations'
import {
  buildDescricoesBarras,
  computeDimScoresFromCard,
  corBolinhaAtencao,
  flattenVariaveis,
  gerarFatoresDestacados,
  scoreTotalFromDimScores,
  type VariavelPontuacao,
} from '../../lib/opportunityCardCopy'
import { resolveOpportunityCardVariaveis } from '../../lib/opportunityCardMockData'
import {
  CORES_DIMENSAO,
  PESOS_PERFIL,
  corFaixaOpportunity,
  corMiniBarraValor,
  faixaFromScore,
  qualificadorTextoMiniBarra,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { GridBreathingResultadosAnimation } from './animations/GridBreathingResultadosAnimation'

const TODAS_SUBST = '__TODAS__'

/** Borda 1px — dourado mais suave que o accent pleno (#EF9F27) */
const OPPORTUNITY_CARD_SELECTED_BORDER = 'rgba(239, 159, 39, 0.38)'
const OPPORTUNITY_CARD_SELECTED_SHADOW = '0 0 12px rgba(239, 159, 39, 0.05)'

const pillUnified: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 14px',
  borderRadius: 20,
  fontSize: 14,
  fontWeight: 500,
  backgroundColor: '#1A1A18',
  color: '#B4B2A9',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2C2C2A',
}

function perfilDotColor(proRisco: PerfilRisco): string {
  if (proRisco === 'conservador') return '#1D9E75'
  if (proRisco === 'moderado') return '#E8A830'
  return '#E24B4A'
}

function titleCaseSubst(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/** Cor do texto da posição no ranking (#1 ouro, #2 prata, #3 bronze, demais neutro). */
function corRanking(posicao: number): string {
  if (posicao === 1) return '#EF9F27'
```


### ========== src/components/dashboard/RadarAlertasSubtab.tsx (1717 linhas) ==========

```typescript
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import {
  RADAR_ALERTAS_MOCK,
  type RadarAlerta,
} from '../../data/radar-alertas.mock'
import { MultiSelectDropdown } from './InteligenciaDashboard'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import {
  calcularRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
  type TipoImpacto,
} from '../../lib/relevanciaAlerta'
import { motionMs } from '../../lib/motionDurations'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'

const RELEV_ORDER: Relevancia[] = [
  'critico',
  'desfavoravel',
  'neutro',
  'positivo',
  'favoravel',
]

const TODAS_SUBST = '__TODAS__'

type PeriodoKey = 'hoje' | '7d' | '30d' | '90d' | 'personalizar'

const PERIODO_OPCOES: { id: PeriodoKey; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'personalizar', label: 'Personalizar' },
]

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ymdToday(): string {
  return ymdFromDate(new Date())
}

function parseAlertaDateTimeMs(a: RadarAlerta): number {
  const t = `${a.data}T${a.hora}:00`
  const ms = new Date(t).getTime()
  return Number.isFinite(ms) ? ms : new Date(`${a.data}T12:00:00`).getTime()
}

function alertaPassaPeriodo(
  a: RadarAlerta,
  periodo: PeriodoKey,
  customDe: string,
  customAte: string,
): boolean {
  const ms = parseAlertaDateTimeMs(a)
```


### ========== src/components/dashboard/RadarDashboard.tsx (927 linhas) ==========

```typescript
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import { RadarBackgroundAnimation } from './RadarBackgroundAnimation'
import { RadarAlertasSubtab } from './RadarAlertasSubtab'
import { ProspeccaoWizard } from './ProspeccaoWizard'
import { ProspeccaoResultados } from './ProspeccaoResultados'
import { TerraeLogoLoading } from './animations/TerraeLogoLoading'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  computeOpportunityForProcesso,
  type ObjetivoProspeccao,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { MOTION_GROUP_FADE_MS } from '../../lib/motionDurations'

/** Snapshot dos filtros da última análise concluída (para pular loading se iguais). */
interface FiltrosSnapshot {
  objetivo: string
  substancias: string[]
  perfil: string
  ufs: string[]
}

function buildFiltrosSnapshot(
  objetivo: ObjetivoProspeccao,
  subst: string[],
  perfil: PerfilRisco,
  ufs: string[],
): FiltrosSnapshot {
  return {
    objetivo,
    substancias: [...subst].sort(),
    perfil,
    ufs: [...ufs].sort(),
  }
}

function filtrosIguais(a: FiltrosSnapshot, b: FiltrosSnapshot): boolean {
  return (
    a.objetivo === b.objetivo &&
    a.perfil === b.perfil &&
    JSON.stringify(a.substancias) === JSON.stringify(b.substancias) &&
    JSON.stringify(a.ufs) === JSON.stringify(b.ufs)
  )
}

type RadarViewState =
  | 'home'
  | 'transitioning-to-wizard'
  | 'transitioning-resultados-to-wizard'
  | 'wizard'
  | 'resultados'
  | 'transitioning-to-home'

const TODAS_SUBST = '__TODAS__'

const containersLayout: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: '0 0 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

function getElementStyle(
  viewState: RadarViewState,
  entryPhase: number,
  element: 'radar' | 'cta' | 'containers' | 'footer',
```


### ========== src/data/processos.mock.ts (1266 linhas) ==========

```typescript
import type {
  AlertaLegislativo,
  DadosFiscais,
  GeoJSONPolygon,
  Processo,
  RiskBreakdown,
} from '../types'

type RawProcesso = Omit<Processo, 'geojson'>
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
```


### ========== src/data/relatorio.mock.ts (1553 linhas) ==========

```typescript
/**
 * Mock rico para o Relatório Completo por processo (p1…p30).
 * Alinhado a `processos.mock.ts`: não importa esse ficheiro para manter o módulo isolado.
 */

export interface DadosANM {
  fase_atual: string
  data_protocolo: string
  prazo_vencimento: string | null
  tempo_tramitacao_anos: number
  pendencias: string[]
  ultimo_despacho: string
  data_ultimo_despacho: string
  numero_sei: string
  observacoes_tecnicas: string
}

export type BiomaRelatorio =
  | 'Amazônia'
  | 'Cerrado'
  | 'Caatinga'
  | 'Mata Atlântica'
  | 'Pampa'
  | 'Pantanal'

export interface DadosTerritoriais {
  distancia_ti_km: number | null
  nome_ti_proxima: string | null
  distancia_uc_km: number | null
  nome_uc_proxima: string | null
  tipo_uc: string | null
  distancia_aquifero_km: number | null
  nome_aquifero: string | null
  bioma: BiomaRelatorio | string
  distancia_sede_municipal_km: number
  distancia_ferrovia_km: number | null
  nome_ferrovia: string | null
  distancia_porto_km: number | null
  nome_porto: string | null
  sobreposicao_app: boolean
  sobreposicao_quilombola: boolean
  nome_quilombola: string | null
}

export interface ProcessoVizinho {
  numero: string
  titular: string
  substancia: string
  fase: string
  distancia_km: number
  area_ha: number
  risk_score: number
}

export interface IntelMineral {
  substancia_contexto: string
  reservas_brasil_mundial_pct: number
  producao_brasil_mundial_pct: number
  demanda_projetada_2030: string
  preco_medio_usd_t: number
  /** `'oz'`: exibir cotação primária em onça troy (ex.: ouro). Default `'t'`. */
  unidade_preco?: 't' | 'oz'
  /** USD/oz quando `unidade_preco === 'oz'`. */
  preco_referencia_usd_oz?: number
  tendencia_preco: 'alta' | 'estavel' | 'queda'
  aplicacoes_principais: string[]
  paises_concorrentes: string[]
  estrategia_nacional: string
  potencial_reserva_estimado_t: number
  valor_estimado_usd_mi: number
  metodologia_estimativa: string
  processos_vizinhos: ProcessoVizinho[]
}

export interface CfemHistorico {
  ano: number
  valor_recolhido_brl: number
}

/** CFEM total recebido pelo município (todos os processos minerários), por ano. */
```


### ========== src/lib/mapCamadasGeo.ts (639 linhas) ==========

```typescript
import type { FeatureCollectionJson } from '../data/camadas/geoImport'
import type mapboxgl from 'mapbox-gl'

export type CamadaGeoId =
  | 'terras_indigenas'
  | 'unidades_conservacao'
  | 'quilombolas'
  | 'app_car'
  | 'aquiferos'
  | 'ferrovias'
  | 'portos'

export const CAMADAS_GEO_ORDER: CamadaGeoId[] = [
  'aquiferos',
  'terras_indigenas',
  'unidades_conservacao',
  'quilombolas',
  'app_car',
  'ferrovias',
  'portos',
]

/** Ordem na legenda do mapa (leitura humana; z-order usa `CAMADAS_GEO_ORDER`). */
export const CAMADAS_GEO_LEGEND_ORDER: CamadaGeoId[] = [
  'terras_indigenas',
  'unidades_conservacao',
  'quilombolas',
  'app_car',
  'aquiferos',
  'ferrovias',
  'portos',
]

export const CAMADAS_GEO_LABEL: Record<CamadaGeoId, string> = {
  terras_indigenas: 'Terras Indígenas',
  unidades_conservacao: 'Unidades de Conservação',
  quilombolas: 'Quilombolas',
  app_car: 'Áreas de Preservação',
  aquiferos: 'Aquíferos',
  ferrovias: 'Ferrovias',
  portos: 'Portos',
}

export const CAMADAS_GEO_COLOR: Record<CamadaGeoId, string> = {
  terras_indigenas: '#E07A5F',
  unidades_conservacao: '#4A9E4A',
  quilombolas: '#C4915A',
  app_car: '#5B9A6F',
  aquiferos: '#4A90B8',
  ferrovias: '#B8B8B8',
  portos: '#7EADD4',
}

const TEXT_FONT = ['Open Sans Semibold', 'Arial Unicode MS Bold'] as string[]

const POLY_FILTER: mapboxgl.ExpressionSpecification = [
  'any',
  ['==', ['geometry-type'], 'Polygon'],
  ['==', ['geometry-type'], 'MultiPolygon'],
]

const POINT_FILTER: mapboxgl.ExpressionSpecification = ['==', ['geometry-type'], 'Point']

const LINE_FILTER: mapboxgl.ExpressionSpecification = [
  'any',
  ['==', ['geometry-type'], 'LineString'],
  ['==', ['geometry-type'], 'MultiLineString'],
]

function addBefore(
  map: mapboxgl.Map,
  layer: mapboxgl.AddLayerObject,
  beforeId: string,
) {
  map.addLayer(layer, beforeId)
}

/** Layers usados em queryRenderedFeatures para tooltip (sem halo). */
export const CAMADA_GEO_HOVER_LAYER_IDS: string[] = [
  'geo-aquiferos-fill',
```


### ========== src/lib/opportunityScore.ts (545 linhas) ==========

```typescript
import type { AlertaLegislativo, Processo } from '../types'

export type PerfilRisco = 'conservador' | 'moderado' | 'arrojado'
export type ObjetivoProspeccao = 'investir' | 'novo_requerimento' | 'avaliar_portfolio'

export interface OpportunityResult {
  processoId: string
  scoreTotal: number
  scoreAtratividade: number
  scoreViabilidade: number
  scoreSeguranca: number
  faixa: 'alta' | 'moderada' | 'baixa' | 'desfavoravel'
  fatoresPositivos: string[]
  fatoresAtencao: string[]
}

const RELEVANCIA_SUBSTANCIA: Record<string, number> = {
  DISPRÓSIO: 100,
  NEODÍMIO: 95,
  'TERRAS RARAS': 95,
  LÍTIO: 90,
  NIÓBIO: 85,
  NÍQUEL: 75,
  OURO: 70,
  COBRE: 65,
  FERRO: 45,
  BAUXITA: 40,
  QUARTZO: 25,
}

const GAP_SUBSTANCIA: Record<string, number> = {
  DISPRÓSIO: 22.2,
  NEODÍMIO: 22.2,
  'TERRAS RARAS': 22.2,
  NIÓBIO: 6.0,
  LÍTIO: 3.0,
  NÍQUEL: 6.0,
  FERRO: -5.0,
  OURO: 1.0,
  COBRE: 1.0,
  BAUXITA: -2.0,
  QUARTZO: -2.0,
}

const PRECO_USD_T: Record<string, number> = {
  DISPRÓSIO: 290_000,
  NEODÍMIO: 68_000,
  LÍTIO: 13_000,
  NIÓBIO: 41_000,
  NÍQUEL: 16_000,
  OURO: 62_000,
  COBRE: 8500,
  FERRO: 110,
  BAUXITA: 50,
  QUARTZO: 30,
  'TERRAS RARAS': 68_000,
}

const TENDENCIA_SUBSTANCIA: Record<string, 'alta' | 'estavel' | 'queda'> = {
  DISPRÓSIO: 'alta',
  NEODÍMIO: 'alta',
  'TERRAS RARAS': 'alta',
  LÍTIO: 'alta',
  NIÓBIO: 'estavel',
  NÍQUEL: 'alta',
  OURO: 'estavel',
  COBRE: 'alta',
  FERRO: 'estavel',
  BAUXITA: 'estavel',
  QUARTZO: 'queda',
}

export const PESOS_PERFIL: Record<PerfilRisco, { a: number; b: number; c: number }> = {
  conservador: { a: 0.25, b: 0.3, c: 0.45 },
  moderado: { a: 0.4, b: 0.3, c: 0.3 },
  arrojado: { a: 0.55, b: 0.25, c: 0.2 },
}

function normSubKey(s: string): string {
  return s
```


## 3. Exports em src/lib/*.ts (linhas que comeÃ§am por export)


### alertaImpactoLegislativo.ts

```typescript
3: export const ALERTA_LEG_TOOLTIP_MAX_W_PX = 280
5: export const ALERTA_LEG_TOOLTIP_BOX_SHADOW =
15: export function textoTooltipNivelImpactoLegislativo(n: NivelImpacto): string {
19: export function textoTooltipTipoImpactoLegislativo(
35: export function textoLinkPublicacaoAlerta(_fonteDiario: string): string {
52: export function rotuloFontePublicacaoExibicao(
79: export function tipoImpactoLabel(t: AlertaLegislativo['tipo_impacto']): string {
92: export function corTipoImpacto(t: AlertaLegislativo['tipo_impacto']): string {
105: export {
```


### alertaNivelImpactoBadge.ts

```typescript
4: export function nivelImpactoMaisGrave(
19: export function alertaMaisGraveParaTituloPopover(
36: export function estiloImpactoOutlinePorNivel(n: NivelImpacto): {
70: export function estiloImpactoAgregadoPopover(
77: export function estiloBadgeNivelImpacto(n: NivelImpacto): {
106: export {
```


### brazilMapPaths.ts

```typescript
21: export const BRAZIL_OUTLINE = joinPaths(BRASIL_UFS_PAINT_ORDER)
33: export const BRAZIL_REGIONS = [
77: export const BRAZIL_VIEWBOX = BRASIL_MINI_VIEWBOX
80: export const BRAZIL_MAP_CENTER = { cx: 216.019, cy: 303.634 } as const
85: export const BRAZIL_SCALE_TO_300W = 300 / vbW
```


### camadasTooltips.ts

```typescript
2: export { REGIME_BADGE_TOOLTIP as REGIME_CAMADA_TOOLTIP } from './regimes'
4: export const AREAS_BLOQUEADAS_SECAO_TOOLTIP =
```


### corSubstancia.ts

```typescript
3: export const COR_SUBSTANCIA: Record<string, string> = {
30: export function corSubstanciaOuUndefined(raw: string): string | undefined {
38: export function estiloBadgeSubstanciaPaletaV2(raw: string): {
62: export function estiloBadgeSubstancia(raw: string): {
```


### formatarRealBrlInteligente.ts

```typescript
5: export function formatarRealBrlInteligente(valorBrl: number): string {
```


### formatarUsdMiInteligente.ts

```typescript
5: export function formatarUsdMiInteligente(valorMilhoesUsd: number): string {
```


### intelMapDrill.ts

```typescript
4: export function fingerprintDrillFiltros(
26: export function cloneFiltrosState(f: FiltrosState): FiltrosState {
36: export const BRAZIL_BOUNDS_LNG_LAT: [[number, number], [number, number]] = [
41: export function boundsFromProcessos(processos: Processo[]): mapboxgl.LngLatBounds | null {
59: export function boundsFromSingleProcesso(p: Processo): mapboxgl.LngLatBounds | null {
```


### mapCamadasGeo.ts

```typescript
4: export type CamadaGeoId =
13: export const CAMADAS_GEO_ORDER: CamadaGeoId[] = [
24: export const CAMADAS_GEO_LEGEND_ORDER: CamadaGeoId[] = [
34: export const CAMADAS_GEO_LABEL: Record<CamadaGeoId, string> = {
44: export const CAMADAS_GEO_COLOR: Record<CamadaGeoId, string> = {
79: export const CAMADA_GEO_HOVER_LAYER_IDS: string[] = [
118: export function camadasGeoLayersPresent(map: mapboxgl.Map): boolean {
122: export function addCamadasGeoLayers(
514: export function camadaGeoIdFromLayerId(layerId: string): CamadaGeoId | null {
522: export function formatCamadaGeoTooltip(
601: export function syncCamadasGeoVisibility(
618: export function defaultCamadasGeo(): Record<CamadaGeoId, boolean> {
630: export function mergeCamadasGeoPersisted(
```


### mapFiltrosCount.ts

```typescript
14: export function countFiltrosAlterados(f: FiltrosState): number {
```


### mapFloatingUiEvents.ts

```typescript
2: export const TERRAE_MAP_CLEAR_FLOATING_UI = 'terrae-map-clear-floating-ui'
4: export function dispatchTerraeMapClearFloatingUi(): void {
```


### motionDurations.ts

```typescript
3: export const MOTION_OVERLAY_INNER_ENTER_DELAY_MS = 60
4: export const MOTION_OVERLAY_INNER_ENTER_MS = 120
5: export const MOTION_OVERLAY_INNER_EXIT_MS = 120
7: export const MOTION_OVERLAY_UNMOUNT_MS = 180
9: export const MOTION_STAGGER_STEP_MS = 60
11: export function motionStaggerBaseMs(reducedMotion: boolean): number {
17: export const MOTION_TAB_CROSSFADE_OUT_MS = 120
18: export const MOTION_TAB_CROSSFADE_IN_MS = 180
20: export const MOTION_GROUP_FADE_MS = 300
21: export const MOTION_GROUP_TRANSLATE_PX = 16
23: export const MOTION_BAR_WIDTH_MS = 400
24: export const MOTION_BAR_STAGGER_MS = 30
26: export const MOTION_MAP_INTRO_SEARCH_DELAY_MS = 300
27: export const MOTION_MAP_INTRO_LEGEND_DELAY_MS = 400
28: export const MOTION_MAP_INTRO_THEME_DELAY_MS = 450
29: export const MOTION_MAP_INTRO_DURATION_MS = 250
32: export const MOTION_LINE_ANIMATION_BEGIN_MS: Record<
43: export function motionMs(d: number, reducedMotion: boolean): number {
```


### opportunityCardCopy.ts

```typescript
6: export interface VariavelPontuacao {
13: export interface OpportunityCardVariaveis {
19: export type FatorDestacado = {
25: export const PESOS_INTERNOS_ATRATIVIDADE = [0.25, 0.25, 0.2, 0.15, 0.15] as const
26: export const PESOS_INTERNOS_VIABILIDADE = [0.2, 0.2, 0.15, 0.1, 0.1, 0.15, 0.1] as const
27: export const PESOS_INTERNOS_SEGURANCA = [0.35, 0.2, 0.15, 0.15, 0.1, 0.05] as const
33: export function scoreDimensaoFromVariaveis(
46: export function computeDimScoresFromCard(cv: OpportunityCardVariaveis): {
58: export function scoreTotalFromDimScores(
83: export function gerarDescricaoDimensao(
110: export function gerarFatoresDestacados(
140: export function corBolinhaAtencao(valor: number): '#E8A830' | '#E24B4A' {
145: export function flattenVariaveis(cv: OpportunityCardVariaveis): VariavelPontuacao[] {
149: export function buildDescricoesBarras(
161: export function mockVarValor(subScore: number, varIndex: number): number {
298: export function gerarVariaveisAutomaticas(
```


### opportunityCardMockData.ts

```typescript
12: export const OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID: Record<string, OpportunityCardVariaveis> = {
479: export function getOpportunityCardVariaveis(processoId: string): OpportunityCardVariaveis | null {
483: export type OpportunityCardFonte = 'manual' | 'auto'
486: export function resolveOpportunityCardVariaveis(
```


### opportunityScore.ts

```typescript
3: export type PerfilRisco = 'conservador' | 'moderado' | 'arrojado'
4: export type ObjetivoProspeccao = 'investir' | 'novo_requerimento' | 'avaliar_portfolio'
6: export interface OpportunityResult {
73: export const PESOS_PERFIL: Record<PerfilRisco, { a: number; b: number; c: number }> = {
94: export function normalizeGap(gap: number): number {
102: export function normalizeValorEstimado(v: number): number {
129: export function normalizeRecenciaDespacho(dataIso: string): number {
139: export function normalizeAlertasRestritivos(alertas: AlertaLegislativo[]): number {
147: export function normalizeAlertasFavoraveis(alertas: AlertaLegislativo[]): number {
175: export function faixaFromScore(score: number): OpportunityResult['faixa'] {
182: export function corFaixaOpportunity(faixa: OpportunityResult['faixa']): string {
189: export function labelFaixaOpportunity(faixa: OpportunityResult['faixa']): string {
197: export const CORES_DIMENSAO = {
204: export function corMiniBarraValor(v: number): string {
211: export function qualificadorTextoMiniBarra(valor: number): { label: string; color: string } {
384: export function computeOpportunityForProcesso(
535: export function runProspeccao(
```


### radarFeedIdFromProcessoAlerta.ts

```typescript
8: export function radarFeedIdParaAlertaProcesso(
```


### regimes.ts

```typescript
3: export const REGIME_COLORS: Record<Regime, string> = {
14: export const REGIME_COLORS_MAP: Record<Regime, string> = {
24: export const REGIME_LABELS: Record<Regime, string> = {
35: export const REGIME_LAYER_ORDER: Regime[] = [
46: export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
```


### relevanciaAlerta.ts

```typescript
3: export type TipoImpacto = AlertaLegislativo['tipo_impacto']
5: export type Relevancia =
12: export interface RelevanciaConfig {
19: export const RELEVANCIA_MAP: Record<Relevancia, RelevanciaConfig> = {
27: export function calcularRelevancia(
58: export function estiloBadgeRelevancia(
```


### substancias.ts

```typescript
14: export type SubstanciaDef = {
22: export const SUBSTANCIA_DEFS: SubstanciaDef[] = [
35: export function normalizeSubstanciaKey(raw: string): string {
51: export function labelSubstanciaParaExibicao(raw: string): string {
63: export const RARE_KEYS = ['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPRÓSIO'] as const
```


### ufBounds.ts

```typescript
3: export const UF_NOME_COMPLETO: Record<string, string> = {
61: export function ufBoundsLngLat(uf: string): [[number, number], [number, number]] | null {
65: export function ufNomeOuSigla(uf: string): string {
```


## 4. ConteÃºdo completo dos arquivos crÃ­ticos


### src\components\dashboard\RadarDashboard.tsx (927 linhas)

```typescript
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import { RadarBackgroundAnimation } from './RadarBackgroundAnimation'
import { RadarAlertasSubtab } from './RadarAlertasSubtab'
import { ProspeccaoWizard } from './ProspeccaoWizard'
import { ProspeccaoResultados } from './ProspeccaoResultados'
import { TerraeLogoLoading } from './animations/TerraeLogoLoading'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  computeOpportunityForProcesso,
  type ObjetivoProspeccao,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { MOTION_GROUP_FADE_MS } from '../../lib/motionDurations'

/** Snapshot dos filtros da última análise concluída (para pular loading se iguais). */
interface FiltrosSnapshot {
  objetivo: string
  substancias: string[]
  perfil: string
  ufs: string[]
}

function buildFiltrosSnapshot(
  objetivo: ObjetivoProspeccao,
  subst: string[],
  perfil: PerfilRisco,
  ufs: string[],
): FiltrosSnapshot {
  return {
    objetivo,
    substancias: [...subst].sort(),
    perfil,
    ufs: [...ufs].sort(),
  }
}

function filtrosIguais(a: FiltrosSnapshot, b: FiltrosSnapshot): boolean {
  return (
    a.objetivo === b.objetivo &&
    a.perfil === b.perfil &&
    JSON.stringify(a.substancias) === JSON.stringify(b.substancias) &&
    JSON.stringify(a.ufs) === JSON.stringify(b.ufs)
  )
}

type RadarViewState =
  | 'home'
  | 'transitioning-to-wizard'
  | 'transitioning-resultados-to-wizard'
  | 'wizard'
  | 'resultados'
  | 'transitioning-to-home'

const TODAS_SUBST = '__TODAS__'

const containersLayout: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: '0 0 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

function getElementStyle(
  viewState: RadarViewState,
  entryPhase: number,
  element: 'radar' | 'cta' | 'containers' | 'footer',
  reducedMotion: boolean,
): CSSProperties {
  if (reducedMotion) {
    if (element === 'containers') {
      return {
        ...containersLayout,
        opacity: 1,
        transform: 'translateY(0)',
        pointerEvents: 'auto',
      }
    }
    if (element === 'footer') {
      return { opacity: 1, transform: 'translateY(0)' }
    }
    return { opacity: 1, transform: 'none' }
  }

  if (viewState === 'transitioning-to-wizard') {
    switch (element) {
      case 'radar':
        return { opacity: 0, transition: 'opacity 400ms ease-in' }
      case 'cta':
        return {
          opacity: 0,
          transform: 'translateY(-20px)',
          transition: 'opacity 300ms ease-in, transform 300ms ease-in',
        }
      case 'containers':
        return {
          ...containersLayout,
          opacity: 0,
          transform: 'translateY(60px)',
          transition: 'opacity 350ms ease-in, transform 350ms ease-in',
          pointerEvents: 'none',
        }
      case 'footer':
        return { opacity: 0, transition: 'opacity 300ms ease-in' }
      default:
        return {}
    }
  }

  switch (element) {
    case 'radar':
      return {
        opacity: entryPhase >= 1 ? 1 : 0,
        transform: entryPhase >= 1 ? 'scale(1)' : 'scale(0.97)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
      }
    case 'cta':
      return {
        opacity: entryPhase >= 2 ? 1 : 0,
        transform: entryPhase >= 2 ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 350ms ease-out, transform 350ms ease-out',
        pointerEvents: entryPhase >= 2 ? 'auto' : 'none',
      }
    case 'containers':
      return {
        ...containersLayout,
        opacity: entryPhase >= 3 ? 1 : 0,
        transform: entryPhase >= 3 ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
        pointerEvents: entryPhase >= 3 ? 'auto' : 'none',
      }
    case 'footer':
      return {
        opacity: entryPhase >= 3 ? 1 : 0,
        transform: entryPhase >= 3 ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
      }
    default:
      return {}
  }
}

export function RadarDashboard({
  reducedMotion = false,
}: {
  reducedMotion?: boolean
} = {}) {
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const pendingRadarAlertaId = useAppStore((s) => s.pendingRadarAlertaId)
  const processos = useMapStore((s) => s.processos)
  const setPendingNavigation = useMapStore((s) => s.setPendingNavigation)

  const processoById = useMemo(() => {
    const m = new Map<string, Processo>()
    for (const p of processos) m.set(p.id, p)
    return m
  }, [processos])

  const substanciasCatalogo = useMemo(() => {
    const s = new Set<string>()
    for (const p of processos) s.add(p.substancia)
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos])

  const prospeccaoSubstOpcoes = useMemo(
    () => [TODAS_SUBST, ...substanciasCatalogo],
    [substanciasCatalogo],
  )

  const [viewState, setViewState] = useState<RadarViewState>('home')

  /** 0–3: entrada escalonada na home (radar → CTA → containers); 3 = estado final */
  const [entryPhase, setEntryPhase] = useState(() => (reducedMotion ? 3 : 0))

  useLayoutEffect(() => {
    if (viewState !== 'home') return
    if (reducedMotion) {
      setEntryPhase(3)
      return
    }
    setEntryPhase(0)
    const t1 = window.setTimeout(() => setEntryPhase(1), 50)
    const t2 = window.setTimeout(() => setEntryPhase(2), 250)
    const t3 = window.setTimeout(() => setEntryPhase(3), 500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [viewState, reducedMotion])

  const navigateProcessoMapa = useCallback(
    (id: string) => {
      setPendingNavigation({
        type: 'processo',
        payload: id,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setPendingNavigation, setTelaAtiva],
  )

  /* --- Prospecção --- */
  const [homeLeaveSource, setHomeLeaveSource] = useState<'wizard' | 'resultados' | null>(null)
  const [wizardEntryVisible, setWizardEntryVisible] = useState(false)

  const [proObjetivo, setProObjetivo] = useState<ObjetivoProspeccao | null>(null)
  const [proSubst, setProSubst] = useState<string[]>([])
  const [proRisco, setProRisco] = useState<PerfilRisco | null>(null)
  const [proUfs, setProUfs] = useState<string[]>([])
  const [proDdSub, setProDdSub] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadMsgIdx, setLoadMsgIdx] = useState(0)
  const [loadOverlayOut, setLoadOverlayOut] = useState(false)
  const [resultados, setResultados] = useState<OpportunityResult[]>([])
  const [resultadosDescartados, setResultadosDescartados] = useState<OpportunityResult[]>([])
  const [excluidosCount, setExcluidosCount] = useState(0)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [wizardEntryStep, setWizardEntryStep] = useState<1 | 2 | 3 | 4>(1)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false)
  const [ultimosFiltrosAnalise, setUltimosFiltrosAnalise] = useState<FiltrosSnapshot | null>(
    null,
  )
  const [skipStaggerResultados, setSkipStaggerResultados] = useState(false)
  const prevTelaRef = useRef(telaAtiva)

  const loadingMsgs = [
    'Cruzando 30 processos com 7 camadas territoriais...',
    'Analisando alertas de 2.500 fontes regulatórias...',
    'Calculando viabilidade econômica e logística...',
    'Aplicando perfil de risco selecionado...',
    'Gerando ranking de oportunidades...',
  ]

  const substanciasFiltroProspeccao = useMemo(() => {
    if (proSubst.includes(TODAS_SUBST)) return null
    const xs = proSubst.filter((x) => x !== TODAS_SUBST)
    return xs.length > 0 ? xs : null
  }, [proSubst])

  const runAnalise = useCallback(() => {
    if (!proObjetivo || !proRisco) return
    let rows = [...processos]
    if (substanciasFiltroProspeccao != null) {
      const allow = new Set(substanciasFiltroProspeccao)
      rows = rows.filter((p) => allow.has(p.substancia))
    }
    if (proUfs.length > 0) {
      rows = rows.filter((p) => proUfs.includes(p.uf))
    }
    const scored = rows
      .map((p) => computeOpportunityForProcesso(p, proRisco, proObjetivo))
      .sort((a, b) => b.scoreTotal - a.scoreTotal)
    const excl = scored.filter((r) => r.scoreTotal <= 24)
    setExcluidosCount(excl.length)
    setResultadosDescartados(excl)
    setResultados(scored.filter((r) => r.scoreTotal > 24))
  }, [processos, proObjetivo, proRisco, substanciasFiltroProspeccao, proUfs])

  useEffect(() => {
    if (!loadingOverlayVisible) return
    setSelectedResultId(null)
    setLoadProgress(0)
    setLoadMsgIdx(0)
    setLoadOverlayOut(false)
    const t0 = Date.now()
    let done = false
    const msgId = window.setInterval(() => {
      setLoadMsgIdx((i) => (i + 1) % loadingMsgs.length)
    }, 1200)
    const id = window.setInterval(() => {
      const elapsed = Date.now() - t0
      const p = Math.min(100, (elapsed / 5000) * 100)
      setLoadProgress(p)
      if (elapsed >= 5000 && !done) {
        done = true
        clearInterval(id)
        clearInterval(msgId)
        setLoadOverlayOut(true)
        window.setTimeout(() => {
          runAnalise()
          if (proObjetivo && proRisco) {
            setUltimosFiltrosAnalise(
              buildFiltrosSnapshot(proObjetivo, proSubst, proRisco, proUfs),
            )
          }
          setLoadingOverlayVisible(false)
          setLoadOverlayOut(false)
          setViewState('resultados')
        }, reducedMotion ? 0 : 300)
      }
    }, 50)
    return () => {
      clearInterval(id)
      clearInterval(msgId)
    }
  }, [
    loadingOverlayVisible,
    runAnalise,
    reducedMotion,
    loadingMsgs.length,
    proObjetivo,
    proRisco,
    proSubst,
    proUfs,
  ])

  const cardStaggerCount = resultados.length > 0 ? resultados.length : 1
  const cardVis = useStaggeredEntrance(cardStaggerCount, {
    baseDelayMs: reducedMotion ? 0 : 200,
    staggerMs: reducedMotion ? 0 : 80,
    reducedMotion,
    skipAnimation: skipStaggerResultados,
  })

  const [barsReady, setBarsReady] = useState(false)

  useEffect(() => {
    if (viewState !== 'resultados') {
      setBarsReady(false)
      return
    }
    if (reducedMotion || skipStaggerResultados) {
      setBarsReady(true)
      return
    }
    const n = Math.max(1, resultados.length)
    const delayMs = 200 + (n - 1) * 80 + MOTION_GROUP_FADE_MS
    const id = window.setTimeout(() => setBarsReady(true), delayMs)
    return () => clearTimeout(id)
  }, [viewState, reducedMotion, resultados.length, skipStaggerResultados])

  useEffect(() => {
    const prev = prevTelaRef.current
    if (prev === 'mapa' && telaAtiva === 'radar' && viewState === 'resultados') {
      setSkipStaggerResultados(true)
    }
    prevTelaRef.current = telaAtiva
  }, [telaAtiva, viewState])

  useEffect(() => {
    if (viewState !== 'resultados') {
      setSkipStaggerResultados(false)
    }
  }, [viewState])

  useEffect(() => {
    if (telaAtiva !== 'radar') return
    if (pendingRadarAlertaId) {
      setViewState('home')
    }
  }, [telaAtiva, pendingRadarAlertaId])

  const resetProspeccao = useCallback(() => {
    setProObjetivo(null)
    setProSubst([])
    setProRisco(null)
    setProUfs([])
    setResultados([])
    setResultadosDescartados([])
    setExcluidosCount(0)
    setSelectedResultId(null)
    setLoadingOverlayVisible(false)
    setUltimosFiltrosAnalise(null)
  }, [])

  const handleIniciarProspeccao = useCallback(() => {
    setWizardEntryStep(1)
    if (reducedMotion) {
      setViewState('wizard')
      return
    }
    setViewState('transitioning-to-wizard')
    window.setTimeout(() => setViewState('wizard'), 500)
  }, [reducedMotion])

  const handleCancelWizard = useCallback(() => {
    setLoadingOverlayVisible(false)
    setWizardEntryStep(1)
    if (reducedMotion) {
      setViewState('home')
      return
    }
    setHomeLeaveSource('wizard')
    setViewState('transitioning-to-home')
    window.setTimeout(() => {
      setEntryPhase(0)
      setViewState('home')
      setHomeLeaveSource(null)
    }, 400)
  }, [reducedMotion])

  const handleAnalisar = useCallback(() => {
    if (!proObjetivo || !proRisco) return
    const snap = buildFiltrosSnapshot(proObjetivo, proSubst, proRisco, proUfs)
    if (
      ultimosFiltrosAnalise &&
      filtrosIguais(ultimosFiltrosAnalise, snap) &&
      resultados.length > 0
    ) {
      setViewState('resultados')
      return
    }
    setLoadingOverlayVisible(true)
  }, [proObjetivo, proRisco, proSubst, proUfs, ultimosFiltrosAnalise, resultados.length])

  const handleRefinarBusca = useCallback(() => {
    setWizardEntryStep(4)
    if (reducedMotion) {
      setViewState('wizard')
      return
    }
    setViewState('transitioning-resultados-to-wizard')
    window.setTimeout(() => setViewState('wizard'), 300)
  }, [reducedMotion])

  const handleVoltarAoRadar = useCallback(() => {
    if (reducedMotion) {
      setEntryPhase(0)
      setViewState('home')
      resetProspeccao()
      return
    }
    setHomeLeaveSource('resultados')
    setViewState('transitioning-to-home')
    window.setTimeout(() => {
      setEntryPhase(0)
      setViewState('home')
      setHomeLeaveSource(null)
      resetProspeccao()
    }, 300)
  }, [reducedMotion, resetProspeccao])

  useEffect(() => {
    if (viewState === 'wizard') {
      if (reducedMotion) {
        setWizardEntryVisible(true)
        return
      }
      setWizardEntryVisible(false)
      const t = window.setTimeout(() => setWizardEntryVisible(true), 50)
      return () => clearTimeout(t)
    }
    setWizardEntryVisible(false)
  }, [viewState, reducedMotion])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 2800)
  }

  const proPrefixSub =
    proSubst.length === 0
      ? 'Substâncias'
      : proSubst.includes(TODAS_SUBST)
        ? 'Todas'
        : proSubst.length === 1
          ? proSubst[0]!
          : `${proSubst.length} itens`

  const showHomeBlocks =
    viewState === 'home' || viewState === 'transitioning-to-wizard'

  const radarStyle = getElementStyle(viewState, entryPhase, 'radar', reducedMotion)
  const ctaStyle = getElementStyle(viewState, entryPhase, 'cta', reducedMotion)
  const containersStyle = getElementStyle(viewState, entryPhase, 'containers', reducedMotion)
  const footerStyle = getElementStyle(viewState, entryPhase, 'footer', reducedMotion)

  const wizardEntryStyle: CSSProperties = reducedMotion
    ? {}
    : {
        opacity: wizardEntryVisible ? 1 : 0,
        transform: wizardEntryVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
      }

  const wizardPanelExitStyle: CSSProperties =
    viewState === 'transitioning-to-home' && homeLeaveSource === 'wizard'
      ? {
          opacity: 0,
          transform: 'translateY(20px)',
          transition: 'opacity 300ms ease-in, transform 300ms ease-in',
        }
      : {}

  const resultadosExitStyle: CSSProperties =
    (viewState === 'transitioning-to-home' && homeLeaveSource === 'resultados') ||
    viewState === 'transitioning-resultados-to-wizard'
      ? {
          opacity: 0,
          transform: 'translateY(20px)',
          transition: 'opacity 300ms ease-in, transform 300ms ease-in',
        }
      : {}

  const headerVisible =
    viewState === 'home' ||
    viewState === 'transitioning-to-wizard' ||
    viewState === 'transitioning-to-home'

  const headerStyle: CSSProperties = reducedMotion
    ? {
        opacity: headerVisible ? 1 : 0,
        height: headerVisible ? 'auto' : 0,
        overflow: 'hidden',
        pointerEvents: headerVisible ? 'auto' : 'none',
      }
    : {
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(-20px)',
        maxHeight: headerVisible ? 200 : 0,
        marginBottom: 0,
        overflow: 'hidden',
        transition: 'opacity 300ms ease, transform 300ms ease, max-height 300ms ease',
        pointerEvents: headerVisible ? 'auto' : 'none',
      }

  const showWizardPanel =
    viewState === 'wizard' ||
    (viewState === 'transitioning-to-home' && homeLeaveSource === 'wizard')

  const showLoadingResults =
    viewState === 'resultados' ||
    (viewState === 'transitioning-to-home' && homeLeaveSource === 'resultados') ||
    viewState === 'transitioning-resultados-to-wizard'

  return (
    <div
      className="terrae-intel-dashboard-scroll box-border flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      style={{
        backgroundColor: '#0D0D0C',
        padding: '24px 0 24px 24px',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <header
        style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
          paddingRight: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #2C2C2A',
          backgroundColor: 'rgba(13, 13, 12, 0.5)',
          backdropFilter: 'blur(34px)',
          WebkitBackdropFilter: 'blur(34px)',
          ...headerStyle,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 500,
            color: '#F1EFE8',
          }}
        >
          Radar
        </h1>
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: 16,
            color: '#888780',
          }}
        >
          Monitoramento regulatório e prospecção de oportunidades do setor mineral
        </p>
      </header>

      {showHomeBlocks ? (
        <div
          style={{
            position: 'relative',
            zIndex: 0,
            flex: '0 0 auto',
            minWidth: 0,
            width: '100%',
            paddingRight: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          {/* Altura fixa (viewport): não estica com o bloco de alertas — evita “salto” do arco/SVG */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: '100vh',
              maxHeight: '100vh',
              zIndex: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              ...radarStyle,
            }}
            aria-hidden
          >
            <RadarBackgroundAnimation />
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'center',
              minHeight: '50vh',
              width: '100%',
              padding: 40,
              paddingTop: '15vh',
              boxSizing: 'border-box',
              ...ctaStyle,
            }}
          >
            <h2
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: '#F1EFE8',
                margin: 0,
              }}
            >
              Prospecção de Oportunidades
            </h2>
            <p
              style={{
                fontSize: 15,
                color: '#888780',
                maxWidth: 480,
                marginTop: 12,
                lineHeight: 1.6,
              }}
            >
              Cruzamos dados de 20+ fontes públicas para identificar as melhores oportunidades do
              setor mineral brasileiro.
            </p>
            <button
              type="button"
              onClick={handleIniciarProspeccao}
              style={{
                marginTop: 32,
                backgroundColor: '#EF9F27',
                color: '#0D0D0C',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                padding: '12px 32px',
                border: 'none',
                cursor: 'pointer',
                transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)'
                e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              Iniciar Prospecção
            </button>
          </div>

          <div style={containersStyle}>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                flex: '0 0 auto',
                minHeight: '50vh',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <RadarAlertasSubtab reducedMotion={reducedMotion} onToast={showToast} />
            </div>
          </div>

          <footer
            style={{
              ...footerStyle,
              position: 'static',
              marginTop: 48,
              paddingTop: 16,
              borderTop: '1px solid #2C2C2A',
              textAlign: 'center',
              fontSize: 11,
              color: '#5F5E5A',
              flexShrink: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo · Atualizado em{' '}
            {new Date().toLocaleDateString('pt-BR')}
          </footer>
        </div>
      ) : null}

      {showWizardPanel ? (
        <>
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              paddingRight: 24,
              display: 'flex',
              flexDirection: 'column',
              ...(viewState === 'transitioning-to-home' && homeLeaveSource === 'wizard'
                ? wizardPanelExitStyle
                : wizardEntryStyle),
            }}
          >
            <ProspeccaoWizard
              key={`wizard-${wizardEntryStep}`}
              reducedMotion={reducedMotion}
              prospeccaoSubstOpcoes={prospeccaoSubstOpcoes}
              proPrefixSub={proPrefixSub}
              proObjetivo={proObjetivo}
              setProObjetivo={setProObjetivo}
              proSubst={proSubst}
              setProSubst={setProSubst}
              proRisco={proRisco}
              setProRisco={setProRisco}
              proUfs={proUfs}
              setProUfs={setProUfs}
              proDdSub={proDdSub}
              setProDdSub={setProDdSub}
              onCancel={handleCancelWizard}
              onAnalisar={handleAnalisar}
              exiting={false}
              initialStep={wizardEntryStep}
            />
            {loadingOverlayVisible ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  backgroundColor: 'rgba(13, 13, 12, 0.72)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loadOverlayOut ? 0 : 1,
                  transition: reducedMotion ? undefined : 'opacity 300ms ease-in',
                }}
              >
                <div style={{ marginBottom: 18 }}>
                  <TerraeLogoLoading size={40} speed={1} />
                </div>
                <p
                  key={loadMsgIdx}
                  style={{
                    fontSize: 18,
                    fontWeight: 400,
                    color: '#B4B2A9',
                    textAlign: 'center',
                    margin: 0,
                    paddingLeft: 16,
                    paddingRight: 16,
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                    overflowX: 'auto',
                    animation: reducedMotion ? undefined : 'terraeRadarFadeMsg 200ms ease-out',
                  }}
                >
                  {loadingMsgs[loadMsgIdx]}
                </p>
                <div
                  style={{
                    marginTop: 20,
                    width: 240,
                    height: 3,
                    backgroundColor: '#2C2C2A',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${loadProgress}%`,
                      backgroundColor: '#EF9F27',
                      borderRadius: 2,
                      transition: reducedMotion ? undefined : 'width 50ms linear',
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {showLoadingResults ? (
        <>
          {(viewState === 'resultados' ||
            (viewState === 'transitioning-to-home' && homeLeaveSource === 'resultados') ||
            viewState === 'transitioning-resultados-to-wizard') && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  paddingRight: 24,
                  paddingTop: 24,
                  ...resultadosExitStyle,
                }}
              >
                <ProspeccaoResultados
                  resultados={resultados}
                  excluidosCount={excluidosCount}
                  resultadosDescartados={resultadosDescartados}
                  processoById={processoById}
                  proRisco={proRisco}
                  proSubst={proSubst}
                  proUfs={proUfs}
                  selectedResultId={selectedResultId}
                  setSelectedResultId={setSelectedResultId}
                  cardVis={cardVis}
                  barsReady={barsReady}
                  reducedMotion={reducedMotion}
                  navigateProcessoMapa={navigateProcessoMapa}
                  handleRefinarBusca={handleRefinarBusca}
                  handleVoltarAoRadar={handleVoltarAoRadar}
                  showToast={showToast}
                />
              </div>

              {viewState === 'resultados' && resultados.length > 0 ? (
                <footer
                  style={{
                    ...footerStyle,
                    flexShrink: 0,
                    marginTop: 'auto',
                    paddingTop: 16,
                    paddingBottom: 8,
                    paddingRight: 24,
                    borderTop: '1px solid #2C2C2A',
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#5F5E5A',
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#0D0D0C',
                  }}
                >
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: '#5F5E5A',
                      textAlign: 'center',
                      lineHeight: 1.5,
                      marginBottom: 0,
                    }}
                  >
                    Análise baseada em dados públicos (ANM, STN, USGS, FUNAI, ICMBio). Não constitui recomendação de
                    investimento. Consulte especialistas antes de tomar decisões.
                  </p>
                </footer>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {toastMsg ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: '#2C2C2A',
            border: '1px solid #5F5E5A',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 13,
            color: '#F1EFE8',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  )
}
```


### src\components\dashboard\ProspeccaoResultados.tsx (1679 linhas)

```typescript
import { ArrowLeft, ChevronRight, Info, SearchX } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { Processo } from '../../types'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
} from '../../lib/motionDurations'
import {
  buildDescricoesBarras,
  computeDimScoresFromCard,
  corBolinhaAtencao,
  flattenVariaveis,
  gerarFatoresDestacados,
  scoreTotalFromDimScores,
  type VariavelPontuacao,
} from '../../lib/opportunityCardCopy'
import { resolveOpportunityCardVariaveis } from '../../lib/opportunityCardMockData'
import {
  CORES_DIMENSAO,
  PESOS_PERFIL,
  corFaixaOpportunity,
  corMiniBarraValor,
  faixaFromScore,
  qualificadorTextoMiniBarra,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { GridBreathingResultadosAnimation } from './animations/GridBreathingResultadosAnimation'

const TODAS_SUBST = '__TODAS__'

/** Borda 1px — dourado mais suave que o accent pleno (#EF9F27) */
const OPPORTUNITY_CARD_SELECTED_BORDER = 'rgba(239, 159, 39, 0.38)'
const OPPORTUNITY_CARD_SELECTED_SHADOW = '0 0 12px rgba(239, 159, 39, 0.05)'

const pillUnified: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 14px',
  borderRadius: 20,
  fontSize: 14,
  fontWeight: 500,
  backgroundColor: '#1A1A18',
  color: '#B4B2A9',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2C2C2A',
}

function perfilDotColor(proRisco: PerfilRisco): string {
  if (proRisco === 'conservador') return '#1D9E75'
  if (proRisco === 'moderado') return '#E8A830'
  return '#E24B4A'
}

function titleCaseSubst(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/** Cor do texto da posição no ranking (#1 ouro, #2 prata, #3 bronze, demais neutro). */
function corRanking(posicao: number): string {
  if (posicao === 1) return '#EF9F27'
  if (posicao === 2) return '#B4B2A9'
  if (posicao === 3) return '#C07840'
  return '#5F5E5A'
}

function faixaLabelCurto(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return 'Alta'
  if (faixa === 'moderada') return 'Moderada'
  if (faixa === 'baixa') return 'Baixa'
  return 'Não recomendado'
}

/** Fontes exibidas no `title` de cada variável do drilldown */
const FONTES_DRILLDOWN: Record<string, string> = {
  'Relevância da substância': 'Fonte: USGS Mineral Commodity Summaries',
  'Gap reserva/produção': 'Fonte: ANM/SIGMINE',
  'Preço USD/t': 'Fonte: Trading Economics, USGS',
  'Tendência de demanda': 'Fonte: USGS, relatórios setoriais',
  'Valor estimado da reserva': 'Fonte: ANM/SIGMINE, Trading Economics',
  'CAPAG do município': 'Fonte: STN/SICONFI',
  'CAPAG município': 'Fonte: STN/SICONFI',
  'Fase do processo': 'Fonte: ANM/SIGMINE',
  'Infraestrutura logística': 'Fonte: DNIT, ANTT, ANTAQ',
  'Área do processo': 'Fonte: ANM/SIGMINE',
  'Autonomia fiscal': 'Fonte: STN/SICONFI',
  'Situação do processo': 'Fonte: ANM/SIGMINE',
  'Incentivos regionais': 'Fonte: BNDES, Sudene, Sudam',
  'Solidez geral': 'Fonte: Cálculo TERRADAR (média ponderada dos riscos)',
  'Conformidade ambiental': 'Fonte: ICMBio, IBAMA, CAR/SICAR',
  'Regularidade regulatória': 'Fonte: ANM/SIGMINE, Adoo',
  'Histórico de despachos': 'Fonte: ANM/SIGMINE',
  'Ausência de restrições': 'Fonte: Adoo (Diários Oficiais)',
  'Alertas favoráveis': 'Fonte: Adoo (Diários Oficiais)',
}

function perfilNomeTitulo(p: PerfilRisco | null): string {
  if (p === 'conservador') return 'Conservador'
  if (p === 'arrojado') return 'Arrojado'
  return 'Moderado'
}

function PesoBarDrilldown({
  pesos,
  heightPx,
}: {
  pesos: { a: number; b: number; c: number }
  heightPx: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        height: heightPx,
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div style={{ flex: pesos.a, minWidth: 0, backgroundColor: CORES_DIMENSAO.atratividade }} />
      <div style={{ flex: pesos.b, minWidth: 0, backgroundColor: CORES_DIMENSAO.viabilidade }} />
      <div style={{ flex: pesos.c, minWidth: 0, backgroundColor: CORES_DIMENSAO.seguranca }} />
    </div>
  )
}

const PERFIS_TOOLTIP_ORDER: PerfilRisco[] = ['conservador', 'moderado', 'arrojado']

function PerfilTooltipArrow({ pointsDown }: { pointsDown: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        lineHeight: 0,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {pointsDown ? (
        <svg width="8" height="4" viewBox="0 0 8 4">
          <polygon points="0,0 8,0 4,4" fill="#1A1A18" stroke="#3C3C3A" strokeWidth="0.75" />
        </svg>
      ) : (
        <svg width="8" height="4" viewBox="0 0 8 4">
          <polygon points="0,4 8,4 4,0" fill="#1A1A18" stroke="#3C3C3A" strokeWidth="0.75" />
        </svg>
      )}
    </div>
  )
}

function PerfilPesosTooltipPanel({ perfilAtivo }: { perfilAtivo: PerfilRisco }) {
  return (
    <div
      style={{
        background: '#1A1A18',
        border: '1px solid #3C3C3A',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {PERFIS_TOOLTIP_ORDER.map((p, idx) => {
        const pesos = PESOS_PERFIL[p]
        const pa = Math.round(pesos.a * 100)
        const pv = Math.round(pesos.b * 100)
        const ps = Math.round(pesos.c * 100)
        const nome = perfilNomeTitulo(p)
        return (
          <div key={p} style={{ marginBottom: idx < PERFIS_TOOLTIP_ORDER.length - 1 ? 10 : 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#D3D1C7' }}>
              {nome}
              {perfilAtivo === p ? (
                <span style={{ fontWeight: 400, color: '#888780', fontSize: 14 }}> (atual)</span>
              ) : null}
            </div>
            <div style={{ marginTop: 4 }}>
              <PesoBarDrilldown pesos={pesos} heightPx={4} />
            </div>
            <div style={{ fontSize: 13, color: '#888780', marginTop: 4 }}>
              A {pa}% · V {pv}% · S {ps}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function motionGroupStyle(visible: boolean, reduced: boolean): CSSProperties {
  if (reduced) return { opacity: 1, transform: 'translateY(0)' }
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${MOTION_GROUP_TRANSLATE_PX}px)`,
    transition: `opacity ${MOTION_GROUP_FADE_MS}ms ease-out, transform ${MOTION_GROUP_FADE_MS}ms ease-out`,
  }
}

function barFillStyle(
  pct: number,
  widthActive: boolean,
  barIndex: number,
  reduced: boolean,
  backgroundColor: string,
): CSSProperties {
  if (reduced) {
    return {
      width: `${pct}%`,
      height: '100%',
      backgroundColor,
      borderRadius: 3,
    }
  }
  return {
    width: widthActive ? `${pct}%` : '0%',
    height: '100%',
    backgroundColor,
    borderRadius: 3,
    transition: `width ${MOTION_BAR_WIDTH_MS}ms ease-out ${barIndex * MOTION_BAR_STAGGER_MS}ms`,
  }
}

export function ProspeccaoResultados({
  resultados,
  excluidosCount,
  resultadosDescartados,
  processoById,
  proRisco,
  proSubst,
  proUfs,
  selectedResultId,
  setSelectedResultId,
  cardVis,
  barsReady,
  reducedMotion,
  navigateProcessoMapa,
  handleRefinarBusca,
  handleVoltarAoRadar,
  showToast,
}: {
  resultados: OpportunityResult[]
  excluidosCount: number
  resultadosDescartados: OpportunityResult[]
  processoById: Map<string, Processo>
  proRisco: PerfilRisco | null
  proSubst: string[]
  proUfs: string[]
  selectedResultId: string | null
  setSelectedResultId: (id: string | null) => void
  cardVis: boolean[]
  barsReady: boolean
  reducedMotion: boolean
  navigateProcessoMapa: (id: string) => void
  handleRefinarBusca: () => void
  handleVoltarAoRadar: () => void
  showToast: (m: string) => void
}) {
  const cardsGridRef = useRef<HTMLDivElement>(null)
  const [drilldownOpen, setDrilldownOpen] = useState<string | null>(null)
  const drilldownOpenRef = useRef<string | null>(null)
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)
  const [showDescartados, setShowDescartados] = useState(false)
  const [perfilPesosInfoHover, setPerfilPesosInfoHover] = useState(false)
  const perfilInfoBtnRef = useRef<HTMLButtonElement | null>(null)
  const perfilTooltipFloatingRef = useRef<HTMLDivElement | null>(null)
  const perfilHoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [perfilInfoTooltipBelow, setPerfilInfoTooltipBelow] = useState(false)
  const [perfilTooltipPos, setPerfilTooltipPos] = useState<{ top: number; left: number } | null>(
    null,
  )

  const clearPerfilHoverLeaveTimer = useCallback(() => {
    if (perfilHoverLeaveTimerRef.current != null) {
      clearTimeout(perfilHoverLeaveTimerRef.current)
      perfilHoverLeaveTimerRef.current = null
    }
  }, [])

  const openPerfilPesosInfo = useCallback(() => {
    clearPerfilHoverLeaveTimer()
    setPerfilPesosInfoHover(true)
  }, [clearPerfilHoverLeaveTimer])

  const scheduleClosePerfilPesosInfo = useCallback(() => {
    clearPerfilHoverLeaveTimer()
    perfilHoverLeaveTimerRef.current = window.setTimeout(() => {
      perfilHoverLeaveTimerRef.current = null
      setPerfilPesosInfoHover(false)
    }, 120)
  }, [clearPerfilHoverLeaveTimer])

  /** Flip drilldown: fade-out → swap → fade-in (um card por vez) */
  const [flipActiveId, setFlipActiveId] = useState<string | null>(null)
  const [flipOpaque, setFlipOpaque] = useState(true)
  const flipTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    drilldownOpenRef.current = drilldownOpen
  }, [drilldownOpen])

  useEffect(() => {
    return () => {
      for (const id of flipTimersRef.current) clearTimeout(id)
      flipTimersRef.current = []
    }
  }, [])

  const beginFlipOpen = useCallback(
    (processoId: string) => {
      if (reducedMotion) {
        setDrilldownOpen(processoId)
        return
      }
      const prev = drilldownOpenRef.current
      if (prev != null && prev !== processoId) {
        setDrilldownOpen(processoId)
        return
      }
      setFlipActiveId(processoId)
      setFlipOpaque(false)
      const t1 = window.setTimeout(() => {
        setDrilldownOpen(processoId)
        setFlipOpaque(true)
        const t2 = window.setTimeout(() => setFlipActiveId(null), 220)
        flipTimersRef.current.push(t2)
      }, 150)
      flipTimersRef.current.push(t1)
    },
    [reducedMotion],
  )

  const beginFlipClose = useCallback(() => {
    if (reducedMotion) {
      setDrilldownOpen(null)
      return
    }
    const id = drilldownOpenRef.current
    if (!id) return
    setFlipActiveId(id)
    setFlipOpaque(false)
    const t1 = window.setTimeout(() => {
      setDrilldownOpen(null)
      setFlipOpaque(true)
      const t2 = window.setTimeout(() => setFlipActiveId(null), 220)
      flipTimersRef.current.push(t2)
    }, 150)
    flipTimersRef.current.push(t1)
  }, [reducedMotion])

  useEffect(() => {
    if (selectedResultId != null) return
    for (const id of flipTimersRef.current) clearTimeout(id)
    flipTimersRef.current = []
    setDrilldownOpen(null)
    setFlipActiveId(null)
    setFlipOpaque(true)
  }, [selectedResultId])

  useEffect(() => {
    if (drilldownOpen == null) setExpandedDimension(null)
  }, [drilldownOpen])

  useEffect(() => {
    if (drilldownOpen == null) {
      clearPerfilHoverLeaveTimer()
      setPerfilPesosInfoHover(false)
    }
  }, [drilldownOpen, clearPerfilHoverLeaveTimer])

  useEffect(() => {
    return () => clearPerfilHoverLeaveTimer()
  }, [clearPerfilHoverLeaveTimer])

  useLayoutEffect(() => {
    if (!perfilPesosInfoHover) {
      setPerfilTooltipPos(null)
      return
    }

    let cancelled = false
    let cleanupAuto: (() => void) | undefined
    let rafId = 0
    let attempts = 0
    const maxAttempts = 40

    const runPosition = (btn: HTMLElement, float: HTMLElement) => {
      computePosition(btn, float, {
        strategy: 'fixed',
        placement: 'top',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement }) => {
        if (cancelled) return
        setPerfilTooltipPos({ top: y, left: x })
        setPerfilInfoTooltipBelow(placement.startsWith('bottom'))
      })
    }

    const setup = () => {
      if (cancelled) return
      const btn = perfilInfoBtnRef.current
      const float = perfilTooltipFloatingRef.current
      const rect = btn?.getBoundingClientRect()
      const validBtn =
        btn &&
        rect &&
        rect.width >= 1 &&
        rect.height >= 1 &&
        Number.isFinite(rect.left) &&
        Number.isFinite(rect.top)

      if (!validBtn || !float) {
        if (attempts++ < maxAttempts) {
          rafId = requestAnimationFrame(setup)
        }
        return
      }

      const update = () => {
        if (cancelled) return
        runPosition(btn, float)
      }

      cleanupAuto = autoUpdate(btn, float, update)
      update()
    }

    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      cleanupAuto?.()
    }
  }, [perfilPesosInfoHover, drilldownOpen, flipOpaque, flipActiveId])

  useEffect(() => {
    if (selectedResultId == null) return
    const handlePointerDown = (e: PointerEvent) => {
      const root = cardsGridRef.current
      if (!root || root.contains(e.target as Node)) return
      setSelectedResultId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedResultId, setSelectedResultId])

  const perfilForDrill = proRisco ?? 'moderado'
  const pesosDrill = PESOS_PERFIL[perfilForDrill]
  const pesoA = Math.round(pesosDrill.a * 100)
  const pesoV = Math.round(pesosDrill.b * 100)
  const pesoS = Math.round(pesosDrill.c * 100)

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#0D0D0C',
        minHeight: '100%',
        /* Evita que o padrão absoluto “esticado” com o conteúdo; altura fixa em viewport (cf. radar home). */
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100vh',
          maxHeight: '100dvh',
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden
      >
        <GridBreathingResultadosAnimation />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 52 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={handleRefinarBusca}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888780',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F1EFE8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888780'
                }}
                title="Refinar busca no assistente"
              >
                <ArrowLeft size={20} />
              </button>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 500,
                  color: '#F1EFE8',
                }}
              >
                {resultados.length} oportunidades identificadas
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleVoltarAoRadar}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#888780',
                  fontSize: 14,
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F1EFE8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888780'
                }}
              >
                Voltar ao Radar
              </button>
              <button
                type="button"
                onClick={() => showToast('Disponível em breve')}
                style={{
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#EF9F27',
                  color: '#EF9F27',
                  fontSize: 14,
                  borderRadius: 8,
                  padding: '8px 20px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 159, 39, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                Salvar prospecção
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              marginLeft: 40,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {proRisco ? (
              <span style={pillUnified}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: perfilDotColor(proRisco),
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                {proRisco.charAt(0).toUpperCase() + proRisco.slice(1)}
              </span>
            ) : null}

            {proSubst.includes(TODAS_SUBST) ? (
              <span style={pillUnified}>Todas</span>
            ) : (
              proSubst.map((s) => (
                <span key={s} style={pillUnified}>
                  {titleCaseSubst(s)}
                </span>
              ))
            )}

            {proUfs.length > 0 ? (
              proUfs.map((uf) => (
                <span key={uf} style={pillUnified}>
                  {uf}
                </span>
              ))
            ) : (
              <span style={pillUnified}>Brasil</span>
            )}
          </div>
        </div>

        {resultados.length === 0 ? (
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: '60vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                maxWidth: 420,
              }}
            >
              <SearchX size={40} color="#5F5E5A" style={{ marginBottom: 16 }} aria-hidden />
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#D3D1C7',
                }}
              >
                Nenhuma oportunidade identificada
              </h3>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: '#888780',
                  lineHeight: 1.5,
                }}
              >
                Nenhum processo atende aos critérios mínimos de score para o perfil selecionado. Tente ampliar as
                substâncias ou a região.
              </p>
              <button
                type="button"
                onClick={handleRefinarBusca}
                style={{
                  marginTop: 24,
                  backgroundColor: '#EF9F27',
                  color: '#0D0D0C',
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '10px 28px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)'
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Refinar busca
              </button>
              {excluidosCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowDescartados(!showDescartados)}
                  style={{
                    marginTop: 12,
                    border: 'none',
                    background: 'none',
                    fontSize: 13,
                    color: '#888780',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  {showDescartados ? 'Ocultar' : 'Ver'} processos analisados ({excluidosCount})
                </button>
              ) : null}
            </div>

            {showDescartados && resultadosDescartados.length > 0 ? (
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  marginTop: 32,
                  width: '100%',
                  maxWidth: 800,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: '#888780',
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  Processos analisados (abaixo do score mínimo)
                </div>
                <div
                  style={{
                    backgroundColor: 'rgba(26, 26, 24, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#2C2C2A',
                    overflow: 'hidden',
                  }}
                >
                  {resultadosDescartados.map((row, i) => {
                    const p = processoById.get(row.processoId)
                    if (!p) return null
                    return (
                      <div
                        key={row.processoId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          borderTop: i > 0 ? '1px solid #2C2C2A' : 'none',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ color: '#5F5E5A', fontWeight: 600, width: 32 }}>{row.scoreTotal}</span>
                          <span style={{ color: '#D3D1C7' }}>{p.numero}</span>
                          <span style={{ color: '#888780' }}>{p.substancia}</span>
                          <span style={{ color: '#5F5E5A' }}>{p.uf}</span>
                        </div>
                        <span style={{ color: '#5F5E5A', fontSize: 12 }}>Abaixo do mínimo</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            ref={cardsGridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {resultados.map((r, i) => {
              const p = processoById.get(r.processoId)
              if (!p) return null
              const { card: cardVar, fonte: cardFonte } = resolveOpportunityCardVariaveis(p, r)
              const dimFromCard = computeDimScoresFromCard(cardVar)
              const dimScoresBarras =
                cardFonte === 'manual'
                  ? dimFromCard
                  : {
                      a: r.scoreAtratividade,
                      v: r.scoreViabilidade,
                      s: r.scoreSeguranca,
                    }
              const descricoesBarras = buildDescricoesBarras(cardVar, dimScoresBarras)
              const scoreBarA = dimScoresBarras.a
              const scoreBarV = dimScoresBarras.v
              const scoreBarS = dimScoresBarras.s
              const scoreTotalDisplay =
                cardFonte === 'manual'
                  ? scoreTotalFromDimScores(dimFromCard, proRisco ?? 'moderado')
                  : r.scoreTotal
              const faixaDisplay =
                cardFonte === 'manual' ? faixaFromScore(scoreTotalDisplay) : r.faixa
              const fatoresCard = gerarFatoresDestacados(
                flattenVariaveis(cardVar),
                descricoesBarras,
              )
              const drillDims = [
                {
                  label: 'Atratividade',
                  v: scoreBarA,
                  peso: pesoA,
                  variaveis: cardVar.atratividade,
                },
                {
                  label: 'Viabilidade',
                  v: scoreBarV,
                  peso: pesoV,
                  variaveis: cardVar.viabilidade,
                },
                {
                  label: 'Segurança',
                  v: scoreBarS,
                  peso: pesoS,
                  variaveis: cardVar.seguranca,
                },
              ]
              const corFaixa = corFaixaOpportunity(faixaDisplay)
              const isSelected = selectedResultId === r.processoId
              const corSub = corSubstanciaOuUndefined(p.substancia) ?? '#888780'

              const applyCardSurfaceAfterToggle = (
                el: HTMLDivElement,
                nextSelected: boolean,
                fromMouseClick: boolean,
              ) => {
                if (nextSelected) {
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = OPPORTUNITY_CARD_SELECTED_BORDER
                  el.style.boxShadow = OPPORTUNITY_CARD_SELECTED_SHADOW
                } else if (fromMouseClick) {
                  el.style.borderColor = '#5F5E5A'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
                } else {
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = '#2C2C2A'
                  el.style.boxShadow = 'none'
                }
              }

              const handleCardClick = (e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
                const nextSelected = !isSelected
                applyCardSurfaceAfterToggle(e.currentTarget, nextSelected, e.type === 'click')
                if (isSelected) {
                  setSelectedResultId(null)
                  setDrilldownOpen(null)
                } else {
                  setSelectedResultId(r.processoId)
                  setDrilldownOpen(null)
                }
              }

              const handleScoreZoneClick = (e: MouseEvent<HTMLDivElement>) => {
                e.stopPropagation()
                setSelectedResultId(r.processoId)
                if (drilldownOpenRef.current === r.processoId) {
                  beginFlipClose()
                } else {
                  beginFlipOpen(r.processoId)
                }
              }

              const handleScoreZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedResultId(r.processoId)
                  if (drilldownOpenRef.current === r.processoId) {
                    beginFlipClose()
                  } else {
                    beginFlipOpen(r.processoId)
                  }
                }
              }

              return (
                <div
                  key={r.processoId}
                  role="button"
                  tabIndex={0}
                  onClick={handleCardClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardClick(e)
                    }
                  }}
                  style={{
                    ...motionGroupStyle(cardVis[i] ?? true, reducedMotion),
                    backgroundColor: 'rgba(26, 26, 24, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: isSelected ? OPPORTUNITY_CARD_SELECTED_BORDER : '#2C2C2A',
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: isSelected ? OPPORTUNITY_CARD_SELECTED_SHADOW : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#5F5E5A'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.transform = 'translateY(0)'
                    if (isSelected) {
                      el.style.borderColor = OPPORTUNITY_CARD_SELECTED_BORDER
                      el.style.boxShadow = OPPORTUNITY_CARD_SELECTED_SHADOW
                    } else {
                      el.style.borderColor = '#2C2C2A'
                      el.style.boxShadow = 'none'
                    }
                  }}
                >
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${corFaixa}25 0%, ${corFaixa}0A 100%)`,
                      padding: '16px 20px',
                      borderRadius: '12px 12px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        letterSpacing: -0.5,
                        color: corRanking(i + 1),
                        lineHeight: 1,
                      }}
                    >
                      #{i + 1}
                    </span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleScoreZoneClick}
                      onKeyDown={handleScoreZoneKeyDown}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: '50%',
                          backgroundColor: `${corFaixa}20`,
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderColor: corFaixa,
                          boxShadow: `0 0 16px ${corFaixa}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 21, fontWeight: 700, color: '#F1EFE8' }}>
                          {scoreTotalDisplay}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: corFaixa,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {faixaLabelCurto(faixaDisplay)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      ...(reducedMotion
                        ? {}
                        : {
                            opacity:
                              flipActiveId === r.processoId ? (flipOpaque ? 1 : 0) : 1,
                            transition:
                              flipActiveId === r.processoId
                                ? 'opacity 150ms ease-in-out'
                                : undefined,
                          }),
                      pointerEvents:
                        !reducedMotion &&
                        flipActiveId === r.processoId &&
                        !flipOpaque
                          ? 'none'
                          : 'auto',
                    }}
                  >
                  {drilldownOpen !== r.processoId ? (
                    <div style={{ padding: '16px 20px 20px 20px', backgroundColor: '#1A1A18' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 17, fontWeight: 500, color: '#F1EFE8' }}>{p.numero}</span>
                        <span
                          style={{
                            padding: '2px 10px',
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 500,
                            backgroundColor: `${corSub}15`,
                            color: corSub,
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: `${corSub}30`,
                          }}
                        >
                          {titleCaseSubst(p.substancia)}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 15, color: '#B4B2A9' }}>{p.titular}</div>
                      <div style={{ marginTop: 2, fontSize: 15, color: '#8A8880' }}>
                        {p.municipio}, {p.uf} · {p.area_ha?.toLocaleString('pt-BR') ?? '–'} ha
                      </div>

                      <div style={{ height: 1, backgroundColor: '#2C2C2A', marginTop: 14, marginBottom: 14 }} />

                      {[
                        {
                          label: 'Atratividade',
                          v: scoreBarA,
                          tooltip: descricoesBarras[0],
                        },
                        {
                          label: 'Viabilidade',
                          v: scoreBarV,
                          tooltip: descricoesBarras[1],
                        },
                        {
                          label: 'Segurança',
                          v: scoreBarS,
                          tooltip: descricoesBarras[2],
                        },
                      ].map((b, bi) => {
                        const c = corMiniBarraValor(b.v)
                        return (
                          <div
                            key={b.label}
                            style={{ marginBottom: bi < 2 ? 14 : 0 }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: '#888780',
                                  width: 104,
                                  flexShrink: 0,
                                }}
                              >
                                {b.label}
                              </span>
                              <div
                                style={{
                                  flex: 1,
                                  height: 5,
                                  backgroundColor: '#2C2C2A',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                  minWidth: 30,
                                }}
                              >
                                <div style={barFillStyle(b.v, barsReady, bi, reducedMotion, c)} />
                              </div>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: c,
                                  marginLeft: 6,
                                  minWidth: 44,
                                  flexShrink: 0,
                                  textAlign: 'right',
                                }}
                              >
                                {b.v}
                              </span>
                            </div>
                            <div
                              style={{
                                marginLeft: 104,
                                marginTop: 2,
                                fontSize: 15,
                                color: '#8A8880',
                                lineHeight: 1.45,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                              }}
                              title={b.tooltip}
                            >
                              {b.tooltip}
                            </div>
                          </div>
                        )
                      })}

                      <div style={{ height: 1, backgroundColor: '#2C2C2A', marginTop: 14, marginBottom: 14 }} />

                      <div style={{ fontSize: 14, color: '#B4B2A9', lineHeight: 1.45 }}>
                        {fatoresCard.map((f, fi) => (
                          <div
                            key={`fc${fi}`}
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'flex-start',
                              marginTop: fi > 0 ? 4 : 0,
                            }}
                          >
                            {f.tipo === 'positivo' ? (
                              <span style={{ color: '#1D9E75', flexShrink: 0, fontSize: 14 }}>✓</span>
                            ) : (
                              <span
                                style={{
                                  color: corBolinhaAtencao(f.variavel.valor),
                                  flexShrink: 0,
                                  fontSize: 14,
                                }}
                              >
                                ●
                              </span>
                            )}
                            <span>
                              {f.variavel.texto} ({f.variavel.fonte})
                            </span>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          maxHeight:
                            isSelected && drilldownOpen !== r.processoId ? 120 : 0,
                          opacity:
                            isSelected && drilldownOpen !== r.processoId ? 1 : 0,
                          overflow: 'hidden',
                          marginTop: isSelected && drilldownOpen !== r.processoId ? 14 : 0,
                          paddingTop: isSelected && drilldownOpen !== r.processoId ? 14 : 0,
                          borderTopWidth: 1,
                          borderTopStyle: 'solid',
                          borderTopColor:
                            isSelected && drilldownOpen !== r.processoId
                              ? '#2C2C2A'
                              : 'transparent',
                          display: 'flex',
                          gap: 10,
                          transition: reducedMotion
                            ? undefined
                            : 'max-height 250ms ease-out, opacity 200ms ease-out, margin-top 250ms ease-out, padding-top 250ms ease-out, border-color 200ms ease-out',
                        }}
                      >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigateProcessoMapa(p.id)
                            }}
                            style={{
                              backgroundColor: '#EF9F27',
                              color: '#0D0D0C',
                              fontSize: 16,
                              fontWeight: 600,
                              borderRadius: 6,
                              padding: '7px 14px',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = 'brightness(1.1)'
                              e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = 'none'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            Ver no Mapa
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              beginFlipOpen(r.processoId)
                            }}
                            style={{
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: '#5F5E5A',
                              color: '#B4B2A9',
                              fontSize: 16,
                              fontWeight: 500,
                              borderRadius: 6,
                              padding: '7px 14px',
                              background: 'transparent',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s ease, color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#888780'
                              e.currentTarget.style.color = '#F1EFE8'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#5F5E5A'
                              e.currentTarget.style.color = '#B4B2A9'
                            }}
                          >
                            Ver cálculo
                          </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{
                        padding: '16px 20px 20px 20px',
                        backgroundColor: '#1A1A18',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#D3D1C7', marginBottom: 8 }}>
                        Decomposição da Pontuação
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 12,
                          }}
                        >
                          <span style={{ fontSize: 15, fontWeight: 500, color: '#B4B2A9' }}>
                            Perfil {perfilNomeTitulo(proRisco)}
                          </span>
                          <div
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                            onMouseEnter={openPerfilPesosInfo}
                            onMouseLeave={scheduleClosePerfilPesosInfo}
                          >
                            <button
                              ref={perfilInfoBtnRef}
                              type="button"
                              aria-label="Informação sobre pesos por perfil"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <Info size={15} color="#5F5E5A" aria-hidden />
                            </button>
                          </div>
                        </div>
                        <PesoBarDrilldown pesos={pesosDrill} heightPx={6} />
                        <div
                          style={{
                            display: 'flex',
                            gap: 2,
                            marginTop: 6,
                            marginBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              flex: pesosDrill.a,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 400,
                              color: '#888780',
                              textAlign: 'center',
                            }}
                          >
                            Atratividade {pesoA}%
                          </div>
                          <div
                            style={{
                              flex: pesosDrill.b,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 400,
                              color: '#888780',
                              textAlign: 'center',
                            }}
                          >
                            Viabilidade {pesoV}%
                          </div>
                          <div
                            style={{
                              flex: pesosDrill.c,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 400,
                              color: '#888780',
                              textAlign: 'center',
                            }}
                          >
                            Segurança {pesoS}%
                          </div>
                        </div>
                      </div>
                      {drillDims.map((dim, di) => {
                        const c = corMiniBarraValor(dim.v)
                        const isExpanded = expandedDimension === dim.label
                        return (
                          <div
                            key={dim.label}
                            style={{ marginBottom: di === 2 ? 40 : di < 2 ? 14 : 0 }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedDimension(isExpanded ? null : dim.label)
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'none',
                                border: 'none',
                                padding: '6px 0',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <ChevronRight
                                  size={14}
                                  color="#5F5E5A"
                                  style={{
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease',
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#888780',
                                    textAlign: 'left',
                                  }}
                                >
                                  {dim.label} ({dim.peso}%)
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: c,
                                  marginLeft: 8,
                                  flexShrink: 0,
                                  textAlign: 'right',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {dim.v}
                              </span>
                            </button>
                            <div
                              style={{
                                height: 5,
                                backgroundColor: '#2C2C2A',
                                borderRadius: 3,
                                overflow: 'hidden',
                                marginTop: 4,
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${dim.v}%`,
                                  backgroundColor: c,
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <div
                              style={{
                                maxHeight: isExpanded ? 500 : 0,
                                opacity: isExpanded ? 1 : 0,
                                overflow: 'hidden',
                                transition: reducedMotion
                                  ? undefined
                                  : 'max-height 300ms ease-out, opacity 200ms ease-out, margin-top 300ms ease-out',
                                marginTop: isExpanded ? 10 : 0,
                                marginLeft: 20,
                                paddingLeft: 12,
                                borderLeft: `2px solid ${c}30`,
                              }}
                            >
                                {dim.variaveis.map((vrow, vi) => {
                                  const q = qualificadorTextoMiniBarra(vrow.valor)
                                  const fonteVar =
                                    'fonte' in vrow && typeof (vrow as VariavelPontuacao).fonte === 'string'
                                      ? `Fonte: ${(vrow as VariavelPontuacao).fonte}`
                                      : FONTES_DRILLDOWN[vrow.nome]
                                  return (
                                  <div
                                    key={vi}
                                    style={{ marginTop: vi > 0 ? 10 : 0 }}
                                    title={fonteVar}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 10,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 14,
                                          color: '#8A8880',
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        {vrow.nome}
                                      </span>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: corMiniBarraValor(vrow.valor),
                                          }}
                                        >
                                          {vrow.valor}
                                        </span>
                                        <span style={{ fontSize: 14, color: q.color, marginLeft: 6 }}>
                                          {q.label}
                                        </span>
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        height: 3,
                                        backgroundColor: '#2C2C2A',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        marginTop: 4,
                                      }}
                                    >
                                      <div
                                        style={{
                                          height: '100%',
                                          width: `${vrow.valor}%`,
                                          backgroundColor: corMiniBarraValor(vrow.valor),
                                          borderRadius: 2,
                                          opacity: 0.7,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  )
                                })}
                            </div>
                          </div>
                        )
                      })}
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px 16px',
                          borderRadius: 8,
                          backgroundColor: `${corFaixa}0F`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 4,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: '#D3D1C7',
                            }}
                          >
                            Pontuação final
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 400, color: '#888780' }}>
                            <span style={{ color: CORES_DIMENSAO.atratividade, fontWeight: 600 }}>A</span>
                            <span style={{ color: '#888780', fontWeight: 400 }}> {scoreBarA}</span>
                            <span style={{ color: '#5F5E5A' }}> · </span>
                            <span style={{ color: CORES_DIMENSAO.viabilidade, fontWeight: 600 }}>V</span>
                            <span style={{ color: '#888780', fontWeight: 400 }}> {scoreBarV}</span>
                            <span style={{ color: '#5F5E5A' }}> · </span>
                            <span style={{ color: CORES_DIMENSAO.seguranca, fontWeight: 600 }}>S</span>
                            <span style={{ color: '#888780', fontWeight: 400 }}> {scoreBarS}</span>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: corFaixa,
                            flexShrink: 0,
                          }}
                        >
                          {scoreTotalDisplay}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: '1px solid #2C2C2A',
                          display: 'flex',
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            beginFlipClose()
                          }}
                          style={{
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: '#5F5E5A',
                            color: '#B4B2A9',
                            fontSize: 16,
                            fontWeight: 500,
                            borderRadius: 6,
                            padding: '7px 14px',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#888780'
                            e.currentTarget.style.color = '#F1EFE8'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#5F5E5A'
                            e.currentTarget.style.color = '#B4B2A9'
                          }}
                        >
                          Voltar
                        </button>
                      </div>
                      {perfilPesosInfoHover
                        ? createPortal(
                            <div
                              ref={perfilTooltipFloatingRef}
                              role="presentation"
                              onMouseEnter={openPerfilPesosInfo}
                              onMouseLeave={scheduleClosePerfilPesosInfo}
                              style={{
                                position: 'fixed',
                                top: perfilTooltipPos?.top ?? 0,
                                left: perfilTooltipPos?.left ?? 0,
                                zIndex: 10050,
                                width: 240,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                pointerEvents: perfilTooltipPos != null ? 'auto' : 'none',
                                opacity: perfilTooltipPos != null ? 1 : 0,
                              }}
                            >
                              {perfilInfoTooltipBelow ? (
                                <>
                                  <PerfilTooltipArrow pointsDown={false} />
                                  <div style={{ marginTop: -1 }}>
                                    <PerfilPesosTooltipPanel perfilAtivo={perfilForDrill} />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <PerfilPesosTooltipPanel perfilAtivo={perfilForDrill} />
                                  <div style={{ marginTop: -1 }}>
                                    <PerfilTooltipArrow pointsDown />
                                  </div>
                                </>
                              )}
                            </div>,
                            document.body,
                          )
                        : null}
                    </div>
                  )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```


### src\components\dashboard\InteligenciaDashboard.tsx (5354 linhas)

```typescript
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipPayloadEntry } from 'recharts'
import { HelpCircle } from 'lucide-react'
import { dashboardMock, type DashboardAlertaRecente } from '../../data/dashboard.mock'
import { PROCESSOS_MOCK } from '../../data/processos.mock'
import BrasilMiniMap from './BrasilMiniMap'
import { estiloBadgeRelevancia } from '../../lib/relevanciaAlerta'
import { estiloBadgeSubstanciaPaletaV2 } from '../../lib/corSubstancia'
import { REGIME_COLORS, REGIME_LABELS } from '../../lib/regimes'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import { AlertaItemImpactoBar } from '../legislativo/AlertaItemImpactoBar'
import { RegimeBadge } from '../ui/RegimeBadge'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Fase, Processo, Regime } from '../../types'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
  MOTION_LINE_ANIMATION_BEGIN_MS,
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS,
  MOTION_OVERLAY_INNER_ENTER_MS,
  MOTION_STAGGER_STEP_MS,
} from '../../lib/motionDurations'

const DEFAULT_INTEL_STAGGER_BASE_MS =
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS + MOTION_OVERLAY_INNER_ENTER_MS

function intelMotionGroupStyle(visible: boolean, reduced: boolean): CSSProperties {
  if (reduced) return { opacity: 1, transform: 'translateY(0)' }
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${MOTION_GROUP_TRANSLATE_PX}px)`,
    transition: `opacity ${MOTION_GROUP_FADE_MS}ms ease-out, transform ${MOTION_GROUP_FADE_MS}ms ease-out`,
  }
}

function intelBarFillStyle(
  pct: number,
  widthActive: boolean,
  barIndex: number,
  reduced: boolean,
  backgroundColor: string,
): CSSProperties {
  if (reduced) {
    return {
      width: `${pct}%`,
      height: '100%',
      backgroundColor,
      borderRadius: 3,
    }
  }
  return {
    width: widthActive ? `${pct}%` : '0%',
    height: '100%',
    backgroundColor,
    borderRadius: 3,
    transition: `width ${MOTION_BAR_WIDTH_MS}ms ease-out ${barIndex * MOTION_BAR_STAGGER_MS}ms`,
  }
}

/** Páginas 1-indexadas para a UI; inclui reticências quando total > 5. */
function indicadoresNumericosPagina(atual0: number, maxPage: number): Array<number | 'ellipsis'> {
  const total = maxPage + 1
  if (total <= 0) return []
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const cur = atual0 + 1
  if (cur <= 3) return [1, 2, 3, 'ellipsis', total]
  if (cur >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total]
  return [1, 'ellipsis', cur - 1, cur, cur + 1, 'ellipsis', total]
}

function IconBuscaIntel({
  size = 16,
  color,
  style,
}: {
  size?: number
  color: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth={2} />
      <path
        d="m21 21-4.3-4.3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLimparBuscaIntel({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChevronPagina({ dir, size = 16 }: { dir: 'left' | 'right'; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      {dir === 'left' ? (
        <path
          d="m15 18-6-6 6-6"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m9 18 6-6-6-6"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

/** Ícones estilo Lucide (SVG inline — evita dependência lucide-react no bundle). */
type IconTendenciaProps = {
  size?: number
  color?: string
  'aria-hidden'?: boolean
}

function IconTendenciaUp({ size = 12, color, ...rest }: IconTendenciaProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function IconTendenciaMinus({ size = 12, color, ...rest }: IconTendenciaProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M5 12h14" />
    </svg>
  )
}

function IconTendenciaDown({ size = 12, color, ...rest }: IconTendenciaProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  )
}

const FASE_LABELS: Record<Fase, string> = {
  requerimento: 'Requerimento',
  pesquisa: 'Pesquisa',
  concessao: 'Concessão',
  lavra: 'Lavra',
  encerrado: 'Encerrado',
}

const FASE_ORDER: Fase[] = [
  'requerimento',
  'pesquisa',
  'concessao',
  'lavra',
  'encerrado',
]

const SUB_KEYS = [
  { key: 'ferro' as const, label: 'Ferro', color: '#7EADD4' },
  { key: 'cobre' as const, label: 'Cobre', color: '#C87C5B' },
  { key: 'ouro' as const, label: 'Ouro', color: '#D4A843' },
  { key: 'niobio' as const, label: 'Nióbio', color: '#5CBFA0' },
  { key: 'terras_raras' as const, label: 'Terras Raras', color: '#3D8B7A' },
]

export const UFS_INTEL_DASHBOARD = ['MG', 'PA', 'GO', 'BA', 'AM', 'MT'] as const

const REGIMES_ORDEM: Regime[] = [
  'autorizacao_pesquisa',
  'concessao_lavra',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
]

/** Mapeia substância do processo para série do gráfico (quando filtro de substâncias ativo). */
function chavesGraficoParaSubstancias(selecionadas: string[]): Set<(typeof SUB_KEYS)[number]['key']> {
  const out = new Set<(typeof SUB_KEYS)[number]['key']>()
  for (const raw of selecionadas) {
    const u = raw.toUpperCase()
    if (u === 'FERRO') out.add('ferro')
    else if (u === 'COBRE') out.add('cobre')
    else if (u === 'OURO') out.add('ouro')
    else if (u === 'NIOBIO') out.add('niobio')
    else if (
      /NEODIMIO|PRASEODIMIO|TERBIO|DISPROSIO|LITIO|TERRAS|RARAS|EUROPIO|GADOLINIO|SAMARIO|ITERBIO/i.test(
        normalizarSubstanciaChave(raw),
      )
    ) {
      out.add('terras_raras')
    }
  }
  return out
}

/** Chaves estáveis para contagem única de minerais estratégicos no KPI. */
type ChaveMineralEstrategico = 'nb' | 'li' | 'dy' | 'ni' | 'tr'

const ORDEM_MINERAL_ESTRATEGICO: ChaveMineralEstrategico[] = [
  'nb',
  'li',
  'dy',
  'ni',
  'tr',
]

const LABEL_MINERAL_ESTRATEGICO: Record<ChaveMineralEstrategico, string> = {
  nb: 'Nb',
  li: 'Li',
  dy: 'Dy',
  ni: 'Ni',
  tr: 'TR',
}

function substanciaParaChaveEstrategica(sub: string): ChaveMineralEstrategico | null {
  const u = normalizarSubstanciaChave(sub)
  if (u === 'NIOBIO') return 'nb'
  if (u === 'LITIO') return 'li'
  if (u === 'DISPROSIO') return 'dy'
  if (u === 'NIQUEL') return 'ni'
  if (
    /NEODIMIO|PRASEODIMIO|TERBIO|TERRAS|RARAS|EUROPIO|GADOLINIO|SAMARIO|ITERBIO/i.test(
      u,
    )
  ) {
    return 'tr'
  }
  return null
}

function estiloPillSubstanciaRanking(sub: string) {
  return estiloBadgeSubstanciaPaletaV2(sub)
}

/** Caixa alta para badges de substância (gráfico, tabela, tooltips do gráfico). */
function textoBadgeSubstanciaExibicao(raw: string): string {
  return raw.toLocaleUpperCase('pt-BR')
}

export interface FiltrosDashboard {
  periodo: { inicio: string | null; fim: string | null }
  ufs: string[]
  substancias: string[]
  regime: string | null
}

type OmitFiltro = { skipRegime?: boolean; skipUfs?: boolean }

function ultimoDiaMes(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

function filtrarProcessos(
  processos: Processo[],
  f: FiltrosDashboard,
  omit?: OmitFiltro,
): Processo[] {
  let rows = processos
  if (!omit?.skipRegime && f.regime != null) {
    rows = rows.filter((p) => p.regime === f.regime)
  }
  if (!omit?.skipUfs && f.ufs.length > 0) {
    rows = rows.filter((p) => f.ufs.includes(p.uf))
  }
  if (f.substancias.length > 0) {
    rows = rows.filter((p) => f.substancias.includes(p.substancia))
  }
  if (f.periodo.inicio) {
    rows = rows.filter((p) => p.data_protocolo >= `${f.periodo.inicio}-01`)
  }
  if (f.periodo.fim != null) {
    const fimMes = f.periodo.fim
    rows = rows.filter((p) => p.data_protocolo <= ultimoDiaMes(fimMes))
  }
  return rows
}

/** Retorna processos do mock filtrados por `filtros` (AND). `omit` exclui regime ou UFs do cruzamento. */
function processosFiltratos(f: FiltrosDashboard, omit?: OmitFiltro): Processo[] {
  return filtrarProcessos(PROCESSOS_MOCK, f, omit)
}

function corRisk(v: number | null): string {
  if (v === null) return '#5F5E5A'
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

/** Preenchimento da barra horizontal por faixa de risco médio (alinhado a `corRisk`). */
function corBarraUf(risk: number): string {
  if (risk < 40) return '#1D9E75'
  if (risk <= 69) return '#E8A830'
  return '#E24B4A'
}

function situacaoLabel(s: Processo['situacao']): string {
  if (s === 'ativo') return 'Ativo'
  if (s === 'bloqueado') return 'Bloqueado'
  return 'Inativo'
}

function formatPrecoUsd(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function textoQuantidadeProcessos(n: number): string {
  if (n === 1) return '1 processo'
  return `${n.toLocaleString('pt-BR')} processos`
}

function textoBaseadoEmScoresCalculados(scoredCount: number): string {
  if (scoredCount === 1) return 'baseado em 1 processo com score calculado'
  return `baseado em ${scoredCount.toLocaleString('pt-BR')} processos com score calculado`
}

function normalizarSubstanciaChave(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function formatValorPotencialKpi(somaMi: number): string {
  if (somaMi >= 1000) {
    const b = somaMi / 1000
    return `USD ${b.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}B`
  }
  return `USD ${Math.round(somaMi).toLocaleString('pt-BR')}M`
}

function fmtUltimoDespachoCelula(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).slice(-2)}`
}

function corUltimoDespachoData(iso: string): string {
  const t = new Date(`${iso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return '#D3D1C7'
  const days = (Date.now() - t) / 86400000
  if (days <= 30) return '#1D9E75'
  if (days <= 180) return '#D3D1C7'
  if (days <= 365) return '#EF9F27'
  return '#E24B4A'
}

const INTEL_KPI_TOOLTIP_CORPO_VALOR_POTENCIAL =
  'Estimativa do valor de mercado das reservas minerais dos processos monitorados, calculada com base em dados de produção, reservas estimadas e preço spot internacional (USGS Mineral Commodity Summaries). Valores sujeitos a variação conforme condições de mercado e estágio de exploração.'

const INTEL_TOOLTIP_GAP_PRODUCAO =
  'Diferença entre a participação brasileira nas reservas mundiais e na produção mundial desta substância. Um gap elevado indica potencial subexplorado, representando oportunidade de investimento e desenvolvimento.'

const INTEL_TOOLTIP_ALERTA_LARGURA = 320
const INTEL_TOOLTIP_GAP_LARGURA = 300

const INTEL_TOOLTIP_DEMANDA_LARGURA = 300

type DemandaNivelMineral = 'alta' | 'moderada' | 'baixa'

const INTEL_TOOLTIP_DEMANDA_POR_NIVEL: Record<DemandaNivelMineral, string> = {
  alta: 'Forte oportunidade de investimento. Demanda global crescente com oferta limitada.',
  moderada:
    'Oportunidade moderada. Mercado em equilíbrio entre oferta e demanda.',
  baixa: 'Mercado com excesso de oferta. Avaliar viabilidade antes de investir.',
}

function tooltipTextoDemandaPorNivel(nivel: DemandaNivelMineral): string {
  return INTEL_TOOLTIP_DEMANDA_POR_NIVEL[nivel]
}

const MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/** Colunas do ranking de titulares — cabeçalhos e linhas compartilham a mesma largura. */
/** Mesmo tamanho/cor dos rótulos “Processos” / “Risco médio” em PROCESSOS POR ESTADO. */
const RANKING_TITULARES_HEAD_CELL: CSSProperties = {
  fontSize: 14,
  color: '#5F5E5A',
  fontWeight: 400,
}

const RANKING_TITULARES_COL_SUBSTANCIAS: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 4,
  justifyContent: 'flex-end',
  alignItems: 'center',
  flex: '0 0 168px',
  minWidth: 0,
}

const RANKING_TITULARES_COL_METRICA: CSSProperties = {
  flex: '0 0 100px',
  textAlign: 'right',
  alignSelf: 'center',
}

/** Célula “Risco” — conteúdo encostado à direita (próximo da coluna de ação / padding do card). */
const RANKING_TITULARES_RISCO_NA_GRID: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  minWidth: 0,
}

const RANKING_TITULARES_COL_ACAO: CSSProperties = {
  flex: '0 0 28px',
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
}

/** Mesma trilha das linhas do ranking — alinha toggles às colunas Hectares / Risco. Coluna 5 ≥80px e cresce p/ “Por Processos” numa linha só. */
const RANKING_TITULARES_GRID_TEMPLATE =
  '20px minmax(0,1fr) 168px 100px minmax(80px, max-content) 28px'

/** Ex.: "2026-03" → "Mar/2026" */
export function formatYyyyMmBarra(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return yyyyMm
  return `${MESES_ABREV[m - 1]}/${y}`
}

function corGapOportunidadePp(gapPp: number): string {
  if (gapPp > 15) return '#1D9E75'
  if (gapPp >= 5) return '#E8A830'
  return '#888780'
}

/** Gap positivo com prefixo "+"; inclui sufixo p.p. */
function formatarGapValorComPrefixo(gapPp: number): string {
  const s = gapPp.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  if (gapPp > 0) return `+${s} p.p.`
  return `${s} p.p.`
}

function parseYyyyMm(v: string | null): { y: number; m: number } | null {
  if (!v) return null
  const [y, m] = v.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null
  return { y, m }
}

function yyyyMmFromParts(y: number, month1: number): string {
  return `${y}-${String(month1).padStart(2, '0')}`
}

/** Mês corrente do relógio do cliente (YYYY-MM), para placeholder do filtro “Até”. */
export function yyyyMmMesAtualSistema(): string {
  const d = new Date()
  return yyyyMmFromParts(d.getFullYear(), d.getMonth() + 1)
}

export function mesYmDesabilitadoNoMonthPicker(
  variant: 'de' | 'ate',
  ym: string,
  todayYm: string,
  periodoMinYm: string,
  otherBound: string | null,
): boolean {
  if (ym.localeCompare(periodoMinYm) < 0) return true
  if (ym.localeCompare(todayYm) > 0) return true
  if (variant === 'de' && otherBound != null && ym.localeCompare(otherBound) > 0) {
    return true
  }
  if (variant === 'ate' && otherBound != null && ym.localeCompare(otherBound) < 0) {
    return true
  }
  return false
}

type SortCol = 'area' | 'risk' | 'fase'

function ChevronDown({
  aberto,
  stroke = '#5F5E5A',
  size = 12,
}: {
  aberto: boolean
  stroke?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      style={{
        flexShrink: 0,
        color: stroke,
        transform: aberto ? 'rotate(180deg)' : undefined,
        transition: 'transform 0.15s ease-out',
      }}
      aria-hidden
    >
      <path
        d="M 3 4.5 L 6 7.5 L 9 4.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

type IntelLinhaPortalTooltipState = {
  lineId: string | null
  texto: string | null
  x: number
  y: number
}

const IntelLinhaPortalTooltipSetterContext =
  createContext<React.Dispatch<React.SetStateAction<IntelLinhaPortalTooltipState>> | null>(null)

const INTEL_LINHA_TOOLTIP_WIDTH = 220
const INTEL_LINHA_TOOLTIP_OFFSET = 12

function intelLinhaTooltipLeftPx(mouseX: number): number {
  if (typeof window === 'undefined') {
    return mouseX + INTEL_LINHA_TOOLTIP_OFFSET
  }
  return mouseX + INTEL_LINHA_TOOLTIP_OFFSET + INTEL_LINHA_TOOLTIP_WIDTH > window.innerWidth
    ? mouseX - INTEL_LINHA_TOOLTIP_WIDTH - INTEL_LINHA_TOOLTIP_OFFSET
    : mouseX + INTEL_LINHA_TOOLTIP_OFFSET
}

function IntelLinhaPortalTooltipProvider({ children }: { children: ReactNode }) {
  const [tooltipState, setTooltipState] = useState<IntelLinhaPortalTooltipState>({
    lineId: null,
    texto: null,
    x: 0,
    y: 0,
  })

  const portal =
    tooltipState.lineId != null && tooltipState.texto != null ? (
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: intelLinhaTooltipLeftPx(tooltipState.x),
          top: tooltipState.y - 8,
          zIndex: 200,
          boxSizing: 'border-box',
          width: INTEL_LINHA_TOOLTIP_WIDTH,
          maxWidth: INTEL_LINHA_TOOLTIP_WIDTH,
          whiteSpace: 'normal',
          backgroundColor: '#2C2C2A',
          border: '1px solid #3a3a38',
          borderRadius: 6,
          padding: '6px 10px',
          color: '#D3D1C7',
          fontSize: 13,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        }}
      >
        {tooltipState.texto}
      </div>
    ) : null

  return (
    <IntelLinhaPortalTooltipSetterContext.Provider value={setTooltipState}>
      {children}
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </IntelLinhaPortalTooltipSetterContext.Provider>
  )
}

function IntelLinhaTooltip({
  lineId,
  texto,
  children,
}: {
  lineId: string
  texto: string
  children: ReactNode
}) {
  const setTooltip = useContext(IntelLinhaPortalTooltipSetterContext)

  if (!setTooltip) {
    return <>{children}</>
  }

  return (
    <div
      onMouseEnter={(e) => {
        setTooltip({ lineId, texto, x: e.clientX, y: e.clientY })
      }}
      onMouseMove={(e) => {
        setTooltip({ lineId, texto, x: e.clientX, y: e.clientY })
      }}
      onMouseLeave={() => {
        setTooltip({ lineId: null, texto: null, x: 0, y: 0 })
      }}
    >
      {children}
    </div>
  )
}

const KPI_TOOLTIP_DELAY_MS = 300

type IntelKpiTooltipApi = {
  enter: (titulo: string, corpo: string, clientX: number, clientY: number) => void
  move: (clientX: number, clientY: number) => void
  leave: () => void
}

const IntelKpiTooltipApiContext = createContext<IntelKpiTooltipApi | null>(null)

/** Quando o ícone de ajuda do KPI está em hover, notifica para fechar o tooltip do card (prioridade ao ícone). */
const IntelKpiNestedInfoContext = createContext<((hovering: boolean) => void) | null>(
  null,
)

function IntelKpiPortalTooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    visible: boolean
    titulo: string | null
    corpo: string | null
    x: number
    y: number
  }>({
    visible: false,
    titulo: null,
    corpo: null,
    x: 0,
    y: 0,
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xyRef = useRef({ x: 0, y: 0 })

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    },
    [],
  )

  const api = useMemo<IntelKpiTooltipApi>(
    () => ({
      enter: (titulo, corpo, clientX, clientY) => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        xyRef.current = { x: clientX, y: clientY }
        setState({
          visible: false,
          titulo: null,
          corpo: null,
          x: clientX,
          y: clientY,
        })
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          const { x: lx, y: ly } = xyRef.current
          setState({
            visible: true,
            titulo,
            corpo,
            x: lx,
            y: ly,
          })
        }, KPI_TOOLTIP_DELAY_MS)
      },
      move: (clientX, clientY) => {
        xyRef.current = { x: clientX, y: clientY }
        setState((s) => (s.visible ? { ...s, x: clientX, y: clientY } : s))
      },
      leave: () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setState({
          visible: false,
          titulo: null,
          corpo: null,
          x: 0,
          y: 0,
        })
      },
    }),
    [],
  )

  const portal =
    state.visible && state.titulo != null && state.corpo != null ? (
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: intelLinhaTooltipLeftPx(state.x),
          top: state.y - 8,
          zIndex: 200,
          boxSizing: 'border-box',
          width: INTEL_LINHA_TOOLTIP_WIDTH,
          maxWidth: INTEL_LINHA_TOOLTIP_WIDTH,
          whiteSpace: 'normal',
          backgroundColor: '#2C2C2A',
          border: '1px solid #3a3a38',
          borderRadius: 6,
          padding: '8px 10px',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{ color: '#F1EFE8', fontWeight: 500, marginBottom: 6, fontSize: 13 }}
        >
          {state.titulo}
        </div>
        <div style={{ color: '#D3D1C7', fontSize: 13 }}>{state.corpo}</div>
      </div>
    ) : null

  return (
    <IntelKpiTooltipApiContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </IntelKpiTooltipApiContext.Provider>
  )
}

function IntelKpiTooltip({
  titulo,
  corpo,
  children,
}: {
  titulo: string
  corpo: string
  children: ReactNode
}) {
  const api = useContext(IntelKpiTooltipApiContext)
  const lastMoveRef = useRef({ x: 0, y: 0 })

  const onNestedInfoHover = useCallback(
    (hovering: boolean) => {
      if (!api) return
      if (hovering) {
        api.leave()
      } else {
        const { x, y } = lastMoveRef.current
        api.enter(titulo, corpo, x, y)
      }
    },
    [api, titulo, corpo],
  )

  if (!api) {
    return <>{children}</>
  }

  return (
    <IntelKpiNestedInfoContext.Provider value={onNestedInfoHover}>
      <div
        style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        onMouseEnter={(e) => {
          lastMoveRef.current = { x: e.clientX, y: e.clientY }
          api.enter(titulo, corpo, e.clientX, e.clientY)
        }}
        onMouseMove={(e) => {
          lastMoveRef.current = { x: e.clientX, y: e.clientY }
          api.move(e.clientX, e.clientY)
        }}
        onMouseLeave={() => {
          api.leave()
        }}
      >
        {children}
      </div>
    </IntelKpiNestedInfoContext.Provider>
  )
}

const INTEL_KPI_TOOLTIP_CORPO_PROCESSOS =
  'Total de processos minerários ativos e bloqueados no universo monitorado pelo Terrae. Inclui todos os regimes: Concessão de Lavra, Autorização de Pesquisa, Req. de Lavra, Licenciamento e Mineral Estratégico.'

const INTEL_KPI_TOOLTIP_CORPO_HECTARES =
  'Soma das áreas de todos os processos monitorados, em hectares. Representa a extensão territorial total sob análise pelo Terrae, equivalente à área georreferenciada no SIGMINE/ANM.'

const INTEL_KPI_TOOLTIP_CORPO_RISCO =
  'Média dos Risk Scores de todos os processos com score calculado. O Risk Score varia de 0 a 100 e pondera quatro dimensões: Geológico (25%), Ambiental (30%), Social (25%) e Regulatório (20%).'

const INTEL_KPI_TOOLTIP_CORPO_MINERAIS_ESTRATEGICOS =
  'Quantidade de categorias de minerais estratégicos presentes na carteira após os filtros: nióbio (Nb), lítio (Li), disprósio (Dy), níquel (Ni) e terras raras (TR). Cada categoria conta uma vez se houver pelo menos um processo com essa substância.'

const INTEL_KPI_TOOLTIP_CORPO_PROCESSOS_RISCO_ALTO =
  'Número de processos com Risk Score igual ou superior a 70 (alto risco). A percentagem indica quanto isso representa do total de processos após os filtros ativos.'

const INTEL_INFO_TEXTO_PRODUCAO_GRAFICO =
  'O gráfico usa índice base 100, onde 100 representa a produção de cada substância em 2019. Valores acima de 100 indicam crescimento em relação a 2019; por exemplo, 150 significa 50% a mais que a produção de 2019. Substâncias com produção zero em 2019 são exibidas como \'sem produção\' no ano base.'

const INTEL_INFO_TEXTO_RISCO_KPI =
  'O Risk Score é um indicador proprietário do Terrae que varia de 0 a 100. É calculado ponderando quatro dimensões: Geológico (25%), Ambiental (30%), Social (25%) e Regulatório (20%). Abaixo de 40 é considerado baixo risco, entre 40 e 69 risco médio, acima de 70 alto risco.'

const INTEL_INFO_TEXTO_DISTRIBUICAO_REGIME =
  'Regime é a modalidade jurídica do título minerário outorgado pela ANM. Cada regime tem direitos e obrigações distintos. A Concessão de Lavra é o título definitivo para extração, enquanto a Autorização de Pesquisa permite apenas estudos geológicos.'

const INTEL_INFO_TEXTO_MINERAIS_ESTRATEGICOS =
  'Minerais classificados pelo Decreto MME 11.892/2025 como críticos para a transição energética e segurança nacional brasileira. Recebem tratamento prioritário na ANM e são objeto de acordos internacionais com EUA e União Europeia.'

const INTEL_INFO_TOOLTIP_WIDTH = 260
const INTEL_INFO_TOOLTIP_OFFSET = 12

function intelInfoTooltipLeftPx(mouseX: number): number {
  if (typeof window === 'undefined') {
    return mouseX + INTEL_INFO_TOOLTIP_OFFSET
  }
  return mouseX + INTEL_INFO_TOOLTIP_OFFSET + INTEL_INFO_TOOLTIP_WIDTH > window.innerWidth
    ? mouseX - INTEL_INFO_TOOLTIP_WIDTH - INTEL_INFO_TOOLTIP_OFFSET
    : mouseX + INTEL_INFO_TOOLTIP_OFFSET
}

function InfoTooltip({ texto }: { texto: string }) {
  const notifyKpiCardIconHover = useContext(IntelKpiNestedInfoContext)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xyRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(false)

  const limparTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      limparTimer()
    },
    [limparTimer],
  )

  const portal = visible ? (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: intelInfoTooltipLeftPx(pos.x),
        top: pos.y - 8,
        zIndex: 200,
        boxSizing: 'border-box',
        width: INTEL_INFO_TOOLTIP_WIDTH,
        maxWidth: INTEL_INFO_TOOLTIP_WIDTH,
        whiteSpace: 'normal',
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#D3D1C7',
        fontSize: 13,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {texto}
    </div>
  ) : null

  return (
    <>
      <span
        aria-label="Informação"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: 6,
          flexShrink: 0,
          cursor: 'help',
          color: '#5F5E5A',
          fontSize: 14,
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          notifyKpiCardIconHover?.(true)
          limparTimer()
          xyRef.current = { x: e.clientX, y: e.clientY }
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            const { x, y } = xyRef.current
            setPos({ x, y })
            visibleRef.current = true
            setVisible(true)
          }, KPI_TOOLTIP_DELAY_MS)
        }}
        onMouseMove={(e) => {
          xyRef.current = { x: e.clientX, y: e.clientY }
          if (visibleRef.current) {
            setPos({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseLeave={() => {
          notifyKpiCardIconHover?.(false)
          limparTimer()
          visibleRef.current = false
          setVisible(false)
        }}
      >
        <HelpCircle size={14} color="#5F5E5A" aria-hidden={true} />
      </span>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

function intelTooltipLargoLeftPx(mouseX: number, tooltipWidth: number): number {
  const off = 12
  if (typeof window === 'undefined') return mouseX + off
  return mouseX + off + tooltipWidth > window.innerWidth
    ? mouseX - tooltipWidth - off
    : mouseX + off
}

function TooltipHoverResumo({
  texto,
  maxWidth,
  children,
  wrapperLayout = 'default',
}: {
  texto: string
  maxWidth: number
  children: ReactNode
  /** `inlineRow` / `inlineColumn`: sem width:100%, para uso dentro de flex. */
  wrapperLayout?: 'default' | 'inlineColumn' | 'inlineRow'
}) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xyRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(false)

  const limpar = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      limpar()
    },
    [limpar],
  )

  const portal = visible ? (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: intelTooltipLargoLeftPx(pos.x, maxWidth),
        top: pos.y - 8,
        zIndex: 200,
        maxWidth,
        width: 'max-content',
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#D3D1C7',
        fontSize: 13,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {texto}
    </div>
  ) : null

  return (
    <>
      <div
        style={
          wrapperLayout === 'inlineColumn'
            ? {
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }
            : wrapperLayout === 'inlineRow'
              ? {
                  display: 'inline-flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'help',
                }
              : { display: 'block', width: '100%' }
        }
        onMouseEnter={(e) => {
          limpar()
          xyRef.current = { x: e.clientX, y: e.clientY }
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            setPos(xyRef.current)
            visibleRef.current = true
            setVisible(true)
          }, KPI_TOOLTIP_DELAY_MS)
        }}
        onMouseMove={(e) => {
          xyRef.current = { x: e.clientX, y: e.clientY }
          if (visibleRef.current) setPos({ x: e.clientX, y: e.clientY })
        }}
        onMouseLeave={() => {
          limpar()
          visibleRef.current = false
          setVisible(false)
        }}
      >
        {children}
      </div>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

/** Tooltip padrão Terrae, ancorado ao retângulo do elemento (acima/abaixo conforme espaço). */
function TooltipDemandaPill({
  texto,
  style,
  children,
  hoverBackground,
}: {
  texto: string
  style: CSSProperties
  children: ReactNode
  /** Fundo no hover (ex.: cor da série + sufixo hex de opacidade). */
  hoverBackground?: string
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpar = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      limpar()
    },
    [limpar],
  )

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const tip = tooltipRef.current
    if (!anchor || !tip) return
    const rect = anchor.getBoundingClientRect()
    const th = tip.offsetHeight
    const tw = tip.offsetWidth || INTEL_TOOLTIP_DEMANDA_LARGURA
    const margin = 8
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const preferBelow = spaceBelow >= th + margin || spaceBelow >= spaceAbove

    let top = preferBelow ? rect.bottom + margin : rect.top - th - margin
    if (top + th > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - th - margin)
    }
    if (top < margin) top = margin

    let left = rect.left + rect.width / 2 - tw / 2
    const pad = 8
    if (left < pad) left = pad
    if (left + tw > window.innerWidth - pad) {
      left = window.innerWidth - tw - pad
    }
    setCoords({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!visible) return
    updatePosition()
    const raf = requestAnimationFrame(() => {
      updatePosition()
    })
    return () => cancelAnimationFrame(raf)
  }, [visible, texto, updatePosition])

  useEffect(() => {
    if (!visible) return
    const handler = () => {
      updatePosition()
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [visible, updatePosition])

  const portal = visible && texto ? (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        left: coords.left,
        top: coords.top,
        zIndex: 200,
        maxWidth: INTEL_TOOLTIP_DEMANDA_LARGURA,
        width: 'max-content',
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#D3D1C7',
        fontSize: 13,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {texto}
    </div>
  ) : null

  const mergedStyle: CSSProperties = {
    ...style,
    ...(hover && hoverBackground ? { backgroundColor: hoverBackground } : {}),
  }

  return (
    <>
      <span
        ref={anchorRef}
        style={mergedStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          setHover(true)
          limpar()
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            setVisible(true)
          }, KPI_TOOLTIP_DELAY_MS)
        }}
        onMouseLeave={() => {
          setHover(false)
          limpar()
          setVisible(false)
        }}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && portal
        ? createPortal(portal, document.body)
        : null}
    </>
  )
}

function dataAlertaDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Primeiro item da lista: badge NOVO se a data está nos últimos 7 dias (relógio do cliente). */
function alertaPrimeiroItemMostraNovo(idx: number, dataIso: string): boolean {
  if (idx !== 0) return false
  const t = new Date(`${dataIso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return false
  const now = Date.now()
  if (t > now) return false
  return now - t <= 7 * 86400000
}

function CardUltimosAlertasLegislativos({
  alertas,
}: {
  alertas: readonly DashboardAlertaRecente[]
}) {
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)

  return (
    <div
      className="terrae-intel-hover-panel"
      style={{
        backgroundColor: '#1A1A18',
        borderRadius: 8,
        padding: 20,
        marginTop: 16,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 36,
          justifyContent: 'space-between',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '1.5px',
            color: '#FFFFFF',
          }}
        >
          ALERTAS REGULATÓRIOS
        </p>
        <button
          type="button"
          onClick={() => setTelaAtiva('radar')}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 14,
            color: '#EF9F27',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Ver todos no Radar →
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {alertas.map((a, idx) => {
          const relevanciaMeta = estiloBadgeRelevancia(
            a.nivel_impacto,
            a.tipo_impacto,
          )
          return (
          <li
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderBottom: idx < alertas.length - 1 ? '1px solid #2C2C2A' : undefined,
              paddingBottom: idx < alertas.length - 1 ? 12 : 0,
              marginBottom: idx < alertas.length - 1 ? 12 : 0,
            }}
          >
            <AlertaItemImpactoBar
              nivel={a.nivel_impacto}
              tipo_impacto={a.tipo_impacto}
            />
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
              <TooltipHoverResumo texto={a.ementa} maxWidth={INTEL_TOOLTIP_ALERTA_LARGURA}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    cursor: 'help',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      color: '#D3D1C7',
                      minWidth: 0,
                    }}
                  >
                    {a.titulo}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        color: relevanciaMeta.cor,
                        fontWeight: 400,
                      }}
                    >
                      {relevanciaMeta.label}
                    </span>
                    <span style={{ color: '#888780' }}>·</span>
                    <span style={{ color: '#888780' }}>{a.fonte_publicacao}</span>
                    <span style={{ color: '#888780' }}>·</span>
                    <span style={{ color: '#888780' }}>{dataAlertaDdMmYyyy(a.data)}</span>
                    {alertaPrimeiroItemMostraNovo(idx, a.data) ? (
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          color: '#EF9F27',
                          fontWeight: 400,
                        }}
                      >
                        NOVO
                      </span>
                    ) : null}
                  </div>
                </div>
              </TooltipHoverResumo>
            </div>
          </li>
          )
        })}
      </ul>
    </div>
  )
}

function CheckMini() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5 L4 7 L8 3"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBarrasRegimeVazio() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="14"
        width="4"
        height="7"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="10"
        y="10"
        width="4"
        height="11"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="16"
        y="6"
        width="4"
        height="15"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
    </svg>
  )
}

/** Mesmo pictograma de barras que os empty states internos, 48px para o empty consolidado. */
function IconBarrasEmptyConsolidado() {
  const c = '#5F5E5A'
  return (
    <svg width={48} height={48} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="14"
        width="4"
        height="7"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="10"
        y="10"
        width="4"
        height="11"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
      <rect
        x="16"
        y="6"
        width="4"
        height="15"
        rx="0.5"
        fill="none"
        stroke={c}
        strokeWidth="1.3"
      />
    </svg>
  )
}

function IconMapaUfVazio() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4 3 6v13l5-2 6 2 5-2V4l-5 2-6-2Z"
        stroke={c}
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 4v13M14 6v13" stroke={c} strokeWidth="1.1" />
    </svg>
  )
}

function IconPodioRankingVazio() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M6 28h8v8H6zM16 22h8v14H16zM26 26h8v10H26z"
        stroke={c}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M20 8v14M16 12h8"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTabelaVazia() {
  const c = '#5F5E5A'
  return (
    <svg width={32} height={32} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3"
        width="15"
        height="14"
        rx="1"
        fill="none"
        stroke={c}
        strokeWidth="1.2"
      />
      <line x1="2.5" y1="7.5" x2="17.5" y2="7.5" stroke={c} strokeWidth="1" />
      <line x1="2.5" y1="11.5" x2="17.5" y2="11.5" stroke={c} strokeWidth="1" />
      <line x1="8" y1="3" x2="8" y2="17" stroke={c} strokeWidth="1" />
      <line x1="13" y1="3" x2="13" y2="17" stroke={c} strokeWidth="1" />
    </svg>
  )
}

/** Empty states dos cards de conteúdo (Inteligência): ícone 32px + mensagem. */
const INTEL_CARD_EMPTY_WRAP: CSSProperties = {
  minHeight: 120,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

const INTEL_CARD_EMPTY_MSG: CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: '#888780',
  textAlign: 'center',
  lineHeight: 1.4,
}

/** Mesma altura mínima nos cards Minerais + Ranking quando vazios, para alinhar ícone e texto. */
const INTEL_MINERAIS_RANKING_EMPTY_PANEL_MIN_PX = 280

const INTEL_CARD_EMPTY_BODY_GROW: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

/** Botão-trigger dos filtros dropdown na Inteligência (reutilizar no Radar). */
export const INTEL_FILTER_SELECT_TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#0D0D0C',
  border: '1px solid #2C2C2A',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 15,
  color: '#D3D1C7',
  cursor: 'pointer',
  outline: 'none',
}

type MultiSelectProps = {
  prefix: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  aberto: boolean
  setAberto: (v: boolean) => void
  /** Substitui o estilo padrão do botão (ex.: linha de filtros compacta no Radar). */
  triggerStyle?: CSSProperties
  /** Rótulo exibido por opção (ex.: "Todas" em vez do id interno). */
  formatOption?: (option: string) => string
}

export function MultiSelectDropdown({
  prefix,
  options,
  selected,
  onChange,
  aberto,
  setAberto,
  triggerStyle,
  formatOption,
}: MultiSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{
    top: number
    left: number
    width: number
    maxH: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!aberto) {
      setRect(null)
      return
    }
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const gap = 4
      const maxH = Math.min(280, vh - r.bottom - gap - 16)
      setRect({
        top: r.bottom + gap,
        left: Math.min(r.left, vw - 220),
        width: Math.max(r.width, 200),
        maxH: Math.max(80, maxH),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto, setAberto])

  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt))
    else onChange([...selected, opt])
  }

  const portal =
    aberto && rect ? (
      <div
        ref={panelRef}
        role="listbox"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxH,
          boxSizing: 'border-box',
          backgroundColor: '#1A1A18',
          border: '1px solid #2C2C2A',
          borderRadius: 8,
          padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 2147483647,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="terrae-dropdown-scroll min-h-0 flex-1 overflow-y-auto">
        {options.map((opt) => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => toggle(opt)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  borderRadius: 3,
                  border: '1px solid #2C2C2A',
                  backgroundColor: on ? '#EF9F27' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <CheckMini /> : null}
              </span>
              <span style={{ fontSize: 13, color: '#D3D1C7' }}>
                {formatOption ? formatOption(opt) : opt}
              </span>
            </button>
          )
        })}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="terrae-intel-border-interactive"
        onClick={() => setAberto(!aberto)}
        style={triggerStyle ?? INTEL_FILTER_SELECT_TRIGGER_STYLE}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {prefix}
        </span>
        <ChevronDown aberto={aberto} stroke="#D3D1C7" size={14} />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

type MonthPickerProps = {
  value: string | null
  onChange: (yyyyMm: string | null) => void
  /** Quando vazio: orientação de faixa (ex.: Jan/1987); cor #5F5E5A. */
  rangeHint: string
  /** YYYY-MM: ano/mês inicial do painel quando não há valor selecionado. */
  viewWhenEmptyYm: string
  variant: 'de' | 'ate'
  periodoMinYm: string
  otherBound: string | null
}

export function MonthPicker({
  value,
  onChange,
  rangeHint,
  viewWhenEmptyYm,
  variant,
  periodoMinYm,
  otherBound,
}: MonthPickerProps) {
  const [aberto, setAberto] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    const p = parseYyyyMm(value) ?? parseYyyyMm(viewWhenEmptyYm)
    return p?.y ?? new Date().getFullYear()
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  const now = new Date()
  const yNow = now.getFullYear()
  const mNow = now.getMonth() + 1
  const todayYm = yyyyMmFromParts(yNow, mNow)

  useLayoutEffect(() => {
    if (aberto) {
      const p = parseYyyyMm(value) ?? parseYyyyMm(viewWhenEmptyYm)
      setViewYear(p?.y ?? new Date().getFullYear())
    }
  }, [aberto, value, viewWhenEmptyYm])

  useLayoutEffect(() => {
    if (!aberto) {
      setRect(null)
      return
    }
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const panelW = 220
      let left = r.left
      if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8)
      setRect({
        top: r.bottom + 4,
        left,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto])

  const selecionarMes = (month1: number) => {
    const ym = yyyyMmFromParts(viewYear, month1)
    if (
      mesYmDesabilitadoNoMonthPicker(variant, ym, todayYm, periodoMinYm, otherBound)
    ) {
      return
    }
    onChange(ym)
    setAberto(false)
  }

  const esteMesDesabilitado = mesYmDesabilitadoNoMonthPicker(
    variant,
    todayYm,
    todayYm,
    periodoMinYm,
    otherBound,
  )

  const portal =
    aberto && rect ? (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: 220,
          boxSizing: 'border-box',
          backgroundColor: '#1A1A18',
          border: '1px solid #2C2C2A',
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 2147483647,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            aria-label="Ano anterior"
            onClick={() => setViewYear((y) => y - 1)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#888780',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            {'<'}
          </button>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#F1EFE8',
            }}
          >
            {viewYear}
          </span>
          <button
            type="button"
            aria-label="Próximo ano"
            onClick={() => setViewYear((y) => y + 1)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#888780',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            {'>'}
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginBottom: 12,
          }}
        >
          {MESES_ABREV.map((abrev, i) => {
            const month1 = i + 1
            const yyyymm = yyyyMmFromParts(viewYear, month1)
            const sel = value === yyyymm
            const isHoje = viewYear === yNow && month1 === mNow
            const desabilitado = mesYmDesabilitadoNoMonthPicker(
              variant,
              yyyymm,
              todayYm,
              periodoMinYm,
              otherBound,
            )
            if (desabilitado) {
              return (
                <span
                  key={abrev}
                  style={{
                    fontSize: 13,
                    borderRadius: 6,
                    padding: '6px 8px',
                    textAlign: 'center',
                    border: '1px solid transparent',
                    backgroundColor: 'transparent',
                    color: '#5F5E5A',
                    fontWeight: 400,
                    cursor: 'not-allowed',
                    boxSizing: 'border-box',
                  }}
                >
                  {abrev}
                </span>
              )
            }
            return (
              <button
                key={abrev}
                type="button"
                onClick={() => selecionarMes(month1)}
                style={{
                  fontSize: 13,
                  borderRadius: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: sel
                    ? '1px solid #FFFFFF'
                    : isHoje
                      ? '1px solid #2C2C2A'
                      : '1px solid transparent',
                  backgroundColor: sel ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: sel ? '#FFFFFF' : '#888780',
                  fontWeight: sel ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!sel) {
                    e.currentTarget.style.backgroundColor = '#2C2C2A'
                    e.currentTarget.style.color = '#D3D1C7'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!sel) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#888780'
                  } else {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.color = '#FFFFFF'
                    e.currentTarget.style.border = '1px solid #FFFFFF'
                  }
                }}
              >
                {abrev}
              </button>
            )
          })}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #2C2C2A',
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setAberto(false)
            }}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#FFFFFF',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#FFFFFF'
            }}
          >
            Limpar
          </button>
          {esteMesDesabilitado ? (
            <span
              style={{
                fontSize: 12,
                color: '#5F5E5A',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}
            >
              Este mês
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                onChange(yyyyMmFromParts(yNow, mNow))
                setAberto(false)
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#888780',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F1EFE8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888780'
              }}
            >
              Este mês
            </button>
          )}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="terrae-intel-border-interactive"
        onClick={() => setAberto((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#0D0D0C',
          border: '1px solid #2C2C2A',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 15,
          color: '#D3D1C7',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {value ? (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {formatYyyyMmBarra(value)}
          </span>
        ) : (
          <span
            style={{
              color: '#5F5E5A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {rangeHint}
          </span>
        )}
        <ChevronDown aberto={aberto} stroke="#D3D1C7" size={14} />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

type MineralEstrategicoMockRow = (typeof dashboardMock.minerais_estrategicos)[number]

export function InteligenciaDashboard({
  motionStaggerBaseMs = DEFAULT_INTEL_STAGGER_BASE_MS,
  reducedMotion = false,
}: {
  motionStaggerBaseMs?: number
  reducedMotion?: boolean
} = {}) {
  const gruposVis = useStaggeredEntrance(6, {
    baseDelayMs: motionStaggerBaseMs,
    staggerMs: MOTION_STAGGER_STEP_MS,
    reducedMotion,
  })
  const [g1, g2, g3, g4, g5, g6] = gruposVis
  const barsWidthReady = g2 && !reducedMotion
  const chartLineAnimActive = !reducedMotion && g3

  const { producao_historica } = dashboardMock

  const [filtros, setFiltros] = useState<FiltrosDashboard>({
    periodo: { inicio: null, fim: null },
    ufs: [],
    substancias: [],
    regime: null,
  })

  const [, startTransition] = useTransition()

  const updateFiltros = useCallback((patch: Partial<FiltrosDashboard> | ((f: FiltrosDashboard) => FiltrosDashboard)) => {
    startTransition(() => {
      setFiltros((prev) =>
        typeof patch === 'function' ? patch(prev) : { ...prev, ...patch },
      )
    })
  }, [startTransition])

  const limparFiltros = useCallback(() => {
    startTransition(() => {
      setFiltros({
        periodo: { inicio: null, fim: null },
        ufs: [],
        substancias: [],
        regime: null,
      })
    })
  }, [startTransition])

  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)

  const navigateProcessoMapa = useCallback(
    (id: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'processo',
        payload: id,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateEstadoMapa = useCallback(
    (uf: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'estado',
        payload: uf,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateRegimeMapa = useCallback(
    (regime: Regime) => {
      useMapStore.getState().setPendingNavigation({
        type: 'regime',
        payload: regime,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateTitularMapa = useCallback(
    (titular: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'titular',
        payload: titular,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const navigateSubstanciaMapa = useCallback(
    (substanciaRaw: string) => {
      useMapStore.getState().setPendingNavigation({
        type: 'substancia',
        payload: substanciaRaw,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setTelaAtiva],
  )

  const temFiltroAtivo =
    filtros.ufs.length > 0 ||
    filtros.substancias.length > 0 ||
    filtros.regime !== null ||
    filtros.periodo.inicio !== null ||
    filtros.periodo.fim !== null

  const processosBase = useMemo(() => processosFiltratos(filtros), [filtros])
  const filtrosSemProcessos = processosBase.length === 0

  const mineraisEstrategicosDoFiltro = useMemo((): Array<
    MineralEstrategicoMockRow & { processos: number }
  > => {
    const estrategicos = processosBase.filter((p) => p.is_mineral_estrategico)
    if (estrategicos.length === 0) return []

    const mockByNormal = new Map<string, MineralEstrategicoMockRow>()
    for (const m of dashboardMock.minerais_estrategicos) {
      mockByNormal.set(normalizarSubstanciaChave(m.substancia), m)
    }

    const groups = new Map<string, { mock: MineralEstrategicoMockRow; count: number }>()
    for (const p of estrategicos) {
      const mock = mockByNormal.get(normalizarSubstanciaChave(p.substancia))
      if (!mock) continue
      const prev = groups.get(mock.sigla)
      if (prev) prev.count += 1
      else groups.set(mock.sigla, { mock, count: 1 })
    }

    return [...groups.values()]
      .map(({ mock, count }) => ({ ...mock, processos: count }))
      .sort((a, b) => {
        const gapA = a.reservas_pct - a.producao_pct
        const gapB = b.reservas_pct - b.producao_pct
        if (gapB !== gapA) return gapB - gapA
        return b.preco_usd_t - a.preco_usd_t
      })
  }, [processosBase])

  const processosParaRegime = useMemo(
    () => processosFiltratos(filtros, { skipRegime: true }),
    [filtros],
  )

  const processosParaUf = useMemo(
    () => processosFiltratos(filtros, { skipUfs: true }),
    [filtros],
  )

  const [titularSelecionado, setTitularSelecionado] = useState<string | null>(null)
  const [hoverUfProcessosEstado, setHoverUfProcessosEstado] = useState<string | null>(
    null,
  )
  const [subAtivas, setSubAtivas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SUB_KEYS.map((s) => [s.key, true])),
  )

  useEffect(() => {
    if (filtrosSemProcessos) setHoverUfProcessosEstado(null)
  }, [filtrosSemProcessos])

  useEffect(() => {
    if (filtros.substancias.length === 0) {
      setSubAtivas(Object.fromEntries(SUB_KEYS.map((s) => [s.key, true])))
      return
    }
    const allowed = chavesGraficoParaSubstancias(filtros.substancias)
    setSubAtivas((prev) => {
      const next = { ...prev }
      for (const s of SUB_KEYS) {
        next[s.key] = allowed.has(s.key)
      }
      return next
    })
  }, [filtros.substancias])

  const chartData = useMemo(() => {
    const base = producao_historica[0]!
    return producao_historica.map((row) => ({
      ano: row.ano,
      ferro: base.ferro ? (row.ferro / base.ferro) * 100 : 0,
      cobre: base.cobre ? (row.cobre / base.cobre) * 100 : 0,
      ouro: base.ouro ? (row.ouro / base.ouro) * 100 : 0,
      niobio: base.niobio ? (row.niobio / base.niobio) * 100 : 0,
      /** Base simbólica 8 em 2019 (produção mínima visível); 2020/2021 proporcionais (~12, ~25). */
      terras_raras:
        base.terras_raras > 0
          ? (row.terras_raras * 8) / base.terras_raras
          : row.terras_raras > 0
            ? 100
            : 0,
    }))
  }, [producao_historica])

  const porRegimeCalculado = useMemo(() => {
    const map = new Map<Regime, { count: number; area_ha: number }>()
    for (const r of REGIMES_ORDEM) {
      map.set(r, { count: 0, area_ha: 0 })
    }
    for (const p of processosParaRegime) {
      const cur = map.get(p.regime)!
      cur.count += 1
      cur.area_ha += p.area_ha
    }
    const maxC = Math.max(1, ...[...map.values()].map((v) => v.count))
    return REGIMES_ORDEM.map((regime) => {
      const v = map.get(regime)!
      return {
        regime,
        label: REGIME_LABELS[regime],
        count: v.count,
        area_ha: v.area_ha,
        cor: REGIME_COLORS[regime],
        pct: (v.count / maxC) * 100,
      }
    })
  }, [processosParaRegime])

  const porUfCalculado = useMemo(() => {
    return UFS_INTEL_DASHBOARD.map((uf) => {
      const list = processosParaUf.filter((p) => p.uf === uf)
      const count = list.length
      const withRisk = list.filter((p) => p.risk_score !== null)
      const risk_medio =
        count > 0 && withRisk.length > 0
          ? Math.round(
              withRisk.reduce((s, p) => s + (p.risk_score as number), 0) / withRisk.length,
            )
          : null
      return { uf, count, risk_medio, scoredCount: withRisk.length }
    })
  }, [processosParaUf])

  const maxUfCount = useMemo(
    () => Math.max(1, ...porUfCalculado.map((u) => u.count)),
    [porUfCalculado],
  )

  const totalProcessosCarteiraUf = useMemo(
    () => processosParaUf.length,
    [processosParaUf],
  )

  const substanciasUnicasMock = useMemo(() => {
    const s = new Set<string>()
    for (const p of PROCESSOS_MOCK) s.add(p.substancia)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [])

  const rankingOrdenado = useMemo(() => {
    const map = new Map<
      string,
      { titular: string; processos: number; area_ha: number; substancias: Set<string>; risks: number[] }
    >()
    for (const p of processosBase) {
      let row = map.get(p.titular)
      if (!row) {
        row = {
          titular: p.titular,
          processos: 0,
          area_ha: 0,
          substancias: new Set(),
          risks: [],
        }
        map.set(p.titular, row)
      }
      row.processos += 1
      row.area_ha += p.area_ha
      row.substancias.add(p.substancia)
      if (p.risk_score !== null) row.risks.push(p.risk_score)
    }
    const rows = [...map.values()].map((r) => ({
      titular: r.titular,
      processos: r.processos,
      area_ha: r.area_ha,
      substancias: [...r.substancias].slice(0, 4),
      risk_medio:
        r.risks.length > 0
          ? Math.round(r.risks.reduce((a, b) => a + b, 0) / r.risks.length)
          : null,
    }))
    return rows
  }, [processosBase])

  const [rankPorArea, setRankPorArea] = useState(true)

  const rankingDisplay = useMemo(() => {
    const rows = [...rankingOrdenado]
    rows.sort((a, b) =>
      rankPorArea ? b.area_ha - a.area_ha : b.processos - a.processos,
    )
    return rows
  }, [rankingOrdenado, rankPorArea])

  const rankingConcentracaoTop3Pct = useMemo(() => {
    if (rankingDisplay.length === 0) return null
    const slice = rankingDisplay.slice(0, Math.min(3, rankingDisplay.length))
    if (rankPorArea) {
      const total = rankingDisplay.reduce((s, r) => s + r.area_ha, 0)
      if (total <= 0) return null
      const top = slice.reduce((s, r) => s + r.area_ha, 0)
      return Math.round((top / total) * 100)
    }
    const total = rankingDisplay.reduce((s, r) => s + r.processos, 0)
    if (total <= 0) return null
    const top = slice.reduce((s, r) => s + r.processos, 0)
    return Math.round((top / total) * 100)
  }, [rankingDisplay, rankPorArea])

  const kpiMemo = useMemo(() => {
    const list = processosBase
    const n = list.length
    const ativos = list.filter((p) => p.situacao === 'ativo').length
    const bloqueados = list.filter((p) => p.situacao === 'bloqueado').length
    const somaArea = list.reduce((s, p) => s + p.area_ha, 0)
    const scores = list.map((p) => p.risk_score).filter((x): x is number => x !== null)
    const riskMedio =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null
    const alto = list.filter((p) => p.risk_score !== null && p.risk_score >= 70).length
    const baixo = list.filter((p) => p.risk_score !== null && p.risk_score < 40).length
    const medio = list.filter(
      (p) => p.risk_score !== null && p.risk_score >= 40 && p.risk_score < 70,
    ).length
    const chavesEstrategicas = new Set<ChaveMineralEstrategico>()
    for (const p of list) {
      const ch = substanciaParaChaveEstrategica(p.substancia)
      if (ch) chavesEstrategicas.add(ch)
    }
    const mineraisEstrategicosOrdenados = ORDEM_MINERAL_ESTRATEGICO.filter((k) =>
      chavesEstrategicas.has(k),
    )
    const mineraisEstrategicosCount = mineraisEstrategicosOrdenados.length
    const mineraisEstrategicosSub = mineraisEstrategicosCount
      ? mineraisEstrategicosOrdenados
          .map((k) => LABEL_MINERAL_ESTRATEGICO[k])
          .join(' · ')
      : 'Nenhum nos filtros atuais'

    const processosRiscoAlto = list.filter(
      (p) => p.risk_score !== null && p.risk_score >= 70,
    ).length
    const pctRiscoAltoCarteira =
      n > 0 ? Math.round((processosRiscoAlto / n) * 100) : 0
    const subRiscoAlto =
      n > 0 ? `${pctRiscoAltoCarteira}% da carteira` : '0% da carteira'

    const somaValorMi = list.reduce((s, p) => s + p.valor_estimado_usd_mi, 0)
    return {
      n,
      ativos,
      bloqueados,
      somaArea,
      riskMedio,
      alto,
      baixo,
      medio,
      mineraisEstrategicosCount,
      mineraisEstrategicosSub,
      processosRiscoAlto,
      subRiscoAlto,
      somaValorMi,
    }
  }, [processosBase])

  const [busca, setBusca] = useState('')
  const [buscaFocada, setBuscaFocada] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 10

  const [ufOpen, setUfOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)

  const processosParaTabela = useMemo(() => {
    let rows = processosBase
    if (titularSelecionado) {
      rows = rows.filter((p) => p.titular === titularSelecionado)
    }
    return rows
  }, [processosBase, titularSelecionado])

  const processosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let rows = [...processosParaTabela]
    if (q) {
      rows = rows.filter(
        (p) =>
          p.numero.toLowerCase().includes(q) ||
          p.titular.toLowerCase().includes(q) ||
          p.substancia.toLowerCase().includes(q),
      )
    }
    if (sortCol) {
      const dir = sortAsc ? 1 : -1
      rows.sort((a, b) => {
        if (sortCol === 'area') return (a.area_ha - b.area_ha) * dir
        if (sortCol === 'risk') {
          const ar = a.risk_score ?? -1
          const br = b.risk_score ?? -1
          return (ar - br) * dir
        }
        return (FASE_ORDER.indexOf(a.fase) - FASE_ORDER.indexOf(b.fase)) * dir
      })
    }
    return rows
  }, [busca, sortCol, sortAsc, processosParaTabela])

  const totalFiltrados = processosFiltrados.length
  const maxPage = Math.max(0, Math.ceil(totalFiltrados / pageSize) - 1)

  useEffect(() => {
    setPage((p) => Math.min(p, maxPage))
  }, [maxPage])

  const pageSafe = Math.min(page, maxPage)
  const sliceStart = pageSafe * pageSize
  const sliceEnd = Math.min(sliceStart + pageSize, totalFiltrados)
  const linhasPagina = processosFiltrados.slice(sliceStart, sliceEnd)

  const indicadoresPagina = useMemo(
    () => indicadoresNumericosPagina(pageSafe, maxPage),
    [pageSafe, maxPage],
  )

  const toggleSort = (c: SortCol) => {
    if (sortCol === c) setSortAsc((s) => !s)
    else {
      setSortCol(c)
      setSortAsc(true)
    }
    setPage(0)
  }

  const exportarCsv = useCallback(() => {
    const sep = ';'
    const header = [
      'Processo',
      'Regime',
      'Substância',
      'Titular',
      'UF',
      'Área (ha)',
      'Fase',
      'Último despacho',
      'Risk Score',
      'Situação',
    ]
    const linhas = processosFiltrados.map((p) =>
      [
        p.numero,
        REGIME_LABELS[p.regime],
        p.substancia,
        p.titular.replaceAll(sep, ','),
        p.uf,
        String(p.area_ha).replace('.', ','),
        FASE_LABELS[p.fase],
        p.ultimo_despacho_data,
        p.risk_score === null ? '' : String(p.risk_score),
        situacaoLabel(p.situacao),
      ].join(sep),
    )
    const body = [header.join(sep), ...linhas].join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `terrae_processos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [processosFiltrados])

  const onRowClick = (p: Processo) => {
    navigateProcessoMapa(p.id)
  }

  const hoje = new Date().toLocaleDateString('pt-BR')

  const ufsUnicasFiltrados = useMemo(() => {
    const s = new Set(processosBase.map((p) => p.uf))
    return s.size
  }, [processosBase])

  const periodoDisponivelYm = useMemo(() => {
    let min = '9999-12'
    for (const p of PROCESSOS_MOCK) {
      const ym = p.data_protocolo.slice(0, 7)
      if (ym.localeCompare(min) < 0) min = ym
    }
    return { min }
  }, [])

  const periodoAtePlaceholderYm = yyyyMmMesAtualSistema()

  const textoBadgeResumoHeader = useMemo(() => {
    const n = processosBase.length
    if (!temFiltroAtivo) return ''
    if (n === 0) return 'Nenhum resultado · Filtrado'
    return `${n} de ${PROCESSOS_MOCK.length} processos · ${ufsUnicasFiltrados} estados`
  }, [processosBase.length, ufsUnicasFiltrados, temFiltroAtivo])

  const pillsAtivos = useMemo(() => {
    type PillAtiva = { key: string; text: string; onRemove: () => void }
    if (!temFiltroAtivo) return [] as PillAtiva[]
    const out: PillAtiva[] = []
    for (const uf of [...filtros.ufs].sort((a, b) => a.localeCompare(b))) {
      out.push({
        key: `uf-${uf}`,
        text: uf,
        onRemove: () =>
          updateFiltros((f) => ({ ...f, ufs: f.ufs.filter((u) => u !== uf) })),
      })
    }
    for (const sub of [...filtros.substancias].sort((a, b) => a.localeCompare(b))) {
      const texto = sub.slice(0, 10)
      out.push({
        key: `sub-${sub}`,
        text: texto,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            substancias: f.substancias.filter((s) => s !== sub),
          })),
      })
    }
    if (filtros.regime) {
      const regime = filtros.regime
      out.push({
        key: 'regime',
        text: REGIME_LABELS[regime as Regime],
        onRemove: () => updateFiltros({ regime: null }),
      })
    }
    const { inicio, fim } = filtros.periodo
    if (inicio && fim) {
      out.push({
        key: 'periodo-inicio',
        text: `A partir de ${formatYyyyMmBarra(inicio)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, inicio: null },
          })),
      })
      out.push({
        key: 'periodo-fim',
        text: `Até ${formatYyyyMmBarra(fim)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, fim: null },
          })),
      })
    } else if (inicio) {
      out.push({
        key: 'periodo-inicio',
        text: `A partir de ${formatYyyyMmBarra(inicio)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, inicio: null },
          })),
      })
    } else if (fim) {
      out.push({
        key: 'periodo-fim',
        text: `Até ${formatYyyyMmBarra(fim)}`,
        onRemove: () =>
          updateFiltros((f) => ({
            ...f,
            periodo: { ...f.periodo, fim: null },
          })),
      })
    }
    return out
  }, [filtros, temFiltroAtivo, updateFiltros])

  const textoEmptyConsolidado = useMemo(() => {
    const temPeriodo =
      filtros.periodo.inicio !== null || filtros.periodo.fim !== null
    const temUfSubReg =
      filtros.ufs.length > 0 ||
      filtros.substancias.length > 0 ||
      filtros.regime !== null
    if (temUfSubReg) {
      return 'Tente remover alguns filtros ou ajustar a combinação.'
    }
    if (temPeriodo) {
      return 'O período selecionado não contém processos. Tente ampliar o intervalo.'
    }
    return 'Ajuste os filtros acima para visualizar os dados.'
  }, [filtros])

  return (
    <div
      className="terrae-intel-dashboard-scroll box-border h-full min-h-0 flex-1"
      style={{
        backgroundColor: '#0D0D0C',
        padding: 24,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <div style={intelMotionGroupStyle(g1, reducedMotion)}>
      <header style={{ marginBottom: 0 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              color: '#F1EFE8',
            }}
          >
            Inteligência Mineral
          </h1>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: 16,
              color: '#888780',
            }}
          >
            Visão consolidada dos processos minerários monitorados
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
            paddingBottom: 16,
            borderBottom: '1px solid #2C2C2A',
          }}
        >
          <MonthPicker
            value={filtros.periodo.inicio}
            rangeHint={formatYyyyMmBarra(periodoDisponivelYm.min)}
            viewWhenEmptyYm={periodoDisponivelYm.min}
            variant="de"
            periodoMinYm={periodoDisponivelYm.min}
            otherBound={filtros.periodo.fim}
            onChange={(inicio) =>
              updateFiltros({
                periodo: {
                  ...filtros.periodo,
                  inicio,
                },
              })
            }
          />
          <MonthPicker
            value={filtros.periodo.fim}
            rangeHint={formatYyyyMmBarra(periodoAtePlaceholderYm)}
            viewWhenEmptyYm={periodoAtePlaceholderYm}
            variant="ate"
            periodoMinYm={periodoDisponivelYm.min}
            otherBound={filtros.periodo.inicio}
            onChange={(fim) =>
              updateFiltros({
                periodo: {
                  ...filtros.periodo,
                  fim,
                },
              })
            }
          />

          <div
            style={{
              width: 1,
              height: 26,
              backgroundColor: '#2C2C2A',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          <MultiSelectDropdown
            prefix="UF"
            options={UFS_INTEL_DASHBOARD}
            selected={filtros.ufs}
            onChange={(ufs) => updateFiltros({ ufs })}
            aberto={ufOpen}
            setAberto={setUfOpen}
          />

          <MultiSelectDropdown
            prefix="Substância"
            options={substanciasUnicasMock}
            selected={filtros.substancias}
            onChange={(substancias) => updateFiltros({ substancias })}
            aberto={subOpen}
            setAberto={setSubOpen}
          />

          {temFiltroAtivo ? (
            <div
              style={{
                width: 1,
                height: 26,
                backgroundColor: '#2C2C2A',
                margin: '0 4px',
                flexShrink: 0,
              }}
            />
          ) : null}

          <button
            type="button"
            onClick={limparFiltros}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 15,
              color: temFiltroAtivo ? '#F1B85A' : '#888780',
              cursor: temFiltroAtivo ? 'pointer' : 'default',
              opacity: temFiltroAtivo ? 1 : 0,
              pointerEvents: temFiltroAtivo ? 'auto' : 'none',
              transition: 'opacity 0.2s ease-out, color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (temFiltroAtivo) e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              if (temFiltroAtivo) e.currentTarget.style.color = '#F1B85A'
            }}
          >
            Limpar tudo
          </button>

          {temFiltroAtivo ? (
            <span
              className="terrae-intel-stat-badge"
              style={{
                marginLeft: 'auto',
                fontSize: 16,
                color: '#D3D1C7',
                border: '1px solid #2C2C2A',
                borderRadius: 6,
                padding: '10px 16px',
                transition: 'all 0.2s ease-out',
              }}
            >
              {textoBadgeResumoHeader}
            </span>
          ) : null}
        </div>
      </header>

      <div
        style={{
          marginBottom: temFiltroAtivo ? 12 : 0,
          marginTop: temFiltroAtivo ? 12 : 0,
          minHeight: temFiltroAtivo ? undefined : 0,
          maxHeight: temFiltroAtivo ? undefined : 0,
          overflow: temFiltroAtivo ? 'visible' : 'hidden',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {pillsAtivos.map((pill) => (
          <span
            key={pill.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 14,
              color: '#D3D1C7',
              backgroundColor: '#2C2C2A',
              border: '1px solid #3D3D3A',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            {pill.text}
            <button
              type="button"
              aria-label="Remover filtro"
              onClick={pill.onRemove}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F1EFE8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888780'
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: '#888780',
                fontSize: 14,
                lineHeight: 1,
                transition: 'color 0.2s ease',
              }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

        {/* KPIs */}
        <IntelKpiPortalTooltipProvider>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 12,
              marginTop: 16,
              alignItems: 'stretch',
            }}
          >
            <IntelKpiTooltip titulo="Processos monitorados" corpo={INTEL_KPI_TOOLTIP_CORPO_PROCESSOS}>
              <KpiCard
                valor={String(kpiMemo.n)}
                valorColor="#F1EFE8"
                label="Processos monitorados"
                sub={`${kpiMemo.ativos} ativos · ${kpiMemo.bloqueados} bloqueados`}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip titulo="Hectares mapeados" corpo={INTEL_KPI_TOOLTIP_CORPO_HECTARES}>
              <KpiCard
                valor={kpiMemo.somaArea.toLocaleString('pt-BR')}
                valorColor="#EF9F27"
                label="Hectares mapeados"
                sub={`≈ ${(kpiMemo.somaArea / 100).toFixed(0)} km²`}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip titulo="Risco médio da carteira" corpo={INTEL_KPI_TOOLTIP_CORPO_RISCO}>
              <KpiCard
                valor={kpiMemo.riskMedio === null ? 'N/D' : String(kpiMemo.riskMedio)}
                valorColor={
                  kpiMemo.riskMedio === null
                    ? '#5F5E5A'
                    : corRisk(kpiMemo.riskMedio)
                }
                label="Risco médio da carteira"
                sub={
                  <>
                    <span style={{ color: '#1D9E75' }}>{kpiMemo.baixo} baixo</span>
                    <span style={{ color: '#5F5E5A' }}> · </span>
                    <span style={{ color: '#E8A830' }}>{kpiMemo.medio} médio</span>
                    <span style={{ color: '#5F5E5A' }}> · </span>
                    <span style={{ color: '#E24B4A' }}>{kpiMemo.alto} alto</span>
                  </>
                }
                subFontSize={15}
                footer={
                  kpiMemo.riskMedio !== null && !filtrosSemProcessos ? (
                    <KpiRiskFaixaBarra valor={kpiMemo.riskMedio} />
                  ) : null
                }
                emptyFiltros={filtrosSemProcessos}
                infoTexto={INTEL_INFO_TEXTO_RISCO_KPI}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip
              titulo="Minerais estratégicos"
              corpo={INTEL_KPI_TOOLTIP_CORPO_MINERAIS_ESTRATEGICOS}
            >
              <KpiCard
                valor={String(kpiMemo.mineraisEstrategicosCount)}
                valorColor="#3D8B7A"
                label="Minerais estratégicos"
                sub={kpiMemo.mineraisEstrategicosSub}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip
              titulo="Processos em risco alto"
              corpo={INTEL_KPI_TOOLTIP_CORPO_PROCESSOS_RISCO_ALTO}
            >
              <KpiCard
                valor={String(kpiMemo.processosRiscoAlto)}
                valorColor="#E24B4A"
                label="Processos em risco alto"
                sub={kpiMemo.subRiscoAlto}
                subFontSize={15}
                emptyFiltros={filtrosSemProcessos}
              />
            </IntelKpiTooltip>
            <IntelKpiTooltip
              titulo="Valor potencial estimado"
              corpo={INTEL_KPI_TOOLTIP_CORPO_VALOR_POTENCIAL}
            >
              <KpiCard
                valor={formatValorPotencialKpi(kpiMemo.somaValorMi)}
                valorColor="#EF9F27"
                label="Valor potencial estimado"
                labelFontSize={14}
                labelColor="#FFFFFF"
                sub="Reservas mapeadas (USGS)"
                subFontSize={15}
                emptyFiltros={filtrosSemProcessos}
                infoTexto={INTEL_KPI_TOOLTIP_CORPO_VALOR_POTENCIAL}
              />
            </IntelKpiTooltip>
          </div>
        </IntelKpiPortalTooltipProvider>

        {filtrosSemProcessos ? (
          <div
            style={{
              boxSizing: 'border-box',
              width: '100%',
              marginTop: 16,
              padding: '80px 24px',
              backgroundColor: '#1A1A18',
              borderRadius: 12,
              border: '1px solid #2C2C2A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <IconBarrasEmptyConsolidado />
            <div style={{ height: 20 }} aria-hidden />
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 500,
                color: '#D3D1C7',
              }}
            >
              Nenhum processo encontrado para os filtros selecionados
            </p>
            <div style={{ height: 8 }} aria-hidden />
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: '#888780',
                maxWidth: 420,
              }}
            >
              {textoEmptyConsolidado}
            </p>
            <div style={{ height: 24 }} aria-hidden />
            <button
              type="button"
              onClick={limparFiltros}
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#5F5E5A',
                borderRadius: 6,
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 500,
                color: '#F1B85A',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#888780'
                e.currentTarget.style.color = '#F1EFE8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#5F5E5A'
                e.currentTarget.style.color = '#F1B85A'
              }}
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : null}
      </div>

        {!filtrosSemProcessos ? (
        <div style={intelMotionGroupStyle(g2, reducedMotion)}>
        <IntelLinhaPortalTooltipProvider>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginTop: 16,
            }}
          >
          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div
              style={
                filtrosSemProcessos
                  ? { marginBottom: 32 }
                  : {
                      display: 'grid',
                      gridTemplateColumns: 'minmax(112px, 1fr) minmax(72px, 2.5fr) auto',
                      columnGap: 8,
                      alignItems: 'center',
                      marginBottom: 32,
                    }
              }
            >
              <div
                style={{
                  ...(filtrosSemProcessos ? {} : { gridColumn: '1 / 3' }),
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#FFFFFF',
                  }}
                >
                  Distribuição por regime
                </p>
              </div>
              {!filtrosSemProcessos ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    flexShrink: 0,
                    color: '#5F5E5A',
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      width: 72,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Processos
                  </span>
                  <span
                    style={{
                      width: 96,
                      textAlign: 'center',
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Hectares
                  </span>
                </div>
              ) : null}
            </div>
            <div style={{ transition: 'opacity 0.2s ease' }}>
              {filtrosSemProcessos ? (
                <div style={INTEL_CARD_EMPTY_WRAP}>
                  <IconBarrasRegimeVazio />
                  <span style={INTEL_CARD_EMPTY_MSG}>Nenhum processo encontrado</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {porRegimeCalculado.map((r, ri) => {
                    const selecionado = filtros.regime === r.regime
                    const outroSelecionado = filtros.regime !== null && !selecionado
                    const op = outroSelecionado ? 0.35 : 1
                    const tooltipRegime = `${textoQuantidadeProcessos(r.count)} de ${r.label} totalizando ${r.area_ha.toLocaleString('pt-BR')} ha de área mapeada.`
                    return (
                      <IntelLinhaTooltip key={r.regime} lineId={`reg:${r.regime}`} texto={tooltipRegime}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => navigateRegimeMapa(r.regime)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigateRegimeMapa(r.regime)
                            }
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(112px, 1fr) minmax(72px, 2.5fr) auto',
                            columnGap: 8,
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: '#D3D1C7',
                              opacity: op,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            {r.label}
                          </span>
                          <div
                            style={{
                              minWidth: 0,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: '#2C2C2A',
                              overflow: 'hidden',
                              opacity: op,
                              filter: 'brightness(1)',
                              borderLeft: selecionado ? `3px solid ${r.cor}` : undefined,
                              boxSizing: 'border-box',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = 'brightness(1.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = 'brightness(1)'
                            }}
                          >
                            <div
                              style={intelBarFillStyle(
                                r.pct,
                                barsWidthReady,
                                ri,
                                reducedMotion,
                                r.cor,
                              )}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 20,
                              flexShrink: 0,
                              fontSize: 14,
                            }}
                          >
                            <span
                              style={{
                                width: 72,
                                textAlign: 'center',
                                color: '#D3D1C7',
                                fontWeight: 500,
                                opacity: op,
                              }}
                            >
                              {r.count}
                            </span>
                            <span
                              style={{
                                width: 96,
                                textAlign: 'center',
                                color: '#888780',
                                opacity: op,
                              }}
                            >
                              {r.area_ha.toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </IntelLinhaTooltip>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div style={{ transition: 'opacity 0.2s ease' }}>
              {filtrosSemProcessos ? (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        color: '#FFFFFF',
                      }}
                    >
                      PROCESSOS POR ESTADO
                    </p>
                  </div>
                  <div style={INTEL_CARD_EMPTY_WRAP}>
                    <IconMapaUfVazio />
                    <span style={INTEL_CARD_EMPTY_MSG}>Nenhum estado com processos</span>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    gap: 0,
                  }}
                >
                  <div
                    style={{
                      flex: '0 0 65%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      paddingRight: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 32,
                        flexShrink: 0,
                      }}
                    >
                      <p
                        style={{
                          flexShrink: 0,
                          margin: 0,
                          fontSize: 13,
                          textTransform: 'uppercase',
                          letterSpacing: '1.5px',
                          color: '#FFFFFF',
                          textAlign: 'left',
                        }}
                      >
                        PROCESSOS POR ESTADO
                      </p>
                      <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 20,
                          flexShrink: 0,
                          color: '#5F5E5A',
                          fontSize: 14,
                        }}
                      >
                        <span
                          style={{
                            width: 72,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Processos
                        </span>
                        <span
                          style={{
                            width: 80,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Risco médio
                        </span>
                      </div>
                    </div>
                    <div
                      className="terrae-uf-scroll"
                      style={{ maxHeight: 280, minHeight: 0 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                      {porUfCalculado.map((u, ui) => {
                        const pct = (u.count / maxUfCount) * 100
                        const barCor =
                          u.count === 0
                            ? '#2C2C2A'
                            : u.risk_medio === null
                              ? '#5F5E5A'
                              : corBarraUf(u.risk_medio)
                        const sel = filtros.ufs.includes(u.uf)
                        const algumUf = filtros.ufs.length > 0
                        const linhaHoverMapa = hoverUfProcessosEstado === u.uf
                        const yRisk =
                          u.risk_medio === null ? 'N/D' : String(u.risk_medio)
                        const tooltipUf = `${textoQuantidadeProcessos(u.count)} em ${u.uf}. Risk Score médio: ${yRisk} (${textoBaseadoEmScoresCalculados(u.scoredCount)}).`
                        return (
                          <IntelLinhaTooltip
                            key={u.uf}
                            lineId={`uf:${u.uf}`}
                            texto={tooltipUf}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (u.count <= 0) return
                                navigateEstadoMapa(u.uf)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  if (u.count <= 0) return
                                  navigateEstadoMapa(u.uf)
                                }
                              }}
                              onMouseEnter={() => {
                                if (u.count > 0) setHoverUfProcessosEstado(u.uf)
                              }}
                              onMouseLeave={() =>
                                setHoverUfProcessosEstado((h) =>
                                  h === u.uf ? null : h,
                                )
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                opacity:
                                  linhaHoverMapa ? 1 : algumUf && !sel ? 0.4 : 1,
                                filter: linhaHoverMapa
                                  ? 'brightness(1.12)'
                                  : undefined,
                                transition:
                                  'opacity 0.15s ease, filter 0.15s ease',
                              }}
                            >
                          <span
                            style={{
                              width: 32,
                              flexShrink: 0,
                              fontSize: 13,
                              fontWeight: 500,
                              color: sel ? '#EF9F27' : '#D3D1C7',
                            }}
                          >
                            {u.uf}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: '#2C2C2A',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={intelBarFillStyle(
                                pct,
                                barsWidthReady,
                                ui,
                                reducedMotion,
                                barCor,
                              )}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 20,
                              flexShrink: 0,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                width: 72,
                                textAlign: 'center',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ color: '#D3D1C7' }}>{u.count}</span>
                              {totalProcessosCarteiraUf > 0 ? (
                                <span style={{ color: '#888780' }}>
                                  {' '}
                                  (
                                  {Math.round(
                                    (u.count / totalProcessosCarteiraUf) * 100,
                                  )}
                                  %)
                                </span>
                              ) : null}
                            </span>
                            <div
                              style={{
                                width: 80,
                                textAlign: 'center',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {u.risk_medio !== null ? (
                                <span
                                  style={{
                                    fontSize: 13,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    backgroundColor: `${corRisk(u.risk_medio)}26`,
                                    color: corRisk(u.risk_medio),
                                    fontWeight: 500,
                                    display: 'inline-block',
                                    boxSizing: 'border-box',
                                    textAlign: 'center',
                                    width: 52,
                                  }}
                                >
                                  {u.risk_medio}
                                </span>
                              ) : (
                                <span style={{ color: '#5F5E5A' }}>N/D</span>
                              )}
                            </div>
                          </div>
                            </div>
                          </IntelLinhaTooltip>
                        )
                      })}
                      </div>
                    </div>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      backgroundColor: '#2C2C2A',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingLeft: 16,
                      overflow: 'hidden',
                    }}
                  >
                    <BrasilMiniMap
                      ufsResumo={porUfCalculado}
                      ufsFiltro={filtros.ufs}
                      highlightedUf={hoverUfProcessosEstado}
                      onHoverUfChange={setHoverUfProcessosEstado}
                      maxHeightPx={220}
                      onNavigateUfToMap={(uf) => navigateEstadoMapa(uf)}
                      onToggleUf={(uf) => {
                        updateFiltros((prev) => {
                          const has = prev.ufs.includes(uf)
                          return {
                            ...prev,
                            ufs: has
                              ? prev.ufs.filter((x) => x !== uf)
                              : [...prev.ufs, uf],
                          }
                        })
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </IntelLinhaPortalTooltipProvider>
        </div>
        ) : null}

        <div style={intelMotionGroupStyle(g3, reducedMotion)}>
        {/* Produção */}
        <div
          className="terrae-intel-hover-panel"
          style={{
            backgroundColor: '#1A1A18',
            borderRadius: 8,
            padding: 20,
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: '#FFFFFF',
                  minWidth: 0,
                }}
              >
                Produção histórica por substância
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              {SUB_KEYS.map((s) => {
                const on = subAtivas[s.key]
                const lockedByFilter = filtros.substancias.length > 0
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      if (lockedByFilter) {
                        const allowed = chavesGraficoParaSubstancias(filtros.substancias)
                        if (!allowed.has(s.key)) return
                      }
                      setSubAtivas((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                    }}
                    className={on ? undefined : 'terrae-intel-chart-pill-inactive'}
                    style={{
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor:
                        lockedByFilter &&
                        !chavesGraficoParaSubstancias(filtros.substancias).has(s.key)
                          ? 'default'
                          : 'pointer',
                      opacity:
                        lockedByFilter &&
                        !chavesGraficoParaSubstancias(filtros.substancias).has(s.key)
                          ? 0.4
                          : 1,
                      border: on ? `1px solid ${s.color}` : '1px solid #2C2C2A',
                      backgroundColor: on ? `${s.color}26` : '#2C2C2A',
                      color: on ? s.color : '#5F5E5A',
                    }}
                  >
                    {textoBadgeSubstanciaExibicao(s.label)}
                  </button>
                )
              })}
            </div>
          </div>
          <p style={{ margin: '0 0 32px 0', fontSize: 16, color: '#888780' }}>
            Variação da produção desde 2019
          </p>
          <div
            style={{
              width: '100%',
              minWidth: 0,
              height: 240,
              minHeight: 240,
              position: 'relative',
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 800, height: 240 }}
            >
              <LineChart
                key={reducedMotion ? 'still' : g3 ? 'draw' : 'pre'}
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="#2C2C2A"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="ano"
                  tick={{ fill: '#888780', fontSize: 13 }}
                  axisLine={{ stroke: '#2C2C2A' }}
                  tickLine={{ stroke: '#2C2C2A' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  padding={{ top: 0, bottom: 10 }}
                  tick={{ fill: '#888780', fontSize: 13 }}
                  axisLine={{ stroke: '#2C2C2A' }}
                  tickLine={{ stroke: '#2C2C2A' }}
                />
                <Tooltip
                  cursor={{ stroke: '#5F5E5A', strokeDasharray: '4 4' }}
                  content={(props) => (
                    <ProducaoTooltip
                      active={props.active}
                      label={props.label}
                      payload={props.payload}
                      subAtivas={subAtivas}
                    />
                  )}
                />
                {SUB_KEYS.map(
                  (s) =>
                    subAtivas[s.key] ? (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={textoBadgeSubstanciaExibicao(s.label)}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: s.color }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={chartLineAnimActive}
                        animationDuration={reducedMotion ? 1 : 800}
                        animationBegin={
                          reducedMotion ? 0 : MOTION_LINE_ANIMATION_BEGIN_MS[s.key]
                        }
                        animationEasing="ease-out"
                      />
                    ) : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>

        <div style={intelMotionGroupStyle(g4, reducedMotion)}>
        <CardUltimosAlertasLegislativos alertas={dashboardMock.alertas_recentes} />
        </div>

        {!filtrosSemProcessos ? (
        <div style={intelMotionGroupStyle(g5, reducedMotion)}>
        {/* Minerais + ranking */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginTop: 16,
          }}
        >
          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
              ...(mineraisEstrategicosDoFiltro.length === 0
                ? {
                    minHeight: INTEL_MINERAIS_RANKING_EMPTY_PANEL_MIN_PX,
                    display: 'flex',
                    flexDirection: 'column' as const,
                  }
                : {}),
            }}
          >
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#FFFFFF',
                  }}
                >
                  Minerais estratégicos
                </p>
              </div>
              {temFiltroAtivo && mineraisEstrategicosDoFiltro.length > 0 ? (
                <p
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: 11,
                    color: '#5F5E5A',
                  }}
                >
                  Filtrado por processos selecionados
                </p>
              ) : null}
            </div>
            {mineraisEstrategicosDoFiltro.length === 0 ? (
              <div
                style={{
                  ...INTEL_CARD_EMPTY_BODY_GROW,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <IconBarrasRegimeVazio />
                <span style={INTEL_CARD_EMPTY_MSG}>Nenhum mineral estratégico encontrado</span>
              </div>
            ) : (
              mineraisEstrategicosDoFiltro.map((m) => {
                const gapPp = m.reservas_pct - m.producao_pct
                const pctFmt = (x: number) =>
                  x.toLocaleString('pt-BR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  })
                const pillTendencia =
                  m.tendencia === 'alta'
                    ? {
                        bg: '#1D9E7526',
                        cor: '#1D9E75',
                        Icon: IconTendenciaUp,
                      }
                    : m.tendencia === 'estavel'
                      ? {
                          bg: '#2C2C2A',
                          cor: '#888780',
                          Icon: IconTendenciaMinus,
                        }
                      : {
                          bg: '#E24B4A26',
                          cor: '#E24B4A',
                          Icon: IconTendenciaDown,
                        }
                const TendenciaIcon = pillTendencia.Icon
                const tooltipDemanda = tooltipTextoDemandaPorNivel(m.demandaNivel)

                return (
                  <div
                    key={m.sigla}
                    role="button"
                    tabIndex={0}
                    className="terrae-intel-hover-subpanel"
                    onClick={() => navigateSubstanciaMapa(m.substancia)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigateSubstanciaMapa(m.substancia)
                      }
                    }}
                    style={{
                      backgroundColor: '#0D0D0C',
                      borderRadius: 6,
                      padding: '14px 16px',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#EF9F27',
                            flexShrink: 0,
                          }}
                        >
                          {m.sigla}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 400,
                            color: '#D3D1C7',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.substancia}
                        </span>
                      </div>
                      <TooltipDemandaPill
                        texto={tooltipDemanda}
                        hoverBackground={`${pillTendencia.cor}15`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 14,
                          fontWeight: 500,
                          color: pillTendencia.cor,
                          backgroundColor: pillTendencia.bg,
                          borderRadius: 999,
                          padding: '2px 14px',
                          flexShrink: 0,
                          transition: 'background-color 0.15s ease-out',
                        }}
                      >
                        Demanda
                        <TendenciaIcon size={12} color={pillTendencia.cor} aria-hidden={true} />
                      </TooltipDemandaPill>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 13, color: '#888780' }}>Reservas</span>
                      <span style={{ fontSize: 14, color: '#F1EFE8', fontWeight: 500 }}>
                        {pctFmt(m.reservas_pct)}%
                      </span>
                      <span style={{ fontSize: 13, color: '#5F5E5A' }}>·</span>
                      <span style={{ fontSize: 13, color: '#888780' }}>Produção</span>
                      <span style={{ fontSize: 14, color: '#F1EFE8', fontWeight: 500 }}>
                        {pctFmt(m.producao_pct)}%
                      </span>
                      <span style={{ fontSize: 13, color: '#5F5E5A' }}>·</span>
                      <TooltipHoverResumo
                        texto={INTEL_TOOLTIP_GAP_PRODUCAO}
                        maxWidth={INTEL_TOOLTIP_GAP_LARGURA}
                        wrapperLayout="inlineRow"
                      >
                        <>
                          <span style={{ fontSize: 13, color: '#888780' }}>Gap</span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: corGapOportunidadePp(gapPp),
                            }}
                          >
                            {formatarGapValorComPrefixo(gapPp)}
                          </span>
                        </>
                      </TooltipHoverResumo>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#EF9F27',
                        }}
                      >
                        USD {formatPrecoUsd(m.preco_usd_t)}/t
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div
            className="terrae-intel-hover-panel"
            style={{
              backgroundColor: '#1A1A18',
              borderRadius: 8,
              padding: 20,
              ...(rankingDisplay.length === 0
                ? {
                    minHeight: INTEL_MINERAIS_RANKING_EMPTY_PANEL_MIN_PX,
                    display: 'flex',
                    flexDirection: 'column' as const,
                  }
                : {}),
            }}
          >
            <div style={{ marginBottom: 32 }}>
              {rankingDisplay.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: RANKING_TITULARES_GRID_TEMPLATE,
                    columnGap: 8,
                    alignItems: 'center',
                    width: '100%',
                    borderLeft: '2px solid transparent',
                    paddingLeft: 8,
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ gridColumn: '1 / 2' }} aria-hidden />
                  <div style={{ gridColumn: '2 / 3', minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        color: '#FFFFFF',
                      }}
                    >
                      Ranking de titulares
                    </p>
                    {rankingConcentracaoTop3Pct != null ? (
                      <p style={{ margin: '6px 0 0 0', fontSize: 16, color: '#888780' }}>
                        {rankPorArea
                          ? `Top 3 concentram ${rankingConcentracaoTop3Pct}% da área total`
                          : `Top 3 concentram ${rankingConcentracaoTop3Pct}% dos processos`}
                      </p>
                    ) : null}
                  </div>
                  <span style={{ gridColumn: '3 / 4' }} aria-hidden />
                  <div
                    style={{
                      gridColumn: '4 / 7',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setRankPorArea(true)}
                      className="terrae-intel-rank-toggle"
                      style={{
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        backgroundColor: rankPorArea ? '#2C2C2A' : '#0D0D0C',
                        color: rankPorArea ? '#F1EFE8' : '#888780',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Por Área
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankPorArea(false)}
                      className="terrae-intel-rank-toggle"
                      style={{
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        backgroundColor: !rankPorArea ? '#2C2C2A' : '#0D0D0C',
                        color: !rankPorArea ? '#F1EFE8' : '#888780',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Por Processos
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#FFFFFF',
                  }}
                >
                  Ranking de titulares
                </p>
              )}
            </div>
            <div
              style={
                rankingDisplay.length === 0
                  ? {
                      ...INTEL_CARD_EMPTY_BODY_GROW,
                      transition: 'opacity 0.2s ease',
                    }
                  : { transition: 'opacity 0.2s ease' }
              }
            >
              {rankingDisplay.length === 0 ? (
                <>
                  <IconPodioRankingVazio />
                  <span style={INTEL_CARD_EMPTY_MSG}>Nenhum titular encontrado</span>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: RANKING_TITULARES_GRID_TEMPLATE,
                      columnGap: 8,
                      alignItems: 'center',
                      width: '100%',
                      marginBottom: 8,
                      borderLeft: '2px solid transparent',
                      paddingLeft: 8,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ gridColumn: '1 / 2' }} aria-hidden />
                    <span style={{ gridColumn: '2 / 3' }} aria-hidden />
                    <span
                      style={{
                        gridColumn: '3 / 4',
                        ...RANKING_TITULARES_HEAD_CELL,
                        ...RANKING_TITULARES_COL_SUBSTANCIAS,
                      }}
                    >
                      Substâncias
                    </span>
                    <span
                      style={{
                        gridColumn: '4 / 5',
                        ...RANKING_TITULARES_HEAD_CELL,
                        ...RANKING_TITULARES_COL_METRICA,
                      }}
                    >
                      {rankPorArea ? 'Hectares' : 'Processos'}
                    </span>
                    <span
                      style={{
                        gridColumn: '5 / 6',
                        ...RANKING_TITULARES_HEAD_CELL,
                        ...RANKING_TITULARES_RISCO_NA_GRID,
                      }}
                    >
                      Risco
                    </span>
                    <span
                      style={{ gridColumn: '6 / 7', ...RANKING_TITULARES_COL_ACAO }}
                      aria-hidden
                    />
                  </div>
                  {rankingDisplay.map((r, i) => {
                const sel = titularSelecionado === r.titular
                const temTit = titularSelecionado !== null
                return (
                  <div key={r.titular}>
                    {i > 0 ? (
                      <div style={{ height: 1, backgroundColor: '#2C2C2A', margin: '8px 0' }} />
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateTitularMapa(r.titular)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigateTitularMapa(r.titular)
                        }
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: RANKING_TITULARES_GRID_TEMPLATE,
                        columnGap: 8,
                        alignItems: 'center',
                        width: '100%',
                        cursor: 'pointer',
                        borderLeft: sel ? '2px solid #EF9F27' : '2px solid transparent',
                        backgroundColor: sel ? '#2C2C2A' : 'transparent',
                        marginLeft: 0,
                        paddingLeft: sel ? 6 : 8,
                        paddingTop: 4,
                        paddingBottom: 4,
                        borderRadius: 4,
                        opacity: temTit && !sel ? 0.5 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          gridColumn: '1 / 2',
                          fontSize: 12,
                          color: '#FFFFFF',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          gridColumn: '2 / 3',
                          minWidth: 0,
                          fontSize: 16,
                          color: '#D3D1C7',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.titular}
                      </span>
                      <div
                        style={{
                          gridColumn: '3 / 4',
                          display: 'flex',
                          flexWrap: 'nowrap',
                          gap: 4,
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        {r.substancias.slice(0, 2).map((sub) => {
                          const pill = estiloPillSubstanciaRanking(sub)
                          return (
                            <span
                              key={sub}
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                boxSizing: 'border-box',
                                display: 'inline-block',
                                ...pill,
                              }}
                            >
                              {sub}
                            </span>
                          )
                        })}
                      </div>
                      <span
                        style={{
                          gridColumn: '4 / 5',
                          ...RANKING_TITULARES_COL_METRICA,
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#EF9F27',
                        }}
                      >
                        {rankPorArea
                          ? `${r.area_ha.toLocaleString('pt-BR')} ha`
                          : `${r.processos}`}
                      </span>
                      <span style={{ gridColumn: '5 / 6', ...RANKING_TITULARES_RISCO_NA_GRID }}>
                        {r.risk_medio !== null ? (
                          <span
                            style={{
                              fontSize: 13,
                              padding: '3px 8px',
                              borderRadius: 4,
                              backgroundColor: `${corRisk(r.risk_medio)}26`,
                              color: corRisk(r.risk_medio),
                              fontWeight: 500,
                              display: 'inline-block',
                              boxSizing: 'border-box',
                              textAlign: 'center',
                              width: 52,
                            }}
                          >
                            {r.risk_medio}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 13,
                              padding: '3px 8px',
                              borderRadius: 4,
                              backgroundColor: '#2C2C2A',
                              color: '#5F5E5A',
                              fontWeight: 500,
                              display: 'inline-block',
                              boxSizing: 'border-box',
                              textAlign: 'center',
                              width: 52,
                            }}
                          >
                            N/D
                          </span>
                        )}
                      </span>
                      <span style={{ gridColumn: '6 / 7', ...RANKING_TITULARES_COL_ACAO }}>
                        {sel ? (
                          <button
                            type="button"
                            aria-label="Limpar titular"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTitularSelecionado(null)
                              setPage(0)
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#888780',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: '0 4px',
                            }}
                          >
                            ✕
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </div>
                )
              })}
                </>
              )}
            </div>
          </div>
        </div>
        </div>
        ) : null}

        <div style={intelMotionGroupStyle(g6, reducedMotion)}>
        {!filtrosSemProcessos ? (
        <div
          className="terrae-intel-hover-panel"
          style={{
            backgroundColor: '#1A1A18',
            borderRadius: 8,
            padding: 20,
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: '#FFFFFF',
              }}
            >
              Tabela de processos
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {processosParaTabela.length > 0 || busca.trim() !== '' ? (
                <div
                  style={{
                    position: 'relative',
                    width: 400,
                    flexShrink: 0,
                    height: 36,
                    boxSizing: 'border-box',
                    padding: '8px 12px 8px 36px',
                    backgroundColor: '#111110',
                    border: `1px solid ${buscaFocada ? '#EF9F27' : '#2C2C2A'}`,
                    borderRadius: 6,
                    transition: 'border-color 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconBuscaIntel
                    size={16}
                    color={buscaFocada ? '#EF9F27' : '#888780'}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      transition: 'opacity 0.2s ease',
                    }}
                  />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value)
                      setPage(0)
                    }}
                    onFocus={() => setBuscaFocada(true)}
                    onBlur={() => setBuscaFocada(false)}
                    placeholder="Buscar processo, titular ou substância..."
                    className="terrae-intel-busca-processos"
                    autoComplete="off"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      height: '100%',
                      boxSizing: 'border-box',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: 14,
                      color: '#F1EFE8',
                      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                      paddingRight: busca ? 28 : 12,
                      paddingLeft: 0,
                    }}
                  />
                  {busca ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Limpar busca"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setBusca('')
                        setPage(0)
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 4,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#888780',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#F1EFE8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#888780'
                      }}
                    >
                      <IconLimparBuscaIntel size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                disabled={totalFiltrados === 0}
                onClick={exportarCsv}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxSizing: 'border-box',
                  height: 36,
                  padding: '0 14px',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: totalFiltrados === 0 ? '#5F5E5A' : '#2C2C2A',
                  background: 'transparent',
                  color: totalFiltrados === 0 ? '#5F5E5A' : '#F1EFE8',
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: totalFiltrados === 0 ? 'default' : 'pointer',
                  opacity: totalFiltrados === 0 ? 0.55 : 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (totalFiltrados === 0) return
                  e.currentTarget.style.color = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#888780'
                }}
                onMouseLeave={(e) => {
                  if (totalFiltrados === 0) return
                  e.currentTarget.style.color = '#F1EFE8'
                  e.currentTarget.style.borderColor = '#2C2C2A'
                }}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                Exportar CSV
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', transition: 'opacity 0.2s ease' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
                transition: 'opacity 0.2s ease',
              }}
            >
              {totalFiltrados > 0 ? (
                <thead>
                  <tr style={{ backgroundColor: '#0D0D0C' }}>
                    <Th>Processo</Th>
                    <Th>Regime</Th>
                    <Th>Substância</Th>
                    <Th>Titular</Th>
                    <Th>UF</Th>
                    <ThSort
                      active={sortCol === 'area'}
                      asc={sortAsc}
                      onClick={() => toggleSort('area')}
                    >
                      Área (ha)
                    </ThSort>
                    <ThSort
                      active={sortCol === 'fase'}
                      asc={sortAsc}
                      onClick={() => toggleSort('fase')}
                    >
                      Fase
                    </ThSort>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 10px',
                        fontSize: 13,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#888780',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Último desp.
                    </th>
                    <ThSort
                      active={sortCol === 'risk'}
                      asc={sortAsc}
                      onClick={() => toggleSort('risk')}
                    >
                      Risk Score
                    </ThSort>
                    <Th>Situação</Th>
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {totalFiltrados === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, border: 'none', verticalAlign: 'middle' }}>
                      <div
                        style={{
                          ...INTEL_CARD_EMPTY_WRAP,
                          padding: '24px 16px',
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        <IconTabelaVazia />
                        <span style={INTEL_CARD_EMPTY_MSG}>Nenhum processo encontrado</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  linhasPagina.map((p, idx) => (
                    <tr
                      key={p.id}
                      onClick={() => onRowClick(p)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: idx % 2 === 0 ? '#1A1A18' : '#111110',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2C2C2A'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          idx % 2 === 0 ? '#1A1A18' : '#111110'
                      }}
                    >
                      <Td>{p.numero}</Td>
                      <Td>
                        <RegimeBadge regime={p.regime} variant="table" />
                      </Td>
                      <Td>
                        <BadgeSubstancia substancia={p.substancia} variant="intelTable" />
                      </Td>
                      <TdTitularTruncado titular={p.titular} />
                      <Td style={{ color: '#D3D1C7' }}>{p.uf}</Td>
                      <Td style={{ color: '#D3D1C7' }}>
                        {p.area_ha.toLocaleString('pt-BR')}
                      </Td>
                      <Td style={{ color: '#D3D1C7' }}>{FASE_LABELS[p.fase]}</Td>
                      <Td
                        style={{
                          color: corUltimoDespachoData(p.ultimo_despacho_data),
                          fontSize: 14,
                        }}
                      >
                        {fmtUltimoDespachoCelula(p.ultimo_despacho_data)}
                      </Td>
                      <Td>
                        {p.risk_score === null ? (
                          <span style={{ color: '#5F5E5A', fontSize: 14 }}>N/D</span>
                        ) : (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontSize: 13,
                              fontWeight: 500,
                              backgroundColor: `${corRisk(p.risk_score)}26`,
                              color: corRisk(p.risk_score),
                            }}
                          >
                            {p.risk_score}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 500,
                            backgroundColor:
                              p.situacao === 'ativo'
                                ? 'rgba(29, 158, 117, 0.15)'
                                : p.situacao === 'bloqueado'
                                  ? 'rgba(226, 75, 74, 0.15)'
                                  : 'rgba(136, 135, 128, 0.15)',
                            color:
                              p.situacao === 'ativo'
                                ? '#1D9E75'
                                : p.situacao === 'bloqueado'
                                  ? '#E24B4A'
                                  : '#888780',
                          }}
                        >
                          {situacaoLabel(p.situacao)}
                        </span>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalFiltrados > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 16,
              }}
            >
              <span style={{ fontSize: 13, color: '#5F5E5A' }}>
                {`Mostrando ${sliceStart + 1}-${sliceEnd} de ${totalFiltrados}`}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <button
                  type="button"
                  disabled={pageSafe <= 0}
                  aria-label="Página anterior"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    cursor: pageSafe <= 0 ? 'default' : 'pointer',
                    color: pageSafe <= 0 ? '#2C2C2A' : '#888780',
                  }}
                >
                  <IconChevronPagina dir="left" size={16} />
                </button>
                {indicadoresPagina.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span
                      key={`e-${idx}`}
                      style={{
                        minWidth: 28,
                        height: 28,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#888780',
                        userSelect: 'none',
                      }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item - 1)}
                      style={{
                        width: 28,
                        height: 28,
                        boxSizing: 'border-box',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: 13,
                        fontWeight: pageSafe + 1 === item ? 500 : 400,
                        cursor: 'pointer',
                        backgroundColor:
                          pageSafe + 1 === item ? '#EF9F27' : 'transparent',
                        color:
                          pageSafe + 1 === item ? '#0D0D0C' : '#888780',
                      }}
                      onMouseEnter={(e) => {
                        if (pageSafe + 1 === item) return
                        e.currentTarget.style.backgroundColor = '#2C2C2A'
                        e.currentTarget.style.color = '#F1EFE8'
                      }}
                      onMouseLeave={(e) => {
                        if (pageSafe + 1 === item) {
                          e.currentTarget.style.backgroundColor = '#EF9F27'
                          e.currentTarget.style.color = '#0D0D0C'
                          return
                        }
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = '#888780'
                      }}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={pageSafe >= maxPage}
                  aria-label="Próxima página"
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    cursor: pageSafe >= maxPage ? 'default' : 'pointer',
                    color: pageSafe >= maxPage ? '#2C2C2A' : '#888780',
                  }}
                >
                  <IconChevronPagina dir="right" size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        ) : null}

      <footer
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #2C2C2A',
          textAlign: 'center',
          fontSize: 11,
          color: '#5F5E5A',
        }}
      >
        Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo · Atualizado em {hoje}
      </footer>
    </div>
    </div>
  )
}

function KpiRiskFaixaBarra({ valor }: { valor: number }) {
  const v = Math.min(100, Math.max(0, valor))
  return (
    <div
      style={{
        marginTop: 8,
        position: 'relative',
        height: 8,
        width: '100%',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: 4,
          borderRadius: 999,
          background:
            'linear-gradient(to right, #1D9E75 0%, #1D9E75 40%, #E8A830 40%, #E8A830 70%, #E24B4A 70%, #E24B4A 100%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${v}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: '#F1EFE8',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

export function KpiCard({
  valor,
  valorColor,
  label,
  sub,
  emptyFiltros,
  infoTexto,
  footer,
  subFontSize = 15,
  labelFontSize = 15,
  labelColor = '#FFFFFF',
}: {
  valor: string
  valorColor: string
  label: string
  sub: ReactNode
  emptyFiltros?: boolean
  infoTexto?: string
  footer?: ReactNode
  subFontSize?: number
  labelFontSize?: number
  labelColor?: string
}) {
  /** Altura reservada para faixa de risco ou espaçador equivalente (8 + 8px). */
  const KPI_FOOTER_RUNWAY_PX = 16

  const valorExibido = emptyFiltros ? '\u2014' : valor
  const corValorExibido = emptyFiltros ? '#5F5E5A' : valorColor

  return (
    <div
      className="terrae-intel-hover-panel"
      style={{
        backgroundColor: '#1A1A18',
        borderRadius: 8,
        padding: 16,
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        opacity: emptyFiltros ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 500,
          color: corValorExibido,
        }}
      >
        {valorExibido}
      </div>
      <div
        style={{
          fontSize: labelFontSize,
          color: labelColor,
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {label}
        {infoTexto != null && infoTexto !== '' ? <InfoTooltip texto={infoTexto} /> : null}
      </div>
      {emptyFiltros ? (
        <>
          <div
            aria-hidden
            style={{ flex: 1, minHeight: 0, width: '100%' }}
          />
          <div
            style={{
              flexShrink: 0,
              transition: 'opacity 0.2s ease',
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontSize: 13, color: '#5F5E5A' }}>
              Sem resultados para os filtros ativos
            </span>
          </div>
          <div
            style={{
              flexShrink: 0,
              width: '100%',
              minHeight: KPI_FOOTER_RUNWAY_PX,
            }}
          >
            <div
              aria-hidden
              style={{ height: KPI_FOOTER_RUNWAY_PX, width: '100%' }}
            />
          </div>
        </>
      ) : (
        <>
          <div
            aria-hidden
            style={{ flex: 1, minHeight: 0, width: '100%' }}
          />
          <div
            style={{
              fontSize: subFontSize,
              color: '#888780',
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {sub}
          </div>
          <div
            style={{
              flexShrink: 0,
              width: '100%',
              minHeight: KPI_FOOTER_RUNWAY_PX,
            }}
          >
            {footer ?? (
              <div
                aria-hidden
                style={{ height: KPI_FOOTER_RUNWAY_PX, width: '100%' }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

const INTEL_TOOLTIP_TITULAR_LARGURA = 320

function TdTitularTruncado({ titular }: { titular: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncado, setTruncado] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setTruncado(el.scrollWidth > el.clientWidth)
  }, [titular])

  const span = (
    <span
      ref={ref}
      style={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: truncado ? 'help' : undefined,
      }}
    >
      {titular}
    </span>
  )

  return (
    <Td style={{ color: '#D3D1C7', maxWidth: 140 }}>
      {truncado ? (
        <TooltipHoverResumo
          texto={titular}
          maxWidth={INTEL_TOOLTIP_TITULAR_LARGURA}
          wrapperLayout="default"
        >
          {span}
        </TooltipHoverResumo>
      ) : (
        span
      )}
    </Td>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '12px 10px',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: '#FFFFFF',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function ThSort({
  children,
  active,
  asc,
  onClick,
}: {
  children: ReactNode
  active: boolean
  asc: boolean
  onClick: () => void
}) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '12px 10px',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: '#FFFFFF',
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onClick={onClick}
    >
      {children}{' '}
      <span style={{ opacity: active ? 1 : 0.4 }}>{active ? (asc ? '↑' : '↓') : '↑↓'}</span>
    </th>
  )
}

function Td({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <td
      style={{
        padding: '12px 10px',
        fontSize: 14,
        borderBottom: '1px solid #2C2C2A',
        ...style,
      }}
    >
      {children}
    </td>
  )
}

function formatValorTooltip(v: TooltipPayloadEntry['value']): string {
  if (v == null) return 'N/D'
  if (typeof v === 'number') return v.toFixed(1)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(String).join(', ')
  return 'N/D'
}

function formatValorTooltipPtBr(v: TooltipPayloadEntry['value']): string {
  const s = formatValorTooltip(v)
  return s === 'N/D' ? s : s.replace('.', ',')
}

function producaoPayloadNumero(v: TooltipPayloadEntry['value']): number | null | undefined {
  if (v === null || v === undefined) return v
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null
  }
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Índice 100 = 2019; exibir variação % com cor semântica. */
function formatVariacaoProducaoDesde2019(num: number): { text: string; color: string } {
  const v = Math.round(num - 100)
  if (v > 0) return { text: `+${v}%`, color: '#1D9E75' }
  if (v < 0) return { text: `${v}%`, color: '#E24B4A' }
  return { text: '0%', color: '#888780' }
}

function ProducaoTooltip({
  active,
  payload,
  label,
  subAtivas,
}: {
  active?: boolean
  payload?: ReadonlyArray<TooltipPayloadEntry>
  label?: string | number
  subAtivas: Record<string, boolean>
}) {
  if (!active || !payload?.length) return null
  const rows = [...payload].filter((p) => {
    const key = SUB_KEYS.find(
      (s) => textoBadgeSubstanciaExibicao(s.label) === String(p.name),
    )?.key
    return key ? subAtivas[key] : true
  })
  if (!rows.length) return null
  const corSerie = (p: TooltipPayloadEntry) =>
    (typeof p.color === 'string' ? p.color : undefined) ?? '#888780'
  return (
    <div
      style={{
        backgroundColor: '#2C2C2A',
        border: '1px solid #3a3a38',
        borderRadius: 8,
        padding: '12px 16px',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#888780' }}>{label}</p>
      {rows.map((p, i) => {
        const num = producaoPayloadNumero(p.value)
        const c = corSerie(p)
        const variacao =
          num !== null && num !== undefined
            ? formatVariacaoProducaoDesde2019(num)
            : null
        const valorFmt = variacao
          ? variacao.text
          : formatValorTooltipPtBr(p.value)
        const valorColor = variacao ? variacao.color : c
        return (
          <div
            key={String(p.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: i === 0 ? 0 : 6,
              fontSize: 13,
              color: '#D3D1C7',
              lineHeight: 1.4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: c,
                flexShrink: 0,
              }}
              aria-hidden
            />
            <span>
              {p.name}:{' '}
              <span style={{ fontWeight: 500, color: valorColor }}>{valorFmt}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
```


## 5. Componente pai / navegaÃ§Ã£o entre abas (telaAtiva)


### grep activeTab / setActiveTab / tabAtiva em src/components/

```text
(nenhum resultado; o projeto usa telaAtiva / setTelaAtiva no useAppStore)
```


### src/App.tsx (completo)

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CHROME_ENTER_MS_DEFAULT,
  CHROME_EXIT_MS_DEFAULT,
  MapChromeTransitionContext,
} from './context/MapChromeTransitionContext'
import { InteligenciaDashboard } from './components/dashboard/InteligenciaDashboard'
import { RadarDashboard } from './components/dashboard/RadarDashboard'
import { MapView } from './components/map/MapView'
import { Navbar } from './components/layout/Navbar'
import { useAppStore } from './store/useAppStore'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import {
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS,
  MOTION_OVERLAY_INNER_ENTER_MS,
  MOTION_OVERLAY_INNER_EXIT_MS,
  MOTION_OVERLAY_UNMOUNT_MS,
  MOTION_TAB_CROSSFADE_IN_MS,
  MOTION_TAB_CROSSFADE_OUT_MS,
  motionMs,
  motionStaggerBaseMs,
} from './lib/motionDurations'

function readCssMs(varName: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function readChromeDurations(): { exit: number; enter: number } {
  return {
    exit: readCssMs('--terrae-chrome-exit-ms', CHROME_EXIT_MS_DEFAULT),
    enter: readCssMs('--terrae-chrome-enter-ms', CHROME_ENTER_MS_DEFAULT),
  }
}

function isExtraTela(t: string): t is 'inteligencia' | 'radar' {
  return t === 'inteligencia' || t === 'radar'
}

const TAB_SLIDE_PX = 30

export default function App() {
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const mapChromeCollapsed =
    telaAtiva === 'inteligencia' || telaAtiva === 'radar'

  const reducedMotion = usePrefersReducedMotion()

  const [chromeExitMs, setChromeExitMs] = useState(CHROME_EXIT_MS_DEFAULT)
  const [chromeEnterMs, setChromeEnterMs] = useState(CHROME_ENTER_MS_DEFAULT)

  useEffect(() => {
    const apply = () => {
      const { exit, enter } = readChromeDurations()
      setChromeExitMs(exit)
      setChromeEnterMs(enter)
    }
    apply()
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const chromeTransitionMs = mapChromeCollapsed ? chromeExitMs : chromeEnterMs

  const [painelExtraMontado, setPainelExtraMontado] = useState(
    () => telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )
  /** Mantém Radar/Intel montados ao ir ao Mapa (estado interno preservado). */
  const [painelExtraOcultoParaMapa, setPainelExtraOcultoParaMapa] = useState(
    () => telaAtiva === 'mapa',
  )
  const [painelExtraOpaco, setPainelExtraOpaco] = useState(
    () => telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )

  const [overlayFadeMode, setOverlayFadeMode] = useState<'in' | 'out'>('in')
  const [renderedExtraTela, setRenderedExtraTela] = useState<
    'inteligencia' | 'radar'
  >(() => (telaAtiva === 'radar' ? 'radar' : 'inteligencia'))
  const [extraTabOpacity, setExtraTabOpacity] = useState(1)
  const [extraTabTranslateX, setExtraTabTranslateX] = useState(0)
  const [tabLayerInstant, setTabLayerInstant] = useState(false)
  const [tabContentTransition, setTabContentTransition] = useState(() =>
    reducedMotion
      ? 'opacity 1ms linear'
      : `opacity ${motionMs(MOTION_TAB_CROSSFADE_IN_MS, false)}ms ease-out`,
  )

  const prevTelaRef = useRef(telaAtiva)

  const enterDelayMs = motionMs(MOTION_OVERLAY_INNER_ENTER_DELAY_MS, reducedMotion)
  const enterDurMs = motionMs(MOTION_OVERLAY_INNER_ENTER_MS, reducedMotion)
  const exitDurMs = motionMs(MOTION_OVERLAY_INNER_EXIT_MS, reducedMotion)
  const unmountAfterExitMs = motionMs(MOTION_OVERLAY_UNMOUNT_MS, reducedMotion)
  const tabCrossOutMs = motionMs(MOTION_TAB_CROSSFADE_OUT_MS, reducedMotion)

  useEffect(() => {
    const prev = prevTelaRef.current
    prevTelaRef.current = telaAtiva

    if (isExtraTela(telaAtiva)) {
      if (!isExtraTela(prev)) {
        setRenderedExtraTela(telaAtiva)
        setExtraTabOpacity(1)
        setExtraTabTranslateX(0)
        setTabLayerInstant(false)
        setTabContentTransition(
          reducedMotion
            ? 'opacity 1ms linear'
            : `opacity ${motionMs(MOTION_TAB_CROSSFADE_IN_MS, reducedMotion)}ms ease-out`,
        )
        setOverlayFadeMode('in')
        setPainelExtraMontado(true)
        setPainelExtraOcultoParaMapa(false)
        setPainelExtraOpaco(false)
        let cancelled = false
        const id = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) setPainelExtraOpaco(true)
          })
        })
        return () => {
          cancelled = true
          cancelAnimationFrame(id)
        }
      }
      if (isExtraTela(prev) && prev !== telaAtiva) {
        const outMs = motionMs(MOTION_TAB_CROSSFADE_OUT_MS, reducedMotion)
        const inMs = motionMs(MOTION_TAB_CROSSFADE_IN_MS, reducedMotion)
        const goingToRadar = telaAtiva === 'radar'
        const exitX = goingToRadar ? -TAB_SLIDE_PX : TAB_SLIDE_PX

        if (reducedMotion) {
          setTabContentTransition('opacity 1ms linear')
          setExtraTabTranslateX(0)
          setExtraTabOpacity(0)
          const t = window.setTimeout(() => {
            setRenderedExtraTela(telaAtiva)
            setTabContentTransition('opacity 1ms linear')
            requestAnimationFrame(() => setExtraTabOpacity(1))
          }, tabCrossOutMs)
          return () => clearTimeout(t)
        }

        setTabLayerInstant(false)
        setTabContentTransition(
          `opacity ${outMs}ms ease-in, transform ${outMs}ms ease-in`,
        )
        setExtraTabTranslateX(exitX)
        setExtraTabOpacity(0)

        const t = window.setTimeout(() => {
          const enterX = -exitX
          setRenderedExtraTela(telaAtiva)
          setTabLayerInstant(true)
          setTabContentTransition('none')
          setExtraTabTranslateX(enterX)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTabLayerInstant(false)
              setTabContentTransition(
                `opacity ${inMs}ms ease-out, transform ${inMs}ms ease-out`,
              )
              setExtraTabTranslateX(0)
              setExtraTabOpacity(1)
            })
          })
        }, tabCrossOutMs)
        return () => clearTimeout(t)
      }
      return
    }

    if (isExtraTela(prev)) {
      setOverlayFadeMode('out')
      setPainelExtraOpaco(false)
      setPainelExtraOcultoParaMapa(true)
      return undefined
    }

    return undefined
  }, [telaAtiva, tabCrossOutMs, reducedMotion])

  const chromeCtx = useMemo(
    () => ({
      mapChromeCollapsed,
      chromeExitMs,
      chromeEnterMs,
      chromeTransitionMs,
    }),
    [mapChromeCollapsed, chromeExitMs, chromeEnterMs, chromeTransitionMs],
  )

  const overlayContentTransition =
    overlayFadeMode === 'in'
      ? `opacity ${enterDurMs}ms ease-out ${enterDelayMs}ms`
      : `opacity ${exitDurMs}ms ease-in`

  const intelStaggerBase = motionStaggerBaseMs(reducedMotion)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-dark-primary">
      <Navbar />
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 48px)' }}
      >
        <MapChromeTransitionContext.Provider value={chromeCtx}>
          <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            <MapView />
          </div>
        </MapChromeTransitionContext.Provider>

        {painelExtraMontado ? (
          <div
            className="pointer-events-auto absolute inset-0 z-[100] box-border flex min-h-0 flex-col overflow-hidden"
            style={{
              backgroundColor: '#0D0D0C',
              opacity: painelExtraOcultoParaMapa ? 0 : 1,
              visibility: painelExtraOcultoParaMapa ? 'hidden' : 'visible',
              pointerEvents: painelExtraOcultoParaMapa ? 'none' : 'auto',
            }}
            aria-hidden={painelExtraOcultoParaMapa}
          >
            <div
              className="box-border flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{
                opacity: painelExtraOpaco ? 1 : 0,
                transitionProperty: 'opacity',
                transition: overlayContentTransition,
              }}
            >
              <div
                className="box-border flex min-h-0 flex-1 flex-col overflow-hidden"
                style={{
                  opacity: extraTabOpacity,
                  transform:
                    reducedMotion || extraTabTranslateX === 0
                      ? 'translateX(0)'
                      : `translateX(${extraTabTranslateX}px)`,
                  transition: tabLayerInstant ? 'none' : tabContentTransition,
                }}
              >
                {renderedExtraTela === 'inteligencia' ? (
                  <InteligenciaDashboard
                    motionStaggerBaseMs={intelStaggerBase}
                    reducedMotion={reducedMotion}
                  />
                ) : (
                  <RadarDashboard reducedMotion={reducedMotion} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```


### src/components/layout/Navbar.tsx (completo)

```tsx
import { useAppStore } from '../../store/useAppStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { motionMs } from '../../lib/motionDurations'

export function Navbar() {
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)
  const reducedMotion = usePrefersReducedMotion()

  const linkMapa = telaAtiva === 'mapa'
  const linkIntel = telaAtiva === 'inteligencia'
  const linkRadar = telaAtiva === 'radar'

  const underlineTransition = `opacity ${motionMs(150, reducedMotion)}ms ease`

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between border-b border-dark-border bg-dark-primary px-4"
      style={{ height: 48 }}
    >
      <a href="/" className="flex items-center gap-2" aria-label="Terrae">
        <img
          src="/terradar-navbar-dark.png"
          alt=""
          width={200}
          height={32}
          className="block shrink-0"
          style={{
            width: 200,
            height: 32,
            objectFit: 'contain',
            objectPosition: 'left center',
          }}
        />
      </a>
      <nav className="flex items-center gap-[28px] text-[14px] tracking-wide">
        <button
          type="button"
          onClick={() => setTelaAtiva('mapa')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 font-normal transition-[color_150ms_ease] ${
            linkMapa
              ? 'text-[#F1EFE8]'
              : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
        >
          Mapa
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{ opacity: linkMapa ? 1 : 0, transition: underlineTransition }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => setTelaAtiva('radar')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 font-normal transition-[color_150ms_ease] ${
            linkRadar
              ? 'text-[#F1EFE8]'
              : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
        >
          Radar
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{ opacity: linkRadar ? 1 : 0, transition: underlineTransition }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => setTelaAtiva('inteligencia')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 font-normal transition-[color_150ms_ease] ${
            linkIntel
              ? 'text-[#F1EFE8]'
              : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
        >
          Inteligência
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{ opacity: linkIntel ? 1 : 0, transition: underlineTransition }}
            aria-hidden
          />
        </button>
      </nav>
    </header>
  )
}
```

