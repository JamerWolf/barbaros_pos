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
The system MUST handle account closures based on the balance computed from OrderItems.
The system MUST physically delete the account if closed with a $0 balance.

#### Scenario: Close account with $0 balance
- GIVEN an open account with items totaling $0
- WHEN a user requests to close the account
- THEN the system MUST physically delete the account from the database

#### Scenario: Close account with non-zero balance
- GIVEN an open account with items totaling greater than $0
- WHEN a user requests to close the account
- THEN the system MUST change the account status to `CLOSED`

### Requirement: Total Computed from OrderItems
The system MUST compute the account total from its OrderItems, not from a stored value.
The total SHALL be `SUM(orderItems.quantity * orderItems.unitPrice)`.

#### Scenario: Total reflects current items
- GIVEN an account with 2 items: 2x $15.00 and 1x $8.00
- WHEN the total is computed
- THEN the system MUST return $38.00

#### Scenario: Total updates after item mutation
- GIVEN an account with a total of $38.00
- WHEN a user removes the $8.00 item
- THEN the system MUST recompute the total as $30.00

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