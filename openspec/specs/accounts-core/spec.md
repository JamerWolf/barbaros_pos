# Accounts Core Specification

## Purpose
Lógica de negocio y persistencia para la gestión de cuentas en el sistema.

## Requirements

### Requirement: Account Creation & Number Reset
The system MUST generate a visual sequential `number` upon account creation.
The system MUST reset this sequential `number` to 1 for each new shift ("noche").

#### Scenario: First account of the night
- GIVEN a new shift ("noche") has started
- WHEN a user creates a new account
- THEN the system MUST assign `number` 1 to the account

#### Scenario: Subsequent accounts in the same night
- GIVEN an account with `number` 1 exists for the current shift
- WHEN a user creates a new account
- THEN the system MUST assign `number` 2 to the account

### Requirement: Account Closure & Zero Balance Deletion

The system MUST handle account closures based on pending amount computed from total minus sum of payments. The system MUST physically delete the account if closed with a $0 pending amount AND total $0. The system MUST change status to CLOSED if closed with $0 pending amount AND total > $0.

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

### Requirement: Total Computed from OrderItems
The system MUST compute the account total from its OrderItems, incorporating item-level and account-level discounts. The total SHALL be computed as: `SUM(orderItems.quantity * orderItems.unitPrice) - SUM(itemDiscounts) - accountDiscount`. Item-level discounts are computed per item: `fixed` discount subtracts the value; `percent` discount subtracts `(unitPrice * quantity * value / 100)`. Account-level discount is applied to the subtotal after item discounts.

#### Scenario: Total reflects current items
- GIVEN an account with 2 items: 2x $15.00 and 1x $8.00
- WHEN the total is computed
- THEN the system MUST return $38.00

#### Scenario: Total updates after item mutation
- GIVEN an account with a total of $38.00
- WHEN a user removes the $8.00 item
- THEN the system MUST recompute the total as $30.00

#### Scenario: Fixed item discount reduces total
- GIVEN an account with 1 item: 2x $15.00 (subtotal $30.00) with fixed discount $5.00
- WHEN the total is computed
- THEN the system MUST return $25.00

#### Scenario: Percent item discount reduces total
- GIVEN an account with 1 item: 2x $20.00 (subtotal $40.00) with percent discount 10%
- WHEN the total is computed
- THEN the system MUST return $36.00

#### Scenario: Account-level fixed discount after item discounts
- GIVEN an account with subtotal $40.00 after item discounts, account discount fixed $5.00
- WHEN the total is computed
- THEN the system MUST return $35.00

#### Scenario: Account-level percent discount after item discounts
- GIVEN an account with subtotal $40.00 after item discounts, account discount percent 10%
- WHEN the total is computed
- THEN the system MUST return $36.00

#### Scenario: Combined item and account discounts
- GIVEN an account with 1 item: 2x $20.00 (subtotal $40.00), item discount fixed $4.00, account discount percent 10%
- WHEN the total is computed
- THEN the system MUST return $32.40

### Requirement: Account Discount Fields
The system MUST support `discountType` (enum: NONE, FIXED, PERCENT) and `discountValue` (Decimal) on the Account model. Default values SHALL be NONE and 0.

#### Scenario: New account has no discount
- GIVEN a newly created account
- WHEN the account is inspected
- THEN `discountType` MUST be NONE and `discountValue` MUST be 0

#### Scenario: Account discount fields included in response
- GIVEN an account with discountType FIXED and discountValue 5.00
- WHEN GET /accounts/:id is called
- THEN the response MUST include `discountType: "FIXED"` and `discountValue: 5.00

### Requirement: OrderItems on Account
The system MUST support OrderItems linked to accounts via foreign key.
OrderItems SHALL be cascade-deleted when the account is deleted.

#### Scenario: Items included in account response
- GIVEN an account with 3 order items
- WHEN GET /accounts/:id is called
- THEN the response MUST include `items: OrderItem[]` and `total: number`

#### Scenario: Closed accounts reject new items
- GIVEN an account with status `CLOSED`
- WHEN a user attempts to add an item
- THEN the system MUST return a 400 error

### Requirement: Prevention of Closed Account Mutation
The system MUST NOT allow modifications to closed accounts.

#### Scenario: Attempt to mutate a closed account
- GIVEN an account with status `CLOSED`
- WHEN a user attempts to modify the account
- THEN the system MUST return a validation error and abort the mutation
