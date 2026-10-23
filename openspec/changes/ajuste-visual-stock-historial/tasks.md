# Tareas

- [x] Reestilizar pantalla y modal de Control de stock.
- [x] Reestilizar pantalla y modal de Historial.
- [x] Actualizar pruebas de componentes y selectores existentes.
- [x] Verificar typecheck y Vitest relevantes; registrar resultado y commit local.

## Ajuste de Antes vacío en Historial

- [x] Agregar regresiones de componentes para valores anteriores vacíos, filas mixtas y cierre de control en escritorio/móvil.
- [x] Omitir Antes y flecha por campo sin valor anterior, conservando el estilo y los valores reales.
- [x] Correr typecheck frontend/backend y Vitest relevantes; registrar resultado y commit en español en la rama actual, sin push.

Validación del ajuste: `npm run lint`, `npm --prefix backend run lint` y 55 pruebas de `HistoryScreen.test.tsx`, `history-copy.test.ts` y `RecordHistoryButton.test.tsx` aprobados. Las regresiones nuevas fallaron antes de implementar el cambio. Sin selectores E2E afectados, build ni push.
