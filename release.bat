@echo off
title JXHH Release
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1" %*
echo.
pause
