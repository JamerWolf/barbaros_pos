import { useRef, useCallback } from 'react';
import { setCardTouched } from './CanvasContainer.js';

export type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface UseCanvasResizeProps {
  elementRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  minWidth?: number;
  minHeight?: number;
  onResize: (dims: { width: number; height: number }) => void;
  onPositionChange?: (pos: { x: number; y: number }) => void;
  onResizeEnd?: () => void;
}

interface DragState {
  handle: HandleId;
  startMouseX: number;
  startMouseY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

/**
 * Get CSS style for a resize handle based on its position.
 * Corner handles are 8x8 squares, side handles are thin bars.
 */
export function getHandleStyle(handle: HandleId): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: '#fff',
    border: '1px solid rgba(200, 168, 78, 0.3)',
    borderRadius: 1,
    zIndex: 20,
  };

  switch (handle) {
    // Corner handles: 8x8 squares
    case 'nw': return { ...base, width: 8, height: 8, top: -4, left: -4, cursor: 'nw-resize' };
    case 'ne': return { ...base, width: 8, height: 8, top: -4, right: -4, cursor: 'ne-resize' };
    case 'sw': return { ...base, width: 8, height: 8, bottom: -4, left: -4, cursor: 'sw-resize' };
    case 'se': return { ...base, width: 8, height: 8, bottom: -4, right: -4, cursor: 'se-resize' };
    // Side handles: thin bars
    case 'n':  return { ...base, width: 16, height: 4, top: -2, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' };
    case 's':  return { ...base, width: 16, height: 4, bottom: -2, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' };
    case 'w':  return { ...base, width: 4, height: 16, top: '50%', left: -2, transform: 'translateY(-50%)', cursor: 'w-resize' };
    case 'e':  return { ...base, width: 4, height: 16, top: '50%', right: -2, transform: 'translateY(-50%)', cursor: 'e-resize' };
  }
}

export function useCanvasResize({
  elementRef,
  zoom,
  minWidth = 60,
  minHeight = 60,
  onResize,
  onPositionChange,
  onResizeEnd,
}: UseCanvasResizeProps) {
  const dragRef = useRef<DragState | null>(null);
  const activePointerId = useRef<number | null>(null);

  const startResizeDrag = useCallback(
    (e: PointerEvent, handle: HandleId) => {
      activePointerId.current = e.pointerId;

      const parentRect = elementRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const mouseX = (e.clientX - parentRect.left) / zoom;
      const mouseY = (e.clientY - parentRect.top) / zoom;

      const nodeRect = elementRef.current?.getBoundingClientRect();
      if (!nodeRect) return;

      const nodeLeft = (nodeRect.left - parentRect.left) / zoom;
      const nodeTop = (nodeRect.top - parentRect.top) / zoom;
      const nodeW = nodeRect.width / zoom;
      const nodeH = nodeRect.height / zoom;

      dragRef.current = {
        handle,
        startMouseX: mouseX,
        startMouseY: mouseY,
        origX: nodeLeft,
        origY: nodeTop,
        origW: nodeW,
        origH: nodeH,
      };

      const onMoveHandler = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId.current || !dragRef.current) return;
        const parentEl = elementRef.current?.parentElement?.getBoundingClientRect();
        if (!parentEl) return;

        const { handle: h, startMouseX, startMouseY, origX, origY, origW, origH } = dragRef.current;
        const mx = (ev.clientX - parentEl.left) / zoom;
        const my = (ev.clientY - parentEl.top) / zoom;

        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (h === 'nw') {
          newW = Math.max(minWidth, origW + (startMouseX - mx));
          newX = origX + origW - newW;
          newH = Math.max(minHeight, origH + (startMouseY - my));
          newY = origY + origH - newH;
        } else if (h === 'ne') {
          newW = Math.max(minWidth, origW + (mx - startMouseX));
          newH = Math.max(minHeight, origH + (startMouseY - my));
          newY = origY + origH - newH;
        } else if (h === 'sw') {
          newW = Math.max(minWidth, origW + (startMouseX - mx));
          newX = origX + origW - newW;
          newH = Math.max(minHeight, origH + (my - startMouseY));
        } else if (h === 'se') {
          newW = Math.max(minWidth, origW + (mx - startMouseX));
          newH = Math.max(minHeight, origH + (my - startMouseY));
        } else if (h === 'n') {
          newH = Math.max(minHeight, origH + (startMouseY - my));
          newY = origY + origH - newH;
        } else if (h === 's') {
          newH = Math.max(minHeight, origH + (my - startMouseY));
        } else if (h === 'w') {
          newW = Math.max(minWidth, origW + (startMouseX - mx));
          newX = origX + origW - newW;
        } else if (h === 'e') {
          newW = Math.max(minWidth, origW + (mx - startMouseX));
        }

        onResize({ width: newW, height: newH });
        if (newX !== origX || newY !== origY) {
          onPositionChange?.({ x: newX, y: newY });
        }
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId.current) return;
        activePointerId.current = null;
        dragRef.current = null;
        document.removeEventListener('pointermove', onMoveHandler);
        document.removeEventListener('pointerup', onUp);
        onResizeEnd?.();
      };

      document.addEventListener('pointermove', onMoveHandler);
      document.addEventListener('pointerup', onUp);
    },
    [elementRef, zoom, minWidth, minHeight, onResize, onPositionChange, onResizeEnd]
  );

  const resizeHandleProps = useCallback(
    (handleId: HandleId) => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setCardTouched();
        startResizeDrag(e.nativeEvent, handleId);
      },
    }),
    [startResizeDrag]
  );

  return { resizeHandleProps };
}
