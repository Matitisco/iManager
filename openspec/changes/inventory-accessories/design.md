# Diseño

InventoryItem agrega kind con default DEVICE y accessoryType/compatibleWith nullable. Accesorios usan model como nombre, cantidad y dinero Decimal existentes. El alta comparte un segmento Celular/Accesorio; Stock agrega una pantalla independiente. Listados de equipos excluyen accesorios por defecto; AppContext solicita ALL explícitamente y ventas ofrece ambos tipos. Métricas mensuales de accesorios se calculan en backend con la zona de la tienda. Umbral compartido fijo de 5. Sin carga en serie nueva.

Migración 20261104120000_inventory_accessories: únicamente ADD COLUMN. DEFAULT constante permite el agregado sin reescritura de filas en PostgreSQL moderno. No se ejecutan migraciones ni consultas contra bases de negocio en esta tarea.
