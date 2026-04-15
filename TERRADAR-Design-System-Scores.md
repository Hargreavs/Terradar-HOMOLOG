# TERRADAR — Design System: componentes de Risk Score

Documento de referência visual extraído do código (sem alterações). Uso: alinhar a subaba **Oportunidade** à mesma linguagem visual.

**Paths principais**

| Área | Ficheiro |
|------|----------|
| Popover do mapa | `src/components/map/ProcessoPopup.tsx` |
| Drawer + abas + card Risk Score + Alertas | `src/components/map/RelatorioCompleto.tsx` |
| Decomposição (acordeões) | `src/components/map/RiskDecomposicaoRelatorioPanel.tsx` |
| Cores faixa + dimensões + pesos | `src/lib/riskScoreDecomposicao.ts` |
| Badge regime (popup/drawer) | `src/components/ui/RegimeBadge.tsx` |
| Barra de impacto legislativo | `src/components/legislativo/AlertaItemImpactoBar.tsx` |

---

## 1. Popover do processo (`ProcessoPopupContent`)

Constante: `POPUP_W = 300` → **largura total 300px**.

### 1.1 Container

| Propriedade | Valor |
|-------------|--------|
| Largura | `300` (px, inline + `className`) |
| Fundo | `#1A1A18` |
| Borda | `1px solid rgba(241, 239, 232, 0.12)` |
| Border-radius | `rounded-[10px]` → **10px** |
| Sombra | `0 4px 14px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1)` |
| Overflow | `overflow-hidden` |
| Alinhamento texto | `text-left` |

### 1.2 Header (número + fechar + regime)

- **Número do processo:** `text-[17px] font-bold leading-snug text-[#F1EFE8]`
- **Botão fechar (✕):** `text-[18px] leading-none text-[#888780]`, hover `text-[#D3D1C7]`, `border-0 bg-transparent p-0`
- **Layout:** `flex items-start justify-between gap-2`; bloco superior `px-4 pt-4`
- **Separador:** `my-3 h-px bg-[#2C2C2A]` (largura total)

**RegimeBadge `variant="popup"`** (`RegimeBadge.tsx` + `CamadaTooltipHover`):

- Wrapper: `inline-block` + `className="mt-3"` no popup
- Span: `borderRadius: 4`, `padding: '3px 10px'`, `fontSize: 11`, `fontWeight: 600`, `letterSpacing: '0.5px'`, `textTransform: 'uppercase'`, `lineHeight: 1.25`
- Cor do texto e borda: `REGIME_COLORS_MAP[regime]` (por regime; fallback `#888780`)
- `border: 1.5px solid ${c}`, `backgroundColor: 'transparent'`, `cursor: 'help'`

### 1.3 Dados cadastrais (ícones + texto)

Constante `ICON_POPUP`: `size: 16`, `color: '#888780'`, `strokeWidth: 1.5` (Lucide).

- **Container:** `space-y-[10px] px-4`
- **Cada linha:** `flex items-start gap-2.5 text-[15px] text-[#D3D1C7]`
- **Ícone:** `mt-0.5 shrink-0` (alinhamento ao texto)
- **Texto:** `leading-snug` (MapPin, substância com `BadgeSubstancia variant="popup"`, Scan área ha, Building2 titular)

### 1.4 Secção Risk Score (popover)

**Título "Risk Score"** (N/A ou com score):

- `mt-4 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]`

**N/A:** `text-[15px] font-medium text-[#E8E6DF]`

**Com score — função `riskTierColor(v)`** (popup):

| Condição | Hex |
|----------|-----|
| `v < 40` | `#1D9E75` |
| `v < 70` | `#E8A830` |
| senão | `#E24B4A` |

> **Nota:** No drawer, `corFaixaRisco` usa `v <= 69` para âmbar; no popup o limite superior da faixa âmbar é **&lt; 70** (69 fica âmbar em ambos).

**Barra total + número:**

- Linha: `flex w-full min-w-0 items-center gap-2`
- Track: `min-w-0 flex-1 overflow-hidden rounded-sm`, **altura 5px**, fundo `#2C2C2A`
- Fill: largura `min(100, max(0, r))%`, cor `riskTierColor(r)`, `rounded-sm`
- Número: `w-[40px] shrink-0 text-right tabular-nums text-[15px] font-bold leading-none`, cor = `riskTierColor(r)`
- Envoltório tooltip: `RiskScoreBarraTotalComTooltip` → `TerraTooltipWrap` com `className="min-w-0 flex-1 cursor-default"`

**Chevron expansão** (só se `risk_breakdown` existe):

- Botão: `flex shrink-0 … border-0 bg-transparent py-0 pr-1.5 pl-0 text-[#F1EFE8] transition-opacity hover:opacity-80`
- **ChevronRight** Lucide: `size={14}`, `strokeWidth={2}`, `className="transition-transform duration-150 ease-out"`, `transform: rotate(90deg)` quando expandido, senão `rotate(0deg)`

**Dimensões expandidas** (`risk_breakdown` + `riskScoreDetalheAberto`):

- Container: `mt-5 space-y-1.5` (+ `mb-5` se houver alertas)
- Cada linha: `RiskBreakdownRowComTooltip` → `flex w-full min-w-0 items-center gap-2`
- **Label:** `w-[112px] shrink-0 text-[15px] text-[#888780]` (Geológico, Ambiental, Social, Regulatório)
- **Barra:** altura **3px**, track `#2C2C2A`, fill `riskTierColor(val)`, largura `v%` com clamp 0–100
- **Valor:** `w-[40px] shrink-0 text-right tabular-nums text-[15px] font-medium`, cor = `riskTierColor(val)`

**Link "Ver decomposição completa":**

- `mt-3 box-border w-full … border-0 bg-transparent p-0 text-center text-[15px] transition-opacity hover:opacity-80`
- Cor texto: `#F1B85A`

### 1.5 Alertas regulatórios (popover)

- Separador full-bleed: `-mx-4 my-3 h-px bg-[#2C2C2A]`
- Título: `whitespace-nowrap text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]`
- Botão "Ver todos os X alertas": `mt-2 flex w-full … text-[15px]`, texto e ícone `#F1B85A`, `ChevronRight` size 14

### 1.6 Botão "Ver relatório completo"

- `mt-5 w-full rounded-lg border-0 px-0 py-3 text-[14px] font-semibold transition-[background-color] duration-200 ease-in-out`
- Texto: `#0D0D0C`
- Fundo default: `#EF9F27`; quando relatório já ativo para o processo: `#F1B85A`
- Hover (se não ativo): fundo → `#F1B85A`
- Largura: `w-full` (100% do popover 300px)

### 1.7 ASCII — bloco Risk (popover)

```
┌────────────────────────────────────── 300px ──────────────────────────────────────┐
│  864.xxx/xxxx                                                    ✕                │
│  [ REGIME ]                                                                      │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  📍 TO / Município                                                               │
│  ○ Substância (badge)                                                            │
│  ◻ 1.234,56 ha                                                                   │
│  ▢ Titular…                                                                      │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  RISK SCORE                                                                      │
│  [████████░░░░░░░░░░]  23    [>]                                                 │
│     (5px track #2C2C2A)      chevron 14px                                       │
│  Geológico    [bar 3px] 52                                                       │
│  …                                                                               │
│       Ver decomposição completa  (#F1B85A 15px)                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  ALERTAS REGULATÓRIOS                                                            │
│  Ver todos os N alertas  >                                                       │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │          Ver relatório completo  (#0D0D0C on #EF9F27, py-3, rounded-lg)     │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Drawer Relatório completo — geral

- **Painel:** `width: 520`, `height: calc(100vh - 48px)`, `backgroundColor: '#111110'`, `borderLeft: '1px solid #2C2C2A'`
- **Conteúdo scroll:** `padding: 22`, `display: flex`, `flexDirection: column`, `gap: 14` entre cards
- **FS (tipografia drawer):** objeto `FS` em `RelatorioCompleto.tsx`: `min: 12`, `sm: 13`, `md: 14`, `base: 15`, `lg: 16`, …, `jumbo: 58` (valores em **px**).

### 2.1 Card genérico (`Card`)

- `backgroundColor: '#1E1E1C'`
- `borderRadius: 8`
- `padding: '20px 18px'`

### 2.2 `subsecaoTituloStyle` (títulos tipo secção)

- `fontSize: FS.lg` → **16px**
- `fontWeight: 700`
- `textTransform: 'uppercase'`
- `letterSpacing: '1px'`
- `color: SECTION_TITLE` → CSS `var(--text-section-title)` = **`#b4b2a9`** (`src/index.css`)

### 2.3 `SecLabel`

- Aplica `subsecaoTituloStyle` + `marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX` (**30px**)
- `branco`: cor `#F1EFE8` em vez de `SECTION_TITLE`

### 2.4 `FonteLabel`

- `display: block`, `textAlign: right`
- `marginTop`: default **20px** ou `FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX` (**32px**) nas abas relatório
- `fontSize: 11`, `lineHeight: 1.45`, `color: '#5F5E5A'`
- Texto: `Atualizado em DD/MM/YYYY · Fonte: …` (se ISO válido)

---

## 3. Abas do drawer (`<nav>`)

| Propriedade | Valor |
|-------------|--------|
| Altura | `44px` |
| Fundo | `#0D0D0C` |
| Borda inferior | `1px solid #2C2C2A` |
| Padding horizontal | `16px` |
| Layout | `display: flex`, `alignItems: center`, `gap: 4` |
| Overflow | `overflowX: 'auto'` → **scroll horizontal** se não couber (5 abas: Processo, Território, Inteligência, Risco, Fiscal) |

**Botão tab:**

- `fontSize: FS.md` → **14px**
- `fontWeight: 600`
- `padding: '0 8px'`, `height: '100%'`
- `whitespace-nowrap`
- **Ativa:** `color: '#F1EFE8'`, `borderBottom: '2px solid #EF9F27'`
- **Inativa:** `color: '#888780'`, `borderBottom: '2px solid transparent'`
- **Hover (inativa):** `color: '#B4B2A9'`

**Largura útil:** drawer 520px − padding lateral do nav (16px×2) ≈ 488px para as 5 tabs; com `overflow-x-auto`, labels longos não quebram linha.

---

## 4. Subaba Risco — Card "Risk Score" (resumo)

**Título "Risk Score":**

- `...subsecaoTituloStyle`, `color: '#F1EFE8'` (override do cinza secção), `textAlign: 'center'`, `marginBottom: 10`

**Número grande (score):**

- `fontSize: FS.jumbo` → **58px**
- `fontWeight: 500`
- `textAlign: 'center'`
- `margin: '0 0 8px 0'`
- Cor: `corFaixaRisco(processo.risk_score)` com **tooltip** opcional (`CamadaTooltipHover` + `RiskTotalCalcTooltipContent`): sublinhado `borderBottom: 1px dotted` na mesma cor, `cursor: 'help'`, `fontVariantNumeric: 'tabular-nums'`
- Sem decomposição em memória: só `span` com cor da faixa

**Função `corFaixaRisco` (drawer):**

| Condição | Hex |
|----------|-----|
| `v < 40` | `#1D9E75` |
| `v <= 69` | `#E8A830` |
| senão | `#E24B4A` |

**Classificação** (`classificacaoRiscoTotal`): texto "Baixo risco" / "Risco médio" / "Alto risco"

- `fontSize: FS.lg` → **16px**
- `fontWeight: 700`
- `textAlign: 'center'`
- `color: '#D3D1C7'`

**Quatro barras (Geológico, Ambiental, Social, Regulatório):**

- Container: `marginTop: 18`, `flexDirection: 'column'`, `gap: 10`
- Linha: `display: flex`, `alignItems: center`, `gap: 10`
- Label: `fontSize: FS.base` (15px), `color: '#888780'`, `width: 100`, `flexShrink: 0`
- Track: `flex: 1`, `minWidth: 0`, **altura 5px**, `borderRadius: 3`, `backgroundColor: '#2C2C2A'`, `overflow: hidden`
- Fill: largura % do valor, `backgroundColor: cor` (= `corFaixaRisco(val)` — **faixa de risco**, não cor fixa por dimensão)
- Valor: `fontSize: FS.base`, `fontWeight: 700`, `color: cor`, `width: 36`, `textAlign: 'right'`, `fontVariantNumeric: 'tabular-nums'`

**Rodapé:** `FonteLabel` com `dataIso={timestamps.cadastro_mineiro}`, `fonte="Terrae, com dados ANM, FUNAI, ICMBio e IBGE"`, `marginTopPx={32}`.

---

## 5. Subaba Risco — `RiskDecomposicaoRelatorioPanel`

**FS local:** `sm: 13`, `md: 14`, `base: 15`, `lg: 16` (px).

### 5.1 Barra segmentada (pesos)

- Container: `display: flex`, `gap: 3`, **altura 6px**, `borderRadius: 3`, `overflow: hidden`, `width: 100%`
- Segmentos: `flex` proporcional a `PESOS_RISK_DIMENSAO` (25, 30, 25, 20 %)
- Cores fixas por dimensão — `CORES_DIMENSAO_RISK` (`riskScoreDecomposicao.ts`):

| Dimensão | Hex |
|----------|-----|
| Geológico | `#7EADD4` |
| Ambiental | `#4A9E4A` |
| Social | `#C87C5B` |
| Regulatório | `#E8A830` |

**Labels abaixo:** `display: flex`, `gap: 3`, `marginTop: 6`, `marginBottom: 16`

- Cada célula: `flex: peso`, `fontSize: FS.sm` (13), `fontWeight: 400`, `color: '#888780'`, `textAlign: 'center'`, `lineHeight: 1.25`
- Texto: `"Geo. 25%"` etc. (`labelPeso` + percentagem)

### 5.2 Acordeão por dimensão

**Botão header:**

- `width: 100%`, `display: flex`, `justifyContent: space-between`, `alignItems: center`, `gap: 8`
- `background: none`, `border: none`, `padding: '6px 0'`, `cursor: pointer`
- **ChevronRight** 14px: rotação 90° quando aberto; cor aberta `#F1EFE8`, fechada `#5F5E5A`, hover grupo → `#F1EFE8` (`group-hover`)
- Nome dimensão: `fontSize: FS.md` (14), `fontWeight: 700`, ellipsis quando necessário
- Mini barra: **72px** largura (max `22vw`), **altura 5px**, track `#2C2C2A`, fill `corFaixaRiscoValor(d.det.score)` — função:

| Valor | Hex |
|-------|-----|
| `< 40` | `#1D9E75` |
| `<= 69` | `#E8A830` |
| senão | `#E24B4A` |

- Valor dimensão: `fontSize: FS.lg` (16), `fontWeight: 700`, `color: corBar`, `borderBottom: 1px dotted`, `cursor: 'help'` (tooltip cálculo)

**Painel expandido (`PainelDetalheDimensaoAnimado`):**

- `marginTop: 10` quando aberto, `marginLeft: 20`, `paddingLeft: 12`
- `borderLeft: 2px solid ${corBar}30` (hex da faixa + **30** = opacidade em hex CSS 8 dígitos se aplicável — aqui é string `${corBar}30` para #RRGGBB + alpha)
- Animação `max-height` + `margin-top` (0.32s cubic-bezier)

**Variável (sub-score):**

- Linha título + valor: nome `fontSize: FS.md`, `color: '#D3D1C7'`
- Valor numérico: `fontWeight: 600`, `color: corV` (= `corFaixaRiscoValor(vrow.valor)`)
- Label qualitativo: `qualificadorRiscoVariavel` → "Risco baixo" / "Risco médio" / "Risco alto" / "-" com cores `#1D9E75` / `#E8A830` / `#E24B4A` / `#5F5E5A`
- Barra fina: **altura 4px**, track `#2C2C2A`, `borderRadius: 2`, fill `corV`, `opacity: 0.85` se valor > 0 senão `0.35`
- Parágrafo descritivo: `fontSize: FS.sm`, `color: '#888780'`, `margin: '6px 0 0 0'`, `lineHeight: 1.4`

---

## 6. Subaba Risco — Card "Alertas regulatórios"

- Título: `<SecLabel branco>Alertas regulatórios</SecLabel>` → estilo secção branco, `marginBottom: 30`
- Vazio: `fontSize: FS.base`, `color: '#888780'`
- Com itens: coluna, separador entre itens `height: 1`, `backgroundColor: '#2C2C2A'`, `margin: '16px 0'`
- **AlertaItemImpactoBar:** `barraAlturaFixaPx={48}`, tooltip z-index acima CFEM
- Título alerta: `fontSize: FS.md`, `color: '#888780'`, `lineHeight: 1.45`
- Link "Ver no Diário": `fontSize: FS.sm`, `fontWeight: 500`, `color: '#F1B85A'`, ícone `ArrowUpRight` 14px mesma cor
- Meta (relevância, fonte, data): mistura `FS.sm`, cores `#5F5E5A` e cor dinâmica `relevanciaMeta.cor` (`estiloBadgeRelevancia`)
- `FonteLabel` final: `timestamps.alertas_legislativos`, `fonte="Adoo"`

---

## 7. Tabela de cores — scores e UI

| Uso | Hex | Onde |
|-----|-----|------|
| Risco baixo (faixa) | `#1D9E75` | `corFaixaRisco`, `corFaixaRiscoValor`, `riskTierColor` (popup), números/barras por valor |
| Risco médio | `#E8A830` | Idem |
| Risco alto | `#E24B4A` | Idem |
| Geológico (barra pesos) | `#7EADD4` | `CORES_DIMENSAO_RISK.geologico` |
| Ambiental | `#4A9E4A` | `CORES_DIMENSAO_RISK.ambiental` |
| Social | `#C87C5B` | `CORES_DIMENSAO_RISK.social` |
| Regulatório (pesos) | `#E8A830` | `CORES_DIMENSAO_RISK.regulatorio` |
| Track barra | `#2C2C2A` | Popover, drawer, decomposição |
| Fundo card drawer | `#1E1E1C` | `Card` |
| Fundo drawer painel | `#111110` | Coluna fixa |
| Fundo header/nav drawer | `#0D0D0C` | Header + abas |
| Texto principal claro | `#F1EFE8` | Títulos, números destaque |
| Texto corpo | `#D3D1C7` | Cadastro, nomes variáveis |
| Texto secundário / labels | `#888780` | Labels dimensões, texto alerta |
| Texto desativado / meta | `#5F5E5A` | Rodapé fonte, meta alerta |
| Destaque link / CTA ouro | `#F1B85A` | Links popover, "Ver no Diário" |
| CTA primário popover | `#EF9F27` / hover `#F1B85A` | Botão relatório |
| Borda geral | `#2C2C2A` | Separadores, borda drawer |
| Título secção (var) | `#b4b2a9` | `--text-section-title` quando não override |
| Tab ativa underline | `#EF9F27` | Border-bottom 2px |

---

## 8. Componentes reutilizáveis (patterns)

| Pattern | Ficheiro | Notas |
|---------|----------|--------|
| Barra progresso horizontal | Inline + `div` absoluto | Track `#2C2C2A`, fill cor faixa ou dimensão; alturas 3–6px conforme contexto |
| Tooltip lateral | `TerraTooltipWrap` / `CamadaTooltipHover` | Risk popover, totais, dimensões |
| Acordeão | `RiskDecomposicaoRelatorioPanel` | `useState` + `ChevronRight` + animação `max-height` |
| Badge regime | `RegimeBadge` | `variant`: `popup` \| `drawer` \| `table` |
| Card | `Card` em `RelatorioCompleto.tsx` | Fundo `#1E1E1C`, radius 8, padding 20×18 |
| Rótulo secção | `SecLabel` | `subsecaoTituloStyle` + margin 30 |
| Fonte / timestamp | `FonteLabel` | 11px, direita, `#5F5E5A` |
| Barra impacto alerta | `AlertaItemImpactoBar` | Altura 48px no drawer |
| Badge substância (popup) | `BadgeSubstancia` | Dentro linha substância popover |

---

## 9. Diferenças popup vs drawer (faixa âmbar)

- **Popup `riskTierColor`:** âmbar se `v < 70` (logo **69** é âmbar).
- **Drawer `corFaixaRisco`:** âmbar se `v <= 69` (**69** é âmbar).

Valor **69** está na faixa âmbar em ambos; **70** é vermelho no drawer e âmbar no popup até 69 — para **70** ambos vermelhos. A única diferença fina é o tratamento no limite documentado nos fontes.

---

*Gerado a partir da leitura estática do código; não reflete alterações futuras não commitadas.*
