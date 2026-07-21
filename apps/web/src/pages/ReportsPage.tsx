import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatCOP } from '../utils/format.js'
import { DateRangePicker } from '../components/DateRangePicker.js'
import { useShiftSockets } from '../hooks/useShiftSockets.js'
import API_URL from '../utils/apiUrl.js'
import { tw } from '../utils/colors.js'
import type { ShiftListItem, ShiftSummary } from '@barbaros/shared'

/** Convert YYYY-MM-DD to ISO string with local timezone offset */
function localDateToISO(dateStr: string, endOfDay = false): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(
    y,
    m - 1,
    d,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  )
  return dt.toISOString()
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { from, to }
}

type AccountSearchResult = {
  id: string
  number: number
  name: string
  status: string
  total: number
  pendingAmount: number
  shiftId: string
  shiftDate: string
  shiftStatus: string
}

export function ReportsPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [shifts, setShifts] = useState<ShiftListItem[]>([])
  const [selectedShift, setSelectedShift] = useState<ShiftSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [_loadingDetail, setLoadingDetail] = useState(false)
  const defaultRange = useMemo(getCurrentMonthRange, [])
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [accountSearch, setAccountSearch] = useState('')
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AccountSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-select shift from URL params (when returning from account detail)
  const shiftIdParam = searchParams.get('shiftId')

  useEffect(() => {
    if (shiftIdParam && !selectedShift) {
      setLoadingDetail(true)
      fetch(`${API_URL}/shifts/${shiftIdParam}`)
        .then((res) => res.json())
        .then((data) => setSelectedShift(data))
        .finally(() => setLoadingDetail(false))
      setSearchParams({})
    }
  }, [shiftIdParam])

  useEffect(() => {
    const loadShifts = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (dateFrom) params.set('from', localDateToISO(dateFrom))
        if (dateTo) params.set('to', localDateToISO(dateTo, true))
        const url = `${API_URL}/shifts${params.toString() ? '?' + params.toString() : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setShifts(data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadShifts()
  }, [dateFrom, dateTo])

  // Global account search (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!globalSearchQuery.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/accounts/search?q=${encodeURIComponent(globalSearchQuery.trim())}`,
        )
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [globalSearchQuery])

  const handleSelectShift = async (shiftId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`${API_URL}/shifts/${shiftId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedShift(data)
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  // Real-time refresh via WebSocket
  const refreshData = useCallback(() => {
    // Refresh selected shift detail
    if (selectedShift) {
      fetch(`${API_URL}/shifts/${selectedShift.id}`)
        .then((res) => res.json())
        .then((data) => setSelectedShift(data))
        .catch(() => {})
    }
    // Refresh shifts list
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', localDateToISO(dateFrom))
    if (dateTo) params.set('to', localDateToISO(dateTo, true))
    const url = `${API_URL}/shifts${params.toString() ? '?' + params.toString() : ''}`
    fetch(url)
      .then((res) => res.json())
      .then((data) => setShifts(data))
      .catch(() => {})
  }, [selectedShift?.id, dateFrom, dateTo])

  useShiftSockets(refreshData)

  const handleExport = async (shiftId: string) => {
    try {
      const res = await fetch(`${API_URL}/reports/export/${shiftId}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_${shiftId}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // silent
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Aggregated summary across all visible shifts (must be before any early return)
  const summary = useMemo(() => {
    let totalSales = 0
    let totalPaid = 0
    let accountsCount = 0
    const paymentsByMethod: Record<string, number> = { CASH: 0, TRANSFER: 0, CARD: 0 }
    for (const s of shifts) {
      totalSales += s.totalSales
      totalPaid += s.totalPaid
      accountsCount += s.accountsCount
      for (const [method, amount] of Object.entries(s.paymentsByMethod)) {
        paymentsByMethod[method] = (paymentsByMethod[method] || 0) + amount
      }
    }
    return {
      totalSales,
      totalPaid,
      pendingAmount: totalSales - totalPaid,
      accountsCount,
      paymentsByMethod,
    }
  }, [shifts])

  // Detail view
  if (selectedShift) {
    return (
      <div className={`flex min-h-screen flex-col gap-4 ${tw.bg} p-4 ${tw.text}`}>
        <header className="flex items-center gap-2">
          <button
            onClick={() => setSelectedShift(null)}
            className={`h-12 rounded-lg ${tw.bgCard} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}
          >
            ← Volver
          </button>
          <h1 className="flex-1 text-xl font-bold">Detalle del Turno</h1>
          <button
            onClick={() => handleExport(selectedShift.id)}
            className={`h-12 rounded-lg ${tw.primaryBg} px-3 font-bold text-sm text-[#0A0A0A] active:bg-[#C8A84E]/80`}
          >
            📊 Excel
          </button>
        </header>

        {/* Summary */}
        <div className={`rounded-xl ${tw.bgCard} p-4`}>
          <div className={`flex justify-between text-sm ${tw.textMuted}`}>
            <span>Estado:</span>
            <span
              className={`font-bold ${selectedShift.status === 'OPEN' ? 'text-[#7CCD7C]' : tw.text}`}
            >
              {selectedShift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
          <div className={`flex justify-between text-sm ${tw.textMuted}`}>
            <span>Desde:</span>
            <span className={tw.text}>{formatDate(selectedShift.openedAt)}</span>
          </div>
          <div className={`flex justify-between text-sm ${tw.textMuted}`}>
            <span>Hasta:</span>
            <span className={tw.text}>
              {selectedShift.closedAt ? formatDate(selectedShift.closedAt) : '—'}
            </span>
          </div>
          <div className={`mt-3 flex justify-between text-sm ${tw.textMuted}`}>
            <span>Cuentas:</span>
            <span className={`font-bold ${tw.text}`}>{selectedShift.accountsCount}</span>
          </div>
          <div className={`flex justify-between text-sm ${tw.textMuted}`}>
            <span>Total Ventas:</span>
            <span className="font-bold text-[#7CCD7C]">{formatCOP(selectedShift.totalSales)}</span>
          </div>
          <div className={`flex justify-between text-sm ${tw.textMuted}`}>
            <span>Total Pagado:</span>
            <span className="font-bold text-[#7CCD7C]">{formatCOP(selectedShift.totalPaid)}</span>
          </div>
          {selectedShift.pendingAmount > 0 && (
            <div className={`flex justify-between text-sm ${tw.textMuted}`}>
              <span>Pendiente:</span>
              <span className="font-bold text-[#E85050]">
                {formatCOP(selectedShift.pendingAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Payment breakdown */}
        <div className={`rounded-xl ${tw.bgCard} p-4`}>
          <h2 className="mb-3 text-lg font-bold">Pagos por Método</h2>
          {Object.entries(selectedShift.paymentsByMethod).map(([method, total]) => (
            <div key={method} className={`flex justify-between text-sm ${tw.textMuted}`}>
              <span>
                {method === 'CASH'
                  ? 'Efectivo'
                  : method === 'TRANSFER'
                    ? 'Transferencia'
                    : 'Tarjeta'}
              </span>
              <span className={`font-bold ${tw.text}`}>{formatCOP(total)}</span>
            </div>
          ))}
        </div>

        {/* Accounts list */}
        <div className={`rounded-xl ${tw.bgCard} p-4`}>
          <h2 className="mb-3 text-lg font-bold">Cuentas</h2>
          {selectedShift.accounts.length > 0 && (
            <div className="relative mb-3">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${tw.textMuted}`}>🔍</span>
              <input
                type="text"
                placeholder="Buscar cuenta..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className={`h-10 w-full rounded-lg ${tw.bgCard} py-2 pl-9 pr-3 text-sm ${tw.text} outline-none focus:ring-2 focus:ring-[#C8A84E]`}
              />
            </div>
          )}
          {selectedShift.accounts.length === 0 ? (
            <p className={tw.textMuted}>Sin cuentas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedShift.accounts
                .filter((account) => {
                  if (!accountSearch.trim()) return true
                  const q = accountSearch.toLowerCase()
                  return (
                    String(account.number).includes(q) ||
                    (account.name || '').toLowerCase().includes(q)
                  )
                })
                .map((account, i) => (
                  <button
                    key={account.id}
                    onClick={() =>
                      navigate(`/accounts/${account.id}?readonly=1&shiftId=${selectedShift.id}`)
                    }
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left active:bg-[#1E1E1E] ${i % 2 === 0 ? 'bg-[#141414]' : 'bg-[#1E1E1E]'}`}
                  >
                    <div>
                      <p className={`font-bold ${tw.text}`}>
                        #{account.number} {account.name}
                      </p>
                      <p className={`text-xs ${tw.textMuted}`}>
                        {account.status === 'VOIDED' ? (
                          <span className="font-bold text-[#E85050]">Anulada</span>
                        ) : account.status === 'OPEN' ? (
                          '🟢 Abierta'
                        ) : (
                          '✅ Cerrada'
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tw.text}`}>{formatCOP(account.total)}</p>
                      {account.pendingAmount > 0 && (
                        <p className="text-xs text-[#E85050]">
                          Pendiente: {formatCOP(account.pendingAmount)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              {selectedShift.accounts.filter((account) => {
                if (!accountSearch.trim()) return true
                const q = accountSearch.toLowerCase()
                return (
                  String(account.number).includes(q) ||
                  (account.name || '').toLowerCase().includes(q)
                )
              }).length === 0 && (
                <p className={`text-center text-sm ${tw.textMuted}`}>No se encontraron cuentas.</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className={`flex min-h-screen flex-col gap-4 ${tw.bg} p-4 ${tw.text}`}>
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className={`h-10 rounded-lg ${tw.bgCard} px-3 font-bold ${tw.text} active:bg-[#1E1E1E]`}
        >
          ← Volver
        </button>
        <h1 className="text-xl font-bold">Reportes</h1>
      </header>

      {/* Global account search */}
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${tw.textMuted}`}>🔍</span>
        <input
          type="text"
          placeholder="Buscar cuenta (nombre o número)..."
          value={globalSearchQuery}
          onChange={(e) => setGlobalSearchQuery(e.target.value)}
          className={`h-12 w-full rounded-lg ${tw.bgCard} py-2 pl-9 pr-3 text-sm ${tw.text} outline-none focus:ring-2 focus:ring-[#C8A84E]`}
        />
      </div>

      {/* Search results */}
      {globalSearchQuery.trim() ? (
        searching ? (
          <p className={tw.textMuted}>Buscando...</p>
        ) : searchResults.length === 0 ? (
          <p className={`text-center text-sm ${tw.textMuted}`}>No se encontraron cuentas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {searchResults.map((account, i) => (
              <button
                key={account.id}
                onClick={() =>
                  navigate(`/accounts/${account.id}?readonly=1&shiftId=${account.shiftId}`)
                }
                className={`flex items-center justify-between rounded-lg px-3 py-3 text-left active:bg-[#1E1E1E] ${i % 2 === 0 ? 'bg-[#141414]' : 'bg-[#1E1E1E]'}`}
              >
                <div>
                  <p className={`font-bold ${tw.text}`}>
                    #{account.number} {account.name}
                  </p>
                  <p className={`text-xs ${tw.textMuted}`}>
                    {account.status === 'VOIDED' ? (
                      <span className="font-bold text-[#E85050]">Anulada</span>
                    ) : account.status === 'OPEN' ? (
                      '🟢 Abierta'
                    ) : (
                      '✅ Cerrada'
                    )}
                    {' · '}
                    {formatDate(account.shiftDate)} (
                    {account.shiftStatus === 'OPEN' ? 'Turno abierto' : 'Turno cerrado'})
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tw.text}`}>{formatCOP(account.total)}</p>
                  {account.pendingAmount > 0 && (
                    <p className="text-xs text-[#E85050]">
                      Pendiente: {formatCOP(account.pendingAmount)}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => {
              setDateFrom(from)
              setDateTo(to)
            }}
          />

          {/* Aggregated summary */}
          {shifts.length > 0 && (
            <>
              <div className={`rounded-xl ${tw.bgCard} p-4`}>
                <div className={`flex justify-between text-sm ${tw.textMuted}`}>
                  <span>Turnos:</span>
                  <span className={`font-bold ${tw.text}`}>{shifts.length}</span>
                </div>
                <div className={`flex justify-between text-sm ${tw.textMuted}`}>
                  <span>Cuentas:</span>
                  <span className={`font-bold ${tw.text}`}>{summary.accountsCount}</span>
                </div>
                <div className={`flex justify-between text-sm ${tw.textMuted}`}>
                  <span>Total Ventas:</span>
                  <span className="font-bold text-[#7CCD7C]">{formatCOP(summary.totalSales)}</span>
                </div>
                <div className={`flex justify-between text-sm ${tw.textMuted}`}>
                  <span>Total Pagado:</span>
                  <span className="font-bold text-[#7CCD7C]">{formatCOP(summary.totalPaid)}</span>
                </div>
                {summary.pendingAmount > 0 && (
                  <div className={`flex justify-between text-sm ${tw.textMuted}`}>
                    <span>Pendiente:</span>
                    <span className="font-bold text-[#E85050]">
                      {formatCOP(summary.pendingAmount)}
                    </span>
                  </div>
                )}
              </div>
              <div className={`rounded-xl ${tw.bgCard} p-4`}>
                <h2 className="mb-3 text-lg font-bold">Pagos por Método</h2>
                {Object.entries(summary.paymentsByMethod).map(([method, total]) => (
                  <div key={method} className={`flex justify-between text-sm ${tw.textMuted}`}>
                    <span>
                      {method === 'CASH'
                        ? 'Efectivo'
                        : method === 'TRANSFER'
                          ? 'Transferencia'
                          : 'Tarjeta'}
                    </span>
                    <span className={`font-bold ${tw.text}`}>{formatCOP(total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {loading ? (
            <p className={tw.textMuted}>Cargando turnos...</p>
          ) : shifts.length === 0 ? (
            <p className={tw.textMuted}>Sin turnos</p>
          ) : (
            <div className="flex flex-col gap-3">
              {shifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => handleSelectShift(shift.id)}
                  className={`flex items-center justify-between rounded-xl ${tw.bgCard} p-4 text-left active:bg-[#1E1E1E]`}
                >
                  <div>
                    <p className={`font-bold ${tw.text}`}>{formatDate(shift.openedAt)}</p>
                    <p className={`text-sm ${tw.textMuted}`}>
                      {shift.accountsCount} cuentas ·{' '}
                      {shift.status === 'OPEN' ? '🟢 Abierto' : '✅ Cerrado'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#7CCD7C]">{formatCOP(shift.totalSales)}</p>
                    {shift.totalPaid < shift.totalSales && (
                      <p className="text-xs text-[#E85050]">Pagado: {formatCOP(shift.totalPaid)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
