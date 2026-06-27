# Reports UI Specification

## Purpose

Frontend pages for viewing shift reports, shift detail summaries with payment breakdown, and Excel export. Includes navigation entry point from the admin dashboard.

## Requirements

### Requirement: Reports Page — Shift List

The system SHALL provide a dedicated `/reports` page displaying all shifts.

#### Scenario: View shift list

- GIVEN the user navigates to `/reports`
- WHEN the page loads
- THEN the system SHALL display a list of shifts sorted by `openedAt` descending
- AND each shift SHALL show open date, close date, and total sales in Colombian peso format
- AND tapping a shift SHALL navigate to shift detail view

#### Scenario: Empty shift list

- GIVEN no shifts exist
- WHEN the user navigates to `/reports`
- THEN the system SHALL display a "Sin turnos" empty state message

### Requirement: Shift Detail Summary

The system SHALL display a detailed summary when a shift is selected.

#### Scenario: View shift detail

- GIVEN the user taps a shift from the list
- WHEN the shift detail view loads
- THEN the system SHALL display the shift open/close dates
- AND show the total number of accounts
- AND show total sales amount
- AND show payment breakdown by method (EFECTIVO, TRANSFERENCIA, TARJETA) with count and total per method
- AND all monetary values SHALL use Colombian peso formatting (no cents, period thousands separator)

#### Scenario: Tap account in shift detail

- GIVEN the shift detail shows a list of accounts
- WHEN the user taps an account
- THEN the system SHALL navigate to account detail in readonly mode (`?readonly=1`)

### Requirement: Excel Export Button

The system SHALL provide an export button on the shift detail view.

#### Scenario: Export Excel

- GIVEN the user is viewing shift detail
- WHEN the user taps "Exportar Excel"
- THEN the system SHALL download an `.xlsx` file via `GET /reports/export/:shiftId`
- AND the file SHALL contain account names, totals, payment methods, and dates
- AND monetary values SHALL be in Colombian peso format

### Requirement: Admin Dashboard Entry Point

The system SHALL provide a navigation entry to reports from the admin dashboard.

#### Scenario: Reports button in admin panel

- GIVEN the user is on the dashboard in Admin mode
- WHEN the admin panel renders
- THEN the system SHALL display a "Reportes" button
- AND tapping it SHALL navigate to `/reports`
