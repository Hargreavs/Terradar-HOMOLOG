/**
 * Ingestão CFEM Autuação (CSV Latin-1, separador ponto e vírgula).
 * Fonte: app.anm.gov.br/DadosAbertos/ARRECADACAO/
 * TERRADAR
 *
 * Run: npm run ingest:autuacao
 */

import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'

import { parse, type CsvError } from 'csv-parse'
import iconv from 'iconv-lite'

import { supabase } from '../supabase'
import { parseDecimalBR, upsertBatch } from './lib/csv-utils'

const ARQUIVO = path.join(process.cwd(), 'data', 'anm-arrecadacao', 'CFEM_Autuacao.csv')
const BATCH_SIZE = 1000
const ON_CONFLICT = 'processo_cobranca,processo_minerario'

/**
 * Normaliza processo minerário formato "950121/1988" para "950.121/1988"
 */
function normalizarProcessoMinerario(raw: string | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  const match = s.match(/^(\d+)\/(\d{4})$/)
  if (!match) return null
  const [, num, ano] = match
  const padded = num.padStart(6, '0')
  return `${padded.slice(0, 3)}.${padded.slice(3)}/${ano}`
}

;(async () => {
  if (!existsSync(ARQUIVO)) {
    console.error(`ARQUIVO NÃO ENCONTRADO: ${ARQUIVO}`)
    process.exit(1)
  }

  console.log('=== INGESTÃO CFEM Autuação (TERRADAR) ===')
  const inicio = Date.now()
  let batch: Record<string, unknown>[] = []
  let total = 0
  let inseridos = 0
  let erros = 0
  let pulados = 0
  /** Números de linha do arquivo com registo CSV inválido (aspas, colunas, etc.). */
  const linhasCsvComErro = new Set<number>()
  let avisosCsvRestantes = 5

  const stream = createReadStream(ARQUIVO)
    .pipe(iconv.decodeStream('latin1'))
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
        quote: '"',
        relax_quotes: true,
        trim: true,
        // ANM: alguns titulares trazem " literal no nome (ex.: VEND"AGUA) sem duplicar aspas.
        skip_records_with_error: true,
        on_skip: (err: CsvError | undefined) => {
          if (err?.lines != null) linhasCsvComErro.add(err.lines)
          if (avisosCsvRestantes > 0 && err) {
            avisosCsvRestantes--
            console.warn(
              `[CSV linha ignorada] ${err.code} (linha ${err.lines}): ${err.message}`,
            )
          }
        },
      }),
    )

  for await (const row of stream as AsyncIterable<Record<string, string>>) {
    try {
      const processoCobranca = row['ProcessoCobrança']?.trim()
      const processoMinerario = normalizarProcessoMinerario(row['ProcessoMinerário'])

      if (!processoCobranca || !processoMinerario) {
        pulados++
        continue
      }

      batch.push({
        processo_cobranca: processoCobranca,
        ano_publicacao: row['AnoPublicação']
          ? Number.parseInt(row['AnoPublicação'], 10)
          : null,
        mes_publicacao: row['MêsPublicação']
          ? Number.parseInt(row['MêsPublicação'], 10)
          : null,
        tipo_pf_pj: row['Tipo_PF_PJ']?.trim() || null,
        cpf_cnpj: row['CPF_CNPJ']?.trim() || null,
        nome_titular: row['NomeTitular']?.trim() || null,
        numero_auto: row['NúmeroAuto']?.trim() || null,
        processo_minerario: processoMinerario,
        substancia: row['Substância']?.trim() || null,
        municipio: row['Município']?.trim() || null,
        uf: row['UF']?.trim() || null,
        valor: parseDecimalBR(row['Valor']),
      })

      total++

      if (batch.length >= BATCH_SIZE) {
        const r = await upsertBatch(supabase, 'cfem_autuacao', batch, ON_CONFLICT)
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
    const r = await upsertBatch(supabase, 'cfem_autuacao', batch, ON_CONFLICT)
    inseridos += r.inserted
    erros += r.errors
  }

  const tempoSeg = Math.round((Date.now() - inicio) / 1000)
  console.log(
    `\nOK Autuação: ${total} processadas, ${inseridos} enviadas em batch, ${pulados} puladas, ${linhasCsvComErro.size} linha(s) de arquivo com CSV inválido ignorada(s), ${erros} erros em ${tempoSeg}s`,
  )

  const { count } = await supabase
    .from('cfem_autuacao')
    .select('*', { count: 'exact', head: true })

  console.log(`=== TOTAL FINAL: ${count ?? '?'} linhas em cfem_autuacao ===`)
})().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
