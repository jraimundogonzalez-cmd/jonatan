# Copia de seguridad de TradePilot, verificada. Solo lee la base.
# Uso normal: doble clic en Copia_de_seguridad_TradePilot.bat
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

Write-Host ''
Write-Host '  ================================================'
Write-Host '     TradePilot - copia de seguridad'
Write-Host '  ================================================'
try {
  Assert-Entorno
  $ruta = New-RespaldoVerificado
  Write-Host ''
  Write-Ok 'Copia de seguridad terminada y verificada.'
  Write-Host "       $ruta"
  Write-Host '       Guarda una copia fuera del ordenador de vez en cuando (USB, nube privada).'
  Write-Host '       No la compartas: contiene tus datos.'
  exit 0
} catch {
  Write-Host ''
  Write-Fallo "$_"
  Write-Host '       No se ha modificado nada en la base de datos.'
  exit 1
}
