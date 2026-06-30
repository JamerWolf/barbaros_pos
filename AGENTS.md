# barbaros_pos — AGENTS.md

Sistema POS para discoteca. Reemplaza el proceso manual de registro de consumos y cuadre de caja al final de la noche.

---

## Estructura del proyecto

```
D:\barbaros_pos
├── apps
│   ├── api          → Backend: Fastify + TypeScript + Prisma + Socket.io
│   └── web          → Frontend: React + TypeScript + Vite + TailwindCSS
├── packages
│   └── shared       → Tipos TypeScript compartidos entre api y web
├── package.json     → Workspace root (npm workspaces)
└── AGENTS.md        → Este archivo
```

---

## Stack tecnológico

| Capa            | Tecnología                              |
| --------------- | --------------------------------------- |
| Backend         | Node.js + TypeScript + Fastify          |
| Tiempo real     | Socket.io                               |
| Base de datos   | PostgreSQL                              |
| ORM             | Prisma                                  |
| Frontend        | React + TypeScript + Vite + TailwindCSS |
| Offline/PWA     | Workbox (Service Worker)                |
| Infraestructura | Docker + Linux                          |

---

## Arquitectura

- **Cliente-servidor en LAN local** — sin dependencia de internet
- **PWA** — sin instalación, se abre desde el navegador con la IP del servidor
- **API REST** — para operaciones (crear, modificar, cerrar cuentas)
- **WebSockets** — para tiempo real (cambios visibles en todos los dispositivos)
- **Modo offline** — caché local en cada dispositivo, sincroniza al reconectarse

---

## Modos de usuario

| Modo     | Acceso                    | Capacidades                                           |
| -------- | ------------------------- | ----------------------------------------------------- |
| Personal | Sin PIN                   | Operación de cuentas y pedidos                        |
| Admin    | PIN numérico global único | Todo lo de Personal + gestión de productos + reportes |

El PIN de admin se usa también para reabrir cuentas cerradas.

---

## Reglas de negocio clave

### Cuentas

- No hay mesas fijas — layout flexible, se abren cuentas con nombre o número libre
- Cualquier mesero puede tocar cualquier cuenta (sin asignación)
- Se pueden unir dos cuentas en una
- **Estados:** 🟢 Abierta | ✅ Cerrada
- Cuenta cerrada → inmutable, nadie puede editarla
- Reabrir cuenta cerrada → solo con PIN de admin
- Cerrar cuenta con $0 → pide confirmación y se elimina sin registrar

### Items y pedidos

- Tocar producto en grid → suma 1 unidad
- Tocar 🗑️ en lista → resta 1 unidad (si llega a 0 desaparece el item)
- Sin confirmación por item — flujo rápido

### Pagos

- Métodos: Efectivo, Transferencia, Tarjeta
- Pago por partes — se registran pagos parciales hasta cubrir el total
- No permite pago de más que el pendiente
- No existe concepto de vuelto
- Transferencia → foto de comprobante opcional
- Botón cerrar cuenta activo solo cuando pendiente = $0
- Pago registrado se puede eliminar (solo si cuenta está abierta)

### Descuentos

- Por item específico — monto fijo o porcentaje
- Por cuenta total — monto fijo o porcentaje
- Cualquiera puede aplicar descuentos (mesero o admin)

### Productos

- Campos: nombre, precio, foto (opcional), categoría, estado (activo/inactivo)
- Sin foto → ícono genérico
- Producto desactivado → oculto en vista del mesero
- Producto en cuenta abierta → no se puede eliminar
- Categorías → el admin puede crear y editar
- Eliminar categoría con productos → advertencia + confirmación → productos quedan sin categoría

### Reportes

- Reporte de ventas por noche (fecha de apertura del turno, no día calendario)
- Incluye cuentas abiertas y cerradas
- Desglose por método de pago
- Exportar en Excel
- Tocar cuenta en reporte → abre detalle (solo lectura si está cerrada)

---

## Pantallas

| #   | Pantalla                                        | Quién |
| --- | ----------------------------------------------- | ----- |
| 1   | Login / selector de modo                        | Todos |
| 2   | Lista de cuentas abiertas (modo Lista y Canvas) | Todos |
| 3   | Detalle de cuenta                               | Todos |
| 4   | Registrar pago                                  | Todos |
| 5   | Gestión de productos                            | Admin |
| 6   | Reporte de ventas                               | Admin |

---

## Convenciones de código

- **TypeScript estricto** en todo el proyecto (`strict: true`)
- **Tipos compartidos** en `packages/shared` — nunca duplicar tipos entre api y web
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `refactor:`
- **Sin comentarios obvios** — el código se documenta solo con nombres claros

### Frontend (Mobile-First UI)
- Todo el código UI debe adherirse a la skill `mobile-first-ui` (`.agent/skills/mobile-first-ui/SKILL.md`).
- **Mobile-First Estricto**: Las clases de Tailwind SIEMPRE se escriben para móvil primero. `md:` y `lg:` se usan solo para adaptar.
- **Touch-Friendly**: Botones GRANDES (min `h-12` o `p-4`), sin dependencias de `hover:`. Todo debe usarse cómodamente con los pulgares en una pantalla táctil apurado.
- **High Contrast**: Entorno oscuro de discoteca requiere fondos oscuros con colores semánticos vivos y alto contraste.

### Canvas (Drag & Shapes)
- Todo el código del canvas debe adherirse a la skill `canvas-tools` (`.agent/skills/canvas-tools/SKILL.md`).
- **Two-Layer Architecture**: Eventos en div sin transformar, render en div transformado.
- **Lock Mode**: Cuando `canvasLocked` está activo, bloquear TODO (drag, shapes, selection, tools).
- **Card Sizes**: S/M/L solo aplica a cuentas nuevas; existentes conservan su tamaño al crearse.

---

## Estado actual

### Completado
- ✅ Setup Monorepo (TypeScript, ESLint, Prettier, Husky, Docker)
- ✅ Gestión de cuentas (Shift, Account, CRUD, WebSockets)
- ✅ UI de cuentas (Dashboard Canvas, DragNode, persistencia localStorage)
- ✅ Productos y categorías (CRUD admin, ProductGrid, CategoryTabs)
- ✅ Items en cuentas (add/remove, lista, total computado)
- ✅ **Pagos** (Payment model, splits, close guard, modal UI, comprobante upload)

### Próximas features
- 🔲 Búsqueda de productos
- 🔲 Turnos y reportes (historial, ventas por noche, export Excel)
- 🔲 Auth y roles (login, permisos Admin/Mesero/Barman)
- 🔲 Modificadores de producto (hielo, doble, notas especiales)
- 🔲 Tests formales (vitest/jest)
- 🔲 PWA completa (Service Worker, offline sync)

---

## Pendiente

- Cuadre de caja — feature a definir en sesiones futuras
