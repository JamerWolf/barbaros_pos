# start.ps1 - Levanta DB de desarrollo, API y Web
# Uso:
#   .\start.ps1          Solo local (desarrollo)
#   .\start.ps1 -Tunnel  Con Cloudflare Tunnel (acceso desde internet)
#
# Este script es SOLO para el ambiente de desarrollo (APP_ENV=develop).
# Para producción, ver start-prod.ps1 (TBD).

param(
    [switch]$Tunnel
)

# Forzar APP_ENV=develop sin importar lo que tenga el shell del operador.
# Esto es la primera línea de defensa contra fuga a producción.
$env:APP_ENV = "develop"
Write-Host "=== Barbaros POS - Start (develop) ===" -ForegroundColor Cyan

# 0. Verificar que Docker este corriendo, si no, levantarlo
Write-Host ""
Write-Host "[0/4] Verificando Docker..." -ForegroundColor Yellow
$dockerRunning = docker info 2>&1 | Select-String "Server Version"
if (-not $dockerRunning) {
    Write-Host "  Docker no esta corriendo. Abriendo Docker Desktop..." -ForegroundColor Yellow
    $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktop) {
        Start-Process $dockerDesktop
    } else {
        Write-Host "  No se encontro Docker Desktop. Abrilo manualmente." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Esperando a que Docker este listo..." -ForegroundColor Yellow
    $maxWait = 60
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        $check = docker info 2>&1 | Select-String "Server Version"
        if ($check) {
            Write-Host "  Docker listo!" -ForegroundColor Green
            break
        }
        Write-Host "  Esperando... ($waited s)"
    }
    if ($waited -ge $maxWait) {
        Write-Host "  Docker no se inicio a tiempo" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Docker listo!" -ForegroundColor Green
}

# 1. Levantar PostgreSQL de desarrollo
# Solo levantamos postgres-dev. postgres-prod NO se toca desde este script.
Write-Host ""
Write-Host "[1/4] Levantando PostgreSQL de desarrollo..." -ForegroundColor Yellow
docker compose up -d postgres-dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al levantar Docker" -ForegroundColor Red
    exit 1
}

# 2. Esperar a que la DB este lista
Write-Host ""
Write-Host "[2/4] Esperando a que PostgreSQL este listo..." -ForegroundColor Yellow
$maxRetries = 20
$retries = 0
while ($retries -lt $maxRetries) {
    # Usamos el container dev y la DB dev (barbaros_pos_dev), no los nombres viejos.
    $check = docker exec barbaros-pos-db-dev pg_isready -U barbaros -d barbaros_pos_dev 2>&1
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

# 3. Ejecutar migraciones via el wrapper seguro (lee APP_ENV=develop del shell)
# NO seteamos DATABASE_URL aca: el wrapper (scripts/migrate.js) carga .env.develop.
# Esto es importante: si alguien setea DATABASE_URL en su shell apuntando a prod,
# el wrapper igual va a usar .env.develop (override: false + carga primero el per-env).
Write-Host ""
Write-Host "[3/4] Ejecutando migraciones..." -ForegroundColor Yellow
npm run prisma:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en migraciones" -ForegroundColor Red
    exit 1
}

# 4. Levantar API y Web en ventanas separadas
Write-Host ""
Write-Host "[4/4] Levantando API y Web..." -ForegroundColor Yellow

$startPath = $PSScriptRoot
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$startPath'; `$env:APP_ENV='develop'; Write-Host 'API Server (develop)' -ForegroundColor Cyan; npm run dev:api")
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$startPath'; Write-Host 'Web Frontend' -ForegroundColor Cyan; npm run dev:web")

Write-Host ""
Write-Host "=== Todo listo! ===" -ForegroundColor Green
Write-Host "  API: http://localhost:3000"
Write-Host "  Web: http://localhost:5173"
Write-Host "  DB:  localhost:5432 (barbaros_pos_dev)"

if ($Tunnel) {
    Write-Host ""
    Write-Host "Levantando Cloudflare Tunnels..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Write-Host 'Tunnel Web (5173)' -ForegroundColor Cyan; cloudflared tunnel --url http://localhost:5173")
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Write-Host 'Tunnel API (3000)' -ForegroundColor Cyan; cloudflared tunnel --url http://localhost:3000")
    Write-Host "  Tunnels abiertos - copia las URLs de las ventanas nuevas" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Para detener: docker compose down" -ForegroundColor DarkGray
