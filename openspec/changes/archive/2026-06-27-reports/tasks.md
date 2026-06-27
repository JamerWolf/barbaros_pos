# Tasks: Reports

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~390 (new + modified) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Run `npm install exceljs` in project root (add to root `package.json`)
- [x] 1.2 Extend `packages/shared/src/types/report.ts` — add `ShiftListItem`, `ShiftSummary`, `ShiftAccountSummary`, `PaymentMethodType` types; keep existing `ShiftReport` for backward compat

## Phase 2: Backend Service + Routes

- [ ] 2.1 Create `apps/api/src/services/report.service.ts` — `listShifts()` with prisma shift.findMany, compute totalSales/totalPaid per shift; `getShiftSummary(shiftId)` with full account/payment include, reuse `calculateAccountTotal` from shared
- [ ] 2.2 Add `exportToExcel(shiftId)` to ReportService — build exceljs workbook with 3 sheets (Resumen, Cuentas, Pagos por Método), COP formatting, return buffer
- [ ] 2.3 Add GET `/` (list shifts) and GET `/:id` (shift summary) to `apps/api/src/routes/shifts/index.ts` — import ReportService, return ShiftListItem[] and ShiftSummary
- [ ] 2.4 Create `apps/api/src/routes/reports.ts` — GET `/export/:shiftId` endpoint, stream xlsx buffer with correct Content-Type and filename header
- [ ] 2.5 Register reportRoutes in `apps/api/src/app.ts` — import from `./routes/reports.js`, prefix `/reports`

## Phase 3: Frontend

- [ ] 3.1 Create `apps/web/src/pages/ReportsPage.tsx` — shift list with ShiftCard (dates, total in COP), tap navigates to detail; detail view shows summary + payment breakdown + account list; export button triggers blob download from `/reports/export/:shiftId`
- [ ] 3.2 Modify `apps/web/src/pages/AccountDetailPage.tsx` — read `readonly` from `useSearchParams`, wrap action buttons (add item, payment, close) in conditional; hide name edit input when readonly; back button navigates to `/reports` when readonly
- [ ] 3.3 Add "Reportes" button to admin panel in `apps/web/src/pages/DashboardPage.tsx` — in the `mode === 'admin'` section, next to "Productos" button, navigate to `/reports`
- [ ] 3.4 Add `/reports` route to `apps/web/src/App.tsx` — import ReportsPage, add Route element

## Phase 4: Integration Verification

- [ ] 4.1 Verify `GET /shifts` returns ShiftListItem[] with correct shape and COP-formatted totals
- [ ] 4.2 Verify `GET /shifts/:id` returns ShiftSummary with paymentsByMethod breakdown
- [ ] 4.3 Verify `GET /reports/export/:shiftId` returns valid .xlsx with 3 sheets
- [ ] 4.4 Verify ReportsPage renders shift list, detail, and export downloads file
- [ ] 4.5 Verify AccountDetailPage hides action buttons when `?readonly=1` and shows them normally without param
