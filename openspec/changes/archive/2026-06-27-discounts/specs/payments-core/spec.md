# Delta for payments-core

## MODIFIED Requirements

### Requirement: Pending Amount Calculation
The system MUST compute `pendingAmount` as `discountedTotal - SUM(payments.amount)`, where `discountedTotal` is the account total after applying item-level and account-level discounts. This is a derived value, not stored.
(Previously: pending amount was `account.total - SUM(payments.amount)` using raw total without discounts)

#### Scenario: Pending calculation with no payments
- GIVEN an account with discounted total $75.00 and no payments
- WHEN pending amount is computed
- THEN the system MUST return $75.00

#### Scenario: Pending calculation with partial payments
- GIVEN an account with discounted total $75.00 and payments totaling $25.00
- WHEN pending amount is computed
- THEN the system MUST return $50.00

#### Scenario: Pending calculation with full payment
- GIVEN an account with discounted total $75.00 and payments totaling $75.00
- WHEN pending amount is computed
- THEN the system MUST return $0.00

#### Scenario: Pending calculation with item discounts
- GIVEN an account with items subtotal $50.00, item discounts $10.00, no account discount, discounted total $40.00, payments totaling $30.00
- WHEN pending amount is computed
- THEN the system MUST return $10.00

#### Scenario: Pending calculation with account discount
- GIVEN an account with discounted total $45.00 after 10% account discount on $50.00 subtotal, payments totaling $20.00
- WHEN pending amount is computed
- THEN the system MUST return $25.00

### Requirement: No Overpayment Enforcement
The system MUST reject any payment where the amount exceeds the current pending amount for the account. Pending amount is computed from discountedTotal minus sum of payments.

#### Scenario: Payment within pending limit
- GIVEN an account with discounted total $50.00 and existing payments totaling $30.00 (pending $20.00)
- WHEN a user submits a payment of $15.00
- THEN the system MUST accept the payment and update pending to $5.00

#### Scenario: Payment exceeding pending rejected
- GIVEN an account with discounted total $50.00 and existing payments totaling $45.00 (pending $5.00)
- WHEN a user submits a payment of $10.00
- THEN the system MUST return a 400 error indicating amount exceeds pending amount

#### Scenario: Exact pending amount accepted
- GIVEN an account with discounted total $50.00 and existing payments totaling $40.00 (pending $10.00)
- WHEN a user submits a payment of $10.00
- THEN the system MUST accept the payment, resulting in pending $0.00

### Requirement: Account Closure Guard (via Payment Service)
The system MUST NOT allow account closure if `pendingAmount > 0`. This guard is enforced by PaymentService when close is attempted, using discounted total.

#### Scenario: Close guard blocks closure with pending
- GIVEN an account with pending $5.00 (from discounted total)
- WHEN a close request is received
- THEN the system MUST return a 400 error indicating pending amount must be zero

#### Scenario: Close guard allows closure with zero pending
- GIVEN an account with pending $0.00 (from discounted total)
- WHEN a close request is received
- THEN the system MUST proceed with closure (delete if discounted total $0, else status → CLOSED)
