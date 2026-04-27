export const FAMILIA_LABEL: Record<string, string> = {
  metais_preciosos: 'Metais Preciosos',
  metais_base: 'Metais Base',
  metais_ferrosos: 'Metais Ferrosos',
  minerais_estrategicos: 'Minerais Estratégicos',
  minerais_industriais: 'Minerais Industriais',
  materiais_construcao: 'Materiais de Construção',
  rochas_ornamentais: 'Rochas Ornamentais',
  gemas_pedras: 'Gemas e Pedras',
  energeticos: 'Energéticos',
  aguas_minerais: 'Águas Minerais',
  outros: 'Outros',
}

export function labelFamilia(familia: string): string {
  return FAMILIA_LABEL[familia] ?? familia
}
