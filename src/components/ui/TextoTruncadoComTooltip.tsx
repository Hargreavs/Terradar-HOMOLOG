import { useRef, type CSSProperties } from 'react'
import {
  TerraSideTooltipPortal,
  useTerraSideTooltip,
  type TerraTooltipPlacement,
} from './TerraSideTooltip'

type TextoTruncadoComTooltipProps = {
  text: string
  /** Tooltip com detalhe (ex.: nome + tipo por extenso). Abre se diferente de `text` ou se houver truncagem. */
  textoTooltip?: string
  className?: string
  style?: CSSProperties
  /** Padrão do projeto: `above` (evita sobrepor colunas vizinhas). */
  placement?: TerraTooltipPlacement
}

function estaTruncado(el: HTMLElement | null): boolean {
  if (!el) return false
  return el.scrollWidth > el.clientWidth + 1
}

/**
 * Uma linha: reticências quando não cabe; tooltip com texto completo (padrão Terrae)
 * apenas ao hover **se** houver truncagem (`scrollWidth > clientWidth`).
 */
export function TextoTruncadoComTooltip({
  text,
  textoTooltip,
  className,
  style,
  placement = 'above',
}: TextoTruncadoComTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { show, onTriggerPointerLeave, open, visible, pos } = useTerraSideTooltip(
    ref,
    {
      placement,
    },
  )

  const bubbleText = textoTooltip ?? text

  const onEnter = () => {
    if (textoTooltip != null && textoTooltip !== '') {
      if (textoTooltip !== text || estaTruncado(ref.current)) {
        show()
        return
      }
    }
    if (estaTruncado(ref.current)) show()
  }

  const onLeave = () => {
    onTriggerPointerLeave()
  }

  if (!text) {
    return null
  }

  return (
    <>
      <div
        ref={ref}
        className={className}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          ...style,
        }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {text}
      </div>
      <TerraSideTooltipPortal
        texto={bubbleText}
        open={open}
        visible={visible}
        pos={pos}
      />
    </>
  )
}
