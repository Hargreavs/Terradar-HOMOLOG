# TERRAE — Export: transições e motion da aba Radar

Exportação completa dos arquivos solicitados (somente leitura; cópia fiel ao repositório).

**Nota:** `ProspeccaoResultados` é componente em `src/components/dashboard/ProspeccaoResultados.tsx` e é renderizado por `RadarDashboard` (não inline).

=== ARQUIVO: src/components/dashboard/RadarDashboard.tsx ===
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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

type RadarViewState =
  | 'home'
  | 'transitioning-to-wizard'
  | 'transitioning-resultados-to-wizard'
  | 'wizard'
  | 'resultados'
  | 'transitioning-to-home'

const TODAS_SUBST = '__TODAS__'

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

  /** 0â€“3: entrada escalonada na home (radar â†’ CTA â†’ containers); 3 = estado final */
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

  /* --- ProspecÃ§Ã£o --- */
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

  const loadingMsgs = [
    'Cruzando 30 processos com 7 camadas territoriais...',
    'Analisando alertas de 2.500 fontes regulatÃ³rias...',
    'Calculando viabilidade econÃ´mica e logÃ­stica...',
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
  }, [loadingOverlayVisible, runAnalise, reducedMotion, loadingMsgs.length])

  const cardStaggerCount = resultados.length > 0 ? resultados.length : 1
  const cardVis = useStaggeredEntrance(cardStaggerCount, {
    baseDelayMs: reducedMotion ? 0 : 100,
    staggerMs: reducedMotion ? 0 : 80,
    reducedMotion,
  })

  const barsReady = viewState === 'resultados' && !reducedMotion

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
    setLoadingOverlayVisible(true)
  }, [])

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
      ? 'SubstÃ¢ncias'
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
        padding: 24,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <header
        style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
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
          Monitoramento regulatÃ³rio e prospecÃ§Ã£o de oportunidades do setor mineral
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              pointerEvents: 'none',
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
              ProspecÃ§Ã£o de Oportunidades
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
              Cruzamos dados de 20+ fontes pÃºblicas para identificar as melhores oportunidades do
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
              Iniciar ProspecÃ§Ã£o
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

          {viewState !== 'resultados' ? (
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
              Dados: ANM/SIGMINE Â· FUNAI Â· ICMBio Â· STN Â· Adoo Â· Atualizado em{' '}
              {new Date().toLocaleDateString('pt-BR')}
            </footer>
          ) : null}
        </div>
      ) : null}

      {showWizardPanel ? (
        <>
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
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
              className="terrae-intel-dashboard-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '24px 0',
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
          )}

          {viewState === 'resultados' && resultados.length > 0 ? (
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
                AnÃ¡lise baseada em dados pÃºblicos (ANM, STN, USGS, FUNAI, ICMBio). NÃ£o constitui recomendaÃ§Ã£o de
                investimento. Consulte especialistas antes de tomar decisÃµes.
              </p>
            </footer>
          ) : null}
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

=== FIM: src/components/dashboard/RadarDashboard.tsx ===

=== ARQUIVO: src/components/dashboard/ProspeccaoWizard.tsx ===
import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, MapPin, Scale, Shield, TrendingUp } from 'lucide-react'
import { UFS_INTEL_DASHBOARD } from './InteligenciaDashboard'
import { ProspeccaoAnimations } from './ProspeccaoAnimations'
import { ObjetivoCard, RiscoCard } from './ProspeccaoCards'
import type { ObjetivoProspeccao, PerfilRisco } from '../../lib/opportunityScore'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'

const TODAS_SUBST = '__TODAS__'

/** ExibiÃ§Ã£o das pills (title case por palavra); valores internos permanecem como no catÃ¡logo. */
function substanciaPillLabel(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const STEP_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Qual seu objetivo com esta prospecÃ§Ã£o?',
  2: 'Quais substÃ¢ncias te interessam?',
  3: 'Qual seu apetite de risco?',
  4: 'PreferÃªncia geogrÃ¡fica',
}

const STEP_SUBTEXTS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Escolha o que melhor descreve sua busca.',
  2: 'Selecione uma ou mais substÃ¢ncias.',
  3: 'Isso ajusta os pesos da PontuaÃ§Ã£o de Oportunidade.',
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
                  label="Identificar Ã¡reas para novo requerimento"
                />
                <ObjetivoCard
                  selected={proObjetivo === 'avaliar_portfolio'}
                  onClick={() => setProObjetivo('avaliar_portfolio')}
                  icon={<BarChart3 size={20} />}
                  label="Avaliar portfÃ³lio atual"
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
                  desc="Prioriza seguranÃ§a e processos consolidados"
                />
                <RiscoCard
                  selected={proRisco === 'moderado'}
                  onClick={() => setProRisco('moderado')}
                  icon={<Scale size={20} />}
                  iconSelectedColor="#E8A830"
                  label="Moderado"
                  desc="EquilÃ­brio entre risco e retorno"
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
              {currentStep < 4 ? 'PrÃ³ximo' : 'Analisar oportunidades'}
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

=== FIM: src/components/dashboard/ProspeccaoWizard.tsx ===

=== ARQUIVO: src/components/dashboard/ProspeccaoResultados.tsx ===
import { ArrowLeft, ChevronRight, SearchX } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import type { Processo } from '../../types'
import { corSubstanciaOuUndefined } from '../../lib/corSubstancia'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
} from '../../lib/motionDurations'
import {
  PESOS_PERFIL,
  corFaixaOpportunity,
  corMiniBarraValor,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { GridBreathingResultadosAnimation } from './animations/GridBreathingResultadosAnimation'

const TODAS_SUBST = '__TODAS__'

/** Borda 1px â€” dourado mais suave que o accent pleno (#EF9F27) */
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

function faixaLabelCurto(faixa: OpportunityResult['faixa']): string {
  if (faixa === 'alta') return 'Alta'
  if (faixa === 'moderada') return 'Moderada'
  if (faixa === 'baixa') return 'Baixa'
  return 'NÃ£o recomendado'
}

function tooltipAtratividade(r: OpportunityResult, _p: Processo): string {
  if (r.scoreAtratividade >= 70) return 'SubstÃ¢ncia com alta demanda global e preÃ§o favorÃ¡vel'
  if (r.scoreAtratividade >= 50) return 'Demanda estÃ¡vel, preÃ§o dentro da mÃ©dia de mercado'
  if (r.scoreAtratividade >= 30) return 'PreÃ§o de mercado abaixo da mÃ©dia, gap reserva/produÃ§Ã£o'
  return 'Baixa demanda e preÃ§o desfavorÃ¡vel no cenÃ¡rio atual'
}

function tooltipViabilidade(r: OpportunityResult, p: Processo): string {
  if (r.scoreViabilidade >= 70)
    return `MunicÃ­pio ${p.municipio} com classificaÃ§Ã£o fiscal favorÃ¡vel, infraestrutura disponÃ­vel`
  if (r.scoreViabilidade >= 50) return 'Viabilidade operacional moderada, infraestrutura parcial'
  if (r.scoreViabilidade >= 30) return 'RestriÃ§Ãµes logÃ­sticas ou fiscais identificadas'
  return 'Viabilidade comprometida por mÃºltiplos fatores'
}

function tooltipSeguranca(r: OpportunityResult, p: Processo): string {
  const rs = p.risk_score ?? 0
  const riskLabel = rs < 40 ? 'baixo' : rs < 70 ? 'mÃ©dio' : 'alto'
  const scoreStr = p.risk_score != null ? `${p.risk_score}` : 'â€“'
  if (r.scoreSeguranca >= 70)
    return `Risk Score ${scoreStr}/100 (${riskLabel}), sem sobreposiÃ§Ãµes territoriais`
  if (r.scoreSeguranca >= 50)
    return `Risk Score ${scoreStr}/100 (${riskLabel}), atenÃ§Ã£o a sobreposiÃ§Ãµes parciais`
  if (r.scoreSeguranca >= 30)
    return `Risk Score ${scoreStr}/100 (${riskLabel}), sobreposiÃ§Ãµes identificadas`
  return `Risk Score ${scoreStr}/100 (${riskLabel}), mÃºltiplos riscos territoriais`
}

/** Valores mock das variÃ¡veis do accordion, orbitando o sub-score */
function mockVarValor(subScore: number, varIndex: number): number {
  const offsets = [-15, -8, 0, 8, 15, -5, 5]
  const offset = offsets[varIndex % offsets.length] ?? 0
  const val = Math.round(subScore + offset + Math.sin(varIndex * 2.7) * 10)
  return Math.max(5, Math.min(100, val))
}

function motionGroupStyle(visible: boolean, reduced: boolean): CSSProperties {
  if (reduced) return { opacity: 1, transform: 'translateY(0)' }
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${MOTION_GROUP_TRANSLATE_PX}px)`,
    transition: `opacity ${MOTION_GROUP_FADE_MS}ms ease-out, transform ${MOTION_GROUP_FADE_MS}ms ease-out`,
  }
}

function barFillStyle(
  pct: number,
  widthActive: boolean,
  barIndex: number,
  reduced: boolean,
  backgroundColor: string,
): CSSProperties {
  if (reduced) {
    return {
      width: `${pct}%`,
      height: '100%',
      backgroundColor,
      borderRadius: 3,
    }
  }
  return {
    width: widthActive ? `${pct}%` : '0%',
    height: '100%',
    backgroundColor,
    borderRadius: 3,
    transition: `width ${MOTION_BAR_WIDTH_MS}ms ease-out ${barIndex * MOTION_BAR_STAGGER_MS}ms`,
  }
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
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)
  const [showDescartados, setShowDescartados] = useState(false)

  useEffect(() => {
    if (selectedResultId == null) setDrilldownOpen(null)
  }, [selectedResultId])

  useEffect(() => {
    if (drilldownOpen == null) setExpandedDimension(null)
  }, [drilldownOpen])

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
    <div style={{ position: 'relative', backgroundColor: '#0D0D0C', minHeight: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
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
                onClick={() => showToast('DisponÃ­vel em breve')}
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
                Salvar prospecÃ§Ã£o
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
                Nenhum processo atende aos critÃ©rios mÃ­nimos de score para o perfil selecionado. Tente ampliar as
                substÃ¢ncias ou a regiÃ£o.
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
                  Processos analisados (abaixo do score mÃ­nimo)
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
                        <span style={{ color: '#5F5E5A', fontSize: 12 }}>Abaixo do mÃ­nimo</span>
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
              const corFaixa = corFaixaOpportunity(r.faixa)
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
                setDrilldownOpen((prev) => (prev === r.processoId ? null : r.processoId))
              }

              const handleScoreZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedResultId(r.processoId)
                  setDrilldownOpen((prev) => (prev === r.processoId ? null : r.processoId))
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
                        color: corFaixa,
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
                        <span style={{ fontSize: 21, fontWeight: 700, color: '#F1EFE8' }}>{r.scoreTotal}</span>
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
                        {faixaLabelCurto(r.faixa)}
                      </span>
                    </div>
                  </div>

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
                        {p.municipio}, {p.uf} Â· {p.area_ha?.toLocaleString('pt-BR') ?? 'â€“'} ha
                      </div>

                      <div style={{ height: 1, backgroundColor: '#2C2C2A', marginTop: 14, marginBottom: 14 }} />

                      {[
                        {
                          label: 'Atratividade',
                          v: r.scoreAtratividade,
                          tooltip: tooltipAtratividade(r, p),
                        },
                        {
                          label: 'Viabilidade',
                          v: r.scoreViabilidade,
                          tooltip: tooltipViabilidade(r, p),
                        },
                        {
                          label: 'SeguranÃ§a',
                          v: r.scoreSeguranca,
                          tooltip: tooltipSeguranca(r, p),
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
                                fontSize: 13,
                                color: '#8A8880',
                                lineHeight: 1.45,
                              }}
                            >
                              {b.tooltip}
                            </div>
                          </div>
                        )
                      })}

                      <div style={{ height: 1, backgroundColor: '#2C2C2A', marginTop: 14, marginBottom: 14 }} />

                      <div style={{ fontSize: 14, color: '#B4B2A9', lineHeight: 1.45 }}>
                        {r.fatoresPositivos.slice(0, 2).map((t, fi) => (
                          <div
                            key={`p${fi}`}
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'flex-start',
                              marginTop: fi > 0 ? 4 : 0,
                            }}
                          >
                            <span style={{ color: '#1D9E75', flexShrink: 0, fontSize: 14 }}>âœ“</span>
                            <span>{t}</span>
                          </div>
                        ))}
                        {r.fatoresAtencao.slice(0, 1).map((t, fi) => (
                          <div
                            key={`a${fi}`}
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'flex-start',
                              marginTop: 4,
                            }}
                          >
                            <span style={{ color: '#E8A830', flexShrink: 0, fontSize: 14 }}>â—</span>
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>

                      {isSelected ? (
                        <div
                          style={{
                            marginTop: 14,
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
                              setDrilldownOpen(drilldownOpen === r.processoId ? null : r.processoId)
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
                            Ver cÃ¡lculo
                          </button>
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
                        </div>
                      ) : null}
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
                        DecomposiÃ§Ã£o da PontuaÃ§Ã£o
                      </div>
                      <div style={{ fontSize: 15, color: '#8A8880', marginBottom: 16, lineHeight: 1.45 }}>
                        Perfil:{' '}
                        {proRisco
                          ? proRisco.charAt(0).toUpperCase() + proRisco.slice(1)
                          : 'Moderado'}{' '}
                        â€” Atratividade Ã—{pesoA}% + Viabilidade Ã—{pesoV}% + SeguranÃ§a Ã—{pesoS}%
                      </div>
                      {[
                        {
                          label: 'Atratividade',
                          v: r.scoreAtratividade,
                          peso: pesoA,
                          variaveis: [
                            { nome: 'RelevÃ¢ncia da substÃ¢ncia', valor: mockVarValor(r.scoreAtratividade, 0) },
                            { nome: 'Gap reserva/produÃ§Ã£o', valor: mockVarValor(r.scoreAtratividade, 1) },
                            { nome: 'PreÃ§o USD/t', valor: mockVarValor(r.scoreAtratividade, 2) },
                            { nome: 'TendÃªncia de demanda', valor: mockVarValor(r.scoreAtratividade, 3) },
                            { nome: 'Valor estimado da reserva', valor: mockVarValor(r.scoreAtratividade, 4) },
                          ],
                        },
                        {
                          label: 'Viabilidade',
                          v: r.scoreViabilidade,
                          peso: pesoV,
                          variaveis: [
                            { nome: 'CAPAG municipal', valor: mockVarValor(r.scoreViabilidade, 0) },
                            { nome: 'Fase do processo', valor: mockVarValor(r.scoreViabilidade, 1) },
                            { nome: 'Infraestrutura logÃ­stica', valor: mockVarValor(r.scoreViabilidade, 2) },
                            { nome: 'Ãrea (hectares)', valor: mockVarValor(r.scoreViabilidade, 3) },
                            { nome: 'Autonomia fiscal', valor: mockVarValor(r.scoreViabilidade, 4) },
                            { nome: 'SituaÃ§Ã£o do processo', valor: mockVarValor(r.scoreViabilidade, 5) },
                            { nome: 'Incentivos e BNDES', valor: mockVarValor(r.scoreViabilidade, 6) },
                          ],
                        },
                        {
                          label: 'SeguranÃ§a',
                          v: r.scoreSeguranca,
                          peso: pesoS,
                          variaveis: [
                            { nome: 'Risk Score (invertido)', valor: mockVarValor(r.scoreSeguranca, 0) },
                            { nome: 'Risco ambiental', valor: mockVarValor(r.scoreSeguranca, 1) },
                            { nome: 'Risco regulatÃ³rio', valor: mockVarValor(r.scoreSeguranca, 2) },
                            { nome: 'RecÃªncia de despacho', valor: mockVarValor(r.scoreSeguranca, 3) },
                            { nome: 'Alertas restritivos', valor: mockVarValor(r.scoreSeguranca, 4) },
                            { nome: 'Alertas favorÃ¡veis', valor: mockVarValor(r.scoreSeguranca, 5) },
                          ],
                        },
                      ].map((dim, di) => {
                        const c = corMiniBarraValor(dim.v)
                        const contribuicao = Math.round((dim.v * dim.peso) / 100)
                        const isExpanded = expandedDimension === dim.label
                        return (
                          <div key={dim.label} style={{ marginBottom: di < 2 ? 14 : 0 }}>
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
                                {dim.v}/100 â†’ {contribuicao} pts
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
                            {isExpanded ? (
                              <div
                                style={{
                                  marginTop: 10,
                                  marginLeft: 20,
                                  paddingLeft: 12,
                                  borderLeft: `2px solid ${c}30`,
                                }}
                              >
                                {dim.variaveis.map((vrow, vi) => (
                                  <div key={vi} style={{ marginTop: vi > 0 ? 8 : 0 }}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <span style={{ fontSize: 12, color: '#888780' }}>{vrow.nome}</span>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 500,
                                          color: corMiniBarraValor(vrow.valor),
                                        }}
                                      >
                                        {vrow.valor}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        height: 2,
                                        backgroundColor: '#2C2C2A',
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        marginTop: 3,
                                      }}
                                    >
                                      <div
                                        style={{
                                          height: '100%',
                                          width: `${vrow.valor}%`,
                                          backgroundColor: corMiniBarraValor(vrow.valor),
                                          borderRadius: 1,
                                          opacity: 0.7,
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 12,
                          borderTop: '1px solid #2C2C2A',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#D3D1C7',
                            textTransform: 'uppercase',
                          }}
                        >
                          PONTUAÃ‡ÃƒO FINAL
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: corFaixa }}>
                          {r.scoreTotal}/100
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
                            setDrilldownOpen(null)
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

=== FIM: src/components/dashboard/ProspeccaoResultados.tsx ===

=== ARQUIVO: src/components/dashboard/ProspeccaoAnimations.tsx ===
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

=== FIM: src/components/dashboard/ProspeccaoAnimations.tsx ===

=== ARQUIVO: src/components/dashboard/ProspeccaoCards.tsx ===
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

=== FIM: src/components/dashboard/ProspeccaoCards.tsx ===

=== ARQUIVO: src/components/dashboard/animations/TerraeLogoLoading.tsx ===
import { useState, useEffect, useRef } from 'react'

/**
 * TerraeLogo breathing/wave loading animation.
 * 4 bars that do a sequential vertical wave (staggered), like a calm equalizer.
 * Uses the exact Terrae brand gradient colors from the logo.
 */
export function TerraeLogoLoading({ size = 48, speed = 1 }: { size?: number; speed?: number }) {
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

  const bars = [
    { color: '#F0B245', gradEnd: '#E8A830' },
    { color: '#D4952A', gradEnd: '#C48825' },
    { color: '#B07A1F', gradEnd: '#9A6B1A' },
    { color: '#8B6118', gradEnd: '#705012' },
  ]

  const barCount = bars.length
  const barHeight = size / (barCount * 2 - 1)
  const barGap = barHeight
  const barWidth = size * 1.1
  const barRadius = barHeight * 0.2

  const waveFreq = 1.8 * speed
  const waveAmplitude = barHeight * 0.15
  const staggerDelay = 0.15

  return (
    <svg
      width={barWidth}
      height={size}
      viewBox={`0 0 ${barWidth} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {bars.map((bar, i) => (
          <linearGradient key={`grad-${i}`} id={`terraeLoadGrad${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={bar.color} />
            <stop offset="100%" stopColor={bar.gradEnd} />
          </linearGradient>
        ))}
      </defs>

      {bars.map((_, i) => {
        const phase = elapsed * waveFreq - i * staggerDelay * waveFreq
        const wave = Math.sin(phase * Math.PI * 2)
        const displacement = wave > 0 ? -wave * waveAmplitude : 0

        const opacityBoost = wave > 0 ? wave * 0.15 : 0
        const opacity = 0.85 + opacityBoost

        const scaleX = 1 + (wave > 0 ? wave * 0.02 : 0)

        const baseY = i * (barHeight + barGap)
        const y = baseY + displacement

        return (
          <rect
            key={i}
            x={(barWidth - barWidth * scaleX) / 2}
            y={y}
            width={barWidth * scaleX}
            height={barHeight}
            rx={barRadius}
            ry={barRadius}
            fill={`url(#terraeLoadGrad${i})`}
            opacity={opacity}
          />
        )
      })}
    </svg>
  )
}

=== FIM: src/components/dashboard/animations/TerraeLogoLoading.tsx ===

