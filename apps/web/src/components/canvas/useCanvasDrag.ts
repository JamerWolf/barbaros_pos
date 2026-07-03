import { useRef, useCallback } from 'react'
import { isPinching, setLongPressActive, setCardTouched, pinchThisGesture, didPanOccur } from './CanvasContainer.js'

const LONG_PRESS_MS = 400
const DRAG_THRESHOLD = 3
const DOUBLE_TAP_MS = 300

interface UseCanvasDragOptions {
  elementRef: React.RefObject<HTMLDivElement>
  zoom: number
  isLocked: boolean
  enabled?: boolean
  onDragMove: (pos: { x: number; y: number }) => void
  onDragEnd?: (didDrag: boolean) => void
  onTap?: () => void
  onDoubleTap?: () => void
}

interface UseCanvasDragReturn {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

export function useCanvasDrag({
  elementRef,
  zoom,
  isLocked,
  enabled = true,
  onDragMove,
  onDragEnd,
  onTap,
  onDoubleTap,
}: UseCanvasDragOptions): UseCanvasDragReturn {
  const activePointerId = useRef<number | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const offset = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const didMove = useRef(false)
  const longPressFired = useRef(false)
  const longPressCancelled = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerDownStarted = useRef(false)
  const lastTapTime = useRef(0)
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLockedRef = useRef(isLocked)
  isLockedRef.current = isLocked

  const cancelLongPress = useCallback((markCancelled = true) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      if (markCancelled) longPressCancelled.current = true
    }
  }, [])

  const handleTapOrDoubleTap = useCallback(() => {
    if (!onTap && !onDoubleTap) return

    const now = Date.now()
    const timeSinceLastTap = now - lastTapTime.current

    if (onDoubleTap && timeSinceLastTap < DOUBLE_TAP_MS) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current)
        singleTapTimer.current = null
      }
      onDoubleTap()
    } else if (onTap) {
      if (onDoubleTap) {
        singleTapTimer.current = setTimeout(() => {
          singleTapTimer.current = null
          onTap()
        }, DOUBLE_TAP_MS)
      } else {
        onTap()
      }
    }
    lastTapTime.current = now
  }, [onTap, onDoubleTap])

  const activateDrag = useCallback((e: PointerEvent) => {
    longPressFired.current = true
    setLongPressActive(true)
    activePointerId.current = e.pointerId

    const onDocMove = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current) return
      if (isPinching()) return
      if (isLockedRef.current) return

      if (!isDragging.current) {
        const dx = Math.abs(ev.clientX - startPos.current.x)
        const dy = Math.abs(ev.clientY - startPos.current.y)
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          isDragging.current = true
        }
      }
      if (!isDragging.current) return

      const parentRect = elementRef.current?.parentElement?.getBoundingClientRect()
      if (!parentRect) return
      const newX = (ev.clientX - parentRect.left) / zoom - offset.current.x
      const newY = (ev.clientY - parentRect.top) / zoom - offset.current.y
      onDragMove({ x: newX, y: newY })
    }

    const onDocUp = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointerId.current) return
      document.removeEventListener('pointermove', onDocMove)
      document.removeEventListener('pointerup', onDocUp)
      activePointerId.current = null
      setLongPressActive(false)

      if (pinchThisGesture()) {
        isDragging.current = false
        return
      }

      if (!isDragging.current) {
        handleTapOrDoubleTap()
      } else {
        onDragEnd?.(true)
      }
      isDragging.current = false
    }

    document.addEventListener('pointermove', onDocMove)
    document.addEventListener('pointerup', onDocUp)
  }, [elementRef, zoom, onDragMove, onDragEnd, handleTapOrDoubleTap])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return
    didMove.current = false
    pointerDownStarted.current = true
    if (isLocked || isPinching()) return
    if (e.button !== 0 && e.button !== undefined) return
    setCardTouched()

    const rect = elementRef.current?.getBoundingClientRect()
    if (rect) {
      offset.current = {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      }
    }
    startPos.current = { x: e.clientX, y: e.clientY }

    if (e.pointerType === 'mouse') {
      activateDrag(e.nativeEvent)
    } else {
      longPressTimer.current = setTimeout(() => {
        activateDrag(e.nativeEvent)
      }, LONG_PRESS_MS)
    }
  }, [enabled, isLocked, elementRef, zoom, activateDrag])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabled) return
    if (!pointerDownStarted.current) return
    if (longPressFired.current) return
    if (isPinching()) {
      cancelLongPress()
      return
    }
    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      didMove.current = true
      if (e.pointerType === 'mouse') {
        activateDrag(e.nativeEvent)
      } else {
        cancelLongPress()
      }
    }
  }, [enabled, cancelLongPress, activateDrag])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!enabled) return
    pointerDownStarted.current = false
    if (!longPressFired.current) {
      cancelLongPress(false)
      if (!didMove.current && !longPressCancelled.current && !didPanOccur()) {
        handleTapOrDoubleTap()
      }
    }
  }, [enabled, cancelLongPress, handleTapOrDoubleTap])

  return { onPointerDown, onPointerMove, onPointerUp }
}
