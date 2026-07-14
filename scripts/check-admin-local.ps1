$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$EnvFile = Join-Path $ProjectRoot ".local\env\wechat-miniapp.local"
$AdminEnvFile = Join-Path $ProjectRoot ".local\env\admin.local"
$ApiUrl = "http://127.0.0.1:3000"
$AdminWebUrl = "http://127.0.0.1:3001"
$AdminLoginUrl = "$AdminWebUrl/login"

Set-Location $ProjectRoot

function Import-LocalEnv($Path) {
  if (-not (Test-Path $Path)) {
    Write-Host "本地环境变量文件不存在：$Path"
    return
  }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
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

function Test-Port($Port, $Label) {
  try {
    $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  } catch {
    $connections = @(netstat -ano | Select-String ":$Port\s+.*LISTENING")
  }
  if ($connections.Count -gt 0) {
    Write-Host "$Label：运行中"
  } else {
    Write-Host "$Label：未运行"
  }
}

function Test-Http($Url, $Label) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    Write-Host "$Label：正常（HTTP $($response.StatusCode)）"
  } catch {
    Write-Host "$Label：异常（$($_.Exception.Message)）"
  }
}

function Test-AdminLogin {
  try {
    $body = @{ username = $env:ADMIN_DEV_USERNAME; password = $env:ADMIN_DEV_PASSWORD } | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Uri "$ApiUrl/admin/auth/login" -UseBasicParsing -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
    Write-Host "后台登录接口：正常（HTTP $($response.StatusCode)）"
  } catch {
    Write-Host "后台登录接口：异常（$($_.Exception.Message)）"
  }
}

function Test-AdminUser {
  $env:ADMIN_DEV_USERNAME = if ($env:ADMIN_DEV_USERNAME) { $env:ADMIN_DEV_USERNAME } else { "admin" }
  $script = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.adminUser.count({
    where: { username: process.env.ADMIN_DEV_USERNAME || 'admin', isActive: true },
  });
  console.log(`本地管理员账号：${count >= 1 ? '存在' : '不存在'}`);
}
main()
  .catch(() => console.log('本地管理员账号：无法检查，请确认数据库已启动'))
  .finally(async () => prisma.$disconnect().catch(() => undefined));
'@
  $script | node
}

Import-LocalEnv $EnvFile

if (-not (Test-Path $AdminEnvFile)) {
  & (Join-Path $ScriptDir "ensure-admin-local-env.ps1")

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Import-LocalEnv $AdminEnvFile

Write-Host "== 绿膳荟本地后台状态检查 =="
Test-Port 3000 "API 端口 3000"
Test-Port 3001 "admin-web 端口 3001"
Test-Http "$ApiUrl/products" "商品接口 /products"
Test-AdminLogin
Test-Http $AdminLoginUrl "后台登录页 /login"
Test-AdminUser

Write-Host ""
Write-Host "后台地址：http://127.0.0.1:3001/login"
Write-Host "本地账号：$env:ADMIN_DEV_USERNAME"
Write-Host "本地密码：$env:ADMIN_DEV_PASSWORD"
Write-Host ""
Write-Host "如果发现异常："
Write-Host "1. 请先双击“停止绿膳荟后台.bat”"
Write-Host "2. 再双击“打开绿膳荟后台.bat”"
Write-Host "3. 如果页面没有样式，请双击“修复后台显示异常.bat”"
