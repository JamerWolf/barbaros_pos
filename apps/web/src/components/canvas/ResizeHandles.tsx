import { type HandleId, getHandleStyle } from './useCanvasResize.js';

interface ResizeHandlesProps {
  handles: HandleId[];
  handleProps: (handleId: HandleId) => { onPointerDown: (e: React.PointerEvent) => void };
  className?: string;
}

/**
 * Renderized resize handles for canvas objects.
 * Use with useCanvasResize's resizeHandleProps.
 *
 * @example
 * const { resizeHandleProps } = useCanvasResize({ ... })
 * <ResizeHandles handles={['nw','ne','sw','se']} handleProps={resizeHandleProps} />
 */
export function ResizeHandles({ handles, handleProps, className = 'pointer-events-auto' }: ResizeHandlesProps): JSX.Element {
  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle}
          className={className}
          style={getHandleStyle(handle)}
          {...handleProps(handle)}
        />
      ))}
    </>
  );
}
