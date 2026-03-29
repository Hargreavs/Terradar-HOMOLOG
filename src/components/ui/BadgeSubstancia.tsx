import type { CSSProperties } from 'react'
import { estiloBadgeSubstanciaPaletaV2 } from '../../lib/corSubstancia'

const BASE: CSSProperties = {
  borderRadius: 4,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  boxSizing: 'border-box',
  display: 'inline-block',
}

export type BadgeSubstanciaVariant = 'popup' | 'intelTable' | 'radarCompact'

export function BadgeSubstancia({
  substancia,
  variant,
}: {
  substancia: string
  variant: BadgeSubstanciaVariant
}) {
  const est = estiloBadgeSubstanciaPaletaV2(substancia)
  const fontSize = variant === 'popup' ? 11 : variant === 'radarCompact' ? 10 : 12
  const padding =
    variant === 'radarCompact' ? '1px 6px' : '2px 8px'
  return (
    <span
      style={{
        ...BASE,
        ...est,
        fontSize,
        padding,
      }}
    >
      {substancia.toLocaleUpperCase('pt-BR')}
    </span>
  )
}
