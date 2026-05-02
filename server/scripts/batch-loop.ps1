# batch-loop.ps1 - wrapper com watchdog por staleness de log.
#
# Lanca npx tsx server/scripts/batch-scores.ts ... em background, captura
# stdout/stderr para um ficheiro tail-able, e mata + relanca o processo se
# o log ficar parado por mais de StaleSeconds segundos. Sai limpo no
# primeiro exit-code 0.
#
# Parametros:
#   -StaleSeconds 120       mata se log nao cresceu em 120 s
#   -PollSeconds 10         checa o log a cada 10 s
#   -RestartDelaySeconds 10 espera entre tentativas
#   -ScoresFonte ...        passado para batch-scores.ts
#   -ExtraArgs @('--foo')   args adicionais
param(
  [int]$StaleSeconds = 120,
  [int]$PollSeconds = 10,
  [int]$RestartDelaySeconds = 10,
  [string]$ScoresFonte = 's31_v4_20260430',
  [string[]]$ExtraArgs = @('--all', '--ativos-only', '--force', '--skip-existing')
)

$ErrorActionPreference = 'Stop'

function Stop-ProcessTree {
  param([int]$RootPid)

  if ($RootPid -le 0) { return }
  $ts = { [datetime]::Now.ToString('yyyy-MM-dd HH:mm:ss') }

  # Camada 1: taskkill nativo com /T (tree) /F (force)
  $output = & taskkill.exe /PID $RootPid /T /F 2>&1
  Write-Host "[wrapper $(& $ts)] taskkill PID $RootPid : $output"

  # Camada 2: WMI walk + Stop-Process pra qualquer filho que sobrou
  Start-Sleep -Milliseconds 500
  $tree = @($RootPid)
  $queue = [System.Collections.Generic.Queue[int]]::new()
  $queue.Enqueue($RootPid)
  while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $current" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      $tree += $child.ProcessId
      $queue.Enqueue([int]$child.ProcessId)
    }
  }
  foreach ($pidToKill in $tree) {
    try { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue } catch {}
  }

  # Camada 3: sweep final de orfaos batch-scores
  Start-Sleep -Milliseconds 500
  $orphans = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'batch-scores' }
  foreach ($orphan in $orphans) {
    Write-Host "[wrapper $(& $ts)] kill orfao node.exe PID $($orphan.ProcessId)"
    Stop-Process -Id $orphan.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$logDir = Join-Path $env:TEMP 'batch-loop'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Write-WrapperLog {
  param([string]$Message)
  $ws = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Write-Host "[wrapper $ws] $Message"
}

$attempt = 0
while ($true) {
  $attempt++
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdoutFile = Join-Path $logDir "batch-$stamp-$attempt.out.log"
  $stderrFile = Join-Path $logDir "batch-$stamp-$attempt.err.log"

  $argList = @('tsx', 'server/scripts/batch-scores.ts') + $ExtraArgs + @('--scores-fonte', $ScoresFonte)

  Write-WrapperLog "tentativa #$attempt - npx $($argList -join ' ')"
  Write-WrapperLog "stdout=$stdoutFile"
  Write-WrapperLog "stderr=$stderrFile"

  $proc = Start-Process -FilePath 'npx.cmd' `
    -ArgumentList $argList `
    -RedirectStandardOutput $stdoutFile `
    -RedirectStandardError $stderrFile `
    -PassThru `
    -WindowStyle Hidden

  Write-WrapperLog "PID lancado=$($proc.Id)"

  $lastSize = -1L
  $lastChange = Get-Date
  $exit = $null
  $killedByWatchdog = $false

  while ($true) {
    if ($proc.HasExited) {
      $exit = $proc.ExitCode
      Write-WrapperLog "processo saiu com exit=$exit"
      break
    }

    Start-Sleep -Seconds $PollSeconds

    if (Test-Path $stdoutFile) {
      $size = (Get-Item $stdoutFile).Length
    } else {
      $size = 0L
    }

    if ($size -ne $lastSize) {
      $lastSize = $size
      $lastChange = Get-Date
      continue
    }

    $stale = (New-TimeSpan -Start $lastChange -End (Get-Date)).TotalSeconds
    if ($stale -ge $StaleSeconds) {
      Write-WrapperLog "log parado ha $([int]$stale)s (>= $StaleSeconds). A matar arvore PID $($proc.Id)."
      Stop-ProcessTree -RootPid $proc.Id
      Start-Sleep -Seconds 2
      $exit = -9
      $killedByWatchdog = $true
      break
    }
  }

  if ($exit -eq 0) {
    Write-WrapperLog "OK - batch concluiu com sucesso. A sair."
    break
  }

  if ($killedByWatchdog) {
    $retries = 0
    while ($retries -lt 5) {
      $remaining = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'batch-scores' }
      if (-not $remaining) { break }
      Write-WrapperLog "aguardando $($remaining.Count) processos batch-scores terminarem..."
      Start-Sleep -Seconds 2
      $retries++
    }
    if ($retries -eq 5) {
      $still = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'batch-scores' }
      if ($still) {
        Write-WrapperLog "AVISO: ainda ha processos batch-scores apos 5 tentativas. Continuando mesmo assim."
      }
    }
  }

  Write-WrapperLog "exit=$exit. A relancar em $RestartDelaySeconds s..."
  Start-Sleep -Seconds $RestartDelaySeconds
}