/**
 * Snap alignment utilities for canvas objects.
 * Cards snap to cards, shapes snap to shapes. No cross-snap.
 */

export interface SnapBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  x?: number;
  y?: number;
  label?: string;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

const THRESHOLD = 5; // canvas pixels

/**
 * Compute snap offset and active guides for a dragged object
 * against a set of candidate objects (same type only).
 *
 * @param dragged - bounds of the object being dragged
 * @param candidates - bounds of all other objects of the same type
 * @returns snap adjustment (dx, dy) and active guide lines
 */
export function computeSnap(
  dragged: SnapBounds,
  candidates: SnapBounds[]
): SnapResult {
  let bestDx = 0;
  let bestDy = 0;
  let minDistX = THRESHOLD + 1;
  let minDistY = THRESHOLD + 1;
  const guides: SnapGuide[] = [];

  const draggedRight = dragged.left + dragged.width;
  const draggedBottom = dragged.top + dragged.height;
  const draggedCenterX = dragged.left + dragged.width / 2;
  const draggedCenterY = dragged.top + dragged.height / 2;

  // Vertical alignment checks (x-axis)
  const dragXEdges = [
    { pos: dragged.left, label: 'left' },
    { pos: draggedCenterX, label: 'center' },
    { pos: draggedRight, label: 'right' },
  ];

  // Horizontal alignment checks (y-axis)
  const dragYEdges = [
    { pos: dragged.top, label: 'top' },
    { pos: draggedCenterY, label: 'middle' },
    { pos: draggedBottom, label: 'bottom' },
  ];

  for (const c of candidates) {
    const cRight = c.left + c.width;
    const cBottom = c.top + c.height;
    const cCenterX = c.left + c.width / 2;
    const cCenterY = c.top + c.height / 2;

    const targetXEdges = [c.left, cCenterX, cRight];
    const targetYEdges = [c.top, cCenterY, cBottom];

    // Check vertical alignment (x-axis snap)
    for (const de of dragXEdges) {
      for (const tx of targetXEdges) {
        const dist = Math.abs(de.pos - tx);
        if (dist < minDistX) {
          minDistX = dist;
          bestDx = tx - de.pos;
        }
      }
    }

    // Check horizontal alignment (y-axis snap)
    for (const de of dragYEdges) {
      for (const ty of targetYEdges) {
        const dist = Math.abs(de.pos - ty);
        if (dist < minDistY) {
          minDistY = dist;
          bestDy = ty - de.pos;
        }
      }
    }
  }

  // Build guide lines for the best snaps
  if (minDistX <= THRESHOLD) {
    const snappedLeft = dragged.left + bestDx;
    const snappedRight = draggedRight + bestDx;
    const snappedCenter = draggedCenterX + bestDx;

    // Find which edge snapped to build the guide line position
    for (const de of dragXEdges) {
      for (const c of candidates) {
        const cEdges = [c.left, c.left + c.width / 2, c.left + c.width];
        for (const tx of cEdges) {
          if (Math.abs((de.pos + bestDx) - tx) < 0.5) {
            guides.push({ type: 'vertical', x: tx });
          }
        }
      }
    }
  }

  if (minDistY <= THRESHOLD) {
    for (const de of dragYEdges) {
      for (const c of candidates) {
        const cEdges = [c.top, c.top + c.height / 2, c.top + c.height];
        for (const ty of cEdges) {
          if (Math.abs((de.pos + bestDy) - ty) < 0.5) {
            guides.push({ type: 'horizontal', y: ty });
          }
        }
      }
    }
  }

  // Deduplicate guides
  const uniqueGuides = guides.filter((g, i, arr) =>
    arr.findIndex((g2) =>
      g.type === g2.type && g.x === g2.x && g.y === g2.y
    ) === i
  );

  return {
    dx: minDistX <= THRESHOLD ? bestDx : 0,
    dy: minDistY <= THRESHOLD ? bestDy : 0,
    guides: uniqueGuides,
  };
}

/**
 * Compute the bounding box of multiple objects (for group selection snap).
 */
export function computeGroupBounds(
  items: { x: number; y: number; width: number; height: number }[]
): SnapBounds {
  if (items.length === 0) return { left: 0, top: 0, width: 0, height: 0 };

  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const item of items) {
    minLeft = Math.min(minLeft, item.x);
    minTop = Math.min(minTop, item.y);
    maxRight = Math.max(maxRight, item.x + item.width);
    maxBottom = Math.max(maxBottom, item.y + item.height);
  }

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
}
