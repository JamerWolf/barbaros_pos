# Proposal: Payments Feature

## Intent

The POS system tracks accounts and orders but has NO payment recording. When an account is closed, money is either deleted ($0 accounts) or status-flipped to CLOSED — but no payment transaction is ever stored. There's no way to know what was paid, how, or when. This breaks shift reports (`totalPaid`, `paymentsByMethod`, `pendingAmount`) and makes cash reconciliation impossible.

**We need a Payment model that records every payment against an account, supports splits (multiple payments per account), enforces no-overpayment, and blocks closing until pending = $0.**

## Scope

### In Scope
- Prisma `Payment` model linked to Account
- `PaymentService` with create/list operations
- API routes: `POST /accounts/:id/payments`, `GET /accounts/:id/payments`
- Pending amount calculation: `total - SUM(payments.amount)`
- Close flow guard: reject close if `pending > 0`
- Close flow for $0 accounts: unchanged (physical delete)
- Frontend: payment modal in AccountDetailPage (select method, enter amount, optional proof photo for transfers)
- WebSocket events: `payment:created`, `account:updated` (with updated pending)
- Account response includes `pendingAmount` alongside `total`

### Out of Scope
- Payment refunds / void / reversal
- Cash drawer integration
- Receipt generation
- Multi-currency
- Split payment UI with add/remove rows (first version: single payment per modal open, repeat as needed)

## Capabilities

### New Capabilities
- `payments-core`: Prisma model, PaymentService, API endpoints, pending calculation
- `payments-ui`: Payment modal, method selector, amount input, proof upload, pending display

### Modified Capabilities
- `accounts-core`: Close flow must check pending = $0 before closing. Account response includes `pendingAmount`.

## Approach

**Payment model**: `Payment { id, accountId, amount, method, proofUrl?, createdAt }`. Amount is `Decimal(10,2)`. Method is enum: `CASH | TRANSFER | CARD`.

**Splits**: Multiple Payment records per account. `pendingAmount = total - SUM(payments.amount)`. No foreign key constraint on sum — validation is application-level.

**Close flow change**: `AccountService.closeAccount()` computes `pendingAmount`. If `pendingAmount > 0`, throw error. If `pendingAmount === 0` and `total === 0`, delete. If `pendingAmount === 0` and `total > 0`, set status to CLOSED.

**UI**: Payment modal triggered from AccountDetailPage. Shows current total, pending amount, existing payments list. Form: method selector (3 buttons), amount input (defaults to pending), optional proof photo for transfers. Submit creates payment, recalculates pending. Close button becomes active only when `pending === 0`.

**Proof photo**: Upload to a `/uploads/` static directory, store URL in `proofUrl`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modified | Add Payment model, PaymentMethod enum |
| `apps/api/src/services/payment.service.ts` | New | PaymentService with create/list/getPendingAmount |
| `apps/api/src/services/account.service.ts` | Modified | closeAccount checks pending, getAccountWithItems returns pendingAmount |
| `apps/api/src/routes/accounts/index.ts` | Modified | Add payment sub-routes, update close response |
| `apps/api/src/routes/payments/index.ts` | New | Standalone payment routes (if needed for reports) |
| `packages/shared/src/types/payment.ts` | Modified | Align with Prisma schema, add DTOs |
| `packages/shared/src/types/account.ts` | Modified | Add pendingAmount to AccountWithTotal |
| `apps/web/src/pages/AccountDetailPage.tsx` | Modified | Add payment modal, pending display, conditional close |
| `apps/web/src/components/Payment/PaymentModal.tsx` | New | Payment form modal |
| `apps/web/src/store/accountStore.ts` | Modified | Handle pendingAmount in state |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition: two payments submitted simultaneously exceed pending | Medium | Use Prisma transaction with serializable isolation on payment create |
| Proof photo upload abuse (large files, wrong types) | Low | Validate file type (jpg/png/webp), limit size (5MB), store in isolated directory |
| Existing accounts have no payments — pending = total | Low | Migration: no data change needed; pending is computed, not stored |
| WebSocket storm on rapid payments | Low | Debounce broadcasts, single event per payment create |

## Rollback Plan

1. Remove Payment model from schema, run `prisma migrate reset` (dev) or revert migration (prod)
2. Revert `AccountService.closeAccount()` to original logic
3. Remove payment routes and UI components
4. No data loss risk: payments table is new, no existing data depends on it

## Dependencies

- Prisma client generation after schema change
- Upload directory exists (`apps/api/uploads/`) — create if missing
- No external service dependencies

## Success Criteria

- [ ] `POST /accounts/:id/payments` creates payment, returns updated account with pendingAmount
- [ ] `GET /accounts/:id/payments` lists payments for account
- [ ] `PUT /accounts/:id/close` rejects if pendingAmount > 0
- [ ] `PUT /accounts/:id/close` succeeds when pendingAmount = 0 (and status → CLOSED or deleted if $0)
- [ ] Multiple payments per account work (splits)
- [ ] Transfer payment with proof photo uploads and stores URL
- [ ] Frontend shows pending amount, payment modal, and close button only when pending = 0
- [ ] WebSocket broadcasts payment:created to all clients
- [ ] Overpayment rejected (amount > pending returns 400)
- [ ] No change/vuelto — amount cannot exceed pending
