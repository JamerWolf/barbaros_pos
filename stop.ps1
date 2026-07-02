# stop.ps1 — Detiene la DB (Docker)
# Uso: .\stop.ps1

Write-Host "Deteniendo PostgreSQL..." -ForegroundColor Yellow
docker compose down
Write-Host "Listo!" -ForegroundColor Green
