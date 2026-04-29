import type { S31SubfatorItem } from '../../../lib/s31SubfatorDecomp'

const FS = { md: 14 } as const

export function SubfatorPanel({
  items,
  totalDim,
}: {
  items: S31SubfatorItem[]
  totalDim: number
}) {
  return (
    <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: '1px solid #2C2C2A' }}>
      {items.map((it, i) => {
        const contrib = it.desativado ? 0 : it.valor * it.peso
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: FS.md,
              marginTop: i > 0 ? 8 : 0,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={
                  it.desativado
                    ? { color: '#5F5E5A', textDecoration: 'line-through' }
                    : { color: '#D3D1C7' }
                }
              >
                {it.nome}{' '}
                <span style={{ color: '#888780' }}>({(it.peso * 100).toFixed(0)}%)</span>
              </div>
              {it.fonte ? (
                <div style={{ color: '#5F5E5A', fontSize: 12, marginTop: 2 }}>
                  {it.fonte}
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: '#888780',
                  width: 36,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {it.valor}
              </span>
              <span
                style={{
                  color: '#E8A830',
                  width: 44,
                  textAlign: 'right',
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                +{contrib.toFixed(1)}
              </span>
            </div>
          </div>
        )
      })}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #2C2C2A',
          paddingTop: 8,
          marginTop: 8,
          fontSize: FS.md,
        }}
      >
        <span style={{ color: '#D3D1C7' }}>Total da dimensão</span>
        <span
          style={{ color: '#F1EFE8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {totalDim}
        </span>
      </div>
    </div>
  )
}
