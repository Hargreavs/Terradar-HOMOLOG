import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { SubstanciasResponse, SubstanciaItem } from '../../lib/radar/api'
import { TODAS_SUBST } from '../../lib/substancias'
import { labelFamilia } from '../../lib/radar/familias'

const SHEET_WIDTH = 480
const ANIM_OPEN_MS = 300
const ANIM_CLOSE_MS = 260
const EASE_SLIDE_IN = 'cubic-bezier(0.32, 0.72, 0, 1)'
const EASE_SLIDE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

function substanciaPillLabel(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export interface RefinarSubstanciaSheetProps {
  /** Catálogo de substâncias (de listarSubstanciasDisponiveis) */
  catalog: SubstanciasResponse | null
  /** Estado atual do filtro aplicado (canônicas) */
  proSubst: string[]
  /** True quando deve estar visível */
  open: boolean
  /** Aplicar o filtro novo. Recebe o array final canônico. */
  onApply: (novasSubstanciasCanonicas: string[]) => void
  /** Fechar sem aplicar (Cancelar, ESC) */
  onClose: () => void
  /** Indica se animações devem ser desabilitadas */
  reducedMotion?: boolean
}

export function RefinarSubstanciaSheet({
  catalog,
  proSubst,
  open,
  onApply,
  onClose,
  reducedMotion = false,
}: RefinarSubstanciaSheetProps) {
  const [draft, setDraft] = useState<string[]>(proSubst)
  const [query, setQuery] = useState('')
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  /** Medir o `<aside>` após commit React (fallback quando rAF era cedo demais). */
  const asideRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(proSubst)
      setQuery('')
    }
  }, [open, proSubst])

  useEffect(() => {
    let cancelled = false
    let rafOpen1 = 0
    let rafOpen2 = 0
    let closeT = 0
    // Igual ao RefinarFaseSheet: espera terminar commit/pinte intermédio antes de RAF,
    // evitando omitir CSS transition quando o primeiro frame já aparece na posição final.
    queueMicrotask(() => {
      if (cancelled) return
      if (open) {
        setVisible(false)
        setMounted(true)
        if (reducedMotion) {
          setVisible(true)
          return
        }
        rafOpen1 = window.requestAnimationFrame(() => {
          // Força reflow com o transform em translate(100%) já aplicado antes de iniciar entrada.
          void asideRef.current?.offsetHeight
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

  const qNorm = useMemo(() => normalizeForSearch(query.trim()), [query])
  const searching = qNorm.length > 0

  const allItems = useMemo(() => {
    if (!catalog) return [] as SubstanciaItem[]
    const map = new Map<string, SubstanciaItem>()
    for (const it of catalog.criticas) map.set(it.substancia, it)
    for (const fam of catalog.porFamilia) {
      for (const s of fam.substancias) {
        if (!map.has(s.substancia)) map.set(s.substancia, { ...s, familia: fam.familia })
      }
    }
    return [...map.values()]
  }, [catalog])

  const searchMatches = useMemo(() => {
    if (!searching) return []
    return allItems.filter((it) => normalizeForSearch(it.substancia).includes(qNorm))
  }, [allItems, searching, qNorm])

  const sortedFamilias = useMemo(() => {
    if (!catalog) return []
    return [...catalog.porFamilia].sort((a, b) => b.qtd - a.qtd)
  }, [catalog])

  useEffect(() => {
    if (!catalog) return
    if (searching) {
      setOpenFamilies(Object.fromEntries(sortedFamilias.map((f) => [f.familia, true] as const)))
    } else {
      setOpenFamilies(Object.fromEntries(sortedFamilias.map((f) => [f.familia, false] as const)))
    }
  }, [searching, catalog, sortedFamilias])

  const todasAtivas = draft.includes(TODAS_SUBST)

  const isSelecionada = useCallback(
    (substancia: string): boolean => {
      if (todasAtivas) return true
      return draft.includes(substancia)
    },
    [draft, todasAtivas],
  )

  const togglePill = useCallback((substancia: string) => {
    setDraft((prev) => {
      if (prev.includes(TODAS_SUBST)) {
        return [substancia]
      }
      if (prev.includes(substancia)) {
        return prev.filter((s) => s !== substancia)
      }
      return [...prev, substancia]
    })
  }, [])

  const removerDraft = useCallback((substancia: string) => {
    setDraft((prev) => prev.filter((s) => s !== substancia))
  }, [])

  const limparTudo = useCallback(() => {
    setDraft([])
  }, [])

  const toggleFamilia = useCallback((famKey: string) => {
    setOpenFamilies((prev) => ({ ...prev, [famKey]: !prev[famKey] }))
  }, [])

  const handleApply = useCallback(() => {
    if (draft.includes(TODAS_SUBST)) {
      onApply([TODAS_SUBST])
      return
    }
    onApply(draft.filter((s) => s !== TODAS_SUBST))
  }, [draft, onApply])

  if (!mounted) return null

  const openMs = reducedMotion ? 0 : ANIM_OPEN_MS
  const closeMs = reducedMotion ? 0 : ANIM_CLOSE_MS
  const transitionMs = visible ? openMs : closeMs
  const translateFn = (pct: string) => `translate3d(${pct}, 0, 0)`
  const transformStyle = visible ? translateFn('0') : translateFn('100%')
  const slideEasing = visible ? EASE_SLIDE_IN : EASE_SLIDE_OUT

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
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Refinar substância"
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
              Refinar substância
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
            Selecione uma categoria ou busque uma substância específica.
          </p>

          <div style={{ position: 'relative', marginTop: 16 }}>
            <input
              type="text"
              placeholder="Buscar por nome (ex: Lítio, Caulim, Diatomita)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%',
                background: '#131313',
                border: '1px solid #2C2C2A',
                color: '#F1EFE8',
                padding: '10px 36px 10px 14px',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#888780',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </header>

        <div
          className="scrollbar-thin-auto"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          {!catalog ? (
            <p style={{ fontSize: 13, color: '#888780' }}>Carregando catálogo de substâncias…</p>
          ) : searching ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {searchMatches.length === 0 ? (
                <p style={{ fontSize: 13, color: '#888780' }}>
                  Nenhuma substância encontrada para &quot;{query}&quot;.
                </p>
              ) : (
                searchMatches.map((it) => {
                  const sel = isSelecionada(it.substancia)
                  return (
                    <button
                      key={it.substancia}
                      type="button"
                      onClick={() => togglePill(it.substancia)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all',
                        sel
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-100'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700',
                      )}
                    >
                      {substanciaPillLabel(it.substancia)}
                    </button>
                  )
                })
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {sortedFamilias.map((fam) => {
                const aberta = openFamilies[fam.familia] === true
                return (
                  <div
                    key={fam.familia}
                    style={{ borderBottom: '1px solid rgba(44,44,42,0.5)' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFamilia(fam.familia)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 0',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F1EFE8' }}>
                        <ChevronRight
                          size={16}
                          style={{
                            color: '#888780',
                            transform: aberta ? 'rotate(90deg)' : 'none',
                            transition: reducedMotion ? 'none' : 'transform 0.15s ease',
                          }}
                          aria-hidden
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{labelFamilia(fam.familia)}</span>
                      </span>
                      <span style={{ fontSize: 12, color: '#888780', fontVariantNumeric: 'tabular-nums' }}>
                        {fam.substancias.length}{' '}
                        {fam.substancias.length === 1 ? 'substância' : 'substâncias'}
                      </span>
                    </button>
                    {aberta ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          paddingLeft: 22,
                          paddingBottom: 12,
                        }}
                      >
                        {fam.substancias.map((it) => {
                          const sel = isSelecionada(it.substancia)
                          return (
                            <button
                              key={`${fam.familia}-${it.substancia}`}
                              type="button"
                              onClick={() => togglePill(it.substancia)}
                              className={cn(
                                'inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-all',
                                sel
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-100'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700',
                              )}
                            >
                              {substanciaPillLabel(it.substancia)}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <footer
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #2C2C2A',
            background: '#0d0d0c',
          }}
        >
          {draft.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              {draft.length <= 6 && !draft.includes(TODAS_SUBST) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {draft.map((s) => (
                    <span
                      key={s}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-200"
                    >
                      <span>{substanciaPillLabel(s)}</span>
                      <button
                        type="button"
                        aria-label={`Remover ${s}`}
                        onClick={() => removerDraft(s)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#888780',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#D3D1C7' }}>
                    {draft.includes(TODAS_SUBST)
                      ? 'Todas as substâncias'
                      : `${draft.length} substâncias selecionadas`}
                  </span>
                  <button
                    type="button"
                    onClick={limparTudo}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888780',
                      cursor: 'pointer',
                      fontSize: 12,
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    Limpar tudo
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#888780' }}>
              {draft.length > 0
                ? draft.includes(TODAS_SUBST)
                  ? 'Filtro: todas'
                  : `${draft.length} ${draft.length === 1 ? 'selecionada' : 'selecionadas'}`
                : 'Nenhuma selecionada'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888780',
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '8px 12px',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  background: '#EF9F27',
                  color: '#0D0D0C',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </footer>
      </aside>
    </>
  )
}
