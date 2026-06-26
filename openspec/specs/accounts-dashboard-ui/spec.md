# Accounts Dashboard UI Specification

## Purpose
Vista principal con interacción de tipo canvas para visualización y organización espacial de cuentas activas (Mobile-First UI).

## Requirements

### Requirement: Canvas Rendering and Persistence
The system MUST render the dashboard as a touch-friendly canvas, displaying active accounts without relying on hover interactions, and persisting their (x, y) coordinates.

#### Scenario: Display persisted accounts
- GIVEN the user has active accounts with saved coordinates
- WHEN the dashboard is loaded
- THEN the accounts MUST be rendered exactly at their persisted (x,y) locations
- AND the touch targets MUST be large and high-contrast

### Requirement: Auto-positioning for New Accounts
The system MUST automatically calculate a position for new accounts to avoid overlapping.

#### Scenario: First free space or center
- GIVEN a new account is created
- WHEN it appears on the dashboard canvas
- THEN the system MUST find the first free spatial location
- AND place the new account there
- AND if no free space is found or calculation fails, it MUST place it in the exact center of the screen

### Requirement: Touch Interactions
The system MUST support touch-first interactions (tap and drag) without hover states.

#### Scenario: Moving an account
- GIVEN an account node on the canvas
- WHEN the user performs a drag gesture on a touch device
- THEN the account MUST follow the touch point
- AND persist its new location upon release
