# Tasks: Inno Setup Production Installer

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250 (new scripts + .iss + app.ts modification) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | exception-ok |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Build pipeline + static serving | PR 1 | `powershell -File installer/build-production.ps1` | Run on dev machine, verify dist/ layout | Revert app.ts change + remove installer/ |
| 2 | Installer + auto-start | PR 1 | Build .iss on dev, run on clean VM | Full install cycle on Windows VM | Remove installer/ directory |

## Phase 1: Build Pipeline

- [x] 1.1 Create `installer/build-production.ps1` — sequential build: shared → api tsc → vite build → prisma generate → copy web dist into `apps/api/dist/web/` → verify artifacts exist
- [x] 1.2 Update `.gitignore` — add `installer/staging/` and `installer/releases/` to ignored paths

## Phase 2: API Production Mode

- [x] 2.1 Modify `apps/api/src/app.ts` — register `@fastify/static` for `apps/api/dist/web/` (web build) with SPA fallback, separate from existing uploads static registration
- [x] 2.2 Update `apps/api/.env.production` — set PORT=3000 (single-port architecture), keep DB on port 5433 to avoid dev conflict

## Phase 3: Docker Compose

- [x] 3.1 Create `installer/staging/docker-compose.yml` — single postgres:16-alpine service, port 5433, volume `pg_data_prod`, healthcheck

## Phase 4: Installer Scripts

- [x] 4.1 Create `installer/staging/start-barbaros.ps1` — wait for Docker ready (up to 120s), start docker-compose, run prisma migrate deploy, start API via `node apps/api/dist/index.js`
- [x] 4.2 Create `installer/staging/stop-barbaros.ps1` — stop API process, stop docker-compose (preserve volume)
- [x] 4.3 Create `installer/staging/.env.production` — production env vars for the deployed instance

## Phase 5: Inno Setup

- [x] 5.1 Create `installer/barbaros-pos.iss` — Inno Setup script: pre-checks (Docker, admin rights), file copy to `C:\BarbarosPOS\`, start menu shortcut, post-install prisma migrate, uninstaller cleanup
- [x] 5.2 Create `installer/build-installer.bat` — wrapper to compile .iss to .exe using ISCC.exe

## Phase 6: Auto-Start

- [x] 6.1 Add Task Scheduler XML definition in `installer/barbaros-pos.iss` [Run] section — register `BarbarosPOS` task at boot with 30s delay, runs `start-barbaros.ps1`

## Phase 7: Testing

- [x] 7.1 Run `installer/build-production.ps1` on dev machine — verify `apps/api/dist/` contains compiled API + web dist copy, `apps/api/dist/web/index.html` exists ✅ (build compilation passed)
- [x] 7.2 Start API with `APP_ENV=production` — verify `http://localhost:3000` serves the web app and API endpoints work ✅ (node dist/index.js starts, health check returns 200)
- [ ] 7.3 Build Inno Setup .exe on dev machine — verify installer compiles without errors ⏭️ (requires Inno Setup compiler, not available on dev)
- [ ] 7.4 Test install on clean Windows VM — verify file layout, Task Scheduler task, auto-start on reboot ⏭️ (requires clean VM environment)
- [ ] 7.5 Test uninstall — verify `C:\BarbarosPOS\` removed, task removed, Docker volume preserved ⏭️ (requires clean VM environment)
