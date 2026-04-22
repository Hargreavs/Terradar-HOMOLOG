/**
 * Fase B: ingere processos SCM (Processo.txt) com BTAtivo=S e fases alvo,
 * depois eventos (ProcessoEvento.txt) só para numeros inseridos nesta execução.
 *
 * Executar DEPOIS de ingest-disponibilidade-sigmine.ts
 *
 * Uso:
 *   npx tsx server/scripts/ingest-requerimentos-microdados.ts [--dry-run] [--limit N] [--numero X] [--skip-eventos] [--microdados-path dir]
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { spawn } from 'node:child_process'

import dotenv from 'dotenv'
import { Pool, type PoolClient } from 'pg'

import { categorizarEventoScm } from './utils/evento-categorias-scm'
import { familiaFromSubstancia } from './utils/substancia-map'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const DATABASE_URL = process.env.DATABASE_URL
const SUBS_FALLBACK = 'SUBSTÂNCIA NÃO ESPECIFICADA'

const ALVO_FASES = new Set([0, 1, 5, 8, 11, 13, 14, 15])

const regimePorFase: Record<number, string> = {
  0: 'reconhecimento_geologico',
  1: 'requerimento_pesquisa',
  5: 'req_plg',
  8: 'disponibilidade',
  11: 'req_registro_extracao',
  13: 'requerimento_licenciamento',
  14: 'direito_requerer_lavra',
  15: 'apto_disponibilidade',
}

function parseArgs(): {
  dryRun: boolean
  limit: number | null
  numero: string | null
  skipEventos: boolean
  dataDir: string
} {
  let dryRun = false
  let limit: number | null = null
  let numero: string | null = null
  let skipEventos = false
  let dataDir = path.join(ROOT, 'data', 'microdados-scm')
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--skip-eventos') skipEventos = true
    else if (a === '--limit' && process.argv[i + 1])
      limit = Math.max(0, parseInt(process.argv[++i], 10) || 0)
    else if (a.startsWith('--limit='))
      limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0)
    else if (a === '--numero' && process.argv[i + 1]) numero = process.argv[++i].trim()
    else if (a.startsWith('--numero=')) numero = a.slice('--numero='.length).trim()
    else if (a === '--microdados-path' && process.argv[i + 1])
      dataDir = process.argv[++i]
  }
  return { dryRun, limit, numero, skipEventos, dataDir }
}

function anoProtocoloFromParts(parts: string[]): number | null {
  const dt = parts[9]?.trim()
  if (dt && dt.length >= 4) {
    const y = parseInt(dt.slice(0, 4), 10)
    if (y >= 1900 && y <= 2100) return y
  }
  const nr = parseInt(parts[2] ?? '', 10)
  if (Number.isFinite(nr) && nr >= 1900 && nr <= 2100) return nr
  return null
}

function loadSmallMapsLatin1(dir: string): {
  faseDesc: Map<number, string>
  substanciaNome: Map<number, string>
  municipio: Map<string, { nome: string; uf: string }>
  eventoDesc: Map<number, string>
} {
  const readAll = (name: string): string =>
    fs.readFileSync(path.join(dir, name), { encoding: 'latin1' })

  const faseDesc = new Map<number, string>()
  for (const line of readAll('FaseProcesso.txt').split(/\r?\n/)) {
    if (!line.trim()) continue
    const p = line.split(';')
    const id = parseInt(p[0] ?? '', 10)
    if (Number.isNaN(id)) continue
    faseDesc.set(id, (p[1] ?? '').trim() || `Fase ${id}`)
  }

  const substanciaNome = new Map<number, string>()
  for (const line of readAll('Substancia.txt').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const p = line.split(';')
    const id = parseInt(p[0] ?? '', 10)
    if (Number.isNaN(id)) continue
    substanciaNome.set(id, (p[1] ?? '').trim() || `Substância ${id}`)
  }

  const municipio = new Map<string, { nome: string; uf: string }>()
  for (const line of readAll('Municipio.txt').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const p = line.split(';')
    const id = (p[0] ?? '').trim()
    if (!id) continue
    municipio.set(id, {
      nome: (p[1] ?? '').trim(),
      uf: (p[2] ?? '').trim().slice(0, 2),
    })
  }

  const eventoDesc = new Map<number, string>()
  for (const line of readAll('Evento.txt').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const p = line.split(';')
    const id = parseInt(p[0] ?? '', 10)
    if (Number.isNaN(id)) continue
    eventoDesc.set(id, (p[1] ?? '').trim() || `Evento ${id}`)
  }

  return { faseDesc, substanciaNome, municipio, eventoDesc }
}

async function loadMasterFamilias(
  client: PoolClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { rows } = await client.query(
    `SELECT substancia_anm, familia FROM master_substancias WHERE substancia_anm IS NOT NULL`,
  )
  for (const r of rows) {
    const k = String(r.substancia_anm).trim()
    if (k) map.set(k, String(r.familia ?? '').trim())
  }
  return map
}

/** Passo 1: numeros-alvo (filtro BTAtivo + fase). */
async function coletarAlvos(
  processoPath: string,
  numeroOne: string | null,
): Promise<Set<string>> {
  const alvos = new Set<string>()
  const rl = readline.createInterface({
    input: fs.createReadStream(processoPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    if (!ds) continue
    if (numeroOne && ds !== numeroOne) continue
    if (parts[3]?.trim() !== 'S') continue
    const idFase = parseInt(parts[6] ?? '', 10)
    if (!ALVO_FASES.has(idFase)) continue
    alvos.add(ds)
  }
  return alvos
}

async function preencheProcessoMunicipio(
  filePath: string,
  alvos: Set<string>,
): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    if (!ds || !alvos.has(ds)) continue
    const ibge = (parts[1] ?? '').trim()
    if (ibge && !m.has(ds)) m.set(ds, ibge)
  }
  return m
}

async function preencheProcessoSubstancia(
  filePath: string,
  alvos: Set<string>,
): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    if (!ds || !alvos.has(ds)) continue
    if (m.has(ds)) continue
    const idSub = parseInt(parts[1] ?? '', 10)
    if (!Number.isNaN(idSub)) m.set(ds, idSub)
  }
  return m
}

async function preencheTitularPessoa(
  filePath: string,
  alvos: Set<string>,
): Promise<Map<string, number>> {
  /** DSProcesso -> IDPessoa (Titular = tipo 1). */
  const m = new Map<string, number>()
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    if (!ds || !alvos.has(ds)) continue
    const idTipo = parseInt(parts[2] ?? '', 10)
    if (idTipo !== 1) continue
    if (m.has(ds)) continue
    const idP = parseInt(parts[1] ?? '', 10)
    if (!Number.isNaN(idP)) m.set(ds, idP)
  }
  return m
}

function loadPessoas(
  pessoaPath: string,
  ids: Set<number>,
): Map<number, { nome: string; cnpj: string | null }> {
  const m = new Map<number, { nome: string; cnpj: string | null }>()
  const content = fs.readFileSync(pessoaPath, { encoding: 'latin1' })
  for (const line of content.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const p = line.split(';')
    const id = parseInt(p[0] ?? '', 10)
    if (Number.isNaN(id) || !ids.has(id)) continue
    const cnpj = (p[1] ?? '').replace(/\*/g, '').trim() || null
    const nome = (p[3] ?? '').trim()
    m.set(id, { nome, cnpj })
  }
  return m
}

type RowIn = {
  numero: string
  titular: string | null
  cnpj: string | null
  substancia: string
  substancia_familia: string | null
  regime: string
  fase: string
  area_ha: number | null
  municipio: string | null
  municipio_ibge: string | null
  uf: string | null
  ano_protocolo: number | null
}

async function flushProcessos(
  client: PoolClient | null,
  dryRun: boolean,
  batch: RowIn[],
): Promise<{ numeros: string[]; byRegime: Map<string, number> }> {
  const empty = { numeros: [] as string[], byRegime: new Map<string, number>() }
  if (batch.length === 0) return empty
  if (dryRun) {
    for (const r of batch.slice(0, 3)) console.log(`[dry-run insert] ${r.numero} ${r.regime}`)
    const byRegime = new Map<string, number>()
    for (const r of batch) {
      byRegime.set(r.regime, (byRegime.get(r.regime) ?? 0) + 1)
    }
    return { numeros: batch.map((r) => r.numero), byRegime }
  }
  const flat: unknown[] = []
  let i = 1
  const placeholders: string[] = []
  for (const r of batch) {
    placeholders.push(
      `($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},now())`,
    )
    flat.push(
      r.numero,
      r.titular,
      r.cnpj,
      r.substancia,
      r.substancia_familia,
      r.regime,
      r.fase,
      r.area_ha,
      r.municipio,
      r.municipio_ibge,
      r.uf,
      r.ano_protocolo,
    )
  }
  const q = `
    INSERT INTO processos (
      numero, titular, cnpj, substancia, substancia_familia, regime, fase,
      area_ha, municipio, municipio_ibge, uf, ano_protocolo, updated_at
    ) VALUES ${placeholders.join(',')}
    ON CONFLICT (numero) DO NOTHING
    RETURNING numero
  `
  const res = await client!.query(q, flat)
  const numeros = res.rows.map((row: { numero: string }) => String(row.numero))
  const byNum = new Map(batch.map((r) => [r.numero, r.regime]))
  const byRegime = new Map<string, number>()
  for (const n of numeros) {
    const reg = byNum.get(n)
    if (reg) byRegime.set(reg, (byRegime.get(reg) ?? 0) + 1)
  }
  return { numeros, byRegime }
}

async function streamInserts(
  processoPath: string,
  maps: ReturnType<typeof loadSmallMapsLatin1> & {
    procMun: Map<string, string>
    procSub: Map<string, number>
    procPessoa: Map<string, number>
    pessoas: Map<number, { nome: string; cnpj: string | null }>
    master: Map<string, string>
  },
  alvos: Set<string>,
  client: PoolClient | null,
  dryRun: boolean,
  limit: number | null,
  numeroOne: string | null,
): Promise<{
  inserted: string[]
  linesRead: number
  linesAccepted: number
  insertedByRegime: Map<string, number>
  /** Todos os numeros que passaram no filtro (para ProcessoEvento.txt); inclui ON CONFLICT skip. */
  numerosAlvoEventos: Set<string>
}> {
  const inserted: string[] = []
  const insertedByRegime = new Map<string, number>()
  const numerosAlvoEventos = new Set<string>()
  let batch: RowIn[] = []
  const BATCH = 1000
  let accepted = 0
  let linesRead = 0

  const mergeRegime = (m: Map<string, number>) => {
    for (const [k, v] of m) {
      insertedByRegime.set(k, (insertedByRegime.get(k) ?? 0) + v)
    }
  }

  const flush = async () => {
    const ret = await flushProcessos(client, dryRun, batch)
    inserted.push(...ret.numeros)
    mergeRegime(ret.byRegime)
    batch = []
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(processoPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true

  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    linesRead++
    if (limit != null && accepted >= limit) break

    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    if (!ds) continue
    if (numeroOne && ds !== numeroOne) continue
    if (parts[3]?.trim() !== 'S') continue
    const idFase = parseInt(parts[6] ?? '', 10)
    if (!ALVO_FASES.has(idFase)) continue
    if (!alvos.has(ds)) continue

    const regime = regimePorFase[idFase]
    if (!regime) continue

    const faseStr =
      maps.faseDesc.get(idFase) ?? `Fase ${idFase}`

    const areaRaw = (parts[11] ?? '0').replace(',', '.').trim()
    const areaHa = parseFloat(areaRaw)
    const area = Number.isFinite(areaHa) ? areaHa : null

    const idSub = maps.procSub.get(ds)
    let substancia = SUBS_FALLBACK
    if (idSub != null) {
      substancia = maps.substanciaNome.get(idSub) ?? SUBS_FALLBACK
    }
    const familia =
      maps.master.get(substancia) ?? familiaFromSubstancia(substancia) ?? null

    const ibge = maps.procMun.get(ds) ?? null
    let municipio: string | null = null
    let uf: string | null = null
    if (ibge) {
      const mm = maps.municipio.get(ibge)
      if (mm) {
        municipio = mm.nome || null
        uf = mm.uf || null
      }
    }

    const idPessoa = maps.procPessoa.get(ds)
    let titular: string | null = null
    let cnpj: string | null = null
    if (idPessoa != null) {
      const pe = maps.pessoas.get(idPessoa)
      if (pe) {
        titular = pe.nome || null
        cnpj = pe.cnpj
      }
    }

    const ano = anoProtocoloFromParts(parts)

    numerosAlvoEventos.add(ds)
    batch.push({
      numero: ds,
      titular,
      cnpj,
      substancia,
      substancia_familia: familia,
      regime,
      fase: faseStr,
      area_ha: area,
      municipio,
      municipio_ibge: ibge,
      uf,
      ano_protocolo: ano,
    })
    accepted++

    if (batch.length >= BATCH) await flush()
  }

  if (batch.length) await flush()

  return {
    inserted,
    linesRead,
    linesAccepted: accepted,
    insertedByRegime,
    numerosAlvoEventos,
  }
}

async function ingestEventos(
  client: PoolClient | null,
  dryRun: boolean,
  dataDir: string,
  numeros: Set<string>,
  eventoDesc: Map<number, string>,
): Promise<{ candidatos: number; inseridos: number }> {
  if (numeros.size === 0) return { candidatos: 0, inseridos: 0 }
  const pathEv = path.join(dataDir, 'ProcessoEvento.txt')
  let buf: {
    processo_numero: string
    evento_codigo: number
    evento_descricao: string
    data_evento: string
    observacao: string
    publicacao_dou: string
    evento_categoria: string | null
  }[] = []
  const CHUNK = 2000
  let candidatos = 0
  let inseridos = 0

  const flushEv = async () => {
    if (buf.length === 0) return
    if (dryRun) {
      candidatos += buf.length
      inseridos += buf.length
      buf = []
      return
    }
    const flat: unknown[] = []
    const valueRows: string[] = []
    let p = 1
    for (const e of buf) {
      valueRows.push(
        `($${p++}::text, $${p++}::int, $${p++}::text, $${p++}::date, $${p++}::text, $${p++}::text, $${p++}::text)`,
      )
      flat.push(
        e.processo_numero,
        e.evento_codigo,
        e.evento_descricao,
        e.data_evento,
        e.observacao,
        e.publicacao_dou,
        e.evento_categoria,
      )
    }
    candidatos += buf.length
    const res = await client!.query(
      `
      INSERT INTO processo_eventos (
        processo_numero, evento_codigo, evento_descricao, data_evento,
        observacao, publicacao_dou, evento_categoria
      )
      SELECT v.processo_numero, v.evento_codigo, v.evento_descricao, v.data_evento,
             v.observacao, v.publicacao_dou, v.evento_categoria
      FROM (VALUES ${valueRows.join(',')}) AS v(
        processo_numero, evento_codigo, evento_descricao, data_evento,
        observacao, publicacao_dou, evento_categoria
      )
      ON CONFLICT (processo_numero, evento_codigo, data_evento) DO NOTHING
    `,
      flat,
    )
    inseridos += res.rowCount ?? 0
    buf = []
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(pathEv, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let header = true
  let lineNo = 0
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    lineNo++
    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    if (!ds || !numeros.has(ds)) continue
    const idEvento = parseInt(parts[1] ?? '', 10)
    const dtRaw = parts[2] ?? ''
    if (!dtRaw || Number.isNaN(idEvento)) continue
    const data_evento = dtRaw.split(' ')[0] ?? dtRaw
    const observacao = (parts[3] ?? '').trim().substring(0, 500)
    const publicacao_dou = (parts[4] ?? '').trim().substring(0, 300)
    const evento_descricao =
      eventoDesc.get(idEvento) ?? `Evento ${idEvento}`
    buf.push({
      processo_numero: ds,
      evento_codigo: idEvento,
      evento_descricao,
      data_evento,
      observacao,
      publicacao_dou,
      evento_categoria: categorizarEventoScm(idEvento),
    })
    if (buf.length >= CHUNK) await flushEv()
    if (lineNo % 2_000_000 === 0)
      console.error(`[eventos] ${(lineNo / 1e6).toFixed(1)}M linhas…`)
  }
  await flushEv()
  return { candidatos, inseridos }
}

function runDerivar(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['tsx', 'server/scripts/derivar-campos-regulatorios.ts', '--only-null'],
      { cwd: ROOT, stdio: 'inherit', shell: true, env: process.env },
    )
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(
            `derivar-campos-regulatorios exit ${code}${signal ? ` (${signal})` : ''}`,
          ),
        )
    })
  })
}

async function main() {
  const wall0 = Date.now()
  const { dryRun, limit, numero, skipEventos, dataDir } = parseArgs()
  const processoPath = path.join(dataDir, 'Processo.txt')
  if (!fs.existsSync(processoPath)) {
    console.error(`Nao encontrado: ${processoPath}`)
    process.exit(1)
  }

  if (!DATABASE_URL && !dryRun) {
    console.error('DATABASE_URL ausente')
    process.exit(1)
  }

  console.error('[scm] Carregando lookups pequenos…')
  const maps = loadSmallMapsLatin1(dataDir)

  console.error('[scm] Coletando alvos (Processo.txt)…')
  const alvos = await coletarAlvos(processoPath, numero)
  console.error(`[scm] alvos: ${alvos.size}`)

  if (alvos.size === 0) {
    console.log('[scm] Nada a fazer.')
    return
  }

  console.error('[scm] ProcessoMunicipio / Substancia / Pessoa (filtrado)…')
  const procMun = await preencheProcessoMunicipio(
    path.join(dataDir, 'ProcessoMunicipio.txt'),
    alvos,
  )
  const procSub = await preencheProcessoSubstancia(
    path.join(dataDir, 'ProcessoSubstancia.txt'),
    alvos,
  )
  const procPessoa = await preencheTitularPessoa(
    path.join(dataDir, 'ProcessoPessoa.txt'),
    alvos,
  )
  const idsPessoa = new Set(procPessoa.values())
  const pessoas = loadPessoas(path.join(dataDir, 'Pessoa.txt'), idsPessoa)
  console.error(`[scm] pessoas carregadas: ${pessoas.size}`)

  const pool = dryRun
    ? null
    : new Pool({
        connectionString: DATABASE_URL!,
        max: 2,
        ssl: DATABASE_URL!.includes('supabase.co')
          ? { rejectUnauthorized: false }
          : undefined,
      })

  let master = new Map<string, string>()
  let client: PoolClient | null = null
  if (!dryRun) {
    client = await pool!.connect()
    await client.query(`SET statement_timeout = '10min'`)
    master = await loadMasterFamilias(client)
    console.error(`[scm] master_substancias: ${master.size}`)
  }

  const merged = {
    ...maps,
    procMun,
    procSub,
    procPessoa,
    pessoas,
    master,
  }

  console.error('[scm] Inserindo processos…')
  const procStats = await streamInserts(
    processoPath,
    merged,
    alvos,
    client,
    dryRun,
    limit,
    numero,
  )
  const numerosInseridos = procStats.inserted

  console.log(
    `[scm] Processo.txt: linhas lidas=${procStats.linesRead}, linhas filtro alvo (BTAtivo+fase)=${procStats.linesAccepted}`,
  )
  console.log(`[scm] processos novos (RETURNING): ${numerosInseridos.length}`)
  const regimeLines = [...procStats.insertedByRegime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([r, c]) => `  ${r}: ${c}`)
    .join('\n')
  console.log(`[scm] INSERTs novos por regime:\n${regimeLines || '  (nenhum)'}`)

  const setEv = procStats.numerosAlvoEventos

  if (!skipEventos && setEv.size > 0) {
    console.error('[scm] Ingerindo eventos…')
    const evStats = await ingestEventos(
      client,
      dryRun,
      dataDir,
      setEv,
      maps.eventoDesc,
    )
    console.log(
      `[scm] eventos: candidatos no stream=${evStats.candidatos}, inseridos (rowCount)=${evStats.inseridos}`,
    )
  }

  if (client) {
    client.release()
    await pool!.end()
  }

  if (!dryRun && procStats.numerosAlvoEventos.size > 0) {
    console.error('[scm] Chamando derivar-campos-regulatorios --only-null…')
    await runDerivar()
  }

  const wallSec = ((Date.now() - wall0) / 1000).toFixed(1)
  console.log(`[scm] wall-clock total: ${wallSec}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
