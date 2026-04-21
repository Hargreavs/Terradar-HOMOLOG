/**
 * Cruza Processo.txt com numeros ja no banco (exportados) e conta ausentes
 * por (IDFaseProcesso, BTAtivo).
 *
 * Passo 1 (PowerShell, na raiz do repo):
 *   psql $env:DATABASE_URL -t -A -c "SELECT numero FROM processos" > tmp/numeros-banco.txt
 *
 * Passo 2:
 *   npx tsx scripts/one-off/contar-ausentes-por-fase.ts
 *
 * Opcoes:
 *   --banco-file <path>   (default: tmp/numeros-banco.txt)
 *   --processo-path <path> (default: data/microdados-scm/Processo.txt)
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const cwd = process.cwd()

function parseArgs(): { bancoFile: string; processoPath: string } {
  let bancoFile = path.join(cwd, 'tmp', 'numeros-banco.txt')
  let processoPath = path.join(cwd, 'data', 'microdados-scm', 'Processo.txt')
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--banco-file' && process.argv[i + 1]) bancoFile = process.argv[++i]
    else if (a === '--processo-path' && process.argv[i + 1])
      processoPath = process.argv[++i]
  }
  return { bancoFile, processoPath }
}

async function loadNumerosBanco(file: string): Promise<Set<string>> {
  if (!fs.existsSync(file)) {
    console.error(`Ficheiro nao encontrado: ${file}`)
    console.error('Gere com: psql $env:DATABASE_URL -t -A -c "SELECT numero FROM processos" > tmp/numeros-banco.txt')
    process.exit(1)
  }
  const set = new Set<string>()
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    const n = line.replace(/\r$/, '').trim()
    if (n) set.add(n)
  }
  return set
}

async function main() {
  const { bancoFile, processoPath } = parseArgs()

  console.error(`Carregando numeros do banco: ${bancoFile}`)
  const noBanco = await loadNumerosBanco(bancoFile)
  console.error(`  ${noBanco.size} numeros no set`)

  if (!fs.existsSync(processoPath)) {
    console.error(`Processo.txt nao encontrado: ${processoPath}`)
    process.exit(1)
  }

  const counts = new Map<string, number>()
  let totalLinhas = 0
  let ausentes = 0

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
    totalLinhas++
    const parts = line.replace(/\r$/, '').split(';')
    const ds = parts[0]?.trim() ?? ''
    const btAtivo = (parts[3] ?? '').trim() || '(vazio)'
    const idFase = (parts[6] ?? '').trim() || '(vazio)'

    if (!ds) continue
    if (noBanco.has(ds)) continue

    ausentes++
    const key = `${idFase}\t${btAtivo}`
    counts.set(key, (counts.get(key) ?? 0) + 1)

    if (totalLinhas % 200_000 === 0) {
      console.error(`  ... ${totalLinhas} linhas lidas, ${ausentes} ausentes`)
    }
  }

  const rows = [...counts.entries()].sort((a, b) => {
    const [fa, ba] = a[0].split('\t')
    const [fb, bb] = b[0].split('\t')
    const na = Number.parseInt(fa, 10)
    const nb = Number.parseInt(fb, 10)
    const ca = Number.isNaN(na) ? fa.localeCompare(fb) : na - nb
    if (ca !== 0) return ca
    return ba.localeCompare(bb)
  })

  console.log('IDFaseProcesso\tBTAtivo\tcount')
  for (const [key, c] of rows) {
    const [idFase, bt] = key.split('\t')
    console.log(`${idFase}\t${bt}\t${c}`)
  }
  console.error(`---`)
  console.error(`Linhas dados Processo.txt: ${totalLinhas}`)
  console.error(`Ausentes (soma contagens): ${ausentes}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
