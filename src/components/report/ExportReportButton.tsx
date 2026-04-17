import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TerraeLogoLoading } from '../dashboard/animations/TerraeLogoLoading'
import type { ReportLang } from '../../lib/reportLang'
import { callGenerateReportAPI } from '../../lib/reportApi'
import { buildReportData } from './reportDataBuilder'
import { buildReportHTML } from './ReportTemplate'
import { captureProcessoMapView } from '../../lib/mapSnapshot'
import { mapInstanceRef } from '../../lib/mapInstanceRef'
import { useMapStore } from '../../store/useMapStore'

type ExportState =
  | 'idle'
  | 'escolhendo-idioma'
  | 'coletando'
  | 'gerando'
  | 'montando'
  | 'pronto'
  | 'erro'

const FS = { md: 14 } as const

export function ExportReportButton({
  numeroProcesso,
}: {
  numeroProcesso: string
}) {
  const [state, setState] = useState<ExportState>('idle')
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const runExport = useCallback(async (lang: ReportLang) => {
    setErroMsg(null)

    try {
      // 1. Coletar dados
      setState('coletando')

      // 1a. (Fase 2) Tentar capturar snapshot do mapa ANTES de buildReportData.
      // Se qualquer etapa falhar (mapa não montado, processo sem geom,
      // toDataURL bloqueado, RPC de linhas territoriais offline), degrada
      // graciosamente: PDF sai sem mapa (mesmo comportamento anterior).
      let mapBase64: string | undefined
      try {
        const map = mapInstanceRef.current
        const processo = useMapStore.getState().processoSelecionado

        if (map && processo && processo.geojson?.geometry) {
          // Garante que o processo alvo do export é o focado no store.
          // Isso dispara o effect de linhas territoriais em MapView.
          if (processo.numero !== numeroProcesso) {
            console.warn(
              '[ExportReportButton] processoSelecionado.numero difere de numeroProcesso; pulando captura de mapa',
            )
          } else {
            // Tempo pra flyTo + fetch de linhas + highlights estabilizarem
            // antes do fitBounds da captura. Conservador: flyTo ~1s +
            // linhas fade-in ~300ms + margem.
            await new Promise((r) => setTimeout(r, 2500))

            const snapshot = await captureProcessoMapView(
              numeroProcesso,
              map,
              processo.geojson.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
            )
            if (snapshot) {
              mapBase64 = snapshot.base64
            }
          }
        }
      } catch (snapErr) {
        console.error('[ExportReportButton] Falha na captura do mapa (seguindo sem mapa):', snapErr)
        mapBase64 = undefined
      }

      const reportData = await buildReportData(numeroProcesso, lang, mapBase64)

      // 2. Chamar API (4-7s)
      setState('gerando')
      const llmBlocks = await callGenerateReportAPI(reportData)

      // 3. Montar HTML (mesmo bundle/Vite que o app: buildReportHTML importa reportPages
      // diretamente; o iframe só exibe a string, não carrega outro JS nem outro HMR.)
      setState('montando')
      const html = buildReportHTML(reportData, llmBlocks, lang)

      // 4. Escrever HTML no iframe invisível
      const iframe = iframeRef.current
      if (!iframe) {
        throw new Error('Iframe de impressão não encontrado')
      }

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) {
        throw new Error('Não foi possível acessar o documento do iframe')
      }

      iframeDoc.open()
      iframeDoc.write(html)
      iframeDoc.close()

      // 5. Aguardar fontes carregarem no iframe
      await new Promise<void>((resolve) => setTimeout(resolve, 1500))

      // 6. Disparar impressão
      setState('pronto')

      if (iframe.contentWindow) {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      }

      // 7. Resetar após 3s
      setTimeout(() => setState('idle'), 3000)

    } catch (error) {
      console.error(error)
      setState('erro')
      setErroMsg(error instanceof Error ? error.message : 'Erro na geração.')
      setTimeout(() => setState('idle'), 5000)
    }
  }, [numeroProcesso])

  const isProcessing =
    state === 'coletando' || state === 'gerando' || state === 'montando'

  const OVERLAY_Z = 2147483647 as const

  const statusLinha =
    state === 'coletando'
      ? 'Coletando dados do processo...'
      : state === 'gerando'
        ? 'Gerando análise via inteligência artificial...'
        : state === 'montando'
          ? 'Montando relatório premium...'
          : ''

  const overlay =
    isProcessing &&
    createPortal(
      <div
        role="alertdialog"
        aria-busy="true"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: OVERLAY_Z,
          margin: 0,
          padding: 24,
          boxSizing: 'border-box',
          background: 'rgba(13, 13, 12, 0.96)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* Logo animado */}
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TerraeLogoLoading size={56} speed={1} />
        </div>

        {/* Texto de estado */}
        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.85)',
            letterSpacing: '0.5px',
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.45,
          }}
        >
          {statusLinha}
        </div>

        {/* Subtexto */}
        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.35)',
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.4,
          }}
        >
          O diálogo de impressão abrirá automaticamente
        </div>
      </div>,
      document.body,
    )

  return (
    <>
      {/* Iframe invisível para impressão */}
      <iframe
        ref={iframeRef}
        title="TERRADAR Relatório Print"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '210mm',
          height: '297mm',
          border: 'none',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />

      {/* Botão */}
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setErroMsg(null)
            setState('escolhendo-idioma')
          }}
          disabled={isProcessing || state === 'escolhendo-idioma'}
          className="cursor-pointer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxSizing: 'border-box',
            minHeight: 28,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: isProcessing ? '#3A3A38' : '#5F5E5A',
            borderRadius: 6,
            padding: '4px 12px',
            backgroundColor: 'transparent',
            fontSize: FS.md,
            fontWeight: 400,
            color: isProcessing ? '#5F5E5A' : '#B4B2A9',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (isProcessing) return
            e.currentTarget.style.color = '#F1EFE8'
            e.currentTarget.style.borderColor = '#888780'
            e.currentTarget.style.backgroundColor = 'rgba(241, 239, 232, 0.08)'
          }}
          onMouseLeave={(e) => {
            if (isProcessing) return
            e.currentTarget.style.color = '#B4B2A9'
            e.currentTarget.style.borderColor = '#5F5E5A'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          {isProcessing && (
            <Loader2
              size={16}
              aria-hidden
              style={{ animation: 'terraeSpin 0.9s linear infinite' }}
            />
          )}
          {state === 'idle' && 'Exportar Relatório PDF'}
          {state === 'escolhendo-idioma' && 'Escolha o idioma…'}
          {state === 'coletando' && 'Coletando dados...'}
          {state === 'gerando' && 'Gerando análise via IA...'}
          {state === 'montando' && 'Montando relatório...'}
          {state === 'pronto' && '✓ Relatório gerado'}
          {state === 'erro' && 'Erro. Tente novamente.'}
        </button>

        {state === 'gerando' && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da geração"
            style={{
              width: 120,
              height: 4,
              borderRadius: 2,
              background: '#2C2C2A',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '40%',
                height: '100%',
                background: 'linear-gradient(90deg, #0F7A5A, #D4A843)',
                borderRadius: 2,
                animation: 'terraeReportIndet 1.2s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {erroMsg && (
          <span
            style={{
              fontSize: 12,
              color: '#E8A830',
              maxWidth: 220,
              textAlign: 'right',
            }}
          >
            {erroMsg}
          </span>
        )}

        <style>{`
          @keyframes terraeSpin { to { transform: rotate(360deg); } }
          @keyframes terraeReportIndet {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}</style>
      </div>

      {overlay}

      {state === 'escolhendo-idioma' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-lang-title"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: OVERLAY_Z,
              margin: 0,
              padding: 24,
              boxSizing: 'border-box',
              background: 'rgba(13, 13, 12, 0.96)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <div
              id="export-lang-title"
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 18,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.92)',
                textAlign: 'center',
              }}
            >
              Idioma do relatório
            </div>
            <div
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.45)',
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              O texto analítico (IA) seguirá o idioma escolhido. Números e scores
              vêm dos dados auditados.
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => void runExport('pt')}
                style={{
                  minWidth: 160,
                  minHeight: 48,
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: '1px solid #5F5E5A',
                  background: 'rgba(241, 239, 232, 0.08)',
                  color: '#F1EFE8',
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Português
              </button>
              <button
                type="button"
                onClick={() => void runExport('en')}
                style={{
                  minWidth: 160,
                  minHeight: 48,
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: '1px solid #5F5E5A',
                  background: 'rgba(241, 239, 232, 0.08)',
                  color: '#F1EFE8',
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                English
              </button>
            </div>
            <button
              type="button"
              onClick={() => setState('idle')}
              style={{
                marginTop: 8,
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              Cancelar
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
