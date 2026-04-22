import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  BRASIL_MINI_VIEWBOX,
  BRASIL_UF_PATH_D,
  BRASIL_UFS_PAINT_ORDER,
} from '../../data/brasil-ufs-paths'

export type UfMapaResumo = {
  uf: string
  count: number
  risk_medio: number | null
}

type Props = {
  ufsResumo: readonly UfMapaResumo[]
  ufsFiltro: string[]
  /** Clique na UF: drill para o mapa (tem prioridade sobre `onToggleUf`). */
  onNavigateUfToMap?: (uf: string) => void
  onToggleUf: (uf: string) => void
  /** Sincronização com linhas de barra (hover conjunto). */
  highlightedUf: string | null
  /**
   * Quando definido (ex.: hover numa substância), destaca vários estados de uma vez.
   * Tem prioridade sobre `highlightedUf` quando length > 0.
   */
  highlightedUfs?: string[] | null
  onHoverUfChange: (uf: string | null) => void
  /** Ocupa a largura/altura disponível da coluna (SVG responsivo). */
  fluid?: boolean
  /** Limite de altura do SVG em px (ex.: 220 no card Processos por estado). */
  maxHeightPx?: number
}

function corFillUf(risk: number | null, count: number): string {
  if (count === 0) return '#1A1A18'
  if (risk === null) return '#5F5E5A'
  if (risk < 40) return '#1D9E75'
  if (risk <= 69) return '#E8A830'
  return '#E24B4A'
}

const MAPA_TOOLTIP_DELAY_MS = 300
const MAPA_TOOLTIP_MAX_W = 280
const MAPA_TOOLTIP_GAP_PX = 10

function tooltipCenterXClamped(centerX: number): number {
  if (typeof window === 'undefined') return centerX
  const half = MAPA_TOOLTIP_MAX_W / 2 + 8
  return Math.min(
    window.innerWidth - half,
    Math.max(half, centerX),
  )
}

type TipState = {
  texto: string
  anchorX: number
  anchorTop: number
}

function BrasilMiniMap({
  ufsResumo,
  ufsFiltro: _ufsFiltro,
  onNavigateUfToMap,
  onToggleUf,
  highlightedUf,
  highlightedUfs,
  onHoverUfChange,
  fluid = true,
  maxHeightPx,
}: Props) {
  const mapByUf = useMemo(() => {
    const m = new Map<string, UfMapaResumo>()
    for (const u of ufsResumo) m.set(u.uf, u)
    return m
  }, [ufsResumo])

  const [tip, setTip] = useState<TipState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleRef = useRef(false)

  const limpar = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const updateAnchorFromPath = (el: SVGPathElement) => {
    const rect = el.getBoundingClientRect()
    return {
      anchorX: tooltipCenterXClamped(rect.left + rect.width / 2),
      anchorTop: rect.top,
    }
  }

  const portal =
    tip != null ? (
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: tip.anchorX,
          top: tip.anchorTop,
          transform: `translate(-50%, calc(-100% - ${MAPA_TOOLTIP_GAP_PX}px))`,
          zIndex: 200,
          maxWidth: MAPA_TOOLTIP_MAX_W,
          boxSizing: 'border-box',
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
        {tip.texto}
      </div>
    ) : null

  const wrapStyle: CSSProperties = fluid
    ? {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        margin: 0,
        padding: 0,
        lineHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        background: 'transparent',
        ...(maxHeightPx != null
          ? { maxHeight: maxHeightPx, overflow: 'hidden' as const }
          : {}),
      }
    : {
        width: '100%',
        maxWidth: 280,
        margin: '0 auto 16px',
        lineHeight: 0,
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        background: 'transparent',
      }

  const svgStyle: CSSProperties = fluid
    ? {
        display: 'block',
        width: '100%',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: maxHeightPx != null ? maxHeightPx : '100%',
        boxSizing: 'border-box',
        border: 'none',
        outline: 'none',
        stroke: 'none',
        boxShadow: 'none',
        background: 'transparent',
      }
    : {
        display: 'block',
        margin: '0 auto',
        width: 280,
        height: (71.58 / 68.46) * 280,
        border: 'none',
        outline: 'none',
        stroke: 'none',
        boxShadow: 'none',
        background: 'transparent',
      }

  return (
    <>
      <div style={wrapStyle}>
        <svg
          viewBox={BRASIL_MINI_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
          focusable="false"
          style={svgStyle}
        >
          {BRASIL_UFS_PAINT_ORDER.map((sigla) => {
            const d = BRASIL_UF_PATH_D[sigla]
            if (!d) return null
            const row = mapByUf.get(sigla)
            const count = row?.count ?? 0
            const risk = row?.risk_medio ?? null
            const fill = corFillUf(risk, count)
            const comDados = count > 0
            const hover =
              highlightedUfs != null && highlightedUfs.length > 0
                ? highlightedUfs.includes(sigla)
                : highlightedUf === sigla
            const fillOpacity = comDados ? (hover ? 1 : 0.7) : 1

            return (
              <path
                key={sigla}
                id={sigla}
                d={d}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke="#3D3D3A"
                strokeWidth={0.5}
                style={{
                  cursor: comDados ? 'pointer' : 'default',
                  transition: 'fill-opacity 0.2s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!comDados) return
                  onHoverUfChange(sigla)
                  limpar()
                  const el = e.currentTarget
                  const riscoTxt =
                    count === 0 ? 'N/D' : risk === null ? 'N/D' : String(risk)
                  const texto = `${sigla}: ${count} ${count === 1 ? 'processo' : 'processos'}, Risk médio ${riscoTxt}`
                  timerRef.current = setTimeout(() => {
                    timerRef.current = null
                    visibleRef.current = true
                    const a = updateAnchorFromPath(el)
                    setTip({ texto, anchorX: a.anchorX, anchorTop: a.anchorTop })
                  }, MAPA_TOOLTIP_DELAY_MS)
                }}
                onMouseMove={(e) => {
                  if (!comDados) return
                  const el = e.currentTarget
                  if (visibleRef.current) {
                    const a = updateAnchorFromPath(el)
                    setTip((t) =>
                      t ? { ...t, anchorX: a.anchorX, anchorTop: a.anchorTop } : t,
                    )
                  }
                }}
                onMouseLeave={() => {
                  onHoverUfChange(null)
                  limpar()
                  visibleRef.current = false
                  setTip(null)
                }}
                onClick={() => {
                  if (!comDados) return
                  if (onNavigateUfToMap) onNavigateUfToMap(sigla)
                  else onToggleUf(sigla)
                }}
                onKeyDown={(e) => {
                  if (!comDados) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (onNavigateUfToMap) onNavigateUfToMap(sigla)
                    else onToggleUf(sigla)
                  }
                }}
                tabIndex={comDados ? 0 : undefined}
              />
            )
          })}
        </svg>
      </div>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

export { BrasilMiniMap }
export default BrasilMiniMap
