import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import postgres from 'postgres'
import pLimit from 'p-limit'
import '../../env'

const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL ou VITE_DATABASE_URL e obrigatorio')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY e obrigatorio')
  process.exit(1)
}

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 16,
  idle_timeout: 0,
  prepare: false,
})
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const rootDir = fileURLToPath(new URL('../../../', import.meta.url))
const systemPath = path.join(rootDir, 'Docs', 'radar_d1_system.txt')
const SYSTEM_PROMPT = fs.readFileSync(systemPath, 'utf-8')

const MODEL = 'claude-sonnet-4-5-20250929' as const

const REGEX_PROC_MINERARIO = /^[0-9]{3}\.[0-9]{3}\/(19|20)[0-9]{2}$/
const REGEX_CNPJ_FORMATADO =
  /^[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}$/

export type ClassificarAtoResult =
  | { skipped: true }
  | {
      skipped: false
      eventoId: number
      categoria: string
      titulo: string
      confianca: number
      custo: number
      aplicacao: unknown
    }

export interface ResultadoIA {
  categoria: 'CRITICO' | 'DESFAVORAVEL' | 'NEUTRO' | 'POSITIVO' | 'FAVORAVEL'
  titulo: string
  resumo: string
  analise_terradar: string
  ufs_afetadas: string[]
  municipios_afetados: string[]
  substancias_minerais: string[]
  regimes_afetados: string[]
  processos_citados: string[]
  cnpjs_afetados: string[]
  orgao_emissor: string
  tipo_ato: string
  numero_ato: string | null
  publicado_em: string
  hora_estimada: boolean
  flags_atencao: string[]
  confianca: number
}

function parseJsonIa(textOut: string): ResultadoIA {
  let cleaned = textOut
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1)
  return JSON.parse(cleaned) as ResultadoIA
}

function custoUsd(usage: { input_tokens: number; output_tokens: number }): number {
  return (usage.input_tokens * 3 + usage.output_tokens * 15) / 1e6
}

export async function classificarAto(pubId: number): Promise<ClassificarAtoResult> {
  const rows = await sql`
    SELECT id, titulo_bruto, conteudo_html, data_publicacao, orgao_secundario, orgao_principal
    FROM radar_publicacoes_brutas
    WHERE id = ${pubId} AND status = 'PENDENTE'
  `
  const pub = rows[0] as
    | {
        id: number
        titulo_bruto: string | null
        conteudo_html: string | null
        data_publicacao: string
        orgao_secundario: string | null
        orgao_principal: string | null
      }
    | undefined
  if (!pub) {
    return { skipped: true as const }
  }

  const corpo = (pub.conteudo_html || '').slice(0, 15000)
  const userMsg = `TEXTO DO ATO PUBLICADO NO DOU:

DATA DE PUBLICAÇÃO: ${pub.data_publicacao}
ÓRGÃO: ${pub.orgao_secundario} (${pub.orgao_principal})
TÍTULO ORIGINAL: ${pub.titulo_bruto}

CONTEÚDO:
---
${corpo}
---

Classifique o ato e gere "resumo" (subtitle ≤140 chars) e "analise_terradar" (2-3 frases interpretativas ≤400 chars). Responda apenas o JSON.`

  const resp = await claude.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  })

  const textOut = resp.content.find((c) => c.type === 'text' && 'text' in c)
  const rawText = textOut && textOut.type === 'text' ? textOut.text : ''
  if (!rawText) throw new Error('Resposta vazia da API')

  const r = parseJsonIa(rawText)

  r.processos_citados = (r.processos_citados || []).filter((p) =>
    REGEX_PROC_MINERARIO.test(String(p)),
  )
  r.cnpjs_afetados = (r.cnpjs_afetados || []).filter((c) =>
    REGEX_CNPJ_FORMATADO.test(String(c)),
  )

  const cu = custoUsd({
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
  })

  const inserted = await sql`
    INSERT INTO radar_eventos (
      publicacao_id, categoria, titulo, resumo, analise_terradar,
      ufs_afetadas, municipios_afetados, substancias_minerais,
      regimes_afetados, processos_citados, cnpjs_afetados,
      orgao_emissor, tipo_ato, numero_ato,
      publicado_em, hora_estimada, data_evento,
      flags_atencao, confianca, modelo_ia, custo_ia_usd
    ) VALUES (
      ${pubId},
      ${r.categoria},
      ${r.titulo},
      ${r.resumo},
      ${r.analise_terradar},
      ${r.ufs_afetadas ?? []},
      ${r.municipios_afetados ?? []},
      ${r.substancias_minerais ?? []},
      ${r.regimes_afetados ?? []},
      ${r.processos_citados ?? []},
      ${r.cnpjs_afetados ?? []},
      ${r.orgao_emissor},
      ${r.tipo_ato},
      ${r.numero_ato},
      ${r.publicado_em}::timestamptz,
      ${r.hora_estimada},
      ${pub.data_publicacao}::date,
      ${r.flags_atencao ?? []},
      ${r.confianca},
      ${MODEL},
      ${cu}
    )
    RETURNING id
  `

  const evento = inserted[0] as { id: number } | undefined
  if (!evento) throw new Error('INSERT radar_eventos sem id')

  await sql`
    UPDATE radar_publicacoes_brutas
    SET status = 'CLASSIFICADO', classificado_em = NOW()
    WHERE id = ${pubId}
  `

  const applied = (await sql`
    SELECT radar_aplicar_evento_a_processos(${evento.id}::int) AS resultado
  `) as { resultado: unknown }[]

  return {
    skipped: false,
    eventoId: evento.id,
    categoria: r.categoria,
    titulo: r.titulo,
    confianca: r.confianca,
    custo: cu,
    aplicacao: applied[0]?.resultado,
  }
}

export async function classificarPendentes(limite = 50) {
  const pendentes = await sql`
    SELECT id FROM radar_publicacoes_brutas
    WHERE status = 'PENDENTE'
    ORDER BY data_publicacao ASC, id ASC
    LIMIT ${limite}
  `

  console.log(
    `Classificando ${pendentes.length} pendentes em paralelo (concurrency=8)...`,
  )

  let custoTotal = 0
  const limit = pLimit(8)

  await Promise.all(
    pendentes.map((p) =>
      limit(async () => {
        const id = Number((p as { id: string | number }).id)
        try {
          const r = await classificarAto(id)
          if (r.skipped) {
            console.log(`[${id}] pulado (nao PENDENTE ou nao encontrado)`)
            return
          }
          custoTotal += r.custo ?? 0
          const apl = r.aplicacao
          const nproc =
            apl != null && typeof apl === 'object' && apl !== null
              ? (apl as { total_aplicados?: number }).total_aplicados
              : apl
          console.log(
            `[${id}] ${r.categoria} (${r.confianca}) — ${r.titulo.slice(0, 80)} -> ${nproc ?? JSON.stringify(r.aplicacao)} processos`,
          )
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`[${id}] ❌`, msg)
          await sql`UPDATE radar_publicacoes_brutas SET status = 'ERRO' WHERE id = ${id}`
        }
      }),
    ),
  )

  await sql`SELECT radar_refresh_resumo()`
  console.log(`\nConcluido. Custo total: USD ${custoTotal.toFixed(4)}`)
  return custoTotal
}

function isEntrypoint(): boolean {
  const a = fileURLToPath(import.meta.url)
  const b = process.argv[1] ? path.resolve(process.argv[1]) : ''
  if (!b) return false
  return a.replace(/\//g, path.sep) === b.replace(/\//g, path.sep)
}

if (isEntrypoint()) {
  const limite = Math.min(10000, Math.max(1, parseInt(process.argv[2] || '50', 10) || 50))
  classificarPendentes(limite)
    .then(() => sql.end({ timeout: 10 }))
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
