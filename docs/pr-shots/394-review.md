# Panel interno #394 — revisión visual

Implementación en `src/pages/StoreActivity.tsx` y `store-activity.css`, con servicios en `src/services/admin-activity-api.ts`, helpers de presentación en `src/lib/admin-panel.ts` y rutas en `src/lib/store-activity.ts`. Backend: cohorte aditiva `7d` en admin y etapa `complete` cuando existe `onboardingCompletedAt`. Sin cambios de schema.

Las siete capturas se tomaron con Chromium contra Vite local, con sesión de administrador y respuestas interceptadas. No se inicia una API ni se escribe en una base para las capturas. Desktop: 1440×900 y 1024×900, escala 1. Teléfono: 390×844, escala 2. Todas son de página completa.

```bash
ISSUE_394_SHOTS=1 npx playwright test --config e2e/admin-panel-shots.config.ts
```

`PLAYWRIGHT_APP_BASE_URL` permite cambiar el puerto de Vite. El fixture vive en `e2e/fixtures/admin-panel.ts`. Las llamadas de la API local de capturas, incluido `/api/me/admin`, se interceptan; la página conserva el gate real y exige el token de la sesión de pruebas.

Capturas revisadas lado a lado con sus PNG aprobados:

- [Embudo 1440](394-embudo-1440.png)
- [Embudo 1024](394-embudo-1024.png)
- [Embudo 390](394-m-embudo.png)
- [Tiendas 1440](394-tiendas-1440.png)
- [Tiendas 390](394-m-tiendas.png)
- [Timeline 1440](394-timeline-1440.png)
- [Timeline 390](394-m-timeline.png)

Se revisaron tamaños de tarjetas, columnas, barras, espacios, textos, tipografía, iconos y colores. Los selectores nuevos quedan bajo `.store-activity`; no se modifican `desk.css` ni los chips `wchip` existentes.

Diferencias respecto de la maqueta:

- Los ajustes aprobados se aplican: un único abandono máximo, ninguna acción en el embudo, sin columnas de facturación y chip de timeline basado en `stuckAt` (en el ejemplo, «Al día»).
- El fixture contiene 12 tiendas en desktop y 6 en teléfono, más 3 de prueba ocultas. La nota cuenta las filas reales recibidas, en lugar del «22» fijo del HTML. El orden respeta Por alta: Rosario aparece antes de Palermo.
- El timeline incluye el hito derivado de stock y un ingreso adicional del primer día. La API guarda cantidades de importación por rangos, de modo que se muestra «entre 11 y 50 equipos» en lugar del «23» inventado de la maqueta. Estos datos agregan altura al timeline.
- El HTML aprobado coloca el `@import` de fuentes después del reset, por lo que el navegador lo ignora y usa la fuente del sistema. El script bloquea la descarga externa para reproducir esa referencia de forma estable. La app conserva DM Sans y sus reglas existentes; con las fuentes descargadas puede variar levemente el ancho de texto y sus saltos de línea.
- El fondo de la página móvil continúa durante todo el scroll; se elimina el límite de altura del shell únicamente para esta página.

Validación final:

- `npm run lint` y `npm --prefix backend run lint`: pasan.
- `npx tsc --noEmit` y `npx tsc --noEmit -p backend/tsconfig.json`: pasan.
- `npm run test:frontend`: 936 tests pasan (130 archivos).
- `npm --prefix backend run test:unit`: 457 tests pasan (64 archivos).
- Integración contra la base local `imanager_test`: 283 tests cubiertos y pasando. La suite normal pasó completa una vez; dos repeticiones tuvieron timeouts intermitentes en `beforeEach/resetDatabase` de tests ajenos al panel. Se verificó de nuevo toda la cobertura en dos ejecuciones secuenciales, sin cambiar código de pruebas ajeno:
  - `ANALYTICS_DISABLED=1 npm --prefix backend run test:integration -- --exclude src/modules/analytics/analytics.integration.test.ts`: 271 pasan.
  - `ANALYTICS_DISABLED=0 npm --prefix backend run test:integration -- src/modules/analytics/analytics.integration.test.ts`: 12 pasan, con recolección habilitada.
- `npm run build`: pasa (advertencia de Vite por tamaño de bundle).
- Playwright: 3 escenarios pasan; generan las 7 capturas, prueban tabs/historial/timeline y verifican las 3 rutas con capacidad denegada sin consultas de datos admin.
- `git diff --check`: pasa.

Cambios dejados en el worktree, sin commits, pushes, ramas ni PRs nuevos.
