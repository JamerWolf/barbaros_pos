# start.ps1 — Levanta DB (Docker), API y Web
# Uso: .\start.ps1

Write-Host "=== Barbaros POS — Start ===" -ForegroundColor Cyan

# 1. Levantar PostgreSQL
Write-Host "`n[1/4] Levantando PostgreSQL..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al levantar Docker" -ForegroundColor Red
    exit 1
}

# 2. Esperar a que la DB esté lista
Write-Host "[2/4] Esperando a que PostgreSQL esté listo..." -ForegroundColor Yellow
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
    Write-Host "  PostgreSQL no respondió a tiempo" -ForegroundColor Red
    exit 1
}

# 3. Ejecutar migraciones
Write-Host "[3/4] Ejecutando migraciones..." -ForegroundColor Yellow
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en migraciones" -ForegroundColor Red
    exit 1
}

# 4. Levantar API y Web en ventanas separadas
Write-Host "[4/4] Levantando API y Web..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; Write-Host 'API Server' -ForegroundColor Cyan; npm run dev:api" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; Write-Host 'Web Frontend' -ForegroundColor Cyan; npm run dev:web" -WindowStyle Normal

Write-Host "`n=== Todo listo! ===" -ForegroundColor Green
Write-Host "  API:   http://localhost:3000" -ForegroundColor White
Write-Host "  Web:   http://localhost:5173" -ForegroundColor White
Write-Host "  DB:    localhost:5432" -ForegroundColor White
Write-Host "`nPara detener: docker compose down" -ForegroundColor DarkGray
