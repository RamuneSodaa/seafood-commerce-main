$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$AdminNextDir = Join-Path $ProjectRoot "apps\admin-web\.next"

Set-Location $ProjectRoot

Write-Host "这是 Windows 本地开发缓存修复。"
Write-Host "它会停止本项目本地后台服务，并删除 admin-web 的 Next 本地缓存。"
Write-Host "不会删除数据库。"
Write-Host "不会删除 node_modules。"
Write-Host "不会删除 .local\env。"
Write-Host ""

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "scripts\stop-admin-local.ps1")

if (Test-Path $AdminNextDir) {
  Remove-Item $AdminNextDir -Recurse -Force
  Write-Host "已清理 admin-web 本地缓存：$AdminNextDir"
} else {
  Write-Host "admin-web 本地缓存不存在，无需清理。"
}

Write-Host "修复完成，请重新双击打开绿膳荟后台。"
