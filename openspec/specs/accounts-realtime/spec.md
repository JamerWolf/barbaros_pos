# Accounts Realtime Specification

## Purpose
Sincronización de estado de cuentas vía WebSockets y manejo de reconexiones en la UI.

## Requirements

### Requirement: Realtime Synchronization
The system MUST emit WebSocket events upon successful account mutations.

#### Scenario: Successful mutation emits event
- GIVEN a connected WebSocket client
- WHEN an account is successfully mutated via REST
- THEN the system MUST emit a corresponding event via Socket.io
- AND the frontend client MUST update its local Zustand state

### Requirement: Reconnection Refetch
The frontend client MUST perform a full state synchronization upon WebSocket reconnection.

#### Scenario: Client reconnects after network drop
- GIVEN a WebSocket client that was disconnected
- WHEN the client successfully reconnects (`connect` event)
- THEN the frontend client MUST execute a `GET /accounts` request
- AND the frontend client MUST replace its local Zustand state with the fetched data