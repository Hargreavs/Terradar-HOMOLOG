import { computeProcessoComBreakdown } from "../server/scoringMotorS31"

async function main() {
  const id = process.argv[2]
  if (!id) {
    console.error("Uso: npx tsx scripts/test-breakdown-1processo.ts <processo_id>")
    process.exit(1)
  }
  const out = await computeProcessoComBreakdown(id)
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})