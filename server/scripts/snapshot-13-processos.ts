/**
 * Captura snapshot JSON (ReportData + RelatorioData) dos 13 processos da apresentacao.
 *
 * Requer API Express rodando; ver TERRAE_API_BASE / API_PORT.
 * Requer loader para stubs de *.geojson (Vite ?raw) — mesmo padrao do front:
 *
 *   node --experimental-loader ./server/scripts/snapshot-geojson-loader.mjs --import tsx server/scripts/snapshot-13-processos.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import '../env'

import { buildReportData } from '../../src/components/report/reportDataBuilder'
import { fetchProcessoCompleto } from '../../src/lib/processoApi'
import type { ProcessoCompleto } from '../../src/lib/processoApi'
import { mapDbRowToMapProcesso } from '../../src/lib/mapProcessoFromDbRow'
import { relatorioDataFromReportData } from '../../src/lib/relatorioDataFromReportData'
import type { Processo } from '../../src/types/index'
import type { ReportData } from '../../src/lib/reportTypes'

const PROCESSOS_13 = [
  '864.016/2026',
  '864.026/2026',
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
  '871.516/2011',
] as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../tmp/snapshots')

function sanitizeNumeroArquivo(numero: string): string {
  return numero.replace(/\//g, '_').replace(/\./g, '_')
}

function patchFetchForApiBase(): void {
  const orig = globalThis.fetch.bind(globalThis)
  const port = process.env.API_PORT ?? '3001'
  const base =
    process.env.TERRAE_API_BASE ?? `http://127.0.0.1:${port}`

  globalThis.fetch = ((
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (url.startsWith('/')) {
      return orig(`${base}${url}`, init)
    }
    return orig(input as RequestInfo, init)
  }) as typeof fetch
}

function processoFromApiCompleto(api: ProcessoCompleto): Processo {
  const merged: Record<string, unknown> = {
    ...(api.processo as Record<string, unknown>),
    scores_persistido: api.scores,
    scores_auto: api.scores_auto,
  }
  const mapped = mapDbRowToMapProcesso(merged)
  if (mapped) return mapped

  const p = api.processo as Record<string, unknown>
  const id = String(p.id ?? p.numero ?? '')
  const lat = Number(p.lat ?? 0)
  const lng = Number(p.lng ?? 0)
  const d = 0.001
  const geojson: Processo['geojson'] = {
    type: 'Feature',
    properties: { id },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng - d, lat - d],
          [lng + d, lat - d],
          [lng + d, lat + d],
          [lng - d, lat + d],
          [lng - d, lat - d],
        ],
      ],
    },
  }

  const sp = api.scores as
    | {
        dimensoes_risco?: Processo['dimensoes_risco_persistido']
        dimensoes_oportunidade?: Record<string, unknown> | null
        os_conservador?: number | null
        os_moderado?: number | null
        os_arrojado?: number | null
        os_label?: string | null
      }
    | null
    | undefined

  return {
    id,
    numero: String(p.numero ?? ''),
    regime: 'disponibilidade',
    fase: 'requerimento',
    substancia: String(p.substancia ?? '-'),
    is_mineral_estrategico: false,
    titular: String(p.titular ?? '-'),
    area_ha: Number(p.area_ha) || 0,
    uf: String(p.uf ?? ''),
    municipio: String(p.municipio ?? ''),
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    data_protocolo: String(p.data_protocolo ?? `${new Date().getFullYear()}-01-01`),
    ano_protocolo:
      p.ano_protocolo != null && Number.isFinite(Number(p.ano_protocolo))
        ? Number(p.ano_protocolo)
        : new Date().getFullYear(),
    situacao: 'ativo',
    risk_score: null,
    risk_breakdown: null,
    risk_decomposicao: null,
    valor_estimado_usd_mi: 0,
    ultimo_despacho_data: '',
    alertas: [],
    fiscal: {
      capag: 'C',
      receita_propria_mi: 0,
      divida_consolidada_mi: 0,
      incentivos_estaduais: [],
      linhas_bndes: [],
      observacao: '',
    },
    geojson,
    fromApi: true,
    dimensoes_risco_persistido: sp?.dimensoes_risco ?? null,
    dimensoes_oportunidade_persistido: sp?.dimensoes_oportunidade ?? null,
    os_conservador_persistido: sp?.os_conservador ?? null,
    os_moderado_persistido: sp?.os_moderado ?? null,
    os_arrojado_persistido: sp?.os_arrojado ?? null,
    os_label_persistido: sp?.os_label ?? null,
  }
}

function jsonStringifyIndent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function metaBase(numero: string, substancia: string) {
  return {
    numero,
    substancia,
    capturado_em: new Date().toISOString(),
  }
}

async function main(): Promise<void> {
  patchFetchForApiBase()
  mkdirSync(OUT_DIR, { recursive: true })

  const index: {
    capturado_em: string
    processos: Array<{
      numero: string
      arquivo: string | null
      status: 'ok' | 'erro'
      erro?: string
    }>
    resumo: { ok: number; erros: number }
  } = {
    capturado_em: new Date().toISOString(),
    processos: [],
    resumo: { ok: 0, erros: 0 },
  }

  const n = PROCESSOS_13.length
  let i = 0
  for (const numero of PROCESSOS_13) {
    i += 1
    const arquivo = `${sanitizeNumeroArquivo(numero)}.json`
    const outPath = path.join(OUT_DIR, arquivo)

    try {
      const rd: ReportData = await buildReportData(numero, 'pt')
      const api = await fetchProcessoCompleto(numero)
      const processo = processoFromApiCompleto(api)
      const substancia = String(
        (api.processo as Record<string, unknown>).substancia ?? rd.substancia_anm,
      )
      const relatorioData = relatorioDataFromReportData(rd, processo)

      const payload = {
        meta: metaBase(numero, substancia),
        reportData: rd,
        relatorioData,
      }
      writeFileSync(outPath, jsonStringifyIndent(payload), 'utf8')
      index.processos.push({ numero, arquivo, status: 'ok' })
      index.resumo.ok += 1
      console.log(`[${i}/${n}] ${numero} OK`)
    } catch (err: unknown) {
      const stack =
        err instanceof Error ? err.stack ?? err.message : String(err)
      const substancia = '-'
      const payloadErro = {
        meta: metaBase(numero, substancia),
        error: stack,
      }
      writeFileSync(outPath, jsonStringifyIndent(payloadErro), 'utf8')
      index.processos.push({
        numero,
        arquivo,
        status: 'erro',
        erro: err instanceof Error ? err.message : String(err),
      })
      index.resumo.erros += 1
      console.log(
        `[${i}/${n}] ${numero} ERRO: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  writeFileSync(
    path.join(OUT_DIR, '_index.json'),
    jsonStringifyIndent(index),
    'utf8',
  )

  console.log('')
  console.log('Snapshot gerado em tmp/snapshots/')
  console.log(`  ${index.resumo.ok}/${n} processos capturados com sucesso`)
  console.log(`  ${index.resumo.erros} erros`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
