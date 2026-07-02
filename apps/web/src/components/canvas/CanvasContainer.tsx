import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'
import { useShapeStore } from '../../store/shapeStore.js'

interface CanvasContainerProps {
  children: ReactNode
  shapes?: ReactNode
}

export function CanvasContainer({ children, shapes }: CanvasContainerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { panOffset, setPanOffset, zoom, setZoom, fitToContent, nodePositions, canvasHeight, setCanvasHeight, _hasHydrated } = useAccountUIStore()
  const { activeTool, shapes: shapeData } = useShapeStore()
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasAutoFitted = useRef(false)

  // Resize state
  const isResizing = useRef(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

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

  // Manual fit button
  const fit = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const currentShapes = useShapeStore.getState().shapes
    fitToContent(container.clientWidth, container.clientHeight, currentShapes)
  }, [fitToContent])

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

  // Canvas panning
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.target === containerRef.current && !activeTool) {
      isPanning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
      containerRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    const current = useAccountUIStore.getState().panOffset
    setPanOffset({ x: current.x + dx, y: current.y + dy })
  }

  const onPointerUp = () => {
    isPanning.current = false
  }

  // Resize handle
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isResizing.current = true
    resizeStartY.current = e.clientY
    resizeStartHeight.current = containerRef.current?.parentElement?.getBoundingClientRect().height ?? 0
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      if (!isResizing.current) return
      const delta = resizeStartY.current - ev.clientY
      const newHeight = Math.max(200, Math.min(window.innerHeight - 100, resizeStartHeight.current + delta))
      setCanvasHeight(newHeight)
    }

    const onUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="relative flex flex-col"
      style={canvasHeight ? { height: canvasHeight, flex: 'none' } : { minHeight: 0, flex: 1 }}
    >
      {/* Resize handle */}
      <div
        onPointerDown={onResizeDown}
        className="flex h-5 shrink-0 cursor-row-resize items-center justify-center rounded-t-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-500"
      >
        <div className="h-1 w-8 rounded-full bg-gray-500" />
      </div>
      {/* Canvas */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-b-xl bg-gray-800"
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
      </div>
      {/* Fit button */}
      <button
        onClick={fit}
        className="absolute bottom-3 right-3 z-10 h-9 rounded-lg bg-gray-700/90 px-3 text-xs font-bold text-white backdrop-blur active:bg-gray-600"
      >
        ⊞ Ajustar
      </button>
    </div>
  )
}
