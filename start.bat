@echo off
title Police Guardian - Start
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm not found. Install Node.js first, then run: npm install -g pnpm
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [JXHH] First run, installing dependencies, please wait...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Dependency install failed. Check network and retry.
        pause
        exit /b 1
    )
)

echo [JXHH] Starting frontend + backend...
echo   Frontend  http://localhost:5173
echo   Backend   http://localhost:3000/api
echo   Stop      close this window, or run stop.bat
echo   Browser   opens automatically in a few seconds
echo.

rem Auto-open the frontend in the default browser after the dev server is ready
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:5173'"

call pnpm dev
pause
