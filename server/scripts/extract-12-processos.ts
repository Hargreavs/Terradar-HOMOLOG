/**
 * Extrai cadastro + eventos dos NUPs alvo (Microdados SCM).
 * Uso (raiz): npx tsx server/scripts/extract-12-processos.ts
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'

import { NUMEROS_ALVO, NUMEROS_LISTA } from './extract-12-processos-numeros'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'data/microdados-scm')
const OUT_DIR = path.join(ROOT, 'tmp')
const OUT_JSON = path.join(OUT_DIR, 'processos-extraidos.json')

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

function parseCsvLine(line: string): string[] {
  return line.replace(/\r$/, '').split(';')
}

function loadEventoLookup(): Map<number, string> {
  const p = path.join(DATA_DIR, 'Evento.txt')
  const raw = fs.readFileSync(p, { encoding: 'latin1' })
  const map = new Map<number, string>()
  const lines = raw.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]!)
    if (parts[0] && !Number.isNaN(Number(parts[0]))) {
      map.set(Number(parts[0]), parts[1]?.trim() || '')
    }
  }
  return map
}

function loadFaseMap(): Map<number, string> {
  const p = path.join(DATA_DIR, 'FaseProcesso.txt')
  const raw = fs.readFileSync(p, { encoding: 'latin1' })
  const map = new Map<number, string>()
  for (const line of raw.split('\n').slice(1)) {
    const parts = parseCsvLine(line)
    if (parts[0] && parts[1]) map.set(Number(parts[0]), parts[1].trim())
  }
  return map
}

function loadTipoReqMap(): Map<number, string> {
  const p = path.join(DATA_DIR, 'TipoRequerimento.txt')
  const raw = fs.readFileSync(p, { encoding: 'latin1' })
  const map = new Map<number, string>()
  for (const line of raw.split('\n').slice(1)) {
    const parts = parseCsvLine(line)
    if (parts[0] && parts[1]) map.set(Number(parts[0]), parts[1].trim())
  }
  return map
}

function loadMunicipioMap(): Map<number, { nome: string; uf: string }> {
  const p = path.join(DATA_DIR, 'Municipio.txt')
  const raw = fs.readFileSync(p, { encoding: 'latin1' })
  const map = new Map<number, { nome: string; uf: string }>()
  for (const line of raw.split('\n').slice(1)) {
    const parts = parseCsvLine(line)
    const id = Number(parts[0])
    if (!Number.isFinite(id)) continue
    map.set(id, {
      nome: (parts[1] ?? '').trim(),
      uf: (parts[2] ?? '').trim(),
    })
  }
  return map
}

function loadSubstanciaMap(): Map<number, string> {
  const p = path.join(DATA_DIR, 'Substancia.txt')
  const raw = fs.readFileSync(p, { encoding: 'latin1' })
  const map = new Map<number, string>()
  for (const line of raw.split('\n').slice(1)) {
    const parts = parseCsvLine(line)
    if (parts[0] && parts[1]) map.set(Number(parts[0]), parts[1].trim())
  }
  return map
}

function loadPessoas(): Map<string, { cnpj: string; nome: string }> {
  const p = path.join(DATA_DIR, 'Pessoa.txt')
  console.log('Carregando Pessoa.txt...')
  const raw = fs.readFileSync(p, { encoding: 'latin1' })
  const map = new Map<string, { cnpj: string; nome: string }>()
  for (const line of raw.split('\n').slice(1)) {
    const parts = parseCsvLine(line)
    const idPessoa = parts[0]
    const cnpj = parts[1]
    const tipo = parts[2]
    const nome = parts[3]
    if (tipo === 'J' && cnpj && cnpj.length >= 14 && idPessoa) {
      map.set(idPessoa, { cnpj, nome: nome?.trim() || '' })
    }
  }
  console.log(`  ${map.size} PJ em memória`)
  return map
}

interface ProcessoRow {
  dsProcesso: string
  ativo: boolean
  nup: string
  idTipoReq: number
  idFase: number
  dtProtocolo: string
  areaHaStr: string
}

async function streamProcessos(): Promise<Map<string, ProcessoRow>> {
  const map = new Map<string, ProcessoRow>()
  const filePath = path.join(DATA_DIR, 'Processo.txt')
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  let header = true
  let n = 0
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = parseCsvLine(line)
    const ds = parts[0]
    if (!ds || !NUMEROS_ALVO.has(ds)) continue
    map.set(ds, {
      dsProcesso: ds,
      ativo: parts[3] === 'S',
      nup: (parts[4] ?? '').trim(),
      idTipoReq: Number(parts[5]),
      idFase: Number(parts[6]),
      dtProtocolo: (parts[9] ?? '').trim(),
      areaHaStr: (parts[11] ?? '0').trim(),
    })
    n++
  }
  console.log(`Processo.txt: ${n} linhas dos NUPs alvo`)
  return map
}

interface TitularAtual {
  idPessoa: string
  desde: string
}

async function streamTitulares(): Promise<Map<string, TitularAtual>> {
  const map = new Map<string, TitularAtual>()
  const filePath = path.join(DATA_DIR, 'ProcessoPessoa.txt')
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = parseCsvLine(line)
    const ds = parts[0]
    if (!ds || !NUMEROS_ALVO.has(ds)) continue
    const idPessoa = parts[1]
    const tipoRelacao = parts[2]
    const dtInicio = parts[6] || ''
    const dtFim = parts[7] || ''
    if (tipoRelacao === '1' && dtFim.trim() === '') {
      const existente = map.get(ds)
      if (!existente || dtInicio > existente.desde) {
        map.set(ds, { idPessoa: idPessoa!, desde: dtInicio })
      }
    }
  }
  console.log(`ProcessoPessoa.txt: ${map.size} titulares atuais (tipo 1)`)
  return map
}

async function streamSubstanciasPrimarias(
  substMap: Map<number, string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const filePath = path.join(DATA_DIR, 'ProcessoSubstancia.txt')
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = parseCsvLine(line)
    const ds = parts[0]
    if (!ds || !NUMEROS_ALVO.has(ds)) continue
    if (out.has(ds)) continue
    const idSub = Number(parts[1])
    const nm = substMap.get(idSub)
    if (nm) out.set(ds, nm)
  }
  console.log(`ProcessoSubstancia.txt: ${out.size} substâncias (primeira vigente)`)
  return out
}

async function streamMunicipiosPrimarios(
  munMap: Map<number, { nome: string; uf: string }>,
): Promise<Map<string, { ibge: number; nome: string; uf: string }>> {
  const out = new Map<string, { ibge: number; nome: string; uf: string }>()
  const filePath = path.join(DATA_DIR, 'ProcessoMunicipio.txt')
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  let header = true
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    const parts = parseCsvLine(line)
    const ds = parts[0]
    if (!ds || !NUMEROS_ALVO.has(ds)) continue
    if (out.has(ds)) continue
    const idMun = Number(parts[1])
    const m = munMap.get(idMun)
    if (m && Number.isFinite(idMun)) {
      out.set(ds, { ibge: idMun, nome: m.nome, uf: m.uf })
    }
  }
  console.log(`ProcessoMunicipio.txt: ${out.size} municípios`)
  return out
}

async function streamEventos(
  eventosLookup: Map<number, string>,
): Promise<Map<string, Array<Record<string, unknown>>>> {
  const porProc = new Map<string, Array<Record<string, unknown>>>()
  const filePath = path.join(DATA_DIR, 'ProcessoEvento.txt')
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  let header = true
  let lineCount = 0
  let matchCount = 0
  for await (const line of rl) {
    if (header) {
      header = false
      continue
    }
    lineCount++
    if (lineCount % 1_000_000 === 0) {
      console.log(`  ProcessoEvento: ${lineCount / 1_000_000}M linhas…`)
    }
    const parts = parseCsvLine(line)
    const ds = parts[0]
    if (!ds || !NUMEROS_ALVO.has(ds)) continue
    const idEvento = Number(parts[1])
    const dtEvento = parts[2] || ''
    const obEvento = parts[3] || ''
    const dsPubDOU = parts[4] || ''
    if (!dtEvento || Number.isNaN(idEvento)) continue
    const ev = {
      codigo: idEvento,
      descricao: eventosLookup.get(idEvento) || `Evento ${idEvento}`,
      categoria: categorizar(idEvento),
      data: (dtEvento.split(' ')[0] ?? dtEvento).trim(),
      publicacao_dou: dsPubDOU.trim().substring(0, 300),
      observacao: obEvento.trim().substring(0, 500),
    }
    if (!porProc.has(ds)) porProc.set(ds, [])
    porProc.get(ds)!.push(ev)
    matchCount++
  }
  console.log(`ProcessoEvento.txt: ${matchCount} eventos capturados`)
  return porProc
}

interface ProcessoExtraido {
  numero: string
  titular: string
  cnpj: string
  substancia: string
  regime: string
  fase: string
  area_ha: number
  uf: string
  municipio: string
  municipio_ibge: number
  data_protocolo: string
  ativo: boolean
  nup_sei: string
  eventos: Array<{
    codigo: number
    descricao: string
    categoria: string | null
    data: string
    publicacao_dou: string
  }>
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const faseMap = loadFaseMap()
  const tipoReqMap = loadTipoReqMap()
  const municipioMap = loadMunicipioMap()
  const substMap = loadSubstanciaMap()
  const eventosLookup = loadEventoLookup()
  const pessoas = loadPessoas()

  const [processos, titulares, subs, muns, eventosPorProc] = await Promise.all([
    streamProcessos(),
    streamTitulares(),
    streamSubstanciasPrimarias(substMap),
    streamMunicipiosPrimarios(municipioMap),
    streamEventos(eventosLookup),
  ])

  const resultado: ProcessoExtraido[] = []
  const naoEncontrados: string[] = []

  for (const numero of NUMEROS_LISTA) {
    const proc = processos.get(numero)
    if (!proc) {
      naoEncontrados.push(numero)
      continue
    }

    const tit = titulares.get(numero)
    const pj = tit ? pessoas.get(tit.idPessoa) : undefined
    const areaHa = Number.parseFloat(proc.areaHaStr.replace(',', '.')) || 0
    const dtProtocolo = proc.dtProtocolo.split(' ')[0] || proc.dtProtocolo
    const municipio = muns.get(numero)
    const evs = eventosPorProc.get(numero) ?? []

    const eventosNorm = evs
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map((e) => ({
        codigo: e.codigo as number,
        descricao: String(e.descricao),
        categoria: e.categoria as string | null,
        data: String(e.data),
        publicacao_dou: String(e.publicacao_dou ?? ''),
      }))

    resultado.push({
      numero: proc.dsProcesso,
      titular: pj?.nome ?? '—',
      cnpj: pj?.cnpj ?? '',
      substancia: subs.get(numero) ?? '—',
      regime: tipoReqMap.get(proc.idTipoReq) ?? '—',
      fase: faseMap.get(proc.idFase) ?? '—',
      area_ha: areaHa,
      uf: municipio?.uf ?? '—',
      municipio: municipio?.nome ?? '—',
      municipio_ibge: municipio?.ibge ?? 0,
      data_protocolo: dtProtocolo,
      ativo: proc.ativo,
      nup_sei: proc.nup,
      eventos: eventosNorm,
    })
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(resultado, null, 2), 'utf8')

  console.log('\n=== Resumo ===')
  console.log(`NUPs alvo: ${NUMEROS_LISTA.length}`)
  console.log(
    `Encontrados em Processo.txt: ${NUMEROS_LISTA.length - naoEncontrados.length}`,
  )
  if (naoEncontrados.length) {
    console.log('NÃO encontrados em Processo.txt:', naoEncontrados.join(', '))
  } else {
    console.log('Todos os NUPs foram encontrados em Processo.txt.')
  }
  console.log(`JSON: ${OUT_JSON}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
