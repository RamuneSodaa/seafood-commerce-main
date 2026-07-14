$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$EnvDir = Join-Path $ProjectRoot ".local\env"
$AdminEnvFile = Join-Path $EnvDir "admin.local"

New-Item -ItemType Directory -Force -Path $EnvDir | Out-Null

if (Test-Path $AdminEnvFile) {
  Write-Host "本地管理员配置已经存在：$AdminEnvFile"
  exit 0
}

function New-RandomHex([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $rng.GetBytes($bytes)
  }
  finally {
    $rng.Dispose()
  }

  return -join (
    $bytes |
      ForEach-Object {
        $_.ToString("x2")
      }
  )
}

$AdminPassword = New-RandomHex 12
$AdminSecret = New-RandomHex 32

@"
# Local-only administrator credentials.
# This file is ignored by Git.

export ADMIN_DEV_USERNAME='admin'
export ADMIN_DEV_PASSWORD='$AdminPassword'
export ADMIN_DEV_DISPLAY_NAME='本地管理员'
export ADMIN_AUTH_SECRET='$AdminSecret'
"@ | Set-Content -Encoding UTF8 $AdminEnvFile

Write-Host ""
Write-Host "本地管理员配置已生成：$AdminEnvFile"
Write-Host "用户名：admin"
Write-Host "本地密码：$AdminPassword"
Write-Host "请只保存在本机，不要上传到 GitHub。"
