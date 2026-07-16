; Barbaros POS — Inno Setup Script
; Compiles to a single .exe installer for the company PC
; Requires: Inno Setup 6.x

#define MyAppName "Barbaros POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Barbaros"
#define MyAppURL "https://github.com/barbaros/pos"
#define MyAppExeName "start-barbaros.ps1"
#define InstallDir "C:\Barbaros POS"

[Setup]
AppId={{B4RB4R0S-POS-2024-UNIQUE}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={#InstallDir}
DefaultGroupName={#MyAppName}
OutputDir=..\releases
OutputBaseFilename=barbaros-setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
; SetupIconFile=..\installer\icon.ico
; UninstallDisplayIcon={app}\installer\icon.ico

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; API compiled code
Source: "..\apps\api\dist\*"; DestDir: "{app}\apps\api\dist"; Flags: recursesubdirs
Source: "..\apps\api\generated\*"; DestDir: "{app}\apps\api\generated"; Flags: recursesubdirs
Source: "..\apps\api\prisma\*"; DestDir: "{app}\apps\api\prisma"; Flags: recursesubdirs
Source: "..\apps\api\.env.production"; DestDir: "{app}\apps\api"

; Web build (served by API in production)
Source: "..\apps\web\dist\*"; DestDir: "{app}\apps\web\dist"; Flags: recursesubdirs

; Shared types (compiled + package.json for resolution via node_modules)
Source: "..\packages\shared\dist\*"; DestDir: "{app}\node_modules\@barbaros\shared\dist"; Flags: recursesubdirs
Source: "..\packages\shared\package.json"; DestDir: "{app}\node_modules\@barbaros\shared"

; Root node_modules (production deps only, from staging)
Source: "..\installer\staging\node_modules\*"; DestDir: "{app}\node_modules"; Flags: recursesubdirs skipifsourcedoesntexist

; Installer scripts
Source: "..\installer\staging\docker-compose.yml"; DestDir: "{app}"
Source: "..\installer\staging\start-barbaros.ps1"; DestDir: "{app}"
Source: "..\installer\staging\stop-barbaros.ps1"; DestDir: "{app}"
Source: "..\installer\staging\.env.production"; DestDir: "{app}"
Source: "..\installer\staging\nssm.exe"; DestDir: "{app}"

[Dirs]
Name: "{app}\logs"; Flags: uninsalwaysuninstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\nssm.exe"; Parameters: "start BarbarosPOS"
Name: "{group}\Detener {#MyAppName}"; Filename: "{app}\nssm.exe"; Parameters: "stop BarbarosPOS"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\nssm.exe"; Parameters: "start BarbarosPOS"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear icono en el escritorio"; GroupDescription: "Iconos adicionales:"

[Run]
; (empty — all service setup is done in ssPostInstall to guarantee ordering)

[UninstallRun]
; Stop and remove Windows Service before uninstalling
Filename: "{app}\nssm.exe"; Parameters: "stop BarbarosPOS"; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "remove BarbarosPOS confirm"; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\apps"
Type: filesandordirs; Name: "{app}\packages"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\installer"
Type: files; Name: "{app}\*.ps1"
Type: files; Name: "{app}\*.yml"
Type: files; Name: "{app}\*.json"
Type: files; Name: "{app}\*.env*"

[Code]
var
  PendingReboot: Boolean;
  PostRebootMode: Boolean;

// Check if we're running after a reboot (from RunOnce)
function IsPostReboot(): Boolean;
begin
  Result := RegValueExists(HKCU, 'Software\Microsoft\Windows\CurrentVersion\RunOnce', 'BarbarosPOS');
end;

// Remove installer from RunOnce registry
procedure RemoveFromRunOnce();
begin
  RegDeleteValue(
    HKCU,
    'Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'BarbarosPOS'
  );
end;

// Add directory to system PATH
procedure EnvAddPath(Path: string);
var
  Paths: string;
begin
  if not RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', Paths) then
    Paths := '';
  
  if Pos(';' + Uppercase(Path) + ';', ';' + Uppercase(Paths) + ';') = 0 then
  begin
    if Paths <> '' then
      Paths := Paths + ';' + Path
    else
      Paths := Path;
    
    RegWriteStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', Paths);
  end;
end;

function GetDockerExe(): String;
begin
    if FileExists(ExpandConstant('{pf64}\Docker\Docker\resources\bin\docker.exe')) then
        Result := ExpandConstant('{pf64}\Docker\Docker\resources\bin\docker.exe')
    else
    if FileExists(ExpandConstant('{pf}\Docker\Docker\resources\bin\docker.exe')) then
        Result := ExpandConstant('{pf}\Docker\Docker\resources\bin\docker.exe')
    else
        Result := '';
end;

function DockerExists(): Boolean;
begin
    Result := GetDockerExe() <> '';
end;

function WaitForDockerReady(): Boolean;
var
    DockerExe: String;
    ResultCode: Integer;
    I: Integer;
begin
    Result := False;

    DockerExe := GetDockerExe();

    if DockerExe = '' then
        Exit;

    for I := 1 to 60 do
    begin
        if Exec(
            DockerExe,
            'version',
            '',
            SW_HIDE,
            ewWaitUntilTerminated,
            ResultCode) then
        begin
            if ResultCode = 0 then
            begin
                Result := True;
                Exit;
            end;
        end;

        Sleep(2000);
    end;
end;

function StartDatabase(): Boolean;
var
    DockerExe: String;
    ResultCode: Integer;
begin
    Result := False;

    DockerExe := GetDockerExe();

    if DockerExe = '' then
    begin
        MsgBox(
            'No se encontró docker.exe.',
            mbError,
            MB_OK);

        Exit;
    end;

    if not Exec(
        DockerExe,
        'compose -f "' +
        ExpandConstant('{app}\docker-compose.yml') +
        '" up -d',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
        MsgBox(
            'No fue posible iniciar Docker Compose.',
            mbError,
            MB_OK);

        Exit;
    end;

    if ResultCode <> 0 then
    begin
        MsgBox(
            'Docker Compose devolvió el código ' +
            IntToStr(ResultCode),
            mbError,
            MB_OK);

        Exit;
    end;

    Result := True;
end;

procedure StopDatabase();
var
    DockerExe: String;
    ResultCode: Integer;
begin

    DockerExe := GetDockerExe();

    if DockerExe = '' then
        Exit;

    Exec(
        DockerExe,
        'compose -f "' +
        ExpandConstant('{app}\docker-compose.yml') +
        '" down',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode);

end;

// Check if virtualization is enabled in BIOS/UEFI
function IsVirtualizationEnabled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  
  // Use PowerShell exit code: 0 = virtualization enabled, 1 = disabled
  if Exec(
      'powershell.exe',
      '-Command "if ((Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled -or (Get-CimInstance Win32_ComputerSystem).HypervisorPresent) { exit 0 } else { exit 1 }"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Result := (ResultCode = 0);
  end
  else
  begin
    Result := True; // If we can't check, be optimistic
  end;
end;

// Start Docker Desktop explicitly
function StartDockerDesktop(): Boolean;
var
  ResultCode: Integer;
  DockerExe: String;
begin
  Result := False;
  
  // Find Docker Desktop executable
  if FileExists(ExpandConstant('{pf64}\Docker\Docker\Docker Desktop.exe')) then
    DockerExe := ExpandConstant('{pf64}\Docker\Docker\Docker Desktop.exe')
  else if FileExists(ExpandConstant('{pf}\Docker\Docker\Docker Desktop.exe')) then
    DockerExe := ExpandConstant('{pf}\Docker\Docker\Docker Desktop.exe')
  else
    Exit;
  
  // Start Docker Desktop (non-blocking)
  Exec(
      DockerExe,
      '',
      '',
      SW_HIDE,
      ewNoWait,
      ResultCode);
  
  Result := True;
end;

// Wait for PostgreSQL to be ready using pg_isready
function WaitForPostgreSQL(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
  DockerExe: String;
begin
  Result := False;
  DockerExe := GetDockerExe();
  
  if DockerExe = '' then
    Exit;
  
  // Try for up to 60 seconds
  for I := 1 to 12 do
  begin
    if Exec(
        DockerExe,
        'exec barbaros-pos-db-prod pg_isready -U barbaros -d barbaros_pos',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      if ResultCode = 0 then
      begin
        Result := True;
        Exit;
      end;
    end;
    
    Sleep(5000);
  end;
end;

// Run Prisma migrations
function RunPrismaMigrations(): Boolean;
var
  ResultCode: Integer;
  PrismaBin: String;
  ApiDir: String;
  Cmd: String;
begin
  Result := False;
  
  ApiDir := ExpandConstant('{app}\apps\api');
  PrismaBin := ExpandConstant('{app}\node_modules\.bin\prisma.cmd');
  
  WizardForm.StatusLabel.Caption := 'Ejecutando migraciones...';
  
  // Build command that sets DATABASE_URL and runs prisma in the same process
  // This avoids the issue of env vars not persisting across separate Exec calls
  Cmd := 'set "DATABASE_URL=postgresql://barbaros:barbaros@localhost:5432/barbaros_pos" && ';
  
  if FileExists(PrismaBin) then
  begin
    Cmd := Cmd + '"' + PrismaBin + '" db push --schema="prisma\schema.prisma" --accept-data-loss';
    
    if Exec(
        'cmd.exe',
        '/c "' + Cmd + '"',
        ApiDir,
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      Result := (ResultCode = 0);
    end;
  end
  else
  begin
    // Fallback to npx
    Cmd := Cmd + 'npx prisma db push --schema="prisma\schema.prisma" --accept-data-loss';
    
    if Exec(
        'cmd.exe',
        '/c "' + Cmd + '"',
        ApiDir,
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      Result := (ResultCode = 0);
    end;
  end;
end;

// Verify API is responding
function VerifyAPIHealth(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
begin
  Result := False;
  
  // Try for up to 30 seconds
  for I := 1 to 6 do
  begin
    if Exec(
        'powershell.exe',
        '-Command "try { $r = Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing -TimeoutSec 2; exit $r.StatusCode } catch { exit 1 }"',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      if ResultCode = 200 then
      begin
        Result := True;
        Exit;
      end;
    end;
    
    Sleep(5000);
  end;
end;

// Add installer to RunOnce registry so it auto-runs after reboot
procedure AddToRunOnce();
var
  RunOnceKey: String;
  InstallerPath: String;
begin
  RunOnceKey := 'Software\Microsoft\Windows\CurrentVersion\RunOnce';
  InstallerPath := ExpandConstant('{srcexe}');
  
  RegWriteStringValue(
    HKCU,
    RunOnceKey,
    'BarbarosPOS',
    '"' + InstallerPath + '"'
  );
end;

// Reboot the computer
procedure RebootComputer();
var
  ResultCode: Integer;
begin
  // Use shutdown command with 30 second delay
  Exec(
    'shutdown.exe',
    '/r /t 30 /c "Barbaros POS requiere reiniciar para completar la instalación de Docker Desktop. El instalador se ejecutará automáticamente después del reinicio." /d p:2:4',
    '',
    SW_HIDE,
    ewNoWait,
    ResultCode
  );
end;

// Pre-install checks and automatic installation
function IsDockerInstalled: Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{pf64}\Docker\Docker\Docker Desktop.exe')) or
    FileExists(ExpandConstant('{pf}\Docker\Docker\Docker Desktop.exe'));
end;

function IsNodeInstalled: Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{pf64}\nodejs\node.exe')) or
    FileExists(ExpandConstant('{pf}\nodejs\node.exe'));
end;

function DownloadAndInstallNode: Boolean;
var
  ResultCode: Integer;
  Url: string;
  InstallerPath: string;
begin
  Result := False;

  Url := 'https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi';
  InstallerPath := ExpandConstant('{tmp}\node-install.msi');

  WizardForm.StatusLabel.Caption := 'Descargando Node.js...';
  WizardForm.ProgressGauge.Position := 10;

  try
    DownloadTemporaryFile(Url, 'node-install.msi', '', nil);
  except
    MsgBox(
      'No fue posible descargar Node.js.' + #13#10 +
      'Verifique su conexión a Internet.',
      mbError,
      MB_OK
    );
    Exit;
  end;

  if not FileExists(InstallerPath) then
  begin
    MsgBox('El instalador de Node.js no se descargó correctamente.', mbError, MB_OK);
    Exit;
  end;

  WizardForm.StatusLabel.Caption := 'Instalando Node.js...';
  WizardForm.ProgressGauge.Position := 50;

  if Exec(
      ExpandConstant('{sys}\msiexec.exe'),
      '/i "' + InstallerPath + '" /qn /norestart',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Result := True;
      MsgBox('Node.js instalado correctamente.', mbInformation, MB_OK);
    end
    else
    begin
      MsgBox(
        'La instalación de Node.js falló.' + #13#10 +
        'Código: ' + IntToStr(ResultCode),
        mbError,
        MB_OK
      );
    end;
  end
  else
  begin
    MsgBox('No fue posible ejecutar el instalador de Node.js.', mbError, MB_OK);
  end;
end;

function DownloadAndInstallDocker: Boolean;
var
  ResultCode: Integer;
  Url: string;
  InstallerPath: string;
begin
  Result := False;

  Url := 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';
  InstallerPath := ExpandConstant('{tmp}\docker-install.exe');

  WizardForm.StatusLabel.Caption := 'Descargando Docker Desktop...';
  WizardForm.ProgressGauge.Position := 10;

  try
    DownloadTemporaryFile(Url, 'docker-install.exe', '', nil);
  except
    MsgBox(
      'No fue posible descargar Docker Desktop.' + #13#10 +
      'Verifique su conexión a Internet.',
      mbError,
      MB_OK
    );
    Exit;
  end;
  
  if not FileExists(InstallerPath) then
  begin
    MsgBox(
      'El instalador de Docker Desktop no se descargó correctamente.',
      mbError,
      MB_OK
    );
    Exit;
  end;

  WizardForm.StatusLabel.Caption := 'Instalando Docker Desktop...';
  WizardForm.ProgressGauge.Position := 60;

  if Exec(
      InstallerPath,
      'install --quiet --accept-license',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    case ResultCode of
      0:
      begin
        Result := True;
        
        // Always reboot after Docker installation for stability
        AddToRunOnce();
        
        MsgBox(
          'Docker Desktop instalado correctamente.' + #13#10 +
          'Es necesario reiniciar Windows para completar la configuración.' + #13#10 + #13#10 +
          'El instalador se ejecutará automáticamente después del reinicio.',
          mbInformation,
          MB_OK);
        
        // Reboot in 30 seconds
        RebootComputer();
        
        // Close installer
        WizardForm.Close;
        Exit;
      end;

      3010:
      begin
        Result := True;
        
        // Docker explicitly requested reboot
        AddToRunOnce();
        
        MsgBox(
          'Docker Desktop se instaló correctamente.' + #13#10 +
          'Es necesario reiniciar Windows para completar la instalación.' + #13#10 + #13#10 +
          'El instalador se ejecutará automáticamente después del reinicio.',
          mbInformation,
          MB_OK);
        
        // Reboot in 30 seconds
        RebootComputer();
        
        // Close installer
        WizardForm.Close;
        Exit;
      end;

    else
      MsgBox(
        'La instalación de Docker Desktop falló.' + #13#10 +
        'Código: ' + IntToStr(ResultCode),
        mbError,
        MB_OK);
    end;
  end
  else
    MsgBox(
      'No fue posible ejecutar el instalador de Docker Desktop.',
      mbError,
      MB_OK);
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  
  // Verify Windows 64-bit
  if not IsWin64 then
  begin
    MsgBox(
      'Barbaros POS requiere Windows de 64 bits.' + #13#10 +
      'Este sistema no es compatible.',
      mbError,
      MB_OK);
    
    Result := False;
    Exit;
  end;
  
  // Check if we're running after a reboot
  PostRebootMode := IsPostReboot();
  if PostRebootMode then
  begin
    // Remove from RunOnce so it doesn't run again
    RemoveFromRunOnce();
    
    Log('Running in post-reboot mode (Docker Desktop was just installed)');
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // === 1. Verificar virtualización ===
    WizardForm.StatusLabel.Caption := 'Verificando virtualización...';
    
    if not IsVirtualizationEnabled() then
    begin
      MsgBox(
        'La virtualización (VT-x/AMD-V) no está habilitada en el BIOS/UEFI.' + #13#10 + #13#10 +
        'Docker Desktop requiere virtualización para funcionar.' + #13#10 +
        'Reinicie el equipo, entre al BIOS/UEFI y habilite la virtualización.' + #13#10 + #13#10 +
        'Luego vuelva a ejecutar el instalador.',
        mbError,
        MB_OK);
      
      Abort;
    end;
    
    // === 2. Verificar Node.js ===
    if not IsNodeInstalled then
    begin
      if MsgBox(
          'Node.js no está instalado.' + #13#10 +
          'Se requiere para ejecutar la API.' + #13#10 + #13#10 +
          '¿Desea instalarlo ahora?',
          mbConfirmation,
          MB_YESNO) = IDYES then
      begin
        if not DownloadAndInstallNode then
        begin
          MsgBox(
            'No fue posible instalar Node.js.',
            mbError,
            MB_OK);

          Abort;
        end;
      end
      else
      begin
        RaiseException('La instalación requiere Node.js.');
      end;
    end;
    
    // === 3. Verificar Docker Desktop ===
    // Skip Docker installation if we're in post-reboot mode (Docker was just installed)
    if not PostRebootMode then
    begin
      if not IsDockerInstalled then
      begin
        if MsgBox(
            'Docker Desktop no está instalado.' + #13#10 +
            'Es necesario para ejecutar PostgreSQL.' + #13#10 + #13#10 +
            '¿Desea instalarlo ahora?',
            mbConfirmation,
            MB_YESNO) = IDYES then
        begin
          if not DownloadAndInstallDocker then
            RaiseException('No se pudo instalar Docker Desktop.');
        end
        else
          RaiseException('La instalación requiere Docker Desktop.');
      end;
    end
    else
    begin
      // In post-reboot mode, verify Docker is now installed
      if not IsDockerInstalled then
      begin
        MsgBox(
          'Docker Desktop no se instaló correctamente.' + #13#10 +
          'Instale Docker Desktop manualmente y vuelva a ejecutar el instalador.',
          mbError,
          MB_OK);
        
        Abort;
      end;
      
      Log('Docker Desktop detected after reboot');
    end;

    // === 4. Eliminar servicio anterior si existe ===
    if FileExists(ExpandConstant('{app}\nssm.exe')) then
    begin
      Exec(
        ExpandConstant('{app}\nssm.exe'),
        'stop BarbarosPOS',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode
      );
      Exec(
        ExpandConstant('{app}\nssm.exe'),
        'remove BarbarosPOS confirm',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode
      );
    end;
  end;

  if CurStep = ssPostInstall then
  begin
    // === 1. Iniciar Docker Desktop ===
    WizardForm.StatusLabel.Caption := 'Iniciando Docker Desktop...';
    
    if not StartDockerDesktop() then
    begin
      MsgBox(
        'No fue posible iniciar Docker Desktop.' + #13#10 +
        'Inicie Docker Desktop manualmente y vuelva a ejecutar el instalador.',
        mbError,
        MB_OK);
      
      Abort;
    end;
    
    // === 2. Esperar Docker Desktop ready ===
    WizardForm.StatusLabel.Caption := 'Esperando a que Docker Desktop inicie...';

    if not WaitForDockerReady() then
    begin
      MsgBox(
        'Docker Desktop no terminó de iniciar después de 2 minutos.' + #13#10 +
        'Abra Docker Desktop y vuelva a ejecutar el instalador.',
        mbError,
        MB_OK);

      Abort;
    end;

    // === 3. docker compose up ===
    WizardForm.StatusLabel.Caption := 'Iniciando PostgreSQL...';

    if not StartDatabase() then
      Abort;

    // === 4. Esperar PostgreSQL ready ===
    WizardForm.StatusLabel.Caption := 'Esperando a que PostgreSQL esté listo...';
    
    if not WaitForPostgreSQL() then
    begin
      MsgBox(
        'PostgreSQL no respondió después de 60 segundos.' + #13#10 +
        'Verifique los logs de Docker Desktop.',
        mbError,
        MB_OK);
      
      Abort;
    end;
    
    // === 5. Ejecutar migraciones Prisma ===
    WizardForm.StatusLabel.Caption := 'Ejecutando migraciones de base de datos...';
    
    if not RunPrismaMigrations() then
    begin
      MsgBox(
        'Las migraciones de Prisma fallaron.' + #13#10 +
        'Verifique la conexión a la base de datos.',
        mbError,
        MB_OK);
      
      Abort;
    end;

    // === 6. Crear servicio NSSM ===
    WizardForm.StatusLabel.Caption := 'Instalando servicio Windows...';

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'install BarbarosPOS "C:\Program Files\nodejs\node.exe"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    // Configure service
    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS AppDirectory "' + ExpandConstant('{app}\apps\api') + '"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS AppParameters "dist/index.js"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS AppEnvironmentExtra "APP_ENV=production"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS AppRestartDelay 5000',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS Start SERVICE_AUTO_START',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS ObjectName LocalSystem',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS AppStdout "' + ExpandConstant('{app}\logs\api-stdout.log') + '"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'set BarbarosPOS AppStderr "' + ExpandConstant('{app}\logs\api-stderr.log') + '"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

    // === 7. Iniciar servicio ===
    WizardForm.StatusLabel.Caption := 'Iniciando servicio...';

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'start BarbarosPOS',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);
    
    // === 8. Verificar que la API responde ===
    WizardForm.StatusLabel.Caption := 'Verificando que la API esté funcionando...';
    
    if not VerifyAPIHealth() then
    begin
      MsgBox(
        'La API no respondió después de 30 segundos.' + #13#10 +
        'Verifique los logs en: ' + ExpandConstant('{app}\logs') + #13#10 + #13#10 +
        'El servicio se instaló correctamente pero puede requerir atención manual.',
        mbInformation,
        MB_OK);
    end
    else
    begin
      MsgBox(
        '¡Instalación completada exitosamente!' + #13#10 + #13#10 +
        'Barbaros POS está corriendo como servicio Windows.' + #13#10 +
        'Se iniciará automáticamente al encender el equipo.',
        mbInformation,
        MB_OK);
    end;

  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
    ResultCode: Integer;
begin

    if CurUninstallStep = usUninstall then
    begin

        StopDatabase();

        Exec(
            ExpandConstant('{app}\nssm.exe'),
            'stop BarbarosPOS',
            '',
            SW_HIDE,
            ewWaitUntilTerminated,
            ResultCode);

        Exec(
            ExpandConstant('{app}\nssm.exe'),
            'remove BarbarosPOS confirm',
            '',
            SW_HIDE,
            ewWaitUntilTerminated,
            ResultCode);

    end;

end;
