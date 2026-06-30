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
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect?.();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }, [onSelect]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      onMove?.(dx, dy);
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
    }
  }, [zoom, onMove]);

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
