import { useEffect, useRef, useState } from 'react';
import { useAccountStore } from '../store/accountStore.js';
import { useProductStore } from '../store/productStore.js';
import { OrderItemList } from '../components/OrderItemList.js';
import { formatCOP } from '../utils/format.js';
import { ProductGrid } from '../components/ProductGrid.js';
import { PaymentModal } from '../components/Payment/PaymentModal.js';
import { Toast } from '../components/Toast.js';
import { useToast } from '../hooks/useToast.js';
import API_URL from '../utils/apiUrl.js';

interface AccountDetailModalProps {
  accountId: string;
  onClose: () => void;
}

export function AccountDetailModal({ accountId, onClose }: AccountDetailModalProps): JSX.Element {
  const { accounts, updateAccount } = useAccountStore();
  const { products, categories, fetchProducts, fetchCategories } = useProductStore();
  const account = accounts[accountId];

  const [confirmClose, setConfirmClose] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { toast, showToast } = useToast();
  const [ready, setReady] = useState(false);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Block ghost clicks for 300ms after opening
  useEffect(() => {
    readyTimer.current = setTimeout(() => setReady(true), 300);
    return () => { if (readyTimer.current) clearTimeout(readyTimer.current); };
  }, []);

  useEffect(() => {
    fetchProducts(true);
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const res = await fetch(`${API_URL}/accounts/${accountId}`);
        if (res.ok) {
          const data = await res.json();
          updateAccount(data);
        }
      } catch {
        // silent
      }
    };
    loadItems();
  }, [accountId, updateAccount]);

  if (!account) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-900 p-4 text-white">
        <p className="text-gray-400">Cuenta no encontrada.</p>
        <button
          onClick={onClose}
          className="h-12 rounded-lg bg-blue-600 px-6 font-bold text-white active:bg-blue-700"
        >
          Volver
        </button>
      </div>
    );
  }

  const handleAddProduct = async (productId: string) => {
    if (loadingItems) return;
    setLoadingItems(true);
    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateAccount(updated);
        const product = products.find(p => p.id === productId);
        showToast(`${product?.name || 'Producto'} agregado`);
      } else {
        showToast('No se pudo agregar el producto', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const item = account.items.find((i) => i.id === itemId);
    if (!item) return;
    const productName = item.product?.name || 'Producto';

    const newQty = item.quantity - 1;
    if (newQty < 1) {
      try {
        const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          const updated = await res.json();
          updateAccount(updated);
          showToast(`${productName} eliminado`);
        } else {
          showToast('No se pudo eliminar', 'error');
        }
      } catch {
        showToast('Error de conexión', 'error');
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: newQty }),
        });
        if (res.ok) {
          const updated = await res.json();
          updateAccount(updated);
        }
      } catch {
        showToast('Error de conexión', 'error');
      }
    }
  };

  const handleIncrementItem = async (itemId: string) => {
    const item = account.items.find((i) => i.id === itemId);
    if (!item) return;
    const productName = item.product?.name || 'Producto';

    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: item.quantity + 1 }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateAccount(updated);
        showToast(`${productName} × ${item.quantity + 1}`);
      } else {
        showToast('No se pudo actualizar', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const closeAccount = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/close`, {
        method: 'PUT',
      });
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : { deleted: true };
        if (data.deleted !== false) {
          useAccountStore.getState().removeAccount(account.id);
        }
        onClose();
      } else {
        const data = await res.json();
        showToast(data.message || 'No se pudo cerrar la cuenta', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const pendingAmount = account.pendingAmount ?? account.total ?? 0;
  const canClose = pendingAmount === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900 text-white"
      style={{ height: '100dvh' }}
      onPointerDown={(e) => { if (!ready) e.stopPropagation() }}
      onClick={(e) => { if (!ready) e.stopPropagation() }}
    >
      <header className="flex items-center gap-2 p-4">
        <button
          onClick={onClose}
          className="h-10 rounded-lg bg-gray-700 px-3 font-bold text-white active:bg-gray-600"
        >
          ← Volver
        </button>
        <input
          type="text"
          value={account.name || ''}
          placeholder={`Cuenta #${account.number} #${account.id.slice(-4)}`}
          onChange={(e) => {
            const newName = e.target.value;
            updateAccount({ ...account, name: newName });
          }}
          onBlur={async () => {
            await fetch(`${API_URL}/accounts/${account.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: account.name }),
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-0 min-w-0 flex-1 rounded-lg bg-gray-700 px-3 py-2 text-xl font-bold text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Total & Pending */}
        <div className="mb-4 rounded-xl bg-gray-800 p-4">
          <p className="text-sm text-gray-400">Estado: {account.status}</p>
          <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
          {pendingAmount > 0 && (
            <p className="mt-2 text-lg text-yellow-400">
              Pendiente: {formatCOP(pendingAmount)}
            </p>
          )}
        </div>

        {/* Payment button */}
        {account.status === 'OPEN' && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="mb-3 h-12 w-full rounded-lg bg-green-600 px-4 font-bold text-white active:bg-green-700"
          >
            Pagar
          </button>
        )}

        {/* Close button */}
        {!confirmClose ? (
          <button
            onClick={() => canClose && setConfirmClose(true)}
            disabled={!canClose}
            className={`mb-4 h-12 w-full rounded-lg px-4 font-bold text-white ${
              canClose
                ? 'bg-red-600 active:bg-red-700'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            {canClose ? 'Cerrar Cuenta' : `Pendiente: ${formatCOP(pendingAmount)}`}
          </button>
        ) : (
          <div className="mb-4 flex flex-col gap-2 rounded-xl bg-red-900/30 p-4">
            <p className="text-white">Seguro que queres cerrar la cuenta?</p>
            <div className="flex gap-2">
              <button
                onClick={closeAccount}
                className="h-12 flex-1 rounded-lg bg-red-600 font-bold text-white active:bg-red-700"
              >
                Si, cerrar
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="h-12 flex-1 rounded-lg bg-gray-700 font-bold text-white active:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <PaymentModal
            accountId={account.id}
            accountTotal={Number(account.total ?? 0)}
            pendingAmount={pendingAmount}
            payments={account.payments}
            accountDiscountType={account.discountType}
            accountDiscountValue={Number(account.discountValue ?? 0)}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => {
              fetch(`${API_URL}/accounts/${account.id}`)
                .then((res) => res.json())
                .then((data) => updateAccount(data));
            }}
          />
        )}

        <section className="mb-4">
          <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
          <OrderItemList items={account.items ?? []} onRemoveItem={handleRemoveItem} onIncrementItem={handleIncrementItem} />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Agregar productos</h2>
          <ProductGrid
            products={products}
            categories={categories}
            onAddProduct={handleAddProduct}
          />
        </section>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
