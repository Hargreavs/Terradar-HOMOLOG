import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  fetchCPTByMunicipio,
  type CPTIncidente,
  type CPTMunicipio,
  type CPTDrawerData,
} from '@/services/cptService'

const cardWrap: CSSProperties = {
  backgroundColor: '#1E1E1C',
  borderRadius: 8,
  padding: '20px 18px',
}

const tituloPrincipal: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#F1EFE8',
  margin: 0,
  marginBottom: 30,
}

/** Igual ao inset, mas branco como outras secções do drawer (`#F1EFE8`). */
const tituloSecaoBranca: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#F1EFE8',
  margin: '0 0 10px 0',
}

const sep: CSSProperties = {
  height: 1,
  backgroundColor: '#2C2C2A',
  margin: '16px 0',
  flexShrink: 0,
}

const textoCorpoMd: CSSProperties = {
  fontSize: 14,
  color: '#D3D1C7',
}

const textoMuted: CSSProperties = {
  fontSize: 13,
  color: '#888780',
}

const textoMutedXs: CSSProperties = {
  fontSize: 12,
  color: '#888780',
}

const headlineMunicipio: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#F1EFE8',
  marginBottom: 10,
}

/** Bolinha + texto (sem multiplicador na v2). */
const NIVEL_CONFIG = {
  severo: {
    label: 'SEVERO',
    bg: '#3B1212',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    labelColor: '#F87171',
    dot: '#F87171',
  },
  alto: {
    label: 'ALTO',
    bg: '#3B2A12',
    border: '1px solid rgba(251, 191, 36, 0.35)',
    labelColor: '#FBBF24',
    dot: '#FBBF24',
  },
  moderado: {
    label: 'MODERADO',
    bg: '#3B3512',
    border: '1px solid rgba(253, 224, 71, 0.35)',
    labelColor: '#FDE047',
    dot: '#FDE047',
  },
  baixo: {
    label: 'BAIXO',
    bg: 'rgba(148, 148, 148, 0.08)',
    border: '1px solid rgba(148, 148, 148, 0.3)',
    labelColor: '#9CA3AF',
    dot: '#94A3B8',
  },
} as const

const UF_NOMES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}

function nomeUFExtenso(uf: string): string {
  const k = uf?.trim().toUpperCase()
  return (k && UF_NOMES[k]?.toUpperCase()) || uf
}

const SIGLAS_GLOSSARIO: Record<string, string> = {
  PDS: 'Projeto de Desenvolvimento Sustentável (assentamento INCRA)',
  PA: 'Projeto de Assentamento (INCRA)',
  PAE: 'Projeto de Assentamento Agroextrativista (INCRA)',
  PAF: 'Projeto de Assentamento Florestal (INCRA)',
  Resex: 'Reserva Extrativista (UC de uso sustentável)',
  Flona: 'Floresta Nacional (UC de uso sustentável)',
  TI: 'Terra Indígena',
  RDS: 'Reserva de Desenvolvimento Sustentável',
  APA: 'Área de Proteção Ambiental',
  Quilombola: 'Comunidade quilombola titulada ou em processo',
}

function findSiglaMatch(primeira: string): string | undefined {
  const p = primeira.trim()
  for (const key of Object.keys(SIGLAS_GLOSSARIO)) {
    if (key === p || key.toLowerCase() === p.toLowerCase()) {
      return key
    }
  }
  return undefined
}

/** Texto de data pode vir com «dezembro» em minúsculas da API — capitaliza nome do mês. */
function capitalizarMesesPt(s: string): string {
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ] as const
  let out = s
  for (const mes of meses) {
    const re = new RegExp(`\\b${mes}\\b`, 'gi')
    out = out.replace(re, (mch) =>
      mch.charAt(0).toUpperCase() + mch.slice(1).toLowerCase(),
    )
  }
  return out
}

function SiglaTooltip({
  texto,
  inlineStyle,
}: {
  texto: string
  inlineStyle?: CSSProperties
}) {
  const base = inlineStyle ?? textoMutedXs
  const trimmed = texto.trim()
  if (!trimmed) return null
  const partes = trimmed.split(/\s+/)
  const primeira = partes[0] ?? ''
  const siglaMatch = findSiglaMatch(primeira)
  if (!siglaMatch) {
    return <span style={base}>{trimmed}</span>
  }
  const resto = partes.slice(1).join(' ')
  return (
    <span style={base}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            style={{
              textDecoration: 'underline dotted',
              textUnderlineOffset: 2,
              cursor: 'help',
              color:
                inlineStyle?.color !== undefined
                  ? inlineStyle.color
                  : '#A8A59A',
            }}
          >
            {primeira}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" style={{ maxWidth: 300 }}>
          {SIGLAS_GLOSSARIO[siglaMatch]}
        </TooltipContent>
      </Tooltip>
      {resto ? ` ${resto}` : ''}
    </span>
  )
}

interface FraseIncidente {
  titulo: string
  detalhes?: string
  localPrefix: string
}

function capitalizarPrimeira(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function vitimaFeminina(g: string | null | undefined): boolean {
  if (!g) return false
  const s = g.trim().toLowerCase()
  return (
    s.startsWith('f') ||
    s.includes('feminino') ||
    s.includes('mulher')
  )
}

function construirFraseIncidente(inc: CPTIncidente): FraseIncidente {
  if (inc.tipo_categoria === 'assassinato' && inc.vitima_nome) {
    const idade =
      inc.vitima_idade != null && Number.isFinite(inc.vitima_idade)
        ? `, ${inc.vitima_idade} anos`
        : ''
    const titulo = `Assassinato de ${inc.vitima_nome}${idade}`

    let detalhes = ''
    if (inc.categoria_vitima) {
      const gen = vitimaFeminina(inc.vitima_genero) ? 'morta' : 'morto'
      const causou = inc.categoria_causou
        ? ` por ${inc.categoria_causou.toLowerCase()}`
        : ''
      detalhes = `${inc.categoria_vitima} ${gen}${causou}`
    }

    return {
      titulo,
      detalhes: detalhes || undefined,
      localPrefix: 'Conflito',
    }
  }

  if (inc.tipo_categoria === 'violencia_posse') {
    const acao = inc.tipo_violencia
      ? capitalizarPrimeira(inc.tipo_violencia)
      : 'Violência'
    const sofreu = inc.categoria_sofreu
      ? ` contra ${inc.categoria_sofreu.toLowerCase()}`
      : ''
    const causou = inc.categoria_causou
      ? ` por ${inc.categoria_causou.toLowerCase()}`
      : ''

    return {
      titulo: `${acao}${sofreu}${causou}`,
      localPrefix: 'Local',
    }
  }

  if (inc.tipo_categoria === 'conflito_trabalhista') {
    const forma = inc.forma_conflito ?? ''
    const ehEscravo =
      forma.toLowerCase().includes('escravo') ||
      (inc.trabalhadores_resgatados ?? 0) > 0
    if (ehEscravo) {
      const qtd = inc.trabalhadores_resgatados ?? 0
      const trabPlural = qtd === 1 ? 'trabalhador resgatado' : 'trabalhadores resgatados'
      return {
        titulo: 'Trabalho escravo identificado',
        detalhes: qtd > 0 ? `${qtd} ${trabPlural}` : undefined,
        localPrefix: 'Local',
      }
    }
    return {
      titulo: capitalizarPrimeira(forma || 'Conflito trabalhista'),
      localPrefix: 'Local',
    }
  }

  return { titulo: 'Conflito documentado', localPrefix: 'Local' }
}

function formatIncidenteHeadData(
  isoDate: string | null,
  anoFallback: number,
): string {
  if (isoDate) {
    const t = isoDate.trim()
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
    if (m) {
      const [, y, mo, d] = m
      return `${d}/${mo}/${y}`
    }
    const dt = Date.parse(t)
    if (!Number.isNaN(dt)) {
      return new Date(dt).toLocaleDateString('pt-BR')
    }
  }
  return String(anoFallback)
}

interface Props {
  municipioIbge?: string | null
  municipioNome?: string | null
  uf?: string | null
}

function temChave(ibge?: string | null, nome?: string | null): boolean {
  const i = ibge?.trim()
  const n = nome?.trim()
  return Boolean(i || n)
}

function linhaMetricasMunicipio(m: CPTMunicipio): string[] {
  const partes: string[] = []
  if (m.qtd_assassinatos > 0) {
    partes.push(
      `${m.qtd_assassinatos} ${
        m.qtd_assassinatos > 1
          ? 'assassinatos documentados'
          : 'assassinato documentado'
      }`,
    )
  }
  if (m.qtd_violencia_posse > 0) {
    partes.push(
      `${m.qtd_violencia_posse} ${
        m.qtd_violencia_posse > 1
          ? 'conflitos por posse de terra'
          : 'conflito por posse de terra'
      }`,
    )
  }
  if (m.qtd_trabalhistas > 0) {
    const base = `${m.qtd_trabalhistas} ${
      m.qtd_trabalhistas > 1 ? 'ocorrências trabalhistas' : 'ocorrência trabalhista'
    }`
    partes.push(
      m.qtd_trabalho_escravo > 0
        ? `${base} (${m.qtd_trabalho_escravo} envolvendo trabalho escravo)`
        : base,
    )
  }
  return partes
}

export function ConflitosTerritoriaisCard({
  municipioIbge,
  municipioNome,
  uf,
}: Props) {
  if (!temChave(municipioIbge, municipioNome)) {
    return null
  }

  const [data, setData] = useState<CPTDrawerData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchCPTByMunicipio({
      municipio_ibge: municipioIbge,
      municipio_nome: municipioNome,
      uf,
    })
      .then(setData)
      .finally(() => setLoading(false))
  }, [municipioIbge, municipioNome, uf])

  if (loading) {
    return <CardSkeletonInner />
  }
  if (!data) {
    return null
  }

  const { municipio, estado, incidentes, fonte_label, fonte_descricao } = data

  const nivelKey = municipio.indice_cpt_nivel
  const nivelCfg =
    nivelKey && nivelKey in NIVEL_CONFIG
      ? NIVEL_CONFIG[nivelKey as keyof typeof NIVEL_CONFIG]
      : NIVEL_CONFIG.baixo

  const metricParts = linhaMetricasMunicipio(municipio)
  const metricasLinha =
    municipio.qtd_total > 0 && metricParts.length > 0
      ? metricParts.join(' · ')
      : ''

  const mostrarIncidentes =
    municipio.qtd_total > 0 &&
    incidentes &&
    incidentes.length > 0

  return (
    <TooltipProvider delayDuration={250}>
      <div style={cardWrap}>
        <p style={tituloPrincipal}>Conflitos territoriais</p>

        <div>
          <div style={headlineMunicipio}>
            Em {municipio.municipio_nome.toUpperCase()} ({municipio.uf})
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: nivelCfg.bg,
              border: nivelCfg.border,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: nivelCfg.dot,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: nivelCfg.labelColor,
              }}
            >
              Índice de Conflito: {nivelCfg.label}
            </span>
          </div>

          {(municipio.descricao_nivel?.trim() ?? '').length > 0 ? (
            <p
              style={{
                ...textoCorpoMd,
                marginTop: 12,
                lineHeight: 1.55,
              }}
            >
              {municipio.descricao_nivel}
            </p>
          ) : null}

          {metricasLinha ? (
            <div style={{ ...textoCorpoMd, marginTop: 12 }}>{metricasLinha}</div>
          ) : null}

          {municipio.data_ultimo_evento_legivel ? (
            <div style={{ ...textoMuted, marginTop: 6 }}>
              Última ocorrência:{' '}
              {capitalizarMesesPt(municipio.data_ultimo_evento_legivel.trim())}
            </div>
          ) : null}
        </div>

        {mostrarIncidentes ? (
          <>
            <div style={sep} aria-hidden />
            <div style={tituloSecaoBranca}>Incidentes documentados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {incidentes.map((inc, idx) => (
                <IncidenteItem key={`${idx}-${inc.ano}-${inc.data_evento}`} inc={inc} />
              ))}
            </div>
          </>
        ) : null}

        <div style={sep} aria-hidden />
        <div
          style={{
            ...tituloSecaoBranca,
            marginBottom: 12,
            textAlign: 'left',
          }}
        >
          Contexto estadual - {nomeUFExtenso(estado.uf)}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 23,
                fontWeight: 600,
                color: '#F1EFE8',
                lineHeight: 1.15,
              }}
            >
              {estado.qtd_5anos}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#888780',
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              conflitos
              <br />
              em 5 anos
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 23,
                fontWeight: 600,
                color: '#F1EFE8',
                lineHeight: 1.15,
              }}
            >
              {estado.qtd_assassinatos_5anos}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#888780',
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              assassinatos
              <br />
              no campo
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 23,
                fontWeight: 600,
                color: '#F1EFE8',
                lineHeight: 1.15,
              }}
            >
              {estado.qtd_municipios_afetados}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#888780',
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              municípios
              <br />
              afetados
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: '#888780',
            marginTop: 20,
            textAlign: 'right',
          }}
        >
          Fonte:{' '}
          {fonte_descricao.trim() ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  style={{
                    textDecoration: 'underline dotted',
                    textUnderlineOffset: 2,
                    cursor: 'help',
                    color: '#A8A59A',
                  }}
                >
                  {fonte_label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" style={{ maxWidth: 320 }}>
                {fonte_descricao}
              </TooltipContent>
            </Tooltip>
          ) : (
            fonte_label
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

const incidenteTituloTipo: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#F1EFE8',
}

function IncidenteItem({ inc }: { inc: CPTIncidente }) {
  const dataFmt = formatIncidenteHeadData(inc.data_evento, inc.ano)
  const frase = construirFraseIncidente(inc)

  return (
    <div>
      <div style={{ ...incidenteTituloTipo }}>{dataFmt}</div>
      <div style={{ ...incidenteTituloTipo, marginTop: 4 }}>{frase.titulo}</div>
      {frase.detalhes ? (
        <div style={{ ...textoMutedXs, marginTop: 4 }}>{frase.detalhes}</div>
      ) : null}
      {inc.nome_conflito ? (
        <div style={{ ...incidenteTituloTipo, marginTop: 4 }}>
          {frase.localPrefix}:{' '}
          <SiglaTooltip
            texto={inc.nome_conflito}
            inlineStyle={{
              ...incidenteTituloTipo,
              display: 'inline',
              fontWeight: 500,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function CardSkeletonInner() {
  return (
    <div style={cardWrap}>
      <div
        style={{
          height: 16,
          background: '#2C2C2A',
          borderRadius: 4,
          width: '45%',
          marginBottom: 20,
        }}
      />
      <div
        style={{
          height: 12,
          background: '#252523',
          borderRadius: 4,
          width: '70%',
          marginBottom: 8,
        }}
      />
      <div
        style={{
          height: 12,
          background: '#252523',
          borderRadius: 4,
          width: '50%',
        }}
      />
    </div>
  )
}
