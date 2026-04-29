import { closeIngestDouSql, ingerirData } from './ingestar_dou'

async function ingerirRange(dataInicio: string, dataFim: string) {
  const [diI, mI, aI] = dataInicio.split('-').map(Number)
  const [diF, mF, aF] = dataFim.split('-').map(Number)

  const inicio = new Date(aI, mI - 1, diI)
  const fim = new Date(aF, mF - 1, diF)

  const dias: string[] = []
  for (
    let d = new Date(inicio);
    d <= fim;
    d.setDate(d.getDate() + 1)
  ) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()

    if (d.getDay() === 0 || d.getDay() === 6) {
      console.log(`[${dd}-${mm}-${yyyy}] pulando fim de semana`)
      continue
    }

    dias.push(`${dd}-${mm}-${yyyy}`)
  }

  console.log(`Total de dias uteis a ingerir: ${dias.length}`)

  let totalIngeridos = 0
  let totalPulados = 0
  let totalErros = 0
  for (const data of dias) {
    try {
      const r = await ingerirData(data)
      totalIngeridos += r.ingeridos
      totalPulados += r.pulados
      totalErros += r.erros
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[${data}] erro fatal:`, msg)
      totalErros++
    }
  }

  console.log(`\n📊 RESUMO RANGE ${dataInicio} -> ${dataFim}`)
  console.log(`   Ingeridos: ${totalIngeridos}`)
  console.log(`   Pulados (dedup): ${totalPulados}`)
  console.log(`   Erros: ${totalErros}`)
}

const [, , dataInicio, dataFim] = process.argv
if (!dataInicio || !dataFim) {
  console.error('Uso: tsx ingestar_range.ts <DD-MM-AAAA> <DD-MM-AAAA>')
  process.exit(1)
}
;(async () => {
  try {
    await ingerirRange(dataInicio, dataFim)
    await closeIngestDouSql()
    process.exit(0)
  } catch (e) {
    console.error(e)
    await closeIngestDouSql().catch(() => {})
    process.exit(1)
  }
})()
