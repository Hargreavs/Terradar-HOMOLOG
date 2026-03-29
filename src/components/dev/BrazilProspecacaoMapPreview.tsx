/**
 * Pré-visualização temporária do mapa do Brasil por macrorregião (Step 4 wizard Prospecção).
 * Importar onde necessário para validar geometria; remover quando a animação final estiver pronta.
 */

import {
  BRAZIL_OUTLINE,
  BRAZIL_REGIONS,
  BRAZIL_VIEWBOX,
} from '../../lib/brazilMapPaths'

export function BrazilProspecacaoMapPreview() {
  return (
    <div
      style={{
        padding: 24,
        backgroundColor: '#0D0D0C',
        border: '1px solid #2C2C2A',
        borderRadius: 8,
        display: 'inline-block',
        boxSizing: 'border-box',
      }}
    >
      <p
        style={{
          margin: '0 0 12px 0',
          fontSize: 12,
          color: '#888780',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        Prévia: Brasil + 5 macrorregiões (paths IBGE / brasil-ufs-paths)
      </p>
      <svg
        viewBox={BRAZIL_VIEWBOX}
        width={300}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mapa do Brasil por macrorregião"
        style={{
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <path
          d={BRAZIL_OUTLINE}
          fill="#1A1A18"
          stroke="#3D3D3A"
          strokeWidth={0.35}
        />
        {BRAZIL_REGIONS.map((r) => (
          <path
            key={r.name}
            d={r.path}
            fill={r.color}
            fillOpacity={0.82}
            stroke="#0D0D0C"
            strokeWidth={0.35}
          />
        ))}
        {BRAZIL_REGIONS.map((r) => (
          <text
            key={`lbl-${r.name}`}
            x={r.cx}
            y={r.cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#F1EFE8"
            fontSize={9}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {r.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
