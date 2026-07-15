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
| Base de datos   | PostgreSQL (dev: :5432, prod: :5433)    |
| ORM             | Prisma                                  |
| Frontend        | React + TypeScript + Vite + TailwindCSS |
| Offline/PWA     | Workbox (Service Worker)                |
| Infraestructura | Docker + Linux                          |
| Installer       | Inno Setup (.exe) + Task Scheduler      |

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

### Color System
- Todos los colores deben seguir la skill `color-system` (`.agent/skills/color-system/SKILL.md`).
- **Paleta centralizada**: Colores en `utils/colors.ts`, nunca hardcodear hex en componentes.
- **Botones**: Usar estándar de la skill (primary/secondary/danger/success).
- **Fondos**: `#0A0A0A` (page), `#141414` (cards), `#1E1E1E` (hover/inputs).

---

## Estado actual

### Completado
- ✅ Setup Monorepo (TypeScript, ESLint, Prettier, Husky, Docker)
- ✅ Gestión de cuentas (Shift, Account, CRUD, WebSockets)
- ✅ UI de cuentas (Dashboard Canvas, DragNode, persistencia localStorage)
- ✅ Productos y categorías (CRUD admin, ProductGrid, CategoryTabs)
- ✅ Items en cuentas (add/remove, lista, total computado)
- ✅ **Pagos** (Payment model, splits, close guard, modal UI, comprobante upload)
- ✅ **Descuentos** (por item y por cuenta, monto fijo o porcentaje)
- ✅ **Sistema de formas** (rectángulos, líneas, texto — drag, resize, rotate, color)
- ✅ **Canvas lock** (bloquea drag, shapes, selection, tools — persiste en localStorage)
- ✅ **Text formatting** (font family, size, bold, italic, underline, strikethrough, alignment — toolbar flotante)
- ✅ **Fotos de productos** (upload endpoint, admin UI, ProductGrid, order items — `utils/productPhoto.ts`)
- ✅ **Cards de productos** (square, full-bleed image, responsive 4-5-6 cols)
- ✅ **Reportes timezone fix** (fechas con offset de timezone local)
- ✅ **Canvas WebSocket** (posiciones y tamaños en tiempo real entre dispositivos)
- ✅ **Cloudflare Tunnel** (script start.ps1 con opción -Tunnel, Vite proxy para API)
- ✅ **Mobile touch fix** (TouchGuard bloquea ghost clicks después de navegar)
- ✅ **Canvas interaction fixes** (selection mode, pinch-to-zoom, toolbar, card tap navigation)
- ✅ **Visual standardization** (paleta centralizada en `utils/colors.ts`, todas las pantallas usan `tw` helpers)
- ✅ **Dev/prod database separation** (Docker Compose, `.env.develop`/`.env.production`, `config.ts` env loader)
- ✅ **switch-env.ps1** (entry point único para dev/prod con guardrails)
- ✅ **Production guardrails** (`scripts/migrate.js` bloquea `migrate dev`, `db push --force-reset`, `db seed` en producción)
- ✅ **CSV product import** (POST /products/import, multipart CSV + fotos, auto-create categorías, skip duplicados)
- ✅ **Free canvas card resize** (handles de esquina nw/ne/sw/se + handles de lado n/s/e/w, dimensiones custom por tarjeta)
- ✅ **Cross-device card sync** (WebSocket para posiciones + dimensiones, fetch inicial carga cardWidth/cardHeight)
- ✅ **Padlock icons** (candadoAbierto.png / candadoCerrado.png para bloquear/desbloquear tarjetas)
- ✅ **Search icon** (iconoLupa.png en dashboard)
- ✅ **Header responsive** (logo + selector de modo en sm, controles en segunda fila)
- ✅ **Canvas LEGO architecture** (composable hooks: useCanvasDrag, useCanvasResize, useCanvasRotate, ResizeHandles, utils/canvas/drag.ts)
- ✅ **Inno Setup installer** (build-production.ps1, barbaros-pos.iss, auto-start via Task Scheduler, Docker PostgreSQL)

### Próximas features
- 🔲 Auth y roles (login, permisos Admin/Mesero/Barman)
- 🔲 Modificadores de producto (hielo, doble, notas especiales)
- 🔲 Tests formales (vitest/jest)
- 🔲 PWA completa (Service Worker, offline sync)

### TODO
- 🔲 Cuenta cerrada no desaparece del canvas en otros dispositivos

---

## Gotchas

- **PowerShell**: nunca usar `&&`, usar `;` para encadenar comandos
- **Husky pre-commit**: roto (lint-staged ejecuta `tsc -b` en archivos individuales) — siempre usar `--no-verify`
- **No remote**: no hay origin configurado, solo commits locales
- **`__dirname` en routes**: en `routes/products/index.ts`, `__dirname` = `apps/api/src/routes/products`. Para llegar a `apps/api/uploads` se necesitan `../../../uploads`, NO `../../uploads`
- **Timezone en reportes**: `new Date("YYYY-MM-DD")` crea medianoche UTC, no local. El frontend debe enviar ISO con offset (`localDateToISO()`)
- **Text drag**: SIEMPRE usar `newX - shape.x` (posición actual), NUNCA `newX - origX` (stale) — previene drift
- **Shape rotation**: calcular ángulo con `getBoundingClientRect()` (screen coords), NO con coords del canvas (panOffset rompe el cálculo)
- **Pointer capture en rotation handle**: usar `e.currentTarget`, NO `e.target` — si no, los eventos van al icono ↻ que no tiene `onPointerMove`
- **Product photo URL**: SIEMPRE usar `productPhotoUrl()` de `utils/productPhoto.ts`, NUNCA concatenar `API_URL` manualmente
- **Text drag**: SIEMPRE usar `newX - shape.x` (posición actual), NUNCA `newX - origX` (stale) — previene drift
- **Selection mode**: Los botones del toolbar (S/M/L, cancelar, etc.) necesitan `data-toolbar` para que CanvasContainer no los trate como taps de fondo
- **Pinch-to-zoom**: Usar `_pinchThisGesture` flag que solo se limpia cuando `touches.length === 0` — sobrevive el gap entre touchend y pointerup
- **Long press vs pinch**: El timer de long press (400ms) puede dispararse después de iniciar pinch si ambas manos tocan en <400ms
- **Dev/prod DB**: `switch-env.ps1 develop` usa `barbaros_pos_dev` (:5432), `switch-env.ps1 production` usa `barbaros_pos_prod` (:5433). Nunca confundir ramas.
- **CSV import**: El parser detecta separador automáticamente (`,` o `;`). El CSV debe tener encoding UTF-8. Las fotos se suben junto al CSV en el mismo request multipart.
- **Canvas resize**: Al hacer resize, SIEMPRE guardar posición Y dimensiones en el backend. Si solo se guardan dimensiones, el otro dispositivo muestra la tarjeta en la posición vieja (norte se ve como sur).
- **`__dirname` en ES modules**: Usar `fileURLToPath(import.meta.url)` + `path.dirname()`. `__dirname` no existe en ES modules.
- **`dotenv` override**: Los archivos `.env.develop`/`.env.production` se cargan con `override: true` para que un `DATABASE_URL` stale del shell no pise la config correcta.
- **Multipart limits**: `@fastify/multipart` tiene límite por defecto de 1MB. Configurar `limits.fileSize` explícitamente (5MB para fotos/CSV).
- **Inno Setup**: El installer compila con ISCC.exe (Inno Setup Compiler). El build script `installer/build-production.ps1` ejecuta todo el pipeline. Requiere Node.js y Docker Desktop pre-instalados en la PC destino.
- **Docker port**: Producción usa :5433 para evitar conflicto con dev (:5432). Nunca confundir.

---

## Pendiente

- Cuadre de caja — feature a definir en sesiones futuras
