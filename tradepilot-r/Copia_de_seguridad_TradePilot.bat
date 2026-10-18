@echo off
setlocal
REM ===================================================================
REM  TradePilot - copia de seguridad verificada de la base de datos local.
REM
REM  Solo LEE la base. Guarda la copia en la carpeta "respaldos" de este
REM  proyecto (no se sube nunca a git) y comprueba que tiene las mismas filas
REM  que la base. La logica esta en scripts\windows\respaldo.ps1.
REM ===================================================================
cd /d "%~dp0"
where powershell >nul 2>&1
if errorlevel 1 goto sin_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\respaldo.ps1"
set "TP_CODIGO=%errorlevel%"
echo.
pause
exit /b %TP_CODIGO%

:sin_powershell
echo.
echo   [X] No encuentro PowerShell, que viene con Windows. No se ha hecho nada.
echo.
pause
exit /b 1
