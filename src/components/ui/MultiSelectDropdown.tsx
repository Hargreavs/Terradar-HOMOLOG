import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ACCENT,
  BG_SECONDARY,
  BORDER_DEFAULT,
  BG_PRIMARY,
  TEXT_BODY,
} from '../../lib/designTokens'

/** Botão-trigger dos filtros dropdown (Inteligência, Radar alertas). */
export const INTEL_FILTER_SELECT_TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  backgroundColor: BG_PRIMARY,
  border: `1px solid ${BORDER_DEFAULT}`,
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 15,
  color: TEXT_BODY,
  cursor: 'pointer',
  outline: 'none',
}

function ChevronDownIcon({
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

type MultiSelectProps = {
  prefix: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  aberto: boolean
  setAberto: (v: boolean) => void
  triggerStyle?: CSSProperties
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
          backgroundColor: BG_SECONDARY,
          border: `1px solid ${BORDER_DEFAULT}`,
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
                    border: `1px solid ${BORDER_DEFAULT}`,
                    backgroundColor: on ? ACCENT : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? <CheckMini /> : null}
                </span>
                <span style={{ fontSize: 13, color: TEXT_BODY }}>
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
        <ChevronDownIcon aberto={aberto} stroke="#D3D1C7" size={14} />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}
