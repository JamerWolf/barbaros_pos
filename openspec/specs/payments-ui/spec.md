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
