/**
 * Ingestão TAH (CSV Latin-1, separador vírgula).
 * Fonte: app.anm.gov.br/DadosAbertos/ARRECADACAO/
 * TERRADAR
 *
 * Run: npm run ingest:tah
 */

import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'csv-parse'
import iconv from 'iconv-lite'

import { supabase } from '../supabase'
import {
  normalizarProcesso,
  parseDataISO,
  parseDecimalBR,
  upsertBatch,
} from './lib/csv-utils'

const ARQUIVO = path.join(process.cwd(), 'data', 'anm-arrecadacao', 'Tah.csv')
const BATCH_SIZE = 1000
const ON_CONFLICT = 'processo_numero,data_quitacao,valor_pago'

;(async () => {
  if (!existsSync(ARQUIVO)) {
    console.error(`ARQUIVO NÃO ENCONTRADO: ${ARQUIVO}`)
    process.exit(1)
  }

  console.log('=== INGESTÃO TAH (TERRADAR) ===')
  const inicio = Date.now()
  let batch: Record<string, unknown>[] = []
  let total = 0
  let inseridos = 0
  let erros = 0
  let pulados = 0

  const stream = createReadStream(ARQUIVO)
    .pipe(iconv.decodeStream('latin1'))
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
      const processoNum = normalizarProcesso(row['NRProcesso'], row['NRAnoProcesso'])
      const dataQuit = parseDataISO(row['DTQuitacao'])
      const valorPago = parseDecimalBR(row['VLPago'])

      if (!processoNum || !dataQuit || valorPago === null) {
        pulados++
        continue
      }

      batch.push({
        processo_numero: processoNum,
        ano_processo: Number.parseInt(row['NRAnoProcesso'], 10) || null,
        cpf_cnpj: row['NRCpfCnpj']?.trim() || null,
        nome_pessoa: row['NMPessoa']?.trim() || null,
        fase_processo: row['DSFaseProcesso']?.trim() || null,
        superintendencia: row['NMSuperintendencia']?.trim() || null,
        hectares: parseDecimalBR(row['NRHectares']),
        data_quitacao: dataQuit,
        valor_pago: valorPago,
        valor_total: parseDecimalBR(row['VLTotal']),
      })

      total++

      if (batch.length >= BATCH_SIZE) {
        const r = await upsertBatch(supabase, 'tah_pagamentos', batch, ON_CONFLICT)
        inseridos += r.inserted
        erros += r.errors
        if (total % 25000 === 0) {
          const taxa = Math.round(total / ((Date.now() - inicio) / 1000))
          console.log(`  ${total} processadas (${taxa}/s, ${pulados} pulados)`)
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
    const r = await upsertBatch(supabase, 'tah_pagamentos', batch, ON_CONFLICT)
    inseridos += r.inserted
    erros += r.errors
  }

  const tempoSeg = Math.round((Date.now() - inicio) / 1000)
  console.log(
    `\nOK TAH: ${total} processadas, ${inseridos} enviadas em batch, ${pulados} puladas, ${erros} erros em ${tempoSeg}s`,
  )

  const { count } = await supabase
    .from('tah_pagamentos')
    .select('*', { count: 'exact', head: true })

  console.log(`=== TOTAL FINAL: ${count ?? '?'} linhas em tah_pagamentos ===`)
})().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
