import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '../../store/productStore.js';
import { CategoryTabs } from '../CategoryTabs.js';
import { formatCOP } from '../../utils/format.js';
import { productPhotoUrl } from '../../utils/productPhoto.js';

interface AdminProductsPageProps {
  onClose: () => void;
}

export function AdminProductsPage({ onClose }: AdminProductsPageProps): JSX.Element {
  const {
    products,
    categories,
    loading,
    fetchProducts,
    fetchCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductPhoto,
    createCategory,
    deleteCategory,
  } = useProductStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formActive, setFormActive] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openNewProduct = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCategoryId('');
    setFormActive(true);
    setShowProductModal(true);
  };

  const openEditProduct = (product: typeof products[number]) => {
    setEditingProduct(product.id);
    setFormName(product.name);
    setFormPrice(String(product.price));
    setFormCategoryId(product.categoryId ?? '');
    setFormActive(product.active);
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    const price = parseFloat(formPrice);
    if (!formName.trim() || isNaN(price)) return;

    const data = {
      name: formName.trim(),
      price,
      categoryId: formCategoryId || undefined,
      active: formActive,
    };

    if (editingProduct) {
      await updateProduct(editingProduct, data);
    } else {
      await createProduct(data);
    }
    setShowProductModal(false);
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
    } catch {
      alert('No se pudo eliminar. ¿Tiene cuentas abiertas?');
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await createCategory(name);
    setNewCategoryName('');
    setShowCategoryInput(false);
  };

  const handleDeleteCategory = async (id: string) => {
    const hasProducts = products.some((p) => p.categoryId === id);
    if (hasProducts) {
      const confirmed = window.confirm(
        'Esta categoría tiene productos. Se desasociarán. ¿Continuar?'
      );
      if (!confirmed) return;
    }
    await deleteCategory(id);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    try {
      await uploadProductPhoto(editingProduct, file);
    } catch {
      alert('Error al subir la foto');
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900 text-white" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-bold">Productos</h2>
        <button onClick={onClose} className="h-10 rounded-lg bg-gray-700 px-3 font-bold text-white active:bg-gray-600">
          ← Volver
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        <div className="mb-3 flex gap-2">
          <button
            onClick={openNewProduct}
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
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              placeholder="Nombre categoría"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              className="h-10 flex-1 rounded-lg bg-gray-700 px-3 text-sm text-white outline-none"
            />
            <button
              onClick={handleAddCategory}
              className="h-10 rounded-lg bg-green-600 px-3 font-bold text-sm text-white active:bg-green-700"
            >
              OK
            </button>
          </div>
        )}

        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 h-10 w-full rounded-lg bg-gray-700 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
        />

        <CategoryTabs
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleDeleteCategory(cat.id)}
                className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-400 hover:text-red-400"
              >
                {cat.name} ✕
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {loading && <p className="text-gray-500">Cargando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-gray-500">No hay productos</p>
          )}
          {filtered.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2"
            >
              {product.photoUrl ? (
                <img
                  src={productPhotoUrl(product.photoUrl)}
                  alt={product.name}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-600 text-lg">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-bold text-white">{product.name}</p>
                <p className="text-xs text-gray-400">
                  {formatCOP(Number(product.price))}
                  {product.category && ` · ${product.category.name}`}
                  {!product.active && (
                    <span className="ml-1 text-red-400">Inactivo</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => openEditProduct(product)}
                className="h-8 rounded bg-gray-600 px-2 text-xs font-bold text-white active:bg-gray-500"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDeleteProduct(product.id)}
                className="h-8 rounded bg-red-600/30 px-2 text-xs font-bold text-red-300 active:bg-red-600/50"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
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
                step="0.01"
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
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4"
                />
                Activo
              </label>
              {editingProduct && (
                <div className="flex items-center gap-3">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="h-10 rounded-lg bg-gray-600 px-3 text-sm font-bold text-white active:bg-gray-500"
                  >
                    📷 Cambiar foto
                  </button>
                  {products.find((p) => p.id === editingProduct)?.photoUrl && (
                    <img
                      src={productPhotoUrl(products.find((p) => p.id === editingProduct)!.photoUrl)}
                      alt="Foto actual"
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowProductModal(false)}
                className="h-12 flex-1 rounded-xl bg-gray-600 font-bold text-white active:bg-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className="h-12 flex-1 rounded-xl bg-blue-600 font-bold text-white active:bg-blue-700"
              >
                Guardar
              </button>
            </div>
           </div>
        </div>
      )}
    </div>
  );
}
