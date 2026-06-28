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
  const selectionMode = useAccountUIStore((s) => s.selectionMode)
  const selectedIds = useAccountUIStore((s) => s.selectedIds)
  const isSelected = selectedIds.has(accountId)
  const updatePosition = useAccountUIStore((s) => s.updatePosition)
  const movePositions = useAccountUIStore((s) => s.movePositions)
  const toggleSelection = useAccountUIStore((s) => s.toggleSelection)
  const zoom = useAccountUIStore((s) => s.zoom)
  const offset = useRef({ x: 0, y: 0 })

  const startPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    isDragging.current = false
    startPos.current = { x: e.clientX, y: e.clientY }

    const rect = nodeRef.current?.getBoundingClientRect()
    if (rect) {
      offset.current = {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      }
    }
    nodeRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!nodeRef.current?.hasPointerCapture(e.pointerId)) return

    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)

    if (dx > 5 || dy > 5) {
      isDragging.current = true
    }

    if (!isDragging.current) return

    const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect()
    if (!parentRect) return

    // Calculate raw position for this node
    const newX = (e.clientX - parentRect.left) / zoom - offset.current.x
    const newY = (e.clientY - parentRect.top) / zoom - offset.current.y
    const delta = { x: newX - position.x, y: newY - position.y }

    // If this account is selected, move all selected accounts as a group
    if (isSelected && selectedIds.size > 1) {
      movePositions(Array.from(selectedIds), delta)
    } else {
      updatePosition(accountId, { x: newX, y: newY })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) {
      // It's a tap/click
      if (selectionMode) {
        toggleSelection(accountId)
      } else {
        onClick?.()
      }
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
      className={`pointer-events-auto select-none ${
        selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800 rounded-xl' : ''}`}
    >
      {children}
    </div>
  )
}
