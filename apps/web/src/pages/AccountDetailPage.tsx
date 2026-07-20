import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAccountStore } from '../store/accountStore.js'
import { useProductStore } from '../store/productStore.js'
import { OrderItemList } from '../components/OrderItemList.js'
import { formatCOP } from '../utils/format.js'
import { ProductGrid } from '../components/ProductGrid.js'
import { PaymentModal } from '../components/Payment/PaymentModal.js'
import { Toast } from '../components/Toast.js'
import { useToast } from '../hooks/useToast.js'
import API_URL from '../utils/apiUrl.js'
import { tw } from '../utils/colors.js'
import {
  voidAccount as apiVoidAccount,
  reopenAccount as apiReopenAccount,
} from '../services/accountApi.js'
import type { Payment, PaymentMethod, AccountStatus } from '@barbaros/shared'

export function AccountDetailPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const readonly = searchParams.get('readonly') === '1'
  const shiftId = searchParams.get('shiftId')
  const { accounts, updateAccount } = useAccountStore()
  const { products, categories, fetchProducts, fetchCategories } = useProductStore()
  const account = id ? accounts[id] : undefined

  const [confirmClose, setConfirmClose] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [previewProof, setPreviewProof] = useState<string | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinAction, setPinAction] = useState<'void' | 'reopen' | null>(null)
  const [processingAction, setProcessingAction] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => {
    fetchProducts(true)
    fetchCategories()
  }, [fetchProducts, fetchCategories])

  useEffect(() => {
    if (!id) return
    const loadItems = async () => {
      try {
        const res = await fetch(`${API_URL}/accounts/${id}`)
        if (res.ok) {
          const data = await res.json()
          updateAccount(data)
        }
      } catch {
        // silent
      }
    }
    loadItems()
  }, [id, updateAccount])

  if (!account) {
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center gap-4 ${tw.bg} p-4 ${tw.text}`}
      >
        <p className={tw.textMuted}>Cuenta no encontrada.</p>
        <button
          onClick={() => navigate('/')}
          className={`h-12 rounded-lg ${tw.primaryBg} px-6 font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80`}
        >
          Volver
        </button>
      </div>
    )
  }

  const handleAddProduct = async (productId: string) => {
    if (loadingItems) return
    setLoadingItems(true)
    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateAccount(updated)
        const product = products.find((p) => p.id === productId)
        showToast(`${product?.name || 'Producto'} agregado`)
      } else {
        showToast('No se pudo agregar el producto', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setLoadingItems(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    const item = account.items.find((i) => i.id === itemId)
    if (!item) return
    const productName = item.product?.name || 'Producto'

    const newQty = item.quantity - 1
    if (newQty < 1) {
      try {
        const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          const updated = await res.json()
          updateAccount(updated)
          showToast(`${productName} eliminado`)
        } else {
          showToast('No se pudo eliminar', 'error')
        }
      } catch {
        showToast('Error de conexión', 'error')
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: newQty }),
        })
        if (res.ok) {
          const updated = await res.json()
          updateAccount(updated)
        }
      } catch {
        showToast('Error de conexión', 'error')
      }
    }
  }

  const handleIncrementItem = async (itemId: string) => {
    const item = account.items.find((i) => i.id === itemId)
    if (!item) return
    const productName = item.product?.name || 'Producto'

    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: item.quantity + 1 }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateAccount(updated)
        showToast(`${productName} × ${item.quantity + 1}`)
      } else {
        showToast('No se pudo actualizar', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const closeAccount = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/${account.id}/close`, {
        method: 'PUT',
      })
      if (res.ok) {
        const text = await res.text()
        const data = text ? JSON.parse(text) : { deleted: true }
        if (data.deleted !== false) {
          useAccountStore.getState().removeAccount(account.id)
        }
        navigate('/')
      } else {
        const data = await res.json()
        showToast(data.message || 'No se pudo cerrar la cuenta', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const pendingAmount = account.pendingAmount ?? account.total ?? 0
  const canClose = pendingAmount === 0
  const payments = (account.payments ?? []) as Payment[]

  const paymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH':
        return 'Efectivo'
      case 'TRANSFER':
        return 'Transferencia'
      case 'CARD':
        return 'Tarjeta'
      default:
        return method
    }
  }

  const statusLabel = (status: AccountStatus) => {
    switch (status) {
      case 'OPEN':
        return 'Abierta'
      case 'CLOSED':
        return 'Cerrada'
      case 'VOIDED':
        return 'Anulada'
      default:
        return status
    }
  }

  const closePinModal = () => {
    setShowPinModal(false)
    setPin('')
    setPinError(null)
    setPinAction(null)
  }

  const openPinModal = (action: 'void' | 'reopen') => {
    setPinAction(action)
    setPin('')
    setPinError(null)
    setShowPinModal(true)
  }

  const submitPin = async () => {
    if (!pinAction) return
    setProcessingAction(true)
    if (pinAction === 'void') {
      const result = await apiVoidAccount(account.id, pin)
      if (result.ok) {
        updateAccount(result.account)
        closePinModal()
        showToast('Cuenta anulada')
      } else {
        setPinError(result.message || 'PIN incorrecto')
      }
    } else {
      const result = await apiReopenAccount(account.id, pin)
      if (result.ok) {
        updateAccount(result.account)
        closePinModal()
        navigate(`/accounts/${account.id}`)
      } else {
        setPinError(result.message || 'PIN incorrecto')
      }
    }
    setProcessingAction(false)
  }

  const handleEdit = () => {
    if (account.status === 'VOIDED') return
    if (account.status === 'OPEN') {
      navigate(`/accounts/${account.id}`)
    } else {
      openPinModal('reopen')
    }
  }

  const isVoided = account.status === 'VOIDED'

  return (
    <div className={`flex flex-col ${tw.bg} ${tw.text} lg:min-h-dvh lg:flex-row lg:gap-0 lg:p-0`}>
      {/* Mobile/Medium: single column — scrollable */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-dvh lg:hidden">
        <header className="flex items-center gap-2">
          <button
            onClick={() =>
              readonly
                ? navigate(shiftId ? `/reports?shiftId=${shiftId}` : '/reports')
                : navigate('/')
            }
            className={`h-10 rounded-lg ${tw.bgCard} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}
          >
            ← Volver
          </button>
          {readonly ? (
            <h1 className={`flex-1 text-xl font-bold`}>
              {account.name || `Cuenta #${account.number}`}{' '}
              <span className={`text-sm ${tw.textMuted}`}>#{account.id.slice(-4)}</span>
            </h1>
          ) : (
            <input
              type="text"
              value={account.name || ''}
              placeholder={`Cuenta #${account.number} #${account.id.slice(-4)}`}
              onChange={(e) => {
                const newName = e.target.value
                updateAccount({ ...account, name: newName })
              }}
              onBlur={async () => {
                await fetch(`${API_URL}/accounts/${account.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: account.name }),
                })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              disabled={isVoided}
              className={`w-0 min-w-0 flex-1 rounded-lg ${tw.bgCard} px-3 py-2 text-xl font-bold ${tw.text} outline-none focus:ring-2 focus:ring-[#C8A84E] disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          )}
        </header>

        <div className={`rounded-xl ${tw.bgCard} p-4`}>
          <p className={`text-sm ${tw.textMuted}`}>
            Estado:{' '}
            <span className={isVoided ? 'font-bold text-[#E85050]' : tw.text}>
              {statusLabel(account.status)}
            </span>
          </p>
          <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
          {!isVoided && pendingAmount > 0 && (
            <p className="mt-2 text-lg text-[#E85050]">Pendiente: {formatCOP(pendingAmount)}</p>
          )}
        </div>

        {account.status === 'OPEN' && !readonly && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="h-12 w-full rounded-lg bg-[#2D5A27] px-4 font-bold text-[#7CCD7C] active:bg-[#2D5A27]/80"
          >
            Pagar
          </button>
        )}

        {!readonly &&
          !isVoided &&
          (!confirmClose ? (
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
                <button
                  onClick={closeAccount}
                  className="h-12 flex-1 rounded-lg bg-[#5C1A1A] font-bold text-[#E85050] active:bg-[#5C1A1A]/80"
                >
                  Si, cerrar
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className={`h-12 flex-1 rounded-lg ${tw.bgCard} font-bold ${tw.text} active:bg-[#1E1E1E]`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))}

        <section>
          <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
          <OrderItemList
            items={account.items ?? []}
            onRemoveItem={handleRemoveItem}
            onIncrementItem={handleIncrementItem}
            readonly={readonly}
          />
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
                      {new Date(p.createdAt).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {p.proofUrl && (
                      <button
                        onClick={() => setPreviewProof(`/${p.proofUrl}`)}
                        className="text-xs text-[#C8A84E] underline"
                      >
                        Ver comprobante
                      </button>
                    )}
                  </div>
                  <p className="font-bold text-[#7CCD7C]">{formatCOP(Number(p.amount))}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {readonly && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => openPinModal('void')}
              disabled={isVoided || processingAction}
              className={`h-12 w-full rounded-lg px-4 font-bold active:bg-[#5C1A1A]/80 ${isVoided ? 'cursor-not-allowed opacity-50' : ''} bg-[#5C1A1A] text-[#E85050]`}
            >
              Anular cuenta
            </button>
            <button
              onClick={handleEdit}
              disabled={isVoided}
              className={`h-12 w-full rounded-lg bg-[#141414] px-4 font-bold text-[#E8E0D0] active:bg-[#1E1E1E] ${isVoided ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              Editar cuenta
            </button>
          </div>
        )}

        {!readonly && !isVoided && (
          <section>
            <h2 className="mb-2 text-lg font-bold">Agregar productos</h2>
            <ProductGrid
              products={products}
              categories={categories}
              onAddProduct={handleAddProduct}
            />
          </section>
        )}
      </div>

      {/* Desktop (lg+): two columns — products left, account right */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-row">
        {/* Left: products (hidden in readonly and voided) */}
        {!readonly && !isVoided && (
          <div className={`flex flex-1 flex-col gap-4 border-r border-[#C8A84E]/20 p-4`}>
            <h2 className="text-lg font-bold">Agregar productos</h2>
            <ProductGrid
              products={products}
              categories={categories}
              onAddProduct={handleAddProduct}
            />
          </div>
        )}

        {/* Right: account detail */}
        <div className="flex w-[420px] flex-col gap-4 p-4">
          <header className="flex items-center gap-2">
            <button
              onClick={() =>
                readonly
                  ? navigate(shiftId ? `/reports?shiftId=${shiftId}` : '/reports')
                  : navigate('/')
              }
              className={`h-10 rounded-lg ${tw.bgCard} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}
            >
              ← Volver
            </button>
            {readonly ? (
              <h1 className={`flex-1 text-xl font-bold`}>
                {account.name || `Cuenta #${account.number}`}{' '}
                <span className={`text-sm ${tw.textMuted}`}>#{account.id.slice(-4)}</span>
              </h1>
            ) : (
              <input
                type="text"
                value={account.name || ''}
                placeholder={`Cuenta #${account.number} #${account.id.slice(-4)}`}
                onChange={(e) => {
                  const newName = e.target.value
                  updateAccount({ ...account, name: newName })
                }}
                onBlur={async () => {
                  await fetch(`${API_URL}/accounts/${account.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: account.name }),
                  })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                disabled={isVoided}
                className={`w-0 min-w-0 flex-1 rounded-lg ${tw.bgCard} px-3 py-2 text-xl font-bold ${tw.text} outline-none focus:ring-2 focus:ring-[#C8A84E] disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            )}
          </header>

          <div className={`rounded-xl ${tw.bgCard} p-4`}>
            <p className={`text-sm ${tw.textMuted}`}>
              Estado:{' '}
              <span className={isVoided ? 'font-bold text-[#E85050]' : tw.text}>
                {statusLabel(account.status)}
              </span>
            </p>
            <p className="mt-1 text-3xl font-bold">{formatCOP(Number(account.total ?? 0))}</p>
            {!isVoided && pendingAmount > 0 && (
              <p className="mt-2 text-lg text-[#E85050]">Pendiente: {formatCOP(pendingAmount)}</p>
            )}
          </div>

          {account.status === 'OPEN' && !readonly && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="h-12 w-full rounded-lg bg-[#2D5A27] px-4 font-bold text-[#7CCD7C] active:bg-[#2D5A27]/80"
            >
              Pagar
            </button>
          )}

          {!readonly &&
            !isVoided &&
            (!confirmClose ? (
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
                  <button
                    onClick={closeAccount}
                    className="h-12 flex-1 rounded-lg bg-[#5C1A1A] font-bold text-[#E85050] active:bg-[#5C1A1A]/80"
                  >
                    Si, cerrar
                  </button>
                  <button
                    onClick={() => setConfirmClose(false)}
                    className={`h-12 flex-1 rounded-lg ${tw.bgCard} font-bold ${tw.text} active:bg-[#1E1E1E]`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}

          <section>
            <h2 className="mb-2 text-lg font-bold">Productos en la cuenta</h2>
            <OrderItemList
              items={account.items ?? []}
              onRemoveItem={handleRemoveItem}
              onIncrementItem={handleIncrementItem}
              readonly={readonly}
            />
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
                        {new Date(p.createdAt).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {p.proofUrl && (
                        <button
                          onClick={() => setPreviewProof(`/${p.proofUrl}`)}
                          className="text-xs text-[#C8A84E] underline"
                        >
                          Ver comprobante
                        </button>
                      )}
                    </div>
                    <p className="font-bold text-[#7CCD7C]">{formatCOP(Number(p.amount))}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {readonly && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => openPinModal('void')}
                disabled={isVoided || processingAction}
                className={`h-12 w-full rounded-lg px-4 font-bold active:bg-[#5C1A1A]/80 ${isVoided ? 'cursor-not-allowed opacity-50' : ''} bg-[#5C1A1A] text-[#E85050]`}
              >
                Anular cuenta
              </button>
              <button
                onClick={handleEdit}
                disabled={isVoided}
                className={`h-12 w-full rounded-lg bg-[#141414] px-4 font-bold text-[#E8E0D0] active:bg-[#1E1E1E] ${isVoided ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Editar cuenta
              </button>
            </div>
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
              .then((data) => updateAccount(data))
          }}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6 shadow-2xl">
            <h2 className="mb-2 text-xl font-bold text-[#E8E0D0]">
              {pinAction === 'void' ? 'Anular cuenta' : 'Editar cuenta'}
            </h2>
            {pinAction === 'void' && (
              <p className="mb-4 text-sm text-[#E85050]">
                Esta acción es irreversible. Ingresá el PIN de admin para confirmar.
              </p>
            )}
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={processingAction}
              className="mb-4 h-14 w-full rounded-xl bg-[#1E1E1E] px-4 text-center text-2xl tracking-widest text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E] disabled:opacity-50"
            />
            {pinError && <p className="mb-4 text-center text-sm text-[#E85050]">{pinError}</p>}
            <div className="flex gap-3">
              <button
                onClick={closePinModal}
                disabled={processingAction}
                className="h-12 flex-1 rounded-xl bg-[#1E1E1E] font-bold text-[#E8E0D0] active:bg-[#1E1E1E]/80 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitPin}
                disabled={processingAction || pin.length === 0}
                className="h-12 flex-1 rounded-xl bg-[#C8A84E] font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {previewProof && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewProof(null)}
        >
          <div className="relative max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewProof}
              alt="Comprobante de pago"
              className="max-h-[85vh] max-w-full rounded-xl object-contain"
            />
            <button
              onClick={() => setPreviewProof(null)}
              className="absolute right-2 top-2 h-10 w-10 rounded-full bg-black/60 text-xl font-bold text-white active:bg-black/80"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
