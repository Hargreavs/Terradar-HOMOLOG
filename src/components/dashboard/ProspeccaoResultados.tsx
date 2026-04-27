import { ArrowLeft, SearchX, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react'
import { motionGroupStyle } from '../../lib/motionStyles'
import {
  CORES_DIMENSAO,
  PESOS_PERFIL,
  corFaixaOpportunity,
  corMiniBarraValor,
  getOpportunityLabel,
  qualificadorTextoMiniBarra,
  type OpportunityResult,
  type PerfilRisco,
} from '../../lib/opportunityScore'
import { GridBreathingResultadosAnimation } from './animations/GridBreathingResultadosAnimation'
import { clampBarPct } from '../../lib/radar/bars'
import { TODAS_SUBST } from '../../lib/substancias'

const OPPORTUNITY_CARD_SELECTED_BORDER = 'rgba(239, 159, 39, 0.38)'
const OPPORTUNITY_CARD_SELECTED_SHADOW = '0 0 12px rgba(239, 159, 39, 0.05)'

function cn(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

function formatArea(ha: number): string {
  if (!Number.isFinite(ha)) return '—'
  return `${ha.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ha`
}

function substanciaPillLabel(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function titleCaseSubst(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function ehSubfatorParasita(v: { texto?: unknown; fonte?: unknown }): boolean {
  const texto = String((v as { texto?: unknown }).texto ?? '').toLowerCase()
  const padroes = [
    'não compõe',
    'nao compoe',
    'pendente',
    'fallback',
    'indisponível',
    'indisponivel',
    'não disponível',
    'nao disponivel',
  ]
  return padroes.some((p) => texto.includes(p))
}

function MiniBarra({ label, valor }: { label: string; valor: number }) {
  const cor = corMiniBarraValor(valor)
  const widthPct = Math.max(0, Math.min(100, valor))
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[76px] text-[12px] text-zinc-500">{label}</span>
      <div className="h-[5px] flex-1 overflow-hidden rounded-sm bg-zinc-900">
        <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, background: cor }} />
      </div>
      <span
        className="min-w-[24px] text-right text-[13px] font-medium tabular-nums"
        style={{ color: cor }}
      >
        {valor}
      </span>
    </div>
  )
}

function CardResultado({
  r,
  ord,
  onVerMapa,
  onVerCalculo,
}: {
  r: OpportunityResult
  ord: number
  onVerMapa: () => void
  onVerCalculo: () => void
}) {
  const scoreCor = corFaixaOpportunity(r.faixa)
  const scoreLabel = getOpportunityLabel(r.scoreTotal)
  const isLavra = (r.fase ?? '').toLowerCase().includes('lavra')
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-2">
            <span
              className="text-[18px] font-medium tabular-nums leading-none"
              style={{ color: '#EF9F27' }}
            >
              #{ord}
            </span>
            <span className="text-[15px] font-medium tabular-nums text-zinc-100">
              {r.numero ?? '—'}
            </span>
          </div>
          <div
            className="truncate text-[13px] leading-snug text-zinc-300"
            title={r.titular ?? undefined}
          >
            {r.titular?.trim() ? r.titular : '—'}
          </div>
          <div className="mt-0.5 text-[12px] text-zinc-500">
            {[r.municipio, r.uf].filter(Boolean).join(', ')}
            {r.areaHa != null && Number.isFinite(r.areaHa) ? ` · ${formatArea(r.areaHa)}` : ''}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-center gap-1">
          <span
            className="inline-flex items-center justify-center rounded-full text-[18px] font-medium tabular-nums"
            style={{
              width: 48,
              height: 48,
              border: `2px solid ${scoreCor}`,
              color: scoreCor,
            }}
          >
            {r.scoreTotal}
          </span>
          <span
            className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wider"
            style={{ color: scoreCor }}
          >
            {scoreLabel}
          </span>
        </div>
      </div>
      <div className="mb-3 flex gap-2 border-t border-zinc-800 pt-3">
        {r.substancia ? (
          <span className="inline-flex items-center rounded bg-amber-500/10 px-2.5 py-1 text-[12px] font-medium text-amber-200">
            {substanciaPillLabel(r.substancia)}
          </span>
        ) : null}
        {r.fase ? (
          <span
            className={cn(
              'inline-flex items-center rounded border px-2.5 py-1 text-[12px] font-medium',
              isLavra
                ? 'border-green-500/20 bg-green-500/10 text-green-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400',
            )}
          >
            {r.fase}
          </span>
        ) : null}
        {r.penalidades && r.penalidades.length > 0 ? (
          <span
            className="inline-flex items-center rounded border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-[12px] font-medium text-red-200"
            title={r.penalidades.join(' · ')}
          >
            Penalidades
          </span>
        ) : null}
      </div>
      <div className="mb-4 flex flex-col gap-1.5">
        <MiniBarra label="Atratividade" valor={r.scoreAtratividade ?? 0} />
        <MiniBarra label="Viabilidade" valor={r.scoreViabilidade ?? 0} />
        <MiniBarra label="Segurança" valor={r.scoreSeguranca ?? 0} />
      </div>
      <div className="flex gap-2 border-t border-zinc-800 pt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onVerMapa()
          }}
          style={{ cursor: 'pointer' }}
          className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-amber-400"
        >
          Ver no Mapa
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onVerCalculo()
          }}
          style={{ cursor: 'pointer' }}
          className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700"
        >
          Ver cálculo
        </button>
      </div>
    </div>
  )
}

interface SubfatorDrill {
  nome?: string
  valor?: number
  valor_bruto?: number
  peso_pct?: number
  texto?: string
  fonte?: string
  label?: string
}

function fmtPtSubfator(n: number): string {
  const arredondado = Math.round(n * 10) / 10
  if (arredondado === Math.round(arredondado)) {
    return String(Math.round(arredondado))
  }
  return arredondado.toFixed(1).replace('.', ',')
}

function SubfatorLinha({ subfator }: { subfator: SubfatorDrill }) {
  const pesoPct = Number((subfator as { peso_pct?: unknown }).peso_pct) || 0
  const tetoSubfator = pesoPct * 100
  const valorBrutoN = Number((subfator as { valor_bruto?: unknown }).valor_bruto)
  let valorCaptado = Number((subfator as { valor?: unknown }).valor)
  if (!Number.isFinite(valorCaptado) && tetoSubfator > 0 && Number.isFinite(valorBrutoN)) {
    valorCaptado = (valorBrutoN / 100) * tetoSubfator
  }
  if (!Number.isFinite(valorCaptado)) valorCaptado = 0
  const aproveitamentoPct = tetoSubfator > 0 ? (valorCaptado / tetoSubfator) * 100 : 0
  const q = qualificadorTextoMiniBarra(aproveitamentoPct)
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-zinc-300">{subfator.nome ?? subfator.label ?? '—'}</span>
        <div className="flex flex-shrink-0 items-baseline gap-2">
          <span className="text-[13px] font-medium tabular-nums" style={{ color: q.color }}>
            {fmtPtSubfator(valorCaptado)} de {fmtPtSubfator(tetoSubfator)}
          </span>
          <span className="min-w-[40px] text-right text-[11px] tracking-wide" style={{ color: '#888780' }}>
            {q.label}
          </span>
        </div>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-zinc-900">
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(100, aproveitamentoPct))}%`,
            background: q.color,
          }}
        />
      </div>
    </div>
  )
}

type DimK = 'atratividade' | 'viabilidade' | 'seguranca'

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function fmtPonderacao(n: number): string {
  return n
    .toFixed(4)
    .replace('.', ',')
    .replace(/0+$/, '')
    .replace(/,$/, '')
}

function PontuacaoFinalCard({
  r,
  perfil: _perfil,
  pesos,
}: {
  r: OpportunityResult
  perfil: PerfilRisco
  pesos: { a: number; b: number; c: number }
}) {
  const scoreCor = corFaixaOpportunity(r.faixa)
  const scoreLabel = getOpportunityLabel(r.scoreTotal)
  const a = r.scoreAtratividade ?? 0
  const v = r.scoreViabilidade ?? 0
  const s = r.scoreSeguranca ?? 0
  const contribA = a * pesos.a
  const contribV = v * pesos.b
  const contribS = s * pesos.c
  const fmt = fmtPonderacao
  return (
    <div
      className="mt-4 overflow-hidden rounded-lg p-4"
      style={{
        background: `linear-gradient(135deg, ${hexToRgba(scoreCor, 0.05)} 0%, ${hexToRgba(scoreCor, 0.06)} 100%)`,
        border: `1px solid ${hexToRgba(scoreCor, 0.25)}`,
        borderLeft: `3px solid ${scoreCor}`,
      }}
    >
      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-zinc-100">Pontuação final</div>
        <div className="mt-1.5 text-[28px] font-medium tabular-nums" style={{ color: scoreCor }}>
          {r.scoreTotal}
        </div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: scoreCor }}>
          {scoreLabel.toUpperCase()}
        </div>
        <div
          className="mt-3 border-t border-solid pt-3 text-[14px] leading-relaxed text-zinc-300"
          style={{ borderColor: hexToRgba(scoreCor, 0.15) }}
        >
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1.5 tabular-nums">
            <span className="whitespace-nowrap">
              A {a} × {fmt(pesos.a)} <span className="text-zinc-500">→</span> {fmt(contribA)}
            </span>
            <span className="text-zinc-600" aria-hidden>
              |
            </span>
            <span className="whitespace-nowrap">
              V {v} × {fmt(pesos.b)} <span className="text-zinc-500">→</span> {fmt(contribV)}
            </span>
            <span className="text-zinc-600" aria-hidden>
              |
            </span>
            <span className="whitespace-nowrap">
              S {s} × {fmt(pesos.c)} <span className="text-zinc-500">→</span> {fmt(contribS)}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function DimensaoExpandivel({
  k,
  nome,
  peso,
  valor,
  subfatores,
  cor,
  aberta,
  onToggle,
  reducedMotion,
}: {
  k: DimK
  nome: string
  peso: number
  valor: number
  subfatores: unknown[] | undefined
  cor: string
  aberta: boolean
  onToggle: (key: DimK) => void
  reducedMotion: boolean
}) {
  const subLista = (Array.isArray(subfatores) ? subfatores : []).filter(
    (sf) => !ehSubfatorParasita(sf as { texto?: unknown }),
  )
  const temSubs = subLista.length > 0
  const trClass = reducedMotion
    ? ''
    : 'transition-[grid-template-rows] duration-300 ease-in-out'
  const barStyle: CSSProperties = reducedMotion
    ? { width: `${clampBarPct(valor)}%`, background: cor }
    : { width: `${clampBarPct(valor)}%`, background: cor, transition: 'width 0.35s ease-out' }
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle(k)
        }}
        className="mb-2 flex w-full cursor-pointer items-center justify-between text-left"
        aria-expanded={aberta}
        aria-controls={`dim-drill-${k}`}
        id={`dim-head-${k}`}
      >
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-zinc-100">
          <span className="text-xs text-zinc-500" aria-hidden>
            {aberta ? '▼' : '▶'}
          </span>
          {nome} <span className="font-normal text-zinc-500">({Math.round(peso * 100)}%)</span>
        </span>
        <span className="text-[15px] font-medium tabular-nums" style={{ color: cor }}>
          {valor}
        </span>
      </button>
      <div className="mb-5 h-[5px] overflow-hidden rounded-sm bg-zinc-900">
        <div className="h-full rounded-sm" style={barStyle} />
      </div>
      {temSubs ? (
        <div
          className={cn('grid', trClass, aberta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
          id={`dim-drill-${k}`}
          role="region"
          aria-labelledby={`dim-head-${k}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-4 border-l border-zinc-800 pl-4">
              {subLista.map((sf, i) => (
                <SubfatorLinha key={i} subfator={sf as SubfatorDrill} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DrilldownCalculo({
  r,
  perfil,
  pesos,
  onVoltar,
  reducedMotion,
}: {
  r: OpportunityResult
  perfil: PerfilRisco
  pesos: { a: number; b: number; c: number }
  onVoltar: () => void
  reducedMotion: boolean
}) {
  const [dimAberta, setDimAberta] = useState<DimK | null>(null)
  const toggleDim = useCallback((k: DimK) => {
    setDimAberta((prev) => (prev === k ? null : k))
  }, [])
  const sa = r.scoreAtratividade ?? 0
  const sv = r.scoreViabilidade ?? 0
  const ss = r.scoreSeguranca ?? 0
  const dimensoes = r.dimensoesOportunidade
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="p-5"
      role="presentation"
    >
      <div className="mb-3">
        <div className="mb-1 text-[13px] font-medium text-zinc-100">Decomposição da Pontuação</div>
        <p className="mb-4 text-[12px] leading-relaxed text-zinc-400">
          Cada subfator contribui com até <span className="font-medium text-zinc-200">peso × 100</span> pontos
          para sua dimensão. A barra mostra quanto desse potencial foi capturado.
        </p>
      </div>
      <div className="mb-1 flex h-1.5 overflow-hidden rounded-sm bg-zinc-900">
        <div style={{ width: `${pesos.a * 100}%`, background: CORES_DIMENSAO.atratividade }} />
        <div style={{ width: `${pesos.b * 100}%`, background: CORES_DIMENSAO.viabilidade }} />
        <div style={{ width: `${pesos.c * 100}%`, background: CORES_DIMENSAO.seguranca }} />
      </div>
      <div className="mb-6 flex text-[12px] leading-tight text-zinc-400">
        <span className="text-center" style={{ flex: pesos.a, minWidth: 0 }}>
          Atratividade {Math.round(pesos.a * 100)}%
        </span>
        <span className="text-center" style={{ flex: pesos.b, minWidth: 0 }}>
          Viabilidade {Math.round(pesos.b * 100)}%
        </span>
        <span className="text-center" style={{ flex: pesos.c, minWidth: 0 }}>
          Segurança {Math.round(pesos.c * 100)}%
        </span>
      </div>
      <DimensaoExpandivel
        k="atratividade"
        nome="Atratividade"
        peso={pesos.a}
        valor={sa}
        subfatores={dimensoes?.atratividade?.subfatores as unknown[] | undefined}
        cor={CORES_DIMENSAO.atratividade}
        aberta={dimAberta === 'atratividade'}
        onToggle={toggleDim}
        reducedMotion={reducedMotion}
      />
      <DimensaoExpandivel
        k="viabilidade"
        nome="Viabilidade"
        peso={pesos.b}
        valor={sv}
        subfatores={dimensoes?.viabilidade?.subfatores as unknown[] | undefined}
        cor={CORES_DIMENSAO.viabilidade}
        aberta={dimAberta === 'viabilidade'}
        onToggle={toggleDim}
        reducedMotion={reducedMotion}
      />
      <DimensaoExpandivel
        k="seguranca"
        nome="Segurança"
        peso={pesos.c}
        valor={ss}
        subfatores={dimensoes?.seguranca?.subfatores as unknown[] | undefined}
        cor={CORES_DIMENSAO.seguranca}
        aberta={dimAberta === 'seguranca'}
        onToggle={toggleDim}
        reducedMotion={reducedMotion}
      />
      <PontuacaoFinalCard r={r} perfil={perfil} pesos={pesos} />
      <div className="mt-4 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onVoltar()
          }}
          className="cursor-pointer rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}

const filtroChipsClass =
  'inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-[13px] text-zinc-200'

function perfilDotColor(proRisco: PerfilRisco): string {
  if (proRisco === 'conservador') return '#1D9E75'
  if (proRisco === 'moderado') return '#E8A830'
  return '#E24B4A'
}

function botaoPaginacaoStyle(disabled: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: disabled ? '#2C2C2A' : '#5F5E5A',
    background: 'transparent',
    color: disabled ? '#5F5E5A' : '#D3D1C7',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

export function ProspeccaoResultados({
  resultados,
  totalOportunidades,
  paginaAtual,
  carregandoPagina,
  onIrParaPagina,
  pageSize,
  resultadosListRef,
  proRisco,
  proSubst,
  proUfs,
  selectedResultId,
  setSelectedResultId,
  cardVis,
  barsReady: _barsReady,
  reducedMotion,
  navigateProcessoMapa,
  handleRefinarBusca,
  handleRefinarBuscaDesdeVazio,
  handleVoltarAoRadar,
  showToast,
  onAbrirRefinarSubst,
  onRemoverFiltroSubst,
}: {
  resultados: OpportunityResult[]
  totalOportunidades: number | null
  paginaAtual: number
  carregandoPagina: boolean
  onIrParaPagina: (pagina: number) => void | Promise<void>
  pageSize: number
  resultadosListRef: RefObject<HTMLDivElement | null>
  proRisco: PerfilRisco | null
  proSubst: string[]
  proUfs: string[]
  selectedResultId: string | null
  setSelectedResultId: (id: string | null) => void
  cardVis: boolean[]
  barsReady: boolean
  reducedMotion: boolean
  navigateProcessoMapa: (processoId: string, numeroAnm?: string | null) => void
  handleRefinarBusca: () => void
  handleRefinarBuscaDesdeVazio: () => void
  handleVoltarAoRadar: () => void
  showToast: (m: string) => void
  onAbrirRefinarSubst: () => void
  onRemoverFiltroSubst: (substancia: string) => void
}) {
  void _barsReady
  const cardsGridRef = resultadosListRef
  const [drilldownOpen, setDrilldownOpen] = useState<string | null>(null)
  const drilldownOpenRef = useRef<string | null>(null)
  const [flipActiveId, setFlipActiveId] = useState<string | null>(null)
  const [flipOpaque, setFlipOpaque] = useState(true)
  const flipTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    drilldownOpenRef.current = drilldownOpen
  }, [drilldownOpen])

  useEffect(() => {
    return () => {
      for (const id of flipTimersRef.current) clearTimeout(id)
      flipTimersRef.current = []
    }
  }, [])

  const beginFlipOpen = useCallback(
    (processoId: string) => {
      if (reducedMotion) {
        setDrilldownOpen(processoId)
        return
      }
      const prev = drilldownOpenRef.current
      if (prev != null && prev !== processoId) {
        setDrilldownOpen(processoId)
        return
      }
      setFlipActiveId(processoId)
      setFlipOpaque(false)
      const t1 = window.setTimeout(() => {
        setDrilldownOpen(processoId)
        setFlipOpaque(true)
        const t2 = window.setTimeout(() => setFlipActiveId(null), 220)
        flipTimersRef.current.push(t2)
      }, 150)
      flipTimersRef.current.push(t1)
    },
    [reducedMotion],
  )

  const beginFlipClose = useCallback(() => {
    if (reducedMotion) {
      setDrilldownOpen(null)
      return
    }
    const id = drilldownOpenRef.current
    if (!id) return
    setFlipActiveId(id)
    setFlipOpaque(false)
    const t1 = window.setTimeout(() => {
      setDrilldownOpen(null)
      setFlipOpaque(true)
      const t2 = window.setTimeout(() => setFlipActiveId(null), 220)
      flipTimersRef.current.push(t2)
    }, 150)
    flipTimersRef.current.push(t1)
  }, [reducedMotion])

  useEffect(() => {
    if (selectedResultId != null) return
    for (const id of flipTimersRef.current) clearTimeout(id)
    flipTimersRef.current = []
    setDrilldownOpen(null)
    setFlipActiveId(null)
    setFlipOpaque(true)
  }, [selectedResultId])

  useEffect(() => {
    if (selectedResultId == null) return
    const handlePointerDown = (e: PointerEvent) => {
      const root = cardsGridRef.current
      if (!root || root.contains(e.target as Node)) return
      setSelectedResultId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedResultId, setSelectedResultId])

  const perfilForDrill = proRisco ?? 'moderado'
  const pesosDrill = PESOS_PERFIL[perfilForDrill]
  const totalPaginas =
    totalOportunidades != null
      ? Math.max(1, Math.ceil(totalOportunidades / pageSize))
      : 1
  const proximaSemContagem = totalOportunidades === null
  const podeProximaComContagem =
    totalOportunidades != null && paginaAtual < totalPaginas
  const podeProximaSemContagem = proximaSemContagem && resultados.length === pageSize
  const desabilitaProxima = proximaSemContagem
    ? !podeProximaSemContagem
    : !podeProximaComContagem

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#0D0D0C',
        minHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100vh',
          maxHeight: '100dvh',
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden
      >
        <GridBreathingResultadosAnimation />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 52 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={handleRefinarBusca}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888780',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F1EFE8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888780'
                }}
                title="Refinar busca no assistente"
              >
                <ArrowLeft size={20} />
              </button>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 500,
                  color: '#F1EFE8',
                }}
              >
                {totalOportunidades !== null
                  ? `${totalOportunidades.toLocaleString('pt-BR')} oportunidades identificadas`
                  : `${resultados.length} oportunidades carregadas`}
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleVoltarAoRadar}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#888780',
                  fontSize: 14,
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F1EFE8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888780'
                }}
              >
                Voltar ao Radar
              </button>
              <button
                type="button"
                onClick={() => showToast('Disponível em breve')}
                style={{
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#EF9F27',
                  color: '#EF9F27',
                  fontSize: 14,
                  borderRadius: 8,
                  padding: '8px 20px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 159, 39, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                Salvar prospecção
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              marginLeft: 40,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {proRisco ? (
              <span className={filtroChipsClass}>
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: perfilDotColor(proRisco) }}
                  aria-hidden
                />
                {proRisco.charAt(0).toUpperCase() + proRisco.slice(1)}
              </span>
            ) : null}

            {proSubst.includes(TODAS_SUBST) ? (
              <span className={filtroChipsClass}>Todas</span>
            ) : (
              proSubst.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[13px] text-amber-200"
                >
                  <span>{titleCaseSubst(s)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoverFiltroSubst(s)
                    }}
                    aria-label={`Remover ${s}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888780',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))
            )}

            {proUfs.length > 0 ? (
              proUfs.map((uf) => (
                <span key={uf} className={filtroChipsClass}>
                  {uf}
                </span>
              ))
            ) : (
              <span className={filtroChipsClass}>Brasil</span>
            )}

            <button
              type="button"
              onClick={onAbrirRefinarSubst}
              className="cursor-pointer rounded-full border border-dashed border-zinc-700 bg-transparent px-3.5 py-2 text-[13px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              + Filtrar substância
            </button>
          </div>
        </div>

        {resultados.length === 0 && paginaAtual === 1 ? (
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: '60vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                maxWidth: 420,
              }}
            >
              <SearchX size={40} color="#5F5E5A" style={{ marginBottom: 16 }} aria-hidden />
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#D3D1C7',
                }}
              >
                Nenhuma oportunidade identificada
              </h3>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: '#888780',
                  lineHeight: 1.5,
                }}
              >
                Nenhum processo atende aos critérios mínimos de score para o perfil selecionado. Tente
                ampliar as substâncias ou a região.
              </p>
              <button
                type="button"
                onClick={handleRefinarBuscaDesdeVazio}
                style={{
                  marginTop: 24,
                  backgroundColor: '#EF9F27',
                  color: '#0D0D0C',
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '10px 28px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)'
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Refinar busca
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={cardsGridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {resultados.length === 0 && paginaAtual > 1 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#888780',
                  fontSize: 14,
                  padding: '32px 16px',
                }}
              >
                Nada nesta página. Use &quot;Anterior&quot; ou ajuste a busca.
              </div>
            ) : null}
            {resultados.map((r, i) => {
              const isSelected = selectedResultId === r.processoId

              const applyCardSurfaceAfterToggle = (
                el: HTMLDivElement,
                nextSelected: boolean,
                fromMouseClick: boolean,
              ) => {
                if (nextSelected) {
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = OPPORTUNITY_CARD_SELECTED_BORDER
                  el.style.boxShadow = OPPORTUNITY_CARD_SELECTED_SHADOW
                } else if (fromMouseClick) {
                  el.style.borderColor = '#5F5E5A'
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
                } else {
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = '#2C2C2A'
                  el.style.boxShadow = 'none'
                }
              }

              const handleCardClick = (e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
                const nextSelected = !isSelected
                applyCardSurfaceAfterToggle(e.currentTarget, nextSelected, e.type === 'click')
                if (isSelected) {
                  setSelectedResultId(null)
                  setDrilldownOpen(null)
                } else {
                  setSelectedResultId(r.processoId)
                  setDrilldownOpen(null)
                }
              }

              return (
                <div
                  key={r.processoId}
                  role="button"
                  tabIndex={0}
                  onClick={handleCardClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardClick(e)
                    }
                  }}
                  style={{
                    ...motionGroupStyle(cardVis[i] ?? true, reducedMotion),
                    backgroundColor: 'rgba(26, 26, 24, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: isSelected ? OPPORTUNITY_CARD_SELECTED_BORDER : '#2C2C2A',
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: isSelected ? OPPORTUNITY_CARD_SELECTED_SHADOW : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#5F5E5A'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.transform = 'translateY(0)'
                    if (isSelected) {
                      el.style.borderColor = OPPORTUNITY_CARD_SELECTED_BORDER
                      el.style.boxShadow = OPPORTUNITY_CARD_SELECTED_SHADOW
                    } else {
                      el.style.borderColor = '#2C2C2A'
                      el.style.boxShadow = 'none'
                    }
                  }}
                >
                  <div
                    style={{
                      ...(reducedMotion
                        ? {}
                        : {
                            opacity:
                              flipActiveId === r.processoId ? (flipOpaque ? 1 : 0) : 1,
                            transition:
                              flipActiveId === r.processoId
                                ? 'opacity 150ms ease-in-out'
                                : undefined,
                          }),
                      pointerEvents:
                        !reducedMotion &&
                        flipActiveId === r.processoId &&
                        !flipOpaque
                          ? 'none'
                          : 'auto',
                    }}
                  >
                    {drilldownOpen !== r.processoId ? (
                      <div>
                        <CardResultado
                          r={r}
                          ord={i + 1}
                          onVerMapa={() => {
                            const n = (r.numero && String(r.numero).trim()) || ''
                            const id = (r.processoId && String(r.processoId).trim()) || ''
                            if (!n && !id) {
                              console.warn('[Ver no Mapa] Card sem numero nem processoId', r)
                              return
                            }
                            navigateProcessoMapa(id, n || null)
                          }}
                          onVerCalculo={() => {
                            setSelectedResultId(r.processoId)
                            beginFlipOpen(r.processoId)
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#1A1A18' }} className="bg-[#1A1A18]">
                        <DrilldownCalculo
                          key={r.processoId}
                          r={r}
                          perfil={perfilForDrill}
                          pesos={pesosDrill}
                          onVoltar={beginFlipClose}
                          reducedMotion={reducedMotion}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {resultados.length > 0 || paginaAtual > 1 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                  padding: '24px 0',
                  fontSize: 14,
                  color: '#B4B2A9',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    void onIrParaPagina(paginaAtual - 1)
                  }}
                  disabled={paginaAtual === 1 || carregandoPagina}
                  style={botaoPaginacaoStyle(paginaAtual === 1 || carregandoPagina)}
                >
                  ← Anterior
                </button>
                {totalOportunidades === null ? null : (
                  <span>
                    Página <strong>{paginaAtual}</strong> de{' '}
                    {totalPaginas.toLocaleString('pt-BR')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void onIrParaPagina(paginaAtual + 1)
                  }}
                  disabled={desabilitaProxima || carregandoPagina}
                  style={botaoPaginacaoStyle(desabilitaProxima || carregandoPagina)}
                >
                  Próxima →
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
