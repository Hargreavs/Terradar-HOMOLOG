import { createPortal } from 'react-dom'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { TERRAE_MAP_CLEAR_FLOATING_UI } from '../../lib/mapFloatingUiEvents'

const TIP_DELAY_MS = 300
const TIP_Z = 10060

type Place = 'right' | 'left' | 'above' | 'below'

function isUsableTriggerRect(r: DOMRectReadOnly): boolean {
  return (
    r.width >= 2 &&
    r.height >= 2 &&
    Number.isFinite(r.left) &&
    Number.isFinite(r.top) &&
    r.right > r.left + 0.5 &&
    r.bottom > r.top + 0.5
  )
}

/**
 * Tooltip de camada (sidebar): atraso 300 ms, estilo alinhado ao padrão dos riscos no popup.
 */
export function CamadaTooltipHover({
  texto,
  children,
  className = '',
  maxWidthPx = 240,
  bubbleBoxShadow,
  bubbleBackgroundColor = '#2C2C2A',
  bubbleBorder = '1px solid #3a3a38',
  bubblePadding = '6px 10px',
  /** Só acima do alvo (ex.: gatilho centrado no drawer lateral — evita lateral no mapa). */
  preferAbove = false,
  /** Abaixo do alvo, centrado (ex.: letra CAPAG). Ignora `preferAbove`. */
  preferBelow = false,
  /** `span` inline dentro de parágrafos (evita quebra de linha antes do gatilho). */
  inlineWrap = false,
}: {
  texto: string
  children: ReactNode
  className?: string
  /** Largura máxima do bubble (ex.: 300 no relatório do mapa). */
  maxWidthPx?: number
  /** Sombra do bubble (ex.: alertas legislativos). */
  bubbleBoxShadow?: string
  bubbleBackgroundColor?: string
  bubbleBorder?: string
  bubblePadding?: string
  preferAbove?: boolean
  preferBelow?: boolean
  inlineWrap?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement | HTMLSpanElement | null>(null)
  const blockShowUntilLeaveRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{
    left: number
    top: number
    place: Place
  } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openNow = () => {
    const el = wrapRef.current
    if (!el) return

    const applyRect = (r: DOMRectReadOnly) => {
      const gap = 8
      const vw = window.innerWidth
      const needW = Math.min(maxWidthPx, vw - 32)

      let place: Place
      let left: number
      let top: number

      if (preferBelow) {
        place = 'below'
        const half = needW / 2 + 12
        const center = r.left + r.width / 2
        left = Math.max(8 + half, Math.min(center, vw - 8 - half))
        top = r.bottom + gap
      } else if (preferAbove) {
        place = 'above'
        const half = needW / 2 + 12
        const center = r.left + r.width / 2
        left = Math.max(8 + half, Math.min(center, vw - 8 - half))
        top = Math.max(4, r.top - gap)
      } else {
        const spaceRight = vw - r.right - gap
        const spaceLeft = r.left - gap

        if (spaceRight >= needW + 8) {
          place = 'right'
          left = r.right + gap
          top = r.top + r.height / 2
        } else if (spaceLeft >= needW + 8) {
          place = 'left'
          left = r.left - gap
          top = r.top + r.height / 2
        } else {
          place = 'above'
          const half = needW / 2 + 12
          const center = r.left + r.width / 2
          left = Math.max(8 + half, Math.min(center, vw - 8 - half))
          top = Math.max(4, r.top - gap)
        }
      }

      setPos({ place, left, top })
      setOpen(true)
    }

    const tryLayout = (attempt: number) => {
      const r = el.getBoundingClientRect()
      if (!isUsableTriggerRect(r)) {
        if (attempt < 3) {
          requestAnimationFrame(() => tryLayout(attempt + 1))
        }
        return
      }
      applyRect(r)
    }

    tryLayout(0)
  }

  const onEnter = () => {
    if (blockShowUntilLeaveRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (!blockShowUntilLeaveRef.current) openNow()
    }, TIP_DELAY_MS)
  }

  const onLeave = () => {
    blockShowUntilLeaveRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setOpen(false)
    setPos(null)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    const onClear = () => {
      blockShowUntilLeaveRef.current = true
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setOpen(false)
      setPos(null)
    }
    window.addEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, onClear)
    return () => window.removeEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, onClear)
  }, [])

  const minBubbleW = Math.min(220, maxWidthPx)

  const transform =
    pos?.place === 'right'
      ? 'translateY(-50%)'
      : pos?.place === 'left'
        ? 'translate(-100%, -50%)'
        : pos?.place === 'below'
          ? 'translate(-50%, 0)'
          : 'translate(-50%, calc(-100% - 4px))'

  const bubble =
    open && pos
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none"
            style={{
              position: 'fixed',
              zIndex: TIP_Z,
              left: pos.left,
              top: pos.top,
              transform,
              maxWidth: maxWidthPx,
              minWidth: minBubbleW,
              padding: bubblePadding,
              fontSize: 13,
              lineHeight: 1.35,
              color: '#D3D1C7',
              backgroundColor: bubbleBackgroundColor,
              border: bubbleBorder,
              borderRadius: 6,
              boxSizing: 'border-box',
              transition: 'opacity 150ms ease',
              ...(bubbleBoxShadow != null && bubbleBoxShadow !== ''
                ? { boxShadow: bubbleBoxShadow }
                : {}),
            }}
          >
            {texto}
          </div>,
          document.body,
        )
      : null

  if (inlineWrap) {
    return (
      <span
        ref={wrapRef as RefObject<HTMLSpanElement>}
        className={className}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
        {bubble}
      </span>
    )
  }

  return (
    <div
      ref={wrapRef as RefObject<HTMLDivElement>}
      className={className}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {bubble}
    </div>
  )
}
