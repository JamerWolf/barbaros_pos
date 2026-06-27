# Design: Discounts

## Technical Approach

Add a `DiscountType` enum and discount fields to the Prisma schema (OrderItem + Account), create a centralized `calculateAccountTotal()` in `packages/shared` used by all services and routes, add two PATCH endpoints for item-level and account-level discounts, extend PaymentModal with a collapsible discount section, and broadcast via WebSocket on discount changes.

The key insight from the codebase: total calculation is currently duplicated **five times** (AccountService.getAccountWithItems, AccountService.closeAccount, AccountService.listItems, PaymentService.createPayment, PaymentService.getPendingAmount, and the route handler inline at line 53). The centralized calculator eliminates all duplication.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Centralized calc in shared vs per-service inline | Shared eliminates drift (5 existing duplication sites); slight import overhead | **shared** — eliminates the core risk identified in proposal |
| DiscountType as Prisma enum vs string field | Enum provides DB-level validation; string is more flexible but riskier | **Prisma enum** — matches existing pattern (AccountStatus, PaymentMethod) |
| One PATCH endpoint with scope param vs two separate endpoints | Single endpoint reduces routes; two endpoints have clearer semantics and simpler validation | **Two endpoints** — `/:id/discount` and `/:id/items/:itemId/discount` — aligns with REST conventions and keeps validation isolated |
| Collapsible section vs separate screen | Separate screen adds navigation; collapsible keeps payment flow linear | **Collapsible** — keeps modal self-contained, matches proposal |

## Data Flow

```
User taps "Apply Discount" in PaymentModal
  → Selects type (FIXED/PERCENT) + enters value
  → Live preview calls calculateAccountTotal() locally
  → User taps "Apply"
  → PATCH /accounts/:id/discount or /:id/items/:itemId/discount
    → Service validates (open account, valid params)
    → Prisma updates discountType + discountValue on Account or OrderItem
    → Service calls calculateAccountTotal() to recompute total
    → Broadcasts discount:updated via WebSocket
    → Returns updated account with recalculated total + pendingAmount
  → PaymentModal receives response, updates local state
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modify | Add `DiscountType` enum; add `discountType` + `discountValue` to Account and OrderItem models |
| `packages/shared/src/types/discount.ts` | Create | `DiscountType` enum, `DiscountResult` interface, `calculateAccountTotal()` function |
| `packages/shared/src/types/account.ts` | Modify | Add `discountType` + `discountValue` to `IAccount` |
| `packages/shared/src/types/order-item.ts` | Modify | Add `discountType` + `discountValue` to `IOrderItem` |
| `packages/shared/src/events/socket.ts` | Modify | Add `discount:updated` to `ServerToClientEvents` |
| `packages/shared/src/index.ts` | Modify | Export new discount types |
| `apps/api/src/services/account.service.ts` | Modify | Replace inline total calcs with `calculateAccountTotal()`; add `setItemDiscount()` and `setAccountDiscount()` methods |
| `apps/api/src/services/payment.service.ts` | Modify | Replace inline total calc with `calculateAccountTotal()` in `createPayment` and `getPendingAmount` |
| `apps/api/src/routes/accounts/index.ts` | Modify | Add `PATCH /:id/discount` and `PATCH /:id/items/:itemId/discount` endpoints; replace inline total calc at line 53 |
| `apps/web/src/components/Payment/PaymentModal.tsx` | Modify | Add collapsible discount section with type selector, value input, live preview, and Apply button |

## Interfaces / Contracts

### New shared type: `packages/shared/src/types/discount.ts`

```typescript
export enum DiscountType {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

export interface DiscountResult {
  subtotal: number;          // SUM(qty * unitPrice)
  itemDiscounts: number;     // SUM of per-item discount amounts
  afterItemDiscounts: number; // subtotal - itemDiscounts
  accountDiscount: number;    // discount applied to afterItemDiscounts
  total: number;              // afterItemDiscounts - accountDiscount
}

export interface CalculateAccountTotalInput {
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountType: DiscountType;
    discountValue: number;
  }>;
  accountDiscountType: DiscountType;
  accountDiscountValue: number;
}

export function calculateAccountTotal(input: CalculateAccountTotalInput): DiscountResult
```

### Calculation formula

```
subtotal = SUM(item.quantity * item.unitPrice)
itemDiscounts = SUM(per-item discount)
  per-item: FIXED → item.discountValue
            PERCENT → item.unitPrice * item.quantity * item.discountValue / 100
afterItemDiscounts = subtotal - itemDiscounts
accountDiscount = accountDiscountType === FIXED
  ? accountDiscountValue
  : afterItemDiscounts * accountDiscountValue / 100
total = afterItemDiscounts - accountDiscount
```

### API contracts

**PATCH /accounts/:id/discount**
```json
// Request
{ "discountType": "FIXED" | "PERCENT" | "NONE", "discountValue": number }

// Response 200
{ "account": IAccount, "total": number, "pendingAmount": number }

// Response 400
{ "error": "Account is closed" | "Invalid discount type" | "Value out of range" }
```

**PATCH /accounts/:id/items/:itemId/discount**
```json
// Request
{ "discountType": "FIXED" | "PERCENT" | "NONE", "discountValue": number }

// Response 200
{ "account": IAccount, "total": number, "pendingAmount": number }

// Response 400
{ "error": "Account is closed" | "Item not found" | "Invalid discount type" | "Value out of range" }
```

### Validation rules (both endpoints)

- Account must be OPEN (status !== 'CLOSED')
- `discountType` must be one of `NONE`, `FIXED`, `PERCENT`
- `discountValue` must be ≥ 0
- For `PERCENT`: `discountValue` ≤ 100
- For `NONE`: `discountValue` is forced to 0

### WebSocket event

```typescript
'discount:updated': (payload: {
  accountId: string;
  total: number;
  pendingAmount: number;
  account: IAccount;
}) => void
```

### Modified shared types

```typescript
// IAccount — add:
discountType: DiscountType;
discountValue: number;

// IOrderItem — add:
discountType: DiscountType;
discountValue: number;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `calculateAccountTotal()` with all 5 spec scenarios | Pure function, no mocks — test directly in shared |
| Integration | PATCH endpoints validate discount params, reject closed accounts | Fastify inject + Prisma test DB |
| Integration | PaymentService pendingAmount uses discounted total | Mock Prisma, verify calculation chain |
| E2E | Apply discount → modal shows updated total → pending updates | Playwright on PaymentModal |

## Migration / Rollout

No data migration needed. New fields have safe defaults (`NONE` and `0`), so existing rows remain valid. Prisma migration will add nullable columns then set defaults.

Order of operations:
1. Prisma schema + migration (add enum + columns with defaults)
2. Shared calculator (pure function, no dependencies)
3. Shared types update (add fields to IAccount, IOrderItem)
4. API services (swap inline calcs → calculator, add discount methods)
5. API routes (add PATCH endpoints, fix inline calc)
6. Frontend (PaymentModal discount section)
7. WebSocket event type update

## Open Questions

- None — all requirements are well-defined across the 4 specs.
