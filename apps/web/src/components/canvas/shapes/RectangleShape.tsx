import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';

interface RectangleShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

export function RectangleShape({ shape, isSelected, isLocked, onSelect, onMove, onResize }: RectangleShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{
    handle: Handle;
    startPos: { x: number; y: number };
    offset: { x: number; y: number };
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
    const offset = parentRect
      ? {
          x: (e.clientX - parentRect.left) / zoom - shape.x,
          y: (e.clientY - parentRect.top) / zoom - shape.y,
        }
      : { x: 0, y: 0 };

    dragRef.current = {
      handle,
      startPos: { x: e.clientX, y: e.clientY },
      offset,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
    };
  }, [shape.x, shape.y, shape.width, shape.height, zoom]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !nodeRef.current) return;
    e.stopPropagation();

    const { handle, offset, origX, origY, origW, origH } = dragRef.current;
    const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    if (handle === 'move') {
      const newX = (e.clientX - parentRect.left) / zoom - offset.x;
      const newY = (e.clientY - parentRect.top) / zoom - offset.y;
      onMove?.(newX - shape.x, newY - shape.y);
    } else {
      // For resize handles, compute new bounds from the original shape
      const mouseX = (e.clientX - parentRect.left) / zoom;
      const mouseY = (e.clientY - parentRect.top) / zoom;

      let x = origX, y = origY, w = origW, h = origH;

      if (handle === 'se') {
        w = Math.max(20, mouseX - origX);
        h = Math.max(20, mouseY - origY);
      } else if (handle === 'sw') {
        x = Math.min(mouseX, origX + origW - 20);
        w = Math.max(20, origX + origW - x);
        h = Math.max(20, mouseY - origY);
      } else if (handle === 'ne') {
        w = Math.max(20, mouseX - origX);
        y = Math.min(mouseY, origY + origH - 20);
        h = Math.max(20, origY + origH - y);
      } else if (handle === 'nw') {
        x = Math.min(mouseX, origX + origW - 20);
        y = Math.min(mouseY, origY + origH - 20);
        w = Math.max(20, origX + origW - x);
        h = Math.max(20, origY + origH - y);
      }

      onResize?.(x, y, w, h);
    }
  }, [isLocked, zoom, shape.x, shape.y, onMove, onResize]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = null;
  }, []);

  const handleSize = 8;

  return (
    <div
      ref={nodeRef}
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
