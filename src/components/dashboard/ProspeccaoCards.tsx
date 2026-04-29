import {
  cloneElement,
  isValidElement,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Check } from 'lucide-react'
import { SELECTED_INSET_BG, SELECTED_INSET_RING } from '../../lib/radar/tokens'

const baseLayout: CSSProperties = {
  textAlign: 'left',
  borderRadius: 10,
  padding: '18px 20px',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease-out, background-color 0.15s ease-out, box-shadow 0.15s ease-out',
  width: '100%',
  boxSizing: 'border-box',
  position: 'relative',
  borderWidth: 1,
  borderStyle: 'solid',
}

/** Superfície comum: cartões de escolha (ex.: apetite de risco no wizard Radar). */
function cardSurface(selected: boolean, isHovered: boolean): Pick<
  CSSProperties,
  'borderColor' | 'backgroundColor' | 'boxShadow'
> {
  if (selected) {
    return {
      borderColor: 'rgba(245, 158, 11, 0.6)',
      backgroundColor: SELECTED_INSET_BG,
      boxShadow: `${SELECTED_INSET_RING}, 0 0 8px rgba(245, 158, 11, 0.08)`,
    }
  }
  if (isHovered) {
    return {
      borderColor: '#888780',
      backgroundColor: '#1A1A18',
      boxShadow: 'none',
    }
  }
  return {
    borderColor: '#2C2C2A',
    backgroundColor: '#111110',
    boxShadow: 'none',
  }
}

export function RiscoCard({
  selected,
  onClick,
  icon,
  iconSelectedColor,
  label,
  desc,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  iconSelectedColor: string
  label: string
  desc: string
}) {
  const [hover, setHover] = useState(false)
  const isHovered = hover && !selected
  const surface = cardSurface(selected, isHovered)

  const iconColor = selected ? iconSelectedColor : isHovered ? '#B4B2A9' : '#888780'
  const iconEl =
    isValidElement(icon) && icon != null
      ? cloneElement(icon as ReactElement<{ size?: number; color?: string }>, {
          size: 18,
          color: iconColor,
        })
      : icon

  const iconContainerBg = selected
    ? 'rgba(245, 158, 11, 0.12)'
    : isHovered
      ? '#2C2C2A'
      : '#1A1A18'

  const descColor = selected ? '#B4B2A9' : isHovered ? '#B4B2A9' : '#888780'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...baseLayout,
        ...surface,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: iconContainerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
        >
          {iconEl}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: selected || isHovered ? '#F1EFE8' : '#D3D1C7',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: descColor,
              marginTop: 2,
            }}
          >
            {desc}
          </div>
        </div>
      </div>
      {selected ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: 12,
            transform: 'translateY(-50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'rgb(245, 158, 11)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={12} color="#0D0D0C" strokeWidth={3} />
        </div>
      ) : null}
    </button>
  )
}
