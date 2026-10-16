## Context

El backend usa PostgreSQL y db push al iniciar. El puente de sesión resuelve StoreMember para todas las operaciones. La cotización automática compartida es blue vendedor, cacheada quince minutos.

## Goals / Non-Goals

Proteger a las cuentas anteriores y poder cobrar sin capturar tarjetas en iManager. No agregar pasarelas ni exportar datos del negocio.

## Decisions

- User recibe un marcador legacy con default true; el alta de usuario nuevo lo escribe false. Store recibe plan INTERNAL por default; ambos caminos de creación asignan TRIAL con siete días solo al usuario nuevo. Esto incluye cuentas preexistentes sin tienda y funciona con db push sin backfill manual.
- Catálogo global de cuatro planes en tabla nueva; IDs remotos, vendedor y cotización persistidos. Script operativo con lock de PostgreSQL y recuperación por nombre/back_url evita duplicados al reintentar altas; actualización con PUT. No permitir que un owner de tienda administre precios globales.
- Checkout del init_point del plan con external_reference=storeId y payer_email elegido por owner. Una cotización persistida y temporal guarda email/plan/monto. Confirmación explícita antes de navegar; si cambió el precio requiere nueva confirmación.
- Webhook solo toma un ID, valida firma si existe secreto y consulta /preapproval/{id}. Referencia, plan, moneda, frecuencia y email deben coincidir con una intención de checkout de esa tienda. Pagos exitosos confirmados por el resumen remoto determinan vigencia; una autorización pendiente no regala períodos. Eventos de facturas consultan authorized_payments y luego preapproval.
- Locks por tienda y fecha remota evitan regresiones y doble alta; no se habilitan dos suscripciones cobrables a la vez. Cancelar conserva el período abonado, sin reembolso automático.
- El guard del backend rechaza escrituras de negocio al vencer; facturación, sesión, seguridad y lecturas siguen disponibles. Límites 1/3 incluyendo owner; prueba 3 para permitir invitar durante onboarding. Si un pago de Básico llega con exceso, queda solo lectura hasta reducir el equipo; el owner puede quitar miembros.
- Estado de facturación en sesión y AppContext, refrescado al foco y periódicamente. UI en el desk existente, con layout iPhone y desktop.

## Risks / Trade-offs

- El checkout hospedado puede exigir cuenta MP y puede ignorar campos por query → validar realmente en sandbox antes de vender, documentar como decisión pendiente si el entorno no permite completar el pago. Nunca afirmar prueba real a partir de mocks.
- Actualizar un plan puede no modificar contratos ya creados → el script también actualiza montos de preapprovals locales no cancelados; se documenta alcance y aviso comercial pendiente.
- No existe trabajo programado en el proyecto → script para ejecutar periódicamente y reconciliar pagos desde Railway; la expiración se evalúa en cada request aunque no haya cron.
- MP o cotización fuera de servicio → error visible y reintento, sin montos inventados ni acceso gratuito.

## Migration Plan

Aplicar schema aditivo mediante db push, configurar MP_ACCESS_TOKEN y FRONTEND_URL, ejecutar billing:sync y configurar webhook. MP_WEBHOOK_SECRET opcional; producción debe configurarlo. Para rollback mantener columnas/tablas y desplegar código previo; no borrar suscripciones remotas. Separar vendedor TEST de producción explícitamente.

## Open Questions

Cadencia definitiva de sincronización, política de aviso ante ajustes ARS y verificación comercial del checkout como invitado.
