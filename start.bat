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

rem 1) Clean up any leftover processes from the previous run (ports + project dev processes)
echo [JXHH] Checking for leftover processes from the last run...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = @(); $pids += Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; $pids += Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'policehagent|concurrently|nest|vite' } | Select-Object -ExpandProperty ProcessId; $pids = $pids | Where-Object { $_ } | Sort-Object -Unique; if ($pids.Count -gt 0) { foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }; Write-Host ('[JXHH] Closed ' + $pids.Count + ' leftover process(es).') } else { Write-Host '[JXHH] No leftover process found.' }"
rem wait ~2s for killed processes to release the ports
ping -n 3 127.0.0.1 >nul

rem 2) Install dependencies on first run
if not exist node_modules (
    echo [JXHH] First run, installing dependencies, please wait...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Dependency install failed. Check network and retry.
        pause
        exit /b 1
    )
)

rem 3) Start servers
echo [JXHH] Starting frontend + backend...
echo   Frontend  http://localhost:5173
echo   Backend   http://localhost:3000/api
echo   Stop      close this window, or run stop.bat
echo   Browser   opens automatically in a few seconds
echo.

rem 4) Auto-open the frontend in the default browser after the dev server is ready
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:5173'"

call pnpm dev
pause
