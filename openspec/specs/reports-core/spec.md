# Reports Core Specification

## Purpose

Backend service and API endpoints for end-of-night reporting: shift listing, shift summary with payment breakdown, and Excel export. Reports are historical, read-only data with no real-time updates.

## Requirements

### Requirement: Shift Listing

The system SHALL provide a ReportService that queries all shifts with computed totals and account counts.

#### Scenario: List all shifts

- GIVEN one or more shifts exist with opened and closed dates
- WHEN `GET /shifts` is called
- THEN the system SHALL return an array of shifts sorted by `openedAt` descending
- AND each shift SHALL include `id`, `openedAt`, `closedAt`, total sales (sum of account totals), and account count
- AND Colombian peso formatting SHALL be applied to monetary values in the response (no cents, period thousands separator)

#### Scenario: No shifts exist

- GIVEN no shifts have been created
- WHEN `GET /shifts` is called
- THEN the system SHALL return an empty array

### Requirement: Shift Summary

The system SHALL provide a detailed summary for a single shift including payment breakdown by method.

#### Scenario: Get shift summary

- GIVEN a shift exists with closed accounts and payments
- WHEN `GET /shifts/:id` is called
- THEN the system SHALL return shift metadata (`id`, `openedAt`, `closedAt`)
- AND return the total sales amount
- AND return the count of accounts in the shift
- AND return a payment breakdown grouped by method (EFECTIVO, TRANSFERENCIA, TARJETA) with count and total per method
- AND exclude $0 accounts from totals (physically deleted from DB)

#### Scenario: Shift not found

- GIVEN no shift exists with the given ID
- WHEN `GET /shifts/:id` is called
- THEN the system SHALL return HTTP 404

### Requirement: Excel Export

The system SHALL export shift data to an Excel file using `exceljs`.

#### Scenario: Export shift to Excel

- GIVEN a shift exists with accounts and payments
- WHEN `GET /reports/export/:shiftId` is called
- THEN the system SHALL return an `.xlsx` file as binary download
- AND the file SHALL contain columns: Account Name, Total, Payment Method, Date
- AND monetary values SHALL be formatted in Colombian peso style (no cents, period as thousands separator)
- AND the filename SHALL be `reporte_{shiftId}.xlsx`

#### Scenario: Export shift with no accounts

- GIVEN a shift exists but has no accounts
- WHEN `GET /reports/export/:shiftId` is called
- THEN the system SHALL return an `.xlsx` file with headers only and no data rows

### Requirement: $0 Account Exclusion

The system SHALL exclude $0 accounts from all report queries. Per business rules, $0 accounts are physically deleted from the database upon close.

#### Scenario: Closed $0 accounts not in reports

- GIVEN a shift contains accounts where total = $0 at close time
- WHEN shift summary or export is requested
- THEN those accounts SHALL NOT appear in the results (they are deleted from DB)
