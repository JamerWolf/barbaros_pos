## Exploration: gestion-cuentas

### Current State
El sistema actualmente no tiene gestión de cuentas implementada. Se requiere un sistema flexible donde las cuentas (mesas/grupos) no estén atadas a un layout fijo, permitiendo nombres libres y acceso concurrente sin asignación estricta de meseros. 

### Affected Areas
- `packages/db/prisma/schema.prisma` — Creación del modelo `Account` y enums relacionados.
- `packages/backend/src/modules/accounts` — Controladores, servicios y rutas REST.
- `packages/backend/src/gateways/socket` — Emisión de eventos de Socket.io para sincronización.
- `packages/frontend/src/store/useAccountStore.ts` — Estado global con Zustand.
- `packages/frontend/src/hooks/useSocket.ts` — Suscripción a eventos de socket.
- `packages/shared/src/types` — Definición de tipos compartidos (ej. `AccountDTO`, `AccountState`).

### Approaches

#### 1. Mutaciones por REST + Broadcast por WebSockets (Recomendado)
- **Descripción:** El cliente hace peticiones HTTP (POST, PATCH) para mutar. El backend actualiza la DB y emite un evento Socket.io (`account:created`, `account:updated`) a todas las tablets.
- **Pros:** 
  - Manejo de errores HTTP estándar.
  - Tipado fácil con Fastify.
  - Desacoplamiento de la mutación y la sincronización.
- **Cons:** 
  - Requiere manejar dos protocolos en el cliente (fetch/axios para mutar, socket para escuchar).
- **Effort:** Medium

#### 2. Mutaciones 100% WebSockets (Socket.io Acknowledgements)
- **Descripción:** El cliente emite eventos socket para mutar (ej. `socket.emit('createAccount', data, (res) => {})`) y el server hace el broadcast interno.
- **Pros:** 
  - Un solo protocolo y conexión para todo.
  - Ligeramente menor latencia.
- **Cons:** 
  - El enrutamiento y validación de tipos es más verboso sin Fastify.
  - Menor compatibilidad con herramientas estándar (Postman, Swagger).
- **Effort:** Medium

#### Modelo de Datos (Prisma) propuesto
```prisma
enum AccountState {
  OPEN
  CLOSED
}

model Account {
  id        String       @id @default(uuid())
  name      String       // Ej: "Mesa VIP", "Cuenta #4"
  state     AccountState @default(OPEN)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  // Relaciones futuras:
  // items   Item[]
  // payments Payment[]
}
```

#### Frontend State (Zustand)
```typescript
interface AccountStore {
  accounts: Record<string, Account>;
  addOrUpdateAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  // ...
}
```

### Recommendation
**Mutaciones REST + Sincronización WebSocket.**  
Usar Prisma para persistir la tabla `Account`. Crear los endpoints en Fastify para crear, renombrar, cerrar, y fusionar. En cada éxito de servicio, inyectar el Socket.io server para emitir el evento a todos los clientes conectados. En el frontend, Zustand mantendrá un `Record<string, Account>` actualizado pasivamente por los listeners del socket. Para las cuentas de $0, confirmar en el frontend y usar un endpoint `DELETE /accounts/:id` explícito que emita `account:deleted`.

### Risks
- **Condición de carrera al fusionar:** Dos meseros intentando cobrar/fusionar la misma cuenta al mismo tiempo. Requiere transacciones en Prisma y validación de estado.
- **Desconexión del WebSocket:** Si el socket se cae, el frontend puede quedar desincronizado. Requiere un refetch completo (GET /accounts/open) al reconectar el socket.

### Ready for Proposal
Yes