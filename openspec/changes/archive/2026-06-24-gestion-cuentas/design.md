# Design: Gestión de Cuentas

## Technical Approach

Implementar un modelo transaccional donde las mutaciones de `Account` se realizan a través de Fastify REST. La persistencia usa Prisma, asociando cada cuenta a un `Shift` (Turno) activo para controlar el `number` consecutivo. Tras cada mutación exitosa en DB, el handler de la API emite eventos por Socket.io. En el frontend, Zustand mantiene un diccionario en memoria, actualizándose con los eventos y realizando un refetch completo al reconectarse el socket.

## Architecture Decisions

### Decision: Schema Prisma `Account`
**Choice**: `id` como `String @default(uuid())`, y `number` como `Int` autocalculado por turno.
**Alternatives considered**: Usar un entero autoincremental global como ID, o un string secuencial.
**Rationale**: `UUID` previene enumeración de IDs en la API. El `number` es un identificador visual ("Cuenta #45") para los mozos/staff y debe ser relativo a la noche en curso, no global.

### Decision: Secuencia por turno (Reseteo del `number`)
**Choice**: Modelo `Shift` (Turno) explícito. Cada `Account` pertenece al `Shift` activo. El `number` se asigna calculando `MAX(number) + 1` para el `shiftId` actual dentro de una transacción `Serializable` en Prisma.
**Alternatives considered**: Tabla genérica `Sequence`, o resetear una secuencia Postgres con cron jobs.
**Rationale**: La jornada de una discoteca cruza la medianoche (ej: 22:00 a 06:00). Un `Shift` manejado manualmente encapsula la jornada sin depender de cambios de fecha. `MAX(number) + 1` concurrente dentro de la misma transacción previene colisiones.

### Decision: Apertura y cierre manual de Turnos (Shift)
**Choice**: Endpoints REST manuales `POST /shifts/open` y `POST /shifts/close`, operados exclusivamente por el rol Admin.
**Alternatives considered**: Apertura automática con la primera cuenta de la noche.
**Rationale**: Una discoteca tiene jornadas atípicas. El control manual provee robustez para garantizar que no haya transiciones de turno accidentales. La API verificará que no haya más de un `Shift` en estado `OPEN` a la vez.
**Choice**: Modelo `Shift` (Turno) explícito. Cada `Account` pertenece al `Shift` activo. El `number` se asigna calculando `MAX(number) + 1` para el `shiftId` actual dentro de una transacción `Serializable` en Prisma.
**Alternatives considered**: Tabla genérica `Sequence`, o resetear una secuencia Postgres con cron jobs.
**Rationale**: La jornada de una discoteca cruza la medianoche (ej: 22:00 a 06:00). Un `Shift` manejado manualmente encapsula la jornada sin depender de cambios de fecha. `MAX(number) + 1` concurrente dentro de la misma transacción previene colisiones.

### Decision: API Routing
**Choice**: Rutas REST en Fastify (`POST /accounts`, `PUT /accounts/:id/close`, `POST /accounts/merge`).
**Alternatives considered**: TRPC o GraphQL.
**Rationale**: Simplicidad y adherencia a la propuesta. Fácil de testear con HTTP clients estándar.

### Decision: Emisión Socket.io
**Choice**: Emisión manual de eventos (`account:created`, `account:updated`, `account:deleted`) desde los handlers de Fastify, después del `await prisma.$transaction`.
**Alternatives considered**: Prisma Middleware o Prisma Extensions.
**Rationale**: Emitir eventos a nivel de DB (Prisma Middleware) es riesgoso porque la transacción de Fastify podría fallar post-query pero el evento ya se emitió. Emitir en el handler asegura consistencia con el retorno HTTP.

### Decision: Frontend Store
**Choice**: `useAccountStore` en Zustand con un diccionario `Record<string, Account>` (llave = ID de cuenta).
**Alternatives considered**: Array de cuentas o delegar estado a React Query/SWR.
**Rationale**: Un `Record` permite actualizaciones y borrados O(1) cuando llega un evento socket. Zustand es ligero y recomendado en la propuesta.

## Data Flow

    [Frontend Zustand] <──(Socket.io events)──┐
          │                                   │
       (REST API)                             │
          ▼                                   │
    [Fastify Handler] ────(Prisma TX)───> [PostgreSQL]

1. UI llama a `POST /accounts`.
2. Fastify abre TX: obtiene `Shift` activo, calcula `number`, inserta `Account`, cierra TX.
3. Fastify emite evento Socket `account:created`.
4. El hook de Sockets en UI intercepta y actualiza el Zustand store en O(1).
5. Si UI pierde conexión y reconecta, emite `GET /accounts` para reconciliar estado.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modify | Agregar modelo `Shift`, `Account` y enums de estado. |
| `packages/shared/src/types/account.ts` | Create | Interfaces `IAccount`, `IShift`, status enums. |
| `packages/shared/src/events/socket.ts` | Modify | Definir payloads `AccountCreatedEvent`, etc. |
| `apps/api/src/routes/accounts/index.ts` | Create | Endpoints REST (`POST`, `PUT`, `GET`). |
| `apps/api/src/services/account.service.ts` | Create | Lógica de negocio (MAX+1 y transacciones). |
| `apps/frontend/src/store/accountStore.ts` | Create | Zustand store con `accounts: Record<string, IAccount>`. |
| `apps/frontend/src/hooks/useAccountSockets.ts` | Create | Hook para bind de eventos y sync en reconexión. |

## Interfaces / Contracts

```typescript
// packages/shared/src/types/account.ts
export type AccountStatus = 'OPEN' | 'CLOSED';

export interface IAccount {
  id: string;
  shiftId: string;
  number: number;
  name: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

// packages/shared/src/events/socket.ts
export interface ServerToClientEvents {
  'account:created': (account: IAccount) => void;
  'account:updated': (account: IAccount) => void;
  'account:deleted': (accountId: string) => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zustand Store | Testear que los actions actualizan el dict `Record<string, Account>`. |
| Integration | Concurrencia Account Number | Ejecutar 10 `POST /accounts` en paralelo usando `Promise.all` y verificar que no hay colisiones de `number`. |
| Integration | Borrado físico en $0 | Crear cuenta, cerrarla con total $0, verificar que ya no existe en la DB. |

## Migration / Rollout

No migration required for existing data, ya que actualmente solo hay un `AccountPlaceholder`. Se requerirá un script o endpoint para iniciar el primer `Shift` antes de operar.

## Open Questions

- [x] ¿Quién abre el `Shift` al inicio de la noche? → Resuelto: El Admin lo hace manualmente (apertura y cierre).