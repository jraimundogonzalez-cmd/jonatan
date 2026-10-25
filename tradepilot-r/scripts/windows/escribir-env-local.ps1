# Escribe apps\web\.env.local con la configuracion de Supabase LOCAL, sin
# perder nunca una configuracion que no sea la que genera el lanzador.
# Lo llama Abrir_TradePilot.bat (paso 9); no hace falta ejecutarlo a mano.
#
# Entrada: variables de entorno TP_URL y TP_ANON (las lee el lanzador de
# `supabase status -o env`). Nunca por argumentos: los argumentos se ven en la
# lista de procesos. Ningun mensaje ensena la URL leida ni la clave.
#
# Decision:
#   - no existe                        -> se crea con las dos variables;
#   - existe, local y misma clave      -> no se toca (ni respaldo);
#   - existe, local y otra clave       -> respaldo fechado
#                                         .env.respaldo-AAAAMMDD-HHMMSS.local
#                                         y despues se reescribe;
#   - otra URL (p. ej. Supabase alojado), claves de mas, lineas que no son
#     CLAVE=valor, claves repetidas o fichero ilegible -> NO se toca y se para.
# La configuracion de produccion vive en las variables de entorno de Vercel,
# nunca en este fichero. Los respaldos terminan en .local: git los ignora.
# Nunca sobrescribe ni borra un respaldo, ni .env.anterior.local.
#
# -Destino solo existe para probar el script sobre una carpeta temporal.
#
# Codigo de salida: 0 escrito o ya correcto, 1 parado sin tocar nada.
param([string]$Destino)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

$UrlLocal = 'http://127.0.0.1:54321'
$Claves = @('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
if (-not $Destino) { $Destino = Join-Path $script:Raiz 'apps\web\.env.local' }

function Stop-Env([string]$motivo) {
  Write-Fallo $motivo
  Write-Host '      No he modificado apps\web\.env.local.'
  exit 1
}

# Escribe primero a un fichero temporal de la misma carpeta y despues lo pone
# en su sitio: si algo falla a medias, el .env.local anterior sigue entero.
function Write-Env([string]$ruta, [string]$url, [string]$anon) {
  $temporal = Join-Path (Split-Path -Parent $ruta) '.env.escribiendo.local'
  $texto = "NEXT_PUBLIC_SUPABASE_URL=$url`r`nNEXT_PUBLIC_SUPABASE_ANON_KEY=$anon`r`n"
  [System.IO.File]::WriteAllText($temporal, $texto, (New-Object System.Text.UTF8Encoding $false))
  # [NullString]::Value y no $null: PowerShell convierte $null en "" al pasarlo
  # a un parametro string, y Replace rechaza "" como ruta de respaldo.
  if (Test-Path -LiteralPath $ruta) { [System.IO.File]::Replace($temporal, $ruta, [NullString]::Value) }
  else { [System.IO.File]::Move($temporal, $ruta) }
}

$url = $env:TP_URL
$anon = $env:TP_ANON
if (-not $url -or -not $anon) { Stop-Env 'Falta la direccion o la clave publica de Supabase local.' }
if ($url -cne $UrlLocal) { Stop-Env "Supabase no ha devuelto la direccion local esperada ($UrlLocal)." }
if ($anon -notmatch '^[A-Za-z0-9._-]+$') { Stop-Env 'La clave publica de Supabase tiene un formato inesperado.' }

if (-not (Test-Path -LiteralPath $Destino)) {
  Write-Env $Destino $url $anon
  Write-Ok 'Configuracion local creada en apps\web\.env.local'
  exit 0
}

try { $lineas = [System.IO.File]::ReadAllLines($Destino) }
catch { Stop-Env 'Ya existe apps\web\.env.local y no se puede leer.' }

$actual = @{}
foreach ($linea in $lineas) {
  if ($linea.Trim() -eq '') { continue }
  if ($linea -notmatch '^([A-Z0-9_]+)=([A-Za-z0-9._:/-]+)$') {
    Stop-Env 'apps\web\.env.local tiene lineas que no genero el lanzador (comentarios, comillas o espacios). Revisalo a mano.'
  }
  $clave = $Matches[1]
  if ($Claves -cnotcontains $clave) { Stop-Env "apps\web\.env.local tiene variables de mas ($clave). Revisalo a mano." }
  if ($actual.ContainsKey($clave)) { Stop-Env "apps\web\.env.local repite la variable $clave. Revisalo a mano." }
  $actual[$clave] = $Matches[2]
}
foreach ($clave in $Claves) {
  if (-not $actual.ContainsKey($clave)) { Stop-Env "A apps\web\.env.local le falta $clave. Revisalo a mano." }
}
if ($actual['NEXT_PUBLIC_SUPABASE_URL'] -cne $UrlLocal) {
  Stop-Env 'apps\web\.env.local apunta a otro Supabase (puede ser el alojado). No lo sustituyo por el local.'
}
if ($actual['NEXT_PUBLIC_SUPABASE_ANON_KEY'] -ceq $anon) {
  Write-Ok 'Configuracion local ya correcta en apps\web\.env.local (sin cambios)'
  exit 0
}

$respaldo = Join-Path (Split-Path -Parent $Destino) (".env.respaldo-{0}.local" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $respaldo) { Stop-Env 'Ya existe un respaldo con la hora de ahora. Espera un segundo y vuelve a intentarlo.' }
Copy-Item -LiteralPath $Destino -Destination $respaldo
if ((Get-FileHash -LiteralPath $Destino).Hash -ne (Get-FileHash -LiteralPath $respaldo).Hash) {
  Stop-Env 'El respaldo de apps\web\.env.local no ha quedado identico.'
}
Write-Env $Destino $url $anon
Write-Ok "Clave local nueva: respaldo en apps\web\$(Split-Path -Leaf $respaldo) y configuracion reescrita"
exit 0
