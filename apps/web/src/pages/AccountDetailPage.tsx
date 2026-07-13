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
import { tw } from '../utils/colors.js';
import type { Payment, PaymentMethod } from '@barbaros/shared';

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
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 ${tw.bg} p-4 ${tw.text}`}>
        <p className={tw.textMuted}>Cuenta no encontrada.</p>
        <button
          onClick={() => navigate('/')}
          className={`h-12 rounded-lg ${tw.primaryBg} px-6 font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80`}
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
  const payments = (account.payments ?? []) as Payment[];

  const paymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'TRANSFER': return 'Transferencia';
      case 'CARD': return 'Tarjeta';
      default: return method;
    }
  };

  return (
    <div className={`flex flex-col ${tw.bg} ${tw.text} lg:min-h-dvh lg:flex-row lg:gap-0 lg:p-0`}>
      {/* Mobile/Medium: single column — scrollable */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-dvh lg:hidden">
        <header className="flex items-center gap-2">
          <button
            onClick={() => readonly ? navigate(shiftId ? `/reports?shiftId=${shiftId}` : '/reports') : navigate('/')}
            className={`h-10 rounded-lg ${tw.bgCard} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}
          >
            ← Volver
          </button>
          {readonly ? (
            <h1 className={`flex-1 text-xl font-bold`}>{account.name || `Cuenta #${account.number}`} <span className={`text-sm ${tw.textMuted}`}>#{account.id.slice(-4)}</span></h1>
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
              className={`w-0 min-w-0 flex-1 rounded-lg ${tw.bgCard} px-3 py-2 text-xl font-bold ${tw.text} outline-none focus:ring-2 focus:ring-[#C8A84E]`}
            />
          )}
        </header>

        <div className={`rounded-xl ${tw.bgCard} p-4`}>
          <p className={`text-sm ${tw.textMuted}`}>Estado: {account.status}</p>
          <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
          {pendingAmount > 0 && (
            <p className="mt-2 text-lg text-[#E85050]">Pendiente: {formatCOP(pendingAmount)}</p>
          )}
        </div>

        {account.status === 'OPEN' && !readonly && (
          <button onClick={() => setShowPaymentModal(true)} className="h-12 w-full rounded-lg bg-[#2D5A27] px-4 font-bold text-[#7CCD7C] active:bg-[#2D5A27]/80">
            Pagar
          </button>
        )}

        {!readonly && (
          !confirmClose ? (
            <button
              onClick={() => canClose && setConfirmClose(true)}
              disabled={!canClose}
              className={`h-12 w-full rounded-lg px-4 font-bold ${canClose ? 'bg-[#5C1A1A] text-[#E85050] active:bg-[#5C1A1A]/80' : 'bg-[#1E1E1E] text-[#7A7060] cursor-not-allowed opacity-50'}`}
            >
              {canClose ? 'Cerrar Cuenta' : `Pendiente: ${formatCOP(pendingAmount)}`}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl bg-[#5C1A1A]/30 p-4">
              <p className={tw.text}>Seguro que queres cerrar la cuenta?</p>
              <div className="flex gap-2">
                <button onClick={closeAccount} className="h-12 flex-1 rounded-lg bg-[#5C1A1A] font-bold text-[#E85050] active:bg-[#5C1A1A]/80">Si, cerrar</button>
                <button onClick={() => setConfirmClose(false)} className={`h-12 flex-1 rounded-lg ${tw.bgCard} font-bold ${tw.text} active:bg-[#1E1E1E]`}>Cancelar</button>
              </div>
            </div>
          )
        )}

        <section>
          <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
          <OrderItemList items={account.items ?? []} onRemoveItem={readonly ? () => {} : handleRemoveItem} onIncrementItem={readonly ? () => {} : handleIncrementItem} />
        </section>

        {readonly && payments.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-bold">Historial de pagos</h2>
            <div className={`rounded-xl ${tw.bgCard} divide-y divide-[#C8A84E]/10`}>
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className={`text-sm ${tw.textMuted}`}>{paymentMethodLabel(p.method)}</p>
                    <p className="text-xs text-[#7A7060]">
                      {new Date(p.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {p.proofUrl && (
                      <a href={`${API_URL}/${p.proofUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C8A84E] underline">
                        Ver comprobante
                      </a>
                    )}
                  </div>
                  <p className="font-bold text-[#7CCD7C]">{formatCOP(Number(p.amount))}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!readonly && (
          <section>
            <h2 className="mb-2 text-lg font-bold">Agregar productos</h2>
            <ProductGrid products={products} categories={categories} onAddProduct={handleAddProduct} />
          </section>
        )}
      </div>

      {/* Desktop (lg+): two columns — products left, account right */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-row">
        {/* Left: products (hidden in readonly) */}
        {!readonly && (
          <div className={`flex flex-1 flex-col gap-4 border-r border-[#C8A84E]/20 p-4`}>
            <h2 className="text-lg font-bold">Agregar productos</h2>
            <ProductGrid products={products} categories={categories} onAddProduct={handleAddProduct} />
          </div>
        )}

        {/* Right: account detail */}
        <div className="flex w-[420px] flex-col gap-4 p-4">
          <header className="flex items-center gap-2">
            <button
              onClick={() => readonly ? navigate(shiftId ? `/reports?shiftId=${shiftId}` : '/reports') : navigate('/')}
              className={`h-10 rounded-lg ${tw.bgCard} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}
            >
              ← Volver
            </button>
            {readonly ? (
              <h1 className={`flex-1 text-xl font-bold`}>{account.name || `Cuenta #${account.number}`} <span className={`text-sm ${tw.textMuted}`}>#{account.id.slice(-4)}</span></h1>
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
              className={`w-0 min-w-0 flex-1 rounded-lg ${tw.bgCard} px-3 py-2 text-xl font-bold ${tw.text} outline-none focus:ring-2 focus:ring-[#C8A84E]`}
              />
            )}
          </header>

          <div className={`rounded-xl ${tw.bgCard} p-4`}>
            <p className={`text-sm ${tw.textMuted}`}>Estado: {account.status}</p>
            <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
            {pendingAmount > 0 && (
              <p className="mt-2 text-lg text-[#E85050]">Pendiente: {formatCOP(pendingAmount)}</p>
            )}
          </div>

          {account.status === 'OPEN' && !readonly && (
            <button onClick={() => setShowPaymentModal(true)} className="h-12 w-full rounded-lg bg-[#2D5A27] px-4 font-bold text-[#7CCD7C] active:bg-[#2D5A27]/80">
              Pagar
            </button>
          )}

          {!readonly && (
            !confirmClose ? (
              <button
                onClick={() => canClose && setConfirmClose(true)}
                disabled={!canClose}
                className={`h-12 w-full rounded-lg px-4 font-bold ${canClose ? 'bg-[#5C1A1A] text-[#E85050] active:bg-[#5C1A1A]/80' : 'bg-[#1E1E1E] text-[#7A7060] cursor-not-allowed opacity-50'}`}
              >
                {canClose ? 'Cerrar Cuenta' : `Pendiente: ${formatCOP(pendingAmount)}`}
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl bg-[#5C1A1A]/30 p-4">
                <p className={tw.text}>Seguro que queres cerrar la cuenta?</p>
                <div className="flex gap-2">
                  <button onClick={closeAccount} className="h-12 flex-1 rounded-lg bg-[#5C1A1A] font-bold text-[#E85050] active:bg-[#5C1A1A]/80">Si, cerrar</button>
                  <button onClick={() => setConfirmClose(false)} className={`h-12 flex-1 rounded-lg ${tw.bgCard} font-bold ${tw.text} active:bg-[#1E1E1E]`}>Cancelar</button>
                </div>
              </div>
            )
          )}

          <section>
            <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
            <OrderItemList items={account.items ?? []} onRemoveItem={readonly ? () => {} : handleRemoveItem} onIncrementItem={readonly ? () => {} : handleIncrementItem} />
          </section>

          {readonly && payments.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold">Historial de pagos</h2>
              <div className={`rounded-xl ${tw.bgCard} divide-y divide-[#C8A84E]/10`}>
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className={`text-sm ${tw.textMuted}`}>{paymentMethodLabel(p.method)}</p>
                      <p className="text-xs text-[#7A7060]">
                        {new Date(p.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {p.proofUrl && (
                        <a href={`${API_URL}/${p.proofUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C8A84E] underline">
                          Ver comprobante
                        </a>
                      )}
                    </div>
                    <p className="font-bold text-[#7CCD7C]">{formatCOP(Number(p.amount))}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
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
          onSuccess={() => {
            fetch(`${API_URL}/accounts/${account.id}`)
              .then((res) => res.json())
              .then((data) => updateAccount(data));
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
