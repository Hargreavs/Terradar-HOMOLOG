export const SICONFI_TT_BASE =
  'https://apidatalake.tesouro.gov.br/ords/siconfi/tt'

export interface SiconfiItem {
  exercicio?: number
  cod_ibge?: string | number
  instituicao?: string
  uf?: string
  populacao?: number
  coluna?: string
  conta?: string
  cod_conta?: string
  valor?: number
}

export async function fetchDCA(
  ibge: string,
  anexo: string,
  anos?: number[],
): Promise<{ items: SiconfiItem[]; exercicio: number }> {
  const years = anos ?? [2024, 2023, 2022]
  for (const ano of years) {
    const url = `${SICONFI_TT_BASE}/dca?an_exercicio=${ano}&id_ente=${ibge}&no_anexo=${encodeURIComponent(anexo)}`
    console.log(`  [SICONFI] ${anexo} ${ano} para ${ibge}...`)
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`    HTTP ${res.status}`)
      continue
    }
    const data = (await res.json()) as { items?: SiconfiItem[] }
    const items = data.items ?? []
    if (items.length > 0) {
      console.log(`    OK ${items.length} registros (exercicio ${ano})`)
      return { items, exercicio: ano }
    }
    console.log(`    vazio para ${ano}`)
  }
  console.log(`    sem DCA para ${ibge}`)
  return { items: [], exercicio: 0 }
}

function colunaEhReferencia(coluna: string): boolean {
  const c = coluna.trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(c)) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return true
  if (/31\/12\/\d{4}/.test(c)) return true
  return false
}

function extrairValorContaDataRealizada(
  items: SiconfiItem[],
  matchConta: (conta: string) => boolean,
): number | null {
  const candidatos = items.filter((item) =>
    matchConta(item.conta?.trim() ?? ''),
  )
  if (candidatos.length === 0) return null

  const comRef = candidatos.find((item) =>
    colunaEhReferencia(item.coluna?.trim() ?? ''),
  )
  const match = comRef ?? candidatos[candidatos.length - 1]
  const v = match?.valor
  return v != null && Number.isFinite(v) ? v : null
}

const DIVIDA_CONSOLIDADA_RE =
  /d[i\u00ED]vida\s+consolidada|d\s*c\s*\(\s*i\s*\)|\bdc\b.*consolidad/i

export function extrairDividaConsolidadaDeItens(
  items: SiconfiItem[],
  rotulo: string,
): number | null {
  const v = extrairValorContaDataRealizada(items, (conta) => {
    const cl = conta.toLowerCase()
    if (/amortiza|d[i\u00ED]vida\s+ativa\s+tribut/i.test(cl)) return false
    return DIVIDA_CONSOLIDADA_RE.test(conta)
  })
  if (v != null && Number.isFinite(v)) {
    console.log(`  [divida consolidada] ${rotulo} -> R$ ${v.toFixed(2)}`)
    return v
  }
  return null
}

async function buscarDividaConsolidadaAnexosExtras(
  ibge: string,
  exercicioBase: number,
): Promise<number | null> {
  const anexos = ['DCA-Anexo I-D', 'DCA-Anexo I-F']
  const anos = [exercicioBase, exercicioBase - 1].filter((y) => y >= 2020)
  for (const anexo of anexos) {
    for (const ano of anos) {
      const { items, exercicio } = await fetchDCA(ibge, anexo, [ano])
      if (exercicio === 0 || items.length === 0) continue
      const v = extrairDividaConsolidadaDeItens(
        items,
        `${anexo} ex.${exercicio}`,
      )
      if (v != null) return v
    }
  }
  console.log(
    `  [divida consolidada] sem linha DC nos anexos DCA (fonte indisponivel)`,
  )
  return null
}

export async function resolveDividaConsolidada(
  ibge: string,
  exercicioRef: number,
  balancoItems: SiconfiItem[],
  exBal: number,
): Promise<number | null> {
  let dividaValor = extrairDividaConsolidadaDeItens(
    balancoItems,
    `DCA-Anexo I-AB ex.${exBal || exercicioRef}`,
  )
  if (dividaValor == null) {
    dividaValor = await buscarDividaConsolidadaAnexosExtras(ibge, exercicioRef)
  }
  return dividaValor
}

export async function fetchDividaConsolidadaForMunicipio(
  ibge: string,
  exercicioAlvo: number,
): Promise<number | null> {
  const anosBalanco = [exercicioAlvo, exercicioAlvo - 1, 2024, 2023, 2022].filter(
    (y, i, a) => y >= 2020 && a.indexOf(y) === i,
  )
  let balancoItems: SiconfiItem[] = []
  let exBal = 0
  for (const ano of anosBalanco) {
    const r = await fetchDCA(ibge, 'DCA-Anexo I-AB', [ano])
    if (r.items.length > 0) {
      balancoItems = r.items
      exBal = r.exercicio
      break
    }
  }
  return resolveDividaConsolidada(ibge, exercicioAlvo, balancoItems, exBal)
}
