import type { ICategory } from '@barbaros/shared';

interface CategoryTabsProps {
  categories: ICategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  large?: boolean;
}

export function CategoryTabs({ categories, selectedId, onSelect, large }: CategoryTabsProps): JSX.Element {
  const h = large ? 'h-14' : 'h-10';
  const text = large ? 'text-base' : 'text-sm';

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`${h} shrink-0 rounded-lg px-4 font-bold ${text} ${
          selectedId === null ? 'bg-[#C8A84E] text-[#E8E0D0]' : 'bg-[#141414] text-[#7A7060]'
        }`}
      >
        Todos
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`${h} shrink-0 rounded-lg px-4 font-bold ${text} ${
            selectedId === cat.id ? 'bg-[#C8A84E] text-[#E8E0D0]' : 'bg-[#141414] text-[#7A7060]'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
