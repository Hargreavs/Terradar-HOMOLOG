import { ArrowLeft, ChevronRight, Info, SearchX } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { Processo } from '../../types'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'
import {
  buildDescricoesBarras,
  computeDimScoresFromCard,
  corBolinhaAtencao,
  flattenVariaveis,
  gerarFatoresDestacados,
  scoreTotalFromDimScores,
  type VariavelPontuacao,
} from '../../lib/opportunityCardCopy'
import { resolveOpportunityCardVariaveis } from '../../lib/opportunityCardMockData'
import {
  CORES_DIMENSAO,
  PESOS_PERFIL,
  corFaixaOpportunity,
  corMiniBarraValor,
  faixaFromScore,
  qualificadorTextoMiniBarra,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { GridBreathingResultadosAnimation } from './animations/GridBreathingResultadosAnimation'
import { barFillStyle, motionGroupStyle } from '../../lib/motionStyles'
import { TODAS_SUBST } from '../../lib/substancias'


/** Borda 1px — dourado mais suave que o accent pleno (#EF9F27) */
const OPPORTUNITY_CARD_SELECTED_BORDER = 'rgba(239, 159, 39, 0.38)'
const OPPORTUNITY_CARD_SELECTED_SHADOW = '0 0 12px rgba(239, 159, 39, 0.05)'

const pillUnified: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 14px',
  borderRadius: 20,
  fontSize: 14,
  fontWeight: 500,
  backgroundColor: '#1A1A18',
  color: '#B4B2A9',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2C2C2A',
}

function perfilDotColor(proRisco: PerfilRisco): string {
  if (proRisco === 'conservador') return '#1D9E75'
  if (proRisco === 'moderado') return '#E8A830'
  return '#E24B4A'
}

function titleCaseSubst(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/** Cor do texto da posição no ranking (#1 ouro, #2 prata, #3 bronze, demais neutro). */
function corRanking(posicao: number): string {
  if (posicao === 1) return '#EF9F27'
  if (posicao === 2) return '#B4B2A9'
  if (posicao === 3) return '#C07840'
  return '#5F5E5A'
}

function faixaLabelCurto(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return 'Alta'
  if (faixa === 'moderada') return 'Moderada'
  if (faixa === 'baixa') return 'Baixa'
  return 'Não recomendado'
}

/** Fontes exibidas no `title` de cada variável do drilldown */
const FONTES_DRILLDOWN: Record<string, string> = {
  'Relevância da substância': 'Fonte: USGS Mineral Commodity Summaries',
  'Gap reserva/produção': 'Fonte: ANM/SIGMINE',
  'Preço USD/t': 'Fonte: Trading Economics, USGS',
  'Tendência de demanda': 'Fonte: USGS, relatórios setoriais',
  'Valor estimado da reserva': 'Fonte: ANM/SIGMINE, Trading Economics',
  'CAPAG do município': 'Fonte: STN/SICONFI',
  'CAPAG município': 'Fonte: STN/SICONFI',
  'Fase do processo': 'Fonte: ANM/SIGMINE',
  'Infraestrutura logística': 'Fonte: DNIT, ANTT, ANTAQ',
  'Área do processo': 'Fonte: ANM/SIGMINE',
  'Autonomia fiscal': 'Fonte: STN/SICONFI',
  'Situação do processo': 'Fonte: ANM/SIGMINE',
  'Incentivos regionais': 'Fonte: BNDES, Sudene, Sudam',
  'Solidez geral': 'Fonte: Cálculo TERRADAR (média ponderada dos riscos)',
  'Conformidade ambiental': 'Fonte: ICMBio, IBAMA, CAR/SICAR',
  'Regularidade regulatória': 'Fonte: ANM/SIGMINE, Adoo',
  'Histórico de despachos': 'Fonte: ANM/SIGMINE',
  'Ausência de restrições': 'Fonte: Adoo (Diários Oficiais)',
  'Alertas favoráveis': 'Fonte: Adoo (Diários Oficiais)',
}

function perfilNomeTitulo(p: PerfilRisco | null): string {
  if (p === 'conservador') return 'Conservador'
  if (p === 'arrojado') return 'Arrojado'
  return 'Moderado'
}

function PesoBarDrilldown({
  pesos,
  heightPx,
}: {
  pesos: { a: number; b: number; c: number }
  heightPx: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        height: heightPx,
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div style={{ flex: pesos.a, minWidth: 0, backgroundColor: CORES_DIMENSAO.atratividade }} />
      <div style={{ flex: pesos.b, minWidth: 0, backgroundColor: CORES_DIMENSAO.viabilidade }} />
      <div style={{ flex: pesos.c, minWidth: 0, backgroundColor: CORES_DIMENSAO.seguranca }} />
    </div>
  )
}

const PERFIS_TOOLTIP_ORDER: PerfilRisco[] = ['conservador', 'moderado', 'arrojado']

function PerfilTooltipArrow({ pointsDown }: { pointsDown: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        lineHeight: 0,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {pointsDown ? (
        <svg width="8" height="4" viewBox="0 0 8 4">
          <polygon points="0,0 8,0 4,4" fill="#1A1A18" stroke="#3C3C3A" strokeWidth="0.75" />
        </svg>
      ) : (
        <svg width="8" height="4" viewBox="0 0 8 4">
          <polygon points="0,4 8,4 4,0" fill="#1A1A18" stroke="#3C3C3A" strokeWidth="0.75" />
        </svg>
      )}
    </div>
  )
}

function PerfilPesosTooltipPanel({ perfilAtivo }: { perfilAtivo: PerfilRisco }) {
  return (
    <div
      style={{
        background: '#1A1A18',
        border: '1px solid #3C3C3A',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {PERFIS_TOOLTIP_ORDER.map((p, idx) => {
        const pesos = PESOS_PERFIL[p]
        const pa = Math.round(pesos.a * 100)
        const pv = Math.round(pesos.b * 100)
        const ps = Math.round(pesos.c * 100)
        const nome = perfilNomeTitulo(p)
        return (
          <div key={p} style={{ marginBottom: idx < PERFIS_TOOLTIP_ORDER.length - 1 ? 10 : 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#D3D1C7' }}>
              {nome}
              {perfilAtivo === p ? (
                <span style={{ fontWeight: 400, color: '#888780', fontSize: 14 }}> (atual)</span>
              ) : null}
            </div>
            <div style={{ marginTop: 4 }}>
              <PesoBarDrilldown pesos={pesos} heightPx={4} />
            </div>
            <div style={{ fontSize: 13, color: '#888780', marginTop: 4 }}>
              A {pa}% · V {pv}% · S {ps}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ProspeccaoResultados({
  resultados,
  excluidosCount,
  resultadosDescartados,
  processoById,
  proRisco,
  proSubst,
  proUfs,
  selectedResultId,
  setSelectedResultId,
  cardVis,
  barsReady,
  reducedMotion,
  navigateProcessoMapa,
  handleRefinarBusca,
  handleVoltarAoRadar,
  showToast,
}: {
  resultados: OpportunityResult[]
  excluidosCount: number
  resultadosDescartados: OpportunityResult[]
  processoById: Map<string, Processo>
  proRisco: PerfilRisco | null
  proSubst: string[]
  proUfs: string[]
  selectedResultId: string | null
  setSelectedResultId: (id: string | null) => void
  cardVis: boolean[]
  barsReady: boolean
  reducedMotion: boolean
  navigateProcessoMapa: (id: string) => void
  handleRefinarBusca: () => void
  handleVoltarAoRadar: () => void
  showToast: (m: string) => void
}) {
  const cardsGridRef = useRef<HTMLDivElement>(null)
  const [drilldownOpen, setDrilldownOpen] = useState<string | null>(null)
  const drilldownOpenRef = useRef<string | null>(null)
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)
  const [showDescartados, setShowDescartados] = useState(false)
  const [perfilPesosInfoHover, setPerfilPesosInfoHover] = useState(false)
  const perfilInfoBtnRef = useRef<HTMLButtonElement | null>(null)
  const perfilTooltipFloatingRef = useRef<HTMLDivElement | null>(null)
  const perfilHoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [perfilInfoTooltipBelow, setPerfilInfoTooltipBelow] = useState(false)
  const [perfilTooltipPos, setPerfilTooltipPos] = useState<{ top: number; left: number } | null>(
    null,
  )

  const clearPerfilHoverLeaveTimer = useCallback(() => {
    if (perfilHoverLeaveTimerRef.current != null) {
      clearTimeout(perfilHoverLeaveTimerRef.current)
      perfilHoverLeaveTimerRef.current = null
    }
  }, [])

  const openPerfilPesosInfo = useCallback(() => {
    clearPerfilHoverLeaveTimer()
    setPerfilPesosInfoHover(true)
  }, [clearPerfilHoverLeaveTimer])

  const scheduleClosePerfilPesosInfo = useCallback(() => {
    clearPerfilHoverLeaveTimer()
    perfilHoverLeaveTimerRef.current = window.setTimeout(() => {
      perfilHoverLeaveTimerRef.current = null
      setPerfilPesosInfoHover(false)
    }, 120)
  }, [clearPerfilHoverLeaveTimer])

  /** Flip drilldown: fade-out → swap → fade-in (um card por vez) */
  const [flipActiveId, setFlipActiveId] = useState<string | null>(null)
  const [flipOpaque, setFlipOpaque] = useState(true)
  const flipTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    drilldownOpenRef.current = drilldownOpen
  }, [drilldownOpen])

  useEffect(() => {
    return () => {
      for (const id of flipTimersRef.current) clearTimeout(id)
      flipTimersRef.current = []
    }
  }, [])

  const beginFlipOpen = useCallback(
    (processoId: string) => {
      if (reducedMotion) {
        setDrilldownOpen(processoId)
        return
      }
      const prev = drilldownOpenRef.current
      if (prev != null && prev !== processoId) {
        setDrilldownOpen(processoId)
        return
      }
      setFlipActiveId(processoId)
      setFlipOpaque(false)
      const t1 = window.setTimeout(() => {
        setDrilldownOpen(processoId)
        setFlipOpaque(true)
        const t2 = window.setTimeout(() => setFlipActiveId(null), 220)
        flipTimersRef.current.push(t2)
      }, 150)
      flipTimersRef.current.push(t1)
    },
    [reducedMotion],
  )

  const beginFlipClose = useCallback(() => {
    if (reducedMotion) {
      setDrilldownOpen(null)
      return
    }
    const id = drilldownOpenRef.current
    if (!id) return
    setFlipActiveId(id)
    setFlipOpaque(false)
    const t1 = window.setTimeout(() => {
      setDrilldownOpen(null)
      setFlipOpaque(true)
      const t2 = window.setTimeout(() => setFlipActiveId(null), 220)
      flipTimersRef.current.push(t2)
    }, 150)
    flipTimersRef.current.push(t1)
  }, [reducedMotion])

  useEffect(() => {
    if (selectedResultId != null) return
    for (const id of flipTimersRef.current) clearTimeout(id)
    flipTimersRef.current = []
    setDrilldownOpen(null)
    setFlipActiveId(null)
    setFlipOpaque(true)
  }, [selectedResultId])

  useEffect(() => {
    if (drilldownOpen == null) setExpandedDimension(null)
  }, [drilldownOpen])

  useEffect(() => {
    if (drilldownOpen == null) {
      clearPerfilHoverLeaveTimer()
      setPerfilPesosInfoHover(false)
    }
  }, [drilldownOpen, clearPerfilHoverLeaveTimer])

  useEffect(() => {
    return () => clearPerfilHoverLeaveTimer()
  }, [clearPerfilHoverLeaveTimer])

  useLayoutEffect(() => {
    if (!perfilPesosInfoHover) {
      setPerfilTooltipPos(null)
      return
    }

    let cancelled = false
    let cleanupAuto: (() => void) | undefined
    let rafId = 0
    let attempts = 0
    const maxAttempts = 40

    const runPosition = (btn: HTMLElement, float: HTMLElement) => {
      computePosition(btn, float, {
        strategy: 'fixed',
        placement: 'top',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement }) => {
        if (cancelled) return
        setPerfilTooltipPos({ top: y, left: x })
        setPerfilInfoTooltipBelow(placement.startsWith('bottom'))
      })
    }

    const setup = () => {
      if (cancelled) return
      const btn = perfilInfoBtnRef.current
      const float = perfilTooltipFloatingRef.current
      const rect = btn?.getBoundingClientRect()
      const validBtn =
        btn &&
        rect &&
        rect.width >= 1 &&
        rect.height >= 1 &&
        Number.isFinite(rect.left) &&
        Number.isFinite(rect.top)

      if (!validBtn || !float) {
        if (attempts++ < maxAttempts) {
          rafId = requestAnimationFrame(setup)
        }
        return
      }

      const update = () => {
        if (cancelled) return
        runPosition(btn, float)
      }

      cleanupAuto = autoUpdate(btn, float, update)
      update()
    }

    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      cleanupAuto?.()
    }
  }, [perfilPesosInfoHover, drilldownOpen, flipOpaque, flipActiveId])

  useEffect(() => {
    if (selectedResultId == null) return
    const handlePointerDown = (e: PointerEvent) => {
      const root = cardsGridRef.current
      if (!root || root.contains(e.target as Node)) return
      setSelectedResultId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedResultId, setSelectedResultId])

  const perfilForDrill = proRisco ?? 'moderado'
  const pesosDrill = PESOS_PERFIL[perfilForDrill]
  const pesoA = Math.round(pesosDrill.a * 100)
  const pesoV = Math.round(pesosDrill.b * 100)
  const pesoS = Math.round(pesosDrill.c * 100)

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#0D0D0C',
        minHeight: '100%',
        /* Evita que o padrão absoluto “esticado” com o conteúdo; altura fixa em viewport (cf. radar home). */
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100vh',
          maxHeight: '100dvh',
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden
      >
        <GridBreathingResultadosAnimation />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 52 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={handleRefinarBusca}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888780',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F1EFE8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888780'
                }}
                title="Refinar busca no assistente"
              >
                <ArrowLeft size={20} />
              </button>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 500,
                  color: '#F1EFE8',
                }}
              >
                {resultados.length} oportunidades identificadas
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleVoltarAoRadar}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#888780',
                  fontSize: 14,
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F1EFE8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888780'
                }}
              >
                Voltar ao Radar
              </button>
              <button
                type="button"
                onClick={() => showToast('Disponível em breve')}
                style={{
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#EF9F27',
                  color: '#EF9F27',
                  fontSize: 14,
                  borderRadius: 8,
                  padding: '8px 20px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 159, 39, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                Salvar prospecção
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              marginLeft: 40,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {proRisco ? (
              <span style={pillUnified}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: perfilDotColor(proRisco),
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                {proRisco.charAt(0).toUpperCase() + proRisco.slice(1)}
              </span>
            ) : null}

            {proSubst.includes(TODAS_SUBST) ? (
              <span style={pillUnified}>Todas</span>
            ) : (
              proSubst.map((s) => (
                <span key={s} style={pillUnified}>
                  {titleCaseSubst(s)}
                </span>
              ))
            )}

            {proUfs.length > 0 ? (
              proUfs.map((uf) => (
                <span key={uf} style={pillUnified}>
                  {uf}
                </span>
              ))
            ) : (
              <span style={pillUnified}>Brasil</span>
            )}
          </div>
        </div>

        {resultados.length === 0 ? (
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: '60vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                maxWidth: 420,
              }}
            >
              <SearchX size={40} color="#5F5E5A" style={{ marginBottom: 16 }} aria-hidden />
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#D3D1C7',
                }}
              >
                Nenhuma oportunidade identificada
              </h3>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: '#888780',
                  lineHeight: 1.5,
                }}
              >
                Nenhum processo atende aos critérios mínimos de score para o perfil selecionado. Tente ampliar as
                substâncias ou a região.
              </p>
              <button
                type="button"
                onClick={handleRefinarBusca}
                style={{
                  marginTop: 24,
                  backgroundColor: '#EF9F27',
                  color: '#0D0D0C',
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '10px 28px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)'
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Refinar busca
              </button>
              {excluidosCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowDescartados(!showDescartados)}
                  style={{
                    marginTop: 12,
                    border: 'none',
                    background: 'none',
                    fontSize: 13,
                    color: '#888780',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  {showDescartados ? 'Ocultar' : 'Ver'} processos analisados ({excluidosCount})
                </button>
              ) : null}
            </div>

            {showDescartados && resultadosDescartados.length > 0 ? (
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  marginTop: 32,
                  width: '100%',
                  maxWidth: 800,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: '#888780',
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  Processos analisados (abaixo do score mínimo)
                </div>
                <div
                  style={{
                    backgroundColor: 'rgba(26, 26, 24, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#2C2C2A',
                    overflow: 'hidden',
                  }}
                >
                  {resultadosDescartados.map((row, i) => {
                    const p = processoById.get(row.processoId)
                    if (!p) return null
                    return (
                      <div
                        key={row.processoId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          borderTop: i > 0 ? '1px solid #2C2C2A' : 'none',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ color: '#5F5E5A', fontWeight: 600, width: 32 }}>{row.scoreTotal}</span>
                          <span style={{ color: '#D3D1C7' }}>{p.numero}</span>
                          <span style={{ color: '#888780' }}>{p.substancia}</span>
                          <span style={{ color: '#5F5E5A' }}>{p.uf}</span>
                        </div>
                        <span style={{ color: '#5F5E5A', fontSize: 12 }}>Abaixo do mínimo</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            ref={cardsGridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {resultados.map((r, i) => {
              const p = processoById.get(r.processoId)
              if (!p) return null
              const { card: cardVar, fonte: cardFonte } = resolveOpportunityCardVariaveis(p, r)
              const dimFromCard = computeDimScoresFromCard(cardVar)
              const dimScoresBarras =
                cardFonte === 'manual'
                  ? dimFromCard
                  : {
                      a: r.scoreAtratividade,
                      v: r.scoreViabilidade,
                      s: r.scoreSeguranca,
                    }
              const descricoesBarras = buildDescricoesBarras(cardVar, dimScoresBarras)
              const scoreBarA = dimScoresBarras.a
              const scoreBarV = dimScoresBarras.v
              const scoreBarS = dimScoresBarras.s
              const scoreTotalDisplay =
                cardFonte === 'manual'
                  ? scoreTotalFromDimScores(dimFromCard, proRisco ?? 'moderado')
                  : r.scoreTotal
              const faixaDisplay =
                cardFonte === 'manual' ? faixaFromScore(scoreTotalDisplay) : r.faixa
              const fatoresCard = gerarFatoresDestacados(
                flattenVariaveis(cardVar),
                descricoesBarras,
              )
              const drillDims = [
                {
                  label: 'Atratividade',
                  v: scoreBarA,
                  peso: pesoA,
                  variaveis: cardVar.atratividade,
                },
                {
                  label: 'Viabilidade',
                  v: scoreBarV,
                  peso: pesoV,
                  variaveis: cardVar.viabilidade,
                },
                {
                  label: 'Segurança',
                  v: scoreBarS,
                  peso: pesoS,
                  variaveis: cardVar.seguranca,
                },
              ]
              const corFaixa = corFaixaOpportunity(faixaDisplay)
              const isSelected = selectedResultId === r.processoId
              const corSub = corSubstanciaOuUndefined(p.substancia) ?? '#888780'

              const applyCardSurfaceAfterToggle = (
                el: HTMLDivElement,
                nextSelected: boolean,
                fromMouseClick: boolean,
              ) => {
                if (nextSelected) {
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = OPPORTUNITY_CARD_SELECTED_BORDER
                  el.style.boxShadow = OPPORTUNITY_CARD_SELECTED_SHADOW
                } else if (fromMouseClick) {
                  el.style.borderColor = '#5F5E5A'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
                } else {
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = '#2C2C2A'
                  el.style.boxShadow = 'none'
                }
              }

              const handleCardClick = (e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
                const nextSelected = !isSelected
                applyCardSurfaceAfterToggle(e.currentTarget, nextSelected, e.type === 'click')
                if (isSelected) {
                  setSelectedResultId(null)
                  setDrilldownOpen(null)
                } else {
                  setSelectedResultId(r.processoId)
                  setDrilldownOpen(null)
                }
              }

              const handleScoreZoneClick = (e: MouseEvent<HTMLDivElement>) => {
                e.stopPropagation()
                setSelectedResultId(r.processoId)
                if (drilldownOpenRef.current === r.processoId) {
                  beginFlipClose()
                } else {
                  beginFlipOpen(r.processoId)
                }
              }

              const handleScoreZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedResultId(r.processoId)
                  if (drilldownOpenRef.current === r.processoId) {
                    beginFlipClose()
                  } else {
                    beginFlipOpen(r.processoId)
                  }
                }
              }

              return (
                <div
                  key={r.processoId}
                  role="button"
                  tabIndex={0}
                  onClick={handleCardClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardClick(e)
                    }
                  }}
                  style={{
                    ...motionGroupStyle(cardVis[i] ?? true, reducedMotion),
                    backgroundColor: 'rgba(26, 26, 24, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: isSelected ? OPPORTUNITY_CARD_SELECTED_BORDER : '#2C2C2A',
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: isSelected ? OPPORTUNITY_CARD_SELECTED_SHADOW : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#5F5E5A'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.transform = 'translateY(0)'
                    if (isSelected) {
                      el.style.borderColor = OPPORTUNITY_CARD_SELECTED_BORDER
                      el.style.boxShadow = OPPORTUNITY_CARD_SELECTED_SHADOW
                    } else {
                      el.style.borderColor = '#2C2C2A'
                      el.style.boxShadow = 'none'
                    }
                  }}
                >
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${corFaixa}25 0%, ${corFaixa}0A 100%)`,
                      padding: '16px 20px',
                      borderRadius: '12px 12px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        letterSpacing: -0.5,
                        color: corRanking(i + 1),
                        lineHeight: 1,
                      }}
                    >
                      #{i + 1}
                    </span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleScoreZoneClick}
                      onKeyDown={handleScoreZoneKeyDown}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: '50%',
                          backgroundColor: `${corFaixa}20`,
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderColor: corFaixa,
                          boxShadow: `0 0 16px ${corFaixa}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 21, fontWeight: 700, color: '#F1EFE8' }}>
                          {scoreTotalDisplay}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: corFaixa,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {faixaLabelCurto(faixaDisplay)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      ...(reducedMotion
                        ? {}
                        : {
                            opacity:
                              flipActiveId === r.processoId ? (flipOpaque ? 1 : 0) : 1,
                            transition:
                              flipActiveId === r.processoId
                                ? 'opacity 150ms ease-in-out'
                                : undefined,
                          }),
                      pointerEvents:
                        !reducedMotion &&
                        flipActiveId === r.processoId &&
                        !flipOpaque
                          ? 'none'
                          : 'auto',
                    }}
                  >
                  {drilldownOpen !== r.processoId ? (
                    <div style={{ padding: '16px 20px 20px 20px', backgroundColor: '#1A1A18' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 17, fontWeight: 500, color: '#F1EFE8' }}>{p.numero}</span>
                        <span
                          style={{
                            padding: '2px 10px',
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 500,
                            backgroundColor: `${corSub}15`,
                            color: corSub,
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: `${corSub}30`,
                          }}
                        >
                          {titleCaseSubst(p.substancia)}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 15, color: '#B4B2A9' }}>{p.titular}</div>
                      <div style={{ marginTop: 2, fontSize: 15, color: '#8A8880' }}>
                        {p.municipio}, {p.uf} · {p.area_ha?.toLocaleString('pt-BR') ?? '–'} ha
                      </div>

                      <div style={{ height: 1, backgroundColor: '#2C2C2A', marginTop: 14, marginBottom: 14 }} />

                      {[
                        {
                          label: 'Atratividade',
                          v: scoreBarA,
                          tooltip: descricoesBarras[0],
                        },
                        {
                          label: 'Viabilidade',
                          v: scoreBarV,
                          tooltip: descricoesBarras[1],
                        },
                        {
                          label: 'Segurança',
                          v: scoreBarS,
                          tooltip: descricoesBarras[2],
                        },
                      ].map((b, bi) => {
                        const c = corMiniBarraValor(b.v)
                        return (
                          <div
                            key={b.label}
                            style={{ marginBottom: bi < 2 ? 14 : 0 }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: '#888780',
                                  width: 104,
                                  flexShrink: 0,
                                }}
                              >
                                {b.label}
                              </span>
                              <div
                                style={{
                                  flex: 1,
                                  height: 5,
                                  backgroundColor: '#2C2C2A',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                  minWidth: 30,
                                }}
                              >
                                <div style={barFillStyle(b.v, barsReady, bi, reducedMotion, c)} />
                              </div>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: c,
                                  marginLeft: 6,
                                  minWidth: 44,
                                  flexShrink: 0,
                                  textAlign: 'right',
                                }}
                              >
                                {b.v}
                              </span>
                            </div>
                            <div
                              style={{
                                marginLeft: 104,
                                marginTop: 2,
                                fontSize: 15,
                                color: '#8A8880',
                                lineHeight: 1.45,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                              }}
                              title={b.tooltip}
                            >
                              {b.tooltip}
                            </div>
                          </div>
                        )
                      })}

                      <div style={{ height: 1, backgroundColor: '#2C2C2A', marginTop: 14, marginBottom: 14 }} />

                      <div style={{ fontSize: 14, color: '#B4B2A9', lineHeight: 1.45 }}>
                        {fatoresCard.map((f, fi) => (
                          <div
                            key={`fc${fi}`}
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'flex-start',
                              marginTop: fi > 0 ? 4 : 0,
                            }}
                          >
                            {f.tipo === 'positivo' ? (
                              <span style={{ color: '#1D9E75', flexShrink: 0, fontSize: 14 }}>✓</span>
                            ) : (
                              <span
                                style={{
                                  color: corBolinhaAtencao(f.variavel.valor),
                                  flexShrink: 0,
                                  fontSize: 14,
                                }}
                              >
                                ●
                              </span>
                            )}
                            <span>
                              {f.variavel.texto} ({f.variavel.fonte})
                            </span>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          maxHeight:
                            isSelected && drilldownOpen !== r.processoId ? 120 : 0,
                          opacity:
                            isSelected && drilldownOpen !== r.processoId ? 1 : 0,
                          overflow: 'hidden',
                          marginTop: isSelected && drilldownOpen !== r.processoId ? 14 : 0,
                          paddingTop: isSelected && drilldownOpen !== r.processoId ? 14 : 0,
                          borderTopWidth: 1,
                          borderTopStyle: 'solid',
                          borderTopColor:
                            isSelected && drilldownOpen !== r.processoId
                              ? '#2C2C2A'
                              : 'transparent',
                          display: 'flex',
                          gap: 10,
                          transition: reducedMotion
                            ? undefined
                            : 'max-height 250ms ease-out, opacity 200ms ease-out, margin-top 250ms ease-out, padding-top 250ms ease-out, border-color 200ms ease-out',
                        }}
                      >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigateProcessoMapa(p.id)
                            }}
                            style={{
                              backgroundColor: '#EF9F27',
                              color: '#0D0D0C',
                              fontSize: 16,
                              fontWeight: 600,
                              borderRadius: 6,
                              padding: '7px 14px',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = 'brightness(1.1)'
                              e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = 'none'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            Ver no Mapa
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              beginFlipOpen(r.processoId)
                            }}
                            style={{
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: '#5F5E5A',
                              color: '#B4B2A9',
                              fontSize: 16,
                              fontWeight: 500,
                              borderRadius: 6,
                              padding: '7px 14px',
                              background: 'transparent',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s ease, color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#888780'
                              e.currentTarget.style.color = '#F1EFE8'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#5F5E5A'
                              e.currentTarget.style.color = '#B4B2A9'
                            }}
                          >
                            Ver cálculo
                          </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{
                        padding: '16px 20px 20px 20px',
                        backgroundColor: '#1A1A18',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#D3D1C7', marginBottom: 8 }}>
                        Decomposição da Pontuação
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 12,
                          }}
                        >
                          <span style={{ fontSize: 15, fontWeight: 500, color: '#B4B2A9' }}>
                            Perfil {perfilNomeTitulo(proRisco)}
                          </span>
                          <div
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                            onMouseEnter={openPerfilPesosInfo}
                            onMouseLeave={scheduleClosePerfilPesosInfo}
                          >
                            <button
                              ref={perfilInfoBtnRef}
                              type="button"
                              aria-label="Informação sobre pesos por perfil"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <Info size={15} color="#5F5E5A" aria-hidden />
                            </button>
                          </div>
                        </div>
                        <PesoBarDrilldown pesos={pesosDrill} heightPx={6} />
                        <div
                          style={{
                            display: 'flex',
                            gap: 2,
                            marginTop: 6,
                            marginBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              flex: pesosDrill.a,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 400,
                              color: '#888780',
                              textAlign: 'center',
                            }}
                          >
                            Atratividade {pesoA}%
                          </div>
                          <div
                            style={{
                              flex: pesosDrill.b,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 400,
                              color: '#888780',
                              textAlign: 'center',
                            }}
                          >
                            Viabilidade {pesoV}%
                          </div>
                          <div
                            style={{
                              flex: pesosDrill.c,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 400,
                              color: '#888780',
                              textAlign: 'center',
                            }}
                          >
                            Segurança {pesoS}%
                          </div>
                        </div>
                      </div>
                      {drillDims.map((dim, di) => {
                        const c = corMiniBarraValor(dim.v)
                        const isExpanded = expandedDimension === dim.label
                        return (
                          <div
                            key={dim.label}
                            style={{ marginBottom: di === 2 ? 40 : di < 2 ? 14 : 0 }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedDimension(isExpanded ? null : dim.label)
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'none',
                                border: 'none',
                                padding: '6px 0',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <ChevronRight
                                  size={14}
                                  color="#5F5E5A"
                                  style={{
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease',
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#888780',
                                    textAlign: 'left',
                                  }}
                                >
                                  {dim.label} ({dim.peso}%)
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: c,
                                  marginLeft: 8,
                                  flexShrink: 0,
                                  textAlign: 'right',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {dim.v}
                              </span>
                            </button>
                            <div
                              style={{
                                height: 5,
                                backgroundColor: '#2C2C2A',
                                borderRadius: 3,
                                overflow: 'hidden',
                                marginTop: 4,
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${dim.v}%`,
                                  backgroundColor: c,
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <div
                              style={{
                                maxHeight: isExpanded ? 500 : 0,
                                opacity: isExpanded ? 1 : 0,
                                overflow: 'hidden',
                                transition: reducedMotion
                                  ? undefined
                                  : 'max-height 300ms ease-out, opacity 200ms ease-out, margin-top 300ms ease-out',
                                marginTop: isExpanded ? 10 : 0,
                                marginLeft: 20,
                                paddingLeft: 12,
                                borderLeft: `2px solid ${c}30`,
                              }}
                            >
                                {dim.variaveis.map((vrow, vi) => {
                                  const q = qualificadorTextoMiniBarra(vrow.valor)
                                  const fonteVar =
                                    'fonte' in vrow && typeof (vrow as VariavelPontuacao).fonte === 'string'
                                      ? `Fonte: ${(vrow as VariavelPontuacao).fonte}`
                                      : FONTES_DRILLDOWN[vrow.nome]
                                  return (
                                  <div
                                    key={vi}
                                    style={{ marginTop: vi > 0 ? 10 : 0 }}
                                    title={fonteVar}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 10,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 14,
                                          color: '#8A8880',
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        {vrow.nome}
                                      </span>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: corMiniBarraValor(vrow.valor),
                                          }}
                                        >
                                          {vrow.valor}
                                        </span>
                                        <span style={{ fontSize: 14, color: q.color, marginLeft: 6 }}>
                                          {q.label}
                                        </span>
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        height: 3,
                                        backgroundColor: '#2C2C2A',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        marginTop: 4,
                                      }}
                                    >
                                      <div
                                        style={{
                                          height: '100%',
                                          width: `${vrow.valor}%`,
                                          backgroundColor: corMiniBarraValor(vrow.valor),
                                          borderRadius: 2,
                                          opacity: 0.7,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  )
                                })}
                            </div>
                          </div>
                        )
                      })}
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px 16px',
                          borderRadius: 8,
                          backgroundColor: `${corFaixa}0F`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 4,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: '#D3D1C7',
                            }}
                          >
                            Pontuação final
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 400, color: '#888780' }}>
                            <span style={{ color: CORES_DIMENSAO.atratividade, fontWeight: 600 }}>A</span>
                            <span style={{ color: '#888780', fontWeight: 400 }}> {scoreBarA}</span>
                            <span style={{ color: '#5F5E5A' }}> · </span>
                            <span style={{ color: CORES_DIMENSAO.viabilidade, fontWeight: 600 }}>V</span>
                            <span style={{ color: '#888780', fontWeight: 400 }}> {scoreBarV}</span>
                            <span style={{ color: '#5F5E5A' }}> · </span>
                            <span style={{ color: CORES_DIMENSAO.seguranca, fontWeight: 600 }}>S</span>
                            <span style={{ color: '#888780', fontWeight: 400 }}> {scoreBarS}</span>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: corFaixa,
                            flexShrink: 0,
                          }}
                        >
                          {scoreTotalDisplay}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: '1px solid #2C2C2A',
                          display: 'flex',
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            beginFlipClose()
                          }}
                          style={{
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: '#5F5E5A',
                            color: '#B4B2A9',
                            fontSize: 16,
                            fontWeight: 500,
                            borderRadius: 6,
                            padding: '7px 14px',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#888780'
                            e.currentTarget.style.color = '#F1EFE8'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#5F5E5A'
                            e.currentTarget.style.color = '#B4B2A9'
                          }}
                        >
                          Voltar
                        </button>
                      </div>
                      {perfilPesosInfoHover
                        ? createPortal(
                            <div
                              ref={perfilTooltipFloatingRef}
                              role="presentation"
                              onMouseEnter={openPerfilPesosInfo}
                              onMouseLeave={scheduleClosePerfilPesosInfo}
                              style={{
                                position: 'fixed',
                                top: perfilTooltipPos?.top ?? 0,
                                left: perfilTooltipPos?.left ?? 0,
                                zIndex: 10050,
                                width: 240,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                pointerEvents: perfilTooltipPos != null ? 'auto' : 'none',
                                opacity: perfilTooltipPos != null ? 1 : 0,
                              }}
                            >
                              {perfilInfoTooltipBelow ? (
                                <>
                                  <PerfilTooltipArrow pointsDown={false} />
                                  <div style={{ marginTop: -1 }}>
                                    <PerfilPesosTooltipPanel perfilAtivo={perfilForDrill} />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <PerfilPesosTooltipPanel perfilAtivo={perfilForDrill} />
                                  <div style={{ marginTop: -1 }}>
                                    <PerfilTooltipArrow pointsDown />
                                  </div>
                                </>
                              )}
                            </div>,
                            document.body,
                          )
                        : null}
                    </div>
                  )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
