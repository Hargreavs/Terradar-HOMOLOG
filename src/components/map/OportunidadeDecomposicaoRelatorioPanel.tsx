import { ChevronRight } from 'lucide-react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RelatorioOportunidadeData } from '../../data/relatorio.mock'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import {
  CORES_DIMENSAO_OS,
  corFaixaOS,
  type DimensaoOSKey,
} from '../../lib/oportunidadeRelatorioUi'
import { OportunidadeDimensionCalcTooltipContent } from './OportunidadeDimensionCalcTooltipContent'
import type { ScoreBreakdownView } from '../../hooks/useScoreBreakdown'
import {
  SubfatorBreakdownLoading,
  SubfatorDecomposicaoRows,
} from './SubfatorDecomposicaoRows'
import {
  partitionAtratividadeSubs,
} from '../../lib/scoreBreakdownDimUi'
import { formatNumeroPt } from '../../lib/scoreBreakdownFormat'

const FS = {
  sm: 13,
  md: 14,
  lg: 16,
} as const

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
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset da animacao ao recolher */
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

function OsPesosBarraTres({
  pesos,
}: {
  pesos: { atratividade: number; viabilidade: number; seguranca: number }
}) {
  const w = pesos
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
          flex: w.atratividade,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_OS.atratividade,
        }}
      />
      <div
        style={{
          flex: w.viabilidade,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_OS.viabilidade,
        }}
      />
      <div
        style={{
          flex: w.seguranca,
          minWidth: 0,
          backgroundColor: CORES_DIMENSAO_OS.seguranca,
        }}
      />
    </div>
  )
}

const DIM_CONFIG: {
  key: DimensaoOSKey
  label: string
  labelPeso: string
}[] = [
  { key: 'atratividade', label: 'Atratividade', labelPeso: 'Atrat.' },
  { key: 'viabilidade', label: 'Viabilidade', labelPeso: 'Viab.' },
  { key: 'seguranca', label: 'Segurança', labelPeso: 'Seg.' },
]

export function OportunidadeDecomposicaoRelatorioPanel({
  oportunidade,
  pesosPerfil,
  scoreBreakdown,
}: {
  oportunidade: RelatorioOportunidadeData
  pesosPerfil: { atratividade: number; viabilidade: number; seguranca: number }
  scoreBreakdown: ScoreBreakdownView
}) {
  const {
    data: breakdownData,
    loading: breakdownLoading,
    error: breakdownError,
  } = scoreBreakdown

  const [expandido, setExpandido] = useState<Record<DimensaoOSKey, boolean>>(
    () => ({
      atratividade: false,
      viabilidade: false,
      seguranca: false,
    }),
  )

  const dims = useMemo(() => {
    const pesos = pesosPerfil
    return DIM_CONFIG.map((c) => ({
      ...c,
      peso:
        c.key === 'atratividade'
          ? pesos.atratividade
          : c.key === 'viabilidade'
            ? pesos.viabilidade
            : pesos.seguranca,
      valorDim: oportunidade.dimensoes[c.key].valor,
    }))
  }, [oportunidade, pesosPerfil])

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 24 }}>
        <OsPesosBarraTres pesos={pesosPerfil} />
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
              {d.labelPeso} {Math.round(d.peso * 100)}%
            </div>
          ))}
        </div>
      </div>

      {dims.map((d, di) => {
        const isExp = expandido[d.key]
        const corDim = CORES_DIMENSAO_OS[d.key]
        const corBar = corFaixaOS(d.valorDim)

        return (
          <div
            key={d.key}
            style={{ marginBottom: di === dims.length - 1 ? 12 : 14, minWidth: 0 }}
          >
            <button
              type="button"
              onClick={() =>
                setExpandido((prev) => ({ ...prev, [d.key]: !prev[d.key] }))
              }
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
                    transition: 'transform 0.15s ease, color 0.15s ease-out',
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
                      width: `${Math.min(100, Math.max(0, d.valorDim))}%`,
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
                      <OportunidadeDimensionCalcTooltipContent
                        dim={d.key}
                        oportunidade={oportunidade}
                      />
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
                      {d.valorDim}
                    </span>
                  </CamadaTooltipHover>
                </div>
              </div>
            </button>

            <PainelDetalheDimensaoAnimado isExp={isExp} corBar={corDim}>
              {isExp ? (
                breakdownLoading ? (
                  <SubfatorBreakdownLoading />
                ) : breakdownError ? (
                  <p style={{ fontSize: FS.sm, color: '#E24B4A', margin: 0 }}>
                    {breakdownError}
                  </p>
                ) : (
                  (() => {
                    const rawSubs =
                      breakdownData?.dimensoes_oportunidade?.[d.key]?.subfatores ??
                      []
                    const { linhasSubfatores, bonusBadge } =
                      d.key === 'atratividade'
                        ? partitionAtratividadeSubs(rawSubs)
                        : { linhasSubfatores: rawSubs, bonusBadge: null }
                    if (
                      linhasSubfatores.length === 0 &&
                      (d.key !== 'atratividade' || !bonusBadge)
                    ) {
                      return (
                        <p
                          style={{
                            fontSize: FS.sm,
                            color: '#888780',
                            margin: 0,
                          }}
                        >
                          Nenhum subfator disponível para esta dimensão.
                        </p>
                      )
                    }
                    return (
                      <>
                        {linhasSubfatores.length > 0 ? (
                          <SubfatorDecomposicaoRows
                            variant="oportunidade"
                            subfatores={linhasSubfatores}
                          />
                        ) : null}
                        {d.key === 'atratividade' && bonusBadge ? (
                          <div
                            style={{
                              marginTop:
                                linhasSubfatores.length > 0 ? 10 : 0,
                              fontSize: FS.sm,
                              fontWeight: 600,
                              color: '#46A672',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            +
                            {formatNumeroPt(bonusBadge.valor)} pontos · Mineral
                            crítico
                          </div>
                        ) : null}
                      </>
                    )
                  })()
                )
              ) : null}
            </PainelDetalheDimensaoAnimado>
          </div>
        )
      })}

      {oportunidade.penalidades && oportunidade.penalidades.length > 0 ? (
        <div
          style={{
            marginTop: 20,
            borderRadius: 6,
            border: '1px solid rgba(248, 113, 113, 0.4)',
            background: 'rgba(248, 113, 113, 0.07)',
            padding: 10,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: FS.sm,
              fontWeight: 700,
              color: '#F87171',
              marginBottom: 6,
            }}
          >
            Penalidades aplicadas (motor S31)
          </div>
          {oportunidade.penalidades.map((p, i) => (
            <div
              key={`${i}-${p.slice(0, 20)}`}
              style={{ fontSize: FS.md, color: '#D3D1C7', lineHeight: 1.45, marginTop: i > 0 ? 4 : 0 }}
            >
              {p}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
