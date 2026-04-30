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
import { RadarBackgroundAnimation } from './RadarBackgroundAnimation'
import { RadarAlertasSubtab } from './RadarAlertasSubtab'
import { ProspeccaoWizard } from './ProspeccaoWizard'
import { ProspeccaoResultados } from './ProspeccaoResultados'
import { RefinarFaseSheet } from './RefinarFaseSheet'
import { RefinarSubstanciaSheet } from './RefinarSubstanciaSheet'
import { TerraeLogoLoading } from './animations/TerraeLogoLoading'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import { type OpportunityResult, type PerfilRisco } from '../../lib/opportunityScore'
import {
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_LOADING,
  MOTION_STAGGER,
  motionTransition,
} from '../../lib/motion'
import { TODAS_SUBST } from '../../lib/substancias'
import type { FamiliasResponse, SubstanciasResponse } from '../../lib/radar/api'
import {
  RADAR_OPORTUNIDADES_PAGE_SIZE,
  SCORE_MINIMO_POR_PERFIL,
  contarOportunidades,
  expandirSubstanciasParaVariantes,
  listarFamiliasDisponiveis,
  listarOportunidades,
  listarSubstanciasDisponiveis,
} from '../../lib/radar/api'

/** Snapshot dos filtros da última análise concluída (para pular loading se iguais). */
interface FiltrosSnapshot {
  substancias: string[]
  perfil: string
  ufs: string[]
  /** Fases aplicadas na listagem (pós-resultado); [] = sem filtro de fase. */
  fases: string[]
}

function buildFiltrosSnapshot(
  subst: string[],
  perfil: PerfilRisco,
  ufs: string[],
  fases: string[],
): FiltrosSnapshot {
  return {
    substancias: [...subst].sort(),
    perfil,
    ufs: [...ufs].sort(),
    fases: [...fases].sort(),
  }
}

function filtrosIguais(a: FiltrosSnapshot, b: FiltrosSnapshot): boolean {
  return (
    a.perfil === b.perfil &&
    JSON.stringify(a.substancias) === JSON.stringify(b.substancias) &&
    JSON.stringify(a.ufs) === JSON.stringify(b.ufs) &&
    JSON.stringify(a.fases) === JSON.stringify(b.fases)
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
  const setPendingNavigation = useMapStore((s) => s.setPendingNavigation)

  const [catalogoSubstancias, setCatalogoSubstancias] = useState<SubstanciasResponse | null>(null)
  const [, setCatalogoFamilias] = useState<FamiliasResponse | null>(null)

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
    (processoId: string, numeroAnm?: string | null) => {
      const num = typeof numeroAnm === 'string' ? numeroAnm.trim() : ''
      setPendingNavigation({
        type: 'processo',
        payload: processoId,
        timestamp: Date.now(),
        ...(num ? { numeroAnm: num } : {}),
      })
      setTelaAtiva('mapa')
    },
    [setPendingNavigation, setTelaAtiva],
  )

  /* --- Prospecção --- */
  const [homeLeaveSource, setHomeLeaveSource] = useState<'wizard' | 'resultados' | null>(null)
  const [wizardEntryVisible, setWizardEntryVisible] = useState(false)

  const [proSubst, setProSubst] = useState<string[]>([])
  const [proRisco, setProRisco] = useState<PerfilRisco | null>(null)
  const [proUfs, setProUfs] = useState<string[]>([])
  const [loadMsgIdx, setLoadMsgIdx] = useState(0)
  const [loadOverlayOut, setLoadOverlayOut] = useState(false)
  const [resultados, setResultados] = useState<OpportunityResult[]>([])
  const [totalOportunidades, setTotalOportunidades] = useState<number | null>(null)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [carregandoPagina, setCarregandoPagina] = useState(false)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const resultadosListRef = useRef<HTMLDivElement | null>(null)
  const [wizardEntryStep, setWizardEntryStep] = useState<1 | 2>(1)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false)
  const [ultimosFiltrosAnalise, setUltimosFiltrosAnalise] = useState<FiltrosSnapshot | null>(
    null,
  )
  const [refinarSubstAberto, setRefinarSubstAberto] = useState(false)
  const [refinarFaseAberto, setRefinarFaseAberto] = useState(false)
  /** Incrementa a cada abertura do sheet de fase para key estável (draft init + animação). */
  const refinarFaseMontagemKey = useRef(0)
  const [proFases, setProFases] = useState<string[]>([])
  const [skipStaggerResultados, setSkipStaggerResultados] = useState(false)
  const prevTelaRef = useRef(telaAtiva)

  const substanciasFiltroProspeccao = useMemo(() => {
    if (proSubst.includes(TODAS_SUBST)) return null
    const xs = proSubst.filter((x) => x !== TODAS_SUBST)
    if (xs.length === 0) return null
    return expandirSubstanciasParaVariantes(xs, catalogoSubstancias)
  }, [proSubst, catalogoSubstancias])

  const loadingMsgs = useMemo(() => {
    if (!proRisco) return []
    const ufLabel =
      proUfs.length === 0 ? 'em todo o Brasil' : proUfs.length === 1 ? `em ${proUfs[0]}` : `em ${proUfs.length} estados`
    const limiar = SCORE_MINIMO_POR_PERFIL[proRisco]
    const nomePerfil =
      proRisco === 'conservador' ? 'conservador' : proRisco === 'moderado' ? 'moderado' : 'arrojado'
    const substPhrase =
      substanciasFiltroProspeccao == null
        ? 'todas as substâncias'
        : substanciasFiltroProspeccao.length === 1
          ? 'a substância filtrada'
          : `${substanciasFiltroProspeccao.length} substâncias`
    return [
      `Filtrando processos ativos ${ufLabel}…`,
      `Aplicando perfil ${nomePerfil} (limiar OS ≥ ${limiar})…`,
      `Selecionando ${substPhrase}…`,
      `Ordenando por Opportunity Score…`,
    ]
  }, [proRisco, proUfs, substanciasFiltroProspeccao])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 2800)
  }, [])

  const buildFiltrosListagem = useCallback(
    (novasSubst: string[], fasesLista: string[]) => {
      if (!proRisco) {
        return null
      }
      const fasesRpc =
        fasesLista.length > 0 ? fasesLista.map((x) => x.trim()).filter(Boolean) : null
      if (novasSubst.includes(TODAS_SUBST)) {
        return {
          perfil: proRisco,
          substancias: null,
          ufs: proUfs.length > 0 ? proUfs : null,
          fases: fasesRpc,
        }
      }
      const xs = novasSubst.filter((s) => s !== TODAS_SUBST)
      return {
        perfil: proRisco,
        substancias:
          xs.length > 0 ? expandirSubstanciasParaVariantes(xs, catalogoSubstancias) : null,
        ufs: proUfs.length > 0 ? proUfs : null,
        fases: fasesRpc,
      }
    },
    [proRisco, proUfs, catalogoSubstancias],
  )

  const handleAplicarFiltroSubstancia = useCallback(
    async (novasSubstancias: string[]) => {
      const substAnterior = proSubst
      setProSubst(novasSubstancias)
      setRefinarSubstAberto(false)
      if (!proRisco) return
      const filtros = buildFiltrosListagem(novasSubstancias, proFases)
      if (!filtros) return
      setCarregandoPagina(true)
      setSelectedResultId(null)
      const [listadoResult, contadoResult] = await Promise.allSettled([
        listarOportunidades(filtros, RADAR_OPORTUNIDADES_PAGE_SIZE, 0),
        contarOportunidades(filtros),
      ])
      if (listadoResult.status === 'rejected') {
        console.error(listadoResult.reason)
        setProSubst(substAnterior)
        showToast('Não foi possível aplicar o filtro. Tente novamente.')
        setResultados([])
        setTotalOportunidades(null)
        setPaginaAtual(1)
        setCarregandoPagina(false)
        return
      }
      setResultados(listadoResult.value.resultados)
      setPaginaAtual(1)
      if (contadoResult.status === 'fulfilled') {
        setTotalOportunidades(contadoResult.value)
      } else {
        setTotalOportunidades(null)
        console.warn('Falha ao contar oportunidades:', contadoResult.reason)
      }
      setUltimosFiltrosAnalise(
        buildFiltrosSnapshot(novasSubstancias, proRisco, proUfs, proFases),
      )
      setCarregandoPagina(false)
    },
    [proRisco, proUfs, proSubst, proFases, showToast, buildFiltrosListagem],
  )

  const handleAplicarFiltroFase = useCallback(
    async (novasFases: string[]) => {
      const fasesAntes = proFases
      setProFases(novasFases)
      setRefinarFaseAberto(false)
      if (!proRisco) return
      const filtros = buildFiltrosListagem(proSubst, novasFases)
      if (!filtros) return
      setCarregandoPagina(true)
      setSelectedResultId(null)
      const [listadoResult, contadoResult] = await Promise.allSettled([
        listarOportunidades(filtros, RADAR_OPORTUNIDADES_PAGE_SIZE, 0),
        contarOportunidades(filtros),
      ])
      if (listadoResult.status === 'rejected') {
        console.error(listadoResult.reason)
        setProFases(fasesAntes)
        showToast('Não foi possível aplicar o filtro de fase. Tente novamente.')
        setResultados([])
        setTotalOportunidades(null)
        setPaginaAtual(1)
        setCarregandoPagina(false)
        return
      }
      setResultados(listadoResult.value.resultados)
      setPaginaAtual(1)
      if (contadoResult.status === 'fulfilled') {
        setTotalOportunidades(contadoResult.value)
      } else {
        setTotalOportunidades(null)
        console.warn('Falha ao contar oportunidades:', contadoResult.reason)
      }
      setUltimosFiltrosAnalise(buildFiltrosSnapshot(proSubst, proRisco, proUfs, novasFases))
      setCarregandoPagina(false)
    },
    [
      buildFiltrosListagem,
      proSubst,
      proRisco,
      proUfs,
      proFases,
      showToast,
    ],
  )

  /** Lista de fases a enviar à RPC (`[]` no assistente nova análise; após filtros na listagem passar `proFases`). */
  const runAnalise = useCallback(async (fasesParaListagem: string[]): Promise<boolean> => {
    if (!proRisco) return false
    const filtros = buildFiltrosListagem(proSubst, fasesParaListagem)
    if (!filtros) return false
    const [listadoResult, contadoResult] = await Promise.allSettled([
      listarOportunidades(filtros, RADAR_OPORTUNIDADES_PAGE_SIZE, 0),
      contarOportunidades(filtros),
    ])
    if (listadoResult.status === 'rejected') {
      console.error(listadoResult.reason)
      showToast('Não foi possível carregar oportunidades. Tente novamente.')
      setResultados([])
      setTotalOportunidades(null)
      setPaginaAtual(1)
      return false
    }
    const pagina = listadoResult.value
    setResultados(pagina.resultados)
    setPaginaAtual(1)
    if (contadoResult.status === 'fulfilled') {
      setTotalOportunidades(contadoResult.value)
    } else {
      setTotalOportunidades(null)
      console.warn('Falha ao contar oportunidades:', contadoResult.reason)
    }
    return true
  }, [showToast, buildFiltrosListagem, proSubst, proRisco])

  const runAnaliseRef = useRef(runAnalise)

  useEffect(() => {
    runAnaliseRef.current = runAnalise
  }, [runAnalise])

  const proSubstRef = useRef(proSubst)
  const proUfsRef = useRef(proUfs)
  const proRiscoRef = useRef(proRisco)

  useEffect(() => {
    proSubstRef.current = proSubst
    proUfsRef.current = proUfs
    proRiscoRef.current = proRisco
  }, [proSubst, proUfs, proRisco])

  const irParaPagina = useCallback(
    async (pagina: number) => {
      if (!proRisco) return
      const offset = (pagina - 1) * RADAR_OPORTUNIDADES_PAGE_SIZE
      setCarregandoPagina(true)
      try {
        const filtros = buildFiltrosListagem(proSubst, proFases)
        if (!filtros) throw new Error('Filtros indisponíveis')
        const resultado = await listarOportunidades(
          filtros,
          RADAR_OPORTUNIDADES_PAGE_SIZE,
          offset,
        )
        setResultados(resultado.resultados)
        setPaginaAtual(pagina)
        resultadosListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch (err) {
        console.error(err)
        showToast('Erro ao carregar página. Tente novamente.')
      } finally {
        setCarregandoPagina(false)
      }
    },
    [proRisco, buildFiltrosListagem, proSubst, proFases, showToast],
  )

  useEffect(() => {
    const perfil = proRisco ?? 'moderado'
    void Promise.all([listarFamiliasDisponiveis(perfil), listarSubstanciasDisponiveis(perfil)])
      .then(([catFams, catSubs]) => {
        setCatalogoFamilias(catFams)
        setCatalogoSubstancias(catSubs)
      })
      .catch((err) => {
        console.error('Falha ao carregar catalogos de substancias:', err)
      })
  }, [proRisco])

  useEffect(() => {
    if (!loadingOverlayVisible || !proRisco) return
    setProFases((prev) => (prev.length === 0 ? prev : []))
    setSelectedResultId(null)
    setLoadMsgIdx(0)
    setLoadOverlayOut(false)
    const msgsLen = Math.max(1, loadingMsgs.length)

    let cancelled = false
    /** Todos os timeouts desta corrida de loading/análise para limpar no teardown. */
    const phaseTimers: number[] = []
    const tStarted = Date.now()
    const MIN_VISIBLE_MS = MOTION_LOADING.minVisibleMs

    const msgId = window.setInterval(() => {
      setLoadMsgIdx((i) => (i + 1) % msgsLen)
    }, 1200)

    void (async () => {
      const ok = await runAnaliseRef.current([])
      if (cancelled) return
      const elapsed = Date.now() - tStarted
      const waitRemain = Math.max(0, MIN_VISIBLE_MS - elapsed)
      phaseTimers.push(
        window.setTimeout(
          () => {
            if (cancelled) return
            clearInterval(msgId)
            const rAtual = proRiscoRef.current
            if (ok && rAtual) {
              setUltimosFiltrosAnalise(
                buildFiltrosSnapshot(proSubstRef.current, rAtual, proUfsRef.current, []),
              )
            }
            if (reducedMotion) {
              setLoadOverlayOut(false)
              setLoadingOverlayVisible(false)
              setViewState('resultados')
              return
            }
            const fadeMs = MOTION_LOADING.fadeOutMs
            setLoadOverlayOut(true)
            phaseTimers.push(
              window.setTimeout(() => {
                if (cancelled) return
                setViewState('resultados')
              }, fadeMs / 2),
            )
            phaseTimers.push(
              window.setTimeout(() => {
                if (cancelled) return
                setLoadingOverlayVisible(false)
                setLoadOverlayOut(false)
              }, fadeMs),
            )
          },
          waitRemain,
        ),
      )
    })()

    return () => {
      cancelled = true
      clearInterval(msgId)
      for (const t of phaseTimers) clearTimeout(t)
    }
  }, [loadingOverlayVisible, proRisco, reducedMotion, loadingMsgs.length])

  /** Filtros atuais (subst., UF, perfil) sem filtro de fase — só para contagens por fase ao abrir o sheet. */
  const filtrosBaseContagemPorFase = useMemo(() => buildFiltrosListagem(proSubst, []), [buildFiltrosListagem, proSubst])

  const cardStaggerCount = resultados.length > 0 ? resultados.length : 1
  const cardVis = useStaggeredEntrance(cardStaggerCount, {
    baseDelayMs: reducedMotion ? 0 : 100,
    staggerMs: reducedMotion ? 0 : MOTION_STAGGER.comfortable,
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
    setBarsReady(false)
    /* Alinha com baseDelayMs do stagger; delays por cartão ficam em ProspeccaoResultados (barFillStyle). */
    const id = window.setTimeout(() => setBarsReady(true), 100)
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
    setProSubst([])
    setProRisco(null)
    setProUfs([])
    setProFases([])
    setResultados([])
    setTotalOportunidades(null)
    setPaginaAtual(1)
    setCarregandoPagina(false)
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
    if (!proRisco) return
    const snap = buildFiltrosSnapshot(proSubst, proRisco, proUfs, proFases)
    if (
      ultimosFiltrosAnalise &&
      filtrosIguais(ultimosFiltrosAnalise, snap) &&
      resultados.length > 0
    ) {
      setViewState('resultados')
      return
    }
    setLoadingOverlayVisible(true)
  }, [proRisco, proSubst, proUfs, proFases, ultimosFiltrosAnalise, resultados.length])

  const handleRefinarBusca = useCallback(() => {
    setWizardEntryStep(2)
    if (reducedMotion) {
      setViewState('wizard')
      return
    }
    setViewState('transitioning-resultados-to-wizard')
    window.setTimeout(() => setViewState('wizard'), 300)
  }, [reducedMotion])

  const handleRefinarBuscaDesdeVazio = useCallback(() => {
    setWizardEntryStep(1)
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
      className="terrae-intel-dashboard-scroll scrollbar-thin-auto box-border flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
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
          {/* Altura fixa (viewport): não estica com o bloco de alertas; evita “salto” do arco/SVG */}
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
                pointerEvents: viewState === 'transitioning-to-wizard' ? 'none' : 'auto',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)'
                e.currentTarget.style.transition =
                  `${motionTransition('transform', MOTION_DURATION.instant, MOTION_EASING.standard)}, filter 0.15s ease-out, box-shadow 0.15s ease-out`
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)'
                e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'scale(1)'
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
              proRisco={proRisco}
              setProRisco={setProRisco}
              proUfs={proUfs}
              setProUfs={setProUfs}
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
                  transition:
                    reducedMotion
                      ? undefined
                      : motionTransition('opacity', MOTION_LOADING.fadeOutMs, MOTION_EASING.accelerate),
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
                    animation: reducedMotion
                      ? undefined
                      : `terraeRadarFadeMsg 200ms ${MOTION_EASING.decelerate}`,
                  }}
                >
                  {loadingMsgs[
                    loadingMsgs.length > 0 ? loadMsgIdx % loadingMsgs.length : 0
                  ] ?? 'Carregando oportunidades…'}
                </p>
                <div
                  aria-hidden
                  style={{
                    marginTop: 20,
                    width: 240,
                    height: 3,
                    backgroundColor: '#2C2C2A',
                    borderRadius: 2,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {reducedMotion ? (
                    <div
                      style={{
                        height: '100%',
                        width: '100%',
                        backgroundColor: '#EF9F27',
                      }}
                    />
                  ) : (
                    <div className="terraeRadarIndeterminateBar" />
                  )}
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
                className="scrollbar-thin-auto"
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
                  totalOportunidades={totalOportunidades}
                  paginaAtual={paginaAtual}
                  carregandoPagina={carregandoPagina}
                  onIrParaPagina={irParaPagina}
                  pageSize={RADAR_OPORTUNIDADES_PAGE_SIZE}
                  resultadosListRef={resultadosListRef}
                  proRisco={proRisco}
                  proSubst={proSubst}
                  proUfs={proUfs}
                  proFases={proFases}
                  selectedResultId={selectedResultId}
                  setSelectedResultId={setSelectedResultId}
                  cardVis={cardVis}
                  barsReady={barsReady}
                  reducedMotion={reducedMotion}
                  navigateProcessoMapa={navigateProcessoMapa}
                  handleRefinarBusca={handleRefinarBusca}
                  handleRefinarBuscaDesdeVazio={handleRefinarBuscaDesdeVazio}
                  handleVoltarAoRadar={handleVoltarAoRadar}
                  showToast={showToast}
                  onAbrirRefinarSubst={() => setRefinarSubstAberto(true)}
                  onRemoverFiltroSubst={(substancia) => {
                    const novas = proSubst.filter((s) => s !== substancia)
                    void handleAplicarFiltroSubstancia(novas)
                  }}
                  onAbrirRefinarFase={() => {
                    refinarFaseMontagemKey.current += 1
                    setRefinarFaseAberto(true)
                  }}
                  onRemoverFiltroFase={(fase) => {
                    const novas = proFases.filter((f) => f !== fase)
                    void handleAplicarFiltroFase(novas)
                  }}
                />
                <RefinarSubstanciaSheet
                  catalog={catalogoSubstancias}
                  proSubst={proSubst}
                  open={refinarSubstAberto}
                  onApply={handleAplicarFiltroSubstancia}
                  onClose={() => setRefinarSubstAberto(false)}
                  reducedMotion={reducedMotion}
                />
                {filtrosBaseContagemPorFase ? (
                  <RefinarFaseSheet
                    key={`fase-${refinarFaseMontagemKey.current}`}
                    filtrosBase={filtrosBaseContagemPorFase}
                    proFases={proFases}
                    open={refinarFaseAberto}
                    onApply={handleAplicarFiltroFase}
                    onClose={() => setRefinarFaseAberto(false)}
                    onVoltarWizard={handleRefinarBusca}
                    reducedMotion={reducedMotion}
                  />
                ) : null}
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
