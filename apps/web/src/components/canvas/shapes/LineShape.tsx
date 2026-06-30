import type { IShape } from '@barbaros/shared';

interface LineShapeProps {
  shape: IShape;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function LineShape({ shape, isSelected, onSelect }: LineShapeProps): JSX.Element {
  const points = shape.points || [];
  if (points.length < 2) return <></>;

  // Calculate bounding box for the SVG viewBox
  const xs = points.map((p: { x: number; y: number }) => p.x);
  const ys = points.map((p: { x: number; y: number }) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const padding = 10;

  // Build SVG path
  const pathData = points
    .map((p: { x: number; y: number }, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x - minX + padding} ${p.y - minY + padding}`)
    .join(' ');

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className={`absolute cursor-pointer pointer-events-auto ${isSelected ? 'ring-2 ring-white rounded' : ''}`}
      style={{
        left: minX - padding,
        top: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
        zIndex: shape.zIndex,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`}
      >
        <path
          d={pathData}
          stroke={shape.color}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Wider invisible hit area */}
        <path
          d={pathData}
          stroke="transparent"
          strokeWidth="12"
          fill="none"
        />
      </svg>
    </div>
  );
}
