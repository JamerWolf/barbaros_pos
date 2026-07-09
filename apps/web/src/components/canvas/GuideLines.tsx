import { useAccountUIStore } from '../../store/accountUIStore.js'

/**
 * Renders snap alignment guide lines on the canvas.
 * Lines are in canvas coordinates, transformed by the canvas zoom/pan.
 */
export function GuideLines(): JSX.Element | null {
  const activeGuides = useAccountUIStore((s) => s.activeGuides)
  const zoom = useAccountUIStore((s) => s.zoom)
  const panOffset = useAccountUIStore((s) => s.panOffset)

  if (activeGuides.length === 0) return null

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 25 }}>
      {activeGuides.map((guide, i) => {
        if (guide.type === 'vertical' && guide.x != null) {
          // Vertical line at canvas x position
          const screenX = (guide.x + panOffset.x) * zoom
          return (
            <line
              key={`v-${i}`}
              x1={screenX}
              y1={0}
              x2={screenX}
              y2="100%"
              stroke="#C8A84E"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.8}
            />
          )
        }
        if (guide.type === 'horizontal' && guide.y != null) {
          // Horizontal line at canvas y position
          const screenY = (guide.y + panOffset.y) * zoom
          return (
            <line
              key={`h-${i}`}
              x1={0}
              y1={screenY}
              x2="100%"
              y2={screenY}
              stroke="#C8A84E"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.8}
            />
          )
        }
        return null
      })}
    </svg>
  )
}
