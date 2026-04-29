# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / 'server' / 'scoringMotorS31.ts'
s = target.read_text(encoding='utf-8')
anchor = "import type { ScoreResult } from './scoreEngine'\n\nconst dbUrl"
inj = """import type { ScoreResult } from './scoreEngine'
import type { DimensaoOutput, SubfatorOutput } from './scoringS31BreakdownTypes'

export type { DimensaoOutput, SubfatorOutput } from './scoringS31BreakdownTypes'

function fmtKm(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function classifyLabelRisk(bruto0_100: number): string {
  if (bruto0_100 < 40) return 'Risco baixo'
  if (bruto0_100 < 70) return 'Risco médio'
  return 'Risco alto'
}

function classifyLabelOpp(bruto0_100: number): string {
  if (bruto0_100 < 25) return 'Oportunidade baixa'
  if (bruto0_100 < 50) return 'Oportunidade média'
  if (bruto0_100 < 75) return 'Oportunidade alta'
  return 'Oportunidade muito alta'
}

function biomaCoef(b: string | null | undefined): number {
  if (!b) return 1
  const k = b.trim()
  const o: Record<string, number> = {
    Amazonia: 1.3,
    'Amazônia': 1.3,
    'MATA ATLANTICA': 1.2,
    'MATA ATLÂNTICA': 1.2,
    Pantanal: 1.25,
    Cerrado: 1.1,
    Caatinga: 1,
    Pampa: 1,
  }
  return o[k] ?? 1
}

function warnCoerenciaDimensao(label: string, d: DimensaoOutput) {
  const soma = d.subfatores.reduce((s, r) => s + r.valor, 0)
  if (Math.abs(soma - d.valor) > 0.5)
    console.warn(
      '[scoringMotorS31] Coerência ' + label + ': Σ subfatores.valor=' + soma.toFixed(3) + ' vs dimensão.valor=' + d.valor,
    )
}

const dbUrl"""
if anchor not in s:
    raise SystemExit('anchor missing')
target.write_text(s.replace(anchor, inj), encoding='utf-8')
print('phase1 helpers ok')
