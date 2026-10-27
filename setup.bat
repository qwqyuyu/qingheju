@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 没有找到 node，请先安装 Node.js 18+：https://nodejs.org/
    pause
    exit /b 1
)
node setup.js %*
if errorlevel 1 pause
endlocal
