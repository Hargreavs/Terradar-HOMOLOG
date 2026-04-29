import type { SubfatorOutput } from '../types/scoreBreakdown'

function formatNumBr(n: number, casas = 1): string {
  if (!Number.isFinite(n)) return '\u2014'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n)
}

function formatBrlAbrev(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return 'R$ 0'
  if (valor >= 1_000_000_000) {
    return `R$ ${formatNumBr(valor / 1_000_000_000, 2)} bi`
  }
  if (valor >= 1_000_000) {
    return `R$ ${formatNumBr(valor / 1_000_000, 2)} mi`
  }
  if (valor >= 1_000) {
    return `R$ ${formatNumBr(valor / 1_000, 1)} mil`
  }
  return `R$ ${formatNumBr(valor, 0)}`
}

function classificarRelevancia(v: number): 'alta' | 'm\u00e9dia' | 'baixa' {
  if (v >= 70) return 'alta'
  if (v >= 40) return 'm\u00e9dia'
  return 'baixa'
}

function titleCaseSubstancia(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function detectarSubfator(sf: SubfatorOutput): string {
  const nome = (sf.nome ?? '').toLowerCase().trim()

  if (
    nome.includes('relev\u00e2ncia da subst\u00e2ncia') ||
    nome.includes('(a1)')
  )
    return 'A1'
  if (
    nome.includes('espa\u00e7o de mercado') ||
    nome.includes('(a2)') ||
    nome.includes('gap oferta')
  )
    return 'A2'
  if (
    nome.includes('pre\u00e7o de mercado') ||
    nome.includes('(a3)') ||
    nome.includes('pre\u00e7o spot')
  )
    return 'A3'
  if (nome.includes('tend\u00eancia de demanda') || nome.includes('(a4)'))
    return 'A4'
  if (
    nome.includes('valor da reserva') ||
    nome.includes('(a5)') ||
    nome.includes('valor estimado')
  )
    return 'A5'

  if (nome.includes('fase do processo') || nome.includes('(b1)')) return 'B1'
  if (nome.includes('profundidade') || nome.includes('(b2)')) return 'B2'
  if (nome.includes('infraestrutura') || nome.includes('(b3)')) return 'B3'
  if (
    nome.includes('situa\u00e7\u00e3o atual') ||
    nome.includes('situa\u00e7\u00e3o do processo') ||
    nome.includes('(b4)')
  )
    return 'B4'
  if (nome.includes('cfem') || nome.includes('(b5)')) return 'B5'
  if (
    nome.includes('autonomia fiscal') ||
    nome.includes('(b6)') ||
    nome.includes('capag')
  )
    return 'B6'
  if (nome.includes('incentivos regionais') || nome.includes('(b7)')) return 'B7'
  if (nome.includes('bioma') || nome.includes('(b8)')) return 'B8'
  if (nome.includes('\u00e1rea do processo') || nome.includes('(b9)')) return 'B9'

  if (
    nome.includes('solidez geral') ||
    nome.includes('100 \u2212 risk') ||
    nome.includes('100 - risk')
  )
    return 'C1'
  if (nome.includes('estabilidade documental')) return 'C2'
  if (nome.includes('hist\u00f3rico de cumprimento')) return 'C3'
  if (nome.includes('conformidade ambiental')) return 'C_AMB'
  if (nome.includes('regularidade')) return 'C_REG'
  if (nome.includes('rec\u00eancia de despacho')) return 'C_REC'
  if (nome.includes('alertas')) return 'C_ALERT'

  return 'unknown'
}

function refinarA1(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(
    /Substância\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)\s+mapeada\s+com\s+índice\s+sintético\s+([\d,.]+)/i,
  )
  if (m) {
    const subst = titleCaseSubstancia(m[1].trim())
    const valorNum = Number(m[2].replace(',', '.'))
    const rel = classificarRelevancia(valorNum)
    return `${subst}: relev\u00e2ncia ${rel} (${formatNumBr(valorNum, 0)}/100).`
  }
  const m2 = txt.match(/Substância\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+)/i)
  if (m2) {
    const subst = titleCaseSubstancia(m2[1].trim())
    const v = sf.valor_bruto ?? sf.valor
    return `${subst}: relev\u00e2ncia ${classificarRelevancia(v)} (${formatNumBr(v, 0)}/100).`
  }
  return txt
}

function refinarA2(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(/Gap\s+de\s+mercado\s*\(([\d,.-]+)\s*p\.?p\.?\)/i)
  if (m) {
    const gap = Number(m[1].replace(',', '.'))
    if (gap > 0) {
      return `Demanda ${formatNumBr(gap, 1)} pontos percentuais acima da oferta consolidada \u2014 janela de mercado.`
    }
    return `Demanda ${formatNumBr(Math.abs(gap), 1)} pontos percentuais abaixo da oferta \u2014 mercado equilibrado ou em excesso.`
  }
  const m2 = txt.match(/Gap\s*(-?[\d.,]+)\s*pp/i)
  if (m2) {
    const gap = Number(m2[1].replace(',', '.'))
    if (gap > 0)
      return `Demanda ${formatNumBr(gap, 1)} pontos percentuais acima da oferta \u2014 janela de mercado.`
    return `Demanda ${formatNumBr(Math.abs(gap), 1)} pontos percentuais abaixo da oferta.`
  }
  return txt
}

function refinarA3(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(/Preço médio monitorado\s*\(([^)]+)\)/i)
  if (m) {
    return `Preço médio monitorado: ${m[1].trim()}.`
  }
  if (/sem preço spot/i.test(txt)) {
    return 'Sem preço spot disponível para esta substância.'
  }
  return txt
}

function refinarA4(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(/Tendência\s+(?:de mercado registrada:?\s+)?(\w+)/i)
  if (m) {
    const tend = m[1].toLowerCase()
    if (tend === 'alta') return 'Demanda em alta — forte sinal de aquecimento.'
    if (tend === 'estável' || tend === 'estavel')
      return 'Demanda estável — mercado consolidado.'
    if (tend === 'baixa') return 'Demanda em baixa — mercado contraído.'
  }
  return txt
}

function refinarA5(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(
    /(?:Valor reserva\/ha\s*×\s*área|Valor estimado).*?\(([\d.,]+)\s*×\s*([\d.,]+)\s*ha\)/i,
  )
  if (m) {
    const valorBrutoParse = Number(m[1].replace(/\./g, '').replace(',', '.'))
    const areaNum = Number(m[2].replace(',', '.'))
    return `Reserva estimada: ${formatBrlAbrev(valorBrutoParse)} sobre ${formatNumBr(areaNum, 2)} ha.`
  }
  if (/Área\s+\d/.test(txt) && /Teor/.test(txt)) {
    return 'Reserva sem dados consolidados de área ou teor.'
  }
  return txt
}

function refinarB1(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(/Fase\s+(?:declarada\s+)?([^;.\n]+?)(?:;|\.|$)/i)
  if (m) {
    const fase = m[1].trim()
    const valor = sf.valor_bruto ?? sf.valor
    let etapa = 'intermedi\u00e1ria'
    if (valor >= 70) etapa = 'avan\u00e7ada'
    else if (valor < 40) etapa = 'inicial'
    return `Em fase de ${fase} \u2014 etapa ${etapa} do processo regulat\u00f3rio (${formatNumBr(valor, 0)}/100 na r\u00e9gua de maturidade).`
  }
  return txt
}

function refinarB2(sf: SubfatorOutput): string {
  const v = sf.valor_bruto ?? sf.valor
  if (v >= 70)
    return `Modelagem geol\u00f3gica avan\u00e7ada \u2014 dados consistentes (${formatNumBr(v, 0)}/100).`
  if (v >= 40)
    return `Modelagem geol\u00f3gica em fase intermedi\u00e1ria \u2014 dado dispon\u00edvel mas n\u00e3o conclusivo (${formatNumBr(v, 0)}/100).`
  return `Modelagem geol\u00f3gica em fase inicial \u2014 dados ainda preliminares (${formatNumBr(v, 0)}/100).`
}

function refinarB3(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const v = sf.valor_bruto ?? sf.valor
  if (
    /Nenhuma\s+(ferrovia|porto|hidrovia)/i.test(txt) ||
    /sem\s+(ferrovia|porto|hidrovia)/i.test(txt)
  ) {
    return `Sem ferrovia, porto ou hidrovia pr\u00f3ximos \u2014 log\u00edstica depende de transporte rodovi\u00e1rio (${formatNumBr(v, 0)}/100).`
  }
  if (/Ferrovia\s+a\s+([\d.,]+)\s*km/i.test(txt)) {
    const m = txt.match(/Ferrovia\s+a\s+([\d.,]+)\s*km/i)
    const km = m ? Number(m[1].replace(',', '.')) : 0
    if (km < 50)
      return `Ferrovia a ${formatNumBr(km, 1)} km \u2014 infraestrutura log\u00edstica favor\u00e1vel (${formatNumBr(v, 0)}/100).`
    return `Ferrovia distante (${formatNumBr(km, 1)} km) \u2014 log\u00edstica parcialmente comprometida (${formatNumBr(v, 0)}/100).`
  }
  return `Acesso a infraestrutura de transporte mapeada (${formatNumBr(v, 0)}/100).`
}

function refinarB4(sf: SubfatorOutput): string {
  const txt = (sf.texto ?? '').toLowerCase()
  if (txt.includes('inativo') || txt.includes('encerrad')) {
    return 'Processo inativo na ANM — sem evolução administrativa recente.'
  }
  if (txt.includes('bloquead')) {
    return 'Processo bloqueado por decisão administrativa.'
  }
  if (txt.includes('apto para disponibilidade')) {
    return 'Processo apto para disponibilidade — pode ser reaberto à concorrência.'
  }
  if (txt.includes('ativo')) {
    return 'Processo ativo na ANM — sem indicativos de paralisação ou caducidade.'
  }
  return sf.texto ?? ''
}

function refinarB5(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(
    /CFEM\s+acumulada\s+([\d,]+(?:\.\d+)?)\s*(?:→|->)\s*faixa\s+([\d,]+(?:\.\d+)?)/i,
  )
  if (m) {
    const cfem = Number(m[1].replace(',', '.'))
    const faixa = Number(m[2].replace(',', '.'))
    if (cfem === 0) {
      return `Sem histórico de produção (CFEM acumulada R$ 0) — score neutro de ${formatNumBr(faixa, 0)}/100.`
    }
    return `Histórico de produção: ${formatBrlAbrev(cfem)} acumulado — score de ${formatNumBr(faixa, 0)}/100.`
  }
  return txt
}

function refinarB6(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  if (/CAPAG\s+([A-D])/i.test(txt)) {
    const m = txt.match(/CAPAG\s+([A-D])/i)
    const grau = m ? m[1].toUpperCase() : 'B'
    if (grau === 'A')
      return 'Munic\u00edpio com CAPAG A — capacidade de pagamento elevada, alta autonomia fiscal.'
    if (grau === 'B')
      return 'Munic\u00edpio com CAPAG B — capacidade de pagamento adequada.'
    if (grau === 'C')
      return 'Munic\u00edpio com CAPAG C — capacidade de pagamento limitada.'
    if (grau === 'D')
      return 'Munic\u00edpio com CAPAG D — risco fiscal elevado.'
  }
  if (/sem receita declarada|fallback/i.test(txt)) {
    return 'Indicadores fiscais municipais indispon\u00edveis — score neutro aplicado.'
  }
  return 'Munic\u00edpio com indicadores fiscais consolidados — base s\u00f3lida para projeto de longo prazo.'
}

function refinarB7(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(
    /Incentivo\s+estadual\s+([\d,]+(?:\.\d+)?)\s*\+\s*b\u00f4nus\s+BNDES\s*\+([\d,]+(?:\.\d+)?)\s*(?:→|->)\s*([\d,]+(?:\.\d+)?)/i,
  )
  if (m) {
    return `Incentivos estaduais altos (${formatNumBr(Number(m[1].replace(',', '.')), 0)}/100) + bônus BNDES (+${m[2]}) = ${formatNumBr(Number(m[3].replace(',', '.')), 0)}/100.`
  }
  const m2 = txt.match(/Incentivo\s+estadual\s+([\d,]+(?:\.\d+)?)/i)
  if (m2) {
    return `Incentivos estaduais (${formatNumBr(Number(m2[1].replace(',', '.')), 0)}/100) — sem bônus BNDES adicional.`
  }
  if (/score incentivo uf:\s*0/i.test(txt)) {
    return 'Sem incentivos regionais identificados para esta UF.'
  }
  return txt
}

function refinarB8(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(/Bioma\s+(.+?)\s*(?:→|->)\s*([\d,]+(?:\.\d+)?)/i)
  if (m) {
    const bioma = m[1].trim()
    const v = Number(m[2].replace(',', '.'))
    let nivel = 'moderadas'
    if (v < 30) nivel = 'severas'
    else if (v >= 75) nivel = 'm\u00ednimas'
    else if (v >= 50) nivel = 'baixas'
    return `${bioma} — bioma com restrições ambientais ${nivel} (${formatNumBr(v, 0)}/100).`
  }
  return txt
}

function refinarB9(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(/[\u00c1\u00e1]rea\s+([\d.,]+)\s*ha/i)
  if (m) {
    const area = Number(m[1].replace(',', '.'))
    if (area === 0) return 'Área do processo não declarada.'
    if (area < 50)
      return `Área: ${formatNumBr(area, 2)} ha — área pequena (< 50 ha).`
    return `Área: ${formatNumBr(area, 2)} ha.`
  }
  return txt
}

function refinarC1(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const m = txt.match(
    /Risco\s+consolidado\s+([\d,]+(?:\.\d+)?)\s*(?:→|->)\s*complemento\s+([\d,]+(?:\.\d+)?)/i,
  )
  if (m) {
    const risk = m[1].replace(',', '.')
    const compl = m[2].replace(',', '.')
    return `Risk Score do processo é ${formatNumBr(Number(risk), 0)} — solidez calculada como complemento (100 − ${formatNumBr(Number(risk), 0)} = ${formatNumBr(Number(compl), 0)}).`
  }
  const m2 = txt.match(/Risk\s+Score\s+([\d,]+(?:\.\d+)?)/i)
  if (m2) {
    const risk = Number(m2[1].replace(',', '.'))
    return `Risk Score do processo é ${formatNumBr(risk, 0)} — solidez é o complemento (100 − ${formatNumBr(risk, 0)} = ${formatNumBr(100 - risk, 0)}).`
  }
  return txt
}

function refinarC2(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const v = sf.valor_bruto ?? sf.valor
  if (/GU\s+ausente|GU\s+expirada/i.test(txt)) {
    return `Guia de Utilização (GU) ausente ou expirada — pendência documental moderada (${formatNumBr(v, 0)}/100).`
  }
  if (/GU\s+vigente/i.test(txt)) {
    return `Guia de Utilização (GU) vigente — documentação operacional em ordem (${formatNumBr(v, 0)}/100).`
  }
  return txt
}

function refinarC3(sf: SubfatorOutput): string {
  const txt = sf.texto ?? ''
  const v = sf.valor_bruto ?? sf.valor
  if (/sem\s+autuações/i.test(txt)) {
    return `Sem autuações da ANM mapeadas no histórico — bom indicador de cumprimento (${formatNumBr(v, 0)}/100).`
  }
  const m = txt.match(/(\d+)\s+autuações/i)
  if (m) {
    return `${m[1]} autuações da ANM no histórico — atenção a passivo regulatório (${formatNumBr(v, 0)}/100).`
  }
  return txt
}

function refinarCAmb(sf: SubfatorOutput): string {
  const m = (sf.texto ?? '').match(/RS\s+ambiental\s+([\d,.]+)/i)
  if (m) {
    const rs = Number(m[1].replace(',', '.'))
    return `Risco ambiental ${formatNumBr(rs, 0)} — conformidade calculada como complemento (${formatNumBr(100 - rs, 0)}/100).`
  }
  return sf.texto ?? ''
}

function refinarCReg(sf: SubfatorOutput): string {
  const m = (sf.texto ?? '').match(/RS\s+regulatório\s+([\d,.]+)/i)
  if (m) {
    const rs = Number(m[1].replace(',', '.'))
    return `Risco regulatório ${formatNumBr(rs, 0)} — regularidade é o complemento (${formatNumBr(100 - rs, 0)}/100).`
  }
  return sf.texto ?? ''
}

function refinarCRec(sf: SubfatorOutput): string {
  const m = (sf.texto ?? '').match(/(\d+)\s+dias\s+desde\s+último\s+despacho/i)
  if (m) {
    const dias = Number(m[1])
    if (dias <= 365) return `Atividade recente — ${dias} dias desde o último despacho.`
    if (dias <= 1825)
      return `Atividade moderada — ${dias} dias desde o último despacho.`
    return `Sem atividade recente — ${dias} dias desde o último despacho.`
  }
  return sf.texto ?? ''
}

function refinarCAlert(sf: SubfatorOutput): string {
  if (/integração\s+adoo\s+pendente/i.test(sf.texto ?? '')) {
    return 'Integração com Adoo pendente — não compõe o score atualmente.'
  }
  return sf.texto ?? ''
}

export function refinarTextoSubfator(sf: SubfatorOutput): string {
  if (!sf || sf.texto == null) return ''

  try {
    const tipo = detectarSubfator(sf)
    switch (tipo) {
      case 'A1':
        return refinarA1(sf)
      case 'A2':
        return refinarA2(sf)
      case 'A3':
        return refinarA3(sf)
      case 'A4':
        return refinarA4(sf)
      case 'A5':
        return refinarA5(sf)
      case 'B1':
        return refinarB1(sf)
      case 'B2':
        return refinarB2(sf)
      case 'B3':
        return refinarB3(sf)
      case 'B4':
        return refinarB4(sf)
      case 'B5':
        return refinarB5(sf)
      case 'B6':
        return refinarB6(sf)
      case 'B7':
        return refinarB7(sf)
      case 'B8':
        return refinarB8(sf)
      case 'B9':
        return refinarB9(sf)
      case 'C1':
        return refinarC1(sf)
      case 'C2':
        return refinarC2(sf)
      case 'C3':
        return refinarC3(sf)
      case 'C_AMB':
        return refinarCAmb(sf)
      case 'C_REG':
        return refinarCReg(sf)
      case 'C_REC':
        return refinarCRec(sf)
      case 'C_ALERT':
        return refinarCAlert(sf)
      default:
        return sf.texto
    }
  } catch {
    return sf.texto ?? ''
  }
}

