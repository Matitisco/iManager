# Historial de acciones para marketing

En `/admin/actividad`, **Última acción** muestra el último movimiento o visita conocido por tienda. En `/admin/actividad/tienda/:id`, **Historial de acciones** permite elegir tipo, fechas inclusivas y cargar más. Todas las fechas/horas se muestran en Buenos Aires. **Actualizar** reinicia el historial y vuelve a intentar las fuentes externas. El recorrido y los primeros pasos existentes se conservan.

El acceso es el mismo del panel: Firebase con email verificado e incluido en `ADMIN_EMAILS`. Las rutas son de lectura y responden `Cache-Control: no-store`.

## Fuentes y privacidad

- BD: AuditEvent y eventos de producto registrados por tienda. No se consultan nombres, teléfonos, notas, diferencias ni importes de clientes para construir el historial; solo metadatos de la acción y actor. Los títulos se construyen con un catálogo de textos.
- PostHog: consulta HogQL desde backend, con `POSTHOG_PERSONAL_API_KEY`, proyecto `POSTHOG_PROJECT_ID` (default 689030, proyecto US existente) y `POSTHOG_REGION=us|eu`. Nunca usar una variable `VITE_` para esta clave. Contrato basado en la [API SQL oficial](https://posthog.com/docs/sql).
- Solo se consultan eventos permitidos: visitas a pantallas, cargas por Excel, ventas, canjes, invitaciones y algunos hitos. URLs y propiedades arbitrarias nunca se envían al navegador. Las pantallas se traducen usando rutas conocidas.
- El usuario de PostHog se resuelve por ID interno/Firebase contra miembros de esa tienda. Si ya no pertenece al equipo o no se puede reconocer, se muestra «Usuario sin identificar»; no se confía en nombres de propiedades externas. La auditoría conserva el nombre/rol histórico y completa el rol con la membresía si faltaba.
- «Entró a la app» es la actividad diaria registrada. Solo un evento explícito `user_logged_in` se traduce como «Inició sesión»; la instrumentación actual no garantiza ese evento para todos los accesos.
- Fallos, timeout (4,5 s), falta de clave o respuesta inválida de PostHog dejan disponible la BD y muestran un aviso discreto. No se devuelven ni registran errores/cuerpos externos o credenciales.

## API

`GET /admin/stores/:id/history?type=sales&from=2026-10-01&to=2026-10-31&limit=40`

Tipos: `inventory`, `sales`, `team`, `session`, `navigation`, `other`. Fechas `YYYY-MM-DD`; `to` incluye todo el día argentino. Límite 1–100 (default 40). Devuelve `actions`, `nextCursor`, `warning`. Cada acción contiene ID opaco, fecha ISO, tipo, texto y actor (nombre/rol), sin datos del registro de negocio.

El cursor fija un instante máximo y avanza por fecha/ID de la última fila escaneada. Puede haber páginas sin acciones visibles si todas fueron duplicadas: se conserva `nextCursor` para seguir. Se prioriza BD sobre PostHog; ventas se correlacionan por ID de venta, invitaciones/cargas por actor, operación y proximidad de hasta 5 segundos entre fuentes. No se colapsan operaciones de una misma fuente. Los contrapuntos de BD se buscan independientemente del cursor para evitar repetidos entre páginas. Sin un ID común no se intenta adivinar la equivalencia de dos ventas.

Si PostHog falla durante una lectura, el resto de sus páginas sigue usando BD y conserva el aviso. **Actualizar** vuelve a consultar ambas fuentes desde el principio, para recuperar también visitas omitidas durante el fallo.

`GET /admin/store-activity` agrega `lastAction: { text, at } | null` por tienda y `warning`. Consulta la última acción en lotes (una consulta externa para todas las tiendas), conservando el resto del contrato.

## Validación

- Lint TypeScript frontend/backend, sin build.
- 34 unitarias backend de admin/analítica, incluyendo textos y adaptador PostHog (auth por header, errores, payload inválido, límite y scope).
- 26 integraciones de admin/analítica, incluyendo 9 nuevas de historial: 401/403, no-store, aislamiento, privacidad, fechas argentinas, cursores con empates/snapshot, deduplicación entre páginas y fallback. PostgreSQL local exclusivo con datos ficticios y sesión en zona argentina.
- 24 pruebas frontend relacionadas y 2 recorridos Chromium en 1440/390 px (filtros, carga adicional, aviso, navegación y ausencia de desborde). Capturas locales en `/tmp/admin-store-history-{1440,390}.png`.
