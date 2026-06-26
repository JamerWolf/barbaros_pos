# Design: UI de Cuentas

## Technical Approach

El cambio implementará la interfaz gráfica Mobile-First para la gestión de cuentas en el sistema POS. La estrategia principal será separar el estado UI (las posiciones visuales en la pantalla) del estado de negocio mediante un store dedicado persistido localmente (`useAccountUIStore`). La navegación utilizará React Router v6 con las rutas `/` (Dashboard Canvas) y `/accounts/:id` (Detalles de la cuenta). Todos los componentes aplicarán diseño Mobile-First estricto: áreas táctiles grandes (`h-12`/`p-4`), alto contraste para entorno oscuro (`bg-gray-900`) y feedback táctil directo (`active:`).

## Architecture Decisions

### Decision: Canvas State Management

**Choice**: Usar Zustand con `persist` para un `useAccountUIStore` separado.
**Alternatives considered**: Guardar coordenadas `x,y` en el `useAccountStore` principal junto a la cuenta, o en el backend.
**Rationale**: Las coordenadas visuales (Canvas) son un estado puramente local del dispositivo cliente (una tablet vs un móvil tienen distintas dimensiones y distribuciones). Separarlo evita polucionar la lógica de negocio y los envíos de web sockets con datos visuales intrascendentes.

### Decision: Drag and Touch Interaction

**Choice**: Utilizar eventos nativos `PointerEvent` integrados en componentes React simples (`components/canvas/DragNode.tsx`).
**Alternatives considered**: Usar una librería pesada como `react-beautiful-dnd` o `dnd-kit`.
**Rationale**: El entorno es touch en pantallas móviles. Los eventos pointer nativos proveen menos fricción y tamaño de bundle para un Canvas simple 2D que no requiere listas ordenables complejas, optimizando el rendimiento y simplificando el DOM.

### Decision: Auto-posicionamiento (Primer espacio libre)

**Choice**: Algoritmo de grilla radial / búsqueda en espiral.
**Alternatives considered**: Posicionamiento en cuadrícula estricta o random stack apilado.
**Rationale**: Al abrir una cuenta, si el usuario no la mueve, queremos evitar que las nuevas cuentas se encimen. Se definirá un tamaño de tarjeta (ej. `w-32 h-32`). El algoritmo buscará el primer múltiplo libre partiendo del centro `(x=0, y=0)` en anillos crecientes.

## Data Flow

    AccountsDashboard (Canvas UI)
         │  (Lee cuentas)     │  (Lee/Escribe coordenadas)
         ▼                    ▼
    useAccountStore    useAccountUIStore (localStorage)
         ▲                    │  (Calcula espacio libre)
         │                    ▼
    AccountDetail ◄─── AutoPosition Utility
    (Carga items por ID)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/stores/useAccountUIStore.ts` | Create | Store Zustand con `{ nodePositions: Record<string, {x, y}> }`, persistido en localStorage. Funciones `updatePosition`, `findFreeSpace`. |
| `src/routes/AppRouter.tsx` | Modify | Agregar `<Route path="/" element={<AccountsDashboard />} />` y `<Route path="/accounts/:id" element={<AccountDetail />} />`. |
| `src/pages/AccountsDashboard.tsx` | Create | Vista principal (Canvas). Fondo oscuro (`bg-gray-900`), renderiza iterando cuentas de `useAccountStore`. |
| `src/pages/AccountDetail.tsx` | Create | Vista de cuenta específica. Botones grandes (`h-12`, `p-4`), listado de ítems, barra de pago en parte inferior fija. |
| `src/components/canvas/DragNode.tsx` | Create | Wrapper para `AccountCard` que maneja `onPointerDown`, `onPointerMove`, `onPointerUp`. |
| `src/components/AccountCard.tsx` | Create | Tarjeta visual de la mesa/cuenta (`w-32 h-32`, bg color dinámico según estado). |
| `src/utils/canvasUtils.ts` | Create | Funciones puras: `calculateFirstFreeSpace(positions, width, height)` para algoritmo radial. |

## Interfaces / Contracts

```typescript
// src/stores/useAccountUIStore.ts
export interface Position {
  x: number;
  y: number;
}

export interface AccountUIState {
  nodePositions: Record<string, Position>;
  updatePosition: (accountId: string, pos: Position) => void;
  assignInitialPosition: (accountId: string) => void;
  clearOrphanPositions: (activeAccountIds: string[]) => void;
}
```

```typescript
// src/utils/canvasUtils.ts
export function calculateFirstFreeSpace(
  existingPositions: Record<string, Position>,
  nodeWidth: number,
  nodeHeight: number
): Position {
  // Implementación de búsqueda radial en espiral
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `calculateFirstFreeSpace` | Testear que retorne el espacio central si está vacío, y espacios adyacentes al simular colisiones. |
| Unit | `useAccountUIStore` | Validar que el persist se guarda correctamente y que `clearOrphanPositions` elimine IDs inactivos. |
| Integration | `AccountsDashboard` | Renderizar el dashboard con cuentas mockeadas y verificar que los `<AccountCard>` existan en el DOM. |

## Migration / Rollout

No migration required. El localStorage es nuevo y local a cada cliente. La limpieza de coordenadas huérfanas se integrará en el disparador de apertura/cierre de turnos de la app principal.

## Open Questions

- [ ] ¿Cual será el comportamiento deseado si el Canvas excede el viewport del dispositivo (Panning/Zoom vs Scroll estándar)?
- [ ] ¿Cómo reaccionamos al redimensionar la ventana/rotar dispositivo con posiciones absolutas ya asignadas? (Posiblemente limitarlo a un grid fluido en vista Portrait).