@echo off
setlocal
REM ===================================================================
REM  TradePilot - prueba que la ultima copia de seguridad se RESTAURA.
REM
REM  La restaura en una base TEMPORAL nueva (tp_prueba_restauracion_...),
REM  compara las filas tabla a tabla y borra solo esa base temporal. Tu base
REM  de datos no se toca. La logica esta en scripts\windows\probar-restauracion.ps1.
REM ===================================================================
cd /d "%~dp0"
where powershell >nul 2>&1
if errorlevel 1 goto sin_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\probar-restauracion.ps1"
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
