import type { CSSProperties, ReactNode } from 'react'
import type { RelatorioOportunidadeData } from '../../data/relatorio.mock'
import { corFaixaOS } from '../../lib/oportunidadeRelatorioUi'

/** Secundário: percentuais e fórmulas (tooltip). */
const META = '#B5B3AB'
const LABEL = '#D3D1C7'
const SEP = '#2C2C2A'
const DOT = '#8E8C84'

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 0,
  width: '100%',
  fontVariantNumeric: 'tabular-nums',
}

function linhaPontilhada() {
  return (
    <span
      aria-hidden
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 6,
        margin: '0 5px',
        borderBottom: `1px dotted ${DOT}`,
        opacity: 0.75,
        transform: 'translateY(-2px)',
      }}
    />
  )
}

function rowWeighted(label: string, pct: number, valor: number): ReactNode {
  const corV = corFaixaOS(valor)
  return (
    <div key={`${label}-${pct}`} style={rowStyle}>
      <span style={{ color: LABEL, flexShrink: 0, maxWidth: '62%' }}>
        {label}{' '}
        <span style={{ color: META }}>({pct}%)</span>
      </span>
      {linhaPontilhada()}
      <span style={{ color: corV, flexShrink: 0, fontWeight: 600 }}>{valor}</span>
    </div>
  )
}

function separadora() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: SEP,
        margin: '8px 0',
      }}
    />
  )
}

function linhaResultado(score: number) {
  const corResult = corFaixaOS(score)
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        width: '100%',
        fontWeight: 700,
        marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ color: LABEL }}>=</span>
      <span style={{ color: corResult }}>{score}</span>
    </div>
  )
}

type PerfilId = 'conservador' | 'moderado' | 'arrojado'

const FORMULA: Record<
  PerfilId,
  { linhas: [string, number][]; formula: string }
> = {
  conservador: {
    linhas: [
      ['Atratividade', 25],
      ['Viabilidade', 30],
      ['Segurança', 45],
    ],
    formula: 'OS Conservador = Atrat × 0.25 + Viab × 0.30 + Seg × 0.45',
  },
  moderado: {
    linhas: [
      ['Atratividade', 40],
      ['Viabilidade', 30],
      ['Segurança', 30],
    ],
    formula: 'OS Moderado = Atrat × 0.40 + Viab × 0.30 + Seg × 0.30',
  },
  arrojado: {
    linhas: [
      ['Atratividade', 55],
      ['Viabilidade', 25],
      ['Segurança', 20],
    ],
    formula: 'OS Arrojado = Atrat × 0.55 + Viab × 0.25 + Seg × 0.20',
  },
}

/** Tooltip com fórmula do Opportunity Score por perfil (blocos do card resumo). */
export function OportunidadePerfilCalcTooltipContent({
  perfil,
  oportunidade,
}: {
  perfil: PerfilId
  oportunidade: RelatorioOportunidadeData
}): ReactNode {
  const cfg = FORMULA[perfil]
  const a = oportunidade.dimensoes.atratividade.valor
  const v = oportunidade.dimensoes.viabilidade.valor
  const s = oportunidade.dimensoes.seguranca.valor
  const valores = [a, v, s]
  const total = oportunidade.perfis[perfil].valor

  return (
    <div style={{ maxWidth: 280 }}>
      {cfg.linhas.map(([nome, pct], i) =>
        rowWeighted(nome, pct, valores[i]!),
      )}
      {separadora()}
      {linhaResultado(total)}
      <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>{cfg.formula}</div>
    </div>
  )
}
