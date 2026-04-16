import type { ReportData, ReportLLMBlocks, RiskDimension } from '../../lib/reportTypes'
import type { ReportL10n } from './reportL10n'
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
  if (
    L.includes('muito baixo') ||
    L.includes('baixo') ||
    L.includes('very low') ||
    L.includes('low')
  )
    return 'green'
  if (L.includes('moderado') || L.includes('moderate')) return 'amber'
  if (
    L.includes('favorável') ||
    L.includes('favoravel') ||
    L.includes('favorable')
  )
    return 'green'
  if (
    L.includes('desfavorável') ||
    L.includes('desfavoravel') ||
    L.includes('unfavorable')
  )
    return 'red'
  if (L.includes('alta') && !L.includes('qualidade')) return 'green'
  if (L.includes('high') && !L.includes('quality')) return 'green'
  if (L.includes('very high')) return 'red'
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

export function buildPage1_Capa(data: ReportData, t: ReportL10n): string {
  const logo = terradarLogoDataUri()
  return `<div class="page capa">
  <div>
    <img class="capa-logo" src="${logo}" alt="TERRADAR">
    <div class="capa-conf">${sanitizeReportText(t.capaConf)}</div>
    <div class="capa-tipo">${sanitizeReportText(t.capaTipo)}</div>
    <div class="capa-numero">${sanitizeReportText(data.processo)}</div>
    <div class="capa-sub">${sanitizeReportText(data.substancia_anm)} &mdash; ${sanitizeReportText(data.municipio)}</div>
  </div>
  <div class="capa-bottom">
    <div class="capa-label">${sanitizeReportText(t.capaEngLabel)}</div>
    <div class="capa-val">${sanitizeReportText(t.capaEngVal)}</div>
    <div class="capa-label">${sanitizeReportText(t.capaRegLabel)}</div>
    <div class="capa-val">${sanitizeReportText(t.capaRegVal)}</div>
    <div class="capa-line">
      <span>${sanitizeReportText(data.data_relatorio)} &middot; ${sanitizeReportText(t.capaVersao)} ${sanitizeReportText(data.versao)}</span>
      <span>${sanitizeReportText(t.capaFooterRight)}</span>
    </div>
  </div>
</div>`
}

export function buildPage2_SumarioVital(
  data: ReportData,
  llm: ReportLLMBlocks['sumario'],
  t: ReportL10n,
): string {
  const matIdx = maturidadeActiveIndex(data.estagio_index)
  const matHtml = t.maturidade.map((lb, i) => {
    const cl = i === matIdx ? 'mat-s mat-a' : 'mat-s'
    return `<div class="${cl}">${sanitizeReportText(lb)}</div>`
  }).join('')

  const pontoRaw = String(llm.ponto_atencao ?? '').trim()
  const ponto =
    pontoRaw !== ''
      ? `<div class="imp" style="border-left-color:var(--amber);"><strong>${sanitizeReportText(t.pontoAtencao)}</strong> ${sanitizeReportText(pontoRaw.replace(/\s+/g, ' '))}</div>`
      : ''

  const tendenciaSub = `${data.var_12m_pct >= 0 ? '+' : ''}${fmtPct(data.var_12m_pct)} · ${sanitizeReportText(t.tendenciaSub)}`

  const vereditoBlock = String(llm.veredito_texto ?? '').trim()
    ? `<div style="font-size:8.5pt;color:#666;margin-bottom:10px;">${paragraphsFromLLM(llm.veredito_texto)}</div>`
    : ''

  const guRow = `${sanitizeReportText(data.gu_status)}${data.gu_pendencia && data.gu_pendencia !== 'N/D' ? ` <span class="tag ta" style="font-size:5.5pt;">${sanitizeReportText(data.gu_pendencia)}</span>` : ''}`

  // Status regulatório (TAH / Licença): rows renderizadas SEMPRE (ND fallback vem do builder
  // via `nd()`). O badge "em dia" só aparece quando há status real (evita tag verde falsa em ND).
  const tahStatusText = String(data.tah_status ?? '').trim()
  const tahHasReal =
    tahStatusText !== '' && tahStatusText !== t.nd && tahStatusText !== 'N/D' && tahStatusText !== 'N/A'
  const tahCell = tahHasReal
    ? `${sanitizeReportText(tahStatusText)} <span class="tag tg" style="font-size:5.5pt;">${sanitizeReportText(t.tahEmDia)}</span>`
    : sanitizeReportText(tahStatusText === '' ? t.nd : tahStatusText)

  const licencaText = String(data.licenca_ambiental ?? '').trim()
  const licencaCell = sanitizeReportText(licencaText === '' ? t.nd : licencaText)

  const conservLabel = t.locale.startsWith('en') ? ' (conservative)' : ' (conservador)'
  const htmlResult = `<div class="page content breathe">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>${sanitizeReportText(t.p2Tag)}</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>

  <div class="cards">
    <div class="card">
      <div class="card-lbl">${sanitizeReportText(t.riskScore)}</div>
      <div class="card-val green">${data.risk_score}<span class="card-unit">/100</span></div>
      <div class="card-sub">${sanitizeReportText(data.rs_classificacao)}</div>
    </div>
    <div class="card">
      <div class="card-lbl">${sanitizeReportText(t.opportunityScore)}</div>
      <div class="card-val gold">${data.os_conservador}<span class="card-unit">/100</span></div>
      <div class="card-sub">${sanitizeReportText(data.os_classificacao)}${conservLabel}</div>
    </div>
    <div class="card">
      <div class="card-lbl">${sanitizeReportText(t.valorInsitu)}</div>
      <div class="card-val gold card-insitu-mi" style="font-size:13pt;">US$ ${fmtValorInsituUsdMiPerHa(data.valor_insitu_usd_ha)}<span class="card-unit">/ha</span></div>
      <div class="card-sub">${sanitizeReportText(t.valorInsituSub)}</div>
    </div>
    <div class="card">
      <div class="card-lbl">${sanitizeReportText(t.tendenciaPreco)}</div>
      <div class="card-val ${data.var_12m_pct >= 0 ? 'green' : 'red'} card-tend">${sanitizeReportText(data.mercado_tendencia)}</div>
      <div class="card-sub">${tendenciaSub}</div>
    </div>
  </div>

  <h2>${sanitizeReportText(t.vereditoMaturidade)}</h2>
  <div class="mat">${matHtml}</div>
  ${vereditoBlock}
  ${ponto}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px;">
    <div>
      <h2 style="margin-top:0;">${sanitizeReportText(t.identificacaoAtivo)}</h2>
      <table class="dsm" style="font-size:7.5pt;">
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblTitular)}</td><td><strong>${sanitizeReportText(data.titular)}</strong></td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblCnpj)}</td><td>${sanitizeReportText(data.cnpj)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblSubstancia)}</td><td>${sanitizeReportText(data.substancia_anm)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblRegime)}</td><td>${sanitizeReportText(data.regime)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblFase)}</td><td>${sanitizeReportText(data.fase)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblArea)}</td><td>${fmtNum(data.area_ha)} ha</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblMunicipio)}</td><td>${sanitizeReportText(data.municipio)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblBioma)}</td><td>${sanitizeReportText(data.bioma)}</td></tr>
      </table>
    </div>
    <div>
      <h2 style="margin-top:0;">${sanitizeReportText(t.statusRegulatorio)}</h2>
      <table class="dsm" style="font-size:7.5pt;">
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblAlvara)}</td><td style="white-space:nowrap;">${sanitizeReportText(t.alvaraAte)} ${sanitizeReportText(data.alvara_validade)} <span class="tag tg" style="font-size:5.5pt;">${sanitizeReportText(data.alvara_status)}</span></td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblUltimoDespacho)}</td><td>${sanitizeReportText(data.ultimo_despacho)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblNupSei)}</td><td style="font-family:var(--mono);font-size:7pt;">${sanitizeReportText(data.nup_sei)}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblGu)}</td><td style="white-space:nowrap;">${guRow}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblTah)}</td><td style="white-space:nowrap;">${tahCell}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblLicenca)}</td><td>${licencaCell}</td></tr>
        <tr style="height:26px;"><td>${sanitizeReportText(t.tblProtocolo)}</td><td>${data.protocolo_anos} ${sanitizeReportText(t.tblProtocoloAnos)}</td></tr>
      </table>
    </div>
  </div>
  <div class="src">${sanitizeReportText(t.fontesP2)} ${sanitizeReportText(data.data_relatorio)}</div>
  ${reportFooter(2, data)}
</div>`

  return htmlResult
}

export function buildPage3_Territorio(
  data: ReportData,
  llm: ReportLLMBlocks['territorio'],
  t: ReportL10n,
): string {
  const mapSrc =
    data.mapa_base64 && data.mapa_base64.length > 20
      ? data.mapa_base64.startsWith('data:')
        ? data.mapa_base64
        : `data:image/png;base64,${data.mapa_base64}`
      : ''

  const mapBlock = mapSrc
    ? `<img class="mapa" src="${mapSrc}" alt="Mapa territorial">
  <div class="mapa-leg">${sanitizeReportText(t.mapaLegenda)}</div>`
    : `<p style="font-size:9pt;color:#666;">${sanitizeReportText(t.mapaIndisponivel)}</p>`

  const rows = data.layers
    .map(
      (l) =>
        `<tr>
      <td>${sanitizeReportText(l.tipo)}</td>
      <td>${sanitizeReportText(l.nome)} ${sanitizeReportText(l.detalhes)}</td>
      <td class="mono">${l.distancia_km.toLocaleString(t.locale, { maximumFractionDigits: 1 })} km</td>
      <td><span class="tag ${l.tag_class}">${sanitizeReportText(l.tag_label)}</span></td>
    </tr>`,
    )
    .join('')

  const infraRows = data.infraestrutura
    .map((i) => {
      const isRail = i.tipo.toLowerCase().includes('ferrov')
      const distCell = isRail
        ? `<td class="mono" style="color:var(--green);font-weight:600;">${i.distancia_km.toLocaleString(t.locale, { maximumFractionDigits: 1 })} km</td>`
        : `<td class="mono">${i.distancia_km.toLocaleString(t.locale, { maximumFractionDigits: 1 })} km</td>`
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
  <h1>${sanitizeReportText(t.p3Tag)}</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>
  ${mapBlock}
  <h2 style="margin-top:20px;">${sanitizeReportText(t.sobreposicoes)}</h2>
  <table style="table-layout:fixed;">
    <thead><tr><th style="width:18%;">${sanitizeReportText(t.thAreaProt)}</th><th style="width:42%;">${sanitizeReportText(t.thMaisProxima)}</th><th style="width:16%;">${sanitizeReportText(t.thDistancia)}</th><th style="width:24%;">${sanitizeReportText(t.thSobreposicao)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2 style="margin-top:20px;">${sanitizeReportText(t.logisticaTitulo)}</h2>
  <p style="font-size:8pt;color:var(--text-light);margin-bottom:3px;">${paragraphsFromLLM(llm.logistica_texto)}</p>

  <table style="table-layout:fixed;">
    <thead><tr><th style="width:16%;">${sanitizeReportText(t.thInfra)}</th><th style="width:32%;">${sanitizeReportText(t.thNome)}</th><th style="width:32%;">${sanitizeReportText(t.thDetalhes)}</th><th style="width:20%;">${sanitizeReportText(t.thDistancia)}</th></tr></thead>
    <tbody>${infraRows}</tbody>
  </table>

  <div class="imp">${paragraphsFromLLM(llm.implicacao)}</div>

  <div class="src">${sanitizeReportText(t.fontesP3)}</div>
  ${reportFooter(3, data)}
</div>`
}

export function buildPage4_Mercado(
  data: ReportData,
  llm: ReportLLMBlocks['mercado'],
  t: ReportL10n,
): string {
  const gapPp = data.reservas_mundiais_pct - data.producao_mundial_pct
  const gapStr =
    gapPp >= 0
      ? `<strong class="green">+${gapPp.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</strong> ${sanitizeReportText(t.tblGapPotencial)}`
      : `<strong>${gapPp.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</strong>`

  return `<div class="page content">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>${sanitizeReportText(t.p4Tag)}</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">${sanitizeReportText(t.precoSpot)}</div>
      <div class="kpi-val gold">US$ ${fmtUsdOz(data.preco_oz_usd)}<span class="card-unit">/oz</span></div>
      <div class="kpi-sub">R$ ${fmtUsdOz(data.preco_g_brl)}/g &middot; PTAX R$ ${fmtUsdOz(data.ptax)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">${sanitizeReportText(t.var12m)}</div>
      <div class="kpi-val ${data.var_12m_pct >= 0 ? 'green' : 'red'}">${fmtPct(data.var_12m_pct)}</div>
      <div class="kpi-sub">${sanitizeReportText(t.refSpot)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">${sanitizeReportText(t.cresc5a)}</div>
      <div class="kpi-val green">${fmtPct(data.cagr_5a_pct)} <span class="card-unit">a.a.</span></div>
      <div class="kpi-sub">${sanitizeReportText(t.cagrLbl)}</div>
    </div>
    ${
      data.demanda_global_t > 0
        ? `
    <div class="kpi">
      <div class="kpi-lbl">${sanitizeReportText(t.demandaGlobal)}</div>
      <div class="kpi-val">${fmtNum(data.demanda_global_t)} <span class="card-unit">t</span></div>
      <div class="kpi-sub">${sanitizeReportText(t.refMercado)}</div>
    </div>`
        : ''
    }
  </div>

  <div class="cols">
    <div class="col">
      <h2 style="margin-top:0;">${sanitizeReportText(t.posicaoBrasil)}</h2>
      <table class="dsm">
        <tr><td>${sanitizeReportText(t.tblReservasMundiais)}</td><td>${fmtPct(data.reservas_mundiais_pct)} ${sanitizeReportText(t.doTotalGlobal)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblProducaoMundial)}</td><td>${fmtPct(data.producao_mundial_pct)} ${sanitizeReportText(t.doTotalGlobal)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblGap)}</td><td>${gapStr}</td></tr>
        <tr><td>${sanitizeReportText(t.tblAplicacoes)}</td><td>${sanitizeReportText(t.tblAplicacoesVal)}</td></tr>
      </table>
    </div>
    <div class="col">
      <h2 style="margin-top:0;">${sanitizeReportText(t.aspectosReg)}</h2>
      <table class="dsm">
        <tr><td>${sanitizeReportText(t.tblEstrategiaPnm)}</td><td class="cell-text-wrap estrategia-pnm-cell">${sanitizeReportText(data.estrategia_nacional)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblCfemRoyalty)}</td><td>${fmtPct(data.cfem_aliquota_pct)} ${sanitizeReportText(t.tblCfemPct)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblMineralEstrategico)}</td><td>${sanitizeReportText(t.tblMineralEstrategicoVal)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblCfemHa)}</td><td><strong>R$ ${fmtCfemEstimadaBrlMiPerHa(data.cfem_estimada_ha)}/ha</strong> ${sanitizeReportText(t.tblCfemHaRef)}</td></tr>
      </table>
    </div>
  </div>

  <h2>${sanitizeReportText(t.valorEstimadoReserva)}</h2>
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">${sanitizeReportText(t.valorInsituKpi)}</div>
      <div class="kpi-val gold kpi-val-mi">US$ ${fmtValorInsituUsdMiPerHa(data.valor_insitu_usd_ha)}<span class="card-unit">/ha</span></div>
      <div class="kpi-sub">${sanitizeReportText(t.refMercado2)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">${sanitizeReportText(t.cfemEstKpi)}</div>
      <div class="kpi-val gold kpi-val-mi">R$ ${fmtCfemEstimadaBrlMiPerHa(data.cfem_estimada_ha)}<span class="card-unit">/ha</span></div>
      <div class="kpi-sub">${sanitizeReportText(t.cfemEstSub)} ${fmtPct(data.cfem_aliquota_pct)} ${sanitizeReportText(t.cfemEstSubSobre)}</div>
    </div>
  </div>

  <div class="nota">${sanitizeReportText(t.notaMetodologica)}</div>

  <div class="imp">${paragraphsFromLLM(llm.implicacao)}</div>

  <div class="src">${sanitizeReportText(t.fontesP4)}</div>
  ${reportFooter(4, data)}
</div>`
}

export function buildPage5_Fiscal(
  data: ReportData,
  llm: ReportLLMBlocks['fiscal'],
  t: ReportL10n,
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

  const linhasBndesCell =
    data.incentivos.linhas_bndes_nomes &&
    data.incentivos.linhas_bndes_nomes.length > 0
      ? sanitizeReportText(data.incentivos.linhas_bndes_nomes.join('; '))
      : `${data.incentivos.linhas_bndes} ${sanitizeReportText(t.tblLinhasBndesEleg)}`

  return `<div class="page content compact">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>${sanitizeReportText(t.p5Tag)}</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead">${paragraphsFromLLM(llm.lead)}</p>

  <div class="cols">
    <div class="col">
      <div style="text-align:center;padding:10px 0;">
        <div class="sbig gold">${sanitizeReportText(data.capag_nota)}</div>
        <div style="font-size:8.5pt;color:var(--text-muted);margin-top:2px;">${sanitizeReportText(t.capagRef)}</div>
        <div style="font-size:7.5pt;color:var(--text-muted);margin-top:4px;">${sanitizeReportText(data.fiscal_contexto_referencia)}</div>
      </div>
      <table class="dsm">
        <thead><tr><th>${sanitizeReportText(t.thIndicador)}</th><th>${sanitizeReportText(t.thValor)}</th><th>${sanitizeReportText(t.thNota)}</th></tr></thead>
        <tbody>
          <tr><td>${sanitizeReportText(t.endividamento)}</td><td class="mono">${sanitizeReportText(data.capag_endiv)}</td><td><span class="tag tg">${sanitizeReportText(data.capag_endiv_nota)}</span></td></tr>
          <tr><td>${sanitizeReportText(t.poupancaCorrente)}</td><td class="mono">${sanitizeReportText(data.capag_poupcorr)}</td><td><span class="tag tr">${sanitizeReportText(data.capag_poupcorr_nota)}</span></td></tr>
          <tr><td>${sanitizeReportText(t.liquidez)}</td><td class="mono">${sanitizeReportText(data.capag_liquidez)}</td><td><span class="tag ta">${sanitizeReportText(data.capag_liquidez_nota)}</span></td></tr>
        </tbody>
      </table>
      <p style="font-size:7.5pt;color:var(--gold);font-style:italic;margin-top:4px;">${sanitizeReportText(t.capagNotaFinal)}</p>
    </div>
    <div class="col">
      <h2 style="margin-top:0;">${sanitizeReportText(t.indicadoresMun)}</h2>
      <table class="dsm">
        <tr><td>${sanitizeReportText(t.tblReceitaPropria)}</td><td><strong>${sanitizeReportText(data.receita_propria)}</strong></td></tr>
        <tr><td>${sanitizeReportText(t.tblDivida)}</td><td><strong>${sanitizeReportText(data.divida)}</strong></td></tr>
        <tr><td>${sanitizeReportText(t.tblPib)}</td><td><strong>${sanitizeReportText(data.pib_municipal)}</strong></td></tr>
        <tr><td>${sanitizeReportText(t.tblDepTransf)}</td><td><strong>${sanitizeReportText(data.dependencia_transf)}</strong> ${sanitizeReportText(t.tblDepTransfSuffix)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblPop)}</td><td>${sanitizeReportText(data.populacao)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblIdh)}</td><td>${sanitizeReportText(data.idh)}</td></tr>
      </table>
      <h2>${sanitizeReportText(t.incentivosDisp)}</h2>
      <table class="dsm">
        <tr><td>${sanitizeReportText(t.tblProgEstadual)}</td><td class="cell-text-wrap">${sanitizeReportText(data.incentivos.programa_estadual)}</td></tr>
        <tr><td>${sanitizeReportText(t.tblLinhasBndes)}</td><td class="cell-text-wrap">${linhasBndesCell}</td></tr>
      </table>
    </div>
  </div>

  <h2>${sanitizeReportText(t.arrecadacaoCfem)}</h2>
  <p style="font-size:8.5pt;color:var(--text-light);margin-bottom:4px;">${paragraphsFromLLM(llm.cfem_intro)}</p>

  <table class="cfem" style="font-size:8.5pt;table-layout:fixed;">
    <thead><tr><th style="width:12%;">${sanitizeReportText(t.thAno)}</th><th style="width:25%;">${sanitizeReportText(t.thCfemProcesso)}</th><th style="width:25%;">${sanitizeReportText(t.thCfemMunicipio)}</th><th style="width:38%;">${sanitizeReportText(t.thCfemSubst)}</th></tr></thead>
    <tbody>${cfemRows}</tbody>
  </table>

  <div class="imp">${paragraphsFromLLM(llm.implicacao)}</div>

  <div class="src">${sanitizeReportText(t.fontesP5)}</div>
  ${reportFooter(5, data)}
</div>`
}

export function buildPage6_Risco(
  data: ReportData,
  llm: ReportLLMBlocks['risco'],
  t: ReportL10n,
): string {
  const dims = [
    { k: t.riscoGeologico, r: data.rs_geo, text: llm.dim_geo },
    { k: t.riscoAmbiental, r: data.rs_amb, text: llm.dim_amb },
    { k: t.riscoSocial, r: data.rs_soc, text: llm.dim_soc },
    { k: t.riscoRegulatorio, r: data.rs_reg, text: llm.dim_reg },
  ] as const

  const bars = dims.map((d) => riskBar(d.k, d.r)).join('')

  return `<div class="page content">
  <div class="ptag">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>${sanitizeReportText(t.p6Tag)}</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead" style="margin-bottom:8px;">${paragraphsFromLLM(llm.lead)}</p>

  <div style="text-align:center;margin:4px 0;">
    <div class="sbig green">${data.risk_score}</div>
    <div style="font-size:8.5pt;color:var(--text-muted);">/100 &middot; ${sanitizeReportText(data.rs_classificacao)}</div>
    <div style="font-size:7pt;color:var(--text-muted);font-style:italic;margin-top:2px;">${sanitizeReportText(t.rsEscopo)}</div>
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

  <div class="imp" style="margin-top:8px;"><strong>${sanitizeReportText(t.leituraIntegrada)}</strong> ${sanitizeReportText(String(llm.leitura ?? '').replace(/\s+/g, ' ').trim())}</div>

  <div class="src">${sanitizeReportText(t.fontesP6)} ${sanitizeReportText(data.data_relatorio)}</div>
  ${reportFooter(6, data)}
</div>`
}

export function buildPage7_Oportunidade(
  data: ReportData,
  llm: ReportLLMBlocks['oportunidade'],
  t: ReportL10n,
): string {
  const osBars = [
    { label: t.dimMercado, r: data.os_merc },
    { label: t.dimViab, r: data.os_viab },
    { label: t.dimSeg, r: data.os_seg },
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
  <h1>${sanitizeReportText(t.p7Tag)}</h1>
  <div class="hl">${sanitizeReportText(llm.headline)}</div>
  <p class="lead" style="margin-bottom:4px;">${paragraphsFromLLM(llm.lead)}</p>

  <div style="text-align:center;margin:4px 0;">
    <div class="sbig gold">${data.os_conservador}</div>
    <div style="font-size:8.5pt;color:var(--text-muted);">/100 &middot; ${sanitizeReportText(data.os_classificacao)} ${sanitizeReportText(t.oportunidadePerfilCons)}</div>
    <div style="font-size:7pt;color:var(--text-muted);font-style:italic;margin-top:2px;">${sanitizeReportText(t.osEscopo)}</div>
  </div>

  ${osBars}

  <div class="cols" style="margin-top:20px;">
    <div class="col">
      <div class="rdim"><h3>${sanitizeReportText(t.dimMercado)} - ${sanitizeReportText(data.os_merc.label)}</h3>${paragraphsFromLLM(llm.dim_merc)}</div>
    </div>
    <div class="col">
      <div class="rdim"><h3>${sanitizeReportText(t.dimSeg)} - ${sanitizeReportText(data.os_seg.label)}</h3>${paragraphsFromLLM(llm.dim_seg)}</div>
    </div>
  </div>
  <div class="rdim"><h3>${sanitizeReportText(t.dimViab)} - ${sanitizeReportText(data.os_viab.label)}</h3>${paragraphsFromLLM(llm.dim_viab)}</div>

  <h2 style="margin-top:18px;">${sanitizeReportText(t.perfilInvestidor)}</h2>
  <table class="ptbl" style="font-size:9pt;">
    <thead><tr><th>${sanitizeReportText(t.thPerfil)}</th><th style="text-align:center;">${sanitizeReportText(t.thScore)}</th><th>${sanitizeReportText(t.thClassificacao)}</th></tr></thead>
    <tbody>
      <tr><td><strong>${sanitizeReportText(t.perfilCons)}</strong> ${sanitizeReportText(t.perfilConsSub)}</td><td class="gold">${data.os_conservador}</td><td>${sanitizeReportText(data.os_classificacao)}</td></tr>
      <tr><td><strong>${sanitizeReportText(t.perfilMod)}</strong> ${sanitizeReportText(t.perfilModSub)}</td><td class="gold">${data.os_moderado}</td><td>${sanitizeReportText(data.os_classificacao)}</td></tr>
      <tr><td><strong>${sanitizeReportText(t.perfilArr)}</strong> ${sanitizeReportText(t.perfilArrSub)}</td><td class="gold">${data.os_arrojado}</td><td>${sanitizeReportText(data.os_classificacao)}</td></tr>
    </tbody>
  </table>

  <div style="margin-top:8px;background:linear-gradient(135deg, rgba(15,122,90,0.06) 0%, rgba(212,168,67,0.08) 100%);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:10px 12px;">
    <div style="font-family:var(--mono);font-size:6.5pt;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">${sanitizeReportText(t.sinteseTerradar)}</div>
    ${sinteseInner}
  </div>

  <div class="src">${sanitizeReportText(t.fontesP7)} ${sanitizeReportText(data.data_relatorio)}</div>
  ${reportFooter(7, data)}
</div>`
}

export function buildPage8_Metodologia(data: ReportData, t: ReportL10n): string {
  return `<div class="page contra">
  <div class="ptag" style="color:rgba(212,168,67,0.5);">TERRADAR ${sanitizeReportText(data.processo)}</div>
  <h1>${sanitizeReportText(t.p8Tag)}</h1>
  <div class="hl">${sanitizeReportText(t.p8Hl)}</div>
  <p style="font-size:9pt;color:rgba(255,255,255,0.6);margin-bottom:12px;">${sanitizeReportText(t.p8Intro)}</p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
    <div class="cbox"><h3>${sanitizeReportText(t.cboxRs)}</h3><p>${sanitizeReportText(t.cboxRsTxt)}</p></div>
    <div class="cbox"><h3>${sanitizeReportText(t.cboxMat)}</h3><p>${sanitizeReportText(t.cboxMatTxt)}</p></div>
    <div class="cbox"><h3>${sanitizeReportText(t.cboxOs)}</h3><p>${sanitizeReportText(t.cboxOsTxt)}</p></div>
    <div class="cbox"><h3>${sanitizeReportText(t.cboxVi)}</h3><p>${sanitizeReportText(t.cboxViTxt)}</p></div>
  </div>

  <h2 style="color:white;">${sanitizeReportText(t.fontesDadosTitulo)}</h2>
  <table>
    <thead><tr><th>${sanitizeReportText(t.thCategoria)}</th><th>${sanitizeReportText(t.thFontes)}</th></tr></thead>
    <tbody>
      <tr><td>${sanitizeReportText(t.catCadastro)}</td><td>${sanitizeReportText(t.catCadastroVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catCfem)}</td><td>${sanitizeReportText(t.catCfemVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catTerr)}</td><td>${sanitizeReportText(t.catTerrVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catInfra)}</td><td>${sanitizeReportText(t.catInfraVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catSocio)}</td><td>${sanitizeReportText(t.catSocioVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catFiscal)}</td><td>${sanitizeReportText(t.catFiscalVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catMercado)}</td><td>${sanitizeReportText(t.catMercadoVal)}</td></tr>
      <tr><td>${sanitizeReportText(t.catLeg)}</td><td>${sanitizeReportText(t.catLegVal)}</td></tr>
    </tbody>
  </table>

  <div style="font-size:7pt;color:rgba(255,255,255,0.3);margin-top:10px;line-height:1.45;">${sanitizeReportText(t.p8NotaRodape)} ${sanitizeReportText(data.data_relatorio)}${sanitizeReportText(t.p8NotaRodape2)}</div>

  <div style="margin-top:auto;">
    <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-family:var(--mono);font-size:6pt;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:2px;">${sanitizeReportText(t.capaEngLabel)}</div>
        <div style="font-size:9pt;color:rgba(255,255,255,0.65);">${sanitizeReportText(t.capaEngVal)}</div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.3);">${sanitizeReportText(t.p8ShareSite)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--mono);font-size:6pt;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:2px;">${sanitizeReportText(t.capaRegLabel)}</div>
        <div style="font-size:9pt;color:rgba(255,255,255,0.65);">${sanitizeReportText(t.capaRegVal)}</div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.3);">Brasília/DF</div>
      </div>
    </div>
  </div>
  <div class="pf" style="color:rgba(255,255,255,0.2);"><span>TERRADAR &middot; ${sanitizeReportText(t.capaConf)} &middot; 8/${TOTAL}</span><span>${sanitizeReportText(refSlug(data))}</span></div>
</div>`
}
