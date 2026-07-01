import { useMemo, useRef, useState } from 'react';
import type { ICategory, IProduct } from '@barbaros/shared';
import { CategoryTabs } from './CategoryTabs.js';
import { formatCOP } from '../utils/format.js';
import { useProductStore } from '../store/productStore.js';

interface ProductGridProps {
  products: IProduct[];
  categories: ICategory[];
  onAddProduct: (productId: string) => void;
  quickCount?: number;
}

export function ProductGrid({ products, categories, onAddProduct, quickCount = 5 }: ProductGridProps): JSX.Element {
  const { createProduct, createCategory, uploadProductPhoto, fetchProducts, fetchCategories } = useProductStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Category inline input state
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await createCategory(name);
    setNewCategoryName('');
    setShowCategoryInput(false);
  };

  const handleCreateProduct = async () => {
    const price = parseFloat(formPrice);
    if (!formName.trim() || isNaN(price)) return;
    const product = await createProduct({
      name: formName.trim(),
      price,
      categoryId: formCategoryId || undefined,
    });
    if (formPhoto) {
      await uploadProductPhoto(product.id, formPhoto);
    }
    setShowProductModal(false);
    setFormName('');
    setFormPrice('');
    setFormCategoryId('');
    setFormPhoto(null);
    // Auto-agregar el producto recién creado a la cuenta
    onAddProduct(product.id);
  };

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
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFormName('');
                setFormPrice('');
                setFormCategoryId('');
                setShowProductModal(true);
              }}
              className="h-10 flex-1 rounded-lg bg-green-600 font-bold text-sm text-white active:bg-green-700"
            >
              + Producto
            </button>
            <button
              onClick={() => setShowCategoryInput(!showCategoryInput)}
              className="h-10 flex-1 rounded-lg bg-blue-600 font-bold text-sm text-white active:bg-blue-700"
            >
              + Categoría
            </button>
          </div>

          {showCategoryInput && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                className="h-10 flex-1 rounded-lg bg-gray-700 px-3 text-sm text-white outline-none"
              />
              <button
                onClick={handleCreateCategory}
                className="h-10 rounded-lg bg-green-600 px-3 font-bold text-sm text-white active:bg-green-700"
              >
                OK
              </button>
            </div>
          )}

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
              setShowCategoryInput(false);
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

      {/* New Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">Nuevo Producto</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nombre"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-12 rounded-lg bg-gray-700 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="1"
                placeholder="Precio"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="h-12 rounded-lg bg-gray-700 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="h-12 rounded-lg bg-gray-700 px-4 text-white outline-none"
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
                className="h-12 rounded-lg bg-gray-700 px-4 text-sm text-gray-300 active:bg-gray-600"
              >
                📷 {formPhoto ? formPhoto.name : 'Agregar foto (opcional)'}
              </button>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowProductModal(false)}
                className="h-12 flex-1 rounded-xl bg-gray-600 font-bold text-white active:bg-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProduct}
                className="h-12 flex-1 rounded-xl bg-blue-600 font-bold text-white active:bg-blue-700"
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
