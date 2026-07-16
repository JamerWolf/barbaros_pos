; Barbaros POS — Inno Setup Script
; Compiles to a single .exe installer for the company PC
; Requires: Inno Setup 6.x

#define MyAppName "Barbaros POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Barbaros"
#define MyAppURL "https://github.com/barbaros/pos"
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

; Root package.json for npm install
Source: "..\apps\api\package.json"; DestDir: "{app}"

; Installer scripts
Source: "..\installer\staging\start-barbaros.ps1"; DestDir: "{app}"
Source: "..\installer\staging\stop-barbaros.ps1"; DestDir: "{app}"
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

; Stop PostgreSQL service
Filename: "sc.exe"; Parameters: "stop postgresql-x64-16"; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\apps"
Type: filesandordirs; Name: "{app}\node_modules"
Type: files; Name: "{app}\*.ps1"
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

// Add installer to RunOnce registry so it auto-runs after reboot
procedure AddToRunOnce();
var
  InstallerPath: String;
begin
  InstallerPath := ExpandConstant('{srcexe}');
  
  RegWriteStringValue(
    HKCU,
    'Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'BarbarosPOS',
    '"' + InstallerPath + '"'
  );
end;

// Reboot the computer
procedure RebootComputer();
var
  ResultCode: Integer;
begin
  Exec(
    'shutdown.exe',
    '/r /t 30 /c "Barbaros POS requiere reiniciar para completar la instalación. El instalador se ejecutará automáticamente después del reinicio." /d p:2:4',
    '',
    SW_HIDE,
    ewNoWait,
    ResultCode
  );
end;

// Check if Node.js is installed
function IsNodeInstalled: Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{pf64}\nodejs\node.exe')) or
    FileExists(ExpandConstant('{pf}\nodejs\node.exe'));
end;

// Download and install Node.js
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

// Check if PostgreSQL is installed
function IsPostgreSQLInstalled: Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{pf}\PostgreSQL\16\bin\pg_isready.exe')) or
    FileExists(ExpandConstant('{pf64}\PostgreSQL\16\bin\pg_isready.exe'));
end;

// Download and install PostgreSQL
function DownloadAndInstallPostgreSQL: Boolean;
var
  ResultCode: Integer;
  Url: string;
  InstallerPath: string;
begin
  Result := False;

  // PostgreSQL 16.3 for Windows x64
  Url := 'https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64.exe';
  InstallerPath := ExpandConstant('{tmp}\postgresql-install.exe');

  WizardForm.StatusLabel.Caption := 'Descargando PostgreSQL...';
  WizardForm.ProgressGauge.Position := 20;

  try
    DownloadTemporaryFile(Url, 'postgresql-install.exe', '', nil);
  except
    MsgBox(
      'No fue posible descargar PostgreSQL.' + #13#10 +
      'Verifique su conexión a Internet.',
      mbError,
      MB_OK
    );
    Exit;
  end;

  if not FileExists(InstallerPath) then
  begin
    MsgBox('El instalador de PostgreSQL no se descargó correctamente.', mbError, MB_OK);
    Exit;
  end;

  WizardForm.StatusLabel.Caption := 'Instalando PostgreSQL...';
  WizardForm.ProgressGauge.Position := 40;

  // Silent installation with EDB installer
  // --mode unattended: silent install
  // --superpassword: password for postgres user
  // --serverport: port number
  // --locale: locale setting
  if Exec(
      InstallerPath,
      '--mode unattended --superpassword barbaros --serverport 5432 --locale Spanish_Argentina.1252 --disable-components pgAdmin',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Result := True;
      MsgBox('PostgreSQL instalado correctamente.', mbInformation, MB_OK);
    end
    else
    begin
      MsgBox(
        'La instalación de PostgreSQL falló.' + #13#10 +
        'Código: ' + IntToStr(ResultCode),
        mbError,
        MB_OK
      );
    end;
  end
  else
  begin
    MsgBox('No fue posible ejecutar el instalador de PostgreSQL.', mbError, MB_OK);
  end;
end;

// Wait for PostgreSQL service to be running
function WaitForPostgreSQLService(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
  Output: String;
  TmpFile: String;
begin
  Result := False;
  TmpFile := ExpandConstant('{tmp}\pgservice.txt');
  
  // Try for up to 2 minutes
  for I := 1 to 24 do
  begin
    if Exec(
        'sc.exe',
        'query postgresql-x64-16',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      // Check if service is running (STATE: 4 RUNNING)
      if Exec(
          'powershell.exe',
          '-Command "(Get-Service postgresql-x64-16).Status | Out-File -FilePath ''' + TmpFile + ''' -Encoding utf8"',
          '',
          SW_HIDE,
          ewWaitUntilTerminated,
          ResultCode) then
      begin
        if LoadStringFromFile(TmpFile, Output) then
        begin
          if Pos('Running', Output) > 0 then
          begin
            Result := True;
            DeleteFile(TmpFile);
            Exit;
          end;
        end;
      end;
    end;
    
    Sleep(5000);
  end;
  
  DeleteFile(TmpFile);
end;

// Wait for PostgreSQL to accept connections
function WaitForPostgreSQLReady(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
  PgBin: String;
begin
  Result := False;
  
  // Find pg_isready
  if FileExists(ExpandConstant('{pf64}\PostgreSQL\16\bin\pg_isready.exe')) then
    PgBin := ExpandConstant('{pf64}\PostgreSQL\16\bin\pg_isready.exe')
  else if FileExists(ExpandConstant('{pf}\PostgreSQL\16\bin\pg_isready.exe')) then
    PgBin := ExpandConstant('{pf}\PostgreSQL\16\bin\pg_isready.exe')
  else
    Exit;
  
  // Try for up to 60 seconds
  for I := 1 to 12 do
  begin
    if Exec(
        PgBin,
        '-U barbaros -d barbaros_pos',
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

// Install Node.js dependencies
function InstallNodeDependencies(): Boolean;
var
  ResultCode: Integer;
  NpmBin: String;
begin
  Result := False;
  
  WizardForm.StatusLabel.Caption := 'Instalando dependencias...';
  
  // Find npm
  if FileExists(ExpandConstant('{pf64}\nodejs\npm.cmd')) then
    NpmBin := ExpandConstant('{pf64}\nodejs\npm.cmd')
  else if FileExists(ExpandConstant('{pf}\nodejs\npm.cmd')) then
    NpmBin := ExpandConstant('{pf}\nodejs\npm.cmd')
  else
  begin
    MsgBox('No se encontró npm. Verifique la instalación de Node.js.', mbError, MB_OK);
    Exit;
  end;
  
  // Run npm install
  if Exec(
      NpmBin,
      'install --omit=dev --ignore-scripts',
      ExpandConstant('{app}'),
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Result := (ResultCode = 0);
  end
  else
  begin
    MsgBox('No fue posible ejecutar npm install.', mbError, MB_OK);
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
    RemoveFromRunOnce();
    Log('Running in post-reboot mode');
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // === 1. Verificar Node.js ===
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
    
    // === 2. Verificar PostgreSQL ===
    if not PostRebootMode then
    begin
      if not IsPostgreSQLInstalled then
      begin
        if MsgBox(
            'PostgreSQL no está instalado.' + #13#10 +
            'Es necesario para la base de datos.' + #13#10 + #13#10 +
            '¿Desea instalarlo ahora?',
            mbConfirmation,
            MB_YESNO) = IDYES then
        begin
          if not DownloadAndInstallPostgreSQL then
            RaiseException('No se pudo instalar PostgreSQL.');
        end
        else
          RaiseException('La instalación requiere PostgreSQL.');
      end;
    end
    else
    begin
      // In post-reboot mode, verify PostgreSQL is now installed
      if not IsPostgreSQLInstalled then
      begin
        MsgBox(
          'PostgreSQL no se instaló correctamente.' + #13#10 +
          'Instale PostgreSQL manualmente y vuelva a ejecutar el instalador.',
          mbError,
          MB_OK);
        
        Abort;
      end;
      
      Log('PostgreSQL detected after reboot');
    end;

    // === 3. Eliminar servicio anterior si existe ===
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
    // === 1. Instalar dependencias Node.js ===
    if not InstallNodeDependencies() then
    begin
      MsgBox(
        'La instalación de dependencias Node.js falló.' + #13#10 +
        'Verifique la conexión a Internet.',
        mbError,
        MB_OK);
      
      Abort;
    end;

    // === 2. Esperar a que PostgreSQL esté corriendo ===
    WizardForm.StatusLabel.Caption := 'Esperando a que PostgreSQL inicie...';
    
    if not WaitForPostgreSQLService() then
    begin
      MsgBox(
        'El servicio PostgreSQL no inició después de 2 minutos.' + #13#10 +
        'Verifique el estado del servicio en services.msc',
        mbError,
        MB_OK);
      
      Abort;
    end;

    // === 3. Esperar a que PostgreSQL acepte conexiones ===
    WizardForm.StatusLabel.Caption := 'Esperando a que PostgreSQL esté listo...';
    
    if not WaitForPostgreSQLReady() then
    begin
      MsgBox(
        'PostgreSQL no respondió después de 60 segundos.' + #13#10 +
        'Verifique los logs de PostgreSQL.',
        mbError,
        MB_OK);
      
      Abort;
    end;
    
    // === 4. Ejecutar migraciones Prisma ===
    if not RunPrismaMigrations() then
    begin
      MsgBox(
        'Las migraciones de Prisma fallaron.' + #13#10 +
        'Verifique la conexión a la base de datos.',
        mbError,
        MB_OK);
      
      Abort;
    end;

    // === 5. Crear servicio Windows para la API ===
    WizardForm.StatusLabel.Caption := 'Instalando servicio Windows...';

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'install BarbarosPOS "C:\Program Files\nodejs\node.exe"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

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

    // === 6. Iniciar servicio ===
    WizardForm.StatusLabel.Caption := 'Iniciando servicio...';

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'start BarbarosPOS',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);
    
    // === 7. Verificar que la API responde ===
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
    // Stop and remove API service
    Exec(ExpandConstant('{app}\nssm.exe'), 'stop BarbarosPOS', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'remove BarbarosPOS confirm', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // Stop PostgreSQL service
    Exec('sc.exe', 'stop postgresql-x64-16', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
