# Discounts UI Specification

## Purpose
Collapsible discount section in PaymentModal for applying item-level and account-level discounts with type selection, value input, and live total preview. Mobile-first, touch-friendly, dark theme.

## Requirements

### Requirement: Collapsible Discount Section in PaymentModal
The system MUST provide a collapsible/toggleable section in PaymentModal labeled "Apply Discount". Section MUST be collapsed by default. Toggle button MUST be touch-friendly (min h-12). Section content includes discount type selector, value input, and preview.

#### Scenario: Discount section hidden by default
- GIVEN a user opens the PaymentModal for an account
- WHEN the modal renders
- THEN the discount section MUST be collapsed (hidden)

#### Scenario: Toggle reveals discount section
- GIVEN the PaymentModal with collapsed discount section
- WHEN a user taps the "Apply Discount" toggle button
- THEN the discount section MUST expand and show type selector and value input

#### Scenario: Toggle hides discount section
- GIVEN the PaymentModal with expanded discount section
- WHEN a user taps the toggle button again
- THEN the discount section MUST collapse

### Requirement: Discount Type Selector
The system MUST present a segmented/toggle control to select discount type: "Fixed ($)" or "Percent (%)". Default selection SHALL be "Fixed ($)". Selection MUST be visually clear with high contrast on dark theme.

#### Scenario: Default type is Fixed
- GIVEN the discount section is expanded
- WHEN the section renders
- THEN "Fixed ($)" MUST be the selected/default type

#### Scenario: Switch to Percent type
- GIVEN the discount section with "Fixed ($)" selected
- WHEN a user taps "Percent (%)"
- THEN the type MUST change to PERCENT and input placeholder MUST update to "%"

#### Scenario: Switch back to Fixed type
- GIVEN the discount section with "Percent (%)" selected
- WHEN a user taps "Fixed ($)"
- THEN the type MUST change to FIXED and input placeholder MUST update to "$"

### Requirement: Discount Value Input
The system MUST provide a numeric input for discount value. Input MUST accept positive integers only. For FIXED type: value represents peso amount. For PERCENT type: value represents percentage (0-100). Input MUST be touch-friendly with large hit area.

#### Scenario: Enter fixed discount value
- GIVEN the discount section with FIXED type selected
- WHEN a user enters "5000"
- THEN the system MUST register a $5,000 fixed discount

#### Scenario: Enter percent discount value
- GIVEN the discount section with PERCENT type selected
- WHEN a user enters "10"
- THEN the system MUST register a 10% discount

#### Scenario: Percent value capped at 100
- GIVEN the discount section with PERCENT type selected
- WHEN a user enters "150"
- THEN the system MUST reject the value and show validation error

### Requirement: Live Total Preview
The system MUST display a live preview of the adjusted total as the user enters discount values. Preview MUST update on every keystroke/input change. Format MUST use Colombian peso format (no cents, period as thousands separator, dollar sign prefix).

#### Scenario: Preview updates for fixed discount
- GIVEN an account with total $50,000 and FIXED type selected
- WHEN a user enters "5000" in the value input
- THEN the preview MUST show "Total: $45.000" and the pending amount MUST update accordingly

#### Scenario: Preview updates for percent discount
- GIVEN an account with total $100,000 and PERCENT type selected
- WHEN a user enters "10" in the value input
- THEN the preview MUST show "Total: $90.000" and the pending amount MUST update accordingly

#### Scenario: Preview resets when discount cleared
- GIVEN an account with a $5,000 fixed discount applied and total showing $45,000
- WHEN a user clears the discount (sets type to NONE)
- THEN the preview MUST revert to showing the original total "Total: $50.000"

### Requirement: Apply Discount Action
The system MUST provide an "Apply" button to confirm and save the discount. Button MUST be disabled when discount section is empty or invalid. Button MUST be touch-friendly (min h-12). On success, the modal MUST show the updated account total and pending amount.

#### Scenario: Apply button disabled with no input
- GIVEN the discount section is expanded with no value entered
- WHEN the modal renders
- THEN the "Apply" button MUST be disabled

#### Scenario: Apply button enabled with valid input
- GIVEN the discount section with FIXED type and value 5000
- WHEN the modal renders
- THEN the "Apply" button MUST be enabled

#### Scenario: Successful discount application
- GIVEN an account with total $50,000 and a valid $5,000 fixed discount entered
- WHEN a user taps "Apply"
- THEN the system MUST save the discount, update the total to $45,000, and refresh the payment section with new pending amount

### Requirement: Existing Discount Display
The system MUST display any existing discount when the discount section is expanded. If a discount is already applied, the section MUST show the current type and value pre-filled. User MAY modify or clear existing discount.

#### Scenario: Existing fixed discount displayed
- GIVEN an account with an existing $3,000 fixed discount
- WHEN the discount section is expanded
- THEN the input MUST show "3000" and type MUST be "Fixed ($)"

#### Scenario: Existing percent discount displayed
- GIVEN an account with an existing 15% discount
- WHEN the discount section is expanded
- THEN the input MUST show "15" and type MUST be "Percent (%)"

### Requirement: Mobile-First Touch Design
The system MUST follow mobile-first UI conventions: all interactive elements MUST have min h-12 hit targets, high contrast on dark background, and smooth collapse/expand animations. Layout MUST work on 320px minimum width.

#### Scenario: Touch targets adequate on small screen
- GIVEN a device with 320px width
- WHEN the discount section is rendered
- THEN all buttons and inputs MUST be tappable without accidental touches

#### Scenario: High contrast on dark theme
- GIVEN the dark theme POS background
- WHEN the discount section renders
- THEN text and controls MUST have sufficient contrast ratio (minimum 4.5:1)
