import { useEffect, useState } from 'react'

const SECTION_TITLE = 'var(--text-section-title)'

type EventoRow = {
  data_evento: string
  evento_codigo: number | null
  evento_descricao: string | null
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
 * Resumo + linha do tempo de eventos SCM quando `GET /api/processo/eventos` existir;
 * caso contrário, mostra só o resumo numérico e metadados passados pelo drawer.
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

  useEffect(() => {
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
          Carregando eventos…
        </p>
      ) : eventos && eventos.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {eventos.map((ev, i) => (
            <li
              key={`${ev.data_evento}-${ev.evento_codigo ?? i}`}
              style={{
                paddingBottom: 10,
                borderBottom:
                  i < eventos.length - 1 ? '1px solid #2C2C2A' : undefined,
              }}
            >
              <div style={{ fontSize: 12, color: '#888780', marginBottom: 4 }}>
                {formatDataBr(ev.data_evento)}
                {ev.evento_codigo != null ? ` · código ${ev.evento_codigo}` : ''}
              </div>
              <div style={{ fontSize: 14, color: '#D3D1C7', lineHeight: 1.45 }}>
                {ev.evento_descricao?.trim() || '—'}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13, color: '#888780', margin: 0, lineHeight: 1.5 }}>
          {total !== null && total > 0
            ? 'Lista detalhada de eventos não está disponível (rota /api/processo/eventos).'
            : 'Nenhum evento indexado para este processo.'}
        </p>
      )}
    </div>
  )
}
