/**
 * Ingestão CFEM Arrecadação (CSV Latin-1, separador vírgula).
 * Fonte: app.anm.gov.br/DadosAbertos/ARRECADACAO/
 * TERRADAR
 *
 * Coloque os CSVs em data/anm-arrecadacao/ antes de rodar.
 * Run: npm run ingest:cfem
 */

import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'csv-parse'
import iconv from 'iconv-lite'

import { supabase } from '../supabase'
import {
  criarStreamLimpezaAspas,
  normalizarProcesso,
  parseDataISO,
  parseDecimalBR,
  upsertBatch,
} from './lib/csv-utils'

const PASTA_DADOS = path.join(process.cwd(), 'data', 'anm-arrecadacao')
const ARQUIVOS = [
  'CFEM_Arrecadacao_2017_2021.csv',
  'CFEM_Arrecadacao_2022_2026.csv',
] as const

const BATCH_SIZE = 1000
const ON_CONFLICT =
  'ano,mes,processo_numero,municipio_ibge,substancia,valor_recolhido'

async function ingerir(arquivo: string): Promise<void> {
  const fullPath = path.join(PASTA_DADOS, arquivo)
  if (!existsSync(fullPath)) {
    console.error(`ARQUIVO NÃO ENCONTRADO: ${fullPath}`)
    return
  }

  console.log(`\n=== Ingerindo ${arquivo} ===`)
  const inicio = Date.now()
  let batch: Record<string, unknown>[] = []
  let total = 0
  let inseridos = 0
  let erros = 0
  let pulados = 0

  const stream = createReadStream(fullPath)
    .pipe(iconv.decodeStream('latin1'))
    .pipe(criarStreamLimpezaAspas())
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        delimiter: ',',
        quote: '"',
        relax_quotes: true,
        trim: true,
      }),
    )

  for await (const row of stream as AsyncIterable<Record<string, string>>) {
    try {
      const processoNum = normalizarProcesso(row['Processo'], row['AnoDoProcesso'])
      const ano = Number.parseInt(row['Ano'], 10)
      const mes = Number.parseInt(row['Mês'], 10)
      const valorRec = parseDecimalBR(row['ValorRecolhido'])

      if (
        !processoNum ||
        !Number.isFinite(ano) ||
        !Number.isFinite(mes) ||
        valorRec === null
      ) {
        pulados++
        continue
      }

      batch.push({
        ano,
        mes,
        processo_numero: processoNum,
        ano_processo: Number.parseInt(row['AnoDoProcesso'], 10) || null,
        tipo_pf_pj: row['Tipo_PF_PJ']?.trim() || null,
        cpf_cnpj: row['CPF_CNPJ']?.trim() || null,
        substancia: row['Substância']?.trim() || 'NAO_INFORMADA',
        uf: row['UF']?.trim() || null,
        municipio_ibge: row['CodigoMunicipio']?.trim() || null,
        municipio_nome: row['Município']?.trim() || null,
        quantidade_comercializada: parseDecimalBR(row['QuantidadeComercializada']),
        unidade_medida: row['UnidadeDeMedida']?.trim() || null,
        valor_recolhido: valorRec,
        data_criacao: parseDataISO(row['DataCriacao']),
      })

      total++

      if (batch.length >= BATCH_SIZE) {
        const r = await upsertBatch(supabase, 'cfem_arrecadacao', batch, ON_CONFLICT)
        inseridos += r.inserted
        erros += r.errors
        if (total % 25000 === 0) {
          const taxa = Math.round(total / ((Date.now() - inicio) / 1000))
          console.log(`  ${total} linhas processadas (${taxa}/s, ${pulados} pulados)`)
        }
        batch = []
      }
    } catch (e: unknown) {
      erros++
      if (erros < 10) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`  Erro linha:`, msg)
      }
    }
  }

  if (batch.length > 0) {
    const r = await upsertBatch(supabase, 'cfem_arrecadacao', batch, ON_CONFLICT)
    inseridos += r.inserted
    erros += r.errors
  }

  const tempoSeg = Math.round((Date.now() - inicio) / 1000)
  console.log(
    `OK ${arquivo}: ${total} processadas, ${inseridos} enviadas em batch, ${pulados} puladas, ${erros} erros em ${tempoSeg}s`,
  )
}

;(async () => {
  console.log('=== INGESTÃO CFEM Arrecadação (TERRADAR) ===')
  console.log(`Pasta: ${PASTA_DADOS}`)

  for (const arq of ARQUIVOS) {
    await ingerir(arq)
  }

  const { count } = await supabase
    .from('cfem_arrecadacao')
    .select('*', { count: 'exact', head: true })

  console.log(`\n=== TOTAL FINAL: ${count ?? '?'} linhas em cfem_arrecadacao ===`)
})().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
