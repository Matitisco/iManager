# Diseño

Endpoint admin separado /admin/stores/:id/history para conservar el contrato de hitos. Proyección explícita de auditoría y ProductEvent, y consulta HogQL server-side con timeout. Clave personal solo desde entorno backend; proyecto US 689030 (verificado por API), sobreescribible. Nunca devolver propiedades crudas ni errores externos. Actor resuelto por ID interno/Firebase y membresía; desconocidos identificados sin inventar nombres.

Paginación keyset por fecha e ID, con límite por fuente. Escanear antes de deduplicar y avanzar por la última fila escaneada, incluso si una página contiene duplicados. Dedupe entre fuentes con ID de operación cuando existe y correlación conservadora por actor/acción/tiempo para invitaciones. No fusionar operaciones distintas de una misma fuente. Filtros por categoría y fechas calendario inclusivas de Buenos Aires. Última acción consultada en lotes por tienda, sin consultas externas por fila.

Historial carga de forma independiente luego del guard admin. Mantener estilos del panel existente, estados vacíos/error/reintento y controles accesibles. No inferir inicio de sesión de una visita: active_day se describe como entrada diaria.
