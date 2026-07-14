# switch-env.ps1 - Single entry point to switch between develop and production
#
# Uso:
#   .\switch-env.ps1 develop              Levanta develop (DB dev, API :3000)
#   .\switch-env.ps1 develop -Tunnel      develop + Cloudflare Tunnels
#   .\switch-env.ps1 production           Levanta production (DB prod, API :3001)
#   .\switch-env.ps1 production -Tunnel   production + Cloudflare Tunnels
#   .\switch-env.ps1 stop                 Mata todos los procesos de dev y prod
#   .\switch-env.ps1 status               Muestra el estado actual
#
# Este script es la UNICA forma de levantar la app. El viejo start.ps1 se
# conserva como alias de switch-env.ps1 develop por compatibilidad, pero los
# nuevos operadores deben usar este script.

param(
    [Parameter(Position = 0)]
    [ValidateSet("develop", "production", "stop", "status")]
    [string]$Command,

    [switch]$Tunnel,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# --- Configuracion ---------------------------------------------------------

$REPO_ROOT = $PSScriptRoot
$DEV_API_PORT = 3000
$DEV_WEB_PORT = 5173
$PROD_API_PORT = 3001
$PROD_WEB_PORT = 5174

$DEV_BRANCH = "develop"
$PROD_BRANCH = "main"

$DEV_DB_CONTAINER = "barbaros-pos-db-dev"
$PROD_DB_CONTAINER = "barbaros-pos-db-prod"
$DEV_DB_NAME = "barbaros_pos_dev"
$PROD_DB_NAME = "barbaros_pos_prod"

# --- Helpers ---------------------------------------------------------------

function Write-Section($msg) {
    Write-Host ""
    Write-Host $msg -ForegroundColor Yellow
}

function Get-CurrentBranch {
    $branch = git -C $REPO_ROOT rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo determinar la rama actual de git." }
    return $branch.Trim()
}

function Test-WorkingTreeClean {
    $status = git -C $REPO_ROOT status --porcelain 2>$null
    return [string]::IsNullOrWhiteSpace($status)
}

function Kill-PortIfBusy($port, $label) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid_ = $conn.OwningProcess
        Write-Host "  Puerto $port ocupado por PID $pid_ ($label). Matando..." -ForegroundColor DarkYellow
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

function Wait-DockerReady {
    Write-Section "[0] Verificando Docker..."
    $out = & cmd /c "docker info 2>nul"
    $dockerRunning = $out | Select-String "Server Version"
    if ($dockerRunning) {
        Write-Host "  Docker listo!" -ForegroundColor Green
        return
    }

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
        $out = & cmd /c "docker info 2>nul"
        $check = $out | Select-String "Server Version"
        if ($check) {
            Write-Host "  Docker listo!" -ForegroundColor Green
            return
        }
        Write-Host "  Esperando... ($waited s)"
    }
    Write-Host "  Docker no se inicio a tiempo" -ForegroundColor Red
    exit 1
}

function Wait-DbReady($container, $db) {
    $maxRetries = 20
    $retries = 0
    while ($retries -lt $maxRetries) {
        $check = docker exec $container pg_isready -U barbaros -d $db 2>&1
        if ($LASTEXITCODE -eq 0) { return }
        $retries++
        Write-Host "  Esperando DB... ($retries/$maxRetries)"
        Start-Sleep -Seconds 1
    }
    throw "La DB $db no respondio a tiempo."
}

function Start-AppWindows($apiPort, $webPort, $appEnv) {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "Set-Location '$REPO_ROOT/apps/api'; `$env:APP_ENV='$appEnv'; `$env:PORT='$apiPort'; Write-Host 'API Server ($appEnv, port $apiPort)' -ForegroundColor Cyan; npm run dev"
    )
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "Set-Location '$REPO_ROOT'; `$env:API_PORT='$apiPort'; `$env:VITE_PORT='$webPort'; Write-Host 'Web Frontend (port $webPort, API port $apiPort)' -ForegroundColor Cyan; npm run dev:web"
    )
}

# --- Comandos ---------------------------------------------------------------

function Stop-All {
    Write-Section "[stop] Matando todos los procesos de dev y prod..."
    Kill-PortIfBusy $DEV_API_PORT "dev API"
    Kill-PortIfBusy $DEV_WEB_PORT "dev Web"
    Kill-PortIfBusy $PROD_API_PORT "prod API"
    Kill-PortIfBusy $PROD_WEB_PORT "prod Web"
    Write-Host "  Listo. Ningun puerto ocupado." -ForegroundColor Green
}

function Show-Status {
    Write-Section "[status] Estado actual"
    $branch = Get-CurrentBranch
    Write-Host "  Rama actual:        $branch"
    Write-Host "  Working tree clean: $(Test-WorkingTreeClean)"
    Write-Host ""
    foreach ($p in @(@{n='dev API'; port=$DEV_API_PORT}, @{n='dev Web'; port=$DEV_WEB_PORT}, @{n='prod API'; port=$PROD_API_PORT}, @{n='prod Web'; port=$PROD_WEB_PORT})) {
        $busy = Get-NetTCPConnection -LocalPort $p.port -State Listen -ErrorAction SilentlyContinue
        $status = if ($busy) { "OCUPADO (PID $($busy.OwningProcess))" } else { "libre" }
        Write-Host ("  {0,-10} :{1,-5} {2}" -f $p.n, $p.port, $status)
    }
    Write-Host ""
    foreach ($c in @($DEV_DB_CONTAINER, $PROD_DB_CONTAINER)) {
        $running = docker ps --filter "name=^${c}$" --format "{{.Names}}" 2>$null
        $status = if ($running) { "corriendo" } else { "detenido" }
        Write-Host "  $c : $status"
    }
}

function Start-Env($envName) {
    $config = @{
        "develop" = @{
            branch = $DEV_BRANCH
            appEnv = "develop"
            apiPort = $DEV_API_PORT
            webPort = $DEV_WEB_PORT
            dbContainer = $DEV_DB_CONTAINER
            dbName = $DEV_DB_NAME
            composeService = "postgres-dev"
        }
        "production" = @{
            branch = $PROD_BRANCH
            appEnv = "production"
            apiPort = $PROD_API_PORT
            webPort = $PROD_WEB_PORT
            dbContainer = $PROD_DB_CONTAINER
            dbName = $PROD_DB_NAME
            composeService = "postgres-prod"
        }
    }[$envName]

    Write-Host "=== Barbaros POS - Switch to $envName ===" -ForegroundColor Cyan
    Write-Host "  Rama esperada: $($config.branch)"
    Write-Host "  APP_ENV:       $($config.appEnv)"
    Write-Host "  API port:      $($config.apiPort)"
    Write-Host "  Web port:      $($config.webPort)"
    Write-Host "  DB:            $($config.dbName) (container $($config.dbContainer))"

    # 0. Verificar que Docker este corriendo
    Wait-DockerReady

    # 1. Verificar y forzar la rama
    $currentBranch = Get-CurrentBranch
    if ($currentBranch -ne $config.branch) {
        if (-not (Test-WorkingTreeClean)) {
            Write-Host ""
            Write-Host "  ERROR: estas en '$currentBranch' pero $envName requiere '$($config.branch)'." -ForegroundColor Red
            Write-Host "  Tienes cambios sin commitear. Commitea o stashea antes de cambiar." -ForegroundColor Red
            exit 2
        }
        Write-Host ""
        Write-Host "  Cambiando de rama: $currentBranch -> $($config.branch)" -ForegroundColor Cyan
        $ErrorActionPreferenceOld = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        git -C $REPO_ROOT checkout $config.branch
        $ErrorActionPreference = $ErrorActionPreferenceOld
    }

    # 2. Forzar APP_ENV para que se propague a todos los procesos hijos
    $env:APP_ENV = $config.appEnv

    # 3. Limpiar puertos del ambiente destino
    Write-Section "[1/4] Limpiando puertos previos..."
    Kill-PortIfBusy $config.apiPort "API anterior"
    Kill-PortIfBusy $config.webPort "Web anterior"

    # 4. Levantar DB
    # PowerShell's native invocation of docker.exe treats any stderr
    # output (e.g. "Container X Running") as a non-terminating error,
    # which breaks our control flow. Routing through cmd.exe with
    # explicit stdout-only redirection gives us clean output and a
    # reliable exit code. We use a here-string and let cmd do the
    # parsing to avoid PowerShell's variable interpolation.
    Write-Section "[2/4] Levantando $($config.dbContainer)..."
    $serviceName = $config.composeService
    $out = & cmd /c "docker compose up -d $serviceName 2>&1"
    foreach ($line in $out) { Write-Host "  $line" }
    if ($LASTEXITCODE -ne 0) { throw "Error al levantar Docker (exit $LASTEXITCODE)." }

    # 5. Esperar DB
    Write-Section "[3/4] Esperando DB..."
    Wait-DbReady $config.dbContainer $config.dbName
    Write-Host "  PostgreSQL listo!" -ForegroundColor Green

    # 6. Migraciones via wrapper seguro
    # En develop: prisma:migrate (wrapper -> migrate dev, genera nueva migracion si hay cambios)
    # En production: prisma:deploy (wrapper -> migrate deploy, solo aplica migraciones existentes)
    # El wrapper (scripts/migrate.js) lee .env.<env> y bloquea comandos peligrosos en prod.
    Write-Section "[4/4] Corriendo migraciones..."

    # First ensure prisma client is generated
    Write-Step "Generando Prisma Client..."
    $ErrorActionPreferenceOld = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    npm run --prefix apps/api prisma:generate 2>$null
    $ErrorActionPreference = $ErrorActionPreferenceOld

    $npmScript = if ($config.appEnv -eq 'production') { 'prisma:deploy' } else { 'prisma:migrate' }
    $ErrorActionPreference = "SilentlyContinue"
    & cmd /c "npm run --prefix apps/api $npmScript"
    $migOk = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $ErrorActionPreferenceOld

    if (-not $migOk) {
        Write-Host "  Migraciones fallaron. Abortando." -ForegroundColor Red
        exit 1
    }
    Write-OK "Migraciones completadas"

    # 7. Levantar API + Web
    Write-Section "[start] Levantando API y Web..."
    Start-AppWindows $config.apiPort $config.webPort $config.appEnv

    Write-Host ""
    Write-Host "=== Listo! ===" -ForegroundColor Green
    Write-Host "  API: http://localhost:$($config.apiPort)"
    Write-Host "  Web: http://localhost:$($config.webPort)"
    Write-Host "  DB:  $($config.dbName) on $($config.dbContainer)"
    Write-Host "  APP_ENV=$($config.appEnv) (rama $($config.branch))"

    if ($Tunnel) {
        Write-Host ""
        Write-Host "Levantando Cloudflare Tunnels..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Write-Host 'Tunnel Web ($($config.webPort))' -ForegroundColor Cyan; cloudflared tunnel --url http://localhost:$($config.webPort)")
        Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Write-Host 'Tunnel API ($($config.apiPort))' -ForegroundColor Cyan; cloudflared tunnel --url http://localhost:$($config.apiPort)")
        Write-Host "  Tunnels abiertos - copia las URLs de las ventanas nuevas" -ForegroundColor DarkGray
    }
}

# --- Main ------------------------------------------------------------------

if (-not $Command) {
    Write-Host "Uso: .\switch-env.ps1 <develop|production|stop|status> [-Tunnel]" -ForegroundColor Yellow
    exit 1
}

switch ($Command) {
    "stop" { Stop-All }
    "status" { Show-Status }
    "develop" { Start-Env "develop" }
    "production" { Start-Env "production" }
}
