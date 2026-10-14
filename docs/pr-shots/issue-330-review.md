# Issue #330 — pantallas de comisiones

Implementación de partes 2 y 3 sobre `feat/330-comisiones-backend`, con las pantallas nuevas de `src/desk`. Las 24 referencias `m-comisiones-*` y `comisiones-*` (01–11 y 03b) se abrieron y revisaron. Las capturas usan datos ficticios: iPhone 13 a 393×852 y desktop a 1440×900. Pixel 5 tiene el mismo recorrido funcional.

## Capturas

| Estado | iPhone | Desktop |
| --- | --- | --- |
| 01 Navegación | [Más](issue-330-mobile-01-entrada-mas.png) | [Sidebar](issue-330-desktop-01-entrada-sidebar.png) |
| 02 Equipo | [Móvil](issue-330-mobile-02-dueno.png) | [Desktop](issue-330-desktop-02-dueno.png) |
| 03 Detalle | [Móvil](issue-330-mobile-03-detalle-vendedor.png) | [Desktop](issue-330-desktop-03-detalle-vendedor.png) |
| 03b Ajuste por venta anulada | [Móvil](issue-330-mobile-03b-ajuste-anulada.png) | [Desktop](issue-330-desktop-03b-ajuste-anulada.png) |
| 04 Regla | [Personal fija USD](issue-330-mobile-04-regla.png) | [Equipo sobre ganancia](issue-330-desktop-04-regla.png) |
| 05 Pago | [USD que salda ARS](issue-330-mobile-05-registrar-pago.png) | [ARS que salda USD](issue-330-desktop-05-registrar-pago.png) |
| 06 Vendedor opcional | [Móvil](issue-330-mobile-06-venta-vendedor.png) | [Desktop](issue-330-desktop-06-venta-vendedor.png) |
| 07 Selección masiva | [Móvil](issue-330-mobile-07-asignar-vendedor-barra.png) | [Desktop](issue-330-desktop-07-asignar-vendedor-barra.png) |
| 08 Asignación | [Móvil](issue-330-mobile-08-asignar-vendedor-hoja.png) | [Desktop](issue-330-desktop-08-asignar-vendedor-hoja.png) |
| 09 Vista propia | [Móvil](issue-330-mobile-09-mis-comisiones.png) | [Desktop](issue-330-desktop-09-mis-comisiones.png) |
| 10 Reportes | [Móvil](issue-330-mobile-10-reportes.png) | [Desktop](issue-330-desktop-10-reportes.png) |
| 11 Permisos | [Móvil](issue-330-mobile-11-permisos.png) | [Desktop](issue-330-desktop-11-permisos.png) |

## Comparación y diferencias deliberadas

- El vendedor empieza en «Sin vendedor», según el issue y la instrucción de implementación; los PNG todavía mostraban un vendedor elegido automáticamente.
- Reportes usa los agregados mensuales de `/api/reports/commissions`. La evolución dice «Por mes» y el indicador dice «Liquidación mensual»: el contrato no entrega una serie diaria ni una comparación contra el período anterior. Los rangos incluyen los meses completos indicados, explicado en pantalla. No se generaron datos diarios ni porcentajes ficticios.
- El pago muestra la fecha real de registro, de solo lectura. El contrato no admite retrofechar; la forma de pago se conserva en `note`.
- La hoja de asignación explica el recálculo y las compensaciones sin presentar un importe estimado que el backend no confirma antes de guardar.
- Se conservaron el formulario y el shell existentes: título «Registrar venta», opciones de pago actuales, nombre de rol «Propietario», conversión de Ventas a la moneda de la tienda y navegación del empleado según sus permisos. Los totales de Comisiones y sus movimientos mantienen ARS/USD separados.
- Las cifras de Ventas y los saldos de Reportes reflejan los datos del recorrido de pruebas, incluido el alta y los pagos realizados. Las imágenes del sistema operativo no forman parte de la aplicación.

Durante la revisión se ajustaron el selector de mes en español, tarjetas y total de la tabla, colores y bordes de vendedores, separación de deudas y descuentos, tamaño de KPIs, acciones fijas y visibilidad del formulario. Las ventas anuladas aparecen tachadas; el ajuste y el saldo a descontar quedan identificados en rojo. No hay exportación fuera de Reportes.

## Validación

Las suites usan bases PostgreSQL locales aisladas y puertos propios. No se modifican datos de producción. La suite e2e completa se corrió con dos workers; frontend con dos workers para mantener el uso de memoria acotado. Las pruebas de integración usan la cotización de prueba ya definida por el repositorio. Las pruebas unitarias que dependen de un servicio externo permanecen omitidas en el entorno offline; PWA omite los casos que no corresponden a cada plataforma.

Resultados finales:

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | Correcto |
| `npm --prefix backend run lint` | Correcto |
| `npm run build` | Correcto |
| `npm test -- -- --maxWorkers=2` | 570 aprobados, 94 archivos |
| `npm --prefix backend run test:unit` (entorno offline) | 229 aprobados, 20 omitidos |
| `npm --prefix backend run test:integration` | 106 aprobados |
| `npm run test:e2e -- --workers=2` | 137 aprobados |
| `npm run test:pwa:e2e` | 48 aprobados, 36 omitidos por plataforma |
| Recorrido de comisiones, iPhone 13 / Pixel 5 / desktop | 3 aprobados; incluye vendedor opcional, edición, asignación masiva, pagos, ajustes, permisos y ausencia de exportación fuera de Reportes |

También se verificó el enlace de asignación para meses históricos. Se corrigieron carreras de los tests al volver del pago al detalle y al consultar el worker durante una recarga esperada; no se relajaron las comprobaciones de persistencia, permisos ni versión activa.
