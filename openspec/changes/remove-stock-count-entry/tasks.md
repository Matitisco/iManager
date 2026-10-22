## Frontend
- [x] Retirar el botón, estado, props, icono y CSS exclusivos del acceso antiguo.
- [x] Actualizar tests de componentes y selector E2E para usar la pestaña.

## Validación
- [x] Ejecutar typecheck frontend/backend y Vitest relevante sin build.
- [x] Registrar la validación y crear commit en español sin push.

Validación: `npm run lint`, `npm --prefix backend run lint` y `npm run test:frontend -- src/desk/screens/StockCountScreen.test.tsx src/desk/screens/InventoryScreen.test.tsx src/desk/DeskApp.test.tsx src/desk/nav.test.ts src/desk/hash-route.test.ts` aprobados (93 pruebas). Selector E2E actualizado; E2E no ejecutado.

## Backend
Sin cambios.
