# Actualiza la base de datos local de TradePilot SIN borrar datos.
# Uso normal: doble clic en Actualizar_TradePilot.bat
#
# Pasos, y en cada uno se para si algo no cuadra (sin haber tocado nada que no
# se pueda deshacer con la copia):
#   1. Diagnostico de solo lectura (el mismo de Diagnosticar_TradePilot.bat).
#      Se NIEGA a seguir si la base tiene migraciones u objetos que este
#      codigo no conoce, si le falta algo que su historial dice tener, o si no
#      tiene ninguna Cuenta: base y codigo no son de la misma linea de trabajo.
#   2. Pide confirmacion.
#   3. Copia de seguridad completa y verificada.
#   4. Aplica SOLO las migraciones pendientes (`supabase migration up`).
#   5. Reinstala las funciones de TradePilot (solo funciones y permisos; no
#      tocan filas), cada fichero en una unica transaccion.
#   6. Vuelve a contar las filas de todas las tablas de la copia: deben seguir
#      siendo las mismas.
# Dependencias: docker y supabase en Windows; psql, pg_dump y pg_restore
# dentro del contenedor. Ninguna herramienta Unix.
#
# Nunca ejecuta `supabase db reset`, ni borra volumenes, ni restaura nada.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

# Ficheros de funciones, en el orden declarado en supabase/config.toml
# ([db.seed] sql_paths). Se leen de ahi para no mantener dos listas.
function Get-FicherosDeFunciones {
  $toml = Get-Content -Raw -Path (Join-Path $script:Raiz 'supabase/config.toml')
  $bloque = [regex]::Match($toml, '(?s)sql_paths\s*=\s*\[(.*?)\]')
  if (-not $bloque.Success) { throw 'No encuentro sql_paths en supabase/config.toml.' }
  $rutas = @([regex]::Matches($bloque.Groups[1].Value, '"\./(functions/sql/[A-Za-z0-9_\-]+\.sql)"') | ForEach-Object { $_.Groups[1].Value })
  if ($rutas.Count -eq 0) { throw 'sql_paths de supabase/config.toml no lista ningun fichero de funciones.' }
  foreach ($r in $rutas) {
    if (-not (Test-Path (Join-Path $script:Raiz "supabase/$r"))) { throw "Falta el fichero supabase/$r" }
  }
  return $rutas
}

Write-Host ''
Write-Host '  ================================================'
Write-Host '     TradePilot - actualizar la base de datos'
Write-Host '     (no borra datos; hace una copia antes)'
Write-Host '  ================================================'

$respaldo = $null
try {
  Assert-Entorno

  Write-Paso 'Diagnostico de solo lectura: historial, esquema y filas...'
  $diag = Get-Diagnostico
  if ($diag.Bloqueos.Count -gt 0) {
    Write-Host ''
    $informe = Write-Diagnostico $diag
    Write-Host ''
    Write-Fallo 'La actualizacion esta BLOQUEADA. No se ha tocado nada.'
    Write-Host "       Informe: $informe"
    Write-Host '       Si tu base tiene trabajo que no esta en esta version, hay que'
    Write-Host '       recuperarlo antes de actualizar, no pisarlo.'
    exit 2
  }
  $estado = $diag.Estado
  foreach ($a in $diag.Avisos) { Write-Aviso $a }
  Write-Ok "Migraciones ya aplicadas: $($estado.Aplicadas.Count); ningun objeto desconocido en tu base"
  if ($estado.Pendientes.Count -eq 0) {
    Write-Ok 'No falta ninguna migracion'
  } else {
    Write-Host '       Pendientes de aplicar:'
    $estado.Pendientes | ForEach-Object { Write-Host "         $($_.Nombre)" }
  }
  $funciones = Get-FicherosDeFunciones
  Write-Host '       Funciones que se reinstalaran (no tocan datos):'
  $funciones | ForEach-Object { Write-Host "         $_" }

  Write-Host ''
  if (-not (Read-Confirmacion 'Primero se hara una copia de seguridad verificada. Continuar?')) {
    Write-Aviso 'Cancelado. No se ha hecho nada.'
    exit 0
  }

  $respaldo = New-RespaldoVerificado

  if ($estado.Pendientes.Count -gt 0) {
    Write-Paso 'Aplicando solo las migraciones pendientes...'
    $r = Invoke-Externo $script:Supabase @('migration', 'up', '--local')
    foreach ($linea in $r.Salida) { Write-Host "       $linea" }
    if ($r.Codigo -ne 0) { throw 'supabase migration up ha fallado.' }
    $despues = Get-EstadoMigraciones
    if ($despues.Pendientes.Count -gt 0) {
      throw ('Siguen pendientes: ' + (($despues.Pendientes | ForEach-Object { $_.Nombre }) -join ', '))
    }
    Write-Ok 'Migraciones aplicadas'
  }

  Write-Paso 'Reinstalando las funciones de TradePilot...'
  foreach ($rel in $funciones) {
    $nombre = Split-Path -Leaf $rel
    $r = Invoke-Externo $script:Docker @('cp', (Join-Path $script:Raiz "supabase/$rel"), "$($script:Contenedor):/tmp/$nombre")
    if ($r.Codigo -ne 0) { throw ("No he podido copiar $nombre al contenedor:`n" + ($r.Salida -join "`n")) }
    $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', "/tmp/$nombre")
    if ($r.Codigo -ne 0) { throw ("$nombre ha fallado (su transaccion se ha deshecho entera):`n" + ($r.Salida -join "`n")) }
    Write-Ok $nombre
  }

  Write-Paso 'Comprobando que no se ha perdido ni una fila...'
  $null = Test-RespaldoContraBase
  Write-Ok 'Mismas filas que antes de actualizar'

  $faltan = Invoke-Sql "select count(*) from (values ('listar_empresas'),('registrar_operacion'),('confirmar_importacion'),('listar_lotes_importacion')) v(f) where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v.f)"
  if (@($faltan)[0] -ne '0') { throw 'Despues de actualizar siguen faltando funciones de TradePilot.' }
  Write-Ok 'Funciones de TradePilot disponibles'

  Write-Host ''
  Write-Host '  ================================================'
  Write-Host '     Actualizacion terminada. Tus datos siguen ahi.'
  Write-Host '  ================================================'
  Write-Host "     Copia de antes de actualizar: $respaldo"
  exit 0
} catch {
  Write-Host ''
  Write-Fallo "$_"
  if ($respaldo) {
    Write-Host "       Tienes una copia verificada de antes del cambio: $respaldo"
    Write-Host '       No intentes arreglarlo con supabase db reset: borraria tus datos.'
    Write-Host '       Copia este mensaje y pide ayuda.'
  } else {
    Write-Host '       No se ha modificado nada en la base de datos.'
  }
  exit 1
}
