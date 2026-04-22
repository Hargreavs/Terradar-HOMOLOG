# Terrae — Exportação: animações e transições (análise)

Documento gerado para desenho de um motion system. **Somente leitura do código** — nenhuma alteração na aplicação.

---

## 1. Transição entre abas (`App.tsx`)

**Nota:** Neste ficheiro **não** existem `useRef` nem `useCallback` ligados à transição do overlay; apenas `useState`, `useEffect`, `useMemo` e funções auxiliares (`readCssMs`, `readChromeDurations`).


Inclui: overlay Inteligência/Radar, fade de opacidade, `painelExtraMontado` / `painelExtraOpaco`, leitura de `--terrae-chrome-exit-ms` / `--terrae-chrome-enter-ms`, `requestAnimationFrame` e `setTimeout` na sequência de entrada/saída.

```tsx
// src/App.tsx (linhas 1–136)

import { useEffect, useMemo, useState } from 'react'
import {
  CHROME_ENTER_MS_DEFAULT,
  CHROME_EXIT_MS_DEFAULT,
  MapChromeTransitionContext,
} from './context/MapChromeTransitionContext'
import { InteligenciaDashboard } from './components/dashboard/InteligenciaDashboard'
import { RadarPlaceholder } from './components/dashboard/RadarPlaceholder'
import { MapView } from './components/map/MapView'
import { Navbar } from './components/layout/Navbar'
import { useAppStore } from './store/useAppStore'

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

export default function App() {
  const telaAtiva = useAppStore((s) => s.telaAtiva)
  const mapChromeCollapsed =
    telaAtiva === 'inteligencia' || telaAtiva === 'radar'

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

  useEffect(() => {
    if (telaAtiva === 'inteligencia' || telaAtiva === 'radar') {
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

    setPainelExtraOpaco(false)
    const t = window.setTimeout(() => {
      setPainelExtraMontado(false)
    }, chromeExitMs)
    return () => clearTimeout(t)
  }, [telaAtiva, chromeExitMs])

  const chromeCtx = useMemo(
    () => ({
      mapChromeCollapsed,
      chromeExitMs,
      chromeEnterMs,
      chromeTransitionMs,
    }),
    [mapChromeCollapsed, chromeExitMs, chromeEnterMs, chromeTransitionMs],
  )

  /** Fade do dashboard: sempre na duração da saída rápida, alinhada ao recolhimento do chrome. */
  const dashboardDur = `${chromeExitMs}ms`

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
            {/*
              Fundo opaco desde o 1.º frame; evita o mapa a aparecer por trás durante o fade.
              A opacidade anima só no conteúdo (sincronizada com a saída do chrome).
            */}
            <div
              className="box-border flex min-h-0 flex-1 flex-col overflow-hidden ease-out"
              style={{
                opacity: painelExtraOpaco ? 1 : 0,
                transitionProperty: 'opacity',
                transitionDuration: dashboardDur,
                transitionTimingFunction: 'ease-out',
              }}
            >
              {telaAtiva === 'inteligencia' ? (
                <InteligenciaDashboard />
              ) : (
                <RadarPlaceholder />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

---

## 2. `MapChromeTransitionContext`

Arquivo completo (durações default, tipo de contexto, provider implícito via `createContext`, hook `useMapChromeTransition`).

```tsx
// src/context/MapChromeTransitionContext.tsx (linhas 1–32)

import { createContext, useContext } from 'react'

/** Saída do mapa → Inteligência (mais rápida, alinhada ao fade do dashboard). */
export const CHROME_EXIT_MS_DEFAULT = 180

/** Entrada no mapa a partir da Inteligência (sidebar / overlays). */
export const CHROME_ENTER_MS_DEFAULT = 280

/** @deprecated Preferir CHROME_ENTER_MS_DEFAULT */
export const MAP_CHROME_TRANSITION_MS = CHROME_ENTER_MS_DEFAULT

export type MapChromeTransitionValue = {
  mapChromeCollapsed: boolean
  chromeExitMs: number
  chromeEnterMs: number
  /** Duração da transição do chrome neste estado (recolher = exit, expandir = enter). */
  chromeTransitionMs: number
}

const defaultValue: MapChromeTransitionValue = {
  mapChromeCollapsed: false,
  chromeExitMs: CHROME_EXIT_MS_DEFAULT,
  chromeEnterMs: CHROME_ENTER_MS_DEFAULT,
  chromeTransitionMs: CHROME_ENTER_MS_DEFAULT,
}

export const MapChromeTransitionContext =
  createContext<MapChromeTransitionValue>(defaultValue)

export function useMapChromeTransition(): MapChromeTransitionValue {
  return useContext(MapChromeTransitionContext)
}
```

**Nota:** O “sequenciamento” em tempo real (recolher vs expandir) é feito em `App.tsx` (`chromeTransitionMs`) e consumido em `MapView.tsx` (ver secção 6).

---

## 3. Animações CSS da Inteligência (`src/index.css`)

### `:root` — variáveis de chrome + `prefers-reduced-motion`

```css
/* src/index.css (linhas 4–36) */

:root {
  /* ... outras variáveis omitidas ... */

  /* Chrome do mapa: saída rápida (Mapa → Inteligência), entrada mais suave (volta). */
  --terrae-chrome-exit-ms: 180ms;
  --terrae-chrome-enter-ms: 280ms;
  --terrae-chrome-transition-ms: var(--terrae-chrome-enter-ms);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --terrae-chrome-exit-ms: 1ms;
    --terrae-chrome-enter-ms: 1ms;
  }
}
```

### `@keyframes` e classes globais relacionadas

```css
/* src/index.css (linhas 38–58) */

@keyframes terrae-badge-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}

.terrae-badge-pulse {
  animation: terrae-badge-pulse 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .terrae-badge-pulse {
    animation: none;
  }
}
```

```css
/* Exportação PDF — spinner (não específico da Inteligência, mas no mesmo ficheiro) */
/* src/index.css (linhas 387–401) */

.terrae-relatorio-pdf-export-spinner {
  /* ... */
  animation: terrae-pdf-export-spin 0.85s linear infinite;
}

@keyframes terrae-pdf-export-spin {
  to {
    transform: rotate(360deg);
  }
}
```

### Classes `.terrae-intel-*` com `transition`

```css
/* src/index.css (linhas 196–229) — scroll Inteligência: sem transition nas regras principais */

.terrae-intel-dashboard-scroll { /* scrollbar, sem transition */ }
.terrae-intel-dashboard-scroll:hover { scrollbar-color: #4a4a48 #1a1a18; }

/* src/index.css (linhas 310–368) */

.terrae-intel-hover-panel {
  box-sizing: border-box;
  border: 1px solid #2c2c2a;
  transition: border-color 0.2s ease-out;
}

.terrae-intel-hover-panel:hover {
  border-color: #888780;
}

.terrae-intel-hover-subpanel {
  box-sizing: border-box;
  border: 1px solid #2c2c2a;
  transition: border-color 0.2s ease-out;
}

.terrae-intel-hover-subpanel:hover {
  border-color: #6e6e6a;
}

.terrae-intel-stat-badge {
  transition:
    border-color 0.2s ease-out,
    box-shadow 0.2s ease-out;
}

.terrae-intel-stat-badge:hover {
  border-color: #888780;
  box-shadow: 0 0 0 1px rgba(136, 135, 128, 0.2);
}

.terrae-intel-border-interactive {
  transition: border-color 0.2s ease-out;
}

.terrae-intel-border-interactive:hover,
.terrae-intel-border-interactive:focus-visible {
  border-color: #888780 !important;
}

.terrae-intel-chart-pill-inactive {
  transition: border-color 0.2s ease-out;
}

.terrae-intel-chart-pill-inactive:hover {
  border-color: #888780 !important;
}

.terrae-intel-rank-toggle {
  border: 1px solid #2c2c2a;
  transition:
    border-color 0.2s ease-out,
    background-color 0.15s ease-out;
}

.terrae-intel-rank-toggle:hover {
  border-color: #888780;
}
```

**Outras classes `.terrae-intel-*` no ficheiro:** `.terrae-intel-busca-processos` e variantes `::placeholder` / `::-webkit-search-cancel-button` — **sem** `transition` / `animation` / `transform`.

**Mapbox popup (mapa, não dashboard):** `.terrae-processo-popup--layout-pending` usa `opacity: 0` sem transição declarada no excerto.

---

## 4. Animações inline em `InteligenciaDashboard.tsx`

### `useTransition` (React 19) — atualização de filtros

- **Secção:** estado global dos filtros do dashboard (`updateFiltros`, `limparFiltros`).
- **Linhas ~2169–2188**

```tsx
const [, startTransition] = useTransition()

const updateFiltros = useCallback((patch: ...) => {
  startTransition(() => {
    setFiltros((prev) =>
      typeof patch === 'function' ? patch(prev) : { ...prev, ...patch },
    )
  })
}, [startTransition])

const limparFiltros = useCallback(() => {
  startTransition(() => {
    setFiltros({
      periodo: { inicio: null, fim: null },
      ufs: [],
      substancias: [],
      regime: null,
    })
  })
}, [startTransition])
```

### `ChevronDown` (dropdowns) — `transform` + `transition`

- **Secção:** ícone de seta dos triggers (MonthPicker, MultiSelect).
- **Linhas ~548–579**

```tsx
style={{
  flexShrink: 0,
  color: stroke,
  transform: aberto ? 'rotate(180deg)' : undefined,
  transition: 'transform 0.15s ease-out',
}}
```

### Tooltips — `setTimeout` / `requestAnimationFrame` (efeito de atraso / posição, não CSS keyframes)

| Componente | Finalidade | Linhas (aprox.) |
|------------|------------|-----------------|
| `IntelKpiPortalTooltipProvider` | Atraso `KPI_TOOLTIP_DELAY_MS` antes de mostrar tooltip do KPI | ~710–748 |
| `InfoTooltip` | Idem para ícone de ajuda | ~903–971 |
| `TooltipHoverResumo` | Idem para hover resumo | ~1015–1082 |
| `TooltipDemandaPill` | `requestAnimationFrame` reposiciona tooltip; `setTimeout` para mostrar | ~1124–1232 |

**Constante:** `KPI_TOOLTIP_DELAY_MS = 300` (~linha 680).

**`IntelLinhaTooltip`:** sem `setTimeout`; atualiza posição em `mouseenter` / `mousemove` (~648–677).

### Opacity + `transition` inline (amostra representativa)

| Secção | Linhas (aprox.) | Notas |
|--------|-----------------|--------|
| Botão “Limpar tudo” (header filtros) | ~2808–2810 | `opacity` + `transition: opacity 0.2s, color 0.2s` |
| Badge resumo filtros | ~2832 | `transition: all 0.2s ease-out` |
| Botão ✕ das pills | ~2887 | `transition: color 0.2s ease` |
| Card “Distribuição por regime” | ~3149 | wrapper `transition: opacity 0.2s ease`; linhas usam `opacity: op` |
| Card “Processos por estado” | ~3279 | idem |
| Linhas UF + mini mapa | ~3445–3451 | `opacity` + `transition: opacity 0.15s, filter 0.15s` |
| Pills do gráfico de produção | ~3665–3669 | `opacity` 0.4 quando locked (sem transition nessa linha) |
| Empty state Minerais estratégicos | ~3801 | `transition: opacity 0.2s ease` |
| Badge “Demanda” (mineral) | ~3894 | `transition: background-color 0.15s ease-out` |
| Corpo Ranking (vazio / com dados) | ~4074–4076 | `transition: opacity 0.2s ease` |
| Linha ranking (titular selecionado) | ~4173 | `opacity: temTit && !sel ? 0.5 : 1` (sem transition nesta linha) |
| Caixa de busca tabela | ~4359 | `transition: border-color 0.2s ease` |
| Ícone lupa | ~4373 | `transition: opacity 0.2s ease` |
| Exportar CSV | ~4459 | `opacity` estática |
| Wrapper tabela | ~4495, ~4501 | `transition: opacity 0.2s ease` |
| `KpiCard` | ~4874–4875 | `opacity` + `transition: opacity 0.2s ease` |
| `KpiCard` empty footer | ~4909 | `transition: opacity 0.2s ease` |

### `transform` inline (posicionamento / KPI)

- **Ícone busca / botão limpar:** `transform: 'translateY(-50%)'` (~4371, ~4418).
- **`KpiRiskFaixaBarra`:** gradiente e marcador com `translateY` / `translate(-50%, -50%)` (~4808, ~4821) — posicionamento, não animado por transition no snippet.

### `ThSort` — indicador de ordenação

- **Linhas ~5056:** `opacity: active ? 1 : 0.4` no span das setas (sem `transition`).

### Recharts (`LineChart` / `<Line>`)

- **Secção:** gráfico “Produção histórica por substância”.
- **Linhas ~3686–3728**

**Não encontrado** — sem `animationDuration`, `animationBegin`, `isAnimationActive` ou props explícitas de animação nos `<Line>`. O Recharts usa animações por defeito da biblioteca, não configuradas neste ficheiro.

---

## 5. Navbar — transições de abas (`Navbar.tsx`)

Transição apenas na **cor** do texto; o sublinhado ativo é um `<span>` estático (sem transição de largura).

```tsx
// src/components/layout/Navbar.tsx (linhas 36–88)

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
    {linkMapa ? (
      <span
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-[1px] bg-[#EF9F27]"
        aria-hidden
      />
    ) : null}
  </button>
  {/* Radar e Inteligência: mesma classe transition-[color_150ms_ease] e mesmo padrão de underline */}
</nav>
```

---

## 6. Mapa — transições ao sair da aba Mapa (Inteligência)

### O mapa é desmontado?

**Não.** `MapView` permanece montado dentro de `App.tsx` (`<MapView />` está sempre presente sob `MapChromeTransitionContext.Provider`). Ao ir para Inteligência ou Radar, um overlay absoluto (`z-[100]`) cobre o mapa; o canvas **não** recebe `opacity: 0` no `MapView` — o overlay opaco (`#0D0D0C`) esconde o mapa.

### Chrome do mapa (searchbar, legenda, estilos)

`MapView.tsx` usa `useMapChromeTransition()` e anima **transform** e **opacity** em elementos sobrepostos:

```tsx
// src/components/map/MapView.tsx (linhas 810–835) — resize após transição

const {
  mapChromeCollapsed,
  chromeTransitionMs,
  chromeExitMs,
  chromeEnterMs,
} = useMapChromeTransition()
const chromeEase = `${chromeTransitionMs}ms ease-out`
// ...
useEffect(() => {
  const map = mapRef.current
  if (!map || !mapLoaded) return
  // ... prev tracking ...
  const id = window.setTimeout(() => {
    map.resize()
  }, chromeTransitionMs)
  return () => clearTimeout(id)
}, [mapChromeCollapsed, mapLoaded, chromeTransitionMs])
```

```tsx
// src/components/map/MapView.tsx (linhas 1056–1065) — MapSearchBar: slide para cima ao colapsar

<div
  className="pointer-events-none absolute left-0 right-0 top-4 z-10 flex flex-col items-center px-4"
  style={{
    transform: mapChromeCollapsed ? 'translateY(-132px)' : 'translateY(0)',
    transformOrigin: '50% 0',
    transitionProperty: 'transform',
    transitionDuration: `${chromeExitMs}ms`,
    transitionTimingFunction: 'ease-out',
    transitionDelay: mapChromeCollapsed ? '0ms' : `${chromeEnterMs}ms`,
  }}
>
```

```tsx
// src/components/map/MapView.tsx (linhas 1087–1101) — legenda Risk Score: desliza para a direita

<div
  style={{
    transform: mapChromeCollapsed
      ? 'translateX(calc(100% + 32px))'
      : 'translateX(0)',
    transition: `transform ${chromeEase}`,
  }}
>
```

```tsx
// src/components/map/MapView.tsx (linhas 1121–1131) — estilos + legenda regime: desliza para a direita

<div
  style={{
    transform: mapChromeCollapsed
      ? 'translateX(calc(100% + 32px))'
      : 'translateX(0)',
    transition: `transform ${chromeEase}`,
  }}
>
```

```tsx
// src/components/map/MapView.tsx (linhas 1144–1157) — caixa “Legenda” (regimes): opacity conforme modo/painel

<div
  style={{
    opacity:
      modoVisualizacao === 'risco'
        ? 0.3
        : painelFiltrosAberto
          ? 0.5
          : 1,
    transition: 'opacity 300ms ease',
  }}
>
```

### Sidebar de filtros (`MapSidebar`)

Quando o painel de filtros está montado, anima entrada/saída com **transform** (independente do `mapChromeCollapsed` para o slide lateral do drawer de filtros):

```tsx
// src/components/map/MapSidebar.tsx (linhas 192–201)

<aside
  style={{
    transform: animar ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 200ms ease-out',
  }}
>
```

### `MapSearchBar.tsx` (referência rápida)

- `transition: 'border-color 200ms ease'` no pill de busca.
- Classes Tailwind `transition-colors` em botões internos.

---

## Resumo cruzado (útil para motion system)

| Origem | Durações típicas |
|--------|------------------|
| CSS `:root` | Chrome exit 180ms, enter 280ms; reduced motion → 1ms |
| `MapChromeTransitionContext` | Defaults 180 / 280 ms (espelho dos CSS) |
| Overlay dashboard (`App.tsx`) | Fade de opacidade = `chromeExitMs` |
| Navbar | `color` 150ms ease |
| Inteligência (inline + classes `.terrae-intel-*`) | 0.15s–0.2s ease / ease-out |
| MapSidebar slide | 200ms ease-out |
| Legenda mapa (opacity) | 300ms ease |
| Chevron dropdowns | 0.15s transform |
| Tooltips KPI / hover | Atraso 300ms antes de aparecer |
| Recharts `Line` | Sem props de animação explícitas no projeto |

---

*Ficheiro gerado para análise de produto/design. Caminhos relativos ao repositório Terrae.*
