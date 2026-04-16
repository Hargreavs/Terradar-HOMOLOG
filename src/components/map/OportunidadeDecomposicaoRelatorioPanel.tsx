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
  qualificadorOS,
  type DimensaoOSKey,
} from '../../lib/oportunidadeRelatorioUi'
import { OportunidadeDimensionCalcTooltipContent } from './OportunidadeDimensionCalcTooltipContent'

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
}: {
  oportunidade: RelatorioOportunidadeData
  pesosPerfil: { atratividade: number; viabilidade: number; seguranca: number }
}) {
  const [expandido, setExpandido] = useState<Record<DimensaoOSKey, boolean>>(
    () => ({
      atratividade: true,
      viabilidade: true,
      seguranca: true,
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
      variaveis: oportunidade.decomposicao[c.key],
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
              {d.variaveis.map((vrow, vi) => {
                const impactoNeutro = vrow.impacto_neutro === true
                const q = impactoNeutro
                  ? { texto: 'Impacto neutro', cor: '#888780' }
                  : qualificadorOS(vrow.valor)
                const corV = impactoNeutro ? '#888780' : corFaixaOS(vrow.valor)
                const corBarra = impactoNeutro ? '#888780' : corFaixaOS(vrow.valor)
                const opacidadeBarra = impactoNeutro ? 0.5 : 0.85
                const tituloLinha = vrow.nome
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
                        {tituloLinha}
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
                        <span style={{ fontSize: FS.md, color: q.cor }}>{q.texto}</span>
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
                          backgroundColor: corBarra,
                          borderRadius: 2,
                          opacity:
                            vrow.valor > 0 ? opacidadeBarra : 0.35,
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
