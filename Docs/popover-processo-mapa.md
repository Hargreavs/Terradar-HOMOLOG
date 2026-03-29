# Popover de processo no mapa — lógica e referência de código

Documento para **validação manual** do comportamento de **abertura**, **fechamento** e **interação** do popover de dados do polígono (Mapbox GL + React). Os caminhos são relativos à raiz do repositório (`Terrae/`).

---

## 1. Visão geral

| Conceito | Descrição |
|----------|-----------|
| **Popover** | Instância `mapboxgl.Popup` com conteúdo React (`ProcessoPopupContent`) montado via `createRoot` num `div` passado a `setDOMContent`. |
| **Estado “processo ativo”** | `useMapStore.processoSelecionado` (objeto `Processo` ou `null`). **Não** é persistido no `localStorage` (só filtros são persistidos). |
| **Drawer “Relatório completo”** | `useMapStore.relatorioDrawerAberto`. Quando `true`, um clique “de fundo” no mapa pode fechar popup + drawer (ver §6). |
| **Teardown DOM** | `tearDownProcessoPopupDom`: desmonta React root, chama `popup.remove()`, limpa refs. |

---

## 2. Ficheiros principais

| Ficheiro | Papel |
|----------|--------|
| `src/components/map/MapView.tsx` | Criação do mapa, layers `processos-fill` / `processos-outline`, `openProcessoPopupOnMap`, `attachProcessosLayerHandlers`, teardown, integração com filtros e `load` do mapa. |
| `src/components/map/ProcessoPopup.tsx` | UI do cartão; botão **✕** chama `onClose` (ligado a `closePopup` em `MapView`). |
| `src/store/useMapStore.ts` | `processoSelecionado`, `selecionarProcesso`, `relatorioDrawerAberto`, `setRelatorioDrawerAberto`, `getProcessosFiltrados`. |
| `src/lib/mapFloatingUiEvents.ts` | Evento global `terrae-map-clear-floating-ui` para fechar tooltips portaled ao pan/zoom. |
| `src/components/ui/TerraSideTooltip.tsx` | Tooltips do popover (Risk Score); escuta o evento global + bloqueio de reabertura até `mouseleave`. |
| `src/components/filters/CamadaTooltipHover.tsx` | Tooltips dos alertas no popover; mesma lógica de limpeza global. |
| `src/index.css` | Classes `.terrae-processo-popup`, `--layout-pending`, `z-index` vs canvas. |
| `src/components/dashboard/InteligenciaDashboard.tsx` | Linha ~2518–2520: `selecionarProcesso(p)` + `setTelaAtiva('mapa')` para abrir o mapa com processo já escolhido. |

---

## 3. Estado global (Zustand) — `useMapStore`

```ts
// Campos relevantes (ver implementação completa em src/store/useMapStore.ts)
processoSelecionado: Processo | null
relatorioDrawerAberto: boolean

selecionarProcesso: (processo: Processo | null) => void
setRelatorioDrawerAberto: (aberto: boolean) => void
getProcessosFiltrados: () => Processo[]
```

- **`processoSelecionado`**: atualizado ao clicar num polígono, ao fechar com **✕** (fica `null` após teardown e lógica de `closePopup`), ao remover o processo dos filtrados, ou ao fechar o mapa (`dispose`).
- **`relatorioDrawerAberto`**: toggling via `verRelatorioRef` / `RelatorioCompleto` / `closePopup` quando o drawer estava aberto.

---

## 4. Refs no `MapView` (resumo)

| Ref | Conteúdo |
|-----|----------|
| `processoPopupRef` | Instância `mapboxgl.Popup \| null` |
| `processoPopupRootRef` | `Root` do React (`createRoot`) ou `null` |
| `tearDownProcessoPopupRef` | Função `tearDownProcessoPopupDom` (para efeitos externos, ex. filtro) |
| `processosLayerHandlersRef` | Handlers atuais para `off` ao reaplicar |
| `pendingFecharProcessoTimeoutRef` | Timeout ao fechar drawer + limpar seleção |
| `mapDragClickGuardRef` | `{ consumeNextClick, resetTimeoutId }` — ignora no máximo um `click` após `dragend` |

---

## 5. Abertura do popover

### 5.1 Função central: `openProcessoPopupOnMap`

**Ficheiro:** `src/components/map/MapView.tsx`

Ordem lógica:

1. Cancela timeout pendente de fecho do drawer, se existir.
2. **`tearDownProcessoPopupDom()`** — remove popup anterior e unmount do root.
3. Cria `div`, `createRoot(mountEl)`, guarda em `popupRootRef`.
4. Cria `new mapboxgl.Popup({ closeButton: false, closeOnClick: false, closeOnMove: false, className: 'terrae-processo-popup terrae-processo-popup--layout-pending', ... })`, `setLngLat`, `setDOMContent(mountEl)`, `addTo(map)`.
5. `processoPopupRef.current = popup`.
6. Define **`closePopup`**: chama teardown; se `relatorioDrawerAberto`, fecha drawer e agenda `selecionarProcesso(null)` após `DRAWER_CLOSE_ANIM_MS` (320 ms); senão `selecionarProcesso(null)` já.
7. `root.render(<ProcessoPopupContent processo={proc} onClose={closePopup} onToggleRelatorioCompleto={...} />)`.
8. **`agendarAnchorVerticalProcessoPopup`**: mede altura do elemento, escolhe âncora top/bottom, remove classe `terrae-processo-popup--layout-pending` no fim.

### 5.2 Quem chama `openProcessoPopupOnMap`

1. **`onUnifiedClick`** (mapa): após `queryRenderedFeatures` em `processos-fill` e `processos-outline`, resolve `properties.id` → `processo` na store, `selecionarProcesso(proc)` e `openProcessoPopupOnMap(...)`.
2. **`map.on('load')`**: se já existir `processoSelecionado` em memória (ex. vindo do dashboard), abre o popup e faz `flyTo` para o processo.

### 5.3 Entrada a partir do Inteligência (dashboard)

**Ficheiro:** `src/components/dashboard/InteligenciaDashboard.tsx` (por volta das linhas 2518–2520)

- `useMapStore.getState().selecionarProcesso(p)`
- `useAppStore.getState().setTelaAtiva('mapa')`

Quando o mapa carrega ou já está montado com `load`, o fluxo em `map.on('load')` usa `preSel` para abrir o mesmo popup.

---

## 6. Fechamento do popover — matriz de decisão

### 6.1 Botão ✕ no cartão

**Ficheiro:** `src/components/map/ProcessoPopup.tsx` — `onClick={onClose}` no botão com `aria-label="Fechar"`.

`onClose` é o **`closePopup`** definido dentro de `openProcessoPopupOnMap` (§5.1): sempre faz **teardown** e atualiza store (drawer + timeout ou `selecionarProcesso(null)` imediato).

### 6.2 Clique noutro polígono

**Handler:** `onUnifiedClick` em `attachProcessosLayerHandlers`.

- Se o clique não for em DOM do popup / `.painel-alertas-popover`, faz `queryRenderedFeatures`.
- Com hit válido → `selecionarProcesso(proc)` + `openProcessoPopupOnMap` (substitui o anterior).

### 6.3 Clique no mapa “vazio” (sem feature nas layers de processo)

- Se o alvo do evento for **dentro** de `.mapboxgl-popup`, `.terrae-processo-popup` ou `.painel-alertas-popover` → **return** (não trata como mapa).
- Se **`(temProcessoSelecionado \|\| temPopup) && !relatorioDrawerAberto`** → **return** — **não** fecha (comportamento desejado: só ✕ ou outro polígono).
- Caso contrário, se há popup/drawer a justificar fecho global → `tearDownProcessoPopupDom()` + lógica drawer/selection.

### 6.4 Consumir um `click` fantasma após pan

Após **`dragend`**, `mapDragClickGuardRef` fica com `consumeNextClick = true` (com timeout de 380 ms para reset).

No início de **`onUnifiedClick`**, se `consumeNextClick` → consome e **return** (não processa como clique real).

### 6.5 Processo deixa de existir nos filtrados

**Ficheiro:** `src/components/map/MapView.tsx` — `useEffect` dependente de `[mapLoaded, filtros, modoVisualizacao]`.

- Atualiza `setData` da source GeoJSON.
- Se `processoSelecionado` **não** está em `filtrados` → `tearDownProcessoPopupRef.current?.()` + `selecionarProcesso(null)`.

### 6.6 Desmontagem do `MapView` / remoção do mapa

**`dispose`** (cleanup do `useLayoutEffect`): limpa timeouts, guard de drag, `tearDownProcessoPopupDom()`, `selecionarProcesso(null)`, `map.remove()`.

### 6.7 Drawer “Relatório completo”

- **`RelatorioCompleto`**: `onFechar={() => setRelatorioDrawerAberto(false)}` (só fecha o painel lateral, não o popup por si só).
- Claque no mapa vazio **com** `relatorioDrawerAberto === true` segue o ramo que chama teardown + `setRelatorioDrawerAberto(false)` + timeout → `selecionarProcesso(null)` (ver corpo de `onUnifiedClick` após `tearDownProcessoPopupDom`).

---

## 7. Eventos Mapbox registados em `attachProcessosLayerHandlers`

| Evento | Função |
|--------|--------|
| `mousemove` / `mouseleave` em `processos-fill` | Cursor `pointer` sobre polígonos. |
| `click` (mapa global) | `onUnifiedClick` — único handler de clique para hit + fecho. |
| `dragstart` | `dispatchTerraeMapClearFloatingUi()` — fecha tooltips portaled. |
| `dragend` | Ativa guard `consumeNextClick` + timeout de reset. |
| `zoomstart` | `dispatchTerraeMapClearFloatingUi()` (ex.: roda do rato sem `dragstart`). |
| `moveend` | Remove `terrae-processo-popup--layout-pending` do elemento do popup se ainda estiver aberto (evita opacity 0 presa). |

**Layers usados no hit-test:** `PROCESSOS_CLICK_LAYERS = ['processos-fill', 'processos-outline']`.

---

## 8. Evento global de UI flutuante (tooltips)

**Ficheiro:** `src/lib/mapFloatingUiEvents.ts`

```ts
export const TERRAE_MAP_CLEAR_FLOATING_UI = 'terrae-map-clear-floating-ui'

export function dispatchTerraeMapClearFloatingUi(): void {
  window.dispatchEvent(new CustomEvent(TERRAE_MAP_CLEAR_FLOATING_UI))
}
```

Disparado em **`dragstart`** e **`zoomstart`** no mapa (ver §7).

**Ouvintes:** `useTerraSideTooltip` e `CamadaTooltipHover` fecham o bubble e, no caso do hook de lado Terrae, bloqueiam novo `show` até **`mouseleave`** no gatilho (evita tooltip órfão quando o mapa se move por baixo do cursor).

---

## 9. CSS relevante (`src/index.css`)

| Regra | Efeito |
|-------|--------|
| `.mapboxgl-canvas-container` | `z-index: 0` — canvas por baixo do popup na ordem de pintura. |
| `.terrae-processo-popup.mapboxgl-popup` | `z-index: 10 !important`, `pointer-events: none` no wrapper Mapbox. |
| `.terrae-processo-popup .mapboxgl-popup-content` | `pointer-events: auto` — card clicável. |
| `.terrae-processo-popup--layout-pending.mapboxgl-popup` | `opacity: 0` até o layout/âncora estar pronto. |

---

## 10. Opções `mapboxgl.Popup` usadas

```ts
new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  closeOnMove: false,
  anchor: 'bottom',        // ajustado depois por agendarAnchorVerticalProcessoPopup
  offset: 10,
  maxWidth: 'none',
  className: 'terrae-processo-popup terrae-processo-popup--layout-pending',
})
```

Isto **impede** o fecho automático do Mapbox ao clicar no mapa ou ao mover o mapa; o fecho é **só** pela lógica da app + botão ✕.

---

## 11. Checklist de validação (sugestão)

1. Clicar num polígono → popup abre, `processoSelecionado` correto.
2. Clicar noutro polígono → popup troca de processo.
3. Com só popover (sem drawer): clicar no mapa vazio → **não** fecha.
4. Clicar em **✕** → popup desaparece, `processoSelecionado` vira `null` (ou drawer fecha primeiro se estiver aberto, conforme §6.1).
5. Abrir “Relatório completo” → `relatorioDrawerAberto` true; clicar no mapa vazio → comportamento de fecho combinado (teardown + drawer).
6. Arrastar o mapa (pan) → cartão mantém-se visível por cima do canvas; tooltips dentro do cartão não ficam “órfãos” permanentes (limpeza em drag/zoom + bloqueio até sair do hover).
7. Alterar filtros para excluir o processo atual → popup fecha e seleção limpa.
8. A partir do dashboard Inteligência: escolher linha → mapa com mesmo processo e popup após `load` / `preSel`.

---

## 12. Constantes úteis

| Constante | Valor | Uso |
|-----------|-------|-----|
| `DRAWER_CLOSE_ANIM_MS` | `320` | Atraso antes de `selecionarProcesso(null)` após fechar drawer via `closePopup`. |
| `PROCESSO_POPUP_OFFSET_PX` | `10` | Offset Mapbox popup. |
| `PROCESSOS_CLICK_LAYERS` | `processos-fill`, `processos-outline` | Hit-test no clique. |

---

## 13. Nota sobre versão do código

Este documento descreve a arquitetura **atual** do repositório. Números de linha podem mudar; use **pesquisa por nome de função** (`openProcessoPopupOnMap`, `attachProcessosLayerHandlers`, `onUnifiedClick`, `tearDownProcessoPopupDom`) nos ficheiros indicados para localizar o código após alterações futuras.
