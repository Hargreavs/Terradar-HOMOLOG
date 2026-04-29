// S31 penalidades Opportunity Score (human copy). Ordem de severidade: cap 10 > 25 > 20.

export interface PenalidadeDisclaimer {
  titulo: string
  corpo: string
  rodape: string
}

const SEVERIDADE_ORDEM = [
  { match: /cap\s*10\b/i, key: 'cap10' as const },
  { match: /cap\s*25\b/i, key: 'cap25' as const },
  { match: /cap\s*20\b/i, key: 'cap20' as const },
]

const TEXTOS_POR_CAP: Record<
  (typeof SEVERIDADE_ORDEM)[number]['key'],
  PenalidadeDisclaimer
> = {
  cap25: {
    titulo: 'Por que este processo n\u00e3o \u00e9 recomendado',
    corpo:
      'A \u00e1rea tem indicadores socioambientais cr\u00edticos (\u00edndice ambiental ou social \u2265 95). Mesmo com bons indicadores de atratividade e viabilidade, o motor de scoring aplica um teto de oportunidade nesses casos \u2014 risco de licenciamento invi\u00e1vel, contesta\u00e7\u00e3o judicial e dano reputacional supera qualquer ganho potencial.',
    rodape: 'Regra do motor S31: cap 25 (veto socioambiental).',
  },
  cap20: {
    titulo: 'Por que este processo n\u00e3o \u00e9 recomendado',
    corpo:
      'Este processo est\u00e1 formalmente encerrado ou inativo na ANM (arquivado, indeferido, com alvar\u00e1 prescrito ou em outra situa\u00e7\u00e3o sem caminho administrativo ativo). O t\u00edtulo n\u00e3o evolui para pesquisa ou lavra, independente da qualidade da \u00e1rea.',
    rodape: 'Regra do motor S31: cap 20 (encerrado/inativo).',
  },
  cap10: {
    titulo: 'Por que este processo n\u00e3o \u00e9 recomendado',
    corpo:
      'A \u00e1rea est\u00e1 em zona de bloqueio permanente da ANM (Terra Ind\u00edgena homologada, Unidade de Conserva\u00e7\u00e3o de prote\u00e7\u00e3o integral, \u00e1rea militar ou similar). O bloqueio \u00e9 definitivo, sem janela jur\u00eddica de revers\u00e3o no curto prazo.',
    rodape: 'Regra do motor S31: cap 10 (bloqueio permanente).',
  },
}

export function resolverPenalidadeDisclaimer(
  penalidades: string[] | null | undefined,
): PenalidadeDisclaimer | null {
  if (!penalidades?.length) return null

  for (const { match, key } of SEVERIDADE_ORDEM) {
    if (penalidades.some((p) => match.test(p))) {
      return TEXTOS_POR_CAP[key]
    }
  }

  return {
    titulo: 'Por que este processo n\u00e3o \u00e9 recomendado',
    corpo:
      'O motor S31 aplicou uma penalidade que limita a oportunidade. Consulte a regra t\u00e9cnica abaixo para detalhes.',
    rodape: `Penalidade aplicada: ${penalidades[0]}.`,
  }
}
