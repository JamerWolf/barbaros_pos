# Tasks: setup-monorepo-base

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600–800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Tooling + Git → PR 2: Dev environment → PR 3: Workspace scaffold + integration |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Git repo + root TS/ESLint/Prettier/Husky | PR 1 | Base branch: main; includes root package.json scripts |
| 2 | Docker Compose + .env.example + .gitignore | PR 2 | Base: main after PR 1; verifies db:up |
| 3 | apps/api + apps/web + packages/shared scaffold | PR 3 | Base: main after PR 2; resolves @barbaros/shared imports |

## Phase 1: Git + Root Tooling

- [x] 1.1 Run `git init` in `D:\barbaros_pos` if not already initialized.
- [x] 1.2 Update root `package.json` with workspaces, devDeps, and root scripts (`typecheck`, `lint`, `format`, `db:*`, `dev:*`, `build`).
- [x] 1.3 Create `tsconfig.base.json` with strict ES2022 settings and base compiler options.
- [x] 1.4 Create root `eslint.config.js` (flat config v9+) linting TS files across all workspaces.
- [x] 1.5 Create `.prettierrc` with `semi: false`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`.
- [x] 1.6 Create `.gitignore` excluding `node_modules`, `dist`, `.env`, `*.tsbuildinfo`, and generated Prisma migrations.
- [x] 1.7 Install Husky v9 and lint-staged, then create `.husky/pre-commit` running `npx lint-staged`.
- [x] 1.8 Configure `lint-staged` in root `package.json` to run lint, format, and typecheck on staged files.
- [x] 1.9 Run `npm install` from root and verify workspace symlinks resolve.

## Phase 2: Local Development Environment

- [x] 2.1 Create `docker-compose.yml` with `postgres:16-alpine` service on port `5432` and named volume `pg_data`.
- [x] 2.2 Create `.env.example` documenting `DATABASE_URL`, `PORT`, and any API-required variables.
- [x] 2.3 Add `db:up`, `db:down`, `db:migrate`, and `db:studio` scripts to root `package.json`.
- [x] 2.4 Run `npm run db:up` and confirm PostgreSQL accepts connections on `localhost:5432`.
- [x] 2.5 Run `npm run db:down` and verify the named volume persists data across restarts.

## Phase 3: Workspace Scaffold

- [x] 3.1 Create `packages/shared/package.json` named `@barbaros/shared` with `main`/`types` pointing to `dist/`.
- [x] 3.2 Create `packages/shared/tsconfig.json` as `composite` emitting declarations to `dist/`.
- [x] 3.3 Create `packages/shared/src/index.ts` exporting `AccountStatus`, `PaymentMethod`, and `SocketEvents`.
- [x] 3.4 Create `apps/api/package.json` named `@barbaros/api` with Fastify, Prisma, `@fastify/cors`, `@fastify/websocket`, and `tsx`.
- [x] 3.5 Create `apps/api/tsconfig.json` extending base, `composite`, referencing `packages/shared`.
- [x] 3.6 Create `apps/api/src/index.ts` as a minimal Fastify entry point importing `SocketEvents` from `@barbaros/shared`.
- [x] 3.7 Create `apps/api/prisma/schema.prisma` with a placeholder `datasource db` and `generator client`.
- [x] 3.8 Create `apps/web/package.json` named `@barbaros/web` with React 18, Vite, Tailwind, `react-router-dom` v6, Zustand, and `vite-tsconfig-paths`.
- [x] 3.9 Create `apps/web/tsconfig.json` extending base with `noEmit` and JSX settings.
- [x] 3.10 Create `apps/web/vite.config.ts` with `vite-tsconfig-paths` and `vite-plugin-pwa`/Workbox integration.
- [x] 3.11 Create `apps/web/tailwind.config.js` with content paths for `src/**/*.{ts,tsx}`.
- [x] 3.12 Create `apps/web/src/main.tsx` as the React entry point with conditional `navigator.serviceWorker.register('/sw.js')`.
- [x] 3.13 Create `apps/web/public/manifest.json` with name, short_name, start_url, display, and icons fields.
- [x] 3.14 Add `@barbaros/shared` as a workspace dependency in `apps/api/package.json` and `apps/web/package.json`.

## Phase 4: Integration Verification

- [x] 4.1 Run `npm run typecheck` from root and fix any TS errors across all workspaces.
- [x] 4.2 Run `npm run lint` from root and fix any ESLint errors.
- [x] 4.3 Run `npm run format --check` from root and fix any formatting drift.
- [x] 4.4 Run `npm run dev:api` and confirm Fastify starts without import errors.
- [x] 4.5 Run `npm run dev:web` and confirm Vite resolves `@barbaros/shared` imports.
- [x] 4.6 Run `npm run build:web` and verify Workbox generates `sw.js` in the output directory.
- [x] 4.7 Stage all files, run a test commit, and confirm Husky pre-commit blocks or passes as expected.
