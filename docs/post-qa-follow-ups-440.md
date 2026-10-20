# Seguimiento post-QA — issue #440

## Navegación

- Proveedores pasa a Finanzas, después de Gastos. Compras y obligaciones con proveedores quedan junto a la gestión financiera.
- Conserva el permiso de Inventario. Un Empleado con ese permiso puede abrir Proveedores dentro de Finanzas sin recibir acceso a Cajas ni Gastos.
- El hash canónico es `#/finanzas/proveedores`; `#/proveedores`, `#/suppliers` y `#/stock/proveedores` siguen funcionando, con sus parámetros de consulta.
- La barra mobile muestra todos los nombres debajo de los íconos. Distribuye el ancho entre las secciones habilitadas, conserva el indicador activo y respeta movimiento reducido. Verificada sin overflow a 320, 360 y 390px y con botones de al menos 44×44px.

## Concurrencia: evidencia y corrección

El [CI 39449949293](https://github.com/Matitisco/iManager/actions/runs/39449949293) registra `P2034` en **POST /api/operations/:source**. El test fallido es `delete-cancelled-sales` y esperaba 201 al crear una venta. El error ocurrió en la preparación, antes de la anulación. La creación ya tenía cinco reintentos de transacciones Serializable en el `main` actualizado.

Las nuevas pruebas usan PostgreSQL 18 local, `127.0.0.1:55440/imanager_440_test`. Seis creaciones simultáneas en tiendas independientes aprobaron con una venta, número 1, stock y saldos correctos por tienda. Ese caso no reprodujo el P2034 histórico; no se atribuye una causa exacta a aquel interleaving de CI.

Sí se reprodujo otro error real de concurrencia: dos anulaciones simultáneas de una venta cobrada intentaban insertar la misma reversa de caja. PostgreSQL devolvía P2002 sobre `CashMovement.reversalOf`; una solicitud terminaba en 500 aunque la otra completaba la anulación.

La anulación ahora toma `SELECT ... FOR UPDATE` sobre la venta o el canje, filtrando por tienda, antes de leer el estado y crear reversas. La segunda transacción espera o reintenta el conflicto Serializable y reconoce la cancelación ya realizada. No se amplió el retry a todos los P2002, porque una duplicación de IMEI sigue siendo un error de negocio.

Además, agotar los cinco reintentos devuelve HTTP 409 con `La operación coincidió con otro cambio. Volvé a intentarlo.`. El intento fallido se revierte y la respuesta no revela SQL ni datos de conexión.

Regresiones nuevas:

- Seis ventas concurrentes en tiendas independientes, con comprobantes y saldos aislados.
- Dos anulaciones simultáneas de una venta cobrada: ambas responden 200, una devolución, dos movimientos de caja (+900/−900) y un solo conjunto de notificaciones.
- El mismo caso con canje: una sola reversa por la diferencia cobrada (+700/−700).
- Anulaciones de dos ventas pendientes del mismo cliente: ambas restauran stock y revierten íntegramente deuda y total gastado.
- Conflictos ORM y SQL reintentables, límite de intentos, errores no reintentables y respuesta HTTP segura.

## Escáner: validación física pendiente

Las imágenes y la cámara simulada verifican el flujo del software. No certifican enfoque, permisos reales, óptica, iluminación ni periféricos.

| Prueba | Procedimiento y criterio | Resultado físico |
|---|---|---|
| Samsung / Chrome | Leer Code128 del IMEI en una caja real; comprobar 15 dígitos y que EAN-13 no reemplace al IMEI | Pendiente |
| iPhone / Safari | Permitir, rechazar y volver a permitir cámara; cerrar y reabrir el visor | Pendiente |
| iPhone / PWA instalada | Repetir permisos y reapertura desde la app instalada | Pendiente |
| Cámara trasera | Comprobar cámara principal, enfoque cercano y linterna cuando el dispositivo la admite | Pendiente |
| Lector USB / Bluetooth | Escanear varias etiquetas con Enter, comprobar ritmo real, un registro por lectura, beep y vibración cuando estén disponibles | Pendiente |
| Condiciones difíciles | Medir diez lecturas por condición con poca luz y etiqueta curva; registrar aciertos y tiempo, con objetivo cercano a 2s | Pendiente |

Registrar modelo, versión del SO/navegador, modo Safari/PWA, cantidad de intentos, tiempos y resultado antes de marcar los puntos físicos del issue.

El WebKit de Playwright instalado en Windows no expone `MediaStream` ni `HTMLCanvasElement.prototype.captureStream`. Los cinco escenarios que requieren video simulado no pueden validarse aquí con ese motor; la denegación de permisos y la navegación sí pueden probarse. No se marcaron como aprobadas las pruebas de cámara WebKit por este motivo.

## SMTP

La configuración `SMTP_HOST` / `SMTP_FROM` en Railway queda expresamente para después por indicación del usuario. No se modificaron variables ni se enviaron correos.

## Reproducción

Validación del 2026-10-20: TypeScript frontend/backend, 50 tests frontend, 12 tests unitarios backend y 99 integraciones aprobados. Veinte E2E distintos aprobados: 13 en la primera pasada y siete adicionales después de corregir la URL fija de la prueba de permisos y agregar los seis escenarios Chromium/Android. La primera pasada también incluyó cinco fallos de cámara WebKit por las APIs ausentes en Windows, documentados arriba; no se computan como aprobados.

Los logs E2E mostraron P2002 intermitentes en `GET /api/catalogs`, también presentes en el CI de referencia. Las pruebas indicadas aprobaron; este cambio no modifica la inicialización de catálogos.

Capturas revisadas: [barra a 390px](pr-shots/440-nav-390.png) y [Empleado a 360px](pr-shots/440-nav-360-staff.png).

En PowerShell, para integración (solo contra una base local de prueba ya preparada):

```powershell
$env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55440/imanager_440_test'
npm --prefix backend run test:integration -- src/test/operation-concurrency.integration.test.ts src/test/integrated-operations.integration.test.ts src/test/cancel-refund.integration.test.ts src/test/cash.integration.test.ts src/test/commissions.integration.test.ts
```

Para E2E, usar otra base local aislada y puertos libres:

```powershell
$env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55440/imanager_440_e2e'
$env:PLAYWRIGHT_API_BASE_URL = 'http://127.0.0.1:31440'
$env:PLAYWRIGHT_APP_BASE_URL = 'http://127.0.0.1:41440'
npx playwright test e2e/mobile-nav.spec.ts e2e/delete-cancelled-sales.spec.ts e2e/qa-scan-1910.spec.ts e2e/qa-scan-1910-iphone.spec.ts e2e/qa-scan-1910-android.spec.ts --workers=2
```

No se ejecutó build ni se modificó el schema de Prisma. Las bases de pruebas no contienen datos del negocio.
