import { useRef, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'

interface DragNodeProps {
  accountId: string
  children: ReactNode
  onClick?: () => void
}

export function DragNode({ accountId, children, onClick }: DragNodeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null)
  const position = useAccountUIStore((s) => s.nodePositions[accountId] ?? { x: 0, y: 0 })
  const updatePosition = useAccountUIStore((s) => s.updatePosition)
  const zoom = useAccountUIStore((s) => s.zoom)
  const offset = useRef({ x: 0, y: 0 })

  const startPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false) // Usamos ref para evitar re-renders innecesarios durante el drag

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    isDragging.current = false // Reset
    startPos.current = { x: e.clientX, y: e.clientY }
    
    const rect = nodeRef.current?.getBoundingClientRect()
    if (rect) {
      // Ajustamos el offset inicial también por el zoom
      offset.current = {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      }
    }
    nodeRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    // Si no tenemos capturado el puntero, no arrastramos
    if (!nodeRef.current?.hasPointerCapture(e.pointerId)) return

    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    
    // Solo marcamos arrastre si nos movemos más de 5px
    if (dx > 5 || dy > 5) {
      isDragging.current = true
    }

    if (!isDragging.current) return
    
    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect()
    if (!parentRect) return
    
    // Ajustamos el cálculo por el zoom actual
    const newX = (e.clientX - parentRect.left) / zoom - offset.current.x
    const newY = (e.clientY - parentRect.top) / zoom - offset.current.y
    updatePosition(accountId, { x: newX, y: newY })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) {
      // Es un click/tap
      onClick?.()
    }
    isDragging.current = false
    nodeRef.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={nodeRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
      className="pointer-events-auto select-none cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  )
}
