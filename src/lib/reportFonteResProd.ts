export const PREFIX_SEM_FONTE_RES_PROD = "SEM_FONTE_OFICIAL:"

export function isSemFonteOficialReservaProducaoGlobal(
  fonte: string | null | undefined,
): boolean {
  return Boolean(fonte?.startsWith(PREFIX_SEM_FONTE_RES_PROD))
}

export function textoAposSemFonteOficial(fonte: string): string {
  return fonte.slice(PREFIX_SEM_FONTE_RES_PROD.length).trim()
}