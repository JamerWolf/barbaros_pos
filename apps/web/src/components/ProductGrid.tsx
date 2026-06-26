import { useMemo, useState } from 'react';
import type { ICategory, IProduct } from '@barbaros/shared';
import { CategoryTabs } from './CategoryTabs.js';
import { formatCOP } from '../utils/format.js';

interface ProductGridProps {
  products: IProduct[];
  categories: ICategory[];
  onAddProduct: (productId: string) => void;
  quickCount?: number;
}

export function ProductGrid({ products, categories, onAddProduct, quickCount = 5 }: ProductGridProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const quickProducts = useMemo(
    () => products.filter((p) => p.active).slice(0, quickCount),
    [products, quickCount]
  );

  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => p.active);
    const lowerSearch = search.toLowerCase();
    return active.filter((p) => {
      const matchesSearch = !lowerSearch || p.name.toLowerCase().includes(lowerSearch);
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const displayProducts = expanded ? filteredProducts : quickProducts;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!expanded && e.target.value) setExpanded(true);
          }}
          className="h-12 flex-1 rounded-lg bg-gray-800 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="h-12 shrink-0 rounded-lg bg-gray-700 px-4 font-bold text-sm text-white active:bg-gray-600"
          >
            Ver más
          </button>
        )}
      </div>

      {expanded && (
        <>
          <CategoryTabs
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <button
            onClick={() => {
              setExpanded(false);
              setSearch('');
              setSelectedCategory(null);
            }}
            className="h-10 rounded-lg bg-gray-700 font-bold text-sm text-gray-300 active:bg-gray-600"
          >
            ▲ Ver menos
          </button>
        </>
      )}

      <div className="grid grid-cols-3 gap-2">
        {displayProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product.id)}
            className="flex flex-col items-center gap-1 rounded-xl bg-gray-800 p-3 active:bg-gray-700"
          >
            {product.photoUrl ? (
              <img src={product.photoUrl} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-xl">
                📦
              </div>
            )}
            <span className="w-full truncate text-center text-xs font-bold text-white">{product.name}</span>
            <span className="text-xs text-green-400">{formatCOP(Number(product.price))}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
