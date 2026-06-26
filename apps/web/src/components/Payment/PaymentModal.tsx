import { useState } from 'react';
import { PaymentMethod } from '@barbaros/shared';
import { formatCOP } from '../../utils/format.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface PaymentModalProps {
  accountId: string;
  pendingAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ accountId, pendingAmount, onClose, onSuccess }: PaymentModalProps): JSX.Element {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [amount, setAmount] = useState(pendingAmount.toString());
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      // If there's a proof file, upload it first
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

      // Regular JSON payment
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
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-6">
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
            <span>Total:</span>
            <span className="font-bold text-white">{formatCOP(pendingAmount)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Pendiente:</span>
            <span className="font-bold text-yellow-400">{formatCOP(pendingAmount)}</span>
          </div>
        </div>

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
