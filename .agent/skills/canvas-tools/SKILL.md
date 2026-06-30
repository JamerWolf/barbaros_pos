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

### ShapeTool Types

| Tool | Shape | Drawing | Editing |
|------|-------|---------|---------|
| `rectangle` | RECTANGLE | Drag to define bounds | Drag handles to resize |
| `line` | LINE | Drag start → end | Drag endpoint handles |
| `text` | TEXT | Drag to define text box | Double-click to edit text |

### TextShape

```
Draw: select T tool → drag on canvas → textarea auto-focuses
Edit: double-click text shape → textarea appears
Save: blur, Escape, or click elsewhere
Cancel: Escape restores original text
Rotate: drag ↻ handle at top center → rotates around shape center
```

- `editingShapeId` in shapeStore tracks which text is being edited
- `onSelect` MUST be called AFTER `isLocked` check (same as other shapes)
- Text uses `shape.label` field (same as RectangleShape)
- Default color from `drawingColor` at creation time
- Resize handles: 4 corners (nw/ne/sw/se), same as RectangleShape
- Rotation handle: ↻ icon at top center, rotates around `transformOrigin: center center`
- Rotation formula: `getAngle(centerX, centerY, mouseX, mouseY)` → delta from start angle

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

### CRITICAL: Shape Drag Coordinate Conversion

**The #1 recurring bug.** All shape components MUST follow this exact pattern:

```tsx
// onPointerDown — calculate offset
const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
const offset = parentRect
  ? {
      x: (e.clientX - parentRect.left) / zoom - shape.x,
      y: (e.clientY - parentRect.top) / zoom - shape.y,
    }
  : { x: 0, y: 0 };

// onPointerMove — use CURRENT shape.x/y, NOT origX/origY
const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
const newX = (e.clientX - parentRect.left) / zoom - offset.x;
const newY = (e.clientY - parentRect.top) / zoom - offset.y;
onMove?.(newX - shape.x, newY - shape.y); // delta from CURRENT position
```

**Why**: Using `origX/origY` (position at drag start) causes drift because the delta compounds. Using `shape.x/shape.y` (current position) stays under the cursor.

**NEVER**:
```tsx
// WRONG — causes drift
const dx = newX - origX;  // origX is stale after first move event
onMove?.(dx, dy);
```

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
6. **Shape drag delta**: ALWAYS use `newX - shape.x` (current position), NEVER `newX - origX` (stale position). Using origX causes drift.

## File Reference

| File | Role |
|------|------|
| `apps/web/src/store/accountUIStore.ts` | UI state, positions, zoom, pan, selection, lock |
| `apps/web/src/store/shapeStore.ts` | Shapes CRUD, active tool, editingShapeId |
| `apps/web/src/components/canvas/CanvasContainer.tsx` | Canvas wrapper, panning, zoom, resize |
| `apps/web/src/components/canvas/DragNode.tsx` | Account card drag/select |
| `apps/web/src/components/canvas/shapes/ShapeLayer.tsx` | Shape drawing + event routing |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | Rectangle move/resize |
| `apps/web/src/components/canvas/shapes/LineShape.tsx` | Line move/resize |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | Text editable shape |
| `apps/web/src/pages/DashboardPage.tsx` | Toolbar, mode toggles, shape tools |
