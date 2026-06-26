# Exploration: setup-monorepo-base

**Change**: setup-monorepo-base  
**Project**: barbaros_pos  
**Date**: 2026-06-24  
**Mode**: hybrid (OpenSpec + Engram)

---

## Current State

El monorepo fue inicializado con npm workspaces. Tiene la siguiente estructura real:

```
D:\barbaros_pos
├── apps/
│   ├── api/          → VACÍO
│   └── web/          → VACÍO
├── packages/
│   └── shared/       → VACÍO
├── openspec/         → SDD artifacts
├── .atl/             → skill-registry.md
├── AGENTS.md         → reglas de negocio y convenciones
└── package.json      → workspace root (npm workspaces, node >=20)
```

`package.json` raíz tiene scripts básicos (`dev:api`, `dev:web`, `build`) pero NO tiene:
- ESLint / Prettier configurados
- tsconfig base compartido
- Scripts de lint, format, type-check
- Script para levantar Docker / PostgreSQL

No existe ningún archivo en apps/api, apps/web, ni packages/shared. El proyecto está en estado cero — solo el scaffold del monorepo.

---

## Affected Areas

- `package.json` — agregar devDependencies raíz, scripts de lint/format/typecheck/dev
- `tsconfig.base.json` (nuevo) — configuración TypeScript base compartida
- `apps/api/` — scaffold completo: tsconfig, package.json, estructura Fastify + Prisma
- `apps/web/` — scaffold completo: tsconfig, package.json, estructura React + Vite + TailwindCSS
- `packages/shared/` — package.json, tsconfig, tipos base exportados
- `.eslintrc` / `eslint.config.js` (nuevo) — ESLint compartido en raíz
- `.prettierrc` (nuevo) — Prettier compartido en raíz
- `docker-compose.yml` (nuevo) — PostgreSQL local para desarrollo
- `.gitignore` (nuevo o actualizar si existe)

---

## Approaches

### Approach 1: tsconfig con "composite" + project references (recomendado para monorepos)

Cada workspace tiene su `tsconfig.json` que extiende `tsconfig.base.json` en la raíz y declara `"composite": true`. Se usan `references` entre workspaces cuando hay dependencias (api → shared, web → shared).

- **Pros**:
  - Build incremental nativo con `tsc --build`
  - TypeScript puede navegar entre workspaces sin pasos extra
  - Estándar de la industria para monorepos TypeScript
  - Compatible con Vite, ts-node, Prisma
- **Cons**:
  - Requiere `declarationDir` y `declaration: true` en packages/shared
  - Más archivos tsconfig (uno por workspace + base)
  - Build completo con `tsc -b` requiere entender el grafo
- **Effort**: Medium

### Approach 2: tsconfig simple extend sin project references

Cada workspace extiende el base pero sin `composite` ni `references`. TypeScript no conoce la relación entre workspaces — cada build es independiente.

- **Pros**:
  - Más simple de entender para equipos pequeños
  - Menos configuración inicial
  - Vite y ts-node no requieren `composite`
- **Cons**:
  - Sin build incremental entre workspaces
  - Si packages/shared cambia, api/web deben hacer typecheck manualmente
  - Puede generar errores crípticos en imports cross-workspace
- **Effort**: Low

### Approach 3: Turborepo / Nx como task runner sobre npm workspaces

Agregar Turborepo (o Nx) para orquestar builds, lint, typecheck con cache inteligente.

- **Pros**:
  - Cache de tareas muy poderoso
  - Pipeline declarativo (`turbo.json`)
  - Estándar en monorepos grandes
- **Cons**:
  - Overhead de configuración no justificado para 3 workspaces
  - Agrega una capa de abstracción cuando el equipo no es grande
  - El proyecto tiene scope pequeño (POS para una discoteca)
- **Effort**: High

---

## Recommendation

**Approach 1** con la siguiente configuración concreta:

### tsconfig

```
tsconfig.base.json              ← raíz: strict, target ES2022, paths
apps/api/tsconfig.json          ← extiende base, composite, outDir dist/
apps/web/tsconfig.json          ← extiende base (sin composite — Vite lo maneja)
packages/shared/tsconfig.json   ← extiende base, composite, declaración
```

> **Nota Vite**: Vite no necesita `composite` porque usa esbuild internamente. El tsconfig de `apps/web` extiende el base pero con `noEmit: true`. Type-check de web se hace con `tsc --noEmit`.

### ESLint

Usar ESLint flat config (`eslint.config.js`) — es el estándar moderno (v9+). Un archivo en raíz con overrides por workspace. Incluir:
- `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
- `eslint-plugin-import` para order de imports
- `eslint-config-prettier` para no conflictar con Prettier

### Prettier

Un solo `.prettierrc` en raíz — aplica a todos los workspaces. Configuración mínima opinionada:
```json
{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

### packages/shared

Estructura mínima para empezar:
```
packages/shared/
├── src/
│   ├── index.ts          ← barrel export
│   ├── types/
│   │   ├── account.ts    ← Account, AccountStatus, Item
│   │   ├── product.ts    ← Product, Category
│   │   ├── payment.ts    ← Payment, PaymentMethod
│   │   └── report.ts     ← SalesReport
│   └── events/
│       └── socket.ts     ← tipos de eventos Socket.io (ServerToClient, ClientToServer)
├── package.json
└── tsconfig.json
```

Los tipos de Socket.io centralizados en shared es crítico — permite que tanto el backend (Socket.io server) como el frontend (Socket.io client) usen los mismos tipos de eventos sin duplicación.

### apps/api (Fastify + Prisma)

```
apps/api/
├── src/
│   ├── main.ts           ← entry point (bootstrap Fastify)
│   ├── app.ts            ← instancia Fastify + plugins
│   ├── plugins/          ← cors, sensible, socket.io
│   ├── routes/           ← rutas por dominio (accounts/, products/, payments/)
│   └── db/
│       └── prisma.ts     ← instancia singleton de PrismaClient
├── prisma/
│   └── schema.prisma     ← schema inicial (mínimo: Account, Product, Category, Payment)
├── package.json
└── tsconfig.json
```

**Decisión clave**: Fastify usa plugins para todo. No mezclar lógica de negocio en las rutas desde el inicio — usar pattern: `routes/ → service → prisma`.

### apps/web (React + Vite + TailwindCSS)

```
apps/web/
├── src/
│   ├── main.tsx          ← entry point React
│   ├── App.tsx           ← router principal (React Router v7)
│   ├── components/       ← componentes UI atómicos
│   ├── pages/            ← pantallas (Login, AccountList, AccountDetail, Payment, Products, Reports)
│   ├── hooks/            ← custom hooks (useSocket, useAccounts, etc.)
│   ├── services/         ← llamadas API (fetch wrapper)
│   └── store/            ← estado global (Zustand — liviano, sin boilerplate)
├── public/
├── vite.config.ts
├── tailwind.config.ts
├── index.html
├── package.json
└── tsconfig.json
```

**Decisión estado**: Zustand sobre Redux — el scope del proyecto no justifica Redux. Zustand es simple, TypeScript-friendly y compatible con Vite.

### Docker

```yaml
# docker-compose.yml (raíz)
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: barbaros_pos
      POSTGRES_USER: pos
      POSTGRES_PASSWORD: pos_dev
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
volumes:
  pg_data:
```

Agregar script en `package.json` raíz: `"db:up": "docker compose up -d db"`, `"db:down": "docker compose down"`.

### Scripts raíz (package.json)

```json
{
  "scripts": {
    "dev:api": "npm run dev --workspace=apps/api",
    "dev:web": "npm run dev --workspace=apps/web",
    "build": "npm run build --workspaces --if-present",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc -b",
    "db:up": "docker compose up -d db",
    "db:down": "docker compose down",
    "db:migrate": "npm run db:migrate --workspace=apps/api",
    "db:studio": "npm run db:studio --workspace=apps/api"
  }
}
```

---

## Decision Matrix — Puntos clave

| Decisión | Opción elegida | Razón |
|----------|---------------|-------|
| TypeScript monorepo | composite + project references | Build incremental, navegación cross-workspace |
| ESLint config format | Flat config (eslint.config.js) | Estándar ESLint v9+, una sola fuente de verdad |
| Estado frontend | Zustand | Simple, sin boilerplate, TypeScript-friendly |
| Router frontend | React Router v7 | Estándar de facto, compatible con Vite |
| Gestión de DB local | Docker Compose | Reproducible, sin instalar Postgres localmente |
| Entry de shared | Barrel export (src/index.ts) | Un solo import path: `@barbaros/shared` |
| Socket types | En packages/shared | Única fuente de verdad para eventos server↔client |

---

## Risks

- **Riesgo 1 — Vite + paths de TypeScript**: Si se usan `paths` en tsconfig.base.json (ej: `@barbaros/shared`), Vite necesita `vite-tsconfig-paths` plugin para resolverlos. Sin esto, los imports en apps/web fallarán en runtime aunque TypeScript los valide.
- **Riesgo 2 — npm workspaces symlinks en Windows**: npm workspaces usa symlinks para resolver packages locales. En Windows, esto requiere permisos de administrador o Developer Mode habilitado. El deploy es en Linux, pero el dev es en Windows — testear que `npm install` en la raíz resuelva correctamente `@barbaros/shared`.
- **Riesgo 3 — Prisma y TypeScript strict**: Prisma genera tipos en `node_modules/@prisma/client`. Con `strict: true` y `noUncheckedIndexedAccess`, algunos accesos a relaciones opcionales de Prisma pueden requerir null-checks explícitos. Menor, pero puede sorprender.
- **Riesgo 4 — Workbox PWA scope**: Agregar Workbox (service worker) al final del proceso — no al inicio. El service worker puede interferir con hot-reload de Vite en desarrollo. Se configura solo para el build de producción.
- **Riesgo 5 — package.json `name` en workspaces**: Para que npm workspaces resuelva `@barbaros/shared`, el `name` en `packages/shared/package.json` debe ser exactamente `@barbaros/shared`. Si el nombre no coincide con los imports, TypeScript compila pero npm no resuelve.

---

## Open Questions

1. ¿El nombre del scope npm para los packages? Propuesta: `@barbaros/shared`, `@barbaros/api`, `@barbaros/web`. ¿O sin scope? (ej: `barbaros-shared`)
2. ¿Se agrega `.env` / `.env.example` en esta fase? Necesario para la DATABASE_URL de Prisma.
3. ¿Se inicializa git en esta fase? El monorepo no tiene `.git` todavía (no es un repo git según el contexto).
4. ¿Se agrega `husky` + `lint-staged` para pre-commit hooks? Recomendado pero puede ir en una fase separada.

---

## Ready for Proposal

**Yes** — la exploración tiene suficiente claridad para proceder con la propuesta. Las open questions son decisiones puntuales que se pueden resolver en sdd-propose o directamente tomar con los defaults recomendados.

**Recomendación al usuario**: Confirmar el nombre del scope npm (`@barbaros/...`) y si se incluye `.env.example` en esta fase. El resto puede avanzar sin bloqueo.
