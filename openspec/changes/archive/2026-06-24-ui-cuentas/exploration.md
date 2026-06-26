## Exploration: ui-cuentas

### Current State
- **Backend & State Manager:** `useAccountStore` en `apps/web/src/store/accountStore.ts` ya existe, administrando los datos de las cuentas (IAccount).
- **Enrutamiento:** `App.tsx` en `apps/web/src/App.tsx` utiliza `react-router-dom` pero solo tiene una ruta inicial `/`.
- **Estilos:** Tailwind CSS y Vite están configurados.
- **Reglas UI:** Se exige Mobile-First Estricto, High Contrast (Dark Mode) y Touch-Friendly (botones grandes `h-12`/`p-4`, sin `hover:`, usando `active:`), dictados por la skill `mobile-first-ui`.

### Affected Areas
- `apps/web/src/App.tsx` — Para actualizar el enrutamiento y agregar nuevas rutas.
- `apps/web/src/store/accountUIStore.ts` (Nuevo) — Para separar el estado de la presentación visual.
- `apps/web/src/pages/AccountsPage.tsx` (Nuevo) — Contenedor principal de la vista de cuentas.
- `apps/web/src/pages/AccountDetailPage.tsx` (Nuevo) — Vista individual de cuenta.
- `apps/web/src/components/Accounts/*` (Nuevos) — Componentes de presentación (Canvas, List, Card).
- `apps/web/src/components/Shifts/ShiftControls.tsx` (Nuevo) — Controles para turnos.

### Approaches

1. **Estado Unificado en useAccountStore vs Estado UI Separado**
   - **Opción A (Unificado):** Agregar estado visual (x,y y viewMode) al `useAccountStore` existente usando middleware `persist`.
     - *Pros:* Un solo lugar de consulta.
     - *Cons:* Mezcla datos de negocio que provienen de WebSockets/API con estado puramente visual de cliente. Peligro de sobrescritura de estado.
     - *Effort:* Low.
   - **Opción B (Separado):** Crear `useAccountUIStore` en Zustand exclusivo para `viewMode` ('list' | 'canvas') y coordenadas `positions: Record<string, {x,y}>`, utilizando el middleware `persist` (localStorage).
     - *Pros:* Desacoplamiento total. Los sockets actualizan `useAccountStore` y el drag-and-drop actualiza `useAccountUIStore`.
     - *Cons:* Dos hooks que invocar en los componentes.
     - *Effort:* Low.

2. **Interacción del Canvas Táctil (Drag & Drop)**
   - **Opción A:** Usar HTML5 nativo o librerías de escritorio (dnd-kit).
     - *Pros:* Ecosistema rico.
     - *Cons:* HTML5 DnD es terrible en móviles y pantallas táctiles.
     - *Effort:* Medium.
   - **Opción B:** Usar un sistema simple de manejo táctil (`onTouchStart`, `onTouchMove`, `onTouchEnd`) directamente en React, con posición absoluta calculada y guardada en Zustand.
     - *Pros:* Máximo control, perfecto para dispositivos móviles/tablets con alto rendimiento sin dependencias extra pesadas.
     - *Cons:* Requiere cálculo manual de offsets.
     - *Effort:* Medium.

### Recommendation
**Recomiendo las Opciones B para ambos casos.**
Crear un store separado `useAccountUIStore` manejado con Zustand `persist` para las coordenadas y el modo de vista (Canvas/Lista). Esto mantendrá `accountStore` limpio y sincronizado con el backend, dejando la parte visual persistida 100% del lado del cliente.
Para el Canvas, implementar manejadores táctiles (`onTouch*`/`onPointer*`) directos en React usando clases utilitarias de Tailwind como `absolute` y estilos en línea (`top`, `left`) leídos desde `useAccountUIStore`. React Router v6 será expandido para crear la jerarquía de `/accounts` y `/accounts/:id` para la navegación táctil rápida.

### Risks
- El estado Canvas puede desincronizarse (ej: cuentas cerradas cuyas coordenadas queden huérfanas en el `localStorage`). Hay que prever un garbage collector o limpieza de posiciones huérfanas al cargar cuentas nuevas.
- Eventos táctiles (touch) vs Mouse: Asegurar que el soporte sea híbrido (Pointer Events) para permitir el uso tanto de ratón en escritorio como dedos en tablet.
- Clutter en el Canvas: Dispositivos de menor tamaño pueden sobreponer demasiados elementos si las coordenadas guardadas exceden el ancho/alto (viewport mapping es necesario o usar scroll/overflow hidden).

### Ready for Proposal
Yes. El orquestador puede informar al usuario que la fase sdd-explore está completada y proceder con sdd-propose y sdd-spec.