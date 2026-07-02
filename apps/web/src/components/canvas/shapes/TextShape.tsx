import { useRef, useCallback, useState, useEffect } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { useShapeStore } from '../../../store/shapeStore.js';
import { TextToolbar } from './TextToolbar.jsx';
import { isPinching, setLongPressActive } from '../CanvasContainer.js';

interface TextShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onStartEdit?: () => void;
  onStopEdit?: () => void;
  onMove?: (dx: number, dy: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
  onRotate?: (degrees: number) => void;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | 'rotate';

function getAngle(cx: number, cy: number, mx: number, my: number): number {
  return Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
}

const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD = 3;

export function TextShape({ shape, isSelected, isLocked, isEditing, onSelect, onStartEdit, onStopEdit, onMove, onResize, onRotate }: TextShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const updateShape = useShapeStore((s) => s.updateShape);
  const [localText, setLocalText] = useState(shape.label || '');
  const dragRef = useRef<{
    handle: Handle;
    startPos: { x: number; y: number };
    offset: { x: number; y: number };
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    startAngle: number;
    origRotation: number;
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

  // Sync local text when shape changes externally
  useEffect(() => {
    setLocalText(shape.label || '');
  }, [shape.label]);

  // Focus textarea when editing starts
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

  const startDrag = useCallback((e: PointerEvent, handle: Handle) => {
    activePointerId.current = e.pointerId;

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();

    let offset = { x: 0, y: 0 };
    let startAngle = 0;

    if (parentRect) {
      const mouseX = (e.clientX - parentRect.left) / zoom;
      const mouseY = (e.clientY - parentRect.top) / zoom;
      offset = {
        x: mouseX - shape.x,
        y: mouseY - shape.y,
      };

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
      startPos: { x: e.clientX, y: e.clientY },
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

      if (h === 'move') {
        const newX = (ev.clientX - parentRect.left) / zoom - off.x;
        const newY = (ev.clientY - parentRect.top) / zoom - off.y;
        onMove?.(newX - shape.x, newY - shape.y);
      } else if (h === 'rotate') {
        const shapeRect = nodeRef.current?.getBoundingClientRect();
        if (shapeRect) {
          const cx = shapeRect.left + shapeRect.width / 2;
          const cy = shapeRect.top + shapeRect.height / 2;
          const currentAngle = getAngle(cx, cy, ev.clientX, ev.clientY);
          const delta = currentAngle - sa;
          onRotate?.(origRotation + delta);
        }
      } else {
        const mouseX = (ev.clientX - parentRect.left) / zoom;
        const mouseY = (ev.clientY - parentRect.top) / zoom;
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (h.includes('w')) { newW = Math.max(40, origX + origW - mouseX); newX = mouseX; }
        if (h.includes('e') || h === 'ne' || h === 'se') { newW = Math.max(40, mouseX - origX); }
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
  }, [shape.x, shape.y, shape.width, shape.height, shape.rotation, zoom, onMove, onResize, onRotate]);

  // Move handle: long press to drag, short tap to select
  const onMovePointerDown = useCallback((e: React.PointerEvent) => {
    if (isLocked || isPinching()) return;
    e.stopPropagation();
    e.preventDefault();

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

  // Resize and rotation handles: immediate drag
  const onImmediatePointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    startDrag(e.nativeEvent, handle);
  }, [isLocked, startDrag]);

  const handleDoubleClick = useCallback(() => {
    if (!isLocked) {
      onStartEdit?.();
    }
  }, [isLocked, onStartEdit]);

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
      onPointerDown={onMovePointerDown}
      onPointerMove={onMovePointerMove}
      onPointerUp={onMovePointerUp}
      onDoubleClick={handleDoubleClick}
      className="absolute pointer-events-auto cursor-move"
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
      {/* Selection ring */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-2px] border-2 border-dashed border-white/60" />
      )}
      {/* Text content */}
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
          }}
        >
          {shape.label || 'Escribir...'}
        </div>
      )}
      {/* Text formatting toolbar */}
      {isSelected && !isLocked && <TextToolbar shape={shape} zoom={zoom} />}
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
                onPointerDown={(e) => onImmediatePointerDown(e, pos)}
              />
            );
          })}
          {/* Rotation handle */}
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
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const shapeRect = nodeRef.current?.getBoundingClientRect();
              let startAngle = 0;
              if (shapeRect) {
                const cx = shapeRect.left + shapeRect.width / 2;
                const cy = shapeRect.top + shapeRect.height / 2;
                startAngle = getAngle(cx, cy, e.clientX, e.clientY);
              }
              dragRef.current = {
                handle: 'rotate',
                startPos: { x: e.clientX, y: e.clientY },
                offset: { x: 0, y: 0 },
                origX: shape.x,
                origY: shape.y,
                origW: shape.width,
                origH: shape.height,
                startAngle,
                origRotation: shape.rotation ?? 0,
              };
            }}
          >
            <div className="h-4 w-px bg-white/40" />
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-gray-800 text-xs text-white"
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
