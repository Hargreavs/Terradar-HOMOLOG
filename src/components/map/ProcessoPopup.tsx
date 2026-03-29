import { useMemo, type ReactNode } from 'react'
import {
  Building2,
  ChevronRight,
  Circle,
  MapPin,
  Scan,
  type LucideIcon,
} from 'lucide-react'
import { alertaMaisGraveParaTituloPopover } from '../../lib/alertaNivelImpactoBadge'
import {
  calcularRelevancia,
  RELEVANCIA_MAP,
  type Relevancia,
} from '../../lib/relevanciaAlerta'
import { normalizeSubstanciaKey, SUBSTANCIA_DEFS } from '../../lib/substancias'
import { useMapStore } from '../../store/useMapStore'
import type { AlertaLegislativo, Processo } from '../../types'
import { TerraTooltipWrap } from '../ui/TerraSideTooltip'
import { BadgeSubstancia } from '../ui/BadgeSubstancia'
import { RegimeBadge } from '../ui/RegimeBadge'

const POPUP_W = 300
const POPUP_Z = 1

const ICON_POPUP = { size: 16, color: '#888780' as const, strokeWidth: 1.5 }

/** Faixas: menor que 40 verde, 40 a 69 âmbar, 70 ou mais vermelho (barras e números). */
function riskTierColor(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v < 70) return '#E8A830'
  return '#E24B4A'
}

function substanciaIconForPopup(substancia: string): {
  Icon: LucideIcon
  color: string
} {
  const key = normalizeSubstanciaKey(substancia)
  const def = SUBSTANCIA_DEFS.find((d) => d.key === key)
  if (def) return { Icon: def.Icon, color: def.color }
  return { Icon: Circle, color: '#D3D1C7' }
}

function mensagemTooltipRiskScoreTotal(valor: number): string {
  const v = valor
  if (v < 40)
    return 'Risco baixo. Indicadores favoráveis nas principais dimensões. Área com bom perfil para investimento.'
  if (v <= 69)
    return 'Risco moderado. Nenhuma dimensão isolada é crítica, mas a combinação requer análise detalhada antes de investir.'
  return 'Risco elevado. Uma ou mais dimensões apresentam indicadores críticos. Recomenda-se análise aprofundada no relatório completo.'
}

function mensagemTooltipDimensao(
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio',
  valor: number,
): string {
  const v = valor
  if (dim === 'geologico') {
    if (v < 40)
      return 'Região com perfil geológico favorável e histórico de pesquisa ativo'
    if (v <= 69)
      return 'Potencial geológico moderado: dados de pesquisa mineral incompletos'
    return 'Risco geológico elevado: ausência de relatórios de pesquisa recentes'
  }
  if (dim === 'ambiental') {
    if (v < 40)
      return 'Sem sobreposição com áreas protegidas: licenciamento simplificado'
    if (v <= 69)
      return 'Área próxima a unidades de conservação: EIA/RIMA pode ser exigido'
    return 'Sobreposição com Terra Indígena ou UC de proteção integral identificada'
  }
  if (dim === 'social') {
    if (v < 40)
      return 'Município com baixo índice de conflitos fundiários registrados'
    if (v <= 69)
      return 'Histórico de conflitos rurais na região: monitoramento recomendado'
    return 'Alto índice de conflitos rurais (CPT) e criminalidade na região'
  }
  if (v < 40)
    return 'Processo sem pendências na ANM: legislação favorável para o regime'
  if (v <= 69)
    return 'Alertas regulatórios ativos podem impactar o cronograma do processo'
  return 'Múltiplas restrições regulatórias ativas: processo com alto risco de bloqueio'
}

function RiskBreakdownRowComTooltip({
  dim,
  val,
  children,
}: {
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio'
  val: number
  children: ReactNode
}) {
  return (
    <TerraTooltipWrap
      texto={mensagemTooltipDimensao(dim, val)}
      className="flex w-full min-w-0 cursor-default items-center gap-2"
    >
      {children}
    </TerraTooltipWrap>
  )
}

function RiskScoreBarraTotalComTooltip({
  valor,
  children,
}: {
  valor: number
  children: ReactNode
}) {
  return (
    <TerraTooltipWrap
      texto={mensagemTooltipRiskScoreTotal(valor)}
      className="w-full cursor-default"
    >
      {children}
    </TerraTooltipWrap>
  )
}

export type ProcessoPopupContentProps = {
  processo: Processo
  onClose: () => void
  onToggleRelatorioCompleto?: () => void
  /** Abre o relatório na aba Risco (alertas regulatórios). */
  onAbrirRelatorioAbaRisco?: () => void
  /** Navega para o Radar com o alerta selecionado no feed (Mapa). */
  onIrParaRadarAlerta?: (alerta: AlertaLegislativo) => void
  /** Mapa: fecha o popover e abre o Radar em home (ver todos os alertas). */
  onVerTodosAlertasRadar?: () => void
}

/** Conteúdo do popup (montado via ReactDOM.createRoot dentro de mapboxgl.Popup). */
export function ProcessoPopupContent({
  processo,
  onClose,
  onToggleRelatorioCompleto,
  onAbrirRelatorioAbaRisco,
  onIrParaRadarAlerta,
  onVerTodosAlertasRadar,
}: ProcessoPopupContentProps) {
  const relatorioDrawerAberto = useMapStore((s) => s.relatorioDrawerAberto)
  const processoSelId = useMapStore((s) => s.processoSelecionado?.id)
  const relatorioAtivo =
    relatorioDrawerAberto && processoSelId === processo.id

  const r = processo.risk_score
  const { Icon: SubstIcon, color: substIconColor } = substanciaIconForPopup(
    processo.substancia,
  )

  const alertaTituloDestaque =
    processo.alertas.length > 0
      ? alertaMaisGraveParaTituloPopover(processo.alertas)
      : null

  const badgeRelevancia =
    alertaTituloDestaque !== null
      ? RELEVANCIA_MAP[
          calcularRelevancia(
            alertaTituloDestaque.nivel_impacto,
            alertaTituloDestaque.tipo_impacto,
          )
        ]
      : null

  const alertasOrdenadosPorCriticidade = useMemo(() => {
    const ordem = (a: AlertaLegislativo): number => {
      const rel: Relevancia = calcularRelevancia(a.nivel_impacto, a.tipo_impacto)
      return RELEVANCIA_MAP[rel].ordem
    }
    return [...processo.alertas].sort((a, b) => ordem(a) - ordem(b))
  }, [processo.alertas])

  const alertasPopoverVisiveis = alertasOrdenadosPorCriticidade.slice(0, 2)
  const totalAlertas = processo.alertas.length
  const mostrarLinkVerTodos = onVerTodosAlertasRadar != null && totalAlertas > 2

  return (
    <div className="pointer-events-auto relative" style={{ width: POPUP_W }}>
      <div
        className="box-border overflow-hidden rounded-[10px] text-left"
        style={{
          position: 'relative',
          zIndex: POPUP_Z,
          width: POPUP_W,
          backgroundColor: '#1A1A18',
          border: '1px solid rgba(241, 239, 232, 0.12)',
          boxShadow:
            '0 4px 14px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="px-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[17px] font-bold leading-snug text-[#F1EFE8]">
              {processo.numero}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[18px] leading-none text-[#888780] transition-colors hover:text-[#D3D1C7]"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <RegimeBadge regime={processo.regime} variant="popup" className="mt-3" />
        </div>

        <div className="my-3 h-px w-full shrink-0 bg-[#2C2C2A]" aria-hidden />

        <div className="space-y-[10px] px-4">
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <MapPin
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={ICON_POPUP.color}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="leading-snug">
              {processo.uf} / {processo.municipio}
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <SubstIcon
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={substIconColor}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="inline-block leading-snug">
              <BadgeSubstancia substancia={processo.substancia} variant="popup" />
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <Scan
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={ICON_POPUP.color}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="leading-snug">
              {processo.area_ha.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ha
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[15px] text-[#D3D1C7]">
            <Building2
              className="mt-0.5 shrink-0"
              aria-hidden
              size={ICON_POPUP.size}
              color={ICON_POPUP.color}
              strokeWidth={ICON_POPUP.strokeWidth}
            />
            <span className="leading-snug">{processo.titular}</span>
          </div>
        </div>

        <div className="my-3 h-px w-full shrink-0 bg-[#2C2C2A]" aria-hidden />

        <div className="px-4 pb-4">
          <p className="mt-4 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#888780]">
            Risk Score
          </p>
          {r === null ? (
            <p className="text-[15px] font-medium text-[#E8E6DF]">N/A</p>
          ) : (
            <>
              <RiskScoreBarraTotalComTooltip valor={r}>
                <div className="flex w-full min-w-0 items-center gap-2">
                  <div
                    className="min-w-0 flex-1 overflow-hidden rounded-sm"
                    style={{ height: 5, backgroundColor: '#2C2C2A' }}
                  >
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.min(100, Math.max(0, r))}%`,
                        backgroundColor: riskTierColor(r),
                      }}
                    />
                  </div>
                  <span
                    className="w-[40px] shrink-0 text-right tabular-nums text-[15px] font-bold"
                    style={{ color: riskTierColor(r) }}
                  >
                    {r}
                  </span>
                </div>
              </RiskScoreBarraTotalComTooltip>
              {processo.risk_breakdown ? (
                <div
                  className={`mt-5 space-y-1.5 ${processo.alertas.length > 0 ? 'mb-5' : ''}`}
                >
                  {(
                    [
                      ['geologico', 'Geológico', processo.risk_breakdown.geologico],
                      ['ambiental', 'Ambiental', processo.risk_breakdown.ambiental],
                      ['social', 'Social', processo.risk_breakdown.social],
                      ['regulatorio', 'Regulatório', processo.risk_breakdown.regulatorio],
                    ] as const
                  ).map(([dim, label, val]) => {
                    const v = Math.min(100, Math.max(0, val))
                    const corVal = riskTierColor(val)
                    return (
                      <RiskBreakdownRowComTooltip key={dim} dim={dim} val={val}>
                        <span className="w-[112px] shrink-0 text-[15px] text-[#888780]">
                          {label}
                        </span>
                        <div
                          className="min-w-0 flex-1 overflow-hidden rounded-sm"
                          style={{ height: 3, backgroundColor: '#2C2C2A' }}
                        >
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${v}%`,
                              backgroundColor: corVal,
                            }}
                          />
                        </div>
                        <span
                          className="w-[40px] shrink-0 text-right tabular-nums text-[15px] font-medium"
                          style={{ color: corVal }}
                        >
                          {val}
                        </span>
                      </RiskBreakdownRowComTooltip>
                    )
                  })}
                </div>
              ) : null}
            </>
          )}

          <>
            <div
              className="-mx-4 my-3 h-px shrink-0 bg-[#2C2C2A]"
              aria-hidden
            />
            {processo.alertas.length > 0 && onIrParaRadarAlerta ? (
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                  <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[1px] text-[#888780]">
                    Alertas regulatórios
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded-[10px] text-[13px] font-medium tabular-nums leading-none text-[#F1EFE8]"
                    style={{ backgroundColor: '#2C2C2A', padding: '2px 9px' }}
                  >
                    {processo.alertas.length}
                  </span>
                </div>
                <ul className="mt-2 list-none space-y-1 p-0">
                  {alertasPopoverVisiveis.map((al, idx) => {
                    const badge = RELEVANCIA_MAP[
                      calcularRelevancia(al.nivel_impacto, al.tipo_impacto)
                    ]
                    return (
                      <li key={`${idx}-${al.titulo}`}>
                        <button
                          type="button"
                          className="group box-border w-full cursor-pointer appearance-none rounded-[6px] border-0 bg-transparent py-[10px] pl-1.5 pr-1.5 text-left transition-[background-color] duration-150 ease hover:bg-[#2C2C2A]"
                          onClick={() => onIrParaRadarAlerta(al)}
                          aria-label={`Abrir alerta no Radar: ${al.titulo}`}
                        >
                          <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
                            <span
                              className="inline-flex w-fit shrink-0 items-center justify-center rounded-[4px] font-semibold uppercase"
                              style={{
                                padding: '2px 6px',
                                fontSize: 9,
                                letterSpacing: '0.5px',
                                color: badge.cor,
                                border: `1px solid ${badge.cor}`,
                                backgroundColor: 'transparent',
                              }}
                            >
                              {badge.label}
                            </span>
                            <ChevronRight
                              className="shrink-0 text-[#5F5E5A] transition-colors group-hover:text-[#888780]"
                              size={14}
                              strokeWidth={2}
                              aria-hidden
                            />
                          </div>
                          <p className="mt-1.5 line-clamp-2 min-w-0 text-left text-[15px] leading-snug text-[#D3D1C7]">
                            {al.titulo}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {mostrarLinkVerTodos ? (
                  <button
                    type="button"
                    className="box-border w-full border-0 bg-transparent py-0 pl-1.5 pr-1.5 text-left"
                    style={{
                      marginTop: 8,
                      fontSize: 15,
                      color: '#F1B85A',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none'
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onVerTodosAlertasRadar?.()
                    }}
                    aria-label={`Ver todos os ${totalAlertas} alertas no Radar`}
                  >
                    {`Ver todos os ${totalAlertas} alertas`}
                  </button>
                ) : null}
              </div>
            ) : processo.alertas.length > 0 && badgeRelevancia ? (
              <button
                type="button"
                className="group box-border w-full cursor-pointer appearance-none rounded-[6px] border-0 bg-transparent py-[10px] pl-1.5 pr-1.5 text-left transition-[background-color] duration-150 ease hover:bg-[#2C2C2A]"
                onClick={() => onAbrirRelatorioAbaRisco?.()}
                aria-label="Abrir alertas regulatórios no relatório"
              >
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                    <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[1px] text-[#888780]">
                      Alertas regulatórios
                    </span>
                    <span
                      className="inline-flex shrink-0 items-center justify-center rounded-[10px] text-[13px] font-medium tabular-nums leading-none text-[#F1EFE8]"
                      style={{ backgroundColor: '#2C2C2A', padding: '2px 9px' }}
                    >
                      {processo.alertas.length}
                    </span>
                  </div>
                  <ChevronRight
                    className="shrink-0 text-[#5F5E5A] transition-colors group-hover:text-[#888780]"
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
                <span
                  className="mt-2 inline-flex w-fit shrink-0 items-center justify-center rounded-[4px] font-semibold uppercase"
                  style={{
                    padding: '2px 6px',
                    fontSize: 9,
                    letterSpacing: '0.5px',
                    color: badgeRelevancia.cor,
                    border: `1px solid ${badgeRelevancia.cor}`,
                    backgroundColor: 'transparent',
                  }}
                >
                  {badgeRelevancia.label}
                </span>
                {alertaTituloDestaque ? (
                  <p className="mt-1.5 line-clamp-2 min-w-0 text-[15px] leading-snug text-[#D3D1C7]">
                    {alertaTituloDestaque.titulo}
                  </p>
                ) : null}
              </button>
            ) : (
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                  <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[1px] text-[#888780]">
                    Alertas regulatórios
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded-[10px] text-[13px] font-medium tabular-nums leading-none text-[#F1EFE8]"
                    style={{ backgroundColor: '#2C2C2A', padding: '2px 9px' }}
                  >
                    {processo.alertas.length}
                  </span>
                </div>
              </div>
            )}
          </>

          <button
            type="button"
            className="mt-5 w-full cursor-pointer rounded-lg border-0 px-0 py-3 text-[14px] font-semibold transition-[background-color] duration-200 ease-in-out"
            style={{
              color: '#0D0D0C',
              backgroundColor: relatorioAtivo ? '#F1B85A' : '#EF9F27',
            }}
            onMouseEnter={(e) => {
              if (!relatorioAtivo) e.currentTarget.style.backgroundColor = '#F1B85A'
            }}
            onMouseLeave={(e) => {
              if (!relatorioAtivo) e.currentTarget.style.backgroundColor = '#EF9F27'
            }}
            onClick={() => onToggleRelatorioCompleto?.()}
          >
            Ver relatório completo
          </button>
        </div>
      </div>
    </div>
  )
}
