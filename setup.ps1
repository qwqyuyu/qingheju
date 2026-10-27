<#
    setup.ps1 — 清和居 · 配置向导（Windows）

    用法：
        .\setup.ps1              交互式填写数据库 / JWT / AI 配置
        .\setup.ps1 --check      只检查 server\.env 是否完整（0=可以启动）
        .\setup.ps1 --yes        非交互：保留已有值，缺的用默认值并自动生成 JWT

    实际逻辑在 setup.js（Node 实现，Windows / macOS / Linux 通用），
    本脚本只负责检查 Node 并转发参数。
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$setupJs = Join-Path $root 'setup.js'

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkYellow
Write-Host '        清 和 居 · 配置向导' -ForegroundColor DarkYellow
Write-Host '  ============================================' -ForegroundColor DarkYellow
Write-Host ''

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host '[错误] 没有找到 node，请先安装 Node.js 18+：https://nodejs.org/' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $setupJs)) {
    Write-Host "[错误] 找不到 $setupJs" -ForegroundColor Red
    exit 1
}

Push-Location $root
try {
    & node $setupJs @args
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
