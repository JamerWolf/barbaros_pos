# Proposal: setup-monorepo-base

## Intent

El monorepo existe pero está vacío de scaffold real. No hay TypeScript configurado, ni tooling (ESLint, Prettier, Husky), ni estructura de directorios para API, web o shared. Este cambio establece la base completa e inmediata sobre la que se construirá toda la lógica de negocio de Bárbaro's POS.

## Scope

### In Scope
- `tsconfig.base.json` raíz + tsconfigs por workspace (composite + project references)
- `eslint.config.js` flat config (ESLint v9+) con TypeScript y Prettier integrados
- `.prettierrc` con config estándar del proyecto
- `docker-compose.yml` con postgres:16-alpine (puerto 5432, volumen pg_data)
- `.env.example` con variables requeridas (DATABASE_URL, PORT, etc.)
- `.gitignore` completo (node_modules, dist, .env, prisma/migrations generadas)
- `git init` en `D:\barbaros_pos`
- `husky` + `lint-staged` en raíz (pre-commit: lint + format + typecheck)
- Scaffold `apps/api/`: tsconfig, package.json (`@barbaros/api`), estructura Fastify + Prisma
- Scaffold `apps/web/`: tsconfig, package.json (`@barbaros/web`), estructura React + Vite + Tailwind + Workbox PWA
- Scaffold `packages/shared/`: tsconfig, package.json (`@barbaros/shared`), tipos base + eventos socket
- Scripts raíz en `package.json`: dev:api, dev:web, build, lint, format, typecheck, db:up, db:down, db:migrate, db:studio

### Out of Scope
- Lógica de negocio real (rutas, handlers, componentes de UI)
- Schema Prisma con entidades completas (solo placeholder inicial)
- Autenticación / autorización
- CI/CD pipelines
- Deploy / producción
- Tests (unit, integration, e2e)

## Capabilities

> Contrato entre proposal y sdd-spec: cada capability nueva genera `openspec/specs/<name>/spec.md`.

### New Capabilities
- `monorepo-tooling`: Configuración de TypeScript, ESLint, Prettier y Husky para el monorepo completo
- `workspace-scaffold`: Estructura de directorios y archivos base para apps/api, apps/web y packages/shared
- `local-dev-environment`: Docker Compose para PostgreSQL local, .env.example, git init
- `pwa-scaffold`: Configuración base de Workbox para habilitar el modo offline en tablets

### Modified Capabilities
- None

## Approach

Instalación secuencial por capas:
1. **Git + Node tooling**: `git init`, `.gitignore`, instalar devDeps raíz (typescript, eslint, prettier, husky, lint-staged)
2. **TypeScript**: `tsconfig.base.json` strict + ES2022; cada workspace extiende con sus propias necesidades (composite para api y shared, noEmit para web)
3. **ESLint + Prettier**: flat config con `@typescript-eslint`, `eslint-config-prettier`; `.prettierrc` con `{ semi: false, singleQuote: true, trailingComma: "all", printWidth: 100 }`
4. **Husky + lint-staged**: hook pre-commit aplica lint + format + typecheck sobre staged files
5. **Docker**: `docker-compose.yml` + `.env.example` para DATABASE_URL
6. **Scaffold apps/web**: Vite + React 18 + TailwindCSS + React Router v6 + Zustand; `vite-tsconfig-paths` plugin para resolver `@barbaros/shared`; Workbox para PWA offline
7. **Scaffold apps/api**: Fastify 4.x + `@fastify/cors` + `@fastify/websocket`; Prisma client; estructura routes/plugins/db; `tsx` para dev
8. **Scaffold packages/shared**: tipos base (account, product, payment, report) + eventos Socket.io server↔client; barrel export en `src/index.ts`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Agregar devDeps raíz, scripts, husky config, lint-staged |
| `tsconfig.base.json` | New | Config TS base compartida |
| `eslint.config.js` | New | ESLint flat config v9+ |
| `.prettierrc` | New | Prettier estándar del proyecto |
| `docker-compose.yml` | New | PostgreSQL local dev |
| `.env.example` | New | Variables de entorno requeridas |
| `.gitignore` | New | Ignorar node_modules, dist, .env, etc. |
| `.husky/pre-commit` | New | Hook lint + format + typecheck |
| `apps/api/` | New | Scaffold completo Fastify + Prisma |
| `apps/web/` | New | Scaffold completo React + Vite + Tailwind + Workbox PWA |
| `packages/shared/` | New | Tipos compartidos + eventos socket |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| npm workspaces symlinks en Windows requieren Developer Mode o admin | Med | Documentar en README; usar `npm install --legacy-peer-deps` como fallback |
| Vite no resuelve `@barbaros/shared` sin plugin | High | Incluir `vite-tsconfig-paths` en `vite.config.ts` desde el inicio |
| Prisma strict TS con `noUncheckedIndexedAccess` | Med | Activar solo `strict: true` base; habilitar extra checks por workspace si se necesita |
| `package.json name` incorrecto rompe workspace resolution | High | Verificar `@barbaros/shared` exacto post-install con `npm ls @barbaros/shared` |
| Husky v9 requiere Node >=18 y git init previo | Low | `git init` se ejecuta antes de instalar husky; Node >=18 ya asumido |

## Rollback Plan

El cambio es puramente aditivo sobre un repo vacío. No hay lógica de negocio ni datos en riesgo.

**Si algo falla post-scaffold:**
1. Eliminar todos los archivos generados (`git clean -fdx` o borrar manualmente)
2. El estado previo (carpetas vacías con `package.json` raíz minimal) se restaura en segundos
3. Para problemas de dependencias: `Remove-Item -Recurse -Force node_modules, apps/*/node_modules, packages/*/node_modules`; luego `npm install` desde cero

## Dependencies

- Node.js >=18 instalado en el sistema
- Docker Desktop corriendo (para `db:up`)
- Windows Developer Mode habilitado O PowerShell como administrador (para npm workspaces symlinks)

## Success Criteria

- [ ] `npm run typecheck` pasa sin errores en raíz (verifica los 3 workspaces)
- [ ] `npm run lint` pasa sin errores en raíz
- [ ] `npm run format --check` pasa sin diferencias
- [ ] `npm run db:up` levanta PostgreSQL en `localhost:5432` correctamente
- [ ] `npm run dev:api` arranca Fastify sin errores de import
- [ ] `npm run dev:web` arranca Vite y resuelve `@barbaros/shared` sin errores
- [ ] `packages/shared` exporta sus tipos correctamente (`import { SocketEvents } from "@barbaros/shared"` funciona)
- [ ] El hook pre-commit de Husky se ejecuta al hacer `git commit`
- [ ] `.env.example` presente con todas las variables documentadas
- [ ] `npm run build:web` genera service worker de Workbox sin errores
- [ ] `apps/web/public/manifest.json` es válido y permite instalar la PWA
