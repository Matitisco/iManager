## Decisión

Elegir el bloqueo seguro: el marcador de compensación emitida del reclamo y cualquier nota vinculada impiden anularlo, sin depender del saldo restante ni del borrado lógico de la nota. Hoy no existe una operación de reversión integral de compensaciones; no se interpreta un borrado lógico como reversión de dinero/cliente. El mensaje pide anular primero el reintegro/nota. No se modifica reconocimiento financiero ni se deshacen aplicaciones de otras ventas.

## Transacción

Conservar Serializable, retry y lock `returns:<storeId>` compartido por resolución y aplicación de notas. Validar antes de escribir. Sin compensación, facturación, ganancia y acumulado no tuvieron descuento: conservarlos. Revertir movimientos de stock/RMA bajo lock de inventario; rechazar estados ambiguos, reventa o reserva con 409. Conservar registros y auditoría; limpiar el destino efectivo al anular para liberar el alcance sin liberar históricos anulados con efectos conservados.

## Verificación

PostgreSQL nuevo exclusivo local, datos ficticios. Regresiones USD/ARS, devolución completa/parcial, reintegro/nota abierta/parcialmente aplicada/consumida, OWNER/STAFF con y sin acceso sensible, reparación sin dinero, RMA, rollback y aislamiento. Mantener #691 (finanzas STAFF) y límites HVD-01/02/03. Sin build.
