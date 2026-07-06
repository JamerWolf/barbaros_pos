import { useRef, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'
import { saveAccountPosition } from '../../services/accountApi.js'
import { getSaveGeneration } from './CanvasContainer.js'
import { useCanvasDrag } from './useCanvasDrag.js'

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
  const cardsLocked = useAccountUIStore((s) => s.cardsLocked)
  const zoom = useAccountUIStore((s) => s.zoom)
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDragPos = useRef({ x: 0, y: 0 })

  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrag({
    elementRef: nodeRef,
    zoom,
    isLocked: cardsLocked,
    onDragMove: (pos) => {
      if (isSelected && selectedIds.size > 1) {
        const delta = { x: pos.x - lastDragPos.current.x, y: pos.y - lastDragPos.current.y }
        lastDragPos.current = pos
        movePositions(Array.from(selectedIds), delta)
      } else {
        updatePosition(accountId, pos)
        lastDragPos.current = pos
      }
    },
    onDragEnd: () => {
      const uiState = useAccountUIStore.getState()
      const idsToSave = isSelected && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [accountId]
      if (dragSaveTimer.current) clearTimeout(dragSaveTimer.current)
      const gen = getSaveGeneration()
      dragSaveTimer.current = setTimeout(() => {
        if (getSaveGeneration() !== gen) return
        for (const id of idsToSave) {
          const pos = uiState.nodePositions[id]
          if (pos) saveAccountPosition(id, { posX: pos.x, posY: pos.y })
        }
      }, 300)
    },
    onTap: () => {
      if (selectionMode) {
        useAccountUIStore.getState().toggleSelection(accountId)
      } else {
        onClick?.()
      }
    },
  })

  const handlePointerDown = (e: React.PointerEvent) => {
    lastDragPos.current = { ...position }
    onPointerDown(e)
  }

  return (
    <div
      ref={nodeRef}
      data-canvas-node
      onPointerDown={handlePointerDown}
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
