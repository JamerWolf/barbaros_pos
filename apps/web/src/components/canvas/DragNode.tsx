import { useRef, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'
import { saveAccountPosition } from '../../services/accountApi.js'
import { isPinching, setLongPressActive, setCardTouched } from './CanvasContainer.js'

interface DragNodeProps {
  accountId: string
  children: ReactNode
  onClick?: () => void
}

const LONG_PRESS_MS = 400
const DRAG_THRESHOLD = 3

export function DragNode({ accountId, children, onClick }: DragNodeProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null)
  const position = useAccountUIStore((s) => s.nodePositions[accountId] ?? { x: 0, y: 0 })
  const selectionMode = useAccountUIStore((s) => s.selectionMode)
  const selectedIds = useAccountUIStore((s) => s.selectedIds)
  const isSelected = selectedIds.has(accountId)
  const updatePosition = useAccountUIStore((s) => s.updatePosition)
  const movePositions = useAccountUIStore((s) => s.movePositions)
  const toggleSelection = useAccountUIStore((s) => s.toggleSelection)
  const canvasLocked = useAccountUIStore((s) => s.canvasLocked)
  const zoom = useAccountUIStore((s) => s.zoom)
  const offset = useRef({ x: 0, y: 0 })
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const didMove = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const activePointerId = useRef<number | null>(null)

  const startDrag = (e: PointerEvent) => {
    activePointerId.current = e.pointerId
    isDragging.current = false
    longPressFired.current = false
    startPos.current = { x: e.clientX, y: e.clientY }

    const rect = nodeRef.current?.getBoundingClientRect()
    if (rect) {
      offset.current = {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      }
    }

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setLongPressActive(true)

      // Start drag from long press position
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId.current) return

        const dx = Math.abs(ev.clientX - startPos.current.x)
        const dy = Math.abs(ev.clientY - startPos.current.y)
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          isDragging.current = true
        }
        if (!isDragging.current) return

        const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect()
        if (!parentRect) return

        const newX = (ev.clientX - parentRect.left) / zoom - offset.current.x
        const newY = (ev.clientY - parentRect.top) / zoom - offset.current.y
        const delta = { x: newX - position.x, y: newY - position.y }

        if (isSelected && selectedIds.size > 1) {
          movePositions(Array.from(selectedIds), delta)
        } else {
          updatePosition(accountId, { x: newX, y: newY })
        }
      }

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== activePointerId.current) return
        activePointerId.current = null
        setLongPressActive(false)
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)

        if (!isDragging.current) {
          // Long press without drag → enter selection mode + select this card
          const uiState = useAccountUIStore.getState()
          if (!uiState.selectionMode) {
            useAccountUIStore.getState().setSelectionMode(true)
          }
          useAccountUIStore.getState().toggleSelection(accountId)
        } else {
          // Long press + drag → save position
          const uiState = useAccountUIStore.getState()
          const idsToSave = isSelected && selectedIds.size > 1
            ? Array.from(selectedIds)
            : [accountId]
          if (dragSaveTimer.current) clearTimeout(dragSaveTimer.current)
          dragSaveTimer.current = setTimeout(() => {
            for (const id of idsToSave) {
              const pos = uiState.nodePositions[id]
              if (pos) saveAccountPosition(id, { posX: pos.x, posY: pos.y })
            }
          }, 300)
        }
        isDragging.current = false
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (canvasLocked || isPinching()) return
    if (e.button !== 0 && e.button !== undefined) return
    didMove.current = false
    setCardTouched()
    startDrag(e.nativeEvent)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!longPressFired.current) {
      // Cancel long press if finger moves too much before timer fires
      const dx = Math.abs(e.clientX - startPos.current.x)
      const dy = Math.abs(e.clientY - startPos.current.y)
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        didMove.current = true
        cancelLongPress()
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!longPressFired.current) {
      cancelLongPress()
      // Only navigate on clean tap — not if finger moved (pan gesture)
      if (!didMove.current) {
        if (selectionMode) {
          toggleSelection(accountId)
        } else {
          onClick?.()
        }
      }
    }
    // Long press up is handled by the document listener in startDrag
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
