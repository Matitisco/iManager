# Issue #374 — Resumen periódico

Análisis → Reportes → Resumen periódico. Períodos calendario cerrados en la zona horaria de la tienda: última quincena, último mes y selector de los doce meses/veinticuatro quincenas anteriores. Tres tarjetas con tres filas de vista previa. Cada «Ver todas (n)» abre la lista completa en el modal Sheet compartido, centrado en escritorio y como hoja inferior en móvil, sin navegar a otra pantalla.

Diseño v3b: sin rango debajo de los chips, sin leyendas en tarjetas vacías y sin texto de anulación. Las anuladas conservan el importe tachado y la fecha. Los modales comparten cierre por botón, Escape y fondo, captura del foco y devolución al botón de origen.

`GET /api/reports/periodic-summary?period=latest-half` es de solo lectura. También acepta `latest-month`, `month:YYYY-MM` y `half:YYYY-MM-01|16`. Requiere membresía y Reportes; Ventas/Devoluciones requieren Ventas y los conteos respetan la autorización existente para consultar resultados cerrados. Nunca expone resultados de conteos a ciegas a empleados.

Las ventas CANCELADA/ANULADA o con cancelledAt/voidedAt conservan su fila de auditoría y no suman. Los reintegros/notas de crédito se ubican por el primer evento de resolución comercial, incluso con RMA pendiente. Los conteos usan su resultado histórico: equipos distintos por IMEI, con la última diferencia de cada equipo dentro del período. Las ventas legítimas durante el conteo no se consideran diferencias. Los importes conservan moneda de origen y se convierten con useMoney; sin cotización compatible, el total queda sin importe y aparece el aviso compartido.

No hay cambios de schema, migraciones ni modificaciones del scheduler SMTP. Las consultas muestran el estado actual de anulaciones/resoluciones; no constituyen un cierre contable inmutable.

## Verificación

Resultado v3b: typecheck/lint frontend y backend, 1.469 pruebas frontend, suite unitaria backend, 396 integraciones PostgreSQL y un único E2E aprobados. Para la integración se preparó una instancia PostgreSQL aislada dentro del workspace, accesible únicamente por localhost, usando el schema existente sin modificarlo.

```bash
npm run lint
npm --prefix backend run lint
npm run test:frontend -- --maxWorkers=2
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test npm --prefix backend run test:unit -- --maxWorkers=2
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test npm --prefix backend run test:integration
npx playwright test --config e2e/periodic-summary.config.ts
```

Las 16 pruebas de componente incluyen los tres modales con listas que superan la vista previa, cierre, foco, cambios de tienda/período y ausencia de navegación en móvil/escritorio. El único E2E usa HTTP sintético, recorre 390×844 y 1440×900, verifica ausencia de desbordes, filas anuladas, selector, los tres modales, vacío y reintento. Guarda capturas en `test-results/periodic-summary/` (ignorado). Las integraciones usan únicamente PostgreSQL local `imanager_test`; verifican tenant, permisos, límites inclusivos, febrero bisiesto, anulaciones, reintegros durante RMA y deduplicación de conteos. No se ejecutó build.

Wireframes regenerados antes de modificar el código: `/workspace/imanager-local/shots/374/wireframe.png` y `/workspace/imanager-local/shots/374/wireframe-modal.png`, cada uno con escritorio y móvil. Se conservaron las tarjetas v3b y el estilo de la aplicación existente. Herramienta y prompts exactos en [wireframe-prompts.md](wireframe-prompts.md).
