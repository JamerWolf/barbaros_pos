import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountStore } from '../store/accountStore.js'
import { useAccountUIStore } from '../store/accountUIStore.js'
import { AccountCard } from '../components/Accounts/AccountCard.js'
import { AdminProductsPage } from '../components/Admin/AdminProductsPage.js'
import { CanvasContainer } from '../components/canvas/CanvasContainer.js'
import { DragNode } from '../components/canvas/DragNode.js'
import { toTitleCase } from '../utils/textUtils.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const ADMIN_PIN = '1234'

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const { accounts } = useAccountStore()
  const { nodePositions, assignPositionsBatch, clearOrphanPositions, viewMode, setViewMode, _hasHydrated } = useAccountUIStore()
  const [accountName, setAccountName] = useState('')
  const [mode, setMode] = useState<'personal' | 'admin'>('personal')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showAdminProducts, setShowAdminProducts] = useState(false)

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const openAccounts = useMemo(
    () => Object.values(accounts).filter((acc) => acc.status === 'OPEN'),
    [accounts]
  )

  useEffect(() => {
    if (!_hasHydrated) return
    // No limpiar ni asignar si las cuentas todavía no se cargaron del servidor
    if (openAccounts.length === 0) return
    
    // Limpiar huérfanos (cuentas que ya no existen)
    const activeIds = openAccounts.map((acc) => acc.id)
    clearOrphanPositions(activeIds)

    // Asignar en batch solo a los que NO tienen posición
    const idsToAssign = openAccounts
        .filter(acc => !nodePositions[acc.id])
        .map(acc => acc.id);
        
    if (idsToAssign.length > 0) {
        assignPositionsBatch(idsToAssign);
    }
  }, [openAccounts, assignPositionsBatch, clearOrphanPositions, _hasHydrated, nodePositions])

  const createAccount = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName.trim() || undefined }),
      })
      if (res.ok) {
        setAccountName('')
      } else {
        const data = await res.json()
        showToast(data.message || 'No se pudo crear la cuenta', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const handleModeChange = (selected: 'personal' | 'admin') => {
    if (selected === 'admin') {
      setShowPinModal(true)
    } else {
      setMode('personal')
    }
  }

  const submitPin = () => {
    if (pin === ADMIN_PIN) {
      setMode('admin')
      setShowPinModal(false)
      setPin('')
      setPinError(null)
    } else {
      setPinError('PIN incorrecto')
    }
  }

  const openShift = async () => {
    try {
      const res = await fetch(`${API_URL}/shifts/open`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.message || 'Error al abrir turno', 'error')
      } else {
        showToast('Turno abierto correctamente')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  const closeShift = async () => {
    try {
      const res = await fetch(`${API_URL}/shifts/close`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.message || 'Error al cerrar turno', 'error')
      } else {
        showToast('Turno cerrado correctamente')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-900 p-4 text-white">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bárbaro's POS</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => handleModeChange('personal')}
              className={`h-10 rounded-md px-4 font-bold ${mode === 'personal' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
            >
              Personal
            </button>
            <button
              onClick={() => handleModeChange('admin')}
              className={`h-10 rounded-md px-4 font-bold ${mode === 'admin' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}
            >
              Admin
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`h-10 rounded-lg px-3 font-bold ${viewMode === 'list' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={`h-10 rounded-lg px-3 font-bold ${viewMode === 'canvas' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              Canvas
            </button>
          </div>
        </div>
      </header>

      {mode === 'admin' && (
        <div className="flex flex-col gap-3 rounded-xl bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Control de Turno</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdminProducts(true)}
                className="h-10 rounded-lg bg-purple-600 px-3 font-bold text-sm text-white active:bg-purple-700"
              >
                ☰ Productos
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="h-10 rounded-lg bg-blue-600 px-3 font-bold text-sm text-white active:bg-blue-700"
              >
                📊 Reportes
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openShift}
              className="h-12 flex-1 rounded-lg bg-green-600 px-4 font-bold text-white active:bg-green-700 disabled:opacity-50"
            >
              Abrir Turno
            </button>
            <button
              onClick={closeShift}
              className="h-12 flex-1 rounded-lg bg-red-600 px-4 font-bold text-white active:bg-red-700 disabled:opacity-50"
            >
              Cerrar Turno
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nombre (opcional)"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className="h-12 flex-1 rounded-lg bg-gray-800 px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={createAccount}
          className="h-12 rounded-lg bg-green-600 px-4 font-bold text-white active:bg-green-700"
        >
          + Cuenta
        </button>
      </div>

      <section className="flex-1">
        {!_hasHydrated ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : openAccounts.length === 0 ? (
          <p className="text-center text-gray-500">No hay cuentas abiertas.</p>
        ) : viewMode === 'list' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {openAccounts.map((acc) => (
              <AccountCard
                key={acc.id}
                id={acc.id}
                name={toTitleCase(acc.name || `Cuenta #${acc.number}`)}
                total={acc.total ?? 0}
                pendingAmount={acc.pendingAmount ?? 0}
                status={acc.status.toLowerCase() as 'open' | 'closed'}
                onClick={() => navigate(`/accounts/${acc.id}`)}
              />
            ))}
          </div>
        ) : (
          <CanvasContainer>
            {openAccounts.map((acc) => (
              <DragNode
                key={acc.id}
                accountId={acc.id}
                onClick={() => navigate(`/accounts/${acc.id}`)}
              >
                <AccountCard
                  name={toTitleCase(acc.name || `Cuenta #${acc.number}`)}
                  total={acc.total ?? 0}
                  pendingAmount={acc.pendingAmount ?? 0}
                  status={acc.status.toLowerCase() as 'open' | 'closed'}
                />
              </DragNode>
            ))}
          </CanvasContainer>
        )}
      </section>

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Acceso Admin</h2>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mb-4 h-14 w-full rounded-xl bg-gray-700 px-4 text-center text-2xl tracking-widest text-white outline-none focus:ring-2 focus:ring-purple-500"
            />
            {pinError && <p className="mb-4 text-center text-sm text-red-400">{pinError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false)
                  setPin('')
                  setPinError(null)
                }}
                className="h-12 flex-1 rounded-xl bg-gray-600 font-bold text-white active:bg-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={submitPin}
                className="h-12 flex-1 rounded-xl bg-purple-600 font-bold text-white active:bg-purple-700"
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminProducts && (
        <AdminProductsPage onClose={() => setShowAdminProducts(false)} />
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 rounded-xl p-4 text-center font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
