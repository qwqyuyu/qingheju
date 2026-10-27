<#
    start.ps1 — 清和居一键启动脚本（Windows PowerShell）

    用法：
        .\start.ps1                  # 使用 server/app.js 里的默认端口（当前 3112）
        .\start.ps1 -Port 3210       # 指定端口
        .\start.ps1 -NoBrowser       # 不打开浏览器

    说明：
        * 会自动安装 server 依赖（仅首次）、读取 server\.env、检查端口和 MySQL。
        * 没有 MySQL 也能启动：静态页面可正常浏览，登录/发帖/签到等接口会返回 500。
        * 要配置数据库或 AI Key，在 server 目录下新建 .env，每行一个 KEY=VALUE。
#>
[CmdletBinding()]
param(
    [int]$Port = 0,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'
$appJs     = Join-Path $serverDir 'app.js'

function Write-Step { param($m) Write-Host "[清和居] $m" -ForegroundColor Cyan }
function Write-Warn { param($m) Write-Host "[警告]   $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[错误]   $m" -ForegroundColor Red }

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkYellow
Write-Host '        清 和 居 · 中医文化日常养生' -ForegroundColor DarkYellow
Write-Host '  ============================================' -ForegroundColor DarkYellow

# ---------- 1. Node ----------
Write-Step '检查运行环境…'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err '没有找到 node，请先安装 Node.js 18+：https://nodejs.org/'
    exit 1
}
$nodeVersion = (& node -v).Trim().TrimStart('v')
$major = 0
[void][int]::TryParse(($nodeVersion -split '\.')[0], [ref]$major)
Write-Step "Node.js $nodeVersion"
if ($major -lt 18) { Write-Warn "项目要求 Node 18+，当前 $nodeVersion 可能无法运行" }

if (-not (Test-Path $appJs)) {
    Write-Err "找不到后端入口：$appJs"
    exit 1
}

# 没指定端口时，沿用 server/app.js 里的默认端口（process.env.PORT || N）
if ($Port -le 0) {
    $Port = 3000
    $m = Select-String -Path $appJs -Pattern 'process\.env\.PORT\s*\|\|\s*(\d+)' | Select-Object -First 1
    if ($m) { $Port = [int]$m.Matches[0].Groups[1].Value }
}

# ---------- 2. 依赖 ----------
if (-not (Test-Path (Join-Path $serverDir 'node_modules\express'))) {
    Write-Step '首次运行，安装后端依赖（几分钟）…'
    Push-Location $serverDir
    try {
        if (Test-Path (Join-Path $serverDir 'package-lock.json')) {
            & npm ci --no-audit --no-fund
        } else {
            & npm install --no-audit --no-fund
        }
        if ($LASTEXITCODE -ne 0) { throw "npm 安装失败（退出码 $LASTEXITCODE）" }
    }
    finally { Pop-Location }
}

# ---------- 3. 读取 server\.env ----------
$envFile = Join-Path $serverDir '.env'
if (Test-Path $envFile) {
    Write-Step '读取 server\.env'
    Get-Content -LiteralPath $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $i = $line.IndexOf('=')
        if ($i -lt 1) { return }
        $key = $line.Substring(0, $i).Trim()
        $val = $line.Substring($i + 1).Trim()
        if ($val.Length -ge 2) {
            $q1 = $val.Substring(0, 1); $q2 = $val.Substring($val.Length - 1, 1)
            if (($q1 -eq '"' -and $q2 -eq '"') -or ($q1 -eq "'" -and $q2 -eq "'")) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }
        # 已存在的系统环境变量优先，不覆盖
        if (-not (Test-Path "env:$key")) { Set-Item -Path "env:$key" -Value $val }
    }
}
else {
    Write-Step '未找到 server\.env，使用代码内默认配置'
}

# ---------- 4. 端口 ----------
$env:PORT = "$Port"
$portBusy = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portBusy) {
    Write-Err "端口 $Port 已被占用。换一个端口：.\start.ps1 -Port 3210"
    exit 1
}

# ---------- 5. 数据库（MariaDB / MySQL） ----------
$dbHost = if ($env:MYSQLHOST) { $env:MYSQLHOST } elseif ($env:MYSQL_HOST) { $env:MYSQL_HOST } else { 'localhost' }
$dbPort = if ($env:MYSQLPORT) { [int]$env:MYSQLPORT } elseif ($env:MYSQL_PORT) { [int]$env:MYSQL_PORT } else { 3306 }
$dbName = if ($env:MYSQLDATABASE) { $env:MYSQLDATABASE } elseif ($env:MYSQL_DATABASE) { $env:MYSQL_DATABASE } else { 'qingheju' }

if (Test-NetConnection -ComputerName $dbHost -Port $dbPort -InformationLevel Quiet -WarningAction SilentlyContinue) {
    Write-Step "数据库已连接（MariaDB/MySQL）：$dbHost`:$dbPort / $dbName"
}
else {
    Write-Warn "连不上数据库（$dbHost`:$dbPort）。页面可以看，但接口会返回 500。"
    Write-Warn '请确认 MariaDB/MySQL 服务已启动，并导入过 server\schema.sql'
}

# ---------- 6. AI ----------
$aiKey = if ($env:AI_API_KEY) { $env:AI_API_KEY } else { $env:DASHSCOPE_API_KEY }
if (-not $aiKey -or -not $env:AI_BASE_URL -or -not $env:AI_MODEL) {
    Write-Warn 'AI 未配置完整（AI_API_KEY / AI_BASE_URL / AI_MODEL），AI 问诊会返回 503'
}
else {
    $aiFormat = if ($env:AI_FORMAT) { $env:AI_FORMAT } else { 'responses' }
    $aiStream = if ($env:AI_STREAM -eq 'false') { 'JSON' } else { '流式' }
    Write-Step "AI 已配置：$aiFormat / $($env:AI_MODEL) / $aiStream"
}

# ---------- 7. 鉴权 ----------
if (-not $env:JWT_SECRET -or $env:JWT_SECRET.Length -lt 32) {
    Write-Err 'JWT_SECRET 未配置或不足 32 位。请在 server\.env 里加一行 JWT_SECRET=<随机字符串>'
    Write-Err '可用 node -e "console.log(require(''crypto'').randomBytes(48).toString(''base64url''))" 生成'
    exit 1
}

# ---------- 8. 启动 ----------
Write-Host ''
Write-Step "启动后端 → http://localhost:$Port/  （首页 pages/index.html）"
Write-Step '按 Ctrl+C 停止服务'
Write-Host ''

if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($url)
        Start-Sleep -Seconds 3
        try { Start-Process $url } catch { }
    } -ArgumentList "http://localhost:$Port/" | Out-Null
}

Push-Location $serverDir
try {
    & node app.js
}
finally {
    Pop-Location
    Get-Job | Where-Object { $_.State -eq 'Running' } | Stop-Job
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
}
