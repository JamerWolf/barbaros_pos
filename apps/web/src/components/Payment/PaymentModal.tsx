import { useState } from 'react';
import { PaymentMethod, DiscountType } from '@barbaros/shared';
import type { Payment, IAccount } from '@barbaros/shared';
import { formatCOP } from '../../utils/format.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface PaymentModalProps {
  accountId: string;
  accountTotal: number;
  pendingAmount: number;
  payments?: Payment[];
  accountDiscountType?: DiscountType;
  accountDiscountValue?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({
  accountId,
  accountTotal,
  pendingAmount,
  payments = [],
  accountDiscountType = DiscountType.NONE,
  accountDiscountValue = 0,
  onClose,
  onSuccess,
}: PaymentModalProps): JSX.Element {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [amount, setAmount] = useState(pendingAmount.toString());
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>(
    accountDiscountType !== DiscountType.NONE ? accountDiscountType : DiscountType.FIXED
  );
  const [discountValue, setDiscountValue] = useState(
    accountDiscountValue > 0 ? String(accountDiscountValue) : ''
  );
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    type: DiscountType;
    value: number;
  } | null>(
    accountDiscountType !== DiscountType.NONE
      ? { type: accountDiscountType, value: accountDiscountValue }
      : null
  );

  const previewTotal = (() => {
    const numVal = parseFloat(discountValue);
    if (isNaN(numVal) || numVal < 0) return accountTotal;
    if (numVal === 0) return accountTotal;

    if (discountType === DiscountType.FIXED) {
      return Math.max(0, accountTotal - numVal);
    }
    // PERCENT
    return Math.max(0, accountTotal - (accountTotal * numVal) / 100);
  })();

  const previewPending = (() => {
    const paidSum = payments.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, previewTotal - paidSum);
  })();

  const isDiscountValid =
    discountValue !== '' &&
    !isNaN(parseFloat(discountValue)) &&
    parseFloat(discountValue) >= 0 &&
    (discountType !== DiscountType.PERCENT || parseFloat(discountValue) <= 100);

  const handleApplyDiscount = async () => {
    setDiscountError('');
    setDiscountLoading(true);

    const numVal = parseFloat(discountValue) || 0;
    // If value is 0, send NONE to remove the discount
    const effectiveType = numVal === 0 ? DiscountType.NONE : discountType;

    try {
      const res = await fetch(`${API_URL}/accounts/${accountId}/discount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountType: effectiveType,
          discountValue: numVal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply discount');
      }

      const data = await res.json();
      setAppliedDiscount(effectiveType === DiscountType.NONE ? null : { type: discountType, value: numVal });
      onSuccess();
    } catch (err: any) {
      setDiscountError(err.message || 'Error applying discount');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    if (amountNum > pendingAmount) {
      setError('Amount exceeds pending amount');
      return;
    }

    setLoading(true);
    try {
      let proofUrl: string | undefined;
      if (method === PaymentMethod.TRANSFER && proofFile) {
        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('method', method);
        formData.append('file', proofFile);

        const uploadRes = await fetch(`${API_URL}/accounts/${accountId}/payments/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error || 'Failed to upload proof');
        }

        onSuccess();
        onClose();
        return;
      }

      const res = await fetch(`${API_URL}/accounts/${accountId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum, method, proofUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-800 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Registrar Pago</h2>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-lg bg-gray-700 text-white active:bg-gray-600"
          >
            X
          </button>
        </div>

        {/* Summary */}
        <div className="mb-4 rounded-xl bg-gray-900 p-4">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Total cuenta:</span>
            <span className="font-bold text-white">{formatCOP(accountTotal)}</span>
          </div>
          {appliedDiscount && (
            <div className="flex justify-between text-sm text-gray-400">
              <span>Descuento:</span>
              <span className="font-bold text-green-400">
                {appliedDiscount.type === DiscountType.FIXED
                  ? `-${formatCOP(appliedDiscount.value)}`
                  : `-${appliedDiscount.value}%`}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-400">
            <span>Pendiente:</span>
            <span className="font-bold text-yellow-400">{formatCOP(pendingAmount)}</span>
          </div>
        </div>

        {/* Discount section */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setDiscountOpen(!discountOpen)}
            className="h-12 w-full rounded-lg bg-gray-700 px-4 text-left font-bold text-white active:bg-gray-600"
          >
            {discountOpen ? 'Ocultar Descuento' : 'Aplicar Descuento'}
          </button>

          {discountOpen && (
            <div className="mt-3 rounded-xl bg-gray-900 p-4">
              {/* Type selector */}
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType(DiscountType.FIXED)}
                  className={`h-12 flex-1 rounded-lg font-bold text-white ${
                    discountType === DiscountType.FIXED
                      ? 'bg-blue-600'
                      : 'bg-gray-700 active:bg-gray-600'
                  }`}
                >
                  Fijo ($)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType(DiscountType.PERCENT)}
                  className={`h-12 flex-1 rounded-lg font-bold text-white ${
                    discountType === DiscountType.PERCENT
                      ? 'bg-blue-600'
                      : 'bg-gray-700 active:bg-gray-600'
                  }`}
                >
                  Porcentaje (%)
                </button>
              </div>

              {/* Value input */}
              <div className="mb-3">
                <label className="mb-1 block text-sm text-gray-400">
                  {discountType === DiscountType.FIXED ? 'Monto (COP)' : 'Porcentaje'}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={discountType === DiscountType.PERCENT ? 100 : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="h-12 w-full rounded-lg bg-gray-700 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={discountType === DiscountType.FIXED ? '$' : '%'}
                />
                {discountType === DiscountType.PERCENT && (
                  <p className="mt-1 text-xs text-gray-500">Maximo: 100%</p>
                )}
              </div>

              {/* Live preview */}
              {isDiscountValid && (
                <div className="mb-3 rounded-lg bg-gray-800 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total con descuento:</span>
                    <span className="font-bold text-green-400">{formatCOP(previewTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Pendiente:</span>
                    <span className="font-bold text-yellow-400">{formatCOP(previewPending)}</span>
                  </div>
                </div>
              )}

              {/* Discount error */}
              {discountError && (
                <div className="mb-3 rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
                  {discountError}
                </div>
              )}

              {/* Apply button */}
              <button
                type="button"
                onClick={handleApplyDiscount}
                disabled={!isDiscountValid || discountLoading}
                className="h-12 w-full rounded-lg bg-purple-600 font-bold text-white active:bg-purple-700 disabled:opacity-50"
              >
                {discountLoading
                  ? 'Aplicando...'
                  : parseFloat(discountValue) === 0
                    ? 'Quitar Descuento'
                    : 'Aplicar Descuento'}
              </button>
            </div>
          )}
        </div>

        {/* Existing payments */}
        {payments.length > 0 && (
          <div className="mb-4 rounded-xl bg-gray-900 p-4">
            <p className="mb-2 text-xs text-gray-400">Pagos registrados:</p>
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-300">
                    {p.method === PaymentMethod.CASH ? 'Efectivo' : p.method === PaymentMethod.TRANSFER ? 'Transferencia' : 'Tarjeta'}
                  </span>
                  {p.createdAt && (
                    <span className="ml-2 text-xs text-gray-500">
                      {new Date(p.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <span className="text-green-400">{formatCOP(p.amount)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gray-700 pt-2 text-sm font-bold">
              <span className="text-gray-300">Total pagado:</span>
              <span className="text-green-400">{formatCOP(payments.reduce((sum, p) => sum + p.amount, 0))}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Method selector */}
          <div className="flex gap-2">
            {[PaymentMethod.CASH, PaymentMethod.TRANSFER, PaymentMethod.CARD].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-12 flex-1 rounded-lg font-bold text-white ${
                  method === m
                    ? 'bg-blue-600'
                    : 'bg-gray-700 active:bg-gray-600'
                }`}
              >
                {m === PaymentMethod.CASH ? 'Efectivo' : m === PaymentMethod.TRANSFER ? 'Transferencia' : 'Tarjeta'}
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Monto</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={pendingAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 w-full rounded-lg bg-gray-700 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximo: {formatCOP(pendingAmount)}
            </p>
          </div>

          {/* Proof upload (only for transfers) */}
          {method === PaymentMethod.TRANSFER && (
            <div>
              <label className="mb-1 block text-sm text-gray-400">Comprobante (opcional)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="h-12 w-full rounded-lg bg-gray-700 px-4 text-white file:mr-4 file:h-12 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:font-bold file:text-white"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-lg bg-green-600 font-bold text-white active:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Pagar'}
          </button>
        </form>
      </div>
    </div>
  );
}
