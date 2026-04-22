# TERRADAR — Exportação dos dados mock de Prospecção (Radar, resultados)

Documento para reescrita dos textos descritivos com lógica algorítmica. Nenhum ficheiro de código da aplicação (`src/`, etc.) foi alterado para gerar este export.

## Mapa de fontes no código

| Área | Ficheiro |
|------|----------|
| Lista de processos (titular, UF, área, fase, risk, alertas, fiscal…) | `src/data/processos.mock.ts` → `processosMock` |
| Cálculo de `OpportunityResult` | `src/lib/opportunityScore.ts` → `computeOpportunityForProcesso`, `runProspeccao` |
| Variáveis ricas do card (`nome`, `valor`, `texto`, `fonte`) | `src/lib/opportunityCardMockData.ts` |
| Algoritmo descrição / fatores | `src/lib/opportunityCardCopy.ts` |
| UI: tooltips fallback, `mockVarValor`, drilldown | `src/components/dashboard/ProspeccaoResultados.tsx` |
| Filtro, perfil, objetivo, ranking | `src/components/dashboard/RadarDashboard.tsx` |

## Interface `OpportunityResult` (`opportunityScore.ts`)

```ts
export interface OpportunityResult {
  processoId: string
  scoreTotal: number
  scoreAtratividade: number
  scoreViabilidade: number
  scoreSeguranca: number
  faixa: 'alta' | 'moderada' | 'baixa' | 'desfavoravel'
  fatoresPositivos: string[]
  fatoresAtencao: string[]
}
```

## Comportamento na UI

- Com entrada em `getOpportunityCardVariaveis(id)` (`opportunityCardMockData`): barras, textos sob as barras e fatores seguem `opportunityCardCopy.ts` (scores derivados das variáveis).
- Sem entrada: tooltips `tooltipAtratividade` / `tooltipViabilidade` / `tooltipSeguranca`; drilldown usa `mockVarValor`; fatores vêm de `computeOpportunityForProcesso`.

## Parâmetros do JSON seguinte

- **Perfil:** `moderado`
- **Objetivo:** `investir`
- **Conjunto:** todos os `processosMock` (30 processos, `p1` … `p30`).

---

## JSON — scores e fatores por processo (`computeOpportunityForProcesso`)

```json
[
  {
    "id": "p1",
    "numero": "872.390/2012",
    "substancia": "FERRO",
    "titular": "Vale Mineração S.A.",
    "municipio": "Itabira",
    "uf": "MG",
    "area_ha": 1240.5,
    "fase": "lavra",
    "situacao": "ativo",
    "risk_score": 42,
    "valor_estimado_usd_mi": 166,
    "scoreTotal": 60,
    "faixa": "moderada",
    "scoreAtratividade": 38,
    "scoreViabilidade": 86,
    "scoreSeguranca": 63,
    "fatoresPositivos": [
      "Risk Score 42/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada",
      "Processo em fase de lavra (maduro)"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p2",
    "numero": "841.102/2008",
    "substancia": "OURO",
    "titular": "St. George Mining Brasil",
    "municipio": "Araxá",
    "uf": "MG",
    "area_ha": 892.3,
    "fase": "lavra",
    "situacao": "ativo",
    "risk_score": 67,
    "valor_estimado_usd_mi": 166,
    "scoreTotal": 61,
    "faixa": "moderada",
    "scoreAtratividade": 58,
    "scoreViabilidade": 86,
    "scoreSeguranca": 39,
    "fatoresPositivos": [
      "OURO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 62.000/t",
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Componente ambiental do risco pressionado"
    ]
  },
  {
    "id": "p3",
    "numero": "910.445/2019",
    "substancia": "BAUXITA",
    "titular": "Companhia Brasileira de Metalurgia",
    "municipio": "Poços de Caldas",
    "uf": "MG",
    "area_ha": 2104,
    "fase": "concessao",
    "situacao": "ativo",
    "risk_score": 31,
    "valor_estimado_usd_mi": 166,
    "scoreTotal": 61,
    "faixa": "moderada",
    "scoreAtratividade": 36,
    "scoreViabilidade": 86,
    "scoreSeguranca": 71,
    "fatoresPositivos": [
      "Risk Score 31/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada",
      "Concessão aprovada, caminho operacional claro"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p4",
    "numero": "798.201/2001",
    "substancia": "COBRE",
    "titular": "Atlas Critical Minerals Brasil",
    "municipio": "Montes Claros",
    "uf": "MG",
    "area_ha": 456.7,
    "fase": "encerrado",
    "situacao": "inativo",
    "risk_score": 18,
    "valor_estimado_usd_mi": 166,
    "scoreTotal": 20,
    "faixa": "desfavoravel",
    "scoreAtratividade": 61,
    "scoreViabilidade": 52,
    "scoreSeguranca": 74,
    "fatoresPositivos": [
      "Risk Score 18/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "COBRE com alta relevância estratégica no mercado",
      "Tendência de demanda alta"
    ],
    "fatoresAtencao": [
      "Fase ainda distante da lavra (maior incerteza de prazo)",
      "Último despacho ANM há mais de 1 ano"
    ]
  },
  {
    "id": "p5",
    "numero": "883.667/2015",
    "substancia": "QUARTZO",
    "titular": "Serra Verde Mining Ltda.",
    "municipio": "Diamantina",
    "uf": "MG",
    "area_ha": 334.2,
    "fase": "lavra",
    "situacao": "ativo",
    "risk_score": 55,
    "valor_estimado_usd_mi": 166,
    "scoreTotal": 49,
    "faixa": "baixa",
    "scoreAtratividade": 25,
    "scoreViabilidade": 84,
    "scoreSeguranca": 47,
    "fatoresPositivos": [
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada",
      "Processo em fase de lavra (maduro)",
      "Situação ativa junto à ANM"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Tendência de demanda em queda"
    ]
  },
  {
    "id": "p6",
    "numero": "756.012/1995",
    "substancia": "FERRO",
    "titular": "Viridis Recursos Minerais Ltda.",
    "municipio": "Paracatu",
    "uf": "MG",
    "area_ha": 982,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 48,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 54,
    "faixa": "moderada",
    "scoreAtratividade": 35,
    "scoreViabilidade": 76,
    "scoreSeguranca": 57,
    "fatoresPositivos": [
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada",
      "Risk Score 48/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Situação ativa junto à ANM"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p7",
    "numero": "901.223/2018",
    "substancia": "OURO",
    "titular": "Vale Mineração S.A.",
    "municipio": "Governador Valadares",
    "uf": "MG",
    "area_ha": 1205.4,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 72,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 57,
    "faixa": "moderada",
    "scoreAtratividade": 55,
    "scoreViabilidade": 76,
    "scoreSeguranca": 40,
    "fatoresPositivos": [
      "OURO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 62.000/t",
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Trâmite regulatório com indicadores de risco elevados (ANM)"
    ]
  },
  {
    "id": "p8",
    "numero": "822.556/2005",
    "substancia": "BAUXITA",
    "titular": "Companhia Brasileira de Metalurgia",
    "municipio": "Uberlândia",
    "uf": "MG",
    "area_ha": 678.9,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 39,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 55,
    "faixa": "moderada",
    "scoreAtratividade": 33,
    "scoreViabilidade": 76,
    "scoreSeguranca": 64,
    "fatoresPositivos": [
      "Risk Score 39/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Classificação fiscal A (STN/SICONFI) — receita própria elevada",
      "Situação ativa junto à ANM"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p9",
    "numero": "934.881/2021",
    "substancia": "COBRE",
    "titular": "St. George Mining Brasil",
    "municipio": "Marabá",
    "uf": "PA",
    "area_ha": 445.1,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 61,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 58,
    "faixa": "moderada",
    "scoreAtratividade": 58,
    "scoreViabilidade": 68,
    "scoreSeguranca": 49,
    "fatoresPositivos": [
      "COBRE com alta relevância estratégica no mercado",
      "Tendência de demanda alta",
      "Referência de preço spot ~US$ 8.500/t"
    ],
    "fatoresAtencao": [
      "Poucos drivers regulatórios favoráveis",
      "Área útil reduzida para escala industrial"
    ]
  },
  {
    "id": "p10",
    "numero": "888.334/2016",
    "substancia": "QUARTZO",
    "titular": "Atlas Critical Minerals Brasil",
    "municipio": "Parauapebas",
    "uf": "PA",
    "area_ha": 512.6,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 44,
    "valor_estimado_usd_mi": 156,
    "scoreTotal": 48,
    "faixa": "baixa",
    "scoreAtratividade": 25,
    "scoreViabilidade": 61,
    "scoreSeguranca": 64,
    "fatoresPositivos": [
      "Risk Score 44/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Situação ativa junto à ANM",
      "Recência de despachos favorável"
    ],
    "fatoresAtencao": [
      "Tendência de demanda em queda",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p11",
    "numero": "845.991/2009",
    "substancia": "FERRO",
    "titular": "Serra Verde Mining Ltda.",
    "municipio": "Redenção",
    "uf": "PA",
    "area_ha": 1334.8,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 53,
    "valor_estimado_usd_mi": 156,
    "scoreTotal": 51,
    "faixa": "moderada",
    "scoreAtratividade": 38,
    "scoreViabilidade": 61,
    "scoreSeguranca": 60,
    "fatoresPositivos": [
      "Situação ativa junto à ANM",
      "Recência de despachos favorável",
      "Valor estimado de reservas ~US$ 156 mi"
    ],
    "fatoresAtencao": [
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)",
      "Poucos drivers regulatórios favoráveis"
    ]
  },
  {
    "id": "p12",
    "numero": "912.007/2019",
    "substancia": "OURO",
    "titular": "Viridis Recursos Minerais Ltda.",
    "municipio": "Altamira",
    "uf": "PA",
    "area_ha": 721.3,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 58,
    "valor_estimado_usd_mi": 156,
    "scoreTotal": 59,
    "faixa": "moderada",
    "scoreAtratividade": 58,
    "scoreViabilidade": 61,
    "scoreSeguranca": 57,
    "fatoresPositivos": [
      "OURO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 62.000/t",
      "Situação ativa junto à ANM"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Poucos drivers regulatórios favoráveis"
    ]
  },
  {
    "id": "p13",
    "numero": "771.448/1998",
    "substancia": "BAUXITA",
    "titular": "Vale Mineração S.A.",
    "municipio": "Tucuruí",
    "uf": "PA",
    "area_ha": 889,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 36,
    "valor_estimado_usd_mi": 156,
    "scoreTotal": 53,
    "faixa": "moderada",
    "scoreAtratividade": 36,
    "scoreViabilidade": 61,
    "scoreSeguranca": 67,
    "fatoresPositivos": [
      "Risk Score 36/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Situação ativa junto à ANM",
      "Recência de despachos favorável"
    ],
    "fatoresAtencao": [
      "Alerta restritivo recente (licenciamento em APP)",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p14",
    "numero": "925.112/2020",
    "substancia": "FERRO",
    "titular": "Companhia Brasileira de Metalurgia",
    "municipio": "Santarém",
    "uf": "PA",
    "area_ha": 1567.2,
    "fase": "requerimento",
    "situacao": "ativo",
    "risk_score": 74,
    "valor_estimado_usd_mi": 322,
    "scoreTotal": 45,
    "faixa": "baixa",
    "scoreAtratividade": 42,
    "scoreViabilidade": 56,
    "scoreSeguranca": 39,
    "fatoresPositivos": [
      "Valor estimado de reservas ~US$ 322 mi",
      "Situação ativa junto à ANM",
      "Recência de despachos favorável"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)"
    ]
  },
  {
    "id": "p15",
    "numero": "918.556/2020",
    "substancia": "OURO",
    "titular": "St. George Mining Brasil",
    "municipio": "Catalão",
    "uf": "GO",
    "area_ha": 623.5,
    "fase": "requerimento",
    "situacao": "ativo",
    "risk_score": 81,
    "valor_estimado_usd_mi": 322,
    "scoreTotal": 54,
    "faixa": "moderada",
    "scoreAtratividade": 62,
    "scoreViabilidade": 63,
    "scoreSeguranca": 34,
    "fatoresPositivos": [
      "OURO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 62.000/t",
      "Valor estimado de reservas ~US$ 322 mi"
    ],
    "fatoresAtencao": [
      "Trâmite regulatório com indicadores de risco elevados (ANM)",
      "Componente ambiental do risco pressionado"
    ]
  },
  {
    "id": "p16",
    "numero": "867.201/2013",
    "substancia": "COBRE",
    "titular": "Atlas Critical Minerals Brasil",
    "municipio": "Minaçu",
    "uf": "GO",
    "area_ha": 412.8,
    "fase": "requerimento",
    "situacao": "ativo",
    "risk_score": 69,
    "valor_estimado_usd_mi": 322,
    "scoreTotal": 57,
    "faixa": "moderada",
    "scoreAtratividade": 65,
    "scoreViabilidade": 61,
    "scoreSeguranca": 42,
    "fatoresPositivos": [
      "COBRE com alta relevância estratégica no mercado",
      "Tendência de demanda alta",
      "Referência de preço spot ~US$ 8.500/t"
    ],
    "fatoresAtencao": [
      "Área útil reduzida para escala industrial",
      "Trâmite regulatório com indicadores de risco elevados (ANM)"
    ]
  },
  {
    "id": "p17",
    "numero": "806.778/2003",
    "substancia": "BAUXITA",
    "titular": "Vale Mineração S.A.",
    "municipio": "Niquelândia",
    "uf": "GO",
    "area_ha": 2341,
    "fase": "requerimento",
    "situacao": "ativo",
    "risk_score": 77,
    "valor_estimado_usd_mi": 322,
    "scoreTotal": 47,
    "faixa": "baixa",
    "scoreAtratividade": 39,
    "scoreViabilidade": 67,
    "scoreSeguranca": 36,
    "fatoresPositivos": [
      "Valor estimado de reservas ~US$ 322 mi",
      "Situação ativa junto à ANM",
      "CAPAG B — ambiente fiscal moderado"
    ],
    "fatoresAtencao": [
      "Trâmite regulatório com indicadores de risco elevados (ANM)",
      "Componente ambiental do risco pressionado"
    ]
  },
  {
    "id": "p18",
    "numero": "895.334/2017",
    "substancia": "NÍQUEL",
    "titular": "Serra Verde Mining Ltda.",
    "municipio": "Alto Horizonte",
    "uf": "GO",
    "area_ha": 298.4,
    "fase": "lavra",
    "situacao": "ativo",
    "risk_score": 41,
    "valor_estimado_usd_mi": 40,
    "scoreTotal": 68,
    "faixa": "moderada",
    "scoreAtratividade": 67,
    "scoreViabilidade": 76,
    "scoreSeguranca": 63,
    "fatoresPositivos": [
      "NÍQUEL com alta relevância estratégica no mercado",
      "Risk Score 41/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Referência de preço spot ~US$ 16.000/t"
    ],
    "fatoresAtencao": [
      "Área útil reduzida para escala industrial",
      "Poucos drivers regulatórios favoráveis"
    ]
  },
  {
    "id": "p19",
    "numero": "879.901/2015",
    "substancia": "QUARTZO",
    "titular": "Viridis Recursos Minerais Ltda.",
    "municipio": "Barro Alto",
    "uf": "GO",
    "area_ha": 156.2,
    "fase": "lavra",
    "situacao": "ativo",
    "risk_score": 29,
    "valor_estimado_usd_mi": 40,
    "scoreTotal": 53,
    "faixa": "moderada",
    "scoreAtratividade": 22,
    "scoreViabilidade": 76,
    "scoreSeguranca": 72,
    "fatoresPositivos": [
      "Risk Score 29/100 — sem sobreposições territoriais identificadas (ANM/ICMBio)",
      "Processo em fase de lavra (maduro)",
      "Situação ativa junto à ANM"
    ],
    "fatoresAtencao": [
      "Tendência de demanda em queda",
      "Área útil reduzida para escala industrial"
    ]
  },
  {
    "id": "p20",
    "numero": "802.445/2002",
    "substancia": "FERRO",
    "titular": "Companhia Brasileira de Metalurgia",
    "municipio": "Goiás",
    "uf": "GO",
    "area_ha": 887.6,
    "fase": "lavra",
    "situacao": "ativo",
    "risk_score": 52,
    "valor_estimado_usd_mi": 40,
    "scoreTotal": 54,
    "faixa": "moderada",
    "scoreAtratividade": 35,
    "scoreViabilidade": 78,
    "scoreSeguranca": 55,
    "fatoresPositivos": [
      "Processo em fase de lavra (maduro)",
      "Situação ativa junto à ANM",
      "CAPAG B — ambiente fiscal moderado"
    ],
    "fatoresAtencao": [
      "Produção nacional 12% abaixo da reserva estimada (USGS 2024)",
      "Poucos drivers regulatórios favoráveis"
    ]
  },
  {
    "id": "p21",
    "numero": "940.001/2022",
    "substancia": "NEODÍMIO",
    "titular": "Atlas Critical Minerals Brasil",
    "municipio": "Irecê",
    "uf": "BA",
    "area_ha": 198.3,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 84,
    "valor_estimado_usd_mi": 958,
    "scoreTotal": 66,
    "faixa": "moderada",
    "scoreAtratividade": 96,
    "scoreViabilidade": 59,
    "scoreSeguranca": 34,
    "fatoresPositivos": [
      "Mineral estratégico com gap de +22,2 p.p.",
      "NEODÍMIO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 68.000/t"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Alerta restritivo recente (licenciamento em APP)"
    ]
  },
  {
    "id": "p22",
    "numero": "941.002/2022",
    "substancia": "NÍOBIO",
    "titular": "Viridis Recursos Minerais Ltda.",
    "municipio": "Jacobina",
    "uf": "BA",
    "area_ha": 176.5,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 79,
    "valor_estimado_usd_mi": 958,
    "scoreTotal": 58,
    "faixa": "moderada",
    "scoreAtratividade": 73,
    "scoreViabilidade": 59,
    "scoreSeguranca": 37,
    "fatoresPositivos": [
      "NÍOBIO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 41.000/t",
      "Valor estimado de reservas ~US$ 958 mi"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Alerta restritivo recente (licenciamento em APP)"
    ]
  },
  {
    "id": "p23",
    "numero": "942.003/2023",
    "substancia": "LÍTIO",
    "titular": "St. George Mining Brasil",
    "municipio": "Brumado",
    "uf": "BA",
    "area_ha": 245,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 87,
    "valor_estimado_usd_mi": 958,
    "scoreTotal": 57,
    "faixa": "moderada",
    "scoreAtratividade": 75,
    "scoreViabilidade": 59,
    "scoreSeguranca": 32,
    "fatoresPositivos": [
      "LÍTIO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 13.000/t",
      "Tendência de demanda alta"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Alerta restritivo recente (licenciamento em APP)"
    ]
  },
  {
    "id": "p24",
    "numero": "943.004/2023",
    "substancia": "DISPRÓSIO",
    "titular": "Serra Verde Mining Ltda.",
    "municipio": "Caetité",
    "uf": "BA",
    "area_ha": 132.7,
    "fase": "pesquisa",
    "situacao": "ativo",
    "risk_score": 82,
    "valor_estimado_usd_mi": 958,
    "scoreTotal": 68,
    "faixa": "moderada",
    "scoreAtratividade": 100,
    "scoreViabilidade": 59,
    "scoreSeguranca": 36,
    "fatoresPositivos": [
      "DISPRÓSIO com alta relevância estratégica no mercado",
      "Mineral estratégico com gap de +22,2 p.p.",
      "Referência de preço spot ~US$ 290.000/t"
    ],
    "fatoresAtencao": [
      "Componente ambiental do risco pressionado",
      "Alerta restritivo recente (licenciamento em APP)"
    ]
  },
  {
    "id": "p25",
    "numero": "650.100/1987",
    "substancia": "OURO",
    "titular": "Vale Mineração S.A.",
    "municipio": "Presidente Figueiredo",
    "uf": "AM",
    "area_ha": 88,
    "fase": "encerrado",
    "situacao": "bloqueado",
    "risk_score": 85,
    "valor_estimado_usd_mi": 0,
    "scoreTotal": 10,
    "faixa": "desfavoravel",
    "scoreAtratividade": 52,
    "scoreViabilidade": 27,
    "scoreSeguranca": 15,
    "fatoresPositivos": [
      "OURO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 62.000/t",
      "Demanda estável no horizonte recente"
    ],
    "fatoresAtencao": [
      "Fase ainda distante da lavra (maior incerteza de prazo)",
      "Processo bloqueado na ANM"
    ]
  },
  {
    "id": "p26",
    "numero": "651.101/1991",
    "substancia": "FERRO",
    "titular": "Companhia Brasileira de Metalurgia",
    "municipio": "Itacoatiara",
    "uf": "AM",
    "area_ha": 120.4,
    "fase": "encerrado",
    "situacao": "bloqueado",
    "risk_score": 86,
    "valor_estimado_usd_mi": 0,
    "scoreTotal": 10,
    "faixa": "desfavoravel",
    "scoreAtratividade": 32,
    "scoreViabilidade": 29,
    "scoreSeguranca": 14,
    "fatoresPositivos": [
      "Demanda estável no horizonte recente",
      "CAPAG A, incentivos fiscais ativos",
      "Logística: ferrovia/porto com distância média (referência ANM)"
    ],
    "fatoresAtencao": [
      "Fase ainda distante da lavra (maior incerteza de prazo)",
      "Processo bloqueado na ANM"
    ]
  },
  {
    "id": "p27",
    "numero": "652.102/1994",
    "substancia": "BAUXITA",
    "titular": "Atlas Critical Minerals Brasil",
    "municipio": "Barcelos",
    "uf": "AM",
    "area_ha": 64.2,
    "fase": "encerrado",
    "situacao": "bloqueado",
    "risk_score": 86,
    "valor_estimado_usd_mi": 0,
    "scoreTotal": 10,
    "faixa": "desfavoravel",
    "scoreAtratividade": 30,
    "scoreViabilidade": 27,
    "scoreSeguranca": 14,
    "fatoresPositivos": [
      "Demanda estável no horizonte recente",
      "CAPAG A, incentivos fiscais ativos",
      "Logística: ferrovia/porto com distância média (referência ANM)"
    ],
    "fatoresAtencao": [
      "Fase ainda distante da lavra (maior incerteza de prazo)",
      "Processo bloqueado na ANM"
    ]
  },
  {
    "id": "p28",
    "numero": "960.501/2024",
    "substancia": "COBRE",
    "titular": "St. George Mining Brasil",
    "municipio": "Guarantã do Norte",
    "uf": "MT",
    "area_ha": 310.9,
    "fase": "lavra",
    "situacao": "bloqueado",
    "risk_score": 70,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 29,
    "faixa": "baixa",
    "scoreAtratividade": 58,
    "scoreViabilidade": 54,
    "scoreSeguranca": 30,
    "fatoresPositivos": [
      "COBRE com alta relevância estratégica no mercado",
      "Tendência de demanda alta",
      "Processo em fase de lavra (maduro)"
    ],
    "fatoresAtencao": [
      "Processo bloqueado na ANM",
      "Último despacho ANM há mais de 1 ano"
    ]
  },
  {
    "id": "p29",
    "numero": "961.502/2024",
    "substancia": "QUARTZO",
    "titular": "Viridis Recursos Minerais Ltda.",
    "municipio": "Peixoto de Azevedo",
    "uf": "MT",
    "area_ha": 205.6,
    "fase": "pesquisa",
    "situacao": "bloqueado",
    "risk_score": 71,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 19,
    "faixa": "desfavoravel",
    "scoreAtratividade": 22,
    "scoreViabilidade": 44,
    "scoreSeguranca": 29,
    "fatoresPositivos": [
      "Fase ainda incipiente no ciclo ANM",
      "CAPAG A, incentivos fiscais ativos",
      "Logística: ferrovia/porto com distância média (referência ANM)"
    ],
    "fatoresAtencao": [
      "Processo bloqueado na ANM",
      "Tendência de demanda em queda"
    ]
  },
  {
    "id": "p30",
    "numero": "962.503/2024",
    "substancia": "OURO",
    "titular": "Serra Verde Mining Ltda.",
    "municipio": "Alta Floresta",
    "uf": "MT",
    "area_ha": 142.1,
    "fase": "requerimento",
    "situacao": "bloqueado",
    "risk_score": 72,
    "valor_estimado_usd_mi": 24,
    "scoreTotal": 25,
    "faixa": "baixa",
    "scoreAtratividade": 55,
    "scoreViabilidade": 39,
    "scoreSeguranca": 28,
    "fatoresPositivos": [
      "OURO com alta relevância estratégica no mercado",
      "Referência de preço spot ~US$ 62.000/t",
      "Demanda estável no horizonte recente"
    ],
    "fatoresAtencao": [
      "Processo bloqueado na ANM",
      "Último despacho ANM há mais de 1 ano"
    ]
  }
]
```

---

## Ficheiro completo — `opportunityCardMockData.ts`

```ts
import type { OpportunityCardVariaveis } from './opportunityCardCopy'

/**
 * Dados concretos (texto + fonte) por processo para cards de oportunidade.
 * Chaves: ids estáveis em `processos.mock` (p3, p23, p22, p21).
 */
export const OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID: Record<string, OpportunityCardVariaveis> = {
  p3: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 21,
        texto: 'Bauxita: demanda estável, baixa criticidade',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 32,
        texto: 'Reserva nacional 2.8x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 28,
        texto: 'US$ 38/t, estável (-0.5% a.a.)',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 62,
        texto: 'Demanda global +1.8% a.a.',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 52,
        texto: 'Reserva estimada em US$ 8.2M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 92,
        texto: 'CAPAG A, receita própria elevada',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 88,
        texto: 'Concessão de Lavra ativa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 85,
        texto: 'Ferrovia a 12 km, rodovia federal a 3 km',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 72,
        texto: '2.104 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 78,
        texto: 'Autonomia fiscal 71%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 91,
        texto: 'Processo ativo, sem pendências',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 85,
        texto: 'Incentivos estaduais, linhas BNDES e Sudene alinhados ao projeto',
        fonte: 'BNDES',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 69,
        texto: 'Risk Score 31/100 (baixo)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 82,
        texto: 'Sem sobreposição com UCs ou TIs',
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 74,
        texto: '0 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 65,
        texto: 'Último despacho há 38 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 76,
        texto: 'Nenhuma restrição publicada em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 58,
        texto: '3 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p23: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 94,
        texto: 'Lítio: mineral crítico, alta demanda global',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 82,
        texto: 'Reserva nacional 6.1x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 45,
        texto: 'US$ 12.400/t, volatilidade alta',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 91,
        texto: 'Demanda global +14% a.a. (eletrificação)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 68,
        texto: 'Reserva estimada em US$ 94M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 48,
        texto: 'CAPAG C, capacidade fiscal limitada',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 55,
        texto: 'Fase de Pesquisa (autorizada)',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 35,
        texto: 'Ferrovia a 210 km, acesso por estrada vicinal',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 61,
        texto: '487 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 29,
        texto: 'Autonomia fiscal 22%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 72,
        texto: 'Processo ativo, relatório pendente',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 65,
        texto: 'Área de atuação Sudene',
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 52,
        texto: 'Risk Score 48/100 (médio)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 56,
        texto: 'Proximidade com APP (2.3 km)',
        fonte: 'ICMBio, CAR/SICAR',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 61,
        texto: '1 alerta restritivo em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 71,
        texto: 'Último despacho há 22 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 55,
        texto: '1 restrição publicada em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 68,
        texto: '5 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p22: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 97,
        texto: 'Nióbio: Brasil detém 98% das reservas globais',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 88,
        texto: 'Reserva nacional 12x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 76,
        texto: 'US$ 41.000/t, tendência de alta',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 85,
        texto: 'Demanda global +3.2% a.a. (aços especiais)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 92,
        texto: 'Reserva estimada em US$ 680M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 85,
        texto: 'CAPAG A, superávit fiscal',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 90,
        texto: 'Concessão de Lavra ativa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 88,
        texto: 'Ferrovia a 8 km, rodovia a 2 km',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 64,
        texto: '312 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 82,
        texto: 'Autonomia fiscal 74%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 85,
        texto: 'Processo ativo, sem pendências',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 55,
        texto: 'Fora de área prioritária',
        fonte: 'BNDES',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 84,
        texto: 'Risk Score 12/100 (baixo)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 91,
        texto: 'Sem sobreposição territorial identificada',
        fonte: 'ICMBio, FUNAI',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 85,
        texto: '0 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 78,
        texto: 'Último despacho há 15 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 82,
        texto: 'Nenhuma restrição em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 74,
        texto: '7 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
  p21: {
    atratividade: [
      {
        nome: 'Relevância da substância',
        valor: 78,
        texto: 'Grafita: mineral crítico para baterias',
        fonte: 'USGS',
      },
      {
        nome: 'Gap reserva/produção',
        valor: 71,
        texto: 'Reserva nacional 4.5x produção anual',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Preço USD/t',
        valor: 52,
        texto: 'US$ 1.200/t, recuperação após queda',
        fonte: 'Trading Economics',
      },
      {
        nome: 'Tendência de demanda',
        valor: 74,
        texto: 'Demanda global +8% a.a. (baterias Li-ion)',
        fonte: 'USGS',
      },
      {
        nome: 'Valor estimado da reserva',
        valor: 38,
        texto: 'Reserva estimada em US$ 4.1M',
        fonte: 'ANM, Trading Economics',
      },
    ],
    viabilidade: [
      {
        nome: 'CAPAG município',
        valor: 32,
        texto: 'CAPAG D, endividamento elevado',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Fase do processo',
        valor: 38,
        texto: 'Requerimento de Pesquisa',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Infraestrutura logística',
        valor: 28,
        texto: 'Ferrovia a 340 km, acesso precário',
        fonte: 'DNIT, ANTT',
      },
      {
        nome: 'Área do processo',
        valor: 55,
        texto: '1.850 ha',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Autonomia fiscal',
        valor: 18,
        texto: 'Autonomia fiscal 11%',
        fonte: 'STN/SICONFI',
      },
      {
        nome: 'Situação do processo',
        valor: 62,
        texto: 'Processo ativo, documentação pendente',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Incentivos regionais',
        valor: 72,
        texto: 'Área de atuação Sudene',
        fonte: 'BNDES, Sudene',
      },
    ],
    seguranca: [
      {
        nome: 'Solidez geral',
        valor: 42,
        texto: 'Risk Score 58/100 (médio)',
        fonte: 'Cálculo TERRADAR',
      },
      {
        nome: 'Conformidade ambiental',
        valor: 35,
        texto: 'Sobreposição parcial com APP (0.8 km)',
        fonte: 'ICMBio, CAR/SICAR',
      },
      {
        nome: 'Regularidade regulatória',
        valor: 51,
        texto: '2 alertas restritivos em 12 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Histórico de despachos',
        valor: 55,
        texto: 'Último despacho há 92 dias',
        fonte: 'ANM/SIGMINE',
      },
      {
        nome: 'Ausência de restrições',
        valor: 38,
        texto: '2 restrições publicadas em 6 meses',
        fonte: 'Adoo',
      },
      {
        nome: 'Alertas favoráveis',
        valor: 62,
        texto: '4 alertas favoráveis em 12 meses',
        fonte: 'Adoo',
      },
    ],
  },
}

export function getOpportunityCardVariaveis(processoId: string): OpportunityCardVariaveis | null {
  return OPPORTUNITY_CARD_VARIAVEIS_POR_PROCESSO_ID[processoId] ?? null
}

```

---

## Referência — `mockVarValor` (`ProspeccaoResultados.tsx`)

```ts
function mockVarValor(subScore: number, varIndex: number): number {
  const offsets = [-15, -8, 0, 8, 15, -5, 5]
  const offset = offsets[varIndex % offsets.length] ?? 0
  const val = Math.round(subScore + offset + Math.sin(varIndex * 2.7) * 10)
  return Math.max(5, Math.min(100, val))
}
```

As funções `tooltipAtratividade`, `tooltipViabilidade` e `tooltipSeguranca` estão no mesmo ficheiro; o mapa `FONTES_DRILLDOWN` define o `title` de cada variável no drilldown.

---

*Fim do export.*
