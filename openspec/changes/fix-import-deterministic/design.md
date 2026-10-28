# Diseño

Priorizar planes heurísticos validados por contenido (80%). Completar destinos libres sin sobreescribir encabezados. Usar modelos únicamente como respaldo y proteger campos críticos comprobados. Advertir moneda ambigua sin convertir importes. El costo persistido no es nullable: rechazar costos inválidos por fila evita inventar cero; el precio vacío conserva priceToDefine. Confirmar hasta 400 filas por request, secuencialmente, con timeout de 120 s y resultados parciales recuperables. Probar grids generados con parseWorkbook real y persistencia en PostgreSQL local de test.
