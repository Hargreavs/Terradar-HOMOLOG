/**
 * Auditoria: dados fiscais / processo no Supabase vs valores esperados no PDF.
 * Uso: npx tsx server/scripts/audit-fiscal-vs-pdf.ts [numero_processo]
 * Ex.: npx tsx server/scripts/audit-fiscal-vs-pdf.ts "860.232/1990"
 */
import '../env'
import { createClient } from '@supabase/supabase-js'

const numero = process.argv[2] ?? '860.232/1990'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

function fmtBrlMiFromReceitaTrib(n: number): string {
  return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Mi`
}

function fmtDivida(passivo: unknown): string {
  if (passivo === null || passivo === undefined || String(passivo).trim() === '') {
    return 'Não disponível'
  }
  const v = Number(passivo)
  if (Number.isNaN(v)) return 'Não disponível'
  if (v <= 0) return 'Sem dívida'
  return fmtBrlMiFromReceitaTrib(v)
}

async function main() {
  const { data: proc, error: e1 } = await supabase
    .from('processos')
    .select('*')
    .eq('numero', numero)
    .maybeSingle()

  if (e1 || !proc) {
    console.error('Processo:', numero, e1?.message ?? 'não encontrado')
    process.exit(1)
  }

  const ibge = String(proc.municipio_ibge ?? '')
  const substancia = String(proc.substancia ?? '')

  const [
    { data: fiscal },
    { data: capag },
    { data: cfem },
    { data: mercado },
    { data: linhas },
    { data: incentivosTo },
  ] = await Promise.all([
      supabase
        .from('fiscal_municipios')
        .select('*')
        .eq('municipio_ibge', ibge)
        .order('exercicio', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('capag_municipios')
        .select('*')
        .eq('municipio_ibge', ibge)
        .order('ano', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cfem_historico')
        .select('*')
        .eq('municipio_ibge', ibge)
        .order('ano', { ascending: true }),
      supabase
        .from('master_substancias')
        .select('*')
        .ilike('substancia_anm', substancia.trim())
        .limit(1)
        .maybeSingle(),
      supabase.from('linhas_bndes').select('*'),
      supabase.from('incentivos_uf').select('*').eq('uf', 'TO').maybeSingle(),
    ])

  const f = fiscal as Record<string, unknown> | null
  const receitaTrib = f?.receita_tributaria != null ? Number(f.receita_tributaria) : NaN
  const receitaPdf =
    !Number.isNaN(receitaTrib) && receitaTrib > 0 ? fmtBrlMiFromReceitaTrib(receitaTrib) : 'Não disponível'

  const dividaPdf = fmtDivida(f?.passivo_nao_circulante)

  const pibMi =
    f?.pib_municipal_mi != null && Number(f.pib_municipal_mi) > 0
      ? Number(f.pib_municipal_mi)
      : null
  const pibStr =
    pibMi != null
      ? `R$ ${pibMi.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} Mi`
      : 'Não disponível'

  const dep =
    f?.dep_transferencias_pct != null
      ? `${Number(f.dep_transferencias_pct).toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : 'Não disponível'

  const pop =
    f?.populacao != null && Number(f.populacao) > 0
      ? `${Number(f.populacao).toLocaleString('pt-BR')} hab.`
      : 'Não disponível'

  const idhStr =
    f?.idh != null && String(f.idh).trim() !== ''
      ? Number(f.idh).toLocaleString('pt-BR', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })
      : 'Não disponível'

  const capagStr = capag?.nota != null ? String(capag.nota) : 'Não disponível'

  const isMineralEstrategico = Boolean(
    (mercado as { mineral_critico_2025?: unknown } | null)?.mineral_critico_2025,
  )
  const isLinhaMineraisEstrategicos = (linhaCol: string) =>
    /minerais\s+estrat[eé]gicos/i.test(linhaCol)
  const linhasFiltradas = (linhas ?? []).filter((r) => {
    if (isMineralEstrategico) return true
    const linha = String((r as { linha?: unknown }).linha ?? '').trim()
    return !isLinhaMineraisEstrategicos(linha)
  })
  const linhasCount = linhasFiltradas.length

  console.log('=== RAW Supabase (processo', numero, ') ===')
  console.log(JSON.stringify({ processo: proc, fiscal: f, capag, cfem_rows: cfem?.length }, null, 2))

  console.log('\n=== Formatação alinhada ao PDF (reportDataBuilder) ===')
  console.log(
    JSON.stringify(
      {
        capag_nota: capagStr,
        receita_propria: receitaPdf,
        divida: dividaPdf,
        pib_municipal: pibStr,
        dependencia_transf: dep + ' da receita corrente',
        populacao: pop,
        idh: idhStr,
        linhas_bndes_count: linhasCount,
        programa_estadual_TO: incentivosTo?.programas ?? null,
        fase: proc.fase,
        regime: proc.regime,
        area_ha: proc.area_ha,
        titular: proc.titular,
        estrategia_nacional_db: mercado?.estrategia_nacional ?? null,
      },
      null,
      2,
    ),
  )

  console.log('\n=== CFEM histórico (município IBGE', ibge, ') ===')
  for (const row of cfem ?? []) {
    const r = row as { ano?: unknown; valor_brl?: unknown }
    console.log(`${r.ano}: R$ ${Number(r.valor_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
