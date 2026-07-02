import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { isPinching, setLongPressActive, setCardTouched } from '../CanvasContainer.js';

interface LineShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  onSelect?: () => void;
  onMove?: (dx: number, dy: number) => void;
  onResize?: (x: number, y: number, width: number, height: number, points: { x: number; y: number }[]) => void;
}

type Handle = 'start' | 'end' | 'move';

const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD = 3;

export function LineShape({ shape, isSelected, isLocked, onSelect, onMove, onResize }: LineShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{
    handle: Handle;
    offset: { x: number; y: number };
    origPoints: { x: number; y: number }[];
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

  const startDrag = useCallback((e: PointerEvent, handle: Handle) => {
    activePointerId.current = e.pointerId;

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
        offset = {
          x: (e.clientX - parentRect.left) / zoom - minX,
          y: (e.clientY - parentRect.top) / zoom - minY,
        };
      }
    }

    dragRef.current = { handle, offset, origPoints: origPoints.map((p) => ({ ...p })) };

    const onMoveHandler = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current || !dragRef.current || !nodeRef.current) return;
      const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const { handle: h, offset: off } = dragRef.current;
      const mouseX = (ev.clientX - parentRect.left) / zoom;
      const mouseY = (ev.clientY - parentRect.top) / zoom;

      if (h === 'move') {
        const curPoints = shape.points || [];
        const curMinX = Math.min(...curPoints.map((p) => p.x));
        const curMinY = Math.min(...curPoints.map((p) => p.y));
        const newX = mouseX - off.x;
        const newY = mouseY - off.y;
        const dx = newX - curMinX;
        const dy = newY - curMinY;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          onMove?.(dx, dy);
        }
      } else {
        const curPoints = shape.points || [];
        const newPoints = curPoints.map((p) => ({ ...p }));
        if (h === 'start') {
          newPoints[0] = { x: mouseX - off.x, y: mouseY - off.y };
        } else {
          newPoints[newPoints.length - 1] = { x: mouseX - off.x, y: mouseY - off.y };
        }

        const pXs = newPoints.map((p) => p.x);
        const pYs = newPoints.map((p) => p.y);
        const nMinX = Math.min(...pXs);
        const nMinY = Math.min(...pYs);
        const nMaxX = Math.max(...pXs);
        const nMaxY = Math.max(...pYs);

        onResize?.(nMinX, nMinY, nMaxX - nMinX, nMaxY - nMinY, newPoints);
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
  }, [shape.points, zoom, minX, minY, onMove, onResize]);

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
      onSelect?.();
      startDrag(e.nativeEvent, 'move');
    }, LONG_PRESS_MS);
  }, [isLocked, onSelect, startDrag]);

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

  // Endpoint handles: immediate drag
  const onEndpointPointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setCardTouched();
    onSelect?.();
    startDrag(e.nativeEvent, handle);
  }, [isLocked, onSelect, startDrag]);

  const handleRadius = 6;

  return (
    <div
      ref={nodeRef}
      onPointerDown={onMovePointerDown}
      onPointerMove={onMovePointerMove}
      onPointerUp={onMovePointerUp}
      className={`absolute pointer-events-auto ${isSelected ? 'ring-2 ring-white rounded' : ''}`}
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
            onPointerDown={(e) => onEndpointPointerDown(e, handle)}
          />
        );
      })}
    </div>
  );
}
