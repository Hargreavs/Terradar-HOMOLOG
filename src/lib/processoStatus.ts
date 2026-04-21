import type { AnaliseAreaProtegida } from './processoApi'

export type BloqueadorConstitucional =
  | { tipo: 'TI_REGULARIZADA'; nome: string }
  | { tipo: 'UC_PROTECAO_INTEGRAL'; nome: string }

export function detectarBloqueadorConstitucional(
  areasProtegidas: AnaliseAreaProtegida[] | null | undefined,
): BloqueadorConstitucional | null {
  if (!areasProtegidas?.length) return null

  const tiBloqueadora = areasProtegidas.find((a) => {
    const dk = Number(a.distancia_km)
    const sobre =
      Number.isFinite(dk) && (dk === 0 || Math.abs(dk) < 1e-6)
    return (
      a.tipo === 'TI' &&
      (a.categoria ?? '').trim() === 'Regularizada' &&
      sobre
    )
  })
  if (tiBloqueadora) {
    return { tipo: 'TI_REGULARIZADA', nome: tiBloqueadora.nome.trim() }
  }

  const ucBloqueadora = areasProtegidas.find((a) => {
    const dk = Number(a.distancia_km)
    const sobre =
      Number.isFinite(dk) && (dk === 0 || Math.abs(dk) < 1e-6)
    return (
      a.tipo === 'UC' &&
      sobre &&
      /\b(ESEC|REBIO|PARNA|MONA|REVIS|PROTE[cç][AÃ]O\s+INTEGRAL)\b/i.test(
        a.categoria ?? '',
      )
    )
  })
  if (ucBloqueadora) {
    return { tipo: 'UC_PROTECAO_INTEGRAL', nome: ucBloqueadora.nome.trim() }
  }

  return null
}

export function isProcessoTerminal(processo: {
  ativo_derivado?: boolean | null
}): boolean {
  return processo?.ativo_derivado === false
}

/** Infraestrutura considerada para proximidade logística operacional (exclui projetos só em estudo). */
export function infraestruturaComOperacaoDeclarada<
  T extends { detalhes?: string },
>(infra: T[]): T[] {
  return infra.filter((i) => (i.detalhes ?? '').trim() !== 'Estudo')
}
