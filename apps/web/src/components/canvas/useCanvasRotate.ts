import { useRef, useCallback } from 'react';
import { setCardTouched } from './CanvasContainer.js';

interface UseCanvasRotateProps {
  elementRef: React.RefObject<HTMLDivElement>;
  onRotate: (degrees: number) => void;
}

function getAngle(cx: number, cy: number, mx: number, my: number): number {
  return Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
}

/**
 * Rotation handle for canvas objects.
 * Uses screen-space angle calculation via getBoundingClientRect().
 *
 * @example
 * const { rotateHandleProps } = useCanvasRotate({ elementRef, onRotate })
 * <div {...rotateHandleProps()} style={rotateStyle}>↻</div>
 */
export function useCanvasRotate({ elementRef, onRotate }: UseCanvasRotateProps) {
  const activePointerId = useRef<number | null>(null);
  const dragRef = useRef<{ startAngle: number; origRotation: number } | null>(null);

  const startRotateDrag = useCallback((e: PointerEvent) => {
    activePointerId.current = e.pointerId;

    const shapeRect = elementRef.current?.getBoundingClientRect();
    if (!shapeRect) return;

    const cx = shapeRect.left + shapeRect.width / 2;
    const cy = shapeRect.top + shapeRect.height / 2;
    const startAngle = getAngle(cx, cy, e.clientX, e.clientY);

    // Read current rotation from the element's transform
    const currentTransform = elementRef.current?.style.transform;
    let origRotation = 0;
    if (currentTransform) {
      const match = currentTransform.match(/rotate\(([-\d.]+)deg\)/);
      if (match) origRotation = parseFloat(match[1]);
    }

    dragRef.current = { startAngle, origRotation };

    const onMoveHandler = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current || !dragRef.current || !elementRef.current) return;

      const rect = elementRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const currentAngle = getAngle(cx, cy, ev.clientX, ev.clientY);
      const delta = currentAngle - dragRef.current.startAngle;
      onRotate(dragRef.current.origRotation + delta);
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
  }, [elementRef, onRotate]);

  const rotateHandleProps = useCallback(() => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setCardTouched();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      startRotateDrag(e.nativeEvent);
    },
  }), [startRotateDrag]);

  return { rotateHandleProps };
}
