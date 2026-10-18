# Onboarding #395

Implementa el alcance aprobado sobre #386: Nombre → Stock, sin pantalla de equipo. Excel es la primera opción; pegado, carga manual, `.txt` y ejemplos conservan sus flujos existentes. La fila Moneda y dólar muestra la cotización real y despliega los controles existentes.

Primeros pasos conserva la píldora y el panel actuales. El nombre guardado aporta 1/5; únicamente stock real aporta el segundo paso. Omitir o cargar muestras conserva 1/5. Las etapas anteriores `invite`/`video` reanudan Stock; las tiendas con onboarding completado conservan el ingreso normal.

El espaciado sigue la grilla 4/8 y solo cambia onboarding, Dashboard y la píldora/panel: 16 px mobile / 32 desktop, tarjetas 16/20, gaps 8/16, secciones 24 y contenido desktop de hasta 1120 px. No cambia el diseño de Dashboard de #386.

Sin cambios de Prisma, facturación o suscripciones. Sin commit ni push. Todas las escrituras y las pruebas usan exclusivamente `127.0.0.1:5432/imanager_test`.

## Capturas

Las capturas `docs/pr-shots/395-antes-*.png` se tomaron antes de modificar código, incluidas Nombre, Equipo, Stock, Dashboard, panel y progreso. Las nueve capturas finales `395-*.png` se regeneran durante los E2E con `ISSUE_395_SHOTS=docs/pr-shots`. Desktop: 1440×900; mobile: 390×844 (WebKit/iPhone para las finales).

## Validación

- `npx vitest run`: 127 archivos, 876 tests aprobados. Las cuatro pruebas que usan Chromium requirieron indicar la ruta de los navegadores al usar una caché temporal; la corrida final no tiene fallos ni omisiones.
- `npx tsc --noEmit` y lint TypeScript backend: aprobados.
- Backend: 449 unitarios y 270 integraciones aprobados. La integración incluye muestras excluidas del progreso y compatibilidad con etapas `invite`/`video`.
- Playwright: pendiente registrar la corrida final a 390×844 y las regresiones de los flujos actualizados.
- Puertos frontend/API: 4395/3395. No se ejecutó build.
- El entorno no traía PostgreSQL ni las librerías de WebKit. Se prepararon una instancia y dependencias locales temporales dentro del worktree. WebKit requiere en este entorno la ruta local de librerías y el manifiesto EGL de Mesa; no se cambió la configuración del repo para adaptarla al entorno.
