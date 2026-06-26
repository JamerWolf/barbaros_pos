import type { ICategory } from '@barbaros/shared';

interface CategoryTabsProps {
  categories: ICategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps): JSX.Element {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`h-10 shrink-0 rounded-lg px-4 font-bold text-sm ${
          selectedId === null ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
        }`}
      >
        Todos
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`h-10 shrink-0 rounded-lg px-4 font-bold text-sm ${
            selectedId === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
