export interface Position {
  x: number;
  y: number;
}

export function calculateFirstFreeSpace(
  existingPositions: Record<string, Position>,
  nodeWidth: number,
  nodeHeight: number
): Position {
  const existingCoords = new Set<string>();
  
  Object.values(existingPositions).forEach(pos => {
    const gridX = Math.round(pos.x / nodeWidth);
    const gridY = Math.round(pos.y / nodeHeight);
    existingCoords.add(`${gridX},${gridY}`);
  });

  let ring = 0;
  while (true) {
    if (ring === 0) {
      if (!existingCoords.has("0,0")) {
        return { x: 0, y: 0 };
      }
    } else {
      // Traverse top and bottom edges
      for (let x = -ring; x <= ring; x++) {
        if (!existingCoords.has(`${x},${-ring}`)) return { x: x * nodeWidth, y: -ring * nodeHeight };
        if (!existingCoords.has(`${x},${ring}`)) return { x: x * nodeWidth, y: ring * nodeHeight };
      }
      // Traverse left and right edges (excluding corners already checked)
      for (let y = -ring + 1; y < ring; y++) {
        if (!existingCoords.has(`${-ring},${y}`)) return { x: -ring * nodeWidth, y: y * nodeHeight };
        if (!existingCoords.has(`${ring},${y}`)) return { x: ring * nodeWidth, y: y * nodeHeight };
      }
    }
    ring++;
    if (ring > 50) {
      return { x: 0, y: 0 }; // Fallback to avoid infinite loop
    }
  }
}

export function recalculateBounds(
  positions: Record<string, Position>,
  _viewportWidth: number,
  _viewportHeight: number
): Record<string, Position> {
  // Simple constraint to prevent nodes from going completely out of bounds
  // For now, it returns positions as-is, can be expanded if needed
  return { ...positions };
}
