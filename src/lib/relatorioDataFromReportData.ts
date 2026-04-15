/**
 * Converte `ReportData` (API / buildReportData) no formato `RelatorioData` do drawer.
 */
import type {
  BiomaRelatorio,
  CapagEstruturado,
  CfemMunicipalHistorico,
  DadosANM,
  DadosFiscaisRicos,
  DadosTerritoriais,
  IntelMineral,
  ObservacoesTecnicas,
  RelatorioData,
  RelatorioOportunidadeData,
  Timestamps,
} from '../data/relatorio.mock'
import type { ReportData } from './reportTypes'
import type { Processo } from '../types'
import {
  PESOS_OS_POR_PERFIL,
  corFaixaOS,
  labelFaixaOS,
} from './oportunidadeRelatorioUi'
import {
  capagBadgeLetra,
  normalizeCapagNotaDisplay,
  parseDividaMiFromTexto,
  parsePercentFromDependencia,
  parsePibMunicipalMiFromTexto,
  parseReceitaPropriaMiFromTexto,
} from './fiscalDisplay'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function parsePtBrMoney(raw: string): number {
  const t = raw.replace(/R\$\s*/i, '').trim()
  if (!t) return 0
  const n = Number(
    t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''),
  )
  return Number.isFinite(n) ? n : 0
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

function territorialFromReport(rd: ReportData): DadosTerritoriais {
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

  let distancia_ferrovia_km: number | null = null
  let nome_ferrovia: string | null = null
  let distancia_rodovia_km = 0
  let nome_rodovia: string | null = null
  let distancia_porto_km: number | null = null
  let nome_porto: string | null = null
  let uf_porto = ''

  for (const inf of rd.infraestrutura) {
    if (inf.tipo === 'Ferrovia') {
      if (
        distancia_ferrovia_km == null ||
        inf.distancia_km < distancia_ferrovia_km
      ) {
        distancia_ferrovia_km = inf.distancia_km
        nome_ferrovia = inf.nome
      }
    }
    if (inf.tipo === 'Rodovia') {
      if (!nome_rodovia || inf.distancia_km < distancia_rodovia_km) {
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

  return {
    distancia_ti_km,
    nome_ti_proxima,
    fase_ti: null,
    distancia_uc_km: nome_uc_us_proxima ? distancia_uc_us_km : null,
    nome_uc_proxima: nome_uc_us_proxima ?? nome_uc_pi_proxima,
    tipo_uc: tipo_uc_us ?? tipo_uc_pi,
    nome_uc_us_proxima,
    tipo_uc_us,
    distancia_uc_us_km,
    nome_uc_pi_proxima,
    tipo_uc_pi,
    distancia_uc_pi_km,
    distancia_aquifero_km: null,
    nome_aquifero: null,
    unidade_hidrogeologica: null,
    litologia_aquifero: null,
    espessura_aquifero: null,
    vazao_aquifero: null,
    produtividade_aquifero: null,
    sobreposicao_aquifero: false,
    bioma: biomaFromString(rd.bioma) as BiomaRelatorio,
    distancia_sede_municipal_km: 0,
    distancia_sede_km: 0,
    nome_sede: '',
    distancia_ferrovia_km,
    nome_ferrovia,
    situacao_ferrovia: 'Não disponível',
    bitola_ferrovia: '',
    uf_ferrovia: '',
    nome_rodovia,
    tipo_rodovia: '',
    uf_rodovia: '',
    distancia_rodovia_km,
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
  }
}

function intelFromReport(rd: ReportData, processo: Processo): IntelMineral {
  const v12 = rd.var_12m_pct
  const tendencia: IntelMineral['tendencia_preco'] =
    v12 > 0.5 ? 'alta' : v12 < -0.5 ? 'queda' : 'estavel'

  return {
    substancia_contexto: rd.substancia_anm,
    reservas_brasil_mundial_pct: rd.reservas_mundiais_pct,
    producao_brasil_mundial_pct: rd.producao_mundial_pct,
    demanda_projetada_2030:
      'Síntese a partir da master de substâncias e fontes de mercado.',
    preco_medio_usd_t:
      rd.preco_oz_usd > 0 && rd.substancia_anm.toUpperCase().includes('OURO')
        ? rd.preco_oz_usd * 32_151
        : rd.valor_insitu_usd_ha > 0 && processo.area_ha > 0
          ? (rd.valor_insitu_usd_ha / 750_000) * 1_000_000
          : 0,
    unidade_preco:
      rd.substancia_anm.toUpperCase().includes('OURO') ? 'oz' : 't',
    preco_referencia_usd_oz: rd.preco_oz_usd,
    tendencia_preco: tendencia,
    aplicacoes_principais: [],
    paises_concorrentes: [],
    estrategia_nacional:
      rd.estrategia_nacional &&
      String(rd.estrategia_nacional).trim() !== '' &&
      rd.estrategia_nacional !== 'Não disponível'
        ? rd.estrategia_nacional
        : 'Ver fontes do master de substâncias.',
    potencial_reserva_estimado_t: null,
    valor_estimado_usd_mi: 0,
    valor_estimado_usd_ha: rd.valor_insitu_usd_ha,
    valor_estimado_brl_ha: rd.valor_insitu_usd_ha * rd.ptax,
    metodologia_estimativa:
      'Valores derivados do motor de scores e master de substâncias.',
    processos_vizinhos: [],
    cambio_brl_usd: rd.ptax,
    cambio_data: todayIso(),
    var_1a_pct: rd.var_12m_pct,
    cagr_5a_pct: rd.cagr_5a_pct,
  }
}

function fiscalFromReport(rd: ReportData, processo: Processo): DadosFiscaisRicos {
  const notaNorm = normalizeCapagNotaDisplay(rd.capag_nota)
  const badge = capagBadgeLetra(notaNorm)
  const capagPrincipal = badge ?? notaNorm

  const cfemProc = rd.cfem_historico.map((h) => ({
    ano: h.ano,
    valor_recolhido_brl: parsePtBrMoney(h.processo_valor),
  }))
  const cfemMun: CfemMunicipalHistorico[] = rd.cfem_historico.map((h) => ({
    ano: h.ano,
    valor_total_municipio_brl: parsePtBrMoney(h.municipio_valor),
    substancias: h.substancias,
  }))
  const pibMi = parsePibMunicipalMiFromTexto(rd.pib_municipal)

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

  const estAnualMi =
    processo.area_ha > 0 && rd.cfem_estimada_ha > 0
      ? (rd.cfem_estimada_ha * processo.area_ha) / 1_000_000
      : 0

  const receitaMi = parseReceitaPropriaMiFromTexto(rd.receita_propria)
  const dividaMi = parseDividaMiFromTexto(rd.divida)
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

  return {
    capag: capagPrincipal,
    capag_descricao: '',
    capag_estruturado,
    receita_propria_mi: receitaMi,
    divida_consolidada_mi: dividaMi,
    pib_municipal_mi: pibMi,
    dependencia_transferencias_pct: depPct,
    idh_municipal: idhMunicipal,
    cfem_processo: cfemProc,
    cfem_municipio: cfemMun,
    cfem_historico: cfemProc,
    cfem_total_5anos_mi: 0,
    cfem_municipal_historico: cfemMun,
    incentivos_estaduais: incentivosLista,
    linhas_bndes: linhasBndesLista,
    aliquota_cfem_pct: rd.cfem_aliquota_pct,
    estimativa_cfem_anual_operacao_mi: estAnualMi,
    observacao: '',
    contexto_referencia_fiscal: rd.fiscal_contexto_referencia,
  }
}

function oportunidadeFromReport(rd: ReportData): RelatorioOportunidadeData {
  const mkVar = (nome: string, texto: string) => ({
    nome,
    valor: 0,
    peso: 0,
    texto,
    impacto_neutro: true as const,
  })

  return {
    perfis: {
      conservador: {
        valor: rd.os_conservador,
        label: labelFaixaOS(rd.os_conservador),
        cor: corFaixaOS(rd.os_conservador),
        pesos: PESOS_OS_POR_PERFIL.conservador,
      },
      moderado: {
        valor: rd.os_moderado,
        label: labelFaixaOS(rd.os_moderado),
        cor: corFaixaOS(rd.os_moderado),
        pesos: PESOS_OS_POR_PERFIL.moderado,
      },
      arrojado: {
        valor: rd.os_arrojado,
        label: labelFaixaOS(rd.os_arrojado),
        cor: corFaixaOS(rd.os_arrojado),
        pesos: PESOS_OS_POR_PERFIL.arrojado,
      },
    },
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
      atratividade: [mkVar('Atratividade', 'Dimensão calculada automaticamente.')],
      viabilidade: [mkVar('Viabilidade', 'Dimensão calculada automaticamente.')],
      seguranca: [mkVar('Segurança', 'Dimensão calculada automaticamente.')],
    },
    cruzamento: {
      tipo: 'analise',
      abertura:
        'Leitura sintética com base nos indicadores do motor de scores (TERRADAR).',
      explicacao: `Risk Score consolidado ${rd.risk_score} (${rd.rs_classificacao}); Opportunity Score (perfil conservador) ${rd.os_conservador}.`,
      contexto: rd.municipio,
      data: rd.data_relatorio,
      rs: rd.risk_score,
      os: rd.os_conservador,
    },
  }
}

export function relatorioDataFromReportData(
  rd: ReportData,
  processo: Processo,
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

  const dados_anm: DadosANM = {
    fase_atual: rd.fase,
    data_protocolo: processo.data_protocolo,
    ano_protocolo: processo.ano_protocolo,
    tempo_tramitacao_anos: rd.protocolo_anos,
    pendencias: [],
    ultimo_despacho: rd.ultimo_despacho,
    data_ultimo_despacho: rd.ultimo_despacho,
    numero_sei: rd.nup_sei,
    licenca_ambiental: rd.licenca_ambiental,
  }

  const observacoes_tecnicas: ObservacoesTecnicas = {
    ciclo_regulatorio: [],
    identificacao: [],
  }

  return {
    processo_id: processo.id,
    dados_anm,
    observacoes_tecnicas,
    territorial: territorialFromReport(rd),
    intel_mineral: intelFromReport(rd, processo),
    fiscal: fiscalFromReport(rd, processo),
    timestamps,
    metadata: {
      fonte_territorial: 'PostGIS · fn_territorial_analysis',
      fonte_precos: 'Master substâncias / IMF',
      fonte_fiscal: 'SICONFI DCA · STN CAPAG · IBGE (PIB, IDHM) · ANM CFEM',
      cambio: rd.ptax,
      calculado_em: ts,
    },
    oportunidade: oportunidadeFromReport(rd),
  }
}
