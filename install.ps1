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
#   1. Verifica virtualizacion
#   2. Verifica/instala WSL2
#   3. Verifica/instala Docker Desktop
#   4. Verifica/instala Node.js
#   5. Clona el repo (o actualiza)
#   6. Instala dependencias
#   7. Levanta la app

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
    Write-Host "Click derecho -> Ejecutar como administrador" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Barbaros POS - Instalador ===" -ForegroundColor Cyan
Write-Host ""

# --- Check virtualization ---
Write-Section "[0/6] Verificando virtualizacion..."

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
Write-Section "[1/6] Verificando WSL2..."

# Check 1: wsl command exists
$wslExists = Get-Command wsl -ErrorAction SilentlyContinue
if (-not $wslExists) {
    Write-Step "WSL no encontrado. Instalando WSL2..."
    & cmd /c "wsl --install --no-launch" 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Error instalando WSL2. Reinicia el PC y vuelve a ejecutar."
        exit 1
    }
    Write-OK "WSL2 instalado - puede ser necesario reiniciar"
} else {
    # WSL exists — try to detect if it has distros (UTF-16 output, check raw bytes)
    $hasDistro = $false
    try {
        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo.FileName = "wsl"
        $proc.StartInfo.Arguments = "-l -v"
        $proc.StartInfo.RedirectStandardOutput = $true
        $proc.StartInfo.UseShellExecute = $false
        $proc.StartInfo.StandardOutputEncoding = [System.Text.Encoding]::Unicode
        $proc.Start() | Out-Null
        $output = $proc.StandardOutput.ReadToEnd()
        $proc.WaitForExit()
        if ($output -match "docker-desktop" -or $output -match "Ubuntu") {
            $hasDistro = $true
        }
    } catch {
        # Ignore — will be caught by Docker check later
    }

    if ($hasDistro) {
        Write-OK "WSL2 ya instalado"
    } else {
        Write-Step "WSL detectado. Verificando que funcione con Docker..."
        # WSL exists but might need update — Docker check will validate later
        Write-OK "WSL presente (Docker verificara WSL2)"
    }
}

# --- Step 2: Docker Desktop ---
Write-Section "[2/6] Verificando Docker Desktop..."

# Helper: check if Docker daemon is responsive
function Test-DockerReady {
    try {
        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo.FileName = "docker"
        $proc.StartInfo.Arguments = "info"
        $proc.StartInfo.RedirectStandardOutput = $true
        $proc.StartInfo.RedirectStandardError = $true
        $proc.StartInfo.UseShellExecute = $false
        $proc.Start() | Out-Null
        $stdout = $proc.StandardOutput.ReadToEnd()
        $proc.WaitForExit(5000)
        return ($proc.ExitCode -eq 0)
    } catch {
        return $false
    }
}

$dockerReady = Test-DockerReady
if ($dockerReady) {
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

    Write-Step "Esperando a que Docker este listo (puede tardar 1-2 minutos)..."
    $maxWait = 180
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 5
        $waited += 5
        if (Test-DockerReady) {
            Write-OK "Docker listo!"
            break
        }
        Write-Host "  Esperando... $waited s" -ForegroundColor DarkGray
    }
    if ($waited -ge $maxWait) {
        Write-Fail "Docker no se inicio a tiempo"
        Write-Host "  Abri Docker Desktop manualmente y vuelve a ejecutar" -ForegroundColor Yellow
        exit 1
    }
}

# --- Step 3: Node.js ---
Write-Section "[3/6] Verificando Node.js..."

$nodeVersion = node --version 2>&1
if ($nodeVersion -match "v\d+") {
    Write-OK "Node.js $nodeVersion instalado"
} else {
    Write-Step "Descargando Node.js LTS..."
    $nodeInstaller = "$env:TEMP\node-install.msi"
    $nodeUrl = "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
    } catch {
        Write-Fail "No se pudo descargar Node.js"
        Write-Host "  Descargalo manualmente desde: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }

    Write-Step "Instalando Node.js..."
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$nodeInstaller`" /qn"
    Remove-Item $nodeInstaller -ErrorAction SilentlyContinue

    # Refresh PATH
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"

    $nodeVersion = node --version 2>&1
    if ($nodeVersion -match "v\d+") {
        Write-OK "Node.js $nodeVersion instalado"
    } else {
        Write-Fail "Node.js se instalo pero no se detecta en PATH"
        Write-Host "  Reinicia el PC y vuelve a ejecutar" -ForegroundColor Yellow
        exit 1
    }
}

# --- Step 4: Clone or update repo ---
Write-Section "[4/6] Preparando el codigo..."

if (Test-Path "$InstallDir\.git") {
    Write-Step "Repo ya existe, actualizando..."
    Push-Location $InstallDir
    git pull origin main 2>$null
    $pullOk = $LASTEXITCODE -eq 0
    Pop-Location
    if ($pullOk) {
        Write-OK "Codigo actualizado"
    } else {
        Write-Step "No se pudo actualizar (usando version local)"
    }
} else {
    Write-Step "Clonando repo..."
    git clone -b main $RepoUrl $InstallDir 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Error clonando repo"
        exit 1
    }
    Write-OK "Repo clonado"
}

Set-Location $InstallDir

# --- Step 5: Install dependencies ---
Write-Section "[5/6] Instalando dependencias..."
npm install 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Error en npm install"
    exit 1
}
Write-OK "Dependencias instaladas"

# --- Step 6: Start app ---
Write-Section "[6/6] Levantando la app en PRODUCCION..."
Write-Step "Ejecutando switch-env.ps1 production..."
& "$InstallDir\switch-env.ps1" production

# --- Done ---
Write-Host ""
Write-Host "=== Barbaros POS esta corriendo! ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Web: http://localhost:5174" -ForegroundColor Cyan
Write-Host "  API: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  DB:  localhost:5433" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para acceder desde otros dispositivos:" -ForegroundColor Yellow
Write-Host "  Abrir navegador a la IP de este PC en puerto 5174" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para que arranque automaticamente al encender:" -ForegroundColor Yellow
Write-Host "  Copiar shortcuts\Barbaros POS.bat a shell:startup" -ForegroundColor Gray
