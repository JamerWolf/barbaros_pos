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
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

export function TextShape({ shape, isSelected, isLocked, isEditing, onSelect, onStartEdit, onStopEdit, onMove, onResize }: TextShapeProps): JSX.Element {
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
    if (parentRect) {
      const mouseX = (e.clientX - parentRect.left) / zoom;
      const mouseY = (e.clientY - parentRect.top) / zoom;
      offset = {
        x: mouseX - shape.x,
        y: mouseY - shape.y,
      };
    }

    dragRef.current = {
      handle,
      startPos: { x: e.clientX, y: e.clientY },
      offset,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
    };
  }, [isLocked, zoom, shape.x, shape.y, shape.width, shape.height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !nodeRef.current) return;
    e.stopPropagation();

    const parentRect = nodeRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const { handle, offset, origX, origY, origW, origH } = dragRef.current;
    const mouseX = (e.clientX - parentRect.left) / zoom;
    const mouseY = (e.clientY - parentRect.top) / zoom;

    if (handle === 'move') {
      const newX = mouseX - offset.x;
      const newY = mouseY - offset.y;
      const dx = newX - origX;
      const dy = newY - origY;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        onMove?.(dx, dy);
      }
    } else {
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
  }, [zoom, onMove, onResize]);

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
        </>
      )}
    </div>
  );
}
