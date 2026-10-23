# Auditoría de cifras del Dashboard

El período inicial es el mes calendario argentino hasta hoy. Hoy, 7 días, Este mes, Mes anterior y la selección manual aplican límites inclusivos en America/Argentina/Buenos_Aires. Total representa ausencia de rango: `/api/reports/overview?rangeKey=all_time`, sin `startDate`/`endDate` (ni `from`/`to`).

| Tarjeta, número o lista | Alcance decidido | Fuente y reglas |
| --- | --- | --- |
| Ventas | Período seleccionado; todo el historial en Total | `overview.summary.revenue`: ventas COMPLETADA, sin `voidedAt`, por `soldAt`. El título existente cambia entre Ventas del mes, Ventas del período y Ventas totales. |
| Margen bruto e índice de margen | Mismo período que ventas | `overview.summary.grossProfit` y `marginRate`, desde las mismas ventas completadas y sus costos. |
| Equipos vendidos | Período seleccionado | `overview.summary.unitsSold`. Sin permiso financiero: ventas de AppContext completadas, sin anulación, con el mismo filtro de días argentinos. |
| Comparaciones de ventas, margen, unidades y tendencia | Ventana previa contigua de igual duración | Sólo si `comparison.available` y hay una base válida. Sin período previo, en Total o con denominador menor que una unidad se omite el badge completo. |
| Tendencia | Período seleccionado | `overview.salesSeries`. Día hasta 12 días, semana hasta 84, mes en rangos largos. Total recibe meses argentinos, incluyendo meses vacíos entre primera y última venta; históricos extensos se condensan en hasta doce grupos de meses sin perder importes. |
| Medios de pago: importes y participaciones | Período seleccionado | `overview.paymentMethods`: mismas ventas completadas que los KPI. Barras, distribución móvil, porcentajes e importes provienen de la misma respuesta. |
| Ventas recientes | Período seleccionado | Hasta cinco ventas de AppContext en desktop y cuatro en celular, en orden descendente por fecha y número. Conserva el layout de #512 con avatar, cliente, equipo, estado e importe. Incluye pendientes y anuladas; esas filas no inflan KPI financieros. |
| Stock disponible, denominador y barra | Estado actual, independiente del período | Inventario disponible actual sobre total de inventario activo. Un rango de ventas no representa una reconstrucción histórica de existencias. Sin badge de variación. |
| Canjes en curso | Todos los canjes actualmente abiertos, independiente del período | AppContext: PENDIENTE, PERITAJE TÉC. y EN REVISIÓN, excluyendo anulados. La fecha de creación no elimina trabajo que sigue abierto. Sin badge de variación. |
| Saldos a cobrar | Toda la deuda neta actualmente pendiente, independiente del período | Suma de `max(pendingBalance - creditBalance, 0)` por cliente, usando la proyección monetaria compartida. Incluye deuda anterior: elegir un rango de ventas no debe esconder cobros pendientes. Sin badge de variación. |
| Notificaciones y equipo | Estado actual | Permisos y sesión confirmados; no son métricas del período comercial. Avatares con espacio reservado. |
| Primeros pasos | Progreso actual de la cuenta | Se espera la resolución inicial antes de decidir la pantalla. Una consulta fallida se considera resuelta y conserva el comportamiento discreto existente. |

Sólo se presentan métricas de listas con permiso de lectura. Sin inventario no se muestra Stock; sin ventas ni permiso financiero no se muestra Equipos vendidos. Así una lista no autorizada no aparece como cero.

Stock, canjes y saldos permanecen visibles y sin atenuación al cambiar el rango, incluso mientras llega el nuevo overview. No se agregan etiquetas, subtítulos ni explicaciones al producto. Las métricas comerciales y las ventas recientes esperan juntas la respuesta del nuevo período.

## Primer pintado

Se espera la confirmación real de `/api/me`, permisos, estado inicial de Primeros pasos, las cuatro listas de red y overview cuando corresponde. `listsLoaded` sigue permitiendo caché en otras pantallas; `listsSettled` identifica la finalización de las consultas del Dashboard por usuario, tienda y permisos. Ninguna cifra de negocio se presenta mientras falta una dependencia inicial. Skeleton existente, grilla y alturas reservadas, sin texto Cargando….

Las respuestas tardías de otro rango, tienda, usuario, permisos o listas invalidadas se descartan. Si overview falla, se muestra el vacío discreto existente. Si falla una lista inicial, se muestran valores ausentes y un mensaje neutro en ventas, sin presentar ceros o caché como resultados confirmados.

## Pruebas que fijan las decisiones

- `DashboardScreen.test.tsx`: coordinación de sesión/permisos/progreso/listas/overview; caché pendiente; Total; cada KPI, tendencia, medios y ventas recientes por rango; stock/canjes/saldos constantes incluso durante la consulta siguiente; error de listas; empleado sin finanzas; filas pendientes/anuladas; límites inclusivos argentinos; apertura y menú.
- `dashboard-period.test.ts`: días, semanas, meses, vacíos, Total y conservación de importes al condensar históricos.
- `dashboard-date-range.test.tsx`: borrador/Aplicar, Total, volver a un rango, móvil, Escape, foco y futuro deshabilitado.
- `reports-api.test.ts`: consulta acotada y Total sin fechas.
- Backend `reports.service.test.ts` / `reports.routes.test.ts`: Total sin condición temporal, meses argentinos, meses vacíos, métricas coherentes y ausencia de consulta/comparación anterior; contrato de ruta y normalización de límites antiguos.
- `store-records.test.tsx` y `getting-started-state.test.tsx`: distinguir caché de red y resolución de progreso incluso con error.
- Tests existentes de boot, shell y cargas actualizados para esperar el primer pintado completo. Fixture de novedades de ventas usa día argentino, evitando depender de si UTC ya cambió de fecha.

## Validación final

- `npm run lint`: aprobado (typecheck/lint frontend).
- `npm --prefix backend run lint`: aprobado (typecheck/lint backend).
- `npx vitest run`: **196 archivos, 1.585 pruebas aprobadas**.
- `npm --prefix backend run test:unit`: **81 archivos, 572 pruebas aprobadas**.
- `git diff --check`: aprobado.
- Comparación con HEAD/origin/main (#512): `ui.tsx`, `desk.css` y los cuatro archivos E2E restaurados íntegramente; markup de filas de ventas, KPI y colores de pagos coincidentes. Sin ejecutar E2E.

 Se conservan las superficies, estilos y filas de ventas de #512; las únicas reservas adicionales son las necesarias para Skeleton y estabilidad de carga. El selector admite los cinco chips completos y wrap en pantallas angostas.
