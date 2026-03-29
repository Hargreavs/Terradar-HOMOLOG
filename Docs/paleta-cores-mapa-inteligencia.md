# Paleta de cores (hex) — abas **Mapa** e **Inteligência**

Documento de referência dos principais códigos de cor usados na interface, incluindo componentes compartilhados (navbar), chrome do mapa, sidebar, popovers, relatório (drawer) e dashboard de Inteligência.  
Valores extraídos do código em `tailwind.config.ts`, `src/index.css` e componentes React.

---

## 1. Tokens globais (design system)

Estes valores aparecem como classes Tailwind (`bg-dark-primary`, `border-dark-border`, `text-[#…]`) ou variáveis CSS em `:root`.

| Token / variável | Hex | Uso |
|------------------|-----|-----|
| **Terrae 50** | `#FAEEDA` | Escala de marca (pouco usada em UI escura) |
| **Terrae 100** | `#FAC775` | Logo (faixas claras) |
| **Terrae 200** ( `--terrae-200` ) | `#EF9F27` | Âmbar primário: ativo, foco, slider, indicadores, abas |
| **Terrae 400** | `#BA7517` | Borda do thumb do `range` / detalhe escuro âmbar |
| **Terrae 600** | `#854F0B` | Gradiente do track do `range` (início) |
| **Terrae 800** | `#633806` | Logo (faixa escura) |
| **Terrae 900** | `#412402` | Escala (Tailwind) |
| **dark.primary** / `--bg-primary` | `#0D0D0C` | Fundo app, mapa, painéis, overlay Inteligência/Radar |
| **dark.secondary** / `--bg-secondary` | `#111110` | Sidebar mapa, linhas tabela (zebra), tooltip lateral |
| **dark.tertiary** / `--bg-tertiary` | `#1A1A18` | Cards, inputs, popup processo, mini-mapa UF (sem dados) |
| **dark.border** / `--bg-border` | `#2C2C2A` | Bordas padrão, separadores, checks, sliders |
| **--text-primary** | `#F1EFE8` | Texto principal, títulos, estados ativos (nav) |
| **--text-secondary** | `#888780` | Texto secundário, legendas, placeholders “neutros” |
| **--text-tertiary** | `#5F5E5A` | Texto apagado, atribuição Mapbox, ícones empty state |
| **--text-section-title** | `#B4B2A9` | Rótulos de secção (ex.: “Localização”, títulos de legenda) |

**Texto adicional (hardcoded frequente)**

| Hex | Onde costuma aparecer |
|-----|------------------------|
| `#D3D1C7` | Corpo de texto em cards, popups, dropdowns |
| `#FFFFFF` | Cabeçalhos de tabela (Inteligência), alguns destaques |
| `#B8B5AC`, `#ADABA3`, `#8E8C84` | Ícones / ações secundárias no popup de processo |
| `#E8E6DF` | Destaques suaves no popup |
| `#6F6E6A` | Borda de pill/link no popup |
| `#3F3F3C` | Fundo de indicador numérico (timeline no popup) |
| `#333331` | Hover em botão inativo do seletor de estilo do mapa |

**Sombras (não são hex puros, mas padrão visual)**

| Valor | Uso |
|-------|-----|
| `rgba(0, 0, 0, 0.35)` | Dropdowns / MonthPicker (portal) |
| `rgba(0, 0, 0, 0.45)` | Tooltips KPI, tooltip lateral |
| `rgba(0, 0, 0, 0.4)` | Painel dropdown UF (sidebar) |
| `rgba(17, 17, 16, 0.9)` | Fundo das legendas flutuantes do mapa |
| `rgba(13, 13, 12, 0.85)` | Fundo da atribuição Mapbox |
| `rgba(241, 239, 232, 0.16)` | Borda do tooltip lateral (`TerraSideTooltip`) |

---

## 2. Navegação principal (abas)

Compartilhada por Mapa, Radar e Inteligência (`Navbar.tsx` + Tailwind).

| Elemento | Hex / classe |
|----------|----------------|
| Borda inferior header | `border-dark-border` → `#2C2C2A` |
| Fundo header | `bg-dark-primary` → `#0D0D0C` |
| Aba ativa — texto | `#F1EFE8` |
| Aba inativa — texto | `#D3D1C7` |
| Indicador (ponto sob aba ativa) | `bg-terrae-200` → `#EF9F27` |
| Logo — texto “TERRAE” | `#F1EFE8` |
| Logo — barras | `#FAC775`, `#EF9F27`, `#BA7517`, `#854F0B`, `#633806` |

---

## 3. Aba **Mapa**

### 3.1 Layout e chrome

| Área | Hex |
|------|-----|
| Fundo atrás do mapa | `#0D0D0C` (`bg-dark-primary`) |
| Sidebar — fundo | `#111110` (`bg-dark-secondary`) |
| Sidebar — borda direita | `#2C2C2A` (`border-dark-border`) |

### 3.2 Sidebar — filtros e secções

| Componente / estado | Hex |
|---------------------|-----|
| Títulos de secção (“Localização”, collapse +/−) | `var(--text-section-title)` → `#B4B2A9`; ícone ± `#888780` |
| **LayerToggles** — label | `#F1EFE8` |
| **LayerToggles** — track toggle ativo | “bola” `#F1EFE8` |
| **LayerToggles** — aviso / texto auxiliar | `#888780` |
| **LayerToggles** — badge contagem camada | fundo `#E24B4A`, texto `white` |
| **PeriodoSlider** — números ano | `#F1EFE8` |
| **PeriodoSlider** — trilha visual | base `#2C2C2A`; preenchimento `#EF9F27` (CSS + estilos inline) |
| **SubstanciaFilter** — labels | `#F1EFE8`; ícone ± `#888780` |
| **SubstanciaFilter** — marcador “estratégico” | `#BA7517` |
| **UF dropdown (trigger)** — fundo | `#1A1A18` |
| **UF dropdown (trigger)** — borda fechada | `#2C2C2A`; hover borda `#5F5E5A` |
| **UF dropdown (trigger)** — borda aberta | `#EF9F27` |
| **UF dropdown (trigger)** — texto | `#F1EFE8` |
| **Chevron UF** | `#5F5E5A` (stroke) |
| **Painel lista UF (portal)** — fundo / borda | `#1A1A18` / `#2C2C2A` |
| **Opção lista UF** — não selecionada | texto `#D3D1C7`; hover fundo `#2C2C2A`, texto `#F1EFE8` |
| **Opção lista UF** — selecionada | fundo `#2C2C2A`, texto `#EF9F27` |
| **Município** — input | `border-dark-border`, `bg-dark-tertiary`, texto `#F1EFE8` |
| **Município** — placeholder | `#5F5E5A` |
| **Município** — desabilitado | opacidade reduzida (`opacity-40`) |
| **CamadaTooltipHover** | fundo `#0D0D0C`, texto `#D3D1C7`, borda `#2C2C2A` |

### 3.3 Barra superior do mapa (busca + Risk Score)

| Elemento | Hex |
|----------|-----|
| **SearchBar** — fundo | `#1A1A18` |
| **SearchBar** — borda padrão | `#5F5E5A` |
| **SearchBar** — foco | borda e realces `white` (`#FFFFFF`); ícone/placeholder em foco → branco |
| **SearchBar** — texto digitado | `#F1EFE8` |
| **SearchBar** — ícone / placeholder | `#888780` |
| **RiskScoreMapToggle** — fundo | `#1A1A18` |
| **RiskScoreMapToggle** — inativo | borda `#2C2C2A`, texto `#888780`; hover texto `#EF9F27` |
| **RiskScoreMapToggle** — ativo | borda e texto `#EF9F27` |

### 3.4 Polígonos no mapa (regime vs risco)

| Modo | Cor | Hex (resumo) |
|------|-----|----------------|
| **Regime** | Por tipo de regime | Ver §3.6 (`REGIME_COLORS`) |
| **Risco** — baixo (0–39) | Verde | `#1D9E75` |
| **Risco** — médio (40–69) | Âmbar | `#EF9F27` |
| **Risco** — alto (70–100) | Vermelho | `#E24B4A` |
| **Risco** — não calculado | Cinza | `#444441` |
| Fallback cor no GeoJSON | Vermelho puro (erro dados) | `#FF0000` |

Opacidade do preenchimento dos polígonos: **0.3**; contorno: largura **2.5**, opacidade **1**.

### 3.5 Legendas flutuantes (canto)

| Elemento | Hex |
|----------|-----|
| Fundo painel | `rgba(17, 17, 16, 0.9)` |
| Borda | `#2C2C2A` |
| Título secção (Risk / Legenda) | `var(--text-section-title)` |
| Texto corpo itens | `#F1EFE8` |
| Classe genérica `text-[#888780]` no wrapper | `#888780` |
| Marcadores (bolinhas) | cores da legenda (regime ou risco, ver acima) |

### 3.6 Regime mineral (`lib/regimes.ts`)

| Regime | Hex |
|--------|-----|
| Concessão de Lavra | `#378ADD` |
| Autorização de Pesquisa | `#1D9E75` |
| Req. de Lavra | `#7F77DD` |
| Licenciamento | `#639922` |
| Mineral Estratégico | `#0F6E56` |
| Bloqueio Provisório | `#EF9F27` |
| Bloqueio Permanente | `#E24B4A` |

### 3.7 Seletor de estilo Mapbox (`MapStyleSwitcher`)

| Estado | Fundo | Ícone / texto |
|--------|--------|----------------|
| Ativo | `#EF9F27` | `#0D0D0C` |
| Inativo | `#2C2C2A` | `#888780` |
| Inativo — hover | `#333331` | (mantém `#888780` via classe) |

### 3.8 Popup de processo (Mapbox + `ProcessoPopup.tsx`)

| Elemento | Hex |
|----------|-----|
| Card — fundo | `#1A1A18` |
| Card — borda | `#2C2C2A` |
| Título / ênfase | `#F1EFE8` |
| Fechar — default | `#B8B5AC`; hover `#F1EFE8` |
| Separadores | `#2C2C2A` |
| Corpo / metadados | `#D3D1C7` |
| Ícones linha | `#8E8C84` |
| Link “Ver relatório” (estilo ghost) | borda `#6F6E6A`, texto `#ADABA3`; hover borda/texto `#F1EFE8` |
| Barra de risk compacta | trilho `#2C2C2A`; faixas por score `#1D9E75` / `#EF9F27` / `#E24B4A` |
| Rótulos timeline | `#888780` / `#D3D1C7` |
| Número em círculo | fundo `#3F3F3C`, texto `#E8E6DF` |
| Botão primário (ex.: relatório) | borda `#EF9F27`, texto `#F1EFE8` |
| Tip Mapbox (seta) | `#1a1a18` (CSS `.terrae-processo-popup`) |

### 3.9 Controles Mapbox (CSS global)

| Elemento | Hex / nota |
|----------|------------|
| Atribuição — texto | `#5F5E5A` |
| Atribuição — fundo | `rgba(13, 13, 12, 0.85)` |
| Atribuição — links | `#888780` |

---

## 4. Relatório completo (drawer) — contexto **Mapa**

Abre sobre o mapa; abas internas (Processo, Território, Inteligência mineral, Risco, Fiscal) e PDF.

| Elemento | Hex (principal) |
|----------|------------------|
| Drawer — fundo conteúdo scroll | `#111110` |
| Drawer — borda esquerda | `#2C2C2A` |
| Header drawer — fundo | `#0D0D0C` |
| Header — borda inferior | `#2C2C2A` |
| Texto header / corpo forte | `#F1EFE8` |
| **Abas** — inativa | texto `#5F5E5A`; hover `#888780` |
| **Abas** — ativa | texto `#F1EFE8`, sublinhado `#EF9F27` (2px) |
| Botões secundários / estados | `#2C2C2A`, `#5F5E5A`, `#F1EFE8`, `#FFFFFF` (conforme estado) |
| Semântica em métricas (ex.: risco, distância) | `#1D9E75`, `#EF9F27`, `#E24B4A`, `#888780`, `#639922`, `#444441` |
| Blocos internos | frequentemente `#1A1A18`, bordas `#2C2C2A` |

*(Há mais variações no ficheiro `RelatorioCompleto.tsx`; a maioria deriva dos tokens acima.)*

### 4.1 Tooltip lateral (mapa / sidebar)

| Elemento | Valor |
|----------|--------|
| Fundo | `#111110` |
| Borda | `rgba(241, 239, 232, 0.16)` |
| Sombra | `0 8px 24px rgba(0, 0, 0, 0.45)` |

---

## 5. Aba **Inteligência**

Fundo da área de scroll: `#0D0D0C` (`InteligenciaDashboard`). Reutiliza largamente os mesmos tokens de **§1**.

### 5.1 Cabeçalho do dashboard

| Elemento | Hex |
|----------|-----|
| Título principal | `#F1EFE8` |
| Subtítulo | `#888780` |
| Linha divisória filtros | `#2C2C2A` |
| **MonthPicker** — botão fundo | `#0D0D0C` |
| **MonthPicker** — borda sem valor | `#2C2C2A` |
| **MonthPicker** — borda / texto com mês seleccionado | `#FFFFFF` |
| **MonthPicker** — placeholder “De” / “Até” | `#D3D1C7` |
| **MonthPicker** — painel | `#1A1A18`, borda `#2C2C2A` |
| **MonthPicker** — navegação ano | `#888780` / hover `#F1EFE8` |
| **MultiSelect UF / Substância** — fundo | `#0D0D0C` |
| **MultiSelect** — borda | `#2C2C2A`; hover `#888780` (classe `.terrae-intel-border-interactive`) |
| **MultiSelect** — texto | `#D3D1C7` |
| **MultiSelect** — painel portal | `#1A1A18`, borda `#2C2C2A` |
| **MultiSelect** — checkbox marcado | fill `#EF9F27`, borda caixa `#2C2C2A` |
| **Badge resumo** (processos · estados / filtrado) | texto `#D3D1C7`, borda `#2C2C2A`; hover borda `#888780` (`.terrae-intel-stat-badge`) |
| **Limpar tudo** | `#F1B85A`; hover `#F1EFE8` |
| **Pills filtros ativos** | UF `#EF9F27`; substância `#378ADD`; período `#7F77DD`; regime `#1D9E75` (bordas/textos; fundo `${cor}26`) |

### 5.2 KPIs (`KpiCard`)

| Elemento | Hex |
|----------|-----|
| Valor principal | por card (`#FFFFFF`, `#EF9F27`, `#378ADD`, etc.) |
| Label | tipicamente `#888780` ou `#FFFFFF` conforme variante |
| Estado vazio (“—”) | `#5F5E5A`, subtítulo “Sem resultados…” `#5F5E5A` ou `#888780` conforme ramo |

### 5.3 Cards e gráficos

| Elemento | Hex |
|----------|-----|
| Painel de card | `#1A1A18` |
| Subpainéis / nested | `#1A1A18`, `#0D0D0C` |
| Títulos em maiúsculas | `#FFFFFF` |
| Texto corpo | `#D3D1C7`, `#888780`, `#5F5E5A` |
| Barras de fundo (regime, etc.) | trilho `#2C2C2A` |
| Séries gráfico produção (por substância) | Ferro `#378ADD`, Cobre `#E24B4A`, Ouro `#EF9F27`, Nióbio `#1D9E75`, Terras raras `#0F6E56` |
| Grid / eixos Recharts | tons `#2C2C2A` / `#5F5E5A` / `#888780` (conforme tick) |
| **Alertas legislativos** — highlight | `#EF9F2726`, texto destaque `#EF9F27` |
| **Minerais estratégicos** — preço / ênfase | `#EF9F27`; tendência alta `#1D9E75`, estável `#888780`, queda `#E24B4A` |

### 5.4 Mini-mapa UF (`BrasilMiniMap`)

| Estado | Fill |
|--------|------|
| Sem processos (count 0) | `#1A1A18` |
| Sem risk calculado | `#5F5E5A` |
| Risk baixo / médio / alto | `#1D9E75` / `#EF9F27` / `#E24B4A` |

### 5.5 Tabela de processos

| Elemento | Hex |
|----------|-----|
| `thead` fundo | `#0D0D0C` |
| Cabeçalhos sortíveis | `#FFFFFF` |
| Coluna “Último desp.” | `#888780` |
| Linhas zebra | `#1A1A18` / `#111110` |
| Hover linha | `#2C2C2A` |
| Badges regime | `REGIME_COLORS` + alpha `26` no fundo |
| Badges substância | `COR_SUBSTANCIA` (ex.: `#0F6E56`, `#378ADD`, …) |
| Situação ativo / bloqueado / outro | `#1D9E75`, `#E24B4A`, `#888780` (com fundos rgba 15%) |
| **Empty state** | ícone `#5F5E5A`, mensagem `#888780` |

### 5.6 Empty states (ícones)

Ícones SVG dos cards vazios: traço `#5F5E5A`.

### 5.7 Tooltips internos (Inteligência)

Balões de KPI / hover: fundo `#0D0D0C`, borda `#2C2C2A`, texto `#D3D1C7` / título `#F1EFE8`.

### 5.8 Ranking — toggles “Por Área / Por Processos”

| Estado | Hex |
|--------|-----|
| Inativo | fundo `#0D0D0C`, borda `#2c2c2a`, texto `#888780` |
| Ativo | fundo `#2C2C2A`, texto `#F1EFE8` |
| Hover (classe) | borda `#888780` |

---

## 6. Aba **Radar** (placeholder)

| Elemento | Hex |
|----------|-----|
| Fundo | `#0D0D0C` |
| Título | `#F1EFE8` |
| Parágrafo | `#888780` |

---

## 7. Notas para designers / devs

1. **Âmbar de ação** aparece como `#EF9F27` (token) ou `#F1B85A` em links tipo “Limpar tudo” no header de Inteligência — são dois tons propositadamente distintos.
2. **Azul de dados** `#378ADD` aparece em regime “Concessão de Lavra”, KPIs, pills de substância e alguns gráficos.
3. Para **novos componentes**, preferir sempre `--bg-*`, `--text-*` e `--terrae-*` em `index.css` / Tailwind antes de introduzir hex soltos.
4. O mapa base (tiles Mapbox) não segue esta paleta; só o **chrome** e as **camadas vectoriais** (processos) usam estes hex.

---

*Última revisão com base no código do repositório Terrae (ficheiros em `src/` e `tailwind.config.ts`).*
