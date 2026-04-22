import { useEffect, useState, type ReactNode } from 'react'
import {
  Building2,
  ChevronRight,
  Circle,
  MapPin,
  Scan,
  type LucideIcon,
} from 'lucide-react'
import { corFaixaOS } from '../../lib/oportunidadeRelatorioUi'
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
  if (key === 'MINERIO DE OURO') {
    const ouro = SUBSTANCIA_DEFS.find((d) => d.key === 'OURO')!
    return { Icon: ouro.Icon, color: ouro.color }
  }
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
      className="min-w-0 flex-1 cursor-default"
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
  onVerTodosAlertasRadar,
}: ProcessoPopupContentProps) {
  const relatorioDrawerAberto = useMapStore((s) => s.relatorioDrawerAberto)
  const processoSelId = useMapStore((s) => s.processoSelecionado?.id)
  const relatorioAtivo =
    relatorioDrawerAberto && processoSelId === processo.id

  const r = processo.risk_score
  const osConservador = processo.os_conservador_persistido ?? null
  const { Icon: SubstIcon, color: substIconColor } = substanciaIconForPopup(
    processo.substancia,
  )

  const totalAlertas = processo.alertas.length

  const [riskScoreDetalheAberto, setRiskScoreDetalheAberto] = useState(false)
  useEffect(() => {
    setRiskScoreDetalheAberto(false)
  }, [processo.id])

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
          {r === null ? (
            <>
              <p className="mt-4 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]">
                Risk Score
              </p>
              <p className="text-[15px] font-medium text-[#E8E6DF]">N/A</p>
            </>
          ) : (
            <>
              <p className="mt-4 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]">
                Risk Score
              </p>
              <div className="flex w-full min-w-0 items-center gap-2">
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
                      className="w-[40px] shrink-0 text-right tabular-nums text-[15px] font-bold leading-none"
                      style={{ color: riskTierColor(r) }}
                    >
                      {r}
                    </span>
                  </div>
                </RiskScoreBarraTotalComTooltip>
                {processo.risk_breakdown ? (
                  <button
                    type="button"
                    className="flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent py-0 pr-1.5 pl-0 text-[#F1EFE8] transition-opacity hover:opacity-80"
                    aria-expanded={riskScoreDetalheAberto}
                    aria-label={
                      riskScoreDetalheAberto
                        ? 'Ocultar dimensões do Risk Score'
                        : 'Mostrar dimensões do Risk Score'
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setRiskScoreDetalheAberto((v) => !v)
                    }}
                  >
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                      className="transition-transform duration-150 ease-out"
                      style={{
                        transform: riskScoreDetalheAberto
                          ? 'rotate(90deg)'
                          : 'rotate(0deg)',
                      }}
                    />
                  </button>
                ) : null}
              </div>
              {processo.risk_breakdown && riskScoreDetalheAberto ? (
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
                          style={{ height: 5, backgroundColor: '#2C2C2A', borderRadius: 3 }}
                        >
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${v}%`,
                              backgroundColor: corVal,
                              borderRadius: 3,
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
                  {onAbrirRelatorioAbaRisco ? (
                    <button
                      type="button"
                      className="mt-3 box-border w-full cursor-pointer border-0 bg-transparent p-0 text-center text-[15px] transition-opacity hover:opacity-80"
                      style={{ color: '#F1B85A' }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onAbrirRelatorioAbaRisco()
                      }}
                    >
                      Ver decomposição completa
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          {osConservador != null ? (
            <>
              <div
                className="-mx-4 my-3 h-px shrink-0 bg-[#2C2C2A]"
                aria-hidden
              />
              <p
                className="mt-1 mb-2.5 text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]"
              >
                Opportunity Score
              </p>
              <div className="flex w-full min-w-0 items-center gap-2">
                <div
                  className="flex min-w-0 items-center gap-2"
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: 0,
                  }}
                >
                  <div
                    className="min-w-0"
                    style={{
                      flexGrow: 1,
                      flexShrink: 0,
                      flexBasis: 0,
                      minWidth: 0,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: '#2C2C2A',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, osConservador))}%`,
                        height: '100%',
                        borderRadius: 3,
                        backgroundColor: corFaixaOS(osConservador),
                      }}
                    />
                  </div>
                  <span
                    className="w-[40px] shrink-0 text-right tabular-nums text-[15px] font-bold leading-none"
                    style={{ color: corFaixaOS(osConservador) }}
                  >
                    {osConservador}
                  </span>
                </div>
                {processo.risk_breakdown && r !== null ? (
                  <div
                    className="flex shrink-0 items-center justify-center border-0 bg-transparent py-0 pr-1.5 pl-0"
                    aria-hidden
                  >
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      className="pointer-events-none invisible"
                      aria-hidden
                    />
                  </div>
                ) : null}
              </div>
              <div
                className="w-full text-left"
                style={{ marginTop: 2 }}
              >
                <span
                  className="text-[12px] font-normal not-italic"
                  style={{ color: '#8A877E' }}
                >
                  Perfil conservador
                </span>
              </div>
              <div
                className="-mx-4 my-3 h-px shrink-0 bg-[#2C2C2A]"
                aria-hidden
              />
            </>
          ) : null}

          {totalAlertas > 0 && onVerTodosAlertasRadar ? (
            <>
              {osConservador == null ? (
                <div
                  className="-mx-4 my-3 h-px shrink-0 bg-[#2C2C2A]"
                  aria-hidden
                />
              ) : null}
              <div className="flex min-w-0 flex-col">
                <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[1px] text-[#F1EFE8]">
                  Alertas regulatórios
                </span>
                <button
                  type="button"
                  className="mt-2 flex w-full cursor-pointer items-center justify-between border-0 bg-transparent py-0 pl-0 pr-1.5 text-left text-[15px] transition-opacity hover:opacity-80"
                  style={{ color: '#F1B85A' }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onVerTodosAlertasRadar()
                  }}
                  aria-label={`Ver todos os ${totalAlertas} alertas no Radar`}
                >
                  <span className="min-w-0" style={{ color: '#F1B85A' }}>
                    {`Ver todos os ${totalAlertas} alertas`}
                  </span>
                  <ChevronRight
                    size={14}
                    strokeWidth={2}
                    className="shrink-0"
                    style={{ color: '#F1B85A' }}
                    aria-hidden
                  />
                </button>
              </div>
            </>
          ) : null}

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
