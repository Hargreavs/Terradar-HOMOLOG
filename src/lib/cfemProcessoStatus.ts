/**
 * CFEM e devida em operacao (lavra etc.). Fases pre-operacionais nao geram recolhimento
 * atribuivel ao processo. Nao ha granularidade por processo na base - so municipio+ano.
 */
export const REGIMES_CFEM_PRODUTIVOS = new Set<string>([
  'concessao_lavra',
  'lavra_garimpeira',
  'licenciamento',
  'registro_extracao',
  'permissao_lavra_garimpeira',
])

export type CfemProcessoStatus =
  | 'PROCESSO_NAO_PRODUTIVO'
  | 'SEM_DADO_INDIVIDUALIZADO'
  | 'OK'
  | null

export function processoGeraCfem(regime: string | null | undefined): boolean {
  const r = regime != null ? String(regime).trim() : ''
  return r !== '' && REGIMES_CFEM_PRODUTIVOS.has(r)
}

/**
 * `cfemNumLancamentos`: total de lançamentos CFEM atribuíveis ao processo (Tier 1 / view).
 */
export function getCfemProcessoStatus(
  regime: string | null | undefined,
  cfemNumLancamentos?: number | null,
): CfemProcessoStatus {
  if (!processoGeraCfem(regime)) return 'PROCESSO_NAO_PRODUTIVO'
  const n =
    cfemNumLancamentos != null && Number.isFinite(Number(cfemNumLancamentos))
      ? Number(cfemNumLancamentos)
      : 0
  if (n > 0) return 'OK'
  return 'SEM_DADO_INDIVIDUALIZADO'
}