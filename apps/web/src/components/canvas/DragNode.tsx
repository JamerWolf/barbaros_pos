import { useRef, type ReactNode } from 'react'
import { useAccountUIStore } from '../../store/accountUIStore.js'
import { saveAccountPosition, saveAccountCardDimensions } from '../../services/accountApi.js'
import { getSaveGeneration } from './CanvasContainer.js'
import { useCanvasDrag } from './useCanvasDrag.js'
import { useCanvasResize } from './useCanvasResize.js'
import { ResizeHandles } from './ResizeHandles.js'
import { computeGroupBounds, type SnapBounds } from '../../utils/snapAlignment.js'

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
  const cardDimensions = useAccountUIStore((s) => s.cardDimensions[accountId])
  const setCardDimensions = useAccountUIStore((s) => s.setCardDimensions)
  const getCardDimensions = useAccountUIStore((s) => s.getCardDimensions)
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dimSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDragPos = useRef({ x: 0, y: 0 })

  const dims = getCardDimensions(accountId)

  const { resizeHandleProps } = useCanvasResize({
    elementRef: nodeRef,
    zoom,
    onResize: ({ width, height }) => {
      setCardDimensions(accountId, width, height)
    },
    onPositionChange: (pos) => {
      updatePosition(accountId, pos)
    },
    onResizeEnd: () => {
      if (dimSaveTimer.current) clearTimeout(dimSaveTimer.current)
      const gen = getSaveGeneration()
      dimSaveTimer.current = setTimeout(() => {
        if (getSaveGeneration() !== gen) return
        const currentDims = useAccountUIStore.getState().cardDimensions[accountId]
        const currentPos = useAccountUIStore.getState().nodePositions[accountId]
        if (currentDims) {
          saveAccountCardDimensions(accountId, currentDims.w, currentDims.h)
        }
        if (currentPos) {
          saveAccountPosition(accountId, { posX: currentPos.x, posY: currentPos.y })
        }
      }, 300)
    },
  })

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
    onLongPress: () => {
      if (!selectionMode) {
        const state = useAccountUIStore.getState()
        state.saveSelectionSnapshot()
        state.setSelectionMode(true)
        state.toggleSelection(accountId)
      }
    },
    // Snap alignment: cards snap to cards
    getSnapBounds: () => {
      const state = useAccountUIStore.getState()
      const { w, h } = state.getCardDimensions(accountId)
      if (isSelected && selectedIds.size > 1) {
        // Group selection: compute group bounding box
        const groupItems = Array.from(selectedIds).map((id) => {
          const pos = state.nodePositions[id] ?? { x: 0, y: 0 }
          const dim = state.getCardDimensions(id)
          return { x: pos.x, y: pos.y, width: dim.w, height: dim.h }
        })
        const group = computeGroupBounds(groupItems)
        return { left: group.left, top: group.top, width: group.width, height: group.height }
      }
      return { left: position.x, top: position.y, width: w, height: h }
    },
    getOtherSnapBounds: () => {
      const state = useAccountUIStore.getState()
      const bounds: SnapBounds[] = []
      for (const [id, pos] of Object.entries(state.nodePositions)) {
        // Skip dragged card(s)
        if (isSelected && selectedIds.size > 1) {
          if (selectedIds.has(id)) continue
        } else {
          if (id === accountId) continue
        }
        const dim = state.getCardDimensions(id)
        bounds.push({ left: pos.x, top: pos.y, width: dim.w, height: dim.h })
      }
      return bounds
    },
    onSnapGuides: (guides) => {
      useAccountUIStore.getState().setActiveGuides(guides)
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
        width: cardDimensions ? cardDimensions.w : dims.w,
        height: cardDimensions ? cardDimensions.h : dims.h,
        touchAction: 'none',
      }}
      className={`pointer-events-auto select-none ${
        selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isSelected ? 'ring-2 ring-[#C8A84E] ring-offset-2 ring-offset-[#0A0A0A] rounded-xl' : ''}`}
    >
      {children}
      {isSelected && selectionMode && !cardsLocked && (
        <ResizeHandles
          handles={['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']}
          handleProps={resizeHandleProps}
        />
      )}
    </div>
  )
}
