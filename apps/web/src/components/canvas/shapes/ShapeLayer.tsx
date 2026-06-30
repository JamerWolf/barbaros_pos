import { useState, useRef, useCallback, useEffect } from 'react';
import { useShapeStore } from '../../../store/shapeStore.js';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { RectangleShape } from './RectangleShape.jsx';
import { LineShape } from './LineShape.jsx';

export function ShapeLayer(): JSX.Element {
  const { shapes, activeTool, drawingColor, selectedShapeId, loadShapes, addShape, deleteShape, setActiveTool, setSelectedShapeId } = useShapeStore();
  const { zoom, panOffset } = useAccountUIStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
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
      if (!layerRef.current) return;

      // When a tool is active, start drawing
      if (activeTool) {
        e.stopPropagation();
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        if (activeTool === 'rectangle') {
          setIsDrawing(true);
          setDrawStart(canvasPos);
          setDrawCurrent(canvasPos);
          setSelectedShapeId(null);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } else if (activeTool === 'line') {
          setLinePoints((prev) => [...prev, canvasPos]);
        }
      }
      // When no tool is active, let the event propagate for panning
      // Shape clicks are handled by each shape's own onSelect
    },
    [activeTool, screenToCanvas]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing || activeTool !== 'rectangle') return;
      setDrawCurrent(screenToCanvas(e.clientX, e.clientY));
    },
    [isDrawing, activeTool, screenToCanvas]
  );

  const handlePointerUp = useCallback(async () => {
    if (!activeTool) return;

    if (activeTool === 'rectangle' && drawStart && drawCurrent) {
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
          zIndex: 0,
        });
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  }, [activeTool, drawStart, drawCurrent, drawingColor, addShape]);

  const handleLineDoubleClick = useCallback(async () => {
    if (activeTool !== 'line' || linePoints.length < 2) return;

      await addShape({
        type: 'LINE',
        x: linePoints[0].x,
        y: linePoints[0].y,
        width: 0,
        height: 0,
        points: linePoints,
        color: drawingColor,
        zIndex: 0,
      });

    setLinePoints([]);
  }, [activeTool, linePoints, drawingColor, addShape]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool(null);
        setLinePoints([]);
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

  // Preview line points
  const previewLinePoints =
    activeTool === 'line' && linePoints.length > 0 ? linePoints : null;

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 ${activeTool ? 'cursor-crosshair' : 'pointer-events-none'}`}
      style={{ zIndex: 10 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleLineDoubleClick}
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
          if (shape.type === 'RECTANGLE') {
            return (
              <RectangleShape
                key={shape.id}
                shape={shape}
                isSelected={selectedShapeId === shape.id}
                onSelect={() => setSelectedShapeId(shape.id)}
              />
            );
          }
          if (shape.type === 'LINE') {
            return (
              <LineShape
                key={shape.id}
                shape={shape}
                isSelected={selectedShapeId === shape.id}
                onSelect={() => setSelectedShapeId(shape.id)}
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

        {/* Preview line points */}
        {previewLinePoints && previewLinePoints.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {previewLinePoints.length >= 2 && (
              <path
                d={previewLinePoints
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ')}
                stroke={drawingColor}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 3"
              />
            )}
            {previewLinePoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill={drawingColor} />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
