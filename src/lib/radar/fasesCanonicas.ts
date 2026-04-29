/** Ordem por fluxo lógico do processo minerário (não por contagem). */
export const FASES_CANONICAS: ReadonlyArray<{
  value: string
  label: string
  grupo: 'Pesquisa' | 'Lavra' | 'Garimpeira' | 'Licenciamento' | 'Disponibilidade'
}> = [
  { value: 'Disponibilidade', label: 'Disponibilidade', grupo: 'Disponibilidade' },
  { value: 'Apto para Disponibilidade', label: 'Apto para Disponibilidade', grupo: 'Disponibilidade' },
  { value: 'Requerimento de Pesquisa', label: 'Requerimento de Pesquisa', grupo: 'Pesquisa' },
  { value: 'Autorização de Pesquisa', label: 'Autorização de Pesquisa', grupo: 'Pesquisa' },
  { value: 'Direito de Requerer a Lavra', label: 'Direito de Requerer a Lavra', grupo: 'Lavra' },
  { value: 'Requerimento de Lavra', label: 'Requerimento de Lavra', grupo: 'Lavra' },
  { value: 'Concessão de Lavra', label: 'Concessão de Lavra', grupo: 'Lavra' },
  {
    value: 'Requerimento de Licenciamento',
    label: 'Requerimento de Licenciamento',
    grupo: 'Licenciamento',
  },
  { value: 'Licenciamento', label: 'Licenciamento', grupo: 'Licenciamento' },
  {
    value: 'Requerimento de Lavra Garimpeira',
    label: 'Requerimento de Lavra Garimpeira',
    grupo: 'Garimpeira',
  },
  { value: 'Lavra Garimpeira', label: 'Lavra Garimpeira', grupo: 'Garimpeira' },
  {
    value: 'Requerimento de Registro de Extração',
    label: 'Requerimento de Registro de Extração',
    grupo: 'Licenciamento',
  },
  { value: 'Registro de Extração', label: 'Registro de Extração', grupo: 'Licenciamento' },
] as const

export type FaseCanonica = (typeof FASES_CANONICAS)[number]['value']
