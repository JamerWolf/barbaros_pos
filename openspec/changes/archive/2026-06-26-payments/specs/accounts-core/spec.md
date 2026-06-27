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