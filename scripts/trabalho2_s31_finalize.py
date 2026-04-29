# -*- coding: utf-8 -*-
"""Trabalho 2: dimAmbiental + dimSocial + dimRegul + opAtr + opVab + opSeg + runS31MotorAndPersist + computeProcessoComBreakdown."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "server" / "scoringMotorS31.ts"


def main() -> None:
    text = TARGET.read_text(encoding="utf-8")

    old_amb = """export async function dimAmbiental(p: ProcessoMotorRow, ls: LayerRow[]) {
  const s = getSql()
  const t1 = ls.find(ti)
  const q1 = ls.find(qx)
  const ucp = ls.filter(ucpi)
  const tiS = p.amb_ti_sobrepoe === true || ovl(ls, ti, 100)
  const qS = p.amb_quilombola_sobrepoe === true || ovl(ls, qx, 100)
  const uS = p.amb_uc_pi_sobrepoe === true || ucp.some((u) => (u.sobreposicao_pct ?? 0) >= 100)
  if (tiS || qS || uS) return biomaMult(100, p.bioma_territorial)
  let pt = 0
  if (t1 && !tiS) {
    if (t1.distancia_km <= 5) pt += 50
    else if (t1.distancia_km <= 10) pt += 30
    else if (t1.distancia_km <= 20) pt += 15
  }
  const umin = ucp.length ? Math.min(...ucp.map((u) => u.distancia_km)) : Number.POSITIVE_INFINITY
  if (Number.isFinite(umin) && !uS) {
    if (umin <= 5) pt += 40
    else if (umin <= 10) pt += 20
  }
  if (q1 && !qS) {
    if (q1.distancia_km <= 5) pt += 45
    else if (q1.distancia_km <= 10) pt += 25
  }
  // Usa coluna geog precomputada (4326) + GIST em geo_sitios_arqueologicos — evita ST_Transform por linha
  if (p.geog != null) {
    const d0 = (await s`
      SELECT MIN(ST_Distance(p.geog, s.geog)) / 1000 AS d
      FROM processos p
      CROSS JOIN geo_sitios_arqueologicos s
      WHERE p.id = ${p.id}
        AND ST_DWithin(p.geog, s.geog, 5000)
    `) as { d: string | null }[]
    const dk = d0[0]?.d != null ? Number(d0[0].d) : null
    if (dk != null && Number.isFinite(dk)) {
      if (dk <= 1) pt += 30
      else if (dk <= 5) pt += 15
    }
  }
  const ap = p.app_overlap_pct
  if (ap != null) {
    if (ap > 10) pt += 25
    else if (ap >= 1) pt += 15
    else if (ap > 0) pt += 8
  } else if (p.amb_app_sobrepoe) pt += 8
  const usL = ls.filter((l) => uucs(l))
  if (usL.some((u) => (u.sobreposicao_pct ?? 0) > 0)) pt += 20
  else {
    const x = mine(ls, (l) => uucs(l) && !ucpi(l))
    if (Number.isFinite(x) && x <= 5) pt += 10
  }
  if (p.amb_uc_us_5km) pt = Math.max(pt, 10)
  const a = ls.find(aqu)
  if (a) {
    if ((a.sobreposicao_pct ?? 0) > 0) pt += 15
    else if (a.distancia_km <= 1) pt += 10
    else if (a.distancia_km <= 5) pt += 5
  } else if (p.amb_aquifero_5km) pt += 5
  return biomaMult(Math.min(100, pt), p.bioma_territorial)
}

"""

    new_amb = r"""export async function dimAmbiental(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  options?: { returnSubfatores?: boolean },
): Promise<number | DimensaoOutput> {
  const want = !!options?.returnSubfatores
  const subs: SubfatorOutput[] = []
  const s = getSql()
  const t1 = ls.find(ti)
  const q1 = ls.find(qx)
  const ucp = ls.filter(ucpi)
  const tiS = p.amb_ti_sobrepoe === true || ovl(ls, ti, 100)
  const qS = p.amb_quilombola_sobrepoe === true || ovl(ls, qx, 100)
  const uS = p.amb_uc_pi_sobrepoe === true || ucp.some((u) => (u.sobreposicao_pct ?? 0) >= 100)

  const fonteMix = 'ICMBio/FUNAI/INCRA/ANA + territorial_layers + SQL interno'
  const pushBio = (preBio: number, valorFinal: number) => {
    if (!want) return
    const coef = biomaCoef(p.bioma_territorial)
    subs.push({
      nome: 'Multiplicador de bioma',
      fonte: 'IBGE/bioma_territorial',
      label: '',
      texto:
        p.bioma_territorial != null && String(p.bioma_territorial).trim().length > 0
          ? `Bioma ${p.bioma_territorial}; coeficiente ${fmtKm(coef)}× aplicado sobre ${fmtKm(preBio)} → ${fmtKm(valorFinal)} (teto 100).`
          : `Bioma não informado; coeficiente 1,0×. ${fmtKm(preBio)} → ${fmtKm(valorFinal)}.`,
      valor: valorFinal - preBio,
      peso_pct: 1,
      valor_bruto: coef,
    })
  }

  if (tiS || qS || uS) {
    const preBio = 100
    const valorFinal = biomaMult(100, p.bioma_territorial)
    if (!want) return valorFinal
    const partes: string[] = []
    if (tiS) partes.push('sobreposição com Terra Indígena homologada ou camada equivalente')
    if (qS) partes.push('sobreposição com comunidade quilombola ou camada equivalente')
    if (uS) partes.push('sobreposição com UC de Proteção Integral ou camada equivalente')
    subs.push({
      nome: 'Sobreposição ambiental (teto 100 antes do bioma)',
      fonte: fonteMix,
      label: classifyLabelRisk(100),
      texto: partes.length > 0 ? partes.join('; ') + '.' : 'Vetor de sobreposição calculado.',
      valor: preBio,
      peso_pct: 1,
      valor_bruto: 100,
    })
    pushBio(preBio, valorFinal)
    const out: DimensaoOutput = { valor: valorFinal, subfatores: subs }
    warnCoerenciaDimensao('Ambiental', out)
    return out
  }

  let pt = 0

  const pushDelta = (row: SubfatorOutput) => {
    if (row.valor === 0) return
    pt += row.valor
    if (want) subs.push(row)
  }

  if (t1 && !tiS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (t1.distancia_km <= 5) {
      delta = 50
      bruto = 50
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 5 km).`
    } else if (t1.distancia_km <= 10) {
      delta = 30
      bruto = 30
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 10 km).`
    } else if (t1.distancia_km <= 20) {
      delta = 15
      bruto = 15
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 20 km).`
    }
    pushDelta({
      nome: 'Proximidade a Terra Indígena',
      fonte: 'FUNAI/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto:
        delta > 0
          ? txt
          : `Sem proximidade em faixa de pontuação; mais próximo: ${fmtKm(t1.distancia_km)} km.`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  const umin = ucp.length ? Math.min(...ucp.map((u) => u.distancia_km)) : Number.POSITIVE_INFINITY
  const ucNear = ucp.length ? ucp.reduce((a, b) => (a.distancia_km <= b.distancia_km ? a : b)) : null
  if (Number.isFinite(umin) && !uS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (umin <= 5) {
      delta = 40
      bruto = 40
      txt = `${ucNear?.nome ?? 'UC PI'} a ${fmtKm(umin)} km (≤ 5 km).`
    } else if (umin <= 10) {
      delta = 20
      bruto = 20
      txt = `${ucNear?.nome ?? 'UC PI'} a ${fmtKm(umin)} km (≤ 10 km).`
    } else txt = `Sem UC de Proteção Integral próxima em faixa pontuada (${fmtKm(umin)} km).`
    pushDelta({
      nome: 'UC Proteção Integral próxima',
      fonte: 'ICMBio/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : `Sem pontos: distância ${fmtKm(umin)} km.`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  if (q1 && !qS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (q1.distancia_km <= 5) {
      delta = 45
      bruto = 45
      txt = `${q1.nome ?? 'Território quilombola'} a ${fmtKm(q1.distancia_km)} km (≤ 5 km).`
    } else if (q1.distancia_km <= 10) {
      delta = 25
      bruto = 25
      txt = `${q1.nome ?? 'Território quilombola'} a ${fmtKm(q1.distancia_km)} km (≤ 10 km).`
    }
    pushDelta({
      nome: 'Proximidade a território quilombola',
      fonte: 'INCRA/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : `Sem quilombola em faixa pontuada (${fmtKm(q1.distancia_km)} km).`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  // Usa coluna geog precomputada (4326) + GIST em geo_sitios_arqueologicos — evita ST_Transform por linha
  if (p.geog != null) {
    const d0 = (await s`
      SELECT MIN(ST_Distance(p.geog, s.geog)) / 1000 AS d
      FROM processos p
      CROSS JOIN geo_sitios_arqueologicos s
      WHERE p.id = ${p.id}
        AND ST_DWithin(p.geog, s.geog, 5000)
    `) as { d: string | null }[]
    const dk = d0[0]?.d != null ? Number(d0[0].d) : null
    let dkPts = 0
    if (dk != null && Number.isFinite(dk)) {
      if (dk <= 1) dkPts = 30
      else if (dk <= 5) dkPts = 15
    }
    if (dkPts > 0 && dk != null)
      pushDelta({
        nome: 'Sítios arqueológicos próximos',
        fonte: 'IPHAN/geo_sitios_arqueologicos',
        label: classifyLabelRisk(dkPts),
        texto: `Sítio arqueológico a ${fmtKm(dk)} km (≤ ${dkPts === 30 ? '1' : '5'} km).`,
        valor: dkPts,
        peso_pct: 1,
        valor_bruto: dkPts,
      })
  }

  const ap = p.app_overlap_pct
  if (ap != null) {
    let delta = 0
    if (ap > 10) delta = 25
    else if (ap >= 1) delta = 15
    else if (ap > 0) delta = 8
    pushDelta({
      nome: 'APP hídrica',
      fonte: 'ANA/geo_processos/overlap_pct',
      label: classifyLabelRisk(delta),
      texto:
        delta > 0
          ? `Sobreposição com APP ${fmtKm(ap)}%`
          : 'Sem sobreposição APP registrada sobre limiares de pontuação.',
      valor: delta,
      peso_pct: 1,
      valor_bruto: delta,
    })
  } else if (p.amb_app_sobrepoe)
    pushDelta({
      nome: 'APP hídrica',
      fonte: 'flags processo/motor',
      label: classifyLabelRisk(8),
      texto: 'Flag de sobreposição com APP.',
      valor: 8,
      peso_pct: 1,
      valor_bruto: 8,
    })

  const usL = ls.filter((l) => uucs(l))
  if (usL.some((u) => (u.sobreposicao_pct ?? 0) > 0))
    pushDelta({
      nome: 'UC Uso Sustentável próxima (sobreposição)',
      fonte: 'ICMBio/territorial_layers',
      label: classifyLabelRisk(20),
      texto: 'Sobreposição com UC Uso Sustentável / APA etc.',
      valor: 20,
      peso_pct: 1,
      valor_bruto: 20,
    })
  else {
    const x = mine(ls, (l) => uucs(l) && !ucpi(l))
    if (Number.isFinite(x) && x <= 5)
      pushDelta({
        nome: 'UC Uso Sustentável próxima',
        fonte: 'ICMBio/territorial_layers',
        label: classifyLabelRisk(10),
        texto: `Infraestrutura UC/US a ${fmtKm(x)} km (≤ 5 km); sem sobrep. positiva.`,
        valor: 10,
        peso_pct: 1,
        valor_bruto: 10,
      })
  }

  const beforeFloor = pt
  if (p.amb_uc_us_5km) pt = Math.max(pt, 10)
  const flo = pt - beforeFloor
  if (want && flo > 0)
    subs.push({
      nome: 'Piso de proximidade UC Uso Sustentável (5 km)',
      fonte: 'flags territorial',
      label: classifyLabelRisk(10),
      texto: `Flag amb_uc_us_5km aplica piso mínimo (+${fmtKm(flo)}) sem alteração da soma além da própria regra.`,
      valor: flo,
      peso_pct: 1,
      valor_bruto: 10,
    })

  const a = ls.find(aqu)
  if (a) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if ((a.sobreposicao_pct ?? 0) > 0) {
      delta = 15
      bruto = 15
      txt = 'Sobreposição com aquífero.'
    } else if (a.distancia_km <= 1) {
      delta = 10
      bruto = 10
      txt = `Aquífero a ${fmtKm(a.distancia_km)} km (≤ 1 km).`
    } else if (a.distancia_km <= 5) {
      delta = 5
      bruto = 5
      txt = `Aquífero a ${fmtKm(a.distancia_km)} km (≤ 5 km).`
    }
    pushDelta({
      nome: 'Aquífero subjacente',
      fonte: 'ANA/camadas hidrogeológicas',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : 'Sem aquífero em faixa pontuada.',
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  } else if (p.amb_aquifero_5km)
    pushDelta({
      nome: 'Aquífero subjacente',
      fonte: 'flags territorial',
      label: classifyLabelRisk(5),
      texto: 'Flag amb_aquifero_5km.',
      valor: 5,
      peso_pct: 1,
      valor_bruto: 5,
    })

  const rawLin = pt
  const preBio = Math.min(100, rawLin)
  if (want && rawLin > 100)
    subs.push({
      nome: 'Teto da soma linear (100 pontos)',
      fonte: 'Regra motor S31 ambiental',
      label: '',
      texto: `Soma linear ${fmtKm(rawLin)} limitada a 100 antes do bioma.`,
      valor: preBio - rawLin,
      peso_pct: 1,
      valor_bruto: preBio - rawLin,
    })

  const valorFinal = biomaMult(preBio, p.bioma_territorial)
  if (!want) return valorFinal

  pushBio(preBio, valorFinal)
  const out: DimensaoOutput = { valor: valorFinal, subfatores: subs }
  warnCoerenciaDimensao('Ambiental', out)
  return out
}

"""

    if old_amb not in text:
        raise SystemExit("dimAmbiental block not found")
    text = text.replace(old_amb, new_amb, 1)

    # Fix APP block: I used invalid `delta` in label when ap not scoring
    text = text.replace(
        "label: classifyLabelRisk(delta > 0 ? delta : 0),",
        "label: classifyLabelRisk(delta),",
        1,
    )

    old_soc = """export function dimSocial(p: ProcessoMotorRow, ls: LayerRow[], cpt: number) {
  const c1 = cmu(p, ls)
  const c2 = Math.round(0.5 * idh0(p.idh_municipio) + 0.5 * pib0(p.pib_pc_municipio))
  const c3 = Math.min(100, Math.max(0, 30 + 70 * (cpt - 1)))
  const c4 = dns(p.densidade_demografica)
  return Math.min(100, Math.round(c1 * 0.45 + c2 * 0.2 + c3 * 0.2 + c4 * 0.15))
}
"""

    new_soc = """export function dimSocial(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  cpt: number,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const c1 = cmu(p, ls)
  const c2 = Math.round(0.5 * idh0(p.idh_municipio) + 0.5 * pib0(p.pib_pc_municipio))
  const c3 = Math.min(100, Math.max(0, 30 + 70 * (cpt - 1)))
  const c4 = dns(p.densidade_demografica)
  const valor = Math.min(100, Math.round(c1 * 0.45 + c2 * 0.2 + c3 * 0.2 + c4 * 0.15))
  if (!options?.returnSubfatores) return valor
  const v1 = c1 * 0.45
  const v2 = c2 * 0.2
  const v3 = c3 * 0.2
  const v4 = c4 * 0.15
  const sumW = v1 + v2 + v3 + v4
  const adj = valor - sumW
  const sf: SubfatorOutput[] = [
    {
      nome: 'Comunidades vulneráveis',
      fonte: 'FUNAI/INCRA/ICMBIo + CPT (cmu)',
      label: classifyLabelRisk(c1),
      texto:
        `Vulnerabilidade territorial composta (${fmtKm(c1)} pts componente; peso 45%).`,
      valor: v1 + (Math.abs(adj) > 1e-6 ? adj / 4 : 0),
      peso_pct: 0.45,
      valor_bruto: c1,
    },
    {
      nome: 'Socioeconômico do município',
      fonte: 'IBGE/SIM (IDH+PIB/hab blend)',
      label: classifyLabelRisk(c2),
      texto: `Blend IDH municipal + PIB per capita (${fmtKm(c2)} pontos interpolados).`,
      valor: v2 + (Math.abs(adj) > 1e-6 ? adj / 4 : 0),
      peso_pct: 0.2,
      valor_bruto: c2,
    },
    {
      nome: 'Conflitos territoriais (CPT)',
      fonte: 'CPT/uf',
      label: classifyLabelRisk(c3),
      texto: `Intensidade de conflitos (CPT) no estado; score ${fmtKm(c3)}.`,
      valor: v3 + (Math.abs(adj) > 1e-6 ? adj / 4 : 0),
      peso_pct: 0.2,
      valor_bruto: c3,
    },
    {
      nome: 'Densidade demográfica',
      fonte: 'IBGE censo→densidade',
      label: classifyLabelRisk(c4),
      texto: `Pressão populacional (${fmtKm(c4)}).`,
      valor: v4 + (Math.abs(adj) > 1e-6 ? adj / 4 : 0),
      peso_pct: 0.15,
      valor_bruto: c4,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Social', out)
  return out
}
"""

    if old_soc not in text:
        raise SystemExit("dimSocial block not found")
    text = text.replace(old_soc, new_soc, 1)

    old_reg = """export function dimRegul(p: ProcessoMotorRow, aut: { count: number; total: number }) {
  const f = mapFase(p.fase ?? '')
  const sp = p0(p.pendencias_abertas != null ? Number(p.pendencias_abertas) : 0)
  const sc = c0(diasAteCaducidade(p.alvara_validade, p.regime), p.regime, f)
  const st = t0(diasDesde(p.ultimo_evento_data))
  const sa = aut0(aut.count, aut.total)
  const sa2 = 5
  const cp = capagScore(p.capag_nota)
  let v = sp * 0.25 + sc * 0.2 + sa * 0.2 + st * 0.1 + sa2 * 0.1 + cp * 0.15
  if (sc >= 90 || sa >= 60) v = Math.max(v, 70)
  return Math.min(100, Math.round(v * 10) / 10)
}
"""

    new_reg = """export function dimRegul(
  p: ProcessoMotorRow,
  aut: { count: number; total: number },
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const f = mapFase(p.fase ?? '')
  const sp = p0(p.pendencias_abertas != null ? Number(p.pendencias_abertas) : 0)
  const sc = c0(diasAteCaducidade(p.alvara_validade, p.regime), p.regime, f)
  const st = t0(diasDesde(p.ultimo_evento_data))
  const sa = aut0(aut.count, aut.total)
  const sa2 = 5
  const cp = capagScore(p.capag_nota)
  let v = sp * 0.25 + sc * 0.2 + sa * 0.2 + st * 0.1 + sa2 * 0.1 + cp * 0.15
  if (sc >= 90 || sa >= 60) v = Math.max(v, 70)
  const valor = Math.min(100, Math.round(v * 10) / 10)
  if (!options?.returnSubfatores) return valor
  const p1 = sp * 0.25
  const p2 = sc * 0.2
  const p3 = sa * 0.2
  const p4 = st * 0.1
  const p5 = sa2 * 0.1
  const p6 = cp * 0.15
  const sumP = p1 + p2 + p3 + p4 + p5 + p6
  const adj = valor - sumP
  const sf: SubfatorOutput[] = [
    {
      nome: 'Pendências abertas',
      fonte: 'ANM/eventos + pendencias',
      label: classifyLabelRisk(sp),
      texto: `Pendências abertas → score ${fmtKm(sp)} (peso 25%).`,
      valor: p1 + adj / 6,
      peso_pct: 0.25,
      valor_bruto: sp,
    },
    {
      nome: 'Caducidade documental',
      fonte: 'alvará + regime',
      label: classifyLabelRisk(sc),
      texto: `Prazo / caducidade (${fmtKm(sc)}).`,
      valor: p2 + adj / 6,
      peso_pct: 0.2,
      valor_bruto: sc,
    },
    {
      nome: 'Autuações e débitos',
      fonte: 'ANM autuações',
      label: classifyLabelRisk(sa),
      texto: `Autuações (${aut.count}) e volume autuado (${fmtKm(aut.total)}).`,
      valor: p3 + adj / 6,
      peso_pct: 0.2,
      valor_bruto: sa,
    },
    {
      nome: 'Tempo do processo',
      fonte: 'último evento',
      label: classifyLabelRisk(st),
      texto: `Recência de movimentação (${fmtKm(st)}).`,
      valor: p4 + adj / 6,
      peso_pct: 0.1,
      valor_bruto: st,
    },
    {
      nome: 'Alertas Adoo',
      fonte: 'integração Adoo (placeholder)',
      label: '',
      texto: 'Integração pendente (score fixo 5 no componente bruto).',
      valor: p5 + adj / 6,
      peso_pct: 0.1,
      valor_bruto: sa2,
    },
    {
      nome: 'CAPAG do município',
      fonte: 'Tesouro/CAPAG',
      label: classifyLabelRisk(cp),
      texto: p.capag_nota != null && String(p.capag_nota).trim().length > 0 ? `CAPAG ${String(p.capag_nota).trim()}.` : 'CAPAG não disponível; score neutro.',
      valor: p6 + adj / 6,
      peso_pct: 0.15,
      valor_bruto: cp,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Regulatório', out)
  return out
}
"""

    if old_reg not in text:
        raise SystemExit("dimRegul block not found")
    text = text.replace(old_reg, new_reg, 1)

    old_atr = """function opAtr(p: ProcessoMotorRow, sub: SubData | null, cfg: Record<string, unknown> | null) {
  const a1 = pickSubScore(p.substancia, cfg)
  const g = sub?.gap_pp
  let a2 = 40
  if (g != null) { if (g > 15) a2 = 95; else if (g >= 10) a2 = 80; else if (g >= 5) a2 = 60; else if (g >= 1) a2 = 40; else a2 = 15 }
  const pr = sub?.preco_brl
  let a3 = 30
  if (pr != null && pr > 0) { const lg = Math.log10(pr); if (lg > 5) a3 = 95; else if (lg >= 4) a3 = 80; else if (lg >= 3) a3 = 65; else if (lg >= 2) a3 = 45; else if (lg >= 1) a3 = 25; else a3 = 10 }
  const M: Record<string, number> = { 'Alta (demanda)': 95, Alta: 90, 'Estavel': 50, 'Estável': 50, Queda: 15 }
  const a4 = sub?.tendencia != null ? (M[sub.tendencia] ?? 50) : 50
  let a5 = 10
  const vh = sub?.val_reserva_brl_ha, ah = p.area_ha
  if (vh != null && ah != null && ah > 0) {
    const vt = vh * ah
    if (vt >= 1e9) a5 = 95
    else if (vt >= 1e8) a5 = 80
    else if (vt >= 1e7) a5 = 60
    else if (vt >= 1e6) a5 = 35
  }
  let t = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  if (sub?.mineral_critico_2025) t = Math.min(100, t + 10)
  return t
}
"""

    new_atr = """function opAtr(
  p: ProcessoMotorRow,
  sub: SubData | null,
  cfg: Record<string, unknown> | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const a1 = pickSubScore(p.substancia, cfg)
  const g = sub?.gap_pp
  let a2 = 40
  if (g != null) {
    if (g > 15) a2 = 95
    else if (g >= 10) a2 = 80
    else if (g >= 5) a2 = 60
    else if (g >= 1) a2 = 40
    else a2 = 15
  }
  const pr = sub?.preco_brl
  let a3 = 30
  if (pr != null && pr > 0) {
    const lg = Math.log10(pr)
    if (lg > 5) a3 = 95
    else if (lg >= 4) a3 = 80
    else if (lg >= 3) a3 = 65
    else if (lg >= 2) a3 = 45
    else if (lg >= 1) a3 = 25
    else a3 = 10
  }
  const M: Record<string, number> = { 'Alta (demanda)': 95, Alta: 90, Estavel: 50, Estável: 50, Queda: 15 }
  const a4 = sub?.tendencia != null ? (M[sub.tendencia] ?? 50) : 50
  let a5 = 10
  const vh = sub?.val_reserva_brl_ha,
    ah = p.area_ha
  if (vh != null && ah != null && ah > 0) {
    const vt = vh * ah
    if (vt >= 1e9) a5 = 95
    else if (vt >= 1e8) a5 = 80
    else if (vt >= 1e7) a5 = 60
    else if (vt >= 1e6) a5 = 35
  }
  let t = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  const mc = !!sub?.mineral_critico_2025
  if (mc) t = Math.min(100, t + 10)
  if (!options?.returnSubfatores) return t
  const w1 = a1 * 0.25
  const w2 = a2 * 0.25
  const w3 = a3 * 0.2
  const w4 = a4 * 0.15
  const w5 = a5 * 0.15
  const baseR = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  const sumW = w1 + w2 + w3 + w4 + w5
  const adjBase = baseR - sumW
  const bonus = mc ? Math.min(100, baseR + 10) - baseR : 0
  const sf: SubfatorOutput[] = [
    {
      nome: 'Relevância da substância (A1)',
      fonte: 'ANM/config_scores master_substâncias',
      label: classifyLabelOpp(a1),
      texto: `Lookup de substância ${p.substancia ?? '—'} → ${fmtKm(a1)} pts.`,
      valor: w1 + adjBase / 5,
      peso_pct: 0.25,
      valor_bruto: a1,
    },
    {
      nome: 'Espaço de mercado (gap) (A2)',
      fonte: 'master_substancias.gap_pp',
      label: classifyLabelOpp(a2),
      texto: g != null ? `Gap de preço ${fmtKm(g)} pp.` : 'Gap não informado; baseline 40.',
      valor: w2 + adjBase / 5,
      peso_pct: 0.25,
      valor_bruto: a2,
    },
    {
      nome: 'Preço de mercado (A3)',
      fonte: 'séries mercado interno',
      label: classifyLabelOpp(a3),
      texto: pr != null && pr > 0 ? `Preço BRL/t ${fmtKm(pr)}.` : 'Preço não informado; baseline 30.',
      valor: w3 + adjBase / 5,
      peso_pct: 0.2,
      valor_bruto: a3,
    },
    {
      nome: 'Tendência de demanda (A4)',
      fonte: 'curvas de mercado',
      label: classifyLabelOpp(a4),
      texto: sub?.tendencia != null ? `Tendência: ${sub.tendencia}.` : 'Tendência não informada; 50 pts.',
      valor: w4 + adjBase / 5,
      peso_pct: 0.15,
      valor_bruto: a4,
    },
    {
      nome: 'Valor da reserva por hectare (A5)',
      fonte: 'val_reserva × área',
      label: classifyLabelOpp(a5),
      texto:
        vh != null && ah != null && ah > 0
          ? `Valor reserva/ha × área (${fmtKm(vh)} × ${fmtKm(ah)} ha).`
          : 'Sem valor de reserva ou área; baseline 10.',
      valor: w5 + adjBase / 5,
      peso_pct: 0.15,
      valor_bruto: a5,
    },
  ]
  if (mc || !mc) {
    sf.push({
      nome: 'Bônus mineral crítico',
      fonte: 'master_substancias.mineral_critico_2025',
      label: '',
      texto: mc ? 'Substância marcada como mineral crítico 2025: +10 pontos (fora da média ponderada).' : 'Substância sem flag de criticidade: sem bônus.',
      valor: bonus,
      peso_pct: null,
      valor_bruto: mc ? 10 : 0,
    })
  }
  const out: DimensaoOutput = { valor: t, subfatores: sf }
  warnCoerenciaDimensao('Atratividade', out)
  return out
}
"""

    if old_atr not in text:
        raise SystemExit("opAtr block not found")
    text = text.replace(old_atr, new_atr, 1)

    # Revert Estavel key if we broke M record - file has both Estavel and Estável
    # Restore user file exact M line from backup if needed after run

    old_vab = """function opVab(p: ProcessoMotorRow, ls: LayerRow[], cf: number, bnd: boolean) {
  const f = mapFase(p.fase ?? '')
  const b1 = SCORE_FASE_OS[f] ?? 25, b2 = 50, b3m = b3(ls), b4 = p.ativo_derivado === false || f === 'encerrado' ? 5 : 90, b5 = cf0(cf)
  const b6m = fiscalB6(p)
  const b7n = Math.min(100, b7(p.incentivo_b7) + (bnd ? 5 : 0))
  return Math.round(
    b1 * 0.2 + b2 * 0.15 + b3m * 0.15 + b4 * 0.15 + b5 * 0.1 + b6m * 0.1 + b7n * 0.05 + bm0(p.bioma_territorial) * 0.05 + ar0(p.area_ha) * 0.05
  )
}
"""

    new_vab = r"""function b3InfraText(ls: LayerRow[]): string {
  const pred = (l: LayerRow) => /ferrov|porto|hidrovi/i.test(l.tipo) || l.tipo.toUpperCase().includes('FERRO')
  const cand = ls.filter(pred)
  if (!cand.length) return 'Nenhuma ferrovia/porto/hidrovia em malha listada (baseline 20).'
  const best = cand.reduce((a, b) => (a.distancia_km <= b.distancia_km ? a : b))
  return `${best.tipo} a ${fmtKm(best.distancia_km)} km (menor distância).`
}

function opVab(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  cf: number,
  bnd: boolean,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const f = mapFase(p.fase ?? '')
  const b1 = SCORE_FASE_OS[f] ?? 25,
    b2 = 50,
    b3m = b3(ls),
    b4 = p.ativo_derivado === false || f === 'encerrado' ? 5 : 90,
    b5 = cf0(cf)
  const b6m = fiscalB6(p)
  const b7Base = b7(p.incentivo_b7)
  const b7n = Math.min(100, b7Base + (bnd ? 5 : 0))
  const b8m = bm0(p.bioma_territorial)
  const b9m = ar0(p.area_ha)
  const valor = Math.round(
    b1 * 0.2 + b2 * 0.15 + b3m * 0.15 + b4 * 0.15 + b5 * 0.1 + b6m * 0.1 + b7n * 0.05 + b8m * 0.05 + b9m * 0.05,
  )
  if (!options?.returnSubfatores) return valor
  const p1 = b1 * 0.2
  const p2 = b2 * 0.15
  const p3 = b3m * 0.15
  const p4 = b4 * 0.15
  const p5 = b5 * 0.1
  const p6 = b6m * 0.1
  const p7 = b7n * 0.05
  const p8 = b8m * 0.05
  const p9 = b9m * 0.05
  const sumP = p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
  const adj = valor - sumP
  const sf: SubfatorOutput[] = [
    {
      nome: 'Fase do processo (B1)',
      fonte: 'ANM/fase',
      label: classifyLabelOpp(b1),
      texto: `Fase ${p.fase ?? '—'} → score ${fmtKm(b1)}.`,
      valor: p1 + adj / 9,
      peso_pct: 0.2,
      valor_bruto: b1,
    },
    {
      nome: 'Profundidade do dado geológico (B2)',
      fonte: 'baseline motor S31',
      label: classifyLabelOpp(b2),
      texto: 'Profundidade geológica modelada (50 pts baseline).',
      valor: p2 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b2,
    },
    {
      nome: 'Infraestrutura logística (B3)',
      fonte: 'IBGE/ports + malha logística',
      label: classifyLabelOpp(b3m),
      texto: `${b3InfraText(ls)} → score ${fmtKm(b3m)}.`,
      valor: p3 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b3m,
    },
    {
      nome: 'Situação atual (B4)',
      fonte: 'ativo/situação',
      label: classifyLabelOpp(b4),
      texto: p.ativo_derivado === false || f === 'encerrado' ? 'Processo inativo ou encerrado.' : 'Processo ativo.',
      valor: p4 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b4,
    },
    {
      nome: 'CFEM histórica produzida (B5)',
      fonte: 'ANM/CFEM',
      label: classifyLabelOpp(b5),
      texto: `CFEM acumulada ${fmtKm(cf)} → faixa ${fmtKm(b5)}.`,
      valor: p5 + adj / 9,
      peso_pct: 0.1,
      valor_bruto: b5,
    },
    {
      nome: 'Autonomia fiscal do município (B6)',
      fonte: 'RGF/receitas',
      label: classifyLabelOpp(b6m),
      texto: 'Indicadores de autonomia e dívida consolidada.',
      valor: p6 + adj / 9,
      peso_pct: 0.1,
      valor_bruto: b6m,
    },
    {
      nome: 'Incentivos regionais (B7)',
      fonte: 'config incentivo_b7 + linhas BNDES',
      label: classifyLabelOpp(b7n),
      texto: `Incentivo estadual ${fmtKm(b7Base)}${bnd ? ' + bônus BNDES +5' : ''} → ${fmtKm(b7n)}.`,
      valor: p7 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b7n,
    },
    {
      nome: 'Bioma operacional (B8)',
      fonte: 'IBGE/bioma',
      label: classifyLabelOpp(b8m),
      texto: `Bioma ${p.bioma_territorial ?? '—'} → ${fmtKm(b8m)}.`,
      valor: p8 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b8m,
    },
    {
      nome: 'Área do processo (B9)',
      fonte: 'declarada ANM',
      label: classifyLabelOpp(b9m),
      texto: `Área ${p.area_ha != null ? fmtKm(p.area_ha) + ' ha' : 'não informada'}.`,
      valor: p9 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b9m,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Viabilidade', out)
  return out
}
"""

    if old_vab not in text:
        raise SystemExit("opVab block not found")
    text = text.replace(old_vab, new_vab, 1)

    old_seg = """function opSeg(risk: number, p: ProcessoMotorRow, aut: { count: number }) {
  const c1 = 100 - risk, c2 = p.gu_validade ? 75 : 50, c3 = aut.count ? 50 : 75, c4 = 50
  return Math.round(c1 * 0.5 + c2 * 0.25 + c3 * 0.2 + c4 * 0.05)
}
"""

    new_seg = """function opSeg(
  risk: number,
  p: ProcessoMotorRow,
  aut: { count: number },
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const c1 = 100 - risk,
    c2 = p.gu_validade ? 75 : 50,
    c3 = aut.count ? 50 : 75,
    c4 = 50
  const valor = Math.round(c1 * 0.5 + c2 * 0.25 + c3 * 0.2 + c4 * 0.05)
  if (!options?.returnSubfatores) return valor
  const w1 = c1 * 0.5
  const w2 = c2 * 0.25
  const w3 = c3 * 0.2
  const w4 = c4 * 0.05
  const sumW = w1 + w2 + w3 + w4
  const adj = valor - sumW
  const sf: SubfatorOutput[] = [
    {
      nome: 'Solidez geral (100 − Risk)',
      fonte: 'consolidador risk_score',
      label: classifyLabelOpp(c1),
      texto: `Risco consolidado ${fmtKm(risk)} → complemento ${fmtKm(c1)}.`,
      valor: w1 + adj / 4,
      peso_pct: 0.5,
      valor_bruto: c1,
    },
    {
      nome: 'Estabilidade documental',
      fonte: 'gu_validade',
      label: classifyLabelOpp(c2),
      texto: p.gu_validade ? 'GU dentro da validade (75).' : 'GU ausente/expirada (50).',
      valor: w2 + adj / 4,
      peso_pct: 0.25,
      valor_bruto: c2,
    },
    {
      nome: 'Histórico de cumprimento',
      fonte: 'autuações/aut.count',
      label: classifyLabelOpp(c3),
      texto: aut.count ? 'Há autuações registradas (50).' : 'Sem autuações mapeadas (75).',
      valor: w3 + adj / 4,
      peso_pct: 0.2,
      valor_bruto: c3,
    },
    {
      nome: 'Bônus alertas Adoo',
      fonte: 'Adoo/integration',
      label: '',
      texto: 'Integração pendente (placeholder 50).',
      valor: w4 + adj / 4,
      peso_pct: 0.05,
      valor_bruto: c4,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Segurança', out)
  return out
}
"""

    if old_seg not in text:
        raise SystemExit("opSeg block not found")
    text = text.replace(old_seg, new_seg, 1)

    old_run_head = """export async function runS31MotorAndPersist(
  processoId: string,
  opts: { persist?: boolean; massCaches?: S31MassCaches } = {},
): Promise<ScoreResult> {
  const prevSess = sessionMassCaches
  const prevCfg = cfgCache
  sessionMassCaches = opts.massCaches ?? null
  const persist = opts.persist === true
"""

    new_run_head = """export async function runS31MotorAndPersist(
  processoId: string,
  opts: { persist?: boolean; massCaches?: S31MassCaches; returnSubfatores?: boolean } = {},
): Promise<ScoreResult> {
  const prevSess = sessionMassCaches
  const prevCfg = cfgCache
  sessionMassCaches = opts.massCaches ?? null
  const wantSub = opts.returnSubfatores === true
  const persist = opts.persist === true && !wantSub
"""

    if old_run_head not in text:
        raise SystemExit("runS31MotorAndPersist header not found")
    text = text.replace(old_run_head, new_run_head, 1)

    old_mid = """  const dg = dimGeologico(p, cfg)
  const da = await dimAmbiental(p, ls)
  const ds = dimSocial(p, ls, cpt)
  const dr = dimRegul(p, aut)
  let risk = dg * 0.25 + da * 0.3 + ds * 0.25 + dr * 0.2
"""

    new_mid = """  const dgR = dimGeologico(p, cfg, { returnSubfatores: wantSub })
  const dg = typeof dgR === 'number' ? dgR : dgR.valor
  const daR = await dimAmbiental(p, ls, { returnSubfatores: wantSub })
  const da = typeof daR === 'number' ? daR : daR.valor
  const dsR = dimSocial(p, ls, cpt, { returnSubfatores: wantSub })
  const ds = typeof dsR === 'number' ? dsR : dsR.valor
  const drR = dimRegul(p, aut, { returnSubfatores: wantSub })
  const dr = typeof drR === 'number' ? drR : drR.valor
  let risk = dg * 0.25 + da * 0.3 + ds * 0.25 + dr * 0.2
"""

    if old_mid not in text:
        raise SystemExit("motor mid block not found")
    text = text.replace(old_mid, new_mid, 1)

    old_os = """  risk = Math.min(100, Math.round(risk))
  const oa = opAtr(p, sub, cfg), ov = opVab(p, ls, cfe, bnd), os0 = opSeg(risk, p, aut)
"""

    new_os = """  risk = Math.min(100, Math.round(risk))
  const oaR = opAtr(p, sub, cfg, { returnSubfatores: wantSub })
  const ovR = opVab(p, ls, cfe, bnd, { returnSubfatores: wantSub })
  const osR = opSeg(risk, p, aut, { returnSubfatores: wantSub })
  const oa = typeof oaR === 'number' ? oaR : oaR.valor
  const ov = typeof ovR === 'number' ? ovR : ovR.valor
  const os0 = typeof osR === 'number' ? osR : osR.valor
"""

    if old_os not in text:
        raise SystemExit("motor os block not found")
    text = text.replace(old_os, new_os, 1)

    old_ret_open = """  return {
    risk_score: risk, risk_label: rI.l, risk_cor: rI.c,
    risk_breakdown: { geologico: dg, ambiental: da, social: ds, regulatorio: dr },
    os_conservador: ocI, os_moderado: omI, os_arrojado: oa2I,
"""

    new_ret_open = """  return {
    risk_score: risk, risk_label: rI.l, risk_cor: rI.c,
    risk_breakdown: { geologico: dg, ambiental: da, social: ds, regulatorio: dr },
    ...(wantSub
      ? {
          dimensoes_risco: {
            geologico: dgR as DimensaoOutput,
            ambiental: daR as DimensaoOutput,
            social: dsR as DimensaoOutput,
            regulatorio: drR as DimensaoOutput,
          },
          dimensoes_oportunidade: {
            atratividade: oaR as DimensaoOutput,
            viabilidade: ovR as DimensaoOutput,
            seguranca: osR as DimensaoOutput,
            penalidades: R,
          },
        }
      : {}),
    os_conservador: ocI, os_moderado: omI, os_arrojado: oa2I,
"""

    if old_ret_open not in text:
        raise SystemExit("return spread block not found")
    text = text.replace(old_ret_open, new_ret_open, 1)

    TARGET.write_text(text, encoding="utf-8")
    print("trabalho2_s31_finalize: ok")


if __name__ == "__main__":
    main()