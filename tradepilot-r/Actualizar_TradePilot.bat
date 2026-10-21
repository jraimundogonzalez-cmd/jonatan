@echo off
setlocal
REM ===================================================================
REM  TradePilot - actualizar la base de datos SIN borrar datos.
REM
REM  Ejecutalo una vez despues de descargar una version nueva del proyecto.
REM  Antes de cambiar nada hace una copia de seguridad completa y la
REM  verifica; despues aplica solo lo que falta y comprueba que siguen todas
REM  las filas. Se para y avisa si algo no cuadra.
REM
REM  NUNCA ejecuta `supabase db reset` ni borra volumenes de Docker.
REM  La logica esta en scripts\windows\actualizar.ps1.
REM ===================================================================
cd /d "%~dp0"
where powershell >nul 2>&1
if errorlevel 1 goto sin_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\actualizar.ps1"
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
