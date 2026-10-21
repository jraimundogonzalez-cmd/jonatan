@echo off
setlocal
REM ===================================================================
REM  Crea en el Escritorio los accesos directos de TradePilot:
REM    TradePilot - Abrir, TradePilot - Cerrar,
REM    TradePilot - Copia de seguridad, TradePilot - Diagnosticar,
REM    TradePilot - Actualizar
REM  Solo crea accesos directos; no toca la base de datos ni el proyecto.
REM  Si mueves la carpeta del proyecto, vuelve a ejecutarlo.
REM ===================================================================
cd /d "%~dp0"
where powershell >nul 2>&1
if errorlevel 1 goto sin_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\accesos-directos.ps1"
echo.
pause
exit /b 0

:sin_powershell
echo.
echo   [X] No encuentro PowerShell, que viene con Windows.
echo.
pause
exit /b 1
