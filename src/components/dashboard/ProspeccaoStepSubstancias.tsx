import { useCallback, useMemo, useState } from 'react'
import { Check, Info, X } from 'lucide-react'
import type { BlocoFamilia, FamiliasResponse, SubstanciasResponse } from '../../lib/radar/api'
import {
  CHIP_SELECTED_BG,
  CHIP_SELECTED_BORDER,
  CHIP_SELECTED_TEXT,
} from '../../lib/radar/tokens'
import { labelFamilia } from '../../lib/radar/familias'
import { TODAS_SUBST } from '../../lib/substancias'

const FAMILIAS_PRINCIPAIS = [
  'criticos_usgs',
  'metais_preciosos',
  'metais_base',
  'minerais_estrategicos',
] as const

function substanciaPillLabel(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function cx(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

/**
 * Decide se o bloco esta "selecionado" (todas suas substancias em proSubst).
 */
function isBlocoSelecionado(bloco: BlocoFamilia, proSubst: string[]): boolean {
  if (proSubst.includes(TODAS_SUBST)) return false
  if (bloco.substancias.length === 0) return false
  return bloco.substancias.every((s) => proSubst.includes(s))
}

/**
 * Lista achatada de todas as substancias canonicas (pra busca direta).
 */
function collectAllCanonicas(catalog: FamiliasResponse): string[] {
  const out = new Set<string>()
  for (const bloco of catalog.blocos) {
    for (const s of bloco.substancias) {
      out.add(s)
    }
  }
  return [...out]
}

export function ProspeccaoStepSubstancias({
  catalog: _catalog,
  catalogFamilias,
  proSubst,
  setProSubst,
}: {
  catalog: SubstanciasResponse | null
  catalogFamilias: FamiliasResponse | null
  proSubst: string[]
  setProSubst: (s: string[]) => void
}) {
  void _catalog
  const [query, setQuery] = useState('')
  const [expandido, setExpandido] = useState(false)
  const qNorm = useMemo(() => normalizeForSearch(query.trim()), [query])
  const searching = qNorm.length > 0

  const todasAtivas = proSubst.includes(TODAS_SUBST)

  const allCanonicas = useMemo(
    () => (catalogFamilias ? collectAllCanonicas(catalogFamilias) : []),
    [catalogFamilias],
  )

  const searchMatches = useMemo(() => {
    if (!searching) return []
    return allCanonicas
      .filter((s) => normalizeForSearch(s).includes(qNorm))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [searching, qNorm, allCanonicas])

  const blocosVisiveis = useMemo(() => {
    if (!catalogFamilias) return []
    if (expandido || searching) return catalogFamilias.blocos
    return catalogFamilias.blocos.filter((b) =>
      FAMILIAS_PRINCIPAIS.includes(b.chave as (typeof FAMILIAS_PRINCIPAIS)[number]),
    )
  }, [catalogFamilias, expandido, searching])

  const blocosOrdenados = useMemo(() => {
    if (expandido || searching) return blocosVisiveis
    const map = new Map(blocosVisiveis.map((b) => [b.chave, b]))
    return FAMILIAS_PRINCIPAIS.map((chave) => map.get(chave)).filter(
      (b): b is BlocoFamilia => Boolean(b),
    )
  }, [blocosVisiveis, expandido, searching])

  const toggleBloco = useCallback(
    (bloco: BlocoFamilia) => {
      if (todasAtivas) {
        setProSubst([...bloco.substancias])
        return
      }
      const todasSelecionadas = isBlocoSelecionado(bloco, proSubst)
      if (todasSelecionadas) {
        const set = new Set(proSubst)
        for (const s of bloco.substancias) {
          set.delete(s)
        }
        setProSubst([...set])
      } else {
        const set = new Set(proSubst)
        for (const s of bloco.substancias) {
          set.add(s)
        }
        setProSubst([...set])
      }
    },
    [proSubst, setProSubst, todasAtivas],
  )

  const togglePillSubstancia = useCallback(
    (substancia: string) => {
      if (todasAtivas) {
        setProSubst([substancia])
        return
      }
      if (proSubst.includes(substancia)) {
        setProSubst(proSubst.filter((s) => s !== substancia))
      } else {
        setProSubst([...proSubst, substancia])
      }
    },
    [proSubst, setProSubst, todasAtivas],
  )

  const removeSelected = useCallback(
    (substancia: string) => {
      if (substancia === TODAS_SUBST) {
        setProSubst([])
        return
      }
      setProSubst(proSubst.filter((s) => s !== substancia))
    },
    [proSubst, setProSubst],
  )

  if (!catalogFamilias) {
    return <p className="text-sm text-zinc-500">Carregando catálogo de substâncias…</p>
  }

  const nBlocosTotal = catalogFamilias.blocos.length
  const mostrarBotaoVerTodas = nBlocosTotal > FAMILIAS_PRINCIPAIS.length

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-1 border-b border-zinc-800/50 bg-zinc-950 px-1 pb-2 pt-1">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nome (ex: Lítio, Caulim, Diatomita)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2.5 pl-3.5 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            autoComplete="off"
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {searching ? (
        <div className="flex flex-col gap-2">
          {searchMatches.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {`Nenhuma substância encontrada para "${query}".`}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {searchMatches.map((s) => {
                const sel = !todasAtivas && proSubst.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={todasAtivas}
                    onClick={() => togglePillSubstancia(s)}
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all',
                      todasAtivas && 'cursor-not-allowed opacity-50',
                      sel
                        ? `${CHIP_SELECTED_BG} ${CHIP_SELECTED_BORDER} ${CHIP_SELECTED_TEXT}`
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700',
                    )}
                  >
                    {substanciaPillLabel(s)}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {blocosOrdenados.map((bloco) => {
              const isCriticos = bloco.chave === 'criticos_usgs'
              const selecionado = isBlocoSelecionado(bloco, proSubst)
              const titulo = isCriticos
                ? bloco.titulo
                : labelFamilia(bloco.chave) || bloco.titulo
              const previewNomes = bloco.preview.slice(0, 4).map((x) => substanciaPillLabel(x))
              const restoQtd = Math.max(0, bloco.qtdSubstancias - 4)
              let previewLabel: string
              if (previewNomes.length === 0) {
                previewLabel = '—'
              } else {
                previewLabel =
                  restoQtd > 0
                    ? `${previewNomes.join(', ')} +${restoQtd}`
                    : previewNomes.join(', ')
              }

              return (
                <button
                  type="button"
                  key={bloco.chave}
                  onClick={() => toggleBloco(bloco)}
                  disabled={todasAtivas}
                  className={cx(
                    'group relative flex min-h-[112px] flex-col justify-between rounded-[10px] border p-4 text-left transition-all',
                    todasAtivas && 'cursor-not-allowed opacity-50',
                    selecionado
                      ? 'border-amber-500/45 bg-amber-500/[0.06]'
                      : 'border-zinc-800/80 bg-transparent hover:border-zinc-700 hover:bg-zinc-900/40',
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cx(
                          'min-w-0 flex-1 pr-1 text-pretty text-sm font-medium leading-snug',
                          selecionado ? 'text-amber-100' : 'text-zinc-100',
                        )}
                      >
                        {titulo}
                      </span>
                      <div className="h-5 shrink-0">
                        {selecionado ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500"
                            aria-hidden
                          >
                            <Check className="h-2.5 w-2.5 text-[#0D0D0C]" strokeWidth={3} />
                          </span>
                        ) : isCriticos ? (
                          <span
                            className="inline-flex h-5 max-w-[100px] items-center gap-0.5 text-[9px] font-medium uppercase leading-none tracking-wide text-amber-400/90"
                            title="Lista USGS 2025 de minerais estratégicos para a transição energética e segurança industrial."
                          >
                            <Info size={10} className="shrink-0" aria-hidden />
                            <span>USGS 2025</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-zinc-400">
                      {previewLabel}
                    </p>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-zinc-800/50 pt-2.5 text-[11px] tabular-nums text-zinc-500">
                    <span>
                      {bloco.qtdSubstancias}{' '}
                      {bloco.qtdSubstancias === 1 ? 'substância' : 'substâncias'}
                    </span>
                    <span>{bloco.qtdOportunidades.toLocaleString('pt-BR')} oportunidades</span>
                  </div>
                </button>
              )
            })}
          </div>

          {!expandido && mostrarBotaoVerTodas ? (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="mt-1 self-start text-sm text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-200"
            >
              Ver todas as {nBlocosTotal} famílias
            </button>
          ) : null}
          {expandido && !searching ? (
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="mt-1 self-start text-sm text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-200"
            >
              Mostrar apenas as principais
            </button>
          ) : null}
        </>
      )}

      {proSubst.length > 0 ? (
        <div className="sticky bottom-0 z-10 -mx-1 mt-2 border-t border-zinc-800/80 bg-zinc-950 px-1 pb-1 pt-3">
          {todasAtivas ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
                Todas as substâncias
                <button
                  type="button"
                  aria-label="Remover Todas"
                  onClick={() => removeSelected(TODAS_SUBST)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          ) : proSubst.length <= 6 ? (
            <div className="flex flex-wrap items-center gap-2">
              {proSubst.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200"
                >
                  <span>{substanciaPillLabel(s)}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${s}`}
                    onClick={() => removeSelected(s)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-300">
                {proSubst.length} substâncias selecionadas
              </span>
              <button
                type="button"
                onClick={() => setProSubst([])}
                className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
              >
                Limpar
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
