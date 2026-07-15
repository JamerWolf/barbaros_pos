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

[Dirs]
Name: "{app}\logs"; Flags: uninsalwaysuninstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start-barbaros.ps1"""
Name: "{group}\Detener {#MyAppName}"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\stop-barbaros.ps1"""
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start-barbaros.ps1"""; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear icono en el escritorio"; GroupDescription: "Iconos adicionales:"

[Run]
; Register Task Scheduler auto-start
Filename: "schtasks.exe"; Parameters: "/create /tn ""BarbarosPOS"" /tr ""powershell.exe -ExecutionPolicy Bypass -File {app}\start-barbaros.ps1"" /sc onstart /delay 0000:30 /ru SYSTEM /rl HIGHEST /f"; StatusMsg: "Configurando inicio automatico..."; Flags: runhidden waituntilterminated

; Offer to start after install
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start-barbaros.ps1"""; Description: "Iniciar Barbaros POS ahora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop services before uninstalling
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\stop-barbaros.ps1"""; Flags: runhidden

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

// Pre-install checks and automatic installation
function IsDockerInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('docker', 'version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function IsNodeInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('node', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function DownloadAndInstallNode: Boolean;
var
  ResultCode: Integer;
  InstallerPath: String;
  ScriptPath: String;
begin
  Result := False;
  InstallerPath := ExpandConstant('{tmp}\node-install.msi');
  ScriptPath := ExpandConstant('{tmp}\download.ps1');
  
  WizardForm.StatusLabel.Caption := 'Descargando Node.js v20.18.3...';
  WizardForm.ProgressGauge.Position := 10;
  
  // Create a PowerShell script to download the file
  SaveStringToFile(ScriptPath, 'Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi" -OutFile "' + InstallerPath + '"', False);
  
  // Execute the PowerShell script
  if not Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Error al descargar Node.js. Verifique su conexion a internet.', mbError, MB_OK);
    Exit;
  end;
  
  if not FileExists(InstallerPath) then
  begin
    MsgBox('Error al descargar Node.js. Verifique su conexion a internet.', mbError, MB_OK);
    Exit;
  end;
  
  WizardForm.StatusLabel.Caption := 'Instalando Node.js...';
  WizardForm.ProgressGauge.Position := 50;
  
  // Install Node.js silently
  if Exec('msiexec.exe', '/i "' + InstallerPath + '" /qn /norestart', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Result := True;
      MsgBox('Node.js instalado correctamente.', mbInformation, MB_OK);
    end
    else
    begin
      MsgBox('Error al instalar Node.js. Codigo: ' + IntToStr(ResultCode), mbError, MB_OK);
    end;
  end
  else
  begin
    MsgBox('No se pudo ejecutar el instalador de Node.js.', mbError, MB_OK);
  end;
end;

function DownloadAndInstallDocker: Boolean;
var
  ResultCode: Integer;
  InstallerPath: String;
  ScriptPath: String;
begin
  Result := False;
  InstallerPath := ExpandConstant('{tmp}\docker-install.exe');
  ScriptPath := ExpandConstant('{tmp}\download-docker.ps1');
  
  WizardForm.StatusLabel.Caption := 'Descargando Docker Desktop...';
  WizardForm.ProgressGauge.Position := 10;
  
  // Create a PowerShell script to download the file
  SaveStringToFile(ScriptPath, 'Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile "' + InstallerPath + '"', False);
  
  // Execute the PowerShell script
  if not Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Error al descargar Docker Desktop. Verifique su conexion a internet.', mbError, MB_OK);
    Exit;
  end;
  
  if not FileExists(InstallerPath) then
  begin
    MsgBox('Error al descargar Docker Desktop. Verifique su conexion a internet.', mbError, MB_OK);
    Exit;
  end;
  
  WizardForm.StatusLabel.Caption := 'Instalando Docker Desktop...';
  WizardForm.ProgressGauge.Position := 50;
  
  // Install Docker Desktop silently
  if Exec(InstallerPath, 'install --quiet --accept-license', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Result := True;
      MsgBox('Docker Desktop instalado correctamente. Es posible que necesite reiniciar el sistema.', mbInformation, MB_OK);
    end
    else
    begin
      MsgBox('Error al instalar Docker Desktop. Codigo: ' + IntToStr(ResultCode), mbError, MB_OK);
    end;
  end
  else
  begin
    MsgBox('No se pudo ejecutar el instalador de Docker Desktop.', mbError, MB_OK);
  end;
end;

function InitializeSetup: Boolean;
var
  NeedRestart: Boolean;
begin
  Result := False;
  NeedRestart := False;
  
  // Check and install Node.js if needed
  if not IsNodeInstalled then
  begin
    if MsgBox('Node.js no está instalado. Se requiere para ejecutar la API.' + #13#10 + #13#10 +
              '¿Desea instalarlo ahora?',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      if DownloadAndInstallNode then
      begin
        // Refresh PATH to detect newly installed Node.js
        EnvAddPath(ExpandConstant('{pf}\nodejs'));
      end;
    end
    else
    begin
      MsgBox('La instalación no puede continuar sin Node.js.', mbError, MB_OK);
      Exit;
    end;
  end;
  
  // Check and install Docker Desktop if needed
  if not IsDockerInstalled then
  begin
    if MsgBox('Docker Desktop no está instalado. Se requiere para ejecutar la base de datos.' + #13#10 + #13#10 +
              '¿Desea instalarlo ahora?' + #13#10 + #13#10 +
              'Nota: Docker Desktop requiere Windows 10/11 Pro o Enterprise con virtualización habilitada.',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      if DownloadAndInstallDocker then
      begin
        NeedRestart := True;
      end;
    end
    else
    begin
      MsgBox('La instalación no puede continuar sin Docker Desktop.', mbError, MB_OK);
      Exit;
    end;
  end;
  
  // If Docker was just installed, we might need a restart
  if NeedRestart then
  begin
    if MsgBox('Se requiere reiniciar el sistema para completar la instalación de Docker Desktop.' + #13#10 + #13#10 +
              '¿Desea reiniciar ahora?',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Result := True;
      PendingReboot := True;
    end
    else
    begin
      MsgBox('Por favor reinicie el sistema manualmente antes de ejecutar Barbaros POS.', mbInformation, MB_OK);
      Result := True;
    end;
  end
  else
  begin
    Result := True;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // Remove old Task Scheduler task before creating new one
    Exec('schtasks.exe', '/delete /tn "BarbarosPOS" /f', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    // Stop and remove Task Scheduler task
    Exec('schtasks.exe', '/end /tn "BarbarosPOS"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('schtasks.exe', '/delete /tn "BarbarosPOS" /f', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
