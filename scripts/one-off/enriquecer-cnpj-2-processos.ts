// Cruza ProcessoPessoa.txt + Pessoa.txt (microdados SCM) para CNPJ do titular (IDTipoRelacao=1).
// Uso: npx tsx scripts/one-off/enriquecer-cnpj-2-processos.ts [--apply]
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const NUMEROS_ALVO = new Set(['857.854/1996', '850.280/1991'])
/** Titular no arquivo ProcessoPessoa (coluna IDTipoRelacao). */
const ID_TIPO_TITULAR = '1'

function formatCnpj(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return null
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function normNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function streamTitularesProcessoPessoa(
  filePath: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!fs.existsSync(filePath)) {
    console.error(`Ficheiro nao encontrado: ${filePath}`)
    process.exit(1)
  }
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let lineNum = 0
  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) continue
    const parts = line.split(';')
    const ds = parts[0]?.trim()
    if (!ds || !NUMEROS_ALVO.has(ds)) continue
    const idPessoa = parts[1]?.trim()
    const idTipo = parts[2]?.trim()
    if (idTipo !== ID_TIPO_TITULAR || !idPessoa) continue
    out.set(ds, idPessoa)
  }
  return out
}

async function loadPessoaMap(
  filePath: string,
  ids: Set<string>,
): Promise<Map<string, { nome: string; docRaw: string }>> {
  const map = new Map<string, { nome: string; docRaw: string }>()
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })
  let lineNum = 0
  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) continue
    const parts = line.split(';')
    const id = parts[0]?.trim()
    if (!id || !ids.has(id)) continue
    const docRaw = parts[1]?.trim() ?? ''
    const nome = parts[3]?.trim() ?? ''
    map.set(id, { nome, docRaw })
  }
  return map
}

async function fetchTitularesBanco(
  numeros: string[],
): Promise<Map<string, string>> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes; skip comparacao com banco.')
    return new Map()
  }
  const supabase = createClient(url, key)
  const out = new Map<string, string>()
  for (const n of numeros) {
    const { data, error } = await supabase
      .from('processos')
      .select('numero, titular')
      .eq('numero', n)
      .maybeSingle()
    if (error) {
      console.warn(`[banco] ${n}:`, error.message)
      continue
    }
    if (data?.titular) out.set(n, String(data.titular))
  }
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')
  const procPessoaPath = path.join(
    ROOT,
    'data',
    'microdados-scm',
    'ProcessoPessoa.txt',
  )
  const pessoaPath = path.join(ROOT, 'data', 'microdados-scm', 'Pessoa.txt')

  const numeroToIdPessoa = await streamTitularesProcessoPessoa(procPessoaPath)
  const ids = new Set(numeroToIdPessoa.values())
  const pessoaMap = await loadPessoaMap(pessoaPath, ids)
  const titularesDb = await fetchTitularesBanco([...NUMEROS_ALVO])

  console.log('')
  console.log('=== enriquecer-cnpj-2-processos (relatorio) ===')
  for (const numero of NUMEROS_ALVO) {
    const idP = numeroToIdPessoa.get(numero)
    const titularDb = titularesDb.get(numero) ?? '(sem titular no banco ou erro)'
    if (!idP) {
      console.log(`\n${numero}`)
      console.log('  titular_banco:', titularDb)
      console.log('  cnpj_encontrado: NAO ENCONTRADO (sem linha titular IDTipoRelacao=1 em ProcessoPessoa)')
      continue
    }
    const p = pessoaMap.get(idP)
    if (!p) {
      console.log(`\n${numero}  IDPessoa=${idP}`)
      console.log('  titular_banco:', titularDb)
      console.log('  cnpj_encontrado: NAO ENCONTRADO (ID ausente em Pessoa.txt)')
      continue
    }
    const digits = p.docRaw.replace(/\D/g, '')
    const isCnpj = digits.length === 14
    const cnpjFmt = isCnpj ? formatCnpj(digits) : null
    const nomeFile = normNome(p.nome)
    const nomeDb = titularesDb.has(numero)
      ? normNome(titularesDb.get(numero)!)
      : ''
    const nomesBatem =
      nomeDb.length > 0 && nomeFile.length > 0 && nomeFile === nomeDb

    console.log(`\n${numero}`)
    console.log('  IDPessoa (titular):', idP)
    console.log('  titular_banco:     ', titularDb)
    console.log('  nome Pessoa.txt:   ', p.nome)
    console.log('  doc bruto:         ', p.docRaw)
    console.log('  CNPJ formatado:    ', cnpjFmt ?? '(nao e CNPJ 14 digitos; pode ser CPF mascarado)')
    console.log(
      '  comparacao nome:   ',
      titularesDb.has(numero)
        ? nomesBatem
          ? 'OK (igual apos normalizacao)'
          : 'DIVERGENTE: revisar antes de aplicar UPDATE'
        : 'nao verificado (sem titular no banco)',
    )

    if (apply && cnpjFmt && titularesDb.has(numero) && nomesBatem) {
      const url = process.env.SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) {
        console.error('  UPDATE ignorado: credenciais Supabase ausentes.')
        continue
      }
      const supabase = createClient(url, key)
      const { error } = await supabase
        .from('processos')
        .update({ cnpj_titular: cnpjFmt, updated_at: new Date().toISOString() })
        .eq('numero', numero)
        .is('cnpj_titular', null)
      if (error) console.error('  UPDATE erro:', error.message)
      else console.log('  UPDATE OK: cnpj_titular =', cnpjFmt)
    } else if (apply) {
      console.log(
        '  UPDATE nao aplicado: use --apply apenas quando CNPJ valido e nome bate com o banco.',
      )
    }
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
