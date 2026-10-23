# Catálogo público (#341, diseño v2)

La sección Catálogo pertenece al propietario: después de Inventario en desktop y primer módulo de Más en móvil. Inventario sólo muestra «En catálogo» cuando el equipo está efectivamente publicado. `catalogVisible` conserva la selección del propietario; `catalogIncluded` es calculado, considerando actividad y reglas.

## Configuración autenticada (OWNER)

- `GET /api/catalog`: `{ catalog: null | ManagedCatalog }`. Leer no crea ni activa un catálogo.
- `PATCH /api/catalog`: crea o actualiza configuración. `active`, `hideWithoutStock`, `hideReserved`, `minBattery` (null o entero 0–100), `showPrice`, `priceCurrency` (`ARS`, `USD`, `ORIGINAL`), `logoUrl` (https o null), `hours` (120 caracteres o null). Campos desconocidos rechazados.
- `PATCH /api/catalog/items`: `{ ids: string[], visible: boolean }`, máximo 500 equipos. Selección atómica y aislada por tienda; un ID ajeno/archivado rechaza todo el lote.
- `POST /api/catalog/regenerate`: nuevo slug con sufijo aleatorio de 96 bits; conserva configuración y selección. El slug anterior responde 404.

Todas las escrituras requieren OWNER y guardan auditoría. Socio/Empleado no pueden administrar el catálogo aunque tengan acceso a Inventario.

## Lectura anónima

`GET /api/public/catalog/:slug` devuelve exclusivamente:

- `store`: nombre, teléfono, dirección, logo, horario y moneda configurada de la tienda (sólo para el encabezado «precios en …»).
- actividad, visibilidad de precio y modo de moneda.
- equipos: modelo, capacidad, color, condición, calidad y batería; precio y moneda únicamente si están habilitados.

No devuelve IDs, IMEI, serial, costo, proveedor, customFields, cantidad, estado interno, CUIT, razón social ni datos de clientes. Stock/cantidad/estado se usan sólo para aplicar reglas. Archivados y equipos para completar nunca se publican. Los mínimos de batería usan el extremo inferior del rango; batería desconocida queda fuera cuando se exige un mínimo. La conversión usa la cotización de venta de la tienda (manual o fuente automática elegida); si no está disponible, devuelve error visible, sin inventar una cotización.

Catálogo desactivado: identidad/contacto públicos, `active: false`, equipos vacíos. Slug desconocido/regenerado: 404 genérico. No hay endpoints de exportación, descargas de filas ni escrituras públicas. El contenido público puede ser leído por un navegador como cualquier catálogo público; no equivale a entregar el inventario privado.

Límite de 60 solicitudes por minuto por IP e instancia de API, compartido entre JSON y preview; 429 incluye `Retry-After`. No se confía en `X-Forwarded-For` aportado por el solicitante. Respuestas `no-store`, incluidas errores. En una infraestructura con proxies, la IP es la del peer observado por Fastify; con varias réplicas el límite es por réplica.

## Página, SEO y PWA

`/c/:slug` monta la lista pública fuera de AppProvider, sin sesión ni login. Lista sin fotos de equipos, en dos columnas en desktop y una en el teléfono. Los filtros son chips, no `<select>`: en desktop quedan en la página (modelo, capacidad, condición, batería y precio) y en el teléfono se abren en el sheet «Filtrar lista», con el botón «Filtros · N». El encabezado dice «precios en» la moneda del catálogo, o la de la tienda cuando el precio queda como está cargado. El WhatsApp general flotante usa `wa.me` con el texto en UTF-8 (`encodeURIComponent`). Un teléfono argentino local se normaliza a `549` más 10 dígitos; un internacional explícito conserva su prefijo. Si el número no es válido, la página pública no muestra el botón y la sección Catálogo avisa con un botón que abre el formulario de la tienda en el teléfono. El conteo «disponibles» de esa sección cuenta sólo equipos en estado disponible. Cambios se reflejan en toda nueva lectura inmediatamente; una página ya abierta revalida al volver al foco, cada 15 segundos y al volver la conexión (`online`, visibilidad y `navigator.onLine`), sin mostrar avisos de conexión ni mensajes sustitutos; los datos viejos se retiran ante revocación/error. Los reintentos automáticos se conservan también en el resto de la app.

El servidor `npm start` (`scripts/serve-spa.mjs`) genera title/description/canonical/OG en HTML antes de ejecutar JavaScript. Usa `VITE_API_BASE_URL` en runtime o el `catalog-config.json` generado con la URL del build. La preview `GET /api/public/catalog/:slug/preview.png` es un PNG 1200×630 construido sólo con nombre/modelos/cantidades públicos, sin fotos ni precios. Debe usarse ese servidor en producción para que los scrapers reciban OG; el servidor dev de Vite sirve el HTML genérico.

El service worker no intercepta `/c/` ni la API pública, y no guarda documentos públicos en el caché de la app. Offline no se sirve un catálogo revocado desde caché. Previews y HTML se sirven con `no-store`, aunque WhatsApp puede conservar una preview que ya descargó.

## Validación reproducible

Prisma es sólo aditivo: `InventoryItem.catalogVisible DEFAULT false`, tabla `StorePublicCatalog` y dos índices. La migración conserva equipos existentes y no publica ninguno por defecto.

Pruebas relevantes: `public-catalog.integration.test.ts`, `rules.test.ts`, `src/catalog/*.test.*`, `scripts/catalog-seo.test.mjs`, `scripts/pwa.test.mjs`, `e2e/public-catalog.spec.ts` (desktop + iPhone/WebKit) y `e2e/pwa/public-catalog.spec.ts` (bundle de producción y worker real).

Capturas opcionales: `ISSUE_341_SHOTS=docs/pr-shots npm run test:e2e -- e2e/public-catalog.spec.ts --workers=1`, con DATABASE_URL local exclusiva y puertos libres.
