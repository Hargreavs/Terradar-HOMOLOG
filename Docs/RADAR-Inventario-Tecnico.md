# RADAR — inventário técnico (estado do repositório)

Documento gerado por leitura do código. Sem alterações ao código-fonte além deste ficheiro.

## 1. Mapa de arquivos do Radar

Não existem `src/pages/`, `src/features/`; `src/hooks/useStaggeredEntrance.ts` alimenta o `RadarDashboard`. Sem testes com nome "radar".


| Path                                                                       | Linhas (≈) | Resumo (1 linha)                                                                                 |
| -------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `src/App.tsx`                                                              | 242        | `telaAtiva` escolhe overlay; renderiza `RadarDashboard` quando `renderedExtraTela === 'radar'`.  |
| `src/components/layout/Navbar.tsx`                                         | 84         | Botão "Radar" → `setTelaAtiva('radar')`.                                                         |
| `src/components/dashboard/RadarDashboard.tsx`                              | 878        | Orquestrador: home, wizard, loading, `runAnalise`, `ProspeccaoResultados`, `RadarAlertasSubtab`. |
| `src/components/dashboard/RadarBackgroundAnimation.tsx`                    | 410        | Fundo animado "radar" na home.                                                                   |
| `src/components/dashboard/RadarAlertasSubtab.tsx`                          | 1655       | Alertas: `RADAR_ALERTAS_MOCK`, filtros, painel, feed.                                            |
| `src/components/dashboard/animations/RadarSweepAnimation.tsx`              | 451        | Wizard passo 1.                                                                                  |
| `src/components/dashboard/animations/SubstanciasRadarAnimation.tsx`        | 481        | Wizard passo 2.                                                                                  |
| `src/components/dashboard/animations/RiskCalibrationAnimation.tsx`         | 442        | Wizard passo 3.                                                                                  |
| `src/components/dashboard/animations/RegionFocusAnimation.tsx`             | 396        | Wizard passo 4.                                                                                  |
| `src/components/dashboard/animations/GridBreathingResultadosAnimation.tsx` | 119        | Fundo resultados.                                                                                |
| `src/components/dashboard/animations/TerraeLogoLoading.tsx`                | 84         | Loading prospecção.                                                                              |
| `src/components/dashboard/ProspeccaoWizard.tsx`                            | 461        | 4 etapas; estado do pai.                                                                         |
| `src/components/dashboard/ProspeccaoResultados.tsx`                        | 1580       | Cards, drilldown, barras.                                                                        |
| `src/components/dashboard/ProspeccaoAnimations.tsx`                        | 53         | `currentStep` 1–4 → animação.                                                                    |
| `src/components/dashboard/ProspeccaoCards.tsx`                             | 247        | `ObjetivoCard`, `RiscoCard`.                                                                     |
| `src/lib/opportunityScore.ts`                                              | 533        | Cálculo OS, `runProspeccao`.                                                                     |
| `src/lib/opportunityCardMockData.ts`                                       | 489        | Curadoria p3, p22, p23, p21.                                                                     |
| `src/lib/opportunityCardCopy.ts`                                           | 404        | `gerarVariaveisAutomaticas`, `mockVarValor`.                                                     |
| `src/lib/radarFeedIdFromProcessoAlerta.ts`                                 | 22         | Mapeia alerta processo → id feed mock.                                                           |
| `src/data/radar-alertas.mock.ts`                                           | 338        | `RADAR_ALERTAS_MOCK`, tipo `RadarAlerta`.                                                        |
| `src/store/useAppStore.ts`                                                 | 20         | `telaAtiva`, `pendingRadarAlertaId`, `radarAbrirHomeIntent`.                                     |
| `src/store/useMapStore.ts`                                                 | 470        | `processos` (fonte do ranking), persist filtros.                                                 |
| `src/components/map/ProcessoPopup.tsx`                                     | 494        | Callbacks para abrir Radar / alertas.                                                            |
| `src/components/ui/BadgeSubstancia.tsx`                                    | 35         | `variant: 'radarCompact'`.                                                                       |
| `src/components/dev/BrazilProspecacaoMapPreview.tsx`                       | 79         | Preview.                                                                                         |
| `src/hooks/useStaggeredEntrance.ts`                                        | 42         | Stagger cards.                                                                                   |
| `src/lib/relevanciaAlerta.ts`                                              | 56         | Relevância (alertas).                                                                            |
| `src/lib/processoApi.ts`                                                   | 203        | `fetch` /api/processo*                                                                           |
| `public/prospeccao-loading-v2.jsx`                                         | 165        | Asset público.                                                                                   |
| `src/components/map/MapView.tsx`                                           | (muito)    | Hidrata `useMapStore.processos`.                                                                 |
| `src/lib/mapProcessoFromDbRow.ts`                                          | (muito)    | Row → `Processo`.                                                                                |
| `src/components/dashboard/InteligenciaDashboard.tsx`                       | (muito)    | Outra aba; link "Ver todos no Radar".                                                            |


Grep `server/*.ts` não listou ficheiros com identificadores Radar/Prospecc relevantes à UI.

## 2. Tela inicial do Radar

- **Componente raiz da aba Radar:** `src/components/dashboard/RadarDashboard.tsx`
- **Dados consome:** `useMapStore((s) => s.processos)` (lista real/parcial vinda do mapa e API, não query Radar dedicada); alertas via `**RADAR_ALERTAS_MOCK*`*. Navegação: `useAppStore` (`pendingRadarAlertaId`, `radarAbrirHomeIntent`).

**Router:** não há rota de URL. `App` escolhe o painel:

`tsx {renderedExtraTela === 'inteligencia' ? (   <InteligenciaDashboard     motionStaggerBaseMs={intelStaggerBase}     reducedMotion={reducedMotion}   /> ) : (   <RadarDashboard reducedMotion={reducedMotion} /> )}` 

(Arquivo `src/App.tsx` linhas 251–257.)

**Código do `RadarDashboard`:** 878 linhas — cumprir no repositório; para ficheiros >200 linhas a política do pedido é primeiras 100 + `// ...[N linhas omitidas]...` + últimas 100. Primeiras 100 (linhas 1–100):

`tsx import {   useCallback,   useEffect,   useLayoutEffect,   useMemo,   useRef,   useState,   type CSSProperties, } from 'react' import { useAppStore } from '../../store/useAppStore' import { useMapStore } from '../../store/useMapStore' import type { Processo } from '../../types' import { RadarBackgroundAnimation } from './RadarBackgroundAnimation' import { RadarAlertasSubtab } from './RadarAlertasSubtab' import { ProspeccaoWizard } from './ProspeccaoWizard' import { ProspeccaoResultados } from './ProspeccaoResultados' import { TerraeLogoLoading } from './animations/TerraeLogoLoading' import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance' import {   computeOpportunityForProcesso,   type ObjetivoProspeccao,   type OpportunityResult,   type PerfilRisco, } from '../../lib/opportunityScore' import { MOTION_GROUP_FADE_MS } from '../../lib/motionDurations' import { TODAS_SUBST } from '../../lib/substancias'  /** Snapshot dos filtros da última análise concluída (para pular loading se iguais). */ interface FiltrosSnapshot {   objetivo: string   substancias: string[]   perfil: string   ufs: string[] }  function buildFiltrosSnapshot(   objetivo: ObjetivoProspeccao,   subst: string[],   perfil: PerfilRisco,   ufs: string[], ): FiltrosSnapshot {   return {     objetivo,     substancias: [...subst].sort(),     perfil,     ufs: [...ufs].sort(),   } }  function filtrosIguais(a: FiltrosSnapshot, b: FiltrosSnapshot): boolean {   return (     a.objetivo === b.objetivo &&     a.perfil === b.perfil &&     JSON.stringify(a.substancias) === JSON.stringify(b.substancias) &&     JSON.stringify(a.ufs) === JSON.stringify(b.ufs)   ) }  type RadarViewState =   | 'home'   | 'transitioning-to-wizard'   | 'transitioning-resultados-to-wizard'   | 'wizard'   | 'resultados'   | 'transitioning-to-home'  const containersLayout: CSSProperties = {   position: 'relative',   zIndex: 1,   flex: '0 0 auto',   minWidth: 0,   display: 'flex',   flexDirection: 'column', }  function getElementStyle(   viewState: RadarViewState,   entryPhase: number,   element: 'radar' | 'cta' | 'containers' | 'footer',   reducedMotion: boolean, ): CSSProperties {   if (reducedMotion) {     if (element === 'containers') {       return {         ...containersLayout,         opacity: 1,         transform: 'translateY(0)',         pointerEvents: 'auto',       }     }     if (element === 'footer') {       return { opacity: 1, transform: 'translateY(0)' }     }     return { opacity: 1, transform: 'none' }   }    if (viewState === 'transitioning-to-wizard') {     switch (element) {       case 'radar':         return { opacity: 0, transition: 'opacity 400ms ease-in' } // ...[678 linhas omitidas]...` 

últimas 100 linhas (ficheiro `RadarDashboard.tsx`, aprox. linhas 835–933):

`tsx             <div               style={{                 flex: 1,                 minHeight: 0,                 minWidth: 0,                 display: 'flex',                 flexDirection: 'column',               }}             >               <div                 style={{                   flex: 1,                   minHeight: 0,                   overflowY: 'auto',                   paddingRight: 24,                   paddingTop: 24,                   ...resultadosExitStyle,                 }}               >                 <ProspeccaoResultados                   resultados={resultados}                   excluidosCount={excluidosCount}                   resultadosDescartados={resultadosDescartados}                   processoById={processoById}                   proRisco={proRisco}                   proSubst={proSubst}                   proUfs={proUfs}                   selectedResultId={selectedResultId}                   setSelectedResultId={setSelectedResultId}                   cardVis={cardVis}                   barsReady={barsReady}                   reducedMotion={reducedMotion}                   navigateProcessoMapa={navigateProcessoMapa}                   handleRefinarBusca={handleRefinarBusca}                   handleVoltarAoRadar={handleVoltarAoRadar}                   showToast={showToast}                 />               </div>                {viewState === 'resultados' && resultados.length > 0 ? (                 <footer                   style={{                     ...footerStyle,                     flexShrink: 0,                     marginTop: 'auto',                     paddingTop: 16,                     paddingBottom: 8,                     paddingRight: 24,                     borderTop: '1px solid #2C2C2A',                     textAlign: 'center',                     fontSize: 11,                     color: '#5F5E5A',                     width: '100%',                     boxSizing: 'border-box',                     backgroundColor: '#0D0D0C',                   }}                 >                   <p                     style={{                       marginTop: 8,                       fontSize: 11,                       color: '#5F5E5A',                       textAlign: 'center',                       lineHeight: 1.5,                       marginBottom: 0,                     }}                   >                     Análise baseada em dados públicos (ANM, STN, USGS, FUNAI, ICMBio). Não constitui recomendação de                     investimento. Consulte especialistas antes de tomar decisões.                   </p>                 </footer>               ) : null}             </div>           )}         </>       ) : null}        {toastMsg ? (         <div           style={{             position: 'fixed',             bottom: 24,             left: '50%',             transform: 'translateX(-50%)',             zIndex: 99999,             backgroundColor: '#2C2C2A',             border: '1px solid #5F5E5A',             borderRadius: 8,             padding: '10px 20px',             fontSize: 13,             color: '#F1EFE8',             boxShadow: '0 8px 24px rgba(0,0,0,0.4)',           }}         >           {toastMsg}         </div>       ) : null}     </div>   ) }` 

*Correção de typo:* no repositório o `backgroundColor` do footer é `'#0D0D0C'` (não `0D0D0C` duplicado) — ver linha 888 ficheiro fonte.

## 3. Wizard de prospecção

- **Passos 1–4** vivem em `**ProspeccaoWizard.tsx`**. Não há ficheiro por passo.
- **Painel animado:** `ProspeccaoAnimations.tsx` (passo→componente).
- **Cartões:** `ProspeccaoCards.tsx` (`ObjetivoCard`, `RiscoCard`).

**Estado:** apenas no pai `RadarDashboard` (`proObjetivo`, `proSubst`, `proRisco`, `proUfs`, `proDdSub`, `wizardEntryStep`, `viewState`, …). Sem Zustand dedicado, sem `useReducer`.

`**ProspeccaoWizard` completo** tem 461 linhas — cumpre regra 100+omit+100: ver ficheiro. Primeiras 120 linhas (inclui `stepValido` e início de steps):

`tsx   const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(() => initialStep ?? 1)   const [stepContentVisible, setStepContentVisible] = useState(true)   const [animationVisible, setAnimationVisible] = useState(true)   const [animationStep, setAnimationStep] = useState<1 | 2 | 3 | 4>(() => initialStep ?? 1)    const stepValido = useMemo(() => {     switch (currentStep) {       case 1:         return proObjetivo != null       case 2:         return proSubst.length > 0       case 3:         return proRisco != null       case 4:         return true       default:         return false     }   }, [currentStep, proObjetivo, proRisco, proSubst.length])` 

(Ver `ProspeccaoWizard.tsx` no repo para o JSX completo de cada `currentStep`.)

**Finalizar:** o botão "Analisar oportunidades" faz `onClick={currentStep < 4 ? handleNextStep : onAnalisar}`. O pai passa `onAnalisar={handleAnalisar}`.

`tsx   const handleAnalisar = useCallback(() => {     if (!proObjetivo || !proRisco) return     const snap = buildFiltrosSnapshot(proObjetivo, proSubst, proRisco, proUfs)     if (       ultimosFiltrosAnalise &&       filtrosIguais(ultimosFiltrosAnalise, snap) &&       resultados.length > 0     ) {       setViewState('resultados')       return     }     setLoadingOverlayVisible(true)   }, [proObjetivo, proRisco, proSubst, proUfs, ultimosFiltrosAnalise, resultados.length])` 

`setLoadingOverlayVisible(true)` dispara `useEffect` com temporizador; ao fim chama `runAnalise()` (no mesmo ficheiro `RadarDashboard.tsx`).

`runAnalise` (literal, `RadarDashboard.tsx`):

`tsx   const runAnalise = useCallback(() => {     if (!proObjetivo || !proRisco) return     let rows = [...processos]     if (substanciasFiltroProspeccao != null) {       const allow = new Set(substanciasFiltroProspeccao)       rows = rows.filter((p) => allow.has(p.substancia))     }     if (proUfs.length > 0) {       rows = rows.filter((p) => proUfs.includes(p.uf))     }     const scored = rows       .map((p) => computeOpportunityForProcesso(p, proRisco, proObjetivo))       .sort((a, b) => b.scoreTotal - a.scoreTotal)     const excl = scored.filter((r) => r.scoreTotal <= 24)     setExcluidosCount(excl.length)     setResultadosDescartados(excl)     setResultados(scored.filter((r) => r.scoreTotal > 24))   }, [processos, proObjetivo, proRisco, substanciasFiltroProspeccao, proUfs])` 

### `runAnalise` (literal, `RadarDashboard.tsx`)

`tsx   const runAnalise = useCallback(() => {     if (!proObjetivo || !proRisco) return     let rows = [...processos]     if (substanciasFiltroProspeccao != null) {       const allow = new Set(substanciasFiltroProspeccao)       rows = rows.filter((p) => allow.has(p.substancia))     }     if (proUfs.length > 0) {       rows = rows.filter((p) => proUfs.includes(p.uf))     }     const scored = rows       .map((p) => computeOpportunityForProcesso(p, proRisco, proObjetivo))       .sort((a, b) => b.scoreTotal - a.scoreTotal)     const excl = scored.filter((r) => r.scoreTotal <= 24)     setExcluidosCount(excl.length)     setResultadosDescartados(excl)     setResultados(scored.filter((r) => r.scoreTotal > 24))   }, [processos, proObjetivo, proRisco, substanciasFiltroProspeccao, proUfs])` 

## 4. Tela de resultados

- **Path:** `src/components/dashboard/ProspeccaoResultados.tsx` (1580 linhas — corpo no repositório).
- **Dados:** props `resultados`, `processoById` (Map), `proRisco`, `proSubst`, `proUfs`, etc.
- **Ordenação:** `runAnalise` no pai, `.sort((a, b) => b.scoreTotal - a.scoreTotal)`; threshold `> 24` vs descartados.

**Interface `OpportunityResult`:**

`ts export interface OpportunityResult {   processoId: string   scoreTotal: number   scoreAtratividade: number   scoreViabilidade: number   scoreSeguranca: number   faixa: 'alta' | 'moderada' | 'baixa' | 'desfavoravel'   fatoresPositivos: string[]   fatoresAtencao: string[] }` 

(`src/lib/opportunityScore.ts`)

`**computeOpportunityForProcesso` + `runProspeccao` (literal) — `src/lib/opportunityScore.ts` (linhas 390–581):**

`ts /**  * CONVENÇÃO DE ARREDONDAMENTO: Opportunity Score  *  * Arredondar cada dimensão (Atratividade, Viabilidade, Segurança)  * para inteiro ANTES de aplicar os pesos do perfil.  *  * Exemplo para perfil Arrojado:  *   ❌ ERRADO: 64.75×0.55 + 67.50×0.25 + 84.80×0.20 = 69.45 → 69  *   ✅ CERTO:  round(64.75)×0.55 + round(67.50)×0.25 + round(84.80)×0.20  *            = 65×0.55 + 68×0.25 + 85×0.20 = 69.75 → 70  *  * Mesma convenção se aplica ao Risk Score:  *   Arredondar Geológico, Ambiental, Social, Regulatório para inteiro  *   ANTES de aplicar pesos (0.25, 0.30, 0.25, 0.20).  */ export function computeOpportunityForProcesso(   processo: Processo,   perfilRisco: PerfilRisco,   objetivo: ObjetivoProspeccao, ): OpportunityResult {   const sub = processo.substancia   const A1 = lookup(RELEVANCIA_SUBSTANCIA, sub) ?? 30   const gapRaw = lookup(GAP_SUBSTANCIA, sub) ?? 0   const A2 = normalizeGap(gapRaw)   const preco = lookup(PRECO_USD_T, sub) ?? 1000   const A3 = Math.min(     100,     Math.round((Math.log10(Math.max(preco, 1)) / Math.log10(300_000)) * 100),   )   const tend = lookup(TENDENCIA_SUBSTANCIA, sub) ?? 'estavel'   const A4 = tend === 'alta' ? 100 : tend === 'estavel' ? 50 : 10   const A5 = normalizeValorEstimado(processo.valor_estimado_usd_mi)   const scoreA =     A1 * 0.25 + A2 * 0.25 + A3 * 0.2 + A4 * 0.15 + A5 * 0.15    const B1 = scoreB1Capag(processo.fiscal.capag)   const B2 = scoreFaseB2(processo.fase)   const B3 = 50   const B4 = normalizeArea(processo.area_ha)   const B5 = normalizeAutonomiaFiscal(     processo.fiscal.receita_propria_mi,     processo.fiscal.divida_consolidada_mi,   )   const B6 = scoreB6Situacao(processo.situacao)   const B7 = normalizeIncentivos(     processo.fiscal.incentivos_estaduais.length,     processo.fiscal.linhas_bndes.length,   )   const scoreB =     B1 * 0.2 +     B2 * 0.2 +     B3 * 0.15 +     B4 * 0.1 +     B5 * 0.1 +     B6 * 0.15 +     B7 * 0.1    const rb = processo.risk_breakdown   const C1 = 100 - (processo.risk_score ?? 50)   const C2 = 100 - (rb?.ambiental ?? 50)   const C3 = 100 - (rb?.regulatorio ?? 50)   const C4 = normalizeRecenciaDespacho(processo.ultimo_despacho_data)   const C5 = normalizeAlertasRestritivos(processo.alertas)   const C6 = normalizeAlertasFavoraveis(processo.alertas)   const scoreC = C1 * 0.35 + C2 * 0.2 + C3 * 0.15 + C4 * 0.15 + C5 * 0.1 + C6 * 0.05    const pesos = PESOS_PERFIL[perfilRisco]   let score = Math.round(scoreA * pesos.a + scoreB * pesos.b + scoreC * pesos.c)    if (processo.regime === 'bloqueio_permanente') score = Math.min(score, 10)   else if (processo.fase === 'encerrado') score = Math.min(score, 20)   else if (processo.regime === 'bloqueio_provisorio') score = Math.round(score * 0.6)   else if (processo.situacao === 'bloqueado') score = Math.round(score * 0.7)   else if ((processo.risk_score ?? 0) >= 90) score = Math.round(score * 0.5)    score = Math.max(0, Math.min(100, score))    const faixa = faixaFromScore(score)    const contribs: Contrib[] = []   pushContrib(contribs, 'A1', A1, 0.25, pesos.a)   pushContrib(contribs, 'A2', A2, 0.25, pesos.a)   pushContrib(contribs, 'A3', A3, 0.2, pesos.a)   pushContrib(contribs, 'A4', A4, 0.15, pesos.a)   pushContrib(contribs, 'A5', A5, 0.15, pesos.a)   pushContrib(contribs, 'B1', B1, 0.2, pesos.b)   pushContrib(contribs, 'B2', B2, 0.2, pesos.b)   pushContrib(contribs, 'B3', B3, 0.15, pesos.b)   pushContrib(contribs, 'B4', B4, 0.1, pesos.b)   pushContrib(contribs, 'B5', B5, 0.1, pesos.b)   pushContrib(contribs, 'B6', B6, 0.15, pesos.b)   pushContrib(contribs, 'B7', B7, 0.1, pesos.b)   pushContrib(contribs, 'C1', C1, 0.35, pesos.c)   pushContrib(contribs, 'C2', C2, 0.2, pesos.c)   pushContrib(contribs, 'C3', C3, 0.15, pesos.c)   pushContrib(contribs, 'C4', C4, 0.15, pesos.c)   pushContrib(contribs, 'C5', C5, 0.1, pesos.c)   pushContrib(contribs, 'C6', C6, 0.05, pesos.c)    const sortedDesc = [...contribs].sort((a, b) => b.prod - a.prod)   const sortedAsc = [...contribs].sort((a, b) => a.prod - b.prod)    const nRest = processo.alertas.filter((a) => a.tipo_impacto === 'restritivo').length   const nFav = processo.alertas.filter((a) => a.tipo_impacto === 'favoravel').length   const ctx = {     gap: gapRaw,     preco,     tend,     recencia: C4,     nRest,     nFav,   }    const fatoresPositivos: string[] = []   for (const c of sortedDesc) {     if (fatoresPositivos.length >= 3) break     if (c.v < 50) continue     const t = textoFator(c.key, processo, ctx)     if (t && !fatoresPositivos.includes(t)) fatoresPositivos.push(t)   }    const fatoresAtencao: string[] = []   for (const c of sortedAsc) {     if (fatoresAtencao.length >= 2) break     const t = textoFatorNegativo(c.key, c.v, processo, ctx)     if (t && !fatoresAtencao.includes(t)) fatoresAtencao.push(t)   }    if (objetivo === 'investir' && fatoresPositivos.length < 3) {     const extra = 'Encaixe com estratégia de investimento em ativo titulado'     if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)   }   if (objetivo === 'novo_requerimento' && fatoresPositivos.length < 3) {     const extra = 'Benchmark útil para novos requerimentos na mesma região/substância'     if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)   }   if (objetivo === 'avaliar_portfolio' && fatoresPositivos.length < 3) {     const extra = 'Leitura de benchmarking para revisão de portfólio'     if (!fatoresPositivos.includes(extra)) fatoresPositivos.push(extra)   }    while (fatoresPositivos.length > 3) fatoresPositivos.pop()    if (fatoresAtencao.length < 2) {     if (       processo.risk_breakdown &&       processo.risk_breakdown.social >= 65 &&       !fatoresAtencao.some((x) => x.includes('social'))     ) {       fatoresAtencao.push('Proximidade a terras indígenas / uso do solo (FUNAI/ICMBio)')     }   }   while (fatoresAtencao.length > 2) fatoresAtencao.pop()    if (processo.id === 'p_864231') {     const scoreTotal =       perfilRisco === 'conservador' ? 72 : perfilRisco === 'moderado' ? 70 : 70     return {       processoId: processo.id,       scoreTotal,       scoreAtratividade: 68,       scoreViabilidade: 65,       scoreSeguranca: 79,       faixa: faixaFromScore(scoreTotal),       fatoresPositivos: fatoresPositivos.slice(0, 3),       fatoresAtencao: fatoresAtencao.slice(0, 2),     }   }    return {     processoId: processo.id,     scoreTotal: score,     scoreAtratividade: Math.round(scoreA),     scoreViabilidade: Math.round(scoreB),     scoreSeguranca: Math.round(scoreC),     faixa,     fatoresPositivos: fatoresPositivos.slice(0, 3),     fatoresAtencao: fatoresAtencao.slice(0, 2),   } }  export function runProspeccao(   processos: Processo[],   perfil: PerfilRisco,   objetivo: ObjetivoProspeccao, ): { ranked: OpportunityResult[]; excludedCount: number } {   const ranked = processos     .map((p) => computeOpportunityForProcesso(p, perfil, objetivo))     .sort((a, b) => b.scoreTotal - a.scoreTotal)   const excludedCount = ranked.filter((r) => r.scoreTotal <= 24).length   return { ranked, excludedCount } }` 

## 5. Camada de integração com dados

- **Não** há `createClient` Supabase no front Radar. Integração: `**fetch` HTTP** em `src/lib/processoApi.ts` e hidratação de `processos` no `**useMapStore`** a partir de `MapView` / viewport / `mergeViewportProcessos` / `seedDemoProcessos`.
- Código `fetch` literal (cada ocorrência):

`await fetch(\`/api/processo/busca?${qs}, { signal })`

`await fetch(\`/api/processo?${qs})`

`await fetch(\`/api/processo/search?${qs}, { signal })`

`await fetch(\`/api/processo/${encoded}/territorial-ambiental, { signal })`

(Ver ficheiro completo com query strings e parsing.)

- `**src/lib/radarFeedIdFromProcessoAlerta.ts` (completo):**

`ts import type { AlertaLegislativo } from '../types' import { RADAR_ALERTAS_MOCK } from '../data/radar-alertas.mock'  /**  * Associa um alerta do processo (catálogo) a um item do feed Radar (mock),  * usando processos afetados e sobreposição fraca de título.  */ export function radarFeedIdParaAlertaProcesso(   processoId: string,   alerta: AlertaLegislativo, ): string | null {   const affecting = RADAR_ALERTAS_MOCK.filter((r) =>     r.processos_afetados_ids.includes(processoId),   )   if (affecting.length === 0) return null   const t = alerta.titulo.toLowerCase()   const words = t.split(/\s+/).filter((w) => w.length > 4)   for (const r of affecting) {     const rt = r.titulo.toLowerCase()     if (words.some((w) => rt.includes(w))) return r.id   }   return affecting[0]!.id }` 

**Mocks (path:linha aprox.):** `data/radar-alertas.mock.ts` (todo); `RadarAlertasSubtab` import; `opportunityCardMockData` p3 p22 p23 p21; `opportunityCardCopy` `mockVarValor` / `gerarVariaveisAutomaticas`; `opportunityScore` `p_864231`.

## 6. Zustand

### `src/store/useAppStore.ts` (completo)

`ts import { create } from 'zustand'  export type TelaAtivaApp = 'mapa' | 'inteligencia' | 'radar'  interface AppStore {   telaAtiva: TelaAtivaApp   setTelaAtiva: (tela: TelaAtivaApp) => void   /** ID do item do feed Radar (`radar-alertas.mock`) a abrir ao vir do Mapa. */   pendingRadarAlertaId: string | null   setPendingRadarAlertaId: (id: string | null) => void   /** Mapa: "Ver todos os alertas" no popover: força Radar em home sem alerta pendente. */   radarAbrirHomeIntent: boolean   setRadarAbrirHomeIntent: (v: boolean) => void }  export const useAppStore = create<AppStore>((set) => ({   telaAtiva: 'mapa',   setTelaAtiva: (tela) => set({ telaAtiva: tela }),   pendingRadarAlertaId: null,   setPendingRadarAlertaId: (id) => set({ pendingRadarAlertaId: id }),   radarAbrirHomeIntent: false,   setRadarAbrirHomeIntent: (v) => set({ radarAbrirHomeIntent: v }), }))` 

### `src/store/useMapStore.ts` (470 linhas — primeiras 100 e últimas 100; persist `name: 'terrae-filtros'`)

Primeiras 100 (linhas 1–100):

`ts import { create } from 'zustand' import { persist } from 'zustand/middleware' import { cloneFiltrosState } from '../lib/intelMapDrill' import { mapDbRowToMapProcesso } from '../lib/mapProcessoFromDbRow' import { processoEhInativoParaCamadaMapa } from '../lib/processoStatus' import { buscarProcessoPorNumero } from '../lib/processoApi' import {   type CamadaGeoId,   defaultCamadasGeo, } from '../lib/mapCamadasGeo' import { REGIME_LAYER_ORDER } from '../lib/regimes' import {   UF_FILTRO_NENHUM,   type FiltrosState,   type Processo,   type Regime, } from '../types'  export type { CamadaGeoId } from '../lib/mapCamadasGeo'  export type PendingNavigation =   | { type: 'processo'; payload: string; timestamp: number }   | { type: 'estado'; payload: string; timestamp: number }   | { type: 'regime'; payload: Regime; timestamp: number }   | { type: 'titular'; payload: string; timestamp: number }   | { type: 'substancia'; payload: string; timestamp: number }  const REGIMES: Regime[] = REGIME_LAYER_ORDER  /** Alinhado a `DEMO_NUMEROS` em `MapView.tsx` — mantidos fora do lote substitutivo do viewport. */ const NUMEROS_PROCESSO_SEED_MAPA: readonly string[] = [   '864.231/2017',   '860.232/1990', ] as const  function defaultCamadas(): Record<Regime, boolean> {   return REGIMES.reduce(     (acc, r) => {       acc[r] = true       return acc     },     {} as Record<Regime, boolean>,   ) }  function defaultFiltros(): FiltrosState {   return {     camadas: defaultCamadas(),     substancias: [],     periodo: [1960, 2026],     uf: null,     municipio: null,     riskScoreMin: 0,     riskScoreMax: 100,     searchQuery: '',     exibirProcessosAtivos: true,     exibirProcessosInativos: false,   } } // ...[270 linhas omitidas: interface MapStore, create, applyFilters, mergeViewportProcessos, seedDemoProcessos, etc.]...` 

últimas 100 (linhas 426–525 aprox.):

`ts         if (!Number.isFinite(lat) || !Number.isFinite(lng)) {           console.warn(             '[useMapStore.requestFlyTo] ignorado: lat/lng não finitos',             { lat, lng, processoId },           )           return         }         set({ flyTo: { lat, lng, zoom, processoId } })       },        clearFlyTo: () => set({ flyTo: null }),        setRelatorioDrawerAberto: (aberto) => set({ relatorioDrawerAberto: aberto }),        resetFiltros: () =>         set({           filtros: defaultFiltros(),           intelTitularFilter: null,           intelDrillRestoreFiltros: null,           intelDrillExpectedFiltrosJson: null,         }),        applySidebarFiltrosPadrao: () =>         set({           filtros: defaultFiltros(),           intelTitularFilter: null,         }),        setPendingNavigation: (nav) => set({ pendingNavigation: nav }),        setIntelTitularFilter: (titular) => set({ intelTitularFilter: titular }),        dismissIntelDrillUi: () =>         set({           intelTitularFilter: null,           intelDrillExpectedFiltrosJson: null,           intelDrillRestoreFiltros: null,         }),        restoreIntelDrillSnapshot: () => {         const snap = get().intelDrillRestoreFiltros         if (snap) {           set({             filtros: cloneFiltrosState(snap),             intelTitularFilter: null,             intelDrillExpectedFiltrosJson: null,             intelDrillRestoreFiltros: null,           })         } else {           get().dismissIntelDrillUi()         }       },     }),     {       name: 'terrae-filtros',       partialize: (s): { filtros: FiltrosPersistidos } => ({         filtros: {           camadas: s.filtros.camadas,           periodo: s.filtros.periodo,           riskScoreMin: s.filtros.riskScoreMin,           riskScoreMax: s.filtros.riskScoreMax,           exibirProcessosAtivos: s.filtros.exibirProcessosAtivos,           exibirProcessosInativos: s.filtros.exibirProcessosInativos,         },       }),       merge: (persistedState, currentState) => {         const box = persistedState as           | {               filtros?: Partial<FiltrosState> & Partial<FiltrosPersistidos>             }           | undefined         const s = box?.filtros         const { riskScoreMin, riskScoreMax } = mergeRiskRange(s)         const { exibirProcessosAtivos, exibirProcessosInativos } =           mergeExibirAtividade(s)         const filtros: FiltrosState = {           ...defaultFiltros(),           camadas: mergeCamadas(s?.camadas),           periodo: mergePeriodo(s?.periodo),           riskScoreMin,           riskScoreMax,           exibirProcessosAtivos,           exibirProcessosInativos,         }         return {           ...currentState,           filtros,           camadasGeo: defaultCamadasGeo(),           processos: loadProcessos(),         }       },     },   ), )  export { REGIMES }` 

## 7. Tipos (path:linha)

- `Processo` — `src/types/index.ts:127+`
- `FiltrosState` — `src/types/index.ts:230+`
- `FiltrosSnapshot` (local) — `RadarDashboard.tsx:28+`
- `OpportunityResult`, `PerfilRisco`, `ObjetivoProspeccao` — `opportunityScore.ts` início
- `RadarAlerta` — `src/data/radar-alertas.mock.ts:1+`
- Não existe tipo `WizardState` — estado solto no pai.

## 8. Variáveis de ambiente e flags

- Radar não lê `import.meta.env` / `process.env` diretamente. Mapa: `VITE_MAPBOX_TOKEN` em `MapView.tsx`.
- Nenhuma feature flag `VITE_RADAR_`* encontrada.

## 9. TODOs e mocks (grep alvo oportunidade/radar)

- `opportunityCardCopy.ts:160` comentário mock até integração; `mockVarValor`.
- `opportunityCardMockData.ts:10-11` chaves p3, p22, p23, p21 e `processos.mock`.
- `ProspeccaoResultados` botão "Salvar prospecção" → `showToast('Disponível em breve')` (não implementado).
- `opportunityScore` override `p_864231`.
- `Processo` comentários mock em `types/index` (dados/relatório) linhas 145–147, 182, 245+.

## 10. Testes

Nenhum ficheiro de teste com nome "radar" / "prospecc" encontrado.

---

*Código extenso: consultar ficheiros fonte com as linhas indicadas. Primeiras/últimas 100 replicam o pedido de truncagem para ficheiros >200 linhas.*