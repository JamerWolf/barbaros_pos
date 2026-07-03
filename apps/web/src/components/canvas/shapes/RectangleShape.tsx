import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { isPinching, setLongPressActive, setCardTouched } from '../CanvasContainer.js';

interface RectangleShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD = 3;

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

  // Long press state for move handle
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Called when long press fires or when resize handle is used directly
  const startDrag = useCallback((e: PointerEvent, handle: Handle) => {
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
      startPos: { x: e.clientX, y: e.clientY },
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

      if (h === 'move') {
        const newX = mouseX - off.x;
        const newY = mouseY - off.y;
        onMove?.(newX - shape.x, newY - shape.y);
      } else {
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;
        if (h.includes('w')) { newW = Math.max(20, origX + origW - mouseX); newX = mouseX; }
        if (h.includes('e') || h === 'ne' || h === 'se') { newW = Math.max(20, mouseX - origX); }
        if (h.includes('n')) { newH = Math.max(20, origY + origH - mouseY); newY = mouseY; }
        if (h.includes('s')) { newH = Math.max(20, mouseY - origY); }
        onResize?.(newX, newY, newW, newH);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current) return;
      activePointerId.current = null;
      setLongPressActive(false);
      dragRef.current = null;
      document.removeEventListener('pointermove', onMoveHandler);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMoveHandler);
    document.addEventListener('pointerup', onUp);
  }, [shape.x, shape.y, shape.width, shape.height, zoom, onMove, onResize]);

  // Move handle: long press to drag, short tap to select
  const onMovePointerDown = useCallback((e: React.PointerEvent) => {
    if (isLocked || isPinching()) return;
    e.stopPropagation();
    e.preventDefault();
    setCardTouched();

    longPressFired.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setLongPressActive(true);
      startDrag(e.nativeEvent, 'move');
    }, LONG_PRESS_MS);
  }, [isLocked, startDrag]);

  const onMovePointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressFired.current) {
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        cancelLongPress();
      }
    }
  }, [cancelLongPress]);

  const onMovePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (!longPressFired.current) {
      cancelLongPress();
      onSelect?.();
    }
  }, [cancelLongPress, onSelect]);

  // Resize handles: immediate drag (no long press)
  const onResizePointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setCardTouched();
    startDrag(e.nativeEvent, handle);
  }, [isLocked, startDrag]);

  return (
    <div
      ref={nodeRef}
      data-canvas-node
      onPointerDown={(e) => onMovePointerDown(e)}
      onPointerMove={onMovePointerMove}
      onPointerUp={onMovePointerUp}
      className={`absolute pointer-events-auto ${isSelected ? 'cursor-move' : ''}`}
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
      {/* Selection ring */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-2px] border-2 border-dashed border-white/60" />
      )}
      {/* Resize handles */}
      {isSelected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: 8,
              height: 8,
              backgroundColor: '#fff',
              border: '1px solid #374151',
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
