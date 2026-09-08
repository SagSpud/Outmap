@echo off
chcp 65001 >nul
setlocal
title Outmap Cache Cleaner
cls
echo ====================================================
echo      Outmap Cache Deep Clean and Recovery Tool
echo ====================================================
echo.
echo [1/2] Checking runtime environment...

set "CLEAN_JS="
set "CLEAN_PS="

if exist "%~dp0scripts\cleanup-offline-cache.js" set "CLEAN_JS=%~dp0scripts\cleanup-offline-cache.js"
if exist "%~dp0cleanup-offline-cache.js" set "CLEAN_JS=%~dp0cleanup-offline-cache.js"

if exist "%~dp0scripts\cleanup-offline-cache.ps1" set "CLEAN_PS=%~dp0scripts\cleanup-offline-cache.ps1"
if exist "%~dp0cleanup-offline-cache.ps1" set "CLEAN_PS=%~dp0cleanup-offline-cache.ps1"

where node >nul 2>nul
if %errorlevel% equ 0 if defined CLEAN_JS (
    echo [2/2] Node.js detected. Running cleanup engine...
    node "%CLEAN_JS%"
    goto :done
)

if defined CLEAN_PS (
    echo [2/2] Running PowerShell cleanup engine...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CLEAN_PS%"
    goto :done
)

echo [Error] Cannot find cleanup-offline-cache.js or .ps1!
echo Please ensure the scripts folder or cleanup scripts exist in the current directory.

:done
echo.
echo ====================================================
echo  Cleanup finished successfully. Press any key to exit.
echo ====================================================
pause >nul
