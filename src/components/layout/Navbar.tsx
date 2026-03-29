import { useAppStore } from '../../store/useAppStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { motionMs } from '../../lib/motionDurations'

export function Navbar() {
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const setTelaAtiva = useAppStore((s) => s.setTelaAtiva)
  const reducedMotion = usePrefersReducedMotion()

  const linkMapa = telaAtiva === 'mapa'
  const linkIntel = telaAtiva === 'inteligencia'
  const linkRadar = telaAtiva === 'radar'

  const underlineTransition = `opacity ${motionMs(150, reducedMotion)}ms ease`

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between border-b border-dark-border bg-dark-primary px-4"
      style={{ height: 48 }}
    >
      <a href="/" className="flex items-center gap-2" aria-label="Terrae">
        <img
          src="/terradar-navbar-dark.png"
          alt=""
          width={200}
          height={32}
          className="block shrink-0"
          style={{
            width: 200,
            height: 32,
            objectFit: 'contain',
            objectPosition: 'left center',
          }}
        />
      </a>
      <nav className="flex items-center gap-[28px] text-[14px] tracking-wide">
        <button
          type="button"
          onClick={() => setTelaAtiva('mapa')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 font-normal transition-[color_150ms_ease] ${
            linkMapa
              ? 'text-[#F1EFE8]'
              : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
        >
          Mapa
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{ opacity: linkMapa ? 1 : 0, transition: underlineTransition }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => setTelaAtiva('radar')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 font-normal transition-[color_150ms_ease] ${
            linkRadar
              ? 'text-[#F1EFE8]'
              : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
        >
          Radar
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{ opacity: linkRadar ? 1 : 0, transition: underlineTransition }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => setTelaAtiva('inteligencia')}
          className={`relative cursor-pointer border-0 bg-transparent px-0 pb-[3px] pt-0 font-normal transition-[color_150ms_ease] ${
            linkIntel
              ? 'text-[#F1EFE8]'
              : 'text-[#888780] hover:text-[#B4B2A9]'
          }`}
        >
          Inteligência
          <span
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
            style={{ opacity: linkIntel ? 1 : 0, transition: underlineTransition }}
            aria-hidden
          />
        </button>
      </nav>
    </header>
  )
}
