import type { CSSProperties, ReactNode } from 'react'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import {
  REGIME_BADGE_TOOLTIP,
  REGIME_COLORS,
  REGIME_COLORS_MAP,
  REGIME_LABELS,
} from '../../lib/regimes'
import type { Regime } from '../../types'

const TOOLTIP = {
  maxWidthPx: 340,
  bubblePadding: '10px 12px',
  preferBelow: true as const,
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function estiloVariante(
  regime: Regime,
  variant: RegimeBadgeVariant,
): { wrapClassName: string; spanStyle: CSSProperties } {
  const color = REGIME_COLORS[regime] ?? '#888780'
  const dotted = { borderBottom: `1px dotted ${color}` }
  if (variant === 'popup' || variant === 'drawer') {
    const c = REGIME_COLORS_MAP[regime] ?? color
    const baseDrawerExportAlign: CSSProperties =
      variant === 'drawer'
        ? {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 28,
            padding: '4px 12px',
            borderRadius: 6,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }
        : {}
    const spanStyle: CSSProperties = {
      display: variant === 'drawer' ? undefined : 'inline-block',
      borderRadius: variant === 'drawer' ? undefined : 4,
      padding: variant === 'drawer' ? undefined : '3px 10px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
      lineHeight: variant === 'drawer' ? 1.2 : 1.25,
      color: c,
      backgroundColor: 'transparent',
      border: `1.5px solid ${c}`,
      cursor: 'help',
      boxSizing: 'border-box' as const,
      ...baseDrawerExportAlign,
    }
    return {
      wrapClassName:
        variant === 'drawer'
          ? 'inline-flex min-h-[28px] max-w-full min-w-0 flex-1 items-stretch'
          : 'inline-block',
      spanStyle,
    }
  }
  return {
    wrapClassName: 'inline-flex max-w-full',
    spanStyle: {
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 13,
      fontWeight: 500,
      backgroundColor: `${color}26`,
      color,
      cursor: 'help',
      ...dotted,
    },
  }
}

export type RegimeBadgeVariant = 'popup' | 'drawer' | 'table'

export function RegimeBadge({
  regime,
  variant,
  className,
  children,
}: {
  regime: Regime
  variant: RegimeBadgeVariant
  /** Classes no wrapper do tooltip (ex.: mt-3 no popup). */
  className?: string
  children?: ReactNode
}) {
  const texto = REGIME_BADGE_TOOLTIP[regime]
  const label = REGIME_LABELS[regime]
  const { wrapClassName, spanStyle } = estiloVariante(regime, variant)

  const inner = (
    <span style={spanStyle}>
      {children ?? label}
    </span>
  )

  return (
    <CamadaTooltipHover
      texto={texto}
      maxWidthPx={TOOLTIP.maxWidthPx}
      bubblePadding={TOOLTIP.bubblePadding}
      preferBelow={TOOLTIP.preferBelow}
      className={
        className ? `${wrapClassName} ${className}` : wrapClassName
      }
    >
      {inner}
    </CamadaTooltipHover>
  )
}
