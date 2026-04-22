import { createPortal } from 'react-dom'
import type { MutableRefObject, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TERRAE_MAP_CLEAR_FLOATING_UI } from '../../lib/mapFloatingUiEvents'

/** Padrão visual Terrae: tooltip lateral com seta (popover / mapa / sidebar). */
export const TERRA_SIDE_TOOLTIP_MAX_W = 300
export const TERRA_SIDE_TOOLTIP_FADE_MS = 140

const BUBBLE_BG = '#2C2C2A'
const BUBBLE_BORDER = '#3a3a38'

export const terraSideTooltipBubbleStyle = {
  backgroundColor: BUBBLE_BG,
  border: `1px solid ${BUBBLE_BORDER}`,
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
  padding: '10px 12px',
} as const

export type TerraTooltipPlacement = 'side' | 'above'

export type TerraSideTooltipPos =
  | { placement: 'side-right'; left: number; top: number }
  | { placement: 'side-left'; right: number; top: number }
  | { placement: 'above'; left: number; top: number }

export function useTerraSideTooltip(
  triggerRef: MutableRefObject<HTMLElement | null>,
  options?: { placement?: TerraTooltipPlacement },
): {
  show: () => void
  hide: () => void
  /** Chamar no `mouseleave` do gatilho: repõe hover após limpeza global (ex.: pan do mapa). */
  onTriggerPointerLeave: () => void
  open: boolean
  visible: boolean
  pos: TerraSideTooltipPos | null
} {
  const placement = options?.placement ?? 'side'
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<TerraSideTooltipPos | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Após `terrae-map-clear-floating-ui`, não reabrir até o cursor sair do gatilho (mapa move por baixo). */
  const blockShowUntilLeaveRef = useRef(false)

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 10

    if (placement === 'above') {
      const halfW = TERRA_SIDE_TOOLTIP_MAX_W / 2
      const pad = 8
      const center = r.left + r.width / 2
      const clampedLeft = Math.max(
        pad + halfW,
        Math.min(center, window.innerWidth - pad - halfW),
      )
      setPos({
        placement: 'above',
        left: clampedLeft,
        top: Math.max(4, r.top - gap),
      })
      return
    }

    const minSide = 120
    const spaceRight = window.innerWidth - r.right - gap
    const spaceLeft = r.left - gap
    const useRight = spaceRight >= minSide || spaceRight >= spaceLeft

    if (useRight) {
      const estW = TERRA_SIDE_TOOLTIP_MAX_W
      let left = r.right + gap
      if (left + estW > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - 8 - estW)
      }
      setPos({
        placement: 'side-right',
        left,
        top: r.top + r.height / 2,
      })
    } else {
      setPos({
        placement: 'side-left',
        right: window.innerWidth - r.left + gap,
        top: r.top + r.height / 2,
      })
    }
  }, [triggerRef, placement])

  const show = useCallback(() => {
    if (blockShowUntilLeaveRef.current) return
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    updatePosition()
    setOpen(true)
    requestAnimationFrame(() => setVisible(true))
  }, [updatePosition])

  const hide = useCallback(() => {
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setPos(null)
      closeTimerRef.current = null
    }, TERRA_SIDE_TOOLTIP_FADE_MS)
  }, [])

  const onTriggerPointerLeave = useCallback(() => {
    blockShowUntilLeaveRef.current = false
    hide()
  }, [hide])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onClear = () => {
      blockShowUntilLeaveRef.current = true
      hide()
    }
    window.addEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, onClear)
    return () => window.removeEventListener(TERRAE_MAP_CLEAR_FLOATING_UI, onClear)
  }, [hide])

  return { show, hide, onTriggerPointerLeave, open, visible, pos }
}

export function TerraSideTooltipPortal({
  texto,
  open,
  visible,
  pos,
  maxWidthPx = TERRA_SIDE_TOOLTIP_MAX_W,
}: {
  texto: string
  open: boolean
  visible: boolean
  pos: TerraSideTooltipPos | null
  maxWidthPx?: number
}) {
  if (!open || !pos) return null

  const arrowBorder = 'rgba(241, 239, 232, 0.12)'

  const arrowLeft = (
    <div
      aria-hidden
      className="shrink-0"
      style={{
        width: 0,
        height: 0,
        marginRight: -1,
        borderTop: '7px solid transparent',
        borderBottom: '7px solid transparent',
        borderRight: `8px solid ${BUBBLE_BG}`,
        filter: `drop-shadow(-1px 0 0 ${arrowBorder})`,
      }}
    />
  )

  const arrowRight = (
    <div
      aria-hidden
      className="shrink-0"
      style={{
        width: 0,
        height: 0,
        marginLeft: -1,
        borderTop: '7px solid transparent',
        borderBottom: '7px solid transparent',
        borderLeft: `8px solid ${BUBBLE_BG}`,
        filter: `drop-shadow(1px 0 0 ${arrowBorder})`,
      }}
    />
  )

  const arrowDown = (
    <div
      aria-hidden
      className="shrink-0"
      style={{
        width: 0,
        height: 0,
        marginTop: -1,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderTop: `8px solid ${BUBBLE_BG}`,
        filter: `drop-shadow(0 -1px 0 ${arrowBorder})`,
      }}
    />
  )

  const bubble = (
    <div
      className="text-[14px] font-normal leading-snug text-[#F1EFE8]"
      style={{
        ...terraSideTooltipBubbleStyle,
        maxWidth: maxWidthPx,
        minWidth: Math.min(220, maxWidthPx),
        boxSizing: 'border-box',
      }}
    >
      {texto}
    </div>
  )

  if (pos.placement === 'above') {
    return createPortal(
      <div
        role="tooltip"
        className="pointer-events-none flex flex-col items-center"
        style={{
          position: 'fixed',
          zIndex: 10050,
          left: pos.left,
          top: pos.top,
          opacity: visible ? 1 : 0,
          transform: 'translate(-50%, -100%)',
          transition: `opacity ${TERRA_SIDE_TOOLTIP_FADE_MS}ms ease-in-out`,
        }}
      >
        {bubble}
        {arrowDown}
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none flex items-center"
      style={{
        position: 'fixed',
        zIndex: 10050,
        top: pos.top,
        maxWidth: maxWidthPx,
        opacity: visible ? 1 : 0,
        transition: `opacity ${TERRA_SIDE_TOOLTIP_FADE_MS}ms ease-in-out`,
        transform: 'translateY(-50%)',
        ...(pos.placement === 'side-right'
          ? { left: pos.left }
          : { right: pos.right }),
      }}
    >
      {pos.placement === 'side-right' ? (
        <>
          {arrowLeft}
          {bubble}
        </>
      ) : (
        <>
          {bubble}
          {arrowRight}
        </>
      )}
    </div>,
    document.body,
  )
}

type TerraTooltipWrapProps = {
  texto: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  maxWidthPx?: number
  /** `above`: acima do alvo (ex. células estreitas). Padrão: `side`. */
  placement?: TerraTooltipPlacement
}

/**
 * Ativa o tooltip padrão ao hover. Usar em todo o sistema no lugar de `title=""`.
 */
export function TerraTooltipWrap({
  texto,
  children,
  className,
  style,
  maxWidthPx,
  placement = 'side',
}: TerraTooltipWrapProps) {
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const { show, onTriggerPointerLeave, open, visible, pos } =
    useTerraSideTooltip(triggerRef, {
      placement,
    })

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        style={style}
        onMouseEnter={show}
        onMouseLeave={onTriggerPointerLeave}
      >
        {children}
      </div>
      <TerraSideTooltipPortal
        texto={texto}
        open={open}
        visible={visible}
        pos={pos}
        maxWidthPx={maxWidthPx}
      />
    </>
  )
}
