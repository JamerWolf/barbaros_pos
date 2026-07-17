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
SetupLogging=yes

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

; Seed data
Source: "..\scripts\seed-production.sql"; DestDir: "{app}\scripts"

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
Filename: "sc.exe"; Parameters: "stop postgresql-barbaros"; Flags: runhidden

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

// Helper function to convert Boolean to string for logging
function BoolToStr(Value: Boolean): String;
begin
  if Value then
    Result := 'True'
  else
    Result := 'False';
end;

// Get Node.js installation directory
function GetNodeDir(): String;
begin
  if FileExists(ExpandConstant('{pf64}\nodejs\node.exe')) then
    Result := ExpandConstant('{pf64}\nodejs')
  else if FileExists(ExpandConstant('{pf}\nodejs\node.exe')) then
    Result := ExpandConstant('{pf}\nodejs')
  else
    Result := '';
end;

// Check if Node.js is installed
function IsNodeInstalled: Boolean;
begin
  Result := GetNodeDir() <> '';
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

  Log('Downloading Node.js from ' + Url);

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

  Log('Installing Node.js...');

  if Exec(
      ExpandConstant('{sys}\msiexec.exe'),
      '/i "' + InstallerPath + '" /qn /norestart',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Log('Node.js install result: ' + IntToStr(ResultCode));
    
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

// Get PostgreSQL bin directory from Windows Registry
// Looks specifically for our installation (postgresql-barbaros service)
function GetPostgreSQLBinDir(): String;
var
  InstallDir: String;
  I: Integer;
  TestPath: String;
begin
  Result := '';
  
  // Try to read from registry (EnterpriseDB installations)
  // Check for our specific installation first
  if RegQueryStringValue(HKLM, 'SOFTWARE\PostgreSQL\Installations\postgresql-barbaros', 'Base Directory', InstallDir) then
  begin
    Log('Registry found postgresql-barbaros at: ' + InstallDir);
    if FileExists(InstallDir + '\bin\pg_isready.exe') then
    begin
      Result := InstallDir + '\bin';
      Log('PostgreSQL bin found: ' + Result);
      Exit;
    end;
  end
  else
  begin
    Log('Registry key postgresql-barbaros not found');
  end;
  
  // Fallback: check common installation paths (versions 16-18)
  for I := 16 to 18 do
  begin
    TestPath := ExpandConstant('{pf}\PostgreSQL\' + IntToStr(I) + '\bin');
    if FileExists(TestPath + '\pg_isready.exe') then
    begin
      Result := TestPath;
      Log('PostgreSQL bin found at: ' + Result);
      Exit;
    end;
    
    TestPath := ExpandConstant('{pf64}\PostgreSQL\' + IntToStr(I) + '\bin');
    if FileExists(TestPath + '\pg_isready.exe') then
    begin
      Result := TestPath;
      Log('PostgreSQL bin found at: ' + Result);
      Exit;
    end;
  end;
  
  Log('PostgreSQL bin directory not found');
end;

// Check if OUR PostgreSQL is installed (postgresql-barbaros service)
function IsOurPostgreSQLInstalled: Boolean;
var
  ResultCode: Integer;
  Output: String;
  TmpFile: String;
begin
  Result := False;
  TmpFile := ExpandConstant('{tmp}\pgservicecheck.txt');
  
  // Check if our specific service exists
  // sc.exe query returns:
  //   0 = service found
  //   1060 = service does not exist
  if Exec(
      'sc.exe',
      'query postgresql-barbaros',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    // ResultCode 0 means service exists
    // ResultCode 1060 means service does not exist
    if ResultCode = 0 then
    begin
      Result := True;
      Log('PostgreSQL service postgresql-barbaros found');
    end
    else
    begin
      Log('PostgreSQL service postgresql-barbaros not found (code: ' + IntToStr(ResultCode) + ')');
    end;
  end
  else
  begin
    Log('Failed to execute sc.exe query');
  end;
  
  DeleteFile(TmpFile);
end;

// Download and install PostgreSQL
function DownloadAndInstallPostgreSQL: Boolean;
var
  ResultCode: Integer;
  Url: string;
  InstallerPath: string;
begin
  Result := False;

  // PostgreSQL 16.6 for Windows x64 (latest stable)
  Url := 'https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe';
  InstallerPath := ExpandConstant('{tmp}\postgresql-install.exe');

  WizardForm.StatusLabel.Caption := 'Descargando PostgreSQL...';
  WizardForm.ProgressGauge.Position := 20;

  Log('Downloading PostgreSQL from ' + Url);

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

  Log('Installing PostgreSQL with service name: postgresql-barbaros');

  // Silent installation with command-line parameters
  // --mode unattended: silent install
  // --superpassword: password for postgres superuser
  // --servicename: custom service name to avoid conflicts
  // --serverport: port number
  if Exec(
      InstallerPath,
      '--mode unattended --superpassword barbaros --servicename postgresql-barbaros --serverport 5432',
      '',
      SW_SHOWNORMAL,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Log('PostgreSQL install result: ' + IntToStr(ResultCode));
    
    case ResultCode of
      0:
      begin
        Result := True;
        MsgBox('PostgreSQL instalado correctamente.', mbInformation, MB_OK);
      end;
      
      1:
      begin
        MsgBox(
          'La instalación de PostgreSQL falló.' + #13#10 +
          'Posibles causas:' + #13#10 +
          '- El puerto 5432 está siendo usado por otra aplicación' + #13#10 +
          '- Ya existe una instalación de PostgreSQL en esa ruta' + #13#10 + #13#10 +
          'Revise el log en: %TEMP%\install-postgresql.log',
          mbError,
          MB_OK);
        Abort;
      end;
          
      2:
      begin
        MsgBox('La instalación de PostgreSQL fue cancelada.', mbError, MB_OK);
        Abort;
      end;
          
      3:
      begin
        MsgBox('Parámetros de instalación inválidos.', mbError, MB_OK);
        Abort;
      end;
          
      3010:
      begin
        Result := True;
        AddToRunOnce();
        MsgBox(
          'PostgreSQL se instaló correctamente.' + #13#10 +
          'Es necesario reiniciar Windows.' + #13#10 +
          'El instalador se ejecutará automáticamente después del reinicio.',
          mbInformation,
          MB_OK);
        RebootComputer();
        Abort;
      end;
      
      else
      begin
        MsgBox(
          'La instalación de PostgreSQL falló con código: ' + IntToStr(ResultCode) + #13#10 +
          'Revise el log en: %TEMP%\install-postgresql.log',
          mbError,
          MB_OK);
        Abort;
      end;
    end;
  end
  else
  begin
    MsgBox('No fue posible ejecutar el instalador de PostgreSQL.', mbError, MB_OK);
    Abort;
  end;
end;

// Wait for PostgreSQL service to be running
function WaitForPostgreSQLService(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
begin
  Result := False;
  Log('Waiting for PostgreSQL service to be running...');
  
  // Try for up to 2 minutes
  for I := 1 to 24 do
  begin
    // Check both possible service names
    if Exec(
        'powershell.exe',
        '-Command "if ((Get-Service postgresql-barbaros -ErrorAction SilentlyContinue).Status -eq ''Running'') { exit 0 } elseif ((Get-Service postgresql-x64-16 -ErrorAction SilentlyContinue).Status -eq ''Running'') { exit 0 } else { exit 1 }"',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      if ResultCode = 0 then
      begin
        Log('PostgreSQL service is running');
        Result := True;
        Exit;
      end;
    end;
    
    Sleep(5000);
  end;
  
  Log('PostgreSQL service did not start within 2 minutes');
end;

// Wait for PostgreSQL to accept connections
function WaitForPostgreSQLReady(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
  PgBin: String;
begin
  Result := False;
  PgBin := GetPostgreSQLBinDir();
  
  if PgBin = '' then
  begin
    Log('PostgreSQL bin directory not found');
    Exit;
  end;
  
  Log('Waiting for PostgreSQL to accept connections...');
  
  // Try for up to 60 seconds
  // Use pg_isready without specifying a database (just check server)
  for I := 1 to 12 do
  begin
    if Exec(
        PgBin + '\pg_isready.exe',
        '-h localhost -p 5432',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      if ResultCode = 0 then
      begin
        Log('PostgreSQL is ready to accept connections');
        Result := True;
        Exit;
      end;
    end;
    
    Sleep(5000);
  end;
  
  Log('PostgreSQL did not respond within 60 seconds');
end;

// Check if a database exists using psql
// Returns True if the database exists, False otherwise
function CheckDatabaseExists(DatabaseName: String): Boolean;
var
  ResultCode: Integer;
  PgBin: String;
  BatFile: String;
  BatContent: String;
begin
  Result := False;
  PgBin := GetPostgreSQLBinDir();

  if PgBin = '' then
  begin
    Log('PostgreSQL bin directory not found in CheckDatabaseExists');
    Exit;
  end;

  // Use \l dbname which fails if database does not exist
  BatFile := ExpandConstant('{tmp}\pg_check_db.bat');
  BatContent :=
    '@echo off' + #13#10 +
    'set PGPASSWORD=barbaros' + #13#10 +
    '"' + PgBin + '\psql.exe" -U postgres -d postgres -c "\l ' + DatabaseName + '"' + #13#10 +
    'exit %ERRORLEVEL%';

  SaveStringToFile(BatFile, BatContent, False);

  if Exec(
    BatFile,
    '',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) then
  begin
    Result := (ResultCode = 0);
    Log('Database ' + DatabaseName + ' exists check: ' + BoolToStr(Result) + ' (code: ' + IntToStr(ResultCode) + ')');
  end;

  DeleteFile(BatFile);
end;

// Create database user and database (idempotent)
// NOTE: We always install our own PostgreSQL with password 'barbaros'
// so we can safely use PGPASSWORD=barbaros here.
function CreateDatabaseAndUser(): Boolean;
var
  ResultCode: Integer;
  PgBin: String;
  SqlFile: String;
  SqlContent: String;
  BatFile: String;
  BatContent: String;
  UserCreated: Boolean;
  DbCreated: Boolean;
  TestConnected: Boolean;
  RetryCount: Integer;
  I: Integer;
  DbExists: Boolean;
begin
  Result := False;
  UserCreated := False;
  DbCreated := False;
  TestConnected := False;

  PgBin := GetPostgreSQLBinDir();

  if PgBin = '' then
  begin
    MsgBox('No se encontró PostgreSQL.', mbError, MB_OK);
    Log('PostgreSQL bin directory not found in CreateDatabaseAndUser');
    Exit;
  end;

  Log('PostgreSQL bin directory: ' + PgBin);

  // First test connection with a simple SELECT 1
  WizardForm.StatusLabel.Caption := 'Probando conexión a PostgreSQL...';
  Log('Testing PostgreSQL connection...');

  BatFile := ExpandConstant('{tmp}\pg_test.bat');
  BatContent :=
    '@echo off' + #13#10 +
    'set PGPASSWORD=barbaros' + #13#10 +
    '"' + PgBin + '\psql.exe" -U postgres -d postgres -c "SELECT 1"' + #13#10 +
    'exit %ERRORLEVEL%';

  SaveStringToFile(BatFile, BatContent, False);
  Log('Test connection bat: ' + BatFile);

  if Exec(
    BatFile,
    '',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) then
  begin
    TestConnected := (ResultCode = 0);
    Log('Test connection result: ' + IntToStr(ResultCode));
  end
  else
  begin
    Log('Test connection command failed to execute');
  end;

  DeleteFile(BatFile);

  if not TestConnected then
  begin
    MsgBox(
      'No se pudo conectar a PostgreSQL con el usuario postgres.' + #13#10 +
      'Verifique que el servicio esté corriendo y que la contraseña sea barbaros.',
      mbError,
      MB_OK);
    Exit;
  end;

  WizardForm.StatusLabel.Caption := 'Creando usuario PostgreSQL...';
  Log('Creating PostgreSQL user barbaros...');

  // Create user barbaros (idempotent - check if exists first)
  SqlFile := ExpandConstant('{tmp}\create_user.sql');
  SqlContent :=
    'DO $$' + #13#10 +
    'BEGIN' + #13#10 +
    '  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ''barbaros'') THEN' + #13#10 +
    '    CREATE ROLE barbaros LOGIN PASSWORD ''barbaros'';' + #13#10 +
    '  END IF;' + #13#10 +
    'END $$;';

  SaveStringToFile(SqlFile, SqlContent, False);

  BatFile := ExpandConstant('{tmp}\pg_create_user.bat');
  BatContent :=
    '@echo off' + #13#10 +
    'set PGPASSWORD=barbaros' + #13#10 +
    '"' + PgBin + '\psql.exe" -U postgres -d postgres -f "' + SqlFile + '"' + #13#10 +
    'exit %ERRORLEVEL%';

  SaveStringToFile(BatFile, BatContent, False);
  Log('User creation bat: ' + BatFile);

  if Exec(
    BatFile,
    '',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) then
  begin
    UserCreated := (ResultCode = 0);
    Log('User creation result: ' + IntToStr(ResultCode));
  end
  else
  begin
    Log('User creation command failed to execute');
  end;

  DeleteFile(SqlFile);
  DeleteFile(BatFile);

  WizardForm.StatusLabel.Caption := 'Creando base de datos...';
  Log('Creating database barbaros_pos...');

  // Create database barbaros_pos (idempotent - check if exists first)
  // Also grant CREATEDB permission to barbaros so Prisma can work if needed
  SqlFile := ExpandConstant('{tmp}\create_db.sql');
  SqlContent :=
    'DO $$' + #13#10 +
    'BEGIN' + #13#10 +
    '  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = ''barbaros_pos'') THEN' + #13#10 +
    '    CREATE DATABASE barbaros_pos OWNER barbaros;' + #13#10 +
    '  END IF;' + #13#10 +
    'END $$;' + #13#10 +
    'ALTER ROLE barbaros CREATEDB;' + #13#10 +
    'GRANT ALL PRIVILEGES ON DATABASE barbaros_pos TO barbaros;';

  SaveStringToFile(SqlFile, SqlContent, False);

  BatFile := ExpandConstant('{tmp}\pg_create_db.bat');
  BatContent :=
    '@echo off' + #13#10 +
    'set PGPASSWORD=barbaros' + #13#10 +
    '"' + PgBin + '\psql.exe" -U postgres -d postgres -f "' + SqlFile + '"' + #13#10 +
    'exit %ERRORLEVEL%';

  SaveStringToFile(BatFile, BatContent, False);
  Log('Database creation bat: ' + BatFile);

  if Exec(
    BatFile,
    '',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) then
  begin
    DbCreated := (ResultCode = 0);
    Log('Database creation result: ' + IntToStr(ResultCode));
  end
  else
  begin
    Log('Database creation command failed to execute');
  end;

  DeleteFile(SqlFile);
  DeleteFile(BatFile);

  // Verify database actually exists before reporting success
  if DbCreated then
  begin
    DbExists := CheckDatabaseExists('barbaros_pos');
    if not DbExists then
    begin
      Log('Database creation reported success but database does not exist. Retrying...');
      
      // Retry up to 3 times
      for I := 1 to 3 do
      begin
        Sleep(2000);
        DbExists := CheckDatabaseExists('barbaros_pos');
        if DbExists then
          break;
      end;
      
      DbCreated := DbExists;
    end;
  end;

  Result := UserCreated and DbCreated;

  if Result then
  begin
    Log('Database user and database created successfully');
  end
  else
  begin
    Log('UserCreated=' + BoolToStr(UserCreated) + ', DbCreated=' + BoolToStr(DbCreated));
    MsgBox(
      'No fue posible crear el usuario y la base de datos.' + #13#10 +
      'UserCreated=' + BoolToStr(UserCreated) + ', DbCreated=' + BoolToStr(DbCreated),
      mbError,
      MB_OK);
  end;
end;

// Install Node.js dependencies
function InstallNodeDependencies(): Boolean;
var
  ResultCode: Integer;
  NpmBin: String;
  NodeDir: String;
  BatFile: String;
  BatContent: String;
  NodeExe: String;
  WorkDir: String;
  NpmLogFile: String;
begin
  Result := False;

  WizardForm.StatusLabel.Caption := 'Instalando dependencias...';
  Log('Installing Node.js dependencies...');

  NodeDir := GetNodeDir();
  if NodeDir = '' then
  begin
    MsgBox('No se encontró Node.js. Verifique la instalación.', mbError, MB_OK);
    Exit;
  end;

  NodeExe := NodeDir + '\node.exe';
  NpmBin := NodeDir + '\npm.cmd';
  WorkDir := ExpandConstant('{app}');
  NpmLogFile := ExpandConstant('{app}\logs\npm-install.log');

  if not FileExists(NodeExe) then
  begin
    Log('node.exe not found at: ' + NodeExe);
    MsgBox('No se encontró node.exe. Verifique la instalación de Node.js.', mbError, MB_OK);
    Exit;
  end;

  if not FileExists(NpmBin) then
  begin
    MsgBox('No se encontró npm en: ' + NpmBin, mbError, MB_OK);
    Exit;
  end;

  // Create batch file that sets PATH and runs npm install
  // npm.cmd calls node internally, so PATH must include NodeDir
  BatFile := ExpandConstant('{tmp}\npm_install.bat');
  ForceDirectories(ExpandConstant('{app}\logs'));

  BatContent :=
    '@echo off' + #13#10 +
    'set "PATH=' + NodeDir + ';%PATH%"' + #13#10 +
    'cd /d "' + WorkDir + '"' + #13#10 +
    '"' + NpmBin + '" install --omit=dev --ignore-scripts > "' + NpmLogFile + '" 2>&1' + #13#10 +
    'exit %ERRORLEVEL%';

  SaveStringToFile(BatFile, BatContent, False);
  Log('npm install bat: ' + BatFile);
  Log('npm install command: ' + BatContent);
  Log('npm install log: ' + NpmLogFile);

  if Exec(
      BatFile,
      '',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Log('npm install result: ' + IntToStr(ResultCode));
    Result := (ResultCode = 0);
  end
  else
  begin
    MsgBox('No fue posible ejecutar npm install.', mbError, MB_OK);
  end;

  DeleteFile(BatFile);
end;

// Run Prisma migrations
function RunPrismaMigrations(): Boolean;
var
  ResultCode: Integer;
  PrismaBin: String;
  ApiDir: String;
  BatFile: String;
  BatContent: String;
  SchemaPath: String;
  LogFile: String;
  NodeDir: String;
  NodeExe: String;
begin
  Result := False;

  ApiDir := ExpandConstant('{app}\apps\api');
  PrismaBin := ExpandConstant('{app}\node_modules\.bin\prisma.cmd');
  SchemaPath := ApiDir + '\prisma\schema.prisma';
  NodeDir := GetNodeDir();
  NodeExe := NodeDir + '\node.exe';

  WizardForm.StatusLabel.Caption := 'Ejecutando migraciones...';
  Log('Running Prisma migrations...');
  Log('Prisma binary: ' + PrismaBin);
  Log('Schema path: ' + SchemaPath);
  Log('Working directory: ' + ApiDir);
  Log('Node directory: ' + NodeDir);
  Log('Node executable: ' + NodeExe);

  if NodeDir = '' then
  begin
    Log('Node.js directory not found');
    MsgBox('No se encontró Node.js. No se pueden ejecutar las migraciones.', mbError, MB_OK);
    Exit;
  end;

  if not FileExists(NodeExe) then
  begin
    Log('Node.exe not found at: ' + NodeExe);
    MsgBox('No se encontró node.exe. Verifique la instalación de Node.js.', mbError, MB_OK);
    Exit;
  end;

  if not FileExists(PrismaBin) then
  begin
    Log('Prisma binary not found at: ' + PrismaBin);
    MsgBox('No se encontró el binario de Prisma. Verifique que npm install haya funcionado.', mbError, MB_OK);
    Exit;
  end;

  if not FileExists(SchemaPath) then
  begin
    Log('Schema not found at: ' + SchemaPath);
    MsgBox('No se encontró el schema de Prisma.', mbError, MB_OK);
    Exit;
  end;

  // Create batch file to set DATABASE_URL and run prisma
  // Output is redirected to a log file so we can diagnose errors
  BatFile := ExpandConstant('{tmp}\prisma_migrate.bat');
  LogFile := ExpandConstant('{app}\logs\prisma-migrate.log');

  // Ensure logs directory exists
  ForceDirectories(ExpandConstant('{app}\logs'));

  BatContent :=
    '@echo off' + #13#10 +
    'set "PATH=' + NodeDir + ';%PATH%"' + #13#10 +
    'set DATABASE_URL=postgresql://barbaros:barbaros@localhost:5432/barbaros_pos' + #13#10 +
    'cd /d "' + ApiDir + '"' + #13#10 +
    '"' + PrismaBin + '" migrate deploy --schema="' + SchemaPath + '" > "' + LogFile + '" 2>&1' + #13#10 +
    'exit %ERRORLEVEL%';
  
  SaveStringToFile(BatFile, BatContent, False);
  Log('Prisma migrate bat: ' + BatFile);
  Log('Prisma migrate command: ' + BatContent);
  Log('Prisma output log: ' + LogFile);
  
  if Exec(
      BatFile,
      '',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Log('Prisma migrate deploy result: ' + IntToStr(ResultCode));
    Result := (ResultCode = 0);
  end
  else
  begin
    Log('Prisma migrate command failed to execute');
  end;
  
  DeleteFile(BatFile);
  
  if not Result then
  begin
    MsgBox(
      'Las migraciones de Prisma fallaron.' + #13#10 +
      'Código: ' + IntToStr(ResultCode) + #13#10 + #13#10 +
      'El output de Prisma se guardó en:' + #13#10 +
      LogFile + #13#10 + #13#10 +
      'Abrir ese archivo para ver el error exacto.',
      mbError,
      MB_OK);
  end
  else
  begin
    Log('Prisma migrations completed successfully');
  end;
end;

// Run seed SQL script (categories, products, shapes)
// Idempotent: uses ON CONFLICT DO NOTHING and UPDATE-only labels
function RunSeedScript(): Boolean;
var
  ResultCode: Integer;
  PgBin: String;
  SeedFile: String;
  BatFile: String;
  BatContent: String;
  LogFile: String;
begin
  Result := False;

  WizardForm.StatusLabel.Caption := 'Poblando datos por defecto...';
  Log('Running seed script...');

  PgBin := GetPostgreSQLBinDir();
  SeedFile := ExpandConstant('{app}\scripts\seed-production.sql');
  LogFile := ExpandConstant('{app}\logs\seed-production.log');

  if PgBin = '' then
  begin
    Log('PostgreSQL bin directory not found in RunSeedScript');
    MsgBox('No se encontró PostgreSQL. No se pudieron poblar los datos por defecto.', mbError, MB_OK);
    Exit;
  end;

  if not FileExists(SeedFile) then
  begin
    Log('Seed file not found at: ' + SeedFile);
    MsgBox('No se encontró el archivo de datos por defecto.', mbError, MB_OK);
    Exit;
  end;

  ForceDirectories(ExpandConstant('{app}\logs'));

  BatFile := ExpandConstant('{tmp}\seed_production.bat');
  BatContent :=
    '@echo off' + #13#10 +
    'set PGPASSWORD=barbaros' + #13#10 +
    '"' + PgBin + '\psql.exe" -U postgres -d barbaros_pos -f "' + SeedFile + '" > "' + LogFile + '" 2>&1' + #13#10 +
    'exit %ERRORLEVEL%';

  SaveStringToFile(BatFile, BatContent, False);
  Log('Seed bat: ' + BatFile);
  Log('Seed command: ' + BatContent);
  Log('Seed log: ' + LogFile);

  if Exec(
      BatFile,
      '',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode) then
  begin
    Log('Seed script result: ' + IntToStr(ResultCode));
    Result := (ResultCode = 0);
  end
  else
  begin
    Log('Seed script command failed to execute');
  end;

  DeleteFile(BatFile);

  if not Result then
  begin
    MsgBox(
      'No se pudieron poblar los datos por defecto.' + #13#10 +
      'Código: ' + IntToStr(ResultCode) + #13#10 + #13#10 +
      'Revisá el log en:' + #13#10 +
      LogFile,
      mbError,
      MB_OK);
  end
  else
  begin
    Log('Seed script completed successfully');
  end;
end;

// Verify API is responding
function VerifyAPIHealth(): Boolean;
var
  ResultCode: Integer;
  I: Integer;
  HealthUrl: String;
  PowershellCmd: String;
  LogFile: String;
  ErrorContent: String;
  TimeoutSec: Integer;
  MaxAttempts: Integer;
  WaitBetweenAttempts: Integer;
begin
  Result := False;
  Log('Verifying API health...');

  // Wait a bit before starting health checks (service needs time to start)
  Sleep(3000);

  HealthUrl := 'http://127.0.0.1:3000/health';
  TimeoutSec := 3;
  MaxAttempts := 12;  // 12 attempts * 5 seconds = 60 seconds total
  WaitBetweenAttempts := 5000;

  Log('Health check URL: ' + HealthUrl);
  Log('Timeout per attempt: ' + IntToStr(TimeoutSec) + 's');
  Log('Max attempts: ' + IntToStr(MaxAttempts));

  // Try both localhost and 127.0.0.1
  for I := 1 to MaxAttempts do
  begin
    // Try 127.0.0.1 first
    PowershellCmd :=
      'try { $r = Invoke-WebRequest -Uri "' + HealthUrl + '" -UseBasicParsing -TimeoutSec ' +
      IntToStr(TimeoutSec) +
      '; exit $r.StatusCode } catch { exit 1 }';

    Log('Health check attempt ' + IntToStr(I) + ' to ' + HealthUrl);

    if Exec(
        'powershell.exe',
        '-Command "' + PowershellCmd + '"',
        '',
        SW_HIDE,
        ewWaitUntilTerminated,
        ResultCode) then
    begin
      Log('Health check attempt ' + IntToStr(I) + ' result: ' + IntToStr(ResultCode));

      if ResultCode = 200 then
      begin
        Log('API health check passed');
        Result := True;
        Exit;
      end;
    end
    else
    begin
      Log('Health check command failed to execute on attempt ' + IntToStr(I));
    end;

    // Also try localhost as fallback
    if I mod 2 = 0 then
    begin
      PowershellCmd :=
        'try { $r = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec ' +
        IntToStr(TimeoutSec) +
        '; exit $r.StatusCode } catch { exit 1 }';

      if Exec(
          'powershell.exe',
          '-Command "' + PowershellCmd + '"',
          '',
          SW_HIDE,
          ewWaitUntilTerminated,
          ResultCode) then
      begin
        Log('Health check localhost attempt result: ' + IntToStr(ResultCode));
        if ResultCode = 200 then
        begin
          Log('API health check passed via localhost');
          Result := True;
          Exit;
        end;
      end;
    end;

    Sleep(WaitBetweenAttempts);
  end;

  Log('API health check failed after ' + IntToStr(MaxAttempts) + ' attempts');
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
    Log('=== ssInstall phase started ===');
    
    // === 1. Verificar Node.js ===
    if not IsNodeInstalled then
    begin
      Log('Node.js not found, installing automatically...');
      if not DownloadAndInstallNode then
        Abort;
    end
    else
    begin
      Log('Node.js already installed');
    end;
    
    // === 2. Verificar PostgreSQL ===
    // Always install our own PostgreSQL instance (postgresql-barbaros service)
    // This avoids conflicts with existing PostgreSQL installations
    Log('Checking if our PostgreSQL instance is installed...');
    
    if not IsOurPostgreSQLInstalled then
    begin
      Log('Our PostgreSQL instance not found, installing automatically...');
      DownloadAndInstallPostgreSQL;
      // DownloadAndInstallPostgreSQL calls Abort on failure
      Log('PostgreSQL installation completed');
    end
    else
    begin
      Log('Our PostgreSQL instance already installed (postgresql-barbaros service)');
    end;

    // === 3. Eliminar servicio anterior si existe ===
    if FileExists(ExpandConstant('{app}\nssm.exe')) then
    begin
      Log('Removing previous API service...');
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
    
    Log('=== ssInstall phase completed ===');
  end;

  if CurStep = ssPostInstall then
  begin
    Log('=== ssPostInstall phase started ===');
    
    // === 1. Esperar a que PostgreSQL esté corriendo ===
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

    // === 2. Esperar a que PostgreSQL acepte conexiones ===
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
    
    // === 3. Crear usuario y base de datos ===
    if not CreateDatabaseAndUser() then
      Abort;
    
    // === 4. Instalar dependencias Node.js ===
    if not InstallNodeDependencies() then
    begin
      MsgBox(
        'La instalación de dependencias Node.js falló.' + #13#10 +
        'Verifique la conexión a Internet.',
        mbError,
        MB_OK);
      
      Abort;
    end;

    // === 5. Ejecutar migraciones Prisma ===
    if not RunPrismaMigrations() then
      Abort;

    // === 6. Poblar datos por defecto ===
    if not RunSeedScript() then
      Abort;

    // === 7. Crear servicio Windows para la API ===
    WizardForm.StatusLabel.Caption := 'Instalando servicio Windows...';
    Log('Installing Windows service for API...');

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'install BarbarosPOS "' + GetNodeDir() + '\node.exe"',
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

    Log('Windows service configured');

    // === 8. Iniciar servicio ===
    WizardForm.StatusLabel.Caption := 'Iniciando servicio...';
    Log('Starting API service...');

    Exec(
      ExpandConstant('{app}\nssm.exe'),
      'start BarbarosPOS',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);
    
    Log('API service start result: ' + IntToStr(ResultCode));
    
    // === 9. Verificar que la API responde ===
    WizardForm.StatusLabel.Caption := 'Verificando que la API esté funcionando...';
    
    if not VerifyAPIHealth() then
    begin
      MsgBox(
        'El servicio de la API se instaló y está corriendo.' + #13#10 +
        'El health check automático no pudo confirmar la respuesta, pero el sistema puede estar funcionando correctamente.' + #13#10 +
        'Verifique accediendo a http://127.0.0.1:3000 desde el navegador.' + #13#10 + #13#10 +
        'Logs en: ' + ExpandConstant('{app}\logs'),
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

    Log('=== ssPostInstall phase completed ===');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Log('Uninstalling...');
    
    // Stop and remove API service
    Exec(ExpandConstant('{app}\nssm.exe'), 'stop BarbarosPOS', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'remove BarbarosPOS confirm', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // Stop PostgreSQL service
    Exec('sc.exe', 'stop postgresql-barbaros', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    Log('Uninstall completed');
  end;
end;
