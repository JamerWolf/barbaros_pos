# Proposal: UI de Cuentas

## Intent
Implementar la interfaz gráfica de Gestión de Cuentas utilizando un diseño Mobile-First Estricto y un modo Canvas para disposición espacial de mesas/cuentas, conectándolo con el backend y estados de Zustand existentes.

## Scope

### In Scope
- Implementación de vistas con React Router v6.
- Interfaz gráfica Mobile-First (alto contraste, botones grandes, sin hovers).
- Dashboard en Modo Canvas con persistencia local (`useAccountUIStore` con `persist`).
- Lógica de coordenadas: auto-posicionamiento de cuentas nuevas y limpieza al iniciar turno.

### Out of Scope
- Modificaciones al backend o a la estructura de datos principal de las cuentas.
- Alteraciones en la lógica core de `useAccountStore`.

## Capabilities

### New Capabilities
- `accounts-dashboard-ui`: Vista principal con interacción de tipo canvas para visualización y organización espacial de cuentas activas.
- `account-detail-ui`: Vista de detalle para visualizar y operar sobre los ítems de una cuenta específica.
- `shift-controls-ui`: Controles vinculados a los turnos que incluyen el hook para la limpieza de coordenadas huérfanas en el canvas.

### Modified Capabilities
- Ninguna.

## Approach
Se construirán las páginas `AccountsDashboard` y `AccountDetail` conectadas mediante React Router v6. Para el comportamiento del Canvas, se implementará el store `useAccountUIStore` usando Zustand con el middleware `persist` para guardar en `localStorage` las posiciones `(x, y)` de cada cuenta. Se creará una función utilitaria de auto-posicionamiento que determine el primer espacio libre para una cuenta nueva o la ubique en el centro por defecto. Al dispararse el evento de "abrir turno", se ejecutará una limpieza de posiciones asociadas a IDs de cuenta inactivos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/stores/useAccountUIStore.ts` | New | Store UI de Zustand con middleware de persistencia |
| `src/pages/AccountsDashboard.tsx` | New | Dashboard visual (modo Canvas) |
| `src/pages/AccountDetail.tsx` | New | Vista de detalle de pedidos de la cuenta |
| `src/components/canvas/` | New | Componentes de nodos arrastrables |
| `src/routes/` | Modified | Registro de las nuevas rutas en React Router v6 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Colisión de posiciones en el canvas | Medium | Implementar búsqueda radial iterativa para asignar espacio libre; fallback al centro. |
| Inconsistencia de estado UI vs Datos | Medium | Limpiar metadatos UI de cuentas cerradas al iniciar nuevo turno. |

## Rollback Plan
Revertir los commits de UI asociados al feature branch `ui-cuentas`, eliminar las rutas en React Router y purgar la clave de persistencia del UI store de Zustand.

## Dependencies
- React Router v6
- Zustand (middleware persist)
- Componentes de Drag & Drop para React (si se requiere interactividad touch en el canvas)

## Success Criteria
- [ ] El canvas renderiza cuentas activas respetando posiciones persistidas entre recargas.
- [ ] Las cuentas nuevas se instancian en un espacio vacío disponible o en el centro de la pantalla.
- [ ] Al abrir un turno nuevo, las coordenadas huérfanas se eliminan exitosamente del store UI.
- [ ] La interfaz cumple rigurosamente las pautas Mobile-First (dimensiones touch, contraste).
