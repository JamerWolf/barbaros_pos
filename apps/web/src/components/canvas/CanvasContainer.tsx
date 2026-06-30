import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'

interface CanvasContainerProps {
  children: ReactNode
}

export function CanvasContainer({ children }: CanvasContainerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { panOffset, setPanOffset, zoom, setZoom, fitToContent, nodePositions } = useAccountUIStore()
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Auto-fit when positions change
  const fit = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    fitToContent(container.clientWidth, container.clientHeight)
  }, [fitToContent])

  // Fit on mount and when node count changes
  useEffect(() => {
    const timer = setTimeout(fit, 50)
    return () => clearTimeout(timer)
  }, [Object.keys(nodePositions).length, fit])

  // ResizeObserver to re-fit when container resizes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      fit()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [fit])

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

      // Mouse position relative to container
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Adjust pan so the point under the cursor stays fixed
      const newPanX = mouseX / newZoom - mouseX / currentZoom + currentPan.x
      const newPanY = mouseY / newZoom - mouseY / currentZoom + currentPan.y

      setZoom(newZoom)
      setPanOffset({ x: newPanX, y: newPanY })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [setZoom, setPanOffset])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.target === containerRef.current) {
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

  return (
    <div className="relative flex-1">
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-full w-full touch-none overflow-hidden rounded-xl bg-gray-800"
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
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
