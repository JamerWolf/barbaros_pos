# stop-barbaros.ps1 - Stop Barbaros POS services
# Stops API service and optionally PostgreSQL service

$ErrorActionPreference = "Stop"
$installDir = $PSScriptRoot
$logDir = Join-Path $installDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir ("stop-" + (Get-Date -Format "yyyy-MM-dd-HHmmss") + ".log")

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Log "=== Barbaros POS - Stopping services ==="

# --- Step 1: Stop API service ---
Log "Stopping BarbarosPOS service..."
$nssm = Join-Path $installDir "nssm.exe"
if (Test-Path $nssm) {
    & $nssm stop BarbarosPOS
    if ($LASTEXITCODE -eq 0) {
        Log "API service stopped successfully"
    } else {
        Log "WARNING: Service stop returned exit code $LASTEXITCODE (may not be running)"
    }
} else {
    Log "WARNING: nssm.exe not found at $nssm"
}

# --- Step 2: Optionally stop PostgreSQL service ---
# Uncomment the following lines if you want to stop PostgreSQL as well
# Log "Stopping PostgreSQL service..."
# Stop-Service postgresql-x64-16 -Force -ErrorAction SilentlyContinue
# if ($LASTEXITCODE -eq 0) {
#     Log "PostgreSQL service stopped"
# } else {
#     Log "WARNING: PostgreSQL stop failed"
# }

Log "=== Services stopped ==="
