/**
 * Mock rico para o Relatório Completo por processo (p1…p30).
 * Alinhado a `processos.mock.ts`: não importa esse ficheiro para manter o módulo isolado.
 */

export interface DadosANM {
  fase_atual: string
  data_protocolo: string
  prazo_vencimento: string | null
  tempo_tramitacao_anos: number
  pendencias: string[]
  ultimo_despacho: string
  data_ultimo_despacho: string
  numero_sei: string
  observacoes_tecnicas: string
}

export type BiomaRelatorio =
  | 'Amazônia'
  | 'Cerrado'
  | 'Caatinga'
  | 'Mata Atlântica'
  | 'Pampa'
  | 'Pantanal'

export interface DadosTerritoriais {
  distancia_ti_km: number | null
  nome_ti_proxima: string | null
  distancia_uc_km: number | null
  nome_uc_proxima: string | null
  tipo_uc: string | null
  distancia_aquifero_km: number | null
  nome_aquifero: string | null
  bioma: BiomaRelatorio | string
  distancia_sede_municipal_km: number
  distancia_ferrovia_km: number | null
  nome_ferrovia: string | null
  distancia_porto_km: number | null
  nome_porto: string | null
  sobreposicao_app: boolean
  sobreposicao_quilombola: boolean
  nome_quilombola: string | null
}

export interface ProcessoVizinho {
  numero: string
  titular: string
  substancia: string
  fase: string
  distancia_km: number
  area_ha: number
  risk_score: number
}

export interface IntelMineral {
  substancia_contexto: string
  reservas_brasil_mundial_pct: number
  producao_brasil_mundial_pct: number
  demanda_projetada_2030: string
  preco_medio_usd_t: number
  /** `'oz'`: exibir cotação primária em onça troy (ex.: ouro). Default `'t'`. */
  unidade_preco?: 't' | 'oz'
  /** USD/oz quando `unidade_preco === 'oz'`. */
  preco_referencia_usd_oz?: number
  tendencia_preco: 'alta' | 'estavel' | 'queda'
  aplicacoes_principais: string[]
  paises_concorrentes: string[]
  estrategia_nacional: string
  potencial_reserva_estimado_t: number
  valor_estimado_usd_mi: number
  metodologia_estimativa: string
  processos_vizinhos: ProcessoVizinho[]
}

export interface CfemHistorico {
  ano: number
  valor_recolhido_brl: number
}

/** CFEM total recebido pelo município (todos os processos minerários), por ano. */
export interface CfemMunicipalHistorico {
  ano: number
  valor_total_municipio_brl: number
}

export interface DadosFiscaisRicos {
  capag: 'A' | 'B' | 'C' | 'D'
  capag_descricao: string
  receita_propria_mi: number
  divida_consolidada_mi: number
  pib_municipal_mi: number
  dependencia_transferencias_pct: number
  cfem_historico: CfemHistorico[]
  cfem_total_5anos_mi: number
  cfem_municipal_historico: CfemMunicipalHistorico[]
  incentivos_estaduais: string[]
  linhas_bndes: string[]
  aliquota_cfem_pct: number
  estimativa_cfem_anual_operacao_mi: number
  observacao: string
}

export interface Timestamps {
  cadastro_mineiro: string
  sigmine: string
  cfem: string
  terras_indigenas: string
  unidades_conservacao: string
  siconfi: string
  cfem_municipal: string
  usgs: string
  preco_spot: string
  alertas_legislativos: string
}

export interface RelatorioData {
  processo_id: string
  dados_anm: DadosANM
  territorial: DadosTerritoriais
  intel_mineral: IntelMineral
  fiscal: DadosFiscaisRicos
  timestamps: Timestamps
}

const PROF_M = 30
const DENS_T_M3 = 2.5
/** Fração da reserva assumida como produzida por ano (mock CFEM). */
const PRODUCAO_ANUAL_PCT = 0.08

function substChaveNormalizada(subst: string): string {
  return subst
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/**
 * Teor em massa (fração): terras raras (Nd, Pr, Tb, Dy) 0,08%; nióbio 0,3%; ferro 12%;
 * cobre 0,8%; ouro 0,0015%; quartzo 8%; bauxita 15%; níquel 1%; lítio 0,008% (mock).
 */
function teorDecimal(subst: string): number {
  const u = substChaveNormalizada(subst)
  if (['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO'].includes(u)) return 0.0008
  if (u === 'LITIO') return 0.00008
  if (u === 'NIOBIO') return 0.003
  if (u === 'FERRO') return 0.12
  if (u === 'COBRE') return 0.008
  if (u === 'OURO') return 0.000015
  if (u === 'QUARTZO') return 0.08
  if (u === 'BAUXITA') return 0.15
  if (u === 'NIQUEL') return 0.01
  return 0.01
}

/** volume_m3 × densidade × teor (t). */
function potencialReservaT(areaHa: number, subst: string): number {
  const volumeM3 = areaHa * 10_000 * PROF_M
  return volumeM3 * DENS_T_M3 * teorDecimal(subst)
}

/**
 * valor_estimado_usd_mi = (pot × preço) / 1e6; REE enquadrados 5–80 Mi (pesquisa).
 */
function valorEstimadoUsdMi(pot: number, precoUsdT: number, subst: string): number {
  const raw = (pot * precoUsdT) / 1_000_000
  const v = Math.round(raw)
  const u = substChaveNormalizada(subst)
  if (['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO'].includes(u)) {
    return Math.min(80, Math.max(5, v))
  }
  if (u === 'LITIO' || u === 'NIOBIO') {
    return Math.min(80, Math.max(1, v))
  }
  return v
}

/** Prazo de pesquisa renovado quando o término original seria anterior a 2025. */
function prazoVencimentoPara(s: Seed): string | null {
  if (s.regime === 'bloqueio_permanente' || s.regime === 'bloqueio_provisorio') {
    return null
  }
  if (s.situacao === 'bloqueado') return null
  if (s.fase === 'requerimento') return null
  if (s.fase === 'lavra' || s.fase === 'concessao') return null
  if (s.fase !== 'pesquisa' || s.situacao !== 'ativo') return null

  const candidate = `${s.ano_protocolo + 3}-12-31`
  if (candidate >= '2025-01-01') return candidate

  const h = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const t0 = Date.UTC(2026, 5, 30)
  const t1 = Date.UTC(2028, 11, 31)
  const spanDays = Math.floor((t1 - t0) / 86_400_000)
  const off = h % (spanDays + 1)
  const ms = t0 + off * 86_400_000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Valores em milhões de R$ por ano; convertidos para BRL absoluto no mock. */
const CFEM_MUNICIPAL_MI_POR_UF: Record<string, number[]> = {
  MG: [28.5, 32.1, 38.7, 41.2, 36.8],
  PA: [15.2, 18.9, 24.3, 27.1, 25.6],
  GO: [8.4, 9.1, 11.5, 12.8, 11.9],
  BA: [5.1, 6.3, 8.7, 9.4, 10.2],
  AM: [22.0, 25.3, 30.1, 38.5, 42.0],
  MT: [3.2, 4.1, 5.8, 7.2, 8.5],
}

function cfemMunicipalHistoricoPara(uf: string): CfemMunicipalHistorico[] {
  const anos = [2020, 2021, 2022, 2023, 2024]
  const miPorAno = CFEM_MUNICIPAL_MI_POR_UF[uf] ?? CFEM_MUNICIPAL_MI_POR_UF.MG!
  return anos.map((ano, i) => ({
    ano,
    valor_total_municipio_brl: Math.round(miPorAno[i]! * 1_000_000),
  }))
}

function capagDescricao(c: DadosFiscaisRicos['capag']): string {
  const m: Record<DadosFiscaisRicos['capag'], string> = {
    A: 'Município com finanças equilibradas: baixo risco de inadimplência e capacidade de honrar incentivos fiscais',
    B: 'Situação fiscal satisfatória: pequenas restrições de endividamento sem impacto significativo',
    C: 'Capacidade de pagamento comprometida: incentivos fiscais sujeitos a revisão orçamentária',
    D: 'Município em situação fiscal crítica: alto risco de descontinuidade de incentivos prometidos',
  }
  return m[c]
}

function territorialPorUf(uf: string, seed: number): DadosTerritoriais {
  const r = (a: number, b: number) => a + (seed % 1000) * ((b - a) / 1000)

  switch (uf) {
    case 'PA':
      return {
        distancia_ti_km: r(15, 80),
        nome_ti_proxima: seed % 3 === 0 ? 'TI Kayapó' : 'TI Munduruku',
        distancia_uc_km: r(25, 95),
        nome_uc_proxima:
          seed % 2 === 0
            ? 'Parque Nacional da Serra do Pardo'
            : 'Floresta Nacional do Tapirapé-Aquiri',
        tipo_uc: seed % 2 === 0 ? 'Proteção integral' : 'Uso sustentável',
        distancia_aquifero_km: r(8, 45),
        nome_aquifero: 'Aquífero Alter do Chão',
        bioma: 'Amazônia',
        distancia_sede_municipal_km: r(12, 68),
        distancia_ferrovia_km: r(20, 150),
        nome_ferrovia: 'EF Carajás',
        distancia_porto_km: r(180, 420),
        nome_porto: 'Porto de Vila do Conde',
        sobreposicao_app: seed % 4 !== 0,
        sobreposicao_quilombola: seed % 5 === 0,
        nome_quilombola: seed % 5 === 0 ? 'Território quilombola Rio Acará' : null,
      }
    case 'GO':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(40, 120),
        nome_uc_proxima: 'APA dos Pirineus',
        tipo_uc: 'Área de Proteção Ambiental (APA)',
        distancia_aquifero_km: null,
        nome_aquifero: null,
        bioma: 'Cerrado',
        distancia_sede_municipal_km: r(8, 55),
        distancia_ferrovia_km: r(30, 120),
        nome_ferrovia: 'Ferrovia Norte-Sul',
        distancia_porto_km: r(900, 1100),
        nome_porto: 'Porto de Santos',
        sobreposicao_app: seed % 3 === 0,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
    case 'MG':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(15, 90),
        nome_uc_proxima:
          seed % 2 === 0
            ? 'APA Serra da Gandarela'
            : 'Parque Estadual do Rio Doce',
        tipo_uc: seed % 2 === 0 ? 'APA' : 'Parque Estadual',
        distancia_aquifero_km: seed % 2 === 0 ? r(20, 80) : null,
        nome_aquifero: seed % 2 === 0 ? 'Aquífero Bambuí' : null,
        bioma: seed % 2 === 0 ? 'Cerrado' : 'Mata Atlântica / Cerrado',
        distancia_sede_municipal_km: r(10, 45),
        distancia_ferrovia_km: r(10, 80),
        nome_ferrovia: seed % 2 === 0 ? 'EF Vitória a Minas' : 'MRS Logística',
        distancia_porto_km: r(200, 600),
        nome_porto: 'Porto de Tubarão (Vitória)',
        sobreposicao_app: seed % 4 === 0,
        sobreposicao_quilombola: seed % 7 === 0,
        nome_quilombola: seed % 7 === 0 ? 'Quilombo do Campinho' : null,
      }
    case 'BA':
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(35, 100),
        nome_uc_proxima: 'APA Chapada Diamantina',
        tipo_uc: 'APA',
        distancia_aquifero_km: null,
        nome_aquifero: null,
        bioma: 'Caatinga',
        distancia_sede_municipal_km: r(6, 40),
        distancia_ferrovia_km: null,
        nome_ferrovia: null,
        distancia_porto_km: r(300, 600),
        nome_porto: 'Porto de Salvador',
        sobreposicao_app: seed % 3 !== 0,
        sobreposicao_quilombola: seed % 6 === 0,
        nome_quilombola: seed % 6 === 0 ? 'Território quilombola Brejões' : null,
      }
    case 'AM':
      return {
        distancia_ti_km: r(5, 40),
        nome_ti_proxima: seed % 2 === 0 ? 'TI Waimiri-Atroari' : 'TI Uatumã',
        distancia_uc_km: r(12, 55),
        nome_uc_proxima: 'UC de proteção integral: entorno de manancial',
        tipo_uc: 'Unidade de Conservação: proteção integral',
        distancia_aquifero_km: r(5, 35),
        nome_aquifero: 'Sistema Aquífero Alter do Chão',
        bioma: 'Amazônia',
        distancia_sede_municipal_km: r(25, 95),
        distancia_ferrovia_km: null,
        nome_ferrovia: null,
        distancia_porto_km: r(80, 300),
        nome_porto: 'Porto de Manaus',
        sobreposicao_app: true,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
    case 'MT':
      return {
        distancia_ti_km: r(30, 100),
        nome_ti_proxima: seed % 2 === 0 ? 'TI Kayabi' : 'TI Munduruku',
        distancia_uc_km: r(28, 85),
        nome_uc_proxima: 'APA Cristalino',
        tipo_uc: 'APA',
        distancia_aquifero_km: r(15, 70),
        nome_aquifero: 'Aquífero Guarani (margem setentrional)',
        bioma: 'Amazônia / Cerrado',
        distancia_sede_municipal_km: r(15, 55),
        distancia_ferrovia_km: null,
        nome_ferrovia: null,
        distancia_porto_km: r(1400, 1600),
        nome_porto: 'Porto de Santos (corredor rodoviário)',
        sobreposicao_app: seed % 2 === 0,
        sobreposicao_quilombola: seed % 5 === 0,
        nome_quilombola: seed % 5 === 0 ? 'Quilombo Rio Arinos' : null,
      }
    default:
      return {
        distancia_ti_km: null,
        nome_ti_proxima: null,
        distancia_uc_km: r(20, 80),
        nome_uc_proxima: 'UC genérica estadual',
        tipo_uc: 'APA',
        distancia_aquifero_km: null,
        nome_aquifero: null,
        bioma: 'Cerrado',
        distancia_sede_municipal_km: 25,
        distancia_ferrovia_km: 40,
        nome_ferrovia: 'Malha ferroviária regional',
        distancia_porto_km: 500,
        nome_porto: 'Porto costeiro',
        sobreposicao_app: false,
        sobreposicao_quilombola: false,
        nome_quilombola: null,
      }
  }
}

function pendenciasPorRegime(
  regime: string,
  situacao: string,
): string[] {
  if (situacao === 'bloqueado') {
    if (regime === 'bloqueio_permanente') {
      return [
        'Determinação judicial de suspensão de atividades',
        'Sobreposição com TI não homologada: análise jurídica em curso',
      ]
    }
    return [
      'Bloqueio provisório: determinação administrativa em vigor',
      'Sobreposição com área sensível aguardando deslinde',
    ]
  }
  switch (regime) {
    case 'autorizacao_pesquisa':
      return [
        'Relatório Final de Pesquisa não entregue no prazo regulamentar',
        'DIPEM em atraso: exercício 2024',
        'Vistoria de campo pendente de homologação',
      ]
    case 'concessao_lavra':
      return [
        'RAL 2024 não entregue ou com pendências de esclarecimento',
        'TAH com débito em aberto: regularização junto à ANM',
        'Plano de Fechamento de Mina desatualizado face ao cronograma real',
      ]
    case 'req_lavra':
      return [
        'Aguardando parecer conclusivo do IBAMA',
        'Documentação ambiental incompleta: complementação solicitada',
      ]
    case 'licenciamento':
      return [
        'EIA/RIMA em análise técnica conjunta',
        'Audiência pública agendada: condicionante ao licenciamento',
      ]
    case 'mineral_estrategico':
      return ['Pendência administrativa menor: atualização cadastral SEI']
    default:
      return ['Acompanhamento de exigências normativas em trâmite']
  }
}

function aliquotaCfemPct(subst: string): number {
  const u = substChaveNormalizada(subst)
  if (['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO', 'LITIO'].includes(u))
    return 3
  if (u === 'FERRO') return 3.5
  if (u === 'OURO') return 1.5
  return 2
}

function cfemHistorico(
  areaHa: number,
  subst: string,
  regime: string,
  incluir: boolean,
): { historico: CfemHistorico[]; totalMi: number; aliquota: number } {
  const aliquota = aliquotaCfemPct(subst)
  if (!incluir) {
    return { historico: [], totalMi: 0, aliquota }
  }
  const anos = [2020, 2021, 2022, 2023, 2024]
  const u = substChaveNormalizada(subst)
  const mineralEstrategicoRegime = regime === 'mineral_estrategico'
  const tr =
    mineralEstrategicoRegime ||
    ['NEODIMIO', 'PRASEODIMIO', 'TERBIO', 'DISPROSIO', 'NIOBIO', 'LITIO'].includes(
      u,
    )

  let valores: number[]
  if (u === 'FERRO' && areaHa > 800) {
    valores = [2_800_000, 3_100_000, 3_400_000, 3_900_000, 4_200_000]
  } else if (u === 'FERRO') {
    valores = [890_000, 1_100_000, 1_300_000, 1_500_000, 1_700_000]
  } else if (tr) {
    valores = [340_000, 410_000, 520_000, 680_000, 890_000]
  } else {
    valores = [120_000, 145_000, 180_000, 210_000, 260_000]
  }

  const historico = anos.map((ano, i) => ({
    ano,
    valor_recolhido_brl: valores[i]!,
  }))
  const totalMi =
    Math.round(
      (historico.reduce((s, h) => s + h.valor_recolhido_brl, 0) / 1_000_000) *
        10,
    ) / 10
  return { historico, totalMi, aliquota }
}

function intelPorSubstancia(
  subst: string,
  areaHa: number,
  _processoId: string,
): Omit<IntelMineral, 'processos_vizinhos'> {
  const pot = potencialReservaT(areaHa, subst)

  const rareEarth = (): Omit<IntelMineral, 'processos_vizinhos'> => {
    const u = substChaveNormalizada(subst)
    const preco =
      u === 'DISPROSIO'
        ? 290_000
        : u === 'NEODIMIO'
          ? 68_000
          : u === 'PRASEODIMIO'
            ? 82_000
            : u === 'TERBIO'
              ? 1_200_000
              : 68_000
    const estrategiaMME =
      'Decreto MME 11.892/2025: mineral crítico prioritário. Brasil negocia fornecimento processado para EUA e UE.'
    let aplicacoes: string[]
    if (u === 'NEODIMIO') {
      aplicacoes = [
        'Veículos elétricos',
        'Turbinas eólicas',
        'Defesa e aeroespacial',
        'Eletrônicos de consumo',
      ]
    } else if (u === 'PRASEODIMIO') {
      aplicacoes = ['Ímãs permanentes', 'Ligas de alta resistência', 'Catalisadores']
    } else if (u === 'TERBIO') {
      aplicacoes = [
        'Displays OLED',
        'Lâmpadas de eficiência energética',
        'Sonar militar',
      ]
    } else if (u === 'DISPROSIO') {
      aplicacoes = [
        'Motores de veículos elétricos',
        'Turbinas eólicas offshore',
        'Equipamentos militares',
      ]
    } else {
      aplicacoes = [
        'Veículos elétricos',
        'Turbinas eólicas',
        'Defesa e aeroespacial',
        'Eletrônicos de consumo',
      ]
    }
    return {
      substancia_contexto: `${subst}: terras raras de interesse estratégico para cadeias de magnetos e eletrônica.`,
      reservas_brasil_mundial_pct: 23,
      producao_brasil_mundial_pct: 0.8,
      demanda_projetada_2030:
        'Demanda global projetada +12–18% a.a. até 2030, puxada por VE, eólica e defesa.',
      preco_medio_usd_t: preco,
      tendencia_preco: 'alta',
      aplicacoes_principais: aplicacoes,
      paises_concorrentes: [
        'China (~60% da produção mundial)',
        'Austrália',
        'Estados Unidos',
      ],
      estrategia_nacional: estrategiaMME,
      potencial_reserva_estimado_t: Math.round(pot),
      valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
      metodologia_estimativa:
        'Volume = área (ha)×10⁴×profundidade (30 m)×densidade (2,5 t/m³)×teor; massa mineral = volume×densidade×teor; valor USD (Mi) = potencial×preço/10⁶; REE enquadrados 5–80 Mi em fase de pesquisa.',
    }
  }

  switch (substChaveNormalizada(subst)) {
    case 'NEODIMIO':
    case 'PRASEODIMIO':
    case 'TERBIO':
    case 'DISPROSIO':
      return rareEarth()
    case 'NIOBIO': {
      const preco = 41_000
      return {
        substancia_contexto:
          'Nióbio: Brasil detém posição dominante em reservas; foco em aços especiais e ligas.',
        reservas_brasil_mundial_pct: 94,
        producao_brasil_mundial_pct: 88,
        demanda_projetada_2030:
          'Demanda estável a moderadamente crescente em infraestrutura e baterias avançadas.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'estavel',
        aplicacoes_principais: [
          'Aço de alta resistência',
          'Superligas aeroespaciais',
          'Baterias de nova geração',
        ],
        paises_concorrentes: ['Brasil', 'Canadá'],
        estrategia_nacional:
          'Brasil domina 94% das reservas e 88% da produção mundial. CBMM referência global.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Volume 30 m, densidade 2,5 t/m³, teor 0,3% Nb; valor = potencial×preço/10⁶ (teto 80 Mi USD no mock).',
      }
    }
    case 'FERRO': {
      const preco = 110
      return {
        substancia_contexto: 'Minério de ferro: commodity global com pricing benchmark 62% Fe.',
        reservas_brasil_mundial_pct: 12,
        producao_brasil_mundial_pct: 15,
        demanda_projetada_2030:
          'Crescimento moderado ligado a China e infraestrutura emergente; volatilidade cíclica.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'queda',
        aplicacoes_principais: [
          'Siderurgia',
          'Construção civil',
          'Manufatura industrial',
        ],
        paises_concorrentes: ['Austrália', 'Brasil', 'África do Sul'],
        estrategia_nacional:
          'Política de valor agregado e logística ferroviária/portuária; CPAs e desmatamento zero na mira regulatória.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 12% Fe em massa; volume útil 30 m; massa = volume×2,5×teor; valor = potencial×preço/10⁶.',
      }
    }
    case 'COBRE': {
      const preco = 9200
      return {
        substancia_contexto:
          'Cobre: metal da transição energética (cabeamento, VE, renováveis).',
        reservas_brasil_mundial_pct: 4,
        producao_brasil_mundial_pct: 3,
        demanda_projetada_2030:
          'Projeção IEA: déficit estrutural possível após 2028 sem novos projetos greenfield.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Energia elétrica',
          'Veículos elétricos',
          'Telecomunicações',
          'Construção civil',
        ],
        paises_concorrentes: ['Chile', 'Peru', 'Congo', 'China'],
        estrategia_nacional:
          'Programas de mapeamento mineral e incentivo a estudos de viabilidade em províncias polimetálicas.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 0,8% Cu; profundidade 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'OURO': {
      const preco = 62_000
      return {
        substancia_contexto: 'Ouro: reserva de valor e insumo eletrônico de alta pureza.',
        reservas_brasil_mundial_pct: 3,
        producao_brasil_mundial_pct: 3,
        demanda_projetada_2030:
          'Demanda firme de joias e ETFs; componente industrial estável.',
        preco_medio_usd_t: preco,
        unidade_preco: 'oz',
        preco_referencia_usd_oz: 2050,
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Reserva de valor',
          'Eletrônicos',
          'Joalheria',
          'Medicina',
        ],
        paises_concorrentes: ['China', 'Austrália', 'Rússia', 'Canadá'],
        estrategia_nacional:
          'Rastreabilidade da cadeia (LGPD e compliance LBMA) e combate ao garimpo ilegal.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 0,0015% Au; volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'QUARTZO': {
      const preco = 45
      return {
        substancia_contexto:
          'Quartzo / sílica: insumo para vidro, fundição e silício metalúrgico.',
        reservas_brasil_mundial_pct: 8,
        producao_brasil_mundial_pct: 5,
        demanda_projetada_2030:
          'Crescimento com painéis solares e fundições; pressão de custo em logística.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'estavel',
        aplicacoes_principais: ['Semicondutores', 'Vidro', 'Cerâmica industrial'],
        paises_concorrentes: ['China', 'Estados Unidos', 'Turquia'],
        estrategia_nacional:
          'Integração com parque solar e cerâmica; exigências de licenciamento ambiental municipal.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 8% em massa (produto sílica); volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'BAUXITA': {
      const preco = 32
      return {
        substancia_contexto: 'Bauxita: matéria-prima da alumina e alumínio.',
        reservas_brasil_mundial_pct: 11,
        producao_brasil_mundial_pct: 9,
        demanda_projetada_2030:
          'Demanda acompanha construção civil e embalagens; ciclo ligado ao PIB chinês.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'estavel',
        aplicacoes_principais: ['Alumínio', 'Refratários', 'Abrasivos'],
        paises_concorrentes: ['Guiné', 'Austrália', 'Brasil', 'Jamaica'],
        estrategia_nacional:
          'Expansão de refinarias costeiras e logística mineral; atenção a licenças de supressão em Cerrado.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 15% em massa (Al2O3 equivalente); volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    case 'LITIO': {
      const preco = 18_000
      return {
        substancia_contexto:
          'Lítio: insumo crítico para baterias de íon-lítio e armazenamento.',
        reservas_brasil_mundial_pct: 1.5,
        producao_brasil_mundial_pct: 0.2,
        demanda_projetada_2030:
          'Crescimento acelerado 15–25% a.a. até 2030 em baterias e estacionárias.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Baterias para VE',
          'Armazenamento em rede',
          'Cerâmica técnica',
        ],
        paises_concorrentes: ['Chile', 'Austrália', 'Argentina', 'China'],
        estrategia_nacional:
          'Inserção em rota estratégica de minerais críticos; prioridade a estudos de salar e pegmatitos com ESG reforçado.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 0,008% Li2O equivalente (mock); volume 30 m; valor = potencial×preço/10⁶ (teto 80 Mi USD).',
      }
    }
    case 'NIQUEL': {
      const preco = 16_000
      return {
        substancia_contexto:
          'Níquel: aço inoxidável e precursores de cátodos para baterias.',
        reservas_brasil_mundial_pct: 12,
        producao_brasil_mundial_pct: 5,
        demanda_projetada_2030:
          'Forte tração de baterias NMC/NCA; oferta Indonesia domina short run.',
        preco_medio_usd_t: preco,
        tendencia_preco: 'alta',
        aplicacoes_principais: [
          'Baterias de veículos elétricos',
          'Aço inoxidável',
          'Ligas especiais',
        ],
        paises_concorrentes: ['Indonésia', 'Filipinas', 'Rússia', 'Nova Caledónia'],
        estrategia_nacional:
          'Integração com polo de Goiás/Tocantins e incentivos à metalurgia de primeira transformação.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, preco, subst),
        metodologia_estimativa:
          'Teor 1% Ni em massa; volume 30 m; valor = potencial×preço/10⁶.',
      }
    }
    default:
      return {
        substancia_contexto: `${subst}: commodity mineral com perfil de mercado regional.`,
        reservas_brasil_mundial_pct: 5,
        producao_brasil_mundial_pct: 2,
        demanda_projetada_2030: 'Demanda moderada vinculada ao ciclo industrial.',
        preco_medio_usd_t: 500,
        tendencia_preco: 'estavel',
        aplicacoes_principais: ['Indústria geral'],
        paises_concorrentes: ['Brasil', 'Global'],
        estrategia_nacional: 'Acompanhamento setorial ANM e política mineral.',
        potencial_reserva_estimado_t: Math.round(pot),
        valor_estimado_usd_mi: valorEstimadoUsdMi(pot, 500, subst),
        metodologia_estimativa:
          'Parâmetros genéricos: profundidade 30 m, densidade 2,5 t/m³, teor 1%.',
      }
  }
}

function vizinhosFicticios(
  subst: string,
  _uf: string,
  faseAtual: string,
  risk: number | null,
  id: string,
): ProcessoVizinho[] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const n = 2 + (id.charCodeAt(1) % 3)
  const titulares = [
    'Mineração Horizonte Verde Ltda.',
    'Pedra Branca Mineração SPE',
    'Cerrado Minerais S.A.',
    'Norte Logística Mineral Ltda.',
  ]
  const norm = faseAtual.toLowerCase()
  const fasesAlt = ['pesquisa', 'lavra', 'concessao', 'requerimento'].filter(
    (f) => f !== norm,
  )
  const out: ProcessoVizinho[] = []
  for (let i = 0; i < n; i++) {
    const d = 5 + ((hash + i * 11) % 31)
    const baseRisk = risk ?? 50 + (hash % 31)
    const rs = Math.max(
      12,
      Math.min(92, baseRisk + (i % 2 === 0 ? -9 : 11)),
    )
    const faseV =
      fasesAlt[i % fasesAlt.length] === 'concessao'
        ? 'Concessão'
        : fasesAlt[i % fasesAlt.length] === 'requerimento'
          ? 'Requerimento'
          : fasesAlt[i % fasesAlt.length] === 'lavra'
            ? 'Lavra'
            : 'Pesquisa'
    const ano = 2008 + ((hash + i * 7) % 16)
    const n1 = 200 + ((hash + i * 53) % 800)
    const n2 = 100 + ((hash + i * 41) % 900)
    const numero = `${String(n1).padStart(3, '0')}.${String(n2).padStart(3, '0')}/${ano}`
    out.push({
      numero,
      titular: titulares[i % titulares.length]!,
      substancia: subst,
      fase: faseV,
      distancia_km: d,
      area_ha: Math.round(80 + i * 120 + (id.charCodeAt(2) % 50)),
      risk_score: rs,
    })
  }
  return out
}

type Seed = {
  id: string
  numero: string
  regime: string
  fase: string
  substancia: string
  titular: string
  area_ha: number
  uf: string
  municipio: string
  data_protocolo: string
  ano_protocolo: number
  situacao: string
  risk_score: number | null
}

const SEEDS: Seed[] = [
  {
    id: 'p1',
    numero: '872.390/2012',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'FERRO',
    titular: 'Vale Mineração S.A.',
    area_ha: 1240.5,
    uf: 'MG',
    municipio: 'Itabira',
    data_protocolo: '2012-03-14',
    ano_protocolo: 2012,
    situacao: 'ativo',
    risk_score: 42,
  },
  {
    id: 'p2',
    numero: '841.102/2008',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'OURO',
    titular: 'St. George Mining Brasil',
    area_ha: 892.3,
    uf: 'MG',
    municipio: 'Araxá',
    data_protocolo: '2008-07-22',
    ano_protocolo: 2008,
    situacao: 'ativo',
    risk_score: 67,
  },
  {
    id: 'p3',
    numero: '910.445/2019',
    regime: 'concessao_lavra',
    fase: 'concessao',
    substancia: 'BAUXITA',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 2104.0,
    uf: 'MG',
    municipio: 'Poços de Caldas',
    data_protocolo: '2019-11-05',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 31,
  },
  {
    id: 'p4',
    numero: '798.201/2001',
    regime: 'concessao_lavra',
    fase: 'encerrado',
    substancia: 'COBRE',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 456.7,
    uf: 'MG',
    municipio: 'Montes Claros',
    data_protocolo: '2001-04-18',
    ano_protocolo: 2001,
    situacao: 'inativo',
    risk_score: 18,
  },
  {
    id: 'p5',
    numero: '883.667/2015',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'QUARTZO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 334.2,
    uf: 'MG',
    municipio: 'Diamantina',
    data_protocolo: '2015-09-30',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 55,
  },
  {
    id: 'p6',
    numero: '756.012/1995',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 982.0,
    uf: 'MG',
    municipio: 'Paracatu',
    data_protocolo: '1995-02-10',
    ano_protocolo: 1995,
    situacao: 'ativo',
    risk_score: 48,
  },
  {
    id: 'p7',
    numero: '901.223/2018',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    titular: 'Vale Mineração S.A.',
    area_ha: 1205.4,
    uf: 'MG',
    municipio: 'Governador Valadares',
    data_protocolo: '2018-06-12',
    ano_protocolo: 2018,
    situacao: 'ativo',
    risk_score: 72,
  },
  {
    id: 'p8',
    numero: '822.556/2005',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 678.9,
    uf: 'MG',
    municipio: 'Uberlândia',
    data_protocolo: '2005-08-25',
    ano_protocolo: 2005,
    situacao: 'ativo',
    risk_score: 39,
  },
  {
    id: 'p9',
    numero: '934.881/2021',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'COBRE',
    titular: 'St. George Mining Brasil',
    area_ha: 445.1,
    uf: 'PA',
    municipio: 'Marabá',
    data_protocolo: '2021-01-19',
    ano_protocolo: 2021,
    situacao: 'ativo',
    risk_score: 61,
  },
  {
    id: 'p10',
    numero: '888.334/2016',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 512.6,
    uf: 'PA',
    municipio: 'Parauapebas',
    data_protocolo: '2016-10-03',
    ano_protocolo: 2016,
    situacao: 'ativo',
    risk_score: 44,
  },
  {
    id: 'p11',
    numero: '845.991/2009',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 1334.8,
    uf: 'PA',
    municipio: 'Redenção',
    data_protocolo: '2009-05-27',
    ano_protocolo: 2009,
    situacao: 'ativo',
    risk_score: 53,
  },
  {
    id: 'p12',
    numero: '912.007/2019',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 721.3,
    uf: 'PA',
    municipio: 'Altamira',
    data_protocolo: '2019-04-08',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 58,
  },
  {
    id: 'p13',
    numero: '771.448/1998',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    titular: 'Vale Mineração S.A.',
    area_ha: 889.0,
    uf: 'PA',
    municipio: 'Tucuruí',
    data_protocolo: '1998-12-14',
    ano_protocolo: 1998,
    situacao: 'ativo',
    risk_score: 36,
  },
  {
    id: 'p14',
    numero: '925.112/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'FERRO',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 1567.2,
    uf: 'PA',
    municipio: 'Santarém',
    data_protocolo: '2020-08-21',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 74,
  },
  {
    id: 'p15',
    numero: '918.556/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'OURO',
    titular: 'St. George Mining Brasil',
    area_ha: 623.5,
    uf: 'GO',
    municipio: 'Catalão',
    data_protocolo: '2020-03-02',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 81,
  },
  {
    id: 'p16',
    numero: '867.201/2013',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'COBRE',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 412.8,
    uf: 'GO',
    municipio: 'Minaçu',
    data_protocolo: '2013-11-11',
    ano_protocolo: 2013,
    situacao: 'ativo',
    risk_score: 69,
  },
  {
    id: 'p17',
    numero: '806.778/2003',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'BAUXITA',
    titular: 'Vale Mineração S.A.',
    area_ha: 2341.0,
    uf: 'GO',
    municipio: 'Niquelândia',
    data_protocolo: '2003-07-07',
    ano_protocolo: 2003,
    situacao: 'ativo',
    risk_score: 77,
  },
  {
    id: 'p18',
    numero: '895.334/2017',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'NÍQUEL',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 298.4,
    uf: 'GO',
    municipio: 'Alto Horizonte',
    data_protocolo: '2017-02-28',
    ano_protocolo: 2017,
    situacao: 'ativo',
    risk_score: 41,
  },
  {
    id: 'p19',
    numero: '879.901/2015',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'QUARTZO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 156.2,
    uf: 'GO',
    municipio: 'Barro Alto',
    data_protocolo: '2015-12-01',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 29,
  },
  {
    id: 'p20',
    numero: '802.445/2002',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'FERRO',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 887.6,
    uf: 'GO',
    municipio: 'Goiás',
    data_protocolo: '2002-09-09',
    ano_protocolo: 2002,
    situacao: 'ativo',
    risk_score: 52,
  },
  {
    id: 'p21',
    numero: '940.001/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NEODIMIO',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 198.3,
    uf: 'BA',
    municipio: 'Irecê',
    data_protocolo: '2022-05-16',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 84,
  },
  {
    id: 'p22',
    numero: '941.002/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NIOBIO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 176.5,
    uf: 'BA',
    municipio: 'Jacobina',
    data_protocolo: '2022-06-20',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 79,
  },
  {
    id: 'p23',
    numero: '942.003/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'LITIO',
    titular: 'St. George Mining Brasil',
    area_ha: 245.0,
    uf: 'BA',
    municipio: 'Brumado',
    data_protocolo: '2023-01-11',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 87,
  },
  {
    id: 'p24',
    numero: '943.004/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'DISPRÓSIO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 132.7,
    uf: 'BA',
    municipio: 'Caetité',
    data_protocolo: '2023-08-30',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 82,
  },
  {
    id: 'p25',
    numero: '650.100/1987',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'OURO',
    titular: 'Vale Mineração S.A.',
    area_ha: 88.0,
    uf: 'AM',
    municipio: 'Presidente Figueiredo',
    data_protocolo: '1987-04-22',
    ano_protocolo: 1987,
    situacao: 'bloqueado',
    risk_score: 85,
  },
  {
    id: 'p26',
    numero: '651.101/1991',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'FERRO',
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 120.4,
    uf: 'AM',
    municipio: 'Itacoatiara',
    data_protocolo: '1991-09-05',
    ano_protocolo: 1991,
    situacao: 'bloqueado',
    risk_score: 86,
  },
  {
    id: 'p27',
    numero: '652.102/1994',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'BAUXITA',
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 64.2,
    uf: 'AM',
    municipio: 'Barcelos',
    data_protocolo: '1994-12-18',
    ano_protocolo: 1994,
    situacao: 'bloqueado',
    risk_score: 86,
  },
  {
    id: 'p28',
    numero: '960.501/2024',
    regime: 'bloqueio_provisorio',
    fase: 'lavra',
    substancia: 'COBRE',
    titular: 'St. George Mining Brasil',
    area_ha: 310.9,
    uf: 'MT',
    municipio: 'Guarantã do Norte',
    data_protocolo: '2024-02-14',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 70,
  },
  {
    id: 'p29',
    numero: '961.502/2024',
    regime: 'bloqueio_provisorio',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 205.6,
    uf: 'MT',
    municipio: 'Peixoto de Azevedo',
    data_protocolo: '2024-05-22',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 71,
  },
  {
    id: 'p30',
    numero: '962.503/2024',
    regime: 'bloqueio_provisorio',
    fase: 'requerimento',
    substancia: 'OURO',
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 142.1,
    uf: 'MT',
    municipio: 'Alta Floresta',
    data_protocolo: '2024-10-01',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 72,
  },
]

function pibMunicipioMi(municipio: string): number {
  const fix: Record<string, number> = {
    Itabira: 4200,
    Araxá: 8900,
    Parauapebas: 28000,
    Catalão: 12400,
    Marabá: 9800,
  }
  if (fix[municipio] != null) return fix[municipio]!
  let h = 0
  for (let i = 0; i < municipio.length; i++) h += municipio.charCodeAt(i)
  return 800 + (h % 5201)
}

function dependenciaTransferenciasPct(uf: string, seed: number): number {
  const r = seed % 100
  if (uf === 'AM' || uf === 'PA') return Math.round(75 + (r * 17) / 100)
  if (uf === 'MG') return Math.round(35 + (r * 20) / 100)
  if (uf === 'GO') return Math.round(40 + (r * 20) / 100)
  if (uf === 'BA') return Math.round(65 + (r * 15) / 100)
  if (uf === 'MT') return Math.round(45 + (r * 20) / 100)
  return Math.round(50 + (r * 15) / 100)
}

function fiscalRicoPara(
  s: Seed,
  valorEstimadoUsdMi: number,
): DadosFiscaisRicos {
  const cfemIncluir =
    s.situacao !== 'bloqueado' &&
    (s.fase === 'lavra' || s.fase === 'concessao')
  const { historico, totalMi, aliquota } = cfemHistorico(
    s.area_ha,
    s.substancia,
    s.regime,
    cfemIncluir,
  )
  const seed = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pibMi = pibMunicipioMi(s.municipio)
  const depPct = dependenciaTransferenciasPct(s.uf, seed)
  const estimativaCfem =
    Math.round(
      valorEstimadoUsdMi *
        0.051 *
        (aliquota / 100) *
        PRODUCAO_ANUAL_PCT *
        5.1 *
        100,
    ) / 100

  const matriz: Record<
    string,
    Pick<
      DadosFiscaisRicos,
      | 'capag'
      | 'receita_propria_mi'
      | 'divida_consolidada_mi'
      | 'pib_municipal_mi'
      | 'dependencia_transferencias_pct'
      | 'incentivos_estaduais'
      | 'linhas_bndes'
      | 'observacao'
    >
  > = {
    MG: {
      capag: 'A',
      receita_propria_mi: 420,
      divida_consolidada_mi: 280,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'ICMS Ecológico: redução para projetos certificados',
        'Isenção parcial ICMS minerais estratégicos',
      ],
      linhas_bndes: ['Finem', 'Finame', 'Proesco', 'Nova Indústria Brasil'],
      observacao:
        'Base industrial consolidada em MG; disciplina fiscal com novos capex de lavra.',
    },
    PA: {
      capag: 'B',
      receita_propria_mi: 310,
      divida_consolidada_mi: 195,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'Redução de base ICMS mineração e ferrovia',
        'Programa de royalties municipais renegociado',
      ],
      linhas_bndes: ['Finem Mineração', 'Nova Indústria Brasil', 'Finame'],
      observacao:
        'Dependência de CFEM e FPM; sensível a ciclo do minério de ferro e logística hidroviária.',
    },
    GO: {
      capag: 'A',
      receita_propria_mi: 265,
      divida_consolidada_mi: 142,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'CONFAZ 88/2025: cadeia de terras raras e níquel',
        'PRODUZIR GO',
      ],
      linhas_bndes: ['Finem Mineração', 'Finame', 'Nova Indústria Brasil'],
      observacao:
        'Capacidade confortável; polo de terras raras eleva atratividade de Finem.',
    },
    BA: {
      capag: 'B',
      receita_propria_mi: 118,
      divida_consolidada_mi: 72,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'DESENVOLVE BA: mineração e logística',
        'Redução ICMS exportação de minérios',
      ],
      linhas_bndes: ['Finem Mineração', 'Nova Indústria Brasil'],
      observacao:
        'Receita própria volátil; minerais críticos ampliam janela de incentivos.',
    },
    AM: {
      capag: 'C',
      receita_propria_mi: 62,
      divida_consolidada_mi: 48,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'Zona Franca de Manaus: equipamentos importados',
        'Redução ICMS insumos industriais',
      ],
      linhas_bndes: ['Finem', 'Finame', 'FNO Amazônia'],
      observacao:
        'Capacidade limitada; projetos dependem de garantias federais e FNO.',
    },
    MT: {
      capag: 'B',
      receita_propria_mi: 95,
      divida_consolidada_mi: 58,
      pib_municipal_mi: 0,
      dependencia_transferencias_pct: 0,
      incentivos_estaduais: [
        'PRODEI MT: instalações industriais no interior',
        'Redução base ICMS mineração',
      ],
      linhas_bndes: ['Finem Mineração', 'FCO Industrial', 'Finame'],
      observacao:
        'Fronteira agrícola-mineral; FCO relevante para PME da cadeia.',
    },
  }

  const base = matriz[s.uf] ?? matriz.MG!
  const capag =
    s.situacao === 'bloqueado'
      ? ('D' as const)
      : s.regime === 'mineral_estrategico'
        ? ('A' as const)
        : base.capag

  return {
    ...base,
    capag,
    capag_descricao: capagDescricao(capag),
    pib_municipal_mi: pibMi,
    dependencia_transferencias_pct: depPct,
    cfem_historico: historico,
    cfem_total_5anos_mi: totalMi,
    cfem_municipal_historico: cfemMunicipalHistoricoPara(s.uf),
    aliquota_cfem_pct: aliquota,
    estimativa_cfem_anual_operacao_mi:
      s.regime === 'bloqueio_permanente' ? 0 : estimativaCfem,
  }
}

/** Datas ISO YYYY-MM-DD no intervalo [min, max] (determinístico por seed). */
function dataIsoEntre(seed: number, minIso: string, maxIso: string): string {
  const t0 = new Date(minIso + 'T12:00:00.000Z').getTime()
  const t1 = new Date(maxIso + 'T12:00:00.000Z').getTime()
  const span = Math.max(0, Math.floor((t1 - t0) / 86_400_000))
  const dayOff = span > 0 ? seed % (span + 1) : 0
  const d = new Date(t0 + dayOff * 86_400_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Frequências distintas por fonte; coerente com 2025-11-01 … 2026-03-24. */
function timestampsPara(s: Seed): Timestamps {
  const h = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const h2 = h * 31 + s.ano_protocolo

  const sigmine = dataIsoEntre(h, '2026-03-18', '2026-03-24')
  const cadastro_mineiro = dataIsoEntre(h + 11, '2026-02-01', '2026-03-22')
  const cfem = dataIsoEntre(h + 19, '2026-02-10', '2026-03-20')
  const terras_indigenas = dataIsoEntre(h + 3, '2025-12-02', '2026-03-15')
  const unidades_conservacao = dataIsoEntre(h + 7, '2025-11-20', '2026-03-10')
  const cfem_municipal = dataIsoEntre(h2, '2026-01-08', '2026-03-18')
  /* Preço spot: data fixa para alinhar ao exemplo de rodapé (16/03/2026 + fonte IEA na UI). */
  const preco_spot = '2026-03-16'
  const alertas_legislativos = dataIsoEntre(h + 41, '2026-02-18', '2026-03-24')

  const diaUsgs = 8 + (h % 14)
  const usgs = `2026-01-${String(diaUsgs).padStart(2, '0')}`

  const diaSiconfi = 12 + (h % 17)
  const siconfi = `2025-08-${String(diaSiconfi).padStart(2, '0')}`

  return {
    cadastro_mineiro,
    sigmine,
    cfem,
    terras_indigenas,
    unidades_conservacao,
    siconfi,
    cfem_municipal,
    usgs,
    preco_spot,
    alertas_legislativos,
  }
}

function buildRelatorio(s: Seed): RelatorioData {
  const anoAtual = new Date().getFullYear()
  const anosTram = Math.max(0, anoAtual - s.ano_protocolo)
  const hash = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  const pend = pendenciasPorRegime(s.regime, s.situacao)
  const intelBase = intelPorSubstancia(s.substancia, s.area_ha, s.id)
  const intel_mineral: IntelMineral = {
    ...intelBase,
    processos_vizinhos: vizinhosFicticios(
      s.substancia,
      s.uf,
      s.fase,
      s.risk_score,
      s.id,
    ),
  }

  return {
    processo_id: s.id,
    timestamps: timestampsPara(s),
    dados_anm: {
      fase_atual: `${s.fase}: regime ${s.regime.replace(/_/g, ' ')}`,
      data_protocolo: s.data_protocolo,
      prazo_vencimento: prazoVencimentoPara(s),
      tempo_tramitacao_anos: Math.round(anosTram * 10) / 10,
      pendencias: pend,
      ultimo_despacho:
        s.situacao === 'bloqueado'
          ? 'Despacho de suspensão e arquivamento provisório'
          : 'Despacho de ofício complementar à documentação técnica',
      data_ultimo_despacho: `${anoAtual - (hash % 2)}-${String((hash % 11) + 1).padStart(2, '0')}-${String((hash % 27) + 1).padStart(2, '0')}`,
      numero_sei: `${(hash % 9000000) + 1000000}.${hash % 99}/${anoAtual}`,
      observacoes_tecnicas: `Área de ${s.area_ha.toLocaleString('pt-BR')} ha em ${s.municipio}/${s.uf}. Modelo geológico revisado em ${anoAtual - 1}; coordenadas oficiais conferidas ao SIGMINE.`,
    },
    territorial: territorialPorUf(s.uf, hash),
    intel_mineral,
    fiscal: fiscalRicoPara(s, intelBase.valor_estimado_usd_mi),
  }
}

const relatoriosMock: Record<string, RelatorioData> = Object.fromEntries(
  SEEDS.map((s) => [s.id, buildRelatorio(s)]),
) as Record<string, RelatorioData>

export { relatoriosMock }
