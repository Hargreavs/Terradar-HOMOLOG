# Exportar PDF: overlay de loading (código para análise)

Documento gerado a partir do repositório para revisão do fluxo **Exportar Relatório PDF** no mapa (drawer `RelatorioCompleto`). Ficheiros relevantes: `ExportReportButton.tsx`, `TerraeLogoLoading.tsx`.

---

## Contexto rápido

- O botão é renderizado em `RelatorioCompleto.tsx` (`<ExportReportButton processoId={processo.id} />`).
- Só é mostrado quando `processoId === 'p_864231'` (o componente devolve `null` noutros casos).
- O overlay usa `createPortal(..., document.body)` com `z-index` muito alto.
- A animação `@keyframes terraeSpin` está definida num `<style>` **no mesmo fragmento** que o botão (linhas ~290–296). O `Loader2` **dentro do portal** referencia `animation: 'terraeSpin ...'`; o keyframes tem de existir no documento (o bloco `<style>` fica no DOM enquanto o componente está montado).

---

## 1. `src/components/report/ExportReportButton.tsx` (completo)

```tsx
import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { TerraeLogoLoading } from '../dashboard/animations/TerraeLogoLoading'
import { callGenerateReportAPI } from '../../lib/reportApi'
import { buildReportData } from './reportDataBuilder'
import { buildReportHTML } from './ReportTemplate'

type ExportState =
  | 'idle'
  | 'coletando'
  | 'gerando'
  | 'montando'
  | 'pronto'
  | 'erro'

/** Mesma escala mínima do drawer (`RelatorioCompleto` FS). */
const FS = { md: 14 } as const

export function ExportReportButton({ processoId }: { processoId: string }) {
  const [state, setState] = useState<ExportState>('idle')
  const [erroMsg, setErroMsg] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    setErroMsg(null)

    const win = window.open('', '_blank')
    if (!win) {
      setState('erro')
      setErroMsg('Pop-up bloqueado. Permita nova aba para o relatório.')
      setTimeout(() => setState('idle'), 5000)
      return
    }

    win.document.write(`<!DOCTYPE html><html><head>
      <title>TERRADAR - Gerando...</title>
      <style>body{margin:0;background:#0D0D0C;}</style>
      </head><body></body></html>`)
    win.document.close()

    win.blur()
    window.focus()

    try {
      setState('coletando')
      const reportData = buildReportData(processoId)

      setState('gerando')
      const llmBlocks = await callGenerateReportAPI(reportData)

      setState('montando')
      const html = buildReportHTML(reportData, llmBlocks)

      win.document.open()
      win.document.write(html)
      win.document.close()

      await new Promise<void>((resolve) => setTimeout(resolve, 1500))

      setState('pronto')
      win.focus()
      win.print()

      setTimeout(() => setState('idle'), 3000)
    } catch (error) {
      console.error(error)
      win.close()
      setState('erro')
      setErroMsg(error instanceof Error ? error.message : 'Erro na geração.')
      setTimeout(() => setState('idle'), 5000)
    }
  }, [processoId])

  if (processoId !== 'p_864231') {
    return null
  }

  const isProcessing =
    state !== 'idle' && state !== 'pronto' && state !== 'erro'

  const busy =
    state === 'coletando' || state === 'gerando' || state === 'montando'

  /** Acima de mapa/canvas e de outros overlays do app. */
  const OVERLAY_Z = 2147483647 as const

  const statusLinha =
    state === 'coletando'
      ? 'Coletando dados do processo...'
      : state === 'gerando'
        ? 'Gerando análise via inteligência artificial...'
        : state === 'montando'
          ? 'Montando relatório premium...'
          : 'Gerando relatório PDF...'

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
          width: '100vw',
          minHeight: '100vh',
          zIndex: OVERLAY_Z,
          margin: 0,
          padding: 24,
          boxSizing: 'border-box',
          background: 'rgba(13, 13, 12, 0.92)',
          WebkitBackdropFilter: 'blur(4px)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          isolation: 'isolate',
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#D4A843',
            letterSpacing: 6,
            textTransform: 'uppercase',
            lineHeight: 1.2,
          }}
        >
          TERRADAR
        </div>

        <Loader2
          size={44}
          aria-hidden
          strokeWidth={2}
          style={{
            flexShrink: 0,
            color: '#D4A843',
            animation: 'terraeSpin 0.9s linear infinite',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TerraeLogoLoading size={40} speed={1} />
        </div>

        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.85)',
            letterSpacing: '0.5px',
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.45,
          }}
        >
          {statusLinha}
        </div>

        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: '11px',
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
          onClick={() => void handleExport()}
          disabled={isProcessing}
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
            borderColor: busy ? '#3A3A38' : '#5F5E5A',
            borderRadius: 6,
            padding: '4px 12px',
            backgroundColor: 'transparent',
            fontSize: FS.md,
            fontWeight: 400,
            color: busy ? '#5F5E5A' : '#B4B2A9',
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
          {state === 'coletando' || state === 'montando' ? (
            <Loader2
              size={16}
              aria-hidden
              style={{ animation: 'terraeSpin 0.9s linear infinite' }}
            />
          ) : null}
          {state === 'idle' && 'Exportar Relatório PDF'}
          {state === 'coletando' && 'Coletando dados...'}
          {state === 'gerando' && 'Gerando análise via IA...'}
          {state === 'montando' && 'Montando relatório...'}
          {state === 'pronto' && '✓ Relatório gerado'}
          {state === 'erro' && 'Erro. Tente novamente.'}
        </button>
        {state === 'gerando' ? (
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
        ) : null}
        {erroMsg ? (
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
        ) : null}
        <style>{`
          @keyframes terraeSpin { to { transform: rotate(360deg); } }
          @keyframes terraeReportIndet {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}</style>
      </div>
      {overlay}
    </>
  )
}
```

---

## 2. `src/components/dashboard/animations/TerraeLogoLoading.tsx` (completo)

Usado no overlay e noutros sítios (ex.: Radar / prospecção).

```tsx
import { useState, useEffect, useRef, useId } from 'react'

/**
 * TerraeLogo breathing/wave loading animation.
 * 4 bars that do a sequential vertical wave (staggered), like a calm equalizer.
 * Uses the exact Terrae brand gradient colors from the logo.
 *
 * IDs dos gradientes são únicos por instância (`useId`); senão, com vários SVGs na
 * página, `fill: url(#terraeLoadGrad0)` resolve para o primeiro &lt;defs&gt; do documento
 * e as barras podem ficar invisíveis.
 */
export function TerraeLogoLoading({ size = 48, speed = 1 }: { size?: number; speed?: number }) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '_')
  const gradId = (i: number) => `terraeLoadGrad_${instanceId}_${i}`

  const [elapsed, setElapsed] = useState(0)
  const raf = useRef<number | null>(null)
  const t0 = useRef<number | null>(null)

  useEffect(() => {
    const tick = (ts: number) => {
      if (t0.current == null) t0.current = ts
      setElapsed((ts - t0.current) / 1000)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const bars = [
    { color: '#F0B245', gradEnd: '#E8A830' },
    { color: '#D4952A', gradEnd: '#C48825' },
    { color: '#B07A1F', gradEnd: '#9A6B1A' },
    { color: '#8B6118', gradEnd: '#705012' },
  ]

  const barCount = bars.length
  const barHeight = size / (barCount * 2 - 1)
  const barGap = barHeight
  const barWidth = size * 1.1
  const barRadius = barHeight * 0.2

  const waveFreq = 1.8 * speed
  const waveAmplitude = barHeight * 0.15
  const staggerDelay = 0.15

  return (
    <svg
      width={barWidth}
      height={size}
      viewBox={`0 0 ${barWidth} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {bars.map((bar, i) => (
          <linearGradient key={`grad-${i}`} id={gradId(i)} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={bar.color} />
            <stop offset="100%" stopColor={bar.gradEnd} />
          </linearGradient>
        ))}
      </defs>

      {bars.map((_, i) => {
        const phase = elapsed * waveFreq - i * staggerDelay * waveFreq
        const wave = Math.sin(phase * Math.PI * 2)
        const displacement = wave > 0 ? -wave * waveAmplitude : 0

        const opacityBoost = wave > 0 ? wave * 0.15 : 0
        const opacity = 0.85 + opacityBoost

        const scaleX = 1 + (wave > 0 ? wave * 0.02 : 0)

        const baseY = i * (barHeight + barGap)
        const y = baseY + displacement

        return (
          <rect
            key={i}
            x={(barWidth - barWidth * scaleX) / 2}
            y={y}
            width={barWidth * scaleX}
            height={barHeight}
            rx={barRadius}
            ry={barRadius}
            fill={`url(#${gradId(i)})`}
            opacity={opacity}
          />
        )
      })}
    </svg>
  )
}
```

---

## 3. Pontos úteis para depuração

| Tema | Detalhe |
|------|--------|
| Estados com overlay | `isProcessing` = `coletando` \| `gerando` \| `montando` (não inclui `pronto` nem `erro`). |
| Portal | `document.body`; conteúdo do overlay é irmão de `#root` no DOM. |
| `terraeSpin` | Definido no `<style>` **dentro** do fragmento do botão; o overlay no portal depende deste bloco estar montado. |
| `TerraeLogoLoading` | Gradiente SVG com IDs por `useId`; animação por `requestAnimationFrame`. |

---

*Última cópia alinhada ao repositório na data de geração deste ficheiro.*
