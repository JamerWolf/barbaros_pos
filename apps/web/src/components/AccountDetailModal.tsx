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
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0A0A0A] p-4 text-[#E8E0D0]">
        <p className="text-[#7A7060]">Cuenta no encontrada.</p>
        <button
          onClick={onClose}
          className="h-12 rounded-lg bg-[#141414] border border-[#C8A84E]/30 px-6 font-bold text-[#C8A84E] active:bg-[#1E1E1E]"
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
      className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A] text-[#E8E0D0] lg:flex-row"
      style={{ height: '100dvh' }}
    >
      {/* Ghost touch shield */}
      {!ready && (
        <div className="absolute inset-0 z-[9999]" onPointerDown={(e) => e.preventDefault()} />
      )}

      {/* Mobile: single column — scrollable */}
      <div className="flex flex-col overflow-y-auto lg:hidden" style={{ height: '100dvh', overscrollBehavior: 'contain' }}>
        <header className="flex shrink-0 items-center gap-2 p-4">
          <button onClick={onClose} className="h-10 rounded-lg bg-[#141414] px-3 font-bold text-[#E8E0D0] active:bg-[#1E1E1E]">← Volver</button>
          <input
            type="text"
            value={account.name || ''}
            placeholder={`Cuenta #${account.number} #${account.id.slice(-4)}`}
            onChange={(e) => { updateAccount({ ...account, name: e.target.value }); }}
            onBlur={async () => { await fetch(`${API_URL}/accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: account.name }) }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-0 min-w-0 flex-1 rounded-lg bg-[#141414] px-3 py-2 text-xl font-bold text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
          />
        </header>
        <div className="px-4 pb-4">
          <div className="mb-4 rounded-xl bg-[#141414] p-4">
            <p className="text-sm text-[#7A7060]">Estado: {account.status}</p>
            <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
            {pendingAmount > 0 && <p className="mt-2 text-lg text-[#E85050]">Pendiente: {formatCOP(pendingAmount)}</p>}
          </div>
          {account.status === 'OPEN' && (
            <button onClick={() => setShowPaymentModal(true)} className="mb-3 h-12 w-full rounded-lg bg-[#C8A84E] px-4 font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80">Pagar</button>
          )}
          {!confirmClose ? (
            <button onClick={() => canClose && setConfirmClose(true)} disabled={!canClose} className={`mb-4 h-12 w-full rounded-lg px-4 font-bold text-[#E8E0D0] ${canClose ? 'bg-[#5C1A1A] active:bg-[#5C1A1A]/80' : 'bg-[#1E1E1E] cursor-not-allowed opacity-50'}`}>
              {canClose ? 'Cerrar Cuenta' : `Pendiente: ${formatCOP(pendingAmount)}`}
            </button>
          ) : (
            <div className="mb-4 flex flex-col gap-2 rounded-xl bg-[#5C1A1A]/30 p-4">
              <p className="text-[#E8E0D0]">Seguro que queres cerrar la cuenta?</p>
              <div className="flex gap-2">
                <button onClick={closeAccount} className="h-12 flex-1 rounded-lg bg-[#5C1A1A] font-bold text-[#E8E0D0] active:bg-[#5C1A1A]/80">Si, cerrar</button>
                <button onClick={() => setConfirmClose(false)} className="h-12 flex-1 rounded-lg bg-[#141414] font-bold text-[#E8E0D0] active:bg-[#1E1E1E]">Cancelar</button>
              </div>
            </div>
          )}
          <section className="mb-4">
            <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
            <OrderItemList items={account.items ?? []} onRemoveItem={handleRemoveItem} onIncrementItem={handleIncrementItem} />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Agregar productos</h2>
            <ProductGrid products={products} categories={categories} onAddProduct={handleAddProduct} />
          </section>
        </div>
      </div>

      {/* Desktop (lg+): two columns */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-row lg:overflow-hidden">
        {/* Left: products */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto border-r border-[#C8A84E]/20 p-4">
          <button onClick={onClose} className="h-10 w-full rounded-lg bg-[#141414] px-3 font-bold text-[#E8E0D0] active:bg-[#1E1E1E]">← Volver</button>
          <h2 className="text-lg font-bold">Agregar productos</h2>
          <ProductGrid products={products} categories={categories} onAddProduct={handleAddProduct} />
        </div>

        {/* Right: account detail */}
        <div className="flex w-[400px] flex-col overflow-y-auto p-4">
          <header className="mb-4 flex items-center gap-2">
            <button onClick={onClose} className="h-10 rounded-lg bg-[#141414] px-3 font-bold text-[#E8E0D0] active:bg-[#1E1E1E]">← Volver</button>
            <input
              type="text"
              value={account.name || ''}
              placeholder={`Cuenta #${account.number} #${account.id.slice(-4)}`}
              onChange={(e) => { updateAccount({ ...account, name: e.target.value }); }}
              onBlur={async () => { await fetch(`${API_URL}/accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: account.name }) }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-0 min-w-0 flex-1 rounded-lg bg-[#141414] px-3 py-2 text-xl font-bold text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
            />
          </header>

          <div className="mb-4 rounded-xl bg-[#141414] p-4">
            <p className="text-sm text-[#7A7060]">Estado: {account.status}</p>
            <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
            {pendingAmount > 0 && <p className="mt-2 text-lg text-[#E85050]">Pendiente: {formatCOP(pendingAmount)}</p>}
          </div>

          {account.status === 'OPEN' && (
            <button onClick={() => setShowPaymentModal(true)} className="mb-3 h-12 w-full rounded-lg bg-[#C8A84E] px-4 font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80">Pagar</button>
          )}

          {!confirmClose ? (
            <button onClick={() => canClose && setConfirmClose(true)} disabled={!canClose} className={`mb-4 h-12 w-full rounded-lg px-4 font-bold text-[#E8E0D0] ${canClose ? 'bg-[#5C1A1A] active:bg-[#5C1A1A]/80' : 'bg-[#1E1E1E] cursor-not-allowed opacity-50'}`}>
              {canClose ? 'Cerrar Cuenta' : `Pendiente: ${formatCOP(pendingAmount)}`}
            </button>
          ) : (
            <div className="mb-4 flex flex-col gap-2 rounded-xl bg-[#5C1A1A]/30 p-4">
              <p className="text-[#E8E0D0]">Seguro que queres cerrar la cuenta?</p>
              <div className="flex gap-2">
                <button onClick={closeAccount} className="h-12 flex-1 rounded-lg bg-[#5C1A1A] font-bold text-[#E8E0D0] active:bg-[#5C1A1A]/80">Si, cerrar</button>
                <button onClick={() => setConfirmClose(false)} className="h-12 flex-1 rounded-lg bg-[#141414] font-bold text-[#E8E0D0] active:bg-[#1E1E1E]">Cancelar</button>
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
            <OrderItemList items={account.items ?? []} onRemoveItem={handleRemoveItem} onIncrementItem={handleIncrementItem} />
          </section>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          accountId={account.id}
          accountTotal={Number(account.total ?? 0)}
          pendingAmount={pendingAmount}
          payments={account.payments}
          accountDiscountType={account.discountType}
          accountDiscountValue={Number(account.discountValue ?? 0)}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { fetch(`${API_URL}/accounts/${account.id}`).then((res) => res.json()).then((data) => updateAccount(data)); }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
