# Diseño

El DELETE diferencia operaciones activas de ventas canceladas. El servicio borra las canceladas y registra `sale.deleted` en la misma transacción, omitiendo restauraciones y recálculos. El canje y los movimientos de pago se conservan.

AppContext y la confirmación compartida distinguen cancelación de eliminación. La selección de ventas canceladas ofrece Eliminar selección; las activas conservan Cancelar ventas. Los lotes mixtos requieren separar la selección para mantener una confirmación inequívoca.

Regresiones unitarias, integración con PostgreSQL y navegador cubren cancelación seguida de borrado, permisos, auditoría, persistencia y ambos layouts.
