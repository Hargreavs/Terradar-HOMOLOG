# Inventário completo — Aba **Mapa** (Terrae)

Documento gerado apenas por leitura do código no repositório (`src/`, `tailwind.config.ts`, `src/index.css`). Nenhum ficheiro de implementação foi alterado. Última referência de código: estados atuais de `REGIME_COLORS`, estilos Mapbox e mocks descritos abaixo.

---

## 1. Inventário de cores (hex / rgba / CSS vars)

Valores agrupados por área funcional. Onde a cor vem de **Tailwind** (`dark-*`, `terrae-*`) ou **`:root`**, indicam-se o token e o hex resolvido.

### 1.1 Navbar (`src/components/layout/Navbar.tsx`)

| Elemento | Cor(es) | Notas |
|----------|---------|--------|
| Fundo | `#0D0D0C` | `bg-dark-primary` |
| Borda inferior | `#2C2C2A` | `border-dark-border` |
| Texto aba ativa | `#F1EFE8` | |
| Texto aba inativa | `#D3D1C7` | |
| Indicador de aba ativa | `#EF9F27` | `bg-terrae-200` (bolinha sob o label) |
| Logo — barras SVG | `#FAC775`, `#EF9F27`, `#BA7517`, `#854F0B`, `#633806` | `fill` explícitos |
| Logo — texto “TERRAE” | `#F1EFE8` | `fontSize` 18 no SVG |

### 1.2 Sidebar (`src/components/layout/Sidebar.tsx` + filtros)

**Shell da sidebar**

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `#111110` | `bg-dark-secondary` |
| Borda direita | `#2C2C2A` | `border-dark-border` |
| Título “Localização” / secções em filtros | `var(--text-section-title)` → `#B4B2A9` | via outros componentes |
| Botão expandir “+ / −” | `#888780` | |
| Label “UF” / “Município” | `var(--text-section-title)` |

**Dropdown UF (portal)**

| Elemento | Cor(es) |
|----------|---------|
| Fundo painel | `#1A1A18` | |
| Borda | `#2C2C2A` | |
| Sombra | `rgba(0,0,0,0.4)` | `0 8px 24px` |
| Item selecionado — fundo | `#2C2C2A` | |
| Item selecionado — texto | `#EF9F27` | |
| Item não selecionado — texto | `#D3D1C7` | hover texto `#F1EFE8` |
| Chevron | `#5F5E5A` | `currentColor` |

**Trigger UF**

| Estado | Borda | Texto |
|--------|-------|-------|
| Fechado | `#2C2C2A` (hover borda `#5F5E5A`) | `#F1EFE8` |
| Aberto | `#EF9F27` | `#F1EFE8` |

**Input município**

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `#1A1A18` | `bg-dark-tertiary` |
| Borda | `#2C2C2A` | `border-dark-border` |
| Texto | `#F1EFE8` | |
| Placeholder | `#5F5E5A` | `14px` no token placeholder |
| Desativado | opacidade `0.4` | cursor not-allowed |

**Camadas (`LayerToggles.tsx`)**

| Elemento | Cor(es) |
|----------|---------|
| Título secção | `var(--text-section-title)` |
| Divisórias / borda bloco | `#2C2C2A` | `divide-dark-border` |
| Dot de regime | Por `REGIME_COLORS[r]` (ver §1.3) | |
| Label camada | `#F1EFE8` | 13px |
| Linha desligada | opacidade `40%` sobre o grupo | |
| Toggle ON — trilha | `#BA7517` | `bg-terrae-400` |
| Toggle OFF — trilha | `#1A1A18` | `bg-dark-tertiary` |
| Bolinha do switch | `#F1EFE8` | |
| “Áreas bloqueadas” — ícone “!” | `#FFFFFF` texto, fundo `#A85C5C` | |
| Contador “N de 7 tipos” | `#888780` | 14px |

**Período (`PeriodoSlider.tsx`)**

| Elemento | Cor(es) |
|----------|---------|
| Título | `var(--text-section-title)` |
| Trilha base | `#2C2C2A` | altura 2px |
| Segmento selecionado | `#EF9F27` | |
| Anos (números) | `#F1EFE8` | 14px |
| Thumbs WebKit/Gecko | `#ef9f27` | 10×10px, inline no `<style>` do componente |

**Substâncias (`SubstanciaFilter.tsx`)**

| Elemento | Cor(es) |
|----------|---------|
| Checkbox (`accent-terrae-200`) | `#EF9F27` | |
| Label | `#F1EFE8` | 13px |
| Badge “ESTRATÉGICO” — fundo | `rgba(239, 159, 39, 0.15)` | |
| Badge — borda | `rgba(239, 159, 39, 0.4)` | |
| Badge — texto | `#BA7517` | 10px |

### 1.3 Mapa (`MapView.tsx` + `regimes.ts`)

**Polígonos (modo regime)** — cores vindas de `REGIME_COLORS`:

| Regime (`Regime`) | Hex |
|-------------------|-----|
| `concessao_lavra` | `#4A90B8` |
| `autorizacao_pesquisa` | `#5B9A6F` |
| `req_lavra` | `#8B7CB8` |
| `licenciamento` | `#7A9B5A` |
| `mineral_estrategico` | `#2D8B70` |
| `bloqueio_permanente` | `#A85C5C` |
| `bloqueio_provisorio` | `#C4915A` |
| Fallback GeoJSON | `#FF0000` se `color` ausente (não esperado no fluxo normal) |

**Pintura Mapbox (layers `processos-fill` / `processos-outline`)**

| Propriedade | Valor |
|-------------|--------|
| `fill-opacity` | `0.3` |
| `line-opacity` | `1` |
| `line-width` | `2.5` |

**Modo Risk Score** — função `corPorRisco`:

| Faixa | Hex | Uso |
|-------|-----|-----|
| `risk_score === null` | `#444441` | “Não calculado” |
| 0–39 | `#1D9E75` | Baixo |
| 40–69 | `#E8A830` | Médio |
| 70–100 | `#E24B4A` | Alto |
| Valor `< 0` (defensivo) | `#1D9E75` | |
| Outros | `#E24B4A` | |

**Hover em polígono**  
Não há alteração de cor do fill/outline no código: apenas `cursor: pointer` no canvas (`onMove` / `onLeave`).

**Fundo do contentor do mapa**  
`bg-dark-primary` → `#0D0D0C`.

**Estilos base Mapbox** (cores **definidas pelos estilos hospedados Mapbox**, não no repositório):

- `mapbox://styles/mapbox/satellite-streets-v12` (inicial)
- `mapbox://styles/mapbox/dark-v11`
- `mapbox://styles/mapbox/streets-v12`

### 1.4 Barra superior — SearchBar + Risk Score

**SearchBar (`SearchBar.tsx`)**

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `#1A1A18` | |
| Borda padrão | `#5F5E5A` | |
| Borda foco (`focus-within`) | `#FFFFFF` | |
| Texto digitado | `#F1EFE8` | 14px |
| Placeholder | `#888780` → `#FFFFFF` com foco no grupo | |
| Ícone lupa | `#888780` → `#FFFFFF` com foco | |
| Sombra dedicada | *Não definida* no componente | |

**RiskScoreMapToggle (`MapView.tsx`)**

| Estado | Fundo | Borda | Texto |
|--------|-------|-------|-------|
| Inativo | `#1A1A18` | `#2C2C2A` | `#888780` (hover texto `#EF9F27`) |
| Ativo | `#1A1A18` | `#EF9F27` | `#EF9F27` |
| Label | — | — | 14px uppercase |

**Toolbar wrapper**  
`translateY` animado conforme `MapChromeTransitionContext` (apenas posição, não cor).

### 1.5 Popup de processo (`ProcessoPopup.tsx`)

**Card**

| Elemento | Valor |
|----------|--------|
| Largura | 300px (`POPUP_W`) |
| Fundo | `#1A1A18` |
| Borda | `1px solid rgba(241, 239, 232, 0.12)` |
| `border-radius` | 10px |
| Sombra | `0 4px 14px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)` |

**Cabeçalho**

| Elemento | Cor / estilo |
|----------|----------------|
| Número processo | `#F1EFE8`, 16px semibold |
| Botão fechar | `#B8B5AC` → hover `#F1EFE8` |
| Badge regime | texto `REGIME_COLORS[regime]`, fundo `withAlpha(cor, 0.15)` |

**Corpo — ícones**  
`#8E8C84` (`currentColor` nos SVG). Texto valores: `#D3D1C7`, 14px (titular, substância, ha, UF/município).

**Separadores horizontais**  
`#2C2C2A`, 1px.

**Risk Score**

| Elemento | Cor |
|----------|-----|
| Título secção | `var(--text-section-title)` |
| Sem score | texto `#E8E6DF`, 14px — label “N/A” |
| Trilha barra total / mini-barras | `#2C2C2A` |
| Preenchimento faixas | `#1D9E75` / `#E8A830` / `#E24B4A` (mesma lógica `<40`, `≤69`, `>69`) |
| Labels dimensões breakdown | `#888780`, 13px |
| Valores numéricos breakdown | `#D3D1C7`, 13px, tabular-nums |

**Alertas (resumo no popup)**

| Elemento | Cor |
|----------|-----|
| Título “ALERTAS” | `var(--text-section-title)` |
| Badge contagem | fundo `#3F3F3C`, texto `#E8E6DF`, 11px |
| Link “Ver detalhes →” | aberto `#F1EFE8`, fechado `#888780` com hover `#F1EFE8` |

**Botão “Ver relatório completo”**

| Estado | Estilo |
|--------|--------|
| Borda | `#EF9F27` |
| Texto | `#F1EFE8`, 14px bold |
| Fundo | transparente |
| Ativo (drawer aberto no mesmo processo) | `rgba(239, 159, 39, 0.1)` |
| Hover (inativo) | `rgba(239, 159, 39, 0.1)` |
| Altura mín. | 48px |
| Animação / shimmer | *Nenhuma* (apenas hover) |

**Tip do popup Mapbox (`index.css`)**  
Alinhado ao fundo do card:

- Âncora `bottom`: `border-top-color: #1a1a18`
- Âncora `top`: `border-bottom-color: #1a1a18`

### 1.6 Painel de alertas legislativos (master-detail no popup)

Painel `PainelAlertasLegislativos`: posicionado `left: POPUP_W + gap`, `bottom: 0`, `z-index: 1`.

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `#1A1A18` |
| Borda | `1px solid #2C2C2A` |
| `border-radius` | 10px |
| Sombra | *Não* — apenas borda |
| Título | `#F1EFE8`, 14px medium |
| Botão fechar painel | `#B8B5AC` → hover `#F1EFE8` |
| Separador sob título | `#2C2C2A` |

**Badges nível** (`estiloBadgeNivelImpacto` em `alertaNivelImpactoBadge.ts`)

| Nível | Texto badge | Fundo | Texto |
|-------|-------------|-------|-------|
| 1 | ALTO | `#E24B4A26` | `#E24B4A` |
| 2 | MÉDIO | `#EF9F2726` | `#EF9F27` |
| 3 | BAIXO | `#1D9E7526` | `#1D9E75` |
| 4 | INFO | `#2C2C2A` | `#888780` |

**Tipo impacto** (texto ao lado do badge, `tipoImpactoTextColor`)

| `tipo_impacto` | Cor |
|----------------|-----|
| `restritivo` | `#E24B4A` |
| `favoravel` | `#1D9E75` |
| `neutro`, `incerto` | `#888780` |

**Botão “Acessar”**

| Estado | Estilo |
|--------|--------|
| Borda | `#6F6E6A` |
| Texto | `#ADABA3` |
| Hover | borda e texto `#F1EFE8` |
| Fundo | transparente, `rounded-full` |

**Título do alerta na lista**  
`#D3D1C7`, 13px. Separadores entre itens: `border-bottom: 1px solid #1A1A18` (exceto último).

### 1.7 Legendas flutuantes (`MapView.tsx`)

**Legenda Risk Score** (só com `modoVisualizacao === 'risco'`)

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `rgba(17, 17, 16, 0.9)` |
| Borda | `#2C2C2A` |
| Texto título | `var(--text-section-title)`, 12px uppercase |
| Texto auxiliar da caixa | `#888780` (classe no wrapper) |
| Marcadores | `#1D9E75`, `#E8A830`, `#E24B4A`, `#444441` |
| Labels itens | `#F1EFE8`, 13px |

**Legenda de regimes** (canto inferior direito)

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `rgba(17, 17, 16, 0.9)` |
| Borda | `#2C2C2A` |
| Título “Legenda” | `var(--text-section-title)`, 12px |
| Bolinhas | cada `REGIME_COLORS[r]` |
| Labels | `#F1EFE8`, 13px |

Ambas as caixas usam `border-radius: 8px`, padding `10px 12px`. Deslocamento horizontal quando o “chrome” do mapa está colapsado: `translateX(calc(100% + 32px))` com transição em ms vindas do contexto.

**Wrapper do seletor de estilo**  
Mesmo bloco visual: fundo `rgba(17,17,16,0.9)`, borda `#2C2C2A`, raio 8px.

### 1.8 MapStyleSwitcher (`MapStyleSwitcher.tsx`)

| Estado | Fundo ícone | Cor ícone |
|--------|-------------|-----------|
| Ativo | `#EF9F27` | `#0D0D0C` |
| Inativo | `#2C2C2A` | `#888780` |
| Hover inativo | `#333331` | — |

Botões `h-7`, ícones 18×18px, gap da grelha 6px.

### 1.9 Drawer Relatório completo (`RelatorioCompleto.tsx`) + `index.css`

**Shell**

| Elemento | Valor |
|----------|--------|
| Fundo | `#111110` |
| Borda esquerda | `1px solid #2C2C2A` |
| Largura | 520px |
| Altura | `calc(100vh - 48px)` |
| `top` | 48px (abaixo da navbar) |
| `z-index` | 50 |
| Transição abrir/fechar | `transform 300ms ease-out` (`translateX(0)` / `translateX(100%)`) |

**Header drawer**

| Elemento | Cor(es) |
|----------|---------|
| Fundo | `#0D0D0C` |
| Borda inferior | `#2C2C2A` |
| Título (nº processo) | `#F1EFE8`, `FS.base` (15px) |
| Badge regime | `REGIME_COLORS` + sufixo hex `26` em background |
| “Exportar PDF” | borda `#F1EFE8` ou disabled `#5F5E5A`, texto igual |
| Botão fechar | `#F1EFE8` → hover `#FFFFFF` |

**Navegação de abas**

| Estado | Cor texto | Indicador |
|--------|-----------|-----------|
| Ativa | `#F1EFE8`, weight 500 | `border-bottom: 2px solid #EF9F27` |
| Inativa | `#5F5E5A` | transparente |
| Hover inativa | `#888780` | — |
| `fontSize` | `FS.lg` (16px) | |

**Área de conteúdo**

| Elemento | Valor |
|----------|--------|
| Padding | 22px |
| Scrollbar (WebKit) | thumb `#2C2C2A`, hover `#5F5E5A`, largura 4px |
| Scrollbar (Firefox) | `scrollbar-color: #2c2c2a transparent` |

**Componente `Card` (todas as abas)**

| Propriedade | Valor |
|-------------|--------|
| Fundo | `#1A1A18` |
| `border-radius` | 8px |
| Padding | `20px 18px` |

**`SecLabel` / subtítulos**  
`subsecaoTituloStyle`: `fontSize` 16px, `color: var(--text-section-title)` → `#B4B2A9`, uppercase, letter-spacing 1px.

**`FonteLabel` (timestamps)**  
11px, `#5F5E5A`.

**Padrões recorrentes nas abas**  
(Sem listar cada parágrafo: o drawer usa combinações destes tokens.)

- Texto principal: `#F1EFE8`, `#D3D1C7`
- Métricas / destaques: varia por contexto (`#EF9F27` para ênfase financeira/KPIs, `#4A90B8` para alguns destaques “concessão”, semáforo risco `#1D9E75` / `#E8A830` / `#E24B4A` via `corFaixaRisco`)
- CAPAG (`capagCor`): `#5B9A6F` (A), `#7A9B5A` (B), `#C4915A` (C), `#A85C5C` (D)
- Tabelas: bordas/células em tons `#2C2C2A` / `#888780` conforme JSX por secção
- Export PDF overlay: `rgba(17,17,16,0.52)` + blur; spinner borda `rgba(239,159,39,0.28)`, topo `#ef9f27`, animação `terrae-pdf-export-spin` 0.85s linear

Para detalhe linha-a-linha de cada subsecção (Gráficos, tabelas de vizinhos, CFEM, etc.), o ficheiro-fonte excede mil linhas; a tipografia baseia-se na escala `FS` abaixo (§3).

### 1.10 Tooltips

| Tipo | Onde | Fundo | Borda | Sombra | Texto | Delay | Largura máx. |
|------|------|-------|-------|--------|-------|-------|--------------|
| **TerraSide** (`TerraSideTooltip.tsx`) | Risk toggles no mapa, linhas do breakdown no popup, truncagem, etc. | `#111110` | `rgba(241,239,232,0.16)` | `0 8px 24px rgba(0,0,0,0.45)` | `#F1EFE8`, 14px | *Imediato* no hover (fade 140ms ao fechar) | 300px default (`TERRA_SIDE_TOOLTIP_MAX_W`) |
| **CamadaTooltipHover** | Toggle de camadas na sidebar | `#0D0D0C` | `#2C2C2A` | *não* | `#D3D1C7`, 13px | **300ms** antes de abrir | 240px |
| **TextoTruncadoComTooltip** | UF trigger, título drawer quando truncado | Igual TerraSide quando abre | — | — | — | Só abre se texto truncado | 300px |

### 1.11 Controles Mapbox — CSS global (`index.css`)

| Seletor | Regra |
|---------|--------|
| `.mapboxgl-ctrl-logo` | `opacity: 0.35` |
| `.mapboxgl-ctrl-attrib` | `font-size: 10px`, `color: var(--text-tertiary)` → `#5F5E5A`, fundo `rgba(13,13,12,0.85)` |
| Links dentro da atribuição (`.mapboxgl-ctrl-attrib a`) | `color: var(--text-secondary)` → `#888780` |
| `.terrae-processo-popup` | conteúdo transparente; tip com cor `#1a1a18` (ver §1.5) |

---

## 2. Inventário de dados mock

### 2.1 `processos.mock.ts` → `PROCESSOS_MOCK`

**Tipo `Processo` (`src/types/index.ts`)** — campos:

| Campo | Tipo |
|-------|------|
| `id` | `string` |
| `numero` | `string` |
| `regime` | `Regime` |
| `fase` | `Fase` |
| `substancia` | `string` |
| `is_mineral_estrategico` | `boolean` |
| `titular` | `string` |
| `area_ha` | `number` |
| `uf` | `string` |
| `municipio` | `string` |
| `lat`, `lng` | `number` |
| `data_protocolo` | `string` |
| `ano_protocolo` | `number` |
| `situacao` | `'ativo' \| 'inativo' \| 'bloqueado'` |
| `risk_score` | `number \| null` (*no array exportado, todos têm número definido no seed*) |
| `risk_breakdown` | `RiskBreakdown \| null` (*exportado sempre preenchido por `riskBreakdownPara`*) |
| `valor_estimado_usd_mi` | `number` |
| `ultimo_despacho_data` | `string` |
| `alertas` | `AlertaLegislativo[]` (vazio para bloqueados / processos sem alertas) |
| `fiscal` | `DadosFiscais` |
| `geojson` | `GeoJSONPolygon` |

**`RiskBreakdown`**: `geologico`, `ambiental`, `social`, `regulatorio` — `number` 0–100.

**Valores ausentes no mock exportado**  
- `risk_score`: **sempre número** no `PROCESSOS_MOCK` final (seed fixa ou média do breakdown).  
- `risk_breakdown`: **sempre objeto** no export.  
- `valor_estimado_usd_mi` / `ultimo_despacho_data`: **sempre preenchidos** por funções geradoras.  
- `alertas`: **array vazio** para `p25`–`p30` (bloqueios) e qualquer processo onde `pickAlertas` devolve lista vazia (regra: `processoBloqueadoParaRisco` → `[]`).

**Tabela resumida dos 30 processos** (fonte: `processosSeed` + scores; `risk_breakdown` detalhado em `RISK_BY_ID` no mesmo ficheiro):

| id | numero | regime | substancia | titular | UF | risk_score | alertas (n) | Notas |
|----|--------|--------|------------|---------|-----|------------|---------------|-------|
| p1 | 872.390/2012 | concessao_lavra | FERRO | Vale Mineração S.A. | MG | 42 | 1–4 | Breakdown p1 |
| p2 | 841.102/2008 | concessao_lavra | OURO | St. George Mining Brasil | MG | 67 | … | |
| p3 | 910.445/2019 | concessao_lavra | BAUXITA | Companhia Brasileira de Metalurgia | MG | 31 | … | |
| p4 | 798.201/2001 | concessao_lavra | COBRE | Atlas Critical Minerals Brasil | MG | 18 | … | inativo |
| p5 | 883.667/2015 | concessao_lavra | QUARTZO | Serra Verde Mining Ltda. | MG | 55 | … | |
| p6 | 756.012/1995 | autorizacao_pesquisa | FERRO | Viridis Recursos Minerais Ltda. | MG | 48 | … | |
| p7 | 901.223/2018 | autorizacao_pesquisa | OURO | Vale Mineração S.A. | MG | 72 | … | |
| p8 | 822.556/2005 | autorizacao_pesquisa | BAUXITA | Companhia Brasileira de Metalurgia | MG | 39 | … | |
| p9 | 934.881/2021 | autorizacao_pesquisa | COBRE | St. George Mining Brasil | PA | 61 | … | |
| p10 | 888.334/2016 | autorizacao_pesquisa | QUARTZO | Atlas Critical Minerals Brasil | PA | 44 | … | |
| p11 | 845.991/2009 | autorizacao_pesquisa | FERRO | Serra Verde Mining Ltda. | PA | 53 | … | |
| p12 | 912.007/2019 | autorizacao_pesquisa | OURO | Viridis Recursos Minerais Ltda. | PA | 58 | … | |
| p13 | 771.448/1998 | autorizacao_pesquisa | BAUXITA | Vale Mineração S.A. | PA | 36 | … | |
| p14 | 925.112/2020 | req_lavra | FERRO | Companhia Brasileira de Metalurgia | PA | 74 | … | |
| p15 | 918.556/2020 | req_lavra | OURO | St. George Mining Brasil | GO | 81 | … | |
| p16 | 867.201/2013 | req_lavra | COBRE | Atlas Critical Minerals Brasil | GO | 69 | … | |
| p17 | 806.778/2003 | req_lavra | BAUXITA | Vale Mineração S.A. | GO | 77 | … | |
| p18 | 895.334/2017 | licenciamento | NIQUEL | Serra Verde Mining Ltda. | GO | 41 | … | |
| p19 | 879.901/2015 | licenciamento | QUARTZO | Viridis Recursos Minerais Ltda. | GO | 29 | … | |
| p20 | 802.445/2002 | licenciamento | FERRO | Companhia Brasileira de Metalurgia | GO | 52 | … | |
| p21 | 940.001/2022 | mineral_estrategico | NEODIMIO | Atlas Critical Minerals Brasil | BA | 84 | … | |
| p22 | 941.002/2022 | mineral_estrategico | NIOBIO | Viridis Recursos Minerais Ltda. | BA | 79 | … | |
| p23 | 942.003/2023 | mineral_estrategico | LITIO | St. George Mining Brasil | BA | 87 | … | |
| p24 | 943.004/2023 | mineral_estrategico | DISPRÓSIO | Serra Verde Mining Ltda. | BA | 82 | … | |
| p25 | 650.100/1987 | bloqueio_permanente | OURO | Vale Mineração S.A. | AM | 85 | **0** | bloqueado |
| p26 | 651.101/1991 | bloqueio_permanente | FERRO | Companhia Brasileira de Metalurgia | AM | 86 | **0** | |
| p27 | 652.102/1994 | bloqueio_permanente | BAUXITA | Atlas Critical Minerals Brasil | AM | 86 | **0** | |
| p28 | 960.501/2024 | bloqueio_provisorio | COBRE | St. George Mining Brasil | MT | 70 | **0** | |
| p29 | 961.502/2024 | bloqueio_provisorio | QUARTZO | Viridis Recursos Minerais Ltda. | MT | 71 | **0** | |
| p30 | 962.503/2024 | bloqueio_provisorio | OURO | Serra Verde Mining Ltda. | MT | 72 | **0** | |

Breakdown exato por id: ver matriz `RISK_BY_ID` em `processos.mock.ts` (p1–p30).

### 2.2 `relatorio.mock.ts` → `relatoriosMock`

**Export**: `Record<string, RelatorioData>` com chaves `p1`…`p30`.

**`RelatorioData`**

- `processo_id`, `dados_anm`, `territorial`, `intel_mineral`, `fiscal`, `timestamps`

**Campos com `null` possíveis na estrutura** (gerados por funções):

| Secção | Campos potencialmente `null` |
|--------|------------------------------|
| `dados_anm` | `prazo_vencimento` |
| `territorial` | `distancia_ti_km`, `nome_ti_proxima`, `distancia_uc_km`, `nome_uc_proxima`, `tipo_uc`, `distancia_aquifero_km`, `nome_aquifero`, `distancia_ferrovia_km`, `nome_ferrovia`, `distancia_porto_km`, `nome_porto`, `nome_quilombola` — conforme `territorialPorUf` / hash |
| `intel_mineral.processos_vizinhos[].risk_score` | `number \| null` — ver abaixo |

**Processos vizinhos e `risk_score` N/A**  
`vizinhosFicticios` usa `s.risk_score` do **Seed interno** de `relatorio.mock.ts`. Para **`p25`–`p30`** esse `risk_score` no Seed é **`null`**, logo **todos os vizinhos fictícios** desses relatórios têm `risk_score: null` (“N/A” na UI quando aplicável). Para `p1`–`p24`, o seed tem número e os vizinhos recebem valores derivados (± offset, limitados 12–92).

**Strings tipo “N/A” na UI do drawer**  
Aparecem como texto de interface onde o código formata fallback (ex.: risco ausente em tabelas), não como `null` guardado no mock de vizinhos para p1–p24.

### 2.3 `dashboard.mock.ts`

**`dashboardMock`** (usado na **Inteligência**, não no mapa diretamente, mas faz parte do conjunto de mocks do projeto):

| Chave | Conteúdo |
|-------|-----------|
| `alertas_recentes` | 4 itens `DashboardAlertaRecente` |
| `stats` | totais agregados (processos, área, riscos, UFs, etc.) |
| `por_regime` | contagens + cor hex por regime (rótulos PT) |
| `por_uf` | `uf`, `count`, `area_ha`, `risk_medio` |
| `producao_historica` | 2019–2024: `ferro`, `cobre`, `ouro`, `niobio`, `terras_raras` |
| `ranking_titulares` | 6 entradas com `substancias`, `risk_medio`, etc. |
| `minerais_estrategicos` | 6 minerais (Nd, Nb, Li, Dy, Pr, Tb) com preços, tendências, % |
| `calor_investimento` | pontos por UF (não detalhado aqui) |

**Dados faltantes**  
Estrutura satisfaz as interfaces; arrays podem ser vazios onde o tipo permite (ex.: `substancias_afetadas: []` no alerta `alerta-2`).

**Produção histórica (valores)**

| Ano | ferro | cobre | ouro | niobio | terras_raras |
|-----|-------|-------|------|--------|--------------|
| 2019 | 42000 | 1200 | 8 | 3400 | 10 |
| 2020 | 38000 | 980 | 6 | 3100 | 15 |
| 2021 | 45000 | 1400 | 11 | 3600 | 31.25 |
| 2022 | 48000 | 1650 | 14 | 3750 | 62.5 |
| 2023 | 51000 | 1820 | 18 | 3830 | 100 |
| 2024 | 50400 | 1980 | 22.4 | 3910 | 137.5 |

### 2.4 Alertas legislativos

**Catálogo em `processos.mock.ts` (`CATALOGO_ALERTAS`)** — usado para compor `processo.alertas`:

| id | titulo (resumo curto) | nivel_impacto | tipo_impacto | fonte | resumo (primeira frase) |
|----|------------------------|---------------|--------------|-------|--------------------------|
| anm-412-2025 | Portaria ANM nº 412/2025… | 1 | restritivo | ANM | Altera procedimentos para concessão de lavra… |
| anm-89-2025 | Resolução ANM nº 89/2025… | 1 | neutro | ANM | Redefine critérios de área mínima… |
| mme-11892-2025 | Decreto MME 11.892/2025… | 1 | favoravel | DOU | Inclui cobre e bauxita na lista nacional… |
| pec-48-2023 | PEC 48/2023… | 2 | restritivo | Senado | Proposta em tramitação que restringe novos títulos… |
| lei-15190-2025 | Lei 15.190/2025… | 2 | restritivo | DOU | Altera regras de consulta à FUNAI… |
| ibama-1234-2025 | Portaria IBAMA nº 1.234/2025… | 2 | restritivo | IBAMA | Exige novo EIA ou complementação… |
| pl-2197-2025 | PL 2.197/2025… | 3 | favoravel | Câmara | Prevê benefícios fiscais e linhas de crédito… |
| confaz-88-2025 | Convênio CONFAZ 88/2025… | 3 | favoravel | DOU | Redução de base de ICMS para exportação… |
| bndes-finep-2025-03 | Chamada pública BNDES/Finep… | 3 | favoravel | DOU | Financiamento não reembolsável… |
| antt-norte-sul-2025 | Edital ANTT: Ferrovia Norte-Sul… | 4 | favoravel | DOU | Concessão do trecho Palmas–Anápolis… |
| aneel-500kv-pa-2025 | Leilão ANEEL: linha 500 kV no Pará | 4 | favoravel | DOU | Projeto de TLT em corredor estratégico… |

**`dashboardMock.alertas_recentes`** (Inteligência):

1. `alerta-1` — PL terras raras em TIs — nível 1 — tipo “Projeto de Lei” — Câmara — resumo completo no mock.  
2. `alerta-2` — Portaria ANM prazos AP — nível 2 — Portaria — DOU.  
3. `alerta-3` — Decreto minerais críticos — nível 1 — Decreto — DOU.  
4. `alerta-4` — IBAMA APP — nível 2 — Resolução — DOU.

---

## 3. Inventário de tamanhos de fonte (aba Mapa)

| Componente | Texto / elemento | Tamanho (px) |
|------------|------------------|--------------|
| **Navbar** | “TERRAE” no SVG | 18 |
| **Navbar** | Labels Mapa / Radar / Inteligência | 14 |
| **Navbar** | Indicador aba ativa | ~4×4 (h-1 w-1) |
| **Sidebar** | Títulos secção Camadas/Período/Substâncias/Localização | 11 uppercase |
| **Sidebar** | Labels camadas | 13 |
| **Sidebar** | Contador camadas | 14 |
| **Sidebar** | UF dropdown itens | 13 |
| **Sidebar** | Trigger UF | 13 |
| **Sidebar** | Labels Localização | 13 |
| **Sidebar** | Input município | 13 (placeholder 14 no token) |
| **Sidebar** | “!” bloqueadas | 10 |
| **Sidebar** | Badge ESTRATÉGICO | 10 |
| **PeriodoSlider** | Anos | 14 |
| **SearchBar** | Input | 14 |
| **RiskScoreMapToggle** | “RISK SCORE” | 14 |
| **Legendas mapa** | Título | 12 |
| **Legendas mapa** | Itens | 13 |
| **MapStyleSwitcher** | (só ícones, sem texto) | ícone 18 |
| **ProcessoPopup** | Número | 16 semibold |
| **ProcessoPopup** | Badge regime | 13 semibold uppercase |
| **ProcessoPopup** | Linhas dados | 14 |
| **ProcessoPopup** | Secção Risk / labels dimensão | 12 / 13 |
| **ProcessoPopup** | N/A risk | 14 |
| **ProcessoPopup** | ALERTAS / contagem | 12 / 11 |
| **ProcessoPopup** | “Ver detalhes →” | 13 |
| **ProcessoPopup** | Botão relatório | 14 bold |
| **Painel alertas** | Título | 14 |
| **Painel alertas** | Badge nível | 12 |
| **Painel alertas** | Tipo impacto | 13 |
| **Painel alertas** | Botão Acessar | 12 |
| **Painel alertas** | Título alerta | 13 |
| **CamadaTooltipHover** | Corpo | 13 |
| **TerraSideTooltip** | Corpo | 14 |
| **Relatório drawer** | Escala `FS`: min 12, sm 13, md 14, base 15, lg 16, metric 17, xl 18, xxl 21, h2 23, display 26, hero 56, jumbo 58, highlight 32 | ver `RelatorioCompleto.tsx` |
| **Relatório** | `SecLabel` / subtítulos bloco | 16 |
| **Relatório** | `FonteLabel` | 11 |
| **Relatório** | Abas | 16 |
| **Relatório** | Header número | 15 |
| **Relatório** | Badge regime header | 14 |
| **index.css** | Atribuição Mapbox | 10 (!important) |

---

## 4. Interações e comportamentos

| Interação | Comportamento |
|-----------|----------------|
| **Clique em polígono** | Lê `properties.id`, encontra `Processo` na store, `selecionarProcesso`, abre `mapboxgl.Popup` com `ProcessoPopupContent`; handlers reanexam após mudança de estilo. |
| **Hover em polígono** | `cursor: pointer` no canvas. |
| **Posicionamento popup** | Âncora inicial `bottom`, offset 10px; após layout React, `agendarAnchorVerticalProcessoPopup` mede altura e escolhe `bottom` ou `top` para caber com margem 12px; classe `terrae-processo-popup--layout-pending` esconde até posicionar. |
| **Clique no mapa (fora)** | Se não for em feature nem dentro do popup: fecha popup; se drawer aberto, fecha drawer e após `320ms` limpa seleção; senão limpa seleção imediata. |
| **Painel alertas** | Toggle “Ver detalhes →” abre `PainelAlertasLegislativos` ao lado; botão ✕ fecha; ao mudar `processo.id`, painel fecha (`useEffect`). |
| **Drawer relatório** | `RelatorioCompleto` `transform` slide; abre via botão do popup (`setRelatorioDrawerAberto`); fechar header ou fluxo de clique fora; `useEffect` fecha drawer se `processoSelecionado` ficar null. |
| **Filtros sidebar** | `useMapStore.getProcessosFiltrados()` aplica camadas, período (`ano_protocolo`), UF, município (substring), faixa `risk_score` (exceto se `risk_score === null` no processo — não filtra por min/max nessas entradas), substâncias normalizadas, `searchQuery` (número ANM ou texto livre). GeoJSON atualizado no `useEffect` do MapView. |
| **Modo Risk Score** | Alterna `modoVisualizacao` `regime` ↔ `risco`; recomputa cores em `buildGeoJSON`; mostra legenda superior direita. |
| **Busca** | `searchQuery` em tempo real; **Enter** tenta `NUMERO_RX` e `requestFlyTo(lat,lng,10)` se encontrar processo. |
| **Seletor estilo** | `map.setStyle`; em `styledata` recria camadas/handlers e `setData` se necessário. |
| **Persistência** | `localStorage` chave `terrae-filtros` (Zustand `partialize`): `camadas`, `periodo`, `riskScoreMin`, `riskScoreMax`. `loadProcessos` remove `terrae-processos` e carrega sempre `PROCESSOS_MOCK`. |
| **Transições** | Sidebar: largura 280↔0 e `translateX` ao mudar para Inteligência/Radar (`chromeExitMs` 180ms default, `chromeEnterMs` 280ms). Overlays do mapa deslizam com a mesma curva. Redução de movimento: CSS vars → 1ms. |
| **FlyTo pré-selecionado** | No `load` do mapa, se já houver `processoSelecionado`, reabre popup e `flyTo` zoom 10. |

---

## 5. Estrutura de ficheiros (aba Mapa e dependências diretas)

| Caminho | Função |
|---------|--------|
| `src/App.tsx` | Layout: Navbar, flex Sidebar + MapView; contexto de transição do chrome. |
| `src/components/layout/Navbar.tsx` | Navegação entre Mapa / Radar / Inteligência. |
| `src/components/layout/Sidebar.tsx` | Filtros UF/município + compõe toggles/slider/substâncias. |
| `src/components/map/MapView.tsx` | Mapbox GL, camadas processos, legendas, SearchBar, Risk toggle, estilo, `RelatorioCompleto`. |
| `src/components/map/SearchBar.tsx` | Campo de busca e fly-to por número. |
| `src/components/map/MapStyleSwitcher.tsx` | Três estilos Mapbox. |
| `src/components/map/ProcessoPopup.tsx` | Conteúdo do popup + painel de alertas. |
| `src/components/map/RelatorioCompleto.tsx` | Drawer, abas, export PDF (html2canvas + jsPDF). |
| `src/components/filters/LayerToggles.tsx` | Toggles de regime/bloqueio. |
| `src/components/filters/PeriodoSlider.tsx` | Intervalo de anos. |
| `src/components/filters/SubstanciaFilter.tsx` | Checkboxes de substâncias. |
| `src/components/filters/CamadaTooltipHover.tsx` | Tooltip com delay 300ms. |
| `src/components/ui/TerraSideTooltip.tsx` | Tooltip lateral/above padrão Terrae. |
| `src/components/ui/TextoTruncadoComTooltip.tsx` | Ellipsis + tooltip se truncado. |
| `src/context/MapChromeTransitionContext.tsx` | Durações default transição chrome. |
| `src/store/useMapStore.ts` | Estado mapa: processos, filtros, seleção, flyTo, drawer flag, persistência parcial. |
| `src/store/useAppStore.ts` | `telaAtiva` (não listado aqui em detalhe). |
| `src/lib/regimes.ts` | `REGIME_COLORS`, labels, ordem de legenda/camadas. |
| `src/lib/alertaNivelImpactoBadge.ts` | Estilo badges ALTO/MÉDIO/BAIXO/INFO. |
| `src/lib/camadasTooltips.ts` | Textos longos dos tooltips de camada (import em `LayerToggles`). |
| `src/data/processos.mock.ts` | Gera `PROCESSOS_MOCK` + catálogo de alertas. |
| `src/data/relatorio.mock.ts` | `relatoriosMock` por `processo_id`. |
| `src/data/dashboard.mock.ts` | Dados agregados (principalmente Inteligência). |
| `src/data/brasil-ufs-paths.ts` | Geometrias UF (usado noutros ecrãs, não no MapView). |
| `src/types/index.ts` | Tipos `Processo`, `AlertaLegislativo`, filtros, etc. |
| `src/index.css` | Mapbox, popup Terrae, scroll drawer, overlay PDF, variáveis `:root`. |
| `tailwind.config.ts` | Tokens `terrae`, `dark`. |

**Nota:** Não existe pasta `src/utils/` com ficheiros no inventário atual; **não há `relatorioHtml.ts`** — geração de PDF está em `RelatorioCompleto.tsx`.

---

*Fim do inventário.*
