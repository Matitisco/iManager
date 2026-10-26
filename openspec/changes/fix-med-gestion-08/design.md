# Diseño
Permitir exclusivamente RECHAZADO → RECIBIDO en reclamos resueltos con destino PROVEEDOR. Reutilizar la recepción transaccional, conservar resolvedAt y compensación, registrar el evento y actualizar stock según la resolución existente. Mantener cerrados los recibidos y anulados.
Reutilizar la hoja y los controles existentes: Cambiar estado habilita Rechazado/Recibido y Estado al volver. Sin CSS nuevo. Revisión visual obligatoria en PR, sin merge.
