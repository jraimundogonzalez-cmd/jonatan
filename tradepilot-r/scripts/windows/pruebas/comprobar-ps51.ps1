# Comprobacion estatica de compatibilidad con Windows PowerShell 5.1.
#
# Por que existe: los scripts de TradePilot se escriben y prueban fuera de
# Windows, con PowerShell 7. La regla PSUseCompatibleSyntax de PSScriptAnalyzer
# vigila la SINTAXIS, pero sus reglas de comandos y tipos no funcionan
# ejecutadas fuera de Windows (fallan o no detectan nada: comprobado con
# Get-Error, Join-String, -Parallel y -AsHashtable). Este script hace esa parte:
#   - cada comando usado existe en Windows PowerShell 5.1 (cmdlet, funcion o alias);
#   - cada parametro usado existe en ese comando;
#   - cada tipo .NET usado existe y cada miembro estatico usado existe en el.
# La referencia es el perfil oficial de Windows PowerShell 5.1 que publica
# PSScriptAnalyzer (generado por Microsoft sobre una instalacion real):
#   win-48_x64_10.0.17763.0_5.1.17763.316_x64_4.0.30319.42000_framework.json
#
# No sustituye a ejecutar en Windows: no ve metodos de instancia ni el
# comportamiento real de los comandos externos (docker, supabase).
#
# Uso:  pwsh -File comprobar-ps51.ps1 -Perfil <ruta del .json> -Rutas <ps1...>
param(
  [Parameter(Mandatory = $true)][string]$Perfil,
  [Parameter(Mandatory = $true)][string[]]$Rutas,
  [string[]]$Externos = @('docker', 'supabase', 'powershell')
)
$ErrorActionPreference = 'Stop'

# Se lee con System.Text.Json: el perfil tiene una clave "psobject" que
# ConvertFrom-Json no admite. Por eso este comprobador exige PowerShell 7
# (los scripts que COMPRUEBA son los que deben funcionar en 5.1).
$doc = [System.Text.Json.JsonDocument]::Parse([System.IO.File]::ReadAllText($Perfil))
$runtime = $doc.RootElement.GetProperty('Runtime')
function Get-Hijo($el, [string]$nombre) { $v = [System.Text.Json.JsonElement]::new(); if ($el.ValueKind -eq 'Object' -and $el.TryGetProperty($nombre, [ref]$v)) { return $v }; return $null }
function Get-Claves($el) { if ($null -eq $el -or $el.ValueKind -ne 'Object') { return @() }; return @($el.EnumerateObject() | ForEach-Object { $_.Name }) }

$comandos = @{}
$alias = @{}
foreach ($modulo in $runtime.GetProperty('Modules').EnumerateObject()) {
  foreach ($version in $modulo.Value.EnumerateObject()) {
    foreach ($tipo in 'Cmdlets', 'Functions') {
      $lista = Get-Hijo $version.Value $tipo
      if ($null -eq $lista) { continue }
      foreach ($c in $lista.EnumerateObject()) {
        $params = @{}
        foreach ($x in (Get-Claves (Get-Hijo $c.Value 'Parameters'))) { $params[$x.ToLowerInvariant()] = $true }
        foreach ($x in (Get-Claves (Get-Hijo $c.Value 'ParameterAliases'))) { $params[$x.ToLowerInvariant()] = $true }
        $comandos[$c.Name.ToLowerInvariant()] = $params
      }
    }
    $als = Get-Hijo $version.Value 'Aliases'
    if ($null -ne $als) { foreach ($a in $als.EnumerateObject()) { $alias[$a.Name.ToLowerInvariant()] = $a.Value.GetString().ToLowerInvariant() } }
  }
}
$comunes = @{}
$comun = $runtime.GetProperty('Common')
foreach ($x in (Get-Claves (Get-Hijo $comun 'Parameters')) + (Get-Claves (Get-Hijo $comun 'ParameterAliases'))) { $comunes[$x.ToLowerInvariant()] = $true }

$tipos = $runtime.GetProperty('Types')
$aceleradores = @{}
foreach ($x in $tipos.GetProperty('TypeAccelerators').EnumerateObject()) { $aceleradores[$x.Name.ToLowerInvariant()] = $x.Value.GetProperty('Type').GetString() }

function Find-Tipo([string]$nombre) {
  $completo = if ($aceleradores.ContainsKey($nombre.ToLowerInvariant())) { $aceleradores[$nombre.ToLowerInvariant()] } else { $nombre }
  foreach ($candidato in @($completo, "System.$completo")) {
    $punto = $candidato.LastIndexOf('.')
    if ($punto -lt 0) { continue }
    $ns = $candidato.Substring(0, $punto); $corto = $candidato.Substring($punto + 1)
    foreach ($asm in $tipos.GetProperty('Assemblies').EnumerateObject()) {
      $espacio = Get-Hijo (Get-Hijo $asm.Value 'Types') $ns
      $t = Get-Hijo $espacio $corto
      if ($null -ne $t) { return $t }
    }
  }
  return $null
}

$problemas = New-Object System.Collections.Generic.List[string]
$asts = @{}
foreach ($ruta in $Rutas) {
  $tokens = $null; $errores = $null
  $asts[$ruta] = [System.Management.Automation.Language.Parser]::ParseFile($ruta, [ref]$tokens, [ref]$errores)
  foreach ($e in $errores) { $problemas.Add("$(Split-Path -Leaf $ruta):$($e.Extent.StartLineNumber) error de analisis: $($e.Message)") }
}
# Funciones definidas en los propios scripts (se cargan con dot-sourcing).
$propias = @{}
foreach ($ast in $asts.Values) {
  foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) { $propias[$f.Name.ToLowerInvariant()] = $true }
}

$revisados = 0
foreach ($ruta in $Rutas) {
  $ast = $asts[$ruta]; $hoja = Split-Path -Leaf $ruta
  foreach ($c in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)) {
    $nombre = $c.GetCommandName()
    if (-not $nombre) { continue }
    $clave = $nombre.ToLowerInvariant()
    if ($propias.ContainsKey($clave) -or $Externos -contains $clave) { continue }
    if ($alias.ContainsKey($clave)) { $clave = $alias[$clave] }
    $revisados++
    if (-not $comandos.ContainsKey($clave)) { $problemas.Add("${hoja}:$($c.Extent.StartLineNumber) el comando '$nombre' no existe en PowerShell 5.1"); continue }
    foreach ($el in $c.CommandElements) {
      if ($el -is [System.Management.Automation.Language.CommandParameterAst]) {
        $param = $el.ParameterName.ToLowerInvariant()
        if (-not $comandos[$clave].ContainsKey($param) -and -not $comunes.ContainsKey($param)) {
          $problemas.Add("${hoja}:$($el.Extent.StartLineNumber) el parametro -$($el.ParameterName) no existe en '$nombre' de PowerShell 5.1")
        }
      }
    }
  }
  foreach ($t in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.TypeExpressionAst] -or $n -is [System.Management.Automation.Language.TypeConstraintAst] }, $true)) {
    $tn = $t.TypeName
    # [string[]] es un array de [string]: se comprueba el tipo del elemento.
    while ($tn -is [System.Management.Automation.Language.ArrayTypeName]) { $tn = $tn.ElementType }
    $nombreTipo = $tn.FullName
    $revisados++
    if ($null -eq (Find-Tipo $nombreTipo)) { $problemas.Add("${hoja}:$($t.Extent.StartLineNumber) el tipo [$nombreTipo] no existe en PowerShell 5.1") }
  }
  foreach ($m in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.MemberExpressionAst] -and $n.Static }, $true)) {
    if ($m.Expression -isnot [System.Management.Automation.Language.TypeExpressionAst]) { continue }
    $tipo = Find-Tipo $m.Expression.TypeName.FullName
    $miembro = "$($m.Member.Value)"
    if ($null -eq $tipo -or -not $miembro) { continue }
    $revisados++
    $estatico = Get-Hijo $tipo 'Static'
    $existe = $false
    foreach ($clase in 'Methods', 'Properties', 'Fields', 'Events') {
      if ((Get-Claves (Get-Hijo $estatico $clase)) -contains $miembro) { $existe = $true }
    }
    if (-not $existe) { $problemas.Add("${hoja}:$($m.Extent.StartLineNumber) el miembro estatico ::$miembro no existe en [$($m.Expression.TypeName.FullName)] de PowerShell 5.1") }
  }
}

$problemas | ForEach-Object { Write-Output "  [X] $_" }
Write-Output "Elementos revisados: $revisados; problemas: $($problemas.Count)"
if ($problemas.Count -gt 0) { exit 1 }
exit 0
