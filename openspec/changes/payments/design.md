# Design: Payments Feature

## Technical Approach

Add a `Payment` model to Prisma with a `PaymentMethod` enum. Wire `PaymentService` (static methods, following existing pattern) to handle create/list/getPendingAmount. Modify `AccountService.closeAccount()` to enforce pending = $0. Add payment sub-routes under `/accounts/:id/payments`. Frontend: `PaymentModal` component in `AccountDetailPage`, store `pendingAmount` in account state, handle `payment:created` WebSocket event.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Payment amount storage | Decimal(10,2) on Prisma model, computed pending | Store pendingAmount on Account | Pending is derived; storing creates sync bugs. Computation is cheap (single SUM query). |
| Overpayment guard | Application-level check in transaction | Database CHECK constraint | Prisma doesn't support CHECK well; transaction with serializable isolation is the existing pattern (see `createAccount`). |
| Close flow | Reject if pending > 0, delete if total === 0 | Soft-delete always | $0 accounts (no items) should still be deletable — current behavior preserved. |
| Proof upload | Static file in `/uploads/` | S3 or external service | MVP scope — no external deps. Add size/type validation at route level. |
| WebSocket event | `payment:created` payload includes updated account | Separate `payment:created` + `account:updated` | Single event avoids race; account data already computed in create flow. |

## Data Flow

### Payment Create

```
Client ──POST /accounts/:id/payments──→ Route
  │
  ├─→ PaymentService.createPayment()
  │     ├─→ prisma.$transaction (serializable)
  │     │     ├─→ Fetch account + orderItems → compute total
  │     │     ├─→ SUM(payments.amount) → existing paid
  │     │     ├─→ Validate: amount <= (total - existingPaid)
  │     │     └─→ prisma.payment.create()
  │     └─→ Return { payment, pendingAmount }
  │
  ├─→ emitSocketEvent('payment:created', { account, payment, pendingAmount })
  └─→ Reply 201 { payment, pendingAmount, account }
```

### Close Account (modified)

```
PUT /accounts/:id/close
  │
  ├─→ AccountService.closeAccount()
  │     ├─→ Fetch account + orderItems + payments
  │     ├─→ Compute total, paidSum, pendingAmount
  │     ├─→ IF pendingAmount > 0 → throw Error
  │     ├─→ IF total === 0 → delete account
  │     └─→ ELSE → update status CLOSED
  └─→ Reply (204 deleted | 200 closed | 400 pending)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modify | Add `PaymentMethod` enum, `Payment` model with `accountId` FK |
| `apps/api/src/services/payment.service.ts` | Create | `PaymentService`: `createPayment`, `listPayments`, `getPendingAmount` |
| `apps/api/src/services/account.service.ts` | Modify | `closeAccount`: check pending before close; `getAccountWithItems`: return `pendingAmount` |
| `apps/api/src/routes/accounts/index.ts` | Modify | Add `/:id/payments` GET/POST sub-routes |
| `apps/api/src/app.ts` | Modify | Register static `/uploads` serve |
| `packages/shared/src/types/payment.ts` | Modify | Align `PaymentMethod` enum casing with Prisma (`CASH` etc.), add DTO types |
| `packages/shared/src/types/account.ts` | Modify | Add `pendingAmount?: number` to `IAccount` |
| `apps/web/src/pages/AccountDetailPage.tsx` | Modify | Add `pendingAmount` display, `PaymentModal` toggle, conditional close button |
| `apps/web/src/components/Payment/PaymentModal.tsx` | Create | Modal: method selector, amount input, proof upload, submit |
| `apps/web/src/store/accountStore.ts` | Modify | `AccountWithItems` includes `pendingAmount`; `updateAccount` handles it |
| `apps/web/src/hooks/useAccountSockets.ts` | Modify | Handle `payment:created` event → update account in store |

## Interfaces / Contracts

```typescript
// packages/shared/src/types/payment.ts
export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
}

export interface Payment {
  id: string
  accountId: string
  amount: number          // Decimal(10,2)
  method: PaymentMethod
  proofUrl?: string
  createdAt: Date
}

// API response shape
export interface PaymentCreateResponse {
  payment: Payment
  pendingAmount: number
  account: AccountWithTotal  // account with total + pendingAmount
}

// packages/shared/src/types/account.ts (addition)
export interface IAccount {
  // ... existing fields
  pendingAmount?: number
}

// API: POST /accounts/:id/payments
// Request: { amount: number, method: PaymentMethod, proofUrl?: string }
// Response: PaymentCreateResponse | { error: string }

// API: GET /accounts/:id/payments
// Response: Payment[]
```

### Concurrency Handling

`PaymentService.createPayment` uses `prisma.$transaction` with `isolationLevel: 'Serializable'`. Inside the transaction:
1. SELECT account + orderItems → compute `total`
2. SELECT SUM(amount) WHERE accountId = X → compute `existingPaid`
3. Validate `amount <= total - existingPaid`
4. INSERT payment
5. COMMIT

Serializable isolation prevents two concurrent payments from both seeing the same `existingPaid` and both succeeding.

## Migration Strategy

- Prisma migration: add `PaymentMethod` enum and `payments` table with FK to `accounts`
- No data migration: existing accounts have no payments → `pendingAmount = total` (computed)
- Upload directory: create `apps/api/uploads/` if missing, add to `.gitignore`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `PaymentService.getPendingAmount` | Mock prisma, verify SUM logic |
| Unit | `AccountService.closeAccount` with payments | Mock prisma, verify pending guard |
| Integration | POST /accounts/:id/payments (valid, overpayment, invalid account) | Supertest against test DB |
| Integration | Close with pending > 0 → 400 | Supertest |
| Integration | Close with pending = 0 → success | Supertest |
| E2E | Create payment → modal shows updated pending → close button enables | Playwright (if available) |

## Open Questions

- [ ] Proof photo: store as file path only, or also serve via static route? (Current plan: serve via `/uploads/`)
- [ ] Should `GET /accounts/:id` include payments array in response, or only via dedicated endpoint? (Current plan: dedicated endpoint)
