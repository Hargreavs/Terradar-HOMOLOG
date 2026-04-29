/** Multiplicador de risco ambiental S31 (alinhado ao motor / drawer). */
export function biomaMultiplicadorS31(bioma: string | null | undefined): number {
  if (bioma == null || !String(bioma).trim()) return 1.0
  const b = String(bioma).trim()
  const m: Record<string, number> = {
    Amazônia: 1.3,
    Amazonia: 1.3,
    Pantanal: 1.25,
    'Mata Atlântica': 1.2,
    'MATA ATLANTICA': 1.2,
    Cerrado: 1.1,
    Caatinga: 1.0,
    Pampa: 1.0,
  }
  return m[b] ?? 1.0
}

/** Linha textual curta explicando o porquê do multiplicador (drawer só; bioma não mapeado → vazio). */
export function textoMultiplicadorBioma(bioma: string): string {
  const raw = String(bioma).trim()
  if (!raw) return ''

  const flat = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()

  const T: Record<string, string> = {
    AMAZONIA:
      'Sensibilidade máxima · supressão restringida e licenciamento federal IBAMA.',
    PANTANAL: 'Sensibilidade muito alta · planície sazonal protegida.',
    MATAATLANTICA:
      'Bioma prioritário · Lei da Mata Atlântica restringe supressão.',
    CERRADO: 'Sensibilidade moderada · APP hídricas críticas.',
    CAATINGA: 'Sensibilidade baseline.',
    PAMPA: 'Sensibilidade baseline.',
  }

  return T[flat] ?? ''
}

export function corMultiplicadorBioma(mult: number): string {
  if (mult >= 1.2) return '#E24B4A'
  if (mult >= 1.1) return '#E8A830'
  return '#1D9E75'
}
