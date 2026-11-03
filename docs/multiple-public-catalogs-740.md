# Catálogos múltiples · #740

Stock → Catálogos muestra la variante A aprobada: nombre, link, resumen de reglas,
cantidad de equipos, copiar, activo y editar. El editor conserva las reglas de
visibilidad, moneda, logo y horario; agrega nombre y las tres reglas de precio.
En móvil ocupa toda la pantalla; en escritorio abre una hoja centrada.

Decisiones:

- Hasta **10 catálogos** por tienda, incluyendo el predeterminado. Todos comparten
  `InventoryItem.catalogVisible`; ocultar un equipo a mano afecta a todos.
- El catálogo previo se llama inicialmente **Clientes finales**, conserva exactamente
  slug/reglas/estado y no se puede borrar. Se puede renombrar, editar y desactivar.
- Catálogo nuevo: precio de lista, ajuste 0 %, moneda original. El editor propone
  activo al crear; sigue el permiso previo #376 para la creación inicial.
- Manual faltante (incluido precio de lista ausente): usa lista, o muestra Consultá
  cuando tampoco hay lista. Un precio manual 0 es válido. Cada importe manual
  conserva su moneda antes de convertir a la moneda elegida en el catálogo.
- Markup sin costo: precio a consultar; un costo explícito 0 es válido. Costo y precio
  de lista usan la moneda del equipo, o la de la tienda en filas antiguas.
- Cálculos con Decimal, redondeo half up a 2 decimales después de ajuste y conversión,
  con la cotización de venta existente. Un ajuste -100 % produce 0; no se aceptan
  porcentajes menores de -100 ni mayores de 10000 ni más de dos decimales.
- `canSeeFinancials` decide ver/elegir/configurar markup. Cuando deniega, ambos
  campos de regla financiera se devuelven como null, sin costo ni porcentaje. El
  editor guarda otros campos sin enviarlos. El endpoint público devuelve solo
  atributos públicos y el precio resultante, sin regla, costo ni IDs.
- #376 sigue vigente: acceso explícito a Catálogos; propietario para cambiar el
  estado activo de un catálogo existente, regenerar links o borrar catálogos.
  Los empleados autorizados pueden crear y editar reglas no financieras. El
  helper conserva el permiso financiero temporal de STAFF de #691.
- La vista previa usa un POST autenticado con el borrador y el ID del catálogo; no
  persiste cambios. Los cambios de visibilidad de equipos se guardan de inmediato
  mediante el flujo existente y así se indica en el editor.

## API

`GET/POST /api/catalog/list`; `PATCH/DELETE /api/catalog/list/:id`;
`POST /api/catalog/list/:id/regenerate`; `POST /api/catalog/preview`.
`/api/catalog`, `/api/catalog/items` y `/api/catalog/regenerate` siguen operativos
sobre el catálogo predeterminado. `/api/public/catalog/:slug` sirve el correspondiente
catálogo, con la misma lista permitida de campos y sin caché.
Los precios manuales enviados son cambios por equipo: null elimina el precio
manual, omitir un equipo conserva el valor. Se verifican pertenencia y archivado
antes de guardar cualquier cambio. Escrituras y auditoría comparten transacción;
un lock por tienda serializa el límite y la configuración.
El frontend aplica la respuesta canónica del guardado: no depende de una segunda
lectura que podría fallar después de crear y provocar duplicados al reintentar.
Las lecturas anteriores a una escritura y las respuestas de otra tienda se descartan.

## Migración

`20261103210000_multiple_public_catalogs` es **aditiva**: crea `StoreCatalog` y
`CatalogItemPrice`, sus índices y relaciones. INSERT…SELECT idempotente copia
`StorePublicCatalog` a un predeterminado con el mismo link, timestamps y reglas.
No modifica ni elimina filas previas. La tabla vieja queda intacta como histórico.

El arranque actual utiliza `prisma db push`; por eso existe además una importación
perezosa transaccional al primer acceso si aún no se ejecutó el INSERT. Tras crear
el predeterminado solo se consulta la tabla nueva. Un slug regenerado nunca revive
desde la tabla anterior. Inventario y onboarding leen la configuración nueva.
El reset conserva los catálogos como configuración; los precios de equipos que el
reset elimina se eliminan por su FK a InventoryItem.

## Validación

Pruebas unitarias de reglas/redondeo y validación; componentes de lista/editor,
clipboard, permisos, errores y preview; integración de CRUD, backfill repetido,
precios, aislamiento y límite concurrente. E2E a 1440/390 para creación, descuento,
manual y desactivación, más adaptación de los flujos públicos y permisos existentes.
Local: solamente lint y Vitest relacionado con máximo 2 workers; integración y
Playwright se ejecutan en CI. Sin builds, Postgres local ni acceso a producción.
