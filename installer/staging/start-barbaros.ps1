# start-barbaros.ps1 - Manual startup script for Barbaros POS
# NOTE: Normal startup is via Windows Service (BarbarosPOS)
# This script is for manual diagnostics or one-off startup

$ErrorActionPreference = "Stop"
$installDir = $PSScriptRoot
$logDir = Join-Path $installDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir ("start-" + (Get-Date -Format "yyyy-MM-dd-HHmmss") + ".log")

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Log "=== Barbaros POS - Manual startup script ==="

# --- Step 0: Verify Node.js is available ---
try {
    $nodeVersion = & node --version 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
        throw "Node.js not found"
    }
    Log "Node.js detected ($nodeVersion)"
} catch {
    Log "ERROR: Node.js is not installed or not in PATH. Install Node.js v20+ from https://nodejs.org"
    exit 1
}

# --- Step 1: Wait for PostgreSQL service ---
Log "Waiting for PostgreSQL service to be running..."
$pgReady = $false
for ($i = 0; $i -lt 120; $i += 5) {
    try {
        # Check both possible service names
        $service = Get-Service postgresql-barbaros -ErrorAction SilentlyContinue
        if (-not $service) {
            $service = Get-Service postgresql-x64-16 -ErrorAction SilentlyContinue
        }
        if ($service -and $service.Status -eq 'Running') {
            $pgReady = $true
            Log "PostgreSQL service is running"
            break
        }
    } catch { }
    Start-Sleep -Seconds 5
}
if (-not $pgReady) {
    Log "ERROR: PostgreSQL service not running after 120 seconds"
    exit 1
}

# --- Step 2: Wait for PostgreSQL to accept connections ---
Log "Waiting for PostgreSQL to accept connections..."
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
if (-not (Test-Path "$pgBin\pg_isready.exe")) {
    $pgBin = "C:\Program Files (x86)\PostgreSQL\16\bin"
}

if (Test-Path "$pgBin\pg_isready.exe") {
    $connReady = $false
    for ($i = 0; $i -lt 60; $i += 5) {
        try {
            & "$pgBin\pg_isready.exe" -h localhost -p 5432 2>$null
            if ($LASTEXITCODE -eq 0) {
                $connReady = $true
                Log "PostgreSQL is ready to accept connections"
                break
            }
        } catch { }
        Start-Sleep -Seconds 5
    }
    if (-not $connReady) {
        Log "ERROR: PostgreSQL not ready after 60 seconds"
        exit 1
    }
}

# --- Step 3: Sync database schema ---
Log "Syncing database schema..."
$env:PGPASSWORD = "barbaros"
$env:APP_ENV = "production"

$prismaBin = Join-Path $installDir "node_modules\.bin\prisma.cmd"
Push-Location (Join-Path $installDir "apps\api")
if (Test-Path $prismaBin) {
    & $prismaBin migrate deploy --schema=prisma/schema.prisma
} else {
    Log "WARNING: Prisma binary not found at $prismaBin, trying npx..."
    & npx prisma migrate deploy --schema=prisma/schema.prisma
}
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Log "ERROR: Prisma migrate deploy failed"
    exit 1
}
Log "Database schema synced"

# --- Step 4: Start API ---
Log "Starting API server..."
$apiDir = Join-Path $installDir "apps\api"
$env:APP_ENV = "production"
Push-Location $apiDir
& node dist/index.js 2>&1 | ForEach-Object {
    $line = "[API] $_"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}
Pop-Location
