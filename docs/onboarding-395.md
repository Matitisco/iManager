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

## Investigación E2E del PR #413

- Avisos de sección y Caja desktop: reproducida la ambigüedad de «Registrar venta». `go()` cambia el hash y React actualiza la pantalla cuando llega `hashchange`; el Dashboard todavía puede tener sus dos botones al terminar el clic. La navegación y el montaje condicional son iguales en `main`. Los tests esperan `sales-screen` y buscan la acción dentro de esa pantalla, también en mobile. El recorrido final Ventas → Inventario espera ambas visitas para conservar la intención de limpiar novedades.
- Catálogo desktop: la corrida aislada de seis casos reprodujo exactamente la expectativa fallida de la antigua línea 100. La traza registró HTTP 429 al consultar el enlace revocado: previews, StrictMode, consultas anónimas y repeticiones comparten la misma IP local y consumen el límite de 60/minuto. El servidor exclusivo de E2E recibe un límite de 1000; producción y las integraciones mantienen 60, incluida la prueba que verifica el 429. El test exige ahora HTTP 404 y el mensaje visible para el link anterior, sin reintentos que oculten errores.
- Caja iPhone: la antigua línea 170 llama a `POST /api/operations/sales`. El 500 no se reprodujo en la corrida inicial. Los fixtures usan `POST /api/stores`, no el alta de onboarding; las modificaciones de #395 a etapa y progreso no participan en esa escritura. PostgreSQL mostró conflictos de serialización recuperados por los reintentos existentes, pero no hay una excepción de CI que permita atribuirles ese 500. Los fixtures de Caja ahora usan cotización explícita, sin consultar un proveedor remoto dentro de la transacción. El servidor E2E registra ruta, clase y código de error, sin credenciales, headers ni payloads; la aserción del POST incluye endpoint y status y sigue fallando ante cualquier error.
- La corrida inicial completa tuvo 146 aprobados y cuatro fallos: las dos ambigüedades reproducidas y dos timeouts de navegador. Los helpers esperan DOM y luego la UI/API necesaria, sin depender del evento `load` de recursos externos. Ninguna corrección requiere cambiar onboarding, muestras o Prisma.
- Verificación adicional: 904 tests frontend, TypeScript frontend/backend y siete integraciones de catálogo aprobados. El reproducer aislado del catálogo pasó de 4/6 a 6/6 con dos workers y tres repeticiones.
- Validación final: los 150 E2E solicitados pasaron con `--workers=2 --repeat-each=3`, sin retries (5,5 minutos), más seis repeticiones aisladas del catálogo y seis de avisos. Los `.flow.ts` de Caja se incluyen mediante los imports de `cash-operations.spec.ts` y `cash-operations-iphone.spec.ts`. Logs locales en `.qa395/regression-after.log`, `.qa395/catalog-verify.log` y `.qa395/notices-verify.log`; traza del 429 original en `.qa395/catalog-429-desktop.zip`.
- Los diagnósticos nuevos también hacen visible una carrera preexistente de inicialización (`GET /api/catalogs`, P2002); no es el POST investigado ni un cambio de #395. No se modificó ese servicio. El origen exacto del 500 de ventas de CI sigue sin confirmarse.
