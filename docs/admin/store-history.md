# Historial de acciones por tienda

En `/admin/actividad`, **Última acción** muestra la última operación o conexión diaria conocida. En `/admin/actividad/tienda/:id`, **Historial de acciones** muestra fecha/hora argentina, quién y qué cambió. Permite elegir tipo, fechas inclusivas y cargar más. **Actualizar** reinicia el historial y reintenta las fuentes externas. El recorrido y los primeros pasos existentes conservan su propia información.

El acceso sigue exigiendo Firebase con email verificado e incluido en `ADMIN_EMAILS`. Las rutas son de lectura y responden `Cache-Control: no-store`.

## Alcance

- **Cargas**: altas e importaciones guardadas de equipos, ventas, clientes, canjes, devoluciones, reparaciones y empleados.
- **Bajas**: anulaciones, borrados, archivados y remoción de empleados o cancelación de invitaciones.
- **Modificaciones**: ediciones, cambios de estado, restauraciones, roles/permisos y configuración. Si la auditoría conserva campos modificados, se muestran sus nombres: «Editó un cliente · Campos: Nombre, Teléfono».
- **Conexiones**: «Se conectó», como máximo una por usuario, tienda y día calendario de Buenos Aires. No se muestra cada login o sesión.

No se incluyen visitas, navegación, aperturas de pantallas, clics, instalaciones, hitos de onboarding, primeras ventas/equipos duplicados, abandonos, cargas fallidas ni movimientos de módulos fuera del alcance (cajas, gastos, proveedores, comisiones o controles de stock).

## Fuentes y privacidad

- BD: catálogo permitido de AuditEvent y ProductEvent. Para las ediciones solo se proyectan claves de campos de `changes`, traducidas mediante un catálogo fijo. No se transmiten valores anteriores/nuevos, etiquetas libres, notas, importes ni datos de clientes.
- PostHog: consulta HogQL desde backend con `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` (default 689030) y `POSTHOG_REGION=us|eu`. La clave nunca va en variables `VITE_`. No se consultan URLs ni propiedades completas.
- El actor externo se muestra con nombre/rol solo si pertenece a la tienda. Para deduplicar se resuelve su ID interno/Firebase incluso si dejó de ser empleado; no se usan nombres externos. La auditoría conserva nombre/rol históricos.
- Las conexiones locales toman la primera `active_day` del día. Las externas toman el primer `user_logged_in` por identidad/día argentino mediante ranking **antes** del cursor. Una conexión local del usuario/día prevalece sobre PostHog, buscándola fuera de la página actual. Las consultas de última acción excluyen esas conexiones externas antes de elegir la última operación.
- Fallos, timeout (4,5 s), falta de clave o respuesta inválida de PostHog dejan disponible la BD con aviso discreto. No se devuelven ni registran cuerpos externos o credenciales.

## API

`GET /admin/stores/:id/history?type=update&from=2026-10-01&to=2026-10-31&limit=40`

Tipos: `create` (Cargas), `delete` (Bajas), `update` (Modificaciones), `connection` (Conexiones). Fechas `YYYY-MM-DD`; `to` incluye todo el día argentino. Límite 1–100 (default 40). Devuelve `actions`, `nextCursor`, `warning`. Cada acción contiene ID opaco, fecha ISO, tipo, texto y actor (nombre/rol).

El cursor fija un instante máximo y avanza por fecha/ID de la última fila escaneada. Las páginas compuestas solo por duplicados conservan `nextCursor`. Se prioriza BD sobre PostHog; ventas por ID de venta, invitaciones/cargas por actor, operación y proximidad de hasta 5 segundos entre fuentes. Las conexiones se consolidan por día, sin esa ventana temporal. No se fusionan dos operaciones reales de una misma fuente.

Si PostHog falla durante una lectura, las páginas siguientes siguen usando BD y conservan el aviso. **Actualizar** vuelve a consultar ambas fuentes.

`GET /admin/store-activity` agrega `lastAction: { text, at } | null` por tienda y `warning`, con el mismo alcance. Consulta externa en lote para todas las tiendas.

## Validación del ajuste

- Lint TypeScript frontend/backend, sin build.
- 56 unitarias backend relacionadas de admin/analítica; catálogo y adaptador: alcance, tipos, campos seguros, exclusión de navegación/fallos, conexiones agrupadas antes del cursor y última acción.
- 30 integraciones admin/analítica en PostgreSQL local nuevo y exclusivo con datos ficticios y timezone argentino: permisos, privacidad, aislamiento, filtros, fechas, cursores/snapshot, duplicados entre fuentes/páginas, usuarios/días distintos y ex empleados.
- 24 pruebas frontend de las cuatro opciones y cambio de filtros, más 2 recorridos Chromium a 1440/390 px con APIs interceptadas.
- Ambas consultas HogQL nuevas aceptadas por la API real para un ID de tienda sintético inexistente, sin leer eventos de tiendas reales.
