# Prueba que una copia de seguridad se puede RESTAURAR, sin tocar tu base.
# Uso normal: doble clic en Probar_copia_de_seguridad_TradePilot.bat
#
# Que hace:
#   1. Toma la copia mas reciente de respaldos\ (o la que indiques con -Copia).
#   2. Crea una base TEMPORAL nueva, tp_prueba_restauracion_<fecha>, en el
#      mismo PostgreSQL. Tu base de datos (postgres) no se toca.
#   3. Restaura la copia en esa base temporal y compara, tabla a tabla, las
#      filas restauradas con las que contiene la copia.
#   4. Borra SOLO esa base temporal (se comprueba su nombre antes).
# Dependencias: psql y pg_restore dentro del contenedor; nada de Unix.
param([string]$Copia)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

$PatronTemporal = '^tp_prueba_restauracion_\d{8}_\d{6}$'

Write-Host ''
Write-Host '  ================================================'
Write-Host '     TradePilot - probar que una copia se restaura'
Write-Host '     (en una base temporal; tu base no se toca)'
Write-Host '  ================================================'
$temporal = $null
try {
  Assert-Entorno
  if (-not $Copia) {
    $ultima = Get-ChildItem -Path (Join-Path $script:Raiz 'respaldos') -Filter '*.dump' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
    if (-not $ultima) { throw 'No hay ninguna copia en respaldos\. Haz una con Copia_de_seguridad_TradePilot.bat.' }
    $Copia = $ultima.FullName
  }
  if (-not (Test-Path $Copia)) { throw "No existe la copia $Copia" }
  Write-Ok "Copia a probar: $Copia"
  $temporal = 'tp_prueba_restauracion_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
  Write-Host "       Se creara la base temporal $temporal y se borrara al terminar."
  if (-not (Read-Confirmacion 'Continuar?')) { $temporal = $null; Write-Aviso 'Cancelado. No se ha hecho nada.'; exit 0 }

  $enContenedor = '/tmp/tradepilot-prueba-restauracion.dump'
  $r = Invoke-Externo $script:Docker @('cp', $Copia, "$($script:Contenedor):$enContenedor")
  if ($r.Codigo -ne 0) { throw ("No he podido copiar la copia al contenedor:`n" + ($r.Salida -join "`n")) }

  Write-Paso "Creando la base temporal $temporal..."
  $null = Invoke-Sql "create database $temporal" -PermitirEscritura

  Write-Paso 'Restaurando la copia en la base temporal...'
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'pg_restore', '-U', 'postgres', '-d', $temporal, '--no-owner', '--no-privileges', $enContenedor)
  # En una base de Supabase pueden fallar objetos internos (extensiones,
  # esquemas del sistema) al restaurarlos en otra base. Se informa, pero lo
  # que decide es si los DATOS de public estan enteros.
  $errores = @($r.Salida | Where-Object { $_ -match 'error' })
  if ($errores.Count -gt 0) {
    Write-Aviso "pg_restore informo de $($errores.Count) lineas de error (normalmente objetos internos de Supabase):"
    $errores | Select-Object -First 8 | ForEach-Object { Write-Host "         $_" }
  }

  Write-Paso 'Comparando filas restauradas con las de la copia...'
  $lista = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'pg_restore', '--list', $enContenedor) -SinErrores
  $tablas = @($lista.Salida | ForEach-Object { if ($_ -match '^\d+;\s+\d+\s+\d+\s+TABLE DATA public (\S+)\s') { $Matches[1] } } | Sort-Object -Unique)
  if ($tablas.Count -eq 0) { throw 'La copia no contiene datos de ninguna tabla de public.' }
  $fallos = 0
  foreach ($t in $tablas) {
    $enCopia = Get-FilasEnCopia -Dump $enContenedor -Tabla $t
    $restauradas = [long](@(Invoke-Sql "select count(*) from public.$t" -BaseDatos $temporal)[0])
    $marca = if ($enCopia -eq $restauradas) { 'OK   ' } else { $fallos++; 'FALLO' }
    Write-Host ("       {0} {1,-30} copia={2,-7} restauradas={3}" -f $marca, $t, $enCopia, $restauradas)
  }
  if ($fallos -gt 0) { throw "La restauracion NO reproduce la copia en $fallos tablas." }
  Write-Host ''
  Write-Ok "La copia se restaura entera: $($tablas.Count) tablas con las mismas filas."
  $codigo = 0
} catch {
  Write-Host ''
  Write-Fallo "$_"
  $codigo = 1
} finally {
  if ($temporal -and $temporal -match $PatronTemporal) {
    try {
      $null = Invoke-Sql "drop database if exists $temporal" -PermitirEscritura
      Write-Host "       Base temporal $temporal eliminada. Tu base no se ha tocado."
    } catch {
      Write-Aviso "No he podido borrar la base temporal $temporal (no afecta a tus datos): $_"
    }
  }
}
exit $codigo
