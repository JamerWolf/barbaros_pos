---
name: mobile-first-ui
description: Reglas de diseño y desarrollo Frontend. Trigger: implementación de UI, componentes React, Tailwind, pantallas, frontend.
---

# Skill: Mobile-First UI (Bárbaro's POS)

## Propósito
Esta skill define las reglas estrictas para escribir código Frontend (React + Tailwind) en el proyecto. El sistema se usará en un entorno de discoteca: poca luz, ritmo rápido, y pantallas táctiles (tablets y celulares).

## Reglas Obligatorias (Hard Rules)

1. **Mobile-First Estricto**:
   - Las clases base de Tailwind SIEMPRE deben ser para la vista móvil.
   - Usa los prefijos `md:` y `lg:` SOLO para adaptar la vista a tablets o pantallas de administrador.
   - Prohibido empezar diseñando para escritorio.

2. **Touch-Friendly (Dedos, no mouse)**:
   - Los botones y áreas clickeables deben ser GRANDES. Tamaño mínimo: `h-12` o `p-4`.
   - Prohibido depender del `hover:` para interacciones críticas (los dispositivos táctiles no tienen hover).
   - Usa `active:` para dar feedback visual cuando el usuario toca un botón.

3. **High Contrast & Dark Mode**:
   - El entorno es oscuro. Usa fondos oscuros (`bg-gray-900`, `bg-slate-900`) y textos claros de alto contraste (`text-white`, `text-gray-100`).
   - Usa colores semánticos brillantes para acciones rápidas: `bg-green-600` (Abrir/Éxito), `bg-red-600` (Cerrar/Peligro), `bg-blue-600` (Pagos).

4. **Flujo Rápido (Cero fricción)**:
   - Minimiza los popups de confirmación excepto para acciones destructivas (ej. eliminar pago, cerrar cuenta en $0).
   - Eliminar un item de la cuenta debe ser a 1 toque, sin confirmación.

5. **Componentización**:
   - Usa componentes funcionales de React simples y reutilizables.
   - Separa la lógica (hooks/Zustand) de la presentación (UI).

## Output Contract
Al implementar UI, el código generado debe compilar sin errores, usar Tailwind de forma mobile-first, y estar listo para renderizarse correctamente en un dispositivo móvil.
