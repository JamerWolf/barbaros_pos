import { useRef, useCallback, useState, useEffect } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { useShapeStore } from '../../../store/shapeStore.js';
import { TextToolbar } from './TextToolbar.jsx';
import { setCardTouched } from '../CanvasContainer.js';
import { useCanvasDrag } from '../useCanvasDrag.js';
import { useCanvasResize } from '../useCanvasResize.js';
import { useCanvasRotate } from '../useCanvasRotate.js';
import { ResizeHandles } from '../ResizeHandles.js';

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

export function TextShape({ shape, isSelected, isLocked, isEditing, interactive = true, onSelect, onStartEdit, onStopEdit, onMove, onResize, onRotate }: TextShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);
  const updateShape = useShapeStore((s) => s.updateShape);
  const [localText, setLocalText] = useState(shape.label || '');

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

  const { resizeHandleProps } = useCanvasResize({
    elementRef: nodeRef,
    zoom,
    minWidth: 40,
    minHeight: 20,
    onResize: ({ width, height }) => onResize?.(shape.x, shape.y, width, height),
    onPositionChange: (pos) => onMove?.(pos.x, pos.y),
  });

  const { rotateHandleProps } = useCanvasRotate({
    elementRef: nodeRef,
    onRotate: (degrees) => onRotate?.(degrees),
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      saveText();
    }
    e.stopPropagation();
  }, [saveText]);

  const handleBlur = useCallback(() => {
    saveText();
  }, [saveText]);

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
      {isSelected && !isLocked && (
        <>
          <ResizeHandles
            handles={['nw', 'ne', 'sw', 'se']}
            handleProps={resizeHandleProps}
          />
          <div
            className="pointer-events-auto absolute flex flex-col items-center"
            style={{
              top: -32,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
            }}
            {...rotateHandleProps()}
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
