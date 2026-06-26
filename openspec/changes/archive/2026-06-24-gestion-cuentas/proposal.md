# Proposal: Gestión de Cuentas

## Intent
Implementar un sistema concurrente y en tiempo real para gestionar cuentas de clientes con sincronización de estado entre clientes web y el servidor, previniendo condiciones de carrera.

## Scope
### In Scope
- Modelo de base de datos `Account` (Prisma) con estado `OPEN`/`CLOSED`.
- Endpoints REST para mutaciones (crear, modificar, cerrar, unir).
- Generación de `number` consecutivo visual (ej: "Cuenta #45") que se resetea a 1 cada "noche" (por turno/fecha de apertura).
- Sincronización de estado frontend (Zustand) vía WebSockets (Socket.io).
- Refetch completo en eventos de reconexión del socket.
- Lógica de borrado físico de cuentas en DB si se cierran con saldo $0.

### Out of Scope
- Gestión de ítems y detalle de pedidos.
- Facturación electrónica y medios de pago.

## Capabilities
### New Capabilities
- `accounts-core`: Lógica de negocio y persistencia para cuentas.
- `accounts-realtime`: Sincronización vía WebSockets y manejo de reconexiones en UI.

### Modified Capabilities
None

## Approach
Implementar mutaciones transaccionales en DB vía Fastify REST. Emitir eventos por Socket.io tras cada mutación exitosa. El frontend (Zustand) actualizará el estado local en memoria, y realizará un `GET /accounts` en el evento `connect` para recuperarse de desconexiones. Cerrar en $0 realiza `DELETE` en DB, sino actualiza a `CLOSED`.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | Modelo `Account` (id UUID, number consecutivo por noche, name, status) |
| `src/routes/accounts` | New | Endpoints REST (Fastify) |
| `src/websockets` | Modified | Emisión de eventos de cuentas (Socket.io) |
| `frontend/store/accountStore` | New | Estado local en memoria (Zustand) |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pérdida de eventos socket | Medium | Refetch `GET /accounts` en evento `connect` |
| Mutar cuenta cerrada | Low | Validaciones transaccionales en la DB |

## Rollback Plan
Revertir commits de DB/rutas y limpiar migraciones (`prisma migrate resolve --rolled-back`).

## Dependencies
- Prisma, Fastify, Socket.io, Zustand

## Success Criteria
- [ ] Modificar cuenta `CLOSED` retorna error seguro.
- [ ] Cerrar cuenta en $0 elimina el registro físicamente.
- [ ] Al reconectar el socket, el frontend sincroniza estado sin datos perdidos.