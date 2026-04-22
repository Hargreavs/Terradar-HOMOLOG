/**
 * ingest-fiscal.ts (TERRADAR)
 *
 * SICONFI (STN DataLake) + IBGE → tabela `fiscal_municipios`.
 * Regra: nunca sobrescrever valor existente no banco com NULL (merge antes do upsert).
 *
 * Uso:
 *   npx tsx server/scripts/ingest-fiscal.ts --ibge 1711506
 *   npx tsx server/scripts/ingest-fiscal.ts --ibge 1711506,1705102
 *   npx tsx server/scripts/ingest-fiscal.ts --uf TO
 */
import '../env'

import { supabase } from '../supabase'
import {
  type SiconfiItem,
  fetchDCA,
  resolveDividaConsolidada,
} from './utils/siconfi-dca-divida'

/** Não sobrescrever colunas com NULL/undefined (nem string vazia). */
function mergePreserveNonNull<T extends Record<string, unknown>>(
  existing: T | null,
  incoming: T,
): T {
  if (!existing) return incoming
  const out = { ...existing } as Record<string, unknown>
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out as T
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

/** Slug da URL ibge.gov.br/cidades-e-estados/{uf}/{slug}.html */
function slugIbgeCidades(nomeMunicipio: string): string {
  return nomeMunicipio
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/d['']/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * IDHM 2010 - página «Cidades e Estados» (PNUD), quando APIs agregados falham.
 */
async function fetchIDHMFromIbgeCidadesHtml(
  uf: string,
  nomeMunicipio: string,
): Promise<number | null> {
  const slug = slugIbgeCidades(nomeMunicipio)
  if (!slug || !uf) return null
  const url = `https://www.ibge.gov.br/cidades-e-estados/${uf.toLowerCase()}/${slug}.html`
  console.log(`  [IBGE] IDHM (HTML Cidades) ${url}...`)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TERRADAR-ingest-fiscal/1.0' },
    })
    if (!res.ok) {
      console.log(`    HTTP ${res.status}`)
      return null
    }
    const html = await res.text()
    const idx = html.search(/IDHM|índice de desenvolvimento humano municipal/i)
    const slice = idx >= 0 ? html.slice(idx, idx + 2500) : html
    // IBGE usa `<p class='ind-value'>0,662<small>&nbsp;[2010]</small>` (tags entre número e [2010])
    const m = slice.match(
      /(\d{1,2},\d{2,4})(?:\s|<[^>]+>|&nbsp;)*\[\s*2010\s*\]/i,
    )
    if (!m?.[1]) {
      console.log(`    WARN: IDHM [2010] não encontrado no HTML`)
      return null
    }
    const br = m[1].replace(/\./g, '').replace(',', '.')
    const n = parseFloat(br)
    if (!Number.isFinite(n)) return null
    console.log(`    OK IDHM 2010: ${n}`)
    return n
  } catch (e) {
    console.log(`    WARN IDHM HTML: ${e}`)
    return null
  }
}

/**
 * IDHM - endpoint documentado `pesquisas/37/resultados/{ibge}` (hoje costuma retornar `[]`).
 * Mantido como primeira tentativa rápida caso o IBGE volte a popular.
 */
async function fetchIDHMFromPesquisa37V1(ibge: string): Promise<number | null> {
  try {
    const url = `https://servicodados.ibge.gov.br/api/v1/pesquisas/37/resultados/${ibge}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'TERRADAR-ingest-fiscal/1.0' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    if (!Array.isArray(data) || data.length === 0) return null
    const first = data[0] as Record<string, unknown>
    const raw =
      first.res ?? first.resultado ?? first.valor ?? first.idhm ?? first.idh
    const n =
      typeof raw === 'number'
        ? raw
        : raw != null
          ? parseFloat(String(raw).replace(',', '.'))
          : NaN
    if (!Number.isFinite(n)) return null
    console.log(`  [IBGE] IDHM (pesquisas/37/resultados): ${n}`)
    return n
  } catch {
    return null
  }
}

/** IDHM 2010 - SIDRA agregado 6449 (quando a API responder). */
async function fetchIDHM2010Agregados(ibge: string): Promise<number | null> {
  try {
    const loc = encodeURIComponent(`N6[${ibge}]`)
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/6449/periodos/2010/variaveis/12762?localidades=${loc}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    if (
      typeof data === 'object' &&
      data !== null &&
      'statusCode' in data &&
      (data as { statusCode?: number }).statusCode === 500
    ) {
      return null
    }
    const arr = data as Array<{
      resultados?: Array<{
        series?: Array<{ serie?: Record<string, string> }>
      }>
    }>
    const serie = arr[0]?.resultados?.[0]?.series?.[0]?.serie
    if (!serie || typeof serie !== 'object') return null
    const vals = Object.values(serie)
    const last = vals[vals.length - 1]
    const n = last != null ? parseFloat(String(last)) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function fetchIDHM2010(
  ibge: string,
  uf: string,
  nomeMunicipio: string,
): Promise<number | null> {
  const v1 = await fetchIDHMFromPesquisa37V1(ibge)
  if (v1 != null) return v1
  const api = await fetchIDHM2010Agregados(ibge)
  if (api != null) {
    console.log(`  [IBGE] IDHM agregados 6449: ${api}`)
    return api
  }
  console.log(
    `  [IBGE] WARN: agregados 6449 indisponível ou erro; tentando HTML Cidades`,
  )
  return fetchIDHMFromIbgeCidadesHtml(uf, nomeMunicipio)
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
  divida_consolidada: number | null
  dep_transferencias_pct: number | null
  autonomia_ratio: number | null
  pib_municipal_mi: number | null
  area_km2: number | null
  densidade: number | null
  idh: number | null
}

async function fetchExistingFiscal(
  ibge: string,
  exercicio: number,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('fiscal_municipios')
    .select('*')
    .eq('municipio_ibge', ibge)
    .eq('exercicio', exercicio)
    .maybeSingle()
  if (error) return null
  return data ?? null
}

/** Exercício imediatamente anterior (para herdar idh/divida quando o ano novo ainda não tem). */
async function fetchPreviousFiscalYear(
  ibge: string,
  exercicioAtual: number,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('fiscal_municipios')
    .select('*')
    .eq('municipio_ibge', ibge)
    .lt('exercicio', exercicioAtual)
    .order('exercicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data ?? null
}

function carryIdhDividaFromPrevious(
  merged: Record<string, unknown>,
  latestAny: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!latestAny) return merged
  const out = { ...merged }
  const keys = ['idh', 'divida_consolidada'] as const
  for (const k of keys) {
    const cur = out[k]
    if (cur != null && cur !== '') continue
    const prev = latestAny[k]
    if (prev != null && prev !== '') out[k] = prev
  }
  return out
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
  const idhm = await fetchIDHM2010(ibge, uf, municipioNome)
  const densidade =
    populacao != null && area != null && area > 0
      ? populacao / area
      : null

  const dividaValor = await resolveDividaConsolidada(
    ibge,
    exercicio,
    balancoItems,
    exBal,
  )

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
    divida_consolidada: dividaValor,
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

const AUDIT_FISCAL_KEYS: Array<{
  key: keyof FiscalRow
  label: string
  nullReason: 'fonte' | 'erro'
}> = [
  { key: 'receita_corrente', label: 'receita_corrente', nullReason: 'fonte' },
  { key: 'idh', label: 'idh', nullReason: 'fonte' },
  { key: 'divida_consolidada', label: 'divida_consolidada', nullReason: 'fonte' },
  { key: 'pib_municipal_mi', label: 'pib_municipal_mi', nullReason: 'erro' },
]

function auditFiscalRow(ibge: string, row: Record<string, unknown>): void {
  console.log(`\n[AUDIT] fiscal_municipios ${ibge}:`)
  for (const { key, label, nullReason } of AUDIT_FISCAL_KEYS) {
    const v = row[key as string]
    if (v != null && v !== '') {
      console.log(`  ✅ ${label} = ${typeof v === 'number' ? String(v) : v}`)
    } else {
      const tag =
        nullReason === 'fonte'
          ? '(fonte indisponível ou sem linha nos anexos)'
          : '(verificar chamada IBGE/SICONFI)'
      console.log(`  ⚠️ ${label} = NULL ${tag}`)
    }
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

  console.log(`\nIngestao fiscal (TERRADAR): ${ibgeCodes.length} municipio(s)\n`)

  let ok = 0
  let skip = 0

  for (const ibge of ibgeCodes) {
    try {
      const fiscal = await processarMunicipio(ibge)
      if (!fiscal) {
        skip++
        continue
      }

      const existing = await fetchExistingFiscal(ibge, fiscal.exercicio)
      const anterior = await fetchPreviousFiscalYear(ibge, fiscal.exercicio)
      let merged = mergePreserveNonNull(
        existing as Record<string, unknown> | null,
        { ...fiscal, updated_at: new Date().toISOString() } as unknown as Record<
          string,
          unknown
        >,
      )
      merged = carryIdhDividaFromPrevious(merged, anterior)

      const { error } = await supabase.from('fiscal_municipios').upsert(merged, {
        onConflict: 'municipio_ibge,exercicio',
      })

      if (error) {
        console.error(`  erro Supabase ${ibge}: ${error.message}`)
        skip++
      } else {
        console.log(`  OK upsert ${fiscal.municipio_nome}/${fiscal.uf}`)
        const { data: saved } = await supabase
          .from('fiscal_municipios')
          .select('*')
          .eq('municipio_ibge', ibge)
          .eq('exercicio', fiscal.exercicio)
          .maybeSingle()
        if (saved) auditFiscalRow(ibge, saved as Record<string, unknown>)
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
