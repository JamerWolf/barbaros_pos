import { useState, useRef, useCallback, useEffect } from 'react';
import { useShapeStore } from '../../../store/shapeStore.js';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { RectangleShape } from './RectangleShape.jsx';
import { LineShape } from './LineShape.jsx';
import { TextShape } from './TextShape.jsx';
import { computeSnap, type SnapBounds } from '../../../utils/snapAlignment.js';

export function ShapeLayer(): JSX.Element {
  const { shapes, activeTool, drawingColor, selectedShapeId, editingShapeId, loadShapes, addShape, updateShape, deleteShape, setActiveTool, setSelectedShapeId, setEditingShapeId } = useShapeStore();
  const { zoom, panOffset, shapesLocked } = useAccountUIStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  // Load shapes on mount
  useEffect(() => {
    loadShapes();
  }, [loadShapes]);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!layerRef.current) return { x: 0, y: 0 };
      const rect = layerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left) / zoom - panOffset.x,
        y: (screenY - rect.top) / zoom - panOffset.y,
      };
    },
    [zoom, panOffset]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!layerRef.current || shapesLocked) return;

      // When a tool is active, start drawing
      if (activeTool) {
        e.stopPropagation();
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        setIsDrawing(true);
        setDrawStart(canvasPos);
        setDrawCurrent(canvasPos);
        setSelectedShapeId(null);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      // When no tool is active, let the event propagate for panning
      // Shape clicks are handled by each shape's own onSelect
    },
    [activeTool, screenToCanvas, shapesLocked]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing) return;
      setDrawCurrent(screenToCanvas(e.clientX, e.clientY));
    },
    [isDrawing, screenToCanvas]
  );

  const handlePointerUp = useCallback(async () => {
    if (!activeTool || !drawStart || !drawCurrent) return;

    const currentShapes = useShapeStore.getState().shapes;
    const maxZ = currentShapes.length > 0 ? Math.max(...currentShapes.map((s) => s.zIndex)) : 0;
    const nextZ = maxZ + 1;

    if (activeTool === 'rectangle') {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);

      if (width > 5 && height > 5) {
        await addShape({
          type: 'RECTANGLE',
          x,
          y,
          width,
          height,
          color: drawingColor,
          zIndex: nextZ,
        });
      }
    } else if (activeTool === 'line') {
      const dx = drawCurrent.x - drawStart.x;
      const dy = drawCurrent.y - drawStart.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        await addShape({
          type: 'LINE',
          x: drawStart.x,
          y: drawStart.y,
          width: 0,
          height: 0,
          points: [drawStart, drawCurrent],
          color: drawingColor,
          zIndex: nextZ,
        });
      }
    } else if (activeTool === 'text') {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.max(Math.abs(drawCurrent.x - drawStart.x), 80);
      const height = Math.max(Math.abs(drawCurrent.y - drawStart.y), 32);

      const newShape = await addShape({
        type: 'TEXT',
        x,
        y,
        width,
        height,
        label: '',
        color: drawingColor,
        zIndex: nextZ,
      });
      setEditingShapeId(newShape.id);
      setActiveTool(null);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  }, [activeTool, drawStart, drawCurrent, drawingColor, addShape]);

  const handleShapeMove = useCallback((id: string, x: number, y: number) => {
    const currentShapes = useShapeStore.getState().shapes;
    const shape = currentShapes.find((s) => s.id === id);
    if (!shape) return;

    // Compute snap against other shapes
    const getShapeBounds = (s: typeof shape): SnapBounds => ({
      left: s.x,
      top: s.y,
      width: s.width,
      height: s.height,
    });

    const draggedBounds = getShapeBounds({ ...shape, x, y });
    const otherBounds = currentShapes
      .filter((s) => s.id !== id)
      .map(getShapeBounds);

    const snapResult = computeSnap(draggedBounds, otherBounds);
    const snappedX = x + snapResult.dx;
    const snappedY = y + snapResult.dy;

    // Update guides
    useAccountUIStore.getState().setActiveGuides(snapResult.guides);

    if (shape.type === 'RECTANGLE' || shape.type === 'TEXT') {
      updateShape(id, { x: snappedX, y: snappedY });
    } else if (shape.type === 'LINE' && shape.points) {
      const ddx = snappedX - shape.x;
      const ddy = snappedY - shape.y;
      updateShape(id, {
        x: snappedX, y: snappedY,
        points: shape.points.map((p) => ({ x: p.x + ddx, y: p.y + ddy })),
      });
    }
  }, [updateShape]);

  const handleShapeResize = useCallback((id: string, x: number, y: number, width: number, height: number, points?: { x: number; y: number }[]) => {
    if (points) {
      updateShape(id, { x, y, width, height, points });
    } else {
      updateShape(id, { x, y, width, height });
    }
  }, [updateShape]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool(null);
        setSelectedShapeId(null);
      } else if (e.key === 'Delete' && selectedShapeId) {
        deleteShape(selectedShapeId);
        setSelectedShapeId(null);
      }
    },
    [setActiveTool, selectedShapeId, deleteShape, setSelectedShapeId]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Draw preview rectangle
  const previewRect =
    isDrawing && drawStart && drawCurrent && activeTool === 'rectangle'
      ? {
          x: Math.min(drawStart.x, drawCurrent.x),
          y: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null;

  // Draw preview line
  const previewLine =
    isDrawing && drawStart && drawCurrent && activeTool === 'line'
      ? { start: drawStart, end: drawCurrent }
      : null;

  // Draw preview text box
  const previewText =
    isDrawing && drawStart && drawCurrent && activeTool === 'text'
      ? {
          x: Math.min(drawStart.x, drawCurrent.x),
          y: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null;

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 ${activeTool ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
      style={{ zIndex: 10 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Transformed layer — renders shapes and previews in canvas space */}
      <div
        style={{
          transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
        }}
        className="absolute left-0 top-0 h-full w-full origin-top-left"
      >
        {/* Rendered shapes */}
        {shapes.map((shape) => {
          const isInteractive = !activeTool;
          if (shape.type === 'RECTANGLE') {
            return (
              <RectangleShape
                key={shape.id}
                shape={shape}
                isSelected={selectedShapeId === shape.id}
                isLocked={shapesLocked}
                interactive={isInteractive}
                onSelect={() => setSelectedShapeId(shape.id)}
                onMove={(dx, dy) => handleShapeMove(shape.id, dx, dy)}
                onResize={(x, y, w, h) => handleShapeResize(shape.id, x, y, w, h)}
              />
            );
          }
          if (shape.type === 'LINE') {
            return (
              <LineShape
                key={shape.id}
                shape={shape}
                isSelected={selectedShapeId === shape.id}
                isLocked={shapesLocked}
                interactive={isInteractive}
                onSelect={() => setSelectedShapeId(shape.id)}
                onMove={(dx, dy) => handleShapeMove(shape.id, dx, dy)}
                onResize={(x, y, w, h, pts) => handleShapeResize(shape.id, x, y, w, h, pts)}
              />
            );
          }
          if (shape.type === 'TEXT') {
            return (
              <TextShape
                key={shape.id}
                shape={shape}
                isSelected={selectedShapeId === shape.id}
                isLocked={shapesLocked}
                isEditing={editingShapeId === shape.id}
                interactive={isInteractive}
                onSelect={() => setSelectedShapeId(shape.id)}
                onStartEdit={() => setEditingShapeId(shape.id)}
                onStopEdit={() => setEditingShapeId(null)}
                onMove={(dx, dy) => handleShapeMove(shape.id, dx, dy)}
                onResize={(x, y, w, h) => handleShapeResize(shape.id, x, y, w, h)}
                onRotate={(degrees) => updateShape(shape.id, { rotation: degrees })}
              />
            );
          }
          return null;
        })}

        {/* Preview rectangle while drawing */}
        {previewRect && (
          <div
            className="pointer-events-none border-2 border-dashed"
            style={{
              position: 'absolute',
              left: previewRect.x,
              top: previewRect.y,
              width: previewRect.width,
              height: previewRect.height,
              backgroundColor: `${drawingColor}22`,
              borderColor: drawingColor,
            }}
          />
        )}

        {/* Preview line while drawing */}
        {previewLine && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1={previewLine.start.x}
              y1={previewLine.start.y}
              x2={previewLine.end.x}
              y2={previewLine.end.y}
              stroke={drawingColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="6 3"
            />
            <circle cx={previewLine.start.x} cy={previewLine.start.y} r="4" fill={drawingColor} />
            <circle cx={previewLine.end.x} cy={previewLine.end.y} r="4" fill={drawingColor} />
          </svg>
        )}

        {/* Preview text box while drawing */}
        {previewText && (
          <div
            className="pointer-events-none border-2 border-dashed"
            style={{
              position: 'absolute',
              left: previewText.x,
              top: previewText.y,
              width: previewText.width,
              height: previewText.height,
              borderColor: drawingColor,
            }}
          />
        )}
      </div>
    </div>
  );
}
