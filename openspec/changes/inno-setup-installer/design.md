# Design: Inno Setup Installer

## Technical Approach

Package the compiled POS system as a single Windows .exe installer using Inno Setup. The installer deploys Docker Desktop (if absent), a PostgreSQL container, the compiled API (tsc → Node.js), the compiled Web (Vite build), and all node_modules for offline operation. Auto-start via Task Scheduler. Single-port architecture: Fastify serves both API routes and the web build from port 3000.

## Architecture Decisions

### Decision: Single-port serving (API + Web)

**Choice**: Fastify serves the Vite-built web assets via `@fastify/static` + SPA fallback on port 3000.
**Alternatives considered**: Separate Vite preview server on a second port.
**Rationale**: One port to open in firewall, one URL for operators, simpler Docker networking. The SPA fallback already exists in `app.ts` — we just add the static plugin for `web/dist/`.

### Decision: Production build script (PowerShell)

**Choice**: `installer/build-production.ps1` compiles everything in-order: shared → prisma generate → api tsc → vite build → copy to staging.
**Alternatives considered**: npm workspace build, Docker multi-stage build.
**Rationale**: PowerShell is the existing scripting convention (start.ps1, switch-env.ps1). Direct control over each step's order and error handling. No Docker-in-Docker complexity.

### Decision: Docker for PostgreSQL only

**Choice**: Docker Compose runs a single `postgres:16-alpine` container. The API runs as a native Node.js process on the host.
**Alternatives considered**: Running everything in Docker Compose.
**Rationale**: Docker Desktop is required for PostgreSQL (lightweight container). Running the API natively avoids Docker networking complexity, keeps WebSocket connections simple, and reduces resource usage on the target PC.

### Decision: Task Scheduler for auto-start

**Choice**: XML task definition imported by Inno Setup. Runs `start-barbaros.ps1` at logon with a 30-second delay.
**Alternatives considered**: Windows Service via NSSM, registry Run key.
**Rationale**: Task Scheduler is built-in, no extra dependencies. Delay gives Docker Desktop time to start. NSSM adds a third-party dependency. Registry Run key lacks error handling and dependency management.

### Decision: Node.js bundled in installer

**Choice**: Inno Setup bundles the Node.js runtime (node.exe + required DLLs) extracted to the install directory.
**Alternatives considered**: Require Node.js pre-installed on target.
**Rationale**: True offline operation. No dependency on the operator having Node.js installed. The POS PC is a dedicated machine — bundling Node.js keeps it self-contained.

## Data Flow

```
Browser (any device on LAN)
    │
    ▼ HTTP :3000
┌─────────────────────────────────────────┐
│  Node.js process (API + Static Server)  │
│  Fastify on 0.0.0.0:3000               │
│                                         │
│  /accounts, /products, ... → routes     │
│  /ws → WebSocket                        │
│  /uploads/* → file serving              │
│  /* (fallback) → web/dist/index.html    │
└──────────┬──────────────────────────────┘
           │ TCP :5432
           ▼
┌──────────────────────┐
│  PostgreSQL container │
│  barbaros_pos DB     │
│  pg_data volume       │
└──────────────────────┘
```

## File Layout on Target Machine

```
C:\BarbarosPOS\
├── node\                     ← Node.js runtime (bundled)
│   ├── node.exe
│   └── ...
├── app\                      ← Compiled application
│   ├── api\                  ← tsc output (apps/api/dist/)
│   │   ├── index.js
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── routes/
│   │   ├── services/
│   │   ├── db/
│   │   └── prisma/
│   │       └── schema.prisma
│   ├── web\                  ← Vite build output (apps/web/dist/)
│   │   ├── index.html
│   │   ├── assets/
│   │   └── ...
│   ├── shared\               ← packages/shared/dist/
│   ├── node_modules\         ← Production dependencies
│   ├── uploads\              ← Runtime data (product photos, payment proofs)
│   └── .env.production       ← Database connection string
├── docker-compose.yml        ← Single postgres service
├── start-barbaros.ps1        ← Startup script (Docker → DB → API)
├── stop-barbaros.ps1         ← Shutdown script
├── logs\                     ← API stdout/stderr logs
└── data\                     ← Docker volume mount point (PG data persistence)
```

## Build Pipeline Design

### `installer/build-production.ps1` — Order of Operations

```
1. Clean staging directory (installer/staging/)
2. Build shared package:      npm run build --workspace=packages/shared
3. Generate Prisma client:    npx prisma generate --schema apps/api/prisma/schema.prisma
4. Compile API:               tsc -b (apps/api → apps/api/dist/)
5. Build Web:                 vite build (apps/web → apps/web/dist/)
6. Copy api/dist → staging/app/api/
7. Copy web/dist → staging/app/web/
8. Copy shared/dist → staging/app/shared/
9. Copy node_modules → staging/app/node_modules/  (production deps only)
10. Copy prisma schema → staging/app/api/prisma/
11. Copy docker-compose.yml → staging/
12. Copy start/stop scripts → staging/
13. Copy .env.production → staging/app/
14. Verify staging integrity (key files exist)
```

### What Gets Included/Excluded

| Include | Exclude |
|---------|---------|
| `apps/api/dist/**` | `apps/api/src/` (source) |
| `apps/web/dist/**` | `apps/web/src/` (source) |
| `packages/shared/dist/**` | `node_modules/**` (devDependencies) |
| `node_modules/` (prod deps) | `apps/api/node_modules/` (prisma CLI) |
| `apps/api/prisma/schema.prisma` | `apps/api/prisma/migrations/` |
| `.env.production` | `.env.develop`, `.env` |
| Docker Compose files | `start.ps1`, `switch-env.ps1` |

### Native Modules

**None detected.** All dependencies are pure JavaScript/TypeScript. No `node-gyp`, no `.node` binaries, no platform-specific native code. The `node_modules` copy is a simple file copy.

### ESM Import Paths After tsc

The project uses `"module": "NodeNext"` with explicit `.js` extensions in all imports (e.g., `import { buildApp } from './app.js'`). After `tsc` compiles to JS, these `.js` extensions resolve correctly — no rewriting needed. Node.js ESM loader finds `app.js` directly.

## API Static Serving Design

### Changes to `apps/api/src/app.ts`

Add a second `@fastify/static` registration for the web build:

```typescript
// Serve compiled web app (production static build)
await app.register(fastifyStatic, {
  root: path.join(__dirname, '../../web/dist'),
  prefix: '/',           // web assets at root
  decorateReply: true,   // separate reply decorator from uploads
})
```

The existing SPA fallback (`setNotFoundHandler`) already handles non-API GET requests → `index.html`. The key insight: `@fastify_static` serves exact file matches (JS, CSS, images), and the `setNotFoundHandler` catches everything else (SPA routes like `/accounts/123`).

**Important**: `decorateReply: true` for web static, `decorateReply: false` for uploads — Fastify requires unique decorator names per plugin instance.

### Why not just use the fallback?

The fallback reads `index.html` from disk on every request. `@fastify_static` caches files in memory and serves binary assets (JS, CSS, images) with proper Content-Type and caching headers. Performance matters on a slow LAN.

## Docker Compose Design

### `installer/staging/docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: barbaros-pos-db
    environment:
      POSTGRES_USER: barbaros
      POSTGRES_PASSWORD: barbaros
      POSTGRES_DB: barbaros_pos
    ports:
      - "5432:5432"
    volumes:
      - ../data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U barbaros -d barbaros_pos"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
```

**Key decisions**:
- Single service (no API in Docker — runs natively on host)
- Named volume replaced with bind mount to `C:\BarbarosPOS\data\` for easier backup
- Health check matches existing pattern from `docker-compose.yml`
- `restart: unless-stopped` survives Docker Desktop restarts

## Inno Setup Script Design

### Pre-install Checks

```pascal
function InitializeSetup(): Boolean;
begin
  // Check Docker Desktop is installed
  if not FileExists('C:\Program Files\Docker\Docker\Docker Desktop.exe') then
  begin
    MsgBox('Docker Desktop no está instalado. Instalalo primero.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  Result := True;
end;
```

### File Layout (Inno Setup `[Files]` section)

```pascal
[Files]
Source: "staging\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs
Source: "staging\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs
Source: "staging\docker-compose.yml"; DestDir: "{app}"
Source: "staging\start-barbaros.ps1"; DestDir: "{app}"
Source: "staging\stop-barbaros.ps1"; DestDir: "{app}"
```

### Post-install Commands

```pascal
[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start-barbaros.ps1"" -Install"; StatusMsg: "Levantando PostgreSQL..."; Flags: runhidden waituntilterminated
```

### Uninstaller Cleanup

```pascal
[UninstallDelete]
Type: filesandordirs; Name: "{app}\data"        ; // PG data volume
Type: filesandordirs; Name: "{app}\app\uploads"  ; // User uploads
Type: filesandordirs; Name: "{app}\logs"          ; // API logs
Type: filesandordirs; Name: "{app}\app\node_modules" ; // node_modules

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""docker compose -f '{app}\docker-compose.yml' down -v"""; Flags: runhidden
Filename: "schtasks.exe"; Parameters: "/Delete /TN ""BarbarosPOS"" /F"; Flags: runhidden
```

### Icon and Branding

```pascal
[Setup]
AppCopyright=Barbaro's POS
AppPublisher=Barbaro's
DefaultGroupName=Barbaro's POS
UninstallDisplayIcon={app}\app\web\favicon.ico
SetupIconFile=installer\icon.ico
```

## Auto-Start Design

### Task Scheduler XML

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </LogonTrigger>
  </Triggers>
  <Actions>
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\BarbarosPOS\start-barbaros.ps1" -AutoStart</Arguments>
    </Exec>
  </Actions>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
  </Settings>
</Task>
```

### Startup Sequence (`start-barbaros.ps1`)

```
1. Wait for Docker Desktop (up to 60s)
2. docker compose up -d postgres
3. Wait for pg_isready (up to 20 retries)
4. Run prisma migrate deploy (apply pending migrations)
5. Start API: node apps/api/dist/index.js
6. Log output to C:\BarbarosPOS\logs\api-YYYY-MM-DD.log
```

### Graceful Shutdown (`stop-barbaros.ps1`)

```
1. Stop Node.js process (Get-Process node | Stop-Process)
2. docker compose down
3. Log shutdown event
```

## File Changes Matrix

| File | Action | Description |
|------|--------|-------------|
| `installer/build-production.ps1` | **Create** | Build pipeline: compiles all packages, copies to staging |
| `installer/staging/docker-compose.yml` | **Create** | Single postgres service with bind-mount data volume |
| `installer/staging/start-barbaros.ps1` | **Create** | Startup script: Docker → DB → migrate → API (runs on target) |
| `installer/staging/stop-barbaros.ps1` | **Create** | Shutdown script: stop node, docker compose down |
| `installer/barbaros-pos.iss` | **Create** | Inno Setup script: pre-checks, file copy, post-install, uninstaller |
| `installer/icon.ico` | **Create** | Application icon for installer and shortcuts |
| `apps/api/src/app.ts` | **Modify** | Add `@fastify/static` for web/dist with `decorateReply: true` |
| `.gitignore` | **Modify** | Add `installer/staging/`, `installer/releases/`, `installer/*.exe` |
| `apps/api/.env.production` | **Modify** | Update PORT to 3000, DATABASE_URL to single-port single-DB |

## ESM Compatibility Notes

- All imports use `.js` extensions (`from './app.js'`) — works after tsc
- `"type": "module"` in all package.json files — Node.js uses ESM loader
- `"module": "NodeNext"` — tsc outputs NodeNext-compatible JS
- Prisma client generated to `apps/api/generated/prisma` — path must be preserved in staging
- No dynamic imports or `require()` calls in the API codebase

## Threat Matrix

| Boundary | Applicability | Design response |
|----------|--------------|-----------------|
| Documentation-like paths | **N/A** — no executable markdown or config-as-code |
| Git repository selection | **N/A** — installer does not interact with git |
| Commit state | **N/A** — no VCS automation |
| Push state | **N/A** — no remote operations |
| PR commands | **N/A** — no PR automation |

**Shell commands in startup scripts**: `start-barbaros.ps1` runs `docker compose`, `prisma migrate deploy`, and `node`. All are well-known binaries with no user-controlled argument injection. The script runs with fixed arguments from Task Scheduler — no interactive input, no shell injection surface.

## Migration / Rollout

**No data migration required.** This is a new deployment method for the existing system. The target PC starts with a clean database, or the operator can copy an existing `data/` directory.

**Rollout steps**:
1. Build the installer on the dev machine
2. Copy `installer/releases/barbaros-pos-setup.exe` to USB
3. Run installer on target PC (requires Docker Desktop pre-installed)
4. Open `http://localhost:3000` from any browser on the LAN

## Open Questions

- [ ] Should Node.js be bundled in the installer, or require it pre-installed? (Proposed: bundled)
- [ ] Should the installer include Docker Desktop installation, or require it pre-installed? (Proposed: require pre-installed — Docker Desktop has its own installer with EULA)
- [ ] Should the `data/` directory (PG volume) be preserved across uninstall? (Proposed: yes — operator may want to keep data)
- [ ] What port should production use? Current `.env.production` says 3001 but installer should use 3000 for simplicity. (Proposed: 3000)
