import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '../../store/productStore.js';
import { CategoryTabs } from '../CategoryTabs.js';
import { formatCOP } from '../../utils/format.js';
import { productPhotoUrl } from '../../utils/productPhoto.js';
import { tw } from '../../utils/colors.js';
import { useToast } from '../../hooks/useToast.js';

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
    importProducts,
  } = useProductStore();

  const { toast, showToast } = useToast();

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

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPhotos, setImportPhotos] = useState<File[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const importCsvRef = useRef<HTMLInputElement>(null);
  const importPhotosRef = useRef<HTMLInputElement>(null);

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

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await importProducts(importFile, importPhotos);
      const msg = `Importados: ${result.created} | Saltados: ${result.skipped} | Errores: ${result.errors.length}`;
      if (result.errors.length > 0) {
        showToast(`${msg}\n${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`, 'error');
      } else {
        showToast(msg, 'success');
      }
      await fetchProducts();
      setShowImportModal(false);
      setImportFile(null);
      setImportPhotos([]);
    } catch {
      showToast('Error al importar productos', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A] text-[#E8E0D0]" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className={`h-10 rounded-lg ${tw.bgHover} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}>
            ← Volver
          </button>
          <h2 className="text-lg font-bold">Productos</h2>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className={`h-10 rounded-lg ${tw.bgHover} px-3 font-bold text-sm ${tw.text} active:bg-[#1E1E1E]`}
        >
          📄 CSV
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        <div className="mb-3 flex gap-2">
          <button
            onClick={openNewProduct}
            className="h-10 flex-1 rounded-lg bg-[#C8A84E] font-bold text-sm text-[#E8E0D0] active:bg-[#C8A84E]/80"
          >
            + Producto
          </button>
          <button
            onClick={() => setShowCategoryInput(!showCategoryInput)}
            className="h-10 flex-1 rounded-lg bg-[#141414] font-bold text-sm text-[#E8E0D0] active:bg-[#1E1E1E]"
          >
            + Categoría
          </button>
        </div>

        {showCategoryInput && (
          <div className="mb-3 flex flex-col gap-2">
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleDeleteCategory(cat.id)}
                    className={`rounded ${tw.bgHover} px-2 py-0.5 text-xs ${tw.textMuted} hover:text-[#E85050]`}
                  >
                    {cat.name} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                className="h-10 flex-1 rounded-lg bg-[#1E1E1E] px-3 text-sm text-[#E8E0D0] outline-none"
              />
              <button
                onClick={handleAddCategory}
                className="h-10 rounded-lg bg-[#C8A84E] px-3 font-bold text-sm text-[#E8E0D0] active:bg-[#C8A84E]/80"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 h-10 w-full rounded-lg bg-[#1E1E1E] px-3 text-sm text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
        />

        <CategoryTabs
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <div className="mt-4 flex flex-col gap-2">
          {loading && <p className={tw.textMuted}>Cargando...</p>}
          {!loading && filtered.length === 0 && (
            <p className={tw.textMuted}>No hay productos</p>
          )}
          {filtered.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-2 rounded-lg bg-[#1E1E1E] px-3 py-2"
            >
              {product.photoUrl ? (
                <img
                  src={productPhotoUrl(product.photoUrl)}
                  alt={product.name}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tw.bgHover} text-lg`}>
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-bold text-[#E8E0D0]">{product.name}</p>
                <p className="text-xs text-[#7A7060]">
                  {formatCOP(Number(product.price))}
                  {product.category && ` · ${product.category.name}`}
                  {!product.active && (
                    <span className={`ml-1 ${tw.error}`}>Inactivo</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => openEditProduct(product)}
                className={`h-8 rounded ${tw.bgHover} px-2 text-xs font-bold ${tw.text} active:bg-[#1E1E1E]`}
              >
                ✏️
              </button>
              <button
                onClick={() => handleDeleteProduct(product.id)}
                className={`h-8 rounded ${tw.errorBg} px-2 text-xs font-bold ${tw.error} active:bg-[#5C1A1A]/80`}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6">
            <h3 className="mb-4 text-lg font-bold text-[#E8E0D0]">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
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
                step="0.01"
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
              <label className={`flex items-center gap-2 text-sm ${tw.text}`}>
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
                    className={`h-10 rounded-lg ${tw.bgHover} px-3 text-sm font-bold ${tw.text} active:bg-[#1E1E1E]`}
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
                className={`h-12 flex-1 rounded-xl ${tw.bgHover} font-bold ${tw.text} active:bg-[#1E1E1E]`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className="h-12 flex-1 rounded-xl bg-[#141414] font-bold text-[#E8E0D0] active:bg-[#1E1E1E]"
              >
                Guardar
              </button>
            </div>
           </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold ${
            toast.type === 'success' ? `${tw.successBg} ${tw.success}` : `${tw.errorBg} ${tw.error}`
          }`}
          style={{ whiteSpace: 'pre-line', maxWidth: '90vw', textAlign: 'center' }}
        >
          {toast.message}
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6">
            <h3 className="mb-4 text-lg font-bold text-[#E8E0D0]">Importar CSV</h3>
            <div className="flex flex-col gap-3">
              <div>
                <input
                  ref={importCsvRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setImportFile(file);
                    setImportPhotos([]);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => importCsvRef.current?.click()}
                  className={`h-12 w-full rounded-xl ${tw.bgHover} font-bold ${tw.text} active:bg-[#1E1E1E]`}
                >
                  {importFile ? importFile.name : '📄 Seleccionar CSV'}
                </button>
              </div>

              {importFile && (
                <div className="rounded-lg bg-[#1E1E1E] p-3 text-sm text-[#7A7060]">
                  Archivo: {importFile.name}
                </div>
              )}

              <div>
                <input
                  ref={importPhotosRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setImportPhotos(Array.from(e.target.files ?? []))}
                  className="hidden"
                />
                <button
                  onClick={() => importPhotosRef.current?.click()}
                  className={`h-12 w-full rounded-xl ${tw.bgHover} font-bold ${tw.text} active:bg-[#1E1E1E]`}
                >
                  {importPhotos.length > 0
                    ? `${importPhotos.length} fotos seleccionadas`
                    : '📷 Fotos (opcional)'}
                </button>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPhotos([]);
                }}
                className={`h-12 flex-1 rounded-xl ${tw.bgHover} font-bold ${tw.text} active:bg-[#1E1E1E]`}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importLoading}
                className="h-12 flex-1 rounded-xl bg-[#C8A84E] font-bold text-[#E8E0D0] active:bg-[#C8A84E]/80 disabled:opacity-50"
              >
                {importLoading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
