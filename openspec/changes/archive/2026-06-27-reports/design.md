# Design: Reports

## Technical Approach

Add read-only reporting for historical shift data. Backend computes totals by querying Shift → Accounts → Payments and OrderItems, reusing `calculateAccountTotal` for per-account totals. Excel export via `exceljs` streams a buffer response. Frontend adds a `/reports` page with shift list/detail and an export button. Readonly account detail is a simple query-param guard on the existing `AccountDetailPage`.

No new Prisma models — all data comes from existing Shift, Account, OrderItem, and Payment tables.

## Architecture Decisions

### Decision: Extend existing shift routes vs. new reports prefix

**Choice**: Extend `apps/api/src/routes/shifts/index.ts` with GET `/` and GET `/:id`, create separate `reports.ts` for export only.

**Alternatives considered**: (a) New `/reports` prefix with all 3 endpoints. (b) Put everything under shifts.

**Rationale**: Shifts already have `/open` and `/close` under `/shifts`. Adding `GET /shifts` (list) and `GET /shifts/:id` (detail) is RESTful — the resource is Shift. Export is a separate concern (`/reports/export/:shiftId`) and lives in its own route file to avoid bloating the shifts router.

### Decision: Compute totals in service vs. raw SQL aggregation

**Choice**: Reuse `calculateAccountTotal` per-account in the service layer.

**Alternatives considered**: Raw SQL with SUM/GROUP BY for payment breakdown.

**Rationale**: The `calculateAccountTotal` function handles discount logic (FIXED, PERCENT, item-level vs account-level). Bypassing it would duplicate business logic. Payment breakdown by method uses a simple `reduce` — no need for SQL aggregation at this scale (nightclub has ~50-200 accounts per shift).

### Decision: Excel generation in-memory vs. streaming to disk

**Choice**: In-memory buffer with `exceljs`, returned as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Alternatives considered**: Stream to temp file, send file URL.

**Rationale**: Nightclub reports are small (50-200 rows). exceljs workbook creation is <100ms. No need for temp file cleanup complexity.

## Data Flow

```
GET /shifts
  └─ ReportService.listShifts()
       └─ prisma.shift.findMany({ include: { accounts: true } })
            └─ For each shift: compute totalSales, totalPaid, pendingAmount

GET /shifts/:id
  └─ ReportService.getShiftSummary(shiftId)
       └─ prisma.shift.findUnique({ include: { accounts: { include: { payments, orderItems } } } })
            └─ For each account: calculateAccountTotal + aggregate payments by method
       └─ Returns: shift metadata + accounts[] + paymentsByMethod + totals

GET /reports/export/:shiftId
  └─ ReportService.exportToExcel(shiftId)
       └─ Calls getShiftSummary internally
       └─ Builds exceljs workbook: Summary sheet + Accounts sheet + Payments sheet
       └─ Returns buffer as response
```

Frontend:

```
/reports → ReportsPage
  ├─ ShiftList (fetch GET /shifts)
  │    └─ ShiftCard (open/close dates, total, account count)
  └─ ShiftDetail (on card click → fetch GET /shifts/:id)
       ├─ Summary: total sales, accounts count, payment breakdown
       ├─ AccountList → tap → /accounts/:id?readonly=1
       └─ Export button → GET /reports/export/:shiftId → download blob
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/services/report.service.ts` | Create | ReportService: listShifts(), getShiftSummary(), exportToExcel() |
| `apps/api/src/routes/shifts/index.ts` | Modify | Add GET `/` (list shifts) and GET `/:id` (shift summary) |
| `apps/api/src/routes/reports.ts` | Create | GET `/export/:shiftId` — Excel download endpoint |
| `apps/api/src/app.ts` | Modify | Register reportRoutes with prefix `/reports` |
| `apps/web/src/pages/ReportsPage.tsx` | Create | Reports page with shift list + detail + export |
| `apps/web/src/pages/AccountDetailPage.tsx` | Modify | Add `readonly` query param check, hide action buttons when `readonly=1` |
| `apps/web/src/pages/DashboardPage.tsx` | Modify | Add "Reportes" button in admin panel, navigate to `/reports` |
| `apps/web/src/App.tsx` | Modify | Add `/reports` route |
| `packages/shared/src/types/report.ts` | Modify | Extend ShiftReport with accounts count, payment breakdown, shift dates |
| `package.json` (root) | Modify | Add `exceljs` dependency |

## Interfaces / Contracts

### Shared Types (packages/shared/src/types/report.ts)

```typescript
export type PaymentMethodType = 'CASH' | 'TRANSFER' | 'CARD';

export interface ShiftListItem {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;       // ISO date
  closedAt?: string;      // ISO date
  accountsCount: number;
  totalSales: number;
  totalPaid: number;
}

export interface ShiftSummary {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  accountsCount: number;
  totalSales: number;
  totalPaid: number;
  pendingAmount: number;
  paymentsByMethod: Record<PaymentMethodType, number>;
  accounts: ShiftAccountSummary[];
}

export interface ShiftAccountSummary {
  id: string;
  number: number;
  name: string;
  status: 'OPEN' | 'CLOSED';
  total: number;
  paid: number;
  pendingAmount: number;
}
```

### API Contracts

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `GET /shifts` | 200 | `ShiftListItem[]` | All shifts, most recent first |
| `GET /shifts/:id` | 200 | `ShiftSummary` | Full summary with accounts |
| `GET /shifts/:id` | 404 | `{ error: string }` | Shift not found |
| `GET /reports/export/:shiftId` | 200 | `.xlsx` binary | Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `GET /reports/export/:shiftId` | 404 | `{ error: string }` | Shift not found |

### Excel Structure

**Sheet 1: "Resumen"**
| Turno | Desde | Hasta | Cuentas | Total Ventas | Total Pagado | Pendiente |
|-------|-------|-------|---------|-------------|-------------|-----------|

**Sheet 2: "Cuentas"**
| # | Nombre | Estado | Total | Pagado | Pendiente |
|---|--------|--------|-------|--------|-----------|

**Sheet 3: "Pagos por Método"**
| Método | Total |
|--------|-------|
| Efectivo | $X |
| Transferencia | $X |
| Tarjeta | $X |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | ReportService calculations (totals, payment breakdown) | Test with mocked Prisma, verify math matches `calculateAccountTotal` |
| Integration | API endpoints return correct shape and status codes | Fastify inject() with seeded DB |
| E2E | Reports page loads, shows shifts, export downloads | Playwright/Cypress (future) |

## Migration / Rollout

No migration required. All data comes from existing tables. The `exceljs` dependency is added to root `package.json`.

## Open Questions

- None — all specs are clear and the data model supports all required queries.
