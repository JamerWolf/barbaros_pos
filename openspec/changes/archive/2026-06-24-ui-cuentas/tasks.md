# Tasks: UI Cuentas

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Stores & Utils) -> PR 2 (Canvas & Components) -> PR 3 (Pages & Routes) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Zustand UI Store y Algoritmos Canvas | PR 1 | Base: feature/ui-cuentas. Incluye utils, store y tests. |
| 2 | Componentes Canvas (DnD, Panning, Nodos) | PR 2 | Base: branch PR 1. Panning interactivo y DragNode. |
| 3 | Páginas, Ruteo y Turnos (Dashboard, Detalles) | PR 3 | Base: branch PR 2. `AccountsDashboard`, `AccountDetail`, Router. |

## Phase 1: Foundation (Stores y Utilitarios)

- [x] 1.1 Crear `apps/web/src/utils/canvasUtils.ts` con algoritmo radial para `calculateFirstFreeSpace` y `recalculateBounds` para resize/rotación.
- [x] 1.2 Crear `apps/web/src/store/accountUIStore.ts` usando Zustand (con persist middleware). Estado: `nodePositions`, `panOffset`, `zoom`, funciones `updatePosition`, `assignInitialPosition`, `clearOrphanPositions`.

## Phase 2: Canvas y Componentes Core

- [x] 2.1 Crear `apps/web/src/components/canvas/CanvasContainer.tsx` implementando Panning libre y listeners de `ResizeObserver`/`window.resize` para re-calcular posiciones.
- [x] 2.2 Crear `apps/web/src/components/canvas/DragNode.tsx` manejando eventos nativos de React (`onPointerDown`, `onPointerMove`, `onPointerUp`) para drag and drop touch-friendly.
- [x] 2.3 Crear `apps/web/src/components/Accounts/AccountCard.tsx` aplicando Mobile-First: `w-32 h-32`, contraste alto (`bg-gray-900`), áreas interactivas sin `hover:` y con `active:`.

## Phase 3: Páginas y Ruteo

- [x] 3.1 Crear `apps/web/src/pages/DashboardPage.tsx` integrando el `CanvasContainer`, renderizando nodos por cada cuenta en `useAccountStore`.
- [x] 3.2 Crear `apps/web/src/pages/AccountDetailPage.tsx` mostrando el detalle de una cuenta (botones mínimos de `h-12`/`p-4`, diseño oscuro de alto contraste).
- [x] 3.3 Configurar React Router v6 en `apps/web/src/App.tsx` para renderizar `/` (`DashboardPage`) y `/accounts/:id` (`AccountDetailPage`).

## Phase 4: Integración (Limpieza y Turnos)

- [x] 4.1 Crear `apps/web/src/components/Admin/ShiftControls.tsx` para abrir/cerrar turnos y limpiar cuentas huérfanas al abrir turno.