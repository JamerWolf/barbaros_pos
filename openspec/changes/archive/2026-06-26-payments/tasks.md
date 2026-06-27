# Tasks: Payments Feature

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600–750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema + shared types | PR 1 | Base: feature/payments. Foundation, no logic. |
| 2 | PaymentService + routes + close guard | PR 2 | Base: PR 1 branch. Core API, ~200 lines. |
| 3 | Proof upload + account response wiring | PR 3 | Base: PR 2 branch. Uploads, pendingAmount in GET. |
| 4 | Frontend modal + store + sockets | PR 4 | Base: PR 3 branch. UI + WebSocket, ~250 lines. |

## Phase 1: Schema + Shared Types

- [x] 1.1 Add `PaymentMethod` enum (`CASH`, `TRANSFER`, `CARD`) and `Payment` model to `apps/api/prisma/schema.prisma` — fields: `id uuid`, `accountId` FK, `amount Decimal(10,2)`, `method PaymentMethod`, `proofUrl String?`, `createdAt`, `updatedAt`. Add `payments Payment[]` to Account model. (~25 lines)
- [x] 1.2 Run `npx prisma migrate dev --name add_payments` to generate migration and client. Verify `apps/api/generated/prisma` includes Payment.
- [x] 1.3 Update `packages/shared/src/types/payment.ts` — change `PaymentMethod` to uppercase enum (`CASH`, `TRANSFER`, `CARD`), add `PaymentCreateRequest` and `PaymentCreateResponse` DTO types. (~20 lines)
- [x] 1.4 Add `pendingAmount?: number` to `IAccount` in `packages/shared/src/types/account.ts`. (~1 line)
- [x] 1.5 Verify shared types build: `npm run build` in `packages/shared`.

## Phase 2: PaymentService + API Routes + Close Guard

- [x] 2.1 Create `apps/api/src/services/payment.service.ts` with static methods: `createPayment(accountId, amount, method, proofUrl?)` — serializable transaction, fetch account+orderItems → compute total, SUM(payments) → validate amount ≤ pending, insert payment, return `{ payment, pendingAmount }`. `listPayments(accountId)` — query ordered by createdAt desc. `getPendingAmount(accountId)` — compute total − SUM. (~80 lines)
- [x] 2.2 Add POST `/:id/payments` route in `apps/api/src/routes/accounts/index.ts` — validate amount > 0, method ∈ enum, call `PaymentService.createPayment`, emit `payment:created` WebSocket event with `{ payment, pendingAmount, account }`, reply 201. (~35 lines)
- [x] 2.3 Add GET `/:id/payments` route in `apps/api/src/routes/accounts/index.ts` — call `PaymentService.listPayments`, reply 200. (~15 lines)
- [x] 2.4 Modify `AccountService.closeAccount()` in `apps/api/src/services/account.service.ts` — fetch payments, compute pendingAmount, throw if pending > 0, preserve existing delete/CLOSED logic. (~20 lines)
- [x] 2.5 Modify `AccountService.getAccountWithItems()` — include payments in query, compute and return `pendingAmount`. (~10 lines)
- [x] 2.6 Verify: POST creates payment, GET lists payments, close rejects with pending > 0.

## Phase 3: Proof Upload + Account Response Wiring

- [x] 3.1 Create `apps/api/uploads/` directory, add to `.gitignore`. Register static serve for `/uploads` in `apps/api/src/app.ts` using `@fastify/static`. (~10 lines)
- [x] 3.2 Add file upload handling to POST `/:id/payments` route — accept multipart (jpg/png/webp, ≤5MB), save to `uploads/`, store relative URL as `proofUrl`. (~25 lines)
- [x] 3.3 Modify GET `/:id` route in accounts to call `getAccountWithItems` which now returns `payments[]` and `pendingAmount`. Update response shape. (~5 lines)
- [x] 3.4 Modify GET `/` (list accounts) route to include `pendingAmount` in each account object. (~10 lines)
- [x] 3.5 Verify: proof photo uploads, GET /:id returns payments + pendingAmount, list includes pendingAmount.

## Phase 4: Frontend — Modal + Store + WebSocket

- [x] 4.1 Create `apps/web/src/components/Payment/PaymentModal.tsx` — modal overlay, method selector (3 buttons, default CASH), amount input (default pending), conditional proof upload for TRANSFER, submit via POST, close on success, show API errors. Mobile-first, dark theme, h-12 targets. (~120 lines)
- [x] 4.2 Update `apps/web/src/store/accountStore.ts` — add `pendingAmount` to `AccountWithItems`, propagate in `setAccounts`/`updateAccount`/`addItem`/etc. (~10 lines)
- [x] 4.3 Modify `apps/web/src/pages/AccountDetailPage.tsx` — display pendingAmount below total, add "Pagar" button (visible when OPEN), wire PaymentModal toggle, disable/close button when pending > 0. (~40 lines)
- [x] 4.4 Update `apps/web/src/hooks/useAccountSockets.ts` — handle `payment:created` event → call `updateAccount` with updated account data from payload. (~10 lines)
- [x] 4.5 Verify: modal opens, payment submits, pending updates in real-time, close button respects guard, mobile layout works.

## Verification

- [ ] V.1 Full flow: create account → add items → open modal → pay partial → verify pending → pay remaining → verify pending = 0 → close account succeeds.
- [ ] V.2 Overpayment: attempt payment exceeding pending → expect 400 error.
- [ ] V.3 Close guard: attempt close with pending > 0 → expect 400 error.
- [ ] V.4 Split payments: create 3 payments on one account → all succeed, pending = 0.
- [ ] V.5 WebSocket: second client sees payment:created update in real-time.
