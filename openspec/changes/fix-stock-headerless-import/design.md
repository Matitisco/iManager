# Diseño

Representar hojas sin encabezado con headerRow=0 y nombres A, B… hasta el ancho completo. El prompt de OpenAI explicita este contrato y solicita columnIndex desde cero. El backend conserva compatibilidad con planes anteriores sin índice.

Si el encabezado elegido por OpenAI o las filas superiores contienen datos, reconstruir el rango desde fila 1 y el mapeo por contenido con los helpers existentes. Aceptar el resultado como plan del modelo corregido. No sustituir sus decisiones cuando el encabezado es real. Validar que el mapeo de batería corresponda a números o porcentajes, reparar una asignación a reparaciones y preservar formatos de batería válidos y columnas vacías.

Transportar los índices físicos en backend y frontend. Rehabilitar hojas al completar obligatorios. Aplicar descarte de encabezados repetidos/secciones de inventario solo con encabezado de modelo real. Normalizar estados de servicio a EN_REVISION y preservar originales en customFields. Vaciar costos no numéricos o negativos sin descartar el equipo ni agregar textos.

Verificación local: XLSX sintético de 60 filas falsas y 16 columnas con respuesta de OpenAI mockeada que elige fila 5, asigna reparaciones a batería e ignora salud. Resultado: 60 detectadas y 60 aceptadas; costo «abc» vacío y precio a definir. Regresiones de planes correctos, índices duplicados/vacíos, ajuste y rutas analyze/apply. TypeScript/lint frontend/backend, 212 tests backend relacionados y 70 frontend, build frontend aprobado. Sin red ni datos de producción durante las pruebas.
