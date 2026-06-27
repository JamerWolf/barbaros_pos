# Proposal: Reports

## Intent

The nightclub needs end-of-night reporting: sales by shift, payment breakdown by method, and the ability to export to Excel. Currently, there's no way to view historical shift data or generate reports — the Shift model only has open/close endpoints with no query capability.

## Scope

### In Scope
- Backend: ReportService with `listShifts()`, `getShiftSummary()`, `exportToExcel()`
- API endpoints: `GET /shifts`, `GET /shifts/:id`, `GET /reports/export/:shiftId`
- Frontend: `/reports` page with shift list, shift detail summary, and Excel export button
- Account detail readonly mode for viewing closed accounts from reports (`?readonly=1` query param)
- Dashboard admin panel: add "Reportes" button
- Colombian peso formatting (no cents, period as thousands separator)
- `exceljs` library for Excel export (pure JS, no native deps)

### Out of Scope
- Shift creation/editing (already exists, not modifying)
- Real-time report updates via WebSocket (reports are historical, read-only)
- Filtering by date range (future enhancement)
- Per-account drill-down from Excel (only shift-level export)
- Cuadre de caja feature (deferred to future session)

## Capabilities

### New Capabilities
- `reports`: Shift listing, shift summary with payment breakdown, Excel export, readonly account detail from reports

### Modified Capabilities
- `account-detail-ui`: Add readonly mode for viewing closed accounts from reports. Existing edit capabilities remain unchanged when readonly param is absent.

## Approach

1. **Backend ReportService**: Query Shift with included Accounts and Payments. Aggregate totals and group payments by method. Export to Excel using exceljs with proper COO formatting.

2. **API Layer**: Three new endpoints under existing Fastify routes. No WebSocket needed — reports are point-in-time reads.

3. **Frontend Reports Page**: Simple list of shifts with open/close dates and total sales. Tap a shift to see summary with payment breakdown. Export button triggers Excel download.

4. **Readonly Account Detail**: Add `readonly` query param check to AccountDetailPage. When `readonly=1`, hide all action buttons (add item, pay, close). Account data loads the same way via existing `GET /accounts/:id`.

5. **$0 Account Exclusion**: Query filters `total > 0` OR `status = 'CLOSED'` to exclude soft-deleted $0 accounts (they're physically deleted from DB per existing spec).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/services/report.service.ts` | New | ReportService with shift queries and Excel export |
| `apps/api/src/routes/reports.ts` | New | API endpoints for shift list, detail, export |
| `apps/web/src/pages/ReportsPage.tsx` | New | Reports page with shift list + detail |
| `apps/web/src/pages/AccountDetailPage.tsx` | Modified | Add readonly mode via query param |
| `apps/web/src/pages/DashboardPage.tsx` | Modified | Add "Reportes" button to admin panel |
| `packages/shared/src/types/report.ts` | Modified | Extend ShiftReport with additional fields |
| `package.json` (root) | Modified | Add exceljs dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Excel file size for long nights with many accounts | Low | exceljs streams to buffer, paginate if needed |
| Readonly mode bypass via direct URL manipulation | Low | Readonly is UI-only; backend already prevents mutation of closed accounts |
| Shift with no accounts shows empty report | Low | Display "Sin cuentas" message, still allow export with empty sheet |

## Rollback Plan

1. Remove `apps/api/src/routes/reports.ts` and `apps/api/src/services/report.service.ts`
2. Remove `ReportsPage.tsx` and route from `App.tsx`
3. Revert `AccountDetailPage.tsx` changes (remove readonly check)
4. Revert `DashboardPage.tsx` (remove Reportes button)
5. Revert `packages/shared/src/types/report.ts`
6. Remove `exceljs` from `package.json`

## Dependencies

- `exceljs` (npm) — pure JS Excel library, no native compilation needed
- Existing `Shift` model with `openedAt`, `closedAt` fields (already in schema)
- Existing `Account` model with `total`, `status`, `payments` (already in schema)

## Success Criteria

- [ ] `GET /shifts` returns list of all shifts with open/close dates and computed totals
- [ ] `GET /shifts/:id` returns shift summary with accounts count, total sales, payment breakdown by method
- [ ] `GET /reports/export/:shiftId` returns `.xlsx` file with proper COO formatting
- [ ] Reports page shows shift list, tap opens detail with summary
- [ ] Export button downloads Excel file with shift data
- [ ] Closed account viewable from reports in readonly mode (no action buttons)
- [ ] $0 accounts excluded from reports (physically deleted, not shown)
- [ ] Mobile-first, dark theme, touch-friendly throughout
