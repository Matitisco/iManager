## Decisions
Cada actualización tiene un AbortController. Una nueva consulta cancela la anterior; la limpieza del efecto cancela la consulta, invalida su identificador y elimina el intervalo. Las dos fuentes HTTP reciben la señal y se verifica la cancelación antes de guardar caché, incluso si una respuesta tardía ignora la señal.

Se conserva el control de identificador para impedir actualizaciones de estado obsoletas, tanto en éxito como en error. Las pruebas controlan las promesas y los temporizadores sin depender de servicios externos.

## Validation
Regresiones de desmontaje y cambios de configuración, tres ejecuciones completas de unitarios frontend y lint frontend/backend. Sin build ni push.
