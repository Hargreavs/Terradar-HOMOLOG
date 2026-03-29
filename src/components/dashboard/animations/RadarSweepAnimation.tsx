import { useEffect, useRef, useState } from 'react'

const COLORS = {
  ambar: '#EF9F27',
  ambarLight: '#F1B85A',
  verde: '#1D9E75',
  textPrimary: '#F1EFE8',
  textSecondary: '#888780',
  bgPrimary: '#0D0D0C',
  border: '#2C2C2A',
}

const DETECTION_POINTS = [
  { x: 100, y: -160, color: '#5AA3D4', delay: 0.5 },
  { x: -80, y: -110, color: '#6DBF82', delay: 1.0 },
  { x: 166, y: 72, color: '#E0A96A', delay: 1.7 },
  { x: -137, y: 187, color: '#35B88A', delay: 2.3 },
  { x: 58, y: 230, color: '#A08FD4', delay: 3.0 },
  { x: -173, y: -58, color: '#CC6B6B', delay: 3.7 },
  { x: 122, y: -252, color: '#8DB86A', delay: 4.2 },
  { x: -43, y: 302, color: '#5AA3D4', delay: 4.6 },
]

const W = 800
const H = 800
const CX = 400
const CY = 400
const RADII = [80, 160, 240, 320]

export function RadarSweepAnimation() {
  const [elapsed, setElapsed] = useState(0)
  const raf = useRef<number | null>(null)
  const t0 = useRef<number | null>(null)

  useEffect(() => {
    const tick = (ts: number) => {
      if (t0.current == null) t0.current = ts
      setElapsed((ts - t0.current!) / 1000)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const sweep = (elapsed * 120) % 360
  const pulse = 1 + 0.3 * Math.abs(Math.sin(elapsed * Math.PI * 0.67))
  const rp1 = (elapsed * 0.67) % 1
  const rp2 = ((elapsed + 0.75) * 0.67) % 1

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <radialGradient id="sg1" cx="0" cy="0" r="1">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.28" />
            <stop offset="70%" stopColor={COLORS.ambar} stopOpacity="0.06" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cg1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.08" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <mask id="sm1">
            <rect width={W} height={H} fill="black" />
            {(() => {
              const a1 = ((sweep - 35) * Math.PI) / 180
              const a2 = ((sweep + 35) * Math.PI) / 180
              const r = 380
              return (
                <path
                  d={`M ${CX} ${CY} L ${CX + r * Math.cos(a1)} ${CY + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(a2)} ${CY + r * Math.sin(a2)} Z`}
                  fill="white"
                />
              )
            })()}
          </mask>
          <filter id="gl1">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sgl1">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={300} fill="url(#cg1)" />

        {Array.from({ length: Math.ceil(H / 45) + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 45}
            x2={W}
            y2={i * 45}
            stroke={COLORS.ambar}
            strokeOpacity={0.03}
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: Math.ceil(W / 45) + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 45}
            y1={0}
            x2={i * 45}
            y2={H}
            stroke={COLORS.ambar}
            strokeOpacity={0.03}
            strokeWidth={0.5}
          />
        ))}

        {RADII.map((r) => (
          <circle
            key={r}
            cx={CX}
            cy={CY}
            r={r}
            fill="none"
            stroke={COLORS.ambar}
            strokeOpacity={0.07}
            strokeWidth={0.7}
            strokeDasharray={r > 320 ? '4 6' : 'none'}
          />
        ))}

        <line
          x1={CX}
          y1={CY - 370}
          x2={CX}
          y2={CY + 370}
          stroke={COLORS.ambar}
          strokeOpacity={0.05}
          strokeWidth={0.5}
        />
        <line
          x1={CX - 370}
          y1={CY}
          x2={CX + 370}
          y2={CY}
          stroke={COLORS.ambar}
          strokeOpacity={0.05}
          strokeWidth={0.5}
        />
        <line
          x1={CX - 260}
          y1={CY - 260}
          x2={CX + 260}
          y2={CY + 260}
          stroke={COLORS.ambar}
          strokeOpacity={0.025}
          strokeWidth={0.5}
        />
        <line
          x1={CX + 260}
          y1={CY - 260}
          x2={CX - 260}
          y2={CY + 260}
          stroke={COLORS.ambar}
          strokeOpacity={0.025}
          strokeWidth={0.5}
        />

        <circle cx={CX} cy={CY} r={350} fill="url(#sg1)" mask="url(#sm1)" />
        {(() => {
          const a = ((sweep + 35) * Math.PI) / 180
          return (
            <line
              x1={CX}
              y1={CY}
              x2={CX + 350 * Math.cos(a)}
              y2={CY + 350 * Math.sin(a)}
              stroke={COLORS.ambar}
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          )
        })()}
        {(() => {
          const a = ((sweep - 35) * Math.PI) / 180
          return (
            <line
              x1={CX}
              y1={CY}
              x2={CX + 350 * Math.cos(a)}
              y2={CY + 350 * Math.sin(a)}
              stroke={COLORS.ambar}
              strokeOpacity={0.1}
              strokeWidth={0.5}
            />
          )
        })()}

        <circle
          cx={CX}
          cy={CY}
          r={8 * (1 + rp1 * 6)}
          fill="none"
          stroke={COLORS.ambar}
          strokeOpacity={0.3 * (1 - rp1)}
          strokeWidth={0.8}
        />
        <circle
          cx={CX}
          cy={CY}
          r={8 * (1 + rp2 * 6)}
          fill="none"
          stroke={COLORS.ambar}
          strokeOpacity={0.2 * (1 - rp2)}
          strokeWidth={0.6}
        />

        {DETECTION_POINTS.map((pt, i) => {
          if (elapsed <= pt.delay) return null
          const age = elapsed - pt.delay
          const e = Math.min(1, age / 0.5)
          const s = (1 - (1 - e) ** 3) * (1 + 0.05 * Math.sin(age * 2))
          const px = CX + pt.x
          const py = CY + pt.y
          const sz = 16
          return (
            <g key={i} opacity={e}>
              <rect
                x={px - sz * s}
                y={py - sz * s}
                width={sz * s * 2}
                height={sz * s * 2}
                rx={6}
                fill={pt.color}
                opacity={0.12}
                filter="url(#sgl1)"
              />
              <rect
                x={px - (sz * s) / 2}
                y={py - (sz * s) / 2}
                width={sz * s}
                height={sz * s}
                rx={3}
                fill={pt.color}
                opacity={0.9}
              />
              <rect
                x={px - (sz * s) / 2 + 2}
                y={py - (sz * s) / 2 + 2}
                width={sz * s - 4}
                height={Math.max(0, sz * s * 0.3)}
                rx={1.5}
                fill="white"
                opacity={0.12}
              />
              <line
                x1={px}
                y1={py}
                x2={CX}
                y2={CY}
                stroke={pt.color}
                strokeOpacity={0.06}
                strokeWidth={0.5}
                strokeDasharray="3 4"
              />
            </g>
          )
        })}

        <circle cx={CX} cy={CY} r={5 * pulse} fill={COLORS.ambar} filter="url(#gl1)" opacity={0.9} />
        <circle cx={CX} cy={CY} r={3} fill={COLORS.ambarLight} />
        <circle cx={CX} cy={CY} r={1.5} fill="white" opacity={0.6} />

        {RADII.map((r) => (
          <text
            key={`l${r}`}
            x={CX + r + 5}
            y={CY - 5}
            fill={COLORS.ambar}
            fillOpacity={0.12}
            fontSize={7}
            fontFamily="monospace"
            letterSpacing={0.5}
          >
            {r}km
          </text>
        ))}

        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180
          const major = i % 18 === 0
          const minor = i % 9 === 0
          const inn = major ? 335 : minor ? 340 : 345
          return (
            <line
              key={`t${i}`}
              x1={CX + inn * Math.cos(a)}
              y1={CY + inn * Math.sin(a)}
              x2={CX + 350 * Math.cos(a)}
              y2={CY + 350 * Math.sin(a)}
              stroke={COLORS.ambar}
              strokeOpacity={major ? 0.2 : minor ? 0.1 : 0.05}
              strokeWidth={major ? 1 : 0.5}
            />
          )
        })}

        {(
          [
            { l: 'N', a: -90 },
            { l: 'S', a: 90 },
            { l: 'E', a: 0 },
            { l: 'W', a: 180 },
          ] as const
        ).map(({ l, a }) => {
          const rad = (a * Math.PI) / 180
          return (
            <text
              key={l}
              x={CX + 365 * Math.cos(rad)}
              y={CY + 365 * Math.sin(rad) + 3}
              fill={COLORS.ambar}
              fillOpacity={0.12}
              fontSize={9}
              fontFamily="monospace"
              textAnchor="middle"
              letterSpacing={2}
            >
              {l}
            </text>
          )
        })}

        <text
          x={W - 20}
          y={H - 15}
          fill={COLORS.ambar}
          fillOpacity={0.15}
          fontSize={10}
          fontFamily="monospace"
          textAnchor="end"
          letterSpacing={4}
        >
          TERRADAR
        </text>
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: COLORS.verde,
              boxShadow: `0 0 8px ${COLORS.verde}`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: COLORS.textSecondary,
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Prospecção ativa
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            color: COLORS.ambar,
            opacity: 0.35,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'monospace',
          }}
        >
          {Math.floor(sweep)
            .toString()
            .padStart(3, '0')}
          °
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: COLORS.textSecondary,
              marginBottom: 6,
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Oportunidades identificadas
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {DETECTION_POINTS.map((pt, i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: elapsed > pt.delay ? pt.color : COLORS.border,
                  transition: 'background 0.6s ease',
                  opacity: elapsed > pt.delay ? 1 : 0.2,
                }}
              />
            ))}
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.ambar,
                marginLeft: 4,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'monospace',
              }}
            >
              {DETECTION_POINTS.filter((p) => elapsed > p.delay).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
