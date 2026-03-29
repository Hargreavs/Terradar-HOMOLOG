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
