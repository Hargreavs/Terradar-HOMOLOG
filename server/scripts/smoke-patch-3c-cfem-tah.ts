/**
 * Smoke PATCH_3C: valida que `cfem_arrecadacao` e `tah_pagamentos` expõem
 * a coluna `processo_numero` (e que o agregado CFEM bate com loadCfem do motor S31).
 *
 * Uso (3 processos, ou passar os seus):
 *   npx tsx server/scripts/smoke-patch-3c-cfem-tah.ts
 *   npx tsx server/scripts/smoke-patch-3c-cfem-tah.ts "864.231/2017" "123.456/2020" "9.999/1999"
 *
 * Requer DATABASE_URL (ou VITE_DATABASE_URL) com acesso direto ao Postgres
 * (igual ao motor S31 em server/scoringMotorS31.ts).
 */
import '../env'
import postgres from 'postgres'
import { loadCfem } from '../scoringMotorS31'

const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
if (!dbUrl) {
  console.error('Defina DATABASE_URL ou VITE_DATABASE_URL no .env')
  process.exit(1)
}

const sql = postgres(dbUrl, {
  max: 2,
  idle_timeout: 0,
  connect_timeout: 30,
  prepare: false,
  ssl: /supabase|amazonaws/i.test(dbUrl) ? 'require' : false,
})

const DEFAULT_TRIPLE = ['864.231/2017', '857.854/1996', '850.280/1991'] as const

async function main() {
  const args = process.argv.slice(2).filter((a) => a.length > 0)
  const numeros = (args.length ? args : [...DEFAULT_TRIPLE]) as string[]

  if (numeros.length < 1) {
    console.error('Informe ao menos um número de processo.')
    process.exit(1)
  }

  let fail = 0
  for (const numero of numeros) {
    try {
      const rCfem = (await sql`
        SELECT COALESCE(SUM(valor_recolhido), 0)::float8 AS t
        FROM cfem_arrecadacao
        WHERE processo_numero = ${numero}
      `) as { t: string }[]

      const rTah = (await sql`
        SELECT count(*)::int AS c
        FROM tah_pagamentos
        WHERE processo_numero = ${numero}
      `) as { c: number }[]

      const sumDirect = Number(rCfem[0]?.t ?? 0)
      const fromMotor = await loadCfem(numero)
      const tahN = rTah[0]?.c ?? 0
      const delta = Math.abs(sumDirect - fromMotor) < 1e-6

      console.log(
        JSON.stringify(
          {
            processo: numero,
            cfem_soma_valor_recolhido: sumDirect,
            loadCfem: fromMotor,
            motor_bate: delta,
            tah_linhas: tahN,
          },
          null,
          0,
        ),
      )

      if (!delta) {
        console.error(
          `  [ERRO] Divergência direct SQL vs loadCfem para ${numero}`,
        )
        fail++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  [ERRO] ${numero}: ${msg}`)
      if (
        /processo_anm_numero|42703|column .+ does not exist/i.test(msg)
      ) {
        console.error(
          '  Dica: aplicar migration supabase/migrations/20260423130000_patch_3c_cfem_tah_processo_numero.sql',
        )
      }
      fail++
    }
  }

  await sql.end({ timeout: 5 })
  if (fail > 0) {
    process.exit(1)
  }
  console.log('smoke patch-3c: OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
