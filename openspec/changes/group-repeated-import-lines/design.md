# Diseño

Extraer los campos y las expresiones de la clave estricta a un helper puro compartido por admin, script e importación. Agrupar en confirmación backend y al preparar la vista previa; conservar procedencia, dudas y cantidades. Mantener validaciones y límites por unidades. El frontend comprobará filas procesadas y unidades cuando el servidor las informe. Sin cambios de schema ni consultas de merge con stock existente.

La preview conserva una firma de columnas sin asignar para no perder valores que luego serán campos nuevos. Frontend agrupa nuevamente con los personalizados definitivos, también tras editar texto, conservando dudas y exclusiones. El backend informa filas procesadas y unidades; las comprobaciones del cliente usan ambos valores.

Validación: lint/TypeScript frontend y backend, 525 pruebas unitarias backend relacionadas, 220 frontend relacionadas y 91 integraciones en PostgreSQL efímero local, incluidas aplicación/restauración administrativas. Sin build.

La normalización compartida usa validación IMEI sin dependencias de servidor (`imei-value.ts`); `imei.ts` conserva la misma API y el adaptador Zod para el backend. Una guarda de test impide que el agrupado vuelva a cargar Zod en el navegador.
