@echo off
setlocal
cd /d "%~dp0"

REM ===================================================================
REM  TradePilot - apagado limpio.
REM
REM  NO BORRA NADA. `supabase stop` conserva la base de datos: la proxima
REM  vez que abras TradePilot, tus cuentas y operaciones seguiran ahi. El
REM  borrado solo ocurriria con la opcion --no-backup, que aqui no se usa.
REM ===================================================================

echo.
echo   ================================================
echo      TradePilot - apagando
echo   ================================================
echo.

REM --- 1. Parar la aplicacion web -------------------------------------
REM  Se paran SOLO los procesos de Node que ejecutan Next.js DESDE ESTA
REM  CARPETA. Antes bastaba con que la linea de comandos contuviese "next",
REM  lo que tambien cerraba otros proyectos Next.js que tuvieras abiertos.
REM  La ruta se pasa por variable de entorno y se compara como texto (no con
REM  -like): una ruta con corchetes o parentesis no se interpreta como patron.
set "TP_DIR=%~dp0"
echo   [ ] Parando la aplicacion web...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d = $env:TP_DIR; $p = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($d, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $_.CommandLine.IndexOf('next', [StringComparison]::OrdinalIgnoreCase) -ge 0 };" ^
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
