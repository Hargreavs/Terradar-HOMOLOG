import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { mapDbRowToMapProcesso } from '../../lib/mapProcessoFromDbRow'
import {
  buscarProcessoPorNumero,
  buscarProcessos,
  pushSearchHistory,
  readSearchHistory,
} from '../../lib/processoApi'
import { REGIME_COLORS, REGIME_LABELS } from '../../lib/regimes'
import { useMapStore } from '../../store/useMapStore'
import type { Processo } from '../../types'
import type { ResultadoBuscaItem } from '../../types/busca'

const MAX_SUGESTOES = 20

function digitos(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Converte entradas como `860232/1990`, `8602321990` ou `860.232/1990`
 * para o formato canônico ANM `NNN.NNN/AAAA` (usado no banco e na API).
 */
function normalizarNumeroANM(input: string): string | null {
  const t = input.trim()
  if (/^\d{3}\.\d{3}\/\d{4}$/.test(t)) return t
  const d = digitos(t)
  if (d.length !== 10) return null
  return `${d.slice(0, 3)}.${d.slice(3, 6)}/${d.slice(6)}`
}

/**
 * Máscara progressiva do número ANM (NNN.NNN/AAAA) aplicada ao input.
 * Só formata quando a string inteira for composta apenas por dígitos,
 * pontos ou barras — assim preserva buscas por endereço, cidade ou estado.
 * Trunca em 10 dígitos (tamanho máximo do número ANM).
 */
function formatarInputANM(raw: string): string {
  if (!raw) return raw
  if (!/^[\d./\-]+$/.test(raw)) return raw
  const d = raw.replace(/\D/g, '')
  // >10 dígitos: CNPJ ou algo não-ANM. Desmascarar: retornar só dígitos
  // (remove pontos/barras residuais de máscaras aplicadas em keystrokes
  // anteriores quando o usuário ainda estava abaixo de 10 dígitos).
  if (d.length > 10) return d
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}/${d.slice(6, 10)}`
}

/**
 * Mapeia posição do cursor do texto cru (o que o usuário digitou) para
 * o texto formatado, preservando a quantidade de dígitos à esquerda.
 */
function mapCursorPos(
  raw: string,
  formatted: string,
  rawCursor: number,
): number {
  let digitsBefore = 0
  const lim = Math.min(rawCursor, raw.length)
  for (let i = 0; i < lim; i++) {
    if (/\d/.test(raw.charAt(i))) digitsBefore++
  }
  let out = 0
  let seen = 0
  while (out < formatted.length && seen < digitsBefore) {
    if (/\d/.test(formatted.charAt(out))) seen++
    out++
  }
  return out
}

function filtrarSugestoesPorNumero(
  processos: Processo[],
  local: string,
): Processo[] {
  const q = digitos(local)
  if (q.length < 1) return []
  const out = processos.filter((p) => digitos(p.numero).includes(q))
  out.sort((a, b) =>
    a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }),
  )
  return out.slice(0, MAX_SUGESTOES)
}

type MapSearchBarProps = {
  painelFiltrosAberto: boolean
  onTogglePainelFiltros: () => void
  filtrosAlteradosCount: number
  modoRisco: boolean
  onToggleModoRisco: () => void
  /**
   * Abre o drawer do relatório pra um processo resolvido pela busca
   * remota (CNPJ/titular). Necessário porque processos sem geom não têm
   * polígono pra clicar no mapa → não há popup → sem este callback não
   * existiria caminho pra abrir o drawer. Injetado pelo MapView para
   * reusar a mesma lógica de enrichment do caminho popup→relatório.
   */
  onAbrirRelatorio?: (
    p: Processo,
    aba?: 'processo' | 'risco',
  ) => Promise<void>
}

export function MapSearchBar({
  painelFiltrosAberto,
  onTogglePainelFiltros,
  filtrosAlteradosCount,
  modoRisco,
  onToggleModoRisco,
  onAbrirRelatorio,
}: MapSearchBarProps) {
  const searchQuery = useMapStore((s) => s.filtros.searchQuery)
  const [local, setLocal] = useState(searchQuery)
  const [inputFocado, setInputFocado] = useState(false)
  const [badgePulse, setBadgePulse] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [buscandoRemoto, setBuscandoRemoto] = useState(false)
  const [historico, setHistorico] = useState<string[]>(() =>
    readSearchHistory(),
  )
  const [feedbackErro, setFeedbackErro] = useState<string | null>(null)
  const [remoteResultados, setRemoteResultados] = useState<
    ResultadoBuscaItem[]
  >([])
  const [remoteTotal, setRemoteTotal] = useState(0)
  const [remoteTipo, setRemoteTipo] = useState<
    'numero' | 'cnpj' | 'titular' | 'vazio'
  >('vazio')
  const [preloadLoading, setPreloadLoading] = useState(false)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFiltrosCountRef = useRef<number | null>(null)
  const preloadAbortRef = useRef<AbortController | null>(null)
  const preloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useRef(
    `map-search-sugestoes-${Math.random().toString(36).slice(2, 9)}`,
  ).current

  const setFiltro = useMapStore((s) => s.setFiltro)
  const processos = useMapStore((s) => s.processos)
  const adicionarProcesso = useMapStore((s) => s.adicionarProcesso)
  const requestFlyTo = useMapStore((s) => s.requestFlyTo)
  const selecionarProcesso = useMapStore((s) => s.selecionarProcesso)

  const sugestoes = useMemo(
    () => filtrarSugestoesPorNumero(processos, local),
    [processos, local],
  )

  const mostrarBuscaRemota =
    sugestoes.length === 0 &&
    remoteResultados.length === 0 &&
    normalizarNumeroANM(local) !== null &&
    !preloadLoading

  const showHistorico =
    inputFocado &&
    local.trim() === '' &&
    historico.length > 0 &&
    !mostrarBuscaRemota &&
    remoteResultados.length === 0

  const listaItemsCount = showHistorico
    ? historico.length
    : sugestoes.length +
      remoteResultados.length +
      (mostrarBuscaRemota ? 1 : 0)

  const listaVisivel =
    inputFocado &&
    ((sugestoes.length > 0 && digitos(local).length >= 1) ||
      remoteResultados.length > 0 ||
      mostrarBuscaRemota ||
      showHistorico)

  const recordSearch = useCallback((numero: string) => {
    pushSearchHistory(numero)
    setHistorico(readSearchHistory())
  }, [])

  const showFeedback = useCallback((msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedbackErro(msg)
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackErro(null)
      feedbackTimerRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    setLocal(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (listaItemsCount === 0) {
      if (highlightIdx !== -1) setHighlightIdx(-1)
      return
    }
    const max = listaItemsCount - 1
    if (highlightIdx > max) setHighlightIdx(max)
  }, [highlightIdx, listaItemsCount])

  useEffect(() => {
    if (prevFiltrosCountRef.current === null) {
      prevFiltrosCountRef.current = filtrosAlteradosCount
      return
    }
    if (prevFiltrosCountRef.current !== filtrosAlteradosCount) {
      prevFiltrosCountRef.current = filtrosAlteradosCount
      setBadgePulse(true)
      const t = window.setTimeout(() => setBadgePulse(false), 300)
      return () => clearTimeout(t)
    }
  }, [filtrosAlteradosCount])

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      if (preloadDebounceRef.current) clearTimeout(preloadDebounceRef.current)
      if (preloadAbortRef.current) preloadAbortRef.current.abort()
    },
    [],
  )

  /**
   * Pré-busca remota multi-canal (número / CNPJ / titular) via /api/processo/search.
   * Aborta e debounça; só roda se input >= 2 chars e não há sugestões locais.
   */
  useEffect(() => {
    if (preloadAbortRef.current) preloadAbortRef.current.abort()
    if (preloadDebounceRef.current) clearTimeout(preloadDebounceRef.current)

    const q = local.trim()

    if (q.length < 2) {
      setRemoteResultados([])
      setRemoteTotal(0)
      setRemoteTipo('vazio')
      setPreloadLoading(false)
      return
    }

    if (sugestoes.length > 0) {
      setRemoteResultados([])
      setRemoteTotal(0)
      setRemoteTipo('vazio')
      setPreloadLoading(false)
      return
    }

    preloadDebounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      preloadAbortRef.current = controller
      setPreloadLoading(true)

      try {
        const resp = await buscarProcessos(q, controller.signal)
        if (controller.signal.aborted) return

        if (resp.ok) {
          setRemoteResultados(resp.data)
          setRemoteTotal(resp.total)
          setRemoteTipo(resp.tipo)
        } else {
          setRemoteResultados([])
          setRemoteTotal(0)
          setRemoteTipo('vazio')
        }
      } catch (e) {
        if (!(e instanceof Error) || e.name !== 'AbortError') {
          console.error('[MapSearchBar] Erro na busca remota:', e)
        }
        setRemoteResultados([])
        setRemoteTotal(0)
        setRemoteTipo('vazio')
      } finally {
        if (!controller.signal.aborted) setPreloadLoading(false)
      }
    }, 350)

    return () => {
      if (preloadDebounceRef.current) clearTimeout(preloadDebounceRef.current)
      if (preloadAbortRef.current) preloadAbortRef.current.abort()
    }
  }, [local, sugestoes.length])

  const onChange = (v: string) => {
    setLocal(v)
    setFiltro('searchQuery', v)
    setHighlightIdx(-1)
    if (feedbackErro) setFeedbackErro(null)
  }

  const buscarRemoto = useCallback(
    async (numero: string) => {
      const canon = normalizarNumeroANM(numero)
      if (!canon) {
        showFeedback('Use o número completo do processo (6 dígitos + ano)')
        return
      }
      setBuscandoRemoto(true)
      try {
        const resultado = await buscarProcessoPorNumero(canon)
        if (!resultado) {
          showFeedback('Processo não encontrado no banco')
          return
        }
        // Paridade com `escolherResultadoRemoto`: aceitar processos sem geom
        // (zumbis + sem-geom não-zumbi). Sem isso, clicar num número do
        // histórico que é zumbi dispara "Processo sem geometria mapeada"
        // e o drawer nunca abre.
        const novo = mapDbRowToMapProcesso(resultado as Record<string, unknown>, {
          permitirSemGeom: true,
        })
        if (!novo) {
          showFeedback('Processo inválido')
          return
        }
        const existente = useMapStore
          .getState()
          .processos.find((p) => p.numero === novo.numero)
        const alvo = novo // API tem prioridade sobre mock
        if (existente) {
          // substitui entrada mock pela versão da API
          useMapStore.setState((s) => ({
            processos: s.processos.map((p) =>
              p.numero === novo.numero ? novo : p,
            ),
          }))
        } else {
          adicionarProcesso(novo)
        }
        selecionarProcesso(alvo)
        // Fly-to apenas quando há geom real (permitirSemGeom produz NaN
        // como sentinel). Guard com Number.isFinite para não crashar o
        // Mapbox.
        if (Number.isFinite(alvo.lat) && Number.isFinite(alvo.lng)) {
          requestFlyTo(alvo.lat, alvo.lng, 10, alvo.id)
        }
        // Abre drawer com enrichment via callback do MapView (paridade com
        // `escolherResultadoRemoto`). Fallback defensivo: se callback não foi
        // injetada, abre só o drawer (sem enrichment).
        if (onAbrirRelatorio) {
          void onAbrirRelatorio(alvo, 'processo')
        } else {
          useMapStore.getState().setRelatorioDrawerAberto(true)
        }
        recordSearch(alvo.numero)
        setFiltro('searchQuery', alvo.numero)
        setInputFocado(false)
        inputRef.current?.blur()
      } catch (err) {
        console.error('Erro na busca remota:', err)
        showFeedback('Erro ao buscar processo')
      } finally {
        setBuscandoRemoto(false)
      }
    },
    [
      adicionarProcesso,
      requestFlyTo,
      selecionarProcesso,
      setFiltro,
      showFeedback,
      recordSearch,
      onAbrirRelatorio,
    ],
  )

  const tryFlyToNumero = useCallback(() => {
    const norm = normalizarNumeroANM(local)
    if (!norm) return
    const alvo = processos.find(
      (p) =>
        p.numero.replace(/\s/g, '') === norm ||
        digitos(p.numero) === digitos(norm),
    )
    if (alvo) {
      const semGeomLocal =
        !Number.isFinite(alvo.lat) || !Number.isFinite(alvo.lng)
      selecionarProcesso(alvo)
      if (semGeomLocal) {
        // Zumbis/sem-geom já em memória não têm polígono no mapa, então o
        // drawer nunca abre "naturalmente" via popup. Precisamos abrir
        // diretamente via callback do MapView (mesma rota usada por
        // `buscarRemoto` / `escolherPorNumeroHistorico`). Sem esse guard,
        // reabrir a mesma pesquisa após fechar com o X deixa o drawer
        // fechado — o processo já está em `processos`, então o caminho
        // remoto não é invocado.
        if (onAbrirRelatorio) {
          void onAbrirRelatorio(alvo, 'processo')
        } else {
          useMapStore.getState().setRelatorioDrawerAberto(true)
        }
      } else {
        requestFlyTo(alvo.lat, alvo.lng, 10, alvo.id)
      }
      recordSearch(alvo.numero)
      setFiltro('searchQuery', alvo.numero)
      return
    }
    void buscarRemoto(local)
  }, [
    local,
    processos,
    requestFlyTo,
    selecionarProcesso,
    buscarRemoto,
    recordSearch,
    setFiltro,
    onAbrirRelatorio,
  ])

  const escolherProcesso = useCallback(
    (p: Processo) => {
      const texto = p.numero
      setLocal(texto)
      setFiltro('searchQuery', texto)
      selecionarProcesso(p)
      requestFlyTo(p.lat, p.lng, 10, p.id)
      recordSearch(p.numero)
      setHighlightIdx(-1)
      inputRef.current?.blur()
    },
    [setFiltro, requestFlyTo, selecionarProcesso, recordSearch],
  )

  /**
   * Resolve um item do `remoteResultados[]` (CNPJ/titular/número) buscando
   * o processo completo (com geom) pelo número, injetando no store e dando
   * fly-to. Mesma sequência final que `buscarRemoto`.
   */
  async function escolherResultadoRemoto(
    item: ResultadoBuscaItem,
  ): Promise<void> {
    setPreloadLoading(true)
    try {
      const dados = await buscarProcessoPorNumero(item.numero)
      if (!dados) {
        setFeedbackErro(`Processo ${item.numero} não encontrado`)
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(
          () => setFeedbackErro(null),
          3000,
        )
        return
      }

      // Busca remota aceita processos sem geom (badge "sem mapa"): drawer abre
      // com dados cadastrais/regulatórios/fiscais, sem fly-to/popup no mapa.
      const p = mapDbRowToMapProcesso(dados as Record<string, unknown>, {
        permitirSemGeom: true,
      })
      if (!p) {
        setFeedbackErro(`Processo ${item.numero} inválido`)
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(
          () => setFeedbackErro(null),
          3000,
        )
        return
      }

      const existente = useMapStore
        .getState()
        .processos.find((x) => x.numero === p.numero)
      if (existente) {
        useMapStore.setState((s) => ({
          processos: s.processos.map((x) =>
            x.numero === p.numero ? p : x,
          ),
        }))
      } else {
        adicionarProcesso(p)
      }
      selecionarProcesso(p)
      // Fly-to apenas se há geometria. Sem geom: drawer abre, mapa não move.
      // Guard com `Number.isFinite` porque `permitirSemGeom` produz NaN
      // como sentinel em lat/lng (compat com type `Processo.lat: number`).
      if (item.tem_geom && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        requestFlyTo(p.lat, p.lng, 10, p.id)
      }
      // Abre drawer com enrichment via callback do MapView (paridade com
      // caminho popup→"Ver relatório completo"). Fallback defensivo: se
      // callback não foi injetada, abre só o drawer (sem enrichment).
      if (onAbrirRelatorio) {
        void onAbrirRelatorio(p, 'processo')
      } else {
        useMapStore.getState().setRelatorioDrawerAberto(true)
      }
      recordSearch(p.numero)
      setFiltro('searchQuery', p.numero)
      setLocal(p.numero)
      setRemoteResultados([])
      setRemoteTotal(0)
      setRemoteTipo('vazio')
      setInputFocado(false)
      setHighlightIdx(-1)
      lastFetchedRef.current = null
      inputRef.current?.blur()
    } catch (e) {
      console.error('[escolherResultadoRemoto] Erro:', e)
      setFeedbackErro('Erro ao carregar processo')
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = window.setTimeout(
        () => setFeedbackErro(null),
        3000,
      )
    } finally {
      setPreloadLoading(false)
    }
  }

  const escolherPorNumeroHistorico = useCallback(
    (texto: string) => {
      const norm = normalizarNumeroANM(texto)
      const alvo = processos.find((p) => {
        if (
          norm != null &&
          p.numero.replace(/\s/g, '') === norm.replace(/\s/g, '')
        )
          return true
        if (p.numero.replace(/\s/g, '') === texto.replace(/\s/g, ''))
          return true
        return digitos(p.numero) === digitos(texto)
      })
      if (alvo) {
        // Processos zumbi/sem-geom não podem usar o caminho `escolherProcesso`
        // (só faz fly-to + select, não abre drawer). Como não têm polígono/
        // popup no mapa, precisam abrir drawer diretamente. Roteia pelo
        // mesmo caminho de `buscarRemoto` para reutilizar a sequência
        // completa (enrichment via onAbrirRelatorio).
        const semGeomLocal =
          !Number.isFinite(alvo.lat) || !Number.isFinite(alvo.lng)
        if (semGeomLocal) {
          void buscarRemoto(texto)
          return
        }
        escolherProcesso(alvo)
        return
      }
      if (normalizarNumeroANM(texto)) void buscarRemoto(texto)
    },
    [processos, escolherProcesso, buscarRemoto],
  )

  const limparBusca = useCallback(() => {
    setLocal('')
    setFiltro('searchQuery', '')
    selecionarProcesso(null)
    setHighlightIdx(-1)
    setFeedbackErro(null)
    inputRef.current?.focus()
  }, [setFiltro, selecionarProcesso])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listaVisivel) {
      if (e.key === 'Enter') tryFlyToNumero()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => {
        const max = listaItemsCount - 1
        if (max < 0) return -1
        if (i < max) return i + 1
        return 0
      })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => {
        const max = listaItemsCount - 1
        if (max < 0) return -1
        if (i <= 0) return max
        return i - 1
      })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showHistorico && historico.length > 0) {
        const pick =
          highlightIdx >= 0 && highlightIdx < historico.length
            ? historico[highlightIdx]
            : historico[0]
        escolherPorNumeroHistorico(pick)
        return
      }
      if (sugestoes.length > 0 && highlightIdx < sugestoes.length) {
        const pick =
          highlightIdx >= 0 && highlightIdx < sugestoes.length
            ? sugestoes[highlightIdx]
            : sugestoes[0]
        if (pick) escolherProcesso(pick)
        return
      }
      const localIdxLimit = sugestoes.length
      if (
        highlightIdx >= localIdxLimit &&
        highlightIdx < localIdxLimit + remoteResultados.length
      ) {
        void escolherResultadoRemoto(
          remoteResultados[highlightIdx - localIdxLimit],
        )
        return
      }
      if (remoteResultados.length > 0) {
        void escolherResultadoRemoto(remoteResultados[0])
        return
      }
      if (mostrarBuscaRemota) {
        void buscarRemoto(local)
        return
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setHighlightIdx(-1)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="pointer-events-auto relative w-[min(680px,50vw)] min-w-[min(600px,100%)] max-w-[100%] shrink-0">
      <div
        className="group relative box-border flex h-12 w-full items-center rounded-[24px] border border-solid px-0"
        style={{
          backgroundColor: 'rgba(13, 13, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: inputFocado ? '#EF9F27' : 'rgba(95, 94, 90, 0.3)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'border-color 200ms ease',
        }}
      >
        <button
          type="button"
          aria-expanded={painelFiltrosAberto}
          aria-label="Filtros do mapa"
          onClick={onTogglePainelFiltros}
          className={`relative box-border flex h-full shrink-0 cursor-pointer items-center border-0 px-3 transition-colors ${
            painelFiltrosAberto
              ? 'text-[#EF9F27] hover:text-[#EF9F27]'
              : 'text-[#888780] hover:text-[#D3D1C7]'
          }`}
          style={{
            borderRight: '1px solid #3a3a38',
            paddingLeft: 12,
            paddingRight: 12,
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
            {filtrosAlteradosCount > 0 ? (
              <span
                className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF9F27] px-1 text-[10px] font-bold leading-none text-[#0D0D0C] ${badgePulse ? 'terrae-badge-pulse' : ''}`}
                aria-hidden
              >
                {filtrosAlteradosCount > 99 ? '99+' : filtrosAlteradosCount}
              </span>
            ) : null}
          </span>
        </button>
        <div className="flex min-w-0 flex-1 items-center">
          <Search
            size={18}
            strokeWidth={2}
            className="ml-3 shrink-0 text-[#888780]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={listaVisivel}
            aria-controls={listaVisivel ? listId : undefined}
            aria-autocomplete="list"
            value={local}
            onChange={(e) => {
              const raw = e.target.value
              const rawCursor = e.target.selectionStart ?? raw.length
              const formatted = formatarInputANM(raw)
              if (formatted === raw) {
                onChange(raw)
                return
              }
              onChange(formatted)
              const newCursor = mapCursorPos(raw, formatted, rawCursor)
              requestAnimationFrame(() => {
                const el = inputRef.current
                if (el && document.activeElement === el) {
                  try {
                    el.setSelectionRange(newCursor, newCursor)
                  } catch {
                    /* inputs de tipo não-selecionável ignoram */
                  }
                }
              })
            }}
            onFocus={() => setInputFocado(true)}
            onBlur={() => {
              window.setTimeout(() => setInputFocado(false), 180)
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar endereço, cidade, estado ou número do processo..."
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent pl-3 text-[15px] text-[#F1EFE8] outline-none placeholder:text-[15px] placeholder:text-[#5F5E5A]"
          />
          {local.trim().length > 0 ? (
            <button
              type="button"
              aria-label="Limpar busca"
              onMouseDown={(e) => e.preventDefault()}
              onClick={limparBusca}
              className="mr-2 shrink-0 rounded p-0.5 text-[#888780] transition-colors hover:bg-[#2C2C2A] hover:text-[#F1EFE8]"
            >
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
        {listaVisivel ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-[min(280px,40vh)] overflow-y-auto rounded-lg border border-solid py-1 shadow-lg"
            style={{
              backgroundColor: 'rgba(22, 22, 20, 0.98)',
              borderColor: 'rgba(95, 94, 90, 0.45)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
          >
            {showHistorico ? (
              <>
                <li
                  role="presentation"
                  className="pointer-events-none px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5F5E5A]"
                >
                  Recentes
                </li>
                {historico.map((num, i) => (
                  <li key={`hist-${num}-${i}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlightIdx}
                      className={`flex w-full cursor-pointer items-center gap-2 border-0 px-3 py-2.5 text-left text-[14px] leading-normal transition-colors ${
                        i === highlightIdx
                          ? 'bg-[#2C2C2A] text-[#F1EFE8]'
                          : 'bg-transparent text-[#D3D1C7] hover:bg-[#252523]'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        escolherPorNumeroHistorico(num)
                      }}
                      onMouseEnter={() => setHighlightIdx(i)}
                    >
                      <span className="shrink-0 font-semibold tabular-nums text-[#F1EFE8]">
                        {num}
                      </span>
                    </button>
                  </li>
                ))}
              </>
            ) : (
              <>
                {sugestoes.map((p, i) => (
                  <li key={p.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlightIdx}
                      className={`flex w-full cursor-pointer items-center gap-2 border-0 px-3 py-2.5 text-left text-[14px] leading-normal transition-colors ${
                        i === highlightIdx
                          ? 'bg-[#2C2C2A] text-[#F1EFE8]'
                          : 'bg-transparent text-[#D3D1C7] hover:bg-[#252523]'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        escolherProcesso(p)
                      }}
                      onMouseEnter={() => setHighlightIdx(i)}
                    >
                      <span className="shrink-0 font-semibold tabular-nums text-[#F1EFE8]">
                        {p.numero}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#888780]">
                        {p.municipio} · {p.uf}
                      </span>
                      <span
                        className="max-w-[42%] shrink-0 truncate text-right text-[12px] font-medium"
                        style={{ color: REGIME_COLORS[p.regime] ?? '#888780' }}
                        title={REGIME_LABELS[p.regime]}
                      >
                        {REGIME_LABELS[p.regime]}
                      </span>
                    </button>
                  </li>
                ))}
                {remoteResultados.length > 0 ? (
                  <>
                    {remoteTotal > remoteResultados.length ? (
                      <li
                        role="presentation"
                        className="pointer-events-none px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#5F5E5A]"
                      >
                        {remoteTipo === 'cnpj'
                          ? 'Por CNPJ'
                          : remoteTipo === 'titular'
                            ? 'Por titular'
                            : 'Resultados'}
                        {' · '}
                        {remoteTotal} resultados · mostrando{' '}
                        {remoteResultados.length}
                      </li>
                    ) : null}
                    {remoteResultados.map((item, idx) => {
                      const listIdx = sugestoes.length + idx
                      const isHighlighted = listIdx === highlightIdx
                      const local = [item.municipio, item.uf]
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <li
                          key={`remote-${item.id}`}
                          role="presentation"
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            title={item.titular ?? item.numero}
                            className={`flex w-full cursor-pointer flex-col items-start gap-0.5 border-0 px-3 py-2 text-left leading-normal transition-colors ${
                              isHighlighted
                                ? 'bg-[#2C2C2A] text-[#F1EFE8]'
                                : 'bg-transparent text-[#D3D1C7] hover:bg-[#252523]'
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              void escolherResultadoRemoto(item)
                            }}
                            onMouseEnter={() => setHighlightIdx(listIdx)}
                          >
                            <div className="flex w-full items-center gap-2">
                              <Search
                                size={14}
                                strokeWidth={2}
                                className="shrink-0 text-[#EF9F27]"
                                aria-hidden
                              />
                              <span className="shrink-0 font-semibold tabular-nums text-[#F1EFE8]">
                                {item.numero}
                              </span>
                              {!item.tem_geom ? (
                                <span
                                  title="Processo sem georreferenciamento SIGMINE"
                                  className="shrink-0 rounded px-1.5 py-[1px] text-[10px] font-medium tracking-wide text-[#888780]"
                                  style={{
                                    background: 'rgba(136, 135, 128, 0.15)',
                                    letterSpacing: 0.2,
                                  }}
                                >
                                  sem mapa
                                </span>
                              ) : null}
                              <span className="min-w-0 flex-1 truncate text-[13px] text-[#D3D1C7]">
                                {item.titular ?? '—'}
                              </span>
                            </div>
                            <div className="w-full pl-6 text-[12px] text-[#888780]">
                              {local}
                              {item.substancia ? ` · ${item.substancia}` : ''}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </>
                ) : null}
              </>
            )}
            {mostrarBuscaRemota ? (
              (() => {
                const fallbackIdx = sugestoes.length
                const loading = buscandoRemoto || preloadLoading
                return (
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={highlightIdx === fallbackIdx}
                      disabled={loading}
                      className={`flex w-full cursor-pointer items-center gap-2 border-0 px-3 py-2.5 text-left text-[14px] leading-normal transition-colors ${
                        highlightIdx === fallbackIdx
                          ? 'bg-[#2C2C2A] text-[#F1EFE8]'
                          : 'bg-transparent text-[#D3D1C7] hover:bg-[#252523]'
                      } ${loading ? 'cursor-wait opacity-80' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!loading) void buscarRemoto(local)
                      }}
                      onMouseEnter={() => setHighlightIdx(fallbackIdx)}
                    >
                      {loading ? (
                        <Loader2
                          className="h-4 w-4 shrink-0 animate-spin text-[#EF9F27]"
                          aria-hidden
                        />
                      ) : (
                        <span className="shrink-0" aria-hidden>
                          🔍
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        {loading
                          ? 'Buscando...'
                          : `Buscar "${local.trim()}" no banco de dados`}
                      </span>
                    </button>
                  </li>
                )
              })()
            ) : null}
          </ul>
        ) : null}
        <div
          className="flex h-full shrink-0 items-center justify-center self-stretch"
          style={{
            borderLeft: '1px solid #3a3a38',
            paddingLeft: 16,
            paddingRight: 20,
          }}
        >
          <button
            type="button"
            aria-pressed={modoRisco}
            onClick={onToggleModoRisco}
            className={`cursor-pointer border-0 bg-transparent px-0 text-[14px] font-normal transition-colors ${
              modoRisco
                ? 'text-[#EF9F27]'
                : 'text-[#888780] hover:text-[#D3D1C7]'
            }`}
          >
            Risk Score
          </button>
        </div>
      </div>
      {feedbackErro ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-[calc(100%+6px)] z-[210] rounded-md border border-solid border-[rgba(226,75,74,0.45)] bg-[rgba(22,22,20,0.98)] px-3 py-2 text-center text-[13px] leading-snug text-[#E24B4A] shadow-lg"
          role="status"
        >
          {feedbackErro}
        </div>
      ) : null}
    </div>
  )
}
