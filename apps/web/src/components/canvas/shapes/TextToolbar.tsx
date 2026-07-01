import type { IShape, TextAlign } from '@barbaros/shared';
import { useShapeStore } from '../../../store/shapeStore.js';

interface TextToolbarProps {
  shape: IShape;
  zoom: number;
}

const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export function TextToolbar({ shape, zoom }: TextToolbarProps): JSX.Element {
  const updateShape = useShapeStore((s) => s.updateShape);

  const set = (patch: Partial<IShape>) => updateShape(shape.id, patch);

  const invZoom = 1 / zoom;

  return (
    <div
      className="absolute z-50 flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 shadow-lg"
      style={{
        bottom: '100%',
        left: '50%',
        transform: `translateX(-50%) scale(${invZoom})`,
        transformOrigin: 'bottom center',
        marginBottom: 8 / zoom,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Font family */}
      <select
        value={shape.fontFamily ?? 'Arial'}
        onChange={(e) => set({ fontFamily: e.target.value })}
        className="h-7 rounded border border-gray-600 bg-gray-700 px-1 text-xs text-white"
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Font size */}
      <select
        value={shape.fontSize ?? 16}
        onChange={(e) => set({ fontSize: Number(e.target.value) })}
        className="h-7 w-12 rounded border border-gray-600 bg-gray-700 px-1 text-xs text-white"
      >
        {SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-gray-600" />

      {/* Bold */}
      <button
        onClick={() => set({ bold: !shape.bold })}
        className={`h-7 w-7 rounded text-xs font-bold ${
          shape.bold ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        N
      </button>

      {/* Italic */}
      <button
        onClick={() => set({ italic: !shape.italic })}
        className={`h-7 w-7 rounded text-xs italic ${
          shape.italic ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        K
      </button>

      {/* Underline */}
      <button
        onClick={() => set({ underline: !shape.underline })}
        className={`h-7 w-7 rounded text-xs underline ${
          shape.underline ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        S
      </button>

      {/* Strikethrough */}
      <button
        onClick={() => set({ strikethrough: !shape.strikethrough })}
        className={`h-7 w-7 rounded text-xs line-through ${
          shape.strikethrough ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        S
      </button>

      <div className="mx-1 h-5 w-px bg-gray-600" />

      {/* Align left */}
      <button
        onClick={() => set({ textAlign: 'left' })}
        className={`h-7 w-7 rounded text-xs ${
          shape.textAlign === 'left' || !shape.textAlign ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
        title="Alinear izquierda"
      >
        ≡
      </button>

      {/* Align center */}
      <button
        onClick={() => set({ textAlign: 'center' })}
        className={`h-7 w-7 rounded text-xs ${
          shape.textAlign === 'center' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
        title="Centrar"
      >
        ≡
      </button>

      {/* Align right */}
      <button
        onClick={() => set({ textAlign: 'right' })}
        className={`h-7 w-7 rounded text-xs ${
          shape.textAlign === 'right' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
        title="Alinear derecha"
      >
        ≡
      </button>
    </div>
  );
}
