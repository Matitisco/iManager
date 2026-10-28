## Decisions
La heurística es pista y respaldo exclusivo ante error de transporte/timeout. Cada plan del modelo se valida sin sustituirlo por heurísticas: formato de campos, duplicados, contenido y aceptación física >=85%. Se envían errores concretos y plan anterior a Decisions hasta dos veces. Se conserva el mejor candidato por errores y aceptación; dudas identifican índices físicos. Se usa un deadline compartido de 18 segundos incluyendo lectura de respuesta; no se llama Responses para inventario. Calidad inválida se conserva en custom, condición cosmética válida pasa a grade. Diagnósticos y advertencias explican todas las filas excluidas.

## Validation
Tests del módulo con mocks, fixtures JSON anónimos y evaluación real local de Natan/fakes con métricas agregadas sin secretos.
