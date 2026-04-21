// Investigacao SICONFI RGF (SP 3550308): listar anexos sem no_anexo, depois amostra com no_anexo exato.
// Uso: npx tsx server/scripts/debug-siconfi-rgf.ts

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "../..")

const RGF = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rgf"

type Row = Record<string, unknown>

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function norm(s: string): string {
  return semAcento(s).toLowerCase()
}

function buildUrl(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, v)
  }
  return `${RGF}?${p.toString()}`
}

async function fetchRgf(
  url: string,
): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(url)
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = { _parseError: true }
  }
  return { status: res.status, body, text }
}

function itemsOf(body: unknown): Row[] {
  if (body && typeof body === "object" && "items" in body) {
    const it = (body as { items?: unknown }).items
    if (Array.isArray(it)) return it as Row[]
  }
  return []
}

function countOf(body: unknown): number {
  if (body && typeof body === "object" && "count" in body) {
    const c = (body as { count?: unknown }).count
    if (typeof c === "number") return c
  }
  return -1
}

const ANEXO_KEYS = ["anexo", "rotulo", "no_anexo", "demonstrativo"] as const

function distinctAnexoLike(items: Row[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const k of ANEXO_KEYS) m.set(k, new Set())
  for (const row of items) {
    for (const k of ANEXO_KEYS) {
      const v = row[k]
      if (v != null && String(v).trim() !== "") {
        m.get(k)!.add(String(v).trim())
      }
    }
  }
  return m
}

function pickAnexo2Candidate(distinct: Set<string>): string | null {
  const list = [...distinct]
  const scored = list.map((s) => {
    const n = norm(s)
    let score = 0
    if (/anexo\s*0*2/.test(n) || n.includes("anexo 02")) score += 5
    if (n.includes("dcl") || n.includes("divida consolidada")) score += 4
    if (n.includes("rgf") && n.includes("02")) score += 3
    return { s, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.score > 0 ? scored[0].s : null
}

function logDistinctFields(log: (s: string) => void, items: Row[]): void {
  const m = distinctAnexoLike(items)
  log("")
  log("Valores distintos por campo (quando existir):")
  for (const [k, set] of m) {
    if (set.size === 0) continue
    log(`  [${k}] (${set.size} distintos):`)
    for (const v of [...set].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
      log(`    ${JSON.stringify(v)}`)
    }
  }
}

async function main(): Promise<void> {
  const out: string[] = []
  const log = (s: string) => {
    out.push(s)
    console.log(s)
  }

  log("=== Investigacao RGF SICONFI (3550308) ===\n")

  type Attempt = { name: string; url: string }
  const attempts: Attempt[] = [
    {
      name: "Passo 1 (doc): 2023 M E Q Q3 sem no_anexo",
      url: buildUrl({
        an_exercicio: "2023",
        id_ente: "3550308",
        co_esfera: "M",
        co_poder: "E",
        in_periodicidade: "Q",
        nr_periodo: "3",
      }),
    },
    {
      name: "Mesma URL + co_tipo_demonstrativo=QDCC",
      url: buildUrl({
        an_exercicio: "2023",
        id_ente: "3550308",
        co_esfera: "M",
        co_poder: "E",
        co_tipo_demonstrativo: "QDCC",
        in_periodicidade: "Q",
        nr_periodo: "3",
      }),
    },
    {
      name: "Fallback: 2022 mesmos parametros (sem QDCC)",
      url: buildUrl({
        an_exercicio: "2022",
        id_ente: "3550308",
        co_esfera: "M",
        co_poder: "E",
        in_periodicidade: "Q",
        nr_periodo: "3",
      }),
    },
    {
      name: "Fallback: 2022 + QDCC",
      url: buildUrl({
        an_exercicio: "2022",
        id_ente: "3550308",
        co_esfera: "M",
        co_poder: "E",
        co_tipo_demonstrativo: "QDCC",
        in_periodicidade: "Q",
        nr_periodo: "3",
      }),
    },
    {
      name: "Fallback: 2024 nr_periodo=1",
      url: buildUrl({
        an_exercicio: "2024",
        id_ente: "3550308",
        co_esfera: "M",
        co_poder: "E",
        co_tipo_demonstrativo: "QDCC",
        in_periodicidade: "Q",
        nr_periodo: "1",
      }),
    },
    {
      name: "Fallback: so an_exercicio, id_ente, in_periodicidade, nr_periodo (2023 Q3)",
      url: buildUrl({
        an_exercicio: "2023",
        id_ente: "3550308",
        in_periodicidade: "Q",
        nr_periodo: "3",
      }),
    },
    {
      name: "Fallback minimal + QDCC",
      url: buildUrl({
        an_exercicio: "2023",
        id_ente: "3550308",
        co_tipo_demonstrativo: "QDCC",
        in_periodicidade: "Q",
        nr_periodo: "3",
      }),
    },
  ]

  let winner: { attempt: Attempt; status: number; items: Row[] } | null = null

  for (const att of attempts) {
    log(`--- ${att.name} ---`)
    log(`GET ${att.url}`)
    const { status, body } = await fetchRgf(att.url)
    const items = itemsOf(body)
    const cnt = countOf(body)
    log(`HTTP ${status}`)
    log(`count (API): ${cnt >= 0 ? cnt : "n/a"} | items.length: ${items.length}`)

    if (items.length > 0) {
      winner = { attempt: att, status, items }
      log(">>> Dados encontrados nesta tentativa.\n")
      break
    }
    log("")
  }

  if (!winner) {
    log("\n=== RESULTADO ===")
    log(
      "Nenhuma das URLs devolveu linhas. Nao e possivel listar anexos nem executar passos 2-3.",
    )
    log(
      "O endpoint /tt/rgf responde HTTP 200 com count 0 para estas consultas (Data Lake pode nao ter RGF carregado).",
    )
    writeOut(out)
    process.exitCode = 1
    return
  }

  const { attempt, status, items } = winner

  log("=== PASSO 1 — Resumo ===")
  log(`URL que funcionou: ${attempt.url}`)
  log(`HTTP ${status}`)
  log(`Quantidade de linhas: ${items.length}`)
  if (items[0]) {
    log("\n--- Primeiro item completo ---")
    log(JSON.stringify(items[0], null, 2))
    log("\n--- Chaves ordenadas ---")
    log(JSON.stringify(Object.keys(items[0]).sort(), null, 2))
  }
  logDistinctFields(log, items)

  const anexoSet = distinctAnexoLike(items).get("anexo") ?? new Set()
  const rotuloSet = distinctAnexoLike(items).get("rotulo") ?? new Set()
  const combined = new Set<string>([...anexoSet, ...rotuloSet])

  log("\n=== PASSO 2 — Candidato Anexo 2 / DCL ===")
  const candidate = pickAnexo2Candidate(anexoSet.size ? anexoSet : combined)
  if (candidate) {
    log(`Candidato (heuristica): ${JSON.stringify(candidate)}`)
  } else {
    log(
      "(Inferencia automatica falhou; use um valor EXATO da lista [anexo] acima.)",
    )
  }

  const noAnexoExact =
    candidate && anexoSet.has(candidate)
      ? candidate
      : [...anexoSet][0] ?? null

  if (!noAnexoExact) {
    log("\nNenhum valor no campo anexo para no_anexo.")
    writeOut(out)
    process.exitCode = 1
    return
  }

  log(`\nUsando no_anexo = ${JSON.stringify(noAnexoExact)}`)

  const step3 = new URL(attempt.url)
  step3.searchParams.set("no_anexo", noAnexoExact)
  if (!step3.searchParams.has("co_tipo_demonstrativo")) {
    step3.searchParams.set("co_tipo_demonstrativo", "QDCC")
  }
  const step3Url = step3.toString()

  log("\n=== PASSO 3 — Com no_anexo exato (base = URL vencedora) ===")
  log(`GET ${step3Url}`)
  const r3 = await fetchRgf(step3Url)
  const items3 = itemsOf(r3.body)
  log(`HTTP ${r3.status} | items.length: ${items3.length}`)

  const sample = items3.length > 0 ? items3 : items

  log("\n--- 20 linhas completas ---")
  log(JSON.stringify(sample.slice(0, 20), null, 2))

  log("\n--- Filtro: conta contem DIVIDA CONSOLIDADA (normalizado) ---")
  const fDcl = sample.filter((row) => {
    const c = row.conta != null ? String(row.conta) : ""
    return norm(c).includes("divida consolidada")
  })
  if (fDcl.length === 0) log("(nenhuma linha)")
  else log(JSON.stringify(fDcl, null, 2))

  log("\n--- Valores distintos: coluna ---")
  const cols = new Set<string>()
  for (const row of sample) {
    if (row.coluna != null) cols.add(String(row.coluna))
  }
  const sorted = [...cols].sort((a, b) => a.localeCompare(b, "pt-BR"))
  log(`Total: ${sorted.length}`)
  for (const c of sorted) log(`  ${JSON.stringify(c)}`)

  log("\n=== Fim ===")
  writeOut(out)
}

function writeOut(lines: string[]): void {
  const dir = path.join(ROOT, "tmp")
  fs.mkdirSync(dir, { recursive: true })
  const p = path.join(dir, "debug-rgf-sp.log")
  fs.writeFileSync(p, lines.join("\n"), "utf8")
  console.log(`\nLog: ${p}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})