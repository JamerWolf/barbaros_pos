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
      className="absolute z-50 flex items-center gap-1 rounded-lg border border-[#C8A84E]/20 bg-[#141414] px-2 py-1 shadow-lg"
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
        className="h-7 rounded border border-[#C8A84E]/20 bg-[#1E1E1E] px-1 text-xs text-[#E8E0D0]"
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Font size */}
      <select
        value={shape.fontSize ?? 16}
        onChange={(e) => set({ fontSize: Number(e.target.value) })}
        className="h-7 w-12 rounded border border-[#C8A84E]/20 bg-[#1E1E1E] px-1 text-xs text-[#E8E0D0]"
      >
        {SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-[#C8A84E]/20" />

      {/* Bold */}
      <button
        onClick={() => set({ bold: !shape.bold })}
        className={`h-7 w-7 rounded text-xs font-bold ${
          shape.bold ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
      >
        N
      </button>

      {/* Italic */}
      <button
        onClick={() => set({ italic: !shape.italic })}
        className={`h-7 w-7 rounded text-xs italic ${
          shape.italic ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
      >
        K
      </button>

      {/* Underline */}
      <button
        onClick={() => set({ underline: !shape.underline })}
        className={`h-7 w-7 rounded text-xs underline ${
          shape.underline ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
      >
        S
      </button>

      {/* Strikethrough */}
      <button
        onClick={() => set({ strikethrough: !shape.strikethrough })}
        className={`h-7 w-7 rounded text-xs line-through ${
          shape.strikethrough ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
      >
        S
      </button>

      <div className="mx-1 h-5 w-px bg-[#C8A84E]/20" />

      {/* Align left */}
      <button
        onClick={() => set({ textAlign: 'left' })}
        className={`h-7 w-7 rounded text-xs ${
          shape.textAlign === 'left' || !shape.textAlign ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
        title="Alinear izquierda"
      >
        ≡
      </button>

      {/* Align center */}
      <button
        onClick={() => set({ textAlign: 'center' })}
        className={`h-7 w-7 rounded text-xs ${
          shape.textAlign === 'center' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
        title="Centrar"
      >
        ≡
      </button>

      {/* Align right */}
      <button
        onClick={() => set({ textAlign: 'right' })}
        className={`h-7 w-7 rounded text-xs ${
          shape.textAlign === 'right' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060] hover:bg-[#1E1E1E]'
        }`}
        title="Alinear derecha"
      >
        ≡
      </button>
    </div>
  );
}
