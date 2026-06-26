# Estado del Proyecto — Bárbaro's POS

**Fecha**: 26 de junio de 2026
**Stack**: React + TypeScript + Zustand (web) · Fastify + Prisma + PostgreSQL (api) · Monorepo npm workspaces
**Proyecto en**: `D:\barbaros_pos` (no confundir con `C:\Users\imerc\barbaros_pos` que está desactualizado)

---

## Ciclos Completados

### ✅ 1. Setup Monorepo Base
**Fecha**: 24/06/2026
**SDD**: `openspec/changes/archive/2026-06-24-setup-monorepo-base/`

| Elemento | Estado | Verificado en Memoria |
|----------|--------|----------------------|
| TypeScript strict + project references | ✅ | Sí |
| ESLint v9 flat config + Prettier | ✅ | Sí |
| Husky + lint-staged (pre-commit) | ✅ | Sí |
| Docker Compose (PostgreSQL 16) | ✅ | Sí |
| Scaffold `apps/api` (Fastify + Prisma) | ✅ | Sí |
| Scaffold `apps/web` (React + Vite + Tailwind + PWA) | ✅ | Sí |
| Scaffold `packages/shared` (tipos + eventos socket) | ✅ | Sí |
| Scripts raíz (dev, build, lint, db:*) | ✅ | Sí |

### ✅ 2. Gestión de Cuentas (Backend)
**Fecha**: 24/06/2026
**SDD**: `openspec/changes/archive/2026-06-24-gestion-cuentas/`
**Apply**: 2 PRs encadenados (stacked-to-main)

| Elemento | Estado | Verificado en Memoria |
|----------|--------|----------------------|
| Modelo `Shift` (turno) | ✅ | Obs #122: "Jornadas de discoteca cruzan medianoche" |
| Modelo `Account` (UUID, number por turno) | ✅ | Obs #120: "Reset por noche, no día calendario" |
| `POST /shifts/open` y `POST /shifts/close` | ✅ | Obs #126: Tasks 2.1 completado |
| `POST /accounts`, `GET /accounts`, `PUT /accounts/:id/close` | ✅ | Obs #126: Tasks 2.3, 2.4 completados |
| `POST /accounts/merge` (unir cuentas) | ✅ | Implementado |
| `GET /shifts/active` | ✅ | Implementado |
| Servicio `AccountService` con transacciones | ✅ | Obs #126: "Prisma Serializable para MAX+1" |
| Emisión Socket.io (`account:created`, `account:updated`, `account:deleted`) | ✅ | Obs #126: Task 3.2 |
| Borrado físico en $0 al cerrar | ✅ | Obs #128: "Cerrar con saldo $0 realiza DELETE físico" |
| Number consecutivo por turno (MAX+1) | ✅ | Obs #122: "MAX(number)+1 transaccional" |
| Test concurrencia (10 POST paralelos) | ✅ | Obs #126: Task 4.1 |
| Test borrado físico en $0 | ✅ | Obs #126: Task 4.2 |
| Test Zustand store | ✅ | Obs #126: Task 4.3 |
| **Verificación SDD**: PASS WITH WARNINGS | ✅ | Obs #128: "API tests skipped, DB offline" |

### ✅ 3. UI de Cuentas (Frontend)
**Fecha**: 24/06/2026
**SDD**: `openspec/changes/archive/2026-06-24-ui-cuentas/`
**Apply**: Fase 2 Canvas Components

| Elemento | Estado | Verificado en Memoria |
|----------|--------|----------------------|
| Dashboard Canvas con nodos arrastrables | ✅ | Obs #130: "Pointer Events nativos, no HTML5 DnD" |
| Persistencia de posiciones (localStorage) | ✅ | Obs #118: "Separar estado negocio del visual" |
| Auto-posicionamiento radial | ✅ | Implementado en `accountUIStore` |
| Limpieza de posiciones huérfanas al abrir turno | ✅ | Obs #130: "Evitar crecimiento infinito localStorage" |
| AccountDetailPage (detalle de cuenta) | ✅ | Implementado |
| Mobile-First estricto (touch targets, contraste) | ✅ | Obs #130: "Dimensiones touch, alto contraste" |
| Zustand store (`accountStore`, `accountUIStore`) | ✅ | Obs #126: Task 3.1 |
| WebSocket hook para sync en tiempo real | ✅ | Obs #126: Task 3.2 |
| Refetch en reconexión de socket | ✅ | Obs #118: "Refetch GET /accounts en reconexión" |
| PIN admin (1234) para operaciones sensibles | ✅ | Implementado |
| **Bug**: Canvas positions se perdían al recargar | ✅ | Obs: DragNode ahora lee del store directamente |
| **Bug**: clearOrphanPositions limpiaba antes de cargar | ✅ | Obs: Early return si openAccounts.length === 0 |

### ✅ 4. Agregar Productos a Cuentas
**Fecha**: 25/06/2026
**SDD**: `openspec/changes/archive/2026-06-25-agregar-productos-cuenta/`
**Apply**: 2 PRs (PR1: Schema+API, PR2: UI)

| Elemento | Estado | Verificado en Memoria |
|----------|--------|----------------------|
| Modelo `Category` (Prisma) | ✅ | Obs: Migración `add_products` aplicada |
| Modelo `Product` (con category, price, photoUrl) | ✅ | Obs: Migración aplicada |
| Modelo `OrderItem` (unitPrice, quantity, productId, accountId) | ✅ | Obs: Migración aplicada |
| Migración `add_products` aplicada | ✅ | Obs: "prisma migrate reset + migrate dev" |
| `ProductService` (CRUD completo) | ✅ | Implementado |
| `AccountService.addItem/removeItem/updateItemQuantity` | ✅ | Implementado |
| Rutas `/products` y `/categories` | ✅ | Implementado |
| Rutas `/accounts/:id/items` (POST, PUT, DELETE) | ✅ | Implementado |
| `productStore` (Zustand) | ✅ | Implementado |
| `accountStore` extiende con items | ✅ | Obs: "raw.items ?? raw.orderItems ?? []" |
| `CategoryTabs` | ✅ | Implementado |
| `ProductGrid` (top 5 productos rápidos) | ✅ | Implementado |
| `OrderItemList` (lista de items con cantidades) | ✅ | Implementado |
| `AccountDetailPage` reescrito con selector + items + total | ✅ | Implementado |
| `AdminProductsPage` (panel hamburguesa para CRUD admin) | ✅ | Implementado |
| WebSocket `account:updated` con items | ✅ | Implementado |

### 🔧 Fixes Adicionales (No en SDD)
| Fix | Fuente |
|-----|--------|
| `DATABASE_URL` no se encontraba → `--env-file=../../.env` | Obs en memoria |
| Prisma Decimal → `Number()` wrapper | Obs en memoria |
| API `GET /accounts` no incluía items ni total | Sesión actual |
| DashboardPage hardcodeaba `total={0}` | Sesión actual |
| Close account 400 → sin Content-Type header | Obs en memoria |
| Formato pesos colombianos (sin centavos) | Sesión actual |
| Editar nombre de cuenta desde el detalle | Sesión actual |

---

## Discrepancias: Memoria vs Archivos

| Aspecto | En Memoria (Engram) | En Archivos (openspec/) | Discrepancia |
|---------|---------------------|------------------------|--------------|
| Proyecto name | `pos-discoteca` (engram) | `barbaros_pos` (carpeta) | **Menor** — mismo proyecto, nombre distinto en engram vs disco |
| Ruta real | `D:\barbaros_pos` | `D:\barbaros_pos` | ✅ Consistente |
| Copia stale | `C:\Users\imerc\barbaros_pos` | No referenciada | ⚠️ Evitar usar esta ruta |
| Test runner | "Custom TS scripts via tsx" | No hay vitest/jest configurado | ✅ Consistente — tests manuales |
| DB tests | "Skipped - DB offline" | No hay test runner formal | ✅ Consistente |
| SDD verification | "PASS WITH WARNINGS" | verify.md en archive | ✅ Consistente |

---

## Archivos Clave del Proyecto

```
D:\barbaros_pos\
├── apps/
│   ├── api/
│   │   ├── prisma/schema.prisma          # Category, Product, OrderItem, Account, Shift
│   │   └── src/
│   │       ├── routes/accounts/index.ts  # CRUD cuentas + items + PATCH name
│   │       ├── routes/products/index.ts  # CRUD productos
│   │       ├── routes/categories/index.ts # CRUD categorías
│   │       ├── routes/shifts/index.ts    # Apertura/cierre turnos
│   │       └── services/                 # AccountService, ProductService
│   └── web/
│       └── src/
│           ├── pages/DashboardPage.tsx    # Dashboard Canvas
│           ├── pages/AccountDetailPage.tsx # Detalle con productos + editar nombre
│           ├── components/Admin/AdminProductsPage.tsx # CRUD admin
│           ├── components/ProductGrid.tsx  # Top 5 productos
│           ├── components/OrderItemList.tsx # Lista de items
│           ├── store/accountStore.ts      # Estado cuentas + items
│           ├── store/productStore.ts      # Estado productos
│           └── utils/format.ts           # formatCOP (pesos colombianos)
└── openspec/changes/archive/             # Documentación SDD (4 ciclos)
```

---

## Próximos Pasos Recomendados

| # | Feature | Prioridad | Notas |
|---|---------|-----------|-------|
| 1 | **Pagos y Cierre** | 🔴 Alta | Medios de pago, Payment model, splits |
| 2 | **Búsqueda de productos** | 🔴 Alta | UX crítica para servicio rápido |
| 3 | **Tests formales** | 🟡 Media | Vitest/Jest, no scripts manuales |
| 4 | **Turnos y reportes** | 🟡 Media | Historial, ventas por turno, export |
| 5 | **Auth y roles** | 🟡 Media | Login, permisos Admin/Mesero/Barman |
| 6 | **Modificadores de producto** | 🟢 Baja | Hielo, doble, notas especiales |
| 7 | **PWA completa** | 🟢 Baja | Service Worker, offline sync |

