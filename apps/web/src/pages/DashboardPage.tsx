import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountStore } from '../store/accountStore.js'
import { useAccountUIStore } from '../store/accountUIStore.js'
import { useShapeStore, type ShapeTool } from '../store/shapeStore.js'
import { AccountCard } from '../components/Accounts/AccountCard.js'
import { AccountDetailModal } from '../components/AccountDetailModal.js'
import { AdminProductsPage } from '../components/Admin/AdminProductsPage.js'
import { CanvasContainer, cancelPendingSaves } from '../components/canvas/CanvasContainer.js'
import { DragNode } from '../components/canvas/DragNode.js'
import { ShapeLayer } from '../components/canvas/shapes/ShapeLayer.js'
import { Toast } from '../components/Toast.js'
import { useToast } from '../hooks/useToast.js'
import { toTitleCase } from '../utils/textUtils.js'
import { formatCOP } from '../utils/format.js'
import { saveAccountCardSize, saveAccountPosition } from '../services/accountApi.js'
import API_URL from '../utils/apiUrl.js'
import type { IAccount } from '@barbaros/shared'

const ADMIN_PIN = '1234'

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const { accounts } = useAccountStore()
  const { nodePositions, assignPositionsBatch, clearOrphanPositions, viewMode, setViewMode, selectionMode, selectedIds, setSelectionMode, clearSelection, saveSelectionSnapshot, restoreSelectionSnapshot, cardSize, setCardSize, getCardSize, cardsLocked, setCardsLocked, shapesLocked, setShapesLocked, _hasHydrated } = useAccountUIStore()
  const { activeTool, setActiveTool, drawingColor, setDrawingColor, selectedShapeId, setSelectedShapeId, deleteShape } = useShapeStore()
  const [mode, setMode] = useState<'personal' | 'admin'>('personal')
  const [showAdminProducts, setShowAdminProducts] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const { toast, showToast } = useToast()
  const [allOpenAccounts, setAllOpenAccounts] = useState<(IAccount & { total: number; pendingAmount: number })[]>([])
  const [showAddOldAccount, setShowAddOldAccount] = useState(false)
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [confirmCloseShift, setConfirmCloseShift] = useState(false)

  // Scroll to bottom when switching to canvas mode
  useEffect(() => {
    if (viewMode === 'canvas') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [viewMode])

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

  // Auto-exit selection mode when no cards are selected
  const hadSelection = useRef(false)
  useEffect(() => {
    if (selectionMode) {
      if (selectedIds.size > 0) {
        hadSelection.current = true
      } else if (hadSelection.current) {
        // Selection was active and is now empty → exit
        hadSelection.current = false
        setSelectionMode(false)
      }
    } else {
      hadSelection.current = false
    }
  }, [selectedIds, selectionMode, setSelectionMode])

  // Listen for shift events from other devices
  useEffect(() => {
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws'
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let delay = 1000

    const connect = () => {
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return
      ws = new WebSocket(wsUrl)

      ws.onopen = () => { delay = 1000 }

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

      ws.onclose = () => {
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, 10000)
          connect()
        }, delay)
      }

      ws.onerror = () => { ws?.close() }
    }

    connect()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (ws?.readyState === WebSocket.CLOSED || ws?.readyState === WebSocket.CLOSING)) {
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
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
    <div className="flex min-h-dvh flex-col gap-2 bg-[#0A0A0A] px-[5px] text-[#E8E0D0]">
      {/* Header */}
      <header data-toolbar className="flex flex-wrap items-center gap-2">
        <img src="/logo.png" alt="Bárbaro's Logo" className="h-[60px] w-auto object-contain" />
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="relative">
            {showSearch ? (
              <>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8A84E]">🔍</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery) setShowSearch(false) }}
                  className="h-11 w-48 rounded-lg bg-[#141414] border border-[#C8A84E]/20 py-2 pl-10 pr-4 text-sm text-[#E8E0D0] placeholder-[#7A7060] outline-none focus:ring-1 focus:ring-[#C8A84E]/50"
                />
              </>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="h-11 rounded-lg bg-[#141414] border border-[#C8A84E]/20 px-4 text-sm font-bold text-[#7A7060] active:bg-[#1E1E1E]"
              >
                🔍
              </button>
            )}
          </div>
          <div className="flex items-center rounded-lg bg-[#141414] border border-[#C8A84E]/20 px-1">
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
                className={`h-11 rounded-md px-3 text-sm font-bold ${
                  cardSize === size ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={createAccount}
            className="h-11 rounded-lg bg-[#C8A84E] px-4 text-sm font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80 whitespace-nowrap"
          >
            + Cuenta
          </button>
          <div className="flex rounded-lg bg-[#141414] p-1 border border-[#C8A84E]/20">
            <button
              onClick={() => handleModeChange('personal')}
              className={`h-9 rounded-md px-3 text-sm font-bold transition-all ${mode === 'personal' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060]'}`}
            >
              Personal
            </button>
            <button
              onClick={() => handleModeChange('admin')}
              className={`h-9 rounded-md px-3 text-sm font-bold transition-all ${mode === 'admin' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060]'}`}
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      {mode === 'admin' && (
        <div className="flex flex-col gap-3 rounded-xl bg-[#141414] p-3 border border-[#C8A84E]/20 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-[#C8A84E] tracking-wide" style={{ fontFamily: 'serif' }}>Control de Turno</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdminProducts(true)}
                className="h-10 flex-1 rounded-lg bg-[#C8A84E]/10 border border-[#C8A84E]/30 px-3 text-sm font-bold text-[#C8A84E] active:bg-[#C8A84E]/20 sm:flex-none"
              >
                ☰ Productos
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="h-10 flex-1 rounded-lg bg-[#C8A84E]/10 border border-[#C8A84E]/30 px-3 text-sm font-bold text-[#C8A84E] active:bg-[#C8A84E]/20 sm:flex-none"
              >
                📊 Reportes
              </button>
            </div>
          </div>
          {activeShiftId ? (
            !confirmCloseShift ? (
              <button
                onClick={() => setConfirmCloseShift(true)}
                className="h-12 w-full rounded-lg bg-[#5C1A1A] border border-[#E85050]/30 px-4 font-bold text-[#E85050] active:bg-[#5C1A1A]/80"
              >
                Cerrar Turno
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl bg-[#5C1A1A]/30 border border-[#E85050]/20 p-4">
                <p className="text-sm text-[#E8E0D0]">Seguro que queres cerrar el turno?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { closeShift(); setConfirmCloseShift(false) }}
                    className="h-12 flex-1 rounded-lg bg-[#5C1A1A] border border-[#E85050]/30 font-bold text-[#E85050] active:bg-[#5C1A1A]/80"
                  >
                    Si, cerrar
                  </button>
                  <button
                    onClick={() => setConfirmCloseShift(false)}
                    className="h-12 flex-1 rounded-lg bg-[#1E1E1E] border border-[#C8A84E]/20 font-bold text-[#E8E0D0] active:bg-[#1E1E1E]/80"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )
          ) : (
            <button
              onClick={openShift}
              className="h-12 w-full rounded-lg bg-[#2D5A27] border border-[#7CCD7C]/30 px-4 font-bold text-[#7CCD7C] active:bg-[#2D5A27]/80"
            >
              Abrir Turno
            </button>
          )}
        </div>
      )}

      <section className="flex flex-1 flex-col">
        {!_hasHydrated ? (
          <p className="text-center text-[#7A7060]">Cargando...</p>
        ) : viewMode === 'list' ? (
          filteredAllOpenAccounts.length === 0 ? (
            <p className="text-center text-[#7A7060]">{searchQuery ? 'No se encontraron cuentas.' : 'No hay cuentas abiertas.'}</p>
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
                  onClick={() => setSelectedAccountId(acc.id)}
                />
              ))}
            </div>
          )
        ) : filteredOpenAccounts.length === 0 ? (
          <p className="text-center text-[#7A7060]">{searchQuery ? 'No se encontraron cuentas.' : 'No hay cuentas abiertas.'}</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <span className="text-sm text-[#C8A84E]">
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
                    className="h-10 rounded-lg bg-[#1E1E1E] px-3 font-bold text-sm text-[#E8E0D0] active:bg-[#1E1E1E]/80"
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
                  className={`h-10 rounded-lg px-3 font-bold text-sm ${
                    selectionMode ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'bg-[#141414] text-[#E8E0D0] border border-[#C8A84E]/20 active:bg-[#1E1E1E]'
                  }`}
                >
                  {selectionMode ? '✓ Seleccionando' : '☐ Seleccionar'}
                </button>
                <button
                  onClick={() => setShowAddOldAccount(true)}
                  className="h-10 rounded-lg bg-[#C8A84E]/10 border border-[#C8A84E]/30 px-3 font-bold text-sm text-[#C8A84E] active:bg-[#C8A84E]/20"
                >
                  + Agregar cuenta de otro turno
                </button>
                {/* Shape tools — admin only */}
                {mode === 'admin' && (
                  <>
                    <div className={`flex rounded-lg bg-[#141414] border border-[#C8A84E]/20 p-1 ${shapesLocked ? 'opacity-50' : ''}`}>
                      <button
                        onClick={() => !shapesLocked && setActiveTool(activeTool === 'rectangle' ? null : 'rectangle')}
                        disabled={shapesLocked}
                        className={`h-8 rounded-md px-2 text-xs font-bold ${
                          activeTool === 'rectangle' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060]'
                        }`}
                        title="Rectángulo"
                      >
                        ▭
                      </button>
                      <button
                        onClick={() => !shapesLocked && setActiveTool(activeTool === 'line' ? null : 'line')}
                        disabled={shapesLocked}
                        className={`h-8 rounded-md px-2 text-xs font-bold ${
                          activeTool === 'line' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060]'
                        }`}
                        title="Línea"
                      >
                        ╱
                      </button>
                      <button
                        onClick={() => !shapesLocked && setActiveTool(activeTool === 'text' ? null : 'text')}
                        disabled={shapesLocked}
                        className={`h-8 rounded-md px-2 text-xs font-bold ${
                          activeTool === 'text' ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'text-[#7A7060]'
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
                          className="h-8 rounded-md px-2 text-xs font-bold text-[#E85050] hover:bg-[#5C1A1A]"
                          title="Eliminar figura (o presiona Delete)"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShapesLocked(!shapesLocked);
                        if (!shapesLocked) {
                          setActiveTool(null);
                          setSelectionMode(false);
                          setSelectedShapeId(null);
                        }
                      }}
                      className={`h-10 rounded-lg px-3 font-bold text-sm ${
                        shapesLocked ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'bg-[#141414] text-[#E8E0D0] border border-[#C8A84E]/20 active:bg-[#1E1E1E]'
                      }`}
                      title={shapesLocked ? 'Desbloquear figuras' : 'Bloquear figuras'}
                    >
                      {shapesLocked ? '🔒 Figuras' : '🔓 Figuras'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setCardsLocked(!cardsLocked);
                    if (!cardsLocked) {
                      setSelectionMode(false);
                    }
                  }}
                  className={`h-10 rounded-lg px-3 font-bold text-sm ${
                    cardsLocked ? 'bg-[#C8A84E] text-[#0A0A0A]' : 'bg-[#141414] text-[#E8E0D0] border border-[#C8A84E]/20 active:bg-[#1E1E1E]'
                  }`}
                  title={cardsLocked ? 'Desbloquear tarjetas' : 'Bloquear tarjetas'}
                >
                  {cardsLocked ? '🔒 Tarjetas' : '🔓 Tarjetas'}
                </button>
              </div>
            </div>
            <CanvasContainer shapes={<ShapeLayer />} modal={selectedAccountId ? (
              <AccountDetailModal accountId={selectedAccountId} onClose={() => setSelectedAccountId(null)} />
            ) : undefined} onCreateAccount={createAccount} onToggleSelection={() => {
              if (selectionMode) {
                clearSelection()
                setSelectionMode(false)
              } else {
                saveSelectionSnapshot()
                setSelectionMode(true)
              }
            }} onCardSizeChange={(size) => {
              setCardSize(size)
              if (selectionMode && selectedIds.size > 0) {
                for (const id of selectedIds) {
                  saveAccountCardSize(id, size)
                }
              }
            }}>
              {filteredOpenAccounts.map((acc) => (
                <DragNode
                  key={acc.id}
                  accountId={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
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
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-[#E8E0D0]">Acceso Admin</h2>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mb-4 h-14 w-full rounded-xl bg-[#1E1E1E] px-4 text-center text-2xl tracking-widest text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
            />
            {pinError && <p className="mb-4 text-center text-sm text-[#E85050]">{pinError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false)
                  setPin('')
                  setPinError(null)
                }}
                className="h-12 flex-1 rounded-xl bg-[#1E1E1E] font-bold text-[#E8E0D0] active:bg-[#1E1E1E]/80"
              >
                Cancelar
              </button>
              <button
                onClick={submitPin}
                className="h-12 flex-1 rounded-xl bg-[#C8A84E] font-bold text-[#0A0A0A] active:bg-[#C8A84E]/80"
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
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-[#E8E0D0]">Agregar cuenta de otro turno</h2>
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
                      // Pin to backend so it persists across devices
                      fetch(`${API_URL}/accounts/${acc.id}/pin`, { method: 'PATCH' }).catch(() => {})
                      setShowAddOldAccount(false)
                    }}
                    className="mb-2 flex w-full items-center justify-between rounded-xl bg-[#1E1E1E] p-3 text-left text-[#E8E0D0] active:bg-[#1E1E1E]/80"
                  >
                    <span>{toTitleCase(acc.name || `Cuenta #${acc.number}`)}</span>
                    <span className="text-sm text-[#7A7060]">{formatCOP(acc.total)}</span>
                  </button>
                ))}
              {allOpenAccounts.filter((acc) => !openAccounts.some((o) => o.id === acc.id)).length === 0 && (
                <p className="text-center text-[#7A7060]">No hay cuentas de otros turnos.</p>
              )}
            </div>
            <button
              onClick={() => setShowAddOldAccount(false)}
              className="mt-4 h-12 w-full rounded-xl bg-[#1E1E1E] font-bold text-[#E8E0D0] active:bg-[#1E1E1E]/80"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
