import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type FamiliaEventoCor = {
  cor: string
  label: string
}

const FAMILIA_PAGAMENTO: FamiliaEventoCor = { cor: '#1D9E75', label: 'Pagamento' }
const FAMILIA_APRESENTACAO: FamiliaEventoCor = { cor: '#4A90B8', label: 'Apresentação' }
const FAMILIA_MARCO_TITULO: FamiliaEventoCor = { cor: '#8B7DC4', label: 'Marco do título' }
const FAMILIA_EXIGENCIA: FamiliaEventoCor = { cor: '#E8A830', label: 'Exigência' }
const FAMILIA_ADVERSO: FamiliaEventoCor = { cor: '#E24B4A', label: 'Adverso' }
const FAMILIA_OUTRO: FamiliaEventoCor = { cor: '#5F5E5A', label: 'Outros' }

/**
 * Mapeia categoria SCM/ANM (campo `categoria` da RPC) para a família visual.
 * Categorias não mapeadas caem em FAMILIA_OUTRO.
 * Categoria null/undefined retorna null (renderiza bolinha vazada sem família).
 */
function familiaPorCategoria(cat: string | null | undefined): FamiliaEventoCor | null {
  if (!cat) return null

  if (cat === 'TAH_PAGAMENTO' || cat === 'PAGAMENTO_VISTORIA' || cat === 'MULTA_PAGAMENTO') {
    return FAMILIA_PAGAMENTO
  }

  if (
    cat === 'RAL_APRESENTADO' ||
    cat === 'INICIO_PESQUISA_COMUNICADO' ||
    cat === 'INICIO_LAVRA_COMUNICADO' ||
    cat === 'LICENCA_AMBIENTAL_PROTOC'
  ) {
    return FAMILIA_APRESENTACAO
  }

  if (
    cat === 'ALVARA_OUTORGA' ||
    cat === 'ALVARA_PRORROGACAO' ||
    cat === 'ALVARA_PRORROGACAO_SOLIC' ||
    cat === 'GU_AUTORIZACAO' ||
    cat === 'GU_PRORROGACAO' ||
    cat === 'GU_PRORROGACAO_SOLIC' ||
    cat === 'GU_REQUERIMENTO' ||
    cat === 'REQUERIMENTO_INICIAL' ||
    cat === 'CESSAO_APROVADA' ||
    cat === 'CESSAO_PROTOCOLADA' ||
    cat === 'CESSAO_EFETIVADA' ||
    cat === 'PRORROGACAO_COVID'
  ) {
    return FAMILIA_MARCO_TITULO
  }

  if (
    cat === 'EXIGENCIA' ||
    cat === 'EXIGENCIA_ABERTA' ||
    cat === 'EXIGENCIA_CUMPRIMENTO' ||
    cat === 'CUMPRIMENTO_EXIGENCIA' ||
    cat === 'EXIGENCIA_PRORROGACAO_SOLIC' ||
    cat === 'EXIGENCIA_PRORROGACAO_CONCEDIDA'
  ) {
    return FAMILIA_EXIGENCIA
  }

  if (
    cat === 'AUTO_INFRACAO_PUBL' ||
    cat === 'MULTA_APLICADA' ||
    cat === 'BLOQUEIO_JUDICIAL' ||
    cat === 'DEFESA_NAO_ACEITA' ||
    cat === 'CADUCIDADE' ||
    cat === 'EXTINCAO'
  ) {
    return FAMILIA_ADVERSO
  }

  if (cat === 'NEUTRO' || cat === 'DOCUMENTO_DIVERSO' || cat === 'RECURSO_PROTOC') {
    return FAMILIA_OUTRO
  }

  return FAMILIA_OUTRO
}

/**
 * Formata categoria SCM em texto inline title-case basico (só primeira letra
 * em maiuscula; underscores vira espaco).
 */
function formatarCategoriaInline(cat: string | null | undefined): string {
  if (!cat) return ''
  const limpo = cat.replace(/_/g, ' ').toLowerCase()
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

/**
 * Extrai o ano (string) de uma data ISO. Retorna null se invalida.
 */
function anoDe(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso)
  if (!Number.isNaN(d.getTime())) return String(d.getFullYear())
  const slice = iso.slice(0, 4)
  return /^\d{4}$/.test(slice) ? slice : null
}

const SECTION_TITLE = 'var(--text-section-title)'

const PAGE_INITIAL = 5
const PAGE_INCREMENT = 5

type EventoRow = {
  id: number
  codigo: number | null
  descricao: string | null
  categoria: string | null
  dataEvento: string | null
  observacao: string | null
  publicacaoDou: string | null
}

export type ProcessoEventosTimelineProps = {
  numero: string
  totalEventos?: number | null
  ativoDerivado?: boolean | null
  numeroSei?: string | null
  cadastroDataIso?: string | null
}

function formatDataBr(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Resumo + linha do tempo de eventos SCM (GET /api/processo/eventos, RPC
 * `fn_processo_eventos_list` no backend TERRADAR). Se a chamada falhar, mostra
 * só o resumo numérico e metadados passados pelo drawer.
 */
export function ProcessoEventosTimeline({
  numero,
  totalEventos,
  ativoDerivado,
  numeroSei,
  cadastroDataIso,
}: ProcessoEventosTimelineProps) {
  const [eventos, setEventos] = useState<EventoRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [visiveis, setVisiveis] = useState(PAGE_INITIAL)

  useEffect(() => {
    setLoading(true)
    setVisiveis(PAGE_INITIAL)
    let cancelled = false
    const qs = new URLSearchParams({
      numero: numero.trim(),
      limit: '40',
      offset: '0',
    })
    ;(async () => {
      try {
        const res = await fetch(`/api/processo/eventos?${qs}`)
        if (cancelled) return
        if (!res.ok) {
          setEventos(null)
          return
        }
        const json = (await res.json()) as {
          ok?: boolean
          data?: { eventos?: EventoRow[] }
        }
        if (json.ok && Array.isArray(json.data?.eventos)) {
          setEventos(json.data!.eventos!)
        } else {
          setEventos(null)
        }
      } catch {
        if (!cancelled) setEventos(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [numero])

  const total =
    typeof totalEventos === 'number' && Number.isFinite(totalEventos)
      ? totalEventos
      : null

  const eventosVisiveis =
    eventos != null ? eventos.slice(0, visiveis) : []
  const restantes = eventos != null ? Math.max(0, eventos.length - visiveis) : 0

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: SECTION_TITLE,
          margin: 0,
          marginBottom: 10,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        Eventos (SCM / ANM)
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
          fontSize: 14,
          color: '#D3D1C7',
          lineHeight: 1.45,
        }}
      >
        <span>
          <span style={{ color: '#888780' }}>Total indexado: </span>
          <strong style={{ color: '#F1EFE8' }}>
            {total !== null ? String(total) : '—'}
          </strong>
        </span>
        {numeroSei ? (
          <span>
            <span style={{ color: '#888780' }}>NUP SEI: </span>
            {numeroSei}
          </span>
        ) : null}
        <span>
          <span style={{ color: '#888780' }}>Cadastro (ref.): </span>
          {formatDataBr(cadastroDataIso)}
        </span>
        {ativoDerivado === false ? (
          <span
            style={{
              color: '#9CA3AF',
              fontStyle: 'italic',
            }}
          >
            Processo sem efeitos regulatórios ativos
          </span>
        ) : null}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#888780', margin: 0 }}>
          Carregando eventos...
        </p>
      ) : eventos && eventos.length > 0 ? (
        <>
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: 6,
                bottom: 6,
                width: 1.5,
                background: '#3A3A38',
              }}
              aria-hidden
            />

            {(() => {
              let anoAnterior: string | null = null
              const elementos: ReactNode[] = []

              eventosVisiveis.forEach((ev, i) => {
                const ano = anoDe(ev.dataEvento)

                if (ano && ano !== anoAnterior) {
                  elementos.push(
                    <div
                      key={`ano-${ano}`}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        margin: '12px 0 12px -20px',
                        paddingTop: 4,
                        paddingBottom: 4,
                        background: '#1E1E1C',
                        zIndex: 1,
                      }}
                      aria-hidden
                    >
                      <div style={{ flex: 1, height: 1, background: '#2C2C2A' }} />
                      <span
                        style={{
                          fontSize: 11,
                          color: '#888780',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '0.04em',
                          paddingLeft: 4,
                          paddingRight: 4,
                        }}
                      >
                        {ano}
                      </span>
                      <div style={{ flex: 1, height: 1, background: '#2C2C2A' }} />
                    </div>,
                  )
                  anoAnterior = ano
                }

                const familia = familiaPorCategoria(ev.categoria)
                const categoriaTexto = formatarCategoriaInline(ev.categoria)

                const bolinhaStyle: CSSProperties = familia
                  ? {
                      position: 'absolute',
                      left: -20,
                      top: 11,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: familia.cor,
                    }
                  : {
                      position: 'absolute',
                      left: -20,
                      top: 11,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: '#3A3A38',
                    }

                elementos.push(
                  <div
                    key={ev.id ?? `${ev.dataEvento}-${ev.codigo ?? i}`}
                    style={{ position: 'relative', padding: '6px 0 14px 0' }}
                  >
                    <div
                      style={bolinhaStyle}
                      title={familia ? familia.label : 'Sem categoria'}
                      aria-hidden
                    />

                    <div
                      style={{
                        fontSize: 12,
                        color: '#888780',
                        fontVariantNumeric: 'tabular-nums',
                        marginBottom: 3,
                      }}
                    >
                      {formatDataBr(ev.dataEvento)}
                      {ev.codigo != null ? ` · código ${ev.codigo}` : ''}
                      {categoriaTexto ? (
                        <>
                          {' '}
                          <span style={{ color: '#5F5E5A' }}>·</span>{' '}
                          {categoriaTexto}
                        </>
                      ) : null}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: '#D3D1C7',
                        lineHeight: 1.45,
                        marginBottom: ev.observacao || ev.publicacaoDou ? 4 : 0,
                      }}
                    >
                      {ev.descricao?.trim() || '—'}
                    </div>

                    {ev.observacao ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#888780',
                          fontStyle: 'italic',
                          lineHeight: 1.45,
                          marginBottom: ev.publicacaoDou ? 8 : 0,
                        }}
                      >
                        {ev.observacao}
                      </div>
                    ) : null}

                    {ev.publicacaoDou ? (
                      <div
                        style={{
                          marginLeft: 12,
                          paddingLeft: 12,
                          borderLeft: '2px solid #2C2C2A',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: '#888780',
                            lineHeight: 1.5,
                          }}
                        >
                          {ev.publicacaoDou}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: '#5F5E5A',
                            marginTop: 5,
                            letterSpacing: '0.04em',
                          }}
                        >
                          DOU
                        </div>
                      </div>
                    ) : null}
                  </div>,
                )
              })

              return elementos
            })()}
          </div>

          {restantes > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid #2C2C2A',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setVisiveis((v) => v + PAGE_INCREMENT)}
                style={{
                  background: 'transparent',
                  border: '1px solid #2C2C2A',
                  color: '#D3D1C7',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Carregar mais {Math.min(PAGE_INCREMENT, restantes)}
              </button>
              <span style={{ fontSize: 11, color: '#5F5E5A' }}>
                {restantes} restantes
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <p
          style={{ fontSize: 13, color: '#888780', margin: 0, lineHeight: 1.5 }}
        >
          {total !== null && total > 0
            ? 'Eventos indexados, mas nao foi possivel carrega-los agora. Tente recarregar a pagina.'
            : 'Nenhum evento indexado para este processo.'}
        </p>
      )}
    </div>
  )
}
