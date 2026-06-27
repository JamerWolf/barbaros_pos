# Discounts Core Specification

## Purpose
Schema, calculation utility, and API endpoints for applying item-level and account-level discounts (fixed amount or percentage) to accounts and order items.

## Requirements

### Requirement: Discount Schema Fields
The system MUST support `discountType` (enum: NONE, FIXED, PERCENT) and `discountValue` (Decimal) on both `OrderItem` and `Account` models. Default values SHALL be NONE and 0. Fields MUST be included in all account and order item responses.

#### Scenario: Order item with no discount
- GIVEN an order item with default discount fields
- WHEN the item is retrieved
- THEN `discountType` MUST be NONE and `discountValue` MUST be 0

#### Scenario: Order item with fixed discount
- GIVEN an order item with discountType FIXED and discountValue 5.00
- WHEN the item is retrieved
- THEN the response MUST include `discountType: "FIXED"` and `discountValue: 5.00`

#### Scenario: Account with percent discount
- GIVEN an account with discountType PERCENT and discountValue 10
- WHEN GET /accounts/:id is called
- THEN the response MUST include `discountType: "PERCENT"` and `discountValue: 10`

### Requirement: Centralized Discount Calculator
The system MUST provide a centralized calculation function in `packages/shared` that computes discounted totals. The function SHALL accept items (with quantity, unitPrice, discountType, discountValue) and account-level discount, and return `{ subtotal, itemDiscounts, afterItemDiscounts, accountDiscount, total }`.

#### Scenario: Calculate total with no discounts
- GIVEN items: [2x $15.00], account discount NONE
- WHEN calculateAccountTotal is called
- THEN the result MUST be `{ subtotal: 30.00, itemDiscounts: 0.00, afterItemDiscounts: 30.00, accountDiscount: 0.00, total: 30.00 }`

#### Scenario: Calculate total with fixed item discount
- GIVEN items: [2x $15.00 with fixed discount $5.00], account discount NONE
- WHEN calculateAccountTotal is called
- THEN the result MUST be `{ subtotal: 30.00, itemDiscounts: 5.00, afterItemDiscounts: 25.00, accountDiscount: 0.00, total: 25.00 }`

#### Scenario: Calculate total with percent item discount
- GIVEN items: [2x $20.00 with percent discount 10%], account discount NONE
- WHEN calculateAccountTotal is called
- THEN the result MUST be `{ subtotal: 40.00, itemDiscounts: 4.00, afterItemDiscounts: 36.00, accountDiscount: 0.00, total: 36.00 }`

#### Scenario: Calculate total with account percent discount
- GIVEN items: [2x $20.00], account discount 10% PERCENT
- WHEN calculateAccountTotal is called
- THEN the result MUST be `{ subtotal: 40.00, itemDiscounts: 0.00, afterItemDiscounts: 40.00, accountDiscount: 4.00, total: 36.00 }`

#### Scenario: Calculate total with both item and account discounts
- GIVEN items: [2x $20.00 with fixed discount $4.00], account discount 10% PERCENT
- WHEN calculateAccountTotal is called
- THEN the result MUST be `{ subtotal: 40.00, itemDiscounts: 4.00, afterItemDiscounts: 36.00, accountDiscount: 3.60, total: 32.40 }`

### Requirement: Item Discount Validation
The system MUST validate item discount params: `discountType` must be a valid enum value (NONE, FIXED, PERCENT); `discountValue` MUST be > 0 for FIXED; `discountValue` MUST be > 0 and ≤ 100 for PERCENT. Rejection SHALL return 400 with descriptive error.

#### Scenario: Invalid discount type rejected
- GIVEN an open account
- WHEN PATCH /accounts/:id/items/:itemId/discount with discountType "BOGO"
- THEN the system MUST return a 400 error

#### Scenario: Negative fixed discount rejected
- GIVEN an open account
- WHEN PATCH /accounts/:id/items/:itemId/discount with discountType FIXED, discountValue -5
- THEN the system MUST return a 400 error

#### Scenario: Percent discount over 100 rejected
- GIVEN an open account
- WHEN PATCH /accounts/:id/items/:itemId/discount with discountType PERCENT, discountValue 150
- THEN the system MUST return a 400 error

#### Scenario: Percent discount at 100 accepted
- GIVEN an open account
- WHEN PATCH /accounts/:id/items/:itemId/discount with discountType PERCENT, discountValue 100
- THEN the system MUST accept the discount (item becomes free)

#### Scenario: Clear discount by setting type NONE
- GIVEN an order item with discountType FIXED, discountValue 5.00
- WHEN PATCH /accounts/:id/items/:itemId/discount with discountType NONE
- THEN the system MUST clear the discount (discountType NONE, discountValue 0)

### Requirement: Account Discount Validation
The system MUST validate account discount params with the same rules as item discounts. Rejection SHALL return 400 with descriptive error.

#### Scenario: Invalid account discount type rejected
- GIVEN an open account
- WHEN PATCH /accounts/:id/discount with discountType "INVALID"
- THEN the system MUST return a 400 error

#### Scenario: Percent account discount over 100 rejected
- GIVEN an open account
- WHEN PATCH /accounts/:id/discount with discountType PERCENT, discountValue 200
- THEN the system MUST return a 400 error

### Requirement: Closed Account Rejects Discounts
The system MUST reject discount changes on closed accounts.

#### Scenario: Item discount on closed account
- GIVEN an account with status CLOSED
- WHEN PATCH /accounts/:id/items/:itemId/discount
- THEN the system MUST return a 400 error

#### Scenario: Account discount on closed account
- GIVEN an account with status CLOSED
- WHEN PATCH /accounts/:id/discount
- THEN the system MUST return a 400 error

### Requirement: WebSocket Broadcast on Discount Changes
The system MUST broadcast a `discount:updated` event via WebSocket after successful discount application. Event payload SHALL include the updated entity (account or item), recalculated totals, and new pending amount.

#### Scenario: WebSocket broadcast after item discount
- GIVEN an open account with pending $30.00
- WHEN a user applies a $5.00 fixed discount to an item
- THEN the system MUST emit a `discount:updated` event with payload `{ accountId, itemId, discountType, discountValue, total, pendingAmount }`

#### Scenario: WebSocket broadcast after account discount
- GIVEN an open account with pending $40.00
- WHEN a user applies a 10% account discount
- THEN the system MUST emit a `discount:updated` event with updated totals and pending amount
