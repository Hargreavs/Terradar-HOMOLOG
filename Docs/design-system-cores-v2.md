# TERRAE — Design System de Cores v2.0

## Documento de Referência para Produção

**Versão:** 2.0 (proposta)  
**Status:** Aprovado para implementação pós-demo  
**Autores:** Alex + Claude (sócios fundadores)  
**Data:** Março 2026

---

## 1. Filosofia da Paleta

O Terrae é uma plataforma de inteligência mineral geoespacial. Suas cores devem comunicar três coisas simultaneamente:

1. **Confiança institucional** (produto usado por reguladores, fundos de investimento e mineradoras)
2. **Conexão com a terra** (mineração, geologia, estratigrafia, território brasileiro)
3. **Clareza analítica** (dashboards densos com múltiplas camadas de informação)

A paleta segue o princípio "earth-tone warm": tons terrosos de saturação média que remetem a minerais, solos e paisagens naturais. Cores altamente saturadas são reservadas exclusivamente para semântica de risco (semáforo universal).

### Regra de ouro

Nenhuma cor pode ter duplo significado. Cada cor pertence a uma única camada semântica. Se uma cor significa "risco alto", ela nunca pode significar também "regime de bloqueio" ou "substância cobre".

---

## 2. Arquitetura de Camadas

A paleta é organizada em 5 camadas independentes que nunca se confundem:

| Camada | Propósito | Onde aparece | Qtd. cores |
|--------|-----------|--------------|------------|
| 1. Interface | Chrome da aplicação, fundos, texto, bordas, ações | Toda a UI | ~15 tokens |
| 2. Marca | Identidade Terrae, destaques financeiros | Logo, foco, sliders, valores USD | 7 tons âmbar |
| 3. Semântica de risco | Sinalização universal de perigo/segurança | Risk Score, badges, barras | 3 cores fixas |
| 4. Regimes minerários | Categorias jurídicas ANM | Polígonos mapa, badges, barras, legenda | 7 cores |
| 5. Dados geoespaciais | Substâncias, territórios, camadas ambientais | Gráficos, pills, camadas do mapa | 15+ cores |

---

## 3. Camada 1: Interface

Base escura warm com hierarquia clara de profundidade. Estes tokens NÃO mudam na v2.

### Fundos (do mais profundo ao mais elevado)

| Token | Hex | Uso |
|-------|-----|-----|
| bg-primary | `#0D0D0C` | Fundo app, navbar, thead, inputs |
| bg-secondary | `#111110` | Sidebar, linhas zebra, tooltip lateral |
| bg-tertiary | `#1A1A18` | Cards, painéis, popup, dropdowns |
| bg-border | `#2C2C2A` | Bordas, separadores, trilhos de barra, pills inativas |
| bg-hover | `#3D3D3A` | Hover de linhas, bordas sutis do mini-mapa |
| bg-elevated | `#4A4A48` | Thumb de scrollbar hover, elementos elevados |

### Texto (do mais visível ao mais apagado)

| Token | Hex | Uso |
|-------|-----|-----|
| text-primary | `#F1EFE8` | Títulos, valores de destaque, estados ativos |
| text-body | `#D3D1C7` | Corpo em cards, popups, valores em tabelas |
| text-section | `#B4B2A9` | Títulos de seção uppercase, cabeçalhos |
| text-secondary | `#888780` | Subtítulos, eixos, labels inativos, placeholders |
| text-tertiary | `#5F5E5A` | Desabilitado, notas de fonte, timestamps |

### Sombras

| Contexto | Valor |
|----------|-------|
| Dropdowns, MonthPicker | `0 8px 24px rgba(0,0,0,0.35)` |
| Tooltips | `0 4px 16px rgba(0,0,0,0.45)` |
| Badge hover | `0 0 0 1px rgba(136,135,128,0.2)` |

### Border-radius

| Elemento | Valor |
|----------|-------|
| Painéis, cards | 8px |
| Subcards, inputs, botões | 6px |
| Badges | 4px |
| Pills, toggles | 999px |

---

## 4. Camada 2: Marca Terrae

Escala âmbar derivada da identidade visual (estratigrafia geológica). Usada EXCLUSIVAMENTE para:

- Logo e elementos de marca
- Ações de interface (foco, hover, links primários)
- Destaques financeiros (valores USD, KPI de valor)
- Sliders, toggles ativos, indicador de aba ativa

| Token | Hex | Uso principal |
|-------|-----|---------------|
| terrae-50 | `#FAEEDA` | Hover muito sutil (raro) |
| terrae-100 | `#FAC775` | Logo faixa clara |
| terrae-200 | `#EF9F27` | Âmbar primário: foco, ativo, destaque financeiro |
| terrae-300 | `#F1B85A` | Links de ação ("Limpar tudo", "Ver todos no Radar") |
| terrae-400 | `#BA7517` | Borda thumb range, detalhes escuros |
| terrae-600 | `#854F0B` | Gradiente track |
| terrae-800 | `#633806` | Logo faixa escura |
| terrae-900 | `#412402` | Escala profunda |

**Regra:** o âmbar `#EF9F27` NÃO é usado para regime minerário nem substância na v2. É reservado exclusivamente para interface e marca.

---

## 5. Camada 3: Semântica de Risco

Três cores fixas universais (semáforo). Usadas EXCLUSIVAMENTE para:

- Risk Score (badges, barras, mini-mapa, KPI)
- Alertas de impacto (ALTO, MÉDIO, BAIXO)
- Situação de processos (Ativo, Inativo)
- Colorização de datas por recência

| Nível | Hex | Uso |
|-------|-----|-----|
| Baixo (< 40) | `#1D9E75` | Verde semáforo |
| Médio (40-69) | `#E8A830` | Âmbar semáforo (ligeiramente diferente do terrae-200 para não confundir com marca) |
| Alto (≥ 70) | `#E24B4A` | Vermelho semáforo |
| Neutro / N/A | `#5F5E5A` | Sem score calculado |

**Regra:** verde `#1D9E75`, âmbar `#E8A830` e vermelho `#E24B4A` NUNCA são usados para regimes, substâncias ou camadas geoespaciais. São exclusivos de risco e status.

---

## 6. Camada 4: Regimes Minerários

Paleta earth-tone de saturação média. Cada cor remete a um conceito visual do regime.

### Paleta proposta v2

| Regime | Hex v2 | Hex v1 (atual) | Conceito visual |
|--------|--------|----------------|-----------------|
| Concessão de Lavra | `#4A90B8` | `#378ADD` | Azul petróleo, solidez industrial, título definitivo |
| Autorização de Pesquisa | `#5B9A6F` | `#1D9E75` | Verde sálvia, exploração inicial, fase investigativa |
| Req. de Lavra | `#8B7CB8` | `#7F77DD` | Lavanda mineral, transição, processo em andamento |
| Licenciamento | `#7A9B5A` | `#639922` | Verde oliva, permissão ambiental, compliance |
| Mineral Estratégico | `#2D8B70` | `#0F6E56` | Esmeralda, valor estratégico, importância nacional |
| Bloqueio Permanente | `#A85C5C` | `#E24B4A` | Terracota escuro, restrição definitiva, área vedada |
| Bloqueio Provisório | `#C4915A` | `#EF9F27` | Areia dourada, restrição temporária, aguardando decisão |

### Por que mudar Bloqueios

Na v1, Bloqueio Permanente usa `#E24B4A` (= vermelho de risco alto) e Bloqueio Provisório usa `#EF9F27` (= âmbar da marca e risco médio). Isso cria confusão: um polígono vermelho no mapa é alto risco ou bloqueio permanente? Na v2, bloqueios usam terracota e areia, tons que comunicam "restrição" sem confundir com o semáforo de risco.

### Regra de aplicação

Cores de regime aparecem em: polígonos do mapa (fill com opacidade 0.3, stroke opacidade 1.0), badges na tabela e popup (fundo cor + sufixo `26` para 15% opacidade), barras horizontais no dashboard, legenda do mapa.

---

## 7. Camada 5: Dados Geoespaciais

Esta é a camada mais complexa porque abrange múltiplos tipos de informação que aparecem simultaneamente no mapa e no dashboard. Organizada em subcategorias.

### 7.1 Substâncias Minerais

Cores que remetem ao aspecto visual real do mineral ou à sua associação industrial.

| Substância | Hex v2 | Hex v1 (atual) | Referência |
|-----------|--------|----------------|------------|
| Ferro | `#7EADD4` | `#378ADD` | Azul aço, ferro oxidado em ambiente industrial |
| Cobre | `#C87C5B` | `#E24B4A` | Cor natural do cobre metálico |
| Ouro | `#D4A843` | `#EF9F27` | Dourado, diferente do âmbar da marca |
| Nióbio | `#5CBFA0` | `#1D9E75` | Turquesa mineral, liga metálica |
| Terras Raras | `#3D8B7A` | `#0F6E56` | Jade, raridade e valor |
| Lítio | `#9BB8D0` | `#0F6E56` | Azul cristalino, baterias, leve |
| Bauxita | `#B8917A` | fallback cinza | Terracota claro, cor real da bauxita |
| Quartzo | `#C4B89A` | fallback cinza | Areia/cristal, tom neutro terroso |
| Manganês | `#8C7A6D` | N/A (futuro) | Marrom mineral escuro |
| Grafite | `#6B7178` | N/A (futuro) | Cinza grafite metálico |
| Vanádio | `#7B8E7D` | N/A (futuro) | Verde acinzentado industrial |
| Fosfato | `#A8B87A` | N/A (futuro) | Verde claro agrícola |
| Estanho | `#9E9A8E` | N/A (futuro) | Cinza warm metálico |
| Fallback (outros) | `#888780` sobre `#2C2C2A` | igual | Cinza neutro |

### 7.2 Camadas Ambientais e Territoriais

Cores para áreas de sobreposição geoespacial no mapa. Devem funcionar com opacidade 0.15-0.25 sobre mapa satelital.

| Camada | Hex v2 | Conceito | Opacidade sugerida |
|--------|--------|----------|-------------------|
| Terras Indígenas (FUNAI) | `#D4785A` | Terracota quente, terra ancestral | 0.20 |
| Unidades de Conservação (ICMBio) | `#4A8C5E` | Verde floresta, preservação | 0.20 |
| APP (Área Preservação Permanente) | `#6BAF7B` | Verde claro, vegetação ribeirinha | 0.15 |
| Comunidades Quilombolas (INCRA) | `#B8785C` | Terra siena, comunidade tradicional | 0.20 |
| Aquíferos (CPRM/SGB) | `#4A8FB8` | Azul água subterrânea | 0.15 |
| Bioma (contornos IBGE) | `#7A9B6A` | Verde muted, não compete com UCs | 0.10 (apenas stroke) |
| Desmatamento (INPE TerraMAA) | `#C45C4A` | Vermelho terroso, alerta ambiental | 0.25 |
| Zona de conflito rural (CPT) | `#D49A5A` | Âmbar escuro, tensão social | 0.20 |

### 7.3 Infraestrutura e Logística

Cores para camadas de infraestrutura que podem ser sobrepostas no mapa.

| Camada | Hex v2 | Conceito |
|--------|--------|----------|
| Ferrovias (DNIT) | `#8B7A6A` | Marrom trilho, ferrugem |
| Rodovias (DNIT) | `#9E958A` | Cinza asfalto quente |
| Portos (Antaq) | `#5A8AA0` | Azul portuário |
| Aeroportos | `#7A7A8A` | Cinza azulado, aviação |
| Linhas de transmissão | `#B8A840` | Amarelo elétrico muted |
| Dutos (minerodutos/gasodutos) | `#6A7A6A` | Verde industrial escuro |

### 7.4 Dados Fiscais e Financeiros

| Dado | Hex v2 | Uso |
|------|--------|-----|
| CAPAG A | `#5B9A6F` | Verde regime (compliance fiscal boa) |
| CAPAG B | `#7A9B5A` | Verde oliva |
| CAPAG C | `#C4915A` | Areia (atenção) |
| CAPAG D | `#A85C5C` | Terracota (restrição fiscal) |
| CFEM (receita) | `#D4A843` | Dourado (dinheiro) |
| BNDES | `#4A90B8` | Azul institucional |

---

## 8. Regras de Coexistência no Mapa

O mapa é onde mais camadas se sobrepõem. Regras para evitar confusão visual:

### Hierarquia de renderização (z-index)

1. **Polígonos de processo minerário** (camada principal, sempre visível, cores de regime)
2. **Camadas territoriais** (TIs, UCs, APPs, quilombolas, abaixo dos processos, opacidade reduzida)
3. **Camadas de infraestrutura** (linhas/pontos, acima das territoriais)
4. **Camadas ambientais** (desmatamento, conflitos, toggle opcional)

### Regra de opacidade

- Processos minerários: fill 0.30, stroke 1.0 (destaque máximo, são o dado principal)
- Camadas territoriais: fill 0.15-0.20 (contextualizam sem dominar)
- Infraestrutura: stroke 1.0, sem fill (linhas apenas)
- Quando modo "Risk Score" ativo, processos mudam para cores da Camada 3 (semáforo)

### Regra de contraste

Todas as cores de dados (camadas 4 e 5) foram escolhidas com saturação média (30-50%) para funcionar sobre mapa satelital escuro sem "gritar". Cores altamente saturadas são reservadas para a Camada 3 (risco) que é ativada sob demanda.

---

## 9. Acessibilidade

### Contraste de texto

Todos os pares texto/fundo devem ter ratio mínimo WCAG AA:

- text-primary `#F1EFE8` sobre bg-primary `#0D0D0C`: ratio 17.5:1 (passa AAA)
- text-secondary `#888780` sobre bg-primary `#0D0D0C`: ratio 5.8:1 (passa AA)
- text-tertiary `#5F5E5A` sobre bg-primary `#0D0D0C`: ratio 3.6:1 (passa AA para texto grande)

### Daltonismo

As cores de risco (verde/âmbar/vermelho) são acompanhadas de indicadores textuais ou numéricos (badge com número, labels "ALTO"/"MÉDIO"/"BAIXO"). Nunca depender apenas da cor para comunicar risco.

As cores de regime no mapa são acompanhadas pela legenda fixa. No popup e tabela, o nome do regime aparece como texto ao lado do badge colorido.

---

## 10. Tokens para Implementação (Tailwind + CSS)

### Sugestão de estrutura em `tailwind.config.ts`

```ts
colors: {
  // Camada 1: Interface
  dark: {
    primary: '#0D0D0C',
    secondary: '#111110',
    tertiary: '#1A1A18',
    border: '#2C2C2A',
    hover: '#3D3D3A',
    elevated: '#4A4A48',
  },
  text: {
    primary: '#F1EFE8',
    body: '#D3D1C7',
    section: '#B4B2A9',
    secondary: '#888780',
    tertiary: '#5F5E5A',
  },

  // Camada 2: Marca
  terrae: {
    50: '#FAEEDA',
    100: '#FAC775',
    200: '#EF9F27',
    300: '#F1B85A',
    400: '#BA7517',
    600: '#854F0B',
    800: '#633806',
    900: '#412402',
  },

  // Camada 3: Risco
  risk: {
    low: '#1D9E75',
    mid: '#E8A830',
    high: '#E24B4A',
    none: '#5F5E5A',
  },

  // Camada 4: Regimes
  regime: {
    concessao: '#4A90B8',
    pesquisa: '#5B9A6F',
    reqlavra: '#8B7CB8',
    licenciamento: '#7A9B5A',
    estrategico: '#2D8B70',
    bloqueioPerm: '#A85C5C',
    bloqueioTemp: '#C4915A',
  },

  // Camada 5: Substâncias
  substancia: {
    ferro: '#7EADD4',
    cobre: '#C87C5B',
    ouro: '#D4A843',
    niobio: '#5CBFA0',
    terrasRaras: '#3D8B7A',
    litio: '#9BB8D0',
    bauxita: '#B8917A',
    quartzo: '#C4B89A',
    manganes: '#8C7A6D',
    grafite: '#6B7178',
    vanadio: '#7B8E7D',
    fosfato: '#A8B87A',
    estanho: '#9E9A8E',
  },

  // Camada 5: Territórios
  territorio: {
    ti: '#D4785A',
    uc: '#4A8C5E',
    app: '#6BAF7B',
    quilombola: '#B8785C',
    aquifero: '#4A8FB8',
    bioma: '#7A9B6A',
    desmatamento: '#C45C4A',
    conflito: '#D49A5A',
  },

  // Camada 5: Infraestrutura
  infra: {
    ferrovia: '#8B7A6A',
    rodovia: '#9E958A',
    porto: '#5A8AA0',
    aeroporto: '#7A7A8A',
    transmissao: '#B8A840',
    duto: '#6A7A6A',
  },
},
```

---

## 11. Decisões de Demo vs Produção

| Decisão | Demo (v1) | Produção (v2) |
|---------|-----------|---------------|
| Paleta de regimes | Cores saturadas atuais | Earth-tone v2 |
| Paleta de substâncias | Conflita com regimes | Paleta independente |
| Bloqueios | Vermelho/âmbar (= risco) | Terracota/areia |
| Camadas territoriais | Não implementadas visualmente | Cores dedicadas com opacidade |
| Tooltips de tendência | Hardcoded por mineral | Template com variáveis |
| Drilldown minerais | Sem ação | Click filtra tabela |
| Pills de filtro | Multicor | Cinza neutro uniforme |

---

## 12. Referências de Mercado

Plataformas de inteligência geoespacial analisadas:

- **Palantir AIP / Foundry**: tema escuro, paleta de dados desaturada, semáforo para alertas
- **Mapbox Studio**: fundos escuros, dados categoriais em paleta muted
- **Global Mining Explorer (S&P)**: earth tones para camadas minerais, azul para água, verde para preservação
- **Kontur Platform**: UI kit geoespacial open-source, paleta temática por camada
- **Google Earth Engine**: fundo satelital escuro, overlays com opacidade controlada

Padrão comum: separação clara entre cores de interface (neutras), cores semânticas (semáforo) e cores de dados (categoriais, dessaturadas). O Terrae v2 segue exatamente esse padrão.

---

## 13. Documentação relacionada no repositório

- `Docs/paleta-cores-mapa-inteligencia.md` — inventário das cores **efetivamente usadas no código** na época da demo (v1); útil para diff antes da migração v2.

---

*Este documento deve ser revisado após a demo com o presidente da ANM, incorporando feedback sobre legibilidade e preferências visuais. A implementação das novas cores deve ser feita em um branch dedicado com validação visual em todos os contextos: mapa satelital, mapa escuro, mapa claro, popup, relatório, PDF e dashboard.*
