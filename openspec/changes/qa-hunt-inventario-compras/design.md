# Diseño

- Mostrar `cantidad ?? 1` en la celda no editable con IMEI; explicar stock agotado cuando es cero. El default conserva registros históricos sin cantidad.
- Construir la fuente de Inventario activo excluyendo archivados antes de calcular filas y totales. Archivados conserva su lista y conteo por registros.
- Reproducir inversión y cantidades de compras con importación real de 10 unidades USD y 3 ARS, OWNER/STAFF y venta parcial. Mantener los casos abiertos explícitos como `it.fails`: no presentar esas regresiones como arregladas ni omitirlas silenciosamente.
- Verificar navegador 1440/390 contra API real local, sin mock de negocio ni conexiones externas; usar suite existente para importación/onboarding, stock y devoluciones.
