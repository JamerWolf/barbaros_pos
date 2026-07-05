import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'
import { useShapeStore } from '../../store/shapeStore.js'

interface CanvasContainerProps {
  children: ReactNode
  shapes?: ReactNode
  onCreateAccount?: () => void
  onToggleSelection?: () => void
  onCardSizeChange?: (size: 'sm' | 'md' | 'lg') => void
}

// Global flag so DragNode can check during pinch
let _isPinching = false
export function isPinching() { return _isPinching }

// Global flag: long press active on a card/shape — canvas should not pan
let _longPressActive = false
export function setLongPressActive(v: boolean) { _longPressActive = v }

// Global flag: a card/shape was touched this gesture — canvas background tap logic skips
let _cardTouched = false
export function setCardTouched() { _cardTouched = true }

// Save generation counter — increment to cancel pending drag-save timers
let _saveGeneration = 0
export function getSaveGeneration() { return _saveGeneration }
export function cancelPendingSaves() { _saveGeneration++ }

// Global flag: canvas was panned during this gesture — DragNode should not navigate
let _didPan = false
export function didCanvasPan() { return _didPan }

// Persistent pan flag — survives pointerdown resets, only clears on pointerup
let _panOccurred = false
export function didPanOccur() { return _panOccurred }

// Global flag: pinch happened during this gesture — survives touchend/pointerup gap
let _pinchThisGesture = false
export function pinchThisGesture() { return _pinchThisGesture }

export function CanvasContainer({ children, shapes, onCreateAccount, onToggleSelection, onCardSizeChange }: CanvasContainerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { panOffset, setPanOffset, zoom, setZoom, fitToContent, nodePositions, canvasHeight, setCanvasHeight, _hasHydrated, fitZone, setFitZone, cardSize, setCardSize, selectionMode } = useAccountUIStore()
  const { activeTool, shapes: shapeData } = useShapeStore()
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasAutoFitted = useRef(false)

  // Zone selection state
  const [zoneMode, setZoneMode] = useState(false)
  const [showZoneMenu, setShowZoneMenu] = useState(false)
  const [showFullscreenMenu, setShowFullscreenMenu] = useState(false)
  const zoneDrawing = useRef(false)
  const zoneStart = useRef({ x: 0, y: 0 })
  const [zonePreview, setZonePreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Pinch state
  const pinchStartDist = useRef(0)
  const pinchStartZoom = useRef(1)

  // Resize state
  const isResizing = useRef(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    const x = (screenX - rect.left) / zoom - panOffset.x
    const y = (screenY - rect.top) / zoom - panOffset.y
    return { x, y }
  }, [zoom, panOffset])

  // Auto-fit on first load only (no saved positions)
  useEffect(() => {
    if (hasAutoFitted.current) return
    if (!_hasHydrated) return
    if (Object.keys(nodePositions).length === 0) return

    const container = containerRef.current
    if (!container) return

    // Check if this is first time (no saved zoom/pan — default values)
    const state = useAccountUIStore.getState()
    const isFirstTime = state.zoom === 1 && state.panOffset.x === 0 && state.panOffset.y === 0

    if (isFirstTime) {
      const currentShapes = useShapeStore.getState().shapes
      fitToContent(container.clientWidth, container.clientHeight, currentShapes)
    }
    hasAutoFitted.current = true
  }, [nodePositions, _hasHydrated, fitToContent])

  // Manual fit button — uses fitZone if set, otherwise fits all content
  const fit = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const zone = useAccountUIStore.getState().fitZone
    if (zone) {
      // Fit to the user-defined zone
      const padding = 20
      const availableWidth = container.clientWidth - padding * 2
      const availableHeight = container.clientHeight - padding * 2
      const zoomX = availableWidth / zone.width
      const zoomY = availableHeight / zone.height
      const newZoom = Math.min(zoomX, zoomY, 1.5)
      const centerX = zone.x + zone.width / 2
      const centerY = zone.y + zone.height / 2
      const newPan = {
        x: container.clientWidth / (2 * newZoom) - centerX,
        y: container.clientHeight / (2 * newZoom) - centerY,
      }
      setZoom(newZoom)
      setPanOffset(newPan)
    } else {
      const currentShapes = useShapeStore.getState().shapes
      fitToContent(container.clientWidth, container.clientHeight, currentShapes)
    }
  }, [fitToContent, setZoom, setPanOffset])

  // Zone drawing handlers
  const onZonePointerDown = useCallback((e: React.PointerEvent) => {
    if (!zoneMode) return
    e.stopPropagation()
    e.preventDefault()
    zoneDrawing.current = true
    const pos = screenToCanvas(e.clientX, e.clientY)
    zoneStart.current = pos
    setZonePreview({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }, [zoneMode, screenToCanvas])

  // Fullscreen
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Auto-fit when entering/exiting fullscreen
  useEffect(() => {
    if (!containerRef.current) return
    // Small delay so the browser finishes resizing the element
    const timer = setTimeout(() => fit(), 100)
    return () => clearTimeout(timer)
  }, [isFullscreen, fit])

  const onZonePointerMove = useCallback((e: React.PointerEvent) => {
    if (!zoneDrawing.current) return
    const pos = screenToCanvas(e.clientX, e.clientY)
    const x = Math.min(zoneStart.current.x, pos.x)
    const y = Math.min(zoneStart.current.y, pos.y)
    const width = Math.abs(pos.x - zoneStart.current.x)
    const height = Math.abs(pos.y - zoneStart.current.y)
    setZonePreview({ x, y, width, height })
  }, [screenToCanvas])

  const onZonePointerUp = useCallback(() => {
    if (!zoneDrawing.current) return
    zoneDrawing.current = false
    if (zonePreview && zonePreview.width > 10 && zonePreview.height > 10) {
      setFitZone(zonePreview)
    }
    setZonePreview(null)
    setZoneMode(false)
  }, [zonePreview, setFitZone])

  // Pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    })

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        _isPinching = true
        _pinchThisGesture = true
        pinchStartDist.current = getDistance(e.touches[0], e.touches[1])
        pinchStartZoom.current = useAccountUIStore.getState().zoom
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dist = getDistance(e.touches[0], e.touches[1])
        const scale = dist / pinchStartDist.current
        const newZoom = Math.min(Math.max(pinchStartZoom.current * scale, 0.3), 2)

        const state = useAccountUIStore.getState()
        const center = getCenter(e.touches[0], e.touches[1])
        const rect = container.getBoundingClientRect()
        const cx = center.x - rect.left
        const cy = center.y - rect.top

        const newPanX = cx / newZoom - cx / state.zoom + state.panOffset.x
        const newPanY = cy / newZoom - cy / state.zoom + state.panOffset.y

        setZoom(newZoom)
        setPanOffset({ x: newPanX, y: newPanY })
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        _isPinching = false
      }
      // Clear pinch flag only when ALL fingers are up
      if (e.touches.length === 0) {
        _pinchThisGesture = false
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [setZoom, setPanOffset])

  // Wheel zoom — zoom centered on cursor position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const state = useAccountUIStore.getState()
      const currentZoom = state.zoom
      const currentPan = state.panOffset

      const scaleFactor = 0.1
      const delta = e.deltaY > 0 ? -scaleFactor : scaleFactor
      const newZoom = Math.min(Math.max(currentZoom + delta, 0.3), 2)

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const newPanX = mouseX / newZoom - mouseX / currentZoom + currentPan.x
      const newPanY = mouseY / newZoom - mouseY / currentZoom + currentPan.y

      setZoom(newZoom)
      setPanOffset({ x: newPanX, y: newPanY })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [setZoom, setPanOffset])

  // Canvas panning — document-level to work from anywhere (cards, shapes, background)
  useEffect(() => {
    let didPan = false

    const onPointerDown = (e: PointerEvent) => {
      // Don't start pan if pointer is outside the canvas container
      const container = containerRef.current
      if (!container || !container.contains(e.target as Node)) return

      // Don't reset _cardTouched if target is a card or shape (data-canvas-node)
      // React handlers fire before native document listeners, so setCardTouched() runs first
      // but the native handler was overwriting it to false
      const isCanvasNode = (e.target as HTMLElement)?.closest?.('[data-canvas-node]')
      if (!isCanvasNode) {
        _cardTouched = false
      }
      didPan = false
      _didPan = false
      if (isPinching() || _longPressActive) return
      if (activeTool) return
      if (e.button !== 0) return
      // Don't start pan if target is inside the resize handle
      const resizeHandle = (e.target as HTMLElement)?.closest?.('[data-resize-handle]')
      if (resizeHandle) return
      isPanning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanning.current || isPinching() || _longPressActive) {
        isPanning.current = false
        return
      }
      didPan = true
      _didPan = true
      _panOccurred = true
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }
      const current = useAccountUIStore.getState().panOffset
      setPanOffset({ x: current.x + dx, y: current.y + dy })
    }

    const onPointerUp = (e: PointerEvent) => {
      isPanning.current = false
      _panOccurred = false
      // Background tap (not on a card/shape/toolbar, no pan) → exit selection mode
      const isToolbar = (e.target as HTMLElement)?.closest?.('[data-toolbar]')
      if (!_cardTouched && !didPan && !isToolbar) {
        const { selectionMode, setSelectionMode } = useAccountUIStore.getState()
        if (selectionMode) {
          setSelectionMode(false)
        }
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [activeTool, setPanOffset])

  // Resize handle
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isResizing.current = true
    resizeStartY.current = e.clientY
    resizeStartHeight.current = containerRef.current?.parentElement?.getBoundingClientRect().height ?? 0

    const onMove = (ev: PointerEvent) => {
      if (!isResizing.current) return
      const delta = resizeStartY.current - ev.clientY
      const newHeight = Math.max(200, Math.min(window.innerHeight - 100, resizeStartHeight.current + delta))
      setCanvasHeight(newHeight)
    }

    const onUp = () => {
      isResizing.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Convert fitZone from canvas coords to screen coords for the preview overlay
  const zoneScreen = fitZone ? {
    left: (fitZone.x + panOffset.x) * zoom,
    top: (fitZone.y + panOffset.y) * zoom,
    width: fitZone.width * zoom,
    height: fitZone.height * zoom,
  } : null

  const previewScreen = zonePreview ? {
    left: (zonePreview.x + panOffset.x) * zoom,
    top: (zonePreview.y + panOffset.y) * zoom,
    width: zonePreview.width * zoom,
    height: zonePreview.height * zoom,
  } : null

  return (
    <div
      ref={wrapperRef}
      className={`relative flex flex-col ${isFullscreen ? 'h-screen w-screen' : ''}`}
      style={isFullscreen ? undefined : canvasHeight ? { height: canvasHeight, flex: 'none' } : { minHeight: 0, flex: 1 }}
    >
      {/* Resize handle */}
      <div
        onPointerDown={onResizeDown}
        data-resize-handle
        style={{ touchAction: 'none' }}
        className="flex h-5 shrink-0 cursor-row-resize items-center justify-center rounded-t-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-500"
      >
        <div className="h-1 w-8 rounded-full bg-gray-500" />
      </div>
      {/* Canvas */}
      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden rounded-b-xl bg-gray-800 ${zoneMode ? 'cursor-crosshair' : ''}`}
        onPointerDown={zoneMode ? onZonePointerDown : undefined}
        onPointerMove={zoneMode ? onZonePointerMove : undefined}
        onPointerUp={zoneMode ? onZonePointerUp : undefined}
      >
        {/* Shapes layer — rendered first so cards are on top */}
        {shapes && (
          <div
            className={`absolute left-0 top-0 h-full w-full ${activeTool ? '' : 'pointer-events-none'}`}
            style={{ zIndex: 1 }}
          >
            {shapes}
          </div>
        )}
        <div
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            zIndex: 10,
          }}
          className="absolute left-0 top-0 h-full w-full origin-top-left pointer-events-none"
        >
          {children}
        </div>
        {/* Fit zone overlay — shows the saved zone */}
        {zoneScreen && !zoneMode && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-blue-400/60 bg-blue-400/10"
            style={{
              left: zoneScreen.left,
              top: zoneScreen.top,
              width: zoneScreen.width,
              height: zoneScreen.height,
              zIndex: 20,
            }}
          />
        )}
        {/* Zone preview — shows while drawing */}
        {previewScreen && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-yellow-400/80 bg-yellow-400/10"
            style={{
              left: previewScreen.left,
              top: previewScreen.top,
              width: previewScreen.width,
              height: previewScreen.height,
              zIndex: 20,
            }}
          />
        )}
        {/* Zone mode hint */}
        {zoneMode && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
            Dibujá la zona con el mouse
          </div>
        )}
      </div>
      {/* Fit + Config + Fullscreen buttons */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
        {isFullscreen && onCreateAccount && (
          <div className="relative flex">
            <button
              onClick={onCreateAccount}
              className="h-9 rounded-l-lg bg-green-600/90 px-3 text-xs font-bold text-white backdrop-blur active:bg-green-500"
            >
              + Cuenta
            </button>
            <button
              onClick={() => setShowFullscreenMenu(!showFullscreenMenu)}
              className="h-9 rounded-r-lg border-l border-green-500 bg-green-600/90 px-1.5 text-xs text-white backdrop-blur active:bg-green-500"
            >
              ▾
            </button>
            {showFullscreenMenu && (
              <div className="absolute bottom-10 left-0 z-30 w-44 rounded-lg border border-gray-600 bg-gray-800 p-2 shadow-xl">
                <div className="mb-1 text-[10px] font-bold text-gray-400">Tamaño de tarjeta</div>
                <div className="mb-2 flex gap-1">
                  {(['sm', 'md', 'lg'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onCardSizeChange?.(s) ?? setCardSize(s)}
                      className={`flex-1 rounded-md py-1.5 text-xs font-bold ${
                        cardSize === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { onToggleSelection?.(); setShowFullscreenMenu(false) }}
                  className={`w-full rounded-md px-3 py-2 text-left text-xs font-bold ${
                    selectionMode ? 'bg-yellow-600 text-white' : 'text-white hover:bg-gray-700'
                  }`}
                >
                  {selectionMode ? '✓ Seleccionando' : '☐ Seleccionar'}
                </button>
              </div>
            )}
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          className="h-9 rounded-lg bg-gray-700/90 px-2 text-xs font-bold text-white backdrop-blur active:bg-gray-600"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? '⊡' : '⛶'}
        </button>
        {fitZone && (
          <button
            onClick={() => setFitZone(null)}
            className="h-9 rounded-lg bg-blue-600/90 px-2 text-xs font-bold text-white backdrop-blur active:bg-blue-500"
            title="Resetear zona"
          >
            ↺
          </button>
        )}
        <button
          onClick={() => setShowZoneMenu(!showZoneMenu)}
          className="h-9 rounded-lg bg-gray-700/90 px-2 text-xs font-bold text-white backdrop-blur active:bg-gray-600"
          title="Configurar zona"
        >
          ⚙
        </button>
        <button
          onClick={fit}
          className="h-9 rounded-lg bg-gray-700/90 px-3 text-xs font-bold text-white backdrop-blur active:bg-gray-600"
        >
          ⊞ Ajustar
        </button>
      </div>
      {/* Zone config menu */}
      {showZoneMenu && (
        <div className="absolute bottom-14 right-3 z-30 w-48 rounded-lg border border-gray-600 bg-gray-800 p-2 shadow-xl">
          <div className="mb-2 text-xs font-bold text-gray-400">Zona de ajuste</div>
          <button
            onClick={() => {
              setShowZoneMenu(false)
              setZoneMode(true)
            }}
            className="mb-1 w-full rounded-md px-3 py-2 text-left text-xs text-white hover:bg-gray-700 active:bg-gray-600"
          >
            📐 Seleccionar zona
          </button>
          {fitZone && (
            <button
              onClick={() => {
                setFitZone(null)
                setShowZoneMenu(false)
              }}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-white hover:bg-gray-700 active:bg-gray-600"
            >
              ↺ Resetear zona
            </button>
          )}
          {fitZone && (
            <div className="mt-2 border-t border-gray-600 pt-2 text-[10px] text-gray-500">
              Zona activa: {Math.round(fitZone.width)}×{Math.round(fitZone.height)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
