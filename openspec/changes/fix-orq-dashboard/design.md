## Context
El Dashboard cambia de rango antes de resolver la consulta y reemplaza atómicamente métricas, gráfico, medios de pago y ventas. El catch conserva la instantánea anterior por diseño.

## Goals / Non-goals
Hacer visible el fallo de una acción explícita sin vaciar datos. No modificar carga inicial, permisos ni revalidaciones automáticas.

## Decisions
Registrar la clave de consulta fallida en estado local. Mostrar un alert con la clase existente ferr únicamente si hay una instantánea de otro rango. Reintentar incrementa una revisión local que vuelve a ejecutar el efecto con las mismas fechas. Una respuesta correcta limpia el fallo; el guard cancelled protege solicitudes obsoletas. Reutilizar wlink para la acción y tokens existentes.

## Risks / Trade-offs
Se conservan datos anteriores, por lo que el mensaje debe decirlo explícitamente. No guardar el error en caché. Sin cambios de esquema ni migración.

## Validation
Regresión de error HTTP y de red después de aplicar un período, retry con las mismas fechas, error obsoleto y revalidación automática. Chromium local a 1440×900 y 390×844, capturando e inspeccionando cada acción. TypeScript frontend/backend y tests relacionados con máximo dos workers. No build.
