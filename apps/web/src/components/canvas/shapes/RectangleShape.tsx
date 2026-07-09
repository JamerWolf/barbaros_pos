import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { setCardTouched } from '../CanvasContainer.js';
import { useCanvasDrag } from '../useCanvasDrag.js';

interface RectangleShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

export function RectangleShape({ shape, isSelected, isLocked, interactive = true, onSelect, onMove, onResize }: RectangleShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{
    handle: Handle;
    offset: { x: number; y: number };
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const activePointerId = useRef<number | null>(null);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({
    elementRef: nodeRef,
    zoom,
    isLocked: !!isLocked,
    onDragMove: (pos) => onMove?.(pos.x, pos.y),
    onTap: () => onSelect?.(),
    onDragEnd: () => useAccountUIStore.getState().setActiveGuides([]),
  });

  const startResizeDrag = useCallback((e: PointerEvent, handle: Handle) => {
    activePointerId.current = e.pointerId;

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
    const offset = parentRect
      ? {
          x: (e.clientX - parentRect.left) / zoom - shape.x,
          y: (e.clientY - parentRect.top) / zoom - shape.y,
        }
      : { x: 0, y: 0 };

    dragRef.current = {
      handle,
      offset,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
    };

    const onMoveHandler = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current || !dragRef.current || !nodeRef.current) return;
      const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const { handle: h, offset: off, origX, origY, origW, origH } = dragRef.current;
      const mouseX = (ev.clientX - parentRect.left) / zoom;
      const mouseY = (ev.clientY - parentRect.top) / zoom;

      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;
      if (h.includes('w')) { newW = Math.max(20, origX + origW - mouseX); newX = mouseX; }
      if (h.includes('e') || h === 'ne' || h === 'se') { newW = Math.max(20, mouseX - origX); }
      if (h.includes('n')) { newH = Math.max(20, origY + origH - mouseY); newY = mouseY; }
      if (h.includes('s')) { newH = Math.max(20, mouseY - origY); }
      onResize?.(newX, newY, newW, newH);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current) return;
      activePointerId.current = null;
      dragRef.current = null;
      document.removeEventListener('pointermove', onMoveHandler);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMoveHandler);
    document.addEventListener('pointerup', onUp);
  }, [shape.x, shape.y, shape.width, shape.height, zoom, onResize]);

  const onResizePointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setCardTouched();
    startResizeDrag(e.nativeEvent, handle);
  }, [isLocked, startResizeDrag]);

  return (
    <div
      ref={nodeRef}
      data-canvas-node
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${isSelected ? 'cursor-move' : ''}`}
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        zIndex: shape.zIndex,
      }}
    >
      <div
        className="h-full w-full border-2"
        style={{
          borderColor: shape.color,
          backgroundColor: `${shape.color}22`,
        }}
      />
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-2px] border-2 border-dashed border-white/60" />
      )}
      {isSelected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: 8,
              height: 8,
              backgroundColor: '#fff',
              border: '1px solid #C8A84E/30',
              borderRadius: 1,
              zIndex: 20,
            };
            if (pos === 'nw') { style.top = -4; style.left = -4; style.cursor = 'nw-resize'; }
            if (pos === 'ne') { style.top = -4; style.right = -4; style.cursor = 'ne-resize'; }
            if (pos === 'sw') { style.bottom = -4; style.left = -4; style.cursor = 'sw-resize'; }
            if (pos === 'se') { style.bottom = -4; style.right = -4; style.cursor = 'se-resize'; }
            return (
              <div
                key={pos}
                className="pointer-events-auto"
                style={style}
                onPointerDown={(e) => onResizePointerDown(e, pos)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
