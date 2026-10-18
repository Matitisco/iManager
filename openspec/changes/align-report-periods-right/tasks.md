- [x] Capturar BEFORE desktop 1280×800 y móvil 393×852 antes de editar código.
- [x] Agregar únicamente los márgenes automáticos de Reportes.
- [x] Agregar regresión e2e para alineación, salto de línea y scroll móvil.
- [x] Capturar AFTER con los mismos tamaños y navegadores.
- [x] Ejecutar lint frontend/backend, TypeScript, Vitest, build y e2e relevantes.

Validación: lint frontend/backend y `npx tsc --noEmit` aprobados; build aprobado; Vitest 800/800 (122 archivos); Playwright 11/11 sin retries. Una corrida intermedia de Vitest falló en la aserción de health probe del banner offline de `DeskApp.test.tsx`; la suite completa pasó antes y al repetirla, sin cambios a ese test. Capturas BEFORE/AFTER guardadas y revisadas en `docs/pr-shots/issue-392-*.png`.
