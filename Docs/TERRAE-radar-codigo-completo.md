# TERRAE — Exportação de código da aba Radar

Documento gerado automaticamente para análise antes de reestruturação. Contém cópias integrais dos ficheiros listados na árvore abaixo.

## Notas

- **Não existe store Zustand dedicado ao Radar.** A aba usa `useAppStore` (`setTelaAtiva`, `telaAtiva`) e `useMapStore` (`processos`, `pendingNavigation`, `selecionarProcesso`, `relatorioDrawerAberto`, etc.).
- **`MultiSelectDropdown` e `UFS_INTEL_DASHBOARD`** vêm de `InteligenciaDashboard.tsx`; como o ficheiro completo é muito grande, inclui-se um **excerto com linhas explícitas** (código idêntico ao repositório).
- **CSS:** inclui-se apenas o bloco `@media (prefers-reduced-motion: no-preference)` com classes/keyframes `terrae-radar-*` e relacionados (linhas 370–455 de `src/index.css`).

## Árvore de ficheiros relevantes (sob `src/`)

```
src/
  App.tsx
  index.css                    (trecho Radar: ~linhas 370–455)
  components/
    dashboard/
      RadarDashboard.tsx
      RadarAlertasSubtab.tsx
      InteligenciaDashboard.tsx (dependência: UFS_INTEL_DASHBOARD, MultiSelectDropdown — ver excerto neste doc)
    ui/
      BadgeSubstancia.tsx
      RegimeBadge.tsx
  data/
    radar-alertas.mock.ts
  hooks/
    useStaggeredEntrance.ts
  lib/
    corSubstancia.ts
    motionDurations.ts
    opportunityScore.ts
    relevanciaAlerta.ts
  store/
    useAppStore.ts
    useMapStore.ts
```

---


=== ARQUIVO: src/App.tsx ===
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CHROME_ENTER_MS_DEFAULT,
  CHROME_EXIT_MS_DEFAULT,
  MapChromeTransitionContext,
} from './context/MapChromeTransitionContext'
import { InteligenciaDashboard } from './components/dashboard/InteligenciaDashboard'
import { RadarDashboard } from './components/dashboard/RadarDashboard'
import { MapView } from './components/map/MapView'
import { Navbar } from './components/layout/Navbar'
import { useAppStore } from './store/useAppStore'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import {
  MOTION_OVERLAY_INNER_ENTER_DELAY_MS,
  MOTION_OVERLAY_INNER_ENTER_MS,
  MOTION_OVERLAY_INNER_EXIT_MS,
  MOTION_OVERLAY_UNMOUNT_MS,
  MOTION_TAB_CROSSFADE_IN_MS,
  MOTION_TAB_CROSSFADE_OUT_MS,
  motionMs,
  motionStaggerBaseMs,
} from './lib/motionDurations'

function readCssMs(varName: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function readChromeDurations(): { exit: number; enter: number } {
  return {
    exit: readCssMs('--terrae-chrome-exit-ms', CHROME_EXIT_MS_DEFAULT),
    enter: readCssMs('--terrae-chrome-enter-ms', CHROME_ENTER_MS_DEFAULT),
  }
}

function isExtraTela(t: string): t is 'inteligencia' | 'radar' {
  return t === 'inteligencia' || t === 'radar'
}

export default function App() {
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const mapChromeCollapsed =
    telaAtiva === 'inteligencia' || telaAtiva === 'radar'

  const reducedMotion = usePrefersReducedMotion()

  const [chromeExitMs, setChromeExitMs] = useState(CHROME_EXIT_MS_DEFAULT)
  const [chromeEnterMs, setChromeEnterMs] = useState(CHROME_ENTER_MS_DEFAULT)

  useEffect(() => {
    const apply = () => {
      const { exit, enter } = readChromeDurations()
      setChromeExitMs(exit)
      setChromeEnterMs(enter)
    }
    apply()
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const chromeTransitionMs = mapChromeCollapsed ? chromeExitMs : chromeEnterMs

  const [painelExtraMontado, setPainelExtraMontado] = useState(
    () => telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )
  const [painelExtraOpaco, setPainelExtraOpaco] = useState(
    () => telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )

  const [overlayFadeMode, setOverlayFadeMode] = useState<'in' | 'out'>('in')
  const [renderedExtraTela, setRenderedExtraTela] = useState<
    'inteligencia' | 'radar'
  >(() => (telaAtiva === 'radar' ? 'radar' : 'inteligencia'))
  const [extraTabOpacity, setExtraTabOpacity] = useState(1)
  const [tabContentTransition, setTabContentTransition] = useState(() =>
    reducedMotion
      ? 'opacity 1ms linear'
      : `opacity ${motionMs(MOTION_TAB_CROSSFADE_IN_MS, false)}ms ease-out`,
  )

  const prevTelaRef = useRef(telaAtiva)

  const enterDelayMs = motionMs(MOTION_OVERLAY_INNER_ENTER_DELAY_MS, reducedMotion)
  const enterDurMs = motionMs(MOTION_OVERLAY_INNER_ENTER_MS, reducedMotion)
  const exitDurMs = motionMs(MOTION_OVERLAY_INNER_EXIT_MS, reducedMotion)
  const unmountAfterExitMs = motionMs(MOTION_OVERLAY_UNMOUNT_MS, reducedMotion)
  const tabCrossOutMs = motionMs(MOTION_TAB_CROSSFADE_OUT_MS, reducedMotion)

  useEffect(() => {
    const prev = prevTelaRef.current
    prevTelaRef.current = telaAtiva

    if (isExtraTela(telaAtiva)) {
      if (!isExtraTela(prev)) {
        setRenderedExtraTela(telaAtiva)
        setExtraTabOpacity(1)
        setTabContentTransition(
          reducedMotion
            ? 'opacity 1ms linear'
            : `opacity ${motionMs(MOTION_TAB_CROSSFADE_IN_MS, reducedMotion)}ms ease-out`,
        )
        setOverlayFadeMode('in')
        setPainelExtraMontado(true)
        setPainelExtraOpaco(false)
        let cancelled = false
        const id = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) setPainelExtraOpaco(true)
          })
        })
        return () => {
          cancelled = true
          cancelAnimationFrame(id)
        }
      }
      if (isExtraTela(prev) && prev !== telaAtiva) {
        setTabContentTransition(
          reducedMotion
            ? 'opacity 1ms linear'
            : `opacity ${motionMs(MOTION_TAB_CROSSFADE_OUT_MS, reducedMotion)}ms ease-in`,
        )
        setExtraTabOpacity(0)
        const t = window.setTimeout(() => {
          setRenderedExtraTela(telaAtiva)
          setTabContentTransition(
            reducedMotion
              ? 'opacity 1ms linear'
              : `opacity ${motionMs(MOTION_TAB_CROSSFADE_IN_MS, reducedMotion)}ms ease-out`,
          )
          requestAnimationFrame(() => setExtraTabOpacity(1))
        }, tabCrossOutMs)
        return () => clearTimeout(t)
      }
      return
    }

    if (isExtraTela(prev)) {
      setOverlayFadeMode('out')
      setPainelExtraOpaco(false)
      const t = window.setTimeout(() => {
        setPainelExtraMontado(false)
      }, unmountAfterExitMs)
      return () => clearTimeout(t)
    }

    return undefined
  }, [telaAtiva, tabCrossOutMs, unmountAfterExitMs, reducedMotion])

  const chromeCtx = useMemo(
    () => ({
      mapChromeCollapsed,
      chromeExitMs,
      chromeEnterMs,
      chromeTransitionMs,
    }),
    [mapChromeCollapsed, chromeExitMs, chromeEnterMs, chromeTransitionMs],
  )

  const overlayContentTransition =
    overlayFadeMode === 'in'
      ? `opacity ${enterDurMs}ms ease-out ${enterDelayMs}ms`
      : `opacity ${exitDurMs}ms ease-in`

  const intelStaggerBase = motionStaggerBaseMs(reducedMotion)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-dark-primary">
      <Navbar />
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 48px)' }}
      >
        <MapChromeTransitionContext.Provider value={chromeCtx}>
          <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            <MapView />
          </div>
        </MapChromeTransitionContext.Provider>

        {painelExtraMontado ? (
          <div
            className="pointer-events-auto absolute inset-0 z-[100] box-border flex min-h-0 flex-col overflow-hidden"
            style={{ backgroundColor: '#0D0D0C' }}
          >
            <div
              className="box-border flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{
                opacity: painelExtraOpaco ? 1 : 0,
                transitionProperty: 'opacity',
                transition: overlayContentTransition,
              }}
            >
              <div
                className="box-border flex min-h-0 flex-1 flex-col overflow-hidden"
                style={{
                  opacity: extraTabOpacity,
                  transition: tabContentTransition,
                }}
              >
                {renderedExtraTela === 'inteligencia' ? (
                  <InteligenciaDashboard
                    motionStaggerBaseMs={intelStaggerBase}
                    reducedMotion={reducedMotion}
                  />
                ) : (
                  <RadarDashboard reducedMotion={reducedMotion} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

=== FIM: src/App.tsx ===

=== ARQUIVO: src/components/dashboard/RadarDashboard.tsx ===
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  AlertTriangle,
  BarChart3,
  Check,
  Info,
  MapPin,
  Radar as RadarIcon,
  Scale,
  Shield,
  TrendingUp,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import { MultiSelectDropdown, UFS_INTEL_DASHBOARD } from './InteligenciaDashboard'
import { RadarAlertasSubtab } from './RadarAlertasSubtab'
import { RegimeBadge } from '../ui/RegimeBadge'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import {
  MOTION_BAR_STAGGER_MS,
  MOTION_BAR_WIDTH_MS,
  MOTION_GROUP_FADE_MS,
  MOTION_GROUP_TRANSLATE_PX,
  motionMs,
} from '../../lib/motionDurations'
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance'
import {
  computeOpportunityForProcesso,
  corFaixaOpportunity,
  corMiniBarraValor,
  labelFaixaOpportunity,
  type ObjetivoProspeccao,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'

const TODAS_SUBST = '__TODAS__'

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

export function RadarDashboard({
  reducedMotion = false,
}: {
  reducedMotion?: boolean
} = {}) {
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)
  const processos = useMapStore((s) => s.processos)
  const selecionarProcesso = useMapStore((s) => s.selecionarProcesso)
  const setRelatorioDrawerAberto = useMapStore((s) => s.setRelatorioDrawerAberto)
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

  const [modo, setModo] = useState<'alertas' | 'prospeccao'>('alertas')

  const underlineTabMs = motionMs(150, reducedMotion)

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

  const abrirRelatorioProcesso = useCallback(
    (id: string) => {
      const p = processoById.get(id) ?? processos.find((x) => x.id === id)
      if (p) {
        selecionarProcesso(p)
        setRelatorioDrawerAberto(true)
      }
      setTelaAtiva('mapa')
    },
    [processoById, processos, selecionarProcesso, setRelatorioDrawerAberto, setTelaAtiva],
  )

  /* --- Prospecção --- */
  type ProStep = 'idle' | 'perfil' | 'loading' | 'resultados'
  const [proStep, setProStep] = useState<ProStep>('idle')
  const [proObjetivo, setProObjetivo] = useState<ObjetivoProspeccao | null>(null)
  const [proSubst, setProSubst] = useState<string[]>([])
  const [proRisco, setProRisco] = useState<PerfilRisco | null>(null)
  const [proUfs, setProUfs] = useState<string[]>([])
  const [proDdSub, setProDdSub] = useState(false)
  const [proDdUf, setProDdUf] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadMsgIdx, setLoadMsgIdx] = useState(0)
  const [loadOverlayOut, setLoadOverlayOut] = useState(false)
  const [resultados, setResultados] = useState<OpportunityResult[]>([])
  const [excluidosCount, setExcluidosCount] = useState(0)
  const [vistaResultado, setVistaResultado] = useState<'lista' | 'expandido'>('expandido')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loadingMsgs = [
    'Cruzando 30 processos com 7 camadas territoriais...',
    'Analisando alertas de 2.500 fontes regulatórias...',
    'Calculando viabilidade econômica e logística...',
    'Aplicando perfil de risco selecionado...',
    'Gerando ranking de oportunidades...',
  ]

  const prospeccaoValida =
    proObjetivo != null &&
    proRisco != null &&
    proSubst.length > 0 &&
    (proSubst.includes(TODAS_SUBST) || proSubst.some((x) => x !== TODAS_SUBST))

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
    const excl = scored.filter((r) => r.scoreTotal <= 24).length
    setExcluidosCount(excl)
    setResultados(scored.filter((r) => r.scoreTotal > 24))
    setProStep('resultados')
  }, [processos, proObjetivo, proRisco, substanciasFiltroProspeccao, proUfs])

  useEffect(() => {
    if (proStep !== 'loading') return
    setLoadProgress(0)
    setLoadMsgIdx(0)
    setLoadOverlayOut(false)
    const t0 = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Date.now() - t0
      const p = Math.min(100, (elapsed / 5000) * 100)
      setLoadProgress(p)
      if (elapsed >= 5000) {
        clearInterval(id)
        setLoadOverlayOut(true)
        window.setTimeout(() => {
          runAnalise()
        }, reducedMotion ? 0 : 200)
      }
    }, 50)
    const msgId = window.setInterval(() => {
      setLoadMsgIdx((i) => (i + 1) % loadingMsgs.length)
    }, 1200)
    return () => {
      clearInterval(id)
      clearInterval(msgId)
    }
  }, [proStep, runAnalise, reducedMotion, loadingMsgs.length])

  const cardStaggerCount = resultados.length > 0 ? resultados.length : 1
  const cardVis = useStaggeredEntrance(cardStaggerCount, {
    baseDelayMs: reducedMotion ? 0 : 0,
    staggerMs: reducedMotion ? 0 : 60,
    reducedMotion,
  })

  const barsReady = proStep === 'resultados' && !reducedMotion

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

  return (
    <div
      className="box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        backgroundColor: '#0D0D0C',
        padding: 24,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <header style={{ flexShrink: 0 }}>
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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginTop: 8,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 16,
              color: '#888780',
              flex: '1 1 220px',
              minWidth: 0,
            }}
          >
            Monitoramento regulatório e prospecção de oportunidades do setor mineral
          </p>
          <nav
            className="flex shrink-0 items-center"
            style={{ gap: 28 }}
            aria-label="Modo do Radar"
          >
        <button
          type="button"
          onClick={() => setModo('alertas')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 ${
            modo === 'alertas' ? 'text-[#F1EFE8]' : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
          style={{
            fontSize: 15,
            fontWeight: 400,
            transition: `color ${underlineTabMs}ms ease`,
          }}
        >
          Alertas
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{
              opacity: modo === 'alertas' ? 1 : 0,
              transition: `opacity ${underlineTabMs}ms ease`,
            }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => setModo('prospeccao')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 ${
            modo === 'prospeccao' ? 'text-[#F1EFE8]' : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
          style={{
            fontSize: 15,
            fontWeight: 400,
            transition: `color ${underlineTabMs}ms ease`,
          }}
        >
          Prospecção Terrae
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{
              opacity: modo === 'prospeccao' ? 1 : 0,
              transition: `opacity ${underlineTabMs}ms ease`,
            }}
            aria-hidden
          />
        </button>
          </nav>
        </div>
      </header>

      {modo === 'alertas' ? (
        <RadarAlertasSubtab reducedMotion={reducedMotion} onToast={showToast} />
      ) : (
        <div
          className="terrae-intel-dashboard-scroll min-h-0 flex-1 overflow-y-auto"
          style={{ marginTop: 24 }}
        >
          <ProspeccaoBlock
            reducedMotion={reducedMotion}
            proStep={proStep}
            setProStep={setProStep}
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
            proDdUf={proDdUf}
            setProDdUf={setProDdUf}
            prospeccaoSubstOpcoes={prospeccaoSubstOpcoes}
            proPrefixSub={proPrefixSub}
            prospeccaoValida={prospeccaoValida}
            loadProgress={loadProgress}
            loadMsgIdx={loadMsgIdx}
            loadOverlayOut={loadOverlayOut}
            loadingMsgs={loadingMsgs}
            resultados={resultados}
            excluidosCount={excluidosCount}
            vistaResultado={vistaResultado}
            setVistaResultado={setVistaResultado}
            processoById={processoById}
            navigateProcessoMapa={navigateProcessoMapa}
            abrirRelatorioProcesso={abrirRelatorioProcesso}
            cardVis={cardVis}
            barsReady={barsReady}
            showToast={showToast}
            resetProspeccao={() => {
              setProStep('idle')
              setProObjetivo(null)
              setProSubst([])
              setProRisco(null)
              setProUfs([])
              setResultados([])
              setExcluidosCount(0)
            }}
          />
        </div>
      )}

      <footer
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #2C2C2A',
          textAlign: 'center',
          fontSize: 11,
          color: '#5F5E5A',
          flexShrink: 0,
        }}
      >
        Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo · Atualizado em{' '}
        {new Date().toLocaleDateString('pt-BR')}
      </footer>

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

function ProspeccaoBlock({
  reducedMotion,
  proStep,
  setProStep,
  proObjetivo,
  setProObjetivo,
  proSubst,
  setProSubst,
  proRisco,
  setProRisco,
  proUfs,
  setProUfs,
  proDdSub,
  setProDdSub,
  proDdUf,
  setProDdUf,
  prospeccaoSubstOpcoes,
  proPrefixSub,
  prospeccaoValida,
  loadProgress,
  loadMsgIdx,
  loadOverlayOut,
  loadingMsgs,
  resultados,
  excluidosCount,
  vistaResultado,
  setVistaResultado,
  processoById,
  navigateProcessoMapa,
  abrirRelatorioProcesso,
  cardVis,
  barsReady,
  showToast,
  resetProspeccao,
}: {
  reducedMotion: boolean
  proStep: 'idle' | 'perfil' | 'loading' | 'resultados'
  setProStep: (s: 'idle' | 'perfil' | 'loading' | 'resultados') => void
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
  proDdUf: boolean
  setProDdUf: (v: boolean) => void
  prospeccaoSubstOpcoes: string[]
  proPrefixSub: string
  prospeccaoValida: boolean
  loadProgress: number
  loadMsgIdx: number
  loadOverlayOut: boolean
  loadingMsgs: string[]
  resultados: OpportunityResult[]
  excluidosCount: number
  vistaResultado: 'lista' | 'expandido'
  setVistaResultado: (v: 'lista' | 'expandido') => void
  processoById: Map<string, Processo>
  navigateProcessoMapa: (id: string) => void
  abrirRelatorioProcesso: (id: string) => void
  cardVis: boolean[]
  barsReady: boolean
  showToast: (m: string) => void
  resetProspeccao: () => void
}) {
  const onProSubstChange = (next: string[]) => {
    if (next.includes(TODAS_SUBST)) {
      if (!proSubst.includes(TODAS_SUBST)) {
        setProSubst([TODAS_SUBST])
        return
      }
      setProSubst(next.filter((x) => x !== TODAS_SUBST))
      return
    }
    setProSubst(next)
  }

  return (
    <div style={{ marginTop: 24, position: 'relative' }}>
      {proStep === 'idle' ? (
        <div
          style={{
            backgroundColor: '#1A1A18',
            border: '1px solid #2C2C2A',
            borderRadius: 12,
            padding: '80px 40px',
            maxWidth: 600,
            margin: '0 auto',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            className={reducedMotion ? undefined : 'terrae-radar-pulse-icon'}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <RadarIcon size={48} color="#EF9F27" aria-hidden />
          </div>
          <h2
            style={{
              margin: '24px 0 0 0',
              fontSize: 20,
              fontWeight: 500,
              color: '#F1EFE8',
            }}
          >
            Prospecção Terrae
          </h2>
          <p
            style={{
              margin: '12px auto 0',
              fontSize: 14,
              color: '#888780',
              maxWidth: 440,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            Cruzamos dados de 20+ fontes públicas para identificar as melhores oportunidades do setor
            mineral brasileiro.
          </p>
          <button
            type="button"
            onClick={() => setProStep('perfil')}
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
              transition: 'filter 0.15s ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none'
            }}
          >
            Iniciar Prospecção
          </button>
        </div>
      ) : null}

      {proStep === 'perfil' ? (
        <div
          style={{
            backgroundColor: '#1A1A18',
            border: '1px solid #2C2C2A',
            borderRadius: 12,
            padding: 32,
            maxWidth: 800,
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <section>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#D3D1C7' }}>Qual seu objetivo?</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
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
          </section>

          <section style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#D3D1C7' }}>
              Quais substâncias te interessam?
            </div>
            <div style={{ marginTop: 12 }}>
              <MultiSelectDropdown
                prefix={proPrefixSub}
                options={prospeccaoSubstOpcoes}
                selected={proSubst}
                onChange={onProSubstChange}
                aberto={proDdSub}
                setAberto={setProDdSub}
              />
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#D3D1C7' }}>
              Qual seu apetite de risco?
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
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
          </section>

          <section style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#D3D1C7' }}>
              Preferência geográfica (opcional)
            </div>
            <div style={{ marginTop: 12 }}>
              <MultiSelectDropdown
                prefix={proUfs.length === 0 ? 'Todo o Brasil' : `${proUfs.length} UFs`}
                options={[...UFS_INTEL_DASHBOARD]}
                selected={proUfs}
                onChange={setProUfs}
                aberto={proDdUf}
                setAberto={setProDdUf}
              />
            </div>
          </section>

          <button
            type="button"
            disabled={!prospeccaoValida}
            onClick={() => setProStep('loading')}
            style={{
              marginTop: 32,
              backgroundColor: '#EF9F27',
              color: '#0D0D0C',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
              padding: '12px 32px',
              border: 'none',
              cursor: prospeccaoValida ? 'pointer' : 'not-allowed',
              opacity: prospeccaoValida ? 1 : 0.4,
              transition: 'filter 0.15s ease-out',
            }}
            onMouseEnter={(e) => {
              if (!prospeccaoValida) return
              e.currentTarget.style.filter = 'brightness(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none'
            }}
          >
            Analisar oportunidades
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                setProStep('idle')
                setProObjetivo(null)
                setProSubst([])
                setProRisco(null)
                setProUfs([])
              }}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                fontSize: 13,
                color: '#888780',
                cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      ) : null}

      {(proStep === 'loading' || proStep === 'resultados') && (
        <div
          style={{
            position: 'relative',
            minHeight: proStep === 'loading' ? 320 : undefined,
            marginTop: proStep === 'resultados' ? 0 : 0,
          }}
        >
          {proStep === 'loading' ? (
            <div
              style={{
                backgroundColor: '#1A1A18',
                border: '1px solid #2C2C2A',
                borderRadius: 12,
                padding: 48,
                maxWidth: 800,
                margin: '0 auto',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 280,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#0D0D0C',
                  opacity: loadOverlayOut ? 0 : 0.95,
                  borderRadius: 12,
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  transition: reducedMotion ? undefined : 'opacity 200ms ease-out',
                  pointerEvents: loadOverlayOut ? 'none' : 'auto',
                }}
              >
                <div
                  className={reducedMotion ? undefined : 'terrae-radar-spin-slow'}
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <RadarIcon size={40} color="#EF9F27" aria-hidden />
                </div>
                <p
                  key={loadMsgIdx}
                  style={{
                    marginTop: 20,
                    fontSize: 14,
                    color: '#888780',
                    textAlign: 'center',
                    maxWidth: 360,
                    animation: reducedMotion ? undefined : 'terraeRadarFadeMsg 200ms ease-out',
                  }}
                >
                  {loadingMsgs[loadMsgIdx]}
                </p>
                <div
                  style={{
                    marginTop: 24,
                    width: 200,
                    height: 2,
                    backgroundColor: '#2C2C2A',
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${loadProgress}%`,
                      backgroundColor: '#EF9F27',
                      borderRadius: 1,
                      transition: reducedMotion ? undefined : 'width 50ms linear',
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {proStep === 'resultados' ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#F1EFE8' }}>
                {resultados.length} oportunidades identificadas para seu perfil
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 12,
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={resetProspeccao}
                  style={{
                    border: '1px solid #5F5E5A',
                    color: '#B4B2A9',
                    fontSize: 13,
                    borderRadius: 6,
                    padding: '8px 16px',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Nova Prospecção
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Disponível em breve')}
                  style={{
                    border: '1px solid #5F5E5A',
                    color: '#B4B2A9',
                    fontSize: 13,
                    borderRadius: 6,
                    padding: '8px 16px',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Exportar PDF
                </button>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className="terrae-intel-rank-toggle"
                    onClick={() => setVistaResultado('lista')}
                    style={{
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                      backgroundColor: vistaResultado === 'lista' ? '#2C2C2A' : '#0D0D0C',
                      color: vistaResultado === 'lista' ? '#F1EFE8' : '#888780',
                    }}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    className="terrae-intel-rank-toggle"
                    onClick={() => setVistaResultado('expandido')}
                    style={{
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                      backgroundColor: vistaResultado === 'expandido' ? '#2C2C2A' : '#0D0D0C',
                      color: vistaResultado === 'expandido' ? '#F1EFE8' : '#888780',
                    }}
                  >
                    Expandido
                  </button>
                </div>
              </div>

              {resultados.length === 0 ? (
                <p style={{ marginTop: 24, fontSize: 14, color: '#888780' }}>
                  Nenhuma oportunidade atende aos critérios mínimos de score para exibição.
                </p>
              ) : vistaResultado === 'expandido' ? (
                <div style={{ marginTop: 20 }}>
                  {resultados.map((r, i) => {
                    const p = processoById.get(r.processoId)
                    if (!p) return null
                    const cor = corFaixaOpportunity(r.faixa)
                    return (
                      <div
                        key={r.processoId}
                        style={{
                          ...motionGroupStyle(cardVis[i] ?? true, reducedMotion),
                          marginBottom: 12,
                        }}
                      >
                        <OportunidadeCardExpandido
                          pos={i + 1}
                          resultado={r}
                          processo={p}
                          corFaixa={cor}
                          barsReady={barsReady}
                          reducedMotion={reducedMotion}
                          onMapa={() => navigateProcessoMapa(p.id)}
                          onRelatorio={() => abrirRelatorioProcesso(p.id)}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <OportunidadeTableLista
                  resultados={resultados}
                  processoById={processoById}
                  cardVis={cardVis}
                  reducedMotion={reducedMotion}
                  navigateProcessoMapa={navigateProcessoMapa}
                />
              )}

              {excluidosCount > 0 ? (
                <p style={{ marginTop: 16, fontSize: 13, color: '#5F5E5A' }}>
                  {excluidosCount} processos foram excluídos por não atenderem aos critérios mínimos.
                </p>
              ) : null}

              <div
                style={{
                  marginTop: 24,
                  border: '1px solid #2C2C2A',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <Info size={16} color="#5F5E5A" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <p style={{ margin: 0, fontSize: 12, color: '#5F5E5A', lineHeight: 1.5 }}>
                  O Opportunity Score Terrae é uma análise quantitativa baseada em dados públicos e
                  estimativas de mercado. Não constitui recomendação de investimento. Consulte
                  especialistas do setor mineral e jurídico antes de tomar decisões.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ObjetivoCard({
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
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 160,
        textAlign: 'left',
        backgroundColor: selected ? 'rgba(239,159,39,0.08)' : '#0D0D0C',
        border: `1px solid ${selected ? '#EF9F27' : '#2C2C2A'}`,
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease-out, background-color 0.15s ease-out',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#888780'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#2C2C2A'
      }}
    >
      <div style={{ color: selected ? '#EF9F27' : '#888780' }}>{icon}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: selected ? '#F1EFE8' : '#888780',
        }}
      >
        {label}
      </div>
    </button>
  )
}

function RiscoCard({
  selected,
  onClick,
  icon,
  iconSelectedColor,
  label,
  desc,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  iconSelectedColor: string
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 160,
        textAlign: 'left',
        backgroundColor: selected ? 'rgba(239,159,39,0.08)' : '#0D0D0C',
        border: `1px solid ${selected ? '#EF9F27' : '#2C2C2A'}`,
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease-out, background-color 0.15s ease-out',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#888780'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#2C2C2A'
      }}
    >
      <div style={{ color: selected ? iconSelectedColor : '#888780' }}>{icon}</div>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: '#D3D1C7' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: selected ? '#F1EFE8' : '#888780' }}>{desc}</div>
    </button>
  )
}

function OportunidadeCardExpandido({
  pos,
  resultado: r,
  processo: p,
  corFaixa,
  barsReady,
  reducedMotion,
  onMapa,
  onRelatorio,
}: {
  pos: number
  resultado: OpportunityResult
  processo: Processo
  corFaixa: string
  barsReady: boolean
  reducedMotion: boolean
  onMapa: () => void
  onRelatorio: () => void
}) {
  const bars: { label: string; v: number }[] = [
    { label: 'Atratividade', v: r.scoreAtratividade },
    { label: 'Viabilidade', v: r.scoreViabilidade },
    { label: 'Segurança', v: r.scoreSeguranca },
  ]

  return (
    <div
      style={{
        backgroundColor: '#1A1A18',
        border: '1px solid #2C2C2A',
        borderRadius: 8,
        padding: 20,
        borderLeft: `3px solid ${corFaixa}`,
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#888780'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#2C2C2A'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#5F5E5A' }}>#{pos}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: corFaixa,
              backgroundColor: `${corFaixa}26`,
              border: `1px solid ${corFaixa}`,
              borderRadius: 6,
              padding: '4px 12px',
            }}
          >
            {r.scoreTotal}
          </span>
          <span
            style={{
              fontSize: 10,
              letterSpacing: 1,
              color: corFaixa,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {labelFaixaOpportunity(r.faixa)}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#F1EFE8' }}>{p.numero}</span>
        <RegimeBadge regime={p.regime} variant="table" />
        <BadgeSubstancia substancia={p.substancia} variant="intelTable" />
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#888780' }}>
        {p.municipio}, {p.uf}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: '#D3D1C7' }}>{p.titular}</div>

      <div style={{ marginTop: 16 }}>
        {bars.map((b, bi) => {
          const c = corMiniBarraValor(b.v)
          return (
            <div
              key={b.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: bi > 0 ? 8 : 0,
              }}
            >
              <span style={{ fontSize: 12, color: '#888780', width: 100, flexShrink: 0 }}>
                {b.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor: '#2C2C2A',
                  borderRadius: 2,
                  overflow: 'hidden',
                  minWidth: 40,
                }}
              >
                <div
                  style={barFillStyle(b.v, barsReady, bi, reducedMotion, c)}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: c,
                  marginLeft: 8,
                  width: 28,
                  flexShrink: 0,
                }}
              >
                {b.v}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        {r.fatoresPositivos.map((t, i) => (
          <div
            key={`p-${i}`}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: i > 0 ? 8 : 0 }}
          >
            <Check size={14} color="#1D9E75" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            <span style={{ fontSize: 13, color: '#D3D1C7' }}>{t}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {r.fatoresAtencao.map((t, i) => {
          const grave = t.toLowerCase().includes('bloqueio') || t.includes('CAPAG C')
          return (
            <div
              key={`a-${i}`}
              style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: i > 0 ? 8 : 0 }}
            >
              <AlertTriangle
                size={14}
                color={grave ? '#E24B4A' : '#E8A830'}
                style={{ flexShrink: 0, marginTop: 2 }}
                aria-hidden
              />
              <span style={{ fontSize: 13, color: '#D3D1C7' }}>{t}</span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button
          type="button"
          onClick={onMapa}
          style={{
            border: '1px solid #5F5E5A',
            color: '#B4B2A9',
            fontSize: 13,
            borderRadius: 6,
            padding: '8px 16px',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Ver no Mapa
        </button>
        <button
          type="button"
          onClick={onRelatorio}
          style={{
            backgroundColor: '#EF9F27',
            color: '#0D0D0C',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            padding: '8px 16px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Ver Relatório Completo
        </button>
      </div>
    </div>
  )
}

function OportunidadeTableLista({
  resultados,
  processoById,
  cardVis,
  reducedMotion,
  navigateProcessoMapa,
}: {
  resultados: OpportunityResult[]
  processoById: Map<string, Processo>
  cardVis: boolean[]
  reducedMotion: boolean
  navigateProcessoMapa: (id: string) => void
}) {
  return (
    <div style={{ marginTop: 20, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ backgroundColor: '#0D0D0C' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              #
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              Score
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              Processo
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              Substância
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              UF
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              Titular
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '12px 10px',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888780',
                fontWeight: 500,
              }}
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r, idx) => {
            const p = processoById.get(r.processoId)
            if (!p) return null
            const cor = corFaixaOpportunity(r.faixa)
            return (
              <tr
                key={r.processoId}
                style={{
                  ...motionGroupStyle(cardVis[idx] ?? true, reducedMotion),
                  backgroundColor: idx % 2 === 0 ? '#1A1A18' : '#111110',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2C2C2A'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#1A1A18' : '#111110'
                }}
              >
                <td style={{ padding: '12px 10px', color: '#5F5E5A', fontWeight: 600 }}>{idx + 1}</td>
                <td style={{ padding: '12px 10px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      backgroundColor: `${cor}26`,
                      color: cor,
                    }}
                  >
                    {r.scoreTotal}
                  </span>
                </td>
                <td style={{ padding: '12px 10px', color: '#F1EFE8' }}>{p.numero}</td>
                <td style={{ padding: '12px 10px' }}>
                  <BadgeSubstancia substancia={p.substancia} variant="intelTable" />
                </td>
                <td style={{ padding: '12px 10px', color: '#D3D1C7' }}>{p.uf}</td>
                <td
                  style={{
                    padding: '12px 10px',
                    color: '#D3D1C7',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p.titular}
                >
                  {p.titular}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => navigateProcessoMapa(p.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#EF9F27',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Ver →
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

=== FIM: src/components/dashboard/RadarDashboard.tsx ===

=== ARQUIVO: src/components/dashboard/RadarAlertasSubtab.tsx ===
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  X,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import {
  RADAR_ALERTAS_MOCK,
  type RadarAlerta,
} from '../../data/radar-alertas.mock'
import { MultiSelectDropdown } from './InteligenciaDashboard'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import {
  calcularRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
  type TipoImpacto,
} from '../../lib/relevanciaAlerta'
import { motionMs } from '../../lib/motionDurations'

const RELEV_ORDER: Relevancia[] = [
  'critico',
  'desfavoravel',
  'neutro',
  'positivo',
  'favoravel',
]

const TODAS_SUBST = '__TODAS__'

type PeriodoKey = 'hoje' | '7d' | '30d' | '90d' | 'personalizar'

const PERIODO_OPCOES: { id: PeriodoKey; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'personalizar', label: 'Personalizar' },
]

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ymdToday(): string {
  return ymdFromDate(new Date())
}

function parseAlertaDateTimeMs(a: RadarAlerta): number {
  const t = `${a.data}T${a.hora}:00`
  const ms = new Date(t).getTime()
  return Number.isFinite(ms) ? ms : new Date(`${a.data}T12:00:00`).getTime()
}

function alertaPassaPeriodo(
  a: RadarAlerta,
  periodo: PeriodoKey,
  customDe: string,
  customAte: string,
): boolean {
  const ms = parseAlertaDateTimeMs(a)
  const day = a.data.slice(0, 10)
  if (periodo === 'hoje') return day === ymdToday()
  if (periodo === '7d')
    return ms >= Date.now() - 7 * 86400000
  if (periodo === '30d')
    return ms >= Date.now() - 30 * 86400000
  if (periodo === '90d')
    return ms >= Date.now() - 90 * 86400000
  if (periodo === 'personalizar') {
    if (!customDe || !customAte) return true
    const t0 = new Date(`${customDe}T00:00:00`).getTime()
    const t1 = new Date(`${customAte}T23:59:59`).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return true
    return ms >= t0 && ms <= t1
  }
  return true
}

const MESES_PT_CURTO = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

/** Painel detalhe e feed: "23 mar 2026 às 09:15" */
function formatDataHoraPublicacaoPainel(iso: string, hora: string): string {
  const [ys, ms, ds] = iso.split('-')
  const y = Number(ys)
  const mo = Number(ms)
  const d = Number(ds)
  if (!y || !mo || !d || mo < 1 || mo > 12) return `${iso} às ${hora}`
  return `${d} ${MESES_PT_CURTO[mo - 1]} ${y} às ${hora}`
}

/** Cores da bolinha de relevância no feed (esp. explícitas). */
const COR_BOLINHA_RELEV: Record<Relevancia, string> = {
  critico: '#E24B4A',
  desfavoravel: '#E8A830',
  neutro: '#888780',
  positivo: '#5CBFA0',
  favoravel: '#1D9E75',
}

/** Título de cartão — igual a "Distribuição por regime" (InteligenciaDashboard ~3247). */
const INTEL_DIST_REGIME_SECTION_TITLE: CSSProperties = {
  margin: 0,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  color: '#FFFFFF',
}

/** KpiCard: label "Valor potencial estimado" (labelFontSize 14, labelColor #FFFFFF). */
const INTEL_KP_LABEL_FS = 14
const INTEL_KP_LABEL_COLOR = '#FFFFFF'

/** KpiCard: sub "Reservas mapeadas (USGS)" (subFontSize 15, color #888780). */
const INTEL_KP_SUB_FS = 15
const INTEL_KP_SUB_COLOR = '#888780'

function labelRelevResumoPalavra(k: Relevancia, n: number): string {
  const one: Record<Relevancia, string> = {
    critico: 'Crítico',
    desfavoravel: 'Desfavorável',
    neutro: 'Neutro',
    positivo: 'Positivo',
    favoravel: 'Favorável',
  }
  const many: Record<Relevancia, string> = {
    critico: 'Críticos',
    desfavoravel: 'Desfavoráveis',
    neutro: 'Neutros',
    positivo: 'Positivos',
    favoravel: 'Favoráveis',
  }
  return n === 1 ? one[k] : many[k]
}

/**
 * Filtros da sub-aba Alertas: mesma paleta/cantos que UF/Subst. na Inteligência,
 * com padding vertical menor para alinhar à linha (sem alterar o componente na aba Intel).
 */
const RADAR_ALERTAS_FILTER_TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#0D0D0C',
  border: '1px solid #2C2C2A',
  borderRadius: 6,
  padding: '7px 12px',
  fontSize: 14,
  color: '#D3D1C7',
  cursor: 'pointer',
  outline: 'none',
}

function isNovo7d(iso: string): boolean {
  const t = new Date(`${iso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return false
  if (t > Date.now()) return false
  return Date.now() - t <= 7 * 86400000
}

function tipoParaCalculo(t: RadarAlerta['tipo_impacto']): TipoImpacto {
  return t as TipoImpacto
}

function corRiscoProcesso(score: number | null): string {
  if (score == null) return '#888780'
  if (score < 40) return '#1D9E75'
  if (score < 70) return '#EF9F27'
  return '#E24B4A'
}

function analiseTexto(a: RadarAlerta): string {
  return (a.analise ?? a.ementa).trim()
}

const LABEL_SECTION: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#5F5E5A',
  fontWeight: 600,
}

function PeriodoSingleDropdown({
  value,
  onChange,
  aberto,
  setAberto,
  reducedMotion,
  triggerStyle = RADAR_ALERTAS_FILTER_TRIGGER_STYLE,
}: {
  value: PeriodoKey
  onChange: (p: PeriodoKey) => void
  aberto: boolean
  setAberto: (v: boolean) => void
  reducedMotion: boolean
  triggerStyle?: CSSProperties
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{
    top: number
    left: number
    width: number
    maxH: number
  } | null>(null)
  const label = PERIODO_OPCOES.find((o) => o.id === value)?.label ?? 'Hoje'
  const tMs = motionMs(150, reducedMotion)

  useLayoutEffect(() => {
    if (!aberto) {
      setRect(null)
      return
    }
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const gap = 4
      const maxH = Math.min(280, vh - r.bottom - gap - 16)
      setRect({
        top: r.bottom + gap,
        left: Math.min(r.left, vw - 220),
        width: Math.max(r.width, 200),
        maxH: Math.max(80, maxH),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto, setAberto])

  const portal =
    aberto && rect ? (
      <div
        ref={panelRef}
        role="listbox"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxH,
          boxSizing: 'border-box',
          backgroundColor: '#1A1A18',
          border: '1px solid #2C2C2A',
          borderRadius: 8,
          padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 2147483647,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="terrae-dropdown-scroll min-h-0 flex-1 overflow-y-auto">
          {PERIODO_OPCOES.map((opt) => {
            const on = value === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(opt.id)
                  setAberto(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: on ? '#2C2C2A' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 4,
                  transition: `background-color ${tMs}ms ease`,
                }}
              >
                <span style={{ fontSize: 13, color: '#D3D1C7' }}>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="terrae-intel-border-interactive"
        onClick={() => setAberto(!aberto)}
        style={triggerStyle}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {label}
        </span>
        <ChevronDown
          size={12}
          color="#D3D1C7"
          style={{
            flexShrink: 0,
            transform: aberto ? 'rotate(180deg)' : 'none',
            transition: `transform ${tMs}ms ease`,
          }}
          aria-hidden
        />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}

export function RadarAlertasSubtab({
  reducedMotion,
  onToast,
}: {
  reducedMotion: boolean
  onToast?: (msg: string) => void
}) {
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

  const [periodo, setPeriodo] = useState<PeriodoKey>('hoje')
  const [customDe, setCustomDe] = useState(ymdToday())
  const [customAte, setCustomAte] = useState(ymdToday())
  const [substSel, setSubstSel] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [buscaFocada, setBuscaFocada] = useState(false)
  const [ddPeriodo, setDdPeriodo] = useState(false)
  const [ddSub, setDdSub] = useState(false)
  const [alertaSelecionadoId, setAlertaSelecionadoId] = useState<string | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [wide, setWide] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1200px)').matches : true,
  )

  const feedScrollRef = useRef<HTMLDivElement>(null)

  const syncRadarFeedBleedWidth = useCallback(() => {
    const el = feedScrollRef.current
    if (!el) return
    // Largura total do cartão (inclui faixa da scrollbar); usada para linhas full-bleed
    el.style.setProperty('--radar-feed-bleed-w', `${el.offsetWidth}px`)
    const sbw = Math.max(0, el.offsetWidth - el.clientWidth)
    el.style.setProperty('--radar-feed-scrollbar-w', `${sbw}px`)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1200px)')
    const fn = () => {
      setWide(mq.matches)
      if (mq.matches) setDrawerAberto(false)
    }
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const onSubstChange = useCallback((next: string[]) => {
    setSubstSel((prev) => {
      if (next.includes(TODAS_SUBST)) {
        if (!prev.includes(TODAS_SUBST)) return [TODAS_SUBST]
        return next.filter((x) => x !== TODAS_SUBST)
      }
      return next
    })
  }, [])

  const substOpcoes = useMemo(() => [TODAS_SUBST, ...substanciasCatalogo], [substanciasCatalogo])
  const prefixSub =
    substSel.length === 0 || substSel.includes(TODAS_SUBST)
      ? 'Todas'
      : substSel.length === 1
        ? substSel[0]!
        : `${substSel.length} substâncias`

  const alertasFiltrados = useMemo(() => {
    return RADAR_ALERTAS_MOCK.filter((a) => {
      if (!alertaPassaPeriodo(a, periodo, customDe, customAte)) return false
      const subFiltro = substSel.filter((x) => x !== TODAS_SUBST)
      if (subFiltro.length > 0) {
        const ok = a.substancias_afetadas.some((s) => subFiltro.includes(s))
        if (!ok) return false
      }
      const q = busca.trim().toLowerCase()
      if (q) {
        const blob = `${a.titulo} ${analiseTexto(a)} ${a.ementa}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [periodo, customDe, customAte, substSel, busca])

  const alertasOrdenados = useMemo(() => {
    return [...alertasFiltrados].sort(
      (a, b) => parseAlertaDateTimeMs(b) - parseAlertaDateTimeMs(a),
    )
  }, [alertasFiltrados])

  useLayoutEffect(() => {
    const el = feedScrollRef.current
    if (!el) return
    syncRadarFeedBleedWidth()
    const ro = new ResizeObserver(() => syncRadarFeedBleedWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncRadarFeedBleedWidth, alertasOrdenados.length, wide])

  useEffect(() => {
    if (
      alertaSelecionadoId &&
      !alertasFiltrados.some((a) => a.id === alertaSelecionadoId)
    ) {
      setAlertaSelecionadoId(null)
      setDrawerAberto(false)
    }
  }, [alertasFiltrados, alertaSelecionadoId])

  const hojeYmd = ymdToday()

  const alertasHojeResumo = useMemo(
    () => RADAR_ALERTAS_MOCK.filter((a) => a.data.slice(0, 10) === hojeYmd),
    [hojeYmd],
  )

  const resumoDiaStats = useMemo(() => {
    const rel = new Map<Relevancia, number>()
    for (const k of RELEV_ORDER) rel.set(k, 0)
    for (const a of alertasHojeResumo) {
      const r = calcularRelevancia(a.nivel_impacto, tipoParaCalculo(a.tipo_impacto))
      rel.set(r, (rel.get(r) ?? 0) + 1)
    }
    const subCount = new Map<string, number>()
    for (const a of alertasHojeResumo) {
      for (const s of a.substancias_afetadas) {
        subCount.set(s, (subCount.get(s) ?? 0) + 1)
      }
    }
    const topSub = [...subCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    return { rel, topSub, n: alertasHojeResumo.length }
  }, [alertasHojeResumo])

  const alertaSelecionado = useMemo(
    () =>
      alertaSelecionadoId
        ? alertasFiltrados.find((a) => a.id === alertaSelecionadoId) ?? null
        : null,
    [alertaSelecionadoId, alertasFiltrados],
  )

  const navigateProcessoMapa = useCallback(
    (id: string) => {
      setPendingNavigation({
        type: 'processo',
        payload: id,
        timestamp: Date.now(),
      })
      setTelaAtiva('mapa')
      setDrawerAberto(false)
    },
    [setPendingNavigation, setTelaAtiva],
  )

  const onSelectAlerta = (id: string) => {
    if (alertaSelecionadoId === id) {
      setAlertaSelecionadoId(null)
      if (!wide) setDrawerAberto(false)
    } else {
      setAlertaSelecionadoId(id)
      if (!wide) setDrawerAberto(true)
    }
  }

  /** Seleciona o alerta e abre o detalhe (sem alternar desseleção). */
  const selecionarAlertaParaDetalhe = useCallback(
    (id: string) => {
      setAlertaSelecionadoId(id)
      if (!wide) setDrawerAberto(true)
    },
    [wide],
  )

  const showToast = (msg: string) => {
    onToast?.(msg)
  }

  const detalheConteudo = (mobile: boolean) => {
    if (!alertaSelecionado) {
      if (resumoDiaStats.n === 0) {
        return (
          <div
            style={{
              flex: mobile ? undefined : 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
              minHeight: mobile ? 280 : 0,
              width: '100%',
            }}
          >
            <FileText size={36} color="#5F5E5A" aria-hidden />
            <div
              style={{
                marginTop: 12,
                fontSize: INTEL_KP_SUB_FS,
                fontWeight: 500,
                color: INTEL_KP_SUB_COLOR,
                textAlign: 'center',
              }}
            >
              Sem atividade hoje
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: INTEL_KP_SUB_FS,
                color: INTEL_KP_SUB_COLOR,
                textAlign: 'center',
                maxWidth: 220,
                lineHeight: 1.4,
              }}
            >
              Alertas aparecerão aqui conforme forem publicados
            </div>
          </div>
        )
      }

      return (
        <div
          style={{
            padding: 20,
            boxSizing: 'border-box',
            minHeight: mobile ? undefined : '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p style={INTEL_DIST_REGIME_SECTION_TITLE}>Resumo do dia</p>
          <div
            style={{
              marginTop: 16,
              fontSize: INTEL_KP_LABEL_FS,
              fontWeight: 600,
              color: '#B4B2A9',
              lineHeight: 1.35,
            }}
          >
            {resumoDiaStats.n} alertas publicados hoje
          </div>
          {resumoDiaStats.n > 0 ? (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 2,
                width: '100%',
                height: 6,
                minHeight: 0,
                borderRadius: 3,
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
              aria-hidden
            >
              {RELEV_ORDER.map((k) => {
                const n = resumoDiaStats.rel.get(k) ?? 0
                if (n === 0) return null
                return (
                  <div
                    key={k}
                    style={{
                      flexGrow: n,
                      flexShrink: 1,
                      flexBasis: 0,
                      minWidth: 0,
                      height: 6,
                      backgroundColor: COR_BOLINHA_RELEV[k],
                      borderRadius: 3,
                    }}
                  />
                )
              })}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 8,
              fontSize: INTEL_KP_SUB_FS,
              lineHeight: 1.4,
              color: '#888780',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0 4px',
            }}
          >
            {(() => {
              const chunks: ReactNode[] = []
              let first = true
              for (const k of RELEV_ORDER) {
                const n = resumoDiaStats.rel.get(k) ?? 0
                if (n === 0) continue
                if (!first) {
                  chunks.push(
                    <span key={`sep-${k}`} style={{ color: '#888780' }}>
                      {' '}
                      ·{' '}
                    </span>,
                  )
                }
                first = false
                chunks.push(
                  <span key={k}>
                    <span style={{ color: RELEVANCIA_MAP[k].cor }} aria-hidden>
                      ●
                    </span>
                    <span style={{ color: '#888780' }}>
                      {` ${n} ${labelRelevResumoPalavra(k, n)}`}
                    </span>
                  </span>,
                )
              }
              return chunks
            })()}
          </div>
          <div
            style={{
              marginTop: 16,
              marginLeft: -20,
              marginRight: -20,
              height: 1,
              backgroundColor: '#2C2C2A',
              flexShrink: 0,
            }}
            aria-hidden
          />
          {resumoDiaStats.topSub.length > 0 ? (
            <>
              <div
                style={{
                  marginTop: 16,
                  fontSize: INTEL_KP_SUB_FS,
                  fontWeight: 500,
                  color: '#B4B2A9',
                }}
              >
                Substâncias citadas:
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {resumoDiaStats.topSub.map(([s]) => (
                  <BadgeSubstancia key={s} substancia={s} variant="intelTable" />
                ))}
              </div>
            </>
          ) : null}
        </div>
      )
    }

    const a = alertaSelecionado
    const rel = calcularRelevancia(a.nivel_impacto, tipoParaCalculo(a.tipo_impacto))
    const cfg = RELEVANCIA_MAP[rel]
    const bgRel = `${cfg.cor}1F`

    return (
      <div style={{ padding: 20, boxSizing: 'border-box' }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: cfg.cor,
            backgroundColor: bgRel,
            padding: '3px 10px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          {cfg.label}
        </div>
        <h2
          style={{
            margin: '12px 0 0 0',
            fontSize: 15,
            fontWeight: 500,
            color: '#F1EFE8',
            lineHeight: 1.4,
          }}
        >
          {a.titulo}
        </h2>
        <div style={{ marginTop: 20 }}>
          <div style={LABEL_SECTION}>Análise Terrae</div>
          <div
            style={{
              marginTop: 8,
              fontSize: INTEL_KP_SUB_FS,
              color: INTEL_KP_SUB_COLOR,
              lineHeight: 1.4,
              backgroundColor: '#0D0D0C',
              padding: '12px 16px',
              borderRadius: 6,
              border: '1px solid #2C2C2A',
            }}
          >
            {analiseTexto(a)}
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={LABEL_SECTION}>Processos afetados</div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.processos_afetados_ids.map((id) => {
              const p = processoById.get(id)
              const label = p?.numero ?? id
              const corR = corRiscoProcesso(p?.risk_score ?? null)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigateProcessoMapa(id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#2C2C2A',
                    border: '1px solid #3D3D3A',
                    color: '#D3D1C7',
                    fontSize: 12,
                    borderRadius: 4,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#EF9F27'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#3D3D3A'
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: corR,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={LABEL_SECTION}>Substâncias afetadas</div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.substancias_afetadas.map((s) => (
              <BadgeSubstancia key={s} substancia={s} variant="radarCompact" />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={LABEL_SECTION}>Publicação</div>
          <div
            style={{
              marginTop: 8,
              fontSize: INTEL_KP_LABEL_FS,
              color: '#D3D1C7',
            }}
          >
            {a.fonte_nome_completo}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: INTEL_KP_SUB_FS,
              color: INTEL_KP_SUB_COLOR,
            }}
          >
            {formatDataHoraPublicacaoPainel(a.data, a.hora)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            showToast('Disponível em produção')
          }}
          style={{
            marginTop: 20,
            width: '100%',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: 'transparent',
            border: '1px solid #5F5E5A',
            color: '#B4B2A9',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            padding: '10px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#EF9F27'
            e.currentTarget.style.color = '#F1EFE8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#5F5E5A'
            e.currentTarget.style.color = '#B4B2A9'
          }}
        >
          Ver no Diário
          <ArrowUpRight size={14} aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", minHeight: 0 }}
    >
      <div
        className="flex min-h-0 flex-1"
        style={{
          marginTop: 20,
          gap: 16,
          minHeight: 400,
        }}
      >
        <div
          ref={feedScrollRef}
          className="terrae-intel-dashboard-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
          style={{
            flex: wide ? '7 1 0%' : '1 1 auto',
            minWidth: wide ? 500 : 0,
            minHeight: 0,
            backgroundColor: '#1A1A18',
            border: '1px solid #2C2C2A',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              flexShrink: 0,
              backgroundColor: '#1A1A18',
              padding: '16px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0,
                minWidth: 0,
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              <span style={{ fontWeight: 600, color: '#D3D1C7' }}>
                {alertasFiltrados.length}{' '}
                {alertasFiltrados.length === 1 ? 'alerta' : 'alertas'}
              </span>
              <span style={{ color: '#5F5E5A', userSelect: 'none' }}> · </span>
              <span style={{ fontWeight: 400, color: '#888780' }}>
                Atualizado há 3 min
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <PeriodoSingleDropdown
                value={periodo}
                onChange={setPeriodo}
                aberto={ddPeriodo}
                setAberto={setDdPeriodo}
                reducedMotion={reducedMotion}
              />
              {periodo === 'personalizar' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={customDe}
                    onChange={(e) => setCustomDe(e.target.value)}
                    style={{
                      backgroundColor: '#0D0D0C',
                      border: '1px solid #2C2C2A',
                      borderRadius: 6,
                      color: '#D3D1C7',
                      padding: '8px 10px',
                      fontSize: 13,
                    }}
                  />
                  <span style={{ color: '#5F5E5A', fontSize: 12 }}>até</span>
                  <input
                    type="date"
                    value={customAte}
                    onChange={(e) => setCustomAte(e.target.value)}
                    style={{
                      backgroundColor: '#0D0D0C',
                      border: '1px solid #2C2C2A',
                      borderRadius: 6,
                      color: '#D3D1C7',
                      padding: '8px 10px',
                      fontSize: 13,
                    }}
                  />
                </div>
              ) : null}
              <MultiSelectDropdown
                prefix={prefixSub}
                options={substOpcoes}
                selected={substSel}
                onChange={onSubstChange}
                aberto={ddSub}
                setAberto={setDdSub}
                triggerStyle={RADAR_ALERTAS_FILTER_TRIGGER_STYLE}
                formatOption={(o) => (o === TODAS_SUBST ? 'Todas' : o)}
              />
              <div
                style={{
                  position: 'relative',
                  width: 180,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  height: 36,
                  padding: '0 12px 0 34px',
                  backgroundColor: '#111110',
                  border: `1px solid ${buscaFocada ? '#EF9F27' : '#2C2C2A'}`,
                  borderRadius: 6,
                  transition: 'border-color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={14}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: buscaFocada ? '#EF9F27' : '#888780',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onFocus={() => setBuscaFocada(true)}
                  onBlur={() => setBuscaFocada(false)}
                  placeholder="Buscar..."
                  autoComplete="off"
                  className="terrae-intel-busca-processos"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: 14,
                    lineHeight: 1.25,
                    color: '#F1EFE8',
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  }}
                />
              </div>
            </div>
          </div>
          <div
            style={{
              height: 1,
              backgroundColor: '#2C2C2A',
              width: 'var(--radar-feed-bleed-w, 100%)',
              maxWidth: 'var(--radar-feed-bleed-w, none)',
              flexShrink: 0,
            }}
            aria-hidden
          />
            {alertasOrdenados.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    maxWidth: 320,
                  }}
                >
                  <Bell size={40} color="#5F5E5A" aria-hidden />
                  <div
                    style={{
                      marginTop: 16,
                      fontSize: INTEL_KP_LABEL_FS,
                      fontWeight: 500,
                      color: INTEL_KP_LABEL_COLOR,
                    }}
                  >
                    Nenhum alerta para o período
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: INTEL_KP_SUB_FS,
                      color: INTEL_KP_SUB_COLOR,
                    }}
                  >
                    Tente ampliar o período ou ajustar os filtros
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodo('30d')
                      setDdPeriodo(false)
                    }}
                    style={{
                      marginTop: 20,
                      border: '1px solid #5F5E5A',
                      backgroundColor: 'transparent',
                      color: '#D3D1C7',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 6,
                      padding: '8px 20px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.15s ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#EF9F27'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#5F5E5A'
                    }}
                  >
                    Ver últimos 30 dias
                  </button>
                </div>
              </div>
            ) : (
              alertasOrdenados.map((a) => {
                const rel = calcularRelevancia(
                  a.nivel_impacto,
                  tipoParaCalculo(a.tipo_impacto),
                )
                const corBolinha = COR_BOLINHA_RELEV[rel]
                const corBordaSel = COR_BOLINHA_RELEV[rel]
                const sel = alertaSelecionadoId === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectAlerta(a.id)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 0,
                      border: 'none',
                      backgroundColor: 'transparent',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        height: 1,
                        width: 'var(--radar-feed-bleed-w, 100%)',
                        backgroundColor: '#2C2C2A',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        borderLeft: `3px solid ${sel ? corBordaSel : 'transparent'}`,
                        backgroundColor: sel ? '#1E1E1C' : 'transparent',
                        padding:
                          '12px max(10px, calc(20px - var(--radar-feed-scrollbar-w, 0px))) 12px 17px',
                        transition:
                          'background-color .15s ease-out, border-color .15s ease-out',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={(e) => {
                        if (!sel)
                          e.currentTarget.style.backgroundColor = '#2C2C2A'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = sel
                          ? '#1E1E1C'
                          : 'transparent'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: corBolinha,
                                flexShrink: 0,
                              }}
                              aria-hidden
                            />
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: INTEL_KP_LABEL_FS,
                                fontWeight: 500,
                                color: INTEL_KP_LABEL_COLOR,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {a.titulo}
                            </span>
                          </div>
                          <div
                            style={{
                              marginLeft: 16,
                              fontSize: INTEL_KP_SUB_FS,
                              color: INTEL_KP_SUB_COLOR,
                              lineHeight: 1.4,
                            }}
                          >
                            {a.fonte_nome_completo}
                            <span> · </span>
                            {formatDataHoraPublicacaoPainel(a.data, a.hora)}
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          {isNovo7d(a.data) ? (
                            <span
                              style={{
                                backgroundColor: 'rgba(239,159,39,0.12)',
                                color: '#EF9F27',
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: 0.4,
                                padding: '3px 8px',
                                borderRadius: 4,
                                flexShrink: 0,
                                lineHeight: 1.2,
                              }}
                            >
                              NOVO
                            </span>
                          ) : null}
                          <ChevronRight
                            size={18}
                            color="#F1EFE8"
                            style={{ flexShrink: 0 }}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
        </div>

        {wide ? (
          <div
            className="terrae-intel-dashboard-scroll flex min-h-0 flex-col overflow-y-auto"
            style={{
              flex: '3 1 0%',
              minWidth: 360,
              minHeight: 0,
              backgroundColor: '#1A1A18',
              border: '1px solid #2C2C2A',
              borderRadius: 8,
            }}
          >
            {detalheConteudo(false)}
          </div>
        ) : null}
      </div>

      {!wide && drawerAberto && alertaSelecionado ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          role="presentation"
          onClick={() => setDrawerAberto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="terrae-intel-dashboard-scroll overflow-y-auto"
            style={{
              width: 'min(400px, 100vw)',
              maxWidth: '100%',
              height: '100%',
              backgroundColor: '#1A1A18',
              borderLeft: '1px solid #2C2C2A',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
              animation: reducedMotion ? undefined : 'terraeRadarDrawerIn 220ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: 12,
                borderBottom: '1px solid #2C2C2A',
              }}
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => {
                  setDrawerAberto(false)
                  setAlertaSelecionadoId(null)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#888780',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={22} />
              </button>
            </div>
            {detalheConteudo(true)}
          </div>
        </div>
      ) : null}

    </div>
  )
}

=== FIM: src/components/dashboard/RadarAlertasSubtab.tsx ===

=== ARQUIVO: src/data/radar-alertas.mock.ts ===
export interface RadarAlerta {
  id: string
  titulo: string
  ementa: string
  nivel_impacto: 1 | 2 | 3 | 4
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro'
  fonte: string
  fonte_nome_completo: string
  data: string
  /** Hora da publicação (HH:mm), para exibição no feed. */
  hora: string
  substancias_afetadas: string[]
  processos_afetados_ids: string[]
  /** Texto da seção Análise Terrae (fallback: ementa). */
  analise?: string
  urgencia: 'imediata' | 'medio_prazo' | 'longo_prazo'
}

/** YYYY-MM-DD no fuso local (igual ao filtro "Hoje" no Radar; evita desvio de `toISOString()` UTC). */
function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RADAR_MOCK_DATA_HOJE = ymdLocal(new Date())

/** Ordem: mais recente primeiro no feed (parse data+hora). */
const RADAR_MOCK_HORAS_HOJE = ['17:00', '15:20', '13:45', '10:15', '08:30'] as const

function radarMockDataDiasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymdLocal(d)
}

export const RADAR_ALERTAS_MOCK: RadarAlerta[] = [
  {
    id: 'ra1',
    titulo:
      'Portaria ANM nº 12.884/2026: Retificação de área de concessão de lavra em Parauapebas/PA',
    ementa:
      'Altera poligonal de uma concessão de ferro em área contígua a ferrovia, com exigência de novo relatório de impacto. Afeta cronogramas de lavra e licenciamento complementar.',
    analise:
      'Altera poligonal de uma concessão de ferro em área contígua a ferrovia, com exigência de novo relatório de impacto. Afeta cronogramas de lavra e licenciamento complementar.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[0],
    substancias_afetadas: ['FERRO'],
    processos_afetados_ids: ['p1', 'p2', 'p7'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra2',
    titulo: 'Decreto MME 11.402/2026: Atualização da lista de minerais críticos e estratégicos',
    ementa:
      'Inclui novos minerais na política de suprimento crítico, com prioridade em cadastro e eventual trâmite diferenciado na ANM e órgãos ambientais.',
    analise:
      'Inclui novos minerais na política de suprimento crítico, com prioridade em cadastro e eventual trâmite diferenciado na ANM e órgãos ambientais.',
    nivel_impacto: 1,
    tipo_impacto: 'restritivo',
    fonte: 'DOU',
    fonte_nome_completo: 'Diário Oficial da União',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[1],
    substancias_afetadas: ['LÍTIO', 'NÍOBIO', 'NEODÍMIO'],
    processos_afetados_ids: ['p25', 'p26', 'p27'],
    urgencia: 'imediata',
  },
  {
    id: 'ra3',
    titulo: 'PL 8.901/2026: Câmara dos Deputados - Licenciamento ambiental em terra indígena',
    ementa:
      'Propõe marco para consulta e licenciamento em TI, com prazos e competências compartilhadas. Texto em fase de comissões; impacto regulatório ainda incerto.',
    analise:
      'Propõe marco para consulta e licenciamento em TI, com prazos e competências compartilhadas. Texto em fase de comissões; impacto regulatório ainda incerto.',
    nivel_impacto: 1,
    tipo_impacto: 'neutro',
    fonte: 'Câmara',
    fonte_nome_completo: 'Câmara dos Deputados',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[2],
    substancias_afetadas: ['OURO', 'COBRE'],
    processos_afetados_ids: ['p4', 'p15', 'p18'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra4',
    titulo: 'Resolução IBAMA 689/2026: APP e faixa marginal em bacias amazônicas',
    ementa:
      'Endurece parâmetros de vegetação nativa em APP para novos empreendimentos. Exige revisão de EIA/RIMA em processos em licenciamento na Amazônia Legal.',
    analise:
      'Endurece parâmetros de vegetação nativa em APP para novos empreendimentos. Exige revisão de EIA/RIMA em processos em licenciamento na Amazônia Legal.',
    nivel_impacto: 1,
    tipo_impacto: 'restritivo',
    fonte: 'IBAMA',
    fonte_nome_completo: 'Instituto Brasileiro do Meio Ambiente',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[3],
    substancias_afetadas: ['BAUXITA', 'FERRO'],
    processos_afetados_ids: ['p16', 'p19', 'p22'],
    urgencia: 'imediata',
  },
  {
    id: 'ra5',
    titulo: 'Senado: PLS 612/2026 - Royalties diferenciados para cobre e níquel',
    ementa:
      'Estabelece alíquotas progressivas e fundo regional. Pode alterar modelagem econômica de projetos em GO e PA.',
    analise:
      'Estabelece alíquotas progressivas e fundo regional. Pode alterar modelagem econômica de projetos em GO e PA.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'Senado',
    fonte_nome_completo: 'Senado Federal',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[4],
    substancias_afetadas: ['COBRE', 'NÍQUEL'],
    processos_afetados_ids: ['p5', 'p24', 'p28'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra6',
    titulo: 'Portaria ANM 4.120/2026: Autorização de pesquisa para terras raras em Goiás',
    ementa:
      'Publica autorização de pesquisa com condicionantes de relatório anual e geometria retificável. Sinal positivo para pipeline de terras raras.',
    analise:
      'Publica autorização de pesquisa com condicionantes de relatório anual e geometria retificável. Sinal positivo para pipeline de terras raras.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(1),
    hora: '10:00',
    substancias_afetadas: ['NEODÍMIO', 'DISPRÓSIO'],
    processos_afetados_ids: ['p25', 'p26'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra7',
    titulo: 'Edital BNDES 06/2026: Finame verde para logística mineral',
    ementa:
      'Linha de crédito para ferrovias e portos privados com critérios ESG. Beneficia projetos com alto volume e integração modal.',
    analise:
      'Linha de crédito para ferrovias e portos privados com critérios ESG. Beneficia projetos com alto volume e integração modal.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    fonte: 'BNDES',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(2),
    hora: '15:45',
    substancias_afetadas: ['FERRO', 'BAUXITA'],
    processos_afetados_ids: ['p1', 'p8', 'p11'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra8',
    titulo: 'ANTT: Resolução 5.901/2026 - Tarifa ferroviária e trackage rights',
    ementa:
      'Revisa metodologia de tarifas em malhas concedidas. Pode reduzir custo logístico para minério a granel no Arco Norte.',
    analise:
      'Revisa metodologia de tarifas em malhas concedidas. Pode reduzir custo logístico para minério a granel no Arco Norte.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'ANTT',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(3),
    hora: '12:10',
    substancias_afetadas: ['FERRO'],
    processos_afetados_ids: ['p2', 'p9'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra9',
    titulo: 'Finep: Chamada pública 18/2026 - Inovação em lixiviação de lítio',
    ementa:
      'Subvenção econômica para rotas de DLE e rejeitos. Foco em projetos com TRL 6+ em território nacional.',
    analise:
      'Subvenção econômica para rotas de DLE e rejeitos. Foco em projetos com TRL 6+ em território nacional.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    fonte: 'Finep',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(4),
    hora: '17:55',
    substancias_afetadas: ['LÍTIO'],
    processos_afetados_ids: ['p27'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra10',
    titulo: 'Portaria ANM 9.201/2026: Bloqueio provisório por sobreposição cadastral',
    ementa:
      'Suspende análise de requerimento em área com sobreposição a requerimento anterior até saneamento documental.',
    analise:
      'Suspende análise de requerimento em área com sobreposição a requerimento anterior até saneamento documental.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(5),
    hora: '13:20',
    substancias_afetadas: ['OURO'],
    processos_afetados_ids: ['p3', 'p12'],
    urgencia: 'imediata',
  },
  {
    id: 'ra11',
    titulo: 'MME: Ordem de serviço para estudos de minerais críticos em MG',
    ementa:
      'Contratação de levantamento técnico sobre jazidas e cadastro estratégico; não altera titularidade, mas orienta política setorial.',
    analise:
      'Contratação de levantamento técnico sobre jazidas e cadastro estratégico; não altera titularidade, mas orienta política setorial.',
    nivel_impacto: 4,
    tipo_impacto: 'neutro',
    fonte: 'DOU',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(6),
    hora: '09:50',
    substancias_afetadas: ['FERRO', 'NÍQUEL'],
    processos_afetados_ids: ['p6', 'p13', 'p24'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra12',
    titulo: 'IBAMA: Parecer técnico 4402/2026 - Licença prévia cobre em área sensível',
    ementa:
      'Determina condicionante de monitoramento hídrico contínuo e plano de contingência revisado em 180 dias.',
    analise:
      'Determina condicionante de monitoramento hídrico contínuo e plano de contingência revisado em 180 dias.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    fonte: 'IBAMA',
    fonte_nome_completo: 'Instituto Brasileiro do Meio Ambiente',
    data: radarMockDataDiasAtras(7),
    hora: '14:33',
    substancias_afetadas: ['COBRE'],
    processos_afetados_ids: ['p5', 'p14', 'p21'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra13',
    titulo: 'Câmara: PL 7.120/2026 - Cadastro nacional de áreas em litígio mineral',
    ementa:
      'Cria registro público de litígios e bloqueios judiciais para consulta prévia a investidores.',
    analise:
      'Cria registro público de litígios e bloqueios judiciais para consulta prévia a investidores.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'Câmara',
    fonte_nome_completo: 'Câmara dos Deputados',
    data: radarMockDataDiasAtras(8),
    hora: '11:11',
    substancias_afetadas: ['QUARTZO', 'BAUXITA'],
    processos_afetados_ids: ['p10', 'p17', 'p20'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra14',
    titulo: 'ANM: Despacho de concessão de lavra - Nióbio em Goiás',
    ementa:
      'Publica concessão de lavra com plano de fechamento e garantias financeiras. Marco favorável para titular e cadeia de fornecedores.',
    analise:
      'Publica concessão de lavra com plano de fechamento e garantias financeiras. Marco favorável para titular e cadeia de fornecedores.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(9),
    hora: '10:25',
    substancias_afetadas: ['NÍOBIO'],
    processos_afetados_ids: ['p26'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra15',
    titulo: 'Senado: Audiência pública - TI e mineração em MT',
    ementa:
      'Debatedores discutem consulta prévia e compensações. Sem force de lei; orienta risco reputacional e social.',
    analise:
      'Debatedores discutem consulta prévia e compensações. Sem force de lei; orienta risco reputacional e social.',
    nivel_impacto: 4,
    tipo_impacto: 'neutro',
    fonte: 'Senado',
    fonte_nome_completo: 'Senado Federal',
    data: radarMockDataDiasAtras(10),
    hora: '15:00',
    substancias_afetadas: ['OURO', 'FERRO'],
    processos_afetados_ids: ['p23', 'p29', 'p30'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra16',
    titulo: 'DOU: Retificação de edital de leilão de blocos exploratórios (arrecadação ANM)',
    ementa:
      'Corrige coordenadas e prazos de manifestação de interesse para áreas em MT e AM.',
    analise:
      'Corrige coordenadas e prazos de manifestação de interesse para áreas em MT e AM.',
    nivel_impacto: 4,
    tipo_impacto: 'neutro',
    fonte: 'DOU',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(11),
    hora: '08:45',
    substancias_afetadas: ['COBRE', 'OURO'],
    processos_afetados_ids: ['p18', 'p30'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra17',
    titulo: 'BNDES: Linha de apoio a PPP de infraestrutura portuária no Pará',
    ementa:
      'Condições especiais para terminal de minério com contrapartida ambiental. Janela de 24 meses.',
    analise:
      'Condições especiais para terminal de minério com contrapartida ambiental. Janela de 24 meses.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'BNDES',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(12),
    hora: '12:30',
    substancias_afetadas: ['FERRO', 'BAUXITA'],
    processos_afetados_ids: ['p1', 'p11'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra18',
    titulo: 'ANM: Ofício-circular sobre prazos de resposta a complementações',
    ementa:
      'Padroniza contagem de prazo em dias úteis e canal eletrônico único. Reduz incerteza operacional para despachantes.',
    analise:
      'Padroniza contagem de prazo em dias úteis e canal eletrônico único. Reduz incerteza operacional para despachantes.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(13),
    hora: '18:00',
    substancias_afetadas: ['LÍTIO', 'DISPRÓSIO', 'QUARTZO'],
    processos_afetados_ids: ['p25', 'p27', 'p20'],
    urgencia: 'medio_prazo',
  },
]

=== FIM: src/data/radar-alertas.mock.ts ===

=== ARQUIVO: src/lib/relevanciaAlerta.ts ===
import type { AlertaLegislativo, NivelImpacto } from '../types'

export type TipoImpacto = AlertaLegislativo['tipo_impacto']

export type Relevancia =
  | 'favoravel'
  | 'positivo'
  | 'neutro'
  | 'desfavoravel'
  | 'critico'

export interface RelevanciaConfig {
  label: string
  cor: string
  /** 1 = mais crítico, 5 = mais favorável */
  ordem: number
}

export const RELEVANCIA_MAP: Record<Relevancia, RelevanciaConfig> = {
  favoravel: { label: 'FAVORÁVEL', cor: '#1D9E75', ordem: 5 },
  positivo: { label: 'POSITIVO', cor: '#5CBFA0', ordem: 4 },
  neutro: { label: 'NEUTRO', cor: '#888780', ordem: 3 },
  desfavoravel: { label: 'DESFAVORÁVEL', cor: '#E8A830', ordem: 2 },
  critico: { label: 'CRÍTICO', cor: '#E24B4A', ordem: 1 },
}

export function calcularRelevancia(
  nivel_impacto: NivelImpacto,
  tipo_impacto: TipoImpacto,
): Relevancia {
  if (nivel_impacto === 1 && tipo_impacto === 'favoravel') return 'favoravel'
  if (nivel_impacto === 1 && tipo_impacto === 'restritivo') return 'critico'
  if (
    nivel_impacto === 1 &&
    (tipo_impacto === 'neutro' || tipo_impacto === 'incerto')
  )
    return 'neutro'

  if (nivel_impacto === 2 && tipo_impacto === 'favoravel') return 'positivo'
  if (nivel_impacto === 2 && tipo_impacto === 'restritivo') return 'desfavoravel'
  if (
    nivel_impacto === 2 &&
    (tipo_impacto === 'neutro' || tipo_impacto === 'incerto')
  )
    return 'neutro'

  if (nivel_impacto === 3 && tipo_impacto === 'favoravel') return 'positivo'
  if (nivel_impacto === 3 && tipo_impacto === 'restritivo') return 'neutro'
  if (
    nivel_impacto === 3 &&
    (tipo_impacto === 'neutro' || tipo_impacto === 'incerto')
  )
    return 'neutro'

  return 'neutro'
}

export function estiloBadgeRelevancia(
  nivel_impacto: NivelImpacto,
  tipo_impacto: TipoImpacto,
): { cor: string; label: string } {
  const r = calcularRelevancia(nivel_impacto, tipo_impacto)
  const cfg = RELEVANCIA_MAP[r]
  return { cor: cfg.cor, label: cfg.label }
}

=== FIM: src/lib/relevanciaAlerta.ts ===

=== ARQUIVO: src/lib/opportunityScore.ts ===
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
  if (faixa === 'alta') return 'OPORTUNIDADE ALTA'
  if (faixa === 'moderada') return 'OPORTUNIDADE MODERADA'
  if (faixa === 'baixa') return 'OPORTUNIDADE BAIXA'
  return 'NÃO RECOMENDADO'
}

/** Cor da mini-barra por valor 0–100: ≥70 verde, 40–69 âmbar, &lt;40 vermelho */
export function corMiniBarraValor(v: number): string {
  if (v >= 70) return '#1D9E75'
  if (v >= 40) return '#E8A830'
  return '#E24B4A'
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
        ? 'Gap reserva/produção desfavorável no referencial global'
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
        ? 'CAPAG C — município com fragilidade fiscal'
        : 'Nota CAPAG abaixo do ideal para projetos longos'
    case 'B2':
      return 'Fase ainda distante da lavra (maior incerteza de prazo)'
    case 'B3':
      return 'Logística ferroviária/portuária não privilegiada no modelo'
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
        ? 'Risco agregado elevado no modelo Terrae'
        : 'Risco agregado acima da zona confortável'
    case 'C2':
      return 'Componente ambiental do risco pressionado'
    case 'C3':
      return 'Risco regulatório elevado no breakdown'
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
        ? 'CAPAG A, base fiscal sólida no município'
        : p.fiscal.capag === 'B'
          ? 'CAPAG B — ambiente fiscal moderado'
          : 'CAPAG fraca — atenção à autonomia municipal'
    case 'B2':
      return p.fase === 'lavra'
        ? 'Processo em fase de lavra (maduro)'
        : p.fase === 'concessao'
          ? 'Concessão aprovada, caminho operacional claro'
          : 'Fase ainda incipiente no ciclo ANM'
    case 'B3':
      return 'Logística: ferrovia/porto com distância média (referência modelo)'
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
        ? 'Risco agregado elevado no modelo Terrae'
        : 'Risco agregado controlado no modelo Terrae'
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
      fatoresAtencao.push('Proximidade de comunidades / pressão social no modelo')
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

=== FIM: src/lib/opportunityScore.ts ===

=== ARQUIVO: src/lib/motionDurations.ts ===
/** Durações do motion system (alinhadas a App + Inteligência + Mapa). */

export const MOTION_OVERLAY_INNER_ENTER_DELAY_MS = 60
export const MOTION_OVERLAY_INNER_ENTER_MS = 120
export const MOTION_OVERLAY_INNER_EXIT_MS = 120
/** Desmontagem do overlay após início do fade-out do conteúdo (margem + chrome). */
export const MOTION_OVERLAY_UNMOUNT_MS = 180

export const MOTION_STAGGER_STEP_MS = 60
/** Base do stagger na Inteligência = fim do fade-in do overlay (60 + 120). */
export function motionStaggerBaseMs(reducedMotion: boolean): number {
  return reducedMotion
    ? 0
    : MOTION_OVERLAY_INNER_ENTER_DELAY_MS + MOTION_OVERLAY_INNER_ENTER_MS
}

export const MOTION_TAB_CROSSFADE_OUT_MS = 120
export const MOTION_TAB_CROSSFADE_IN_MS = 180

export const MOTION_GROUP_FADE_MS = 300
export const MOTION_GROUP_TRANSLATE_PX = 16

export const MOTION_BAR_WIDTH_MS = 400
export const MOTION_BAR_STAGGER_MS = 30

export const MOTION_MAP_INTRO_SEARCH_DELAY_MS = 300
export const MOTION_MAP_INTRO_LEGEND_DELAY_MS = 400
export const MOTION_MAP_INTRO_THEME_DELAY_MS = 450
export const MOTION_MAP_INTRO_DURATION_MS = 250

/** Recharts `<Line>` animationBegin por `dataKey` (SUB_KEYS). */
export const MOTION_LINE_ANIMATION_BEGIN_MS: Record<
  'ferro' | 'cobre' | 'ouro' | 'niobio' | 'terras_raras',
  number
> = {
  ferro: 120,
  cobre: 170,
  ouro: 220,
  niobio: 270,
  terras_raras: 320,
}

export function motionMs(d: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : d
}

=== FIM: src/lib/motionDurations.ts ===

=== ARQUIVO: src/hooks/useStaggeredEntrance.ts ===
import { useEffect, useState } from 'react'

/**
 * Cada grupo passa a `true` após `baseDelayMs + índice * staggerMs`.
 * Com reduced motion, todos `true` imediatamente.
 */
export function useStaggeredEntrance(
  groupCount: number,
  options: {
    baseDelayMs: number
    staggerMs: number
    reducedMotion: boolean
  },
): boolean[] {
  const { baseDelayMs, staggerMs, reducedMotion } = options

  const [visible, setVisible] = useState<boolean[]>(() =>
    Array.from({ length: groupCount }, () => reducedMotion),
  )

  useEffect(() => {
    if (reducedMotion) {
      setVisible(Array.from({ length: groupCount }, () => true))
      return
    }

    setVisible(Array.from({ length: groupCount }, () => false))
    const ids: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < groupCount; i++) {
      const id = window.setTimeout(() => {
        setVisible((prev) => {
          const next = [...prev]
          if (i < next.length) next[i] = true
          return next
        })
      }, baseDelayMs + i * staggerMs)
      ids.push(id)
    }
    return () => {
      for (const id of ids) clearTimeout(id)
    }
  }, [groupCount, baseDelayMs, staggerMs, reducedMotion])

  return visible
}

=== FIM: src/hooks/useStaggeredEntrance.ts ===

=== ARQUIVO: src/components/ui/BadgeSubstancia.tsx ===
import type { CSSProperties } from 'react'
import { estiloBadgeSubstanciaPaletaV2 } from '../../lib/corSubstancia'

const BASE: CSSProperties = {
  borderRadius: 4,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  boxSizing: 'border-box',
  display: 'inline-block',
}

export type BadgeSubstanciaVariant = 'popup' | 'intelTable' | 'radarCompact'

export function BadgeSubstancia({
  substancia,
  variant,
}: {
  substancia: string
  variant: BadgeSubstanciaVariant
}) {
  const est = estiloBadgeSubstanciaPaletaV2(substancia)
  const fontSize = variant === 'popup' ? 11 : variant === 'radarCompact' ? 10 : 12
  const padding =
    variant === 'radarCompact' ? '1px 6px' : '2px 8px'
  return (
    <span
      style={{
        ...BASE,
        ...est,
        fontSize,
        padding,
      }}
    >
      {substancia.toLocaleUpperCase('pt-BR')}
    </span>
  )
}

=== FIM: src/components/ui/BadgeSubstancia.tsx ===

=== ARQUIVO: src/lib/corSubstancia.ts ===
/** Cores por substância: alinhadas ao dashboard (badges / tabela). */

export const COR_SUBSTANCIA: Record<string, string> = {
  FERRO: '#7EADD4',
  OURO: '#D4A843',
  COBRE: '#C87C5B',
  NIOBIO: '#5CBFA0',
  'TERRAS RARAS': '#3D8B7A',
  NEODIMIO: '#3D8B7A',
  LITIO: '#9BB8D0',
  NIQUEL: '#8FAA8D',
  DISPRÓSIO: '#3D8B7A',
  DISPROSIO: '#3D8B7A',
  PRASEODIMIO: '#3D8B7A',
  TERBIO: '#3D8B7A',
  GRAFITE: '#7A9B5A',
  VANADIO: '#7EADD4',
  BAUXITA: '#B8917A',
  QUARTZO: '#C4B89A',
}

function chaveSubstancia(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/** Cor principal da substância, se existir no mapa. */
export function corSubstanciaOuUndefined(raw: string): string | undefined {
  return COR_SUBSTANCIA[chaveSubstancia(raw)]
}

/**
 * Badge v2: fundo transparente, borda 1px na cor da substância (paleta dashboard).
 * Substâncias fora da paleta: texto #D3D1C7, borda #5F5E5A.
 */
export function estiloBadgeSubstanciaPaletaV2(raw: string): {
  backgroundColor: 'transparent'
  color: string
  border: string
} {
  const cor = corSubstanciaOuUndefined(raw)
  if (!cor) {
    return {
      backgroundColor: 'transparent',
      color: '#D3D1C7',
      border: '1px solid #5F5E5A',
    }
  }
  return {
    backgroundColor: 'transparent',
    color: cor,
    border: `1px solid ${cor}`,
  }
}

/**
 * Estilo de badge (fundo 15% + texto na cor principal).
 * Fallback quando não houver mapeamento: fundo #2C2C2A, texto #888780.
 */
export function estiloBadgeSubstancia(raw: string): {
  backgroundColor: string
  color: string
} {
  const cor = corSubstanciaOuUndefined(raw)
  if (!cor) {
    return { backgroundColor: '#2C2C2A', color: '#888780' }
  }
  return { backgroundColor: `${cor}26`, color: cor }
}

=== FIM: src/lib/corSubstancia.ts ===

=== ARQUIVO: src/store/useAppStore.ts ===
import { create } from 'zustand'

export type TelaAtivaApp = 'mapa' | 'inteligencia' | 'radar'

interface AppStore {
  telaAtiva: TelaAtivaApp
  setTelaAtiva: (tela: TelaAtivaApp) => void
}

export const useAppStore = create<AppStore>((set) => ({
  telaAtiva: 'mapa',
  setTelaAtiva: (tela) => set({ telaAtiva: tela }),
}))

=== FIM: src/store/useAppStore.ts ===

=== ARQUIVO: src/store/useMapStore.ts ===
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PROCESSOS_MOCK } from '../data/processos.mock'
import { cloneFiltrosState } from '../lib/intelMapDrill'
import {
  type CamadaGeoId,
  defaultCamadasGeo,
  mergeCamadasGeoPersisted,
} from '../lib/mapCamadasGeo'
import {
  UF_FILTRO_NENHUM,
  type FiltrosState,
  type Processo,
  type Regime,
} from '../types'

export type { CamadaGeoId } from '../lib/mapCamadasGeo'

export type PendingNavigation =
  | { type: 'processo'; payload: string; timestamp: number }
  | { type: 'estado'; payload: string; timestamp: number }
  | { type: 'regime'; payload: Regime; timestamp: number }
  | { type: 'titular'; payload: string; timestamp: number }
  | { type: 'substancia'; payload: string; timestamp: number }

const REGIMES: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
]

function defaultCamadas(): Record<Regime, boolean> {
  return REGIMES.reduce(
    (acc, r) => {
      acc[r] = true
      return acc
    },
    {} as Record<Regime, boolean>,
  )
}

function defaultFiltros(): FiltrosState {
  return {
    camadas: defaultCamadas(),
    substancias: [],
    periodo: [1960, 2026],
    uf: null,
    municipio: null,
    riskScoreMin: 0,
    riskScoreMax: 100,
    searchQuery: '',
  }
}

/** Garante todas as chaves de regime; só exclui camada se for explicitamente false no persist. */
function mergeCamadas(
  saved?: Partial<Record<Regime, boolean>>,
): Record<Regime, boolean> {
  const base = defaultCamadas()
  if (!saved || typeof saved !== 'object') return base
  const merged = { ...base }
  for (const r of REGIMES) {
    if (r in saved && typeof saved[r] === 'boolean') {
      merged[r] = saved[r]!
    }
  }
  const todasDesligadas = REGIMES.every((r) => merged[r] === false)
  return todasDesligadas ? base : merged
}

function mergePeriodo(raw: unknown): [number, number] {
  const d = defaultFiltros().periodo
  if (!Array.isArray(raw) || raw.length !== 2) return d
  let a = Number(raw[0])
  let b = Number(raw[1])
  if (!Number.isFinite(a)) a = d[0]
  if (!Number.isFinite(b)) b = d[1]
  if (a > b) [a, b] = [b, a]
  return [Math.max(1800, a), Math.min(2100, b)] as [number, number]
}

function mergeRiskRange(saved: Partial<FiltrosState> | undefined) {
  const d = defaultFiltros()
  let lo = Number(saved?.riskScoreMin)
  let hi = Number(saved?.riskScoreMax)
  if (!Number.isFinite(lo)) lo = d.riskScoreMin
  if (!Number.isFinite(hi)) hi = d.riskScoreMax
  lo = Math.max(0, Math.min(100, lo))
  hi = Math.max(0, Math.min(100, hi))
  if (lo > hi) [lo, hi] = [hi, lo]
  return { riskScoreMin: lo, riskScoreMax: hi }
}

function loadProcessos(): Processo[] {
  localStorage.removeItem('terrae-processos')
  return PROCESSOS_MOCK
}

const NUMERO_RX = /\d{3}\.\d{3}\/\d{4}/

export interface MapStore {
  processos: Processo[]
  filtros: FiltrosState
  processoSelecionado: Processo | null
  flyTo: { lat: number; lng: number; zoom: number } | null
  hoveredProcessoId: string | null
  /** Drawer "Relatório completo" visível (UI transitória, não persistida). */
  relatorioDrawerAberto: boolean

  pendingNavigation: PendingNavigation | null
  /** Filtro extra aplicado após drill por titular (não persistido). */
  intelTitularFilter: string | null
  /** Snapshot de `filtros` antes da primeira drill com banner; restaurado ao ✕ do banner. */
  intelDrillRestoreFiltros: FiltrosState | null
  /** Impressão digital dos filtros após aplicar drill; divergência → banner some. */
  intelDrillExpectedFiltrosJson: string | null

  /** Overlays geoespaciais (não filtram processos; só visualização no mapa). */
  camadasGeo: Record<CamadaGeoId, boolean>
  toggleCamadaGeo: (id: CamadaGeoId) => void

  setFiltro: <K extends keyof FiltrosState>(
    key: K,
    value: FiltrosState[K],
  ) => void
  toggleCamada: (regime: Regime) => void
  selecionarProcesso: (processo: Processo | null) => void
  setHoveredProcessoId: (id: string | null) => void
  getProcessosFiltrados: () => Processo[]
  requestFlyTo: (lat: number, lng: number, zoom?: number) => void
  clearFlyTo: () => void
  setRelatorioDrawerAberto: (aberto: boolean) => void
  /** Volta todos os filtros ao padrão (camadas, período, substâncias, UF, município, risk range, busca). */
  resetFiltros: () => void
  /**
   * Reset só da sidebar (filtros + filtro extra por titular), sem mexer em banner/snapshot.
   * Usado no fluxo `pendingNavigation` da Inteligência antes de aplicar o filtro específico.
   */
  applySidebarFiltrosPadrao: () => void

  setPendingNavigation: (nav: PendingNavigation | null) => void
  setIntelTitularFilter: (titular: string | null) => void
  /** Remove banner e filtro por titular; descarta snapshot (ex.: após mudança manual nos filtros). */
  dismissIntelDrillUi: () => void
  /** Restaura filtros do snapshot, limpa drill e banner (botão ✕). */
  restoreIntelDrillSnapshot: () => void
}

function applyFilters(
  processos: Processo[],
  f: FiltrosState,
  intelTitularFilter: string | null,
): Processo[] {
  const q = f.searchQuery.trim().toLowerCase()
  const numeroMatch = q.match(NUMERO_RX)?.[0]

  return processos.filter((p) => {
    if (intelTitularFilter && p.titular !== intelTitularFilter) return false

    if (f.camadas[p.regime] === false) return false

    const [y0, y1] = f.periodo
    if (p.ano_protocolo < y0 || p.ano_protocolo > y1) return false

    if (f.uf === UF_FILTRO_NENHUM) return false
    if (f.uf && p.uf !== f.uf) return false

    if (f.municipio) {
      const m = f.municipio.toLowerCase()
      if (!p.municipio.toLowerCase().includes(m)) return false
    }

    if (p.risk_score === null) {
      /* bloqueados: não filtrar por faixa numérica */
    } else if (
      p.risk_score < f.riskScoreMin ||
      p.risk_score > f.riskScoreMax
    ) {
      return false
    }

    if (f.substancias.length > 0) {
      const norm = (s: string) =>
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
      const sub = norm(p.substancia)
      if (!f.substancias.map(norm).includes(sub)) return false
    }

    if (q.length > 0) {
      if (numeroMatch && p.numero.includes(numeroMatch.replace(/\s/g, ''))) {
        /* ok */
      } else if (numeroMatch) {
        return false
      } else {
        const blob = `${p.numero} ${p.titular} ${p.municipio} ${p.uf} ${p.substancia}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
    }

    return true
  })
}

/** Só isto vai para o localStorage; evita F5 com busca/UF/etc. que zera o mapa. */
type FiltrosPersistidos = Pick<
  FiltrosState,
  'camadas' | 'periodo' | 'riskScoreMin' | 'riskScoreMax'
>

export const useMapStore = create<MapStore>()(
  persist(
    (set, get) => ({
      processos: loadProcessos(),
      filtros: defaultFiltros(),
      processoSelecionado: null,
      flyTo: null,
      hoveredProcessoId: null,
      relatorioDrawerAberto: false,

      pendingNavigation: null,
      intelTitularFilter: null,
      intelDrillRestoreFiltros: null,
      intelDrillExpectedFiltrosJson: null,

      camadasGeo: defaultCamadasGeo(),

      toggleCamadaGeo: (id) =>
        set((s) => ({
          camadasGeo: { ...s.camadasGeo, [id]: !s.camadasGeo[id] },
        })),

      setFiltro: (key, value) =>
        set((s) => ({
          filtros: { ...s.filtros, [key]: value },
        })),

      toggleCamada: (regime) =>
        set((s) => ({
          filtros: {
            ...s.filtros,
            camadas: {
              ...s.filtros.camadas,
              [regime]: !s.filtros.camadas[regime],
            },
          },
        })),

      selecionarProcesso: (processo) =>
        set({
          processoSelecionado: processo,
        }),

      setHoveredProcessoId: (id) => set({ hoveredProcessoId: id }),

      getProcessosFiltrados: () =>
        applyFilters(
          get().processos,
          get().filtros,
          get().intelTitularFilter,
        ),

      requestFlyTo: (lat, lng, zoom = 9) => set({ flyTo: { lat, lng, zoom } }),

      clearFlyTo: () => set({ flyTo: null }),

      setRelatorioDrawerAberto: (aberto) => set({ relatorioDrawerAberto: aberto }),

      resetFiltros: () =>
        set({
          filtros: defaultFiltros(),
          intelTitularFilter: null,
          intelDrillRestoreFiltros: null,
          intelDrillExpectedFiltrosJson: null,
        }),

      applySidebarFiltrosPadrao: () =>
        set({
          filtros: defaultFiltros(),
          intelTitularFilter: null,
        }),

      setPendingNavigation: (nav) => set({ pendingNavigation: nav }),

      setIntelTitularFilter: (titular) => set({ intelTitularFilter: titular }),

      dismissIntelDrillUi: () =>
        set({
          intelTitularFilter: null,
          intelDrillExpectedFiltrosJson: null,
          intelDrillRestoreFiltros: null,
        }),

      restoreIntelDrillSnapshot: () => {
        const snap = get().intelDrillRestoreFiltros
        if (snap) {
          set({
            filtros: cloneFiltrosState(snap),
            intelTitularFilter: null,
            intelDrillExpectedFiltrosJson: null,
            intelDrillRestoreFiltros: null,
          })
        } else {
          get().dismissIntelDrillUi()
        }
      },
    }),
    {
      name: 'terrae-filtros',
      partialize: (s): { filtros: FiltrosPersistidos; camadasGeo: Record<CamadaGeoId, boolean> } => ({
        filtros: {
          camadas: s.filtros.camadas,
          periodo: s.filtros.periodo,
          riskScoreMin: s.filtros.riskScoreMin,
          riskScoreMax: s.filtros.riskScoreMax,
        },
        camadasGeo: s.camadasGeo,
      }),
      merge: (persistedState, currentState) => {
        const box = persistedState as
          | {
              filtros?: Partial<FiltrosState> & Partial<FiltrosPersistidos>
              camadasGeo?: Partial<Record<CamadaGeoId, boolean>>
            }
          | undefined
        const s = box?.filtros
        const { riskScoreMin, riskScoreMax } = mergeRiskRange(s)
        const filtros: FiltrosState = {
          ...defaultFiltros(),
          camadas: mergeCamadas(s?.camadas),
          periodo: mergePeriodo(s?.periodo),
          riskScoreMin,
          riskScoreMax,
        }
        return {
          ...currentState,
          filtros,
          camadasGeo: mergeCamadasGeoPersisted(box?.camadasGeo),
          processos: loadProcessos(),
        }
      },
    },
  ),
)

export { REGIMES }

=== FIM: src/store/useMapStore.ts ===

=== ARQUIVO: src/components/ui/RegimeBadge.tsx ===
import type { CSSProperties, ReactNode } from 'react'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import {
  REGIME_BADGE_TOOLTIP,
  REGIME_COLORS,
  REGIME_COLORS_MAP,
  REGIME_LABELS,
} from '../../lib/regimes'
import type { Regime } from '../../types'

const TOOLTIP = {
  maxWidthPx: 340,
  bubblePadding: '10px 12px',
  preferBelow: true as const,
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function estiloVariante(
  regime: Regime,
  variant: RegimeBadgeVariant,
): { wrapClassName: string; spanStyle: CSSProperties } {
  const color = REGIME_COLORS[regime] ?? '#888780'
  const dotted = { borderBottom: `1px dotted ${color}` }
  if (variant === 'popup' || variant === 'drawer') {
    const c = REGIME_COLORS_MAP[regime] ?? color
    const spanStyle: CSSProperties = {
      display: 'inline-block',
      borderRadius: 4,
      padding: '3px 10px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
      lineHeight: 1.25,
      color: c,
      backgroundColor: 'transparent',
      border: `1.5px solid ${c}`,
      cursor: 'help',
      boxSizing: 'border-box' as const,
    }
    return {
      wrapClassName:
        variant === 'drawer'
          ? 'inline-flex max-w-full shrink-0'
          : 'inline-block',
      spanStyle,
    }
  }
  return {
    wrapClassName: 'inline-flex max-w-full',
    spanStyle: {
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 13,
      fontWeight: 500,
      backgroundColor: `${color}26`,
      color,
      cursor: 'help',
      ...dotted,
    },
  }
}

export type RegimeBadgeVariant = 'popup' | 'drawer' | 'table'

export function RegimeBadge({
  regime,
  variant,
  className,
  children,
}: {
  regime: Regime
  variant: RegimeBadgeVariant
  /** Classes no wrapper do tooltip (ex.: mt-3 no popup). */
  className?: string
  children?: ReactNode
}) {
  const texto = REGIME_BADGE_TOOLTIP[regime]
  const label = REGIME_LABELS[regime]
  const { wrapClassName, spanStyle } = estiloVariante(regime, variant)

  const inner = (
    <span style={spanStyle}>
      {children ?? label}
    </span>
  )

  return (
    <CamadaTooltipHover
      texto={texto}
      maxWidthPx={TOOLTIP.maxWidthPx}
      bubblePadding={TOOLTIP.bubblePadding}
      preferBelow={TOOLTIP.preferBelow}
      className={
        className ? `${wrapClassName} ${className}` : wrapClassName
      }
    >
      {inner}
    </CamadaTooltipHover>
  )
}

=== FIM: src/components/ui/RegimeBadge.tsx ===

=== ARQUIVO: src/index.css (trecho Radar, linhas 370-455) ===
@media (prefers-reduced-motion: no-preference) {
  .terrae-radar-pulse-icon {
    animation: terrae-radar-pulse-opacity 2s ease-in-out infinite;
  }

  .terrae-radar-spin-slow {
    animation: terrae-radar-rotate 3s ease-in-out infinite;
  }

  @keyframes terrae-radar-pulse-opacity {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes terrae-radar-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes terraeRadarFadeMsg {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes terrae-radar-kpi-impacto-opacity {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  .terrae-radar-kpi-impacto-pulse {
    animation: terrae-radar-kpi-impacto-opacity 2s ease-in-out infinite;
  }

  @keyframes terrae-radar-live-scale {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.4);
    }
  }

  .terrae-radar-live-dot {
    animation: terrae-radar-live-scale 1.5s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes terraeRadarDrawerIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @keyframes terraeRadarTimelineEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
=== FIM: src/index.css (trecho Radar, linhas 370-455) ===

=== ARQUIVO: src/components/dashboard/InteligenciaDashboard.tsx (excerto Radar: UFS + MultiSelectDropdown e helpers, linhas 264, 596-629, 1458-1470, 1639-1826) ===
// --- Linha 264 ---
export const UFS_INTEL_DASHBOARD = ['MG', 'PA', 'GO', 'BA', 'AM', 'MT'] as const

// --- Linhas 596-629 (ChevronDown) ---
function ChevronDown({
  aberto,
  stroke = '#5F5E5A',
  size = 12,
}: {
  aberto: boolean
  stroke?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      style={{
        flexShrink: 0,
        color: stroke,
        transform: aberto ? 'rotate(180deg)' : undefined,
        transition: 'transform 0.15s ease-out',
      }}
      aria-hidden
    >
      <path
        d="M 3 4.5 L 6 7.5 L 9 4.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

// --- Linhas 1458-1470 (CheckMini) ---
function CheckMini() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5 L4 7 L8 3"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// --- Linhas 1639-1826 (INTEL_FILTER_SELECT_TRIGGER_STYLE + MultiSelectDropdown) ---
/** Botão-trigger dos filtros dropdown na Inteligência (reutilizar no Radar). */
export const INTEL_FILTER_SELECT_TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#0D0D0C',
  border: '1px solid #2C2C2A',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 15,
  color: '#D3D1C7',
  cursor: 'pointer',
  outline: 'none',
}

type MultiSelectProps = {
  prefix: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  aberto: boolean
  setAberto: (v: boolean) => void
  /** Substitui o estilo padrão do botão (ex.: linha de filtros compacta no Radar). */
  triggerStyle?: CSSProperties
  /** Rótulo exibido por opção (ex.: "Todas" em vez do id interno). */
  formatOption?: (option: string) => string
}

export function MultiSelectDropdown({
  prefix,
  options,
  selected,
  onChange,
  aberto,
  setAberto,
  triggerStyle,
  formatOption,
}: MultiSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{
    top: number
    left: number
    width: number
    maxH: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!aberto) {
      setRect(null)
      return
    }
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const gap = 4
      const maxH = Math.min(280, vh - r.bottom - gap - 16)
      setRect({
        top: r.bottom + gap,
        left: Math.min(r.left, vw - 220),
        width: Math.max(r.width, 200),
        maxH: Math.max(80, maxH),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [aberto, setAberto])

  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt))
    else onChange([...selected, opt])
  }

  const portal =
    aberto && rect ? (
      <div
        ref={panelRef}
        role="listbox"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          maxHeight: rect.maxH,
          boxSizing: 'border-box',
          backgroundColor: '#1A1A18',
          border: '1px solid #2C2C2A',
          borderRadius: 8,
          padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 2147483647,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="terrae-dropdown-scroll min-h-0 flex-1 overflow-y-auto">
        {options.map((opt) => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => toggle(opt)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  borderRadius: 3,
                  border: '1px solid #2C2C2A',
                  backgroundColor: on ? '#EF9F27' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <CheckMini /> : null}
              </span>
              <span style={{ fontSize: 13, color: '#D3D1C7' }}>
                {formatOption ? formatOption(opt) : opt}
              </span>
            </button>
          )
        })}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="terrae-intel-border-interactive"
        onClick={() => setAberto(!aberto)}
        style={triggerStyle ?? INTEL_FILTER_SELECT_TRIGGER_STYLE}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {prefix}
        </span>
        <ChevronDown aberto={aberto} stroke="#D3D1C7" size={14} />
      </button>
      {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
    </>
  )
}
=== FIM: src/components/dashboard/InteligenciaDashboard.tsx (excerto Radar: UFS + MultiSelectDropdown e helpers, linhas 264, 596-629, 1458-1470, 1639-1826) ===
