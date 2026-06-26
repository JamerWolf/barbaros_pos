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