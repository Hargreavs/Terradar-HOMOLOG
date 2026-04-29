# -*- coding: utf-8 -*-
"""Replace dimGeologico implementation."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'server' / 'scoringMotorS31.ts'
text = p.read_text(encoding='utf-8')
old = """export function dimGeologico(p: ProcessoMotorRow, cfg: Record<string, unknown> | null) {
  return Math.min(100, Math.round(0.5 * pickSubScore(p.substancia, cfg) + 25))
}
"""
new = """export function dimGeologico(
  p: ProcessoMotorRow,
  cfg: Record<string, unknown> | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const scoreSubst = pickSubScore(p.substancia, cfg)
  const scoreQual = 50
  const valor = Math.min(100, Math.round(0.5 * scoreSubst + scoreQual * 0.5))
  if (!options?.returnSubfatores) return valor
  const sf: SubfatorOutput[] = [
    {
      nome: 'Substância mineral',
      fonte: 'ANM/config_scores (2_RS_GEOLOGICO)',
      label: classifyLabelRisk(scoreSubst),
      texto:
        p.substancia != null && String(p.substancia).trim().length > 0
          ? `Substância declarada: "${String(p.substancia)}". Score de relevância ${fmtKm(scoreSubst)}.`
          : 'Substância não informada; score neutro no lookup.',
      valor: scoreSubst * 0.5,
      peso_pct: 0.5,
      valor_bruto: scoreSubst,
    },
    {
      nome: 'Qualidade da informação cadastral',
      fonte: 'Baseline cadastro S31 (50)',
      label: classifyLabelRisk(scoreQual),
      texto:
        scoreQual >= 40
          ? `Linha de base documental (${fmtKm(scoreQual)} pontos) incorporada ao consolidado.`
          : 'Dado não disponível sobre qualidade documental granular; baseline 50 pontos aplicada.',
      valor: scoreQual * 0.5,
      peso_pct: 0.5,
      valor_bruto: scoreQual,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Geológico', out)
  return out
}
"""
if old not in text:
    raise SystemExit('dimGeologico block not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('dimGeologico ok')
