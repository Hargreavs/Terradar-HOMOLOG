import 'dotenv/config'
import { computeScoresAuto, getProcesso } from '../server/db'

const casos = [
  '880.041/1996',
  '864.231/2017',
  '852.145/1976',
  '833.391/2023',
  '820.701/2024',
]

for (const numero of casos) {
  let proc: { id?: string } | null = null
  try {
    proc = (await getProcesso(numero)) as { id?: string }
  } catch {
    proc = null
  }
  if (!proc?.id) {
    console.log(numero, '-> NAO ENCONTRADO')
    continue
  }
  try {
    const r = await computeScoresAuto(String(proc.id), { persist: false })
    console.log(
      numero,
      '->',
      JSON.stringify(
        {
          risk: r.risk_score,
          label: r.risk_label,
          dims: r.risk_breakdown,
          opp_cons: r.os_conservador,
          opp_mod: r.os_moderado,
          opp_arr: r.os_arrojado,
        },
        null,
        0,
      ),
    )
  } catch (e) {
    console.log(
      numero,
      '-> ERRO:',
      e instanceof Error ? e.message : String(e),
    )
  }
}
