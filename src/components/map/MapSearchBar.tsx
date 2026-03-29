import { Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMapStore } from '../../store/useMapStore'

const NUMERO_RX = /\d{3}\.\d{3}\/\d{4}/

type MapSearchBarProps = {
  painelFiltrosAberto: boolean
  onTogglePainelFiltros: () => void
  filtrosAlteradosCount: number
  modoRisco: boolean
  onToggleModoRisco: () => void
}

export function MapSearchBar({
  painelFiltrosAberto,
  onTogglePainelFiltros,
  filtrosAlteradosCount,
  modoRisco,
  onToggleModoRisco,
}: MapSearchBarProps) {
  const searchQuery = useMapStore((s) => s.filtros.searchQuery)
  const [local, setLocal] = useState(searchQuery)
  const [inputFocado, setInputFocado] = useState(false)
  const [badgePulse, setBadgePulse] = useState(false)
  const prevFiltrosCountRef = useRef<number | null>(null)
  const setFiltro = useMapStore((s) => s.setFiltro)
  const processos = useMapStore((s) => s.processos)
  const requestFlyTo = useMapStore((s) => s.requestFlyTo)

  useEffect(() => {
    setLocal(searchQuery)
  }, [searchQuery])

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

  const onChange = (v: string) => {
    setLocal(v)
    setFiltro('searchQuery', v)
  }

  const tryFlyToNumero = useCallback(() => {
    const m = local.match(NUMERO_RX)
    if (!m) return
    const alvo = processos.find((p) => p.numero.replace(/\s/g, '') === m[0].replace(/\s/g, ''))
    if (alvo) requestFlyTo(alvo.lat, alvo.lng, 10)
  }, [local, processos, requestFlyTo])

  return (
    <div
      className="group pointer-events-auto relative box-border flex h-12 w-[min(680px,50vw)] min-w-[min(600px,100%)] max-w-[100%] shrink-0 items-center rounded-[24px] border border-solid px-0"
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
        style={{ borderRight: '1px solid #3a3a38', paddingLeft: 12, paddingRight: 12 }}
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
      <Search
        size={18}
        strokeWidth={2}
        className="ml-3 shrink-0 text-[#888780]"
        aria-hidden
      />
      <input
        type="search"
        value={local}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setInputFocado(true)}
        onBlur={() => setInputFocado(false)}
        onKeyDown={(e) => e.key === 'Enter' && tryFlyToNumero()}
        placeholder="Buscar endereço, cidade, estado ou número do processo..."
        className="min-w-0 flex-1 border-0 bg-transparent pl-3 text-[15px] text-[#F1EFE8] outline-none placeholder:text-[15px] placeholder:text-[#5F5E5A]"
      />
      <div
        className="flex h-full shrink-0 items-center justify-center self-stretch"
        style={{ borderLeft: '1px solid #3a3a38', paddingLeft: 16, paddingRight: 20 }}
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
  )
}
