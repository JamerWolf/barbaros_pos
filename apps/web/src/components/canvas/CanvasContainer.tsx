import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'

interface CanvasContainerProps {
  children: ReactNode
}

export function CanvasContainer({ children }: CanvasContainerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { panOffset, setPanOffset, zoom, setZoom } = useAccountUIStore()
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const scaleFactor = 0.1
      const delta = e.deltaY > 0 ? -scaleFactor : scaleFactor
      setZoom(Math.min(Math.max(zoom + delta, 0.5), 2))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    
    const handleResize = () => { /* Future */ }
    window.addEventListener('resize', handleResize)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)
    }
  }, [zoom, setZoom])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.target === containerRef.current) {
      setIsPanning(true)
      lastPos.current = { x: e.clientX, y: e.clientY }
      containerRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy })
  }

  const onPointerUp = () => {
    setIsPanning(false)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative h-[60vh] w-full touch-none overflow-hidden rounded-xl bg-gray-800"
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
  )
}
