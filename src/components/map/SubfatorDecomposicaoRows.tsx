import { Loader2 } from 'lucide-react'

import type { SubfatorOutput } from '../../types/scoreBreakdown'
import {
  formatNumeroPt,
  formatPesoDimensaoLine,
  sanitizarRuídoDecimalNaProsa,
} from '../../lib/scoreBreakdownFormat'

const FS = { sm: 13, md: 14 } as const

const COR_BARRA_MAGNITUDE = '#6B7280'
const COR_TEXTO_VALOR = '#D3D1C7'

export function SubfatorBreakdownLoading() {
  return (
    <div
      style={{
        minHeight: 112,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        justifyContent: 'center',
      }}
    >
      <div className="flex items-center gap-2">
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin"
          style={{ color: '#EF9F27' }}
          aria-hidden
        />
        <span style={{ fontSize: FS.sm, color: '#888780' }}>
          A carregar decomposição S31…
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#2C2C2A' }} />
      <div style={{ height: 8, borderRadius: 4, background: '#2C2C2A', width: '78%' }} />
    </div>
  )
}

function PesoOuAjuste({ pesoPct }: { pesoPct: number | null }) {
  if (pesoPct == null) {
    return (
      <span style={{ fontSize: FS.sm, color: '#5F5E5A', fontStyle: 'italic' }}>
        ajuste
      </span>
    )
  }
  return (
    <span style={{ fontSize: FS.sm, color: '#5F5E5A' }}>
      {formatPesoDimensaoLine(pesoPct)}
    </span>
  )
}

export function SubfatorDecomposicaoRows({
  variant: _variant,
  subfatores,
}: {
  variant: 'risk' | 'oportunidade'
  subfatores: SubfatorOutput[]
}) {
  void _variant
  return (
    <>
      {subfatores.map((sf, vi) => {
        const pctMag = Math.min(100, Math.max(0, Number(sf.valor_bruto ?? sf.valor)))
        const fonteHover = sf.fonte?.trim() ? `Fonte: ${sf.fonte}` : undefined
        const textoLimpo = sanitizarRuídoDecimalNaProsa(sf.texto ?? '')
        return (
          <div key={`${sf.nome}-${vi}`} style={{ marginTop: vi > 0 ? 12 : 0 }}>
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
                title={fonteHover}
                style={{
                  fontSize: FS.md,
                  color: '#D3D1C7',
                  lineHeight: 1.35,
                  minWidth: 0,
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 120,
                  cursor: 'default',
                }}
              >
                {sf.nome}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'flex-end',
                  flexShrink: 0,
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: FS.md,
                    fontWeight: 600,
                    color: COR_TEXTO_VALOR,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatNumeroPt(sf.valor)}
                </span>
                <PesoOuAjuste pesoPct={sf.peso_pct} />
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
                  width: `${Math.min(100, Math.max(0, pctMag))}%`,
                  backgroundColor: COR_BARRA_MAGNITUDE,
                  borderRadius: 2,
                  opacity: sf.valor > 0 ? 0.92 : 0.45,
                }}
              />
            </div>
            {textoLimpo.trim() ? (
              <p
                style={{
                  fontSize: FS.sm,
                  color: '#888780',
                  margin: '6px 0 0 0',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {textoLimpo}
              </p>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
