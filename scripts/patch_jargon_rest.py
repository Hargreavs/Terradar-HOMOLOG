# -*- coding: utf-8 -*-
from pathlib import Path

P = Path(__file__).resolve().parents[1] / "server" / "scoringMotorS31.ts"
t = P.read_text(encoding="utf-8")


def rep(old: str, new: str) -> None:
    global t
    if old not in t:
        raise SystemExit("missing fragment:\n" + old[:120])
    t = t.replace(old, new, 1)


rep(
    'Score de relevância',
    'Índice de relevância minerária',
)
rep(
    "Substância não informada; score neutro no lookup.",
    "Substância não informada; cadastro tratado aqui como neutro.",
)
rep(
    "        scoreQual >= 40\n          ? `Linha de base documental (${fmtKm(scoreQual)} pontos) incorporada ao consolidado.`\n          : 'Dado não disponível sobre qualidade documental granular; baseline 50 pontos aplicada.',",
    "        scoreQual >= 40\n          ? `Qualidade cadastral documental (${fmtKm(scoreQual)}) segundo o referencial uniforme do motor.`\n          : 'Qualidade documental granular indisponível; referência intermediária uniforme quando o detalhe não veio no extrato.',",
)
rep(
    "      texto: `Lookup de substância ${p.substancia ?? '—'} → ${fmtKm(a1)} pts.`,",
    "      texto: `Substância ${p.substancia ?? '—'} mapeada com índice sintético ${fmtKm(a1)} no quadro atual.`,",
)
rep(
    "      texto: g != null ? `Gap de preço ${fmtKm(g)} pp.` : 'Gap não informado; baseline 40.',",
    "      texto:\n        g != null\n          ? `Gap de mercado (${fmtKm(g)} p.p.) entre substância e benchmark interno.`\n          : 'Mercado não informado; cenário econômico marcado aqui como referência média.',",
)
rep(
    "      texto: pr != null && pr > 0 ? `Preço BRL/t ${fmtKm(pr)}.` : 'Preço não informado; baseline 30.',",
    "      texto:\n        pr != null && pr > 0\n          ? `Preço médio monitorado (${fmtKm(pr)} BRL/t).`\n          : 'Preço externo não informado; posição econômica marcada aqui como fraca até nova evidência.',",
)
rep(
    "      texto: sub?.tendencia != null ? `Tendência: ${sub.tendencia}.` : 'Tendência não informada; 50 pts.',",
    "      texto:\n        sub?.tendencia != null\n          ? `Tendência de mercado registrada: ${sub.tendencia}.`\n          : 'Tendência não informada; trajetória assumida estável até novo dado.',",
)
rep(
    "          : 'Sem valor de reserva ou área; baseline 10.',",
    "          : 'Sem valores de reserva econômica nem áreas declaradas; cenário econômico marcado aqui como muito restrito.',",
)
rep(
    "  if (!cand.length) return 'Nenhuma ferrovia/porto/hidrovia em malha listada (baseline 20).'",
    "  if (!cand.length) return 'Nenhuma ferrovia, porto ou hidrovia identificada na malha listada; distância de referência neutra usada (20 em escala interna).'",
)
rep(
    "      texto: `Fase ${p.fase ?? '—'} → score ${fmtKm(b1)}.`,",
    "      texto: `Fase declarada ${p.fase ?? '—'}; posição no quadro de fases ${fmtKm(b1)}.`,",
)
rep(
    "      fonte: 'baseline motor S31',",
    "      fonte: 'parâmetros internos de profundidade',",
)
rep(
    "      texto: 'Profundidade geológica modelada (50 pts baseline).',",
    "      texto: 'Profundidade geológica conforme modelagem interna; referência central em 50 na escala adotada.',",
)
rep(
    "      texto: `${b3InfraText(ls)} → score ${fmtKm(b3m)}.`,",
    "      texto: `${b3InfraText(ls)}; posição infraestrutural ${fmtKm(b3m)} no mesmo quadro.`,",
)

P.write_text(t, encoding="utf-8")
print("patch_jargon_rest ok")
