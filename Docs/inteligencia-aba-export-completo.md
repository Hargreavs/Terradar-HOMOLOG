# Aba Inteligência Mineral — exportação técnica (código, tipografia, cores, animações)

Documento gerado a partir do estado atual do repositório. A **fonte canónica do UI da aba** é o ficheiro monolítico `src/components/dashboard/InteligenciaDashboard.tsx` (~4950 linhas). Este `.md` organiza por **secção / objetivo**, lista **hexadecimais**, **fontes**, **tamanhos**, **transições** e **contexto**, e indica **intervalos de linhas** para navegação no código.

> **Código integral:** para extrair o ficheiro completo, use o próprio `InteligenciaDashboard.tsx` no IDE ou, na raiz do projeto:  
> `Get-Content .\src\components\dashboard\InteligenciaDashboard.tsx` (PowerShell).

---

## 1. Ficheiros envolvidos

| Ficheiro | Papel |
|----------|--------|
| `src/App.tsx` | Monta o overlay da aba (`telaAtiva === 'inteligencia'`), fundo `#0D0D0C`, fade de opacidade ao entrar/sair. |
| `src/components/dashboard/InteligenciaDashboard.tsx` | **Todo** o layout, estado, gráficos, tabela, tooltips, ícones inline. |
| `src/components/dashboard/BrasilMiniMap.tsx` | Mini-mapa SVG do Brasil no card “Processos por estado”. |
| `src/index.css` | Classes `.terrae-intel-*` (scroll, painéis, busca, pills do gráfico, toggles do ranking). |
| `src/index.css` `:root` | Variáveis globais de cor (reutilizadas na app; Inteligência alinha-se a elas). |
| `src/context/MapChromeTransitionContext.tsx` | Durações padrão do chrome (180 ms saída / 280 ms entrada); lidas via CSS em `App`. |
| `src/data/dashboard.mock.ts` | Dados mock do dashboard (produção, alertas, minerais estratégicos). |
| `src/data/processos.mock.ts` | Processos para filtros e tabela. |
| `src/data/brasil-ufs-paths.ts` | Geometrias UF para `BrasilMiniMap`. |
| `src/lib/regimes.ts` | `REGIME_COLORS`, `REGIME_LABELS` (barras por regime). |
| `src/lib/corSubstancia.ts` | `estiloBadgeSubstanciaPaletaV2` (pills do ranking). |
| `src/lib/alertaImpactoLegislativo.ts` / `alertaNivelImpactoBadge.ts` | Cores e textos dos alertas legislativos. |
| `src/components/ui/*` | `RegimeBadge`, `BadgeSubstancia`, `AlertaFonteMetadataLinha`. |
| `src/components/filters/CamadaTooltipHover.tsx` | Tooltips dos badges de alerta. |
| `src/store/useAppStore.ts` | `setTelaAtiva('radar')` no card de alertas. |
| `src/store/useMapStore.ts` | Clique na linha da tabela abre o mapa com processo selecionado. |

**Navbar** (`Navbar.tsx`) não faz parte do painel Inteligência, mas comuta `telaAtiva` para `'inteligencia'`.

---

## 2. Tipografia global (app)

| Uso | Valor |
|-----|--------|
| Família | `'Helvetica Neue', Helvetica, Arial, sans-serif` (`body` em `index.css`; repetida no root do dashboard e no input de busca). |
| Pesos usados na aba | 400 (normal), 500 (medium) em títulos secundários, KPIs, células. |

---

## 3. Paleta e tokens (hex) usados na aba

### 3.1 Fundos e bordas

| Hex | Uso |
|-----|-----|
| `#0D0D0C` | Fundo principal do scroll do dashboard; fundo overlay em `App.tsx`; fundo de subpainéis (minerais); thead da tabela; KPI vazio; página ativa na paginação (texto sobre âmbar). |
| `#111110` | Fundo do campo de busca; linhas ímpares da tabela (zebra). |
| `#1A1A18` | Cards/painéis; track de scroll UF; linhas pares da tabela. |
| `#2C2C2A` | Bordas padrão de painéis (CSS + inline); separadores; barras de fundo de progresso; grid do gráfico; borda inativa de filtros. |
| `#3D3D3A` | Borda de pills de filtro ativo; thumb scroll UF (estado normal). |

### 3.2 Texto

| Hex | Uso |
|-----|-----|
| `#F1EFE8` | Título “Inteligência Mineral”; valores e CTAs principais; texto KPI; limpar filtros hover; chevrons ano no MonthPicker hover. |
| `#FFFFFF` | Títulos de secção em caixa alta; mês selecionado no picker; label “Valor potencial” (KPI); cabeçalhos de tabela (`Th`); número da posição no ranking. |
| `#D3D1C7` | Subtítulos, corpo de dropdowns, linhas de UF, titular na tabela. |
| `#888780` | Texto secundário; eixos Recharts; paginação inativa; ícones desativados. |
| `#5F5E5A` | Metadados discretos; rótulos de eixo “Processos/Hectares”; N/D risco; placeholder busca (CSS `#5f5e5a`). |

### 3.3 Acentos Terrae / âmbar

| Hex | Uso |
|-----|-----|
| `#EF9F27` | Hectares KPI; valor potencial; UF selecionada na lista; borda foco busca; ícone busca focado; coluna métrica ranking; borda esquerda linha selecionada; página atual paginação (fundo). |
| `#F1B85A` | Link “Limpar tudo” (filtros), estado normal. |

### 3.4 Risco e situação (alinhado ao mapa)

| Hex | Uso |
|-----|-----|
| `#1D9E75` | Baixo risco; situação ativo; tendência alta (minerais). |
| `#E8A830` | Risco médio. |
| `#E24B4A` | Alto risco; situação bloqueado; tendência queda. |
| `#444441` / `#5F5E5A` | Risco N/D, neutro. |

Sufixo `26` em hex (ex.: `#1D9E7526`) = ~15 % opacidade para fundos de badge/barra.

### 3.5 Série do gráfico “Produção histórica” (`SUB_KEYS`)

| Substância | Cor linha `#` |
|------------|----------------|
| Ferro | `#7EADD4` |
| Cobre | `#C87C5B` |
| Ouro | `#D4A843` |
| Nióbio | `#5CBFA0` |
| Terras raras | `#3D8B7A` |

### 3.6 KPIs — cores de valor

| KPI | `valorColor` |
|-----|----------------|
| Processos | `#F1EFE8` |
| Hectares | `#EF9F27` |
| Risco | dinâmico (`corRisk`) |
| Substâncias críticas | `#3D8B7A` |
| UFs | `#4A90B8` |
| Valor potencial | `#EF9F27` |

### 3.7 BrasilMiniMap (`BrasilMiniMap.tsx`)

| Hex | Uso |
|-----|-----|
| `#1A1A18` | UF sem processos |
| `#5F5E5A` | Risco médio null |
| `#1D9E75` / `#E8A830` / `#E24B4A` | Faixas de risco |
| Tooltip fundo `#2C2C2A`, borda `#3a3a38`, texto `#D3D1C7`, `fontSize: 13` |

### 3.8 Último despacho (tabela)

Lógica `corUltimoDespachoData`: ≤30 dias `#1D9E75`; ≤180 `#D3D1C7`; ≤365 `#EF9F27`; senão `#E24B4A`.

---

## 4. Classes CSS globais (só Inteligência / partilhadas)

Definições em `src/index.css` (linhas indicativas ~196–229, 310–368, 432–450).

| Classe | Objetivo | Cores / animação |
|--------|----------|------------------|
| `.terrae-intel-dashboard-scroll` | Scroll vertical do painel principal | Thumb transparente → hover `#4a4a48` / track `#1a1a18`; `scrollbar-gutter: stable`. |
| `.terrae-uf-scroll` | Lista de UFs | Thumb `#3d3d3a` / hover `#4a4a48`. |
| `.terrae-dropdown-scroll` | Lista nos dropdowns (portal) | Thumb `#4a4a48`. |
| `.terrae-intel-hover-panel` | Borda card | `#2c2c2a` → hover `#888780`; `transition: border-color 0.2s ease-out`. |
| `.terrae-intel-hover-subpanel` | Subcards minerais | Hover `#6e6e6a`. |
| `.terrae-intel-stat-badge` | Badge resumo no header | Hover borda `#888780` + `box-shadow` sutil; transição 0.2s. |
| `.terrae-intel-border-interactive` | Triggers MonthPicker / MultiSelect | Hover/focus-visible borda `#888780`. |
| `.terrae-intel-chart-pill-inactive` | Pills do gráfico desligados | `border-color` 0.2s; hover borda `#888780`. |
| `.terrae-intel-rank-toggle` | “Por Área” / “Por Processos” | Borda `#2c2c2a`; transição borda + background 0.15–0.2s. |
| `.terrae-intel-busca-processos` | Input type=search | `font-family` Helvetica stack; placeholder `#5f5e5a`; esconde clear nativo WebKit. |

**Nota:** `index.css` também define `*` scrollbar genérica (`#3a3a38`); o dashboard usa ainda classes específicas acima.

---

## 5. Animações e transições

| Onde | O quê |
|------|--------|
| `App.tsx` | Overlay do dashboard: `opacity` 0→1 com `transitionDuration` = `--terrae-chrome-exit-ms` (lido do CSS, tipicamente **180 ms**, `ease-out`). Com `prefers-reduced-motion: reduce` no `:root`, vira **1 ms**. |
| `InteligenciaDashboard` | `useTransition` do React em atualizações de filtros (marcar UI como não urgente). |
| KPI cards | `opacity 0.2s ease` quando `emptyFiltros`. |
| Chevron dropdown (`ChevronDown`) | `transform: rotate(180deg)` com `transition: transform 0.15s ease-out`. |
| Linhas regime (barra) | `filter: brightness(1.1)` no hover da barra clicável. |
| Linhas UF | `opacity 0.15s ease`, `filter` no hover do mapa. |
| Campo busca | `border-color 0.2s ease`; ícone opacidade 0.2s. |
| Tabela | `transition: opacity 0.2s ease` em vários wrappers; hover linha `backgroundColor` instantâneo via JS (`#2C2C2A`). |
| Recharts | `Line` `strokeWidth={2}`, `dot` r=3, `activeDot` r=5 (sem CSS keyframes). |
| Tooltips KPI / linha / info | Atraso **300 ms** (`KPI_TOOLTIP_DELAY_MS`, `MAPA_TOOLTIP_DELAY_MS` no mini-mapa). |
| `KpiRiskFaixaBarra` | Gradiente estático verde → âmbar → vermelho; marcador branco `#F1EFE8` (sem animação). |

**Badge pulse** (`.terrae-badge-pulse` em `index.css`) existe na app mas **não** é referenciado diretamente no JSX do `InteligenciaDashboard` analisado.

---

## 6. Entrada na aba (`App.tsx`)

**Objetivo:** cobrir o mapa com um painel full-screen e mostrar o dashboard com fade.

- Container absoluto `z-[100]`, `backgroundColor: '#0D0D0C'`.
- Filho interno: `opacity` animada; `transitionProperty: 'opacity'`; duração lida do CSS (`--terrae-chrome-exit-ms`).
- Conteúdo: `<InteligenciaDashboard />` quando `telaAtiva === 'inteligencia'`.

Trecho essencial:

```tsx
// src/App.tsx (trecho)
{painelExtraMontado ? (
  <div
    className="pointer-events-auto absolute inset-0 z-[100] ..."
    style={{ backgroundColor: '#0D0D0C' }}
  >
    <div
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
```

---

## 7. `InteligenciaDashboard` — por secção (objetivo + tipografia + linhas)

Root do componente: **~2577–4598** (`return` principal).

### 7.1 Container de scroll

| Propriedade | Valor |
|-------------|--------|
| Classe | `terrae-intel-dashboard-scroll` + utilitários Tailwind |
| Fundo | `#0D0D0C` |
| Padding | `24` px |
| Fonte | `'Helvetica Neue', Helvetica, Arial, sans-serif` |

### 7.2 Cabeçalho e filtros

**Objetivo:** título, subtítulo, período (MonthPicker ×2), UF, Substância, “Limpar tudo”, badge de contagem.

| Elemento | fontSize | fontWeight | Cor principal |
|----------|----------|------------|---------------|
| `h1` “Inteligência Mineral” | 24 | 500 | `#F1EFE8` |
| Subtítulo | 16 | (default 400) | `#888780` |
| Separador vertical | — | — | `#2C2C2A`, 1×26 px |
| “Limpar tudo” | 15 | 400 | ativo `#F1B85A` → hover `#F1EFE8`; `transition opacity/color 0.2s` |
| Badge resumo (stat) | 16 | — | texto `#D3D1C7`, borda `#2C2C2A` |

**MonthPicker / MultiSelect:** ver secção 7.12 (componentes internos).

**Pills de filtros ativos:** `fontSize: 14`, `#D3D1C7`, fundo `#2C2C2A`, borda `#3D3D3A`, `borderRadius: 999`; botão ✕ `#888780`.

Linhas ~2586–2778.

### 7.3 Grelha de KPIs (6 colunas)

**Objetivo:** métricas agregadas com tooltips contextuais (`IntelKpiTooltip` + portal).

- Grelha: `repeat(6, minmax(0, 1fr))`, `gap: 12`, `marginTop: 16`.
- `KpiCard`: ver secção 7.14.

Linhas ~2781–2874.

### 7.4 Distribuição por regime + Processos por estado

**Objetivo:** duas colunas; barras horizontais clicáveis (filtro regime); lista UF + mini-mapa.

- Painéis: `terrae-intel-hover-panel`, fundo `#1A1A18`, `padding: 20`, `borderRadius: 8`.
- Título secção: `fontSize: 13`, `uppercase`, `letterSpacing: 1.5px`, `#FFFFFF`.
- Barras: trilho `#2C2C2A`, altura 6 px; preenchimento cor de `REGIME_COLORS` / risco UF.
- UF código: `fontSize: 13`, `fontWeight: 500`, selecionado `#EF9F27` senão `#D3D1C7`.

`BrasilMiniMap` à direita (**~3375–3392**).

Linhas ~2876–3399.

### 7.5 Produção histórica por substância

**Objetivo:** `LineChart` (Recharts) com toggles por mineral.

- Subtítulo auxiliar: `fontSize: 16`, `#888780`.
- Pills: `fontSize: 12`, `fontWeight: 500`; ativo borda cor série + fundo `${color}26`.
- Gráfico: altura 240 px; grid `#2C2C2A` opacidade 0.3; ticks `#888780` 13 px.

Linhas ~3401–3546.

### 7.6 Últimos alertas legislativos

**Objetivo:** lista com badges de impacto (cores de `estiloBadgeNivelImpacto` / `corTipoImpacto`), link para Radar.

- Título: `fontSize: 13`, `fontWeight: 500`, `letterSpacing: 1.5px`, `#FFFFFF`.
- Badge “via Adoo”: `#EF9F27` / fundo `#EF9F2726`.
- Link Radar: `fontSize: 14`, `#EF9F27`, `fontWeight: 500`.

Componente `CardUltimosAlertasLegislativos`: **~1247–1422**.

### 7.7 Minerais estratégicos + Ranking de titulares

**Objetivo:** cartões de gap reserva/produção + tabela em grelha com toggle ordenação.

- Subpainéis: `terrae-intel-hover-subpanel`, fundo `#0D0D0C`.
- Preço: `#EF9F27`, `fontSize: 14`, `fontWeight: 500`.
- Toggles ranking: classes `terrae-intel-rank-toggle`; ativo fundo `#2C2C2A` texto `#F1EFE8`; inativo fundo `#0D0D0C` texto `#888780`.
- Linha selecionada: `borderLeft: 2px solid #EF9F27`, fundo `#2C2C2A`.

Linhas ~3550–4116.

### 7.8 Tabela de processos + busca + CSV + paginação

**Objetivo:** dados tabulares, ordenação, busca, exportação, páginação.

- Título secção: `fontSize: 13`, uppercase, `#FFFFFF`.
- Wrapper busca: fundo `#111110`, borda `#2C2C2A` ou foco `#EF9F27`, altura 36 px, `borderRadius: 6`.
- Input: `fontSize: 14`, `#F1EFE8`.
- `Th`: `fontSize: 12`, uppercase, `#FFFFFF`, `fontWeight: 500`.
- Coluna “Último desp.”: `fontSize: 13`, `#888780`.
- `Td`: `fontSize: 14`, borda inferior `#2C2C2A`.
- Zebra: `#1A1A18` / `#111110`; hover `#2C2C2A`.
- Paginação: página atual fundo `#EF9F27`, texto `#0D0D0C`; inativa `#888780`.

Linhas ~4118–4583.

### 7.9 Rodapé do dashboard

`fontSize: 11`, `#5F5E5A`, `borderTop: 1px solid #2C2C2A`, `marginTop: 24`, `paddingTop: 16`.

Linhas ~4585–4596.

---

## 8. Componentes e helpers internos (ficheiro único)

Intervalos aproximados em `InteligenciaDashboard.tsx`:

| Bloco | Linhas (aprox.) | Função |
|-------|-----------------|--------|
| Ícones (busca, limpar, chevron, tendência) | 58–199 | SVG inline |
| Constantes fase, substâncias gráfico, UF mock | 201–265 | Dados de UI |
| Filtros, formatação, cores risco | 266–442 | Lógica |
| Ranking grid styles, MonthPicker helpers | 459–556 | Layout tabular |
| Tooltips portal (linha, KPI, info, demanda) | 558–1245 | UX rica |
| Card alertas | 1247–1422 | Alertas DOU |
| Empty states, MultiSelect, MonthPicker | 1535–2070 | Filtros |
| `InteligenciaDashboard` + tabela + KPI + gráfico | 2074–4598 | Página |
| `KpiRiskFaixaBarra`, `KpiCard`, `Th`, `ThSort`, `Td` | 4601–4842 | Design system local |
| `ProducaoTooltip` etc. | 4844+ | Tooltip Recharts |

---

## 9. Trechos de código por objetivo (referência)

### 9.1 Root layout + título

```tsx
// InteligenciaDashboard.tsx ~2577–2607
<div
  className="terrae-intel-dashboard-scroll box-border h-full min-h-0 flex-1"
  style={{
    backgroundColor: '#0D0D0C',
    padding: 24,
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  }}
>
  <header style={{ marginBottom: 0 }}>
    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, color: '#F1EFE8' }}>
      Inteligência Mineral
    </h1>
    <p style={{ margin: '8px 0 0 0', fontSize: 16, color: '#888780' }}>
      Visão consolidada dos processos minerários monitorados
    </p>
```

### 9.2 `KpiCard` (tipografia do número)

```tsx
// ~4673–4756
<div style={{ fontSize: 32, fontWeight: 500, color: corValorExibido }}>{valorExibido}</div>
<div style={{ fontSize: labelFontSize, color: labelColor, marginTop: 4 }}>{label}</div>
<div style={{ fontSize: subFontSize, color: '#888780', lineHeight: 1.4 }}>{sub}</div>
```

### 9.3 `Th` / `ThSort` / `Td`

```tsx
// ~4777–4837
// Th: fontSize 12, uppercase, letterSpacing 0.5px, color #FFFFFF, fontWeight 500
// Td: fontSize 14, borderBottom #2C2C2A
```

---

## 10. Durações CSS sincronizadas com o mapa

Em `src/index.css` `:root`:

- `--terrae-chrome-exit-ms: 180ms` (entrada no overlay Inteligência / Radar)
- `--terrae-chrome-enter-ms: 280ms` (volta ao mapa)

Com `prefers-reduced-motion: reduce`, ambos passam a `1ms`.

---

## 11. Dependências npm relevantes

- `recharts` — gráfico de linhas.
- `react`, `react-dom` — UI e portals (dropdowns, tooltips).

---

## 12. Mapa mental do JSX (ordem vertical)

1. Header + filtros + pills  
2. KPIs (6)  
3. Regime | UF + mini-mapa  
4. Produção histórica  
5. Alertas legislativos  
6. Minerais estratégicos | Ranking titulares  
7. Tabela processos  
8. Footer fontes de dados  

---

*Última atualização: estrutura e linhas referem o código no estado atual do repositório; se o ficheiro for editado, ajuste os intervalos de linha no IDE.*
