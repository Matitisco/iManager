## Why

HVD-04: anular un reclamo compensado en Returns oculta su descuento en Dashboard/Reportes mientras conserva reintegro, nota, stock y acumulado del cliente.

## What Changes

- Bloquear la anulación de reclamos con reintegro o nota emitida (también aplicada) con HTTP 409 y mensaje en español.
- Anular reclamos sin compensación revirtiendo sus efectos físicos en la misma transacción Serializable que estado, evento y auditoría.
- Convertir los fallos esperados en regresiones normales y cubrir monedas, parciales y permisos.

## Non-goals

No crear un mecanismo de anulación de reintegros/notas, reparar históricos, cambiar permisos de #691, modificar schema Prisma o AppContext. Frontend limitado al texto de confirmación y su regresión de error. Entrega por PR a `test`, sin merge ni producción.
