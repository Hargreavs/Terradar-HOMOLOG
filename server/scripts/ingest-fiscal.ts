/**
 * ingest-fiscal.ts
 *
 * SICONFI (STN DataLake) + IBGE → tabela `fiscal_municipios`.
 *
 * Uso:
 *   npx tsx server/scripts/ingest-fiscal.ts --ibge 1711506
 *   npx tsx server/scripts/ingest-fiscal.ts --ibge 1711506,1705102
 *   npx tsx server/scripts/ingest-fiscal.ts --uf TO
 */
import '../env'

import { supabase } from '../supabase'

const SICONFI_BASE = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt'

interface SiconfiItem {
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

async function fetchDCA(
  ibge: string,
  anexo: string,
  anos?: number[],
): Promise<{ items: SiconfiItem[]; exercicio: number }> {
  const years = anos ?? [2024, 2023, 2022]
  for (const ano of years) {
    const url = `${SICONFI_BASE}/dca?an_exercicio=${ano}&id_ente=${ibge}&no_anexo=${encodeURIComponent(anexo)}`
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

function extrairContaReceita(items: SiconfiItem[], contaPrefixo: string): number {
  const candidatos = items.filter((item) =>
    (item.conta?.trim() ?? '').startsWith(contaPrefixo),
  )
  const match =
    candidatos.find((item) => {
      const col = item.coluna?.trim() ?? ''
      return col.includes('Realizad') || col.includes('realizad')
    }) ?? candidatos[0]
  return match?.valor ?? 0
}

function extrairContaBalanco(items: SiconfiItem[], contaPrefixo: string): number {
  const match = items.find((item) => {
    const conta = item.conta?.trim() ?? ''
    const coluna = item.coluna?.trim() ?? ''
    return (
      conta.startsWith(contaPrefixo) &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(coluna) &&
      !conta.includes('Financeiro') &&
      !conta.includes('Permanente')
    )
  })
  return match?.valor ?? 0
}

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v3'

async function fetchPIB(ibge: string): Promise<number | null> {
  try {
    const url = `${IBGE_BASE}/agregados/5938/periodos/-1/variaveis/37?localidades=N6[${ibge}]`
    console.log(`  [IBGE] PIB para ${ibge}...`)

    const res = await fetch(url)
    if (!res.ok) return null

    const data = (await res.json()) as Array<{
      resultados?: Array<{ series?: Array<{ serie?: Record<string, string> }> }>
    }>
    const serie = data[0]?.resultados?.[0]?.series?.[0]?.serie
    if (!serie || typeof serie !== 'object') return null

    const periodos = Object.entries(serie)
    if (periodos.length === 0) return null

    const valorMil = parseFloat(String(periodos[periodos.length - 1]![1]))
    if (Number.isNaN(valorMil)) return null

    const valorMi = valorMil / 1000
    console.log(`    OK PIB: R$ ${valorMi.toFixed(1)} Mi`)
    return valorMi
  } catch (err) {
    console.log(`    erro PIB: ${err}`)
    return null
  }
}

/** IDHM 2010 (variável SIDRA 12762, agregado 6449), quando a API responde. */
async function fetchIDHM2010(ibge: string): Promise<number | null> {
  try {
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/6449/periodos/2010/variaveis/12762?localidades=N6[${ibge}]`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as Array<{
      resultados?: Array<{
        series?: Array<{ serie?: Record<string, string> }>
      }>
    }>
    const serie = data[0]?.resultados?.[0]?.series?.[0]?.serie
    if (!serie || typeof serie !== 'object') return null
    const vals = Object.values(serie)
    const last = vals[vals.length - 1]
    const n = last != null ? parseFloat(String(last)) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function fetchArea(ibge: string): Promise<number | null> {
  try {
    const url = `${IBGE_BASE}/agregados/4714/periodos/-1/variaveis/93?localidades=N6[${ibge}]`
    console.log(`  [IBGE] Area para ${ibge}...`)

    const res = await fetch(url)
    if (!res.ok) return null

    const data = (await res.json()) as Array<{
      resultados?: Array<{ series?: Array<{ serie?: Record<string, string> }> }>
    }>
    const mapa = data[0]?.resultados?.[0]?.series?.[0]?.serie
    if (!mapa || Object.keys(mapa).length === 0) return null

    const periodos = Object.entries(mapa)
    const valor = parseFloat(String(periodos[periodos.length - 1]![1]))
    if (Number.isNaN(valor)) return null

    console.log(`    OK area: ${valor.toFixed(1)} km2`)
    return valor
  } catch (err) {
    console.log(`    erro Area: ${err}`)
    return null
  }
}

interface FiscalRow {
  municipio_ibge: string
  municipio_nome: string
  uf: string
  exercicio: number
  populacao: number | null
  receita_corrente: number | null
  receita_tributaria: number | null
  transferencias_correntes: number | null
  passivo_nao_circulante: number | null
  /** Dívida consolidada (RGF conta DC); preferir quando distinto do passivo DCA. */
  divida_consolidada: number | null
  dep_transferencias_pct: number | null
  autonomia_ratio: number | null
  pib_municipal_mi: number | null
  area_km2: number | null
  densidade: number | null
  idh: number | null
}

async function processarMunicipio(ibge: string): Promise<FiscalRow | null> {
  console.log(`\n--- ${ibge} ---`)

  const { items: receitaItems, exercicio } = await fetchDCA(ibge, 'DCA-Anexo I-C')
  if (exercicio === 0) {
    console.log(`  sem SICONFI receitas; pulando`)
    return null
  }

  const anosBalanco = [
    exercicio,
    exercicio - 1,
    2024,
    2023,
    2022,
  ].filter((y, i, a) => y >= 2020 && a.indexOf(y) === i)

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
  if (balancoItems.length === 0) {
    console.log(`  aviso: sem Anexo I-AB; passivo fica 0`)
  }

  const receitaCorrente = extrairContaReceita(receitaItems, '1.0.0.0.00.0.0')
  const receitaTributaria = extrairContaReceita(receitaItems, '1.1.0.0.00.0.0')
  const transferencias = extrairContaReceita(receitaItems, '1.7.0.0.00.0.0')
  // Conta 2.2.2 = Empréstimos e Financiamentos (dívida financeira real)
  // NÃO usar 2.2.0 (Passivo NC total) — inclui obrigações trabalhistas e fornecedores
  const passivoNC = extrairContaBalanco(balancoItems, '2.2.2.0.0.00.00')

  const populacao = receitaItems[0]?.populacao ?? null
  const municipioNome = receitaItems[0]?.instituicao
    ?.replace(/^Prefeitura Municipal de /i, '')
    ?.replace(/ - [A-Z]{2}$/u, '')
    ?.trim() ?? ''
  const uf = receitaItems[0]?.uf ?? ''

  const depTransf =
    receitaCorrente > 0 ? (transferencias / receitaCorrente) * 100 : null

  let autonomiaRatio: number | null = null
  if (passivoNC > 0 && receitaTributaria > 0) {
    autonomiaRatio = receitaTributaria / passivoNC
  } else if (passivoNC === 0 && receitaTributaria > 0) {
    autonomiaRatio = 999
  }

  const pib = await fetchPIB(ibge)
  const area = await fetchArea(ibge)
  const idhm = await fetchIDHM2010(ibge)
  const densidade =
    populacao != null && area != null && area > 0
      ? populacao / area
      : null

  console.log(
    `  resumo ${municipioNome}/${uf} (receitas ex.${exercicio}, balanco ex.${exBal || 'n/a'}):`,
  )
  console.log(`    receita corrente R$ ${(receitaCorrente / 1e6).toFixed(2)} Mi`)
  console.log(`    receita tributaria R$ ${(receitaTributaria / 1e6).toFixed(2)} Mi`)
  console.log(`    passivo NC R$ ${(passivoNC / 1e6).toFixed(2)} Mi`)
  if (idhm != null) console.log(`    IDHM 2010: ${idhm}`)

  return {
    municipio_ibge: ibge,
    municipio_nome: municipioNome,
    uf,
    exercicio,
    populacao,
    receita_corrente: receitaCorrente || null,
    receita_tributaria: receitaTributaria || null,
    transferencias_correntes: transferencias || null,
    passivo_nao_circulante:
      passivoNC != null && Number.isFinite(passivoNC) ? passivoNC : null,
    divida_consolidada: null,
    dep_transferencias_pct:
      depTransf != null ? Math.round(depTransf * 10) / 10 : null,
    autonomia_ratio:
      autonomiaRatio != null && autonomiaRatio < 999
        ? Math.round(autonomiaRatio * 100) / 100
        : autonomiaRatio === 999
          ? 999
          : null,
    pib_municipal_mi: pib,
    area_km2: area,
    densidade: densidade != null ? Math.round(densidade * 100) / 100 : null,
    idh: idhm,
  }
}

async function main() {
  const args = process.argv.slice(2)
  let ibgeCodes: string[] = []

  const ibgeIdx = args.indexOf('--ibge')
  if (ibgeIdx !== -1 && args[ibgeIdx + 1]) {
    ibgeCodes = args[ibgeIdx + 1].split(',').map((s) => s.trim())
  }

  const ufIdx = args.indexOf('--uf')
  if (ufIdx !== -1 && args[ufIdx + 1]) {
    const uf = args[ufIdx + 1].toUpperCase()
    console.log(`Buscando municipios UF ${uf} em capag_municipios...`)
    const { data: municipios, error } = await supabase
      .from('capag_municipios')
      .select('municipio_ibge')
      .eq('uf', uf)

    if (error) {
      console.error(error.message)
      process.exit(1)
    }
    ibgeCodes = [
      ...new Set(
        (municipios ?? []).map((m) => String(m.municipio_ibge)),
      ),
    ]
    console.log(`Encontrados ${ibgeCodes.length} municipios`)
    if (ibgeCodes.length === 0) process.exit(1)
  }

  if (ibgeCodes.length === 0) {
    console.error(
      'Uso: npx tsx server/scripts/ingest-fiscal.ts --ibge 1711506[,...] | --uf TO',
    )
    process.exit(1)
  }

  console.log(`\nIngestao fiscal: ${ibgeCodes.length} municipio(s)\n`)

  let ok = 0
  let skip = 0

  for (const ibge of ibgeCodes) {
    try {
      const fiscal = await processarMunicipio(ibge)
      if (!fiscal) {
        skip++
        continue
      }

      const { error } = await supabase.from('fiscal_municipios').upsert(
        { ...fiscal, updated_at: new Date().toISOString() },
        { onConflict: 'municipio_ibge,exercicio' },
      )

      if (error) {
        console.error(`  erro Supabase ${ibge}: ${error.message}`)
        skip++
      } else {
        console.log(`  OK upsert ${fiscal.municipio_nome}/${fiscal.uf}`)
        ok++
      }

      await new Promise((r) => setTimeout(r, 1000))
    } catch (err) {
      console.error(`  erro ${ibge}: ${err}`)
      skip++
    }
  }

  console.log(`\nResultado: ${ok} ok, ${skip} pulados\n`)
}

main().catch(console.error)
