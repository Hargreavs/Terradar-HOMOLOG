# Especificação visual: Popover de processo × Drawer Relatório Completo

Documento gerado a partir do código em `src/components/map/ProcessoPopup.tsx` e `src/components/map/RelatorioCompleto.tsx` (e componentes referenciados: `RegimeBadge`, `BadgeSubstancia`, `index.css`). Serve como referência de tokens visuais; não substitui o código.

---

## 1. Popover de processo (`ProcessoPopup.tsx`)

### 1.1 Dimensões e empilhamento

| Token | Valor |
|--------|--------|
| Largura (`POPUP_W`) | `300px` |
| `z-index` do cartão (`POPUP_Z`) | `1` |
| Raio do cartão | `border-radius: 10px` (`rounded-[10px]`) |
| `box-sizing` | `border-box` (classe Tailwind) |

### 1.2 Cartão principal (fundo do popover)

| Propriedade | Valor |
|-------------|--------|
| `backgroundColor` | `#1A1A18` |
| `border` | `1px solid rgba(241, 239, 232, 0.12)` |
| `boxShadow` | `0 4px 14px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1)` |
| `overflow` | `hidden` |
| `text-align` | `left` |

### 1.3 Cabeçalho (número + fechar + regime)

- **Padding superior:** `pt-4` + horizontal `px-4` (área do título).
- **Número do processo:** `text-[17px]`, `font-bold`, `leading-snug`, cor `#F1EFE8`.
- **Botão fechar (✕):** `text-[17px]`, `leading-none`, cor `#B8B5AC`, hover `#F1EFE8`, `transition-colors`.
- **Regime:** `RegimeBadge` com `variant="popup"` (ver secção 3.1).

### 1.4 Separadores horizontais

- **Entre blocos:** `h-px`, `bg-[#2C2C2A]`, margens `my-3` (full width dentro da coluna com padding).

### 1.5 Linhas de metadados (UF/município, substância, área, titular)

- **Container:** `flex items-start gap-2.5`, `text-[15px]`, cor texto `#D3D1C7`.
- **Ícones (MapPin, substância, Scan, Building2):** tamanho `16`, cor padrão `#888780` (`ICON_POPUP.color`), `strokeWidth: 1.5`; ícone da substância usa cor da paleta `SUBSTANCIA_DEFS`.
- **Texto:** `leading-snug`.
- **Badge de substância:** `BadgeSubstancia` `variant="popup"` (ver secção 3.2).

### 1.6 Secção “Risk Score”

- **Título da secção:** `text-[13px]`, `font-medium`, `uppercase`, `tracking-[1px]`, cor `#888780`, margens `mt-4 mb-2.5`.
- **Score total N/A:** `text-[15px]`, `font-medium`, cor `#E8E6DF`.

#### Barra total do risk score

- **Trilho:** `height: 5`, fundo `#2C2C2A`, `rounded-sm`, `overflow-hidden`.
- **Preenchimento:** mesma altura, cor por faixa (`riskTierColor`, ver 1.9).
- **Valor numérico:** `w-[40px]`, `text-right`, `tabular-nums`, `text-[15px]`, `font-bold`, cor = faixa.

#### Breakdown por dimensão (Geológico, Ambiental, Social, Regulatório)

- **Espaçamento vertical entre linhas:** `space-y-1.5`; bloco com `mt-5` e `mb-5` condicional se houver alertas.
- **Label:** largura fixa `w-[112px]`, `text-[15px]`, cor `#888780`.
- **Trilho:** `height: 3`, fundo `#2C2C2A`, `rounded-sm`.
- **Valor:** `w-[40px]`, `text-[15px]`, `font-medium`, `tabular-nums`, cor = faixa.

### 1.7 Cores de faixa de risco (`riskTierColor`)

| Condição | Cor |
|----------|-----|
| `v < 40` | `#1D9E75` |
| `v < 70` | `#E8A830` |
| caso contrário | `#E24B4A` |

### 1.8 Secção “Alertas legislativos”

- **Separador acima:** `-mx-4`, `my-3`, `h-px`, `bg-[#2C2C2A]` (largura alargada em relação ao padding).
- **Área clicável (com alertas):** botão full width, `-mx-0.5`, `rounded-[6px]`, `py-[10px]`, `px-0.5`, fundo transparente, hover `bg-[#2C2C2A]`, transição 150 ms.

#### Cabeçalho “Alertas legislativos” + contagem

- **Título:** `text-[13px]`, `font-medium`, `uppercase`, `tracking-[1px]`, `#888780`.
- **Pill contagem:** `rounded-[10px]`, `text-[13px]`, `font-medium`, `tabular-nums`, `leading-none`, texto `#F1EFE8`, fundo `#2C2C2A`, padding inline `2px 9px`.
- **Chevron:** `ChevronRight` tamanho `14`, `strokeWidth` 2, cor `#5F5E5A`, hover grupo `#888780`.

#### Badge de impacto agregado (referência “IMPACTO ALTO” etc.)

- **Layout:** `inline-flex w-fit shrink-0 items-center justify-center`, `rounded-[4px]`, `font-semibold`, `uppercase`, `mt-2`.
- **Estilo inline:** `padding: 2px 6px`, `fontSize: 9`, `letterSpacing: 0.5px`, `color` e `border` vindos de `estiloImpactoAgregadoPopover` / `estiloImpactoOutlinePorNivel`, `backgroundColor: transparent`.

#### Título do alerta em destaque

- `mt-1.5`, `line-clamp-2`, `text-[15px]`, `leading-snug`, `#D3D1C7`.

### 1.9 Botão “Ver relatório completo”

- **Margem superior:** `mt-5`.
- **Layout:** `w-full`, `rounded-lg`, `py-3`, `text-[14px]`, `font-semibold`, sem borda.
- **Cores:** texto `#0D0D0C`; fundo `#EF9F27` (ou `#F1B85A` quando relatório já ativo para o processo).
- **Hover (estado não ativo):** fundo `#F1B85A` via `onMouseEnter` / `onMouseLeave`.

---

## 2. Modal drawer Relatório Completo (`RelatorioCompleto.tsx`)

### 2.1 Shell do drawer (painel fixo)

| Propriedade | Valor |
|-------------|--------|
| `position` | `fixed` |
| `top` | `48px` |
| `right` | `0` |
| `width` | `520px` |
| `height` | `calc(100vh - 48px)` |
| `z-index` | `50` |
| `display` | `flex`, coluna |
| `backgroundColor` | `#111110` |
| `borderLeft` | `1px solid #2C2C2A` |
| `transform` (aberto/fechado) | `translateX(0)` / `translateX(100%)` |
| `transition` | `transform 300ms ease-out` |
| `box-sizing` | `border-box` |

### 2.2 Cabeçalho do drawer

| Propriedade | Valor |
|-------------|--------|
| `height` | `56px` |
| `flexShrink` | `0` |
| `backgroundColor` | `#0D0D0C` |
| `borderBottom` | `1px solid #2C2C2A` |
| `padding` | `0 20px` |
| `display` | `flex`, `align-items: center`, `justify-content: space-between`, `gap: 12px` |

#### Número do processo (truncado)

- `fontSize: FS.base` → **15px**, `fontWeight: 500`, cor `#F1EFE8`.

#### `RegimeBadge` no drawer

- `variant="drawer"` (ver secção 3.1).

#### Botão “Exportar PDF”

- `minHeight: 28`, `border-radius: 6px`, `padding: 4px 12px`, `fontSize: FS.md` → **14px**, `fontWeight: 400`, borda `1px solid #F1EFE8` (ou `#5F5E5A` desabilitado), fundo transparente, hover fundo `rgba(241, 239, 232, 0.08)`.
- Ícone SVG interno: 16×16.

#### Separador vertical (Exportar | Fechar)

- `width: 1`, `height: 16`, `#2C2C2A`, margens horizontais `12px`.

#### Botão fechar (✕)

- `fontSize: 20`, `lineHeight: 1`, cor `#F1EFE8`, hover `#FFFFFF`, fundo/borda transparentes.

### 2.3 Navegação por abas (Processo, Território, Inteligência, Risco, Fiscal)

| Propriedade | Valor |
|-------------|--------|
| `height` | `44px` |
| `backgroundColor` | `#0D0D0C` |
| `borderBottom` | `1px solid #2C2C2A` |
| `padding` | `0 16px` |
| `gap` | `4px` |
| `overflow-x` | `auto` |

#### Botão de aba

- `fontSize: FS.lg` → **16px**, `padding: 0 8px`, `height: 100%`.
- **Ativa:** `fontWeight: 700`, cor `#F1EFE8`, `border-bottom: 2px solid #EF9F27`.
- **Inativa:** `fontWeight: 600`, cor `#5F5E5A`, borda inferior transparente; hover cor `#888780`.

### 2.4 Área de scroll do conteúdo

- **Classe:** `terrae-relatorio-drawer-scroll` (scrollbar fina; ver `index.css`).
- **Padding:** `22px`.
- **Layout:** coluna flex, `gap: 14px`.
- **Modo PDF:** classe extra `terrae-relatorio--pdf-export` quando aplicável.

### 2.5 Escala tipográfica `FS` (drawer)

| Token | px |
|-------|-----|
| `min` | 12 |
| `sm` | 13 |
| `md` | 14 |
| `base` | 15 |
| `lg` | 16 |
| `metric` | 17 |
| `xl` | 18 |
| `xxl` | 21 |
| `h2` | 23 |
| `display` | 26 |
| `hero` | 56 |
| `jumbo` | 58 |
| `highlight` | 32 |

### 2.6 `Card` (blocos de conteúdo)

- `backgroundColor: #1A1A18`
- `borderRadius: 8`
- `padding: 20px 18px`

### 2.7 Títulos de secção / subsecção

- **`subsecaoTituloStyle`:** `fontSize: FS.lg` (16), `fontWeight: 700`, `uppercase`, `letterSpacing: 1px`, cor padrão `SECTION_TITLE` = `var(--text-section-title)` → **`#b4b2a9`** (`index.css`).
- **`SecLabel`:** aplica o acima; variante `branco` usa `#F1EFE8`; `marginBottom` = `TITULO_SECAO_MARGIN_BOTTOM_PX` (**30px**).

### 2.8 `FonteLabel` (rodapé “Atualizado em…”)

- `display: block`, `text-align: right`, `marginTop` configurável (padrão 20px; relatório extra 32px em várias abas).
- `fontSize: 11`, `lineHeight: 1.45`, cor `#5F5E5A`.

### 2.9 Aba Risco – dimensões e alertas (trechos relevantes)

- **Título do score / métricas:** uso de `FS.display`, `FS.metric`, cores de faixa iguais à lógica `corFaixaRisco` (`#1D9E75` / `#E8A830` / `#E24B4A`).
- **Barras de dimensão:** trilho `#2C2C2A`, altura 6px, preenchimento com cor da faixa; texto descritivo dimensão `FS.md`, `#888780`, `lineHeight: 1.45`.
- **Alertas legislativos:** título `FS.md` + `#888780`; link “Ver no Diário” `FS.sm`, `#F1B85A` + ícone `ArrowUpRight` 14px; linha de metadata `FS.sm`, `#5F5E5A`; badge de impacto no relatório usa `estiloImpactoOutlinePorNivel` com padding `2px 6px`, `fontSize: 9px`, `lineHeight: 1`, `letterSpacing: 0.5px`, `fontWeight: 600`, `rounded-[4px]`, `uppercase`, `leading-none`, fundo transparente (detalhe fino pode evoluir no código).

### 2.10 Variáveis CSS globais úteis (`:root` em `index.css`)

| Variável | Valor |
|----------|--------|
| `--bg-primary` | `#0d0d0c` |
| `--bg-secondary` | `#111110` |
| `--bg-tertiary` | `#1a1a18` |
| `--bg-border` | `#2c2c2a` |
| `--text-primary` | `#f1efe8` |
| `--text-secondary` | `#888780` |
| `--text-tertiary` | `#5f5e5a` |
| `--text-section-title` | `#b4b2a9` |

---

## 3. Componentes partilhados (diferença popup × drawer)

### 3.1 `RegimeBadge`

- **Popup:** borda ~`1.5px` na cor do regime, texto uppercase, `fontSize: 11`, `padding: 3px 10px`, `borderRadius: 4`, fundo transparente, etc.
- **Drawer:** `minHeight: 28`, `borderRadius: 6`, `padding: 0 10px`, `fontSize: 14`, `fontWeight: 500`, fundo cor do regime com alpha `26` em hex (`${color}26`), borda inferior pontilhada.

### 3.2 `BadgeSubstancia`

- **Popup:** `fontSize: 11`, `padding: 2px 8px`, borda/cor via `estiloBadgeSubstanciaPaletaV2`, uppercase, `letterSpacing: 0.5px`, `borderRadius: 4`.

---

## 4. Badges de impacto legislativo (cores compartilhadas)

Definidas em `src/lib/alertaNivelImpactoBadge.ts` (`estiloImpactoOutlinePorNivel` / agregado do popover):

| Nível | Label | Cor texto | Borda (exemplo) |
|-------|--------|-----------|-----------------|
| 1 | IMPACTO ALTO | `#E24B4A` | `1px solid rgba(226, 75, 74, 0.3)` |
| 2 | IMPACTO MÉDIO | `#E8A830` | `1px solid rgba(232, 168, 48, 0.3)` |
| 3 | IMPACTO BAIXO | `#1D9E75` | `1px solid rgba(29, 158, 117, 0.3)` |
| 4 | INFORMATIVO | `#888780` | `1px solid rgba(136, 135, 128, 0.3)` |

---

*Última extração alinhada ao repositório local; conferir sempre os ficheiros fonte para valores definitivos.*
