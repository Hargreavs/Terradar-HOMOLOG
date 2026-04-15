/**
 * Ingestão de CNPJ dos titulares via Microdados SCM (ANM)
 *
 * Fonte: https://dados.gov.br/dados/conjuntos-dados/sistema-de-cadastro-mineiro
 * Arquivos em data/microdados-scm/:
 *   - Pessoa.txt (IDPessoa;NRCPFCNPJ;TPPessoa;NMPessoa)
 *   - ProcessoPessoa.txt (DSProcesso;IDPessoa;IDTipoRelacao;...;DTFimVigencia)
 *   - Processo.txt (DSProcesso;...;NRNUP;...)
 *
 * Encoding: latin-1 (ISO-8859-1). Separador: ponto-e-vírgula (;)
 *
 * Uso (raiz do projeto): npx tsx server/scripts/ingest-cnpj-microdados.ts
 */
import fs from 'fs'
import path from 'path'

import { supabase } from '../supabase'

const DATA_DIR = path.join(process.cwd(), 'data/microdados-scm')
const BATCH_SIZE = 500

function parseCSV(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, { encoding: 'latin1' })
  return content
    .split('\n')
    .map((line) => line.replace(/\r$/, '').split(';'))
    .filter((row) => row.some((c) => c && c.trim() !== ''))
}

interface PessoaJuridica {
  cnpj: string
  nome: string
}

function loadPessoas(): Map<string, PessoaJuridica> {
  console.log('Carregando Pessoa.txt...')
  const rows = parseCSV(path.join(DATA_DIR, 'Pessoa.txt'))
  const map = new Map<string, PessoaJuridica>()

  for (let i = 1; i < rows.length; i++) {
    const idPessoa = rows[i][0]
    const cnpj = rows[i][1]
    const tipo = rows[i][2]
    const nome = rows[i][3]
    if (tipo === 'J' && cnpj && cnpj.length >= 14 && idPessoa) {
      map.set(idPessoa, { cnpj, nome: nome?.trim() || '' })
    }
  }
  console.log(`  ${map.size} pessoas jurídicas carregadas`)
  return map
}

interface TitularAtual {
  idPessoa: string
  desde: string
}

function loadTitulares(): Map<string, TitularAtual> {
  console.log('Carregando ProcessoPessoa.txt...')
  const rows = parseCSV(path.join(DATA_DIR, 'ProcessoPessoa.txt'))
  const map = new Map<string, TitularAtual>()

  for (let i = 1; i < rows.length; i++) {
    const dsProcesso = rows[i][0]
    const idPessoa = rows[i][1]
    const tipoRelacao = rows[i][2]
    const dtInicio = rows[i][6] || ''
    const dtFim = rows[i][7] || ''

    if (!dsProcesso || !idPessoa) continue
    if (tipoRelacao === '1' && dtFim.trim() === '') {
      const existente = map.get(dsProcesso)
      if (!existente || dtInicio > existente.desde) {
        map.set(dsProcesso, { idPessoa, desde: dtInicio })
      }
    }
  }
  console.log(`  ${map.size} titulares atuais carregados`)
  return map
}

interface ProcessoNUP {
  nup: string
  ativo: boolean
}

function loadProcessosNUP(): Map<string, ProcessoNUP> {
  console.log('Carregando Processo.txt...')
  const rows = parseCSV(path.join(DATA_DIR, 'Processo.txt'))
  const map = new Map<string, ProcessoNUP>()

  for (let i = 1; i < rows.length; i++) {
    const dsProcesso = rows[i][0]
    if (!dsProcesso) continue
    const ativo = rows[i][3] === 'S'
    const nup = rows[i][4] || ''
    map.set(dsProcesso, { nup: nup.trim(), ativo })
  }
  console.log(
    `  ${map.size} processos carregados (${[...map.values()].filter((p) => p.ativo).length} ativos)`,
  )
  return map
}

function formatCNPJ(cnpj: string): string {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

interface ProcessoCNPJ {
  numero: string
  cnpj: string
  cnpj_fmt: string
  titular: string
  nup: string
}

async function main() {
  console.log('=== Ingestão CNPJ via Microdados SCM (TERRADAR) ===\n')

  const arquivos = ['Pessoa.txt', 'ProcessoPessoa.txt', 'Processo.txt']
  for (const arq of arquivos) {
    const p = path.join(DATA_DIR, arq)
    if (!fs.existsSync(p)) {
      console.error(`ERRO: ${p} não encontrado.`)
      console.error(
        'Baixe os Microdados SCM em https://dados.gov.br/dados/conjuntos-dados/sistema-de-cadastro-mineiro',
      )
      console.error('e extraia os .txt em data/microdados-scm/')
      process.exit(1)
    }
  }

  const pessoas = loadPessoas()
  const titulares = loadTitulares()
  const processosNUP = loadProcessosNUP()

  const resultados: ProcessoCNPJ[] = []

  for (const [dsProcesso, titularInfo] of titulares) {
    const pessoa = pessoas.get(titularInfo.idPessoa)
    if (!pessoa) continue

    const procInfo = processosNUP.get(dsProcesso)

    resultados.push({
      numero: dsProcesso,
      cnpj: pessoa.cnpj,
      cnpj_fmt: formatCNPJ(pessoa.cnpj),
      titular: pessoa.nome,
      nup: procInfo?.nup || '',
    })
  }

  console.log(`\nJoin completo: ${resultados.length} processos com CNPJ do titular`)

  console.log('\nAmostra (primeiros 5):')
  for (const r of resultados.slice(0, 5)) {
    console.log(`  ${r.numero} → ${r.cnpj_fmt} (${r.titular}) NUP: ${r.nup}`)
  }

  for (const testProc of ['860.232/1990', '864.231/2017']) {
    const r = resultados.find((x) => x.numero === testProc)
    if (r) {
      console.log(
        `\n  CHECK ${testProc}: ${r.cnpj_fmt} (${r.titular}) NUP: ${r.nup}`,
      )
    } else {
      console.log(`\n  CHECK ${testProc}: NÃO ENCONTRADO`)
    }
  }

  console.log(
    `\nIniciando atualização no Supabase (${resultados.length} registros, lotes de ${BATCH_SIZE})...`,
  )

  let updated = 0
  let errors = 0
  let notFound = 0

  for (let i = 0; i < resultados.length; i += BATCH_SIZE) {
    const batch = resultados.slice(i, i + BATCH_SIZE)

    for (const r of batch) {
      const { data, error } = await supabase
        .from('processos')
        .update({
          cnpj_titular: r.cnpj_fmt,
          nup_sei: r.nup || null,
        })
        .eq('numero', r.numero)
        .select('numero')

      if (error) {
        errors++
        if (errors <= 5) console.error(`  ERRO ${r.numero}: ${error.message}`)
      } else if (!data || data.length === 0) {
        notFound++
      } else {
        updated++
      }
    }

    const done = Math.min(i + BATCH_SIZE, resultados.length)
    if (done % 5000 === 0 || done >= resultados.length) {
      console.log(
        `  Progresso: ${done}/${resultados.length} | Atualizados: ${updated} | Não encontrados: ${notFound} | Erros: ${errors}`,
      )
    }
  }

  console.log('\n=== Resultado final ===')
  console.log(`  Total com CNPJ: ${resultados.length}`)
  console.log(`  Atualizados no Supabase: ${updated}`)
  console.log(`  Processo não existe no Supabase: ${notFound}`)
  console.log(`  Erros: ${errors}`)

  console.log('\n=== Verificação ===')
  const { data: check } = await supabase
    .from('processos')
    .select('numero, cnpj_titular, nup_sei')
    .in('numero', ['860.232/1990', '864.231/2017'])

  if (check) {
    for (const c of check) {
      console.log(`  ${c.numero}: cnpj=${c.cnpj_titular}, nup=${c.nup_sei}`)
    }
  }
}

main().catch(console.error)
