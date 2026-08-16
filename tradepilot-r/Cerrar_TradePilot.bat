@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

REM ===================================================================
REM  TradePilot — apagado limpio.
REM
REM  NO BORRA NADA. `supabase stop` conserva la base de datos: la proxima
REM  vez que abras TradePilot, tus cuentas y operaciones seguiran ahi.
REM  Para empezar de cero hay que pedirlo a proposito con `supabase db reset`,
REM  y este archivo no lo hace nunca.
REM ===================================================================

echo.
echo   ================================================
echo      TradePilot — apagando
echo   ================================================
echo.

REM --- 1. Parar la aplicacion web -------------------------------------
REM  Se paran SOLO los procesos de Node que estan ejecutando la web de
REM  TradePilot. No se toca ningun otro Node que puedas tener abierto.
echo   [ ] Parando la aplicacion web...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*next*' -and $_.CommandLine -notlike '*Cerrar_TradePilot*' };" ^
  "if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } ; Write-Host '  [OK] Aplicacion web detenida' } else { Write-Host '  [OK] La aplicacion web no estaba en marcha' }"

REM --- 2. Parar la base de datos ---------------------------------------
echo   [ ] Parando la base de datos ^(sin borrar datos^)...
where supabase >nul 2>&1
if errorlevel 1 (
  echo   [!] No encuentro la herramienta de Supabase; la base de datos
  echo       puede seguir en marcha. Abrela desde Docker Desktop si quieres
  echo       pararla a mano.
) else (
  call supabase stop
)

echo.
echo   ================================================
echo      TradePilot apagado.
echo      Tus datos se conservan para la proxima vez.
echo   ================================================
echo.
pause
exit /b 0
