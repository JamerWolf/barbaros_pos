import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCOP } from '../utils/format.js';
import { DateRangePicker } from '../components/DateRangePicker.js';
import { useShiftSockets } from '../hooks/useShiftSockets.js';
import API_URL from '../utils/apiUrl.js';
import type { ShiftListItem, ShiftSummary } from '@barbaros/shared';

/** Convert YYYY-MM-DD to ISO string with local timezone offset */
function localDateToISO(dateStr: string, endOfDay = false): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return dt.toISOString();
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { from, to };
}

export function ReportsPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shifts, setShifts] = useState<ShiftListItem[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const defaultRange = useMemo(getCurrentMonthRange, []);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [accountSearch, setAccountSearch] = useState('');

  // Auto-select shift from URL params (when returning from account detail)
  const shiftIdParam = searchParams.get('shiftId');

  useEffect(() => {
    if (shiftIdParam && !selectedShift) {
      setLoadingDetail(true);
      fetch(`${API_URL}/shifts/${shiftIdParam}`)
        .then((res) => res.json())
        .then((data) => setSelectedShift(data))
        .finally(() => setLoadingDetail(false));
      setSearchParams({});
    }
  }, [shiftIdParam]);

  useEffect(() => {
    const loadShifts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('from', localDateToISO(dateFrom));
        if (dateTo) params.set('to', localDateToISO(dateTo, true));
        const url = `${API_URL}/shifts${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setShifts(data);
        }
      } finally {
        setLoading(false);
      }
    };
    loadShifts();
  }, [dateFrom, dateTo]);

  const handleSelectShift = async (shiftId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_URL}/shifts/${shiftId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedShift(data);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  // Real-time refresh via WebSocket
  const refreshData = useCallback(() => {
    // Refresh selected shift detail
    if (selectedShift) {
      fetch(`${API_URL}/shifts/${selectedShift.id}`)
        .then((res) => res.json())
        .then((data) => setSelectedShift(data))
        .catch(() => {});
    }
    // Refresh shifts list
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', localDateToISO(dateFrom));
    if (dateTo) params.set('to', localDateToISO(dateTo, true));
    const url = `${API_URL}/shifts${params.toString() ? '?' + params.toString() : ''}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => setShifts(data))
      .catch(() => {});
  }, [selectedShift?.id, dateFrom, dateTo]);

  useShiftSockets(refreshData);

  const handleExport = async (shiftId: string) => {
    try {
      const res = await fetch(`${API_URL}/reports/export/${shiftId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${shiftId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silent
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Aggregated summary across all visible shifts (must be before any early return)
  const summary = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;
    let accountsCount = 0;
    const paymentsByMethod: Record<string, number> = { CASH: 0, TRANSFER: 0, CARD: 0 };
    for (const s of shifts) {
      totalSales += s.totalSales;
      totalPaid += s.totalPaid;
      accountsCount += s.accountsCount;
      for (const [method, amount] of Object.entries(s.paymentsByMethod)) {
        paymentsByMethod[method] = (paymentsByMethod[method] || 0) + amount;
      }
    }
    return { totalSales, totalPaid, pendingAmount: totalSales - totalPaid, accountsCount, paymentsByMethod };
  }, [shifts]);

  // Detail view
  if (selectedShift) {
    return (
      <div className="flex min-h-screen flex-col gap-4 bg-gray-900 p-4 text-white">
        <header className="flex items-center gap-2">
          <button
            onClick={() => setSelectedShift(null)}
            className="h-12 rounded-lg bg-gray-700 px-3 font-bold text-white active:bg-gray-600"
          >
            ← Volver
          </button>
          <h1 className="flex-1 text-xl font-bold">Detalle del Turno</h1>
          <button
            onClick={() => handleExport(selectedShift.id)}
            className="h-12 rounded-lg bg-blue-600 px-3 font-bold text-sm text-white active:bg-blue-700"
          >
            📊 Excel
          </button>
        </header>

        {/* Summary */}
        <div className="rounded-xl bg-gray-800 p-4">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Estado:</span>
            <span className={`font-bold ${selectedShift.status === 'OPEN' ? 'text-green-400' : 'text-gray-300'}`}>
              {selectedShift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Desde:</span>
            <span className="text-white">{formatDate(selectedShift.openedAt)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Hasta:</span>
            <span className="text-white">{selectedShift.closedAt ? formatDate(selectedShift.closedAt) : '—'}</span>
          </div>
          <div className="mt-3 flex justify-between text-sm text-gray-400">
            <span>Cuentas:</span>
            <span className="font-bold text-white">{selectedShift.accountsCount}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Total Ventas:</span>
            <span className="font-bold text-green-400">{formatCOP(selectedShift.totalSales)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Total Pagado:</span>
            <span className="font-bold text-green-400">{formatCOP(selectedShift.totalPaid)}</span>
          </div>
          {selectedShift.pendingAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-400">
              <span>Pendiente:</span>
              <span className="font-bold text-yellow-400">{formatCOP(selectedShift.pendingAmount)}</span>
            </div>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="rounded-xl bg-gray-800 p-4">
          <h2 className="mb-3 text-lg font-bold">Pagos por Método</h2>
          {Object.entries(selectedShift.paymentsByMethod).map(([method, total]) => (
            <div key={method} className="flex justify-between text-sm text-gray-400">
              <span>{method === 'CASH' ? 'Efectivo' : method === 'TRANSFER' ? 'Transferencia' : 'Tarjeta'}</span>
              <span className="font-bold text-white">{formatCOP(total)}</span>
            </div>
          ))}
        </div>

        {/* Accounts list */}
        <div className="rounded-xl bg-gray-800 p-4">
          <h2 className="mb-3 text-lg font-bold">Cuentas</h2>
          {selectedShift.accounts.length > 0 && (
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Buscar cuenta..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="h-10 w-full rounded-lg bg-gray-700 py-2 pl-9 pr-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {selectedShift.accounts.length === 0 ? (
            <p className="text-gray-500">Sin cuentas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedShift.accounts
                .filter((account) => {
                  if (!accountSearch.trim()) return true;
                  const q = accountSearch.toLowerCase();
                  return (
                    String(account.number).includes(q) ||
                    (account.name || '').toLowerCase().includes(q)
                  );
                })
                .map((account) => (
                <button
                  key={account.id}
                  onClick={() => navigate(`/accounts/${account.id}?readonly=1&shiftId=${selectedShift.id}`)}
                  className="flex items-center justify-between rounded-lg bg-gray-700 px-3 py-2 text-left active:bg-gray-600"
                >
                  <div>
                    <p className="font-bold text-white">#{account.number} {account.name}</p>
                    <p className="text-xs text-gray-400">
                      {account.status === 'OPEN' ? '🟢 Abierta' : '✅ Cerrada'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{formatCOP(account.total)}</p>
                    {account.pendingAmount > 0 && (
                      <p className="text-xs text-yellow-400">Pendiente: {formatCOP(account.pendingAmount)}</p>
                    )}
                  </div>
                </button>
              ))}
              {selectedShift.accounts.filter((account) => {
                if (!accountSearch.trim()) return true;
                const q = accountSearch.toLowerCase();
                return String(account.number).includes(q) || (account.name || '').toLowerCase().includes(q);
              }).length === 0 && (
                <p className="text-center text-sm text-gray-500">No se encontraron cuentas.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-900 p-4 text-white">
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="h-10 rounded-lg bg-gray-700 px-3 font-bold text-white active:bg-gray-600"
        >
          ← Volver
        </button>
        <h1 className="text-xl font-bold">Reportes</h1>
      </header>

      <DateRangePicker
        from={dateFrom}
        to={dateTo}
        onChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />

      {/* Aggregated summary */}
      {shifts.length > 0 && (
        <>
          <div className="rounded-xl bg-gray-800 p-4">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Turnos:</span>
              <span className="font-bold text-white">{shifts.length}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Cuentas:</span>
              <span className="font-bold text-white">{summary.accountsCount}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Total Ventas:</span>
              <span className="font-bold text-green-400">{formatCOP(summary.totalSales)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Total Pagado:</span>
              <span className="font-bold text-green-400">{formatCOP(summary.totalPaid)}</span>
            </div>
            {summary.pendingAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Pendiente:</span>
                <span className="font-bold text-yellow-400">{formatCOP(summary.pendingAmount)}</span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-gray-800 p-4">
            <h2 className="mb-3 text-lg font-bold">Pagos por Método</h2>
            {Object.entries(summary.paymentsByMethod).map(([method, total]) => (
              <div key={method} className="flex justify-between text-sm text-gray-400">
                <span>{method === 'CASH' ? 'Efectivo' : method === 'TRANSFER' ? 'Transferencia' : 'Tarjeta'}</span>
                <span className="font-bold text-white">{formatCOP(total)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <p className="text-gray-400">Cargando turnos...</p>
      ) : shifts.length === 0 ? (
        <p className="text-gray-400">Sin turnos</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <button
              key={shift.id}
              onClick={() => handleSelectShift(shift.id)}
              className="flex items-center justify-between rounded-xl bg-gray-800 p-4 text-left active:bg-gray-700"
            >
              <div>
                <p className="font-bold text-white">
                  {formatDate(shift.openedAt)}
                </p>
                <p className="text-sm text-gray-400">
                  {shift.accountsCount} cuentas · {shift.status === 'OPEN' ? '🟢 Abierto' : '✅ Cerrado'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-400">{formatCOP(shift.totalSales)}</p>
                {shift.totalPaid < shift.totalSales && (
                  <p className="text-xs text-yellow-400">Pagado: {formatCOP(shift.totalPaid)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
