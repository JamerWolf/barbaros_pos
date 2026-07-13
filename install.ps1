# install.ps1 - Instalador automatico para el portatil del bar
# Uso:
#   Set-ExecutionPolicy Bypass -Scope Process -Force; .\install.ps1
#
# Requisitos:
#   - Windows 10/11 Pro
#   - 8 GB RAM minimo
#   - Virtualizacion habilitada en BIOS
#
# Este script:
#   1. Verifica/instala WSL2
#   2. Verifica/instala Docker Desktop
#   3. Clona el repo (o actualiza)
#   4. Levanta la app

param(
    [string]$InstallDir = "C:\barbaros_pos",
    [string]$RepoUrl = "https://github.com/JamerWolf/barbaros_pos.git"
)

$ErrorActionPreference = "Stop"

function Write-Section($msg) {
    Write-Host ""
    Write-Host $msg -ForegroundColor Yellow
}

function Write-Step($msg) {
    Write-Host "  $msg" -ForegroundColor Cyan
}

function Write-OK($msg) {
    Write-Host "  $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "  $msg" -ForegroundColor Red
}

# --- Check admin rights ---
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Este script necesita permisos de administrador." -ForegroundColor Red
    Write-Host "Click derecho → Ejecutar como administrador" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Bárbaro's POS - Instalador ===" -ForegroundColor Cyan
Write-Host ""

# --- Check virtualization ---
Write-Section "[0/5] Verificando virtualizacion..."

$virt = (Get-CimInstance -ClassName Win32_Processor).VirtualizationFirmwareEnabled
if ($virt -eq $true) {
    Write-OK "Virtualizacion habilitada en BIOS"
} else {
    Write-Fail "Virtualizacion NO habilitada"
    Write-Host ""
    Write-Host "  Docker y WSL2 necesitan virtualizacion de hardware (VT-x o AMD-V)." -ForegroundColor Yellow
    Write-Host "  Para habilitarla:" -ForegroundColor Yellow
    Write-Host "    1. Reiniciar el PC" -ForegroundColor Gray
    Write-Host "    2. Entrar al BIOS (F2, F10, Del, o Esc al encender)" -ForegroundColor Gray
    Write-Host "    3. Buscar 'Virtualization Technology' o 'SVM Mode'" -ForegroundColor Gray
    Write-Host "    4. Habilitarlo y guardar" -ForegroundColor Gray
    Write-Host "    5. Volver a ejecutar este script" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# --- Step 1: WSL2 ---
Write-Section "[1/5] Verificando WSL2..."

$wslVersion = wsl --version 2>&1
if ($wslVersion -match "WSL version") {
    Write-OK "WSL2 ya instalado"
} else {
    Write-Step "Instalando WSL2..."
    wsl --install --no-launch 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Error instalando WSL2. Reinicia el PC y vuelve a ejecutar."
        exit 1
    }
    Write-OK "WSL2 instalado — puede ser necesario reiniciar"
}

# --- Step 2: Docker Desktop ---
Write-Section "[2/5] Verificando Docker Desktop..."

$dockerRunning = & cmd /c "docker info 2>nul" | Select-String "Server Version"
if ($dockerRunning) {
    Write-OK "Docker Desktop ya corriendo"
} else {
    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Write-Step "Docker Desktop instalado, abriendo..."
        Start-Process $dockerPath
    } else {
        Write-Step "Descargando Docker Desktop..."
        $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
        $dockerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $dockerUrl -OutFile $dockerInstaller -UseBasicParsing
        } catch {
            Write-Fail "No se pudo descargar Docker Desktop"
            Write-Host "  Descargalo manualmente desde: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
            Write-Host "  Y vuelve a ejecutar este script" -ForegroundColor Yellow
            exit 1
        }

        Write-Step "Instalando Docker Desktop (esto puede tardar 5-10 minutos)..."
        Start-Process -Wait -FilePath $dockerInstaller -ArgumentList 'install', '--quiet', '--accept-license', '--backend=wsl-2'
        Remove-Item $dockerInstaller -ErrorAction SilentlyContinue

        Write-Step "Iniciando Docker Desktop..."
        Start-Process $dockerPath
    }

    Write-Step "Esperando a que Docker este listo..."
    $maxWait = 120
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 3
        $waited += 3
        $check = & cmd /c "docker info 2>nul" | Select-String "Server Version"
        if ($check) {
            Write-OK "Docker listo!"
            break
        }
        Write-Host "  Esperando... ($waited s)" -ForegroundColor DarkGray
    }
    if ($waited -ge $maxWait) {
        Write-Fail "Docker no se inicio a tiempo"
        Write-Host "  Abri Docker Desktop manualmente y vuelve a ejecutar" -ForegroundColor Yellow
        exit 1
    }
}

# --- Step 3: Clone or update repo ---
Write-Section "[3/5] Preparando el codigo..."

if (Test-Path "$InstallDir\.git") {
    Write-Step "Repo ya existe, actualizando..."
    git -C $InstallDir pull origin develop 2>&1 | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Step "Clonando repo..."
    git clone $RepoUrl $InstallDir 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Error clonando repo"
        exit 1
    }
}

Set-Location $InstallDir

# --- Step 4: Start app ---
Write-Section "[4/5] Levantando la app..."
Write-Step "Ejecutando switch-env.ps1 develop..."
& "$InstallDir\switch-env.ps1" develop

# --- Step 5: Done ---
Write-Section "[5/5] Listo!"
Write-Host ""
Write-Host "=== Barbaros POS esta corriendo! ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Web: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  DB:  localhost:5432" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para acceder desde otros dispositivos:" -ForegroundColor Yellow
Write-Host "  Abrir navegador → http://$(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress):5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para que arranque automaticamente al encender:" -ForegroundColor Yellow
Write-Host "  Copiar shortcuts\Bárbaro's POS.bat a shell:startup" -ForegroundColor Gray
