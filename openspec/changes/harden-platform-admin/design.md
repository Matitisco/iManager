# Diseño

Autenticar y autorizar todo `/admin/*` en `onRequest`, antes de leer el body. Validar en la transacción Serializable de restore que las FK de categoría, proveedor y compra pertenecen a la tienda del backup, antes de escribir. Mantener el límite existente de payload y la restauración física exacta para backups válidos. Documentar cambios operativos dudosos como pendientes.
