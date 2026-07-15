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

# --- Step 4: Generate Prisma client ---
Write-Host "`n[4/5] Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate --schema=apps/api/prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed" }

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

# --- Step 6: Install production-only dependencies for API ---
Write-Host "`n[6/6] Installing production dependencies for API..." -ForegroundColor Yellow
$stagingDir = Join-Path $root "installer\staging"
$stagingNodeModules = Join-Path $stagingDir "node_modules"
$stagingApiDir = Join-Path $stagingDir "apps\api"

# Clean previous staging node_modules
if (Test-Path $stagingNodeModules) {
    Remove-Item -Recurse -Force $stagingNodeModules
}

# Create a temp directory for standalone install (avoid workspace hoisting)
$tempApi = Join-Path $stagingDir "_temp_api"
if (Test-Path $tempApi) { Remove-Item -Recurse -Force $tempApi }
New-Item -ItemType Directory -Path $tempApi -Force | Out-Null

# Copy only package.json (no node_modules, no src)
Copy-Item (Join-Path $root "apps\api\package.json") $tempApi
Copy-Item (Join-Path $root "apps\api\prisma") (Join-Path $tempApi "prisma") -Recurse

# Remove @barbaros/shared from package.json (workspace package, not on npm, not needed at runtime)
$pkg = Get-Content (Join-Path $tempApi "package.json") -Raw | ConvertFrom-Json
$pkg.dependencies.PSObject.Properties.Remove("@barbaros/shared")
$pkg | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $tempApi "package.json")

# Install production deps in isolation (no workspace context)
Push-Location $tempApi
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& npm install --omit=dev --ignore-scripts --no-package-lock --no-fund --no-audit 2>&1 | Out-Null
$npmExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
Pop-Location

if ($npmExit -ne 0) {
    Remove-Item -Recurse -Force $tempApi -ErrorAction SilentlyContinue
    throw "npm install failed"
}

# Move the result to staging
Copy-Item (Join-Path $tempApi "node_modules") $stagingNodeModules -Recurse

# Cleanup
Remove-Item -Recurse -Force $tempApi

Write-Host "  Production dependencies staged" -ForegroundColor Green

# --- Verify artifacts ---
Write-Host "`n=== Verifying build artifacts ===" -ForegroundColor Cyan

$artifacts = @(
    @{ Path = "packages\shared\dist\index.js";              Label = "shared/dist/index.js" },
    @{ Path = "apps\api\dist\index.js";                     Label = "apps/api/dist/index.js" },
    @{ Path = "apps\web\dist\index.html";                   Label = "apps/web/dist/index.html" },
    @{ Path = "apps\api\dist\web\index.html";               Label = "apps/api/dist/web/index.html" },
    @{ Path = "apps\api\generated\prisma\index.js";         Label = "apps/api/generated/prisma/index.js" },
    @{ Path = "installer\staging\node_modules";             Label = "staging/node_modules" }
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
