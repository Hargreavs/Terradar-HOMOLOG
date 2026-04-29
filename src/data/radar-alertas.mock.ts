export interface RadarAlerta {
  id: string
  titulo: string
  ementa: string
  nivel_impacto: 1 | 2 | 3 | 4
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro'
  fonte: string
  fonte_nome_completo: string
  data: string
  /** Hora da publicação (HH:mm), para exibição no feed. */
  hora: string
  substancias_afetadas: string[]
  processos_afetados_ids: string[]
  /** Contagem do servidor (quando disponível); senão usar `processos_afetados_ids.length`. */
  total_processos_afetados?: number
  /** Texto da seção Análise Terrae (fallback: ementa). */
  analise?: string
  urgencia: 'imediata' | 'medio_prazo' | 'longo_prazo'
}

/** YYYY-MM-DD no fuso local (igual ao filtro "Hoje" no Radar; evita desvio de `toISOString()` UTC). */
function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RADAR_MOCK_DATA_HOJE = ymdLocal(new Date())

/** Ordem: mais recente primeiro no feed (parse data+hora). */
const RADAR_MOCK_HORAS_HOJE = ['17:00', '15:20', '13:45', '10:15', '08:30'] as const

function radarMockDataDiasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymdLocal(d)
}

export const RADAR_ALERTAS_MOCK: RadarAlerta[] = [
  {
    id: 'ra1',
    titulo:
      'Portaria ANM nº 12.884/2026: Retificação de área de concessão de lavra em Parauapebas/PA',
    ementa:
      'Altera poligonal de uma concessão de ferro em área contígua a ferrovia, com exigência de novo relatório de impacto. Afeta cronogramas de lavra e licenciamento complementar.',
    analise:
      'Altera poligonal de uma concessão de ferro em área contígua a ferrovia, com exigência de novo relatório de impacto. Afeta cronogramas de lavra e licenciamento complementar.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[0],
    substancias_afetadas: ['FERRO'],
    processos_afetados_ids: ['p1', 'p2', 'p7'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra2',
    titulo: 'Decreto MME 11.402/2026: Atualização da lista de minerais críticos e estratégicos',
    ementa:
      'Inclui novos minerais na política de suprimento crítico, com prioridade em cadastro e eventual trâmite diferenciado na ANM e órgãos ambientais.',
    analise:
      'Inclui novos minerais na política de suprimento crítico, com prioridade em cadastro e eventual trâmite diferenciado na ANM e órgãos ambientais.',
    nivel_impacto: 1,
    tipo_impacto: 'restritivo',
    fonte: 'DOU',
    fonte_nome_completo: 'Diário Oficial da União',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[1],
    substancias_afetadas: ['LÍTIO', 'NÍOBIO', 'NEODÍMIO'],
    processos_afetados_ids: ['p25', 'p26', 'p27'],
    urgencia: 'imediata',
  },
  {
    id: 'ra3',
    titulo: 'PL 8.901/2026: Câmara dos Deputados - Licenciamento ambiental em terra indígena',
    ementa:
      'Propõe marco para consulta e licenciamento em TI, com prazos e competências compartilhadas. Texto em fase de comissões; impacto regulatório ainda incerto.',
    analise:
      'Propõe marco para consulta e licenciamento em TI, com prazos e competências compartilhadas. Texto em fase de comissões; impacto regulatório ainda incerto.',
    nivel_impacto: 1,
    tipo_impacto: 'neutro',
    fonte: 'Câmara',
    fonte_nome_completo: 'Câmara dos Deputados',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[2],
    substancias_afetadas: ['OURO', 'COBRE'],
    processos_afetados_ids: ['p4', 'p15', 'p18'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra4',
    titulo: 'Resolução IBAMA 689/2026: APP e faixa marginal em bacias amazônicas',
    ementa:
      'Endurece parâmetros de vegetação nativa em APP para novos empreendimentos. Exige revisão de EIA/RIMA em processos em licenciamento na Amazônia Legal.',
    analise:
      'Endurece parâmetros de vegetação nativa em APP para novos empreendimentos. Exige revisão de EIA/RIMA em processos em licenciamento na Amazônia Legal.',
    nivel_impacto: 1,
    tipo_impacto: 'restritivo',
    fonte: 'IBAMA',
    fonte_nome_completo: 'Instituto Brasileiro do Meio Ambiente',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[3],
    substancias_afetadas: ['BAUXITA', 'FERRO'],
    processos_afetados_ids: ['p16', 'p19', 'p22'],
    urgencia: 'imediata',
  },
  {
    id: 'ra5',
    titulo: 'Senado: PLS 612/2026 - Royalties diferenciados para cobre e níquel',
    ementa:
      'Estabelece alíquotas progressivas e fundo regional. Pode alterar modelagem econômica de projetos em GO e PA.',
    analise:
      'Estabelece alíquotas progressivas e fundo regional. Pode alterar modelagem econômica de projetos em GO e PA.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'Senado',
    fonte_nome_completo: 'Senado Federal',
    data: RADAR_MOCK_DATA_HOJE,
    hora: RADAR_MOCK_HORAS_HOJE[4],
    substancias_afetadas: ['COBRE', 'NÍQUEL'],
    processos_afetados_ids: ['p5', 'p24', 'p28'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra6',
    titulo: 'Portaria ANM 4.120/2026: Autorização de pesquisa para terras raras em Goiás',
    ementa:
      'Publica autorização de pesquisa com condicionantes de relatório anual e geometria retificável. Sinal positivo para pipeline de terras raras.',
    analise:
      'Publica autorização de pesquisa com condicionantes de relatório anual e geometria retificável. Sinal positivo para pipeline de terras raras.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(1),
    hora: '10:00',
    substancias_afetadas: ['NEODÍMIO', 'DISPRÓSIO'],
    processos_afetados_ids: ['p25', 'p26'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra7',
    titulo: 'Edital BNDES 06/2026: Finame verde para logística mineral',
    ementa:
      'Linha de crédito para ferrovias e portos privados com critérios ESG. Beneficia projetos com alto volume e integração modal.',
    analise:
      'Linha de crédito para ferrovias e portos privados com critérios ESG. Beneficia projetos com alto volume e integração modal.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    fonte: 'BNDES',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(2),
    hora: '15:45',
    substancias_afetadas: ['FERRO', 'BAUXITA'],
    processos_afetados_ids: ['p1', 'p8', 'p11'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra8',
    titulo: 'ANTT: Resolução 5.901/2026 - Tarifa ferroviária e trackage rights',
    ementa:
      'Revisa metodologia de tarifas em malhas concedidas. Pode reduzir custo logístico para minério a granel no Arco Norte.',
    analise:
      'Revisa metodologia de tarifas em malhas concedidas. Pode reduzir custo logístico para minério a granel no Arco Norte.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'ANTT',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(3),
    hora: '12:10',
    substancias_afetadas: ['FERRO'],
    processos_afetados_ids: ['p2', 'p9'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra9',
    titulo: 'Finep: Chamada pública 18/2026 - Inovação em lixiviação de lítio',
    ementa:
      'Subvenção econômica para rotas de DLE e rejeitos. Foco em projetos com TRL 6+ em território nacional.',
    analise:
      'Subvenção econômica para rotas de DLE e rejeitos. Foco em projetos com TRL 6+ em território nacional.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    fonte: 'Finep',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(4),
    hora: '17:55',
    substancias_afetadas: ['LÍTIO'],
    processos_afetados_ids: ['p27'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra10',
    titulo: 'Portaria ANM 9.201/2026: Bloqueio provisório por sobreposição cadastral',
    ementa:
      'Suspende análise de requerimento em área com sobreposição a requerimento anterior até saneamento documental.',
    analise:
      'Suspende análise de requerimento em área com sobreposição a requerimento anterior até saneamento documental.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(5),
    hora: '13:20',
    substancias_afetadas: ['OURO'],
    processos_afetados_ids: ['p3', 'p12'],
    urgencia: 'imediata',
  },
  {
    id: 'ra11',
    titulo: 'MME: Ordem de serviço para estudos de minerais críticos em MG',
    ementa:
      'Contratação de levantamento técnico sobre jazidas e cadastro estratégico; não altera titularidade, mas orienta política setorial.',
    analise:
      'Contratação de levantamento técnico sobre jazidas e cadastro estratégico; não altera titularidade, mas orienta política setorial.',
    nivel_impacto: 4,
    tipo_impacto: 'neutro',
    fonte: 'DOU',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(6),
    hora: '09:50',
    substancias_afetadas: ['FERRO', 'NÍQUEL'],
    processos_afetados_ids: ['p6', 'p13', 'p24'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra12',
    titulo: 'IBAMA: Parecer técnico 4402/2026 - Licença prévia cobre em área sensível',
    ementa:
      'Determina condicionante de monitoramento hídrico contínuo e plano de contingência revisado em 180 dias.',
    analise:
      'Determina condicionante de monitoramento hídrico contínuo e plano de contingência revisado em 180 dias.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    fonte: 'IBAMA',
    fonte_nome_completo: 'Instituto Brasileiro do Meio Ambiente',
    data: radarMockDataDiasAtras(7),
    hora: '14:33',
    substancias_afetadas: ['COBRE'],
    processos_afetados_ids: ['p5', 'p14', 'p21'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra13',
    titulo: 'Câmara: PL 7.120/2026 - Cadastro nacional de áreas em litígio mineral',
    ementa:
      'Cria registro público de litígios e bloqueios judiciais para consulta prévia a investidores.',
    analise:
      'Cria registro público de litígios e bloqueios judiciais para consulta prévia a investidores.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'Câmara',
    fonte_nome_completo: 'Câmara dos Deputados',
    data: radarMockDataDiasAtras(8),
    hora: '11:11',
    substancias_afetadas: ['QUARTZO', 'BAUXITA'],
    processos_afetados_ids: ['p10', 'p17', 'p20'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra14',
    titulo: 'ANM: Despacho de concessão de lavra - Nióbio em Goiás',
    ementa:
      'Publica concessão de lavra com plano de fechamento e garantias financeiras. Marco favorável para titular e cadeia de fornecedores.',
    analise:
      'Publica concessão de lavra com plano de fechamento e garantias financeiras. Marco favorável para titular e cadeia de fornecedores.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(9),
    hora: '10:25',
    substancias_afetadas: ['NÍOBIO'],
    processos_afetados_ids: ['p26'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra15',
    titulo: 'Senado: Audiência pública - TI e mineração em MT',
    ementa:
      'Debatedores discutem consulta prévia e compensações. Sem force de lei; orienta risco reputacional e social.',
    analise:
      'Debatedores discutem consulta prévia e compensações. Sem force de lei; orienta risco reputacional e social.',
    nivel_impacto: 4,
    tipo_impacto: 'neutro',
    fonte: 'Senado',
    fonte_nome_completo: 'Senado Federal',
    data: radarMockDataDiasAtras(10),
    hora: '15:00',
    substancias_afetadas: ['OURO', 'FERRO'],
    processos_afetados_ids: ['p23', 'p29', 'p30'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra16',
    titulo: 'DOU: Retificação de edital de leilão de blocos exploratórios (arrecadação ANM)',
    ementa:
      'Corrige coordenadas e prazos de manifestação de interesse para áreas em MT e AM.',
    analise:
      'Corrige coordenadas e prazos de manifestação de interesse para áreas em MT e AM.',
    nivel_impacto: 4,
    tipo_impacto: 'neutro',
    fonte: 'DOU',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(11),
    hora: '08:45',
    substancias_afetadas: ['COBRE', 'OURO'],
    processos_afetados_ids: ['p18', 'p30'],
    urgencia: 'medio_prazo',
  },
  {
    id: 'ra17',
    titulo: 'BNDES: Linha de apoio a PPP de infraestrutura portuária no Pará',
    ementa:
      'Condições especiais para terminal de minério com contrapartida ambiental. Janela de 24 meses.',
    analise:
      'Condições especiais para terminal de minério com contrapartida ambiental. Janela de 24 meses.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    fonte: 'BNDES',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(12),
    hora: '12:30',
    substancias_afetadas: ['FERRO', 'BAUXITA'],
    processos_afetados_ids: ['p1', 'p11'],
    urgencia: 'longo_prazo',
  },
  {
    id: 'ra18',
    titulo: 'ANM: Ofício-circular sobre prazos de resposta a complementações',
    ementa:
      'Padroniza contagem de prazo em dias úteis e canal eletrônico único. Reduz incerteza operacional para despachantes.',
    analise:
      'Padroniza contagem de prazo em dias úteis e canal eletrônico único. Reduz incerteza operacional para despachantes.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    fonte: 'ANM',
    fonte_nome_completo: 'Diário Oficial da União',
    data: radarMockDataDiasAtras(13),
    hora: '18:00',
    substancias_afetadas: ['LÍTIO', 'DISPRÓSIO', 'QUARTZO'],
    processos_afetados_ids: ['p25', 'p27', 'p20'],
    urgencia: 'medio_prazo',
  },
]
