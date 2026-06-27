# Proposal: Discounts

## Intent

The POS system currently has no discount mechanism. Business rules require per-item and per-account discounts (fixed amount or percentage), applied by any user during payment. Total computation is scattered across AccountService, PaymentService, and route handlers — no centralized utility exists. Adding discounts requires both a new data model AND a centralized calculation layer.

## Scope

### In Scope
- Prisma schema: `discountType` + `discountValue` on `OrderItem` (item-level) and `Account` (account-level)
- Centralized total calculation utility in `packages/shared` (subtotal → item discounts → account discount → final total)
- New API endpoints: `PATCH /accounts/:id/discount` (account-level) and `PATCH /accounts/:id/items/:itemId/discount` (item-level)
- PaymentModal: collapsible discount section (toggle button, hidden by default)
- Discount UI in modal: type selector (fixed/%), value input, preview of adjusted total
- WebSocket broadcast on discount changes

### Out of Scope
- Discount codes or coupons
- Time-based or conditional automatic discounts
- Discount audit log / history
- Reporting changes for discounted totals (future task)

## Capabilities

### New Capabilities
- `discounts-core`: Schema, calculation utility, API endpoints for item-level and account-level discounts
- `discounts-ui`: Collapsible discount section in PaymentModal with type/value inputs and total preview

### Modified Capabilities
- `payments-core`: `pendingAmount` calculation must use discounted total instead of raw sum
- `payments-ui`: Modal must display discounted total and adjust pending amount accordingly
- `accounts-core`: Total computation formula changes from `SUM(qty * price)` to `SUM(qty * price) - itemDiscounts - accountDiscount`

## Approach

1. **Schema first**: Add `discountType` (enum: NONE, FIXED, PERCENT) and `discountValue` (Decimal) to OrderItem and Account. Default NONE/0.
2. **Centralized calculator**: New `calculateAccountTotal()` in `packages/shared` that takes items + account discount and returns `{ subtotal, itemDiscounts, afterItemDiscounts, accountDiscount, total }`. All services use this single function.
3. **API layer**: Two PATCH endpoints validate discount params (type must be valid, value > 0, percentage ≤ 100). Both broadcast via WebSocket.
4. **UI**: Add collapsible section to PaymentModal. Toggle button labeled "Apply Discount". Section shows discount type selector, value input, and live preview of adjusted total. Mobile-first, touch-friendly.
5. **Integration**: PaymentModal passes discounted total to pending calculation. Close guard uses discounted total.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/calculations.ts` | New | Centralized discount + total calculation utility |
| `packages/shared/src/types.ts` | Modified | Add DiscountType enum, discount fields to shared types |
| `apps/api/prisma/schema.prisma` | Modified | Add discount fields to OrderItem and Account models |
| `apps/api/src/services/PaymentService.ts` | Modified | Use centralized calculator for pendingAmount |
| `apps/api/src/services/AccountService.ts` | Modified | Use centralized calculator for total |
| `apps/api/src/routes/accounts.ts` | Modified | Add discount PATCH endpoints |
| `apps/web/src/components/PaymentModal.tsx` | Modified | Add collapsible discount section |
| `apps/web/src/hooks/useAccount.ts` | Modified | Handle discount-related state |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Total calculation drift between services | High | Centralized utility eliminates this; enforce via code review |
| Discount applied to closed account | Low | Closed account mutation guard already exists in accounts-core |
| Percentage discount > 100% | Low | Validation: percentage must be 0-100, fixed must be ≥ 0 |
| UI complexity on small screens | Medium | Collapsible section keeps default view clean; mobile-first design |

## Rollback Plan

1. Remove discount fields from Prisma schema and run `prisma migrate reset`
2. Remove centralized calculator, revert services to inline `SUM(qty * price)`
3. Remove discount PATCH endpoints from routes
4. Remove collapsible section from PaymentModal
5. All changes are additive — no existing behavior is modified, only extended

## Dependencies

- Existing payments-core spec must be updated to reference discounted total in pendingAmount calculation
- Existing accounts-core spec must be updated to reflect new total formula

## Success Criteria

- [ ] Item discount applied: `2x $15 item with $5 fixed discount → $25 total` (not $30)
- [ ] Account discount applied: `$50 subtotal with 10% account discount → $45 total`
- [ ] Both discounts stacked: item discounts first, then account discount on remainder
- [ ] PaymentModal shows collapsible discount section, hidden by default
- [ ] Pending amount reflects discounted total
- [ ] WebSocket broadcast updates all clients when discount changes
- [ ] Closed accounts reject discount changes
