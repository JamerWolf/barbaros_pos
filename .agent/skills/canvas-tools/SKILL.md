---
name: canvas-tools
description: "Trigger: canvas, drag, shapes, zoom, pan, lock, selection, account cards, DragNode, ShapeLayer, RectangleShape, LineShape, TextShape, CircleShape. Canvas tools patterns for Bárbaro's POS."
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

### LEGO Composition Pattern

Canvas objects compose hooks like LEGO pieces. Each shape picks what it needs:

```
🧱 useCanvasDrag      → body drag (moving the object)
🧱 useCanvasResize    → resize handles (changing size)
🧱 useCanvasRotate    → rotation handle (changing angle)
🧱 ResizeHandles      → JSX component for handle rendering
🧱 computeSnap        → snapping logic (alignment)
🧱 GuideLines         → snap line rendering
```

**Each shape composes its set:**

| Shape | drag | snap | resize | rotate | Notes |
|-------|------|------|--------|--------|-------|
| DragNode | ✅ | ✅ | 8 handles | ❌ | Cards: corners + sides |
| RectangleShape | ✅ | ✅ | 4 corners | ❌ | |
| TextShape | ✅ | ✅ | 4 corners | ✅ | Rotation at top center |
| LineShape | ✅ | ✅ | custom endpoint | ❌ | Different from resize |
| CircleShape (future) | ✅ | ✅ | 4 corners | ❌ | Use RectangleShape pattern |

### Shared Utilities (`utils/canvas/drag.ts`)

```tsx
import { screenToCanvas, calculateDragOffset, calculateDragPosition } from '...'

// Convert screen coords to canvas coords (accounts for zoom + pan)
const canvasCoords = screenToCanvas(clientX, clientY, parentRect, zoom)

// Calculate offset at drag start
const offset = calculateDragOffset(canvasCoords, shapePos)

// Calculate new position during drag (uses CURRENT pos, prevents drift)
const newPos = calculateDragPosition(canvasCoords, offset)
```

### Stores

| Store | Purpose | Persisted |
|-------|---------|-----------|
| `accountUIStore` | Positions, zoom, pan, card sizes, selection, lock | Yes (partial) |
| `shapeStore` | Shapes CRUD, active tool, editingShapeId | Partial (color only) |

**Never persist**: `selectionMode`, `selectedIds` (Set<string> doesn't serialize), `selectionSnapshot`.

## Patterns

### ShapeTool Types

| Tool | Shape | Drawing | Editing |
|------|-------|---------|---------|
| `rectangle` | RECTANGLE | Drag to define bounds | Drag handles to resize |
| `line` | LINE | Drag start → end | Drag endpoint handles |
| `text` | TEXT | Drag to define text box | Double-click to edit text |

### Adding a New Shape (e.g., CircleShape)

1. Create component using composable hooks:

```tsx
function CircleShape({ shape, isSelected, isLocked, onSelect, onMove, onResize }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({
    elementRef: nodeRef, zoom, isLocked: !!isLocked,
    onDragMove: (pos) => onMove?.(pos.x, pos.y),
    onTap: () => onSelect?.(),
  });

  const { resizeHandleProps } = useCanvasResize({
    elementRef: nodeRef, zoom, minWidth: 20, minHeight: 20,
    onResize: ({ width, height }) => onResize?.(shape.x, shape.y, width, height),
    onPositionChange: (pos) => onMove?.(pos.x, pos.y),
  });

  return (
    <div ref={nodeRef} onPointerDown={onPointerDown} ...>
      <svg> {/* render circle inscribed in bounding box */} </svg>
      {isSelected && !isLocked && (
        <ResizeHandles handles={['nw','ne','sw','se']} handleProps={resizeHandleProps} />
      )}
    </div>
  );
}
```

2. Add `'CIRCLE'` to `ShapeType` in `packages/shared/src/types/shape.ts`
3. Add `'circle'` to `ShapeTool` in `shapeStore.ts`
4. Add tool button in `DashboardPage.tsx`

### TextShape

```
Draw: select T tool → drag on canvas → textarea auto-focuses
Edit: double-click text shape → textarea appears
Save: blur, Escape, or click elsewhere
Cancel: Escape restores original text
Rotate: drag ↻ handle at top center → rotates around shape center
Format: toolbar appears above shape when selected
```

- `editingShapeId` in shapeStore tracks which text is being edited
- `onSelect` MUST be called AFTER `isLocked` check (same as other shapes)
- Text uses `shape.label` field (same as RectangleShape)
- Default color from `drawingColor` at creation time
- Resize handles: 4 corners (nw/ne/sw/se) via `ResizeHandles` component
- Rotation handle: ↻ icon at top center via `useCanvasRotate` hook
- **Rotation uses screen coords** via `getBoundingClientRect()` — NOT canvas coords (panOffset breaks angle calculation)

### TextToolbar

Floating toolbar above selected text shape. Fields:
- `fontFamily`: Arial, Calibri, Times New Roman, Courier New, Verdana, Georgia
- `fontSize`: 8–72px
- `bold`, `italic`, `underline`, `strikethrough`: boolean toggles
- `textAlign`: left, center, right

All fields stored in Prisma `Shape` model and persisted via API.

### DragNode (Account Cards)

```
onPointerDown → capture pointer → onPointerMove → update position
                                    ↓
                              if isSelected && selectedIds > 1
                                → movePositions(group, delta)
                              else
                                → updatePosition(id, newPos)
```

- Uses `useCanvasDrag` for body drag
- Uses `useCanvasResize` for 8 handles (corners + sides)
- Uses `ResizeHandles` component for handle rendering
- `canvasLocked` check at top of `onPointerDown` → early return
- Selection mode: tap = toggleSelection, drag = group move
- No selection mode: tap = onClick (navigate to account)

### CRITICAL: Shape Drag Coordinate Conversion

**The #1 recurring bug.** Use the shared utilities:

```tsx
import { screenToCanvas, calculateDragOffset, calculateDragPosition } from '...'

// ✅ CORRECT — uses shared utilities
const canvasCoords = screenToCanvas(e.clientX, e.clientY, parentRect, zoom)
const offset = calculateDragOffset(canvasCoords, shapePos)
const newPos = calculateDragPosition(canvasCoords, offset)

// ❌ WRONG — causes drift
const newX = (e.clientX - parentRect.left) / zoom - offset.x
```

**Why**: Using `origX/origY` (position at drag start) causes drift because the delta compounds. Using `calculateDragPosition` (current position) stays under the cursor.

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
6. **Shape drag delta**: ALWAYS use `calculateDragPosition(canvasCoords, offset)` which uses current position. NEVER use `newX - origX` (stale position) — causes drift.
7. **Rotation uses screen coords**: `getBoundingClientRect()` for center calculation, NOT canvas coords (panOffset breaks angle).

## File Reference

| File | Role |
|------|------|
| `apps/web/src/utils/canvas/drag.ts` | Shared drag utilities (screenToCanvas, calculateDragOffset, calculateDragPosition) |
| `apps/web/src/store/accountUIStore.ts` | UI state, positions, zoom, pan, selection, lock |
| `apps/web/src/store/shapeStore.ts` | Shapes CRUD, active tool, editingShapeId |
| `apps/web/src/components/canvas/CanvasContainer.tsx` | Canvas wrapper, panning, zoom, resize |
| `apps/web/src/components/canvas/useCanvasDrag.ts` | Body drag hook (with snap support) |
| `apps/web/src/components/canvas/useCanvasResize.ts` | Resize handles hook + getHandleStyle helper |
| `apps/web/src/components/canvas/useCanvasRotate.ts` | Rotation handle hook |
| `apps/web/src/components/canvas/ResizeHandles.tsx` | JSX component for rendering handles |
| `apps/web/src/components/canvas/DragNode.tsx` | Account card drag/select/resize |
| `apps/web/src/components/canvas/shapes/ShapeLayer.tsx` | Shape drawing + event routing |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | Rectangle move/resize |
| `apps/web/src/components/canvas/shapes/LineShape.tsx` | Line move/endpoint drag |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | Text editable shape with formatting + rotation |
| `apps/web/src/components/canvas/shapes/TextToolbar.tsx` | Text formatting toolbar |
| `apps/web/src/components/canvas/GuideLines.tsx` | Snap guide line rendering |
| `apps/web/src/utils/snapAlignment.ts` | Snap computation logic |
| `apps/web/src/pages/DashboardPage.tsx` | Toolbar, mode toggles, shape tools |
