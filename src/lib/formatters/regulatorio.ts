/** Labels para valores crus de enum GU (SCM / cadastro); tolera inconsistência de case no banco. */
export const GU_STATUS_LABELS: Record<string, string> = {
  NUNCA_REQUERIDA: 'Nunca requerida',
  REQUERIDA: 'Requerida',
  AUTORIZADA: 'Autorizada',
  INDEFERIDA: 'Indeferida',
  VENCIDA: 'Vencida',
  Vencida: 'Vencida',
  'Vencida ': 'Vencida',
}

/** Tradução EN dos rótulos de GU; usada quando `lang='en'` em pipelines de relatório. */
export const GU_STATUS_LABELS_EN: Record<string, string> = {
  NUNCA_REQUERIDA: 'Never required',
  REQUERIDA: 'Requested',
  AUTORIZADA: 'Authorized',
  INDEFERIDA: 'Denied',
  VENCIDA: 'Expired',
  Vencida: 'Expired',
  'Vencida ': 'Expired',
  'Nunca requerida': 'Never required',
  'Requerida': 'Requested',
  'Autorizada': 'Authorized',
  'Indeferida': 'Denied',
}

export type RegulatorioLang = 'pt' | 'en'

export function formatGuStatus(
  raw: string | null | undefined,
  lang: RegulatorioLang = 'pt',
): string {
  if (!raw || String(raw).trim() === '') {
    return lang === 'en' ? 'No record' : 'Sem registro'
  }
  const t = String(raw).trim()
  if (lang === 'en') {
    return (
      GU_STATUS_LABELS_EN[t] ??
      GU_STATUS_LABELS_EN[raw as string] ??
      GU_STATUS_LABELS[t] ??
      t
    )
  }
  return GU_STATUS_LABELS[t] ?? GU_STATUS_LABELS[raw as string] ?? t
}

export function formatTahUltimoPagamento(
  data: string | null | undefined,
  lang: RegulatorioLang = 'pt',
): { texto: string; tooltip?: string } {
  if (!data || String(data).trim() === '') {
    if (lang === 'en') {
      return {
        texto: 'No event published',
        tooltip:
          'On-time payments do not generate a standalone event in the public SCM timeline. Check the Mining Registry statement if a delay is suspected.',
      }
    }
    return {
      texto: 'Sem evento publicado',
      tooltip:
        'Pagamentos em dia não geram evento autônomo na timeline pública do SCM. Verificar extrato no Cadastro Mineiro se houver suspeita de atraso.',
    }
  }
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) {
    return { texto: String(data) }
  }
  if (lang === 'en') {
    return { texto: `Paid on ${d.toLocaleDateString('en-US')}` }
  }
  return { texto: `Pago em ${d.toLocaleDateString('pt-BR')}` }
}
