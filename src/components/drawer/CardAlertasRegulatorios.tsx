import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, HelpCircle } from 'lucide-react'

import { type AlertaRadar } from '../../types/alertasRadar'
import { useAlertasProcesso } from '../../lib/radar/useAlertasProcesso'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

const STR = {
  tituloCard: 'Alertas regulatórios',
  vazio: 'Nenhum alerta regulatório vinculado a este processo.',
  secDiretos: 'Cita este processo',
  secSetoriais: 'Afeta o segmento',
  verAnalise: 'Ver análise',
  recolher: 'Recolher',
  labelAnalise: 'Análise TERRADAR',
  erroCarregar: 'Não foi possível carregar alertas',
  tentarNovamente: 'Tentar novamente',
  carregando: 'Carregando alertas...',
  tooltipAfetaSegmento:
    'Alertas que mencionam o estado, a substância ou o setor regulatório deste processo, sem citá-lo nominalmente.',
} as const

const SHELL: CSSProperties = {
  backgroundColor: '#1E1E1C',
  borderRadius: 8,
  padding: '20px 18px',
}

/** Mesmo padrão de Risk Score / Opportunity Score no drawer (`subsecaoTituloStyle` + branco). */
const ALERTAS_TITULO_STYLE: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#F1EFE8',
  margin: 0,
  marginBottom: 18,
}

/** Rótulos de secção longos em uppercase — tracking mais fechado para caber ao lado da pill/chevron no drawer estreito. */
const SECAO_LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.045em',
  textTransform: 'uppercase',
  color: '#D4D4D8',
  lineHeight: 1.25,
}

const COUNT_PILL_STYLE: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 9px',
  borderRadius: 999,
  backgroundColor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#D3D1C7',
  lineHeight: 1,
  flexShrink: 0,
}

function IconeAjudaAfetaSegmento({ textoAjuda }: { textoAjuda: string }) {
  const [iconeHover, setIconeHover] = useState(false)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={textoAjuda}
          onClick={(e) => void e.stopPropagation()}
          onPointerDown={(e) => void e.stopPropagation()}
          onMouseEnter={() => setIconeHover(true)}
          onMouseLeave={() => setIconeHover(false)}
          style={{
            cursor: 'help',
            display: 'inline-flex',
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          <HelpCircle
            aria-hidden
            size={14}
            strokeWidth={2}
            color={iconeHover ? '#A1A1AA' : '#71717A'}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{textoAjuda}</TooltipContent>
    </Tooltip>
  )
}

function formatarDdMmYy(dataIso?: string): string {
  if (!dataIso || String(dataIso).trim() === '') return '-'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dataIso).trim())
  if (!m) return dataIso.slice(0, 10)
  return `${m[3]}/${m[2]}/${m[1]}`
}

/**
 * Data do evento (YYYY-MM-DD) → texto relativo; base `data_evento`, não publicado_em.
 */
function formatarDataRelativa(dataEvento: string | null | undefined): string {
  if (dataEvento == null || String(dataEvento).trim() === '') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dataEvento).trim())
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const event = new Date(y, mo, d)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  event.setHours(12, 0, 0, 0)
  const diffMs = today.getTime() - event.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays >= 2 && diffDays <= 7) return `há ${diffDays} dias`
  if (diffDays >= 8 && diffDays <= 30) {
    const sem = Math.max(1, Math.round(diffDays / 7))
    return `há ${sem} ${sem === 1 ? 'semana' : 'semanas'}`
  }
  if (diffDays >= 31 && diffDays <= 365) {
    const mes = Math.max(1, Math.round(diffDays / 30.4375))
    return `há ${mes} ${mes === 1 ? 'mês' : 'meses'}`
  }
  if (diffDays > 365) return formatarDdMmYy(dataEvento)
  if (diffDays < 0) return formatarDdMmYy(dataEvento)
  return ''
}

/** Chip de motivo no rodapé só para setoriais com motivo UF / COMBINADO / SUBSTANCIA. */
function rotuloMotivoRodapeSetorial(matchMotivo: string): string | null {
  const k = String(matchMotivo).trim().toUpperCase()
  if (k === 'UF') return 'UF'
  if (k === 'COMBINADO') return 'Setorial'
  if (k === 'SUBSTANCIA') return 'Substância'
  return null
}

function corBadgeCat(categoria: string): {
  texto: string
  fundo: string
  borda: string
} {
  const c = String(categoria).toUpperCase()
  switch (c) {
    case 'CRITICO':
      return { texto: '#FFEBEE', fundo: 'rgba(229,57,53,0.25)', borda: '#E53935' }
    case 'DESFAVORAVEL':
      return { texto: '#FFF3E0', fundo: 'rgba(239,159,39,0.2)', borda: '#EF9F27' }
    case 'NEUTRO':
      return { texto: '#CCCCCC', fundo: 'rgba(136,136,128,0.2)', borda: '#5F5E5A' }
    case 'POSITIVO':
      return { texto: '#E8F5E9', fundo: 'rgba(129,199,132,0.22)', borda: '#81C784' }
    case 'FAVORAVEL':
      return { texto: '#E8F5E9', fundo: 'rgba(46,125,50,0.28)', borda: '#2E7D32' }
    default:
      return { texto: '#E0E0E0', fundo: 'rgba(136,136,128,0.15)', borda: '#5F5E5A' }
  }
}

function capitalizarPrimeira(texto: string | null | undefined): string {
  if (!texto) return ''
  const t = String(texto).trim()
  if (t === '') return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function linhaTipoInfo(a: AlertaRadar): string {
  const tipoFmt =
    typeof a.tipo_ato === 'string' && a.tipo_ato.trim() !== ''
      ? capitalizarPrimeira(a.tipo_ato.trim())
      : ''
  const p = [tipoFmt, typeof a.numero_ato === 'string' ? a.numero_ato.trim() : '', typeof a.orgao_emissor === 'string' ? a.orgao_emissor.trim() : '']
    .filter((x) => x !== '')
  return p.join(' · ')
}

const BADGE_UNIFICADO_BASE: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '4px 10px',
  borderRadius: 4,
  minHeight: 24,
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

type AlertaCardProps = {
  alerta: AlertaRadar
  secao: 'direto' | 'setorial'
}

function AlertaCard({ alerta, secao }: AlertaCardProps) {
  const [expandido, setExpandido] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const podeExpandir =
    typeof alerta.analise_terradar === 'string' &&
    alerta.analise_terradar.trim() !== ''

  const badges = corBadgeCat(alerta.categoria)
  const urgente =
    Array.isArray(alerta.flags_atencao) &&
    alerta.flags_atencao.some((f) => String(f).toUpperCase() === 'URGENTE')

  const aoExpandir = useCallback(() => {
    setExpandido((v) => !v)
  }, [])

  useLayoutEffect(() => {
    if (!expandido || !rootRef.current) return
    rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [expandido])

  const chipRodape =
    secao === 'setorial'
      ? rotuloMotivoRodapeSetorial(String(alerta.match_motivo ?? ''))
      : null

  const relativa = formatarDataRelativa(alerta.data_evento)

  return (
    <div
      ref={rootRef}
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '14px 12px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        ...(urgente
          ? { borderLeft: '4px solid #F59E0B' }
          : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            ...BADGE_UNIFICADO_BASE,
            color: badges.texto,
            backgroundColor: badges.fundo,
            border: `1px solid ${badges.borda}`,
          }}
        >
          {String(alerta.categoria)}
        </span>
        {relativa ? (
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.2,
              color: '#A1A1AA',
              flexShrink: 0,
            }}
          >
            {relativa}
          </span>
        ) : null}
      </div>
      <p
        style={{
          margin: '10px 0 0 0',
          fontSize: 15,
          fontWeight: 700,
          color: '#F1EFE8',
          lineHeight: 1.35,
        }}
      >
        {alerta.titulo}
      </p>
      <p
        style={{
          margin: '10px 0 0 0',
          fontSize: 13,
          color: '#888780',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {alerta.resumo}
      </p>
      <div
        style={{
          height: 1,
          margin: '14px 0',
          backgroundColor: '#2C2C2A',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px 8px',
          fontSize: 12,
          color: '#5F5E5A',
        }}
      >
        {(() => {
          const linha = linhaTipoInfo(alerta)
          const dataAbs = formatarDdMmYy(alerta.data_evento)
          return (
            <>
              {linha ? <span>{linha}</span> : null}
              {linha && dataAbs !== '-' ? <span aria-hidden>·</span> : null}
              {dataAbs !== '-' ? <span>{dataAbs}</span> : null}
              {chipRodape ? (
                <>
                  <span aria-hidden>·</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#888780',
                      padding: '1px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {chipRodape}
                  </span>
                </>
              ) : null}
            </>
          )
        })()}
      </div>
      {podeExpandir ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void aoExpandir()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 12,
              fontWeight: 600,
              color: '#F1B85A',
            }}
          >
            {expandido ? STR.recolher : STR.verAnalise}
          </button>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {expandido && podeExpandir ? (
          <motion.div
            key="analise"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid #2C2C2A',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#B8821E',
                  marginBottom: 8,
                }}
              >
                {STR.labelAnalise}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#CCCCCC', lineHeight: 1.55 }}>
                {alerta.analise_terradar!.trim()}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function LinhaSecaoTitulo({ titulo, count }: { titulo: string; count: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span
          style={{
            ...SECAO_LABEL_STYLE,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {titulo}
        </span>
        <span style={COUNT_PILL_STYLE} aria-hidden>
          {count}
        </span>
      </div>
      <div
        role="presentation"
        style={{
          borderBottom: '1px solid #2C2C2A',
          marginTop: 8,
        }}
      />
    </div>
  )
}

export function CardAlertasRegulatorios(props: { processoId: string }) {
  const { processoId } = props
  const { data, isLoading, error, refetch } = useAlertasProcesso(processoId ?? null)

  const total = data?.total ?? 0
  const diretos = data?.diretos ?? []
  const setoriais = data?.setoriais ?? []
  const [setoriaisAberto, setSetoriaisAberto] = useState(false)
  const [setoriaisHover, setSetoriaisHover] = useState(false)

  const unicoAlertaSecao =
    diretos.length > 0 ? ('direto' as const) : ('setorial' as const)

  const setoriaisTriggerBgIdle = 'rgba(24, 24, 27, 0.5)'
  const setoriaisTriggerBgHover = 'rgba(39, 39, 42, 0.7)'
  const setoriaisBg =
    setoriaisAberto || setoriaisHover ? setoriaisTriggerBgHover : setoriaisTriggerBgIdle

  return (
    <TooltipProvider delayDuration={200}>
      <div style={SHELL}>
      <p style={ALERTAS_TITULO_STYLE}>{STR.tituloCard}</p>

      {isLoading ? (
        <div aria-busy aria-label={STR.carregando}>
          <div
            style={{
              height: 12,
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginBottom: 10,
              animation: 'pulse 1.25s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 12,
              width: '82%',
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.06)',
              animation: 'pulse 1.25s ease-in-out infinite 0.18s',
            }}
          />
          <p style={{ margin: '14px 0 0', fontSize: 12, color: '#5F5E5A' }}>
            {STR.carregando}
          </p>
          <style>{`@keyframes pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div>
          <p style={{ margin: 0, fontSize: 14, color: '#888780', lineHeight: 1.5 }}>
            {STR.erroCarregar}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              marginTop: 12,
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid rgba(239,159,39,0.45)',
              backgroundColor: 'rgba(239,159,39,0.12)',
              color: '#EF9F27',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {STR.tentarNovamente}
          </button>
        </div>
      ) : null}

      {!isLoading && !error && data ? (
        <>
          {total === 0 ? (
            <p style={{ fontSize: 15, color: '#888780', margin: 0, lineHeight: 1.5 }}>
              {STR.vazio}
            </p>
          ) : null}

          {total === 1 ? (
            <AlertaCard
              alerta={diretos[0] ?? setoriais[0]}
              secao={unicoAlertaSecao}
            />
          ) : null}

          {total >= 2 && diretos.length > 0 && setoriais.length > 0 ? (
            <>
              <LinhaSecaoTitulo titulo={STR.secDiretos} count={diretos.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {diretos.map((a) => (
                  <AlertaCard key={a.id} alerta={a} secao="direto" />
                ))}
              </div>
              <div style={{ marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setSetoriaisAberto((o) => !o)}
                  aria-expanded={setoriaisAberto}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    width: '100%',
                    padding: '12px 16px',
                    marginTop: 10,
                    backgroundColor: setoriaisBg,
                    border: 'none',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setSetoriaisHover(true)}
                  onMouseLeave={() => setSetoriaisHover(false)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flex: '1 1 auto',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        ...SECAO_LABEL_STYLE,
                        textAlign: 'left',
                      }}
                    >
                      {STR.secSetoriais}
                    </span>
                    <IconeAjudaAfetaSegmento textoAjuda={STR.tooltipAfetaSegmento} />
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={COUNT_PILL_STYLE} aria-hidden>
                      {setoriais.length}
                    </span>
                    <motion.span
                      animate={{ rotate: setoriaisAberto ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ display: 'inline-flex' }}
                    >
                      <ChevronDown size={18} color="#888780" aria-hidden />
                    </motion.span>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {setoriaisAberto ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          paddingTop: 12,
                        }}
                      >
                        {setoriais.map((a) => (
                          <AlertaCard key={a.id} alerta={a} secao="setorial" />
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </>
          ) : null}

          {total >= 2 && diretos.length > 0 && setoriais.length === 0 ? (
            <>
              <LinhaSecaoTitulo titulo={STR.secDiretos} count={diretos.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {diretos.map((a) => (
                  <AlertaCard key={a.id} alerta={a} secao="direto" />
                ))}
              </div>
            </>
          ) : null}

          {total >= 2 && diretos.length === 0 && setoriais.length >= 2 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {setoriais.map((a) => (
                <AlertaCard key={a.id} alerta={a} secao="setorial" />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
    </TooltipProvider>
  )
}
