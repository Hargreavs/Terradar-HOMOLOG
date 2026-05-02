import { Loader2, Satellite, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useState,
  startTransition,
} from 'react'
import { createPortal } from 'react-dom'
import {
  buscarImagemSateliteProcesso,
  montarFooter,
} from '../../lib/satelliteSentinel'
import type { Processo } from '../../types'
import { PolygonOverlaySvg } from './PolygonOverlaySvg'

type FaseModal =
  | 'idle'
  | 'sem_geom'
  | 'carregando'
  | 'ok'
  | 'erro_generico'
  | 'erro_rate'
  | 'erro_sem_imagem'

const OVERLAY_Z = 2147483640 as const

function geometriaOverlay(
  p: Processo,
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const g = p.geojson?.geometry as
    | GeoJSON.Polygon
    | GeoJSON.MultiPolygon
    | undefined
    | null
  if (!g) return null
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return null
  return g
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
  const [footerLinha, setFooterLinha] = useState('')
  const [bboxUsado, setBboxUsado] = useState<
    [number, number, number, number] | null
  >(null)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)

  const geomOverlay = geometriaOverlay(processo)

  const iniciarCarregamento = useCallback(async () => {
    if (!geomOverlay) {
      setFase('sem_geom')
      setImgUrl(null)
      setFooterLinha('')
      return
    }
    setFase('carregando')
    setImgUrl(null)
    setBboxUsado(null)
    setImgW(0)
    setImgH(0)
    setFooterLinha('A carregar imagem…')

    const r = await buscarImagemSateliteProcesso(processo.id)
    if (!r.ok) {
      setFooterLinha('')
      if (r.error === 'sem_geom') {
        setFase('sem_geom')
        return
      }
      if (r.error === 'sem_imagem_disponivel') {
        setFase('erro_sem_imagem')
        return
      }
      if (r.error === 'rate_limit') {
        setFase('erro_rate')
        return
      }
      setFase('erro_generico')
      return
    }

    setBboxUsado(r.bbox_usado)
    setImgW(r.imagem_largura)
    setImgH(r.imagem_altura)
    setFooterLinha(montarFooter(r))
    setImgUrl(r.url)
  }, [geomOverlay, processo.id])

  useEffect(() => {
    if (!aberto) {
      startTransition(() => {
        setFase('idle')
        setImgUrl(null)
        setFooterLinha('')
        setBboxUsado(null)
        setImgW(0)
        setImgH(0)
      })
      return
    }
    startTransition(() => {
      void iniciarCarregamento()
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

  const mostrarOverlaySvg =
    fase === 'ok' &&
    geomOverlay &&
    bboxUsado &&
    imgW > 0 &&
    imgH > 0

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

          {fase === 'erro_sem_imagem' ? (
            <p
              style={{
                margin: 24,
                fontSize: 15,
                color: '#D3D1C7',
                textAlign: 'center',
                lineHeight: 1.5,
                maxWidth: 420,
              }}
            >
              Não há imagem de satélite disponível com cobertura de nuvem
              aceitável nos últimos 90 dias para esta região. Tente novamente em
              alguns dias.
            </p>
          ) : null}

          {fase === 'erro_rate' ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                maxWidth: 400,
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
                Limite temporário do serviço de imagens atingido. Tente
                novamente em alguns minutos.
              </p>
              <button
                type="button"
                onClick={() => {
                  void iniciarCarregamento()
                }}
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

          {fase === 'erro_generico' ? (
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
                onClick={() => {
                  void iniciarCarregamento()
                }}
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
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '100%',
                lineHeight: 0,
              }}
            >
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
                alt={`Imagem de satélite do processo ${processo.numero}`}
                width={imgW || undefined}
                height={imgH || undefined}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  verticalAlign: 'top',
                }}
                onLoad={() => {
                  setFase('ok')
                }}
                onError={() => {
                  setFase('erro_generico')
                  setFooterLinha('')
                }}
              />
              {mostrarOverlaySvg ? (
                <PolygonOverlaySvg
                  geometry={geomOverlay}
                  bbox_usado={bboxUsado}
                  imagem_largura={imgW}
                  imagem_altura={imgH}
                />
              ) : null}
            </div>
          ) : null}

          {fase === 'carregando' && !imgUrl ? (
            <Loader2
              size={40}
              color="#D4A843"
              style={{ animation: 'terraeSpin 0.9s linear infinite' }}
              aria-label="Carregando"
            />
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
            {footerLinha || '\u00A0'}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
