import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';

interface LineShapeProps {
  shape: IShape;
  isSelected?: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
  onResize?: (x: number, y: number, width: number, height: number, points: { x: number; y: number }[]) => void;
}

type Handle = 'start' | 'end' | 'move';

export function LineShape({ shape, isSelected, onSelect, onMove, onResize }: LineShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{
    handle: Handle;
    offset: { x: number; y: number };
    origPoints: { x: number; y: number }[];
  } | null>(null);

  const points = shape.points || [];
  if (points.length < 2) return <></>;

  const xs = points.map((p: { x: number; y: number }) => p.x);
  const ys = points.map((p: { x: number; y: number }) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const padding = 10;

  const pathData = points
    .map((p: { x: number; y: number }, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x - minX + padding} ${p.y - minY + padding}`)
    .join(' ');

  const onPointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect?.();

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
    const origPoints = shape.points || [];

    let offset = { x: 0, y: 0 };
    if (parentRect) {
      const curPoints = shape.points || [];
      if (handle === 'start') {
        offset = {
          x: (e.clientX - parentRect.left) / zoom - curPoints[0].x,
          y: (e.clientY - parentRect.top) / zoom - curPoints[0].y,
        };
      } else if (handle === 'end') {
        offset = {
          x: (e.clientX - parentRect.left) / zoom - curPoints[curPoints.length - 1].x,
          y: (e.clientY - parentRect.top) / zoom - curPoints[curPoints.length - 1].y,
        };
      } else {
        // move: offset from first point
        offset = {
          x: (e.clientX - parentRect.left) / zoom - minX,
          y: (e.clientY - parentRect.top) / zoom - minY,
        };
      }
    }

    dragRef.current = { handle, offset, origPoints: origPoints.map((p) => ({ ...p })) };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [shape.points, zoom, minX, minY, onSelect]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !nodeRef.current) return;
    e.stopPropagation();

    const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const { handle, offset, origPoints } = dragRef.current;
    const mouseX = (e.clientX - parentRect.left) / zoom;
    const mouseY = (e.clientY - parentRect.top) / zoom;

    if (handle === 'move') {
      // Use current points from shape prop, not frozen origPoints
      const curPoints = shape.points || [];
      const curMinX = Math.min(...curPoints.map((p) => p.x));
      const curMinY = Math.min(...curPoints.map((p) => p.y));
      const newX = mouseX - offset.x;
      const newY = mouseY - offset.y;
      const dx = newX - curMinX;
      const dy = newY - curMinY;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        onMove?.(dx, dy);
      }
    } else {
      // Dragging an endpoint — use current shape points
      const curPoints = shape.points || [];
      const newPoints = curPoints.map((p) => ({ ...p }));
      if (handle === 'start') {
        newPoints[0] = { x: mouseX - offset.x, y: mouseY - offset.y };
      } else {
        newPoints[newPoints.length - 1] = { x: mouseX - offset.x, y: mouseY - offset.y };
      }

      const pXs = newPoints.map((p) => p.x);
      const pYs = newPoints.map((p) => p.y);
      const nMinX = Math.min(...pXs);
      const nMinY = Math.min(...pYs);
      const nMaxX = Math.max(...pXs);
      const nMaxY = Math.max(...pYs);

      onResize?.(nMinX, nMinY, nMaxX - nMinX, nMaxY - nMinY, newPoints);
    }
  }, [zoom, shape.points, onMove, onResize]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = null;
  }, []);

  const handleRadius = 6;

  return (
    <div
      ref={nodeRef}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute cursor-move pointer-events-auto ${isSelected ? 'ring-2 ring-white rounded' : ''}`}
      style={{
        left: minX - padding,
        top: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
        zIndex: shape.zIndex,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`}
      >
        <path
          d={pathData}
          stroke={shape.color}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Wider invisible hit area */}
        <path
          d={pathData}
          stroke="transparent"
          strokeWidth="12"
          fill="none"
        />
      </svg>
      {/* Endpoint handles */}
      {isSelected && points.map((p: { x: number; y: number }, i: number) => {
        // Only show first and last endpoint
        if (i !== 0 && i !== points.length - 1) return null;
        const handle = i === 0 ? 'start' : 'end';
        return (
          <div
            key={i}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              left: p.x - minX + padding - handleRadius,
              top: p.y - minY + padding - handleRadius,
              width: handleRadius * 2,
              height: handleRadius * 2,
              backgroundColor: '#fff',
              border: '1px solid #374151',
              borderRadius: '50%',
              cursor: i === 0 ? 'nw-resize' : 'se-resize',
              zIndex: 20,
            }}
            onPointerDown={(e) => onPointerDown(e, handle)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        );
      })}
    </div>
  );
}
