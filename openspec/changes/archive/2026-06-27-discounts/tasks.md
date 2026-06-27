# Tasks: Discounts

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~315 (additions + deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Schema & Shared Types

- [x] 1.1 Add `DiscountType` enum to `apps/api/prisma/schema.prisma` (NONE, FIXED, PERCENT)
- [x] 1.2 Add `discountType` + `discountValue` fields to `Account` and `OrderItem` models with defaults (NONE, 0)
- [x] 1.3 Run `prisma migrate dev` to generate migration
- [x] 1.4 Add `discountType` + `discountValue` to `IAccount` in `packages/shared/src/types/account.ts`
- [x] 1.5 Add `discountType` + `discountValue` to `IOrderItem` in `packages/shared/src/types/order-item.ts`

## Phase 2: Centralized Calculator

- [x] 2.1 Create `packages/shared/src/types/discount.ts` with `DiscountType` enum, `DiscountResult`, `CalculateAccountTotalInput` interfaces
- [x] 2.2 Implement `calculateAccountTotal()` pure function with formula: subtotal → item discounts → afterItemDiscounts → account discount → total
- [x] 2.3 Export discount types from `packages/shared/src/index.ts`
- [x] 2.4 Add `discount:updated` event type to `ServerToClientEvents` in `packages/shared/src/events/socket.ts`

## Phase 3: Backend API

- [x] 3.1 Add `setItemDiscount()` and `setAccountDiscount()` methods to `apps/api/src/services/account.service.ts` (validate open account, valid params, update fields)
- [x] 3.2 Replace all inline total calculations in `account.service.ts` with `calculateAccountTotal()`
- [x] 3.3 Replace inline total calc in `payment.service.ts` (`createPayment`, `getPendingAmount`) with `calculateAccountTotal()`
- [x] 3.4 Add `PATCH /:id/discount` endpoint in `apps/api/src/routes/accounts/index.ts` (validate, update, broadcast, return account+total+pendingAmount)
- [x] 3.5 Add `PATCH /:id/items/:itemId/discount` endpoint in same route file (validate item exists, validate params, update, broadcast)
- [x] 3.6 Add `discount:updated` WebSocket broadcast in both endpoints after successful discount application

## Phase 4: Frontend UI

- [x] 4.1 Add collapsible discount section to `apps/web/src/components/Payment/PaymentModal.tsx` (toggle button "Apply Discount", h-12, collapsed by default)
- [x] 4.2 Add discount type selector (segmented Fixed/Percent toggle) with dark theme high-contrast styling
- [x] 4.3 Add numeric discount value input with touch-friendly sizing and placeholder ($ or % based on type)
- [x] 4.4 Add live total preview using `calculateAccountTotal()` — updates on every input change, Colombian peso format ($XX.XXX)
- [x] 4.5 Add "Apply" button (disabled when empty/invalid, h-12) — calls PATCH endpoint, updates modal state on success
- [x] 4.6 Pre-fill existing discount values when discount section is expanded (read from account.discountType/discountValue)
