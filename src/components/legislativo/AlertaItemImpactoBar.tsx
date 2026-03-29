import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  calcularRelevancia,
  RELEVANCIA_MAP,
  type TipoImpacto,
} from '../../lib/relevanciaAlerta'
import type { NivelImpacto } from '../../types'

const ALERTA_IMPACTO_TIP_GAP_PX = 6
const ALERTA_IMPACTO_TIP_VIEWPORT_PAD_PX = 8

type AlertaImpactoTipPlacement = {
  left: number
  top: number
  transform: string
}

function computeAlertaImpactoTipPlacement(
  bar: DOMRect,
  tipW: number,
  tipH: number,
): AlertaImpactoTipPlacement {
  const g = ALERTA_IMPACTO_TIP_GAP_PX
  const pad = ALERTA_IMPACTO_TIP_VIEWPORT_PAD_PX
  const cx = bar.left + bar.width / 2
  const cy = bar.top + bar.height / 2
  const spaceLeft = bar.left - pad
  const useLeft = spaceLeft >= tipW + g

  if (useLeft) {
    let top = cy
    const halfH = tipH / 2
    top = Math.min(
      window.innerHeight - pad - halfH,
      Math.max(pad + halfH, top),
    )
    return {
      left: bar.left - g,
      top,
      transform: 'translate(-100%, -50%)',
    }
  }

  let left = cx
  const halfW = tipW / 2
  left = Math.min(
    window.innerWidth - pad - halfW,
    Math.max(pad + halfW, left),
  )

  const topAbove = bar.top - g
  if (topAbove - tipH >= pad) {
    return {
      left,
      top: topAbove,
      transform: 'translate(-50%, -100%)',
    }
  }

  let topBelow = bar.bottom + g
  const maxTop = window.innerHeight - pad - tipH
  if (topBelow > maxTop) {
    topBelow = Math.max(pad, maxTop)
  }
  return {
    left,
    top: topBelow,
    transform: 'translate(-50%, 0)',
  }
}

type AlertaItemImpactoBarProps = {
  nivel: NivelImpacto
  tipo_impacto: TipoImpacto
  /** Texto longo explicando o nível (ex.: relatório completo). Na Intel fica omitido. */
  textoDetalhe?: string
  zIndexTooltip?: number
  /**
   * Altura fixa da coluna da barra (px). No relatório (Mapa) evita esticar quando o título quebra linhas.
   * Omitido na Intel: a barra acompanha a altura do item.
   */
  barraAlturaFixaPx?: number
}

/** Barra 3px + zona de hover ~14px; tooltip à esquerda da barra ou acima/abaixo se não couber. */
export function AlertaItemImpactoBar({
  nivel,
  tipo_impacto,
  textoDetalhe,
  zIndexTooltip = 100,
  barraAlturaFixaPx,
}: AlertaItemImpactoBarProps) {
  const relevancia = calcularRelevancia(nivel, tipo_impacto)
  const { cor, label } = RELEVANCIA_MAP[relevancia]
  const zoneRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [opacity, setOpacity] = useState(0)
  const [transition, setTransition] = useState('opacity 150ms ease-out')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tipPlacement, setTipPlacement] = useState<AlertaImpactoTipPlacement>({
    left: 0,
    top: 0,
    transform: 'translate(-100%, -50%)',
  })

  const syncTipPos = useCallback(() => {
    const zone = zoneRef.current
    const tip = tooltipRef.current
    if (!zone || !tip) return
    const bar = zone.getBoundingClientRect()
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    if (tw < 1 || th < 1) return
    setTipPlacement(computeAlertaImpactoTipPlacement(bar, tw, th))
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    syncTipPos()
    const id = requestAnimationFrame(() => {
      syncTipPos()
    })
    return () => cancelAnimationFrame(id)
  }, [mounted, label, textoDetalhe, syncTipPos])

  useEffect(() => {
    if (!mounted) return
    const fn = () => syncTipPos()
    window.addEventListener('scroll', fn, true)
    window.addEventListener('resize', fn)
    return () => {
      window.removeEventListener('scroll', fn, true)
      window.removeEventListener('resize', fn)
    }
  }, [mounted, syncTipPos])

  const onEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setTransition('opacity 150ms ease-out')
    setMounted(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpacity(1))
    })
  }

  const onLeave = () => {
    setTransition('opacity 100ms ease-in')
    setOpacity(0)
    closeTimerRef.current = setTimeout(() => {
      setMounted(false)
      closeTimerRef.current = null
    }, 100)
  }

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    [],
  )

  const ariaLabel = textoDetalhe ? `${label}. ${textoDetalhe}` : label

  const outerBarStyle: CSSProperties =
    barraAlturaFixaPx != null
      ? {
          width: 14,
          flexShrink: 0,
          height: barraAlturaFixaPx,
          alignSelf: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
        }
      : {
          width: 14,
          flexShrink: 0,
          alignSelf: 'stretch',
          display: 'flex',
          flexDirection: 'column',
        }

  const portal =
    mounted && typeof document !== 'undefined' ? (
      <div
        ref={tooltipRef}
        role="tooltip"
        style={{
          position: 'fixed',
          left: tipPlacement.left,
          top: tipPlacement.top,
          transform: tipPlacement.transform,
          zIndex: zIndexTooltip,
          backgroundColor: '#2C2C2A',
          border: `1px solid ${cor}`,
          borderRadius: 6,
          padding: textoDetalhe ? '8px 10px' : '4px 10px',
          maxWidth: textoDetalhe ? 280 : undefined,
          width: textoDetalhe ? 'max-content' : undefined,
          boxSizing: 'border-box',
          pointerEvents: 'none',
          opacity,
          transition: `${transition}, left 0ms, top 0ms, transform 0ms`,
          boxShadow: textoDetalhe ? '0 4px 16px rgba(0, 0, 0, 0.45)' : 'none',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: cor,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        {textoDetalhe ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              fontWeight: 400,
              lineHeight: 1.45,
              color: '#D3D1C7',
              whiteSpace: 'normal',
            }}
          >
            {textoDetalhe}
          </div>
        ) : null}
      </div>
    ) : null

  return (
    <>
      <div style={outerBarStyle}>
        <div
          ref={zoneRef}
          aria-label={ariaLabel}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 3,
              flex: 1,
              minHeight: 0,
              borderRadius: '1px 0 0 1px',
              backgroundColor: cor,
            }}
          />
        </div>
      </div>
      {portal ? createPortal(portal, document.body) : null}
    </>
  )
}
