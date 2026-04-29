/**
 * Patch trabalho 2.b em server/scoringMotorS31.ts (anchors; UTF-8 preservado).
 * node server/scripts/apply-2b-prose.cjs
 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'scoringMotorS31.ts')
let t = fs.readFileSync(P, 'utf8')

function replaceBetween(startNeedle, endNeedle, insertion, from = 0) {
  const i = t.indexOf(startNeedle, from)
  if (i < 0) throw new Error('start not found: ' + startNeedle.slice(0, 40))
  const j = t.indexOf(endNeedle, i + startNeedle.length)
  if (j < 0) throw new Error('end not found after start')
  t = t.slice(0, i) + insertion + t.slice(j)
}

function once() {
  const start = 'function warnCoerenciaDimensao(label: string, d: DimensaoOutput) {'
  const end = 'const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL'
  const ins = `function warnCoerenciaDimensao(label: string, d: DimensaoOutput) {
  const ponderados = d.subfatores.filter((r) => r.peso_pct != null)
  const residuais = d.subfatores.filter((r) => r.peso_pct == null)
  const somaPond = ponderados.reduce((s, r) => s + r.valor, 0)
  const somaResidual = residuais.reduce((s, r) => s + r.valor, 0)
  if (Math.abs(somaPond + somaResidual - d.valor) > 0.501)
    console.warn(
      '[scoringMotorS31] Coerência ' +
        label +
        ': ponderados=' +
        somaPond.toFixed(3) +
        ' + ajuste=' +
        somaResidual.toFixed(3) +
        ' vs dimensão.valor=' +
        d.valor,
    )
}

const fmtBr1 = (n: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n)

function textoRegulPendencias(n: number | null): string {
  const c =
    n != null && Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : null
  if (c == null || c <= 0) return 'Sem pendências administrativas em aberto no retrato atual do cadastro.'
  if (c === 1)
    return 'Há uma pendência administrativa em aberto segundo o retrato atual do cadastro público.'
  return \`Há \${c} pendências administrativas em aberto segundo o retrato atual do cadastro público.\`
}

function textoRegulCaducidade(dCad: number | null): string {
  if (dCad == null)
    return 'Prazos de validade incompletos no cadastro ou sem data objetiva aqui — situação examinada com o regime declarado.'
  if (dCad < 0) return 'Documentação obrigatória aparece já vencida na linha temporal do cadastro.'
  return \`Documentação obrigatória com cerca de \${Math.round(dCad)} dias até a data‑limite tratada pelo cadastro.\`
}

function textoRegulUltimaMov(dias: number | null): string {
  if (dias == null) return 'Data do último evento público não consolidada aqui.'
  return \`Última movimentação pública há cerca de \${Math.round(dias)} dias segundo o último evento disponível.\`
}

function textoRegulCapag(notaRaw: string | null | undefined): string {
  if (notaRaw != null && String(notaRaw).trim().length > 0)
    return \`Situação fiscal municipal segundo nota declarada (\${String(notaRaw).trim()}) nos critérios oficiais de capacidade de pagamento do ente.\`
  return 'Nota técnico‑fiscal do ente local não declarada aqui; cenário tratado como neutro.'
}

`
  replaceBetween(start, end, ins)
}

function two() {
  const d0 = t.indexOf('export function dimSocial(')
  if (d0 < 0) throw new Error('dimSocial not found')
  const k = t.indexOf('  const sf: SubfatorOutput[] = [', d0)
  if (k < 0) throw new Error('social sf array not found')
  const j = t.indexOf('  const out: DimensaoOutput = { valor, subfatores: sf }', k)
  if (j < 0) throw new Error('social block end not found')
  const ins = `  const ufS = (p.uf ?? '').trim()
  const den = p.densidade_demografica
  const textoDen =
    den != null && Number.isFinite(den)
      ? \`Adensamento humano na área urbana habitual (~\${fmtBr1(den)} hab/km²).\`
      : 'Densidade municipal não declarada ao motor; cenário tratado aqui como adensamento baixo‑moderado.'

  const sf: SubfatorOutput[] = [
    {
      nome: 'Comunidades vulneráveis',
      fonte: 'FUNAI/INCRA/ICMBio — malhas territoriais',
      label: classifyLabelRisk(c1),
      texto:
        \`Proximidade ou sobreposição com terras indígenas, quilombolas e demais territórios em situação de vulnerabilidade institucional, segundo distâncias calculadas sobre a malha vigente.\`,
      valor: v1,
      peso_pct: 0.45,
      valor_bruto: c1,
    },
    {
      nome: 'Socioeconômico do município',
      fonte: 'IBGE — IDH municipal e PIB/hab.',
      label: classifyLabelRisk(c2),
      texto:
        \`Condição socioeconômica sintetizada pelo IDH municipal e pela renda per capita oficialmente divulgada.\`,
      valor: v2,
      peso_pct: 0.2,
      valor_bruto: c2,
    },
    {
      nome: 'Conflitos territoriais (CPT)',
      fonte: 'CPT — registros estaduais',
      label: classifyLabelRisk(c3),
      texto:
        ufS.length > 0
          ? \`Incidentes de conflitos no campo listados pelo CPT para o estado \${ufS.toUpperCase()}.\`
          : \`Incidentes de conflitos no campo segundo cadastro CPT (UF não informada).\`,
      valor: v3,
      peso_pct: 0.2,
      valor_bruto: c3,
    },
    {
      nome: 'Densidade demográfica',
      fonte: 'IBGE — densidade municipal',
      label: classifyLabelRisk(c4),
      texto: textoDen,
      valor: v4,
      peso_pct: 0.15,
      valor_bruto: c4,
    },
  ]
  if (Math.abs(adj) > 1e-6) {
    sf.push({
      nome: 'Ajuste consolidador social',
      fonte: 'arredondamento do índice da dimensão',
      label: '',
      texto: \`Diferença de \${fmtBr1(adj)} para reconciliar o índice exibido com o arredondamento aplicado à combinação anterior (\${fmtBr1(sumW)}).\`,
      valor: adj,
      peso_pct: null,
      valor_bruto: adj,
    })
  }
`
  t = t.slice(0, k) + ins + t.slice(j)
}

function three() {
  const i = t.indexOf("nome: 'Multiplicador de bioma'")
  if (i < 0) throw new Error('pushBio not found')
  const endPat = '      valor_bruto: coef,\r\n    })'
  const endPatLf = '      valor_bruto: coef,\n    })'
  let j = t.indexOf(endPat, i)
  if (j < 0) j = t.indexOf(endPatLf, i)
  if (j < 0) throw new Error('pushBio end not found')
  const endLen = t[j] === '\r' ? endPat.length : endPatLf.length
  const ins = `      nome: 'Multiplicador de bioma',
      fonte: 'IBGE/bioma_territorial',
      label: '',
      texto:
        p.bioma_territorial != null && String(p.bioma_territorial).trim().length > 0
          ? \`\${String(p.bioma_territorial).trim()}: multiplicador \${fmtBr1(coef)}× sobre os pontos ambientais brutos (antes do teto aplicado).\`
          : \`Bioma não informado ao cadastro; multiplicador 1,0× sobre os pontos ambientais brutos.\`,
      valor: valorFinal - preBio,
      peso_pct: null,
      valor_bruto: coef,
    })`
  t = t.slice(0, i) + ins + t.slice(j + endLen)
}

function four() {
  const start = 'export function dimRegul('
  const i = t.indexOf(start)
  if (i < 0) throw new Error('dimRegul not found')
  const j = t.indexOf('\nfunction b7(', i)
  if (j < 0) throw new Error('after dimRegul')
  const ins = `export function dimRegul(
  p: ProcessoMotorRow,
  aut: { count: number; total: number },
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const f = mapFase(p.fase ?? '')
  const pendN = p.pendencias_abertas != null ? Number(p.pendencias_abertas) : null
  const sp = p0(pendN != null ? pendN : 0)
  const dCad = diasAteCaducidade(p.alvara_validade, p.regime)
  const diasUlt = diasDesde(p.ultimo_evento_data)
  const sc = c0(dCad, p.regime, f)
  const st = t0(diasUlt)
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
      fonte: 'cadastro público da ANM',
      label: classifyLabelRisk(sp),
      texto: textoRegulPendencias(pendN),
      valor: p1,
      peso_pct: 0.25,
      valor_bruto: sp,
    },
    {
      nome: 'Caducidade documental',
      fonte: 'eventos públicos — licença/alvará',
      label: classifyLabelRisk(sc),
      texto: textoRegulCaducidade(dCad),
      valor: p2,
      peso_pct: 0.2,
      valor_bruto: sc,
    },
    {
      nome: 'Autuações e débitos',
      fonte: 'ANM — autuações',
      label: classifyLabelRisk(sa),
      texto: \`Autuações registradas (\${aut.count}); volume econômico associado (\${fmtKm(aut.total)}).\`,
      valor: p3,
      peso_pct: 0.2,
      valor_bruto: sa,
    },
    {
      nome: 'Tempo do processo',
      fonte: 'último movimento público',
      label: classifyLabelRisk(st),
      texto: textoRegulUltimaMov(diasUlt),
      valor: p4,
      peso_pct: 0.1,
      valor_bruto: st,
    },
    {
      nome: 'Alertas Adoo',
      fonte: 'Adoo / receita estadual (integrações)',
      label: '',
      texto:
        'Integração aos alertas externos ainda em curso nesta pilha; nenhum alerta consolidado retornado pela conexão vigente.',
      valor: p5,
      peso_pct: 0.1,
      valor_bruto: sa2,
    },
    {
      nome: 'CAPAG do município',
      fonte: 'Tesouro Nacional — CAPAG',
      label: classifyLabelRisk(cp),
      texto: textoRegulCapag(p.capag_nota),
      valor: p6,
      peso_pct: 0.15,
      valor_bruto: cp,
    },
  ]
  if (Math.abs(adj) > 1e-8) {
    sf.push({
      nome: 'Ajuste consolidador regulatório',
      fonte: 'arredondamento do índice da dimensão',
      label: '',
      texto: \`Diferença de \${fmtBr1(adj)} entre a combinação numérica imediatamente anterior (\${fmtBr1(
        sumP,
      )}) e o valor exibido (\${fmtBr1(valor)}) após arredondar a uma casa decimal.\`,
      valor: adj,
      peso_pct: null,
      valor_bruto: adj,
    })
  }
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Regulatório', out)
  return out
}
`
  t = t.slice(0, i) + ins + t.slice(j)
}

once()
two()
three()
four()
fs.writeFileSync(P, t, 'utf8')
console.log('ok', P)
