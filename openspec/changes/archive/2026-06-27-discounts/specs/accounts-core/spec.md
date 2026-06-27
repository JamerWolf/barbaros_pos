# Delta for accounts-core

## MODIFIED Requirements

### Requirement: Total Computed from OrderItems
The system MUST compute the account total from its OrderItems, incorporating item-level and account-level discounts. The total SHALL be computed as: `SUM(orderItems.quantity * orderItems.unitPrice) - SUM(itemDiscounts) - accountDiscount`. Item-level discounts are computed per item: `fixed` discount subtracts the value; `percent` discount subtracts `(unitPrice * quantity * value / 100)`. Account-level discount is applied to the subtotal after item discounts.
(Previously: total was `SUM(orderItems.quantity * orderItems.unitPrice)` with no discount fields)

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

## ADDED Requirements

### Requirement: Account Discount Fields
The system MUST support `discountType` (enum: NONE, FIXED, PERCENT) and `discountValue` (Decimal) on the Account model. Default values SHALL be NONE and 0.

#### Scenario: New account has no discount
- GIVEN a newly created account
- WHEN the account is inspected
- THEN `discountType` MUST be NONE and `discountValue` MUST be 0

#### Scenario: Account discount fields included in response
- GIVEN an account with discountType FIXED and discountValue 5.00
- WHEN GET /accounts/:id is called
- THEN the response MUST include `discountType: "FIXED"` and `discountValue: 5.00`

### Requirement: Prevention of Closed Account Mutation
The system MUST NOT allow modifications to closed accounts.

#### Scenario: Attempt to mutate a closed account
- GIVEN an account with status `CLOSED`
- WHEN a user attempts to modify the account
- THEN the system MUST return a validation error and abort the mutation
