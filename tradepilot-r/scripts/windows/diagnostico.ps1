# Diagnostico de SOLO LECTURA de la base local de TradePilot.
# Uso normal: doble clic en Diagnosticar_TradePilot.bat
#
# Compara tu base con lo que espera esta version del codigo:
#   - historial de migraciones (desconocidas, pendientes, fuera de orden);
#   - objetos del esquema public (tablas, columnas, funciones, triggers,
#     politicas, indices) frente a supabase/esquema-esperado.txt;
#   - filas por tabla.
# Todas las consultas van con default_transaction_read_only=on: PostgreSQL
# rechazaria cualquier escritura. No arranca ni para nada, no copia ficheros
# dentro del contenedor y no cambia la base. Deja un informe en diagnosticos\.
#
# Codigo de salida: 0 lista para actualizar, 2 bloqueada, 1 error.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

Write-Host ''
Write-Host '  ================================================'
Write-Host '     TradePilot - diagnostico (solo lectura)'
Write-Host '  ================================================'
try {
  Assert-Entorno
  Write-Paso 'Leyendo historial de migraciones, esquema y filas por tabla...'
  $d = Get-Diagnostico
  Write-Host ''
  $ruta = Write-Diagnostico $d
  Write-Host ''
  Write-Host "  Informe guardado en: $ruta"
  if ($d.Bloqueos.Count -gt 0) { exit 2 }
  exit 0
} catch {
  Write-Host ''
  Write-Fallo "$_"
  Write-Host '       No se ha modificado nada.'
  exit 1
}
