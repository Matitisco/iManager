# Control de stock #318

Implementación de la propuesta aprobada de `/workspace/redisenio-372-318/critica.md` y los cuatro PNG entregados. El resultado más reciente abre directamente; un conteo abierto se continúa. Los anteriores se consultan debajo del resultado.

- Inicio mínimo: Disponible, Conteo a ciegas, exclusiones sin IMEI e Iniciar conteo. Sheet compartido, centrado en escritorio y hoja inferior en móvil.
- Revisión: Coinciden, Sin escanear (`missing`), Sin cargar (`surplus`) y Figuran vendidos, con IMEI completo. Un cerrado sin resolución muestra Por revisar. Sin observaciones muestra Sin escaneos; no afirma pérdidas.
- Registrar conteo envía exclusivamente `RECORD` con selecciones vacías. Sin acciones de ajuste/archivo/carga en la pantalla, ni recarga/mutación de inventario. Los ADJUSTED históricos siguen siendo consultables.
- `isCountableStatus` acepta únicamente DISPONIBLE (incluidas sus variantes normalizadas); preview y snapshot excluyen reservados, revisión y archivados. Las exclusiones sin IMEI también corresponden solo a disponibles. Las fotos históricas se conservan.
- Lector, ingreso manual, cámara, permisos, esqueletos y errores visibles conservados. Padding inferior y reserva de scroll para la tab bar y safe area.

## Validación

- TypeScript: `npm run lint` y `npm --prefix backend run lint`.
- Suite completa frontend: `npm run test:frontend -- --maxWorkers=2`: 189 archivos y 1.479 pruebas aprobadas.
- Componentes: `npm run test:frontend -- src/desk/screens/StockCountScreen.test.tsx src/desk/screens/InventoryScreen.test.tsx --maxWorkers=2`: 46 pruebas aprobadas (21 de Stock y 25 de Inventario).
- Backend: suite completa unitaria, 553 pruebas aprobadas; tras agregar las tres variantes de estado fuera de alcance, módulo stock-counts: 7 pruebas aprobadas.
- Integración: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_318_test npm --prefix backend run test:integration -- src/test/stock-counts.integration.test.ts`: 2 pruebas aprobadas con PostgreSQL local aislado. Cubre preview, snapshot, exclusiones, conteo ciego, clasificación, permisos, aislamiento entre tiendas, RECORD sin mutación y compatibilidad de ajustes históricos.
- Revisión visual con Vite y Chromium: resultado a 1440×1000 y 390×1000, modal a 1440×1000 y 390×844, pie a 390×844. Fixtures sintéticos por intercepción HTTP; sin escrituras a servicios externos. Tras desplazar el resultado móvil, el aviso termina en y=529 y la tab bar comienza en y=774. No se agregaron ni ejecutaron E2E.
- Capturas externas al repositorio: `/workspace/imanager-318/implementacion/318-{pantalla,modal}-{1440,390}.png` y `318-pie-390.png`.

El inventario no almacena fotografías de equipos: las filas de escritorio reutilizan el ícono de equipo existente en lugar de las fotos ilustrativas de los PNG. Datos, contadores y moneda proceden de la API. El chrome compartido mantiene su fuente de datos real y sus componentes.

Sin cambios de Prisma ni build local. Commit en la rama actual, sin push.
