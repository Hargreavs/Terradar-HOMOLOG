import type { CSSProperties } from 'react'
import type { Processo } from '../../types'

const BADGE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.2,
  flexShrink: 0,
}

/**
 * Pills regulatórias compactas na faixa do drawer (junto ao RegimeBadge).
 */
export function DrawerRegulatoryBadges({ processo }: { processo: Processo }) {
  const out: { key: string; label: string; style: CSSProperties }[] = []

  if (processo.is_mineral_estrategico) {
    out.push({
      key: 'me',
      label: 'ME',
      style: {
        ...BADGE,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: '#93C5FD',
      },
    })
  }
  if (processo.exigencia_pendente) {
    out.push({
      key: 'exig',
      label: 'Exigência',
      style: {
        ...BADGE,
        backgroundColor: 'rgba(239, 159, 39, 0.18)',
        color: '#FDBA74',
      },
    })
  }
  if (processo.situacao === 'bloqueado') {
    out.push({
      key: 'bloq',
      label: 'Bloqueado',
      style: {
        ...BADGE,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#FCA5A5',
      },
    })
  }
  if (processo.dados_insuficientes) {
    out.push({
      key: 'di',
      label: 'Dados insuficientes',
      style: {
        ...BADGE,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        color: '#F87171',
      },
    })
  }

  if (out.length === 0) return null

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
      }}
    >
      {out.map((b) => (
        <span key={b.key} style={b.style} title={b.label}>
          {b.label}
        </span>
      ))}
    </div>
  )
}
