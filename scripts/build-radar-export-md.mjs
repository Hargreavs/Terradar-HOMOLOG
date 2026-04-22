import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const outPath = path.join(root, 'Docs', 'TERRAE-radar-codigo-completo.md')

const filesFull = [
  'src/App.tsx',
  'src/components/dashboard/RadarDashboard.tsx',
  'src/components/dashboard/RadarAlertasSubtab.tsx',
  'src/data/radar-alertas.mock.ts',
  'src/lib/relevanciaAlerta.ts',
  'src/lib/opportunityScore.ts',
  'src/lib/motionDurations.ts',
  'src/hooks/useStaggeredEntrance.ts',
  'src/components/ui/BadgeSubstancia.tsx',
  'src/lib/corSubstancia.ts',
  'src/store/useAppStore.ts',
  'src/store/useMapStore.ts',
  'src/components/ui/RegimeBadge.tsx',
]

function wrapFile(relPath, content) {
  return `\n=== ARQUIVO: ${relPath} ===\n${content}\n=== FIM: ${relPath} ===\n`
}

async function main() {
  const intelPath = path.join(root, 'src/components/dashboard/InteligenciaDashboard.tsx')
  const intelRaw = await fs.readFile(intelPath, 'utf8')
  const intelLines = intelRaw.split(/\r?\n/)

  function sliceLines(start, endInclusive) {
    return intelLines.slice(start - 1, endInclusive).join('\n')
  }

  /** Trechos contíguos do InteligenciaDashboard usados pelo Radar (import de MultiSelectDropdown + UFS). */
  const intelExtract = [
    '// --- Linha 264 ---',
    intelLines[263],
    '',
    '// --- Linhas 596-629 (ChevronDown) ---',
    sliceLines(596, 629),
    '',
    '// --- Linhas 1458-1470 (CheckMini) ---',
    sliceLines(1458, 1470),
    '',
    '// --- Linhas 1639-1826 (INTEL_FILTER_SELECT_TRIGGER_STYLE + MultiSelectDropdown) ---',
    sliceLines(1639, 1826),
  ].join('\n')

  const cssPath = path.join(root, 'src/index.css')
  const cssRaw = await fs.readFile(cssPath, 'utf8')
  const cssLines = cssRaw.split(/\r?\n/)
  const cssRadarTrecho = cssLines.slice(369, 455).join('\n')

  let md = `# TERRAE — Exportação de código da aba Radar

Documento gerado automaticamente para análise antes de reestruturação. Contém cópias integrais dos ficheiros listados na árvore abaixo.

## Notas

- **Não existe store Zustand dedicado ao Radar.** A aba usa \`useAppStore\` (\`setTelaAtiva\`, \`telaAtiva\`) e \`useMapStore\` (\`processos\`, \`pendingNavigation\`, \`selecionarProcesso\`, \`relatorioDrawerAberto\`, etc.).
- **\`MultiSelectDropdown\` e \`UFS_INTEL_DASHBOARD\`** vêm de \`InteligenciaDashboard.tsx\`; como o ficheiro completo é muito grande, inclui-se um **excerto com linhas explícitas** (código idêntico ao repositório).
- **CSS:** inclui-se apenas o bloco \`@media (prefers-reduced-motion: no-preference)\` com classes/keyframes \`terrae-radar-*\` e relacionados (linhas 370–455 de \`src/index.css\`).

## Árvore de ficheiros relevantes (sob \`src/\`)

\`\`\`
src/
  App.tsx
  index.css                    (trecho Radar: ~linhas 370–455)
  components/
    dashboard/
      RadarDashboard.tsx
      RadarAlertasSubtab.tsx
      InteligenciaDashboard.tsx (dependência: UFS_INTEL_DASHBOARD, MultiSelectDropdown — ver excerto neste doc)
    ui/
      BadgeSubstancia.tsx
      RegimeBadge.tsx
  data/
    radar-alertas.mock.ts
  hooks/
    useStaggeredEntrance.ts
  lib/
    corSubstancia.ts
    motionDurations.ts
    opportunityScore.ts
    relevanciaAlerta.ts
  store/
    useAppStore.ts
    useMapStore.ts
\`\`\`

---

`

  for (const rel of filesFull) {
    const p = path.join(root, rel)
    const content = await fs.readFile(p, 'utf8')
    md += wrapFile(rel.replace(/\\/g, '/'), content)
  }

  md += wrapFile(
    'src/index.css (trecho Radar, linhas 370-455)',
    cssRadarTrecho,
  )

  md += wrapFile(
    'src/components/dashboard/InteligenciaDashboard.tsx (excerto Radar: UFS + MultiSelectDropdown e helpers, linhas 264, 596-629, 1458-1470, 1639-1826)',
    intelExtract,
  )

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, md, 'utf8')
  console.log('Wrote', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
