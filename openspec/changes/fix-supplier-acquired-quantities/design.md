# Diseño

Snapshot privado acquiredQuantity al crear stock manual/importado y otras entradas. Devoluciones que separan filas llevan acquiredQuantity=0: reponen stock sin comprar nuevamente. Ventas, ediciones de stock, anulaciones y restauraciones no cambian el snapshot.

Backfill nullable: cantidad actual + ventas activas que efectivamente descontaron unidades - reposiciones físicas atribuidas a esa misma fila. Ventas legacy stockDeducted=false no se suman; anuladas/canceladas no cuentan. Reclamos archivados/anulados conservan efectos físicos y sí se consideran. Reparación RMA recibida que volvió al cliente no constituye stock repuesto. Los enteros negativos o fuera de rango quedan null, sin modificar stock, ventas ni devoluciones. Lecturas de snapshots null reconstruyen con la misma fórmula y rechazan inconsistencias visiblemente.

El arranque existente usa db push: pre-push agrega el campo antes del backfill y ejecuta el mismo SQL que la migración formal. Todo idempotente y solo completa null. Validar exclusivamente sobre PostgreSQL local descartable con datos sintéticos.

Se conserva el alcance actual de filas no archivadas en resúmenes de proveedor y el conteo de reclamos/problemas por registro.
