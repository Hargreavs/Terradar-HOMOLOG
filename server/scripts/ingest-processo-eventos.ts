/**
 * Ingestao em massa: Microdados SCM ProcessoEvento.txt (~1 GB, 10-15M linhas).
 * Estrategia: streaming Latin-1 para UTF-8, append-dedup via upsert ignoreDuplicates.
 * TERRADAR - nao executar em CI; uso local/overnight.
 */
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import { parse } from 'csv-parse'
import iconv from 'iconv-lite'

import { supabase } from '../supabase'
import {
  parseDataISO,
  upsertBatch,
  criarStreamLimpezaAspas,
} from './lib/csv-utils'

const ARQUIVO = path.join(
  process.cwd(),
  'data',
  'microdados-scm',
  'ProcessoEvento.txt',
)
const BATCH_SIZE = 2000
const ON_CONFLICT = 'processo_numero,evento_codigo,data_evento'
const LOG_A_CADA = 50000
const OBS_MAX = 12000
const DOU_MAX = 500

;(async () => {
  if (!existsSync(ARQUIVO)) {
    console.error('ARQUIVO NAO ENCONTRADO:', ARQUIVO)
    process.exit(1)
  }

  console.log('=== INGESTAO ProcessoEvento.txt ===')
  console.log('Estrategia: append-dedup (onConflict DO NOTHING)')
  console.log('Estimativa: 10-15M linhas, ~30-45 min\n')

  const inicio = Date.now()
  const batch: Record<string, unknown>[] = []
  let total = 0
  let inseridos = 0
  let pulados = 0
  let erros = 0

  const stream = createReadStream(ARQUIVO)
    .pipe(iconv.decodeStream('latin1'))
    .pipe(criarStreamLimpezaAspas())
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
        quote: '"',
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      }),
    )

  try {
    for await (const row of stream) {
      try {
        const r = row as Record<string, string | undefined>
        const processoNum = r.DSProcesso?.trim()
        const eventoCodigo = parseInt(String(r.IDEvento ?? ''), 10)
        const dataRaw = parseDataISO(r.DTEvento)
        const dataEvento =
          dataRaw != null && dataRaw.length >= 10 ? dataRaw.slice(0, 10) : null

        if (!processoNum || !Number.isFinite(eventoCodigo) || !dataEvento) {
          pulados++
          continue
        }
        if (eventoCodigo === 0) {
          pulados++
          continue
        }

        if (!/^\d{3}\.\d{3}\/\d{4}$/.test(processoNum)) {
          pulados++
          continue
        }

        const obs = r.OBEvento?.trim() || null
        const dou = r.DSPublicacaoDOU?.trim() || null

        batch.push({
          processo_numero: processoNum,
          evento_codigo: eventoCodigo,
          data_evento: dataEvento,
          observacao: obs
            ? obs.length > OBS_MAX
              ? obs.slice(0, OBS_MAX)
              : obs
            : null,
          publicacao_dou: dou
            ? dou.length > DOU_MAX
              ? dou.slice(0, DOU_MAX)
              : dou
            : null,
          evento_descricao: null,
          evento_categoria: null,
        })

        total++

        if (batch.length >= BATCH_SIZE) {
          const res = await upsertBatch(
            supabase,
            'processo_eventos',
            batch,
            ON_CONFLICT,
          )
          inseridos += res.inserted
          erros += res.errors
          batch.length = 0
          if (total % LOG_A_CADA === 0) {
            const elapsed = (Date.now() - inicio) / 1000
            const taxa = elapsed > 0 ? Math.round(total / elapsed) : 0
            const restante = Math.max(0, 15000000 - total)
            const etaMin = taxa > 0 ? Math.round(restante / taxa / 60) : 0
            console.log(
              `  ${total.toLocaleString('pt-BR')} processadas · ${taxa}/s · ETA ~${etaMin} min · ${pulados.toLocaleString('pt-BR')} puladas`,
            )
          }
        }
      } catch (e: unknown) {
        erros++
        if (erros < 10) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error('  Erro:', msg)
        }
      }
    }

    if (batch.length > 0) {
      const res = await upsertBatch(
        supabase,
        'processo_eventos',
        batch,
        ON_CONFLICT,
      )
      inseridos += res.inserted
      erros += res.errors
    }

    const tempoMin = Math.round((Date.now() - inicio) / 60000)
    console.log('\n=== FINALIZADO ===')
    console.log(
      'Processadas (validas enfileiradas):',
      total.toLocaleString('pt-BR'),
    )
    console.log('Lotes enviados (linhas):', inseridos.toLocaleString('pt-BR'))
    console.log('Puladas:', pulados.toLocaleString('pt-BR'))
    console.log('Erros:', erros)
    console.log('Tempo:', tempoMin, 'minutos')

    const { count } = await supabase
      .from('processo_eventos')
      .select('*', { count: 'exact', head: true })
    console.log(
      '\nTotal em processo_eventos agora:',
      count != null ? count.toLocaleString('pt-BR') : 'N/D',
      'linhas',
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Falha fatal:', msg)
    process.exit(1)
  }
})()
