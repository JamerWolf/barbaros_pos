import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountStore } from '../store/accountStore.js'
import { useAccountUIStore } from '../store/accountUIStore.js'
import { useShapeStore, type ShapeTool } from '../store/shapeStore.js'
import { AccountCard } from '../components/Accounts/AccountCard.js'
import { AdminProductsPage } from '../components/Admin/AdminProductsPage.js'
import { CanvasContainer, cancelPendingSaves } from '../components/canvas/CanvasContainer.js'
import { DragNode } from '../components/canvas/DragNode.js'
import { ShapeLayer } from '../components/canvas/shapes/ShapeLayer.js'
import { toTitleCase } from '../utils/textUtils.js'
import { formatCOP } from '../utils/format.js'
import { saveAccountCardSize, saveAccountPosition } from '../services/accountApi.js'
import API_URL from '../utils/apiUrl.js'
import type { IAccount } from '@barbaros/shared'

const ADMIN_PIN = '1234'

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const { accounts } = useAccountStore()
  const { nodePositions, assignPositionsBatch, clearOrphanPositions, viewMode, setViewMode, selectionMode, selectedIds, setSelectionMode, clearSelection, saveSelectionSnapshot, restoreSelectionSnapshot, cardSize, setCardSize, getCardSize, canvasLocked, setCanvasLocked, _hasHydrated } = useAccountUIStore()
  const { activeTool, setActiveTool, drawingColor, setDrawingColor, selectedShapeId, setSelectedShapeId, deleteShape } = useShapeStore()
  const [mode, setMode] = useState<'personal' | 'admin'>('personal')
  const [showAdminProducts, setShowAdminProducts] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [allOpenAccounts, setAllOpenAccounts] = useState<(IAccount & { total: number; pendingAmount: number })[]>([])
  const [showAddOldAccount, setShowAddOldAccount] = useState(false)
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Scroll to bottom when switching to canvas mode
  useEffect(() => {
    if (viewMode === 'canvas') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [viewMode])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const openAccounts = useMemo(
    () => Object.values(accounts).filter((acc) => acc.status === 'OPEN'),
    [accounts]
  )

  const filteredOpenAccounts = useMemo(() => {
    if (!searchQuery.trim()) return openAccounts
    const q = searchQuery.toLowerCase()
    return openAccounts.filter((acc) =>
      (acc.name || '').toLowerCase().includes(q) ||
      String(acc.number).includes(q)
    )
  }, [openAccounts, searchQuery])

  const filteredAllOpenAccounts = useMemo(() => {
    if (!searchQuery.trim()) return allOpenAccounts
    const q = searchQuery.toLowerCase()
    return allOpenAccounts.filter((acc) =>
      (acc.name || '').toLowerCase().includes(q) ||
      String(acc.number).includes(q)
    )
  }, [allOpenAccounts, searchQuery])

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

  // Fetch all open accounts from all shifts
  const refreshAllOpenAccounts = () => {
    fetch(`${API_URL}/accounts/all-open`)
      .then((res) => res.json())
      .then((data) => setAllOpenAccounts(data))
      .catch(() => setAllOpenAccounts([]))
  }

  useEffect(() => {
    refreshAllOpenAccounts()
    fetch(`${API_URL}/shifts/active`)
      .then((res) => res.json())
      .then((data) => setActiveShiftId(data?.id ?? null))
      .catch(() => setActiveShiftId(null))
  }, [])

  // Listen for shift events from other devices
  useEffect(() => {
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws'
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (message) => {
      try {
        const { event, data } = JSON.parse(message.data)
        if (event === 'shift:opened') {
          setActiveShiftId(data.id)
        } else if (event === 'shift:closed') {
          setActiveShiftId(null)
          refreshAllOpenAccounts()
        }
      } catch {
        // ignore
      }
    }

    return () => { ws.close() }
  }, [])

  const createAccount = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardSize }),
      })
      if (res.ok) {
        const newAccount = await res.json()
        useAccountStore.getState().addAccount(newAccount)
        // Place new account at the center of the current viewport
        const center = useAccountUIStore.getState().getViewportCenter(window.innerWidth, window.innerHeight)
        useAccountUIStore.getState().updatePosition(newAccount.id, center)
        refreshAllOpenAccounts()
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
        const data = await res.json()
        setActiveShiftId(data.id)
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
        setActiveShiftId(null)
        showToast('Turno cerrado correctamente')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-2 bg-gray-900 p-2 text-white sm:gap-4 sm:p-4">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold sm:text-xl">Bárbaro's POS</h1>
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => handleModeChange('personal')}
              className={`h-9 rounded-md px-3 text-sm font-bold sm:h-10 sm:px-4 ${mode === 'personal' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
            >
              Personal
            </button>
            <button
              onClick={() => handleModeChange('admin')}
              className={`h-9 rounded-md px-3 text-sm font-bold sm:h-10 sm:px-4 ${mode === 'admin' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}
            >
              Admin
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`h-9 flex-1 rounded-lg px-3 text-sm font-bold sm:h-10 ${viewMode === 'list' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className={`h-9 flex-1 rounded-lg px-3 text-sm font-bold sm:h-10 ${viewMode === 'canvas' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Canvas
          </button>
        </div>
      </header>

      {mode === 'admin' && (
        <div className="flex flex-col gap-3 rounded-xl bg-gray-800 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-white">Control de Turno</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdminProducts(true)}
                className="h-10 flex-1 rounded-lg bg-purple-600 px-3 text-sm font-bold text-white active:bg-purple-700 sm:flex-none"
              >
                ☰ Productos
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="h-10 flex-1 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white active:bg-blue-700 sm:flex-none"
              >
                📊 Reportes
              </button>
            </div>
          </div>
          {activeShiftId ? (
            <button
              onClick={closeShift}
              className="h-12 w-full rounded-lg bg-red-600 px-4 font-bold text-white active:bg-red-700"
            >
              Cerrar Turno
            </button>
          ) : (
            <button
              onClick={openShift}
              className="h-12 w-full rounded-lg bg-green-600 px-4 font-bold text-white active:bg-green-700"
            >
              Abrir Turno
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div data-toolbar className="sticky top-0 z-20 flex flex-col gap-2 bg-gray-900 py-1 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar cuenta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-lg bg-gray-800 py-2 pl-10 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 sm:h-12"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex h-11 items-center rounded-lg bg-gray-700 px-1 sm:h-12">
            {([
              ['sm', 'S'],
              ['md', 'M'],
              ['lg', 'L'],
            ] as const).map(([size, label]) => (
              <button
                key={size}
                onClick={() => {
                  setCardSize(size)
                  if (selectionMode && selectedIds.size > 0) {
                    for (const id of selectedIds) {
                      saveAccountCardSize(id, size)
                    }
                  }
                }}
                className={`h-8 rounded-md px-2 text-xs font-bold ${
                  cardSize === size ? 'bg-blue-600 text-white' : 'text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={createAccount}
            className="h-11 flex-1 rounded-lg bg-green-600 px-3 text-sm font-bold text-white active:bg-green-700 sm:h-12 sm:flex-none sm:px-4"
          >
            + Cuenta
          </button>
        </div>
      </div>

      <section className="flex flex-1 flex-col">
        {!_hasHydrated ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : viewMode === 'list' ? (
          filteredAllOpenAccounts.length === 0 ? (
            <p className="text-center text-gray-500">{searchQuery ? 'No se encontraron cuentas.' : 'No hay cuentas abiertas.'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filteredAllOpenAccounts.map((acc) => (
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
          )
        ) : filteredOpenAccounts.length === 0 ? (
          <p className="text-center text-gray-500">{searchQuery ? 'No se encontraron cuentas.' : 'No hay cuentas abiertas.'}</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <span className="text-sm text-blue-400">
                    {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
      <div className="flex flex-wrap items-center gap-2">
                {selectionMode && (
                  <button
                    onClick={() => {
                      cancelPendingSaves()
                      const snapshot = useAccountUIStore.getState().selectionSnapshot
                      restoreSelectionSnapshot()
                      clearSelection()
                      setSelectionMode(false)
                      // Persist restored positions and sizes to DB
                      if (snapshot) {
                        for (const [id, pos] of Object.entries(snapshot.nodePositions)) {
                          saveAccountPosition(id, { posX: pos.x, posY: pos.y })
                        }
                        for (const [id, size] of Object.entries(snapshot.cardSizes)) {
                          saveAccountCardSize(id, size)
                        }
                      }
                    }}
                    className="h-10 rounded-lg bg-gray-700 px-3 font-bold text-sm text-white active:bg-gray-600"
                  >
                    ✕ Cancelar
                  </button>
                )}
                <button
                  onClick={() => {
                    if (selectionMode) {
                      clearSelection()
                      setSelectionMode(false)
                    } else {
                      saveSelectionSnapshot()
                      setSelectionMode(true)
                    }
                  }}
                  className={`h-10 rounded-lg px-3 font-bold text-sm text-white ${
                    selectionMode ? 'bg-yellow-600 active:bg-yellow-700' : 'bg-gray-700 active:bg-gray-600'
                  }`}
                >
                  {selectionMode ? '✓ Seleccionando' : '☐ Seleccionar'}
                </button>
                <button
                  onClick={() => setShowAddOldAccount(true)}
                  className="h-10 rounded-lg bg-blue-600 px-3 font-bold text-sm text-white active:bg-blue-700"
                >
                  + Agregar cuenta de otro turno
                </button>
                {/* Shape tools */}
                <div className={`flex rounded-lg bg-gray-700 p-1 ${canvasLocked ? 'opacity-50' : ''}`}>
                  <button
                    onClick={() => !canvasLocked && setActiveTool(activeTool === 'rectangle' ? null : 'rectangle')}
                    disabled={canvasLocked}
                    className={`h-8 rounded-md px-2 text-xs font-bold ${
                      activeTool === 'rectangle' ? 'bg-green-600 text-white' : 'text-gray-400'
                    }`}
                    title="Rectángulo"
                  >
                    ▭
                  </button>
                  <button
                    onClick={() => !canvasLocked && setActiveTool(activeTool === 'line' ? null : 'line')}
                    disabled={canvasLocked}
                    className={`h-8 rounded-md px-2 text-xs font-bold ${
                      activeTool === 'line' ? 'bg-green-600 text-white' : 'text-gray-400'
                    }`}
                    title="Línea"
                  >
                    ╱
                  </button>
                  <button
                    onClick={() => !canvasLocked && setActiveTool(activeTool === 'text' ? null : 'text')}
                    disabled={canvasLocked}
                    className={`h-8 rounded-md px-2 text-xs font-bold ${
                      activeTool === 'text' ? 'bg-green-600 text-white' : 'text-gray-400'
                    }`}
                    title="Texto"
                  >
                    T
                  </button>
                  {activeTool && (
                    <input
                      type="color"
                      value={drawingColor}
                      onChange={(e) => setDrawingColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-md border-0 bg-transparent p-0"
                      title="Color"
                    />
                  )}
                  {selectedShapeId && (
                    <button
                      onClick={() => {
                        deleteShape(selectedShapeId);
                        setSelectedShapeId(null);
                      }}
                      className="h-8 rounded-md px-2 text-xs font-bold text-red-400 hover:bg-red-900/50"
                      title="Eliminar figura (o presiona Delete)"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setCanvasLocked(!canvasLocked);
                    if (!canvasLocked) {
                      setActiveTool(null);
                      setSelectionMode(false);
                      setSelectedShapeId(null);
                    }
                  }}
                  className={`h-10 rounded-lg px-3 font-bold text-sm text-white ${
                    canvasLocked ? 'bg-yellow-600 active:bg-yellow-700' : 'bg-gray-700 active:bg-gray-600'
                  }`}
                  title={canvasLocked ? 'Desbloquear canvas' : 'Bloquear canvas'}
                >
                  {canvasLocked ? '🔒' : '🔓'}
                </button>
              </div>
            </div>
            <CanvasContainer shapes={<ShapeLayer />} onCreateAccount={createAccount} onToggleSelection={() => {
              if (selectionMode) {
                clearSelection()
                setSelectionMode(false)
              } else {
                saveSelectionSnapshot()
                setSelectionMode(true)
              }
            }}>
              {filteredOpenAccounts.map((acc) => (
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
                    size={getCardSize(acc.id)}
                  />
                </DragNode>
              ))}
            </CanvasContainer>
          </>
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

      {showAddOldAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Agregar cuenta de otro turno</h2>
            <div className="max-h-80 overflow-y-auto">
              {allOpenAccounts
                .filter((acc) => !openAccounts.some((o) => o.id === acc.id))
                .map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      // Add the account to the store so it appears in canvas
                      const { addAccount } = useAccountStore.getState()
                      addAccount(acc)
                      setShowAddOldAccount(false)
                    }}
                    className="mb-2 flex w-full items-center justify-between rounded-xl bg-gray-700 p-3 text-left text-white active:bg-gray-600"
                  >
                    <span>{toTitleCase(acc.name || `Cuenta #${acc.number}`)}</span>
                    <span className="text-sm text-gray-400">{formatCOP(acc.total)}</span>
                  </button>
                ))}
              {allOpenAccounts.filter((acc) => !openAccounts.some((o) => o.id === acc.id)).length === 0 && (
                <p className="text-center text-gray-500">No hay cuentas de otros turnos.</p>
              )}
            </div>
            <button
              onClick={() => setShowAddOldAccount(false)}
              className="mt-4 h-12 w-full rounded-xl bg-gray-600 font-bold text-white active:bg-gray-500"
            >
              Cerrar
            </button>
          </div>
        </div>
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
