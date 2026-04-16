import { ChevronRight } from 'lucide-react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RiskScoreDecomposicao } from '../../types'
import {
  CORES_DIMENSAO_RISK,
  PESOS_RISK_DIMENSAO,
  corFaixaRiscoValor,
} from '../../lib/riskScoreDecomposicao'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import { RiskDimensionCalcTooltipContent } from './RiskScoreCalcTooltipContent'

/** Escala tipográfica alinhada ao drawer (`RelatorioCompleto` FS). */
const FS = {
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
} as const

type DimKey = 'geologico' | 'ambiental' | 'social' | 'regulatorio'

/** Abre/fecha com altura medida (evita `max-height: 2000px`, que deixa a transição artificial). */
function PainelDetalheDimensaoAnimado({
  isExp,
  corBar,
  children,
}: {
  isExp: boolean
  corBar: string
  children: ReactNode
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [maxPx, setMaxPx] = useState(0)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return

    if (!isExp) {
      setMaxPx(0)
      return
    }

    const measure = () => setMaxPx(el.scrollHeight)

    measure()
    const ro = new ResizeObserver(() => {
      measure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isExp])

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const transition = reduceMotion
    ? 'none'
    : 'max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.32s cubic-bezier(0.4, 0, 0.2, 1)'

  return (
    <div
      aria-hidden={!isExp}
      style={{
        maxHeight: maxPx,
        overflow: 'hidden',
        transition,
        marginTop: isExp ? 10 : 0,
        marginLeft: 20,
        paddingLeft: 12,
        borderLeft: `2px solid ${corBar}30`,
        boxSizing: 'border-box',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

function RiskPesosBarraQuatro() {
  const w = PESOS_RISK_DIMENSAO
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: w.geologico,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.geologico,
        }}
      />
      <div
        style={{
          flex: w.ambiental,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.ambiental,
        }}
      />
      <div
        style={{
          flex: w.social,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.social,
        }}
      />
      <div
        style={{
          flex: w.regulatorio,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_RISK.regulatorio,
        }}
      />
    </div>
  )
}

export function RiskDecomposicaoRelatorioPanel({
  decomposicao,
}: {
  decomposicao: RiskScoreDecomposicao
}) {
  const [aberto, setAberto] = useState<DimKey | null>(null)

  const dims = useMemo(
    () =>
      (
        [
          ['geologico', 'Geológico', 'Geo.', decomposicao.geologico],
          ['ambiental', 'Ambiental', 'Amb.', decomposicao.ambiental],
          ['social', 'Social', 'Soc.', decomposicao.social],
          ['regulatorio', 'Regulatório', 'Reg.', decomposicao.regulatorio],
        ] as const
      ).map(([key, label, labelPeso, det]) => ({
        key: key as DimKey,
        label,
        labelPeso,
        peso:
          key === 'geologico'
            ? PESOS_RISK_DIMENSAO.geologico
            : key === 'ambiental'
              ? PESOS_RISK_DIMENSAO.ambiental
              : key === 'social'
                ? PESOS_RISK_DIMENSAO.social
                : PESOS_RISK_DIMENSAO.regulatorio,
        det,
      })),
    [decomposicao],
  )

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 24 }}>
        <RiskPesosBarraQuatro />
        <div
          style={{
            display: 'flex',
            gap: 3,
            marginTop: 6,
            marginBottom: 16,
            maxWidth: '100%',
          }}
        >
          {dims.map((d) => (
            <div
              key={d.key}
              style={{
                flex: d.peso,
                minWidth: 0,
                fontSize: FS.sm,
                fontWeight: 400,
                color: '#888780',
                textAlign: 'center',
                lineHeight: 1.25,
              }}
            >
              {d.labelPeso} {d.peso}%
            </div>
          ))}
        </div>
      </div>

      {dims.map((d, di) => {
        const isExp = aberto === d.key
        const corBar = corFaixaRiscoValor(d.det.score)
        const varsMostrar =
          d.key === 'ambiental'
            ? d.det.variaveis.filter((v) => v.valor !== 0)
            : d.det.variaveis

        return (
          <div
            key={d.key}
            style={{ marginBottom: di === dims.length - 1 ? 12 : 14, minWidth: 0 }}
          >
            <button
              type="button"
              onClick={() => setAberto(isExp ? null : d.key)}
              className="group outline-none ring-0 ring-offset-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              style={{
                width: '100%',
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                padding: '6px 0',
                cursor: 'pointer',
                boxSizing: 'border-box',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 0,
                }}
              >
                <ChevronRight
                  size={14}
                  className={`shrink-0 transition-colors duration-150 ease-out ${
                    isExp
                      ? 'text-[#F1EFE8]'
                      : 'text-[#5F5E5A] group-hover:text-[#F1EFE8]'
                  }`}
                  style={{
                    transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition:
                      'transform 0.15s ease, color 0.15s ease-out',
                    flexShrink: 0,
                  }}
                  strokeWidth={2}
                  aria-hidden
                />
                <span
                  className={`transition-colors duration-150 ease-out ${
                    isExp
                      ? 'text-[#F1EFE8]'
                      : 'text-[#888780] group-hover:text-[#F1EFE8]'
                  }`}
                  style={{
                    fontSize: FS.md,
                    fontWeight: 700,
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexGrow: 0,
                  flexShrink: 0,
                  flexBasis: 'auto',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#2C2C2A',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, d.det.score))}%`,
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: corBar,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 40,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  <CamadaTooltipHover
                    conteudo={
                      <RiskDimensionCalcTooltipContent dim={d.key} det={d.det} />
                    }
                    maxWidthPx={280}
                    preferAbove
                    inlineWrap
                  >
                    <span
                      style={{
                        fontSize: FS.lg,
                        fontWeight: 700,
                        color: corBar,
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        borderBottom: `1px dotted ${corBar}`,
                        cursor: 'help',
                        lineHeight: 1.2,
                      }}
                    >
                      {d.det.score}
                    </span>
                  </CamadaTooltipHover>
                </div>
              </div>
            </button>

            <PainelDetalheDimensaoAnimado isExp={isExp} corBar={corBar}>
              {varsMostrar.map((vrow, vi) => {
                const corV = corFaixaRiscoValor(vrow.valor)
                const fonteTitle = `Fonte: ${vrow.fonte}`
                return (
                  <div key={`${vrow.nome}-${vi}`} style={{ marginTop: vi > 0 ? 12 : 0 }}>
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
                        title={fonteTitle}
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
                        {vrow.nome}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          flexShrink: 0,
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 600,
                            color: corV,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {vrow.valor}
                        </span>
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
                          width: `${Math.min(100, Math.max(0, vrow.valor))}%`,
                          backgroundColor: corV,
                          borderRadius: 2,
                          opacity: vrow.valor > 0 ? 0.85 : 0.35,
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#888780',
                        margin: '6px 0 0 0',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {vrow.texto}
                    </p>
                  </div>
                )
              })}
            </PainelDetalheDimensaoAnimado>
          </div>
        )
      })}
    </div>
  )
}
