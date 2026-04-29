import type { CSSProperties } from 'react'
import { RiskCalibrationAnimation } from './animations/RiskCalibrationAnimation'
import { RegionFocusAnimation } from './animations/RegionFocusAnimation'

export function ProspeccaoAnimations({
  currentStep,
  visible,
  reducedMotion,
  exiting = false,
}: {
  currentStep: 1 | 2
  visible: boolean
  reducedMotion: boolean
  exiting?: boolean
}) {
  const animContainerStyle: CSSProperties = reducedMotion
    ? { opacity: exiting ? 0 : 1, transition: exiting ? 'opacity 300ms ease-in' : undefined }
    : {
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: exiting ? 'opacity 300ms ease-in' : 'opacity 200ms ease',
      }

  return (
    <div
      style={{
        flex: '0 0 50%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0 0 8px 0',
        minHeight: 0,
        backgroundColor: '#0D0D0C',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          ...animContainerStyle,
          position: 'relative',
          width: '100%',
          height: '100%',
          flex: 1,
          minHeight: 0,
        }}
      >
        {currentStep === 1 ? <RiskCalibrationAnimation /> : null}
        {currentStep === 2 ? <RegionFocusAnimation /> : null}
      </div>
    </div>
  )
}
