# Shift Controls UI Specification

## Purpose
Controles vinculados a los turnos que incluyen el hook para la limpieza de coordenadas huérfanas en el canvas.

## Requirements

### Requirement: Orphaned Coordinates Cleanup
The system MUST automatically clean up stale canvas layout data when a new shift starts.

#### Scenario: Starting a new shift
- GIVEN the local storage contains layout coordinates for closed accounts
- WHEN the user initiates the "open shift" action via shift controls
- THEN the system MUST purge all coordinates associated with inactive account IDs
- AND retain only the settings necessary for the active session

### Requirement: Touch-Friendly Shift Actions
The system MUST expose shift actions (open/close) as prominent, high-contrast touch targets.

#### Scenario: Executing a shift action
- GIVEN the shift controls menu is accessed
- WHEN the user taps "Close Shift"
- THEN the system MUST show a clear, high-contrast confirmation dialog
- AND process the action upon confirmation
