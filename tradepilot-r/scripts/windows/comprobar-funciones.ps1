# Comprueba que la base local tiene las funciones de esta version de
# TradePilot antes de arrancar la web. Lo llama Abrir_TradePilot.bat (paso 10).
#
# Llama a dos funciones reales de solo lectura, con la anon key y sin usuario:
#   - listar_empresas            (de siempre)        POST, cuerpo {}
#   - listar_lotes_importacion   (del importador)    GET, p_account_id nulo
# Las dos son `security invoker` y filtran por auth.uid(): sin usuario
# devuelven una lista vacia, [] . No escriben nada.
#
# Solo da por buena una respuesta HTTP 200 cuyo cuerpo sea JSON de tipo
# array. Cualquier otra cosa (401, 404, 500, cuerpo vacio, objeto, texto,
# sin respuesta a tiempo) es un fallo: un 404 suele querer decir que la base
# es anterior al codigo y hay que ACTUALIZARLA, nunca reiniciarla.
#
# Entrada: variables de entorno TP_URL y TP_ANON, nunca argumentos. No ensena
# la clave, las cabeceras, la URL ni el cuerpo de las respuestas.
# TP_TIMEOUT_FUNCIONES (segundos, 1-60, por defecto 10) existe para las pruebas.
#
# Codigo de salida: 0 las dos bien, 1 cualquier fallo.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'comun.ps1')

$url = $env:TP_URL
$anon = $env:TP_ANON
$espera = 10
if ($env:TP_TIMEOUT_FUNCIONES -match '^\d+$' -and [int]$env:TP_TIMEOUT_FUNCIONES -ge 1 -and [int]$env:TP_TIMEOUT_FUNCIONES -le 60) {
  $espera = [int]$env:TP_TIMEOUT_FUNCIONES
}

if (-not $url -or -not $anon) {
  Write-Fallo 'Falta la direccion o la clave publica de Supabase: no puedo comprobar las funciones.'
  exit 1
}
$base = $null
if (-not [System.Uri]::TryCreate($url, [System.UriKind]::Absolute, [ref]$base) -or
    ($base.Scheme -ne 'http' -and $base.Scheme -ne 'https') -or $base.UserInfo) {
  Write-Fallo 'La direccion de Supabase no tiene el formato esperado.'
  exit 1
}
$raiz = $url.TrimEnd('/')

# Devuelve $null si la respuesta es valida, o el motivo del fallo.
function Test-Funcion([string]$metodo, [string]$ruta, [string]$cuerpo) {
  $peticion = @{
    UseBasicParsing = $true
    Uri             = "$raiz$ruta"
    Method          = $metodo
    Headers         = @{ apikey = $anon }
    TimeoutSec      = $espera
  }
  if ($metodo -eq 'POST') { $peticion.ContentType = 'application/json'; $peticion.Body = $cuerpo }
  try {
    $r = Invoke-WebRequest @peticion
  } catch {
    $respuesta = $null
    if ($_.Exception.PSObject.Properties['Response']) { $respuesta = $_.Exception.Response }
    if ($null -ne $respuesta) { return "HTTP $([int]$respuesta.StatusCode)" }
    if ($_.Exception -is [System.Net.WebException] -and $_.Exception.Status -eq [System.Net.WebExceptionStatus]::Timeout) {
      return "sin respuesta en $espera s"
    }
    return 'no se ha podido conectar'
  }
  if ([int]$r.StatusCode -ne 200) { return "HTTP $([int]$r.StatusCode)" }
  $texto = "$($r.Content)".Trim()
  if ($texto -eq '') { return 'HTTP 200 con el cuerpo vacio' }
  if (-not $texto.StartsWith('[')) { return 'HTTP 200 pero el cuerpo no es una lista JSON' }
  try { $null = ConvertFrom-Json -InputObject $texto }
  catch { return 'HTTP 200 pero el cuerpo no es JSON valido' }
  return $null
}

$comprobaciones = @(
  @{ Nombre = 'listar_empresas'; Metodo = 'POST'; Ruta = '/rest/v1/rpc/listar_empresas'; Cuerpo = '{}' },
  @{ Nombre = 'listar_lotes_importacion'; Metodo = 'GET'; Ruta = '/rest/v1/rpc/listar_lotes_importacion?p_account_id=00000000-0000-0000-0000-000000000000'; Cuerpo = $null }
)
$fallos = 0
foreach ($c in $comprobaciones) {
  $motivo = Test-Funcion $c.Metodo $c.Ruta $c.Cuerpo
  if ($null -eq $motivo) { Write-Ok "Funcion $($c.Nombre): HTTP 200, lista JSON" }
  else { Write-Fallo "Funcion $($c.Nombre): $motivo"; $fallos++ }
}
if ($fallos -gt 0) { exit 1 }
exit 0
