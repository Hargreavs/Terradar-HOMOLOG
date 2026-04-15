/**
 * Ingestão de eventos regulatórios via Microdados SCM (ANM)
 *
 * Fonte: data/microdados-scm/ProcessoEvento.txt + Evento.txt
 * Uso (raiz do projeto): npx tsx server/scripts/ingest-eventos-microdados.ts
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'

import { supabase } from '../supabase'

const DATA_DIR = path.join(process.cwd(), 'data/microdados-scm')
const BATCH_INSERT = 100
const PAGE_SIZE = 1000
const DELETE_CHUNK = 500

const CATEGORIAS_EVENTO: Record<string, number[]> = {
  PORTARIA_LAVRA: [400, 488, 489, 495, 496, 497, 498, 499],
  LICENCA_AMBIENTAL: [621, 622, 676, 1399, 1400, 1401, 1402],
  PLANO_FECHAMENTO: [1338, 2503, 2504],
  INICIO_LAVRA: [405],
  TAH_PAGAMENTO: [264, 588, 642],
  EXIGENCIA: [3, 27, 131, 250, 350, 470, 550],
  CUMPRIMENTO_EXIGENCIA: [4, 135, 255, 435, 455, 535],
  RAL: [418, 420, 541, 1773],
  ALVARA: [201, 176],
}

function categorizar(idEvento: number): string | null {
  for (const [cat, ids] of Object.entries(CATEGORIAS_EVENTO)) {
    if (ids.includes(idEvento)) return cat
  }
  return null
}

function loadEventos(): Map<number, string> {
  console.log('Carregando Evento.txt...')
  const content = fs.readFileSync(path.join(DATA_DIR, 'Evento.txt'), {
    encoding: 'latin1',
  })
  const map = new Map<number, string>()
  for (const line of content.split('\n')) {
    const parts = line.replace(/\r$/, '').split(';')
    if (parts[0] && !Number.isNaN(Number(parts[0]))) {
      map.set(Number(parts[0]), parts[1]?.trim() || '')
    }
  }
  console.log(`  ${map.size} tipos de evento carregados`)
  return map
}

async function getProcessosConhecidos(): Promise<Set<string>> {
  console.log('Buscando processos no Supabase (paginado)...')
  const set = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('processos')
      .select('numero')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`Erro Supabase: ${error.message}`)
    const rows = data ?? []
    if (rows.length === 0) break
    for (const row of rows) {
      if (row.numero) set.add(String(row.numero))
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  console.log(`  ${set.size} processos encontrados no Supabase`)
  return set
}

interface EventoProcessado {
  processo_numero: string
  evento_codigo: number
  evento_descricao: string
  evento_categoria: string | null
  data_evento: string
  observacao: string
  publicacao_dou: string
}

async function streamEventos(
  processosConhecidos: Set<string>,
  eventosLookup: Map<number, string>,
): Promise<Map<string, EventoProcessado[]>> {
  console.log('Processando ProcessoEvento.txt (streaming)...')

  const eventosPorProcesso = new Map<string, EventoProcessado[]>()
  const filePath = path.join(DATA_DIR, 'ProcessoEvento.txt')

  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let lineCount = 0
  let matchCount = 0
  let isHeader = true

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue
    }
    lineCount++

    if (lineCount % 1_000_000 === 0) {
      console.log(
        `  ${(lineCount / 1_000_000).toFixed(0)}M linhas lidas, ${matchCount} eventos capturados`,
      )
    }

    const parts = line.replace(/\r$/, '').split(';')
    const dsProcesso = parts[0]
    if (!dsProcesso || !processosConhecidos.has(dsProcesso)) continue

    const idEvento = Number(parts[1])
    const dtEvento = parts[2] || ''
    const obEvento = parts[3] || ''
    const dsPubDOU = parts[4] || ''

    if (!dtEvento || Number.isNaN(idEvento)) continue

    const evento: EventoProcessado = {
      processo_numero: dsProcesso,
      evento_codigo: idEvento,
      evento_descricao: eventosLookup.get(idEvento) || `Evento ${idEvento}`,
      evento_categoria: categorizar(idEvento),
      data_evento: dtEvento.split(' ')[0] ?? dtEvento,
      observacao: obEvento.trim().substring(0, 500),
      publicacao_dou: dsPubDOU.trim().substring(0, 300),
    }

    if (!eventosPorProcesso.has(dsProcesso)) {
      eventosPorProcesso.set(dsProcesso, [])
    }
    eventosPorProcesso.get(dsProcesso)!.push(evento)
    matchCount++
  }

  console.log(
    `  Streaming completo: ${lineCount} linhas, ${matchCount} eventos capturados`,
  )
  return eventosPorProcesso
}

async function inserirEventos(eventosPorProcesso: Map<string, EventoProcessado[]>) {
  const numeros = [...eventosPorProcesso.keys()]
  console.log(`Removendo eventos antigos (${numeros.length} processos)...`)
  for (let i = 0; i < numeros.length; i += DELETE_CHUNK) {
    const chunk = numeros.slice(i, i + DELETE_CHUNK)
    const { error } = await supabase
      .from('processo_eventos')
      .delete()
      .in('processo_numero', chunk)
    if (error) console.error(`  Erro delete: ${error.message}`)
  }

  let total = 0
  let procIdx = 0
  for (const [numero, eventos] of eventosPorProcesso) {
    procIdx++
    eventos.sort((a, b) => a.data_evento.localeCompare(b.data_evento))

    for (let i = 0; i < eventos.length; i += BATCH_INSERT) {
      const batch = eventos.slice(i, i + BATCH_INSERT).map((e) => ({
        processo_numero: e.processo_numero,
        evento_codigo: e.evento_codigo,
        evento_descricao: e.evento_descricao,
        evento_categoria: e.evento_categoria,
        data_evento: e.data_evento,
        observacao: e.observacao || null,
        publicacao_dou: e.publicacao_dou || null,
      }))

      const { error } = await supabase.from('processo_eventos').insert(batch)

      if (error) {
        console.error(`  Erro inserindo batch para ${numero}: ${error.message}`)
      }
    }

    total += eventos.length
    if (procIdx <= 5 || procIdx % 500 === 0) {
      console.log(`  ${numero}: ${eventos.length} eventos inseridos`)
    }
  }
  console.log(`Total: ${total} eventos inseridos`)
}

async function computarDerivados(
  eventosPorProcesso: Map<string, EventoProcessado[]>,
) {
  console.log('\nComputando campos derivados...')

  let idx = 0
  for (const [numero, eventos] of eventosPorProcesso) {
    idx++
    const sorted = [...eventos].sort((a, b) =>
      a.data_evento.localeCompare(b.data_evento),
    )
    const ultimo = sorted[sorted.length - 1]

    const porCategoria = (cat: string) => {
      const matches = sorted.filter((e) => e.evento_categoria === cat)
      return matches.length > 0 ? matches[matches.length - 1] : null
    }

    const portaria = porCategoria('PORTARIA_LAVRA')
    const licenca = porCategoria('LICENCA_AMBIENTAL')
    const inicio = porCategoria('INICIO_LAVRA')
    const fechamento = porCategoria('PLANO_FECHAMENTO')
    const tah = porCategoria('TAH_PAGAMENTO')
    const ral = porCategoria('RAL')

    const exigencias = sorted.filter((e) => e.evento_categoria === 'EXIGENCIA')
    const cumprimentos = sorted.filter(
      (e) => e.evento_categoria === 'CUMPRIMENTO_EXIGENCIA',
    )
    const ultimaExigencia =
      exigencias.length > 0 ? exigencias[exigencias.length - 1] : null
    const ultimoCumprimento =
      cumprimentos.length > 0 ? cumprimentos[cumprimentos.length - 1] : null
    const exigenciaPendente = Boolean(
      ultimaExigencia &&
        (!ultimoCumprimento ||
          ultimoCumprimento.data_evento < ultimaExigencia.data_evento),
    )

    const anoMatch = numero.match(/\/(\d{4})$/)
    const anoProtocolo = anoMatch ? Number(anoMatch[1]) : null

    const update: Record<string, unknown> = {
      ultimo_evento_data: ultimo?.data_evento || null,
      ultimo_evento_descricao: ultimo?.evento_descricao || null,
      ultimo_evento_codigo: ultimo?.evento_codigo ?? null,
      portaria_lavra_data: portaria?.data_evento || null,
      portaria_lavra_dou:
        portaria?.publicacao_dou || portaria?.observacao || null,
      licenca_ambiental_data: licenca?.data_evento || null,
      inicio_lavra_data: inicio?.data_evento || null,
      plano_fechamento_data: fechamento?.data_evento || null,
      tah_ultimo_pagamento: tah?.data_evento || null,
      ral_ultimo_data: ral?.data_evento || null,
      exigencia_pendente: exigenciaPendente,
      total_eventos: eventos.length,
      ano_protocolo: anoProtocolo,
    }

    const { error } = await supabase
      .from('processos')
      .update(update)
      .eq('numero', numero)

    if (error) {
      console.error(`  Erro atualizando ${numero}: ${error.message}`)
    } else if (idx <= 5) {
      console.log(`  ${numero}: ${eventos.length} eventos | último ${update.ultimo_evento_data}`)
    }
  }
}

async function main() {
  console.log('=== Ingestão de Eventos Regulatórios (Microdados SCM, TERRADAR) ===\n')

  for (const arq of ['ProcessoEvento.txt', 'Evento.txt']) {
    if (!fs.existsSync(path.join(DATA_DIR, arq))) {
      console.error(`ERRO: ${arq} não encontrado em ${DATA_DIR}`)
      process.exit(1)
    }
  }

  const eventosLookup = loadEventos()
  const processosConhecidos = await getProcessosConhecidos()

  if (processosConhecidos.size === 0) {
    console.log('Nenhum processo no Supabase. Nada a fazer.')
    return
  }

  const eventosPorProcesso = await streamEventos(
    processosConhecidos,
    eventosLookup,
  )

  if (eventosPorProcesso.size === 0) {
    console.log('Nenhum evento encontrado para os processos do Supabase.')
    return
  }

  await inserirEventos(eventosPorProcesso)
  await computarDerivados(eventosPorProcesso)

  console.log('\n=== Verificação (amostra) ===')
  const amostra = ['860.232/1990', '864.231/2017'].filter((n) =>
    processosConhecidos.has(n),
  )
  if (amostra.length > 0) {
    const { data } = await supabase
      .from('processos')
      .select(
        'numero, ultimo_evento_data, ultimo_evento_descricao, portaria_lavra_data, total_eventos, exigencia_pendente',
      )
      .in('numero', amostra)

    if (data) {
      for (const p of data) {
        console.log(
          `  ${p.numero}: ${p.total_eventos} eventos | Último: ${p.ultimo_evento_data} | Portaria: ${p.portaria_lavra_data} | Exigência pendente: ${p.exigencia_pendente}`,
        )
      }
    }
  }
}

main().catch(console.error)
