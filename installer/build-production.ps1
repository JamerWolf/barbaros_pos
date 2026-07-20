# build-production.ps1 - Full production build pipeline
# Builds: shared -> api -> web -> prisma generate -> copy web dist into api/dist/web/
# Run from repo root: .\installer\build-production.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# Ensure we run from project root (where package.json with workspaces lives)
Set-Location $root

Write-Host "=== Barbaros POS - Production Build ===" -ForegroundColor Cyan

# --- Step 1: Build shared types ---
Write-Host "`n[1/5] Building shared types..." -ForegroundColor Yellow
npm run --workspace=packages/shared build
if ($LASTEXITCODE -ne 0) { throw "shared build failed" }

# --- Step 2: Build API ---
Write-Host "`n[2/5] Building API (tsc)..." -ForegroundColor Yellow
npm run --workspace=apps/api build
if ($LASTEXITCODE -ne 0) { throw "API build failed" }

# --- Step 3: Build Web (Vite) ---
Write-Host "`n[3/5] Building Web (Vite)..." -ForegroundColor Yellow
npm run --workspace=apps/web build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }

# --- Step 4: Generate Prisma client (with retry for locked DLL on Windows) ---
Write-Host "`n[4/5] Generating Prisma client..." -ForegroundColor Yellow
$maxAttempts = 3
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    npx prisma generate --schema=apps/api/prisma/schema.prisma
    if ($LASTEXITCODE -eq 0) { break }
    if ($attempt -lt $maxAttempts) {
        Write-Host "  Attempt $attempt failed (DLL may be locked), waiting 3s and retrying..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 3
    } else {
        throw "Prisma generate failed after $maxAttempts attempts"
    }
}

# --- Step 5: Copy web dist into api/dist/web/ for static serving ---
Write-Host "`n[5/5] Copying web dist into api/dist/web/..." -ForegroundColor Yellow
$webDist = Join-Path $root "apps\web\dist"
$apiWebDist = Join-Path $root "apps\api\dist\web"

if (-not (Test-Path $webDist)) {
    throw "Web dist not found at $webDist - Vite build may have failed silently"
}

if (Test-Path $apiWebDist) {
    Remove-Item -Recurse -Force $apiWebDist
}
Copy-Item -Recurse $webDist $apiWebDist

# --- Step 6: Copy package.json for npm install during deployment ---
Write-Host "`n[6/6] Preparing package.json for deployment..." -ForegroundColor Yellow
$stagingDir = Join-Path $root "installer\staging"

# Clean previous staging
if (Test-Path (Join-Path $stagingDir "node_modules")) {
    Remove-Item -Recurse -Force (Join-Path $stagingDir "node_modules")
}

# Copy package.json (dependencies will be installed on target machine)
Copy-Item (Join-Path $root "apps\api\package.json") (Join-Path $stagingDir "package.json")

Write-Host "  package.json staged for npm install" -ForegroundColor Green

# --- Verify artifacts ---
Write-Host "`n=== Verifying build artifacts ===" -ForegroundColor Cyan

$artifacts = @(
    @{ Path = "packages\shared\dist\index.js";              Label = "shared/dist/index.js" },
    @{ Path = "apps\api\dist\index.js";                     Label = "apps/api/dist/index.js" },
    @{ Path = "apps\web\dist\index.html";                   Label = "apps/web/dist/index.html" },
    @{ Path = "apps\api\dist\web\index.html";               Label = "apps/api/dist/web/index.html" },
    @{ Path = "apps\api\generated\prisma\index.js";         Label = "apps/api/generated/prisma/index.js" },
    @{ Path = "installer\staging\package.json";             Label = "staging/package.json" }
)

$allGood = $true
foreach ($a in $artifacts) {
    $fullPath = Join-Path $root $a.Path
    if (Test-Path $fullPath) {
        Write-Host "  OK  $($a.Label)" -ForegroundColor Green
    } else {
        Write-Host "  MISSING  $($a.Label)" -ForegroundColor Red
        $allGood = $false
    }
}

if (-not $allGood) {
    throw "Build verification failed - missing artifacts"
}

Write-Host "`n=== Build complete ===" -ForegroundColor Green
