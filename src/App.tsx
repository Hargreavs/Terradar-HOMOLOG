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

const TAB_SLIDE_PX = 30

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
  /** Mantém Radar/Intel montados ao ir ao Mapa (estado interno preservado). */
  const [painelExtraOcultoParaMapa, setPainelExtraOcultoParaMapa] = useState(
    () => telaAtiva === 'mapa',
  )
  const [painelExtraOpaco, setPainelExtraOpaco] = useState(
    () => telaAtiva === 'inteligencia' || telaAtiva === 'radar',
  )

  const [overlayFadeMode, setOverlayFadeMode] = useState<'in' | 'out'>('in')
  const [renderedExtraTela, setRenderedExtraTela] = useState<
    'inteligencia' | 'radar'
  >(() => (telaAtiva === 'radar' ? 'radar' : 'inteligencia'))
  const [extraTabOpacity, setExtraTabOpacity] = useState(1)
  const [extraTabTranslateX, setExtraTabTranslateX] = useState(0)
  const [tabLayerInstant, setTabLayerInstant] = useState(false)
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
        setExtraTabTranslateX(0)
        setTabLayerInstant(false)
        setTabContentTransition(
          reducedMotion
            ? 'opacity 1ms linear'
            : `opacity ${motionMs(MOTION_TAB_CROSSFADE_IN_MS, reducedMotion)}ms ease-out`,
        )
        setOverlayFadeMode('in')
        setPainelExtraMontado(true)
        setPainelExtraOcultoParaMapa(false)
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
        const outMs = motionMs(MOTION_TAB_CROSSFADE_OUT_MS, reducedMotion)
        const inMs = motionMs(MOTION_TAB_CROSSFADE_IN_MS, reducedMotion)
        const goingToRadar = telaAtiva === 'radar'
        const exitX = goingToRadar ? -TAB_SLIDE_PX : TAB_SLIDE_PX

        if (reducedMotion) {
          setTabContentTransition('opacity 1ms linear')
          setExtraTabTranslateX(0)
          setExtraTabOpacity(0)
          const t = window.setTimeout(() => {
            setRenderedExtraTela(telaAtiva)
            setTabContentTransition('opacity 1ms linear')
            requestAnimationFrame(() => setExtraTabOpacity(1))
          }, tabCrossOutMs)
          return () => clearTimeout(t)
        }

        setTabLayerInstant(false)
        setTabContentTransition(
          `opacity ${outMs}ms ease-in, transform ${outMs}ms ease-in`,
        )
        setExtraTabTranslateX(exitX)
        setExtraTabOpacity(0)

        const t = window.setTimeout(() => {
          const enterX = -exitX
          setRenderedExtraTela(telaAtiva)
          setTabLayerInstant(true)
          setTabContentTransition('none')
          setExtraTabTranslateX(enterX)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTabLayerInstant(false)
              setTabContentTransition(
                `opacity ${inMs}ms ease-out, transform ${inMs}ms ease-out`,
              )
              setExtraTabTranslateX(0)
              setExtraTabOpacity(1)
            })
          })
        }, tabCrossOutMs)
        return () => clearTimeout(t)
      }
      return
    }

    if (isExtraTela(prev)) {
      setOverlayFadeMode('out')
      setPainelExtraOpaco(false)
      setPainelExtraOcultoParaMapa(true)
      return undefined
    }

    return undefined
  }, [telaAtiva, tabCrossOutMs, reducedMotion])

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
            style={{
              backgroundColor: '#0D0D0C',
              opacity: painelExtraOcultoParaMapa ? 0 : 1,
              visibility: painelExtraOcultoParaMapa ? 'hidden' : 'visible',
              pointerEvents: painelExtraOcultoParaMapa ? 'none' : 'auto',
            }}
            aria-hidden={painelExtraOcultoParaMapa}
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
                  transform:
                    reducedMotion || extraTabTranslateX === 0
                      ? 'translateX(0)'
                      : `translateX(${extraTabTranslateX}px)`,
                  transition: tabLayerInstant ? 'none' : tabContentTransition,
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
