import type { ReportData, ReportLLMBlocks, RiskDimension } from '../../lib/reportTypes'
import {
  fmtCfemEstimadaBrlMiPerHa,
  fmtNum,
  fmtPct,
  fmtUsdOz,
  fmtValorInsituUsdMiPerHa,
  paragraphsFromLLM,
  sanitizeReportText,
  terradarLogoDataUri,
} from './reportHtmlUtils'

const TOTAL = 8

const MAT_LABELS = [
  'Exploratório',
  'Inicial',
  'Intermediário',
  'Avançado',
  'Maduro',
] as const

/** Índice ativo na régua de maturidade (0..4), alinhado a estagio_index do painel. */
function maturidadeActiveIndex(estagioIndex: number): number {
  if (estagioIndex >= 5) return 4
  if (estagioIndex === 4) return 3
  if (estagioIndex === 3) return 2
  if (estagioIndex === 2) return 2
  if (estagioIndex === 1) return 1
  return 1
}

function refSlug(data: ReportData): string {
  const num = String(data.processo ?? '').replace(/\./g, '').replace(/\//g, '-')
  const v = String(data.versao ?? '').replace(/\s+/g, '')
  return `${num}-${v}`
}

function reportFooter(pageNum: number, data: ReportData): string {
  return `<div class="pf"><span>TERRADAR &middot; Confidencial &middot; ${pageNum}/${TOTAL}</span><span>${sanitizeReportText(refSlug(data))}</span></div>`
}

function rbVClass(label: string): string {
  const L = label.toLowerCase()
  if (L.includes('muito baixo') || L.includes('baixo')) return 'green'
  if (L.includes('moderado')) return 'amber'
  if (L.includes('favorável') || L.includes('favoravel')) return 'green'
  if (L.includes('desfavorável') || L.includes('desfavoravel')) return 'red'
  if (L.includes('alta') && !L.includes('qualidade')) return 'green'
  return 'amber'
}

function riskBar(label: string, dim: RiskDimension): string {
  const w = Math.min(100, Math.max(0, dim.width_pct))
  const cls = rbVClass(dim.label)
  return `<div class="rb">
  <div class="rb-l">${sanitizeReportText(label)}</div>
  <div class="rb-bg"><div class="rb-f" style="width:${w}%;background:${dim.color};"></div></div>
  <div class="rb-v ${cls}">${sanitizeReportText(dim.label)}</div>
</div>`
}

export function buildPage1_Capa(data: ReportData): string {
  const logo = terradarLogoDataUri()
  return `<div class="page capa">
  <div>
    <img class="capa-logo" src="${logo}" alt="TERRADAR">
    <div class="capa-conf">Confidencial</div>
    <div class="capa-tipo">Relatório de Inteligência Mineral</div>
    <div class="capa-numero">${sanitizeReportText(data.processo)}</div>
    <div class="capa-sub">${sanitizeReportText(data.substancia_anm)} &mdash; ${sanitizeReportText(data.municipio)}</div>
  </div>
  <div class="capa-bottom">
    <div class="capa-label">Engenharia de dados</div>
    <div class="capa-val">Share Tecnologia</div>
    <div class="capa-label">Inteligência regulatória</div>
    <div class="capa-val">LexMine</div>
    <div class="capa-line">
      <span>${sanitizeReportText(data.data_relatorio)} &middot; Versão ${sanitizeReportText(data.versao)}</span>
      <span>Dados auditados de fontes oficiais públicas</span>
    </div>
  </div>
</div>`
}

export function buildPage2_SumarioVital(
  data: ReportData,
  llm: ReportLLMBlocks['sumario'],
): string {
  const matIdx = maturidadeActiveIndex(data.estagio_index)
  const matHtml = MAT_LABELS.map((lb, i) => {
    const cl = i === matIdx ? 'mat-s mat-a' : 'mat-s'
    return `<div class="${cl}">${sanitizeReportText(lb)}</div>`
  }).join('')

  const pontoRaw = String(llm.ponto_atencao ?? '').trim()
  const ponto =
    pontoRaw !== ''
      ? `<div class="imp" style="border-left-color:var(--amber);"><strong>PONTO DE ATENÇÃO:</strong> ${sanitizeReportText(pontoRaw.replace(/\s+/g, ' '))}</div>`
      : ''

  const tendenciaSub = `${data.var_12m_pct >= 0 ? '+' : ''}${fmtPct(data.var_12m_pct)} · 12 meses · IMF PCPS`

  const vereditoBlock = String(llm.veredito_texto ?? '').trim()
    ? `<div style="font-size:8.5pt;color:#666;margin-bottom:10px;">${paragraphsFromLLM(llm.veredito_texto)}</div>`
    : ''

  const guRow = `${sanitizeReportText(data.gu_status)}${data.gu_pendencia && data.gu_pendencia !== 'N/D' ? ` <span class="tag ta" style="font-size:5.5pt;">${sanitizeReportText(data.gu_pendencia)}</span>` : ''}`

  const htmlResult = `<div class="page content breathe">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>SUMÁRIO VITAL</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>

  <div class="cards">
    <div class="card">
      <div class="card-lbl">Risk Score</div>
      <div class="card-val green">${data.risk_score}<span class="card-unit">/100</span></div>
      <div class="card-sub">${sanitizeReportText(data.rs_classificacao)}</div>
    </div>
    <div class="card">
      <div class="card-lbl">Opportunity Score</div>
      <div class="card-val gold">${data.os_conservador}<span class="card-unit">/100</span></div>
      <div class="card-sub">${sanitizeReportText(data.os_classificacao)} (conservador)</div>
    </div>
    <div class="card">
      <div class="card-lbl">Valor in-situ teórico</div>
      <div class="card-val gold card-insitu-mi" style="font-size:13pt;">US$ ${fmtValorInsituUsdMiPerHa(data.valor_insitu_usd_ha)}<span class="card-unit">/ha</span></div>
      <div class="card-sub">Estimativa, requer NI 43-101</div>
    </div>
    <div class="card">
      <div class="card-lbl">Tendência de preço</div>
      <div class="card-val ${data.var_12m_pct >= 0 ? 'green' : 'red'} card-tend">${sanitizeReportText(data.mercado_tendencia)}</div>
      <div class="card-sub">${tendenciaSub}</div>
    </div>
  </div>

  <h2>Veredito de maturidade</h2>
  <div class="mat">${matHtml}</div>
  ${vereditoBlock}
  ${ponto}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px;">
    <div>
      <h2 style="margin-top:0;">Identificação do ativo</h2>
      <table class="dsm" style="font-size:7.5pt;">
        <tr style="height:26px;"><td>Titular</td><td><strong>${sanitizeReportText(data.titular)}</strong></td></tr>
        <tr style="height:26px;"><td>CNPJ</td><td>${sanitizeReportText(data.cnpj)}</td></tr>
        <tr style="height:26px;"><td>Substância</td><td>${sanitizeReportText(data.substancia_anm)}</td></tr>
        <tr style="height:26px;"><td>Regime</td><td>${sanitizeReportText(data.regime)}</td></tr>
        <tr style="height:26px;"><td>Fase atual</td><td>${sanitizeReportText(data.fase)}</td></tr>
        <tr style="height:26px;"><td>Área</td><td>${fmtNum(data.area_ha)} ha</td></tr>
        <tr style="height:26px;"><td>Município</td><td>${sanitizeReportText(data.municipio)}</td></tr>
        <tr style="height:26px;"><td>Bioma</td><td>${sanitizeReportText(data.bioma)}</td></tr>
      </table>
    </div>
    <div>
      <h2 style="margin-top:0;">Status regulatório</h2>
      <table class="dsm" style="font-size:7.5pt;">
        <tr style="height:26px;"><td>Alvará</td><td style="white-space:nowrap;">Até ${sanitizeReportText(data.alvara_validade)} <span class="tag tg" style="font-size:5.5pt;">${sanitizeReportText(data.alvara_status)}</span></td></tr>
        <tr style="height:26px;"><td>Último despacho</td><td>${sanitizeReportText(data.ultimo_despacho)}</td></tr>
        <tr style="height:26px;"><td>NUP SEI</td><td style="font-family:var(--mono);font-size:7pt;">${sanitizeReportText(data.nup_sei)}</td></tr>
        <tr style="height:26px;"><td>Guia de Utilização</td><td style="white-space:nowrap;">${guRow}</td></tr>
        <tr style="height:26px;"><td>TAH</td><td style="white-space:nowrap;">${sanitizeReportText(data.tah_status)} <span class="tag tg" style="font-size:5.5pt;">Em dia</span></td></tr>
        <tr style="height:26px;"><td>Licença ambiental</td><td>${sanitizeReportText(data.licenca_ambiental)}</td></tr>
        <tr style="height:26px;"><td>Protocolo</td><td>${data.protocolo_anos} anos de tramitação</td></tr>
      </table>
    </div>
  </div>
  <div class="src">Fontes: ANM/SIGMINE (API REST), SEI-ANM (Pesquisa Pública), IBGE &middot; Atualizado em ${sanitizeReportText(data.data_relatorio)}</div>
  ${reportFooter(2, data)}
</div>`

  return htmlResult
}

export function buildPage3_Territorio(
  data: ReportData,
  llm: ReportLLMBlocks['territorio'],
): string {
  const mapSrc =
    data.mapa_base64 && data.mapa_base64.length > 20
      ? data.mapa_base64.startsWith('data:')
        ? data.mapa_base64
        : `data:image/png;base64,${data.mapa_base64}`
      : ''

  const mapBlock = mapSrc
    ? `<img class="mapa" src="${mapSrc}" alt="Mapa territorial">
  <div class="mapa-leg">Mapa gerado pela plataforma TERRADAR com dados de FUNAI, CNUC/MMA, INCRA e DNIT. Polígonos de áreas protegidas e infraestrutura em escala regional.</div>`
    : `<p style="font-size:9pt;color:#666;">Mapa não disponível para impressão nesta versão.</p>`

  const rows = data.layers
    .map(
      (l) =>
        `<tr>
      <td>${sanitizeReportText(l.tipo)}</td>
      <td>${sanitizeReportText(l.nome)} ${sanitizeReportText(l.detalhes)}</td>
      <td class="mono">${l.distancia_km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</td>
      <td><span class="tag ${l.tag_class}">${sanitizeReportText(l.tag_label)}</span></td>
    </tr>`,
    )
    .join('')

  const infraRows = data.infraestrutura
    .map((i) => {
      const isRail = i.tipo.toLowerCase().includes('ferrov')
      const distCell = isRail
        ? `<td class="mono" style="color:var(--green);font-weight:600;">${i.distancia_km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</td>`
        : `<td class="mono">${i.distancia_km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</td>`
      const nomeCell = isRail
        ? `<strong>${sanitizeReportText(i.nome)}</strong>`
        : sanitizeReportText(i.nome)
      return `<tr>
      <td>${sanitizeReportText(i.tipo)}</td>
      <td>${nomeCell}</td>
      <td>${sanitizeReportText(i.detalhes)}</td>
      ${distCell}
    </tr>`
    })
    .join('')

  return `<div class="page content compact">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>INTEGRIDADE TERRITORIAL</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>
  ${mapBlock}
  <h2 style="margin-top:20px;">Sobreposições e proximidades</h2>
  <table style="table-layout:fixed;">
    <thead><tr><th style="width:18%;">Área protegida</th><th style="width:42%;">Mais próxima</th><th style="width:16%;">Distância</th><th style="width:24%;">Sobreposição</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2 style="margin-top:20px;">Logística e infraestrutura de escoamento</h2>
  <p style="font-size:8pt;color:var(--text-light);margin-bottom:3px;">${paragraphsFromLLM(llm.logistica_texto)}</p>

  <table style="table-layout:fixed;">
    <thead><tr><th style="width:16%;">Infraestrutura</th><th style="width:32%;">Nome</th><th style="width:32%;">Detalhes</th><th style="width:20%;">Distância</th></tr></thead>
    <tbody>${infraRows}</tbody>
  </table>

  <div class="imp">${paragraphsFromLLM(llm.implicacao)}</div>

  <div class="src">Fontes: FUNAI, CNUC/MMA, INCRA, CAR/SICAR, CPRM/SGB, DNIT (shapefiles 2025), ANTAQ, IBGE &middot; Verificado via cruzamento geoespacial</div>
  ${reportFooter(3, data)}
</div>`
}

export function buildPage4_Mercado(
  data: ReportData,
  llm: ReportLLMBlocks['mercado'],
): string {
  const gapPp = data.reservas_mundiais_pct - data.producao_mundial_pct
  const gapStr =
    gapPp >= 0
      ? `<strong class="green">+${gapPp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</strong> (potencial de expansão)`
      : `<strong>${gapPp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</strong>`

  return `<div class="page content">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>INTELIGÊNCIA DE MERCADO</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Preço Spot</div>
      <div class="kpi-val gold">US$ ${fmtUsdOz(data.preco_oz_usd)}<span class="card-unit">/oz</span></div>
      <div class="kpi-sub">R$ ${fmtUsdOz(data.preco_g_brl)}/g &middot; PTAX R$ ${fmtUsdOz(data.ptax)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Variação 12 meses</div>
      <div class="kpi-val ${data.var_12m_pct >= 0 ? 'green' : 'red'}">${fmtPct(data.var_12m_pct)}</div>
      <div class="kpi-sub">referência spot</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Crescimento 5 anos</div>
      <div class="kpi-val green">${fmtPct(data.cagr_5a_pct)} <span class="card-unit">a.a.</span></div>
      <div class="kpi-sub">CAGR</div>
    </div>
    ${
      data.demanda_global_t > 0
        ? `
    <div class="kpi">
      <div class="kpi-lbl">Demanda global</div>
      <div class="kpi-val">${fmtNum(data.demanda_global_t)} <span class="card-unit">t</span></div>
      <div class="kpi-sub">referência de mercado</div>
    </div>`
        : ''
    }
  </div>

  <div class="cols">
    <div class="col">
      <h2 style="margin-top:0;">Posição do Brasil</h2>
      <table class="dsm">
        <tr><td>Reservas mundiais</td><td>${fmtPct(data.reservas_mundiais_pct)} do total global</td></tr>
        <tr><td>Produção mundial</td><td>${fmtPct(data.producao_mundial_pct)} do total global</td></tr>
        <tr><td>Gap reserva-produção</td><td>${gapStr}</td></tr>
        <tr><td>Aplicações</td><td>Reserva de valor, eletrônicos, joalheria, medicina</td></tr>
      </table>
    </div>
    <div class="col">
      <h2 style="margin-top:0;">Aspectos regulatórios</h2>
      <table class="dsm">
        <tr><td>Estratégia nacional (PNM)</td><td class="cell-text-wrap estrategia-pnm-cell">${sanitizeReportText(data.estrategia_nacional)}</td></tr>
        <tr><td>CFEM (royalty)</td><td>${fmtPct(data.cfem_aliquota_pct)} sobre faturamento bruto</td></tr>
        <tr><td>Mineral estratégico</td><td>Conforme legislação vigente</td></tr>
        <tr><td>CFEM estimada por hectare</td><td><strong>R$ ${fmtCfemEstimadaBrlMiPerHa(data.cfem_estimada_ha)}/ha</strong> (referência)</td></tr>
      </table>
    </div>
  </div>

  <h2>Valor estimado da reserva</h2>
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Valor in-situ teórico</div>
      <div class="kpi-val gold kpi-val-mi">US$ ${fmtValorInsituUsdMiPerHa(data.valor_insitu_usd_ha)}<span class="card-unit">/ha</span></div>
      <div class="kpi-sub">referência de mercado</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">CFEM estimada por hectare</div>
      <div class="kpi-val gold kpi-val-mi">R$ ${fmtCfemEstimadaBrlMiPerHa(data.cfem_estimada_ha)}<span class="card-unit">/ha</span></div>
      <div class="kpi-sub">Alíquota ${fmtPct(data.cfem_aliquota_pct)} sobre faturamento</div>
    </div>
  </div>

  <div class="nota">Nota metodológica: o valor in-situ é uma estimativa teórica baseada em premissas conservadoras de teor, profundidade e densidade. Não constitui relatório de recursos ou reservas conforme padrões internacionais (NI 43-101 / JORC).</div>

  <div class="imp">${paragraphsFromLLM(llm.implicacao)}</div>

  <div class="src">Fontes: IMF PCPS, BCB PTAX, USGS MCS, WGC, Lei 13.540/2017 (CFEM)</div>
  ${reportFooter(4, data)}
</div>`
}

export function buildPage5_Fiscal(
  data: ReportData,
  llm: ReportLLMBlocks['fiscal'],
): string {
  const cfemRows = data.cfem_historico
    .map(
      (c) =>
        `<tr>
      <td><strong>${c.ano}</strong></td>
      <td>${sanitizeReportText(c.processo_valor)}</td>
      <td>${sanitizeReportText(c.municipio_valor)}</td>
      <td>${sanitizeReportText(c.substancias)}</td>
    </tr>`,
    )
    .join('')

  return `<div class="page content breathe fiscal-sheet">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>CONTEXTO FISCAL DO MUNICÍPIO</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>

  <div class="cols">
    <div class="col">
      <div style="text-align:center;padding:10px 0;">
        <div class="sbig gold">${sanitizeReportText(data.capag_nota)}</div>
        <div style="font-size:8.5pt;color:var(--text-muted);margin-top:2px;">CAPAG (referência STN)</div>
        <div style="font-size:7.5pt;color:var(--text-muted);margin-top:4px;">${sanitizeReportText(data.fiscal_contexto_referencia)}</div>
      </div>
      <table class="dsm">
        <thead><tr><th>Indicador</th><th>Valor</th><th>Nota</th></tr></thead>
        <tbody>
          <tr><td>Endividamento</td><td class="mono">${sanitizeReportText(data.capag_endiv)}</td><td><span class="tag tg">${sanitizeReportText(data.capag_endiv_nota)}</span></td></tr>
          <tr><td>Poupança corrente</td><td class="mono">${sanitizeReportText(data.capag_poupcorr)}</td><td><span class="tag tr">${sanitizeReportText(data.capag_poupcorr_nota)}</span></td></tr>
          <tr><td>Liquidez</td><td class="mono">${sanitizeReportText(data.capag_liquidez)}</td><td><span class="tag ta">${sanitizeReportText(data.capag_liquidez_nota)}</span></td></tr>
        </tbody>
      </table>
      <p style="font-size:7.5pt;color:var(--gold);font-style:italic;margin-top:4px;">Nota final definida pelo pior indicador. A poupança corrente pode determinar a classificação geral.</p>
    </div>
    <div class="col">
      <h2 style="margin-top:0;">Indicadores municipais</h2>
      <table class="dsm">
        <tr><td>Receita própria</td><td><strong>${sanitizeReportText(data.receita_propria)}</strong></td></tr>
        <tr><td>Dívida consolidada</td><td><strong>${sanitizeReportText(data.divida)}</strong></td></tr>
        <tr><td>PIB municipal</td><td><strong>${sanitizeReportText(data.pib_municipal)}</strong></td></tr>
        <tr><td>Dependência transf.</td><td><strong>${sanitizeReportText(data.dependencia_transf)}</strong> da receita corrente</td></tr>
        <tr><td>População</td><td>${sanitizeReportText(data.populacao)}</td></tr>
        <tr><td>IDH</td><td>${sanitizeReportText(data.idh)}</td></tr>
      </table>
      <h2>Incentivos disponíveis</h2>
      <table class="dsm">
        <tr><td>Programa estadual</td><td>${sanitizeReportText(data.incentivos.programa_estadual)}</td></tr>
        <tr><td>Linhas BNDES</td><td>${
          data.incentivos.linhas_bndes_nomes &&
          data.incentivos.linhas_bndes_nomes.length > 0
            ? sanitizeReportText(data.incentivos.linhas_bndes_nomes.join('; '))
            : `${data.incentivos.linhas_bndes} linhas elegíveis`
        }</td></tr>
      </table>
    </div>
  </div>

  <h2>Arrecadação mineral, CFEM</h2>
  <p style="font-size:8.5pt;color:var(--text-light);margin-bottom:4px;">${paragraphsFromLLM(llm.cfem_intro)}</p>

  <table class="cfem" style="font-size:8.5pt;table-layout:fixed;">
    <thead><tr><th style="width:12%;">Ano</th><th style="width:25%;">Processo</th><th style="width:25%;">Município (total)</th><th style="width:38%;">Substâncias municipais</th></tr></thead>
    <tbody>${cfemRows}</tbody>
  </table>

  <div class="imp">${paragraphsFromLLM(llm.implicacao)}</div>

  <div class="src">Fontes: STN/CAPAG, SICONFI, IBGE, ANM Dados Abertos CFEM</div>
  ${reportFooter(5, data)}
</div>`
}

export function buildPage6_Risco(
  data: ReportData,
  llm: ReportLLMBlocks['risco'],
): string {
  const dims = [
    { k: 'Risco geológico', r: data.rs_geo, text: llm.dim_geo },
    { k: 'Risco ambiental', r: data.rs_amb, text: llm.dim_amb },
    { k: 'Risco social', r: data.rs_soc, text: llm.dim_soc },
    { k: 'Risco regulatório', r: data.rs_reg, text: llm.dim_reg },
  ] as const

  const bars = dims.map((d) => riskBar(d.k, d.r)).join('')

  return `<div class="page content breathe">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>ANÁLISE DE RISCO</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead" style="margin-bottom:8px;">${paragraphsFromLLM(llm.lead)}</p>

  <div style="text-align:center;margin:4px 0;">
    <div class="sbig green">${data.risk_score}</div>
    <div style="font-size:8.5pt;color:var(--text-muted);">/100 &middot; ${sanitizeReportText(data.rs_classificacao)}</div>
    <div style="font-size:7pt;color:var(--text-muted);font-style:italic;margin-top:2px;">Quanto menor o score, menor o risco identificado</div>
  </div>

  ${bars}

  <div class="cols" style="margin-top:20px;">
    <div class="col">
      <div class="rdim"><h3>${sanitizeReportText(dims[0].k)} - ${sanitizeReportText(dims[0].r.label)}</h3>${paragraphsFromLLM(llm.dim_geo)}</div>
      <div class="rdim"><h3>${sanitizeReportText(dims[2].k)} - ${sanitizeReportText(dims[2].r.label)}</h3>${paragraphsFromLLM(llm.dim_soc)}</div>
    </div>
    <div class="col">
      <div class="rdim"><h3>${sanitizeReportText(dims[1].k)} - ${sanitizeReportText(dims[1].r.label)}</h3>${paragraphsFromLLM(llm.dim_amb)}</div>
      <div class="rdim"><h3>${sanitizeReportText(dims[3].k)} - ${sanitizeReportText(dims[3].r.label)}</h3>${paragraphsFromLLM(llm.dim_reg)}</div>
    </div>
  </div>

  <div class="imp" style="margin-top:8px;"><strong>Leitura integrada:</strong> ${sanitizeReportText(String(llm.leitura ?? '').replace(/\s+/g, ' ').trim())}</div>

  <div class="src">Metodologia proprietária TERRADAR &middot; Dados: ANM, FUNAI, CNUC/MMA, INCRA, IBGE, STN &middot; Calculado em ${sanitizeReportText(data.data_relatorio)}</div>
  ${reportFooter(6, data)}
</div>`
}

export function buildPage7_Oportunidade(
  data: ReportData,
  llm: ReportLLMBlocks['oportunidade'],
): string {
  const osBars = [
    { label: 'Atratividade de mercado', r: data.os_merc },
    { label: 'Viabilidade operacional', r: data.os_viab },
    { label: 'Segurança do investimento', r: data.os_seg },
  ]
    .map((x) => riskBar(x.label, x.r))
    .join('')

  const sinteseInner = [
    paragraphsFromLLM(llm.sintese_p1),
    String(llm.sintese_p2 ?? '').trim()
      ? paragraphsFromLLM(llm.sintese_p2)
      : '',
    String(llm.sintese_marcos ?? '').trim()
      ? `<p style="font-size:8pt;color:var(--green);font-weight:600;">${sanitizeReportText(llm.sintese_marcos)}</p>`
      : '',
  ].join('')

  return `<div class="page content compact">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>ANÁLISE DE OPORTUNIDADE</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead" style="margin-bottom:4px;">${paragraphsFromLLM(llm.lead)}</p>

  <div style="text-align:center;margin:4px 0;">
    <div class="sbig gold">${data.os_conservador}</div>
    <div style="font-size:8.5pt;color:var(--text-muted);">/100 &middot; ${sanitizeReportText(data.os_classificacao)} (perfil conservador)</div>
    <div style="font-size:7pt;color:var(--text-muted);font-style:italic;margin-top:2px;">Quanto maior o score, mais favorável a oportunidade</div>
  </div>

  ${osBars}

  <div class="cols" style="margin-top:20px;">
    <div class="col">
      <div class="rdim"><h3>Atratividade de mercado - ${sanitizeReportText(data.os_merc.label)}</h3>${paragraphsFromLLM(llm.dim_merc)}</div>
    </div>
    <div class="col">
      <div class="rdim"><h3>Segurança do investimento - ${sanitizeReportText(data.os_seg.label)}</h3>${paragraphsFromLLM(llm.dim_seg)}</div>
    </div>
  </div>
  <div class="rdim"><h3>Viabilidade operacional - ${sanitizeReportText(data.os_viab.label)}</h3>${paragraphsFromLLM(llm.dim_viab)}</div>

  <h2 style="margin-top:18px;">Perfil de investidor</h2>
  <table class="ptbl" style="font-size:9pt;">
    <thead><tr><th>Perfil</th><th style="text-align:center;">Score</th><th>Classificação</th></tr></thead>
    <tbody>
      <tr><td><strong>Conservador</strong> (prioriza segurança)</td><td class="gold">${data.os_conservador}</td><td>${sanitizeReportText(data.os_classificacao)}</td></tr>
      <tr><td><strong>Moderado</strong> (equilíbrio risco-retorno)</td><td class="gold">${data.os_moderado}</td><td>${sanitizeReportText(data.os_classificacao)}</td></tr>
      <tr><td><strong>Arrojado</strong> (prioriza retorno)</td><td class="gold">${data.os_arrojado}</td><td>${sanitizeReportText(data.os_classificacao)}</td></tr>
    </tbody>
  </table>

  <div style="margin-top:8px;background:linear-gradient(135deg, rgba(15,122,90,0.06) 0%, rgba(212,168,67,0.08) 100%);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:10px 12px;">
    <div style="font-family:var(--mono);font-size:6.5pt;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Síntese TERRADAR &middot; Cruzamento Risco &times; Oportunidade</div>
    ${sinteseInner}
  </div>

  <div class="src">Metodologia proprietária TERRADAR &middot; Calculado em ${sanitizeReportText(data.data_relatorio)}</div>
  ${reportFooter(7, data)}
</div>`
}

export function buildPage8_Metodologia(data: ReportData): string {
  return `<div class="page contra">
  <div class="ptag" style="color:rgba(212,168,67,0.5);">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>METODOLOGIA E FONTES</h1>
  <div class="hl">Análise baseada exclusivamente em dados oficiais públicos</div>
  <p style="font-size:9pt;color:rgba(255,255,255,0.6);margin-bottom:12px;">O TERRADAR utiliza uma metodologia proprietária de cálculo e análise que avalia processos minerários em múltiplas dimensões a partir de dados extraídos exclusivamente de fontes oficiais públicas brasileiras e internacionais. Os algoritmos de pontuação, normalização e ponderação foram desenvolvidos e calibrados considerando vários aspectos da regulação minerária, análise de risco e inteligência de mercado. A estrutura de pesos, faixas de classificação e regras de fallback são propriedade intelectual do TERRADAR e não são divulgadas neste relatório.</p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
    <div class="cbox"><h3>Risk Score (0-100)</h3><p>Avalia vulnerabilidades em 4 dimensões: geológica, ambiental, social e regulatória. Menor é melhor. Faixas: 0-39 baixo, 40-69 médio, 70-100 alto. Cálculo proprietário baseado em dados públicos.</p></div>
    <div class="cbox"><h3>Veredito de maturidade</h3><p>5 níveis: Exploratório, Inicial, Intermediário, Avançado, Maduro. Baseado na fase, documentos e status do alvará.</p></div>
    <div class="cbox"><h3>Opportunity Score (0-100)</h3><p>Avalia potencial de retorno em 3 dimensões: atratividade, viabilidade e segurança. Pesos ajustados ao perfil do investidor. Maior é melhor. Cálculo proprietário.</p></div>
    <div class="cbox"><h3>Valor in-situ teórico</h3><p>Estimativa com premissas conservadoras por hectare. Não constitui NI 43-101 / JORC. Referência indicativa.</p></div>
  </div>

  <h2 style="color:white;">Fontes de dados utilizadas</h2>
  <table>
    <thead><tr><th>Categoria</th><th>Fontes</th></tr></thead>
    <tbody>
      <tr><td>Cadastro minerário</td><td>ANM/SIGMINE (API REST), SEI-ANM</td></tr>
      <tr><td>Arrecadação mineral</td><td>ANM/CFEM (Dados Abertos)</td></tr>
      <tr><td>Dados territoriais</td><td>FUNAI (TIs), CNUC/MMA (UCs), INCRA, CAR/SICAR, CPRM/SGB</td></tr>
      <tr><td>Infraestrutura</td><td>DNIT (ferrovias/rodovias), ANTAQ (portos), IBGE</td></tr>
      <tr><td>Socioeconômicos</td><td>IBGE (PIB, população, IDH, biomas)</td></tr>
      <tr><td>Dados fiscais</td><td>STN (CAPAG, SICONFI), Banco Central (PTAX)</td></tr>
      <tr><td>Inteligência de mercado</td><td>FMI (preços), USGS (reservas/produção), World Gold Council</td></tr>
      <tr><td>Legislação</td><td>Código de Mineração, Lei 13.540/2017, Decreto 10.657/2021</td></tr>
    </tbody>
  </table>

  <div style="font-size:7pt;color:rgba(255,255,255,0.3);margin-top:10px;line-height:1.45;">Sobre este relatório: gerado pela plataforma TERRADAR em ${sanitizeReportText(data.data_relatorio)}. Os dados foram verificados em múltiplas sessões de auditoria cruzada, utilizando consultas diretas a APIs oficiais, processação de shapefiles geoespaciais e leitura de documentos primários. Nenhum dado foi inventado, inferido ou estimado sem base documental explícita.</div>

  <div style="margin-top:auto;">
    <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-family:var(--mono);font-size:6pt;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:2px;">Engenharia de dados</div>
        <div style="font-size:9pt;color:rgba(255,255,255,0.65);">Share Tecnologia</div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.3);">Brasília/DF &middot; sharetecnologia.com.br</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--mono);font-size:6pt;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:2px;">Inteligência regulatória</div>
        <div style="font-size:9pt;color:rgba(255,255,255,0.65);">LexMine</div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.3);">Brasília/DF</div>
      </div>
    </div>
  </div>
  <div class="pf" style="color:rgba(255,255,255,0.2);"><span>TERRADAR &middot; Confidencial &middot; 8/${TOTAL}</span><span>${sanitizeReportText(refSlug(data))}</span></div>
</div>`
}
