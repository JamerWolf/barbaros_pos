# Tasks: Gesti�n de Cuentas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350 - 450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (DB + API) -> PR 2 (Frontend) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB Schema, Shared Types y Fastify API | PR 1 | Base branch main. Cubre Prisma, endpoints de Shifts y Accounts, y tests de integracion. |
| 2 | Zustand Store y Socket reconnections | PR 2 | Base branch main (o la rama de PR 1). Cubre la integracion del frontend con la API y WebSockets. |

## Phase 1: Foundation (DB & Shared Types)

- [x] 1.1 Modificar apps/api/prisma/schema.prisma para agregar los modelos Shift, Account y el enum AccountStatus.
- [x] 1.2 Generar la migraci�n de Prisma.
- [x] 1.3 Crear packages/shared/src/types/account.ts exportando AccountStatus, IAccount e IShift.
- [x] 1.4 Actualizar packages/shared/src/events/socket.ts agregando los eventos account:created, account:updated y account:deleted en ServerToClientEvents.

## Phase 2: Core API Implementation (Shifts & Accounts)

- [x] 2.1 Crear rutas en apps/api/src/routes/shifts/index.ts para apertura manual (POST /shifts/open) y cierre (POST /shifts/close).
- [x] 2.2 Crear apps/api/src/services/account.service.ts implementando transacciones Prisma Serializable que calculen el MAX(number) + 1 usando el shiftId activo.
- [x] 2.3 Crear apps/api/src/routes/accounts/index.ts exponiendo POST /accounts.
- [x] 2.4 Agregar en apps/api/src/routes/accounts/index.ts el endpoint PUT /accounts/:id/close implementando el borrado fisico si el total es $0 y emitiendo los eventos correspondientes por Socket.io.

## Phase 3: Frontend Integration

- [x] 3.1 Crear apps/frontend/src/store/accountStore.ts usando Zustand para manejar el estado en memoria como Record<string, IAccount>.
- [x] 3.2 Crear apps/frontend/src/hooks/useAccountSockets.ts para suscribirse a los eventos socket e integrarlo con Zustand, incluyendo el refetch completo via GET /accounts en el evento connect.

## Phase 4: Testing & Verification

- [x] 4.1 Escribir test de integracion verificando que 10 llamadas concurrentes a POST /accounts no generen colisiones de number.
- [x] 4.2 Escribir test validando que cerrar una cuenta con saldo $0 realiza un DELETE fisico en la DB.
- [x] 4.3 Escribir test de la store de Zustand verificando que los borrados y actualizaciones manejan correctamente el diccionario Record<string, IAccount>.
