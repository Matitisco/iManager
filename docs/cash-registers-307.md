# Caja diaria — #307

Cada caja tiene una moneda (ARS o USD) y un medio (Efectivo o Transferencia). El saldo inicial, los movimientos, el conteo y el cierre pertenecen a esa caja. Cambiar la moneda de la tienda o la cotización del dólar no modifica ningún saldo de caja.

La primera caja activa de cada moneda y medio recibe sus cobros automáticamente. Se puede cambiar la predeterminada desde Administrar caja. Antes de cobrar hay que abrir las cajas del día: si falta una caja compatible o su sesión no está abierta, se rechaza toda la operación, incluidos stock, venta y saldo del cliente. Las tiendas sin cajas conservan su funcionamiento anterior. Importar ventas históricas no genera cobros.

Ingreso y Egreso registran dinero real. El egreso exige categoría; los pagos a proveedores se cargan aquí porque todavía no existe una ficha de proveedores. Ajustar saldo exige una explicación y no representa ingreso ni gasto. Las categorías quedan disponibles para una futura integración con Estado de Resultados; este cambio no modifica ese reporte.

Convertir fondos es una operación explícita: entre cajas de igual moneda transfiere el mismo importe; entre ARS y USD permite revisar la cotización blue precargada y guarda la cotización junto con ambos movimientos. Las dos cajas deben estar abiertas. Anular revierte las dos patas una sola vez. La categoría se puede corregir sin mover dinero; un importe incorrecto se anula y se vuelve a cargar. Los movimientos vinculados se corrigen desde su operación de origen.

Ventas y canjes, pagos mixtos, cuotas, cobros de cuenta corriente, señas y cobros de reparación registran su moneda y medio originales dentro de la transacción. Aplicar una seña no vuelve a cobrarla. Anular una venta compensa sus cobros en las cajas originales y restablece la seña como crédito. El anticipo del formulario de reparación se considera efectivo, tal como informa ese formulario.

El conteo oculta saldo y esperado mientras se completa. Efectivo usa denominaciones de su moneda; Transferencia usa el total observado en la cuenta. Guardar compara esperado contra contado y exige nota si hay diferencia. Pausa movimientos hasta que el dueño apruebe o pida recontar; cada intento queda guardado. Aprobar aplica un ajuste de arqueo a esa sesión y moneda. El próximo día toma el saldo aprobado como fondo; no se abre con un cierre pendiente ni se abre dos veces el mismo día. Archivar requiere completar el cierre y conserva el saldo.

El acceso a Cajas y el permiso «Ver saldo de cajas» son independientes. Sin este último, el empleado registra y cuenta sin recibir saldos ni historial. Tras guardar puede ver su último resultado; al pedir reconteo se ocultan los intentos anteriores. Solo el dueño administra cajas, ajusta saldos y aprueba cierres.

## Persistencia y compatibilidad

Solo se agregan `CashRegister`, `CashSession`, `CashMovement`, `CashCount` y sus relaciones en Store. No se agregan unicidades en tablas anteriores. El SQL de `20261014220000_daily_cash_registers` se generó comparando con `origin/main` (`41a91ad`); solo crea tablas, índices y claves foráneas nuevas.

Se verificó el esquema anterior en una base local dedicada, se insertaron una tienda y dos equipos con importes conocidos y el mismo `reservedDepositId`, y se aplicó el esquema actual con `prisma db push`, sin aceptar pérdida de datos. Ambos equipos, sus importes y la referencia duplicada se conservaron; no se crearon movimientos ni cajas históricos. No se modificó producción.

## Validación

- TypeScript frontend y backend: `npm run lint` y `npm --prefix backend run lint`.
- 747 unitarios frontend y 380 unitarios backend aprobados.
- 181 integraciones PostgreSQL aprobadas, incluidas 12 nuevas de Caja: monedas y medios independientes, cambio de cotización, cierres/reconteos, diferencia, permisos, aislamiento de tienda, idempotencia concurrente, stock, señas, cuotas, reparaciones y filtros inclusivos en horario local.
- 23 E2E relevantes aprobados sin retries: 8 de Caja en desktop 1440 × 900 y WebKit con iPhone 13, más 15 de cuenta corriente, señas y operaciones. Los cuatro escenarios compartidos de Caja cubren alta, ingresos/egresos, cierres ARS/USD, diferencia/reconteo, conversión/anulación y empleado sin saldo.
- Capturas: `docs/pr-shots/issue-307-desktop-cierre.png` y `docs/pr-shots/issue-307-iphone-cierre.png`.
- Sin build, siguiendo la regla del repositorio. No se hizo push.
