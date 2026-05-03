/**
 * Converte `ReportData` (API / buildReportData) no formato `RelatorioData` do drawer.
 */
import type {
  BiomaRelatorio,
  CapagEstruturado,
  CfemHistorico,
  CfemMunicipalHistorico,
  DadosANM,
  DadosFiscaisRicos,
  DadosTerritoriais,
  IntelMineral,
  ObservacoesTecnicas,
  ObservacoesTecnicasItem,
  PerfilOportunidadeMock,
  RelatorioData,
  RelatorioOportunidadeData,
  Timestamps,
  VariavelOportunidadeMock,
} from '../data/relatorio.mock'
import type { MasterSubstancia, ReportData } from './reportTypes'
import type { Processo } from '../types'
import { buildAtratividadeItemsS31 } from './s31SubfatorDecomp'
import {
  PESOS_OS_POR_PERFIL,
  corFaixaOS,
  labelFaixaOS,
} from './oportunidadeRelatorioUi'
import {
  capagBadgeLetra,
  normalizeCapagNotaDisplay,
  parseDividaMiFromTextoNullable,
  parsePercentFromDependencia,
  parsePibMunicipalMiFromTextoNullable,
  parseReceitaPropriaMiFromTextoNullable,
} from './fiscalDisplay'
import { piorIndicadorCapag } from './capagPiorIndicador'
import { haversineKm } from './geoHaversine'
import { centroideMunicipioSedeIbge } from './municipioSedeCentroideIbge'
import { getCfemProcessoStatus } from './cfemProcessoStatus'
import { formatCNPJ } from './formatCnpj'
import { infraestruturaComOperacaoDeclarada } from './processoStatus'
import { normalizarSeparadoresRotuloDb } from './normalizarRotuloScore'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

/** Diferença em anos civis aproximados (protocolo → último evento), para processos extintos. */
function anosEntreDatasIso(dataIni: string, dataFim: string): number | null {
  const m0 = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIni.trim())
  const m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataFim.trim())
  if (!m0 || !m1) return null
  const t0 = Date.UTC(Number(m0[1]), Number(m0[2]) - 1, Number(m0[3]))
  const t1 = Date.UTC(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]))
  const ms = t1 - t0
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms / (365.25 * 24 * 60 * 60 * 1000)
}

function parsePtBrMoney(raw: string): number {
  const t = raw.replace(/R\$\s*/i, '').trim()
  if (!t) return 0
  const n = Number(
    t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''),
  )
  return Number.isFinite(n) ? n : 0
}

/** Master de substâncias: texto com `;`, quebras de linha ou marcadores. */
function parseAplicacoesSubstancia(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return []
  return String(raw)
    .split(/[;\n\u2022]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function biomaFromString(raw: string): BiomaRelatorio | string {
  const t = raw.split(',')[0]?.trim() ?? ''
  const u = t.toLowerCase()
  if (u.includes('cerrado')) return 'Cerrado'
  if (u.includes('amazônia') || u.includes('amazonia')) return 'Amazônia'
  if (u.includes('mata atlântica') || u.includes('mata atlantica')) {
    return 'Mata Atlântica'
  }
  if (u.includes('caatinga')) return 'Caatinga'
  if (u.includes('pampa')) return 'Pampa'
  if (u.includes('pantanal')) return 'Pantanal'
  return t || 'Cerrado'
}

function territorialFromReport(
  rd: ReportData,
  processo: Processo,
): DadosTerritoriais {
  let distancia_ti_km: number | null = null
  let nome_ti_proxima: string | null = null
  let distancia_uc_pi_km: number | null = null
  let nome_uc_pi_proxima: string | null = null
  let tipo_uc_pi: string | null = null
  let distancia_uc_us_km: number | null = null
  let nome_uc_us_proxima: string | null = null
  let tipo_uc_us: string | null = null
  let distancia_quilombola_km: number | null = null
  let nome_quilombola_proximo: string | null = null
  let distancia_assentamento_km: number | null = null
  let nome_assentamento_proximo: string | null = null
  let fase_assentamento_incr: string | null = null

  const considerPi = (tipo: string) =>
    /\bPI\b|PARNA|ESEC|REBIO|MONA|REVIS|Proteção integral/i.test(tipo)
  const considerUs = (tipo: string) =>
    /US\s*\(|APA|ARIE|RDS|RESEX|FLONA|RPPN|Uso sustentável/i.test(tipo)

  for (const L of rd.layers) {
    const t = L.tipo
    if (t.includes('Terra Indígena')) {
      if (
        distancia_ti_km == null ||
        L.distancia_km < (distancia_ti_km ?? 1e9)
      ) {
        distancia_ti_km = L.distancia_km
        nome_ti_proxima = L.nome
      }
    } else if (/Quilombola/i.test(t)) {
      if (
        distancia_quilombola_km == null ||
        L.distancia_km < (distancia_quilombola_km ?? 1e9)
      ) {
        distancia_quilombola_km = L.distancia_km
        nome_quilombola_proximo = L.nome
      }
    } else if (t === 'Assentamento INCRA') {
      if (
        distancia_assentamento_km == null ||
        L.distancia_km < (distancia_assentamento_km ?? 1e9)
      ) {
        distancia_assentamento_km = L.distancia_km
        nome_assentamento_proximo = L.nome
        const ph = L.detalhes?.trim()
        fase_assentamento_incr = ph && ph !== '' ? ph : null
      }
    } else if (t.startsWith('UC') || t.includes('UC ')) {
      if (considerPi(t)) {
        if (
          nome_uc_pi_proxima == null ||
          L.distancia_km < (distancia_uc_pi_km ?? 1e9)
        ) {
          distancia_uc_pi_km = L.distancia_km
          nome_uc_pi_proxima = L.nome
          tipo_uc_pi = t
        }
      } else if (considerUs(t)) {
        if (
          nome_uc_us_proxima == null ||
          L.distancia_km < (distancia_uc_us_km ?? 1e9)
        ) {
          distancia_uc_us_km = L.distancia_km
          nome_uc_us_proxima = L.nome
          tipo_uc_us = t
        }
      }
    }
  }

  let nome_aquifero: string | null = null
  let distancia_aquifero_km: number | null = null
  let unidade_hidro_aq: string | null = null
  let sobreposicao_aquifero = false
  for (const L of rd.layers) {
    if (/aqu[ií]fero/i.test(L.tipo)) {
      const d = L.distancia_km
      const sobre = L.sobreposto || d <= 0.05
      if (
        nome_aquifero == null ||
        d < (distancia_aquifero_km ?? 1e9)
      ) {
        nome_aquifero = L.nome
        distancia_aquifero_km = d
        unidade_hidro_aq = L.detalhes?.trim() || null
        sobreposicao_aquifero = sobre
      }
    }
  }

  let distancia_ferrovia_km: number | null = null
  let nome_ferrovia: string | null = null
  let ferroviaApenasProjetoEmEstudo = false
  let distancia_ferrovia_operacional_km: number | null = null
  let distancia_rodovia_km: number | null = null
  let nome_rodovia: string | null = null
  let distancia_porto_km: number | null = null
  let nome_porto: string | null = null
  let uf_porto = ''

  const infraOp = infraestruturaComOperacaoDeclarada(rd.infraestrutura)
  for (const inf of infraOp) {
    if (inf.tipo === 'Ferrovia') {
      if (
        distancia_ferrovia_operacional_km == null ||
        inf.distancia_km < distancia_ferrovia_operacional_km
      ) {
        distancia_ferrovia_operacional_km = inf.distancia_km
      }
    }
  }

  for (const inf of rd.infraestrutura) {
    if (inf.tipo === 'Ferrovia') {
      if (
        distancia_ferrovia_km == null ||
        inf.distancia_km < distancia_ferrovia_km
      ) {
        distancia_ferrovia_km = inf.distancia_km
        nome_ferrovia = inf.nome
        ferroviaApenasProjetoEmEstudo =
          (inf.detalhes ?? '').trim() === 'Estudo'
      }
    }
    if (inf.tipo === 'Rodovia') {
      if (
        nome_rodovia == null ||
        inf.distancia_km < (distancia_rodovia_km ?? Infinity)
      ) {
        distancia_rodovia_km = inf.distancia_km
        nome_rodovia = inf.nome
      }
    }
    if (inf.tipo === 'Porto') {
      if (distancia_porto_km == null || inf.distancia_km < distancia_porto_km) {
        distancia_porto_km = inf.distancia_km
        nome_porto = inf.nome
        uf_porto = inf.detalhes || ''
      }
    }
  }

  const sedeNomeRpc = rd.sede?.nome?.trim() ?? ''
  let nome_sede_pref = sedeNomeRpc || (processo.municipio ?? '')

  let distancia_sede_km: number | undefined
  const rpcKm = rd.sede?.distancia_km
  if (rpcKm != null && Number.isFinite(Number(rpcKm))) {
    distancia_sede_km = Number(rpcKm)
  }

  if (distancia_sede_km === undefined) {
    for (const L of rd.layers) {
      if (/sede/i.test(L.tipo)) {
        const d = L.distancia_km
        if (distancia_sede_km === undefined || d < distancia_sede_km) {
          distancia_sede_km = d
          if (L.nome?.trim() && !sedeNomeRpc) nome_sede_pref = L.nome.trim()
        }
      }
    }
  }
  if (distancia_sede_km === undefined) {
    for (const inf of rd.infraestrutura) {
      if (/sede/i.test(inf.tipo)) {
        const d = inf.distancia_km
        if (distancia_sede_km === undefined || d < distancia_sede_km) {
          distancia_sede_km = d
          if (inf.nome?.trim() && !sedeNomeRpc) nome_sede_pref = inf.nome.trim()
        }
      }
    }
  }

  if (
    distancia_sede_km === undefined &&
    Number.isFinite(processo.lat) &&
    Number.isFinite(processo.lng)
  ) {
    const c = centroideMunicipioSedeIbge(processo.municipio, processo.uf)
    if (c) {
      distancia_sede_km = haversineKm(
        processo.lat,
        processo.lng,
        c.lat,
        c.lng,
      )
    }
  }

  const dTiDenorm = processo.dist_ti
  if (dTiDenorm != null && Number.isFinite(Number(dTiDenorm))) {
    distancia_ti_km = Number(dTiDenorm)
  }
  const dUcDenorm = processo.dist_uc
  if (dUcDenorm != null && Number.isFinite(Number(dUcDenorm))) {
    distancia_uc_us_km = Number(dUcDenorm)
  }
  const dAqDenorm = processo.dist_aquifero
  if (dAqDenorm != null && Number.isFinite(Number(dAqDenorm))) {
    distancia_aquifero_km = Number(dAqDenorm)
    if (Number(dAqDenorm) === 0) sobreposicao_aquifero = true
  }
  const dFvDenorm = processo.dist_ferrovia
  if (dFvDenorm != null && Number.isFinite(Number(dFvDenorm))) {
    const df = Number(dFvDenorm)
    distancia_ferrovia_km = df
    distancia_ferrovia_operacional_km = df
  }

  let assent_sobreposicao_pct: number | null = null
  const tex = rd.territorial_extras
  if (tex) {
    if (
      tex.assent_sobreposicao_pct != null &&
      Number.isFinite(Number(tex.assent_sobreposicao_pct))
    ) {
      assent_sobreposicao_pct = Number(tex.assent_sobreposicao_pct)
    }
    if (tex.assent_nome != null && String(tex.assent_nome).trim() !== '') {
      nome_assentamento_proximo = String(tex.assent_nome).trim()
    }
    if (
      tex.assent_distancia_km != null &&
      Number.isFinite(Number(tex.assent_distancia_km))
    ) {
      distancia_assentamento_km = Number(tex.assent_distancia_km)
    }
  }

  return {
    distancia_ti_km,
    nome_ti_proxima,
    fase_ti: null,
    distancia_uc_km:
      nome_uc_us_proxima || distancia_uc_us_km != null
        ? distancia_uc_us_km
        : null,
    nome_uc_proxima: nome_uc_us_proxima ?? nome_uc_pi_proxima,
    tipo_uc: tipo_uc_us ?? tipo_uc_pi,
    nome_uc_us_proxima,
    tipo_uc_us,
    distancia_uc_us_km,
    nome_uc_pi_proxima,
    tipo_uc_pi,
    distancia_uc_pi_km,
    distancia_aquifero_km,
    nome_aquifero,
    unidade_hidrogeologica: unidade_hidro_aq,
    litologia_aquifero: null,
    espessura_aquifero: null,
    vazao_aquifero: null,
    produtividade_aquifero: null,
    sobreposicao_aquifero,
    bioma: biomaFromString(rd.bioma) as BiomaRelatorio,
    distancia_sede_municipal_km: distancia_sede_km,
    distancia_sede_km,
    nome_sede: nome_sede_pref,
    distancia_ferrovia_km,
    nome_ferrovia,
    ferrovia_apenas_projeto_em_estudo: ferroviaApenasProjetoEmEstudo,
    distancia_ferrovia_operacional_km,
    situacao_ferrovia: 'Não disponível',
    bitola_ferrovia: '',
    uf_ferrovia: '',
    nome_rodovia: nome_rodovia ?? undefined,
    tipo_rodovia: '',
    uf_rodovia: '',
    distancia_rodovia_km:
      nome_rodovia != null && nome_rodovia !== ''
        ? (distancia_rodovia_km ?? 0)
        : undefined,
    distancia_porto_km,
    nome_porto,
    tipo_porto: '',
    uf_porto,
    rio_porto: '',
    sobreposicao_app: false,
    observacao_app: null,
    sobreposicao_quilombola: false,
    nome_quilombola: nome_quilombola_proximo,
    nome_quilombola_proximo,
    uf_quilombola: null,
    municipios_quilombola: null,
    area_ha_quilombola: null,
    familias_quilombola: null,
    fase_quilombola: null,
    responsavel_quilombola: null,
    esfera_quilombola: null,
    distancia_quilombola_km,
    nome_assentamento_proximo,
    fase_assentamento_incr,
    distancia_assentamento_km,
    assent_sobreposicao_pct,
  }
}

function unidadePrecoIntelDrawer(
  rd: ReportData,
  nomeSubstancia: string,
): IntelMineral['unidade_preco'] {
  const isOuro =
    nomeSubstancia.length > 0 && nomeSubstancia.toUpperCase().includes('OURO')
  if (isOuro) return 'oz'
  const u = String(rd.preco_unidade_label ?? 't').trim().toLowerCase()
  if (u === 'oz') return 'oz'
  if (u === 'lb') return 'lb'
  if (u === 'ct') return 'ct'
  if (u === 'l' || u.startsWith('litro')) return 'L'
  return 't'
}

/** Chip de tendência: sem `null` falsos — ausência real ⇒ `null` (UI omite chip). */
function tendenciaPrecoIntelFromReport(
  rd: ReportData,
): IntelMineral['tendencia_preco'] | null {
  const raw = String(rd.mercado_tendencia ?? '').trim()
  const rl = raw.toLowerCase()
  const isNd =
    raw === '' ||
    rl === 'n/d' ||
    rl === 'n/a' ||
    raw === '\u2014' ||
    raw === '-' ||
    rl === 'not available'
  if (!isNd) {
    if (rl.includes('alta') || rl.includes('high') || rl.includes('rise'))
      return 'alta'
    if (
      rl.includes('queda') ||
      rl.includes('baixa') ||
      rl.includes('fall') ||
      rl.includes('declin')
    )
      return 'queda'
    if (
      rl.includes('estável') ||
      rl.includes('estavel') ||
      rl.includes('stable') ||
      rl.includes('flat')
    )
      return 'estavel'
  }
  const v12 = rd.var_12m_pct
  if (v12 == null) return null
  return v12 > 0.5 ? 'alta' : v12 < -0.5 ? 'queda' : 'estavel'
}

function intelFromReport(rd: ReportData, processo: Processo): IntelMineral {
  const tendenciaPrecoUi = tendenciaPrecoIntelFromReport(rd)

  const nomeSub = rd.substancia_anm.trim()
  const isOuro =
    nomeSub.length > 0 && nomeSub.toUpperCase().includes('OURO')

  /** Sem spot/cotação válida ⇒ `null`, nunca `0` enganoso. */
  let preco_medio_usd_t: number | null = null
  if (isOuro && rd.preco_oz_usd > 0) {
    preco_medio_usd_t = rd.preco_oz_usd * 32_151
  } else if (!isOuro && rd.preco_spot_usd_t > 0) {
    preco_medio_usd_t = rd.preco_spot_usd_t
  }

  /** USD/oz apenas quando preço em onça é válido; evita 0 como “ausência”. */
  const preco_referencia_usd_oz: number | null =
    rd.preco_oz_usd > 0 ? rd.preco_oz_usd : null

  /** In-situ positivo publicado; caso contrário `null` (ausente), nunca 0 forçado aqui. */
  let valor_estimado_usd_ha: number | null = null
  let valor_estimado_brl_ha: number | null = null
  const insitu = rd.valor_insitu_usd_ha
  if (insitu != null && Number.isFinite(insitu) && insitu > 0) {
    valor_estimado_usd_ha = insitu
    valor_estimado_brl_ha = rd.ptax > 0 ? insitu * rd.ptax : null
  }

  const familiaIntel =
    typeof processo.substancia_familia === 'string' &&
    processo.substancia_familia.trim() !== ''
      ? processo.substancia_familia.trim()
      : null

  const rawAplicacoesSubst =
    rd.aplicacoes_substancia != null &&
    String(rd.aplicacoes_substancia).trim() !== ''
      ? String(rd.aplicacoes_substancia).trim()
      : null
  const aplicacoesPars = parseAplicacoesSubstancia(
    rd.aplicacoes_substancia ?? null,
  )

  return {
    substancia_contexto: rd.substancia_anm,
    familia: familiaIntel,
    fonte_preco: rd.fonte_preco,
    fonte_res_prod: rd.fonte_res_prod,
    reservas_br_pct_dado: rd.reservas_br_pct_raw ?? null,
    producao_br_pct_dado: rd.producao_br_pct_raw ?? null,
    preco_brl_por_t_legacy: rd.preco_brl_por_t,
    preco_brl_por_g_legacy:
      rd.preco_g_brl > 0 && Number.isFinite(rd.preco_g_brl)
        ? rd.preco_g_brl
        : null,
    tipo_mercado: rd.tipo_mercado ?? null,
    producao_br_absoluta_t: rd.producao_br_absoluta_t ?? null,
    valor_producao_br_brl: rd.valor_producao_br_brl ?? null,
    preco_medio_br_brl_t: rd.preco_medio_br_brl_t ?? null,
    top_uf_produtora: rd.top_uf_produtora ?? null,
    top_uf_pct: rd.top_uf_pct ?? null,
    ano_referencia_amb: rd.ano_referencia_amb ?? null,
    reservas_brasil_mundial_pct: rd.reservas_mundiais_pct,
    producao_brasil_mundial_pct: rd.producao_mundial_pct,
    demanda_projetada_2030:
      'Projeção elaborada com base em fontes oficiais de mercado e referências setoriais',
    preco_medio_usd_t,
    unidade_preco: unidadePrecoIntelDrawer(rd, nomeSub),
    preco_referencia_usd_oz,
    tendencia_preco: tendenciaPrecoUi,
    aplicacoes_principais: aplicacoesPars,
    aplicacoes_texto_bruto:
      aplicacoesPars.length === 0 && rawAplicacoesSubst != null
        ? rawAplicacoesSubst
        : null,
    paises_concorrentes: [],
    estrategia_nacional:
      rd.estrategia_nacional &&
      String(rd.estrategia_nacional).trim() !== '' &&
      rd.estrategia_nacional !== 'Não disponível'
        ? rd.estrategia_nacional
        : '',
    potencial_reserva_estimado_t: null,
    valor_estimado_usd_mi: null,
    valor_estimado_usd_ha,
    valor_estimado_brl_ha,
    metodologia_estimativa:
      'Valores derivados do motor de scores e master de substâncias.',
    processos_vizinhos: [],
    cambio_brl_usd: rd.ptax,
    cambio_data: todayIso(),
    var_1a_pct: rd.var_12m_pct ?? undefined,
    cagr_5a_pct: rd.cagr_5a_pct ?? undefined,
  }
}

function fiscalFromReport(rd: ReportData, processo: Processo): DadosFiscaisRicos {
  const notaNorm = normalizeCapagNotaDisplay(rd.capag_nota)
  const badge = capagBadgeLetra(notaNorm)
  const capagPrincipal = badge ?? notaNorm

  const cfemProcStatus =
    rd.cfem_processo_status ??
    getCfemProcessoStatus(
      processo.regime,
      rd.cfem_num_lancamentos != null && rd.cfem_num_lancamentos > 0
        ? rd.cfem_num_lancamentos
        : null,
    )
  const cfemProc: CfemHistorico[] = (() => {
    if (cfemProcStatus !== 'OK' || !rd.cfem_por_municipio?.length) return []
    const byAno = new Map<number, number>()
    for (const row of rd.cfem_por_municipio) {
      byAno.set(row.ano, (byAno.get(row.ano) ?? 0) + row.total_anual)
    }
    return [...byAno.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, valor]) => ({ ano, valor_recolhido_brl: valor }))
  })()
  const cfemMun: CfemHistorico[] =
    rd.cfem_historico.length > 0
      ? rd.cfem_historico.map((h) => ({
          ano: h.ano,
          valor_recolhido_brl: parsePtBrMoney(h.municipio_valor),
        }))
      : (rd.cfem_municipio_historico_tier1 ?? []).map((h) => ({
          ano: h.ano,
          valor_recolhido_brl: h.valor_brl,
        }))
  const cfemMunRico: CfemMunicipalHistorico[] =
    rd.cfem_historico.length > 0
      ? rd.cfem_historico.map((h) => ({
          ano: h.ano,
          valor_total_municipio_brl: parsePtBrMoney(h.municipio_valor),
          substancias: h.substancias,
        }))
      : (rd.cfem_municipio_historico_tier1 ?? []).map((h) => ({
          ano: h.ano,
          valor_total_municipio_brl: h.valor_brl,
          substancias: h.substancias ?? '',
        }))
  const pibMi = parsePibMunicipalMiFromTextoNullable(rd.pib_municipal)

  const programaInc = rd.incentivos.programa_estadual
  const incentivosLista =
    programaInc &&
    programaInc.trim() !== '' &&
    programaInc !== 'Não disponível'
      ? [programaInc]
      : []
  const linhasBndesLista = rd.incentivos.linhas_bndes_nomes ?? []
  const idhTxt = rd.idh
  const idhMunicipal =
    idhTxt &&
    idhTxt.trim() !== '' &&
    idhTxt !== 'Não disponível'
      ? idhTxt
      : undefined

  const receitaMi = parseReceitaPropriaMiFromTextoNullable(rd.receita_propria)
  const dividaMi = parseDividaMiFromTextoNullable(rd.divida)
  const depPct = parsePercentFromDependencia(rd.dependencia_transf)

  const capag_estruturado: CapagEstruturado = {
    resumo: `Nota CAPAG (STN): ${notaNorm}.`,
    indicadores: [
      {
        label: 'Endividamento',
        valor: rd.capag_endiv,
        nota: rd.capag_endiv_nota,
      },
      {
        label: 'Poupança corrente',
        valor: rd.capag_poupcorr,
        nota: rd.capag_poupcorr_nota,
      },
      {
        label: 'Liquidez',
        valor: rd.capag_liquidez,
        nota: rd.capag_liquidez_nota,
      },
    ],
    rodape:
      'Indicadores em percentual conforme metodologia STN; liquidez pode constar como não disponível.',
  }

  const piorCalc = piorIndicadorCapag(
    rd.capag_endiv_nota,
    rd.capag_poupcorr_nota,
    rd.capag_liquidez_nota,
  )
  const capagPiorLetra =
    rd.capag_pior_indicador_letra != null &&
    String(rd.capag_pior_indicador_letra).trim() !== ''
      ? String(rd.capag_pior_indicador_letra).trim()
      : piorCalc.letra
  const capagPiorNome =
    rd.capag_pior_indicador_nome != null &&
    String(rd.capag_pior_indicador_nome).trim() !== ''
      ? String(rd.capag_pior_indicador_nome).trim()
      : piorCalc.indicador

  return {
    capag: capagPrincipal,
    capag_descricao: '',
    capag_estruturado,
    capag_pior_indicador_letra: capagPiorLetra,
    capag_pior_indicador_nome: capagPiorNome,
    receita_propria_mi: receitaMi,
    divida_consolidada_mi: dividaMi,
    divida_exibicao: rd.divida,
    divida_fonte: rd.divida_fonte ?? null,
    pib_municipal_mi: pibMi,
    dependencia_transferencias_pct: depPct,
    idh_municipal: idhMunicipal,
    cfem_processo: cfemProc,
    cfem_municipio: cfemMun,
    cfem_historico: cfemProc,
    cfem_processo_status: cfemProcStatus,
    cfem_total_5anos_mi: 0,
    cfem_municipal_historico: cfemMunRico,
    incentivos_estaduais: incentivosLista,
    linhas_bndes: linhasBndesLista,
    aliquota_cfem_pct: rd.cfem_aliquota_pct,
    cfem_estimada_ha: Number(rd.cfem_estimada_ha) || 0,
    observacao: '',
    contexto_referencia_fiscal: rd.fiscal_contexto_referencia,
    cfem_num_lancamentos: rd.cfem_num_lancamentos,
    cfem_total_historico_brl: rd.cfem_total_historico ?? null,
    cfem_ultimo_ano: rd.cfem_ultimo_ano ?? null,
    cfem_por_municipio_tier1:
      rd.cfem_por_municipio && rd.cfem_por_municipio.length > 0
        ? rd.cfem_por_municipio.map((r) => ({
            ano: r.ano,
            municipio_nome: r.municipio_nome,
            total_anual_brl: r.total_anual,
            num_lancamentos: r.num_lancamentos,
          }))
        : undefined,
    autuacoes_anm:
      rd.autuacoes_num != null && rd.autuacoes_num > 0
        ? {
            num: rd.autuacoes_num,
            valor_total_brl: rd.autuacoes_valor_total ?? null,
          }
        : null,
  }
}

function cruzamentoOportunidadeDrawer(
  rd: ReportData,
): RelatorioOportunidadeData['cruzamento'] {
  const base = {
    tipo: 'analise' as const,
    data: rd.data_relatorio,
    rs: rd.risk_score,
    os: rd.os_conservador,
    contexto: rd.municipio,
  }
  const rsl = normalizarSeparadoresRotuloDb(rd.rs_classificacao)
  // Placeholders textuais para evitar "null" literal em narrativas quando o
  // processo não tem score (zumbi, sem geom, fora de escopo do motor).
  const rsTxt = rd.risk_score != null ? String(rd.risk_score) : 'indisponível'
  const osTxt =
    rd.os_conservador != null ? String(rd.os_conservador) : 'indisponível'
  if (rd.is_terminal && rd.bloqueador_constitucional?.tipo === 'TI_REGULARIZADA') {
    const nome = rd.bloqueador_constitucional.nome
    return {
      ...base,
      abertura:
        'Oportunidade indisponível · sobreposição constitucional a terra indígena regularizada.',
      explicacao: `Risk Score ${rsTxt} (${rsl}) e Opportunity Score ${osTxt} permanecem como referência técnica do TERRADAR. A área sobrepõe a TI ${nome} em fase Regularizada. O art. 231, §3º da Constituição Federal exige autorização específica do Congresso Nacional para exploração mineral em terras indígenas, ausente na prática. Novo requerimento sobre a mesma área seria indeferido pelo mesmo fundamento. Não há perspectiva de reativação nem de captura de potencial operacional neste recorte.`,
    }
  }
  if (
    rd.is_terminal &&
    rd.bloqueador_constitucional?.tipo === 'UC_PROTECAO_INTEGRAL'
  ) {
    const nome = rd.bloqueador_constitucional.nome
    return {
      ...base,
      abertura:
        'Oportunidade indisponível · unidade de conservação de proteção integral sobreposta.',
      explicacao: `Scores exibidos como referência metodológica. A sobreposição a ${nome} estrutura indisponibilidade de investimento minerário na área.`,
    }
  }
  if (rd.is_terminal) {
    return {
      ...base,
      abertura:
        'Processo juridicamente extinto · oportunidade apenas como referência técnica.',
      explicacao: `Risk Score ${rsTxt} (${rsl}); Opportunity Score (conservador) ${osTxt}. Os valores não implicam disponibilidade operacional após extinção do processo.`,
    }
  }
  return {
    ...base,
    abertura:
      'Leitura sintética com base nos indicadores do motor de scores (TERRADAR).',
    explicacao: `Risk Score consolidado ${rsTxt} (${rsl}); Opportunity Score (perfil conservador) ${osTxt}.`,
  }
}

function parsePenalidadesMotor(
  dimOportunidadePersistida?: Processo['dimensoes_oportunidade_persistido'],
): string[] {
  if (dimOportunidadePersistida == null || typeof dimOportunidadePersistida !== 'object') {
    return []
  }
  const raw = dimOportunidadePersistida as Record<string, unknown>
  const p = raw.penalidades
  if (!Array.isArray(p)) return []
  return p.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

function oportunidadeFromReport(
  rd: ReportData,
  dimOportunidadePersistida: Processo['dimensoes_oportunidade_persistido'],
  processo: Processo,
  mercado: MasterSubstancia | null,
): RelatorioOportunidadeData {
  const labelMap = {
    atratividade: 'Atratividade',
    viabilidade: 'Viabilidade',
    seguranca: 'Segurança',
  } as const

  const dimValOf = (dimKey: keyof typeof labelMap) =>
    dimKey === 'atratividade'
      ? rd.os_merc.valor
      : dimKey === 'viabilidade'
        ? rd.os_viab.valor
        : rd.os_seg.valor

  const mapSub = (s: Record<string, unknown>): VariavelOportunidadeMock => ({
    nome: String(s.nome ?? ''),
    valor: Number(s.valor ?? 0),
    peso: Number(s.peso_pct ?? s.peso ?? 0),
    texto: String(s.texto ?? ''),
    valor_bruto:
      s.valor_bruto != null && Number.isFinite(Number(s.valor_bruto))
        ? Number(s.valor_bruto)
        : undefined,
    impacto_neutro: false,
  })

  const detalhesRoot =
    dimOportunidadePersistida != null &&
    typeof dimOportunidadePersistida === 'object'
      ? ((dimOportunidadePersistida as Record<string, unknown>).detalhes ??
        dimOportunidadePersistida)
      : null

  const decompFromPersistida = (
    dimKey: 'atratividade' | 'viabilidade' | 'seguranca',
  ): VariavelOportunidadeMock[] => {
    if (detalhesRoot != null && typeof detalhesRoot === 'object') {
      const d = (detalhesRoot as Record<string, unknown>)[dimKey] as
        | { subfatores?: unknown[] }
        | undefined
      if (d != null && Array.isArray(d.subfatores) && d.subfatores.length > 0) {
        return d.subfatores.map((x) =>
          mapSub(x as Record<string, unknown>),
        )
      }
    }
    if (dimKey === 'atratividade') {
      const items = buildAtratividadeItemsS31(processo, mercado)
      const rows: VariavelOportunidadeMock[] = items.map((it) => ({
        nome: it.nome,
        valor: Math.round(it.valor),
        peso: Math.round(it.peso * 100),
        texto:
          it.fonte ??
          'Subfator ilustrativo (S31 v1.1; motor preenche JSONB em v1.1+).',
        valor_bruto: it.valor,
        impacto_neutro: false,
      }))
      if (mercado?.mineral_critico_2025) {
        rows.push({
          nome: 'Bônus mineral crítico 2025',
          valor: 10,
          peso: 0,
          texto: 'Condicionado ao consolidado da análise.',
          impacto_neutro: true,
        })
      }
      return rows
    }
    return [
      {
        nome: labelMap[dimKey],
        valor: dimValOf(dimKey),
        peso: 100,
        texto: 'Dimensão calculada automaticamente.',
        impacto_neutro: false,
      },
    ]
  }

  // Helper: gera perfil consistente mesmo quando o OS vem `null` (processo
  // sem score). Mantém `valor: null` para o drawer exibir empty state e
  // preenche label/cor neutros para não quebrar estilos.
  const perfilDe = (
    valor: number | null,
    perfilKey: 'conservador' | 'moderado' | 'arrojado',
  ): PerfilOportunidadeMock => ({
    valor,
    label: valor != null ? labelFaixaOS(valor) : '',
    cor: valor != null ? corFaixaOS(valor) : '',
    pesos: PESOS_OS_POR_PERFIL[perfilKey],
  })

  return {
    perfis: {
      conservador: perfilDe(rd.os_conservador, 'conservador'),
      moderado: perfilDe(rd.os_moderado, 'moderado'),
      arrojado: perfilDe(rd.os_arrojado, 'arrojado'),
    },
    penalidades: parsePenalidadesMotor(dimOportunidadePersistida),
    dimensoes: {
      atratividade: {
        valor: rd.os_merc.valor,
        cor: rd.os_merc.color,
      },
      viabilidade: {
        valor: rd.os_viab.valor,
        cor: rd.os_viab.color,
      },
      seguranca: {
        valor: rd.os_seg.valor,
        cor: rd.os_seg.color,
      },
    },
    decomposicao: {
      atratividade: decompFromPersistida('atratividade'),
      viabilidade: decompFromPersistida('viabilidade'),
      seguranca: decompFromPersistida('seguranca'),
    },
    cruzamento: cruzamentoOportunidadeDrawer(rd),
  }
}

function isoDatePrefix(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1]! : ''
}

function formatDataPtBrFromIsoYmd(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function observacoesTecnicasFromReport(
  rd: ReportData,
  processo: Processo,
): ObservacoesTecnicas {
  const anoDoNumero = (() => {
    const m = /\/(\d{4})$/.exec(processo.numero)
    return m ? parseInt(m[1], 10) : null
  })()
  const anoProt =
    processo.ano_protocolo != null && processo.ano_protocolo > 0
      ? processo.ano_protocolo
      : anoDoNumero

  const extintoObs = processo.ativo_derivado === false
  const tempoTramitacaoValor = (() => {
    if (extintoObs) {
      const proto = processo.data_protocolo?.trim()
      const ult = processo.ultimo_evento_data?.trim()
      if (proto && ult) {
        const a = anosEntreDatasIso(proto, ult)
        if (a != null) {
          return `${Math.round(a)} anos (extinto)`
        }
      }
    }
    if (anoProt != null) {
      return `~${new Date().getFullYear() - anoProt} anos`
    }
    if (rd.protocolo_anos != null && rd.protocolo_anos >= 0) {
      return `~${Math.round(rd.protocolo_anos * 10) / 10} anos`
    }
    return null
  })()

  const dataUltIso = isoDatePrefix(processo.ultimo_evento_data)
  const ultimoEventoValor =
    dataUltIso && processo.ultimo_evento_descricao?.trim()
      ? `${formatDataPtBrFromIsoYmd(dataUltIso)} - ${processo.ultimo_evento_descricao.trim()}`
      : rd.ultimo_despacho?.trim() && rd.ultimo_despacho !== 'Não disponível'
        ? rd.ultimo_despacho.trim()
        : null

  const codigoEventoValor =
    processo.ultimo_evento_codigo != null
      ? `${processo.ultimo_evento_codigo} - ${processo.ultimo_evento_descricao ?? ''}`.trim()
      : rd.dados_sei?.portaria_dou?.trim()
        ? rd.dados_sei.portaria_dou.trim()
        : rd.dados_sei?.ultimo_despacho?.trim() || null

  const ciclo_regulatorio: ObservacoesTecnicasItem[] = [
    {
      label: 'Ano de protocolo',
      valor: anoProt != null ? String(anoProt) : null,
    },
    {
      label: 'Tempo de tramitação',
      valor: tempoTramitacaoValor,
    },
    {
      label: extintoObs ? 'Fase na extinção' : 'Fase atual',
      valor: rd.fase?.trim() ? rd.fase : null,
    },
    {
      label: 'Último evento',
      valor: ultimoEventoValor,
    },
    {
      label: 'Código do evento',
      valor: codigoEventoValor,
    },
    {
      label: 'TAH',
      valor:
        rd.tah_status != null && String(rd.tah_status).trim() !== ''
          ? String(rd.tah_status).trim()
          : null,
    },
  ]

  const cnpjExibir =
    (processo.cnpj_filial != null
      ? String(processo.cnpj_filial).trim()
      : '') ||
    (processo.cnpj_titular != null
      ? String(processo.cnpj_titular).trim()
      : '') ||
    rd.cnpj?.trim() ||
    ''

  const nupSeiExibir =
    (processo.nup_sei != null ? String(processo.nup_sei).trim() : '') ||
    rd.nup_sei?.trim() ||
    ''

  const identificacao: ObservacoesTecnicasItem[] = [
    {
      label: 'Titular',
      valor: rd.titular?.trim() || processo.titular?.trim() || null,
    },
    {
      label: 'CNPJ',
      valor: cnpjExibir ? formatCNPJ(cnpjExibir) : 'Não disponível',
    },
    {
      label: 'Processo SEI',
      valor: nupSeiExibir ? nupSeiExibir : 'Não disponível',
    },
  ]

  return { ciclo_regulatorio, identificacao }
}

export function relatorioDataFromReportData(
  rd: ReportData,
  processo: Processo,
  mercado?: MasterSubstancia | null,
): RelatorioData {
  const ts = todayIso()
  const timestamps: Timestamps = {
    cadastro_mineiro: ts,
    sigmine: ts,
    cfem: ts,
    terras_indigenas: ts,
    unidades_conservacao: ts,
    siconfi: ts,
    cfem_municipal: ts,
    usgs: ts,
    preco_spot: ts,
    alertas_legislativos: ts,
  }

  const anoDoNumero = (() => {
    const m = /\/(\d{4})$/.exec(processo.numero)
    return m ? parseInt(m[1], 10) : null
  })()
  const anoProt =
    processo.ano_protocolo != null && processo.ano_protocolo > 0
      ? processo.ano_protocolo
      : anoDoNumero

  const dataUltimoDrawer =
    isoDatePrefix(processo.ultimo_evento_data) ||
    isoDatePrefix(processo.ultimo_despacho_data)

  const textoUltimoDrawer =
    processo.ultimo_evento_descricao?.trim() ||
    (rd.ultimo_despacho && rd.ultimo_despacho !== 'Não disponível'
      ? rd.ultimo_despacho
      : 'Não disponível')

  const extintoDrawer = processo.ativo_derivado === false
  const tempoAnosExtinto =
    extintoDrawer &&
    processo.data_protocolo?.trim() &&
    processo.ultimo_evento_data?.trim()
      ? anosEntreDatasIso(
          processo.data_protocolo.trim(),
          processo.ultimo_evento_data.trim(),
        )
      : null

  const tempoAnosDrawer =
    tempoAnosExtinto != null
      ? Math.round(tempoAnosExtinto)
      : anoProt != null
        ? new Date().getFullYear() - anoProt
        : rd.protocolo_anos

  const tempoTramitacaoTextoDrawer =
    extintoDrawer && tempoAnosExtinto != null
      ? `${Math.round(tempoAnosExtinto)} anos (extinto)`
      : null

  const dados_anm: DadosANM = {
    fase_atual: rd.fase,
    data_protocolo: processo.data_protocolo,
    ano_protocolo: anoProt ?? processo.ano_protocolo,
    tempo_tramitacao_anos: tempoAnosDrawer,
    tempo_tramitacao_texto: tempoTramitacaoTextoDrawer,
    pendencias: rd.pendencias ?? [],
    ultimo_despacho: textoUltimoDrawer,
    data_ultimo_despacho: dataUltimoDrawer || '',
    numero_sei:
      (processo.nup_sei != null ? String(processo.nup_sei).trim() : '') ||
      rd.nup_sei ||
      '',
    licenca_ambiental: rd.licenca_ambiental,
    dados_insuficientes: Boolean(processo.dados_insuficientes),
    classificacao_zumbi: processo.classificacao_zumbi ?? null,
  }

  const observacoes_tecnicas = observacoesTecnicasFromReport(rd, processo)

  return {
    processo_id: processo.id,
    dados_anm,
    observacoes_tecnicas,
    scores_exibicao_api: {
      rs_label: normalizarSeparadoresRotuloDb(rd.rs_classificacao),
      rs_cor: rd.rs_cor,
      os_label: normalizarSeparadoresRotuloDb(rd.os_classificacao),
      os_cor: rd.os_cor,
    },
    oportunidade_secao_titulo:
      rd.is_terminal && rd.bloqueador_constitucional
        ? 'Oportunidade · indisponibilidade constitucional'
        : rd.is_terminal
          ? 'Oportunidade · processo extinto'
          : undefined,
    territorial: territorialFromReport(rd, processo),
    intel_mineral: intelFromReport(rd, processo),
    fiscal: fiscalFromReport(rd, processo),
    timestamps,
    metadata: {
      fonte_territorial: 'PostGIS · fn_territorial_analysis',
      fonte_precos: 'Referências setoriais / IMF',
      fonte_fiscal: 'SICONFI DCA · STN CAPAG · IBGE (PIB, IDHM) · ANM CFEM',
      cambio: rd.ptax,
      calculado_em: ts,
    },
    oportunidade: oportunidadeFromReport(
      rd,
      processo.dimensoes_oportunidade_persistido,
      processo,
      mercado ?? null,
    ),
  }
}
