export interface Position {
  x: number;
  y: number;
}

/**
 * Convert screen coordinates to canvas coordinates.
 * The canvas has zoom + pan, so we need to divide by zoom and subtract the parent offset.
 *
 * @param clientX - Mouse/touch X in screen space
 * @param clientY - Mouse/touch Y in screen space
 * @param parentRect - getBoundingClientRect() of the UNTRANSFORMED parent div
 * @param zoom - Current canvas zoom level
 * @returns Position in canvas space
 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  parentRect: DOMRect,
  zoom: number
): Position {
  return {
    x: (clientX - parentRect.left) / zoom,
    y: (clientY - parentRect.top) / zoom,
  };
}

/**
 * Calculate the offset between the mouse position and the shape's current position.
 * This offset is captured on pointerDown and reused on every pointerMove.
 *
 * @param canvasCoords - Mouse position in canvas space (from screenToCanvas)
 * @param shapePos - Shape's current position ({ x, y })
 * @returns Offset to subtract from future canvasCoords
 */
export function calculateDragOffset(
  canvasCoords: Position,
  shapePos: Position
): Position {
  return {
    x: canvasCoords.x - shapePos.x,
    y: canvasCoords.y - shapePos.y,
  };
}

/**
 * Calculate the new shape position during a drag.
 * Uses the CURRENT shape position (not the drag-start position) to prevent drift.
 *
 * @param canvasCoords - Mouse position in canvas space (from screenToCanvas)
 * @param offset - Offset from pointerDown (from calculateDragOffset)
 * @returns New position for the shape
 */
export function calculateDragPosition(
  canvasCoords: Position,
  offset: Position
): Position {
  return {
    x: canvasCoords.x - offset.x,
    y: canvasCoords.y - offset.y,
  };
}
