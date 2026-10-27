# Diseño

El lector XLSX rellena exclusivamente los rangos verticales combinados; los títulos horizontales mantienen su estructura. Lee el texto numérico de la celda sin reformatear identificadores a partir de un float. La validación pura de importación expande notación científica sólo si contiene todos los dígitos, mediante operaciones de strings; la notación abreviada y números científicos con cola redondeada se rechazan antes del upsert. Un texto de 15 dígitos sin metadatos de formato no permite determinar si el archivo ya perdió precisión.

La validación compartida detecta modelos de pie sin identidad de equipo; el plan además consulta la primera celda textual para detectar notas fuera de la columna de modelo. Los equipos con IMEI válido o capacidad se conservan. Los descartes footer incluyen fila física y mensaje sin contenido de celdas.
