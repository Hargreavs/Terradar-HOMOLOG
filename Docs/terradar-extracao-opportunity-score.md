# TERRADAR - Extração: Pontuação de Oportunidade

**Onde foi gerado:** pasta `Docs/`, ficheiro `Docs/terradar-extracao-opportunity-score.md`.
**Caminho absoluto:** `C:\Users\alex-\Terrae\Docs\terradar-extracao-opportunity-score.md`

**Notas:** Sem store Zustand dedicado; estado em `RadarDashboard`. Tipos (`OpportunityResult`, `PerfilRisco`, `ObjetivoProspeccao`, etc.) na secção **2a** (`opportunityScore.ts`). Ficheiros `.ts` também estão em blocos `tsx` apenas por convenção do relatório.

## 1. Componente de Resultados da Prospecção
**Arquivo:** `src/components/dashboard/ProspeccaoResultados.tsx`
```tsx
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
```

## 1b. Animação da grelha de resultados (`GridBreathingResultadosAnimation`)
**Arquivo:** `src/components/dashboard/animations/GridBreathingResultadosAnimation.tsx`
```tsx
import { useState, useEffect, useRef } from 'react'

const COLORS = {
  ambar: '#EF9F27',
}

const W = 1400
const H = 800
const CX = W / 2
const CY = H / 2
const SPACING = 50
const COLS = Math.ceil(W / SPACING) + 1
const ROWS = Math.ceil(H / SPACING) + 1

export function GridBreathingResultadosAnimation() {
  const [elapsed, setElapsed] = useState(0)
  const raf = useRef<number | null>(null)
  const t0 = useRef<number | null>(null)

  useEffect(() => {
    const tick = (ts: number) => {
      if (t0.current == null) t0.current = ts
      setElapsed((ts - t0.current) / 1000)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const waveSpeed = 120
  const waveCycle = 6
  const waveT = elapsed % waveCycle
  const waveRadius = waveT * waveSpeed
  const waveWidth = 200

  const wave2T = (elapsed + waveCycle * 0.5) % waveCycle
  const wave2Radius = wave2T * waveSpeed

  function getLineOpacity(dist: number): number {
    const base = 0.03
    const d1 = Math.abs(dist - waveRadius)
    const w1 = d1 < waveWidth ? (1 - d1 / waveWidth) * 0.04 : 0
    const d2 = Math.abs(dist - wave2Radius)
    const w2 = d2 < waveWidth ? (1 - d2 / waveWidth) * 0.025 : 0
    return base + w1 + w2
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: 500,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0 }}
      >
        {Array.from({ length: ROWS }, (_, i) => {
          const y = i * SPACING
          const dist = Math.abs(y - CY)
          return (
            <line
              key={`h${i}`}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              stroke={COLORS.ambar}
              strokeOpacity={getLineOpacity(dist)}
              strokeWidth={0.5}
            />
          )
        })}

        {Array.from({ length: COLS }, (_, i) => {
          const x = i * SPACING
          const dist = Math.abs(x - CX)
          return (
            <line
              key={`v${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={H}
              stroke={COLORS.ambar}
              strokeOpacity={getLineOpacity(dist)}
              strokeWidth={0.5}
            />
          )
        })}

        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const x = col * SPACING
            const y = row * SPACING
            const dist = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2)
            const d1 = Math.abs(dist - waveRadius)
            const w1 = d1 < waveWidth * 0.6 ? (1 - d1 / (waveWidth * 0.6)) * 0.15 : 0
            const dotOp = 0.02 + w1
            if (dotOp < 0.025) return null
            return <circle key={`d${row}-${col}`} cx={x} cy={y} r={1} fill={COLORS.ambar} opacity={dotOp} />
          }),
        )}

        <text
          x={W - 25}
          y={H - 20}
          fill={COLORS.ambar}
          fillOpacity={0.12}
          fontSize={10}
          fontFamily="monospace"
          textAnchor="end"
          letterSpacing={4}
        >
          TERRADAR
        </text>
      </svg>
    </div>
  )
}
```

## 2a. Cálculo, tipos e ranking (`opportunityScore.ts`)
**Arquivo:** `src/lib/opportunityScore.ts`
```tsx
import type { AlertaLegislativo, Processo } from '../types'

export type PerfilRisco = 'conservador' | 'moderado' | 'arrojado'
export type ObjetivoProspeccao = 'investir' | 'novo_requerimento' | 'avaliar_portfolio'

export interface OpportunityResult {
  processoId: string
  scoreTotal: number
  scoreAtratividade: number
  scoreViabilidade: number
  scoreSeguranca: number
  faixa: 'alta' | 'moderada' | 'baixa' | 'desfavoravel'
  fatoresPositivos: string[]
  fatoresAtencao: string[]
}

const RELEVANCIA_SUBSTANCIA: Record<string, number> = {
  DISPRÓSIO: 100,
  NEODÍMIO: 95,
  'TERRAS RARAS': 95,
  LÍTIO: 90,
  NIÓBIO: 85,
  NÍQUEL: 75,
  OURO: 70,
  COBRE: 65,
  FERRO: 45,
  BAUXITA: 40,
  QUARTZO: 25,
}

const GAP_SUBSTANCIA: Record<string, number> = {
  DISPRÓSIO: 22.2,
  NEODÍMIO: 22.2,
  'TERRAS RARAS': 22.2,
  NIÓBIO: 6.0,
  LÍTIO: 3.0,
  NÍQUEL: 6.0,
  FERRO: -5.0,
  OURO: 1.0,
  COBRE: 1.0,
  BAUXITA: -2.0,
  QUARTZO: -2.0,
}

const PRECO_USD_T: Record<string, number> = {
  DISPRÓSIO: 290_000,
  NEODÍMIO: 68_000,
  LÍTIO: 13_000,
  NIÓBIO: 41_000,
  NÍQUEL: 16_000,
  OURO: 62_000,
  COBRE: 8500,
  FERRO: 110,
  BAUXITA: 50,
  QUARTZO: 30,
  'TERRAS RARAS': 68_000,
}

const TENDENCIA_SUBSTANCIA: Record<string, 'alta' | 'estavel' | 'queda'> = {
  DISPRÓSIO: 'alta',
  NEODÍMIO: 'alta',
  'TERRAS RARAS': 'alta',
  LÍTIO: 'alta',
  NIÓBIO: 'estavel',
  NÍQUEL: 'alta',
  OURO: 'estavel',
  COBRE: 'alta',
  FERRO: 'estavel',
  BAUXITA: 'estavel',
  QUARTZO: 'queda',
}

export const PESOS_PERFIL: Record<PerfilRisco, { a: number; b: number; c: number }> = {
  conservador: { a: 0.25, b: 0.3, c: 0.45 },
  moderado: { a: 0.4, b: 0.3, c: 0.3 },
  arrojado: { a: 0.55, b: 0.25, c: 0.2 },
}

function normSubKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function lookup<T>(map: Record<string, T>, substancia: string): T | undefined {
  const n = normSubKey(substancia)
  for (const k of Object.keys(map)) {
    if (normSubKey(k) === n) return map[k]
  }
  return undefined
}

export function normalizeGap(gap: number): number {
  if (gap > 20) return 100
  if (gap >= 10) return 75
  if (gap >= 5) return 50
  if (gap >= 0) return 30
  return 15
}

export function normalizeValorEstimado(v: number): number {
  if (v > 500) return 100
  if (v >= 200) return 80
  if (v >= 50) return 55
  if (v >= 10) return 35
  return 15
}

function normalizeArea(ha: number): number {
  if (ha > 2000) return 100
  if (ha >= 500) return 65
  if (ha >= 100) return 40
  return 20
}

function normalizeAutonomiaFiscal(receita: number, divida: number): number {
  const s = receita + divida
  if (s <= 0) return 50
  return Math.round((receita / s) * 100)
}

function normalizeIncentivos(incentivos: number, bndes: number): number {
  if (incentivos > 0 && bndes > 0) return 100
  if (incentivos > 0 || bndes > 0) return 60
  return 20
}

export function normalizeRecenciaDespacho(dataIso: string): number {
  const t = new Date(`${dataIso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return 50
  const dias = Math.floor((Date.now() - t) / 86400000)
  if (dias <= 30) return 100
  if (dias <= 180) return 70
  if (dias <= 365) return 40
  return 15
}

export function normalizeAlertasRestritivos(alertas: AlertaLegislativo[]): number {
  const count = alertas.filter((a) => a.tipo_impacto === 'restritivo').length
  if (count === 0) return 100
  if (count === 1) return 60
  if (count === 2) return 30
  return 10
}

export function normalizeAlertasFavoraveis(alertas: AlertaLegislativo[]): number {
  const count = alertas.filter((a) => a.tipo_impacto === 'favoravel').length
  if (count === 0) return 40
  if (count === 1) return 70
  return 100
}

function scoreFaseB2(fase: Processo['fase']): number {
  if (fase === 'lavra') return 100
  if (fase === 'concessao') return 80
  if (fase === 'pesquisa') return 50
  if (fase === 'requerimento') return 25
  return 0
}

function scoreB1Capag(capag: Processo['fiscal']['capag']): number {
  if (capag === 'A') return 100
  if (capag === 'B') return 70
  if (capag === 'C') return 35
  return 10
}

function scoreB6Situacao(s: Processo['situacao']): number {
  if (s === 'ativo') return 100
  if (s === 'inativo') return 20
  return 0
}

export function faixaFromScore(score: number): OpportunityResult['faixa'] {
  if (score >= 75) return 'alta'
  if (score >= 50) return 'moderada'
  if (score >= 25) return 'baixa'
  return 'desfavoravel'
}

export function corFaixaOpportunity(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return '#1D9E75'
  if (faixa === 'moderada') return '#E8A830'
  if (faixa === 'baixa') return '#888780'
  return '#E24B4A'
}

export function labelFaixaOpportunity(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return 'ALTA'
  if (faixa === 'moderada') return 'MODERADA'
  if (faixa === 'baixa') return 'BAIXA'
  return 'NÃO RECOMENDADO'
}

/** Cores fixas por dimensão (pesos e identificação visual; independentes do sub-score). */
export const CORES_DIMENSAO = {
  atratividade: '#E8A830',
  viabilidade: '#5CBFA0',
  seguranca: '#1D9E75',
} as const

/** Cor da mini-barra por valor 0–100: ≥70 verde, 40–69 âmbar, &lt;40 vermelho */
export function corMiniBarraValor(v: number): string {
  if (v >= 70) return '#1D9E75'
  if (v >= 40) return '#E8A830'
  return '#E24B4A'
}

/** Qualificador alinhado a `corMiniBarraValor` (mesmos limites). A cor é sempre a da barra. */
export function qualificadorTextoMiniBarra(valor: number): { label: string; color: string } {
  const color = corMiniBarraValor(valor)
  if (valor >= 70) return { label: 'Alto', color }
  if (valor >= 40) return { label: 'Médio', color }
  return { label: 'Baixo', color }
}

type Contrib = { key: string; prod: number; v: number }

function pushContrib(
  out: Contrib[],
  key: string,
  v: number,
  wInterno: number,
  pesoPilar: number,
) {
  out.push({ key, prod: v * wInterno * pesoPilar, v })
}

function textoFatorNegativo(
  key: string,
  _v: number,
  p: Processo,
  ctx: {
    gap: number
    tend: 'alta' | 'estavel' | 'queda'
    recencia: number
    nRest: number
    nFav: number
  },
): string | null {
  const { nRest } = ctx
  switch (key) {
    case 'A1':
      return 'Relevância de mercado da substância abaixo do núcleo estratégico'
    case 'A2':
      return ctx.gap < 0
        ? 'Produção nacional 12% abaixo da reserva estimada (USGS 2024)'
        : 'Dinâmica de oferta/demanda sem folga expressiva'
    case 'A3':
      return 'Preço spot de referência em faixa inferior (commodity pressionada)'
    case 'A4':
      return ctx.tend === 'queda'
        ? 'Tendência de demanda em queda'
        : 'Demanda sem impulso de alta no horizonte recente'
    case 'A5':
      return 'Valor estimado de reservas em faixa inferior'
    case 'B1':
      return p.fiscal.capag === 'C'
        ? 'CAPAG C, município com fragilidade fiscal'
        : 'Nota CAPAG abaixo do ideal para projetos longos'
    case 'B2':
      return 'Fase ainda distante da lavra (maior incerteza de prazo)'
    case 'B3':
      return 'Distância a ferrovia/porto acima da média regional (referência ANM)'
    case 'B4':
      return 'Área útil reduzida para escala industrial'
    case 'B5':
      return 'Autonomia fiscal municipal pressionada (receita vs. dívida)'
    case 'B6':
      return p.situacao === 'bloqueado'
        ? 'Processo bloqueado na ANM'
        : 'Situação inativa reduz previsibilidade operacional'
    case 'B7':
      return 'Poucos incentivos estaduais ou linhas BNDES mapeados'
    case 'C1':
      return p.risk_score != null && p.risk_score >= 75
        ? `Risk Score ${p.risk_score}/100, sobreposições e riscos territoriais elevados (ANM/ICMBio)`
        : `Risk Score ${p.risk_score ?? 0}/100, atenção a sobreposições parciais`
    case 'C2':
      return 'Componente ambiental do risco pressionado'
    case 'C3':
      return 'Trâmite regulatório com indicadores de risco elevados (ANM)'
    case 'C4':
      return ctx.recencia <= 40
        ? 'Último despacho ANM há mais de 1 ano'
        : 'Recência de despachos abaixo do ideal'
    case 'C5':
      return nRest > 0
        ? 'Alerta restritivo recente (licenciamento em APP)'
        : 'Histórico com alertas restritivos no processo'
    case 'C6':
      return 'Poucos drivers regulatórios favoráveis'
    default:
      return null
  }
}

function textoFator(
  key: string,
  p: Processo,
  ctx: {
    gap: number
    preco: number
    tend: 'alta' | 'estavel' | 'queda'
    recencia: number
    nRest: number
    nFav: number
  },
): string | null {
  switch (key) {
    case 'A1':
      return `${p.substancia} com alta relevância estratégica no mercado`
    case 'A2':
      if (ctx.gap > 15)
        return `Mineral estratégico com gap de +${ctx.gap.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`
      if (ctx.gap > 0) return 'Balanço reserva/produção ligeiramente favorável'
      return 'Balanço reserva/produção pressionado no mercado global'
    case 'A3':
      return `Referência de preço spot ~US$ ${Math.round(ctx.preco).toLocaleString('pt-BR')}/t`
    case 'A4':
      if (ctx.tend === 'alta') return 'Tendência de demanda alta'
      if (ctx.tend === 'estavel') return 'Demanda estável no horizonte recente'
      return 'Demanda em queda no referencial de mercado'
    case 'A5':
      return `Valor estimado de reservas ~US$ ${p.valor_estimado_usd_mi.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mi`
    case 'B1':
      return p.fiscal.capag === 'A'
        ? 'Classificação fiscal A (STN/SICONFI), receita própria elevada'
        : p.fiscal.capag === 'B'
          ? 'CAPAG B, ambiente fiscal moderado'
          : 'CAPAG fraca, atenção à autonomia municipal'
    case 'B2':
      return p.fase === 'lavra'
        ? 'Processo em fase de lavra (maduro)'
        : p.fase === 'concessao'
          ? 'Concessão aprovada, caminho operacional claro'
          : 'Fase ainda incipiente no ciclo ANM'
    case 'B3':
      return 'Logística: ferrovia/porto com distância média (referência ANM)'
    case 'B4':
      return `Área de ${p.area_ha.toLocaleString('pt-BR')} ha na faixa típica de escala`
    case 'B5':
      return 'Indicadores de receita própria vs. dívida consolidada equilibrados'
    case 'B6':
      return p.situacao === 'ativo'
        ? 'Situação ativa junto à ANM'
        : 'Situação inativa ou bloqueada reduz previsibilidade'
    case 'B7':
      return p.fiscal.incentivos_estaduais.length > 0 && p.fiscal.linhas_bndes.length > 0
        ? 'CAPAG A, incentivos fiscais ativos'
        : p.fiscal.incentivos_estaduais.length > 0 || p.fiscal.linhas_bndes.length > 0
          ? 'Incentivos estaduais ou linhas BNDES identificados'
          : 'Poucos incentivos explícitos no cadastro'
    case 'C1':
      return p.risk_score != null && p.risk_score >= 75
        ? `Risk Score ${p.risk_score}/100, sobreposições e riscos territoriais elevados (ANM/ICMBio)`
        : `Risk Score ${p.risk_score ?? 0}/100, sem sobreposições territoriais identificadas (ANM/ICMBio)`
    case 'C2':
      return p.risk_breakdown && p.risk_breakdown.ambiental >= 70
        ? 'Componente ambiental do risco pressionado'
        : 'Componente ambiental do risco moderado'
    case 'C3':
      return p.risk_breakdown && p.risk_breakdown.regulatorio >= 70
        ? 'Risco regulatório elevado'
        : 'Trâmite regulatório com folga relativa'
    case 'C4':
      return ctx.recencia <= 40
        ? 'Último despacho ANM há mais de 1 ano'
        : 'Recência de despachos favorável'
    case 'C5':
      return 'Ausência de alertas regulatórios restritivos no processo'
    case 'C6':
      return ctx.nFav >= 2
        ? 'Múltiplos alertas favoráveis vinculados'
        : ctx.nFav === 1
          ? 'Alerta favorável recente no histórico'
          : 'Poucos drivers regulatórios favoráveis'
    default:
      return null
  }
}

export function computeOpportunityForProcesso(
  processo: Processo,
  perfilRisco: PerfilRisco,
  objetivo: ObjetivoProspeccao,
): OpportunityResult {
  const sub = processo.substancia
  const A1 = lookup(RELEVANCIA_SUBSTANCIA, sub) ?? 30
  const gapRaw = lookup(GAP_SUBSTANCIA, sub) ?? 0
  const A2 = normalizeGap(gapRaw)
  const preco = lookup(PRECO_USD_T, sub) ?? 1000
  const A3 = Math.min(
    100,
    Math.round((Math.log10(Math.max(preco, 1)) / Math.log10(300_000)) * 100),
  )
  const tend = lookup(TENDENCIA_SUBSTANCIA, sub) ?? 'estavel'
  const A4 = tend === 'alta' ? 100 : tend === 'estavel' ? 50 : 10
  const A5 = normalizeValorEstimado(processo.valor_estimado_usd_mi)
  const scoreA =
    A1 * 0.25 + A2 * 0.25 + A3 * 0.2 + A4 * 0.15 + A5 * 0.15

  const B1 = scoreB1Capag(processo.fiscal.capag)
  const B2 = scoreFaseB2(processo.fase)
  const B3 = 50
  const B4 = normalizeArea(processo.area_ha)
  const B5 = normalizeAutonomiaFiscal(
    processo.fiscal.receita_propria_mi,
    processo.fiscal.divida_consolidada_mi,
  )
  const B6 = scoreB6Situacao(processo.situacao)
  const B7 = normalizeIncentivos(
    processo.fiscal.incentivos_estaduais.length,
    processo.fiscal.linhas_bndes.length,
  )
  const scoreB =
    B1 * 0.2 +
    B2 * 0.2 +
    B3 * 0.15 +
    B4 * 0.1 +
    B5 * 0.1 +
    B6 * 0.15 +
    B7 * 0.1

  const rb = processo.risk_breakdown
  const C1 = 100 - (processo.risk_score ?? 50)
  const C2 = 100 - (rb?.ambiental ?? 50)
  const C3 = 100 - (rb?.regulatorio ?? 50)
  const C4 = normalizeRecenciaDespacho(processo.ultimo_despacho_data)
  const C5 = normalizeAlertasRestritivos(processo.alertas)
  const C6 = normalizeAlertasFavoraveis(processo.alertas)
  const scoreC = C1 * 0.35 + C2 * 0.2 + C3 * 0.15 + C4 * 0.15 + C5 * 0.1 + C6 * 0.05

  const pesos = PESOS_PERFIL[perfilRisco]
  let score = Math.round(scoreA * pesos.a + scoreB * pesos.b + scoreC * pesos.c)

  if (processo.regime === 'bloqueio_permanente') score = Math.min(score, 10)
  else if (processo.fase === 'encerrado') score = Math.min(score, 20)
  else if (processo.regime === 'bloqueio_provisorio') score = Math.round(score * 0.6)
  else if (processo.situacao === 'bloqueado') score = Math.round(score * 0.7)
  else if ((processo.risk_score ?? 0) >= 90) score = Math.round(score * 0.5)

  score = Math.max(0, Math.min(100, score))

  const faixa = faixaFromScore(score)

  const contribs: Contrib[] = []
  pushContrib(contribs, 'A1', A1, 0.25, pesos.a)
  pushContrib(contribs, 'A2', A2, 0.25, pesos.a)
  pushContrib(contribs, 'A3', A3, 0.2, pesos.a)
  pushContrib(contribs, 'A4', A4, 0.15, pesos.a)
  pushContrib(contribs, 'A5', A5, 0.15, pesos.a)
  pushContrib(contribs, 'B1', B1, 0.2, pesos.b)
  pushContrib(contribs, 'B2', B2, 0.2, pesos.b)
  pushContrib(contribs, 'B3', B3, 0.15, pesos.b)
  pushContrib(contribs, 'B4', B4, 0.1, pesos.b)
  pushContrib(contribs, 'B5', B5, 0.1, pesos.b)
  pushContrib(contribs, 'B6', B6, 0.15, pesos.b)
  pushContrib(contribs, 'B7', B7, 0.1, pesos.b)
  pushContrib(contribs, 'C1', C1, 0.35, pesos.c)
  pushContrib(contribs, 'C2', C2, 0.2, pesos.c)
  pushContrib(contribs, 'C3', C3, 0.15, pesos.c)
  pushContrib(contribs, 'C4', C4, 0.15, pesos.c)
  pushContrib(contribs, 'C5', C5, 0.1, pesos.c)
  pushContrib(contribs, 'C6', C6, 0.05, pesos.c)

  const sortedDesc = [...contribs].sort((a, b) => b.prod - a.prod)
  const sortedAsc = [...contribs].sort((a, b) => a.prod - b.prod)

  const nRest = processo.alertas.filter((a) => a.tipo_impacto === 'restritivo').length
  const nFav = processo.alertas.filter((a) => a.tipo_impacto === 'favoravel').length
  const ctx = {
    gap: gapRaw,
    preco,
    tend,
    recencia: C4,
    nRest,
    nFav,
  }

  const fatoresPositivos: string[] = []
  for (const c of sortedDesc) {
    if (fatoresPositivos.length >= 3) break
    if (c.v < 50) continue
    const t = textoFator(c.key, processo, ctx)
    if (t && !fatoresPositivos.includes(t)) fatoresPositivos.push(t)
  }

  const fatoresAtencao: string[] = []
  for (const c of sortedAsc) {
    if (fatoresAtencao.length >= 2) break
    const t = textoFatorNegativo(c.key, c.v, processo, ctx)
    if (t && !fatoresAtencao.includes(t)) fatoresAtencao.push(t)
  }

  if (objetivo === 'investir' && fatoresPositivos.length < 3) {
    const extra = 'Encaixe com estratégia de investimento em ativo titulado'
    if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)
  }
  if (objetivo === 'novo_requerimento' && fatoresPositivos.length < 3) {
    const extra = 'Benchmark útil para novos requerimentos na mesma região/substância'
    if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)
  }
  if (objetivo === 'avaliar_portfolio' && fatoresPositivos.length < 3) {
    const extra = 'Leitura de benchmarking para revisão de portfólio'
    if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)
  }

  while (fatoresPositivos.length > 3) fatoresPositivos.pop()

  if (fatoresAtencao.length < 2) {
    if (
      processo.risk_breakdown &&
      processo.risk_breakdown.social >= 65 &&
      !fatoresAtencao.some((x) => x.includes('social'))
    ) {
      fatoresAtencao.push('Proximidade a terras indígenas / uso do solo (FUNAI/ICMBio)')
    }
  }
  while (fatoresAtencao.length > 2) fatoresAtencao.pop()

  return {
    processoId: processo.id,
    scoreTotal: score,
    scoreAtratividade: Math.round(scoreA),
    scoreViabilidade: Math.round(scoreB),
    scoreSeguranca: Math.round(scoreC),
    faixa,
    fatoresPositivos: fatoresPositivos.slice(0, 3),
    fatoresAtencao: fatoresAtencao.slice(0, 2),
  }
}

export function runProspeccao(
  processos: Processo[],
  perfil: PerfilRisco,
  objetivo: ObjetivoProspeccao,
): { ranked: OpportunityResult[]; excludedCount: number } {
  const ranked = processos
    .map((p) => computeOpportunityForProcesso(p, perfil, objetivo))
    .sort((a, b) => b.scoreTotal - a.scoreTotal)
  const excludedCount = ranked.filter((r) => r.scoreTotal <= 24).length
  return { ranked, excludedCount }
}
```

## 2b. Mock e variáveis por card (`opportunityCardMockData.ts`)
**Arquivo:** `src/lib/opportunityCardMockData.ts`
```tsx
import type { Processo } from '../types'
import type { OpportunityResult } from './opportunityScore'
import {
  gerarVariaveisAutomaticas,
  type OpportunityCardVariaveis,
} from './opportunityCardCopy'

/**
 * Dados concretos (texto + fonte) por processo para cards de oportunidade.
 * Chaves: ids estáveis em `processos.mock` (p3, p23, p22, p21).
 */
export const OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID: Record<string, OpportunityCardVariaveis> = {
  p3: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 21,
        texto: 'Bauxita: demanda estável, baixa criticidade',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 32,
        texto: 'Reserva nacional 2.8x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 28,
        texto: 'US$ 38/t, estável (-0.5% a.a.)',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 62,
        texto: 'Demanda global +1.8% a.a.',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 52,
        texto: 'Reserva estimada em US$ 8.2M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 92,
        texto: 'CAPAG A, receita própria elevada',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 88,
        texto: 'Concessão de Lavra ativa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 85,
        texto: 'Ferrovia a 12 km, rodovia federal a 3 km',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 72,
        texto: '2.104 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 78,
        texto: 'Autonomia fiscal 71%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 91,
        texto: 'Processo ativo, sem pendências',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 85,
        texto: 'Incentivos estaduais, linhas BNDES e Sudene alinhados ao projeto',
        fonte: 'BNDES',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 69,
        texto: 'Risk Score 31/100 (baixo)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 82,
        texto: 'Sem sobreposição com UCs ou TIs',
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 74,
        texto: '0 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 65,
        texto: 'Último despacho há 38 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 76,
        texto: 'Nenhuma restrição publicada em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 58,
        texto: '3 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p23: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 94,
        texto: 'Lítio: mineral crítico, alta demanda global',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 82,
        texto: 'Reserva nacional 6.1x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 45,
        texto: 'US$ 12.400/t, volatilidade alta',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 91,
        texto: 'Demanda global +14% a.a. (eletrificação)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 68,
        texto: 'Reserva estimada em US$ 94M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 48,
        texto: 'CAPAG C, capacidade fiscal limitada',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 55,
        texto: 'Fase de Pesquisa (autorizada)',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 35,
        texto: 'Ferrovia a 210 km, acesso por estrada vicinal',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 61,
        texto: '487 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 29,
        texto: 'Autonomia fiscal 22%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 72,
        texto: 'Processo ativo, relatório pendente',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 65,
        texto: 'Área de atuação Sudene',
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 52,
        texto: 'Risk Score 48/100 (médio)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 56,
        texto: 'Proximidade com APP (2.3 km)',
        fonte: 'ICMBio, CAR/SICAR',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 61,
        texto: '1 alerta restritivo em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 71,
        texto: 'Último despacho há 22 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 55,
        texto: '1 restrição publicada em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 68,
        texto: '5 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p22: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 97,
        texto: 'Nióbio: Brasil detém 98% das reservas globais',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 88,
        texto: 'Reserva nacional 12x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 76,
        texto: 'US$ 41.000/t, tendência de alta',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 85,
        texto: 'Demanda global +3.2% a.a. (aços especiais)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 92,
        texto: 'Reserva estimada em US$ 680M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 85,
        texto: 'CAPAG A, superávit fiscal',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 90,
        texto: 'Concessão de Lavra ativa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 88,
        texto: 'Ferrovia a 8 km, rodovia a 2 km',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 64,
        texto: '312 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 82,
        texto: 'Autonomia fiscal 74%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 85,
        texto: 'Processo ativo, sem pendências',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 55,
        texto: 'Fora de área prioritária',
        fonte: 'BNDES',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 84,
        texto: 'Risk Score 12/100 (baixo)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 91,
        texto: 'Sem sobreposição territorial identificada',
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 85,
        texto: '0 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 78,
        texto: 'Último despacho há 15 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 82,
        texto: 'Nenhuma restrição em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 74,
        texto: '7 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p21: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 78,
        texto: 'Grafita: mineral crítico para baterias',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 71,
        texto: 'Reserva nacional 4.5x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 52,
        texto: 'US$ 1.200/t, recuperação após queda',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 74,
        texto: 'Demanda global +8% a.a. (baterias Li-ion)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 38,
        texto: 'Reserva estimada em US$ 4.1M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 32,
        texto: 'CAPAG D, endividamento elevado',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 38,
        texto: 'Requerimento de Pesquisa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 28,
        texto: 'Ferrovia a 340 km, acesso precário',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 55,
        texto: '1.850 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 18,
        texto: 'Autonomia fiscal 11%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 62,
        texto: 'Processo ativo, documentação pendente',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 72,
        texto: 'Área de atuação Sudene',
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 42,
        texto: 'Risk Score 58/100 (médio)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 35,
        texto: 'Sobreposição parcial com APP (0.8 km)',
        fonte: 'ICMBio, CAR/SICAR',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 51,
        texto: '2 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 55,
        texto: 'Último despacho há 92 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 38,
        texto: '2 restrições publicadas em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 62,
        texto: '4 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
}

export function getOpportunityCardVariaveis(processoId: string): OpportunityCardVariaveis | null {
  return OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID[processoId] ?? null
}

export type OpportunityCardFonte = 'manual' | 'auto'

/** Dados curados (p3, p23, p22, p21) ou cópia automática derivada do processo e dos scores. */
export function resolveOpportunityCardVariaveis(
  processo: Processo,
  scores: OpportunityResult,
): { card: OpportunityCardVariaveis; fonte: OpportunityCardFonte } {
  const manual = getOpportunityCardVariaveis(processo.id)
  if (manual) return { card: manual, fonte: 'manual' }
  return { card: gerarVariaveisAutomaticas(processo, scores), fonte: 'auto' }
}
```

## 2c. Textos e helpers de UI (`opportunityCardCopy.ts`)
**Arquivo:** `src/lib/opportunityCardCopy.ts`
```tsx
import type { Processo } from '../types'
import type { OpportunityResult, PerfilRisco } from './opportunityScore'
import { PESOS_PERFIL } from './opportunityScore'

/** Variável de uma dimensão da pontuação de oportunidade (valor 0–100 + cópia legível). */
export interface VariavelPontuacao {
  nome: string
  valor: number
  texto: string
  fonte: string
}

export interface OpportunityCardVariaveis {
  atratividade: VariavelPontuacao[]
  viabilidade: VariavelPontuacao[]
  seguranca: VariavelPontuacao[]
}

export type FatorDestacado = {
  tipo: 'positivo' | 'atencao'
  variavel: VariavelPontuacao
}

/** Pesos internos por dimensão (mesmos de `computeOpportunityForProcesso` em `opportunityScore.ts`). */
export const PESOS_INTERNOS_ATRATIVIDADE = [0.25, 0.25, 0.2, 0.15, 0.15] as const
export const PESOS_INTERNOS_VIABILIDADE = [0.2, 0.2, 0.15, 0.1, 0.1, 0.15, 0.1] as const
export const PESOS_INTERNOS_SEGURANCA = [0.35, 0.2, 0.15, 0.15, 0.1, 0.05] as const

function roundScore(weighted: number): number {
  return Math.max(0, Math.min(100, Math.round(weighted)))
}

export function scoreDimensaoFromVariaveis(
  variaveis: VariavelPontuacao[],
  pesos: readonly number[],
): number {
  const n = Math.min(variaveis.length, pesos.length)
  let s = 0
  for (let i = 0; i < n; i++) {
    const v = variaveis[i]
    if (v) s += v.valor * (pesos[i] ?? 0)
  }
  return roundScore(s)
}

export function computeDimScoresFromCard(cv: OpportunityCardVariaveis): {
  a: number
  v: number
  s: number
} {
  return {
    a: scoreDimensaoFromVariaveis(cv.atratividade, PESOS_INTERNOS_ATRATIVIDADE),
    v: scoreDimensaoFromVariaveis(cv.viabilidade, PESOS_INTERNOS_VIABILIDADE),
    s: scoreDimensaoFromVariaveis(cv.seguranca, PESOS_INTERNOS_SEGURANCA),
  }
}

export function scoreTotalFromDimScores(
  dims: { a: number; v: number; s: number },
  perfil: PerfilRisco,
): number {
  const { a, b, c } = PESOS_PERFIL[perfil]
  return roundScore(dims.a * a + dims.v * b + dims.s * c)
}

function stripPontoFinal(s: string): string {
  return s.replace(/\.\s*$/, '').trim()
}

function minMaxVariaveis(variaveis: VariavelPontuacao[]): {
  gargalo: VariavelPontuacao
  destaque: VariavelPontuacao
} {
  const sorted = [...variaveis].sort((a, b) => a.valor - b.valor)
  const gargalo = sorted[0]!
  const destaque = sorted[sorted.length - 1]!
  return { gargalo, destaque }
}

/**
 * Gera 1 linha de descrição abaixo da barra da dimensão (regra Seção 2).
 */
export function gerarDescricaoDimensao(
  variaveis: VariavelPontuacao[],
  scoreDimensao: number,
): string {
  if (variaveis.length === 0) return ''
  const { gargalo, destaque } = minMaxVariaveis(variaveis)

  let out: string
  if (scoreDimensao < 40) {
    out = `${gargalo.texto} (${gargalo.fonte})`
  } else if (scoreDimensao >= 70) {
    out = `${destaque.texto} (${destaque.fonte})`
  } else {
    out = `${destaque.texto}, porém ${gargalo.nome} limitado (${gargalo.fonte})`
  }
  return stripPontoFinal(out)
}

function textoApareceEmDescricoes(texto: string, descricoes: string[]): boolean {
  const t = texto.trim()
  if (!t) return false
  return descricoes.some((d) => d.includes(t))
}

/**
 * Fatores inferiores do card (Seção 3). `descricoesBarras` = [A, V, S].
 */
export function gerarFatoresDestacados(
  todasVariaveis: VariavelPontuacao[],
  descricoesBarras: [string, string, string],
): FatorDestacado[] {
  const desc = descricoesBarras
  const pool = todasVariaveis.filter((v) => !textoApareceEmDescricoes(v.texto, desc))

  const pos = [...pool].filter((v) => v.valor >= 60).sort((a, b) => b.valor - a.valor)
  const neg = [...pool].filter((v) => v.valor < 50).sort((a, b) => a.valor - b.valor)

  const out: FatorDestacado[] = []

  if (pos.length >= 2) {
    for (const v of pos.slice(0, 2)) {
      out.push({ tipo: 'positivo', variavel: v })
    }
  } else if (pos.length === 1) {
    out.push({ tipo: 'positivo', variavel: pos[0]! })
  } else {
    const sortedAll = [...pool].sort((a, b) => b.valor - a.valor)
    if (sortedAll[0]) out.push({ tipo: 'positivo', variavel: sortedAll[0] })
  }

  if (neg.length > 0) {
    out.push({ tipo: 'atencao', variavel: neg[0]! })
  }

  return out
}

export function corBolinhaAtencao(valor: number): '#E8A830' | '#E24B4A' {
  if (valor < 30) return '#E24B4A'
  return '#E8A830'
}

export function flattenVariaveis(cv: OpportunityCardVariaveis): VariavelPontuacao[] {
  return [...cv.atratividade, ...cv.viabilidade, ...cv.seguranca]
}

export function buildDescricoesBarras(
  cv: OpportunityCardVariaveis,
  scores: { a: number; v: number; s: number },
): [string, string, string] {
  return [
    gerarDescricaoDimensao(cv.atratividade, scores.a),
    gerarDescricaoDimensao(cv.viabilidade, scores.v),
    gerarDescricaoDimensao(cv.seguranca, scores.s),
  ]
}

/** Valores mock das variáveis do accordion, orbitando o sub-score da dimensão (mantido até integração real). */
export function mockVarValor(subScore: number, varIndex: number): number {
  const offsets = [-15, -8, 0, 8, 15, -5, 5]
  const offset = offsets[varIndex % offsets.length] ?? 0
  const val = Math.round(subScore + offset + Math.sin(varIndex * 2.7) * 10)
  return Math.max(5, Math.min(100, val))
}

function normSubKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function textoRelevanciaSubstancia(sub: string): string {
  const n = normSubKey(sub)
  if (
    ['OURO', 'COBRE', 'LITIO', 'NIQUEL', 'NIOBIO', 'NEODIMIO', 'DISPROSIO'].includes(n)
  ) {
    return 'mineral crítico, alta demanda global'
  }
  if (n === 'FERRO') return 'commodity de base, demanda estável'
  if (n === 'BAUXITA') return 'demanda estável, baixa criticidade'
  if (n === 'QUARTZO') return 'baixa criticidade, mercado de nicho'
  return 'relevância setorial moderada'
}

function textoPrecoUsdT(sub: string): string {
  const n = normSubKey(sub)
  const m: Record<string, string> = {
    OURO: 'US$ 62.000/t, tendência de alta',
    COBRE: 'US$ 8.500/t, volatilidade moderada',
    LITIO: 'US$ 12.400/t, volatilidade alta',
    FERRO: 'US$ 110/t, estável',
    BAUXITA: 'US$ 38/t, estável (-0.5% a.a.)',
    NIOBIO: 'US$ 41.000/t, tendência de alta',
    NIQUEL: 'US$ 16.000/t, oscilação recente',
    QUARTZO: 'US$ 50/t, mercado estável',
    NEODIMIO: 'US$ 68.000/t, demanda crescente',
    DISPROSIO: 'US$ 290.000/t, oferta restrita',
  }
  return m[n] ?? 'Preço de referência não disponível'
}

function textoGapReservaProducao(valor: number): string {
  const mult = Math.round(valor / 10)
  if (valor >= 70) return `Reserva nacional ${mult}x produção anual`
  if (valor >= 40) return `Gap reserva/produção moderado (${mult}x)`
  return 'Gap reduzido, produção próxima da reserva'
}

function textoTendenciaDemanda(valor: number): string {
  if (valor >= 70) return 'Demanda global em alta (minerais críticos)'
  if (valor >= 40) return 'Demanda global estável'
  return 'Demanda em retração ou substituição tecnológica'
}

function textoCapagMunicipio(valor: number): string {
  if (valor >= 80) return 'CAPAG A, receita própria elevada'
  if (valor >= 60) return 'CAPAG B, ambiente fiscal moderado'
  if (valor >= 40) return 'CAPAG C, capacidade fiscal limitada'
  return 'CAPAG D, endividamento elevado'
}

function textoFaseProcesso(fase: Processo['fase']): string {
  if (fase === 'lavra') return 'Concessão de Lavra ativa'
  if (fase === 'concessao') return 'Concessão aprovada, caminho operacional claro'
  if (fase === 'pesquisa') return 'Fase de Pesquisa (autorizada)'
  if (fase === 'requerimento') return 'Requerimento de Pesquisa'
  if (fase === 'encerrado') return 'Processo encerrado'
  return 'Processo encerrado'
}

function textoInfraLogistica(valor: number): string {
  if (valor >= 70) return 'Ferrovia e rodovia próximas, logística favorável'
  if (valor >= 40) return 'Infraestrutura disponível, distância moderada'
  return 'Acesso precário, infraestrutura distante'
}

function textoAutonomiaFiscal(valor: number): string {
  if (valor >= 70) return `Autonomia fiscal ${valor}%`
  if (valor >= 40) return `Autonomia fiscal moderada (${valor}%)`
  return `Autonomia fiscal baixa (${valor}%)`
}

function textoSituacaoProcesso(s: Processo['situacao']): string {
  if (s === 'ativo') return 'Processo ativo, sem pendências'
  if (s === 'inativo') return 'Processo inativo na ANM'
  if (s === 'bloqueado') return 'Processo bloqueado na ANM'
  return `Situação: ${s}`
}

function textoIncentivosRegionais(valor: number): string {
  if (valor >= 60) return 'Área de atuação Sudene/Sudam ou incentivos estaduais'
  if (valor >= 40) return 'Fora de área prioritária'
  return 'Sem incentivos regionais identificados'
}

function qualificadorRiskScore(risk: number): 'baixo' | 'médio' | 'alto' {
  if (risk < 40) return 'baixo'
  if (risk < 70) return 'médio'
  return 'alto'
}

function textoConformidadeAmbiental(valor: number): string {
  if (valor >= 70) return 'Sem sobreposição com UCs ou TIs'
  if (valor >= 40) return 'Proximidade com área protegida'
  return 'Sobreposição parcial com APP ou UC'
}

function textoRegularidadeRegulatoria(valor: number): string {
  if (valor >= 70) return '0 alertas restritivos em 12 meses'
  if (valor >= 40) return '1-2 alertas restritivos em 12 meses'
  return '3+ alertas restritivos em 12 meses'
}

function textoHistoricoDespachos(valor: number): string {
  if (valor >= 70) return 'Último despacho recente (< 30 dias)'
  if (valor >= 40) return `Último despacho há ${Math.round(180 - valor * 1.5)} dias`
  return 'Último despacho há mais de 6 meses'
}

function textoAusenciaRestricoes(valor: number): string {
  if (valor >= 70) return 'Nenhuma restrição publicada em 12 meses'
  if (valor >= 40) return '1-2 restrições publicadas em 6 meses'
  return '3+ restrições publicadas em 6 meses'
}

function textoAlertasFavoraveis(valor: number): string {
  if (valor >= 70) return `${Math.round(valor / 10)} alertas favoráveis em 12 meses`
  if (valor >= 40) return `${Math.round(valor / 15)} alertas favoráveis em 12 meses`
  return 'Poucos alertas favoráveis recentes'
}

/**
 * Gera texto e fonte por variável a partir de `Processo` + scores; `valor` segue `mockVarValor` por dimensão.
 */
export function gerarVariaveisAutomaticas(
  processo: Processo,
  scores: OpportunityResult,
): OpportunityCardVariaveis {
  const sub = processo.substancia
  const a = scores.scoreAtratividade
  const v = scores.scoreViabilidade
  const s = scores.scoreSeguranca

  const va0 = mockVarValor(a, 0)
  const va1 = mockVarValor(a, 1)
  const va2 = mockVarValor(a, 2)
  const va3 = mockVarValor(a, 3)
  const va4 = mockVarValor(a, 4)

  const vb0 = mockVarValor(v, 0)
  const vb1 = mockVarValor(v, 1)
  const vb2 = mockVarValor(v, 2)
  const vb3 = mockVarValor(v, 3)
  const vb4 = mockVarValor(v, 4)
  const vb5 = mockVarValor(v, 5)
  const vb6 = mockVarValor(v, 6)

  const vc0 = mockVarValor(s, 0)
  const vc1 = mockVarValor(s, 1)
  const vc2 = mockVarValor(s, 2)
  const vc3 = mockVarValor(s, 3)
  const vc4 = mockVarValor(s, 4)
  const vc5 = mockVarValor(s, 5)

  const rs = processo.risk_score ?? 0

  const valorReservaTexto =
    processo.valor_estimado_usd_mi === 0
      ? 'Valor de reserva não estimado'
      : `Reserva estimada em US$ ${processo.valor_estimado_usd_mi}M`

  return {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: va0,
        texto: `${sub}: ${textoRelevanciaSubstancia(sub)}`,
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: va1,
        texto: textoGapReservaProducao(va1),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: va2,
        texto: textoPrecoUsdT(sub),
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: va3,
        texto: textoTendenciaDemanda(va3),
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: va4,
        texto: valorReservaTexto,
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: vb0,
        texto: textoCapagMunicipio(vb0),
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: vb1,
        texto: textoFaseProcesso(processo.fase),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: vb2,
        texto: textoInfraLogistica(vb2),
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: vb3,
        texto: `${processo.area_ha.toLocaleString('pt-BR')} ha`,
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: vb4,
        texto: textoAutonomiaFiscal(vb4),
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: vb5,
        texto: textoSituacaoProcesso(processo.situacao),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: vb6,
        texto: textoIncentivosRegionais(vb6),
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: vc0,
        texto: `Risk Score ${rs}/100 (${qualificadorRiskScore(rs)})`,
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: vc1,
        texto: textoConformidadeAmbiental(vc1),
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: vc2,
        texto: textoRegularidadeRegulatoria(vc2),
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: vc3,
        texto: textoHistoricoDespachos(vc3),
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: vc4,
        texto: textoAusenciaRestricoes(vc4),
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: vc5,
        texto: textoAlertasFavoraveis(vc5),
        fonte: 'Adoo',
      },
    ],
  }
}
```

## 3. Tipos / interfaces

Consolidado na **secção 2a** (`src/lib/opportunityScore.ts`). Não existe ficheiro dedicado em `src/types/` só para oportunidade/prospecção.

## 4. Store do Radar

**ARQUIVO NÃO ENCONTRADO** — não há store Zustand dedicado à prospecção. Caminhos tentados: `src/store/useRadarStore.ts`, `src/store/useRadarStore.tsx`, `src/store/radarStore.ts`.

## 4b. Estado local — `RadarDashboard.tsx` (wizard, resultados, `computeOpportunityForProcesso`)
**Arquivo:** `src/components/dashboard/RadarDashboard.tsx`
```tsx
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import { RadarBackgroundAnimation } from './RadarBackgroundAnimation'
import { RadarAlertasSubtab } from './RadarAlertasSubtab'
import { ProspeccaoWizard } from './ProspeccaoWizard'
import { ProspeccaoResultados } from './ProspeccaoResultados'
import { TerraeLogoLoading } from './animations/TerraeLogoLoading'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  computeOpportunityForProcesso,
  type ObjetivoProspeccao,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { MOTION_GROUP_FADE_MS } from '../../lib/motionDurations'
import { TODAS_SUBST } from '../../lib/substancias'

/** Snapshot dos filtros da última análise concluída (para pular loading se iguais). */
interface FiltrosSnapshot {
  objetivo: string
  substancias: string[]
  perfil: string
  ufs: string[]
}

function buildFiltrosSnapshot(
  objetivo: ObjetivoProspeccao,
  subst: string[],
  perfil: PerfilRisco,
  ufs: string[],
): FiltrosSnapshot {
  return {
    objetivo,
    substancias: [...subst].sort(),
    perfil,
    ufs: [...ufs].sort(),
  }
}

function filtrosIguais(a: FiltrosSnapshot, b: FiltrosSnapshot): boolean {
  return (
    a.objetivo === b.objetivo &&
    a.perfil === b.perfil &&
    JSON.stringify(a.substancias) === JSON.stringify(b.substancias) &&
    JSON.stringify(a.ufs) === JSON.stringify(b.ufs)
  )
}

type RadarViewState =
  | 'home'
  | 'transitioning-to-wizard'
  | 'transitioning-resultados-to-wizard'
  | 'wizard'
  | 'resultados'
  | 'transitioning-to-home'

const containersLayout: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: '0 0 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

function getElementStyle(
  viewState: RadarViewState,
  entryPhase: number,
  element: 'radar' | 'cta' | 'containers' | 'footer',
  reducedMotion: boolean,
): CSSProperties {
  if (reducedMotion) {
    if (element === 'containers') {
      return {
        ...containersLayout,
        opacity: 1,
        transform: 'translateY(0)',
        pointerEvents: 'auto',
      }
    }
    if (element === 'footer') {
      return { opacity: 1, transform: 'translateY(0)' }
    }
    return { opacity: 1, transform: 'none' }
  }

  if (viewState === 'transitioning-to-wizard') {
    switch (element) {
      case 'radar':
        return { opacity: 0, transition: 'opacity 400ms ease-in' }
      case 'cta':
        return {
          opacity: 0,
          transform: 'translateY(-20px)',
          transition: 'opacity 300ms ease-in, transform 300ms ease-in',
        }
      case 'containers':
        return {
          ...containersLayout,
          opacity: 0,
          transform: 'translateY(60px)',
          transition: 'opacity 350ms ease-in, transform 350ms ease-in',
          pointerEvents: 'none',
        }
      case 'footer':
        return { opacity: 0, transition: 'opacity 300ms ease-in' }
      default:
        return {}
    }
  }

  switch (element) {
    case 'radar':
      return {
        opacity: entryPhase >= 1 ? 1 : 0,
        transform: entryPhase >= 1 ? 'scale(1)' : 'scale(0.97)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
      }
    case 'cta':
      return {
        opacity: entryPhase >= 2 ? 1 : 0,
        transform: entryPhase >= 2 ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 350ms ease-out, transform 350ms ease-out',
        pointerEvents: entryPhase >= 2 ? 'auto' : 'none',
      }
    case 'containers':
      return {
        ...containersLayout,
        opacity: entryPhase >= 3 ? 1 : 0,
        transform: entryPhase >= 3 ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
        pointerEvents: entryPhase >= 3 ? 'auto' : 'none',
      }
    case 'footer':
      return {
        opacity: entryPhase >= 3 ? 1 : 0,
        transform: entryPhase >= 3 ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
      }
    default:
      return {}
  }
}

export function RadarDashboard({
  reducedMotion = false,
}: {
  reducedMotion?: boolean
} = {}) {
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const pendingRadarAlertaId = useAppStore((s) => s.pendingRadarAlertaId)
  const radarAbrirHomeIntent = useAppStore((s) => s.radarAbrirHomeIntent)
  const setRadarAbrirHomeIntent = useAppStore((s) => s.setRadarAbrirHomeIntent)
  const processos = useMapStore((s) => s.processos)
  const setPendingNavigation = useMapStore((s) => s.setPendingNavigation)

  const processoById = useMemo(() => {
    const m = new Map<string, Processo>()
    for (const p of processos) m.set(p.id, p)
    return m
  }, [processos])

  const substanciasCatalogo = useMemo(() => {
    const s = new Set<string>()
    for (const p of processos) s.add(p.substancia)
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos])

  const prospeccaoSubstOpcoes = useMemo(
    () => [TODAS_SUBST, ...substanciasCatalogo],
    [substanciasCatalogo],
  )

  const [viewState, setViewState] = useState<RadarViewState>('home')

  /** 0–3: entrada escalonada na home (radar → CTA → containers); 3 = estado final */
  const [entryPhase, setEntryPhase] = useState(() => (reducedMotion ? 3 : 0))

  useLayoutEffect(() => {
    if (viewState !== 'home') return
    if (reducedMotion) {
      setEntryPhase(3)
      return
    }
    setEntryPhase(0)
    const t1 = window.setTimeout(() => setEntryPhase(1), 50)
    const t2 = window.setTimeout(() => setEntryPhase(2), 250)
    const t3 = window.setTimeout(() => setEntryPhase(3), 500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [viewState, reducedMotion])

  const navigateProcessoMapa = useCallback(
    (id: string) => {
      setPendingNavigation({
        type: 'processo',
        payload: id,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
    },
    [setPendingNavigation, setTelaAtiva],
  )

  /* --- Prospecção --- */
  const [homeLeaveSource, setHomeLeaveSource] = useState<'wizard' | 'resultados' | null>(null)
  const [wizardEntryVisible, setWizardEntryVisible] = useState(false)

  const [proObjetivo, setProObjetivo] = useState<ObjetivoProspeccao | null>(null)
  const [proSubst, setProSubst] = useState<string[]>([])
  const [proRisco, setProRisco] = useState<PerfilRisco | null>(null)
  const [proUfs, setProUfs] = useState<string[]>([])
  const [proDdSub, setProDdSub] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadMsgIdx, setLoadMsgIdx] = useState(0)
  const [loadOverlayOut, setLoadOverlayOut] = useState(false)
  const [resultados, setResultados] = useState<OpportunityResult[]>([])
  const [resultadosDescartados, setResultadosDescartados] = useState<OpportunityResult[]>([])
  const [excluidosCount, setExcluidosCount] = useState(0)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [wizardEntryStep, setWizardEntryStep] = useState<1 | 2 | 3 | 4>(1)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false)
  const [ultimosFiltrosAnalise, setUltimosFiltrosAnalise] = useState<FiltrosSnapshot | null>(
    null,
  )
  const [skipStaggerResultados, setSkipStaggerResultados] = useState(false)
  const prevTelaRef = useRef(telaAtiva)

  const loadingMsgs = [
    'Cruzando 30 processos com 7 camadas territoriais...',
    'Analisando alertas de 2.500 fontes regulatórias...',
    'Calculando viabilidade econômica e logística...',
    'Aplicando perfil de risco selecionado...',
    'Gerando ranking de oportunidades...',
  ]

  const substanciasFiltroProspeccao = useMemo(() => {
    if (proSubst.includes(TODAS_SUBST)) return null
    const xs = proSubst.filter((x) => x !== TODAS_SUBST)
    return xs.length > 0 ? xs : null
  }, [proSubst])

  const runAnalise = useCallback(() => {
    if (!proObjetivo || !proRisco) return
    let rows = [...processos]
    if (substanciasFiltroProspeccao != null) {
      const allow = new Set(substanciasFiltroProspeccao)
      rows = rows.filter((p) => allow.has(p.substancia))
    }
    if (proUfs.length > 0) {
      rows = rows.filter((p) => proUfs.includes(p.uf))
    }
    const scored = rows
      .map((p) => computeOpportunityForProcesso(p, proRisco, proObjetivo))
      .sort((a, b) => b.scoreTotal - a.scoreTotal)
    const excl = scored.filter((r) => r.scoreTotal <= 24)
    setExcluidosCount(excl.length)
    setResultadosDescartados(excl)
    setResultados(scored.filter((r) => r.scoreTotal > 24))
  }, [processos, proObjetivo, proRisco, substanciasFiltroProspeccao, proUfs])

  useEffect(() => {
    if (!loadingOverlayVisible) return
    setSelectedResultId(null)
    setLoadProgress(0)
    setLoadMsgIdx(0)
    setLoadOverlayOut(false)
    const t0 = Date.now()
    let done = false
    const msgId = window.setInterval(() => {
      setLoadMsgIdx((i) => (i + 1) % loadingMsgs.length)
    }, 1200)
    const id = window.setInterval(() => {
      const elapsed = Date.now() - t0
      const p = Math.min(100, (elapsed / 5000) * 100)
      setLoadProgress(p)
      if (elapsed >= 5000 && !done) {
        done = true
        clearInterval(id)
        clearInterval(msgId)
        setLoadOverlayOut(true)
        window.setTimeout(() => {
          runAnalise()
          if (proObjetivo && proRisco) {
            setUltimosFiltrosAnalise(
              buildFiltrosSnapshot(proObjetivo, proSubst, proRisco, proUfs),
            )
          }
          setLoadingOverlayVisible(false)
          setLoadOverlayOut(false)
          setViewState('resultados')
        }, reducedMotion ? 0 : 300)
      }
    }, 50)
    return () => {
      clearInterval(id)
      clearInterval(msgId)
    }
  }, [
    loadingOverlayVisible,
    runAnalise,
    reducedMotion,
    loadingMsgs.length,
    proObjetivo,
    proRisco,
    proSubst,
    proUfs,
  ])

  const cardStaggerCount = resultados.length > 0 ? resultados.length : 1
  const cardVis = useStaggeredEntrance(cardStaggerCount, {
    baseDelayMs: reducedMotion ? 0 : 200,
    staggerMs: reducedMotion ? 0 : 80,
    reducedMotion,
    skipAnimation: skipStaggerResultados,
  })

  const [barsReady, setBarsReady] = useState(false)

  useEffect(() => {
    if (viewState !== 'resultados') {
      setBarsReady(false)
      return
    }
    if (reducedMotion || skipStaggerResultados) {
      setBarsReady(true)
      return
    }
    const n = Math.max(1, resultados.length)
    const delayMs = 200 + (n - 1) * 80 + MOTION_GROUP_FADE_MS
    const id = window.setTimeout(() => setBarsReady(true), delayMs)
    return () => clearTimeout(id)
  }, [viewState, reducedMotion, resultados.length, skipStaggerResultados])

  useEffect(() => {
    const prev = prevTelaRef.current
    if (prev === 'mapa' && telaAtiva === 'radar' && viewState === 'resultados') {
      setSkipStaggerResultados(true)
    }
    prevTelaRef.current = telaAtiva
  }, [telaAtiva, viewState])

  useEffect(() => {
    if (viewState !== 'resultados') {
      setSkipStaggerResultados(false)
    }
  }, [viewState])

  useEffect(() => {
    if (telaAtiva !== 'radar') return
    if (pendingRadarAlertaId) {
      setViewState('home')
      return
    }
    if (radarAbrirHomeIntent) {
      setViewState('home')
      setRadarAbrirHomeIntent(false)
    }
  }, [telaAtiva, pendingRadarAlertaId, radarAbrirHomeIntent, setRadarAbrirHomeIntent])

  const resetProspeccao = useCallback(() => {
    setProObjetivo(null)
    setProSubst([])
    setProRisco(null)
    setProUfs([])
    setResultados([])
    setResultadosDescartados([])
    setExcluidosCount(0)
    setSelectedResultId(null)
    setLoadingOverlayVisible(false)
    setUltimosFiltrosAnalise(null)
  }, [])

  const handleIniciarProspeccao = useCallback(() => {
    setWizardEntryStep(1)
    if (reducedMotion) {
      setViewState('wizard')
      return
    }
    setViewState('transitioning-to-wizard')
    window.setTimeout(() => setViewState('wizard'), 500)
  }, [reducedMotion])

  const handleCancelWizard = useCallback(() => {
    setLoadingOverlayVisible(false)
    setWizardEntryStep(1)
    if (reducedMotion) {
      setViewState('home')
      return
    }
    setHomeLeaveSource('wizard')
    setViewState('transitioning-to-home')
    window.setTimeout(() => {
      setEntryPhase(0)
      setViewState('home')
      setHomeLeaveSource(null)
    }, 400)
  }, [reducedMotion])

  const handleAnalisar = useCallback(() => {
    if (!proObjetivo || !proRisco) return
    const snap = buildFiltrosSnapshot(proObjetivo, proSubst, proRisco, proUfs)
    if (
      ultimosFiltrosAnalise &&
      filtrosIguais(ultimosFiltrosAnalise, snap) &&
      resultados.length > 0
    ) {
      setViewState('resultados')
      return
    }
    setLoadingOverlayVisible(true)
  }, [proObjetivo, proRisco, proSubst, proUfs, ultimosFiltrosAnalise, resultados.length])

  const handleRefinarBusca = useCallback(() => {
    setWizardEntryStep(4)
    if (reducedMotion) {
      setViewState('wizard')
      return
    }
    setViewState('transitioning-resultados-to-wizard')
    window.setTimeout(() => setViewState('wizard'), 300)
  }, [reducedMotion])

  const handleVoltarAoRadar = useCallback(() => {
    if (reducedMotion) {
      setEntryPhase(0)
      setViewState('home')
      resetProspeccao()
      return
    }
    setHomeLeaveSource('resultados')
    setViewState('transitioning-to-home')
    window.setTimeout(() => {
      setEntryPhase(0)
      setViewState('home')
      setHomeLeaveSource(null)
      resetProspeccao()
    }, 300)
  }, [reducedMotion, resetProspeccao])

  useEffect(() => {
    if (viewState === 'wizard') {
      if (reducedMotion) {
        setWizardEntryVisible(true)
        return
      }
      setWizardEntryVisible(false)
      const t = window.setTimeout(() => setWizardEntryVisible(true), 50)
      return () => clearTimeout(t)
    }
    setWizardEntryVisible(false)
  }, [viewState, reducedMotion])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 2800)
  }

  const proPrefixSub =
    proSubst.length === 0
      ? 'Substâncias'
      : proSubst.includes(TODAS_SUBST)
        ? 'Todas'
        : proSubst.length === 1
          ? proSubst[0]!
          : `${proSubst.length} itens`

  const showHomeBlocks =
    viewState === 'home' || viewState === 'transitioning-to-wizard'

  const radarStyle = getElementStyle(viewState, entryPhase, 'radar', reducedMotion)
  const ctaStyle = getElementStyle(viewState, entryPhase, 'cta', reducedMotion)
  const containersStyle = getElementStyle(viewState, entryPhase, 'containers', reducedMotion)
  const footerStyle = getElementStyle(viewState, entryPhase, 'footer', reducedMotion)

  const wizardEntryStyle: CSSProperties = reducedMotion
    ? {}
    : {
        opacity: wizardEntryVisible ? 1 : 0,
        transform: wizardEntryVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 400ms ease-out, transform 400ms ease-out',
      }

  const wizardPanelExitStyle: CSSProperties =
    viewState === 'transitioning-to-home' && homeLeaveSource === 'wizard'
      ? {
          opacity: 0,
          transform: 'translateY(20px)',
          transition: 'opacity 300ms ease-in, transform 300ms ease-in',
        }
      : {}

  const resultadosExitStyle: CSSProperties =
    (viewState === 'transitioning-to-home' && homeLeaveSource === 'resultados') ||
    viewState === 'transitioning-resultados-to-wizard'
      ? {
          opacity: 0,
          transform: 'translateY(20px)',
          transition: 'opacity 300ms ease-in, transform 300ms ease-in',
        }
      : {}

  const headerVisible =
    viewState === 'home' ||
    viewState === 'transitioning-to-wizard' ||
    viewState === 'transitioning-to-home'

  const headerStyle: CSSProperties = reducedMotion
    ? {
        opacity: headerVisible ? 1 : 0,
        height: headerVisible ? 'auto' : 0,
        overflow: 'hidden',
        pointerEvents: headerVisible ? 'auto' : 'none',
      }
    : {
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(-20px)',
        maxHeight: headerVisible ? 200 : 0,
        marginBottom: 0,
        overflow: 'hidden',
        transition: 'opacity 300ms ease, transform 300ms ease, max-height 300ms ease',
        pointerEvents: headerVisible ? 'auto' : 'none',
      }

  const showWizardPanel =
    viewState === 'wizard' ||
    (viewState === 'transitioning-to-home' && homeLeaveSource === 'wizard')

  const showLoadingResults =
    viewState === 'resultados' ||
    (viewState === 'transitioning-to-home' && homeLeaveSource === 'resultados') ||
    viewState === 'transitioning-resultados-to-wizard'

  return (
    <div
      className="terrae-intel-dashboard-scroll box-border flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      style={{
        backgroundColor: '#0D0D0C',
        padding: '24px 0 24px 24px',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <header
        style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
          paddingRight: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #2C2C2A',
          backgroundColor: 'rgba(13, 13, 12, 0.5)',
          backdropFilter: 'blur(34px)',
          WebkitBackdropFilter: 'blur(34px)',
          ...headerStyle,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 500,
            color: '#F1EFE8',
          }}
        >
          Radar
        </h1>
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: 16,
            color: '#888780',
          }}
        >
          Monitoramento regulatório e prospecção de oportunidades do setor mineral
        </p>
      </header>

      {showHomeBlocks ? (
        <div
          style={{
            position: 'relative',
            zIndex: 0,
            flex: '0 0 auto',
            minWidth: 0,
            width: '100%',
            paddingRight: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          {/* Altura fixa (viewport): não estica com o bloco de alertas — evita “salto” do arco/SVG */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: '100vh',
              maxHeight: '100vh',
              zIndex: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              ...radarStyle,
            }}
            aria-hidden
          >
            <RadarBackgroundAnimation />
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'center',
              minHeight: '50vh',
              width: '100%',
              padding: 40,
              paddingTop: '15vh',
              boxSizing: 'border-box',
              ...ctaStyle,
            }}
          >
            <h2
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: '#F1EFE8',
                margin: 0,
              }}
            >
              Prospecção de Oportunidades
            </h2>
            <p
              style={{
                fontSize: 15,
                color: '#888780',
                maxWidth: 480,
                marginTop: 12,
                lineHeight: 1.6,
              }}
            >
              Cruzamos dados de 20+ fontes públicas para identificar as melhores oportunidades do
              setor mineral brasileiro.
            </p>
            <button
              type="button"
              onClick={handleIniciarProspeccao}
              style={{
                marginTop: 32,
                backgroundColor: '#EF9F27',
                color: '#0D0D0C',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                padding: '12px 32px',
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
              Iniciar Prospecção
            </button>
          </div>

          <div style={containersStyle}>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                flex: '0 0 auto',
                minHeight: '50vh',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <RadarAlertasSubtab reducedMotion={reducedMotion} onToast={showToast} />
            </div>
          </div>

          <footer
            style={{
              ...footerStyle,
              position: 'static',
              marginTop: 48,
              paddingTop: 16,
              borderTop: '1px solid #2C2C2A',
              textAlign: 'center',
              fontSize: 11,
              color: '#5F5E5A',
              flexShrink: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo · Atualizado em{' '}
            {new Date().toLocaleDateString('pt-BR')}
          </footer>
        </div>
      ) : null}

      {showWizardPanel ? (
        <>
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              paddingRight: 24,
              display: 'flex',
              flexDirection: 'column',
              ...(viewState === 'transitioning-to-home' && homeLeaveSource === 'wizard'
                ? wizardPanelExitStyle
                : wizardEntryStyle),
            }}
          >
            <ProspeccaoWizard
              key={`wizard-${wizardEntryStep}`}
              reducedMotion={reducedMotion}
              prospeccaoSubstOpcoes={prospeccaoSubstOpcoes}
              proPrefixSub={proPrefixSub}
              proObjetivo={proObjetivo}
              setProObjetivo={setProObjetivo}
              proSubst={proSubst}
              setProSubst={setProSubst}
              proRisco={proRisco}
              setProRisco={setProRisco}
              proUfs={proUfs}
              setProUfs={setProUfs}
              proDdSub={proDdSub}
              setProDdSub={setProDdSub}
              onCancel={handleCancelWizard}
              onAnalisar={handleAnalisar}
              exiting={false}
              initialStep={wizardEntryStep}
            />
            {loadingOverlayVisible ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  backgroundColor: 'rgba(13, 13, 12, 0.72)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loadOverlayOut ? 0 : 1,
                  transition: reducedMotion ? undefined : 'opacity 300ms ease-in',
                }}
              >
                <div style={{ marginBottom: 18 }}>
                  <TerraeLogoLoading size={40} speed={1} />
                </div>
                <p
                  key={loadMsgIdx}
                  style={{
                    fontSize: 18,
                    fontWeight: 400,
                    color: '#B4B2A9',
                    textAlign: 'center',
                    margin: 0,
                    paddingLeft: 16,
                    paddingRight: 16,
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                    overflowX: 'auto',
                    animation: reducedMotion ? undefined : 'terraeRadarFadeMsg 200ms ease-out',
                  }}
                >
                  {loadingMsgs[loadMsgIdx]}
                </p>
                <div
                  style={{
                    marginTop: 20,
                    width: 240,
                    height: 3,
                    backgroundColor: '#2C2C2A',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${loadProgress}%`,
                      backgroundColor: '#EF9F27',
                      borderRadius: 2,
                      transition: reducedMotion ? undefined : 'width 50ms linear',
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {showLoadingResults ? (
        <>
          {(viewState === 'resultados' ||
            (viewState === 'transitioning-to-home' && homeLeaveSource === 'resultados') ||
            viewState === 'transitioning-resultados-to-wizard') && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  paddingRight: 24,
                  paddingTop: 24,
                  ...resultadosExitStyle,
                }}
              >
                <ProspeccaoResultados
                  resultados={resultados}
                  excluidosCount={excluidosCount}
                  resultadosDescartados={resultadosDescartados}
                  processoById={processoById}
                  proRisco={proRisco}
                  proSubst={proSubst}
                  proUfs={proUfs}
                  selectedResultId={selectedResultId}
                  setSelectedResultId={setSelectedResultId}
                  cardVis={cardVis}
                  barsReady={barsReady}
                  reducedMotion={reducedMotion}
                  navigateProcessoMapa={navigateProcessoMapa}
                  handleRefinarBusca={handleRefinarBusca}
                  handleVoltarAoRadar={handleVoltarAoRadar}
                  showToast={showToast}
                />
              </div>

              {viewState === 'resultados' && resultados.length > 0 ? (
                <footer
                  style={{
                    ...footerStyle,
                    flexShrink: 0,
                    marginTop: 'auto',
                    paddingTop: 16,
                    paddingBottom: 8,
                    paddingRight: 24,
                    borderTop: '1px solid #2C2C2A',
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#5F5E5A',
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#0D0D0C',
                  }}
                >
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: '#5F5E5A',
                      textAlign: 'center',
                      lineHeight: 1.5,
                      marginBottom: 0,
                    }}
                  >
                    Análise baseada em dados públicos (ANM, STN, USGS, FUNAI, ICMBio). Não constitui recomendação de
                    investimento. Consulte especialistas antes de tomar decisões.
                  </p>
                </footer>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {toastMsg ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: '#2C2C2A',
            border: '1px solid #5F5E5A',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 13,
            color: '#F1EFE8',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  )
}
```

## 5a. Wizard de prospecção (`ProspeccaoWizard.tsx`)
**Arquivo:** `src/components/dashboard/ProspeccaoWizard.tsx`
```tsx
import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, MapPin, Scale, Shield, TrendingUp } from 'lucide-react'
import { UFS_INTEL_DASHBOARD } from './InteligenciaDashboard'
import { ProspeccaoAnimations } from './ProspeccaoAnimations'
import { ObjetivoCard, RiscoCard } from './ProspeccaoCards'
import type { ObjetivoProspeccao, PerfilRisco } from '../../lib/opportunityScore'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'
import { TODAS_SUBST } from '../../lib/substancias'


/** Exibição das pills (title case por palavra); valores internos permanecem como no catálogo. */
function substanciaPillLabel(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const STEP_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Qual seu objetivo com esta prospecção?',
  2: 'Quais substâncias te interessam?',
  3: 'Qual seu apetite de risco?',
  4: 'Preferência geográfica',
}

const STEP_SUBTEXTS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Escolha o que melhor descreve sua busca.',
  2: 'Selecione uma ou mais substâncias.',
  3: 'Isso ajusta os pesos da Pontuação de Oportunidade.',
  4: 'Opcional. Deixe em branco para analisar todo o Brasil.',
}

const navGhostButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  fontSize: 15,
  color: '#F1EFE8',
  cursor: 'pointer',
  fontWeight: 400,
}

export function ProspeccaoWizard({
  reducedMotion,
  prospeccaoSubstOpcoes,
  proPrefixSub: _proPrefixSub,
  proObjetivo,
  setProObjetivo,
  proSubst,
  setProSubst,
  proRisco,
  setProRisco,
  proUfs,
  setProUfs,
  proDdSub: _proDdSub,
  setProDdSub: _setProDdSub,
  onCancel,
  onAnalisar,
  exiting = false,
  initialStep,
}: {
  reducedMotion: boolean
  prospeccaoSubstOpcoes: string[]
  proPrefixSub: string
  proObjetivo: ObjetivoProspeccao | null
  setProObjetivo: (o: ObjetivoProspeccao | null) => void
  proSubst: string[]
  setProSubst: (s: string[]) => void
  proRisco: PerfilRisco | null
  setProRisco: (r: PerfilRisco | null) => void
  proUfs: string[]
  setProUfs: (u: string[]) => void
  proDdSub: boolean
  setProDdSub: (v: boolean) => void
  onCancel: () => void
  onAnalisar: () => void
  exiting?: boolean
  initialStep?: 1 | 2 | 3 | 4
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(() => initialStep ?? 1)
  const [stepContentVisible, setStepContentVisible] = useState(true)
  const [animationVisible, setAnimationVisible] = useState(true)
  const [animationStep, setAnimationStep] = useState<1 | 2 | 3 | 4>(() => initialStep ?? 1)

  const stepValido = useMemo(() => {
    switch (currentStep) {
      case 1:
        return proObjetivo != null
      case 2:
        return proSubst.length > 0
      case 3:
        return proRisco != null
      case 4:
        return true
      default:
        return false
    }
  }, [currentStep, proObjetivo, proRisco, proSubst.length])

  const changeStep = useCallback(
    (newStep: number) => {
      const ns = newStep as 1 | 2 | 3 | 4
      if (reducedMotion) {
        setCurrentStep(ns)
        setAnimationStep(ns)
        return
      }
      setStepContentVisible(false)
      setAnimationVisible(false)
      window.setTimeout(() => {
        setCurrentStep(ns)
        setAnimationStep(ns)
        window.setTimeout(() => {
          setStepContentVisible(true)
          setAnimationVisible(true)
        }, 50)
      }, 200)
    },
    [reducedMotion],
  )

  const handleNextStep = () => {
    if (currentStep < 4) changeStep(currentStep + 1)
  }

  const handlePrevStep = () => {
    if (currentStep > 1) changeStep(currentStep - 1)
  }

  const exitingLeftStyle: CSSProperties = exiting
    ? {
        opacity: 0,
        transform: 'translateX(-40px)',
        transition: 'opacity 300ms ease-in, transform 300ms ease-in',
      }
    : {}

  const stepContentStyle: CSSProperties = reducedMotion
    ? {}
    : {
        opacity: stepContentVisible ? 1 : 0,
        transform: stepContentVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }

  const subtextStyle: CSSProperties = {
    fontSize: 15,
    color: '#B4B2A9',
    marginTop: 8,
    marginBottom: 24,
  }

  const substanciasSemTodas = prospeccaoSubstOpcoes.filter((s) => s !== TODAS_SUBST)

  const toggleTodasSubst = () => {
    if (proSubst.includes(TODAS_SUBST)) setProSubst([])
    else setProSubst([TODAS_SUBST])
  }

  const togglePillSubstancia = (substancia: string) => {
    if (proSubst.includes(TODAS_SUBST)) {
      const todas = prospeccaoSubstOpcoes.filter((s) => s !== TODAS_SUBST && s !== substancia)
      setProSubst(todas)
      return
    }
    if (proSubst.includes(substancia)) {
      setProSubst(proSubst.filter((s) => s !== substancia))
    } else {
      setProSubst([...proSubst, substancia])
    }
  }

  const h2Style: CSSProperties = {
    fontSize: 22,
    fontWeight: 500,
    color: '#F1EFE8',
    margin: 0,
    lineHeight: 1.3,
  }

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        height: '100%',
        alignSelf: 'stretch',
        gap: 0,
        marginTop: 24,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          flex: '0 0 50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '40px 60px 40px 40px',
          paddingTop: '18vh',
          boxSizing: 'border-box',
          minHeight: 0,
          overflow: 'hidden',
          ...exitingLeftStyle,
        }}
      >
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 13,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: '#888780',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              Etapa {currentStep} de 4
            </div>
            <div
              style={{
                display: 'flex',
                gap: 4,
                width: '100%',
                maxWidth: 280,
              }}
            >
              {([1, 2, 3, 4] as const).map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: step <= currentStep ? '#EF9F27' : '#2C2C2A',
                    transition: 'background-color 300ms ease',
                  }}
                />
              ))}
            </div>
          </div>

          <h2 style={h2Style}>{STEP_TITLES[currentStep]}</h2>
          <p style={subtextStyle}>{STEP_SUBTEXTS[currentStep]}</p>

          <div style={stepContentStyle}>
            {currentStep === 1 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                }}
              >
                <ObjetivoCard
                  selected={proObjetivo === 'investir'}
                  onClick={() => setProObjetivo('investir')}
                  icon={<TrendingUp size={20} />}
                  label="Investir em processo existente"
                />
                <ObjetivoCard
                  selected={proObjetivo === 'novo_requerimento'}
                  onClick={() => setProObjetivo('novo_requerimento')}
                  icon={<MapPin size={20} />}
                  label="Identificar áreas para novo requerimento"
                />
                <ObjetivoCard
                  selected={proObjetivo === 'avaliar_portfolio'}
                  onClick={() => setProObjetivo('avaliar_portfolio')}
                  icon={<BarChart3 size={20} />}
                  label="Avaliar portfólio atual"
                />
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    onClick={toggleTodasSubst}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: proSubst.includes(TODAS_SUBST) ? '#EF9F27' : '#2C2C2A',
                      backgroundColor: proSubst.includes(TODAS_SUBST)
                        ? 'rgba(239, 159, 39, 0.12)'
                        : '#111110',
                      color: proSubst.includes(TODAS_SUBST) ? '#EF9F27' : '#D3D1C7',
                    }}
                  >
                    Todas
                  </button>
                  {substanciasSemTodas.map((substancia) => {
                    const isSelected =
                      proSubst.includes(substancia) || proSubst.includes(TODAS_SUBST)
                    const corSub = corSubstanciaOuUndefined(substancia) ?? '#EF9F27'
                    return (
                      <button
                        key={substancia}
                        type="button"
                        onClick={() => togglePillSubstancia(substancia)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 20,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: isSelected ? corSub : '#2C2C2A',
                          backgroundColor: isSelected ? `${corSub}1A` : '#111110',
                          color: isSelected ? corSub : '#D3D1C7',
                        }}
                      >
                        {substanciaPillLabel(substancia)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                }}
              >
                <RiscoCard
                  selected={proRisco === 'conservador'}
                  onClick={() => setProRisco('conservador')}
                  icon={<Shield size={20} />}
                  iconSelectedColor="#1D9E75"
                  label="Conservador"
                  desc="Prioriza segurança e processos consolidados"
                />
                <RiscoCard
                  selected={proRisco === 'moderado'}
                  onClick={() => setProRisco('moderado')}
                  icon={<Scale size={20} />}
                  iconSelectedColor="#E8A830"
                  label="Moderado"
                  desc="Equilíbrio entre risco e retorno"
                />
                <RiscoCard
                  selected={proRisco === 'arrojado'}
                  onClick={() => setProRisco('arrojado')}
                  icon={<TrendingUp size={20} />}
                  iconSelectedColor="#E24B4A"
                  label="Arrojado"
                  desc="Aceita risco elevado por alta recompensa"
                />
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setProUfs([])}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: proUfs.length === 0 ? '#EF9F27' : '#2C2C2A',
                      backgroundColor: proUfs.length === 0 ? 'rgba(239, 159, 39, 0.12)' : '#111110',
                      color: proUfs.length === 0 ? '#EF9F27' : '#D3D1C7',
                    }}
                  >
                    Todo o Brasil
                  </button>
                  {[...UFS_INTEL_DASHBOARD].map((uf) => {
                    const isSelected = proUfs.includes(uf)
                    return (
                      <button
                        key={uf}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setProUfs(proUfs.filter((u) => u !== uf))
                          } else {
                            setProUfs([...proUfs, uf])
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 20,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: isSelected ? '#EF9F27' : '#2C2C2A',
                          backgroundColor: isSelected ? 'rgba(239, 159, 39, 0.12)' : '#111110',
                          color: isSelected ? '#EF9F27' : '#D3D1C7',
                        }}
                      >
                        {uf}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 32,
            }}
          >
            {currentStep > 1 ? (
              <button type="button" onClick={handlePrevStep} style={navGhostButtonStyle}>
                Voltar
              </button>
            ) : null}
            {currentStep === 1 ? (
              <button type="button" onClick={onCancel} style={navGhostButtonStyle}>
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              disabled={!stepValido}
              onClick={currentStep < 4 ? handleNextStep : onAnalisar}
              style={{
                backgroundColor: '#EF9F27',
                color: '#0D0D0C',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                padding: '10px 28px',
                border: 'none',
                cursor: stepValido ? 'pointer' : 'not-allowed',
                opacity: stepValido ? 1 : 0.4,
                transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                if (!stepValido) return
                e.currentTarget.style.filter = 'brightness(1.1)'
                e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {currentStep < 4 ? 'Próximo' : 'Analisar oportunidades'}
            </button>
          </div>
        </div>
      </div>

      <ProspeccaoAnimations
        currentStep={animationStep}
        visible={animationVisible}
        reducedMotion={reducedMotion}
        exiting={exiting}
      />
    </div>
  )
}
```

## 5b. Cartões objetivo/risco (`ProspeccaoCards.tsx`)
**Arquivo:** `src/components/dashboard/ProspeccaoCards.tsx`
```tsx
import {
  cloneElement,
  isValidElement,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Check } from 'lucide-react'

const baseLayout: CSSProperties = {
  textAlign: 'left',
  borderRadius: 10,
  padding: '18px 20px',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease-out, background-color 0.15s ease-out, box-shadow 0.15s ease-out',
  width: '100%',
  boxSizing: 'border-box',
  position: 'relative',
  borderWidth: 1,
  borderStyle: 'solid',
}

function cardSurface(selected: boolean, isHovered: boolean): Pick<
  CSSProperties,
  'borderColor' | 'backgroundColor' | 'boxShadow'
> {
  if (selected) {
    return {
      borderColor: '#EF9F27',
      backgroundColor: 'rgba(239, 159, 39, 0.06)',
      boxShadow: '0 0 12px rgba(239, 159, 39, 0.08)',
    }
  }
  if (isHovered) {
    return {
      borderColor: '#888780',
      backgroundColor: '#1A1A18',
      boxShadow: 'none',
    }
  }
  return {
    borderColor: '#2C2C2A',
    backgroundColor: '#111110',
    boxShadow: 'none',
  }
}

export function ObjetivoCard({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  const [hover, setHover] = useState(false)
  const isHovered = hover && !selected
  const surface = cardSurface(selected, isHovered)

  const iconColor = selected ? '#EF9F27' : isHovered ? '#B4B2A9' : '#888780'
  const iconEl =
    isValidElement(icon) && icon != null
      ? cloneElement(icon as ReactElement<{ size?: number; color?: string }>, {
          size: 18,
          color: iconColor,
        })
      : icon

  const iconContainerBg = selected
    ? 'rgba(239, 159, 39, 0.12)'
    : isHovered
      ? '#2C2C2A'
      : '#1A1A18'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...baseLayout,
        ...surface,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: iconContainerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
        >
          {iconEl}
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: selected || isHovered ? '#F1EFE8' : '#D3D1C7',
            }}
          >
            {label}
          </div>
        </div>
      </div>
      {selected ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: 12,
            transform: 'translateY(-50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#EF9F27',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={12} color="#0D0D0C" strokeWidth={3} />
        </div>
      ) : null}
    </button>
  )
}

export function RiscoCard({
  selected,
  onClick,
  icon,
  iconSelectedColor,
  label,
  desc,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  iconSelectedColor: string
  label: string
  desc: string
}) {
  const [hover, setHover] = useState(false)
  const isHovered = hover && !selected
  const surface = cardSurface(selected, isHovered)

  const iconColor = selected ? iconSelectedColor : isHovered ? '#B4B2A9' : '#888780'
  const iconEl =
    isValidElement(icon) && icon != null
      ? cloneElement(icon as ReactElement<{ size?: number; color?: string }>, {
          size: 18,
          color: iconColor,
        })
      : icon

  const iconContainerBg = selected
    ? 'rgba(239, 159, 39, 0.12)'
    : isHovered
      ? '#2C2C2A'
      : '#1A1A18'

  const descColor = selected ? '#B4B2A9' : isHovered ? '#B4B2A9' : '#888780'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...baseLayout,
        ...surface,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: iconContainerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
        >
          {iconEl}
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: selected || isHovered ? '#F1EFE8' : '#D3D1C7',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: descColor,
              marginTop: 2,
            }}
          >
            {desc}
          </div>
        </div>
      </div>
      {selected ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: 12,
            transform: 'translateY(-50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#EF9F27',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={12} color="#0D0D0C" strokeWidth={3} />
        </div>
      ) : null}
    </button>
  )
}
```

## 5c. Animações do wizard (`ProspeccaoAnimations.tsx`)
**Arquivo:** `src/components/dashboard/ProspeccaoAnimations.tsx`
```tsx
import type { CSSProperties } from 'react'
import { RadarSweepAnimation } from './animations/RadarSweepAnimation'
import { SubstanciasRadarAnimation } from './animations/SubstanciasRadarAnimation'
import { RiskCalibrationAnimation } from './animations/RiskCalibrationAnimation'
import { RegionFocusAnimation } from './animations/RegionFocusAnimation'

export function ProspeccaoAnimations({
  currentStep,
  visible,
  reducedMotion,
  exiting = false,
}: {
  currentStep: 1 | 2 | 3 | 4
  visible: boolean
  reducedMotion: boolean
  exiting?: boolean
}) {
  const animContainerStyle: CSSProperties = reducedMotion
    ? { opacity: exiting ? 0 : 1, transition: exiting ? 'opacity 300ms ease-in' : undefined }
    : {
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: exiting ? 'opacity 300ms ease-in' : 'opacity 200ms ease',
      }

  return (
    <div
      style={{
        flex: '0 0 50%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0 0 8px 0',
        minHeight: 0,
        backgroundColor: '#0D0D0C',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          ...animContainerStyle,
          position: 'relative',
          width: '100%',
          height: '100%',
          flex: 1,
          minHeight: 0,
        }}
      >
        {currentStep === 1 ? <RadarSweepAnimation /> : null}
        {currentStep === 2 ? <SubstanciasRadarAnimation /> : null}
        {currentStep === 3 ? <RiskCalibrationAnimation /> : null}
        {currentStep === 4 ? <RegionFocusAnimation /> : null}
      </div>
    </div>
  )
}
```

