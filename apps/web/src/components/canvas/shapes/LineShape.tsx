import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';

interface LineShapeProps {
  shape: IShape;
  isSelected?: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
}

export function LineShape({ shape, isSelected, onSelect, onMove }: LineShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{ offset: { x: number; y: number } } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect?.();

    const points = shape.points || [];
    const xs = points.map((p: { x: number; y: number }) => p.x);
    const ys = points.map((p: { x: number; y: number }) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
    const offset = parentRect
      ? {
          x: (e.clientX - parentRect.left) / zoom - minX,
          y: (e.clientY - parentRect.top) / zoom - minY,
        }
      : { x: 0, y: 0 };

    dragRef.current = { offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [shape.points, zoom]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !nodeRef.current) return;
    e.stopPropagation();

    const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const points = shape.points || [];
    const xs = points.map((p: { x: number; y: number }) => p.x);
    const ys = points.map((p: { x: number; y: number }) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    const newX = (e.clientX - parentRect.left) / zoom - dragRef.current.offset.x;
    const newY = (e.clientY - parentRect.top) / zoom - dragRef.current.offset.y;
    const dx = newX - minX;
    const dy = newY - minY;

    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      onMove?.(dx, dy);
      // Update offset so subsequent moves are relative to new position
      dragRef.current.offset.x -= dx;
      dragRef.current.offset.y -= dy;
    }
  }, [zoom, shape.points, onMove]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = null;
  }, []);

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

  return (
    <div
      ref={nodeRef}
      onPointerDown={onPointerDown}
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
    </div>
  );
}
