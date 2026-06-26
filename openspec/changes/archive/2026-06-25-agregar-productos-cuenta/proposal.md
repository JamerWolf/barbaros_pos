# Proposal: agregar-productos-cuenta

## Intent

The POS system tracks accounts per shift but has NO product catalog or order items. AccountDetailPage explicitly says "Los ítems y pagos se agregarán en próximas fases" with a hardcoded `$0.00`. We need to add products and order items so accounts reflect what customers actually consume.

## Scope

### In Scope
- Prisma models: `Category`, `Product`, `OrderItem`
- Shared types: `OrderItem` interface, update `IAccount` to include items relation
- API: CRUD for products, add/remove/update items on accounts, compute total from items
- Frontend: Product selector, order item list, running total on AccountDetailPage
- WebSocket: propagate item changes via `account:updated`
- Account total computed from OrderItems (replace hardcoded `$0.00`)

### Out of Scope
- Payment processing (separate phase)
- Product image upload (photoUrl exists but upload deferred)
- Inventory/stock tracking
- Product modifiers or variants
- Multi-currency

## Capabilities

### New Capabilities
- `product-catalog`: Category and Product CRUD — admin management of what's sellable
- `order-items`: Adding, updating, removing items on an account; quantity, price snapshot, line totals

### Modified Capabilities
- `accounts-core`: Account total now computed from OrderItems, not manual param. Close behavior unchanged ($0 → delete, >$0 → CLOSED)
- `account-detail-ui`: Replace placeholder with product selector, item list, running total

## Approach

1. **Schema**: Add `Category`, `Product`, `OrderItem` models. `OrderItem` references `Account` (cascade delete). Price snapshot on item creation.
2. **API**: `POST/GET/PUT/DELETE /accounts/:id/items` — add item (with productId, qty), update qty, remove item. `GET/POST/PUT/DELETE /products` and `/categories` for admin.
3. **Frontend**: Extend `accountStore` with items. Product selector component (searchable grid by category). Item list with +/- qty and remove. Total computed client-side, confirmed server-side on close.
4. **Real-time**: `account:updated` already broadcasts; include items in payload.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modified | Add Category, Product, OrderItem models |
| `apps/api/src/services/account.service.ts` | Modified | Add item methods, compute total from items |
| `apps/api/src/routes/accounts/index.ts` | Modified | Add `/accounts/:id/items` endpoints |
| `apps/api/src/routes/` | New | `products/index.ts`, `categories/index.ts` |
| `apps/web/src/pages/AccountDetailPage.tsx` | Modified | Replace placeholder with real UI |
| `apps/web/src/store/accountStore.ts` | Modified | Hold order items per account |
| `packages/shared/src/types/` | Modified | Add OrderItem, update IAccount |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Price drift: product price changes after item added | Med | Snapshot price on OrderItem creation |
| Race condition on concurrent item adds | Low | Prisma transactions; optimistic UI |
| Migration data loss | Low | New tables only, no ALTER on existing |

## Rollback Plan

1. Revert Prisma migration (`prisma migrate reset` on dev)
2. Revert shared types to pre-change state
3. Revert API routes and service methods
4. Revert AccountDetailPage to placeholder
5. No production data risk — this is dev-phase only

## Dependencies

- Existing Prisma client setup (`apps/api/src/db/prisma.ts`)
- Existing WebSocket broadcast helper (`emitSocketEvent`)
- Existing shared types package structure

## Success Criteria

- [ ] `Category` and `Product` models exist in Prisma with seed data
- [ ] `OrderItem` model links products to accounts with quantity and price snapshot
- [ ] API endpoints allow full CRUD on products and items
- [ ] AccountDetailPage shows product selector and item list
- [ ] Account total computed from items, not hardcoded
- [ ] WebSocket broadcasts item changes in real-time
- [ ] Close account still works: $0 balance → delete, >$0 → CLOSED
