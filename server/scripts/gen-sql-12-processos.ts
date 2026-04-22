/**
 * Gera tmp/insert-12-processos.sql a partir dos JSONs de extração.
 * Uso (raiz): npx tsx server/scripts/gen-sql-12-processos.ts
 */
import fs from 'fs'
import path from 'path'

import { NUMEROS_LISTA } from './extract-12-processos-numeros'

const ROOT = process.cwd()
const TMP = path.join(ROOT, 'tmp')
const PROC_JSON = path.join(TMP, 'processos-extraidos.json')
const GEO_JSON = path.join(TMP, 'poligonos-extraidos.json')
const OUT_SQL = path.join(TMP, 'insert-12-processos.sql')

interface EvRow {
  codigo: number
  descricao: string
  categoria: string | null
  data: string
  publicacao_dou: string
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
  eventos: EvRow[]
}

function sqlStr(s: string | null | undefined): string {
  if (s == null || s === '') return 'NULL'
  return "'" + String(s).replace(/'/g, "''") + "'"
}

function sqlNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return 'NULL'
  return String(n)
}

function sqlGeom(geo: GeoJSON.Geometry | undefined): string {
  if (!geo) return 'NULL'
  const j = JSON.stringify(geo)
  return `ST_SetSRID(ST_GeomFromGeoJSON(${sqlStr(j)}::text), 4326)`
}

async function main() {
  if (!fs.existsSync(PROC_JSON)) {
    console.error('Falta:', PROC_JSON, '— rode extract-12-processos.ts antes.')
    process.exit(1)
  }
  const processos = JSON.parse(
    fs.readFileSync(PROC_JSON, 'utf8'),
  ) as ProcessoExtraido[]

  const poligonos: Record<string, GeoJSON.Geometry> = fs.existsSync(GEO_JSON)
    ? (JSON.parse(fs.readFileSync(GEO_JSON, 'utf8')) as Record<
        string,
        GeoJSON.Geometry
      >)
    : {}

  const lines: string[] = []
  lines.push('-- TERRADAR: ingestão cirúrgica (NUPs alvo) — gerado por gen-sql-12-processos.ts')
  lines.push('-- Homolog: revisar antes de executar.')
  lines.push('BEGIN;')
  lines.push('')

  const numeros = processos.map((p) => p.numero)
  lines.push(
    `DELETE FROM processo_eventos WHERE processo_numero IN (${numeros.map((n) => sqlStr(n)).join(', ')});`,
  )
  lines.push('')

  let idx = 0
  for (const p of processos) {
    idx++
    const geo = poligonos[p.numero]
    const hasGeom = geo != null

    if (p.numero === '871.516/2011') {
      lines.push(
        `-- ${idx}/${processos.length}: ${p.numero} — UPDATE cnpj apenas (cadastro existente); eventos reimportados abaixo`,
      )
      lines.push(
        `UPDATE processos SET cnpj_titular = COALESCE(cnpj_titular, ${sqlStr(p.cnpj)}) WHERE numero = ${sqlStr(p.numero)} AND (cnpj_titular IS NULL OR cnpj_titular = '');`,
      )
      lines.push('')
      for (const ev of p.eventos) {
        lines.push(`INSERT INTO processo_eventos (
  processo_numero, evento_codigo, evento_descricao, evento_categoria,
  data_evento, observacao, publicacao_dou
) VALUES (
  ${sqlStr(p.numero)},
  ${sqlNum(ev.codigo)},
  ${sqlStr(ev.descricao)},
  ${ev.categoria != null ? sqlStr(ev.categoria) : 'NULL'},
  ${sqlStr(ev.data)}::date,
  NULL,
  ${sqlStr(ev.publicacao_dou)}
);`)
      }
      lines.push('')
      continue
    }

    lines.push(
      `-- ${idx}/${processos.length}: ${p.numero}${hasGeom ? ' OK geom' : ' SEM GEOM (SIGMINE)'}`,
    )

    const geomSql = sqlGeom(geo)
    const cnpjVal = p.cnpj && p.cnpj.trim() !== '' ? sqlStr(p.cnpj) : 'NULL'

    lines.push(`INSERT INTO processos (
  numero, titular, cnpj_titular, substancia, regime, fase,
  area_ha, uf, municipio, municipio_ibge, data_protocolo, nup_sei, geom
) VALUES (
  ${sqlStr(p.numero)},
  ${sqlStr(p.titular)},
  ${cnpjVal},
  ${sqlStr(p.substancia)},
  ${sqlStr(p.regime)},
  ${sqlStr(p.fase)},
  ${sqlNum(p.area_ha)},
  ${sqlStr(p.uf)},
  ${sqlStr(p.municipio)},
  ${sqlStr(String(p.municipio_ibge))},
  ${sqlStr(p.data_protocolo)}::date,
  ${sqlStr(p.nup_sei)},
  ${geomSql}
)
ON CONFLICT (numero) DO UPDATE SET
  titular = EXCLUDED.titular,
  cnpj_titular = COALESCE(EXCLUDED.cnpj_titular, processos.cnpj_titular),
  substancia = EXCLUDED.substancia,
  regime = EXCLUDED.regime,
  fase = EXCLUDED.fase,
  area_ha = EXCLUDED.area_ha,
  uf = EXCLUDED.uf,
  municipio = EXCLUDED.municipio,
  municipio_ibge = EXCLUDED.municipio_ibge,
  data_protocolo = EXCLUDED.data_protocolo,
  nup_sei = EXCLUDED.nup_sei,
  geom = COALESCE(EXCLUDED.geom, processos.geom);`)
    lines.push('')

    for (const ev of p.eventos) {
      lines.push(`INSERT INTO processo_eventos (
  processo_numero, evento_codigo, evento_descricao, evento_categoria,
  data_evento, observacao, publicacao_dou
) VALUES (
  ${sqlStr(p.numero)},
  ${sqlNum(ev.codigo)},
  ${sqlStr(ev.descricao)},
  ${ev.categoria != null ? sqlStr(ev.categoria) : 'NULL'},
  ${sqlStr(ev.data)}::date,
  NULL,
  ${sqlStr(ev.publicacao_dou)}
);`)
    }
    lines.push('')
  }

  lines.push('COMMIT;')
  lines.push('')
  lines.push('-- NUPs esperados:', NUMEROS_LISTA.join(', '))

  fs.writeFileSync(OUT_SQL, lines.join('\n'), 'utf8')
  console.log('Gerado:', OUT_SQL)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
