# start.ps1 - Levanta DB (Docker), API y Web
# Uso:
#   .\start.ps1          Solo local
#   .\start.ps1 -Tunnel  Con Cloudflare Tunnel (acceso desde internet)

param(
    [switch]$Tunnel
)

Write-Host "=== Barbaros POS - Start ===" -ForegroundColor Cyan

# 1. Levantar PostgreSQL
Write-Host ""
Write-Host "[1/4] Levantando PostgreSQL..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al levantar Docker" -ForegroundColor Red
    exit 1
}

# 2. Esperar a que la DB este lista
Write-Host "[2/4] Esperando a que PostgreSQL este listo..." -ForegroundColor Yellow
$maxRetries = 20
$retries = 0
while ($retries -lt $maxRetries) {
    $check = docker exec barbaros-pos-db pg_isready -U barbaros -d barbaros_pos 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  PostgreSQL listo!" -ForegroundColor Green
        break
    }
    $retries++
    Write-Host "  Esperando... ($retries/$maxRetries)"
    Start-Sleep -Seconds 1
}
if ($retries -eq $maxRetries) {
    Write-Host "  PostgreSQL no respondio a tiempo" -ForegroundColor Red
    exit 1
}

# 3. Ejecutar migraciones
Write-Host "[3/4] Ejecutando migraciones..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://barbaros:barbaros@localhost:5432/barbaros_pos"
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en migraciones" -ForegroundColor Red
    exit 1
}

# 4. Levantar API y Web en ventanas separadas
Write-Host "[4/4] Levantando API y Web..." -ForegroundColor Yellow

$startPath = $PSScriptRoot
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$startPath'; Write-Host 'API Server' -ForegroundColor Cyan; npm run dev:api")
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$startPath'; Write-Host 'Web Frontend' -ForegroundColor Cyan; npm run dev:web")

Write-Host ""
Write-Host "=== Todo listo! ===" -ForegroundColor Green
Write-Host "  API: http://localhost:3000"
Write-Host "  Web: http://localhost:5173"
Write-Host "  DB:  localhost:5432"

if ($Tunnel) {
    Write-Host ""
    Write-Host "Levantando Cloudflare Tunnels..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Write-Host 'Tunnel Web (5173)' -ForegroundColor Cyan; cloudflared tunnel --url http://localhost:5173")
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Write-Host 'Tunnel API (3000)' -ForegroundColor Cyan; cloudflared tunnel --url http://localhost:3000")
    Write-Host "  Tunnels abiertos - copia las URLs de las ventanas nuevas" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Para detener: docker compose down" -ForegroundColor DarkGray
