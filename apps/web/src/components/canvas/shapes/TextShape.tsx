import { useRef, useCallback, useState, useEffect } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { useShapeStore } from '../../../store/shapeStore.js';

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

  const onPointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

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

      // For rotation: use screen coords to avoid panOffset conversion errors
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
  }, [isLocked, zoom, shape.x, shape.y, shape.width, shape.height, shape.rotation]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !nodeRef.current) return;
    e.stopPropagation();

    const { handle, offset, origX, origY, origW, origH, startAngle, origRotation } = dragRef.current;
    const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    if (handle === 'move') {
      const newX = (e.clientX - parentRect.left) / zoom - offset.x;
      const newY = (e.clientY - parentRect.top) / zoom - offset.y;
      onMove?.(newX - shape.x, newY - shape.y);
    } else if (handle === 'rotate') {
      // Use screen coords to avoid panOffset conversion errors
      const shapeRect = nodeRef.current?.getBoundingClientRect();
      if (shapeRect) {
        const cx = shapeRect.left + shapeRect.width / 2;
        const cy = shapeRect.top + shapeRect.height / 2;
        const currentAngle = getAngle(cx, cy, e.clientX, e.clientY);
        const delta = currentAngle - startAngle;
        onRotate?.(origRotation + delta);
      }
    } else {
      const mouseX = (e.clientX - parentRect.left) / zoom;
      const mouseY = (e.clientY - parentRect.top) / zoom;
      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      if (handle.includes('w')) {
        newW = Math.max(40, origX + origW - mouseX);
        newX = mouseX;
      }
      if (handle.includes('e') || handle === 'ne' || handle === 'se') {
        newW = Math.max(40, mouseX - origX);
      }
      if (handle.includes('n')) {
        newH = Math.max(20, origY + origH - mouseY);
        newY = mouseY;
      }
      if (handle.includes('s')) {
        newH = Math.max(20, mouseY - origY);
      }

      onResize?.(newX, newY, newW, newH);
    }
  }, [zoom, shape.x, shape.y, shape.width, shape.height, onMove, onResize, onRotate]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = null;
  }, []);

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
      onPointerDown={(e) => {
        if (isLocked) return;
        onSelect?.();
        onPointerDown(e, 'move');
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
          className="pointer-events-auto h-full w-full resize-none border-none bg-transparent p-2 text-sm text-white outline-none"
          style={{ color: shape.color }}
        />
      ) : (
        <div
          className="pointer-events-none flex h-full w-full items-start p-2 text-sm whitespace-pre-wrap"
          style={{ color: shape.color }}
        >
          {shape.label || 'Escribir...'}
        </div>
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
              // Manually set dragRef since we skip the shared onPointerDown
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
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Line from handle to shape */}
            <div className="h-4 w-px bg-white/40" />
            {/* Rotation icon */}
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
