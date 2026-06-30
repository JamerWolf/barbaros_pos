import type { IShape } from '@barbaros/shared';

interface RectangleShapeProps {
  shape: IShape;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function RectangleShape({ shape, isSelected, onSelect }: RectangleShapeProps): JSX.Element {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className={`absolute cursor-pointer pointer-events-auto border-2 ${
        isSelected ? 'ring-2 ring-white' : ''
      }`}
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        backgroundColor: `${shape.color}33`,
        borderColor: shape.color,
        zIndex: shape.zIndex,
      }}
    >
      {shape.label && (
        <div
          className="pointer-events-none flex h-full items-center justify-center text-xs font-bold"
          style={{ color: shape.color }}
        >
          {shape.label}
        </div>
      )}
    </div>
  );
}
