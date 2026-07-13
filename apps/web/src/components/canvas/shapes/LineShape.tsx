import { useRef, useCallback } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { setCardTouched } from '../CanvasContainer.js';
import { useCanvasDrag } from '../useCanvasDrag.js';
import { screenToCanvas, calculateDragOffset } from '../../../utils/canvas/drag.js';

interface LineShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (x: number, y: number, width: number, height: number, points: { x: number; y: number }[]) => void;
}

type Handle = 'start' | 'end' | 'move';

export function LineShape({ shape, isSelected, isLocked, interactive = true, onSelect, onMove, onResize }: LineShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const dragRef = useRef<{
    handle: Handle;
    offset: { x: number; y: number };
    origPoints: { x: number; y: number }[];
  } | null>(null);
  const activePointerId = useRef<number | null>(null);

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

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({
    elementRef: nodeRef,
    zoom,
    isLocked: !!isLocked,
    onDragMove: (pos) => onMove?.(pos.x, pos.y),
    onTap: () => onSelect?.(),
    onDragEnd: () => useAccountUIStore.getState().setActiveGuides([]),
  });

  const startEndpointDrag = useCallback((e: PointerEvent, handle: Handle) => {
    activePointerId.current = e.pointerId;

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
    const origPoints = shape.points || [];

    let offset = { x: 0, y: 0 };
    if (parentRect) {
      const curPoints = shape.points || [];
      const targetPoint = handle === 'start' ? curPoints[0] : curPoints[curPoints.length - 1];
      const canvasCoords = screenToCanvas(e.clientX, e.clientY, parentRect, zoom);
      offset = calculateDragOffset(canvasCoords, targetPoint);
    }

    dragRef.current = { handle, offset, origPoints: origPoints.map((p) => ({ ...p })) };

    const onMoveHandler = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current || !dragRef.current || !nodeRef.current) return;
      const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const { handle: h, offset: off } = dragRef.current;
      const mousePos = screenToCanvas(ev.clientX, ev.clientY, parentRect, zoom);

      const curPoints = shape.points || [];
      const newPoints = curPoints.map((p) => ({ ...p }));
      if (h === 'start') {
        newPoints[0] = { x: mousePos.x - off.x, y: mousePos.y - off.y };
      } else {
        newPoints[newPoints.length - 1] = { x: mousePos.x - off.x, y: mousePos.y - off.y };
      }

      const pXs = newPoints.map((p) => p.x);
      const pYs = newPoints.map((p) => p.y);
      const nMinX = Math.min(...pXs);
      const nMinY = Math.min(...pYs);
      const nMaxX = Math.max(...pXs);
      const nMaxY = Math.max(...pYs);

      onResize?.(nMinX, nMinY, nMaxX - nMinX, nMaxY - nMinY, newPoints);
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
  }, [shape.points, zoom, onResize]);

  const onEndpointPointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setCardTouched();
    onSelect?.();
    startEndpointDrag(e.nativeEvent, handle);
  }, [isLocked, onSelect, startEndpointDrag]);

  const handleRadius = 6;

  return (
    <div
      ref={nodeRef}
      data-canvas-node
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${isSelected ? 'ring-2 ring-white rounded' : ''}`}
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
        <path
          d={pathData}
          stroke="transparent"
          strokeWidth="12"
          fill="none"
        />
      </svg>
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
              border: '1px solid #C8A84E/30',
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
