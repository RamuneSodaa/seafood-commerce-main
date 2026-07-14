$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$EnvFile = Join-Path $ProjectRoot ".local\env\wechat-miniapp.local"
$AdminEnvFile = Join-Path $ProjectRoot ".local\env\admin.local"
$RuntimeDir = Join-Path $ProjectRoot ".local\runtime\admin-local-windows"
$ApiPidFile = Join-Path $RuntimeDir "api.pid"
$AdminWebPidFile = Join-Path $RuntimeDir "admin-web.pid"
$ApiLogFile = Join-Path $RuntimeDir "api.log"
$AdminWebLogFile = Join-Path $RuntimeDir "admin-web.log"
$ApiUrl = "http://127.0.0.1:3000"
$AdminWebUrl = "http://127.0.0.1:3001"
$AdminLoginUrl = "$AdminWebUrl/login"

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-Step($Message) {
  Write-Host ""
  Write-Host "== $Message =="
}

function Require-Command($Name, $Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host $Hint
    exit 1
  }
}

function Import-LocalEnv($Path) {
  if (-not (Test-Path $Path)) {
    Write-Host "找不到本地环境变量文件：$Path"
    Write-Host "缺少本地环境配置文件，请联系开发同事，不要自己新建。"
    exit 1
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    if ($line -match '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $key = $Matches[1]
      $value = $Matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}

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
    if ($process) {
      return [string]$process.CommandLine
    }
  } catch {
    return ""
  }
  return ""
}

function Test-ProjectProcess($ProcessId) {
  $commandLine = Get-ProcessCommandLine $ProcessId
  if (-not $commandLine) {
    return $false
  }

  $normalizedRoot = ([string]$ProjectRoot).ToLowerInvariant()
  $normalizedCommand = $commandLine.ToLowerInvariant()
  return $normalizedCommand.Contains($normalizedRoot.ToLowerInvariant()) -or
    $normalizedCommand.Contains("apps\api") -or
    $normalizedCommand.Contains("apps/admin-web") -or
    $normalizedCommand.Contains("admin-web") -or
    $normalizedCommand.Contains("@seafood/api")
}

function Assert-PortFree($Port, $Label) {
  $pids = @(Get-PortProcessIds $Port | Where-Object { $_ })
  if ($pids.Count -eq 0) {
    return
  }

  $hasProjectProcess = $false
  foreach ($pid in $pids) {
    if (Test-ProjectProcess $pid) {
      $hasProjectProcess = $true
    }
  }

  if ($hasProjectProcess) {
    Write-Host "$Label 端口 $Port 已被本项目旧服务占用，请先双击“停止绿膳荟后台.bat”。"
    Write-Host "停止后再重新双击打开后台。"
  } else {
    Write-Host "$Label 端口 $Port 已被其他程序占用，请不要随便关闭。"
    Write-Host "请截图发给开发同事处理。"
  }
  exit 1
}

function Wait-Http($Url, $Label, $Attempts = 60) {
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "$Label 已可访问：$Url"
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
      continue
    }
    Start-Sleep -Seconds 1
  }

  Write-Host "$Label 暂时不可访问：$Url"
  return $false
}

function Ensure-DevAdminUser {
  $script = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.adminUser.findMany({
    select: { username: true, displayName: true, role: true, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  const devAdmin = users.find((user) => user.username === process.env.ADMIN_DEV_USERNAME && user.isActive);
  console.log(`AdminUser count: ${users.length}`);
  console.log(`Dev admin exists: ${devAdmin ? 'yes' : 'no'}`);
  if (users.length < 1 || !devAdmin) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
'@
  $script | node
  if ($LASTEXITCODE -ne 0) {
    throw "本地管理员账号未正确创建，请检查 seed 输出。"
  }
}

function Test-AdminLogin {
  try {
    $body = @{ username = $env:ADMIN_DEV_USERNAME; password = $env:ADMIN_DEV_PASSWORD } | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Uri "$ApiUrl/admin/auth/login" -UseBasicParsing -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
      Write-Host "后台管理员登录接口验证通过。"
      return $true
    }
  } catch {
    Write-Host "后台管理员登录接口验证失败：$($_.Exception.Message)"
    return $false
  }
  return $false
}

function Start-NpmProcess($Arguments, $LogFile) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction Stop
  }
  $errorLogFile = "$LogFile.err"
  New-Item -ItemType File -Force -Path $LogFile | Out-Null
  New-Item -ItemType File -Force -Path $errorLogFile | Out-Null
  return Start-Process -FilePath $npmCommand.Source -ArgumentList $Arguments -WorkingDirectory $ProjectRoot -RedirectStandardOutput $LogFile -RedirectStandardError $errorLogFile -PassThru -WindowStyle Hidden
}

function Stop-ProcessTree($ProcessId) {
  try {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      Stop-ProcessTree $child.ProcessId
    }
    Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
  } catch {
    # 本地清理失败不影响脚本退出。
  }
}

$ApiProcess = $null
$AdminWebProcess = $null

try {
  Require-Command "node" "这台电脑还没有安装运行环境，请联系开发同事安装 Node.js 后再使用。"
  Require-Command "npm" "这台电脑还没有安装运行环境，请联系开发同事安装 Node.js 后再使用。"
  Require-Command "npx" "这台电脑还没有安装运行环境，请联系开发同事安装 Node.js 后再使用。"

  Import-LocalEnv $EnvFile

  if (-not (Test-Path $AdminEnvFile)) {
    & (Join-Path $ScriptDir "ensure-admin-local-env.ps1")
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }

  Import-LocalEnv $AdminEnvFile
  $env:NEXT_PUBLIC_API_BASE = $ApiUrl

  Write-Step "检查本地端口"
  Assert-PortFree 3000 "API"
  Assert-PortFree 3001 "admin-web"

  Write-Step "同步本地数据库结构"
  & npx prisma db push
  if ($LASTEXITCODE -ne 0) { throw "prisma db push 失败。" }

  Write-Step "写入本地种子数据"
  & npx prisma db seed
  if ($LASTEXITCODE -ne 0) { throw "prisma db seed 失败。" }

  Write-Step "确认本地管理员账号"
  Ensure-DevAdminUser

  Write-Step "启动 API 服务"
  $ApiProcess = Start-NpmProcess @("run", "start", "-w", "@seafood/api") $ApiLogFile
  Set-Content -Path $ApiPidFile -Value $ApiProcess.Id

  if (-not (Wait-Http "$ApiUrl/products" "API 商品接口" 60)) {
    Write-Host "API 服务启动失败，请查看日志：$ApiLogFile"
    exit 1
  }

  if (-not (Test-AdminLogin)) {
    Write-Host "后台登录验证失败，请确认 seed 已创建本地管理员。"
    exit 1
  }

  Write-Step "启动 admin-web 服务"
  $AdminWebProcess = Start-NpmProcess @("run", "dev", "-w", "@seafood/admin-web", "--", "-H", "127.0.0.1", "-p", "3001") $AdminWebLogFile
  Set-Content -Path $AdminWebPidFile -Value $AdminWebProcess.Id

  if (-not (Wait-Http $AdminLoginUrl "admin-web 登录页" 90)) {
    Write-Host "admin-web 服务启动失败，请查看日志：$AdminWebLogFile"
    exit 1
  }

  Write-Host ""
  Write-Host "后台已启动"
  Write-Host "地址：http://127.0.0.1:3001/login"
  Write-Host "账号：$env:ADMIN_DEV_USERNAME"
  Write-Host "密码：$env:ADMIN_DEV_PASSWORD"
  Write-Host "停止方式：双击“停止绿膳荟后台.bat”或在当前窗口按 Ctrl+C"

  try {
    Start-Process $AdminLoginUrl | Out-Null
  } catch {
    Write-Host "无法自动打开浏览器，请手动访问：$AdminLoginUrl"
  }

  while ($true) {
    if ($ApiProcess.HasExited) {
      Write-Host "API 服务已退出，正在关闭本地商家后台。"
      exit 1
    }
    if ($AdminWebProcess.HasExited) {
      Write-Host "admin-web 服务已退出，正在关闭本地商家后台。"
      exit 1
    }
    Start-Sleep -Seconds 2
  }
} finally {
  if ($AdminWebProcess -and -not $AdminWebProcess.HasExited) {
    Stop-ProcessTree $AdminWebProcess.Id
  }
  if ($ApiProcess -and -not $ApiProcess.HasExited) {
    Stop-ProcessTree $ApiProcess.Id
  }
  Remove-Item $AdminWebPidFile, $ApiPidFile -ErrorAction SilentlyContinue
}
