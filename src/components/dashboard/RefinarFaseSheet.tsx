import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { RadarFiltros } from '../../lib/radar/api'
import { contarPorFase } from '../../lib/radar/api'
import { FASES_CANONICAS } from '../../lib/radar/fasesCanonicas'

const SHEET_WIDTH = 480
const ANIM_OPEN_MS = 300
const ANIM_CLOSE_MS = 260
const EASE_SLIDE_IN = 'cubic-bezier(0.32, 0.72, 0, 1)'
const EASE_SLIDE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'

const GRUPO_ORDER = [
  'Disponibilidade',
  'Pesquisa',
  'Lavra',
  'Licenciamento',
  'Garimpeira',
] as const

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

export interface RefinarFaseSheetProps {
  /** Lista base (subst., UF, perfil…) — não incluir filtro de fase aplicado pelo utilizador (`fases: null`). */
  filtrosBase: RadarFiltros
  proFases: string[]
  open: boolean
  onApply: (fases: string[]) => void
  onClose: () => void
  reducedMotion?: boolean
  onVoltarWizard: () => void
}

export function RefinarFaseSheet({
  filtrosBase,
  proFases,
  open,
  onApply,
  onClose,
  reducedMotion = false,
  onVoltarWizard,
}: RefinarFaseSheetProps) {
  const [draft, setDraft] = useState<string[]>(() => (proFases.length > 0 ? [...proFases] : []))
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [counts, setCounts] = useState<Map<string, number> | null>(null)
  const [countsError, setCountsError] = useState<string | null>(null)
  const [loadCounts, setLoadCounts] = useState(false)
  const [expandedGrupo, setExpandedGrupo] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GRUPO_ORDER.map((g) => [g, true])),
  )

  /** Draft inicial via `useState`; o parent usa `key` com contador incremental a cada abertura (RadarDashboard). */

  useEffect(() => {
    let cancelled = false
    let rafOpen1 = 0
    let rafOpen2 = 0
    let closeT = 0
    queueMicrotask(() => {
      if (cancelled) return
      if (open) {
        setVisible(false)
        setMounted(true)
        rafOpen1 = window.requestAnimationFrame(() => {
          rafOpen2 = window.requestAnimationFrame(() => {
            if (!cancelled) setVisible(true)
          })
        })
      } else {
        setVisible(false)
        closeT = window.setTimeout(
          () => {
            if (!cancelled) setMounted(false)
          },
          reducedMotion ? 0 : ANIM_CLOSE_MS,
        )
      }
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafOpen1)
      if (rafOpen2) window.cancelAnimationFrame(rafOpen2)
      window.clearTimeout(closeT)
    }
  }, [open, reducedMotion])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previo
    }
  }, [open])

  const baseSemFases = useMemo(
    (): RadarFiltros => ({
      ...filtrosBase,
      fases: undefined,
    }),
    [filtrosBase],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCountsError(null)
      setCounts(null)
      setLoadCounts(true)
      void contarPorFase(baseSemFases)
        .then((map) => {
          if (!cancelled) setCounts(map)
        })
        .catch((e: unknown) => {
          if (!cancelled)
            setCountsError(
              e instanceof Error ? e.message : 'Falha ao carregar contagens por fase.',
            )
        })
        .finally(() => {
          if (!cancelled) setLoadCounts(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [open, baseSemFases])

  const countFor = useCallback(
    (value: string): number => {
      if (!counts) return 0
      return counts.get(value) ?? 0
    },
    [counts],
  )

  const isAtiva = useCallback((value: string) => countFor(value) > 0, [countFor])

  const grupoParaFases = useMemo(() => {
    const m = new Map<string, typeof FASES_CANONICAS>()
    for (const g of GRUPO_ORDER) m.set(g, [])
    for (const it of FASES_CANONICAS) {
      const lista = m.get(it.grupo) ?? []
      lista.push(it)
      m.set(it.grupo, lista)
    }
    return m
  }, [])

  const seleçõesCountTotal = useMemo(() => {
    return draft.reduce((s, key) => s + Math.max(0, countFor(key)), 0)
  }, [draft, countFor])

  const toggleFase = useCallback((value: string) => {
    if (!isAtiva(value)) return
    setDraft((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    )
  }, [isAtiva])

  const seleccionarTodosGrupo = useCallback(
    (grupo: (typeof GRUPO_ORDER)[number]) => {
      const itens = grupoParaFases.get(grupo) ?? []
      const ativas = itens.filter((it) => isAtiva(it.value)).map((it) => it.value)
      if (ativas.length === 0) return
      setDraft((prev) => {
        const set = new Set(prev)
        for (const k of ativas) set.add(k)
        return [...set]
      })
    },
    [grupoParaFases, isAtiva],
  )

  const limparSelecao = useCallback(() => setDraft([]), [])

  const handleApply = useCallback(() => {
    const elegiveis = new Set<string>()
    for (const it of FASES_CANONICAS) {
      if (isAtiva(it.value)) elegiveis.add(it.value)
    }
    const filtrado = draft.filter((x) => elegiveis.has(x))
    onApply(filtrado)
  }, [draft, onApply, isAtiva])

  if (!mounted) return null

  const openMs = reducedMotion ? 0 : ANIM_OPEN_MS
  const closeMs = reducedMotion ? 0 : ANIM_CLOSE_MS
  const transitionMs = visible ? openMs : closeMs
  const translateFn = (pct: string) => `translate3d(${pct}, 0, 0)`
  const transformStyle = visible ? translateFn('0') : translateFn('100%')
  const slideEasing = visible ? EASE_SLIDE_IN : EASE_SLIDE_OUT

  const contagensGlobalmenteVazias = counts !== null && counts.size === 0

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(13,13,12,0.5)',
          opacity: visible ? 1 : 0,
          transition: reducedMotion
            ? 'none'
            : `opacity ${transitionMs}ms ${visible ? 'ease-out' : EASE_SLIDE_OUT}`,
          zIndex: 100,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Refinar fase do processo"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: SHEET_WIDTH,
          maxWidth: '100vw',
          background: '#0d0d0c',
          borderLeft: '1px solid #2C2C2A',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.4)',
          transform: transformStyle,
          willChange: reducedMotion ? undefined : 'transform',
          transition: reducedMotion ? 'none' : `transform ${transitionMs}ms ${slideEasing}`,
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '24px 24px 16px 24px',
            borderBottom: '1px solid #1f1f1f',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#F1EFE8' }}>
              Refinar fase do processo
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888780',
                fontSize: 22,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
            >
              <X size={20} />
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888780' }}>
            Selecione uma ou mais fases.
          </p>
        </header>

        <div
          className="scrollbar-thin-auto"
          style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}
        >
          {loadCounts ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ opacity: reducedMotion ? 1 : 0.75 }}>
                  <div
                    style={{
                      height: 12,
                      width: `${60 + ((i * 23) % 40)}%`,
                      backgroundColor: '#1f1f1f',
                      borderRadius: 6,
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ height: 34, borderRadius: 8, backgroundColor: '#131313' }} />
                    <div style={{ height: 34, borderRadius: 8, backgroundColor: '#131313' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : countsError ? (
            <p style={{ margin: 0, fontSize: 14, color: '#f87171' }}>{countsError}</p>
          ) : contagensGlobalmenteVazias ? (
            <div style={{ padding: '24px 0' }}>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#B4B2A9', lineHeight: 1.55 }}>
                Nenhuma fase corresponde aos filtros atuais. Volte ao assistente e ajuste critérios.
              </p>
              <button
                type="button"
                onClick={() => {
                  onVoltarWizard()
                  onClose()
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid #EF9F27',
                  color: '#EF9F27',
                  background: 'transparent',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Voltar ao assistente
              </button>
            </div>
          ) : (
            GRUPO_ORDER.map((grupo) => {
              const itens = grupoParaFases.get(grupo) ?? []
              if (itens.length === 0) return null
              const exp = expandedGrupo[grupo] ?? true
              const temAtivas = itens.some((it) => isAtiva(it.value))

              return (
                <section key={grupo} style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      className={cn(reducedMotion ? '' : 'transition-colors')}
                      onClick={() =>
                        setExpandedGrupo((p) => ({ ...p, [grupo]: !exp }))
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'none',
                        border: 'none',
                        color: '#D3D1C7',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      aria-expanded={exp}
                    >
                      {exp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      {grupo}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {temAtivas ? (
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF9F27',
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          onClick={() => seleccionarTodosGrupo(grupo)}
                        >
                          Selecionar todas
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {exp ? (
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                      {itens.map((item) => {
                        const cnt = countFor(item.value)
                        const ok = cnt > 0
                        const checked = draft.includes(item.value)

                        return (
                          <li
                            key={item.value}
                            style={{
                              opacity: ok ? 1 : 0.4,
                              pointerEvents: ok ? 'auto' : 'none',
                              marginBottom: 8,
                            }}
                          >
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                cursor: ok ? 'pointer' : 'default',
                                fontSize: 13,
                                color: ok ? '#E4E4E0' : '#888780',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!ok}
                                onChange={() => toggleFase(item.value)}
                                style={{ accentColor: '#EF9F27', width: 18, height: 18 }}
                              />
                              <span style={{ flex: 1 }}>{item.label}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#888780' }}>
                                {ok ? cnt.toLocaleString('pt-BR') : '—'}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </section>
              )
            })
          )}
        </div>

        <footer
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1f1f1f',
            background: '#0d0d0c',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid #2C2C2A',
                color: '#B4B2A9',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
              }}
              onClick={limparSelecao}
            >
              Limpar seleção
            </button>
            <button
              type="button"
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                color: '#888780',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Cancelar
            </button>
            {!loadCounts ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#B4B2A9',
                  textAlign: 'right',
                  maxWidth: '100%',
                }}
              >
                <strong style={{ fontWeight: 600, color: '#F1EFE8' }}>{draft.length}</strong>{' '}
                selecionada
                {draft.length === 1 ? '' : 's'} (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {seleçõesCountTotal.toLocaleString('pt-BR')}
                </span>{' '}
                resultados)
              </p>
            ) : null}
            <button
              type="button"
              style={{
                padding: '8px 20px',
                background: loadCounts || countsError ? '#4a4a48' : '#EF9F27',
                color: '#0D0D0C',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loadCounts || countsError ? 'not-allowed' : 'pointer',
              }}
              disabled={!!countsError || loadCounts}
              onClick={handleApply}
            >
              Aplicar
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}
