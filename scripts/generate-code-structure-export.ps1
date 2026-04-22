# Gera docs/terradar-code-structure-export-full.md com a exportação pedida (UTF-8 sem BOM).
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$outDir = Join-Path $root 'docs'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$outPath = Join-Path $outDir 'terradar-code-structure-export-full.md'

$nl = [Environment]::NewLine
$sb = New-Object System.Text.StringBuilder

function Append([string]$s) { [void]$sb.Append($s) }
function AppendLine([string]$s = '') { [void]$sb.Append($s + $nl) }

function Add-H1([string]$t) { AppendLine ''; AppendLine "# $t"; AppendLine '' }
function Add-H2([string]$t) { AppendLine ''; AppendLine "## $t"; AppendLine '' }
function Add-H3([string]$t) { AppendLine ''; AppendLine "### $t"; AppendLine '' }
# Fences Markdown: ``` (três backticks)
function Add-Fence([string]$lang) { AppendLine ('```' + $lang) }
function End-Fence { AppendLine '```'; AppendLine '' }

Add-H1 'TERRADAR - Exportação da estrutura de código'
AppendLine "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
AppendLine ''

# --- 1 ---
Add-H2 '1. Tree com contagem de linhas (src/components/dashboard, src/lib, src/data)'
$paths = @(
  (Join-Path $root 'src\components\dashboard')
  (Join-Path $root 'src\lib')
  (Join-Path $root 'src\data')
)
$files = @()
foreach ($p in $paths) {
  if (Test-Path $p) {
    $files += Get-ChildItem -Path $p -Recurse -Include *.tsx,*.ts -File -ErrorAction SilentlyContinue
  }
}
$files = $files | Sort-Object FullName -Unique
Add-Fence 'text'
foreach ($f in $files) {
  $n = @([System.IO.File]::ReadAllLines($f.FullName)).Count
  $rel = $f.FullName.Substring($root.Path.Length).TrimStart('\').Replace('\', '/')
  AppendLine ("{0} {1}" -f $n, $rel)
}
End-Fence

# --- 2 ---
Add-H2 '2. Primeiras 80 linhas dos arquivos com mais de 500 linhas'
foreach ($f in $files) {
  $n = @([System.IO.File]::ReadAllLines($f.FullName)).Count
  if ($n -le 500) { continue }
  $rel = $f.FullName.Substring($root.Path.Length).TrimStart('\').Replace('\', '/')
  Add-H3 "========== $rel ($n linhas) =========="
  $lines = [System.IO.File]::ReadAllLines($f.FullName, [System.Text.Encoding]::UTF8)
  $take = [Math]::Min(80, $lines.Length)
  Add-Fence 'typescript'
  for ($i = 0; $i -lt $take; $i++) { AppendLine($lines[$i]) }
  End-Fence
}

# --- 3 ---
Add-H2 '3. Exports em src/lib/*.ts (linhas que começam por export)'
$libFiles = Get-ChildItem -Path (Join-Path $root 'src\lib') -Filter *.ts -File -ErrorAction SilentlyContinue | Sort-Object Name
foreach ($lf in $libFiles) {
  Add-H3 $lf.Name
  $content = [System.IO.File]::ReadAllLines($lf.FullName, [System.Text.Encoding]::UTF8)
  $ln = 0
  Add-Fence 'typescript'
  foreach ($line in $content) {
    $ln++
    if ($line -match '^\s*export\s') { AppendLine("${ln}: $line") }
  }
  End-Fence
}

# --- 4 ---
Add-H2 '4. Conteúdo completo dos arquivos críticos'
$critical = @(
  'src\components\dashboard\RadarDashboard.tsx'
  'src\components\dashboard\ProspeccaoResultados.tsx'
  'src\components\dashboard\InteligenciaDashboard.tsx'
)
foreach ($rel in $critical) {
  $full = Join-Path $root $rel
  if (-not (Test-Path $full)) { continue }
  $lineCount = @([System.IO.File]::ReadAllLines($full, [System.Text.Encoding]::UTF8)).Count
  Add-H3 "$rel ($lineCount linhas)"
  Add-Fence 'typescript'
  Append([System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n"))
  AppendLine ''
  End-Fence
}

# --- 5 ---
Add-H2 '5. Componente pai / navegação entre abas (telaAtiva)'
Add-H3 'grep activeTab / setActiveTab / tabAtiva em src/components/'
Add-Fence 'text'
$grepPaths = Get-ChildItem -Path (Join-Path $root 'src\components') -Recurse -Include *.tsx,*.ts -File -ErrorAction SilentlyContinue
$found = $false
foreach ($g in $grepPaths) {
  if (Select-String -Path $g.FullName -Pattern 'activeTab|setActiveTab|tabAtiva' -Quiet) {
    AppendLine ($g.FullName.Substring($root.Path.Length).TrimStart('\').Replace('\', '/'))
    $found = $true
  }
}
if (-not $found) { AppendLine '(nenhum resultado; o projeto usa telaAtiva / setTelaAtiva no useAppStore)' }
End-Fence

Add-H3 'src/App.tsx (completo)'
Add-Fence 'tsx'
Append([System.IO.File]::ReadAllText((Join-Path $root 'src\App.tsx'), [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n"))
AppendLine ''
End-Fence

Add-H3 'src/components/layout/Navbar.tsx (completo)'
Add-Fence 'tsx'
Append([System.IO.File]::ReadAllText((Join-Path $root 'src\components\layout\Navbar.tsx'), [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n"))
AppendLine ''
End-Fence

# UTF-8 com BOM para abrir corretamente no Notepad / VS Code no Windows
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8Bom)
Write-Host "OK: $outPath"
Write-Host "Bytes:" (Get-Item $outPath).Length
