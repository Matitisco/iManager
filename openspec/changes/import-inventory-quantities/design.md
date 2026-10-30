# Diseño

- Mantener filas compactas con cantidad normalizada en análisis, mapeo y preview. El total representa equipos, los diagnósticos cuentan filas físicas.
- Cantidad ausente/vacía equivale a uno. Cantidades inválidas se conservan en notas, con un equipo En revisión. Filas de total no se multiplican. Una cantidad mayor que uno crea equipos sin IMEI; cualquier identificador original queda en notas para revisar.
- Confirmar cantidades en backend dentro de la transacción existente. Insertar equipos nuevos en lotes acotados; conservar proveedor, compras, campos personalizados y rollback completo.
- Retirar el tope de 100 en texto. Carga en serie divide el envío en lotes y mantiene índices globales de error.
- No cambiar Prisma ni fuentes de datos.
