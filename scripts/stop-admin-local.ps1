$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$RuntimeDir = Join-Path $ProjectRoot ".local\runtime\admin-local-windows"
$ApiPidFile = Join-Path $RuntimeDir "api.pid"
$AdminWebPidFile = Join-Path $RuntimeDir "admin-web.pid"

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Get-PortProcessIds($Port) {
  try {
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $rows = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    return @($rows | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique)
  }
}

function Get-ProcessCommandLine($ProcessId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($process) { return [string]$process.CommandLine }
  } catch {
    return ""
  }
  return ""
}

function Test-ProjectProcess($ProcessId) {
  $commandLine = Get-ProcessCommandLine $ProcessId
  if (-not $commandLine) { return $false }
  $normalizedRoot = ([string]$ProjectRoot).ToLowerInvariant()
  $normalizedCommand = $commandLine.ToLowerInvariant()
  return $normalizedCommand.Contains($normalizedRoot.ToLowerInvariant()) -or
    $normalizedCommand.Contains("apps\api") -or
    $normalizedCommand.Contains("apps/admin-web") -or
    $normalizedCommand.Contains("admin-web") -or
    $normalizedCommand.Contains("@seafood/api")
}

function Stop-ProcessTree($ProcessId) {
  try {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      Stop-ProcessTree $child.ProcessId
    }
    Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
  } catch {
    # 温和停止失败时只提示，不强杀未知进程。
  }
}

function Stop-PidFile($PidFile, $Label) {
  if (-not (Test-Path $PidFile)) {
    Write-Host "$Label 没有记录 PID。"
    return $false
  }

  $pidValue = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (-not $pidValue -or -not (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
    Write-Host "$Label 进程已不在运行。"
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    return $false
  }

  if (-not (Test-ProjectProcess $pidValue)) {
    Write-Host "$Label PID $pidValue 不是本项目进程，已跳过，不会关闭。"
    return $false
  }

  Write-Host "正在停止 $Label，PID：$pidValue"
  Stop-ProcessTree $pidValue
  Start-Sleep -Seconds 1
  Remove-Item $PidFile -ErrorAction SilentlyContinue
  Write-Host "$Label 已停止。"
  return $true
}

function Stop-ProjectProcessOnPort($Port, $Label) {
  $pids = @(Get-PortProcessIds $Port | Where-Object { $_ })
  if ($pids.Count -eq 0) { return }

  $stoppedAny = $false
  foreach ($pidValue in $pids) {
    if (Test-ProjectProcess $pidValue) {
      Write-Host "$Label 端口 $Port 被本项目旧服务占用，正在温和停止 PID：$pidValue"
      Stop-ProcessTree $pidValue
      $stoppedAny = $true
    }
  }

  if (-not $stoppedAny) {
    Write-Host "$Label 端口 $Port 仍被占用，但不是本项目进程。"
    Write-Host "端口被其他程序占用，请不要随便关闭。"
  }
}

$stoppedAnyService = $false
if (Stop-PidFile $AdminWebPidFile "admin-web") { $stoppedAnyService = $true }
if (Stop-PidFile $ApiPidFile "API") { $stoppedAnyService = $true }

if (-not $stoppedAnyService) {
  Write-Host "后台当前没有运行。"
}

Stop-ProjectProcessOnPort 3001 "admin-web"
Stop-ProjectProcessOnPort 3000 "API"

Write-Host "停止检查完成。"
