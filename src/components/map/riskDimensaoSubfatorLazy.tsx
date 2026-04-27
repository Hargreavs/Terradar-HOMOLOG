import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import type { DadosANM, DadosFiscaisRicos, DadosTerritoriais } from '../../data/relatorio.mock'
import { biomaMultiplicadorS31 } from '../../lib/biomaS31'
import { CORES_DISTANCIA, corDistancia } from '../../lib/distanciaCor'
import { buildGeologicoItemsS31 } from '../../lib/s31SubfatorDecomp'
import { useTerritorialAmbiental } from '../../hooks/useTerritorialAmbiental'
import type { Processo } from '../../types'
import { SubfatorPanel } from './s31/SubfatorPanel'

const FS = { sm: 13, md: 14, base: 15 } as const

type DimKey = 'geologico' | 'ambiental' | 'social' | 'regulatorio'

function asRec(p: Processo): Record<string, unknown> {
  return p as unknown as Record<string, unknown>
}

/**
 * Conteudo adicional quando subfatores do JSONB esta vazio (S31 v1.1).
 */
export function RiskDimensaoSubfatorLazy({
  dim,
  habilitar,
  processo,
  territorial,
  fiscalRico,
  dadosAnm,
}: {
  dim: DimKey
  habilitar: boolean
  processo: Processo
  territorial?: DadosTerritoriais
  fiscalRico?: DadosFiscaisRicos
  dadosAnm?: DadosANM
}) {
  const pr = asRec(processo)
  const { data: ambData, loading: ambLoad, error: ambErr } = useTerritorialAmbiental(
    processo.numero,
    habilitar && dim === 'ambiental',
  )

  const regVal = useMemo(() => {
    const p = processo.dimensoes_risco_persistido?.regulatorio as
      | { valor?: number }
      | undefined
    if (p?.valor != null && Number.isFinite(Number(p.valor))) return Number(p.valor)
    return processo.risk_breakdown?.regulatorio ?? null
  }, [processo.dimensoes_risco_persistido, processo.risk_breakdown])
  const pisoTexto = useMemo(() => {
    if (regVal == null) return null
    if (regVal >= 95) return 'Piso S31: dimensao regulatoria >=95 -> risco min. 75.'
    if (regVal >= 85) return 'Piso S31: dimensao regulatoria >=85 -> risco min. 65.'
    if (regVal >= 70) return 'Piso S31: dimensao regulatoria >=70 -> risco min. 55.'
    return null
  }, [regVal])

  if (!habilitar) return null

  if (dim === 'geologico') {
    const fam = pr.substancia_familia != null ? String(pr.substancia_familia) : null
    const totalGeo =
      processo.dimensoes_risco_persistido?.geologico != null
        ? Number(
            (processo.dimensoes_risco_persistido.geologico as { valor?: number }).valor,
          ) || 0
        : processo.risk_breakdown?.geologico ?? 0
    return (
      <div style={{ marginTop: 0 }}>
        <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: 0, lineHeight: 1.4 }}>
          <span style={{ color: '#888780' }}>Substancia (ANM):</span>{' '}
          {String(processo.substancia || '-')}
        </p>
        {fam ? (
          <p style={{ fontSize: FS.sm, color: '#888780', margin: '8px 0 0 0', lineHeight: 1.4 }}>
            Familia: {fam}
            {processo.is_mineral_estrategico ? ' - mineral estrategico' : ''}
          </p>
        ) : null}
        <p style={{ fontSize: FS.sm, color: '#5F5E5A', margin: '8px 0 0 0' }}>
          Fonte: cadastro + Master Substancias.
        </p>
        <div style={{ marginTop: 12 }}>
          <SubfatorPanel items={buildGeologicoItemsS31(processo)} totalDim={totalGeo} />
        </div>
      </div>
    )
  }

  if (dim === 'social') {
    const idh = fiscalRico?.idh_municipal
    const pib = fiscalRico?.pib_municipal_mi
    const dep = fiscalRico?.dependencia_transferencias_pct
    return (
      <div style={{ marginTop: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {territorial ? (
          <div>
            <div style={{ fontSize: FS.sm, color: '#888780', marginBottom: 4 }}>
              Contexto territorial (distancias)
            </div>
            {territorial.nome_ti_proxima != null && territorial.distancia_ti_km != null ? (
              <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: 0, lineHeight: 1.4 }}>
                TI {String(territorial.nome_ti_proxima)} -{' '}
                {Number(territorial.distancia_ti_km).toFixed(1)} km
              </p>
            ) : null}
            {territorial.nome_quilombola != null ? (
              <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '4px 0 0 0' }}>
                Quilombola: {String(territorial.nome_quilombola)}
              </p>
            ) : null}
            {territorial.nome_uc_proxima != null && territorial.distancia_uc_km != null ? (
              <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '4px 0 0 0' }}>
                UC {String(territorial.nome_uc_proxima)} -{' '}
                {Number(territorial.distancia_uc_km).toFixed(1)} km
              </p>
            ) : null}
          </div>
        ) : (
          <p style={{ fontSize: FS.sm, color: '#888780', margin: 0 }}>
            Dados territoriais indisponiveis.
          </p>
        )}
        {fiscalRico ? (
          <div style={{ borderTop: '1px solid #2C2C2A', paddingTop: 8 }}>
            <div style={{ fontSize: FS.sm, color: '#888780', marginBottom: 4 }}>
              Municipio (IBGE/SICONFI)
            </div>
            {idh != null && String(idh).trim() !== '' ? (
              <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: 0 }}>IDHM: {String(idh)}</p>
            ) : null}
            {pib != null && Number.isFinite(pib) ? (
              <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '4px 0 0 0' }}>
                PIB municipal: {pib.toFixed(0)} mi R$
              </p>
            ) : null}
            {dep != null && Number.isFinite(dep) ? (
              <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '4px 0 0 0' }}>
                Dependencia de transferencias: {dep.toFixed(1)}%
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  if (dim === 'regulatorio') {
    return (
      <div style={{ marginTop: 0 }}>
        {dadosAnm?.alvara_vencimento != null && String(dadosAnm.alvara_vencimento).trim() !== '' ? (
          <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: 0, lineHeight: 1.4 }}>
            <span style={{ color: '#888780' }}>Alvara / prazo:</span> {String(dadosAnm.alvara_vencimento)}
          </p>
        ) : null}
        {dadosAnm?.ral_ultimo_apresentado != null &&
        String(dadosAnm.ral_ultimo_apresentado).trim() !== '' ? (
          <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '6px 0 0 0' }}>
            RAL: {String(dadosAnm.ral_ultimo_apresentado)}
          </p>
        ) : null}
        {pr.pendencias_abertas != null ? (
          <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '6px 0 0 0' }}>
            Pendencias abertas (SCM): {String(pr.pendencias_abertas)}
          </p>
        ) : null}
        {fiscalRico?.capag != null ? (
          <p style={{ fontSize: FS.md, color: '#D3D1C7', margin: '6px 0 0 0' }}>
            CAPAG: {String(fiscalRico.capag)}
            {fiscalRico.capag_pior_indicador_letra
              ? ` (pior indicador: ${fiscalRico.capag_pior_indicador_letra})`
              : ''}
          </p>
        ) : null}
        {pisoTexto ? (
          <p
            style={{
              fontSize: FS.sm,
              color: '#E8A830',
              margin: '10px 0 0 0',
              lineHeight: 1.45,
            }}
          >
            {pisoTexto}
          </p>
        ) : null}
        <p style={{ fontSize: FS.sm, color: '#5F5E5A', margin: '8px 0 0 0' }}>
          Autuacoes e CFEM: painel fiscal no relatorio.
        </p>
      </div>
    )
  }

  if (ambLoad) {
    return (
      <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: '#EF9F27' }} aria-hidden />
        <span style={{ fontSize: FS.sm, color: '#888780' }}>A carregar analise ambiental...</span>
      </div>
    )
  }
  if (ambErr) {
    return <p style={{ fontSize: FS.sm, color: '#E24B4A', margin: 0 }}>{ambErr.message}</p>
  }

  const bioma = pr.bioma_territorial != null ? String(pr.bioma_territorial) : null
  const veto1 =
    pr.amb_ti_sobrepoe === true ||
    pr.amb_quilombola_sobrepoe === true ||
    pr.amb_uc_pi_sobrepoe === true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {veto1 ? (
        <div
          style={{
            borderRadius: 6,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.06)',
            padding: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F87171', marginBottom: 4 }}>
            Nivel 1 - Veto (sobreposicao)
          </div>
          {pr.amb_ti_sobrepoe === true ? (
            <div style={{ fontSize: FS.md, color: '#D3D1C7' }}>Sobrepoe terra indigena</div>
          ) : null}
          {pr.amb_quilombola_sobrepoe === true ? (
            <div style={{ fontSize: FS.md, color: '#D3D1C7' }}>Sobrepoe territorio quilombola</div>
          ) : null}
          {pr.amb_uc_pi_sobrepoe === true ? (
            <div style={{ fontSize: FS.md, color: '#D3D1C7' }}>Sobrepoe UC de protecao integral</div>
          ) : null}
        </div>
      ) : null}

      {ambData?.sitios_arqueologicos && ambData.sitios_arqueologicos.length > 0
        ? (() => {
            const sitios = ambData.sitios_arqueologicos
            const relevantes = sitios.filter((s) => s.distancia_km <= 5)
            const corSitioKm = (km: number) =>
              CORES_DISTANCIA[corDistancia('SITIO_ARQ', km)].texto
            if (relevantes.length > 0) {
              return (
                <div>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: '#E8A830', marginBottom: 4 }}
                  >
                    Nivel 2 - Sitios IPHAN em buffer (&lt;= 5 km)
                  </div>
                  {relevantes.slice(0, 4).map((s, i) => {
                    const pts = s.distancia_km <= 1 ? 30 : 15
                    return (
                      <div
                        key={s.id ?? i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: FS.md,
                          color: '#D3D1C7',
                          marginTop: i > 0 ? 6 : 0,
                        }}
                      >
                        <span className="min-w-0 truncate" title={s.nome ?? undefined}>
                          Sitio: {s.nome ?? '-'}
                        </span>
                        <span style={{ color: corSitioKm(s.distancia_km), flexShrink: 0 }}>
                          {s.distancia_km.toFixed(1)} km - +{pts}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            }
            return (
              <div style={{ fontSize: FS.sm, color: '#888780' }}>
                <div>Sem sitio IPHAN em buffer critico (&lt;= 5 km).</div>
                <div style={{ fontSize: 11, color: '#5F5E5A', marginTop: 4 }}>
                  Sitios mais proximos (informativo):
                </div>
                {sitios
                  .slice()
                  .sort((a, b) => a.distancia_km - b.distancia_km)
                  .slice(0, 3)
                  .map((s, i) => (
                    <div
                      key={s.id ?? i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 4,
                        fontSize: 11,
                        color: corSitioKm(s.distancia_km),
                      }}
                    >
                      <span className="min-w-0 truncate">{s.nome ?? '-'}</span>
                      <span className="shrink-0">{s.distancia_km.toFixed(1)} km</span>
                    </div>
                  ))}
              </div>
            )
          })()
        : null}

      {(ambData?.app_hidrica && ambData.app_hidrica.overlap_pct > 0) ||
      pr.amb_uc_us_5km === true ||
      pr.amb_aquifero_5km === true ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888780', marginBottom: 4 }}>
            Nivel 3 - Agravantes
          </div>
          {ambData?.app_hidrica && ambData.app_hidrica.overlap_pct > 0 ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: FS.md,
                color: '#D3D1C7',
              }}
            >
              <span>APP / hidrografia</span>
              <span>{ambData.app_hidrica.overlap_pct.toFixed(1)}% sobreposicao</span>
            </div>
          ) : null}
          {pr.amb_uc_us_5km === true ? (
            <div style={{ fontSize: FS.md, color: '#D3D1C7', marginTop: 4 }}>
              UC uso sustentavel a &lt;=5 km
            </div>
          ) : null}
          {pr.amb_aquifero_5km === true ? (
            <div style={{ fontSize: FS.md, color: '#D3D1C7', marginTop: 4 }}>
              Aquifero a &lt;=5 km
            </div>
          ) : null}
        </div>
      ) : null}

      {bioma ? (
        <div
          style={{
            fontSize: FS.sm,
            color: '#888780',
            borderTop: '1px solid #2C2C2A',
            paddingTop: 8,
          }}
        >
          Bioma: <span style={{ color: '#D3D1C7' }}>{bioma}</span>
          <span style={{ color: '#888780' }}> - </span>
          <span>Multiplicador (motor S31):</span>{' '}
          <span style={{ color: '#E8A830' }}>x{biomaMultiplicadorS31(bioma).toFixed(2)}</span>
        </div>
      ) : null}
    </div>
  )
}
