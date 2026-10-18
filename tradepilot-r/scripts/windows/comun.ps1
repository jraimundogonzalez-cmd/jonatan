# Utilidades compartidas por los scripts de Windows de TradePilot.
#
# Compatibilidad: Windows PowerShell 5.1 (el que trae Windows) y PowerShell 7.
# Comprobado estaticamente con scripts/windows/pruebas/comprobar-ps51.ps1 y con
# la regla PSUseCompatibleSyntax de PSScriptAnalyzer. Solo ASCII en este
# fichero: PowerShell 5.1 lee un .ps1 sin BOM como ANSI y estropearia tildes.
#
# Dependencias: solo docker y supabase en Windows, y dentro del contenedor de
# la base solo psql, pg_dump y pg_restore (vienen con PostgreSQL). Ninguna
# herramienta Unix (sh, awk, sha256sum...): no estan garantizadas en la imagen.
#
# Nada de lo que hay aqui borra datos. Las lecturas van en modo solo lectura
# (default_transaction_read_only). Las unicas escrituras en la base las hace
# actualizar.ps1, despues de una copia de seguridad verificada.
#
# Para probar estos scripts fuera de Windows, los comandos externos se pueden
# sustituir con variables de entorno: TP_DOCKER, TP_SUPABASE, TP_CONTENEDOR.

Set-StrictMode -Version 2.0

$script:Raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:Docker = if ($env:TP_DOCKER) { $env:TP_DOCKER } else { 'docker' }
$script:Supabase = if ($env:TP_SUPABASE) { $env:TP_SUPABASE } else { 'supabase' }
# Supabase nombra el contenedor (y el volumen) de la base supabase_db_<project_id>,
# y project_id = "tradepilot-r" en supabase/config.toml.
$script:Contenedor = if ($env:TP_CONTENEDOR) { $env:TP_CONTENEDOR } else { 'supabase_db_tradepilot-r' }
$script:DumpContenedor = '/tmp/tradepilot-respaldo.dump'
$script:DumpVerificacion = '/tmp/tradepilot-verificacion.dump'
$script:SoloLectura = 'PGOPTIONS=-c default_transaction_read_only=on'

function Write-Paso([string]$texto) { Write-Host ''; Write-Host "  [ ] $texto" }
function Write-Ok([string]$texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Write-Aviso([string]$texto) { Write-Host "  [!] $texto" -ForegroundColor Yellow }
function Write-Fallo([string]$texto) { Write-Host "  [X] $texto" -ForegroundColor Red }

# Ejecuta un programa externo y devuelve su salida y su codigo de salida.
# -SinErrores descarta stderr (para leer un flujo de datos limpio). En
# PowerShell 5.1, con ErrorActionPreference=Stop, una linea en stderr de un
# programa externo lanza una excepcion; por eso se baja a Continue durante la
# llamada.
function Invoke-Externo {
  param([string]$Programa, [string[]]$Argumentos, [switch]$SinErrores)
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    if ($SinErrores) {
      $salida = & $Programa @Argumentos 2>$null | ForEach-Object { "$_" }
    } else {
      $salida = & $Programa @Argumentos 2>&1 | ForEach-Object { "$_" }
    }
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

# Consulta en la base local. Por defecto en SOLO LECTURA: PostgreSQL rechaza
# cualquier escritura de esa sesion. No usar comillas dobles dentro de $Sql
# (PowerShell 5.1 las pasa mal a los programas externos).
function Invoke-Sql {
  param([string]$Sql, [switch]$PermitirEscritura, [string]$BaseDatos = 'postgres')
  $argumentos = @('exec')
  if (-not $PermitirEscritura) { $argumentos += @('-e', $script:SoloLectura) }
  $argumentos += @($script:Contenedor, 'psql', '-U', 'postgres', '-d', $BaseDatos, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', $Sql)
  $r = Invoke-Externo $script:Docker $argumentos
  if ($r.Codigo -ne 0) { throw ("La consulta a la base ha fallado:`n" + ($r.Salida -join "`n")) }
  return @($r.Salida | Where-Object { $_ -ne '' })
}

function Test-ContenedorActivo {
  $r = Invoke-Externo $script:Docker @('ps', '--filter', "name=^/$($script:Contenedor)$", '--format', '{{.Names}}')
  return ($r.Codigo -eq 0 -and (@($r.Salida) -contains $script:Contenedor))
}

# Comprueba Docker y que el contenedor de la base esta en marcha. NO la
# arranca: si `supabase start` no encontrase el volumen de tus datos, crearia
# una base nueva y vacia, y ningun script debe trabajar sobre ella creyendo
# que es la tuya. Arrancar es cosa de Abrir_TradePilot.bat.
function Assert-Entorno {
  Set-Location $script:Raiz
  if (-not (Test-Path (Join-Path $script:Raiz 'supabase/config.toml'))) {
    throw "No encuentro supabase/config.toml en $($script:Raiz). Este script tiene que estar dentro de la carpeta tradepilot-r."
  }
  $info = Invoke-Externo $script:Docker @('info')
  if ($info.Codigo -ne 0) { throw 'Docker Desktop no esta en marcha. Abrelo, espera a que la ballena deje de moverse y vuelve a intentarlo.' }
  if (-not (Test-ContenedorActivo)) {
    throw "La base de datos ($($script:Contenedor)) esta parada. Arrancala con Abrir_TradePilot.bat (con tu base existente no aplica cambios), cierra la ventana de la web si quieres, y vuelve a ejecutar este script."
  }
  Write-Ok "Base de datos en marcha ($($script:Contenedor))"
}

# Filas de cada tabla de public en la base viva, exactas (count(*)), en una
# sola consulta de solo lectura. Devuelve un hashtable tabla -> filas.
function Get-ConteosBase {
  $sql = "select c.relname || '|' || (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind in ('r','p') order by 1"
  $conteos = @{}
  foreach ($linea in (Invoke-Sql $sql)) {
    $partes = $linea -split '\|'
    $conteos[$partes[0]] = [long]$partes[1]
  }
  return $conteos
}

# Filas que contiene una copia (dentro del contenedor) para una tabla. Lee los
# datos con pg_restore y cuenta en PowerShell las lineas entre COPY y "\.".
# COPY escapa los saltos de linea, asi que una fila es siempre una linea.
function Get-FilasEnCopia {
  param([string]$Dump, [string]$Tabla)
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'pg_restore', '--data-only', '--schema=public', "--table=$Tabla", '-f', '-', $Dump) -SinErrores
  if ($r.Codigo -ne 0) { throw "No puedo leer la tabla $Tabla dentro de la copia." }
  $dentro = $false
  $n = 0
  foreach ($linea in $r.Salida) {
    if (-not $dentro) {
      if ($linea.StartsWith('COPY ')) { $dentro = $true }
    } elseif ($linea -eq '\.') {
      $dentro = $false
    } else {
      $n++
    }
  }
  return $n
}

# Compara, tabla a tabla, la base viva con una copia que esta dentro del
# contenedor. Solo lee. Lanza si una tabla no coincide. Devuelve el resumen.
function Test-RespaldoContraBase {
  param([string]$Dump = $script:DumpVerificacion)
  $lista = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'pg_restore', '--list', $Dump) -SinErrores
  if ($lista.Codigo -ne 0) { throw 'La copia no es un fichero valido de pg_dump (pg_restore --list falla).' }
  # Tablas cuyos datos contiene la copia: lineas "... TABLE DATA public <tabla> <propietario>".
  $enCopia = @{}
  foreach ($linea in $lista.Salida) {
    if ($linea -match '^\d+;\s+\d+\s+\d+\s+TABLE DATA public (\S+)\s') { $enCopia[$Matches[1]] = $true }
  }
  $base = Get-ConteosBase
  $fallos = 0
  foreach ($tabla in ($base.Keys | Sort-Object)) {
    if ($enCopia.ContainsKey($tabla)) {
      $copia = Get-FilasEnCopia -Dump $Dump -Tabla $tabla
      $marca = if ($copia -eq $base[$tabla]) { 'OK   ' } else { $fallos++; 'FALLO' }
      Write-Host ("       {0} {1,-30} base={2,-7} copia={3}" -f $marca, $tabla, $base[$tabla], $copia)
    } elseif ($base[$tabla] -eq 0) {
      # Tabla creada despues de la copia (p. ej. por la actualizacion) y vacia.
      Write-Host ("       OK    {0,-30} base=0       (no estaba en la copia; tabla nueva y vacia)" -f $tabla)
    } else {
      $fallos++
      Write-Host ("       FALLO {0,-30} base={1,-7} la copia no tiene esta tabla" -f $tabla, $base[$tabla])
    }
  }
  if ($enCopia.Count -eq 0) { throw 'La copia no contiene datos de ninguna tabla de public.' }
  if ($fallos -gt 0) { throw "La copia NO coincide con la base en $fallos tablas." }
  return $base
}

# Copia de seguridad completa de la base, guardada en respaldos\ (excluida de
# git), y verificada sobre el FICHERO QUE QUEDA EN TU DISCO:
#   1. pg_dump dentro del contenedor y copia al disco;
#   2. ese fichero del disco se vuelve a meter en el contenedor con otro
#      nombre (asi se verifica exactamente lo que guardas, sin sha256sum);
#   3. pg_restore --list lo lee entero (estructura valida);
#   4. cada tabla tiene en la copia las mismas filas que en la base.
# Devuelve la ruta del fichero. Lanza si cualquier comprobacion falla.
function New-RespaldoVerificado {
  $sello = Get-Date -Format 'yyyyMMdd-HHmmss'
  $carpeta = Join-Path $script:Raiz 'respaldos'
  if (-not (Test-Path $carpeta)) { $null = New-Item -ItemType Directory -Path $carpeta }
  $destino = Join-Path $carpeta "tradepilot-$sello.dump"

  Write-Paso 'Haciendo la copia de seguridad completa...'
  $r = Invoke-Externo $script:Docker @('exec', $script:Contenedor, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '-f', $script:DumpContenedor)
  if ($r.Codigo -ne 0) { throw ("pg_dump ha fallado; no se ha cambiado nada:`n" + ($r.Salida -join "`n")) }
  $r = Invoke-Externo $script:Docker @('cp', "$($script:Contenedor):$($script:DumpContenedor)", $destino)
  if ($r.Codigo -ne 0 -or -not (Test-Path $destino) -or (Get-Item $destino).Length -eq 0) {
    throw ("No he podido guardar la copia en el disco:`n" + ($r.Salida -join "`n"))
  }
  Write-Ok "Copia guardada: $destino"

  Write-Paso 'Verificando la copia guardada en el disco (filas por tabla, base frente a copia)...'
  $r = Invoke-Externo $script:Docker @('cp', $destino, "$($script:Contenedor):$($script:DumpVerificacion)")
  if ($r.Codigo -ne 0) { throw ("No he podido preparar la verificacion:`n" + ($r.Salida -join "`n")) }
  $null = Test-RespaldoContraBase -Dump $script:DumpVerificacion
  Write-Ok 'Copia verificada: todos los recuentos coinciden'
  return $destino
}

function Read-Confirmacion([string]$pregunta) {
  if ($env:TP_NO_PREGUNTAR -eq '1') { return $true }
  $respuesta = Read-Host "  $pregunta (S/N)"
  return ($respuesta -match '^\s*[sS]')
}

# ---------------------------------------------------------------------------
# Diagnostico de solo lectura: historial de migraciones y esquema frente a lo
# que espera esta version (supabase/esquema-esperado.txt).
# ---------------------------------------------------------------------------

function Get-MigracionesDelCodigo {
  return @(Get-ChildItem -Path (Join-Path $script:Raiz 'supabase/migrations') -Filter '*.sql' |
    Where-Object { $_.Name -match '^(\d+)_' } |
    ForEach-Object { [pscustomobject]@{ Version = ($_.Name -split '_')[0]; Nombre = $_.BaseName } } |
    Sort-Object Version)
}

function Get-EstadoMigraciones {
  $ficheros = Get-MigracionesDelCodigo
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

# Objetos del esquema public de la base real (misma consulta que genera la
# referencia: scripts/esquema/objetos.sql), en solo lectura.
function Get-ObjetosBase {
  $lineas = Get-Content -Path (Join-Path $script:Raiz 'scripts/esquema/objetos.sql') | Where-Object { $_ -notmatch '^\s*--' }
  $sql = ($lineas -join ' ').Trim().TrimEnd(';')
  return @(Invoke-Sql $sql)
}

function Get-EsquemaEsperado {
  $ruta = Join-Path $script:Raiz 'supabase/esquema-esperado.txt'
  if (-not (Test-Path $ruta)) { throw 'Falta supabase/esquema-esperado.txt.' }
  $objetos = @{}
  $migraciones = @()
  foreach ($linea in Get-Content -Path $ruta) {
    if ($linea -match '^# migracion (\S+)') { $migraciones += $Matches[1]; continue }
    if ($linea.StartsWith('#') -or $linea.Trim() -eq '') { continue }
    $partes = $linea -split '\|', 3
    $objetos["$($partes[1])|$($partes[2])"] = $partes[0]
  }
  return [pscustomobject]@{ Objetos = $objetos; Migraciones = $migraciones }
}

# Devuelve el diagnostico completo. No escribe nada en la base.
#   Bloqueos: motivos para NO actualizar.
#   Avisos:   cosas a revisar que no bloquean.
#   Faltan:   objetos que traera la actualizacion (normal).
function Get-Diagnostico {
  $bloqueos = New-Object System.Collections.Generic.List[string]
  $avisos = New-Object System.Collections.Generic.List[string]
  $faltan = New-Object System.Collections.Generic.List[string]

  $esperado = Get-EsquemaEsperado
  $delCodigo = @(Get-MigracionesDelCodigo | ForEach-Object { $_.Nombre })
  if ((@($esperado.Migraciones) -join ',') -ne ($delCodigo -join ',')) {
    $bloqueos.Add('La referencia supabase/esquema-esperado.txt no corresponde a las migraciones de esta version del codigo (hay que regenerarla). Es un fallo del proyecto, no de tu base.')
  }

  $estado = Get-EstadoMigraciones
  foreach ($v in $estado.Desconocidas) { $bloqueos.Add("Tu base tiene la migracion $v, que esta version del codigo no conoce. Puede ser trabajo (p. ej. de ejecuciones) que no esta en el repositorio.") }
  foreach ($m in $estado.FueraDeOrden) { $bloqueos.Add("Falta la migracion $($m.Nombre), anterior a otras ya aplicadas: base y codigo no son de la misma linea de trabajo.") }
  $pendientes = @($estado.Pendientes | ForEach-Object { "migracion:$($_.Nombre)" })

  $enBase = @{}
  foreach ($o in (Get-ObjetosBase)) { $enBase[$o] = $true }

  $nombresFuncionEsperados = @{}
  foreach ($k in $esperado.Objetos.Keys) {
    if ($k.StartsWith('funcion|')) { $nombresFuncionEsperados[($k.Substring(8) -split '\(')[0]] = $true }
  }
  foreach ($o in ($enBase.Keys | Sort-Object)) {
    if ($esperado.Objetos.ContainsKey($o)) { continue }
    $tipo, $objeto = $o -split '\|', 2
    if ($tipo -eq 'funcion' -and $nombresFuncionEsperados.ContainsKey(($objeto -split '\(')[0])) {
      $avisos.Add("Funcion $objeto con una firma distinta de la esperada (probablemente una version anterior de una funcion conocida).")
    } else {
      $bloqueos.Add("Tu base tiene $tipo '$objeto', que esta version de TradePilot no crea. Puede ser trabajo que no esta en el repositorio.")
    }
  }
  foreach ($k in ($esperado.Objetos.Keys | Sort-Object)) {
    if ($enBase.ContainsKey($k)) { continue }
    $origen = $esperado.Objetos[$k]
    $tipo, $objeto = $k -split '\|', 2
    if ($pendientes -contains $origen -or $origen.StartsWith('funciones:')) {
      $faltan.Add("$tipo '$objeto' (lo trae $origen)")
    } else {
      $bloqueos.Add("Falta $tipo '$objeto', que deberia haber creado $origen (ya registrada como aplicada): tu base no coincide con su historial.")
    }
  }

  $conteos = Get-ConteosBase
  if ($conteos.ContainsKey('accounts') -and $conteos['accounts'] -eq 0) {
    $bloqueos.Add('Esta base no tiene ninguna Cuenta. Si esperabas ver tus cuentas NYS, puede que no sea tu base real (p. ej. un volumen de Docker nuevo). No actualices hasta aclararlo.')
  }

  $volumen = Invoke-Externo $script:Docker @('volume', 'inspect', $script:Contenedor, '--format', '{{.CreatedAt}}')
  $creado = if ($volumen.Codigo -eq 0 -and $volumen.Salida.Count -gt 0) { $volumen.Salida[0] } else { 'desconocida' }

  return [pscustomobject]@{
    Bloqueos = $bloqueos
    Avisos = $avisos
    Faltan = $faltan
    Estado = $estado
    Conteos = $conteos
    VolumenCreado = $creado
    ObjetosBase = $enBase.Count
    ObjetosEsperados = $esperado.Objetos.Count
  }
}

# Escribe el diagnostico por pantalla y en diagnosticos\ (excluido de git).
# Devuelve la ruta del informe.
function Write-Diagnostico {
  param($D)
  $l = New-Object System.Collections.Generic.List[string]
  $l.Add("TradePilot - diagnostico de solo lectura - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
  $l.Add("Contenedor: $($script:Contenedor)   Volumen creado: $($D.VolumenCreado)")
  $l.Add('')
  $l.Add("Migraciones aplicadas en tu base: $($D.Estado.Aplicadas.Count)")
  foreach ($v in $D.Estado.Aplicadas) { $l.Add("  $v") }
  $l.Add("Pendientes (las traera la actualizacion): $($D.Estado.Pendientes.Count)")
  foreach ($m in $D.Estado.Pendientes) { $l.Add("  $($m.Nombre)") }
  $l.Add('')
  $l.Add("Filas por tabla (base viva):")
  foreach ($t in ($D.Conteos.Keys | Sort-Object)) { $l.Add(("  {0,-32} {1}" -f $t, $D.Conteos[$t])) }
  $l.Add('')
  $l.Add("Objetos del esquema public: en tu base $($D.ObjetosBase), esperados por esta version $($D.ObjetosEsperados)")
  $l.Add("Faltan y los traera la actualizacion: $($D.Faltan.Count)")
  foreach ($f in $D.Faltan) { $l.Add("  $f") }
  $l.Add('')
  $l.Add("AVISOS: $($D.Avisos.Count)")
  foreach ($a in $D.Avisos) { $l.Add("  - $a") }
  $l.Add("BLOQUEOS: $($D.Bloqueos.Count)")
  foreach ($b in $D.Bloqueos) { $l.Add("  - $b") }
  $l.Add('')
  if ($D.Bloqueos.Count -eq 0) {
    $l.Add('VEREDICTO: LISTA PARA ACTUALIZAR. Ninguna migracion desconocida, ningun objeto de mas y ninguno que falte sin explicacion.')
  } else {
    $l.Add('VEREDICTO: BLOQUEADA. No actualices. Envia este informe para revisarlo.')
  }

  $carpeta = Join-Path $script:Raiz 'diagnosticos'
  if (-not (Test-Path $carpeta)) { $null = New-Item -ItemType Directory -Path $carpeta }
  $ruta = Join-Path $carpeta "diagnostico-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
  Set-Content -Path $ruta -Value $l -Encoding UTF8
  foreach ($linea in $l) { Write-Host "  $linea" }
  return $ruta
}
