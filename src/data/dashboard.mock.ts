export interface DashboardAlertaRecente {
  id: string
  titulo: string
  /** Categoria da publicação (ex.: Portaria). */
  tipo: string
  /** Classificação de impacto (mesmo eixo dos alertas no mapa / relatório). */
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro' | 'incerto'
  nivel_impacto: 1 | 2 | 3 | 4
  /** Nome completo da fonte na metadata do card (sem prefixo “via”). */
  fonte_publicacao: string
  data: string
  /** Ementa ou texto oficial da publicação (tooltip no dashboard). */
  ementa: string
  substancias_afetadas: string[]
}

export const dashboardMock = {
  alertas_recentes: [
    {
      id: 'alerta-1',
      titulo:
        'PL 2.564/2024 regulamenta exploração de terras raras em TIs',
      tipo: 'Projeto de Lei',
      tipo_impacto: 'restritivo',
      nivel_impacto: 1,
      fonte_publicacao: 'Câmara dos Deputados',
      data: '2026-03-23',
      ementa:
        'Estabelece novo marco regulatório para exploração de minerais estratégicos em Terras Indígenas, com exigência de consulta prévia e repartição de benefícios.',
      substancias_afetadas: ['Terras Raras', 'Nióbio', 'Lítio'],
    },
    {
      id: 'alerta-2',
      titulo:
        'Portaria ANM 847/2026 atualiza prazos de renovação de Autorização de Pesquisa',
      tipo: 'Portaria',
      tipo_impacto: 'neutro',
      nivel_impacto: 2,
      fonte_publicacao: 'Diário Oficial da União',
      data: '2026-03-20',
      ementa:
        'Reduz de 3 para 2 anos o prazo máximo de renovação de Autorização de Pesquisa para substâncias não estratégicas.',
      substancias_afetadas: [],
    },
    {
      id: 'alerta-3',
      titulo: 'Decreto MME amplia lista de minerais críticos para 2026',
      tipo: 'Decreto',
      tipo_impacto: 'favoravel',
      nivel_impacto: 1,
      fonte_publicacao: 'Diário Oficial da União',
      data: '2026-03-18',
      ementa:
        'Inclui grafite e vanádio na lista de minerais estratégicos, seguindo alinhamento com o Critical Minerals Agreement firmado com os EUA.',
      substancias_afetadas: ['Grafite', 'Vanádio'],
    },
    {
      id: 'alerta-4',
      titulo:
        'IBAMA publica novas regras para licenciamento ambiental minerário em APP',
      tipo: 'Resolução',
      tipo_impacto: 'restritivo',
      nivel_impacto: 2,
      fonte_publicacao: 'Diário Oficial da União',
      data: '2026-03-15',
      ementa:
        'Define critérios mais restritivos para atividades de pesquisa e lavra em Áreas de Preservação Permanente, com exigência de compensação ambiental ampliada.',
      substancias_afetadas: [],
    },
  ] satisfies DashboardAlertaRecente[],

  stats: {
    total_processos: 30,
    total_area_ha: 14820,
    processos_ativos: 24,
    processos_bloqueados: 6,
    area_mineral_estrategico_ha: 3240,
    ufs_cobertas: 6,
    titulares_unicos: 6,
    risk_score_medio: 52,
    processos_alto_risco: 8,
    processos_baixo_risco: 11,
  },

  por_regime: [
    { regime: 'Autorização de Pesquisa', count: 8, area_ha: 3840, cor: '#5B9A6F' },
    { regime: 'Concessão de Lavra', count: 5, area_ha: 4200, cor: '#4A90B8' },
    { regime: 'Req. de Lavra', count: 4, area_ha: 1680, cor: '#8B7CB8' },
    { regime: 'Licenciamento', count: 3, area_ha: 1200, cor: '#7A9B5A' },
    { regime: 'Mineral Estratégico', count: 4, area_ha: 1980, cor: '#2D8B70' },
    { regime: 'Bloqueio Permanente', count: 3, area_ha: 960, cor: '#A85C5C' },
    { regime: 'Bloqueio Provisório', count: 3, area_ha: 960, cor: '#C4915A' },
  ],

  por_uf: [
    { uf: 'MG', count: 8, area_ha: 4820, risk_medio: 44 },
    { uf: 'PA', count: 6, area_ha: 3640, risk_medio: 68 },
    { uf: 'GO', count: 6, area_ha: 2880, risk_medio: 49 },
    { uf: 'BA', count: 4, area_ha: 1640, risk_medio: 61 },
    { uf: 'AM', count: 3, area_ha: 1240, risk_medio: 74 },
    { uf: 'MT', count: 3, area_ha: 600, risk_medio: 55 },
  ],

  /**
   * Índices no gráfico: Ferro/Cobre/Ouro/Nióbio = (valor/2019)×100; Terras Raras = (valor/2019)×8 (base simbólica 8).
   * Metas ~2024 no índice: Ouro ~280, Cobre ~165, Ferro ~120, Nióbio ~115, Terras ~110 → eixo Y ~280–300.
   */
  producao_historica: [
    { ano: 2019, ferro: 42000, cobre: 1200, ouro: 8, niobio: 3400, terras_raras: 10 },
    { ano: 2020, ferro: 38000, cobre: 980, ouro: 6, niobio: 3100, terras_raras: 15 },
    { ano: 2021, ferro: 45000, cobre: 1400, ouro: 11, niobio: 3600, terras_raras: 31.25 },
    { ano: 2022, ferro: 48000, cobre: 1650, ouro: 14, niobio: 3750, terras_raras: 62.5 },
    { ano: 2023, ferro: 51000, cobre: 1820, ouro: 18, niobio: 3830, terras_raras: 100 },
    { ano: 2024, ferro: 50400, cobre: 1980, ouro: 22.4, niobio: 3910, terras_raras: 137.5 },
  ],

  ranking_titulares: [
    {
      titular: 'Vale Mineração S.A.',
      processos: 5,
      area_ha: 4200,
      substancias: ['FERRO', 'OURO'],
      risk_medio: 42,
    },
    {
      titular: 'Atlas Critical Minerals Brasil',
      processos: 5,
      area_ha: 2840,
      substancias: ['NEODIMIO', 'COBRE'],
      risk_medio: 68,
    },
    {
      titular: 'Serra Verde Mining Ltda.',
      processos: 5,
      area_ha: 2160,
      substancias: ['LITIO', 'OURO'],
      risk_medio: 51,
    },
    {
      titular: 'Viridis Recursos Minerais Ltda.',
      processos: 5,
      area_ha: 1980,
      substancias: ['NIOBIO', 'QUARTZO'],
      risk_medio: 58,
    },
    {
      titular: 'Companhia Brasileira de Metalurgia',
      processos: 5,
      area_ha: 2240,
      substancias: ['NIOBIO', 'FERRO'],
      risk_medio: 38,
    },
    {
      titular: 'St. George Mining Brasil',
      processos: 5,
      area_ha: 1400,
      substancias: ['DISPRÓSIO', 'COBRE'],
      risk_medio: 71,
    },
  ],

  minerais_estrategicos: [
    {
      substancia: 'Neodímio',
      sigla: 'Nd',
      processos: 2,
      area_ha: 480,
      reservas_pct: 23,
      producao_pct: 0.8,
      preco_usd_t: 68000,
      tendencia: 'alta' as const,
      demandaNivel: 'alta' as const,
    },
    {
      substancia: 'Nióbio',
      sigla: 'Nb',
      processos: 2,
      area_ha: 520,
      reservas_pct: 94,
      producao_pct: 88,
      preco_usd_t: 41000,
      tendencia: 'estavel' as const,
      demandaNivel: 'moderada' as const,
    },
    {
      substancia: 'Lítio',
      sigla: 'Li',
      processos: 2,
      area_ha: 680,
      reservas_pct: 5,
      producao_pct: 2,
      preco_usd_t: 13000,
      tendencia: 'estavel' as const,
      demandaNivel: 'moderada' as const,
    },
    {
      substancia: 'Disprósio',
      sigla: 'Dy',
      processos: 1,
      area_ha: 198,
      reservas_pct: 23,
      producao_pct: 0.8,
      preco_usd_t: 290000,
      tendencia: 'alta' as const,
      demandaNivel: 'alta' as const,
    },
    {
      substancia: 'Praseodímio',
      sigla: 'Pr',
      processos: 1,
      area_ha: 320,
      reservas_pct: 23,
      producao_pct: 0.8,
      preco_usd_t: 82000,
      tendencia: 'alta' as const,
      demandaNivel: 'alta' as const,
    },
    {
      substancia: 'Térbio',
      sigla: 'Tb',
      processos: 1,
      area_ha: 240,
      reservas_pct: 23,
      producao_pct: 0.8,
      preco_usd_t: 1200000,
      tendencia: 'alta' as const,
      demandaNivel: 'alta' as const,
    },
  ],

  calor_investimento: [
    { uf: 'MG', lat: -18.5, lng: -44.5, intensidade: 0.85, valor_mi: 124 },
    { uf: 'PA', lat: -5.5, lng: -52.0, intensidade: 0.72, valor_mi: 98 },
    { uf: 'GO', lat: -15.5, lng: -49.5, intensidade: 0.61, valor_mi: 76 },
    { uf: 'BA', lat: -12.5, lng: -41.5, intensidade: 0.44, valor_mi: 52 },
    { uf: 'AM', lat: -3.5, lng: -62.0, intensidade: 0.38, valor_mi: 41 },
    { uf: 'MT', lat: -12.5, lng: -55.5, intensidade: 0.29, valor_mi: 28 },
  ],
}
