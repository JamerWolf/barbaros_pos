import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore.js';
import { useProductStore } from '../store/productStore.js';
import { OrderItemList } from '../components/OrderItemList.js';
import { formatCOP } from '../utils/format.js';
import { ProductGrid } from '../components/ProductGrid.js';
import { PaymentModal } from '../components/Payment/PaymentModal.js';
import { Toast } from '../components/Toast.js';
import { useToast } from '../hooks/useToast.js';
import API_URL from '../utils/apiUrl.js';

export function AccountDetailPage(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readonly = searchParams.get('readonly') === '1';
  const shiftId = searchParams.get('shiftId');
  const { accounts, updateAccount } = useAccountStore();
  const { products, categories, fetchProducts, fetchCategories } = useProductStore();
  const account = id ? accounts[id] : undefined;

  const [confirmClose, setConfirmClose] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    fetchProducts(true);
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    if (!id) return;
    const loadItems = async () => {
      try {
        const res = await fetch(`${API_URL}/accounts/${id}`);
        if (res.ok) {
          const data = await res.json();
          updateAccount(data);
        }
      } catch {
        // silent
      }
    };
    loadItems();
  }, [id, updateAccount]);

  if (!account) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 p-4 text-white">
        <p className="text-gray-400">Cuenta no encontrada.</p>
        <button
          onClick={() => navigate('/')}
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

    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: item.quantity + 1 }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateAccount(updated);
      }
    } catch {
      // silent
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
        navigate('/');
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
    <div className="flex min-h-dvh flex-col gap-4 bg-gray-900 p-4 text-white">
      <header className="flex items-center gap-2">
        <button
          onClick={() => readonly ? navigate(shiftId ? `/reports?shiftId=${shiftId}` : '/reports') : navigate('/')}
          className="h-10 rounded-lg bg-gray-700 px-3 font-bold text-white active:bg-gray-600"
        >
          ← Volver
        </button>
        {readonly ? (
          <h1 className="flex-1 text-xl font-bold">{account.name || `Cuenta #${account.number}`} <span className="text-sm text-gray-400">#{account.id.slice(-4)}</span></h1>
        ) : (
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
        )}
      </header>

      {/* Total & Pending */}
      <div className="rounded-xl bg-gray-800 p-4">
        <p className="text-sm text-gray-400">Estado: {account.status}</p>
        <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
        {pendingAmount > 0 && (
          <p className="mt-2 text-lg text-yellow-400">
            Pendiente: {formatCOP(pendingAmount)}
          </p>
        )}
      </div>

      {/* Payment button (only when OPEN and not readonly) */}
      {account.status === 'OPEN' && !readonly && (
        <button
          onClick={() => setShowPaymentModal(true)}
          className="h-12 w-full rounded-lg bg-green-600 px-4 font-bold text-white active:bg-green-700"
        >
          Pagar
        </button>
      )}

      {/* Close button - only enabled when pending = 0 and not readonly */}
      {!readonly && (
        !confirmClose ? (
          <button
            onClick={() => canClose && setConfirmClose(true)}
            disabled={!canClose}
            className={`h-12 w-full rounded-lg px-4 font-bold text-white ${
              canClose
                ? 'bg-red-600 active:bg-red-700'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            {canClose ? 'Cerrar Cuenta' : `Pendiente: ${formatCOP(pendingAmount)}`}
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl bg-red-900/30 p-4">
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
        )
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
            // Refresh account data
            fetch(`${API_URL}/accounts/${account.id}`)
              .then((res) => res.json())
              .then((data) => updateAccount(data));
          }}
        />
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
        <OrderItemList items={account.items ?? []} onRemoveItem={readonly ? () => {} : handleRemoveItem} onIncrementItem={readonly ? () => {} : handleIncrementItem} />
      </section>

      {!readonly && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Agregar productos</h2>
          <ProductGrid
            products={products}
            categories={categories}
            onAddProduct={handleAddProduct}
          />
        </section>
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
