# Utilidades compartidas por los scripts de Windows de TradePilot.
#
# Compatibilidad: Windows PowerShell 5.1 (el que trae Windows) y PowerShell 7.
# Solo ASCII en este fichero: PowerShell 5.1 lee un .ps1 sin BOM como ANSI y
# estropearia las tildes.
#
# Nada de lo que hay aqui borra datos. Las unicas escrituras en la base las
# hace actualizar.ps1, despues de una copia de seguridad verificada.
#
# Para probar estos scripts fuera de Windows, los comandos externos se pueden
# sustituir con variables de entorno: TP_DOCKER, TP_SUPABASE, TP_CONTENEDOR.

Set-StrictMode -Version 2.0

$script:Raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:Docker = if ($env:TP_DOCKER) { $env:TP_DOCKER } else { 'docker' }
$script:Supabase = if ($env:TP_SUPABASE) { $env:TP_SUPABASE } else { 'supabase' }
# Supabase nombra el contenedor de la base supabase_db_<project_id>, y
# project_id = "tradepilot-r" en supabase/config.toml.
$script:Contenedor = if ($env:TP_CONTENEDOR) { $env:TP_CONTENEDOR } else { 'supabase_db_tradepilot-r' }

function Write-Paso([string]$texto) { Write-Host ''; Write-Host "  [ ] $texto" }
function Write-Ok([string]$texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Write-Aviso([string]$texto) { Write-Host "  [!] $texto" -ForegroundColor Yellow }
function Write-Fallo([string]$texto) { Write-Host "  [X] $texto" -ForegroundColor Red }

# Ejecuta un programa externo y devuelve su salida (stdout y stderr juntos) y
# su codigo de salida. En PowerShell 5.1, con ErrorActionPreference=Stop, una
# linea en stderr de un programa externo lanza una excepcion; por eso se baja
# a Continue solo durante la llamada.
function Invoke-Externo {
  param([string]$Programa, [string[]]$Argumentos)
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $salida = & $Programa @Argumentos 2>&1 | ForEach-Object { "$_" }
    $codigo = $LASTEXITCODE
  } catch {
    $salida = @("$_")
    $codigo = 127
  } finally {
    $ErrorActionPreference = $anterior
  }
  if ($null -eq $codigo) { $codigo = 0 }
  return [pscustomobject]@{ Salida = @($salida); Codigo = [int]$codigo }
}

# Consulta de solo lectura en la base local. Devuelve las lineas de resultado.
# No usar comillas dobles dentro de $Sql (PowerShell 5.1 las pasa mal a los
# programas externos); las cadenas SQL van con comillas simples.
function Invoke-Sql {
  param([string]$Sql)
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
  if ($r.Codigo -ne 0) { throw ("La consulta a la base ha fallado:`n" + ($r.Salida -join "`n")) }
  return @($r.Salida | Where-Object { $_ -ne '' })
}

# Comprueba Docker y que el contenedor de la base esta en marcha. Si no lo
# esta, lo arranca con `supabase start`, que nunca borra datos.
function Assert-Entorno {
  Set-Location $script:Raiz
  if (-not (Test-Path (Join-Path $script:Raiz 'supabase\config.toml')) -and -not (Test-Path (Join-Path $script:Raiz 'supabase/config.toml'))) {
    throw "No encuentro supabase/config.toml en $($script:Raiz). Este script tiene que estar dentro de la carpeta tradepilot-r."
  }
  $info = Invoke-Externo $script:Docker @('info')
  if ($info.Codigo -ne 0) { throw 'Docker Desktop no esta en marcha. Abrelo, espera a que la ballena deje de moverse y vuelve a intentarlo.' }
  if (-not (Test-ContenedorActivo)) {
    Write-Paso 'La base de datos esta parada; arrancandola (no borra nada)...'
    $null = Invoke-Externo $script:Supabase @('start')
    if (-not (Test-ContenedorActivo)) {
      throw "No consigo arrancar la base de datos (contenedor $($script:Contenedor)). Abre TradePilot con Abrir_TradePilot.bat y mira el mensaje que da."
    }
  }
  Write-Ok "Base de datos en marcha ($($script:Contenedor))"
}

function Test-ContenedorActivo {
  $r = Invoke-Externo $script:Docker @('ps', '--filter', "name=^/$($script:Contenedor)$", '--format', '{{.Names}}')
  return ($r.Codigo -eq 0 -and (@($r.Salida) -contains $script:Contenedor))
}

# Copia de seguridad completa de la base, guardada en la carpeta respaldos\ del
# proyecto (excluida de git), y verificada antes de dar nada por bueno:
#   1. la copia local es identica byte a byte a la generada (SHA-256);
#   2. cada tabla con datos tiene en la copia las mismas filas que en la base.
# Devuelve la ruta del fichero. Lanza si cualquier comprobacion falla.
function New-RespaldoVerificado {
  $sello = Get-Date -Format 'yyyyMMdd-HHmmss'
  $carpeta = Join-Path $script:Raiz 'respaldos'
  if (-not (Test-Path $carpeta)) { $null = New-Item -ItemType Directory -Path $carpeta }
  $destino = Join-Path $carpeta "tradepilot-$sello.dump"
  $enContenedor = '/tmp/tradepilot-respaldo.dump'

  Write-Paso 'Haciendo la copia de seguridad completa...'
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '-f', $enContenedor)
  if ($r.Codigo -ne 0) { throw ("pg_dump ha fallado; no se ha cambiado nada:`n" + ($r.Salida -join "`n")) }
  $r = Invoke-Externo $script:Docker @('cp', "$($script:Contenedor):$enContenedor", $destino)
  if ($r.Codigo -ne 0 -or -not (Test-Path $destino)) { throw ("No he podido copiar la copia de seguridad al disco:`n" + ($r.Salida -join "`n")) }

  $hashLocal = (Get-FileHash -Algorithm SHA256 -Path $destino).Hash.ToLowerInvariant()
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'sha256sum', $enContenedor)
  $hashContenedor = if ($r.Codigo -eq 0 -and $r.Salida.Count -gt 0) { ($r.Salida[0] -split '\s+')[0].ToLowerInvariant() } else { '' }
  if ($hashLocal -ne $hashContenedor) { throw "La copia guardada en disco no coincide con la generada (SHA-256 distinto). No se ha cambiado nada." }
  Write-Ok "Copia guardada: $destino"

  Write-Paso 'Verificando la copia (filas por tabla, base frente a copia)...'
  Test-RespaldoContraBase -Dump $enContenedor
  Write-Ok 'Copia verificada: todos los recuentos coinciden'
  return $destino
}

# Compara, tabla a tabla, las filas de la base con las de una copia que esta
# dentro del contenedor. Solo lee. Lanza si algo no coincide.
function Test-RespaldoContraBase {
  param([string]$Dump)
  $script = Join-Path $script:Raiz 'scripts/respaldo/verificar-respaldo.sh'
  $r = Invoke-Externo $script:Docker @('cp', $script, "$($script:Contenedor):/tmp/verificar-respaldo.sh")
  if ($r.Codigo -ne 0) { throw ("No he podido preparar la verificacion:`n" + ($r.Salida -join "`n")) }
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'sh', '/tmp/verificar-respaldo.sh', $Dump)
  foreach ($linea in $r.Salida) { Write-Host "       $linea" }
  if ($r.Codigo -ne 0) { throw 'La copia NO coincide con la base.' }
}

function Read-Confirmacion([string]$pregunta) {
  if ($env:TP_NO_PREGUNTAR -eq '1') { return $true }
  $respuesta = Read-Host "  $pregunta (S/N)"
  return ($respuesta -match '^\s*[sS]')
}
