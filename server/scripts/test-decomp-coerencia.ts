import 'dotenv/config'

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3001'

const TOLERANCIA = 0.5

type GabaritoRow = {
  uuid: string
  numero: string
  rs: number | null
  dim_risco: [number, number, number, number] | null
  os: [number, number, number] | null
}

const GABARITO: GabaritoRow[] = [
  {
    uuid: '176e3ee1-9e22-4509-ad3c-63b0f346f83c',
    numero: '300.279/2022',
    rs: 31,
    dim_risco: [50, 6, 52, 18.3],
    os: [38, 33, 65],
  },
  {
    uuid: '4ac7d5d6-5b65-4282-87b8-fed90c7ce87d',
    numero: '800.256/1978',
    rs: null,
    dim_risco: null,
    os: null,
  },
  {
    uuid: '5ae286f0-8b5e-4061-a5dc-b4f282cd9b74',
    numero: '808.954/1975',
    rs: null,
    dim_risco: null,
    os: null,
  },
  {
    uuid: '175ab6fb-7d34-4ada-bf37-f9af55507d6d',
    numero: '860.532/2024',
    rs: 23,
    dim_risco: [59, 6, 14, 14.5],
    os: [98, 51, 69],
  },
  {
    uuid: '1b5e9b60-30bf-469a-8028-74305afa26c4',
    numero: '870.102/1999',
    rs: 18,
    dim_risco: [30, 13, 16, 11.5],
    os: [39, 48, 71],
  },
]

const DIMS: ReadonlyArray<{
  key: string
  get: (
    data: Record<string, unknown>,
  ) => { valor: number; subfatores: { valor: number; peso_pct: number | null }[] } | null
}> = [
  {
    key: 'geo',
    get: (d) => {
      const x = (
        (d['dimensoes_risco'] as Record<string, unknown> | undefined)?.['geologico'] ??
        undefined
      ) as { valor?: number; subfatores?: unknown } | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
  {
    key: 'amb',
    get: (d) => {
      const x = (d['dimensoes_risco'] as Record<string, unknown>)?.[
        'ambiental'
      ] as { valor?: number; subfatores?: unknown } | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
  {
    key: 'soc',
    get: (d) => {
      const x = (d['dimensoes_risco'] as Record<string, unknown>)?.['social'] as
        | { valor?: number; subfatores?: unknown }
        | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
  {
    key: 'reg',
    get: (d) => {
      const x = (d['dimensoes_risco'] as Record<string, unknown>)?.[
        'regulatorio'
      ] as { valor?: number; subfatores?: unknown } | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
  {
    key: 'atr',
    get: (d) => {
      const x = (d['dimensoes_oportunidade'] as Record<string, unknown>)?.[
        'atratividade'
      ] as { valor?: number; subfatores?: unknown } | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
  {
    key: 'via',
    get: (d) => {
      const x = (d['dimensoes_oportunidade'] as Record<string, unknown>)?.[
        'viabilidade'
      ] as { valor?: number; subfatores?: unknown } | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
  {
    key: 'seg',
    get: (d) => {
      const x = (d['dimensoes_oportunidade'] as Record<string, unknown>)?.[
        'seguranca'
      ] as { valor?: number; subfatores?: unknown } | undefined
      if (!x?.subfatores) return null
      return {
        valor: Number(x.valor),
        subfatores: x.subfatores as { valor: number; peso_pct: number | null }[],
      }
    },
  },
]

function somaPonderada(
  subfatores: { valor: number; peso_pct: number | null }[],
): { soma: number; bonus: number } {
  let soma = 0
  let bonus = 0
  for (const s of subfatores) {
    if (s.peso_pct === null) bonus += s.valor
    else soma += s.valor
  }
  return { soma, bonus }
}

function coherenceOk(dim: ReturnType<(typeof DIMS)[number]['get']>): boolean {
  if (!dim) return false
  const { soma, bonus } = somaPonderada(dim.subfatores)
  const total = soma + bonus
  const diff = Math.abs(total - dim.valor)
  return diff <= TOLERANCIA
}

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length)
}

async function main() {
  console.log('=== TESTE DE DECOMP — COERENCIA (Trabalho 3.2) ===\n')
  console.log(`BASE_URL=${BASE_URL}\n`)

  const matrix: boolean[][] = DIMS.map(() => [])
  const procMs: number[] = []
  const aggDetails: Array<
    Array<{ nome: string; ok: boolean; esp?: number; obt?: number }>
  > = []

  for (let pi = 0; pi < GABARITO.length; pi++) {
    const proc = GABARITO[pi]!
    const url = `${BASE_URL}/api/processos/${proc.uuid}/score-breakdown`
    const t0 = Date.now()

    let data: Record<string, unknown>
    try {
      const resp = await fetch(url)
      procMs.push(Date.now() - t0)
      if (!resp.ok) {
        console.error(`FAIL ${proc.numero}: HTTP ${resp.status}`)
        for (let di = 0; di < DIMS.length; di++) matrix[di]![pi] = false
        aggDetails.push([])
        continue
      }
      data = (await resp.json()) as Record<string, unknown>
    } catch (e) {
      procMs.push(Date.now() - t0)
      console.error(`FAIL ${proc.numero}:`, e)
      for (let di = 0; di < DIMS.length; di++) matrix[di]![pi] = false
      aggDetails.push([])
      continue
    }

    for (let di = 0; di < DIMS.length; di++) {
      const dim = DIMS[di]!.get(data)
      matrix[di]![pi] = coherenceOk(dim)
    }

    const checks: Array<{ nome: string; ok: boolean; esp?: number; obt?: number }> =
      []
    if (proc.rs !== null && proc.dim_risco !== null && proc.os !== null) {
      const rsEsp = proc.rs
      const rsObt = Number(data['risk_score'])
      checks.push({
        nome: 'risk_score',
        ok: Math.abs(rsObt - rsEsp!) <= TOLERANCIA,
        esp: rsEsp!,
        obt: rsObt,
      })

      const rb = data['risk_breakdown'] as Record<string, number> | undefined
      const dk = ['geologico', 'ambiental', 'social', 'regulatorio'] as const
      for (let i = 0; i < 4; i++) {
        const k = dk[i]!
        const esp = proc.dim_risco![i]!
        const obt = rb?.[k] ?? NaN
        checks.push({
          nome: `risk_breakdown.${k}`,
          ok: Number.isFinite(obt) && Math.abs(obt - esp) <= TOLERANCIA,
          esp,
          obt,
        })
      }

      const ob = data['os_breakdown'] as
        | Record<string, number>
        | undefined
        | null
      const osp = proc.os!

      checks.push({
        nome: 'os_breakdown.atratividade',
        ok:
          ob != null &&
          Math.abs((ob['atratividade'] ?? NaN) - osp[0]!) <= TOLERANCIA,
        esp: osp[0]!,
        obt: ob?.['atratividade'],
      })
      checks.push({
        nome: 'os_breakdown.viabilidade',
        ok:
          ob != null &&
          Math.abs((ob['viabilidade'] ?? NaN) - osp[1]!) <= TOLERANCIA,
        esp: osp[1]!,
        obt: ob?.['viabilidade'],
      })
      checks.push({
        nome: 'os_breakdown.seguranca',
        ok:
          ob != null &&
          Math.abs((ob['seguranca'] ?? NaN) - osp[2]!) <= TOLERANCIA,
        esp: osp[2]!,
        obt: ob?.['seguranca'],
      })
    }

    aggDetails.push(checks)
  }

  const colW = 16
  const dimW = 6

  console.log(`${pad('', dimW)}` + GABARITO.map((p) => pad(p.numero, colW)).join(''))
  console.log('-'.repeat(dimW + GABARITO.length * colW))

  for (let di = 0; di < DIMS.length; di++) {
    const rowLabel = DIMS[di]!.key
    let row = `${pad(rowLabel, dimW)}`
    for (let pi = 0; pi < GABARITO.length; pi++) {
      row += pad(matrix[di]![pi]! ? 'OK' : 'FAIL', colW)
    }
    console.log(row)
  }

  console.log('\nTempos HTTP (ms)')
  GABARITO.forEach((p, i) => {
    console.log(`  ${p.numero}: ${procMs[i] ?? '?'}`)
  })

  console.log('\nAggregados vs gabarito (3 proc com valores esperados)')

  for (let pi = 0; pi < GABARITO.length; pi++) {
    const proc = GABARITO[pi]!
    const checks = aggDetails[pi]!
    if (!checks?.length) {
      console.log(
        `${proc.numero}: aggregados ignorados (motor atual vs gabarito de massa)`,
      )
      continue
    }
    console.log(`${proc.numero}:`)
    for (const c of checks) {
      const tag = c.ok ? 'OK' : 'FAIL'
      const tail =
        c.esp !== undefined && c.obt !== undefined
          ? ` esp=${c.esp} obt=${c.obt}`
          : ''
      console.log(`  [${tag}] ${c.nome}${tail}`)
    }
  }

  const cohTotal = DIMS.length * GABARITO.length
  let cohOk = 0
  for (let di = 0; di < DIMS.length; di++) {
    for (let pi = 0; pi < GABARITO.length; pi++) {
      if (matrix[di]![pi]!) cohOk++
    }
  }

  let aggOkTotal = 0
  let aggCnt = 0
  for (const checks of aggDetails) {
    for (const c of checks) {
      aggCnt++
      if (c.ok) aggOkTotal++
    }
  }

  console.log('\n=== RESUMO ===')
  console.log(`coh interno 7x5: ${cohOk}/${cohTotal}`)
  console.log(`aggregados  (8 checks x 3 proc = 24): ${aggOkTotal}/${aggCnt}`)

  let noteLine = `${cohOk}/${cohTotal} OK coerencia interna`
  const failures: string[] = []
  for (let di = 0; di < DIMS.length; di++) {
    for (let pi = 0; pi < GABARITO.length; pi++) {
      if (!matrix[di]![pi]!)
        failures.push(`${DIMS[di]!.key}:${GABARITO[pi]!.numero}`)
    }
  }
  if (!failures.length) noteLine += '; nenhuma celula falhou.'
  else
    noteLine += ` divergencias: ${failures.join('; ')}`

  if (aggCnt)
    noteLine += ` Aggregados gabarito: ${aggOkTotal}/${aggCnt} esperado 24 OK nos 3 processos.`

  console.log('\nFINAL:', noteLine)
  console.log('=== FIM ===\n')

  if (cohOk < cohTotal || aggOkTotal < aggCnt) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
