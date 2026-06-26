# Account Detail UI Specification

## Purpose
Vista de detalle para visualizar y operar sobre los ítems de una cuenta específica de manera rápida y táctil.

## Requirements

### Requirement: Mobile-First Detail View
The system MUST provide a high-contrast, touch-optimized view for account details, enabling fast workflows.

#### Scenario: Viewing account details
- GIVEN an active account
- WHEN the user taps on the account from the dashboard
- THEN the system MUST navigate to the detail view
- AND display large, readable text and buttons without hover dependencies

### Requirement: Fast Item Operations
The system MUST allow rapid addition or modification of items within the account.

#### Scenario: Adding an item
- GIVEN the account detail view is open
- WHEN the user taps a product in the grid
- THEN the system MUST add 1 unit of that product to the account
- AND accumulate quantity if the product already exists (x2, x3, etc.)
- AND update the total immediately (optimistic UI)

#### Scenario: Decrementing an item
- GIVEN the account has items with quantity > 1
- WHEN the user taps the delete button on an item
- THEN the system MUST decrement the quantity by 1
- AND update the total immediately

#### Scenario: Removing an item at quantity 1
- GIVEN an item has quantity = 1
- WHEN the user taps the delete button
- THEN the system MUST remove the item entirely from the list
- AND update the total immediately

### Requirement: Product Selection
The system MUST provide a searchable product grid with category filtering.

#### Scenario: Quick products view
- GIVEN the account detail page is open
- WHEN the page loads
- THEN the system MUST show the top 5 active products by default

#### Scenario: Expand full catalog
- GIVEN quick products are shown
- WHEN the user taps "Ver más productos"
- THEN the system MUST expand to show all active products

#### Scenario: Search and filter
- GIVEN the full product catalog is visible
- WHEN the user types in the search bar or taps a category tab
- THEN the system MUST filter products by name and/or category in real-time

### Requirement: Close Account
The system MUST provide a close account button always visible at the top.

#### Scenario: Close with $0 total
- GIVEN the account total is $0
- WHEN the user taps "Cerrar cuenta"
- THEN the system MUST show a confirmation dialog
- AND on confirm, DELETE the account

#### Scenario: Close with non-zero total
- GIVEN the account total is > $0
- WHEN the user taps "Cerrar cuenta"
- THEN the system MUST show a confirmation dialog
- AND on confirm, PUT /accounts/:id/close to set status CLOSED

### Requirement: Real-time Updates
The system MUST reflect item changes across all connected clients via WebSocket.

#### Scenario: Item added by another user
- GIVEN two users have the same account open
- WHEN user A adds an item
- THEN user B MUST see the new item and updated total without refresh
