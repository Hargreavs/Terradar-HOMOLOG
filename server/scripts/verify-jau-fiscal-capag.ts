/**
 * Uso: npx tsx server/scripts/verify-jau-fiscal-capag.ts
 * Conferência pós-ingestão 13.01 (Jaú do Tocantins IBGE 1711506).
 */
import '../env'
import { supabase } from '../supabase'

const IBGE = '1711506'

async function main() {
  const { data: fiscal, error: ef } = await supabase
    .from('fiscal_municipios')
    .select('*')
    .eq('municipio_ibge', IBGE)

  if (ef) console.error('fiscal_municipios:', ef.message)
  console.log('--- fiscal_municipios ---')
  console.log(JSON.stringify(fiscal, null, 2))

  const { data: capag, error: ec } = await supabase
    .from('capag_municipios')
    .select('*')
    .eq('municipio_ibge', IBGE)

  if (ec) console.error('capag_municipios:', ec.message)
  console.log('--- capag_municipios ---')
  console.log(JSON.stringify(capag, null, 2))

  const { data: proc } = await supabase
    .from('processos')
    .select('numero, municipio, municipio_ibge')
    .eq('numero', '864.231/2017')
    .maybeSingle()

  console.log('--- processo 864.231/2017 ---')
  console.log(JSON.stringify(proc, null, 2))
  if (proc?.municipio_ibge === IBGE) {
    const fn = fiscal?.[0]?.municipio_nome ?? 'SEM FISCAL'
    const cn = capag?.[0]?.municipio ?? 'SEM CAPAG'
    console.log('--- cruzamento (equivalente ao SQL do prompt) ---')
    console.log(
      `${proc.numero} | ${proc.municipio} | ${proc.municipio_ibge} | ${fn} | ${cn}`,
    )
  }
}

main().catch(console.error)
