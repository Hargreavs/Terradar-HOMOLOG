import { createPortal, flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ArrowUpRight } from 'lucide-react'
import { relatoriosMock } from '../../data/relatorio.mock'
import type { RelatorioData } from '../../data/relatorio.mock'
import {
  rotuloFontePublicacaoExibicao,
  textoTooltipNivelImpactoLegislativo,
} from '../../lib/alertaImpactoLegislativo'
import { estiloBadgeRelevancia } from '../../lib/relevanciaAlerta'
import { formatarRealBrlInteligente } from '../../lib/formatarRealBrlInteligente'
import { formatarUsdMiInteligente } from '../../lib/formatarUsdMiInteligente'
import { labelSubstanciaParaExibicao } from '../../lib/substancias'
import { REGIME_COLORS, REGIME_LABELS } from '../../lib/regimes'
import { RegimeBadge } from '../ui/RegimeBadge'
import { AlertaItemImpactoBar } from '../legislativo/AlertaItemImpactoBar'
import { CamadaTooltipHover } from '../filters/CamadaTooltipHover'
import { TextoTruncadoComTooltip } from '../ui/TextoTruncadoComTooltip'
import { gerarRiskDecomposicaoParaProcesso } from '../../lib/riskScoreDecomposicao'
import type { Fase, Processo, Regime } from '../../types'
import { RiskDecomposicaoRelatorioPanel } from './RiskDecomposicaoRelatorioPanel'
import { RiskTotalCalcTooltipContent } from './RiskScoreCalcTooltipContent'

type AbaId = 'processo' | 'territorio' | 'inteligencia' | 'risco' | 'fiscal'

type JsPdfDoc = InstanceType<typeof jsPDF>

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'processo', label: 'Processo' },
  { id: 'territorio', label: 'Território' },
  { id: 'inteligencia', label: 'Inteligência' },
  { id: 'risco', label: 'Risco' },
  { id: 'fiscal', label: 'Fiscal' },
]

/** Mesma cor de "Camadas disponíveis" na sidebar (`index.css` --text-section-title) */
const SECTION_TITLE = 'var(--text-section-title)'

/** Escala tipográfica do drawer (mínimo 12px) */
const FS = {
  min: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  metric: 17,
  xl: 18,
  xxl: 21,
  h2: 23,
  display: 26,
  hero: 56,
  jumbo: 58,
  highlight: 32,
} as const

const RX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Espaço vertical entre o último conteúdo do card e o rodapé "Atualizado em…". */
const FONTE_LABEL_MARGIN_TOP_PX = 20

/** Reforço antes de "Atualizado em…" nas abas Inteligência, Território, Risco e Fiscal. */
const FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX = 32

/** Espaço abaixo dos títulos de secção do drawer (alinhado ao cabeçalho número do processo + badge). */
const TITULO_SECAO_MARGIN_BOTTOM_PX = 30

function formatarDataIsoPtBr(iso: string | null | undefined): string {
  if (iso == null || iso === '') return ''
  if (!RX_DATA_ISO.test(iso)) return iso
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Rótulo da substância com acentuação correta (ex.: NIQUEL → Níquel). */
function apresentarSubstanciaLabel(s: string): string {
  return labelSubstanciaParaExibicao(s)
}

/** Destaca em negrito trechos de ha e município/UF no texto das observações. */
function observacoesComNegritoHaLocal(texto: string, p: Processo): ReactNode {
  const loc = `${p.municipio}/${p.uf}`
  const areaForms = new Set<string>([
    `${p.area_ha.toLocaleString('pt-BR')} ha`,
    `${p.area_ha.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} ha`,
  ])
  const needles = [...areaForms, loc].filter((n) => texto.includes(n))
  if (needles.length === 0) return texto

  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < texto.length) {
    let nextIdx = -1
    let found = ''
    for (const n of needles) {
      const j = texto.indexOf(n, i)
      if (j !== -1 && (nextIdx === -1 || j < nextIdx)) {
        nextIdx = j
        found = n
      }
    }
    if (nextIdx === -1) {
      out.push(<span key={k++}>{texto.slice(i)}</span>)
      break
    }
    if (nextIdx > i) {
      out.push(<span key={k++}>{texto.slice(i, nextIdx)}</span>)
    }
    out.push(
      <strong key={k++} style={{ fontWeight: 700 }}>
        {found}
      </strong>,
    )
    i = nextIdx + found.length
  }
  return <>{out}</>
}

/** Títulos de subseção no drawer (16px / 700); rótulos do grid Processo usam FS.md / 600. */
const subsecaoTituloStyle = {
  fontSize: FS.lg,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  color: SECTION_TITLE,
}

const FASE_LABELS: Record<Fase, string> = {
  requerimento: 'Requerimento',
  pesquisa: 'Pesquisa',
  concessao: 'Concessão',
  lavra: 'Lavra',
  encerrado: 'Encerrado',
}

function corFaixaRisco(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

function classificacaoRiscoTotal(r: number): string {
  if (r < 40) return 'Baixo risco'
  if (r <= 69) return 'Risco médio'
  return 'Alto risco'
}

/** Ícones de tendência de preço (subaba Inteligência). */
function IconTendenciaAlta({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 16L9.5 10.5 14 14 20 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 6h5v5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTendenciaEstavel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 12h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 9v6M17 9v6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTendenciaQueda({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 8L9.5 13.5 14 10 20 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 18h5v-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Cor semântica para o valor numérico em km (proximidade territorial / logística). */
function corDistanciaKm(km: number): string {
  if (km < 10) return '#E24B4A'
  if (km < 30) return '#E8A830'
  if (km <= 50) return '#D3D1C7'
  return '#1D9E75'
}

const GLOSSARIO_APP =
  'Área de Preservação Permanente (APP): faixa de proteção ao longo de rios, nascentes e topos de morro. Vedada a supressão de vegetação salvo em casos de utilidade pública (Código Florestal, Lei 12.651/2012).'

const GLOSSARIO_QUILOMBOLA =
  'Comunidade remanescente de quilombo com território reconhecido pelo INCRA. Exige consulta prévia conforme Convenção 169 da OIT.'

const AREAS_SENSIVEIS_DIST_TOOLTIP =
  'As distâncias são calculadas entre o centroide do processo minerário e o limite mais próximo de cada área sensível (FUNAI/ICMBio/INCRA). Cores indicam proximidade: vermelho (< 10 km, zona de influência direta), âmbar (10-30 km, zona de atenção), neutro (30-50 km), verde (> 50 km, distância segura). Referência: zonas de amortecimento conforme SNUC e normas específicas de cada UC.'

const SIGLAS_UC_COMUNS = [
  'APA',
  'FLONA',
  'REBIO',
  'ESEC',
  'PARNA',
  'RDS',
  'RPPN',
  'MONA',
] as const

function normalizarAsciiUpper(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function siglasPresentesNoNomeUc(nome: string): Set<string> {
  const u = normalizarAsciiUpper(nome)
  const set = new Set<string>()
  for (const sig of SIGLAS_UC_COMUNS) {
    if (new RegExp(`\\b${sig}\\b`).test(u)) set.add(sig)
  }
  return set
}

function extrairSiglaEntreParentesesUc(tipo: string): string | null {
  const m = tipo.match(/\(\s*([A-Za-zÀ-ÿ]{2,8})\s*\)/)
  if (!m) return null
  return normalizarAsciiUpper(m[1])
}

function extrairSiglaDoTipoUc(tipo: string): string | null {
  const sigs = SIGLAS_UC_COMUNS as readonly string[]
  const p = extrairSiglaEntreParentesesUc(tipo)
  if (p && sigs.includes(p)) return p
  const t = normalizarAsciiUpper(tipo.trim())
  if (sigs.includes(t)) return t
  return null
}

/** Uma linha: nome da UC, sem repetir tipo por extenso se a sigla já está no nome. */
function rotuloUcUmaLinha(nome: string, tipo: string | null): string {
  const n = nome.trim()
  if (!tipo) return n
  const sigTipo = extrairSiglaDoTipoUc(tipo)
  const noNome = siglasPresentesNoNomeUc(n)
  if (sigTipo && noNome.has(sigTipo)) return n
  if (sigTipo && !noNome.has(sigTipo)) return `${sigTipo} ${n}`
  if (/protec[aã]o\s+integral/i.test(tipo)) {
    if (/\bPI\b/i.test(n)) return n
    return `PI ${n}`
  }
  if (/\bUC\s+/i.test(n)) return n
  return `UC ${n}`
}

function tooltipTextoUcCompleto(nome: string, tipo: string | null): string {
  const n = nome.trim()
  if (!tipo) return n
  return `${n} — ${tipo}`
}

const SEI_ANM_PESQUISA_URL =
  'https://sei.anm.gov.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=pesquisa_processo&id_orgao_acesso_externo=0'

/** Gap em p.p.: inteiro se |gap| ≥ 1; senão uma casa decimal. */
function formatarGapPontosPercentuais(gap: number): string {
  if (Math.abs(gap) >= 1) {
    return Math.round(gap).toLocaleString('pt-BR')
  }
  return gap.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })
}

function formatarPctContextoGlobal(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function textoTooltipDependenciaTransferencias(pct: number): string {
  const s = String(pct)
  if (pct <= 40) {
    return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Baixa dependência indica boa capacidade de arrecadação própria.`
  }
  if (pct <= 70) {
    return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Dependência moderada, comum em municípios de médio porte.`
  }
  return `${s}% da receita total do município vem de transferências federais e estaduais (FPM, ICMS, FUNDEB, CFEM e outras). Alta dependência indica vulnerabilidade fiscal, o município gera pouca receita própria.`
}

function prazoVencimentoExibicaoRelatorio(
  prazo: string | null,
  regime: Regime,
): { texto: string; corValor: string } {
  if (prazo != null && prazo !== '' && RX_DATA_ISO.test(prazo)) {
    return { texto: formatarDataIsoPtBr(prazo), corValor: '#D3D1C7' }
  }
  if (regime === 'bloqueio_permanente') {
    return { texto: 'Indeterminado (bloqueio)', corValor: '#5F5E5A' }
  }
  if (regime === 'bloqueio_provisorio') {
    return { texto: 'Pendente de decisão', corValor: '#E8A830' }
  }
  const semPrazo =
    prazo == null || prazo === '' || prazo.trim() === 'Não definido'
  if (semPrazo) {
    return { texto: 'Não informado pela ANM', corValor: '#5F5E5A' }
  }
  return { texto: prazo, corValor: '#D3D1C7' }
}

/** Dots em “Áreas sensíveis” — paleta v2 território. */
const DOT_TI = '#D4785A'
const DOT_UC = '#4A8C5E'
const DOT_APP = '#6BAF7B'
const DOT_QUILOMBOLA = '#B8785C'
/** Ausência positiva (sem TI na região monitorada). */
const DOT_AUSENCIA_POSITIVA = '#1D9E75'

/** Logística v2: ferrovia, porto, sede; ausência de infra usa cinza terciário. */
const DOT_FERROVIA = '#8B7A6A'
const DOT_PORTO = '#5A8AA0'
const DOT_SEDE_MUNICIPAL = '#9E958A'
const DOT_AUSENCIA_INFRA = '#5F5E5A'

const DOT_AQUIFERO = '#4A8FB8'

function corTramitacaoAnos(anos: number): string {
  if (anos <= 5) return '#1D9E75'
  if (anos <= 15) return '#D3D1C7'
  if (anos <= 30) return '#E8A830'
  return '#E24B4A'
}

function corDependenciaTransferenciasPct(pct: number): string {
  if (pct <= 40) return '#1D9E75'
  if (pct <= 60) return '#D3D1C7'
  if (pct <= 80) return '#E8A830'
  return '#E24B4A'
}

function biomaImplicacoes(bioma: string): string {
  if (bioma.includes('Amazônia') && !bioma.includes('Cerrado'))
    return 'Exige licenciamento federal, IBAMA. Alta sensibilidade ambiental e social. Consulta FUNAI obrigatória para processos em TIs.'
  if (bioma.includes('Amazônia') && bioma.includes('Cerrado'))
    return 'Transição Amazônia/Cerrado, atenção a competências federal e estadual e a corredores ecológicos.'
  if (bioma.includes('Cerrado'))
    return 'Licenciamento estadual na maioria dos casos. Biodiversidade crítica mas processo mais ágil que Amazônia.'
  if (bioma.includes('Caatinga'))
    return 'Menor complexidade ambiental relativa. Atenção especial a recursos hídricos.'
  if (bioma.includes('Mata Atlântica'))
    return 'Bioma prioritário, restrições severas de supressão de vegetação. Lei da Mata Atlântica (11.428/2006).'
  if (bioma.includes('Pampa'))
    return 'Paisagem de campos, licenciamento estadual e zoneamento rural relevantes.'
  if (bioma.includes('Pantanal'))
    return 'Patrimônio hidrológico sensível, restrições a obras e supressão em áreas úmidas.'
  return 'Verificar legislação federal e estadual aplicável ao bioma e ao uso do solo.'
}

function capagCor(letra: 'A' | 'B' | 'C' | 'D'): string {
  switch (letra) {
    case 'A':
      return '#5B9A6F'
    case 'B':
      return '#7A9B5A'
    case 'C':
      return '#C4915A'
    case 'D':
      return '#A85C5C'
  }
}

function textoTooltipCapag(letra: 'A' | 'B' | 'C' | 'D'): string {
  switch (letra) {
    case 'A':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota A indica excelente saúde fiscal, com bom equilíbrio entre endividamento, poupança corrente e liquidez.'
    case 'B':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota B indica saúde fiscal adequada, com indicadores dentro dos limites aceitáveis.'
    case 'C':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota C indica fragilidade fiscal em pelo menos um dos indicadores avaliados. Requer atenção.'
    case 'D':
      return 'CAPAG (Capacidade de Pagamento) é a classificação fiscal da Secretaria do Tesouro Nacional. Avalia se o município pode receber garantia da União para operações de crédito. Nota D indica situação fiscal comprometida, o município não possui condições de receber garantia da União.'
  }
}

/**
 * Largura do HTML na captura ≈ folha A4 em px (~96dpi), para colunas/tabelas respirarem;
 * a imagem continua a ser escalada para a área útil (170mm) no jsPDF.
 */
const PDF_LARGURA_CONTEUDO_PX = Math.round(210 * (96 / 25.4))

/**
 * Largura fixa temporária para html2canvas: o conteúdo reflowa como na área útil do PDF
 * (tabelas menos truncadas). Repõe estilos ao terminar.
 */
function definirLarguraCapturaPdf(el: HTMLElement, larguraPx: number): () => void {
  const s = el.style
  const prev = {
    width: s.width,
    minWidth: s.minWidth,
    maxWidth: s.maxWidth,
    boxSizing: s.boxSizing,
  }
  s.boxSizing = 'border-box'
  s.width = `${larguraPx}px`
  s.minWidth = `${larguraPx}px`
  s.maxWidth = `${larguraPx}px`
  return () => {
    s.width = prev.width
    s.minWidth = prev.minWidth
    s.maxWidth = prev.maxWidth
    s.boxSizing = prev.boxSizing
  }
}

/**
 * html2canvas só pinta a região visível de elementos com scroll. Expande o contentor para
 * altura total do conteúdo e remove o clip; devolve função que repõe os estilos inline.
 */
function expandirAreaScrollRelatorioParaPdf(el: HTMLElement): () => void {
  const s = el.style
  const prev = {
    overflow: s.overflow,
    overflowY: s.overflowY,
    overflowX: s.overflowX,
    height: s.height,
    maxHeight: s.maxHeight,
    minHeight: s.minHeight,
    flex: s.flex,
    flexGrow: s.flexGrow,
    flexShrink: s.flexShrink,
    flexBasis: s.flexBasis,
  }

  el.scrollTop = 0
  /* Ceil + margem: scrollHeight por vezes fica ligeiramente abaixo do que o canvas pinta (subpixel). */
  const alturaTotal = Math.ceil(el.scrollHeight) + 12

  s.overflow = 'visible'
  s.overflowY = 'visible'
  s.overflowX = 'visible'
  s.maxHeight = 'none'
  s.flex = '0 0 auto'
  s.flexGrow = '0'
  s.flexShrink = '0'
  s.flexBasis = 'auto'
  s.height = alturaTotal > 0 ? `${alturaTotal}px` : 'auto'

  return () => {
    s.overflow = prev.overflow
    s.overflowY = prev.overflowY
    s.overflowX = prev.overflowX
    s.height = prev.height
    s.maxHeight = prev.maxHeight
    s.minHeight = prev.minHeight
    s.flex = prev.flex
    s.flexGrow = prev.flexGrow
    s.flexShrink = prev.flexShrink
    s.flexBasis = prev.flexBasis
  }
}

/** Igual ao parágrafo "Alíquota aplicável:" na subaba Fiscal (tamanho e cor do texto base). */
const CFEM_CARD_SUBTITLE_STYLE: CSSProperties = {
  fontSize: FS.lg,
  color: '#888780',
  lineHeight: 1.5,
}

/** Alinhado a `CamadaTooltipHover` (variante Fiscal: fundo escuro + borda #3a3a38). */
const CFEM_BAR_TOOLTIP = {
  maxWidthPx: 280,
  padding: '10px 12px',
  backgroundColor: '#2C2C2A',
  border: '1px solid #3a3a38',
  borderRadius: 6,
  fontLine: 1.4 as const,
  /** Ano (legenda do período) */
  fontCaption: FS.sm,
  colorCaption: '#C4C2BB',
  /** Linhas de série */
  fontBody: FS.md,
  colorLabelProcesso: '#8BC5E8',
  colorLabelMunicipio: '#F0B85C',
  colorValue: '#F1EFE8',
  colorMuted: '#9E9C96',
  zIndex: 10060,
} as const

const CFEM_BAR_TOOLTIP_OPACITY_MS = 150

type CfemBarTooltipAnchor = {
  ano: number
  vp: number
  vm: number
  left: number
  top: number
  transform: string
}

function RelatorioCfemBarrasComTooltip({
  processoTemCfem,
  anos,
  procPorAno,
  munPorAno,
  maxProc,
  maxMun,
  trackH,
}: {
  processoTemCfem: boolean
  anos: number[]
  procPorAno: Map<number, number>
  munPorAno: Map<number, number>
  maxProc: number
  maxMun: number
  trackH: number
}) {
  const [tip, setTip] = useState<CfemBarTooltipAnchor | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const positionFromRect = useCallback((r: DOMRect) => {
    const cx = r.left + r.width / 2
    const vw = window.innerWidth
    const margin = 8
    const halfW = CFEM_BAR_TOOLTIP.maxWidthPx / 2 + margin
    const left = Math.max(halfW, Math.min(cx, vw - halfW))
    const showBelow = r.top < 100
    return {
      left,
      top: showBelow ? r.bottom : r.top,
      transform: showBelow
        ? 'translate(-50%, 8px)'
        : 'translate(-50%, calc(-100% - 8px))',
    }
  }, [])

  const showTip = useCallback(
    (
      ano: number,
      vp: number,
      vm: number,
      el: HTMLElement,
    ) => {
      clearHideTimer()
      const pos = positionFromRect(el.getBoundingClientRect())
      setTip({ ano, vp, vm, ...pos })
      requestAnimationFrame(() => setTipVisible(true))
    },
    [clearHideTimer, positionFromRect],
  )

  const hideTip = useCallback(() => {
    setTipVisible(false)
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      setTip(null)
      hideTimerRef.current = null
    }, CFEM_BAR_TOOLTIP_OPACITY_MS)
  }, [clearHideTimer])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  const tooltipPortal =
    tip != null
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none"
            style={{
              position: 'fixed',
              zIndex: CFEM_BAR_TOOLTIP.zIndex,
              left: tip.left,
              top: tip.top,
              transform: tip.transform,
              maxWidth: CFEM_BAR_TOOLTIP.maxWidthPx,
              minWidth: 200,
              padding: CFEM_BAR_TOOLTIP.padding,
              backgroundColor: CFEM_BAR_TOOLTIP.backgroundColor,
              border: CFEM_BAR_TOOLTIP.border,
              borderRadius: CFEM_BAR_TOOLTIP.borderRadius,
              boxSizing: 'border-box',
              opacity: tipVisible ? 1 : 0,
              transition: `opacity ${CFEM_BAR_TOOLTIP_OPACITY_MS}ms ease`,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: CFEM_BAR_TOOLTIP.fontCaption,
                color: CFEM_BAR_TOOLTIP.colorCaption,
                lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                fontWeight: 500,
                marginBottom: 8,
                letterSpacing: '0.02em',
              }}
            >
              {tip.ano}
            </div>
            {processoTemCfem ? (
              <div
                style={{
                  fontSize: CFEM_BAR_TOOLTIP.fontBody,
                  lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                }}
              >
                <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelProcesso }}>
                  Este processo:{' '}
                </span>
                <span
                  style={{
                    color: CFEM_BAR_TOOLTIP.colorValue,
                    fontWeight: 500,
                  }}
                >
                  {formatarRealBrlInteligente(tip.vp)}
                </span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: CFEM_BAR_TOOLTIP.fontBody,
                  lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                }}
              >
                <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelProcesso }}>
                  Este processo:{' '}
                </span>
                <span
                  style={{
                    color: CFEM_BAR_TOOLTIP.colorMuted,
                    fontWeight: 500,
                  }}
                >
                  sem arrecadação
                </span>
              </div>
            )}
            <div
              style={{
                fontSize: CFEM_BAR_TOOLTIP.fontBody,
                lineHeight: CFEM_BAR_TOOLTIP.fontLine,
                marginTop: 6,
              }}
            >
              <span style={{ color: CFEM_BAR_TOOLTIP.colorLabelMunicipio }}>
                Município:{' '}
              </span>
              <span
                style={{
                  color: CFEM_BAR_TOOLTIP.colorValue,
                  fontWeight: 500,
                }}
              >
                {formatarRealBrlInteligente(tip.vm)}
              </span>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {tooltipPortal}
      {processoTemCfem ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginBottom: 22,
          }}
        >
          {anos.map((ano) => {
            const vp = procPorAno.get(ano) ?? 0
            const vm = munPorAno.get(ano) ?? 0
            const hP =
              maxProc > 0 && vp > 0
                ? Math.max(4, (vp / maxProc) * trackH)
                : 0
            const hM =
              maxMun > 0 && vm > 0
                ? Math.max(4, (vm / maxMun) * trackH)
                : 0
            return (
              <div
                key={ano}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 4,
                    width: '100%',
                  }}
                  onMouseEnter={(e) => showTip(ano, vp, vm, e.currentTarget)}
                  onMouseLeave={hideTip}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: trackH,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      {hP > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            height: hP,
                            backgroundColor: '#4A90B8',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: trackH,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}
                    >
                      {hM > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            height: hM,
                            backgroundColor: '#EF9F27',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {ano}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginTop: 18,
            marginBottom: 22,
          }}
        >
          {anos.map((ano) => {
            const vm = munPorAno.get(ano) ?? 0
            const vp = 0
            const hM =
              maxMun > 0 && vm > 0
                ? Math.max(4, (vm / maxMun) * trackH)
                : 0
            return (
              <div
                key={ano}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    height: trackH,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => showTip(ano, vp, vm, e.currentTarget)}
                  onMouseLeave={hideTip}
                >
                  {hM > 0 ? (
                    <div
                      style={{
                        width: '100%',
                        height: hM,
                        backgroundColor: '#EF9F27',
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 1,
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: FS.sm,
                    color: '#888780',
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {ano}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#1E1E1C',
        borderRadius: 8,
        padding: '20px 18px',
      }}
    >
      {children}
    </div>
  )
}

function SecLabel({
  children,
  branco = false,
  style,
}: {
      children: ReactNode
      branco?: boolean
      style?: CSSProperties
    }) {
  return (
    <p
      style={{
        ...subsecaoTituloStyle,
        color: branco ? '#F1EFE8' : SECTION_TITLE,
        margin: 0,
        marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

function FonteLabel({
  dataIso,
  fonte,
  marginTopPx = FONTE_LABEL_MARGIN_TOP_PX,
}: {
  dataIso: string
  fonte: string
  marginTopPx?: number
}) {
  const [y, m, d] = dataIso.split('-')
  const linha =
    d && m && y
      ? `Atualizado em ${d}/${m}/${y} · Fonte: ${fonte}`
      : `Fonte: ${fonte}`
  return (
    <span
      style={{
        display: 'block',
        textAlign: 'right',
        marginTop: marginTopPx,
        fontSize: 11,
        lineHeight: 1.45,
        color: '#5F5E5A',
      }}
    >
      {linha}
    </span>
  )
}

function IconePdfExportar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4h4M9 12h6M9 15.5h6M9 19h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** PNG estático em public/ (ex.: logo completo da capa). */
async function carregarDataUrlAsset(caminhoRelativo: string): Promise<string | null> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  try {
    const res = await fetch(`${base}${caminhoRelativo}`)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve: (v: string | null) => void) => {
      const fr = new FileReader()
      fr.onload = () =>
        resolve(typeof fr.result === 'string' ? fr.result : null)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function carregarDataUrlPrimeiroDisponivel(
  caminhos: string[],
): Promise<string | null> {
  for (const c of caminhos) {
    const u = await carregarDataUrlAsset(c)
    if (u) return u
  }
  return null
}

function medirImagemDataUrl(
  dataUrl: string,
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0)
        resolve({ w: img.naturalWidth, h: img.naturalHeight })
      else resolve(null)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Mesmo RGB de `desenharCapaPdf` / header do drawer (#0D0D0C). */
const PDF_CAPA_FUNDO_RGB: [number, number, number] = [13, 13, 12]

function pixelEhFundoNeutroEscuro(r: number, g: number, b: number): boolean {
  if (r > 130 && g > 128 && b > 122) return false
  if (r > 50 && b < 55 && r - b > 15) return false
  if (r > 80 && g > 50 && b < 50) return false
  const avg = (r + g + b) / 3
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return avg < 58 && spread < 40
}

/** Troca o preto/cinza do PNG da logo pelo hex exato da capa, sem apagar dourados/marrons. */
async function uniformizarFundoLogoCapaPng(
  dataUrl: string,
): Promise<string | null> {
  const [br, bg, bb] = PDF_CAPA_FUNDO_RGB
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      if (iw <= 0 || ih <= 0) {
        resolve(null)
        return
      }
      const c = document.createElement('canvas')
      c.width = iw
      c.height = ih
      const ctx = c.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, iw, ih)
      const d = imageData.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!
        const gch = d[i + 1]!
        const b = d[i + 2]!
        if (pixelEhFundoNeutroEscuro(r, gch, b)) {
          d[i] = br
          d[i + 1] = bg
          d[i + 2] = bb
          d[i + 3] = 255
        }
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Rasteriza o SVG do símbolo para PNG; cabeçalho das páginas de conteúdo. */
async function carregarPdfSymbolPngRaster(): Promise<string | null> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  const urls = [
    `${base}assets/terradar-pdf-symbol.svg`,
    `${base}assets/terradar-primary-dark.svg`,
    `${base}assets/terrae-pdf-symbol.svg`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const svg = await res.text()
      const png = await new Promise<string | null>((resolve) => {
        const img = new Image()
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
        const u = URL.createObjectURL(blob)
        img.onload = () => {
          const w = img.naturalWidth || 120
          const h = img.naturalHeight || 124
          const c = document.createElement('canvas')
          const dpr = 2
          c.width = w * dpr
          c.height = h * dpr
          const ctx = c.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(u)
            resolve(null)
            return
          }
          ctx.scale(dpr, dpr)
          ctx.drawImage(img, 0, 0, w, h)
          URL.revokeObjectURL(u)
          resolve(c.toDataURL('image/png'))
        }
        img.onerror = () => {
          URL.revokeObjectURL(u)
          resolve(null)
        }
        img.src = u
      })
      if (png) return png
    } catch {
      /* tenta próximo asset */
    }
  }
  return null
}

/** Wordmark TERRADAR em fundo escuro (#1A1A18): TERRA #F1EFE8, DAR #D4A84B. */
function desenharWordmarkTerradarCapaPdf(pdf: JsPdfDoc, x: number, y: number) {
  pdf.setFontSize(26)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(241, 239, 232)
  pdf.text('TERRA', x, y)
  const xDar = x + pdf.getTextWidth('TERRA')
  pdf.setTextColor(212, 168, 75)
  pdf.text('DAR', xDar, y)
}

function desenharWordmarkTerradarRodapePdf(pdf: JsPdfDoc, x: number, y: number) {
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  let xw = x
  pdf.setTextColor(241, 239, 232)
  pdf.text('TERRA', xw, y)
  xw += pdf.getTextWidth('TERRA')
  pdf.setTextColor(212, 168, 75)
  pdf.text('DAR', xw, y)
  xw += pdf.getTextWidth('DAR')
  pdf.setTextColor(136, 135, 128)
  pdf.text(' · Mineral Intelligence', xw, y)
}

/** Ícone de barras verticais (gradiente ouro → bronze); capa e cabeçalho do PDF. */
function desenharLogoSimboloPdf(
  pdf: JsPdfDoc,
  x: number,
  y: number,
  escala: number,
) {
  const cores: [number, number, number][] = [
    [255, 224, 160],
    [252, 200, 115],
    [239, 159, 39],
    [186, 117, 23],
    [99, 56, 15],
  ]
  const largura = 2.8 * escala
  const alturas = [3.5, 5, 6.5, 8, 9.5].map((h) => h * escala)
  const hMax = Math.max(...alturas)
  let cx = x
  for (let i = 0; i < 5; i++) {
    const [r, g, b] = cores[i]!
    pdf.setFillColor(r, g, b)
    const hb = alturas[i]!
    pdf.rect(cx, y + (hMax - hb), largura, hb, 'F')
    cx += largura + 0.55 * escala
  }
}

function desenharCapaPdf(
  pdf: JsPdfDoc,
  processo: Processo,
  regimeColor: string,
  coverLogoPng: string | null,
  coverLogoPx: { w: number; h: number } | null,
  fallbackSymbolPng: string | null,
) {
  const w = 210
  const h = 297
  pdf.setFillColor(13, 13, 12)
  pdf.rect(0, 0, w, h, 'F')

  let yAposLogo = 46.5

  if (coverLogoPng && coverLogoPx) {
    const maxW = 155
    const maxH = 28
    const ar = coverLogoPx.h / coverLogoPx.w
    let dw = maxW
    let dh = dw * ar
    if (dh > maxH) {
      dh = maxH
      dw = dh / ar
    }
    const x = (w - dw) / 2
    const y = 22
    pdf.addImage(coverLogoPng, 'PNG', x, y, dw, dh)
    yAposLogo = y + dh + 10
  } else {
    let textoLogoX: number
    if (fallbackSymbolPng) {
      const logoWmm = 16
      const logoHmm = logoWmm * (124 / 120)
      pdf.addImage(fallbackSymbolPng, 'PNG', 22, 20, logoWmm, logoHmm)
      textoLogoX = 22 + logoWmm + 5
    } else {
      desenharLogoSimboloPdf(pdf, 22, 24.5, 1)
      textoLogoX = 48
    }

    desenharWordmarkTerradarCapaPdf(pdf, textoLogoX, 35.5)
    pdf.setFontSize(9.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(186, 117, 23)
    pdf.text('MINERAL INTELLIGENCE', textoLogoX, 41.5)
    yAposLogo = 46.5
  }

  pdf.setDrawColor(239, 159, 39)
  pdf.setLineWidth(0.35)
  pdf.line(22, yAposLogo, w - 22, yAposLogo)

  const yNumero = yAposLogo + 72
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(32)
  pdf.setTextColor(241, 239, 232)
  pdf.text(processo.numero, w / 2, yNumero, { align: 'center' })

  const [rr, gg, bb] = hexParaRgb(regimeColor)
  pdf.setFontSize(14)
  pdf.setTextColor(rr, gg, bb)
  pdf.text(REGIME_LABELS[processo.regime], w / 2, yNumero + 18, {
    align: 'center',
  })

  pdf.setTextColor(211, 209, 199)
  pdf.setFontSize(14)
  const titLines = pdf.splitTextToSize(processo.titular, 166)
  let yTit = yNumero + 28
  for (const line of titLines) {
    pdf.text(line, w / 2, yTit, { align: 'center' })
    yTit += 5.2
  }

  const now = new Date()
  const ds = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  pdf.setFontSize(9)
  pdf.setTextColor(95, 94, 90)
  pdf.text(`Gerado em ${ds}`, w / 2, h - 30, { align: 'center' })
  pdf.text(
    'Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo',
    w / 2,
    h - 24,
    { align: 'center' },
  )
}

function desenharHeaderFooterPaginaConteudo(
  pdf: JsPdfDoc,
  numeroProcesso: string,
  paginaAtual: number,
  totalPaginas: number,
  logoSymbolPng: string | null,
) {
  const m = 20
  pdf.setDrawColor(239, 159, 39)
  pdf.setLineWidth(0.25)
  pdf.line(m, 14, 210 - m, 14)
  if (logoSymbolPng) {
    const hmm = 5.2
    const wmm = hmm * (120 / 124)
    pdf.addImage(logoSymbolPng, 'PNG', m, 3.5, wmm, hmm)
  } else {
    desenharLogoSimboloPdf(pdf, m, 4, 0.32)
  }
  pdf.setFontSize(9)
  pdf.setTextColor(136, 135, 128)
  pdf.setFont('helvetica', 'normal')
  pdf.text(numeroProcesso, 210 - m, 12, { align: 'right' })

  const footY = 289
  pdf.setDrawColor(44, 44, 42)
  pdf.line(m, footY - 10, 210 - m, footY - 10)
  desenharWordmarkTerradarRodapePdf(pdf, m, footY)
  pdf.text(`${paginaAtual} / ${totalPaginas}`, 210 - m, footY, {
    align: 'right',
  })
}

export interface RelatorioCompletoProps {
  processo: Processo | null
  aberto: boolean
  onFechar: () => void
  abaInicial?: AbaId
  /** Quando incrementa (ex.: «Ver decomposição completa» no mapa), força a aba ativa = `abaInicial`. */
  abaRiscoRequestId?: number
}

export function RelatorioCompleto({
  processo,
  aberto,
  onFechar,
  abaInicial = 'processo',
  abaRiscoRequestId = 0,
}: RelatorioCompletoProps) {
  const dados: RelatorioData | undefined = processo
    ? relatoriosMock[processo.id]
    : undefined

  const [aba, setAba] = useState<AbaId>(abaInicial)
  const [pdfGerando, setPdfGerando] = useState(false)
  const pdfCaptureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aberto) setAba(abaInicial)
  }, [aberto, abaInicial, abaRiscoRequestId])

  const regimeColor = processo
    ? (REGIME_COLORS[processo.regime] ?? '#888780')
    : '#888780'

  const alertasOrdenados = useMemo(() => {
    if (!processo) return []
    return [...processo.alertas].sort(
      (a, b) => a.nivel_impacto - b.nivel_impacto,
    )
  }, [processo])

  const riskDecomposicaoMemo = useMemo(() => {
    if (!processo) return null
    return (
      processo.risk_decomposicao ?? gerarRiskDecomposicaoParaProcesso(processo)
    )
  }, [processo])

  const exportarPDF = useCallback(async () => {
    if (!processo || !dados || pdfGerando || !pdfCaptureRef.current) return
    const abaAntes = aba
    setPdfGerando(true)
    try {
      let coverLogoPng: string | null = null
      const pathsLogoCapa = [
        'assets/terradar-primary-dark.png',
        'assets/terradar-pdf-cover-logo.png',
        'assets/terrae-pdf-cover-logo.png',
      ] as const
      for (const p of pathsLogoCapa) {
        const u = await carregarDataUrlAsset(p)
        if (u) {
          coverLogoPng = u
          break
        }
      }
      /* Alinha o fundo do PNG (#000 ou cinza escuro neutro) ao mesmo RGB da capa (`PDF_CAPA_FUNDO_RGB`). */
      if (coverLogoPng) {
        const uniformizado = await uniformizarFundoLogoCapaPng(coverLogoPng)
        if (uniformizado) coverLogoPng = uniformizado
      }
      const coverLogoPx = coverLogoPng
        ? await medirImagemDataUrl(coverLogoPng)
        : null
      const logoSymbolPng = await carregarPdfSymbolPngRaster()
      const totalPaginas = 1 + ABAS.length
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      desenharCapaPdf(
        pdf,
        processo,
        regimeColor,
        coverLogoPng,
        coverLogoPx,
        logoSymbolPng,
      )

      for (let i = 0; i < ABAS.length; i++) {
        const id = ABAS[i]!.id
        flushSync(() => setAba(id))
        await new Promise<void>((r) => setTimeout(r, 120))
        const el = pdfCaptureRef.current
        if (!el) continue

        const restaurarLargura = definirLarguraCapturaPdf(
          el,
          PDF_LARGURA_CONTEUDO_PX,
        )
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        const restaurarScroll = expandirAreaScrollRelatorioParaPdf(el)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        let canvas: HTMLCanvasElement
        try {
          canvas = await html2canvas(el, {
            scale: 1.75,
            useCORS: true,
            logging: false,
            backgroundColor: '#111110',
          })
        } finally {
          restaurarScroll()
          restaurarLargura()
        }
        const img = canvas.toDataURL('image/png', 1)
        pdf.addPage()
        desenharHeaderFooterPaginaConteudo(
          pdf,
          processo.numero,
          2 + i,
          totalPaginas,
          logoSymbolPng,
        )
        const m = 20
        const topReserve = 16
        const botReserve = 14
        const imgMaxW = 210 - 2 * m
        const imgMaxH = 297 - m - topReserve - m - botReserve
        const ratio = canvas.width / canvas.height
        let dw = imgMaxW
        let dh = dw / ratio
        if (dh > imgMaxH) {
          dh = imgMaxH
          dw = dh * ratio
        }
        const xOff = m + (imgMaxW - dw) / 2
        pdf.addImage(img, 'PNG', xOff, m + topReserve, dw, dh)
      }

      const hoje = new Date()
      const d = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`
      const safeNum = processo.numero.replace(/\//g, '_').replace(/\s/g, '_')
      pdf.save(`TERRADAR_${safeNum}_${d}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      flushSync(() => setAba(abaAntes))
      setPdfGerando(false)
    }
  }, [aba, processo, dados, pdfGerando, regimeColor])

  if (!processo || !dados) return null

  const { dados_anm, territorial, intel_mineral, fiscal, timestamps } = dados

  const prazoVencimentoCard = prazoVencimentoExibicaoRelatorio(
    dados_anm.prazo_vencimento,
    processo.regime,
  )

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: 48,
        right: 0,
        width: 520,
        height: 'calc(100vh - 48px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111110',
        borderLeft: '1px solid #2C2C2A',
        transform: aberto ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          height: 56,
          flexShrink: 0,
          backgroundColor: '#0D0D0C',
          borderBottom: '1px solid #2C2C2A',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <TextoTruncadoComTooltip
            text={processo.numero}
            placement="above"
            className="block min-w-0"
            style={{
              fontSize: FS.base,
              fontWeight: 500,
              color: '#F1EFE8',
              flexShrink: 1,
            }}
          />
          <RegimeBadge regime={processo.regime} variant="drawer" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => void exportarPDF()}
            disabled={pdfGerando}
            className="cursor-pointer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxSizing: 'border-box',
              minHeight: 28,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#5F5E5A',
              borderRadius: 6,
              padding: '4px 12px',
              backgroundColor: 'transparent',
              fontSize: FS.md,
              fontWeight: 400,
              color: pdfGerando ? '#5F5E5A' : '#B4B2A9',
              cursor: pdfGerando ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (pdfGerando) return
              e.currentTarget.style.color = '#F1EFE8'
              e.currentTarget.style.borderColor = '#888780'
              e.currentTarget.style.backgroundColor = 'rgba(241, 239, 232, 0.08)'
            }}
            onMouseLeave={(e) => {
              if (pdfGerando) return
              e.currentTarget.style.color = '#B4B2A9'
              e.currentTarget.style.borderColor = '#5F5E5A'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <IconePdfExportar />
            {pdfGerando ? 'Exportando...' : 'Exportar PDF'}
          </button>
          <div
            style={{
              width: 1,
              height: 16,
              backgroundColor: '#2C2C2A',
              margin: '0 12px',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar relatório"
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{
              fontSize: 18,
              lineHeight: 1,
              color: '#888780',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D3D1C7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            ✕
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {pdfGerando ? (
          <div
            className="terrae-relatorio-pdf-export-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="terrae-relatorio-pdf-export-spinner"
              aria-hidden
            />
            <span
              style={{
                fontSize: FS.base,
                fontWeight: 500,
                color: '#F1EFE8',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              Exportando relatório...
            </span>
          </div>
        ) : null}

        <nav
          style={{
            height: 44,
            flexShrink: 0,
            backgroundColor: '#0D0D0C',
            borderBottom: '1px solid #2C2C2A',
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
          }}
        >
        {ABAS.map((t) => {
          const ativo = aba === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAba(t.id)}
              className="cursor-pointer border-0 bg-transparent whitespace-nowrap"
              style={{
                fontSize: FS.md,
                padding: '0 8px',
                height: '100%',
                fontWeight: 600,
                color: ativo ? '#F1EFE8' : '#888780',
                borderBottom: ativo ? '2px solid #EF9F27' : '2px solid transparent',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!ativo) e.currentTarget.style.color = '#B4B2A9'
              }}
              onMouseLeave={(e) => {
                if (!ativo) e.currentTarget.style.color = '#888780'
              }}
            >
              {t.label}
            </button>
          )
        })}
        </nav>

        <div
          ref={pdfCaptureRef}
          className={`terrae-relatorio-drawer-scroll min-h-0 flex-1 overflow-y-auto ${pdfGerando ? 'terrae-relatorio--pdf-export' : ''}`}
          style={{
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
        {aba === 'processo' ? (
          <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                <p
                  style={{
                    fontSize: FS.display,
                    fontWeight: 500,
                    color: '#F1EFE8',
                    margin: 0,
                    lineHeight: 1.25,
                  }}
                >
                  {processo.numero}
                </p>
                {(() => {
                  const sit = processo.situacao
                  const cfg =
                    sit === 'ativo'
                      ? {
                          bg: 'rgba(74, 144, 184, 0.15)',
                          fg: '#4A90B8',
                          l: 'Ativo',
                        }
                      : sit === 'bloqueado'
                        ? {
                            bg: 'rgba(226, 75, 74, 0.15)',
                            fg: '#E24B4A',
                            l: 'Bloqueado',
                          }
                        : {
                            bg: 'rgba(136, 135, 128, 0.15)',
                            fg: '#888780',
                            l: 'Inativo',
                          }
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: FS.sm,
                        fontWeight: 700,
                        backgroundColor: cfg.bg,
                        color: cfg.fg,
                      }}
                    >
                      {cfg.l}
                    </span>
                  )
                })()}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: 16,
                  rowGap: 20,
                  marginTop: 0,
                }}
              >
                {[
                  { label: 'Titular', value: processo.titular, span: 2 },
                  {
                    label: 'Substância',
                    value: apresentarSubstanciaLabel(processo.substancia),
                  },
                  { label: 'Regime', value: REGIME_LABELS[processo.regime] },
                  { label: 'Área', value: `${processo.area_ha.toLocaleString('pt-BR')} ha` },
                  { label: 'UF', value: processo.uf },
                  { label: 'Município', value: processo.municipio },
                  { label: 'Fase', value: FASE_LABELS[processo.fase] },
                  {
                    label: 'Data Protocolo',
                    value: formatarDataIsoPtBr(dados_anm.data_protocolo),
                  },
                  {
                    label: 'Prazo Vencimento',
                    value: prazoVencimentoCard.texto,
                    valueColor: prazoVencimentoCard.corValor,
                  },
                  {
                    label: 'Tempo de Tramitação',
                    value: `${dados_anm.tempo_tramitacao_anos} anos`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      gridColumn: row.span === 2 ? 'span 2' : undefined,
                    }}
                  >
                    <p
                      style={{
                        fontSize: FS.md,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: '#F1EFE8',
                        margin: '0 0 6px 0',
                      }}
                    >
                      {row.label}
                    </p>
                    <p
                      style={{
                        fontSize: FS.base,
                        color:
                          'valueColor' in row && row.valueColor != null
                            ? row.valueColor
                            : '#D3D1C7',
                        margin: 0,
                        lineHeight: 1.35,
                      }}
                    >
                      {row.label === 'Tempo de Tramitação' ? (
                        <span
                          style={{
                            color: corTramitacaoAnos(
                              dados_anm.tempo_tramitacao_anos,
                            ),
                          }}
                        >
                          {`${dados_anm.tempo_tramitacao_anos} anos`}
                        </span>
                      ) : (
                        row.value
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="ANM / Cadastro Mineiro"
              />
            </Card>

            <Card>
              <SecLabel branco>Último despacho ANM</SecLabel>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '0 0 6px 0',
                  lineHeight: 1.5,
                }}
              >
                {formatarDataIsoPtBr(dados_anm.data_ultimo_despacho)}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#D3D1C7',
                  margin: '0 0 8px 0',
                  lineHeight: 1.5,
                }}
              >
                {dados_anm.ultimo_despacho}
              </p>
              <a
                href={SEI_ANM_PESQUISA_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: FS.lg,
                  color: '#EF9F27',
                  margin: 0,
                  lineHeight: 1.5,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none'
                }}
              >
                SEI: {dados_anm.numero_sei}
              </a>
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="SEI-ANM"
              />
            </Card>

            {dados_anm.pendencias.length > 0 ? (
              <Card>
                <SecLabel branco>Pendências</SecLabel>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {dados_anm.pendencias.map((p, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        marginBottom: i < dados_anm.pendencias.length - 1 ? 10 : 0,
                      }}
                    >
                      <span style={{ color: '#E24B4A', fontSize: FS.md, lineHeight: 1.4 }}>
                        ▲
                      </span>
                      <span style={{ fontSize: FS.md, color: '#D3D1C7', lineHeight: 1.4 }}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
                <FonteLabel
                  dataIso={timestamps.cadastro_mineiro}
                  fonte="ANM / Cadastro Mineiro"
                />
              </Card>
            ) : null}

            {dados_anm.observacoes_tecnicas.trim() ? (
              <Card>
                <SecLabel branco>Observações técnicas</SecLabel>
                <p
                  style={{
                    fontSize: FS.lg,
                    color: '#888780',
                    fontStyle: 'italic',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {observacoesComNegritoHaLocal(
                    dados_anm.observacoes_tecnicas,
                    processo,
                  )}
                </p>
                <FonteLabel
                  dataIso={timestamps.cadastro_mineiro}
                  fonte="Terrae / Análise Técnica"
                />
              </Card>
            ) : null}
          </>
        ) : null}

        {aba === 'territorio' ? (
          <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                <SecLabel branco style={{ marginBottom: 0, flex: 1 }}>
                  Áreas sensíveis
                </SecLabel>
                <CamadaTooltipHover texto={AREAS_SENSIVEIS_DIST_TOOLTIP} maxWidthPx={300}>
                  <span
                    aria-label="Sobre cores de distância"
                    style={{
                      cursor: 'help',
                      fontSize: FS.md,
                      color: '#888780',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ⓘ
                  </span>
                </CamadaTooltipHover>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    dot: DOT_TI,
                    nome: territorial.nome_ti_proxima,
                    tipo: 'Terra Indígena',
                    km: territorial.distancia_ti_km,
                    semIdTexto: 'Sem terra indígena na região',
                  },
                  {
                    dot: DOT_UC,
                    nome: territorial.nome_uc_proxima,
                    tipo: territorial.tipo_uc,
                    km: territorial.distancia_uc_km,
                    semIdTexto:
                      'Sem unidade de conservação identificada na região monitorada',
                  },
                ].map((row, i) => {
                  const semDado = row.km === null || row.nome == null
                  const ausenciaTiPositiva =
                    row.tipo === 'Terra Indígena' && semDado
                  const corCirculo = ausenciaTiPositiva
                    ? DOT_AUSENCIA_POSITIVA
                    : semDado
                      ? '#444441'
                      : row.dot
                  const corTextoEsquerda = ausenciaTiPositiva
                    ? DOT_AUSENCIA_POSITIVA
                    : '#D3D1C7'
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: corCirculo,
                            flexShrink: 0,
                          }}
                        />
                        {row.nome && row.dot === DOT_UC ? (
                          <TextoTruncadoComTooltip
                            text={rotuloUcUmaLinha(row.nome, row.tipo ?? null)}
                            textoTooltip={tooltipTextoUcCompleto(
                              row.nome,
                              row.tipo ?? null,
                            )}
                            placement="side"
                            className="min-w-0 flex-1"
                            style={{ fontSize: FS.md, color: corTextoEsquerda }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: FS.md,
                              color: corTextoEsquerda,
                              minWidth: 0,
                            }}
                          >
                            {row.nome ? row.nome : row.semIdTexto}
                          </span>
                        )}
                      </div>
                      {row.km !== null ? (
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 500,
                            color: corDistanciaKm(row.km),
                          }}
                        >
                          {`${row.km.toFixed(1)} km`}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_APP,
                        flexShrink: 0,
                      }}
                    />
                    <CamadaTooltipHover texto={GLOSSARIO_APP} maxWidthPx={300}>
                      <span
                        style={{
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          cursor: 'help',
                          textDecoration: 'underline dotted',
                          textUnderlineOffset: 2,
                        }}
                      >
                        APP
                      </span>
                    </CamadaTooltipHover>
                  </div>
                  <span
                    style={{
                      fontSize: FS.md,
                      fontWeight: 500,
                      color: territorial.sobreposicao_app
                        ? '#E24B4A'
                        : '#1D9E75',
                    }}
                  >
                    {territorial.sobreposicao_app ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_QUILOMBOLA,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: FS.md, color: '#D3D1C7' }}>
                      <CamadaTooltipHover texto={GLOSSARIO_QUILOMBOLA} maxWidthPx={300}>
                        <span
                          style={{
                            cursor: 'help',
                            textDecoration: 'underline dotted',
                            textUnderlineOffset: 2,
                          }}
                        >
                          Quilombola
                        </span>
                      </CamadaTooltipHover>
                      {territorial.nome_quilombola
                        ? ` (${territorial.nome_quilombola})`
                        : ''}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: FS.md,
                      fontWeight: 500,
                      color: territorial.sobreposicao_quilombola
                        ? '#E24B4A'
                        : '#1D9E75',
                    }}
                  >
                    {territorial.sobreposicao_quilombola ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
              <FonteLabel
                dataIso={timestamps.terras_indigenas}
                fonte="FUNAI / ICMBio"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Logística</SecLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    nome: territorial.nome_ferrovia,
                    km: territorial.distancia_ferrovia_km,
                    l: 'Ferrovia',
                    semTexto: 'Sem ferrovia na região monitorada',
                  },
                  {
                    nome: territorial.nome_porto,
                    km: territorial.distancia_porto_km,
                    l: 'Porto',
                    semTexto: 'Sem porto na região monitorada',
                  },
                  {
                    nome: 'Sede municipal',
                    km: territorial.distancia_sede_municipal_km,
                    l: 'Sede municipal',
                    semTexto: '',
                  },
                ].map((row, i) => {
                  const isSede = row.l === 'Sede municipal'
                  const isFerrovia = row.l === 'Ferrovia'
                  const isPorto = row.l === 'Porto'
                  const temInfra =
                    isSede || (row.nome != null && row.nome !== '')
                  const corCirculo = !temInfra
                    ? DOT_AUSENCIA_INFRA
                    : isSede
                      ? DOT_SEDE_MUNICIPAL
                      : isFerrovia
                        ? DOT_FERROVIA
                        : isPorto
                          ? DOT_PORTO
                          : DOT_AUSENCIA_INFRA
                  const textoEsquerda = isSede
                    ? `${row.l} · ${processo.municipio}`
                    : row.nome
                      ? `${row.l} · ${row.nome}`
                      : row.semTexto
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: corCirculo,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: FS.md, color: '#D3D1C7' }}>
                          {textoEsquerda}
                        </span>
                      </div>
                      {row.km !== null ? (
                        <span
                          style={{
                            fontSize: FS.md,
                            fontWeight: 500,
                            color: corDistanciaKm(row.km),
                          }}
                        >
                          {`${row.km.toFixed(1)} km`}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="DNIT / Antaq"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Bioma</SecLabel>
              <p
                style={{
                  fontSize: FS.xl,
                  fontWeight: 500,
                  color: '#F1EFE8',
                  margin: '0 0 8px 0',
                }}
              >
                {territorial.bioma}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {biomaImplicacoes(territorial.bioma)}
              </p>
              <FonteLabel
                dataIso={timestamps.unidades_conservacao}
                fonte="IBGE / Biomas"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Aquífero</SecLabel>
              {territorial.nome_aquifero ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: DOT_AQUIFERO,
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                      aria-hidden
                    />
                    <p
                      style={{
                        fontSize: FS.lg,
                        color: '#D3D1C7',
                        margin: 0,
                        lineHeight: 1.5,
                        flex: 1,
                      }}
                    >
                      {territorial.nome_aquifero}
                    </p>
                  </div>
                  <p
                    style={{
                      fontSize: FS.lg,
                      color: '#888780',
                      margin: 0,
                      lineHeight: 1.5,
                      paddingLeft: 16,
                    }}
                  >
                    {territorial.distancia_aquifero_km !== null ? (
                      <>
                        Distância aproximada:{' '}
                        <span
                          style={{
                            color: corDistanciaKm(territorial.distancia_aquifero_km),
                          }}
                        >
                          {`${territorial.distancia_aquifero_km.toFixed(1)} km`}
                        </span>
                      </>
                    ) : null}
                  </p>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: DOT_AUSENCIA_POSITIVA,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <p style={{ fontSize: FS.base, color: '#1D9E75', margin: 0 }}>
                    Nenhum aquífero relevante identificado
                  </p>
                </div>
              )}
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="CPRM / SGB"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}

        {aba === 'inteligencia' ? (
          <>
            <Card>
              <SecLabel branco style={{ marginBottom: 2 }}>
                Contexto global
              </SecLabel>
              <p
                style={{
                  fontSize: FS.xl,
                  fontWeight: 500,
                  color: '#EF9F27',
                  margin: '0 0 12px 0',
                }}
              >
                {processo.substancia.toUpperCase()}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                }}
              >
                {(() => {
                  const pctR = intel_mineral.reservas_brasil_mundial_pct
                  const corR =
                    pctR > 20 ? '#1D9E75' : pctR >= 5 ? '#EF9F27' : '#888780'
                  const pctP = intel_mineral.producao_brasil_mundial_pct
                  const corP =
                    pctP > 20 ? '#1D9E75' : pctP < 5 ? '#E24B4A' : '#EF9F27'
                  return (
                    <>
                      <div>
                        <p
                          style={{
                            ...subsecaoTituloStyle,
                            margin: '0 0 2px 0',
                          }}
                        >
                          Reservas Brasil
                        </p>
                        <p
                          style={{
                            fontSize: FS.display,
                            fontWeight: 500,
                            color: corR,
                            margin: '0 0 6px 0',
                          }}
                        >
                          {pctR}%
                        </p>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#2C2C2A',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pctR)}%`,
                              height: '100%',
                              backgroundColor: corR,
                            }}
                          />
                        </div>
                        <p
                          style={{
                            fontSize: FS.md,
                            color: SECTION_TITLE,
                            margin: '6px 0 0 0',
                          }}
                        >
                          das reservas mundiais
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            ...subsecaoTituloStyle,
                            margin: '0 0 2px 0',
                          }}
                        >
                          Produção Brasil
                        </p>
                        <p
                          style={{
                            fontSize: FS.display,
                            fontWeight: 500,
                            color: corP,
                            margin: '0 0 6px 0',
                          }}
                        >
                          {pctP}%
                        </p>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#2C2C2A',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pctP)}%`,
                              height: '100%',
                              backgroundColor: corP,
                            }}
                          />
                        </div>
                        <p
                          style={{
                            fontSize: FS.md,
                            color: SECTION_TITLE,
                            margin: '6px 0 0 0',
                          }}
                        >
                          da produção mundial
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
              {(() => {
                const pctR = intel_mineral.reservas_brasil_mundial_pct
                const pctP = intel_mineral.producao_brasil_mundial_pct
                const diff = pctR - pctP
                const fPg = formatarGapPontosPercentuais(diff)
                const fX = formatarPctContextoGlobal(pctP)
                const fY = formatarPctContextoGlobal(pctR)

                let corGap: string
                let gapTxt: string
                let explic: string

                if (Math.abs(diff) < 0.5) {
                  corGap = '#888780'
                  gapTxt =
                    Math.abs(diff) < 0.05
                      ? 'Gap: 0 p.p.'
                      : `Gap: ${fPg} p.p.`
                  explic = `A participação brasileira na produção mundial (${fX}%) está alinhada à sua proporção de reservas (${fY}%).`
                } else if (diff > 0) {
                  corGap = '#1D9E75'
                  gapTxt = `Gap: +${fPg} p.p.`
                  explic = `A produção brasileira (${fX}%) está abaixo da proporção de reservas (${fY}%), indicando potencial de expansão de ${fPg} p.p.`
                } else {
                  corGap = '#E8A830'
                  gapTxt = `Gap: ${fPg} p.p.`
                  explic = `A produção brasileira (${fX}%) supera a proporção de reservas (${fY}%), indicando ritmo de extração acelerado`
                }

                return (
                  <>
                    <p
                      style={{
                        fontSize: FS.lg,
                        fontWeight: 500,
                        color: corGap,
                        margin: '16px 0 0 0',
                        lineHeight: 1.45,
                      }}
                    >
                      {gapTxt}
                    </p>
                    <p
                      style={{
                        fontSize: FS.md,
                        color: '#888780',
                        margin: '6px 0 0 0',
                        lineHeight: 1.45,
                      }}
                    >
                      {explic}
                    </p>
                  </>
                )
              })()}
              <FonteLabel
                dataIso={timestamps.usgs}
                fonte="USGS Mineral Commodity Summaries"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Preço e tendência</SecLabel>
              {intel_mineral.unidade_preco === 'oz' &&
              intel_mineral.preco_referencia_usd_oz != null ? (
                <>
                  <p
                    style={{
                      fontSize: FS.h2,
                      fontWeight: 500,
                      color: '#F1EFE8',
                      margin: '0 0 10px 0',
                    }}
                  >
                    USD{' '}
                    {intel_mineral.preco_referencia_usd_oz.toLocaleString('pt-BR')}
                    /oz
                  </p>
                  <p
                    style={{
                      fontSize: FS.sm,
                      color: '#888780',
                      margin: '0 0 4px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    (≈ USD{' '}
                    {intel_mineral.preco_medio_usd_t.toLocaleString('pt-BR')}/t)
                  </p>
                </>
              ) : (
                <p
                  style={{
                    fontSize: FS.h2,
                    fontWeight: 500,
                    color: '#F1EFE8',
                    margin: '0 0 4px 0',
                  }}
                >
                  {intel_mineral.preco_medio_usd_t.toLocaleString('pt-BR')} USD/t
                </p>
              )}
              {(() => {
                const t = intel_mineral.tendencia_preco
                const cfg =
                  t === 'alta'
                    ? {
                        bg: 'rgba(29, 158, 117, 0.15)',
                        fg: '#1D9E75',
                        tx: 'Alta',
                        Icon: IconTendenciaAlta,
                      }
                    : t === 'estavel'
                      ? {
                          bg: 'rgba(136, 135, 128, 0.15)',
                          fg: '#B8B5AC',
                          tx: 'Estável',
                          Icon: IconTendenciaEstavel,
                        }
                      : {
                          bg: 'rgba(226, 75, 74, 0.15)',
                          fg: '#E24B4A',
                          tx: 'Queda',
                          Icon: IconTendenciaQueda,
                        }
                const Ic = cfg.Icon
                return (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      borderRadius: 5,
                      padding: '6px 12px',
                      fontSize: FS.lg,
                      fontWeight: 500,
                      backgroundColor: cfg.bg,
                      color: cfg.fg,
                      marginBottom: 18,
                    }}
                  >
                    <Ic />
                    {cfg.tx}
                  </span>
                )
              })()}
              <p style={{ fontSize: FS.lg, color: '#888780', margin: 0, lineHeight: 1.5 }}>
                Demanda projetada 2030: {intel_mineral.demanda_projetada_2030}
              </p>
              <FonteLabel
                dataIso={timestamps.preco_spot}
                fonte="Trading Economics / LME · Projeção: IEA Critical Minerals Report 2025"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Aplicações</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {intel_mineral.aplicacoes_principais.map((a) => (
                  <span
                    key={a}
                    style={{
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: FS.sm,
                      backgroundColor: 'rgba(239, 159, 39, 0.15)',
                      color: '#EF9F27',
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.usgs}
                fonte="USGS Mineral Commodity Summaries"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Estratégia nacional</SecLabel>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#D3D1C7',
                  margin: 0,
                  lineHeight: 1.5,
                  borderLeft: '3px solid #EF9F27',
                  paddingLeft: 12,
                }}
              >
                {intel_mineral.estrategia_nacional}
              </p>
              <FonteLabel
                dataIso={timestamps.alertas_legislativos}
                fonte="MME / Plano Nacional de Mineração 2030 + Adoo (monitoramento regulatório)"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <div
              style={{
                backgroundColor: '#0D0D0C',
                borderRadius: 8,
                padding: '20px 18px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                Valor estimado da reserva
              </p>
              <p
                style={{
                  fontSize: FS.highlight,
                  fontWeight: 500,
                  color: '#EF9F27',
                  margin: '0 0 20px 0',
                }}
              >
                {formatarUsdMiInteligente(intel_mineral.valor_estimado_usd_mi)}
              </p>
              <p
                style={{
                  fontSize: FS.sm,
                  color: '#A3A29A',
                  fontStyle: 'italic',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {intel_mineral.metodologia_estimativa}
              </p>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="Estimativa Terrae / SIGMINE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </div>

            <Card>
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  margin: 0,
                  marginBottom: TITULO_SECAO_MARGIN_BOTTOM_PX,
                }}
              >
                Processos vizinhos
              </p>
              <div
                style={
                  pdfGerando
                    ? { overflow: 'visible' }
                    : { overflowX: 'auto' }
                }
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: FS.md,
                  }}
                >
                  <thead>
                    <tr>
                      {(['Nº processo', 'Titular', 'Fase'] as const).map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            ...subsecaoTituloStyle,
                            fontSize: FS.min,
                            padding: '0 6px 8px 0',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        style={{
                          textAlign: 'left',
                          ...subsecaoTituloStyle,
                          fontSize: FS.min,
                          padding: '0 6px 8px 0',
                        }}
                      >
                        <CamadaTooltipHover
                          texto="Distância em quilômetros entre os centroides dos dois processos (fonte: SIGMINE/ANM)"
                          maxWidthPx={300}
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            DIST. (km)
                          </span>
                        </CamadaTooltipHover>
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          ...subsecaoTituloStyle,
                          fontSize: FS.min,
                          padding: '0 6px 8px 0',
                        }}
                      >
                        <CamadaTooltipHover
                          texto="Risk Score do processo vizinho (0-100, calculado pelo modelo de risco Terrae)"
                          maxWidthPx={300}
                        >
                          <span
                            style={{
                              cursor: 'help',
                              textDecoration: 'underline dotted',
                              textUnderlineOffset: 2,
                            }}
                          >
                            RISK
                          </span>
                        </CamadaTooltipHover>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {intel_mineral.processos_vizinhos.map((v, i) => (
                      <tr
                        key={v.numero}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#0D0D0C' : '#1A1A18',
                        }}
                      >
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          {v.numero}
                        </td>
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          <TextoTruncadoComTooltip
                            text={v.titular}
                            placement="above"
                            className="block max-w-[100px] terrae-pdf-titular-wrap"
                            style={{ fontSize: FS.md, color: '#D3D1C7' }}
                          />
                        </td>
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          {v.fase}
                        </td>
                        <td style={{ padding: '8px 6px 8px 0', color: '#D3D1C7' }}>
                          {v.distancia_km} km
                        </td>
                        <td
                          style={{
                            padding: '8px 0',
                            fontWeight: 500,
                            color: corFaixaRisco(v.risk_score),
                          }}
                        >
                          {v.risk_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <FonteLabel
                dataIso={timestamps.sigmine}
                fonte="ANM / SIGMINE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}

        {aba === 'risco' ? (
          <>
            <Card>
              <p
                style={{
                  ...subsecaoTituloStyle,
                  color: '#F1EFE8',
                  textAlign: 'center',
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                Risk Score
              </p>
              {processo.risk_score === null ? (
                <p
                  style={{
                    fontSize: FS.jumbo,
                    fontWeight: 500,
                    textAlign: 'center',
                    color: '#888780',
                    margin: '0 0 8px 0',
                  }}
                >
                  N/A
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: FS.jumbo,
                      fontWeight: 500,
                      textAlign: 'center',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {riskDecomposicaoMemo ? (
                      <CamadaTooltipHover
                        conteudo={
                          <RiskTotalCalcTooltipContent
                            decomposicao={riskDecomposicaoMemo}
                          />
                        }
                        maxWidthPx={280}
                        preferAbove
                        inlineWrap
                      >
                        <span
                          style={{
                            color: corFaixaRisco(processo.risk_score),
                            borderBottom: `1px dotted ${corFaixaRisco(processo.risk_score)}`,
                            cursor: 'help',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {processo.risk_score}
                        </span>
                      </CamadaTooltipHover>
                    ) : (
                      <span
                        style={{ color: corFaixaRisco(processo.risk_score) }}
                      >
                        {processo.risk_score}
                      </span>
                    )}
                  </p>
                  <p
                    style={{
                      fontSize: FS.lg,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: '#D3D1C7',
                      margin: 0,
                    }}
                  >
                    {classificacaoRiscoTotal(processo.risk_score)}
                  </p>
                  {processo.risk_breakdown ? (
                    <div
                      style={{
                        marginTop: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                      }}
                    >
                      {(
                        [
                          ['Geológico', processo.risk_breakdown.geologico],
                          ['Ambiental', processo.risk_breakdown.ambiental],
                          ['Social', processo.risk_breakdown.social],
                          ['Regulatório', processo.risk_breakdown.regulatorio],
                        ] as const
                      ).map(([label, val]) => {
                        const cor = corFaixaRisco(val)
                        return (
                          <div
                            key={label}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              minWidth: 0,
                              maxWidth: '100%',
                            }}
                          >
                            <span
                              style={{
                                fontSize: FS.base,
                                color: '#888780',
                                width: 100,
                                flexShrink: 0,
                              }}
                            >
                              {label}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: '#2C2C2A',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, val))}%`,
                                  height: '100%',
                                  backgroundColor: cor,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: FS.base,
                                fontWeight: 700,
                                color: cor,
                                width: 36,
                                textAlign: 'right',
                                flexShrink: 0,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {val}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </>
              )}
              <FonteLabel
                dataIso={timestamps.cadastro_mineiro}
                fonte="Terrae, com dados ANM, FUNAI, ICMBio e IBGE"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            {processo.risk_score !== null && riskDecomposicaoMemo ? (
              <Card>
                <RiskDecomposicaoRelatorioPanel
                  decomposicao={riskDecomposicaoMemo}
                />
              </Card>
            ) : null}

            <Card>
              <SecLabel branco>Alertas regulatórios</SecLabel>
              {alertasOrdenados.length === 0 ? (
                <p style={{ fontSize: FS.base, color: '#888780', margin: 0 }}>
                  Nenhum alerta regulatório ativo
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {alertasOrdenados.map((al, idx) => {
                    const metaFonte: CSSProperties = {
                      fontSize: FS.sm,
                      color: '#5F5E5A',
                    }
                    const rotuloFonte = rotuloFontePublicacaoExibicao(
                      al.fonte,
                      al.fonte_diario,
                    )
                    const relevanciaMeta = estiloBadgeRelevancia(
                      al.nivel_impacto,
                      al.tipo_impacto,
                    )
                    return (
                    <div key={al.id}>
                      {idx > 0 ? (
                        <div
                          style={{
                            height: 1,
                            backgroundColor: '#2C2C2A',
                            margin: '16px 0',
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                        }}
                      >
                        <AlertaItemImpactoBar
                          nivel={al.nivel_impacto}
                          tipo_impacto={al.tipo_impacto}
                          textoDetalhe={textoTooltipNivelImpactoLegislativo(
                            al.nivel_impacto,
                          )}
                          zIndexTooltip={CFEM_BAR_TOOLTIP.zIndex + 1}
                          barraAlturaFixaPx={48}
                        />
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingLeft: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'nowrap',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 12,
                            }}
                          >
                            <p
                              style={{
                                flex: 1,
                                minWidth: 0,
                                margin: 0,
                                padding: 0,
                                fontSize: FS.md,
                                color: '#888780',
                                lineHeight: 1.45,
                              }}
                            >
                              {al.titulo}
                            </p>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                console.log('abrir publicação')
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'flex-start',
                                alignSelf: 'flex-start',
                                flexShrink: 0,
                                margin: 0,
                                padding: 0,
                                fontSize: FS.sm,
                                fontWeight: 500,
                                color: '#F1B85A',
                                whiteSpace: 'nowrap',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                lineHeight: 1.45,
                              }}
                            >
                              Ver no Diário
                              <ArrowUpRight
                                size={14}
                                strokeWidth={2}
                                aria-hidden
                                className="shrink-0"
                                style={{ marginLeft: 4, flexShrink: 0 }}
                                color="#F1B85A"
                              />
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'baseline',
                              gap: '6px 8px',
                              marginTop: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: FS.sm,
                                fontWeight: 500,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                                color: relevanciaMeta.cor,
                                display: 'inline-block',
                              }}
                            >
                              {relevanciaMeta.label}
                            </span>
                            <span
                              style={{
                                color: '#5F5E5A',
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              ·
                            </span>
                            <span
                              style={{
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              {rotuloFonte}
                            </span>
                            <span
                              style={{
                                color: '#5F5E5A',
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              ·
                            </span>
                            <span
                              style={{
                                ...metaFonte,
                                lineHeight: 1.45,
                                margin: 0,
                                padding: 0,
                              }}
                            >
                              {formatarDataIsoPtBr(al.data)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
              <FonteLabel
                dataIso={timestamps.alertas_legislativos}
                fonte="Adoo"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}

        {aba === 'fiscal' ? (
          <>
            <Card>
              <p
                style={{
                  fontSize: FS.jumbo,
                  fontWeight: 500,
                  textAlign: 'center',
                  color: capagCor(fiscal.capag),
                  margin: '0 0 8px 0',
                }}
              >
                <CamadaTooltipHover
                  className="inline-block"
                  texto={textoTooltipCapag(fiscal.capag)}
                  maxWidthPx={360}
                  preferBelow
                  bubblePadding="10px 12px"
                  inlineWrap
                >
                  <span
                    style={{
                      cursor: 'help',
                      display: 'inline-block',
                    }}
                  >
                    {fiscal.capag}
                  </span>
                </CamadaTooltipHover>
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  textAlign: 'center',
                  margin: '0 0 8px 0',
                  lineHeight: 1.5,
                }}
              >
                {fiscal.capag_descricao}
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  fontWeight: 700,
                  color: '#D3D1C7',
                  textAlign: 'center',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {processo.municipio} / {processo.uf}
              </p>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="STN / SICONFI"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                {[
                  {
                    l: 'Receita própria',
                    v: fiscal.receita_propria_mi,
                  },
                  {
                    l: 'Dívida consolidada',
                    v: fiscal.divida_consolidada_mi,
                  },
                  {
                    l: 'PIB municipal',
                    v: fiscal.pib_municipal_mi,
                  },
                ].map((m) => (
                  <div
                    key={m.l}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                    }}
                  >
                    <p
                      style={{
                        ...subsecaoTituloStyle,
                        margin: '0 0 4px 0',
                        minHeight: 46,
                        lineHeight: 1.25,
                        display: 'flex',
                        alignItems: 'flex-end',
                      }}
                    >
                      {m.l}
                    </p>
                    <p
                      style={{
                        fontSize: FS.metric,
                        fontWeight: 500,
                        color: '#F1EFE8',
                        margin: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {formatarRealBrlInteligente(m.v * 1_000_000)}
                    </p>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '22px 0 0 0',
                  lineHeight: 1.5,
                }}
              >
                Dependência de transferências:{' '}
                <CamadaTooltipHover
                  texto={textoTooltipDependenciaTransferencias(
                    fiscal.dependencia_transferencias_pct,
                  )}
                  maxWidthPx={320}
                  preferAbove
                  inlineWrap
                  bubblePadding="10px 12px"
                >
                  <span
                    style={{
                      color: corDependenciaTransferenciasPct(
                        fiscal.dependencia_transferencias_pct,
                      ),
                      fontWeight: 500,
                      borderBottom: '1px dotted #888780',
                      cursor: 'help',
                    }}
                  >
                    {fiscal.dependencia_transferencias_pct}%
                  </span>
                </CamadaTooltipHover>
              </p>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="STN / FINBRA"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            {fiscal.cfem_historico.length > 0 ||
            fiscal.cfem_municipal_historico.length > 0 ? (
              <Card>
                <SecLabel branco style={{ marginBottom: 4 }}>
                  CFEM: processo vs. município
                </SecLabel>
                <p
                  style={{
                    ...CFEM_CARD_SUBTITLE_STYLE,
                    margin: '0 0 28px 0',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    fontWeight: 400,
                  }}
                >
                  Arrecadação deste processo comparada ao total do município
                </p>
                {fiscal.cfem_historico.some(
                  (h) => h.valor_recolhido_brl > 0,
                ) ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 16,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: '#4A90B8',
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                        Este processo
                      </span>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: '#EF9F27',
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ fontSize: FS.sm, color: '#D3D1C7' }}>
                        Município
                      </span>
                    </div>
                  </div>
                ) : null}
                {(() => {
                  const processoTemCfem = fiscal.cfem_historico.some(
                    (h) => h.valor_recolhido_brl > 0,
                  )
                  const procPorAno = new Map(
                    fiscal.cfem_historico.map((h) => [
                      h.ano,
                      h.valor_recolhido_brl,
                    ]),
                  )
                  const munPorAno = new Map(
                    fiscal.cfem_municipal_historico.map((h) => [
                      h.ano,
                      h.valor_total_municipio_brl,
                    ]),
                  )
                  const anos = [
                    ...new Set([
                      ...fiscal.cfem_historico.map((h) => h.ano),
                      ...fiscal.cfem_municipal_historico.map((h) => h.ano),
                    ]),
                  ].sort((a, b) => a - b)
                  const maxProc = Math.max(
                    ...anos.map((y) => procPorAno.get(y) ?? 0),
                    1,
                  )
                  const maxMun = Math.max(
                    ...anos.map((y) => munPorAno.get(y) ?? 0),
                    1,
                  )
                  const trackH = 80
                  const totalProc = fiscal.cfem_historico.reduce(
                    (s, h) => s + h.valor_recolhido_brl,
                    0,
                  )
                  const totalMun = fiscal.cfem_municipal_historico.reduce(
                    (s, h) => s + h.valor_total_municipio_brl,
                    0,
                  )
                  const pctRep =
                    totalMun > 0 ? (100 * totalProc) / totalMun : null
                  let linhaPct: ReactNode = null
                  if (!processoTemCfem) {
                    linhaPct = (
                      <p
                        style={{
                          fontSize: FS.sm,
                          color: '#888780',
                          margin: '10px 0 0 0',
                          lineHeight: 1.45,
                        }}
                      >
                        Este processo não gerou CFEM no período 2020-2024
                      </p>
                    )
                  } else if (pctRep != null && totalMun > 0) {
                    const muitoBaixa = pctRep > 0 && pctRep < 1
                    const pctTexto = muitoBaixa
                      ? '< 1%'
                      : `${pctRep.toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                          minimumFractionDigits: 0,
                        })}%`
                    linhaPct = (
                      <p
                        style={{
                          ...CFEM_CARD_SUBTITLE_STYLE,
                          color: '#D3D1C7',
                          margin: '10px 0 0 0',
                        }}
                      >
                        Este processo representa{' '}
                        <strong
                          style={{
                            fontWeight: 700,
                            color: '#EF9F27',
                          }}
                        >
                          {pctTexto}
                        </strong>{' '}
                        da CFEM municipal
                      </p>
                    )
                  }
                  const dataIsoCfem = [
                    timestamps.cfem,
                    timestamps.cfem_municipal,
                  ].reduce((a, b) => (a > b ? a : b))
                  return (
                    <>
                      <RelatorioCfemBarrasComTooltip
                        processoTemCfem={processoTemCfem}
                        anos={anos}
                        procPorAno={procPorAno}
                        munPorAno={munPorAno}
                        maxProc={maxProc}
                        maxMun={maxMun}
                        trackH={trackH}
                      />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          marginTop: 4,
                          marginBottom: 28,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: '#888780',
                              margin: '0 0 6px 0',
                              lineHeight: 1.3,
                            }}
                          >
                            Este processo 5 anos
                          </p>
                          {processoTemCfem ? (
                            <p
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: '#4A90B8',
                                margin: 0,
                                lineHeight: 1.2,
                              }}
                            >
                              {formatarRealBrlInteligente(totalProc)}
                            </p>
                          ) : (
                            <p
                              style={{
                                fontSize: FS.sm,
                                color: '#5F5E5A',
                                margin: 0,
                                lineHeight: 1.2,
                                fontWeight: 400,
                              }}
                            >
                              Sem arrecadação
                            </p>
                          )}
                        </div>
                        <div
                          style={{
                            width: 1,
                            flexShrink: 0,
                            backgroundColor: '#2C2C2A',
                            alignSelf: 'stretch',
                            margin: '0 8px',
                          }}
                          aria-hidden
                        />
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: '#888780',
                              margin: '0 0 6px 0',
                              lineHeight: 1.3,
                            }}
                          >
                            Município 5 anos
                          </p>
                          <p
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: '#EF9F27',
                              margin: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {formatarRealBrlInteligente(totalMun)}
                          </p>
                        </div>
                      </div>
                      {linhaPct}
                      <FonteLabel
                        dataIso={dataIsoCfem}
                        fonte="ANM / CFEM"
                        marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
                      />
                    </>
                  )
                })()}
              </Card>
            ) : null}

            <Card>
              <SecLabel branco>Incentivos estaduais</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fiscal.incentivos_estaduais.map((x) => (
                  <span
                    key={x}
                    style={{
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: FS.md,
                      lineHeight: 1.3,
                      backgroundColor: 'rgba(29, 158, 117, 0.15)',
                      color: '#1D9E75',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="Secretarias estaduais / STN"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Linhas BNDES</SecLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fiscal.linhas_bndes.map((x) => (
                  <span
                    key={x}
                    style={{
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: FS.md,
                      lineHeight: 1.3,
                      backgroundColor: 'rgba(74, 144, 184, 0.15)',
                      color: '#4A90B8',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
              <FonteLabel
                dataIso={timestamps.siconfi}
                fonte="BNDES / Linhas de crédito"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>

            <Card>
              <SecLabel branco>Estimativa CFEM em operação</SecLabel>
              {processo.regime === 'bloqueio_permanente' ? (
                <p
                  style={{
                    fontSize: FS.xxl,
                    fontWeight: 500,
                    color: '#5F5E5A',
                    margin: '0 0 8px 0',
                  }}
                >
                  Processo bloqueado permanentemente, sem previsão de operação
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: FS.xxl,
                      fontWeight: 500,
                      color: '#EF9F27',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {formatarRealBrlInteligente(
                      fiscal.estimativa_cfem_anual_operacao_mi * 1_000_000,
                    )}{' '}
                    / ano
                  </p>
                  {processo.regime === 'bloqueio_provisorio' ? (
                    <p
                      style={{
                        fontSize: FS.sm,
                        color: '#5F5E5A',
                        margin: '0 0 10px 0',
                        lineHeight: 1.5,
                      }}
                    >
                      (projeção condicional ao levantamento do bloqueio)
                    </p>
                  ) : null}
                </>
              )}
              <p
                style={{
                  fontSize: FS.lg,
                  color: SECTION_TITLE,
                  margin: '0 0 10px 0',
                  lineHeight: 1.5,
                }}
              >
                Estimativa de CFEM anual em fase de operação
              </p>
              <p
                style={{
                  fontSize: FS.lg,
                  color: '#888780',
                  margin: '6px 0 0 0',
                  lineHeight: 1.5,
                }}
              >
                Alíquota aplicável:{' '}
                <span style={{ color: '#F1EFE8' }}>
                  {fiscal.aliquota_cfem_pct}%
                </span>
              </p>
              <FonteLabel
                dataIso={timestamps.cfem}
                fonte="ANM / CFEM · Alíquotas"
                marginTopPx={FONTE_LABEL_MARGIN_TOP_RELATORIO_EXTRA_PX}
              />
            </Card>
          </>
        ) : null}
        </div>
      </div>
    </div>
  )
}
