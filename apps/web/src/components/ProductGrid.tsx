import { useMemo, useRef, useState } from 'react';
import type { ICategory, IProduct } from '@barbaros/shared';
import { CategoryTabs } from './CategoryTabs.js';
import { formatCOP } from '../utils/format.js';
import { productPhotoUrl } from '../utils/productPhoto.js';
import { useProductStore } from '../store/productStore.js';

interface ProductGridProps {
  products: IProduct[];
  categories: ICategory[];
  onAddProduct: (productId: string) => void;
}

export function ProductGrid({ products, categories, onAddProduct }: ProductGridProps): JSX.Element {
  const { createProduct, uploadProductPhoto } = useProductStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => p.active);
    const lowerSearch = search.toLowerCase();
    return active.filter((p) => {
      const matchesSearch = !lowerSearch || p.name.toLowerCase().includes(lowerSearch);
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const handleCreateProduct = async () => {
    const price = parseFloat(formPrice);
    if (!formName.trim() || isNaN(price)) return;

    const product = await createProduct({
      name: formName.trim(),
      price,
      categoryId: formCategoryId || undefined,
    });
    if (formPhoto && product) {
      await uploadProductPhoto(product.id, formPhoto);
    }
    setShowProductModal(false);
    setFormName('');
    setFormPrice('');
    setFormCategoryId('');
    setFormPhoto(null);
    onAddProduct(product.id);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar + "+ Producto" button */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 flex-1 rounded-lg bg-[#141414] px-4 text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
        />
        <button
          onClick={() => {
            setFormName('');
            setFormPrice('');
            setFormCategoryId('');
            setShowProductModal(true);
          }}
          className="h-12 shrink-0 rounded-lg bg-[#C8A84E] px-3 font-bold text-sm text-[#0A0A0A] active:bg-[#C8A84E]/80 sm:px-4"
        >
          <span className="sm:hidden">+</span>
          <span className="hidden sm:inline">+ Producto</span>
        </button>
      </div>

      {/* Category tabs — all sizes */}
      <CategoryTabs
        categories={categories}
        selectedId={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5">
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product.id)}
            className="flex aspect-square flex-col overflow-hidden rounded-xl bg-[#141414] active:bg-[#1E1E1E]"
          >
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#1E1E1E] p-2">
              {product.photoUrl ? (
                <img src={productPhotoUrl(product.photoUrl)} alt={product.name} className="h-full w-full object-contain" />
              ) : (
                <span className="text-3xl">📦</span>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-center px-1 py-1">
              <span className="w-full truncate text-center text-xs font-bold text-[#E8E0D0] leading-tight">{product.name}</span>
              <span className="text-xs text-[#C8A84E]">{formatCOP(Number(product.price))}</span>
            </div>
          </button>
        ))}
      </div>

      {/* New Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6">
            <h3 className="mb-4 text-lg font-bold text-[#E8E0D0]">Nuevo Producto</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nombre"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-12 rounded-lg bg-[#1E1E1E] px-4 text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
              />
              <input
                type="number"
                step="1"
                placeholder="Precio"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="h-12 rounded-lg bg-[#1E1E1E] px-4 text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
              />
              <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="h-12 rounded-lg bg-[#1E1E1E] px-4 text-[#E8E0D0] outline-none"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFormPhoto(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                className="h-12 rounded-lg bg-[#1E1E1E] px-4 text-sm text-[#7A7060] active:bg-[#141414]"
              >
                📷 {formPhoto ? formPhoto.name : 'Agregar foto (opcional)'}
              </button>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowProductModal(false)}
                className="h-12 flex-1 rounded-xl bg-[#1E1E1E] font-bold text-[#E8E0D0] active:bg-[#141414]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProduct}
                className="h-12 flex-1 rounded-xl bg-[#C8A84E] font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80"
              >
                Crear y agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
