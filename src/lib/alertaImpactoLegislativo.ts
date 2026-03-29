import type { AlertaLegislativo, NivelImpacto } from '../types'

export const ALERTA_LEG_TOOLTIP_MAX_W_PX = 280

export const ALERTA_LEG_TOOLTIP_BOX_SHADOW =
  '0 4px 16px rgba(0, 0, 0, 0.45)'

const TOOLTIP_NIVEL: Record<NivelImpacto, string> = {
  1: 'Norma regulatória com efeito direto e imediato sobre o processo minerário. Pode alterar prazos, exigir novas licenças ou impedir operações em curso.',
  2: 'Norma regulatória que afeta condições operacionais do processo. Pode exigir adequações, documentação adicional ou alterar custos de compliance.',
  3: 'Norma regulatória com efeito indireto ou de longo prazo. Pode criar oportunidades, incentivos ou mudanças graduais no ambiente regulatório.',
  4: 'Publicação relevante para acompanhamento do setor, sem impacto direto no processo. Inclui editais, chamadas públicas e licitações relacionadas.',
}

export function textoTooltipNivelImpactoLegislativo(n: NivelImpacto): string {
  return TOOLTIP_NIVEL[n]
}

export function textoTooltipTipoImpactoLegislativo(
  t: AlertaLegislativo['tipo_impacto'],
): string {
  switch (t) {
    case 'restritivo':
      return 'A norma regulatória impõe novas restrições, exigências ou limitações ao processo minerário ou à região onde ele se localiza.'
    case 'favoravel':
      return 'A norma regulatória cria condições positivas para o processo: incentivos fiscais, simplificação de procedimentos ou abertura de novas oportunidades.'
    case 'neutro':
      return 'A norma regulatória altera procedimentos ou critérios sem impacto claramente positivo ou negativo. Requer análise caso a caso.'
    case 'incerto':
      return 'Impacto regulatório ainda em análise ou dependente de regulamentação complementar.'
  }
}

/** Texto do link à publicação nos alertas legislativos (rótulo único). */
export function textoLinkPublicacaoAlerta(_fonteDiario: string): string {
  return 'Ver no Diário'
}

const ROTULO_CANAL_POR_FONTE: Record<AlertaLegislativo['fonte'], string> = {
  DOU: 'Diário Oficial da União',
  Câmara: 'Câmara dos Deputados',
  Senado: 'Senado Federal',
  DOE: 'Diário Oficial Estadual',
  IBAMA: 'Diário Oficial da União',
  ANM: 'Diário Oficial da União',
}

/**
 * Nome completo do canal de publicação na linha de metadados
 * (alinhado ao mock da Intel: `fonte_publicacao`).
 */
export function rotuloFontePublicacaoExibicao(
  fonte: AlertaLegislativo['fonte'],
  fonteDiario: string,
): string {
  const raw = fonteDiario.trim()
  const u = raw.toUpperCase()

  if (u === 'DOU' || u.startsWith('DOU-')) return 'Diário Oficial da União'

  const doeSt = /^DOE-?([A-Z]{2})$/i.exec(raw)
  if (doeSt) return `Diário Oficial do Estado (${doeSt[1]})`
  if (u === 'DOE' || u.startsWith('DOE')) return 'Diário Oficial Estadual'

  if (/^DOM-/i.test(raw)) {
    const rest = raw.replace(/^DOM-?/i, '').trim()
    return rest ? `Diário Oficial Municipal (${rest})` : 'Diário Oficial Municipal'
  }
  if (u === 'DOM' || u.startsWith('DOM')) return 'Diário Oficial Municipal'

  if (raw === 'Câmara' || u === 'CAMARA') return 'Câmara dos Deputados'
  if (raw === 'Senado' || u === 'SENADO') return 'Senado Federal'

  if (raw.length > 28 || raw.toLowerCase().includes('oficial')) return raw

  return ROTULO_CANAL_POR_FONTE[fonte] ?? raw
}

export function tipoImpactoLabel(t: AlertaLegislativo['tipo_impacto']): string {
  switch (t) {
    case 'restritivo':
      return 'Restritivo'
    case 'favoravel':
      return 'Favorável'
    case 'neutro':
      return 'Neutro'
    case 'incerto':
      return 'Incerto'
  }
}

export function corTipoImpacto(t: AlertaLegislativo['tipo_impacto']): string {
  switch (t) {
    case 'restritivo':
      return '#E24B4A'
    case 'favoravel':
      return '#1D9E75'
    case 'neutro':
      return '#888780'
    case 'incerto':
      return '#EF9F27'
  }
}

export {
  calcularRelevancia,
  estiloBadgeRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
  type RelevanciaConfig,
  type TipoImpacto,
} from './relevanciaAlerta'
