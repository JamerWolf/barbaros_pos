# Proposal: Inno Setup Production Installer

## Intent

The POS system currently only runs in dev mode (`tsx`, vite dev server, shell:startup bat). The target PC is a company machine that turns on/off normally — it needs a **one-click installer** that sets up everything (Docker, PostgreSQL, compiled app, auto-start) and works unattended.

## Scope

### In Scope
- Build script: shared → api → web → prisma generate + migrate deploy
- Production docker-compose: single PostgreSQL on port 5432, DB `barbaros_pos`
- Production `.env` file (replaces dual develop/production env files)
- Inno Setup `.iss` script: installs Docker Desktop, Node.js, Git, app artifacts
- Auto-start: Windows Task Scheduler (runs on boot, no user login required)
- Start/stop scripts for the compiled production app
- API serves web build as static files (SPA fallback)
- Post-install: prisma generate + migrate deploy + seed (first run)

### Out of Scope
- Dev/prod split simplification (existing dual env files stay for dev)
- Cloudflare Tunnel support in production
- PWA service worker in production (future)
- Backup/restore for PostgreSQL data
- Unattended Windows Update handling

## Capabilities

### New Capabilities
- `production-installer`: Inno Setup script, build pipeline, deployment scripts, auto-start configuration

### Modified Capabilities
- None — this is purely additive infrastructure, no existing spec behavior changes

## Approach

### Build Pipeline (`scripts/build.ps1`)
Sequential: `npm run build --workspace=packages/shared` → `npm run build --workspace=apps/api` → `npm run build --workspace=apps/web` → `prisma generate` → copy web dist into API dist for static serving.

### Production Runtime
- **PostgreSQL**: Docker container via `docker-compose.prod.yml`, port 5432, volume `pg_data_prod`
- **API**: `node apps/api/dist/index.js` with `APP_ENV=production` (loads `.env.production`)
- **Web**: Served by API via `@fastify/static` — no separate vite server
- **Auto-start**: Task Scheduler task `BarbarosPOS` triggers on boot, runs `start-prod.ps1`

### API Static Serving Fix
Current `app.ts` resolves `../../web/dist/index.html` relative to `__dirname` (which in compiled mode is `apps/api/dist/`). In production, web dist must be copied INTO `apps/api/dist/web/` during build so the path resolves correctly. Alternatively, adjust the path in app.ts to work from the deployed layout.

### Deployment Layout (on target PC)
```
C:\barbaros_pos\
├── apps/api/dist/          ← compiled API + web dist inside
├── apps/api/.env.production
├── apps/web/dist/          ← compiled web (also copied to api/dist/web/)
├── packages/shared/dist/
├── docker-compose.prod.yml
├── start-prod.ps1
├── stop-prod.ps1
├── scripts/migrate.js
└── uploads/
```

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `scripts/build.ps1` | New | Build pipeline for production artifacts |
| `docker-compose.prod.yml` | New | Single PostgreSQL container for production |
| `apps/api/.env.production` | Modified | Port 5432, DB `barbaros_pos` |
| `apps/api/src/app.ts` | Modified | Fix static serving path for production layout |
| `start-prod.ps1` | New | Start Docker, migrations, API server |
| `stop-prod.ps1` | New | Stop API + Docker |
| `installer/barbaros-pos.iss` | New | Inno Setup script |
| `installer/build-installer.bat` | New | Compiles .iss to .exe |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker Desktop install requires reboot | High | Installer detects and prompts; Task Scheduler handles post-reboot |
| `tsx` → `node` transition breaks ESM imports | Medium | API already uses `.js` extensions in imports; verify with `tsc -b` |
| Prisma generated client path mismatch | Medium | `schema.prisma` outputs to `../generated/prisma` — verify `require()` resolves |
| Static file path wrong in compiled mode | High | Test API serves `index.html` from correct relative path after build |
| Task Scheduler fails without Docker running | Medium | `start-prod.ps1` waits for Docker before starting API |

## Rollback Plan

1. Uninstall via Windows "Add or Remove Programs"
2. Delete `C:\barbaros_pos\`
3. Remove Task Scheduler task `BarbarosPOS`
4. `docker compose -f docker-compose.prod.yml down -v` (removes DB volume)
5. Existing dev setup (`start.ps1`) is completely unaffected

## Dependencies

- Docker Desktop for Windows (installer downloads it)
- Node.js 20+ (installer downloads it)
- Git (installer downloads it)
- Inno Setup 6+ (developer builds .exe on their machine)

## Success Criteria

- [ ] Running `scripts/build.ps1` produces a working `dist/` folder
- [ ] Inno Setup .exe installs on a clean Windows 10/11 machine
- [ ] After install, `http://localhost:3001` serves the POS web app
- [ ] After reboot, the app auto-starts without user interaction
- [ ] All API endpoints work (accounts, products, payments, reports)
- [ ] WebSocket real-time updates work across devices
- [ ] Uninstall cleanly removes everything

## Proposal Question Round

Before finalizing, a few questions to sharpen the proposal:

1. **Installer scope**: Should the Inno Setup `.exe` be built on YOUR dev machine and shipped as a pre-built artifact? Or should the target PC run the full build pipeline (npm install + tsc + vite build) during install? Pre-built is simpler and faster on target; full build is more flexible but requires Node.js on target.

2. **Docker Desktop license**: Docker Desktop requires a paid license for companies with >250 employees or >$10M revenue. Is the target company eligible for the free license (small business)? If not, we may need to consider Podman or WSL2 + plain Docker Engine as alternatives.

3. **Data persistence**: The PostgreSQL data lives in a Docker volume. If Docker is uninstalled or the volume is deleted, data is lost. Should the installer back up the volume periodically, or is manual backup acceptable?

4. **Port conflict**: Production uses port 3001 for API. If the dev environment is also running on the same machine, they won't conflict (dev=3000, prod=3001). But if something else uses 3001, it'll fail. Should we make the port configurable in the installer?
