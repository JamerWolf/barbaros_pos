import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';

interface RectangleShapeProps {
  shape: IShape;
  isSelected?: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

export function RectangleShape({ shape, isSelected, onSelect, onMove, onResize }: RectangleShapeProps): JSX.Element {
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);

  const screenToCanvasDelta = useCallback((dx: number, dy: number) => ({
    dx: dx / zoom,
    dy: dy / zoom,
  }), [zoom]);

  const onPointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
    };
  }, [shape.x, shape.y, shape.width, shape.height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const { handle, startX, startY, origX, origY, origW, origH } = dragRef.current;
    const { dx, dy } = screenToCanvasDelta(e.clientX - startX, e.clientY - startY);

    if (handle === 'move') {
      onMove?.(dx, dy);
    } else if (handle === 'se') {
      onResize?.(origX, origY, Math.max(20, origW + dx), Math.max(20, origH + dy));
    } else if (handle === 'sw') {
      onResize?.(origX + dx, origY, Math.max(20, origW - dx), Math.max(20, origH + dy));
    } else if (handle === 'ne') {
      onResize?.(origX, origY + dy, Math.max(20, origW + dx), Math.max(20, origH - dy));
    } else if (handle === 'nw') {
      onResize?.(origX + dx, origY + dy, Math.max(20, origW - dx), Math.max(20, origH - dy));
    }
  }, [screenToCanvasDelta, onMove, onResize]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = null;
  }, []);

  const handleSize = 8;

  return (
    <div
      onPointerDown={(e) => {
        onSelect?.();
        onPointerDown(e, 'move');
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute pointer-events-auto cursor-move"
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        zIndex: shape.zIndex,
      }}
    >
      {/* Fill */}
      <div
        className="h-full w-full border-2"
        style={{
          backgroundColor: `${shape.color}33`,
          borderColor: shape.color,
        }}
      />
      {/* Label */}
      {shape.label && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold"
          style={{ color: shape.color }}
        >
          {shape.label}
        </div>
      )}
      {/* Selection ring */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-2px] border-2 border-white/60" />
      )}
      {/* Resize handles */}
      {isSelected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: handleSize,
              height: handleSize,
              backgroundColor: '#fff',
              border: '1px solid #374151',
              borderRadius: 1,
              zIndex: 20,
            };
            if (pos === 'nw') { style.top = -handleSize / 2; style.left = -handleSize / 2; style.cursor = 'nw-resize'; }
            if (pos === 'ne') { style.top = -handleSize / 2; style.right = -handleSize / 2; style.cursor = 'ne-resize'; }
            if (pos === 'sw') { style.bottom = -handleSize / 2; style.left = -handleSize / 2; style.cursor = 'sw-resize'; }
            if (pos === 'se') { style.bottom = -handleSize / 2; style.right = -handleSize / 2; style.cursor = 'se-resize'; }
            return (
              <div
                key={pos}
                className="pointer-events-auto"
                style={style}
                onPointerDown={(e) => onPointerDown(e, pos)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
