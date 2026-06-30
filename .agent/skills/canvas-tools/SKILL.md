---
name: canvas-tools
description: "Trigger: canvas, drag, shapes, zoom, pan, lock, selection, account cards, DragNode, ShapeLayer, RectangleShape, LineShape. Canvas tools patterns for Bárbaro's POS."
---

# Canvas Tools

## Architecture

### Two-Layer Event System

The canvas uses a two-layer architecture for correct coordinate conversion:

```
CanvasContainer
├── Transformed div (scale + translate)  ← children (DragNodes)
└── Untransformed div (absolute)         ← ShapeLayer (events layer)
    └── Transformed div                  ← ShapeLayer (render layer)
```

**Why**: Shapes need `getBoundingClientRect()` on their event-catching div to get correct screen coords. If the event div is transformed, coords are wrong.

### Stores

| Store | Purpose | Persisted |
|-------|---------|-----------|
| `accountUIStore` | Positions, zoom, pan, card sizes, selection, lock | Yes (partial) |
| `shapeStore` | Shapes CRUD, active tool, drawing color | Partial (color only) |

**Never persist**: `selectionMode`, `selectedIds` (Set<string> doesn't serialize), `selectionSnapshot`.

## Patterns

### DragNode (Account Cards)

```
onPointerDown → capture pointer → onPointerMove → update position
                                    ↓
                              if isSelected && selectedIds > 1
                                → movePositions(group, delta)
                              else
                                → updatePosition(id, newPos)
```

- Uses `parentElement.getBoundingClientRect()` for position calc (not delta/zoom)
- `canvasLocked` check at top of `onPointerDown` → early return
- Selection mode: tap = toggleSelection, drag = group move
- No selection mode: tap = onClick (navigate to account)

### ShapeLayer (Drawing Shapes)

Two separate `useCallback` hooks:

1. **handlePointerDown** — drawing new shapes (rectangle/line)
   - Guarded by `canvasLocked`
   - Converts screen coords to canvas coords via `screenToCanvas()`
   - Creates shape on pointer up

2. **onPointerDown** (inside each shape) — moving/resizing existing shapes
   - Guarded by `isLocked` prop
- **onSelect** MUST be called AFTER `isLocked` check (first-edit bug fix)

### Shape Components (RectangleShape, LineShape)

```tsx
// CORRECT — isLocked check BEFORE onSelect
<div onPointerDown={(e) => {
  if (isLocked) return;   // ← MUST be first
  onSelect?.();
  onPointerDown(e, 'move');
}}>
```

```tsx
// WRONG — onSelect fires even when locked
<div onPointerDown={(e) => {
  onSelect?.();           // ← shape gets selected, handles appear
  onPointerDown(e, 'move'); // ← blocked but too late
}}>
```

### Canvas Lock (`canvasLocked`)

When locked:
- ❌ DragNode: no drag (early return in onPointerDown)
- ❌ ShapeLayer: no drawing (early return in handlePointerDown)
- ❌ Shape move/resize (early return in onPointerDown + isLocked prop)
- ❌ Shape selection (isLocked check before onSelect)
- ❌ Shape tools disabled (opacity 50%, onClick blocked)
- ✅ Panning still works
- ✅ Zoom still works
- ✅ Clicking shapes does nothing

Lock button clears: activeTool, selectionMode, selectedShapeId.

### Card Sizes (S/M/L)

- `cardSize` = global default for NEW accounts
- `cardSizes[id]` = per-account override (frozen at creation)
- `getCardSize(id)` returns `cardSizes[id] ?? cardSize`
- `setCardSize(size)`:
  - If selectionMode + selectedIds → updates global + selected cards
  - Otherwise → updates global only (new accounts)
- `assignInitialPosition()` and `assignPositionsBatch()` freeze size: `cardSizes[id] = state.cardSize`

### Selection Mode + Snapshot

1. Enter: `saveSelectionSnapshot()` → saves `{ nodePositions, cardSizes }`
2. Cancel: `restoreSelectionSnapshot()` → restores saved state
3. Confirm: `clearSelection()` + `setSelectionMode(false)` → keeps current state

### Canvas Panning

- Only starts if `e.target === containerRef.current` (empty canvas area)
- Blocked when `activeTool` is set (drawing mode)
- Uses `setPointerCapture` for smooth drag

### Zoom-to-Cursor

```
newPanX = mouseX/newZoom - mouseX/oldZoom + oldPanX
```

Formula ensures point under cursor stays fixed.

### fitToContent

- Computes bounding box of ALL cards + shapes
- Adjusts zoom + pan to fit content in viewport
- `fit()` reads shapes via `useShapeStore.getState()` (not as dependency) to avoid re-fit on shape moves
- Called on mount, resize, and via "Ajustar" button

## Gotchas

1. **Set<string> serialization**: `selectedIds` uses Set, excluded from persist. Rehydrate sets it to empty.
2. **CRLF warnings**: Windows line endings in git diff — harmless.
3. **Shape drag uses parentElement**: Both DragNode and shapes use `parentElement.getBoundingClientRect()` — the parent is the untransformed canvas container.
4. **LineShape points**: Stored as `shape.points[]`, resized by dragging endpoints (not width/height like RectangleShape).
5. **Per-card size freeze**: New accounts get `cardSizes[id] = cardSize` at creation. Changing global default later doesn't affect them.

## File Reference

| File | Role |
|------|------|
| `apps/web/src/store/accountUIStore.ts` | UI state, positions, zoom, pan, selection, lock |
| `apps/web/src/store/shapeStore.ts` | Shapes CRUD, active tool |
| `apps/web/src/components/canvas/CanvasContainer.tsx` | Canvas wrapper, panning, zoom, resize |
| `apps/web/src/components/canvas/DragNode.tsx` | Account card drag/select |
| `apps/web/src/components/canvas/shapes/ShapeLayer.tsx` | Shape drawing + event routing |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | Rectangle move/resize |
| `apps/web/src/components/canvas/shapes/LineShape.tsx` | Line move/resize |
| `apps/web/src/pages/DashboardPage.tsx` | Toolbar, mode toggles, shape tools |
