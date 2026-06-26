# Design: setup-monorepo-base

## Technical Approach

Instalar la base del monorepo npm sobre el repositorio vacío existente. La raíz centraliza el tooling compartido; cada workspace recibe solo el scaffold que le corresponde. El objetivo es que `npm run typecheck`, `npm run lint`, `npm run format --check`, `npm run db:up`, `npm run dev:api` y `npm run dev:web` funcionen sin errores antes de agregar lógica de negocio.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Workspaces | npm workspaces (existentes) | pnpm, yarn | El `package.json` raíz ya los define; evitamos migrar. En Windows los symlinks requieren Developer Mode o admin; se documentará. |
| TypeScript | `tsconfig.base.json` strict + project references | Un solo tsconfig | References habilitan `tsc --build` incremental y verificación cruzada. `api`/`shared` son `composite`; `web` usa `noEmit` porque Vite transpila. |
| Lint/format | ESLint v9 flat config + Prettier | `.eslintrc`, StandardJS | Flat config es el estándar actual; `@typescript-eslint` + `eslint-config-prettier` sin conflictos. |
| Pre-commit | Husky v9 + lint-staged | lefthook | Ligero, documentado y compatible con npm scripts. Ejecuta lint + format + typecheck sobre archivos staged. |
| Backend | Fastify 4.x + `@fastify/cors` + `@fastify/websocket` | Express, Hono, Fastify 5 | LTS estable; plugins ampliamente soportados. |
| Dev server API | `tsx` | `ts-node-dev`, `tsc --watch` + `node` | Rápido, moderno, sin configuración extra. |
| ORM | Prisma (placeholder) | Drizzle, TypeORM | Stack ya definido; se deja schema mínimo para generar el client. |
| Frontend | React 18 + Vite + Tailwind + `vite-tsconfig-paths` | Next.js, Remix | SPA PWA sobre LAN; Vite ofrece HMR rápido. El plugin resuelve `@barbaros/shared`. |
| Router | `react-router-dom` v6 | React Router v7 | Opción madura y estable para la fase inicial. |
| PWA | Workbox en `vite.config.ts` | Aplazar a fase posterior | Incluir desde la base para habilitar offline en tablets. |
| DB local | `docker-compose.yml` con `postgres:16-alpine` | PostgreSQL nativo | Reproducible entre máquinas; un solo `npm run db:up`. |

## Data Flow

No hay flujo de negocio todavía. El flujo de desarrollo es:

```
Developer ──► git add ──► Husky pre-commit
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      lint-staged       typecheck root      commit
      (lint+format)     (tsc --build)
```

`apps/api` y `apps/web` importan tipos de `@barbaros/shared`. Vite los resuelve mediante `vite-tsconfig-paths`; Prisma client se genera en `apps/api`.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | devDeps raíz, scripts, config husky/lint-staged |
| `tsconfig.base.json` | Create | Config base strict + ES2022 + paths |
| `apps/api/tsconfig.json` | Create | Extiende base, `composite`, referencia a `packages/shared` |
| `apps/web/tsconfig.json` | Create | Extiende base, `noEmit`, paths para Vite |
| `packages/shared/tsconfig.json` | Create | `composite`, emite declarations |
| `eslint.config.js` | Create | Flat config con TS y Prettier |
| `.prettierrc` | Create | `semi: false, singleQuote: true, trailingComma: all, printWidth: 100` |
| `.gitignore` | Create | node_modules, dist, .env, .tsbuildinfo, migrations generadas |
| `.env.example` | Create | DATABASE_URL, PORT, etc. |
| `docker-compose.yml` | Create | postgres:16-alpine en 5432 con volumen pg_data |
| `.husky/pre-commit` | Create | `npx lint-staged` |
| `apps/api/package.json` | Create | `@barbaros/api`, deps Fastify/Prisma, scripts |
| `apps/api/src/index.ts` | Create | Entry point Fastify mínimo |
| `apps/api/prisma/schema.prisma` | Create | Placeholder con datasource y generator |
| `apps/web/package.json` | Create | `@barbaros/web`, deps React/Vite/Tailwind |
| `apps/web/vite.config.ts` | Create | Con `vite-tsconfig-paths` |
| `apps/web/tailwind.config.js` | Create | Config Tailwind básica |
| `apps/web/vite.config.ts` | Create | Vite + `vite-tsconfig-paths` + `vite-plugin-pwa`/Workbox |
| `apps/web/public/manifest.json` | Create | Web App Manifest para tablets |
| `apps/web/src/main.tsx` | Create | Entry point React con registro condicional del service worker |
| `packages/shared/package.json` | Create | `@barbaros/shared`, main/types apuntan a dist |
| `packages/shared/src/index.ts` | Create | Barrel export de tipos y eventos socket |

## Interfaces / Contracts

`packages/shared/package.json`:

```json
{
  "name": "@barbaros/shared",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -b" }
}
```

`packages/shared/src/index.ts`:

```ts
export type AccountStatus = 'open' | 'closed'
export type PaymentMethod = 'cash' | 'transfer' | 'card'

export interface SocketEvents {
  'account:updated': { accountId: string }
  'account:closed': { accountId: string }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static | TS/ESLint/Prettier + PWA build | Gates obligatorios en pre-commit y CI; build de web genera service worker |
| Unit | Funciones puras en `packages/shared` | Añadir Vitest en fase posterior |
| Integration | API routes + Prisma | PostgreSQL de test cuando existan routes |
| E2E | Flujos de web | Playwright una vez definidas pantallas |

El spec deja tests fuera de scope; ahora se configuran solo los gates estáticos.

## Migration / Rollout

No migration required. Cambio aditivo sobre repo vacío. Rollback: `git clean -fdx` y restaurar `package.json` raíz original.

## Open Questions

- [x] ¿`react-router-dom` v6 o React Router v7 en modo librería? → **v6**
- [x] ¿Fastify 4.x LTS o 5.x? → **4.x LTS**
- [x] ¿`tsx`/`ts-node-dev` para dev de API o `tsc --watch` + `node`? → **tsx**
- [x] ¿Workbox se aplaza a un cambio posterior dedicado? → **Incluir en esta fase**
