# Caja diaria — #307

Cada caja tiene una moneda (ARS o USD) y un medio (Efectivo o Transferencia). El saldo inicial, los movimientos, el conteo y el cierre pertenecen a esa caja. Cambiar la moneda de la tienda o la cotización del dólar no modifica ningún saldo de caja.

La caja nunca bloquea ventas, cobros, cancelaciones ni correcciones de precio. Los cobros usan una caja de la misma moneda y medio abierta hoy, priorizando la predeterminada. Si existe configuración compatible pero ninguna caja está abierta, el movimiento queda persistido con `registerId` y `sessionId` nulos, sin cambiar saldos cerrados. Si no hay configuración para esa moneda y medio (o el medio no corresponde a Cajas), la operación se guarda sin crear un movimiento de caja. No se exige configurar las otras combinaciones. Importar ventas históricas no genera cobros. Los movimientos sin asignar conservan moneda, medio y origen; no se incorporan a cierres ni se reasignan automáticamente.

Ingreso y Egreso registran dinero real. El egreso exige categoría; los pagos a proveedores se cargan aquí porque todavía no existe una ficha de proveedores. Ajustar saldo exige una explicación y no representa ingreso ni gasto. Las categorías quedan disponibles para una futura integración con Estado de Resultados; este cambio no modifica ese reporte.

Convertir fondos es una operación explícita: entre cajas de igual moneda transfiere el mismo importe; entre ARS y USD permite revisar la cotización blue precargada y guarda la cotización junto con ambos movimientos. Las dos cajas deben estar abiertas. Anular revierte las dos patas una sola vez. La categoría se puede corregir sin mover dinero; un importe incorrecto se anula y se vuelve a cargar. Los movimientos vinculados se corrigen desde su operación de origen.

Ventas y canjes, pagos mixtos, cuotas, cobros de cuenta corriente, señas y cobros de reparación registran su moneda y medio originales dentro de la transacción. Aplicar una seña no vuelve a cobrarla. Anular una venta compensa cada cobro según su asignación original: si tenía caja, la compensación va a una caja compatible abierta hoy o queda sin asignar, incluso si la original está cerrada o archivada; si el cobro no tenía caja, su compensación queda siempre sin caja ni sesión aunque ahora haya una compatible abierta. Si no existía movimiento por falta de configuración, no se crea uno retroactivo; cuando hay cliente, la devolución se conserva en su historial fuera de Cajas. Se restablece la seña como crédito. No se modifican los movimientos originales, el saldo cerrado ni los conteos; el historial identifica las anulaciones por su compensación. Corregir el precio no vuelve a cobrar dinero: el aumento de una venta pagada con cliente genera la diferencia como deuda de cuenta corriente (#305), y sólo un cobro posterior genera otro movimiento. Al cancelar tras ajustar el precio, cada compensación sigue su propio cobro: un original sin caja se devuelve fuera de cajas, aunque la diferencia se haya cobrado y deba compensarse en una caja abierta. El anticipo del formulario de reparación se considera efectivo, tal como informa ese formulario.

El conteo oculta saldo y esperado mientras se completa. Efectivo usa denominaciones de su moneda; Transferencia usa el total observado en la cuenta. Guardar compara esperado contra contado y exige nota si hay diferencia. Pausa movimientos manuales de esa caja hasta que el dueño apruebe o pida recontar; los cobros de negocio siguen guardándose sin asignar; cada intento queda guardado. Aprobar aplica un ajuste de arqueo a esa sesión y moneda. El próximo día toma el saldo aprobado como fondo; no se abre con un cierre pendiente ni se abre dos veces el mismo día. Archivar requiere completar el cierre y conserva el saldo.

El acceso a Cajas y el permiso «Ver saldo de cajas» son independientes. Sin este último, el empleado registra y cuenta sin recibir saldos ni historial. Tras guardar puede ver su último resultado; al pedir reconteo se ocultan los intentos anteriores. Solo el dueño administra cajas, ajusta saldos y aprueba cierres.

## Persistencia y compatibilidad

Solo se agregan `CashRegister`, `CashSession`, `CashMovement`, `CashCount` y sus relaciones en Store. No se agregan unicidades en tablas anteriores. El SQL de `20261014220000_daily_cash_registers` se generó comparando con `origin/main` (`41a91ad`); solo crea tablas, índices y claves foráneas nuevas.

Se verificó el esquema anterior en una base local dedicada, se insertaron una tienda y dos equipos con importes conocidos y el mismo `reservedDepositId`, y se aplicó el esquema actual con `prisma db push`, sin aceptar pérdida de datos. Ambos equipos, sus importes y la referencia duplicada se conservaron; no se crearon movimientos ni cajas históricos. No se modificó producción.

## Corrección de bloqueos de producción

`CashMovement.registerId` admite nulos y su relación sigue conservando las filas previas. Se agregan `currency` y `method` opcionales para identificar movimientos sin asignar. Los movimientos anteriores resuelven esos datos desde su caja; no hay backfill ni nuevas unicidades. Se verificó con `prisma db push` sobre el esquema previo de #369 con caja, movimiento y cierre aprobado existentes: se conservaron el movimiento y saldo de USD 123,45, su sesión y conteo; después se agregó un movimiento sin caja. Sin aceptar pérdida de datos ni tocar producción.

Regresiones nuevas: cobros sin apertura, caja cerrada/en revisión/reconteo/día anterior, combinación sin configurar, compensación con otra caja abierta o sin asignar, caja archivada, originales y cierres inmutables, idempotencia y aumento de precio pagado seguido de cobro y cancelación. E2E compartidos cubren las operaciones desde la UI en desktop e iPhone.

## Regresión de reintegros sin caja

El caso que dejaba Caja C en USD -100 se reproduce con un cobro sin asignar seguido de la apertura de otra caja y su cancelación. La compensación conserva la asignación del original: un cobro fuera de cajas nunca afecta una caja abierta después. La regla se evalúa por movimiento, también tras subir o bajar el precio; una diferencia efectivamente cobrada en caja se compensa por separado.

- Cuatro unitarios nuevos y seis integraciones cubren la asignación, falta de configuración, idempotencia, cierres inmutables, correcciones de precio y cobros mixtos.
- Doce E2E nuevos compartidos por desktop e iPhone cancelan desde la UI y verifican saldo cero, historial vacío de la nueva caja y cierre con esperado, contado y diferencia en cero. Cubren caja sin abrir/cerrada, medio sin configuración y correcciones a USD 80/130; al cobrar USD 30 adicionales en caja, sólo se compensan allí esos USD 30.
- Antes del fix fallaban un unitario, cinco integraciones y el E2E desktop por asignar la compensación a la caja abierta. Las pruebas nuevas de navegación también detectaron y corrigieron una espera faltante y una coincidencia con el nombre del usuario de prueba.
- Validación final: lint/typecheck frontend/backend, 756 unitarios frontend, 392 unitarios backend, 198 integraciones y 59 E2E relevantes aprobados con dos workers y cero reintentos. Incluye caja, cuenta corriente #305, cancelación/reintegros, señas, eliminación y edición de operaciones.
- Sin cambios del esquema Prisma ni nuevas unicidades. Se usó `prisma db push` sobre bases locales separadas de integración/E2E. Sin build ni push.

## Validación de la corrección

- Lint/typecheck: `npm run lint` y `npm --prefix backend run lint` (`tsc --noEmit`), ambos aprobados.
- Unitarios: 748 frontend y 388 backend aprobados; incluyen ocho regresiones nuevas de caja y el singular de inventario.
- Integración: 192 pruebas PostgreSQL aprobadas (28 archivos), incluidas las 23 de caja y la suite completa de `accounts` / `cancel-refund` de #305.
- E2E relevante: 73 aprobados en la corrida final (dos workers, un reintento disponible como en CI, ninguno consumido). Incluye los diez casos nuevos de caja en Chromium desktop y WebKit/iPhone 13; cuenta corriente, deuda/caché, señas y devoluciones, cancelaciones y eliminación, edición venta/canje, inventario, reparaciones, dashboard y catálogo.
- Corridas previas detectaron una carrera de lectura de respuesta en la prueba de caché de WebKit, corregida leyendo el fixture desde el contexto HTTP. También se observaron un agotamiento de reintentos serializables entre fixtures paralelos y una recarga en blanco de WebKit; esos casos pasaron al primer intento en la corrida final. No se cambiaron los reintentos del backend.
- `prisma db push` compatible con los datos y cierres anteriores, sin aceptar pérdida ni agregar unicidades. Sin build ni push.

## Validación original de #307

- TypeScript frontend y backend: `npm run lint` y `npm --prefix backend run lint`.
- 747 unitarios frontend y 380 unitarios backend aprobados.
- 181 integraciones PostgreSQL aprobadas, incluidas 12 nuevas de Caja: monedas y medios independientes, cambio de cotización, cierres/reconteos, diferencia, permisos, aislamiento de tienda, idempotencia concurrente, stock, señas, cuotas, reparaciones y filtros inclusivos en horario local.
- 23 E2E relevantes aprobados sin retries: 8 de Caja en desktop 1440 × 900 y WebKit con iPhone 13, más 15 de cuenta corriente, señas y operaciones. Los cuatro escenarios compartidos de Caja cubren alta, ingresos/egresos, cierres ARS/USD, diferencia/reconteo, conversión/anulación y empleado sin saldo.
- Capturas: `docs/pr-shots/issue-307-desktop-cierre.png` y `docs/pr-shots/issue-307-iphone-cierre.png`.
- Sin build, siguiendo la regla del repositorio. No se hizo push.
