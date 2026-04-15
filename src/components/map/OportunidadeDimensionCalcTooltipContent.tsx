import type { CSSProperties, ReactNode } from 'react'
import type { RelatorioOportunidadeData } from '../../data/relatorio.mock'
import { corFaixaOS } from '../../lib/oportunidadeRelatorioUi'

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

type DimOS = 'atratividade' | 'viabilidade' | 'seguranca'

/** Tooltip de cálculo por dimensão (Opportunity Score), mesmo padrão visual do Risk Score. */
export function OportunidadeDimensionCalcTooltipContent({
  dim,
  oportunidade,
}: {
  dim: DimOS
  oportunidade: RelatorioOportunidadeData
}): ReactNode {
  const scoreDim = oportunidade.dimensoes[dim].valor
  const vars = oportunidade.decomposicao[dim]

  const footerDim =
    dim === 'atratividade'
      ? 'Atratividade: score = soma ponderada das variáveis acima.'
      : dim === 'viabilidade'
        ? 'Viabilidade: score = soma ponderada das variáveis acima.'
        : 'Segurança: score = soma ponderada das variáveis acima.'

  return (
    <div style={{ maxWidth: 280 }}>
      {vars.map((v) =>
        rowWeighted(v.nome, Math.round(v.peso * 100), v.valor),
      )}
      {separadora()}
      {linhaResultado(scoreDim)}
      <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
        {footerDim}
      </div>
    </div>
  )
}
