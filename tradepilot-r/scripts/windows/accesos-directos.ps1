# Crea en el Escritorio del usuario los accesos directos de TradePilot.
# Solo ASCII (PowerShell 5.1). No toca la base de datos.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# GetFolderPath respeta un Escritorio redirigido a OneDrive.
$escritorio = [Environment]::GetFolderPath('Desktop')
$accesos = @(
  @{ Nombre = 'TradePilot - Abrir';              Bat = 'Abrir_TradePilot.bat' },
  @{ Nombre = 'TradePilot - Cerrar';             Bat = 'Cerrar_TradePilot.bat' },
  @{ Nombre = 'TradePilot - Copia de seguridad'; Bat = 'Copia_de_seguridad_TradePilot.bat' },
  @{ Nombre = 'TradePilot - Diagnosticar';       Bat = 'Diagnosticar_TradePilot.bat' },
  @{ Nombre = 'TradePilot - Actualizar';         Bat = 'Actualizar_TradePilot.bat' }
)
try {
  $shell = New-Object -ComObject WScript.Shell
  foreach ($a in $accesos) {
    $destino = Join-Path $raiz $a.Bat
    if (-not (Test-Path $destino)) { Write-Host "  [!] No encuentro $($a.Bat); me lo salto"; continue }
    $lnk = $shell.CreateShortcut((Join-Path $escritorio "$($a.Nombre).lnk"))
    $lnk.TargetPath = $destino
    $lnk.WorkingDirectory = $raiz
    $lnk.Save()
    Write-Host "  [OK] $($a.Nombre)"
  }
  Write-Host ''
  Write-Host "  Accesos directos creados en: $escritorio"
} catch {
  Write-Host "  [X] No he podido crear los accesos directos: $_"
  exit 1
}
