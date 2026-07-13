import { useRef } from 'react';
import type { IShape } from '@barbaros/shared';
import { useAccountUIStore } from '../../../store/accountUIStore.js';
import { useCanvasDrag } from '../useCanvasDrag.js';
import { useCanvasResize } from '../useCanvasResize.js';
import { ResizeHandles } from '../ResizeHandles.js';

interface RectangleShapeProps {
  shape: IShape;
  isSelected?: boolean;
  isLocked?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (x: number, y: number, width: number, height: number) => void;
}

export function RectangleShape({ shape, isSelected, isLocked, interactive = true, onSelect, onMove, onResize }: RectangleShapeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useAccountUIStore((s) => s.zoom);

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({
    elementRef: nodeRef,
    zoom,
    isLocked: !!isLocked,
    onDragMove: (pos) => onMove?.(pos.x, pos.y),
    onTap: () => onSelect?.(),
    onDragEnd: () => useAccountUIStore.getState().setActiveGuides([]),
  });

  const { resizeHandleProps } = useCanvasResize({
    elementRef: nodeRef,
    zoom,
    minWidth: 20,
    minHeight: 20,
    onResize: ({ width, height }) => onResize?.(shape.x, shape.y, width, height),
    onPositionChange: (pos) => onMove?.(pos.x, pos.y),
  });

  return (
    <div
      ref={nodeRef}
      data-canvas-node
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${isSelected ? 'cursor-move' : ''}`}
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        zIndex: shape.zIndex,
      }}
    >
      <div
        className="h-full w-full border-2"
        style={{
          borderColor: shape.color,
          backgroundColor: `${shape.color}22`,
        }}
      />
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-2px] border-2 border-dashed border-white/60" />
      )}
      {isSelected && !isLocked && (
        <ResizeHandles
          handles={['nw', 'ne', 'sw', 'se']}
          handleProps={resizeHandleProps}
        />
      )}
    </div>
  );
}
