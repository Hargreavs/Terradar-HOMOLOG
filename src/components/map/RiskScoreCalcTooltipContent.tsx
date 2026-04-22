import type { CSSProperties, ReactNode } from 'react'
import type { RiskDimensaoDetalhe, RiskScoreDecomposicao } from '../../types'
import { corFaixaRiscoValor } from '../../lib/riskScoreDecomposicao'

/** Secundário: percentuais, fórmulas e notas (contraste melhor sobre o bubble #2C2C2A). */
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
  const corV = corFaixaRiscoValor(valor)
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

function rowAmbient(nomeCurto: string, valor: number): ReactNode {
  const corV = corFaixaRiscoValor(valor)
  return (
    <div key={nomeCurto} style={rowStyle}>
      <span style={{ color: LABEL, flexShrink: 0, maxWidth: '62%' }}>{nomeCurto}</span>
      {linhaPontilhada()}
      <span style={{ color: corV, flexShrink: 0, fontWeight: 600 }}>+{valor}</span>
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

const AMB_NOME_CURTO: Record<string, string> = {
  'Sobreposição com TI': 'Sobrepos. TI',
  'Sobreposição com UC PI': 'Sobrepos. UC PI',
  'Sobreposição com APP': 'Sobrepos. APP',
  'Proximidade a quilombola': 'Proxim. quilombola',
  'Proximidade a UC US': 'Proximidade UC US',
  'Proximidade a aquífero': 'Proximidade aquífero',
  'Bioma Amazônia': 'Bioma Amazônia',
  'Bioma Mata Atlântica': 'Bioma Mata Atlântica',
  'Bioma Pantanal': 'Bioma Pantanal',
}

function vGeo(det: RiskDimensaoDetalhe, nome: string): number {
  return det.variaveis.find((v) => v.nome === nome)?.valor ?? 0
}

function linhaResultado(score: number) {
  const corResult = corFaixaRiscoValor(score)
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

/** Conteúdo rico do tooltip de cálculo por dimensão (Risk Score). */
export function RiskDimensionCalcTooltipContent({
  dim,
  det,
}: {
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio'
  det: RiskDimensaoDetalhe
}): ReactNode {
  const scoreDim = det.score

  if (dim === 'geologico') {
    const s = vGeo(det, 'Substância')
    const f = vGeo(det, 'Fase do processo')
    const q = vGeo(det, 'Qualidade da informação')
    return (
      <div style={{ maxWidth: 280 }}>
        {rowWeighted('Substância', 30, s)}
        {rowWeighted('Fase', 45, f)}
        {rowWeighted('Qualidade', 25, q)}
        {separadora()}
        {linhaResultado(scoreDim)}
        <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
          Geológico = Substância × 0.30 + Fase × 0.45 + Qualidade × 0.25
        </div>
      </div>
    )
  }

  if (dim === 'ambiental') {
    const fatores = det.variaveis.filter(
      (v) => v.valor > 0 && v.nome !== 'Resumo',
    )
    if (fatores.length === 0) {
      return (
        <div style={{ maxWidth: 280 }}>
          <div style={{ color: LABEL }}>Nenhuma restrição = 0</div>
          {separadora()}
          {linhaResultado(scoreDim)}
          <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
            Ambiental = soma dos fatores (teto 100)
          </div>
        </div>
      )
    }
    const soma = fatores.reduce((acc, v) => acc + v.valor, 0)
    return (
      <div style={{ maxWidth: 280 }}>
        {fatores.map((v) =>
          rowAmbient(AMB_NOME_CURTO[v.nome] ?? v.nome, v.valor),
        )}
        {separadora()}
        {soma > 100 ? (
          <div style={{ color: META, marginBottom: 6, lineHeight: 1.35 }}>
            Soma: {soma} → Teto: 100
          </div>
        ) : null}
        {linhaResultado(scoreDim)}
        <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
          Ambiental = soma dos fatores (teto 100)
        </div>
      </div>
    )
  }

  if (dim === 'social') {
    const idh = det.variaveis.find((v) => v.nome === 'IDH-M')?.valor ?? 0
    const dens =
      det.variaveis.find((v) => v.nome === 'Densidade populacional')?.valor ?? 0
    const com =
      det.variaveis.find((v) => v.nome === 'Comunidades tradicionais')?.valor ?? 0
    const cap = det.variaveis.find((v) => v.nome === 'CAPAG município')?.valor ?? 0
    return (
      <div style={{ maxWidth: 280 }}>
        {rowWeighted('IDH-M', 35, idh)}
        {rowWeighted('Densidade', 20, dens)}
        {rowWeighted('Comunidades', 25, com)}
        {rowWeighted('CAPAG', 20, cap)}
        {separadora()}
        {linhaResultado(scoreDim)}
        <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
          Social = IDH × 0.35 + Densidade × 0.20 + Comunidades × 0.25 + CAPAG ×
          0.20
        </div>
      </div>
    )
  }

  const t = det.variaveis.find((v) => v.nome === 'Tempo sem despacho')?.valor ?? 0
  const p = det.variaveis.find((v) => v.nome === 'Pendências')?.valor ?? 0
  const a = det.variaveis.find((v) => v.nome === 'Alertas restritivos')?.valor ?? 0
  const c =
    det.variaveis.find((v) => v.nome === 'Proximidade de caducidade')?.valor ?? 0
  return (
    <div style={{ maxWidth: 280 }}>
      {rowWeighted('Tempo s/ despacho', 30, t)}
      {rowWeighted('Pendências', 25, p)}
      {rowWeighted('Alertas restrit.', 25, a)}
      {rowWeighted('Caducidade', 20, c)}
      {separadora()}
      {linhaResultado(scoreDim)}
      <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
        Regulatório = Tempo × 0.30 + Pendências × 0.25 + Alertas × 0.25 +
        Caducidade × 0.20
      </div>
    </div>
  )
}

/** Tooltip do score total (4 dimensões × pesos do modelo). */
export function RiskTotalCalcTooltipContent({
  decomposicao,
}: {
  decomposicao: RiskScoreDecomposicao
}): ReactNode {
  const g = decomposicao.geologico.score
  const a = decomposicao.ambiental.score
  const s = decomposicao.social.score
  const r = decomposicao.regulatorio.score
  const total = decomposicao.total
  return (
    <div style={{ maxWidth: 280 }}>
      {rowWeighted('Geológico', 25, g)}
      {rowWeighted('Ambiental', 30, a)}
      {rowWeighted('Social', 25, s)}
      {rowWeighted('Regulatório', 20, r)}
      {separadora()}
      {linhaResultado(total)}
      <div style={{ marginTop: 8, color: META, lineHeight: 1.35 }}>
        Risk Score = Geo × 0.25 + Amb × 0.30 + Soc × 0.25 + Reg × 0.20
      </div>
    </div>
  )
}
