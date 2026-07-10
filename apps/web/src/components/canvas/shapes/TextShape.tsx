import { useRef, useCallback, useState, useEffect } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { useShapeStore } from '../../../store/shapeStore.js';
import { TextToolbar } from './TextToolbar.jsx';
import { setCardTouched } from '../CanvasContainer.js';
import { useCanvasDrag } from '../useCanvasDrag.js';
import { screenToCanvas, calculateDragOffset } from '../../../utils/canvas/drag.js';

interface TextShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  isEditing?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
  onStartEdit?: () => void;
  onStopEdit?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
  onRotate?: (degrees: number) => void;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | 'rotate';

function getAngle(cx: number, cy: number, mx: number, my: number): number {
  return Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
}

export function TextShape({ shape, isSelected, isLocked, isEditing, interactive = true, onSelect, onStartEdit, onStopEdit, onMove, onResize, onRotate }: TextShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const updateShape = useShapeStore((s) => s.updateShape);
  const [localText, setLocalText] = useState(shape.label || '');
  const dragRef = useRef<{
    handle: Handle;
    offset: { x: number; y: number };
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    startAngle: number;
    origRotation: number;
  } | null>(null);
  const activePointerId = useRef<number | null>(null);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({
    elementRef: nodeRef,
    zoom,
    isLocked: !!isLocked,
    onDragMove: (pos) => onMove?.(pos.x, pos.y),
    onTap: () => onSelect?.(),
    onDoubleTap: () => {
      if (!isLocked) onStartEdit?.();
    },
    onDragEnd: () => useAccountUIStore.getState().setActiveGuides([]),
  });

  useEffect(() => {
    setLocalText(shape.label || '');
  }, [shape.label]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const saveText = useCallback(() => {
    if (localText !== shape.label) {
      updateShape(shape.id, { label: localText });
    }
    onStopEdit?.();
  }, [localText, shape.label, shape.id, onStopEdit]);

  const startImmediateDrag = useCallback((e: PointerEvent, handle: Handle) => {
    activePointerId.current = e.pointerId;

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();

    let offset = { x: 0, y: 0 };
    let startAngle = 0;

    if (parentRect) {
      const canvasCoords = screenToCanvas(e.clientX, e.clientY, parentRect, zoom);
      offset = calculateDragOffset(canvasCoords, { x: shape.x, y: shape.y });

      if (handle === 'rotate') {
        const shapeRect = nodeRef.current?.getBoundingClientRect();
        if (shapeRect) {
          const cx = shapeRect.left + shapeRect.width / 2;
          const cy = shapeRect.top + shapeRect.height / 2;
          startAngle = getAngle(cx, cy, e.clientX, e.clientY);
        }
      }
    }

    dragRef.current = {
      handle,
      offset,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
      startAngle,
      origRotation: shape.rotation ?? 0,
    };

    const onMoveHandler = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current || !dragRef.current || !nodeRef.current) return;
      const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const { handle: h, offset: off, origX, origY, origW, origH, startAngle: sa, origRotation } = dragRef.current;

      if (h === 'rotate') {
        const shapeRect = nodeRef.current?.getBoundingClientRect();
        if (shapeRect) {
          const cx = shapeRect.left + shapeRect.width / 2;
          const cy = shapeRect.top + shapeRect.height / 2;
          const currentAngle = getAngle(cx, cy, ev.clientX, ev.clientY);
          const delta = currentAngle - sa;
          onRotate?.(origRotation + delta);
        }
      } else {
        const mousePos = screenToCanvas(ev.clientX, ev.clientY, parentRect, zoom);
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (h.includes('w')) { newW = Math.max(40, origX + origW - mousePos.x); newX = mousePos.x; }
        if (h.includes('e') || h === 'ne' || h === 'se') { newW = Math.max(40, mousePos.x - origX); }
        if (h.includes('n')) { newH = Math.max(20, origY + origH - mousePos.y); newY = mousePos.y; }
        if (h.includes('s')) { newH = Math.max(20, mousePos.y - origY); }

        onResize?.(newX, newY, newW, newH);
      }
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
  }, [shape.x, shape.y, shape.width, shape.height, shape.rotation, zoom, onResize, onRotate]);

  const onImmediatePointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setCardTouched();
    startImmediateDrag(e.nativeEvent, handle);
  }, [isLocked, startImmediateDrag]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      saveText();
    }
    e.stopPropagation();
  }, [saveText]);

  const handleBlur = useCallback(() => {
    saveText();
  }, [saveText]);

  const handleSize = 8;
  const rotation = shape.rotation || 0;

  return (
    <div
      ref={nodeRef}
      data-canvas-node
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute ${(interactive || isEditing) ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}`}
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        zIndex: shape.zIndex,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-2px] border-2 border-dashed border-white/60" />
      )}
      {isEditing && !isLocked ? (
        <textarea
          ref={textareaRef}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="pointer-events-auto h-full w-full resize-none border-none bg-transparent p-2 outline-none"
          style={{
            color: shape.color,
            fontFamily: shape.fontFamily ?? 'Arial',
            fontSize: shape.fontSize ?? 16,
            fontWeight: shape.bold ? 'bold' : 'normal',
            fontStyle: shape.italic ? 'italic' : 'normal',
            textDecoration: [
              shape.underline ? 'underline' : '',
              shape.strikethrough ? 'line-through' : '',
            ].filter(Boolean).join(' ') || 'none',
            textAlign: (shape.textAlign as 'left' | 'center' | 'right') ?? 'left',
          }}
        />
      ) : (
        <div
          className="pointer-events-none flex h-full w-full items-start p-2 whitespace-pre-wrap"
          style={{
            color: shape.color,
            fontFamily: shape.fontFamily ?? 'Arial',
            fontSize: shape.fontSize ?? 16,
            fontWeight: shape.bold ? 'bold' : 'normal',
            fontStyle: shape.italic ? 'italic' : 'normal',
            textDecoration: [
              shape.underline ? 'underline' : '',
              shape.strikethrough ? 'line-through' : '',
            ].filter(Boolean).join(' ') || 'none',
            textAlign: (shape.textAlign as 'left' | 'center' | 'right') ?? 'left',
            userSelect: 'none',
          }}
        >
          {shape.label || 'Escribir...'}
        </div>
      )}
      {isSelected && !isLocked && <TextToolbar shape={shape} zoom={zoom} />}
      {isSelected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: handleSize,
              height: handleSize,
              backgroundColor: '#fff',
              border: '1px solid #C8A84E/30',
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
                onPointerDown={(e) => onImmediatePointerDown(e, pos)}
              />
            );
          })}
          <div
            className="pointer-events-auto absolute flex flex-col items-center"
            style={{
              top: -32,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setCardTouched();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              startImmediateDrag(e.nativeEvent, 'rotate');
            }}
          >
            <div className="h-4 w-px bg-white/40" />
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#C8A84E]/30 bg-[#141414] text-xs text-[#E8E0D0]"
              style={{ cursor: 'grab' }}
            >
              ↻
            </div>
          </div>
        </>
      )}
    </div>
  );
}
