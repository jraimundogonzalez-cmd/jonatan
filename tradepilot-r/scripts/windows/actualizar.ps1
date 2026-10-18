# Actualiza la base de datos local de TradePilot SIN borrar datos.
# Uso normal: doble clic en Actualizar_TradePilot.bat
#
# Pasos, y en cada uno se para si algo no cuadra (sin haber tocado nada que no
# se pueda deshacer con la copia):
#   1. Comprueba, solo leyendo, que migraciones tiene la base y cuales faltan.
#      Se NIEGA a seguir si la base tiene migraciones que este codigo no
#      conoce, o si falta alguna antigua: eso significa que base y codigo no
#      son de la misma linea de trabajo.
#   2. Pide confirmacion.
#   3. Copia de seguridad completa y verificada.
#   4. Aplica SOLO las migraciones pendientes (`supabase migration up`).
#   5. Reinstala las funciones de TradePilot (solo funciones y permisos; no
#      tocan filas), cada fichero en una unica transaccion.
#   6. Vuelve a contar las filas de todas las tablas de la copia: deben seguir
#      siendo las mismas.
#
# Nunca ejecuta `supabase db reset`, ni borra volumenes, ni restaura nada.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

function Get-EstadoMigraciones {
  $ficheros = @(Get-ChildItem -Path (Join-Path $script:Raiz 'supabase/migrations') -Filter '*.sql' |
    Where-Object { $_.Name -match '^(\d+)_' } |
    ForEach-Object { [pscustomobject]@{ Version = ($_.Name -split '_')[0]; Nombre = $_.Name } } |
    Sort-Object Version)

  $existe = Invoke-Sql "select to_regclass('supabase_migrations.schema_migrations') is not null"
  if (@($existe)[0] -ne 't') {
    throw 'No encuentro el historial de migraciones de la base (supabase_migrations.schema_migrations). No puedo saber que le falta, asi que no toco nada.'
  }
  $aplicadas = @(Invoke-Sql 'select version from supabase_migrations.schema_migrations order by version')

  $versionesFichero = @($ficheros | ForEach-Object { $_.Version })
  $desconocidas = @($aplicadas | Where-Object { $versionesFichero -notcontains $_ })
  $pendientes = @($ficheros | Where-Object { $aplicadas -notcontains $_.Version })
  $ultimaAplicada = if ($aplicadas.Count -gt 0) { ($aplicadas | Sort-Object)[-1] } else { '' }
  $fueraDeOrden = @($pendientes | Where-Object { $_.Version -lt $ultimaAplicada })

  return [pscustomobject]@{
    Aplicadas = $aplicadas
    Pendientes = $pendientes
    Desconocidas = $desconocidas
    FueraDeOrden = $fueraDeOrden
  }
}

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

  Write-Paso 'Comprobando que le falta a la base (solo lectura)...'
  $estado = Get-EstadoMigraciones
  if ($estado.Desconocidas.Count -gt 0) {
    Write-Fallo 'Tu base de datos tiene migraciones que este codigo NO conoce:'
    $estado.Desconocidas | ForEach-Object { Write-Host "         $_" }
    Write-Host '       Puede que tu base contenga trabajo que no esta en esta version del'
    Write-Host '       proyecto. No toco nada. Avisa antes de seguir: ese trabajo hay que'
    Write-Host '       recuperarlo, no pisarlo.'
    exit 2
  }
  if ($estado.FueraDeOrden.Count -gt 0) {
    Write-Fallo 'Faltan migraciones ANTERIORES a otras ya aplicadas:'
    $estado.FueraDeOrden | ForEach-Object { Write-Host "         $($_.Nombre)" }
    Write-Host '       Base y codigo no son de la misma linea de trabajo. No toco nada.'
    exit 2
  }
  Write-Ok "Migraciones ya aplicadas: $($estado.Aplicadas.Count)"
  if ($estado.Pendientes.Count -eq 0) {
    Write-Ok 'No falta ninguna migracion'
  } else {
    Write-Host '       Pendientes de aplicar (todas aditivas segun el proyecto):'
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
  Test-RespaldoContraBase -Dump '/tmp/tradepilot-respaldo.dump'
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
