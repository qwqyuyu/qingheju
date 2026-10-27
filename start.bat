@echo off
chcp 65001 >nul
setlocal
where pwsh >nul 2>nul
if not errorlevel 1 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
)
if errorlevel 1 pause
endlocal
