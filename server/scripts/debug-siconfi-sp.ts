// Debug: SICONFI DCA for Sao Paulo capital (3550308), exercicio 2024.
// Usage: npx tsx server/scripts/debug-siconfi-sp.ts

import { SICONFI_TT_BASE } from './utils/siconfi-dca-divida'

const IBGE = '3550308'
const ANO = 2024

const ANEXOS = [
  'DCA-Anexo I-C',
  'DCA-Anexo I-AB',
  'DCA-Anexo I-D',
  'DCA-Anexo I-F',
] as const

function pickRow(r: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    'conta',
    'cod_conta',
    'coluna',
    'valor',
    'exercicio',
    'cod_ibge',
    'instituicao',
    'uf',
    'populacao',
  ]
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (k in r) out[k] = r[k]
  }
  for (const k of Object.keys(r)) {
    if (!(k in out)) out[`_${k}`] = r[k]
  }
  return out
}

function textoContaCodConta(r: Record<string, unknown>): string {
  return [r.conta, r.cod_conta]
    .filter((x) => x != null)
    .map((x) => String(x))
    .join(' | ')
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// conta ou cod_conta: divida, consolidada/consolidad, dc, dcl (case-insensitive)
function matchFiltro(texto: string): boolean {
  const t = semAcento(texto).toLowerCase()
  if (t.includes('divida')) return true
  if (t.includes('consolidada') || t.includes('consolidad')) return true
  if (t.includes('dcl')) return true
  if (t.includes('dc')) return true
  return false
}

async function fetchAnexo(anexo: string): Promise<{
  items: Record<string, unknown>[]
  exercicioUsado: number
  httpStatus: number
}> {
  const url = `${SICONFI_TT_BASE}/dca?an_exercicio=${ANO}&id_ente=${IBGE}&no_anexo=${encodeURIComponent(anexo)}`
  const res = await fetch(url)
  if (!res.ok) {
    return { items: [], exercicioUsado: 0, httpStatus: res.status }
  }
  const data = (await res.json()) as { items?: Record<string, unknown>[] }
  const items = data.items ?? []
  return { items, exercicioUsado: ANO, httpStatus: res.status }
}

async function main(): Promise<void> {
  console.log('='.repeat(72))
  console.log(
    `SICONFI DCA debug - id_ente=${IBGE} (Sao Paulo capital), an_exercicio=${ANO}`,
  )
  console.log(`Base: ${SICONFI_TT_BASE}/dca`)
  console.log('='.repeat(72))

  const porAnexo: Array<{
    anexo: string
    n: number
    httpStatus: number
    amostra: Record<string, unknown>[]
    todasFiltradas: Record<string, unknown>[]
  }> = []

  for (const anexo of ANEXOS) {
    const { items, httpStatus } = await fetchAnexo(anexo)
    const amostra = items.slice(0, 15).map((r) => pickRow(r))
    const todasFiltradas = items.filter((r) =>
      matchFiltro(textoContaCodConta(r as Record<string, unknown>)),
    )

    porAnexo.push({
      anexo,
      n: items.length,
      httpStatus,
      amostra,
      todasFiltradas,
    })
  }

  console.log('\n--- Resumo por anexo ---\n')
  let totalLinhas = 0
  for (const b of porAnexo) {
    totalLinhas += b.n
    console.log(
      `${b.anexo}: ${b.n} linhas (HTTP ${b.httpStatus}), exercicio pedido: ${ANO}`,
    )
  }
  console.log(`\nTotal linhas (todos anexos): ${totalLinhas}`)
  console.log(
    `Anexos com dados: ${porAnexo.filter((x) => x.n > 0).length} / ${ANEXOS.length}`,
  )

  for (const b of porAnexo) {
    console.log('\n' + '='.repeat(72))
    console.log(`ANEXO: ${b.anexo} - ${b.n} linhas`)
    console.log('='.repeat(72))
    console.log(
      '\n--- Amostra (15 primeiras linhas, campos principais + extras) ---\n',
    )
    console.log(JSON.stringify(b.amostra, null, 2))

    console.log(
      `\n--- Linhas com conta/cod_conta (filtro DIVIDA/CONSOLIDADA/DC/DCL) - ${b.todasFiltradas.length} ocorrencias ---\n`,
    )
    console.log(JSON.stringify(b.todasFiltradas.map((r) => pickRow(r)), null, 2))
  }

  console.log('\n' + '='.repeat(72))
  console.log('Fim do debug.')
  console.log('='.repeat(72))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
