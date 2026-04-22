/** Identificadores Mapbox; também usados no estado do MapView. */
export const MAPBOX_STYLE_SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12'
export const MAPBOX_STYLE_DARK = 'mapbox://styles/mapbox/dark-v11'
export const MAPBOX_STYLE_STREETS = 'mapbox://styles/mapbox/streets-v12'

const ESTILOS = [MAPBOX_STYLE_SATELLITE, MAPBOX_STYLE_DARK, MAPBOX_STYLE_STREETS] as const

function IconSatellite({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4Zm-9 9h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    </svg>
  )
}

/** Lua em crescente; leitura clara em fundos escuros. */
function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.25" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 1.75v4M12 18.25v4M1.75 12h4M18.25 12h4M5.4 5.4l2.83 2.83M15.77 15.77l2.83 2.83M5.4 18.6l2.83-2.83M15.77 8.23l2.83-2.83"
      />
    </svg>
  )
}

const ICONS = [IconSatellite, IconMoon, IconSun] as const

type MapStyleSwitcherProps = {
  estiloAtivo: string
  onTrocar: (identificadorEstilo: string) => void
}

export function MapStyleSwitcher({ estiloAtivo, onTrocar }: MapStyleSwitcherProps) {
  return (
    <div
      className="pointer-events-auto grid w-full min-w-0 grid-cols-3"
      style={{ gap: 6 }}
      role="toolbar"
      aria-label="Estilo do mapa"
    >
      {ESTILOS.map((id, i) => {
        const Icon = ICONS[i]
        const ativo = estiloAtivo === id

        return (
          <div key={id} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (!ativo) onTrocar(id)
              }}
              className="flex h-7 w-full min-w-0 shrink-0 cursor-pointer items-center justify-center border-0 transition-colors"
              style={{
                borderRadius: 6,
                ...(ativo
                  ? {
                      backgroundColor: '#EF9F27',
                      color: '#0D0D0C',
                    }
                  : {
                      backgroundColor: '#2C2C2A',
                      color: '#888780',
                    }),
              }}
              onMouseEnter={(e) => {
                if (ativo) return
                e.currentTarget.style.backgroundColor = '#333331'
              }}
              onMouseLeave={(e) => {
                if (ativo) return
                e.currentTarget.style.backgroundColor = '#2C2C2A'
              }}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
