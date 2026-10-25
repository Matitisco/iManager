# Diseño

ReturnDetail conserva la carga desde AppContext/archivo y usa una sola Sheet para consulta y edición. ReturnDetailContent presenta únicamente datos guardados de ReturnCaseView; Cambiar estado o Agregar nota reemplaza el cuerpo por el editor existente en esa misma hoja. Los endpoints, validaciones, permisos y errores se conservan. Anulados permanecen de solo lectura y archivos históricos conservan Restaurar.

Un único HistoryIconButton y un único historial sirven tanto a consulta como a edición, con portal a desk-app, segunda hoja subov y capa 160 por encima del detalle de Fallas (140). En móvil el historial conserva pantalla completa con flecha. No se agregan eventos ni campos de seguimiento al detalle de consulta.

return-detail.css usa el prefijo rcl- y clases/tokens existentes: tracking-summary, kv, spill, Sheet, Actions, DM Sans, border y colores semánticos. Geometría idéntica a variante 2; hoja móvil de altura automática, scroll interno y pie fijo. Sin flag de desarrollo, variante descartada ni código exploratorio.

QA usa exclusivamente la DB ficticia imanager_reclamo_wireframe y el login local dueno@imanager.local; capturas finales en /workspace/qa-reclamo/final-{1440,390}.png. Sin build.
