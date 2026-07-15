# Production Installer Specification

## Purpose

Deploy compiled POS system to a target Windows PC as a one-click installer with auto-start, offline operation, and PostgreSQL persistence.

## Requirements

### Requirement: Build Pipeline

The system MUST provide a build script (`scripts/build.ps1`) that produces production-ready artifacts in sequential order.

#### Scenario: Full production build

- GIVEN the developer runs `scripts/build.ps1` from repo root
- WHEN each stage completes successfully
- THEN `packages/shared/dist/` exists
- AND `apps/api/dist/` contains compiled API JS files
- AND `apps/web/dist/` contains compiled web assets
- AND `apps/api/dist/web/` contains a copy of web dist (for static serving)
- AND `apps/api/generated/prisma/` contains generated Prisma client

#### Scenario: Build failure halts pipeline

- GIVEN the api TypeScript compilation fails
- WHEN the build script reaches the web build step
- THEN the script MUST exit with non-zero code and MUST NOT proceed

### Requirement: Production Docker

A production docker-compose file (`docker-compose.prod.yml`) MUST provide a single PostgreSQL container.

#### Scenario: Production DB starts on target PC

- GIVEN the installer runs `docker compose -f docker-compose.prod.yml up -d`
- WHEN the container starts
- THEN PostgreSQL is accessible on port 5432
- AND database `barbaros_pos` exists
- AND data persists in named volume `pg_data_prod`

#### Scenario: Dev and prod coexist on same machine

- GIVEN dev PostgreSQL runs on port 5432 (barbaros_pos_dev)
- WHEN production docker-compose starts on the same machine
- THEN production MUST use port 5433 to avoid conflict
- AND the production `.env` file MUST reflect the correct port

### Requirement: API Production Mode

The API MUST run via `node apps/api/dist/index.js` with `APP_ENV=production`.

#### Scenario: API starts with production config

- GIVEN `APP_ENV=production` is set
- WHEN `node apps/api/dist/index.js` executes
- THEN the API loads `apps/api/.env.production`
- AND listens on the configured PORT (default 3001)

#### Scenario: API serves web as static files

- GIVEN the API is running in production mode
- WHEN a GET request hits `/` or any non-API path with `Accept: text/html`
- THEN the API returns `apps/api/dist/web/index.html` with 200 status

#### Scenario: API graceful shutdown

- GIVEN the API is running and serving requests
- WHEN a SIGTERM or SIGINT signal is received
- THEN the API stops accepting new connections
- AND completes in-flight requests
- AND exits cleanly

### Requirement: Installer Pre-Checks

The Inno Setup installer MUST verify prerequisites before installing.

#### Scenario: Docker Desktop not installed

- GIVEN Docker Desktop is not present on the target PC
- WHEN the installer runs
- THEN it prompts to install Docker Desktop first
- AND aborts app installation until Docker is available

#### Scenario: Admin rights required

- GIVEN the installer is run without administrator privileges
- WHEN it attempts to install
- THEN it MUST request elevation (UAC prompt)
- AND abort if elevation is denied

### Requirement: Installer File Layout

The installer MUST deploy files to `C:\barbaros_pos\` with the structure defined in the proposal.

#### Scenario: Clean install

- GIVEN no previous installation exists at `C:\barbaros_pos\`
- WHEN the installer completes
- THEN the directory structure matches the proposal layout
- AND a start menu shortcut is created

#### Scenario: Upgrade existing installation

- GIVEN `C:\barbaros_pos\` already exists
- WHEN the installer runs
- THEN it overwrites application files
- AND preserves `uploads/` directory and `.env` files
- AND preserves the PostgreSQL volume (not touched by installer)

### Requirement: Post-Install Steps

The installer MUST run post-install tasks after file deployment.

#### Scenario: First install

- GIVEN this is a fresh installation
- WHEN post-install runs
- THEN `prisma generate` executes successfully
- THEN `prisma migrate deploy` creates all tables
- AND a Task Scheduler task `BarbarosPOS` is registered

### Requirement: Auto-Start via Task Scheduler

The system MUST auto-start on boot without user login.

#### Scenario: PC boots without user login

- GIVEN the Task Scheduler task `BarbarosPOS` is registered
- WHEN the PC boots (any user or no user logged in)
- THEN the task triggers and runs `start-prod.ps1`
- AND the API becomes available within 120 seconds

#### Scenario: Docker not ready at boot time

- GIVEN the PC just booted and Docker Desktop is still starting
- WHEN the auto-start task runs
- THEN `start-prod.ps1` waits for Docker to be ready (up to 120s)
- AND starts the API only after Docker is confirmed running

### Requirement: Start/Stop Scripts

Manual control scripts MUST be provided.

#### Scenario: start-prod.ps1 starts all services

- GIVEN the user runs `start-prod.ps1`
- WHEN it completes
- THEN Docker is running
- AND PostgreSQL container is up and healthy
- AND API is listening on the configured port
- AND the web app is accessible via browser

#### Scenario: stop-prod.ps1 stops all services

- GIVEN the user runs `stop-prod.ps1`
- WHEN it completes
- THEN the API process is stopped
- AND the Docker container is stopped (data preserved)

### Requirement: Uninstaller

The system MUST provide a clean uninstall path.

#### Scenario: Uninstall removes app files

- GIVEN the user runs the uninstaller from Windows "Add or Remove Programs"
- WHEN uninstall completes
- THEN `C:\barbaros_pos\` is removed
- AND the Task Scheduler task `BarbarosPOS` is removed
- AND Docker container and volume are NOT removed (data preserved)

#### Scenario: Uninstall with running services

- GIVEN the API is currently running
- WHEN uninstall starts
- THEN the API process is stopped first
- THEN files are removed
