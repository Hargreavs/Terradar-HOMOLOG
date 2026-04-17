/**
 * Extração cirúrgica dos 13 NUPs da apresentação a partir dos Microdados SCM (ANM).
 *
 * Lê em streaming os 4 arquivos `data/microdados-scm/*.txt` (latin1, CRLF),
 * filtra cedo pelos 13 NUPs de interesse e gera `tmp/update-13-scm.sql`
 * com UPDATEs no `processos` + DELETE/INSERT idempotente no `processo_eventos`.
 *
 * NÃO abre conexão com Supabase. NÃO executa SQL. O SQL gerado deve ser
 * aplicado manualmente em HOMOLOG via Supabase MCP.
 *
 * Uso (raiz do projeto):
 *   npx tsx server/scripts/extract-13-scm-data.ts
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const DATA_DIR = path.join(process.cwd(), 'data', 'microdados-scm')
const OUT_DIR = path.join(process.cwd(), 'tmp')
const OUT_SQL = path.join(OUT_DIR, 'update-13-scm.sql')

const NUPS = [
  '864.016/2026',
  '864.026/2026',
  '871.516/2011',
  '860.890/2022',
  '860.891/2022',
  '860.892/2022',
  '860.893/2022',
  '860.894/2022',
  '860.895/2022',
  '860.896/2022',
  '860.897/2022',
  '860.898/2022',
  '860.900/2022',
] as const
const SET_NUPS = new Set<string>(NUPS)

const NUP_PRESERVA_EVENTOS = '871.516/2011'

const REQUIRED_FILES = [
  'Processo.txt',
  'Pessoa.txt',
  'ProcessoPessoa.txt',
  'ProcessoEvento.txt',
  'FaseProcesso.txt',
  'Evento.txt',
] as const

interface ProcessoBasico {
  numero: string
  nrnup: string
  idFase: number
  dsFase: string
  dataPrioridade: string
}

interface Titular {
  cnpjCpf: string
  nome: string
  tpPessoa: string
}

interface Evento {
  idEvento: number
  dtEvento: string
  observacao: string
  publicacaoDou: string
  descricao: string
  categoria: string | null
}

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

function ensureFiles(): void {
  for (const f of REQUIRED_FILES) {
    const p = path.join(DATA_DIR, f)
    if (!fs.existsSync(p)) {
      throw new Error(`Arquivo obrigatório ausente: ${p}`)
    }
  }
}

/** Splitter conservador: garante que campos extras com ';' sejam absorvidos
 *  na coluna apropriada. Para arquivos onde o último campo é "livre" (DOU),
 *  usar `lastFieldFree=true` para preservar tudo após o N-ésimo separador
 *  na coluna anterior à última. */
function splitFixed(
  line: string,
  expectedCols: number,
  trailingFieldIdx?: number,
): string[] {
  const parts = line.split(';')
  if (parts.length === expectedCols) return parts
  if (parts.length < expectedCols) {
    while (parts.length < expectedCols) parts.push('')
    return parts
  }
  // Excesso: junta no campo intermediário sinalizado, ou trunca
  if (typeof trailingFieldIdx === 'number') {
    const out = parts.slice(0, trailingFieldIdx)
    const merged = parts
      .slice(trailingFieldIdx, parts.length - (expectedCols - 1 - trailingFieldIdx))
      .join(';')
    out.push(merged)
    out.push(...parts.slice(parts.length - (expectedCols - 1 - trailingFieldIdx)))
    return out
  }
  return parts.slice(0, expectedCols)
}

function loadFases(): Map<number, string> {
  const content = fs.readFileSync(path.join(DATA_DIR, 'FaseProcesso.txt'), {
    encoding: 'latin1',
  })
  const map = new Map<number, string>()
  let isHeader = true
  for (const raw of content.split(/\r?\n/)) {
    if (!raw) continue
    if (isHeader) {
      isHeader = false
      continue
    }
    const [idStr, ds] = raw.split(';')
    const id = Number(idStr)
    if (!Number.isNaN(id)) map.set(id, (ds ?? '').trim())
  }
  return map
}

function loadEventoLookup(): Map<number, string> {
  const content = fs.readFileSync(path.join(DATA_DIR, 'Evento.txt'), {
    encoding: 'latin1',
  })
  const map = new Map<number, string>()
  let isHeader = true
  for (const raw of content.split(/\r?\n/)) {
    if (!raw) continue
    if (isHeader) {
      isHeader = false
      continue
    }
    const idx = raw.indexOf(';')
    if (idx < 0) continue
    const id = Number(raw.slice(0, idx))
    const desc = raw.slice(idx + 1).trim()
    if (!Number.isNaN(id)) map.set(id, desc)
  }
  return map
}

async function streamProcesso(
  fases: Map<number, string>,
): Promise<Map<string, ProcessoBasico>> {
  const out = new Map<string, ProcessoBasico>()
  const filePath = path.join(DATA_DIR, 'Processo.txt')
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let isHeader = true
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue
    }
    if (!line) continue
    // Filtragem barata: o número é o primeiro campo e tem 12 chars
    const sep = line.indexOf(';')
    if (sep !== 12) continue
    const numero = line.slice(0, sep)
    if (!SET_NUPS.has(numero)) continue
    const cols = splitFixed(line, 12)
    const nrnup = (cols[4] ?? '').trim()
    const idFase = Number(cols[6] ?? '')
    const dtPrioridade = (cols[10] ?? '').trim().slice(0, 10)
    out.set(numero, {
      numero,
      nrnup,
      idFase: Number.isNaN(idFase) ? -1 : idFase,
      dsFase: fases.get(idFase) ?? '',
      dataPrioridade: dtPrioridade,
    })
    if (out.size === SET_NUPS.size) break
  }
  rl.close()
  return out
}

async function streamProcessoPessoa(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const filePath = path.join(DATA_DIR, 'ProcessoPessoa.txt')
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let isHeader = true
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue
    }
    if (!line) continue
    const sep = line.indexOf(';')
    if (sep !== 12) continue
    const numero = line.slice(0, sep)
    if (!SET_NUPS.has(numero)) continue
    const cols = splitFixed(line, 8)
    const idPessoa = Number(cols[1] ?? '')
    const idRelacao = Number(cols[2] ?? '')
    const dtFim = (cols[7] ?? '').trim()
    if (Number.isNaN(idPessoa) || idRelacao !== 1) continue
    if (dtFim !== '') continue
    out.set(numero, idPessoa)
  }
  rl.close()
  return out
}

async function streamPessoa(
  idsAlvo: Set<number>,
): Promise<Map<number, Titular>> {
  const out = new Map<number, Titular>()
  if (idsAlvo.size === 0) return out
  const filePath = path.join(DATA_DIR, 'Pessoa.txt')
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let isHeader = true
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue
    }
    if (!line) continue
    const sep = line.indexOf(';')
    if (sep <= 0) continue
    const id = Number(line.slice(0, sep))
    if (Number.isNaN(id) || !idsAlvo.has(id)) continue
    const cols = splitFixed(line, 4, 3)
    out.set(id, {
      cnpjCpf: (cols[1] ?? '').trim(),
      tpPessoa: (cols[2] ?? '').trim(),
      nome: (cols[3] ?? '').trim(),
    })
    if (out.size === idsAlvo.size) break
  }
  rl.close()
  return out
}

async function streamEventos(
  eventoLookup: Map<number, string>,
): Promise<Map<string, Evento[]>> {
  const out = new Map<string, Evento[]>()
  for (const n of NUPS) out.set(n, [])
  const filePath = path.join(DATA_DIR, 'ProcessoEvento.txt')
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let isHeader = true
  let lineCount = 0
  let matchCount = 0
  for await (const line of rl) {
    lineCount++
    if (isHeader) {
      isHeader = false
      continue
    }
    if (!line) continue
    const sep = line.indexOf(';')
    if (sep !== 12) continue
    const numero = line.slice(0, sep)
    if (!SET_NUPS.has(numero)) continue
    const cols = splitFixed(line, 5, 3)
    const idEvento = Number(cols[1] ?? '')
    const dt = (cols[2] ?? '').trim().slice(0, 10)
    if (Number.isNaN(idEvento) || !dt) continue
    const observacao = (cols[3] ?? '').trim()
    const dou = (cols[4] ?? '').trim()
    out.get(numero)!.push({
      idEvento,
      dtEvento: dt,
      observacao,
      publicacaoDou: dou,
      descricao: eventoLookup.get(idEvento) ?? '',
      categoria: categorizar(idEvento),
    })
    matchCount++
    if (lineCount % 500_000 === 0) {
      process.stdout.write(
        `  [eventos] ${lineCount.toLocaleString('pt-BR')} linhas lidas, ${matchCount} matches\r`,
      )
    }
  }
  rl.close()
  if (lineCount >= 500_000) process.stdout.write('\n')
  for (const arr of out.values()) {
    arr.sort((a, b) => a.dtEvento.localeCompare(b.dtEvento))
  }
  return out
}

function sqlEsc(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function sqlOrNull(v: string | null | undefined): string {
  if (v == null) return 'NULL'
  const t = v.trim()
  if (t === '') return 'NULL'
  return sqlEsc(t)
}

function sqlPreservativo(novo: string): string {
  // Se o SCM trouxer string vazia, mantém o valor atual no banco.
  // Caso contrário, sobrescreve com o valor oficial.
  const t = novo.trim()
  if (t === '') return null as unknown as string
  return sqlEsc(t)
}

function buildUpdateProcessos(
  basicos: Map<string, ProcessoBasico>,
  pessoaPorNup: Map<string, number>,
  pessoas: Map<number, Titular>,
  eventosPorNup: Map<string, Evento[]>,
): string {
  const out: string[] = []
  for (const numero of NUPS) {
    const b = basicos.get(numero)
    const tit = pessoaPorNup.get(numero)
    const titular = tit != null ? pessoas.get(tit) : undefined
    const eventos = eventosPorNup.get(numero) ?? []
    const ultimo = eventos.length > 0 ? eventos[eventos.length - 1] : undefined

    if (!b) {
      out.push(`-- ${numero}: NÃO ENCONTRADO em Processo.txt (sem UPDATE)`)
      continue
    }

    const sets: string[] = []

    if (titular?.nome) {
      sets.push(`titular = ${sqlEsc(titular.nome)}`)
    }
    if (titular?.cnpjCpf) {
      sets.push(`cnpj = ${sqlEsc(titular.cnpjCpf)}`)
      sets.push(`cnpj_titular = ${sqlEsc(titular.cnpjCpf)}`)
    }
    if (b.nrnup) {
      sets.push(`nup_sei = ${sqlEsc(b.nrnup)}`)
    }
    if (b.dsFase) {
      sets.push(`fase = ${sqlEsc(b.dsFase)}`)
    }
    if (eventos.length > 0 && ultimo) {
      sets.push(`ultimo_evento_data = ${sqlEsc(ultimo.dtEvento)}`)
      sets.push(`ultimo_evento_codigo = ${ultimo.idEvento}`)
      sets.push(
        `ultimo_evento_descricao = ${sqlOrNull(ultimo.descricao || ultimo.observacao || `Evento ${ultimo.idEvento}`)}`,
      )
      sets.push(`total_eventos = ${eventos.length}`)
    }
    sets.push(`updated_at = now()`)

    out.push(
      `-- ${numero} | titular=${titular?.nome ?? 'n/d'} | cnpj=${titular?.cnpjCpf ?? 'n/d'} | eventos=${eventos.length}`,
    )
    out.push(
      `UPDATE processos SET\n  ${sets.join(',\n  ')}\nWHERE numero = '${numero}';`,
    )
    out.push('')
  }
  return out.join('\n')
}

function buildEventosBlock(eventosPorNup: Map<string, Evento[]>): string {
  const out: string[] = []

  // 1) DELETE por NUP, exceto o que deve ser preservado se contagem ≤ 13
  const nupsParaSubstituir: string[] = []
  for (const numero of NUPS) {
    const arr = eventosPorNup.get(numero) ?? []
    if (arr.length === 0) continue
    if (numero === NUP_PRESERVA_EVENTOS && arr.length <= 13) {
      out.push(
        `-- ${numero}: SCM trouxe ${arr.length} evento(s) (≤ 13). Preservando histórico atual no banco.`,
      )
      continue
    }
    nupsParaSubstituir.push(numero)
  }

  if (nupsParaSubstituir.length === 0) {
    out.push('-- Nenhum INSERT em processo_eventos (sem eventos novos).')
    return out.join('\n')
  }

  const inList = nupsParaSubstituir.map((n) => `'${n}'`).join(', ')
  out.push(
    `DELETE FROM processo_eventos WHERE processo_numero IN (${inList});`,
  )
  out.push('')

  // 2) INSERTs em batches de 500
  const BATCH = 500
  type Row = {
    numero: string
    idEvento: number
    descricao: string
    categoria: string | null
    dtEvento: string
    observacao: string
    publicacaoDou: string
  }
  const rows: Row[] = []
  for (const numero of nupsParaSubstituir) {
    const arr = eventosPorNup.get(numero) ?? []
    for (const e of arr) {
      rows.push({
        numero,
        idEvento: e.idEvento,
        descricao: e.descricao,
        categoria: e.categoria,
        dtEvento: e.dtEvento,
        observacao: e.observacao,
        publicacaoDou: e.publicacaoDou,
      })
    }
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const values = slice
      .map(
        (r) =>
          `  (${sqlEsc(r.numero)}, ${r.idEvento}, ${sqlOrNull(r.descricao)}, ${sqlOrNull(r.categoria)}, ${sqlEsc(r.dtEvento)}, ${sqlOrNull(r.observacao)}, ${sqlOrNull(r.publicacaoDou)})`,
      )
      .join(',\n')
    out.push(
      `INSERT INTO processo_eventos\n  (processo_numero, evento_codigo, evento_descricao, evento_categoria, data_evento, observacao, publicacao_dou)\nVALUES\n${values};`,
    )
    out.push('')
  }
  return out.join('\n')
}

function buildSql(
  basicos: Map<string, ProcessoBasico>,
  pessoaPorNup: Map<string, number>,
  pessoas: Map<number, Titular>,
  eventosPorNup: Map<string, Evento[]>,
): string {
  const header = [
    '-- ════════════════════════════════════════════════════════════',
    '-- TERRADAR — Update cirúrgico dos 13 NUPs (Microdados SCM ANM)',
    `-- Gerado em: ${new Date().toISOString()}`,
    '-- Aplique via Supabase MCP (HOMOLOG). NÃO foi executado pelo script.',
    '-- ════════════════════════════════════════════════════════════',
    '',
    'BEGIN;',
    '',
    '-- ────────────────────────────────',
    '-- BLOCO A: UPDATE em `processos`',
    '-- ────────────────────────────────',
    '',
  ]
  const updates = buildUpdateProcessos(
    basicos,
    pessoaPorNup,
    pessoas,
    eventosPorNup,
  )
  const eventosBlock = buildEventosBlock(eventosPorNup)
  const footer = ['', 'COMMIT;', '']
  return [
    header.join('\n'),
    updates,
    '',
    '-- ─────────────────────────────────────────',
    '-- BLOCO B+C: DELETE + INSERT em `processo_eventos`',
    '-- ─────────────────────────────────────────',
    '',
    eventosBlock,
    footer.join('\n'),
  ].join('\n')
}

async function main() {
  console.log('TERRADAR · extração cirúrgica dos 13 NUPs · Microdados SCM ANM')
  console.log('================================================================\n')

  ensureFiles()

  console.log('1/4  Carregando lookups (FaseProcesso, Evento)...')
  const fases = loadFases()
  const eventoLookup = loadEventoLookup()
  console.log(
    `     fases=${fases.size} · eventos(lookup)=${eventoLookup.size}\n`,
  )

  console.log('2/4  Streaming Processo.txt (filtra 13 NUPs)...')
  const basicos = await streamProcesso(fases)
  console.log(`     casados: ${basicos.size}/${NUPS.length}`)
  for (const n of NUPS) {
    if (!basicos.has(n)) console.log(`     MISS: ${n}`)
  }
  console.log()

  console.log('3/4  Streaming ProcessoPessoa.txt + Pessoa.txt...')
  const pessoaPorNup = await streamProcessoPessoa()
  const idsAlvo = new Set(pessoaPorNup.values())
  const pessoas = await streamPessoa(idsAlvo)
  console.log(
    `     ProcessoPessoa: ${pessoaPorNup.size}/${NUPS.length} titulares vigentes encontrados`,
  )
  console.log(
    `     Pessoa: ${pessoas.size}/${idsAlvo.size} cadastros resolvidos\n`,
  )

  console.log('4/4  Streaming ProcessoEvento.txt (1 GB, descarte cedo)...')
  const eventosPorNup = await streamEventos(eventoLookup)
  let totalEventos = 0
  for (const a of eventosPorNup.values()) totalEventos += a.length
  console.log(`     eventos coletados (todos os 13): ${totalEventos}\n`)

  console.log('Resumo por NUP')
  console.log('--------------')
  for (const numero of NUPS) {
    const b = basicos.get(numero)
    const idP = pessoaPorNup.get(numero)
    const tit = idP != null ? pessoas.get(idP) : undefined
    const evs = eventosPorNup.get(numero) ?? []
    const cnpj = tit?.cnpjCpf ?? '—'
    const titular = (tit?.nome ?? '—').slice(0, 50)
    const nrnup = b?.nrnup ?? '—'
    const fase = b?.dsFase ?? '—'
    console.log(
      `  ${numero} · ${cnpj.padEnd(20)} · ${titular.padEnd(50)} · NUP ${nrnup} · fase=${fase} · #ev=${evs.length}`,
    )
  }
  console.log()

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const sql = buildSql(basicos, pessoaPorNup, pessoas, eventosPorNup)
  fs.writeFileSync(OUT_SQL, sql, { encoding: 'utf8' })
  const stat = fs.statSync(OUT_SQL)
  const linhas = sql.split('\n').length

  console.log(`SQL gerado: ${OUT_SQL}`)
  console.log(
    `  tamanho: ${stat.size.toLocaleString('pt-BR')} bytes · ${linhas.toLocaleString('pt-BR')} linhas`,
  )
  console.log()
  console.log(
    '⚠  SQL NÃO foi executado. Aplique em HOMOLOG via Supabase MCP.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
