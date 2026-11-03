## Backend
- [x] Exponer `membership.id` en la respuesta de sesión y cubrir la tienda elegida con Vitest.

## Frontend
- [x] Tipar el ID y preseleccionarlo una vez en ventas nuevas, sin tocar AppContext.
- [x] Cubrir desktop/mobile, carga tardía, elecciones manuales, sin match y edición.

## Validación y entrega
- [x] Ejecutar lint frontend/backend y tests relacionados con máximo dos workers; sin build ni DB.

Evidencia: 93 tests frontend relacionados y 2 de sesión backend aprobados. Antes del fix fallaron 8 casos de preselección desktop/mobile y la aserción del ID de miembro en la sesión. Ambos lints aprobados. Entrega mediante PR contra `test`, con Closes #749 y merge squash condicionado a CI verde.
