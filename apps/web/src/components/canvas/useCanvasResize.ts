import { useRef, useCallback } from 'react';
import { setCardTouched } from './CanvasContainer.js';

type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

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
