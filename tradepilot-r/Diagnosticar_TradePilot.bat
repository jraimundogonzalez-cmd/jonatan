@echo off
setlocal
REM ===================================================================
REM  TradePilot - diagnostico de SOLO LECTURA de la base de datos local.
REM
REM  Compara tu base con lo que espera esta version del codigo (historial
REM  de migraciones, tablas, columnas, funciones...) y cuenta las filas.
REM  No cambia nada: todas las consultas van en modo solo lectura. Deja un
REM  informe en la carpeta "diagnosticos". Ejecutalo ANTES de actualizar.
REM  La logica esta en scripts\windows\diagnostico.ps1.
REM ===================================================================
cd /d "%~dp0"
where powershell >nul 2>&1
if errorlevel 1 goto sin_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\diagnostico.ps1"
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
