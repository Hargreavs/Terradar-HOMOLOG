import { Loader2, Satellite, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, startTransition } from 'react'
import { createPortal } from 'react-dom'
import { gerarUrlSateliteParaProcesso } from '../../lib/satelliteStaticUrl'
import type { Processo } from '../../types'

type FaseModal = 'idle' | 'sem_geom' | 'carregando' | 'ok' | 'erro'

const OVERLAY_Z = 2147483640 as const

function formatarDataHoraFooter(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function ImagemSateliteModal({
  processo,
  aberto,
  onFechar,
}: {
  processo: Processo
  aberto: boolean
  onFechar: () => void
}) {
  const titleId = useId()
  const [fase, setFase] = useState<FaseModal>('idle')
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [footerLinha, setFooterLinha] = useState<string>(
    'Imagem: Mapbox Satellite · Carregando imagem...',
  )
  const tentativaRef = useRef(0)

  const iniciarCarregamento = useCallback(() => {
    tentativaRef.current += 1
    const bust = String(tentativaRef.current)
    const url = gerarUrlSateliteParaProcesso(processo, { cacheBust: bust })
    if (url == null) {
      setFase('sem_geom')
      setImgUrl(null)
      setFooterLinha('Imagem: Mapbox Satellite')
      return
    }
    setFase('carregando')
    setImgUrl(url)
    setFooterLinha('Imagem: Mapbox Satellite · Carregando imagem...')
  }, [processo])

  useEffect(() => {
    if (!aberto) return
    startTransition(() => {
      iniciarCarregamento()
    })
  }, [aberto, iniciarCarregamento])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFechar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, onFechar])

  if (!aberto || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: OVERLAY_Z,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          position: 'relative',
          maxWidth: 'min(96vw, 1100px)',
          maxHeight: '90vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#111110',
          borderRadius: 10,
          border: '1px solid #2C2C2A',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid #2C2C2A',
            flexShrink: 0,
          }}
        >
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: '#F1EFE8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Satellite size={18} aria-hidden />
            Imagem por satélite · {processo.numero}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{
              fontSize: 22,
              lineHeight: 1,
              color: '#888780',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1EFE8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888780'
            }}
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0D0D0C',
            position: 'relative',
          }}
        >
          {fase === 'sem_geom' ? (
            <p
              style={{
                margin: 24,
                fontSize: 15,
                color: '#B4B2A9',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Este processo não tem polígono cadastrado.
            </p>
          ) : null}

          {fase === 'erro' ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                maxWidth: 360,
              }}
            >
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 15,
                  color: '#D3D1C7',
                  lineHeight: 1.5,
                }}
              >
                Não foi possível carregar a imagem agora. Tente novamente em
                alguns instantes.
              </p>
              <button
                type="button"
                onClick={iniciarCarregamento}
                className="cursor-pointer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 36,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #5F5E5A',
                  backgroundColor: 'transparent',
                  color: '#F1EFE8',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Tentar de novo
              </button>
            </div>
          ) : null}

          {(fase === 'carregando' || fase === 'ok') && imgUrl ? (
            <>
              {fase === 'carregando' ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(13, 13, 12, 0.6)',
                    zIndex: 1,
                  }}
                >
                  <Loader2
                    size={40}
                    color="#D4A843"
                    style={{ animation: 'terraeSpin 0.9s linear infinite' }}
                    aria-label="Carregando"
                  />
                </div>
              ) : null}
              <img
                src={imgUrl}
                alt={`Satélite do processo ${processo.numero}`}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 'min(72vh, 820px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                }}
                onLoad={() => {
                  setFase('ok')
                  setFooterLinha(
                    `Imagem: Mapbox Satellite · gerada em ${formatarDataHoraFooter(new Date())}`,
                  )
                }}
                onError={() => {
                  setFase('erro')
                  setFooterLinha('Imagem: Mapbox Satellite')
                }}
              />
            </>
          ) : null}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #2C2C2A',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: '#5F5E5A',
              textAlign: 'center',
              lineHeight: 1.45,
            }}
          >
            {footerLinha}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
