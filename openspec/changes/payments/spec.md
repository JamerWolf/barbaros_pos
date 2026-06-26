# SDD Delta Specs for Payments Feature

## Accounts Core (Delta)

# Delta for Accounts Core

## MODIFIED Requirements

### Requirement: Account Closure & Zero Balance Deletion

The system MUST handle account closures based on pending amount computed from total minus sum of payments. The system MUST physically delete the account if closed with a $0 pending amount AND total $0. The system MUST change status to CLOSED if closed with $0 pending amount AND total > $0.

(Previously: Closure based on balance computed from OrderItems; $0 balance deleted, non-zero balance status changed to CLOSED)

#### Scenario: Close account with $0 pending and $0 total

- GIVEN an open account with total $0 and no payments
- WHEN a user requests to close the account
- THEN the system MUST physically delete the account from the database

#### Scenario: Close account with $0 pending and non-zero total

- GIVEN an open account with total $50.00 and payments summing to $50.00 (pending $0)
- WHEN a user requests to close the account
- THEN the system MUST change the account status to `CLOSED`

#### Scenario: Close account with non-zero pending

- GIVEN an open account with total $50.00 and payments summing to $30.00 (pending $20.00)
- WHEN a user requests to close the account
- THEN the system MUST return a 400 error indicating pending amount must be zero

#### Scenario: Close guard prevents closure when pending > 0

- GIVEN an open account with pending amount $10.00
- WHEN a user attempts to close the account
- THEN the system MUST reject the operation with a validation error

## ADDED Requirements

### Requirement: Pending Amount in Account Response

The system MUST include `pendingAmount` (computed as total minus sum of payment amounts) in account responses alongside `total`.

#### Scenario: Account response includes pendingAmount

- GIVEN an account with total $50.00 and two payments totaling $30.00
- WHEN GET /accounts/:id is called
- THEN the response MUST include `pendingAmount: 20.00` and `total: 50.00`

#### Scenario: No payments results in pendingAmount equal to total

- GIVEN an account with total $25.00 and no payments
- WHEN GET /accounts/:id is called
- THEN the response MUST include `pendingAmount: 25.00`

#### Scenario: Fully paid account has pendingAmount zero

- GIVEN an account with total $40.00 and payments totaling $40.00
- WHEN GET /accounts/:id is called
- THEN the response MUST include `pendingAmount: 0.00`

## UNCHANGED Requirements

### Requirement: Account Creation & Number Reset
(No changes — retained as-is)

### Requirement: Total Computed from OrderItems
(No changes — retained as-is)

### Requirement: OrderItems on Account
(No changes — retained as-is)

### Requirement: Prevention of Closed Account Mutation
(No changes — retained as-is)

---

## Payments Core (New)

# Payments Core Specification

## Purpose
Business logic and persistence for recording payments against accounts, supporting split payments, and enforcing no-overpayment.

## Requirements

### Requirement: Payment Creation
The system MUST allow creation of a Payment linked to an Account via `accountId`. Payment SHALL include `id`, `accountId`, `amount` (Decimal 10,2), `method` (enum: CASH, TRANSFER, CARD), optional `proofUrl`, and `createdAt` timestamp.

#### Scenario: Successful payment creation

- GIVEN an open account with total $50.00 and no prior payments
- WHEN a user submits a payment with amount $30.00, method CASH
- THEN the system MUST create a Payment record and return the payment with generated `id` and `createdAt`

#### Scenario: Payment with proof URL for transfer

- GIVEN an open account with total $100.00
- WHEN a user submits a payment with amount $50.00, method TRANSFER, proofUrl "uploads/proof.jpg"
- THEN the system MUST create a Payment record with proofUrl stored

#### Scenario: Invalid payment method rejected

- GIVEN an open account
- WHEN a user submits a payment with method "bitcoin"
- THEN the system MUST return a 400 error indicating invalid payment method

#### Scenario: Zero amount rejected

- GIVEN an open account
- WHEN a user submits a payment with amount 0
- THEN the system MUST return a 400 error indicating amount must be greater than zero

#### Scenario: Negative amount rejected

- GIVEN an open account
- WHEN a user submits a payment with amount -10
- THEN the system MUST return a 400 error indicating amount must be positive

### Requirement: No Overpayment Enforcement
The system MUST reject any payment where the amount exceeds the current pending amount for the account. Pending amount is computed as `account.total - SUM(payments.amount)`.

#### Scenario: Payment within pending limit

- GIVEN an account with total $50.00 and existing payments totaling $30.00 (pending $20.00)
- WHEN a user submits a payment of $15.00
- THEN the system MUST accept the payment and update pending to $5.00

#### Scenario: Payment exceeding pending rejected

- GIVEN an account with total $50.00 and existing payments totaling $45.00 (pending $5.00)
- WHEN a user submits a payment of $10.00
- THEN the system MUST return a 400 error indicating amount exceeds pending amount

#### Scenario: Exact pending amount accepted

- GIVEN an account with total $50.00 and existing payments totaling $40.00 (pending $10.00)
- WHEN a user submits a payment of $10.00
- THEN the system MUST accept the payment, resulting in pending $0.00

### Requirement: Split Payment Support
The system MUST allow multiple payments per account. The sum of all payments SHALL be validated at creation time (cannot exceed total). The system SHALL NOT enforce foreign key constraint on sum — validation is application-level.

#### Scenario: Multiple partial payments

- GIVEN an account with total $100.00
- WHEN a user creates three payments of $30.00, $30.00, and $40.00
- THEN the system MUST accept all three payments, resulting in pending $0.00

#### Scenario: Sum exceeds total rejected

- GIVEN an account with total $50.00 and existing payment of $40.00
- WHEN a user attempts to create a payment of $15.00 (pending $10.00)
- THEN the system MUST reject the payment (exceeds pending)

### Requirement: Payment Retrieval
The system MUST support retrieving all payments for an account via `GET /accounts/:id/payments`. The response SHALL be an array of Payment objects ordered by `createdAt` descending.

#### Scenario: List payments for account

- GIVEN an account with three payments
- WHEN GET /accounts/:id/payments is called
- THEN the system MUST return an array of three Payment objects with `id`, `accountId`, `amount`, `method`, `proofUrl`, `createdAt`

#### Scenario: Empty payment list

- GIVEN an account with no payments
- WHEN GET /accounts/:id/payments is called
- THEN the system MUST return an empty array

### Requirement: Pending Amount Calculation
The system MUST compute `pendingAmount` as `account.total - SUM(payments.amount)`. This is a derived value, not stored.

#### Scenario: Pending calculation with no payments

- GIVEN an account with total $75.00 and no payments
- WHEN pending amount is computed
- THEN the system MUST return $75.00

#### Scenario: Pending calculation with partial payments

- GIVEN an account with total $75.00 and payments totaling $25.00
- WHEN pending amount is computed
- THEN the system MUST return $50.00

#### Scenario: Pending calculation with full payment

- GIVEN an account with total $75.00 and payments totaling $75.00
- WHEN pending amount is computed
- THEN the system MUST return $0.00

### Requirement: WebSocket Event on Payment Creation
The system MUST broadcast a `payment:created` event via WebSocket after successful payment creation. Event payload SHALL include payment object and updated `pendingAmount`.

#### Scenario: WebSocket broadcast after payment

- GIVEN an open account
- WHEN a payment is successfully created
- THEN the system MUST emit a `payment:created` event with payload `{ payment: Payment, pendingAmount: number }` to all connected clients

#### Scenario: WebSocket broadcast includes updated pending

- GIVEN an account with pending $20.00
- WHEN a payment of $10.00 is created
- THEN the `payment:created` event MUST include `pendingAmount: 10.00`

### Requirement: Account Closure Guard (via Payment Service)
The system MUST NOT allow account closure if `pendingAmount > 0`. This guard is enforced by PaymentService when close is attempted.

#### Scenario: Close guard blocks closure with pending

- GIVEN an account with pending $5.00
- WHEN a close request is received
- THEN the system MUST return a 400 error indicating pending amount must be zero

#### Scenario: Close guard allows closure with zero pending

- GIVEN an account with pending $0.00
- WHEN a close request is received
- THEN the system MUST proceed with closure (delete if total $0, else status → CLOSED)

---

## Payments UI (New)

# Payments UI Specification

## Purpose
Frontend user interface for recording payments against accounts, including modal form, method selection, amount input, proof upload, and pending display.

## Requirements

### Requirement: Payment Modal Trigger
The system MUST provide a "Pay" button in AccountDetailPage that opens a payment modal. The button SHALL be visible only when account status is OPEN.

#### Scenario: Pay button visible on open account

- GIVEN an open account with pending $50.00
- WHEN the AccountDetailPage loads
- THEN a "Pay" button MUST be visible

#### Scenario: Pay button hidden on closed account

- GIVEN a closed account
- WHEN the AccountDetailPage loads
- THEN the "Pay" button MUST NOT be visible

### Requirement: Payment Modal Display
The system MUST display a modal showing current total, pending amount, and list of existing payments. The modal MUST include a form with method selector, amount input, and optional proof upload.

#### Scenario: Modal shows current totals

- GIVEN an account with total $100.00 and pending $60.00
- WHEN the payment modal opens
- THEN it MUST display "Total: $100.00" and "Pending: $60.00"

#### Scenario: Modal shows existing payments list

- GIVEN an account with two payments ($20.00 cash, $20.00 transfer)
- WHEN the payment modal opens
- THEN it MUST display a list of two payments with method and amount

### Requirement: Method Selector
The system MUST provide three selectable buttons for payment method: Cash, Transfer, Card. Default selection SHALL be Cash.

#### Scenario: Default method selection

- GIVEN the payment modal is opened
- WHEN the modal renders
- THEN Cash button MUST be selected by default

#### Scenario: Method switching

- GIVEN the payment modal is open with Cash selected
- WHEN the user selects Transfer button
- THEN the method selection MUST change to Transfer

### Requirement: Amount Input
The system MUST provide a numeric input field for payment amount. The default value SHALL be the current pending amount. The input MUST accept decimal values with two decimal places.

#### Scenario: Default amount set to pending

- GIVEN an account with pending $45.00
- WHEN the payment modal opens
- THEN the amount input MUST be pre-filled with $45.00

#### Scenario: Manual amount entry

- GIVEN the payment modal is open
- WHEN the user enters $30.00 in amount input
- THEN the input MUST display $30.00

#### Scenario: Amount validation rejects zero

- GIVEN the payment modal is open
- WHEN the user enters $0.00 and submits
- THEN the system MUST show an error "Amount must be greater than zero"

#### Scenario: Amount validation rejects exceeding pending

- GIVEN pending $20.00
- WHEN the user enters $25.00 and submits
- THEN the system MUST show an error "Amount exceeds pending amount"

### Requirement: Proof Upload for Transfers
The system MUST show an optional file upload field when method is Transfer. Upload SHALL accept image files (jpg, png, webp) up to 5MB. The uploaded file URL MUST be stored as `proofUrl`.

#### Scenario: Proof upload visible for transfer

- GIVEN the payment modal is open with Transfer selected
- WHEN the modal renders
- THEN a file upload field labeled "Proof photo" MUST be visible

#### Scenario: Proof upload hidden for non-transfer

- GIVEN the payment modal is open with Cash selected
- WHEN the modal renders
- THEN the file upload field MUST NOT be visible

#### Scenario: File type validation

- GIVEN the payment modal with Transfer selected
- WHEN the user selects a .pdf file
- THEN the system MUST show an error "Only JPG, PNG, or WebP images accepted"

#### Scenario: File size validation

- GIVEN the payment modal with Transfer selected
- WHEN the user selects a 10MB image
- THEN the system MUST show an error "File size must be under 5MB"

### Requirement: Payment Submission
The system MUST submit the payment via `POST /accounts/:id/payments` with amount, method, and optional proofUrl. On success, the modal MUST close and account data MUST refresh.

#### Scenario: Successful payment submission

- GIVEN the payment modal with valid amount $30.00 and method CASH
- WHEN the user clicks "Pay"
- THEN the system MUST send POST request, close modal, and refresh account data

#### Scenario: Payment submission error handling

- GIVEN the payment modal with amount exceeding pending
- WHEN the user clicks "Pay"
- THEN the system MUST display the error message from API and keep modal open

### Requirement: Pending Amount Display
The system MUST display the current pending amount in AccountDetailPage, updated in real-time via WebSocket.

#### Scenario: Pending displayed on page load

- GIVEN an account with pending $50.00
- WHEN AccountDetailPage loads
- THEN the pending amount MUST be displayed as "Pending: $50.00"

#### Scenario: Pending updated via WebSocket

- GIVEN an account with pending $50.00
- WHEN a payment of $20.00 is created by another client
- THEN the pending amount display MUST update to $30.00 automatically

### Requirement: Close Button Guard
The system MUST show a "Close Account" button only when pending amount is $0.00. The button SHALL be disabled or hidden otherwise.

#### Scenario: Close button enabled when pending zero

- GIVEN an account with pending $0.00
- WHEN the AccountDetailPage renders
- THEN the "Close Account" button MUST be enabled

#### Scenario: Close button disabled when pending positive

- GIVEN an account with pending $10.00
- WHEN the AccountDetailPage renders
- THEN the "Close Account" button MUST be disabled or hidden

### Requirement: Mobile-First Responsive Design
The payment modal and pending display MUST be optimized for mobile devices (minimum 320px width). Touch targets SHALL be at least 44px. The modal SHALL overlay full screen on mobile.

#### Scenario: Modal full-screen on mobile

- GIVEN a device with 320px width
- WHEN the payment modal opens
- THEN it MUST occupy the full screen

#### Scenario: Touch-friendly buttons

- GIVEN the payment modal on a touch device
- WHEN the user interacts with method selector buttons
- THEN each button MUST have at least 44px touch target