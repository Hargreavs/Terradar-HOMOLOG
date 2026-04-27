import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, MapPin, Scale, Shield, TrendingUp } from 'lucide-react'
import { UFS_BRASIL } from '../../lib/radar/ufs'
import { ProspeccaoAnimations } from './ProspeccaoAnimations'
import { ObjetivoCard, RiscoCard } from './ProspeccaoCards'
import type { ObjetivoProspeccao, PerfilRisco } from '../../lib/opportunityScore'

const STEP_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Qual seu objetivo com esta prospecção?',
  2: 'Qual seu apetite de risco?',
  3: 'Preferência geográfica',
}

const STEP_SUBTEXTS: Record<1 | 2 | 3, string> = {
  1: 'Escolha o que melhor descreve sua busca.',
  2: 'Isso ajusta os pesos da Pontuação de Oportunidade.',
  3: 'Opcional. Deixe em branco para analisar todo o Brasil.',
}

const navGhostButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  fontSize: 15,
  color: '#F1EFE8',
  cursor: 'pointer',
  fontWeight: 400,
}

export function ProspeccaoWizard({
  reducedMotion,
  proObjetivo,
  setProObjetivo,
  proRisco,
  setProRisco,
  proUfs,
  setProUfs,
  onCancel,
  onAnalisar,
  exiting = false,
  initialStep,
}: {
  reducedMotion: boolean
  proObjetivo: ObjetivoProspeccao | null
  setProObjetivo: (o: ObjetivoProspeccao | null) => void
  proRisco: PerfilRisco | null
  setProRisco: (r: PerfilRisco | null) => void
  proUfs: string[]
  setProUfs: (u: string[]) => void
  onCancel: () => void
  onAnalisar: () => void
  exiting?: boolean
  initialStep?: 1 | 2 | 3
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(() => initialStep ?? 1)
  const [stepContentVisible, setStepContentVisible] = useState(true)
  const [animationVisible, setAnimationVisible] = useState(true)
  const [animationStep, setAnimationStep] = useState<1 | 2 | 3>(() => initialStep ?? 1)

  const stepValido = useMemo(() => {
    switch (currentStep) {
      case 1:
        return proObjetivo != null
      case 2:
        return proRisco != null
      case 3:
        return true
      default:
        return false
    }
  }, [currentStep, proObjetivo, proRisco])

  const changeStep = useCallback(
    (newStep: number) => {
      const ns = newStep as 1 | 2 | 3
      if (reducedMotion) {
        setCurrentStep(ns)
        setAnimationStep(ns)
        return
      }
      setStepContentVisible(false)
      setAnimationVisible(false)
      window.setTimeout(() => {
        setCurrentStep(ns)
        setAnimationStep(ns)
        window.setTimeout(() => {
          setStepContentVisible(true)
          setAnimationVisible(true)
        }, 50)
      }, 200)
    },
    [reducedMotion],
  )

  const handleNextStep = () => {
    if (currentStep < 3) changeStep(currentStep + 1)
  }

  const handlePrevStep = () => {
    if (currentStep > 1) changeStep(currentStep - 1)
  }

  const exitingLeftStyle: CSSProperties = exiting
    ? {
        opacity: 0,
        transform: 'translateX(-40px)',
        transition: 'opacity 300ms ease-in, transform 300ms ease-in',
      }
    : {}

  const stepContentStyle: CSSProperties = reducedMotion
    ? {}
    : {
        opacity: stepContentVisible ? 1 : 0,
        transform: stepContentVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }

  const subtextStyle: CSSProperties = {
    fontSize: 15,
    color: '#B4B2A9',
    marginTop: 8,
    marginBottom: 24,
  }

  const h2Style: CSSProperties = {
    fontSize: 22,
    fontWeight: 500,
    color: '#F1EFE8',
    margin: 0,
    lineHeight: 1.3,
  }

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        height: '100%',
        alignSelf: 'stretch',
        gap: 0,
        marginTop: 24,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          flex: '1 1 50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '40px 60px 40px 40px',
          paddingTop: '18vh',
          boxSizing: 'border-box',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          ...exitingLeftStyle,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 13,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: '#888780',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              Etapa {currentStep} de 3
            </div>
            <div
              style={{
                display: 'flex',
                gap: 4,
                width: '100%',
                maxWidth: 280,
              }}
            >
              {([1, 2, 3] as const).map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: step <= currentStep ? '#EF9F27' : '#2C2C2A',
                    transition: 'background-color 300ms ease',
                  }}
                />
              ))}
            </div>
          </div>

          <h2 style={h2Style}>{STEP_TITLES[currentStep]}</h2>
          <p style={subtextStyle}>{STEP_SUBTEXTS[currentStep]}</p>

          <div
            style={{
              ...stepContentStyle,
              display: 'flex',
              flexDirection: 'column',
              flex: '0 0 auto',
              minHeight: 0,
              overflow: 'visible',
            }}
          >
            {currentStep === 1 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                  flexShrink: 0,
                }}
              >
                <ObjetivoCard
                  selected={proObjetivo === 'investir'}
                  onClick={() => setProObjetivo('investir')}
                  icon={<TrendingUp size={20} />}
                  iconSelectedColor="#E8A830"
                  label="Investir em processo existente"
                  desc="Parceria ou aquisição em ativos já titulados"
                />
                <ObjetivoCard
                  selected={proObjetivo === 'novo_requerimento'}
                  onClick={() => setProObjetivo('novo_requerimento')}
                  icon={<MapPin size={20} />}
                  iconSelectedColor="#22C55E"
                  label="Identificar áreas para novo requerimento"
                  desc="Áreas com potencial para novo requerimento ou título"
                />
                <ObjetivoCard
                  selected={proObjetivo === 'avaliar_portfolio'}
                  onClick={() => setProObjetivo('avaliar_portfolio')}
                  icon={<BarChart3 size={20} />}
                  iconSelectedColor="#3B82F6"
                  label="Avaliar portfólio atual"
                  desc="Desempenho e risco da carteira que você acompanha"
                />
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                  flexShrink: 0,
                }}
              >
                <RiscoCard
                  selected={proRisco === 'conservador'}
                  onClick={() => setProRisco('conservador')}
                  icon={<Shield size={20} />}
                  iconSelectedColor="#1D9E75"
                  label="Conservador"
                  desc="Prioriza segurança e processos consolidados"
                />
                <RiscoCard
                  selected={proRisco === 'moderado'}
                  onClick={() => setProRisco('moderado')}
                  icon={<Scale size={20} />}
                  iconSelectedColor="#E8A830"
                  label="Moderado"
                  desc="Equilíbrio entre risco e retorno"
                />
                <RiscoCard
                  selected={proRisco === 'arrojado'}
                  onClick={() => setProRisco('arrojado')}
                  icon={<TrendingUp size={20} />}
                  iconSelectedColor="#E24B4A"
                  label="Arrojado"
                  desc="Aceita risco elevado por alta recompensa"
                />
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div style={{ flexShrink: 0, width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    maxHeight: 'min(45vh, 400px)',
                    overflowY: 'auto',
                    alignContent: 'flex-start',
                    paddingRight: 4,
                    boxSizing: 'border-box',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setProUfs([])}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: proUfs.length === 0 ? '#EF9F27' : '#2C2C2A',
                      backgroundColor: proUfs.length === 0 ? 'rgba(239, 159, 39, 0.12)' : '#111110',
                      color: proUfs.length === 0 ? '#EF9F27' : '#D3D1C7',
                    }}
                  >
                    Todo o Brasil
                  </button>
                  {[...UFS_BRASIL].map((uf) => {
                    const isSelected = proUfs.includes(uf)
                    return (
                      <button
                        key={uf}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setProUfs(proUfs.filter((u) => u !== uf))
                          } else {
                            setProUfs([...proUfs, uf])
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 20,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: isSelected ? '#EF9F27' : '#2C2C2A',
                          backgroundColor: isSelected ? 'rgba(239, 159, 39, 0.12)' : '#111110',
                          color: isSelected ? '#EF9F27' : '#D3D1C7',
                        }}
                      >
                        {uf}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 24,
              flexShrink: 0,
            }}
          >
            {currentStep > 1 ? (
              <button type="button" onClick={handlePrevStep} style={navGhostButtonStyle}>
                Voltar
              </button>
            ) : null}
            {currentStep === 1 ? (
              <button type="button" onClick={onCancel} style={navGhostButtonStyle}>
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              disabled={!stepValido}
              onClick={currentStep < 3 ? handleNextStep : onAnalisar}
              style={{
                backgroundColor: '#EF9F27',
                color: '#0D0D0C',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                padding: '10px 28px',
                border: 'none',
                cursor: stepValido ? 'pointer' : 'not-allowed',
                opacity: stepValido ? 1 : 0.4,
                transition: 'filter 0.15s ease-out, box-shadow 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                if (!stepValido) return
                e.currentTarget.style.filter = 'brightness(1.1)'
                e.currentTarget.style.boxShadow = '0 0 24px rgba(239, 159, 39, 0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {currentStep < 3 ? 'Próximo' : 'Analisar oportunidades'}
            </button>
          </div>
        </div>
      </div>

      <ProspeccaoAnimations
        currentStep={animationStep}
        visible={animationVisible}
        reducedMotion={reducedMotion}
        exiting={exiting}
      />
    </div>
  )
}
