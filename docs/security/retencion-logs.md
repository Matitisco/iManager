# Retención de logs e historial

Fecha: 2026-11-03. Rama `mejora/retencion-logs`, base `test`. Sin schema ni migraciones; sin acceso a producción. Política operativa propuesta, no un criterio legal de conservación contable.

## Inventario y política

La revisión cubre `backend/prisma/schema.prisma`, escrituras de auditoría/analytics/notificaciones, historial admin anterior (`docs/admin/store-history.md`), restauración de ventas, outbox, webhooks, rate limits y logger.

| Persistencia | Retención / alcance de esta purga | Motivo |
| --- | --- | --- |
| `AuditEvent`: acciones de accesos conocidas | Mínimo **730 días** (24 meses operativos); plazo ampliable. Solo `entityType=member` con `member.invited`, `member.joined`, `member.removed`, `member.role`, `member.permissions`, o `entityType=invitation` con `invitation.cancelled`. | Permite investigar cambios de equipo y permisos durante dos años. Lista cerrada de acción **y** entidad; nunca se deduce por prefijos. |
| Resto de `AuditEvent`, incluida auditoría financiera, inventario/importaciones y administración | **Sin purga automática**, aun después de 730 días. | `sale.voided` participa en la restauración de ventas. Importaciones, costos/precios, agrupaciones/restores, reset y correcciones admin son evidencia de operaciones. No existe una clasificación o archivo separado que permita borrarlos con seguridad. Acciones nuevas/desconocidas se conservan. |
| `ProductEvent`: telemetría efímera **sin `dedupeKey`** | Mínimo **90 días**, ampliable. Solo `onboarding_name_viewed`, `onboarding_stock_viewed`, `stock_method_chosen`, `stock_import_finished`, `stock_import_abandoned`, `first_steps_opened`, `first_steps_step_clicked`, `invite_shared`. | Tres meses de diagnóstico del onboarding/importador. Son eventos de uso; la importación de negocio y su auditoría se conservan. |
| Resto de `ProductEvent` y cualquier fila con `dedupeKey` | **Sin purga automática**. | Hitos, primeras ventas/pasos, invitaciones y conexiones alimentan funnel/historial. Las claves únicas impiden volver a registrar hitos. También se protege `active_day`, aun sin clave, y cualquier evento desconocido. Requiere diseño de agregación/archivo para acotar su crecimiento. |
| `StoreNotification` + `NotificationRead` | Mínimo **90 días** desde creación **y desde la última lectura**; ampliable. Requiere al menos una lectura y lectura de **todos** los miembros actuales (`removedAt IS NULL`). | No elimina avisos pendientes de otros usuarios. Se exige lectura incluso de miembros sin acceso a la sección: criterio conservador que puede retener avisos indefinidamente. Las lecturas de la notificación borrada se eliminan por el cascade existente. Las lecturas restantes se conservan para no convertir avisos en no leídos. |
| `PeriodicReportDelivery` / `PeriodicReportSettings` | **Sin purga automática**. | El outbox guarda payload financiero y clave de idempotencia `(storeId, periodKey, recipient)`. Incluye `PREPARED`, `SENDING`, `UNCERTAIN` y `SENT`; borrar puede permitir duplicación o perder evidencia de envíos inciertos. Settings guarda el último error/estado, no un log acumulativo. |
| `RepairStatusEvent`, `ReturnEvent`, `StockCount*`, `SectionRecordView`, `ImeiTacMiss` | **Sin purga automática**. | Historial de negocio/control físico, estado de lectura y catálogo agregado de TAC faltantes, respectivamente. No se consideran logs técnicos descartables. |
| Ventas, canjes, compras, pagos, cuotas, señas, caja, comisiones, gastos, stock, clientes, proveedores, invitaciones y `BillingCheckout` | **Fuera de alcance**, sin borrados ni actualizaciones. | Registros de negocio/contabilidad, evidencia y estados activos de acceso/billing. |
| Pino/Fastify y `console` | Propuesta: **30 días** para logs técnicos/errores en el colector; incidentes seleccionados hasta **90 días** en almacenamiento controlado. **Este script no los purga**. | El servidor escribe a stdout/stderr; no configura archivos/rotación propios. Mantiene redacción de #727. La retención real depende del host/colector y requiere validación/OK independiente; no se consultó ni cambió Railway. |
| Rate limits | Memoria de cada instancia: ventanas existentes de 1 minuto (HTTP) y 10 minutos (importador de texto), sin tabla histórica. | No hay datos persistidos para este job. No se alteran cuotas ni controles de #725. |
| Webhooks | No existe tabla de eventos/webhooks genérica. Se reconcilia Mercado Pago contra estado de negocio/billing. | No hay `WebhookEvent`/`ErrorLog`/`ImportLog`/`RateLimit` persistentes que purgar. `AuditEvent` y `ProductEvent` cubren los eventos de importación existentes. |
| Archivos operativos y fuentes externas | **Fuera de alcance**: backups JSON de scripts de agrupación, reportes del evaluador de importaciones, logs locales de desarrollo y PostHog. | Backups pueden ser necesarios para restaurar y contienen datos. No se recorren discos/volúmenes ni se borran archivos. PostHog se consulta opcionalmente desde historial admin; purgar PostgreSQL **no elimina sus eventos** y el historial puede seguir mostrándolos. |

El cutoff usa UTC, compara estrictamente `<` y conserva filas exactamente en el límite. No se usa `clientAt` para decidir antigüedad. No se tocan permisos/costos/ganancias de STAFF (#691).

## Ejecución y variables

Script: `backend/scripts/retention-logs.ts`. No agrega timers a la API ni endpoints HTTP. Ejecutarlo una vez al día desde un servicio cron dedicado, con el mismo código desplegado y acceso directo a la DB correspondiente. La conexión debe conservar la sesión: **no usar un pooler en modo transaction pooling** para este proceso.

| Variable | Default | Validación / efecto |
| --- | --- | --- |
| `RETENTION_JOBS_ENABLED` | `false` | Solo `true` habilita. `false` desactiva; acepta exclusivamente `true`/`false`. |
| `RETENTION_DRY_RUN` | `true` **en todos los entornos, incluida producción** | Simula sin borrar. El borrado exige `false` explícito, además de jobs habilitados. |
| `RETENTION_SECURITY_DAYS` | `730` | Entero entre 730 y 36500. No permite reducir dos años. |
| `RETENTION_TELEMETRY_DAYS` | `90` | Entero entre 90 y 36500. |
| `RETENTION_NOTIFICATION_DAYS` | `90` | Entero entre 90 y 36500; aplica a creación y lecturas. |
| `RETENTION_BATCH_SIZE` | `100` | Entero entre 1 y 500; máximo de padres por lote/categoría. |
| `RETENTION_MAX_BATCHES` | `5` | Entero entre 1 y 20 **por categoría y ejecución**. |
| `NODE_ENV` | `production` si está ausente | `test` omite la CLI aunque el job esté habilitado. Solo las pruebas del núcleo pueden autorizar explícitamente su DB aislada; no hay env para saltarse esta guarda. |
| `DATABASE_URL` | Sin default | Inyectada por el entorno protegido del servicio; solo se requiere al ejecutar. No imprimirla ni copiarla a crontabs, archivos, tickets o comandos documentados. |

Variables inválidas abortan con salida 1; no se imprime su contenido. Los plazos solo pueden ampliarse. La configuración no admite nombres de tablas ni acciones arbitrarias.

Cron sugerido: `30 6 * * *` con zona horaria del scheduler **UTC** (03:30 Argentina). Comando del servicio, desde el directorio `backend/` de un despliegue construido normalmente por CI:

```sh
timeout 300s node dist/scripts/retention-logs.js
```

Configurar las variables en el entorno protegido que **inyecta el scheduler** (un cron del sistema no hereda automáticamente las variables de la API). No crear un nuevo servicio/deploy ni activar este cron en producción sin el OK indicado abajo. Sin cron no se ejecuta automáticamente. El límite externo corta invocaciones atascadas; una desconexión revierte el lote en curso y libera el lock. Los anteriores ya están confirmados.

En desarrollo, con `DATABASE_URL` ya inyectada apuntando a una DB local descartable, desde `backend/`:

```sh
RETENTION_JOBS_ENABLED=true RETENTION_DRY_RUN=true node --import tsx scripts/retention-logs.ts
```

El runtime compilado usa `node`; el ejemplo local usa el `tsx` ya instalado. El script no carga `.env` ni inicializa Firebase. Para desactivar: `RETENTION_JOBS_ENABLED=false` en el scheduler y cancelar la programación. El cambio toma efecto en la siguiente invocación; para interrumpir una ejecución propia en curso, detener ese proceso desde su scheduler. Mantener `RETENTION_DRY_RUN=true` evita el borrado aun si alguien habilita el cron.

## Lotes, concurrencia y auditoría

- Advisory lock de **sesión** PostgreSQL con par fijo `(1845101001, 1)` en un cliente exclusivo con `connection_limit=1`. Otra instancia informa `status=locked` y termina sin borrar. Se libera con `finally` y desconexión; cada lote comprueba que su conexión aún lo posee, para abortar si fue reemplazada.
- Cada lote usa transacción independiente, `LIMIT`, `FOR UPDATE SKIP LOCKED`, `lock_timeout=1s`, `statement_timeout=5s` y timeout de transacción de 8s. Las filas ocupadas se reintentan en la siguiente invocación. No hay transacción que abarque toda la purga.
- Defaults: hasta **500 padres por categoría**, 1500 en total por ejecución, más las lecturas dependientes de las notificaciones por el cascade existente. No es un límite de filas escaneadas ni de lecturas dependientes: sin nuevos índices, una DB grande puede agotar el timeout. Ante esto, no aumentar timeouts sin medir en un entorno de prueba; evaluar índices en otra tarea con autorización de schema/migración.
- El dry-run solo selecciona IDs internos y pagina por ID para no contar una fila dos veces. Informa candidatos **hasta el presupuesto**, no el total histórico. `capped=true` significa que el último lote estuvo lleno: puede haber más. No modifica tablas ni marca filas como procesadas; repetirlo vuelve a mostrar los mismos candidatos. Es una vista previa, no congela la DB para el próximo borrado.
- El borrado vuelve a evaluar elegibilidad en cada lote. Los miembros/lecturas se evalúan en el snapshot de la sentencia PostgreSQL: no se bloquean altas de miembros ni cambios de permisos durante toda la ejecución. Un nuevo miembro posterior puede encontrar el historial ya purgado, como cualquier alta posterior a la retención.
- Logs `Retención lote` después de cada commit: categoría, modo, número de lote y cantidad de padres borrados/candidatos. `Retención categoría`: acumulado, cutoff UTC y `capped`. `Retención`: estado final (`disabled`, `test`, `locked`, `completed`), modo y conteos. No incluyen IDs, tiendas, usuarios, emails, mensajes, payloads, conexión ni errores crudos. El conteo de notificaciones cuenta padres, no sus lecturas en cascade.
- Guardar y revisar esos resúmenes en el colector con la política técnica acordada; verificar ejecución diaria, salida 0 y evolución de `capped`. Salida 1 informa fallo genérico; revisar configuración/conectividad sin volcar secretos. Puede haber lotes previos confirmados: auditar sus líneas y repetir, ya que la purga es idempotente. No se agrega un log en DB que crezca con el propio job.

## Requiere OK de Matias

**PR abierto, sin merge automático**: incluye una política de borrado y cambia el historial visible al activar el modo real. Para producción se necesita aprobar la política/alcance y la primera ventana de ejecución; después habilitar el cron inicialmente con `RETENTION_JOBS_ENABLED=true`, **manteniendo `RETENTION_DRY_RUN=true`**, revisar sus resúmenes y el respaldo/restauración existente. Solo con OK explícito cambiar `RETENTION_DRY_RUN=false`. No se ejecutó ni se configuró nada en producción en esta tarea.

También quedan sujetos a OK la retención efectiva de stdout/stderr en el host y la purga histórica de PostHog. Auditoría financiera/admin, conexiones/hitos con deduplicación, outbox y backups siguen creciendo: acotarlos requiere resolver sus dependencias, no aplicar un TTL genérico. Este PR no incorpora archivo/exportación previa ni borrado por solicitud de usuario.

## Validación

Pruebas contra PostgreSQL descartable exclusivo `retencion_logs_test`, loopback, puerto aleatorio >20000 y datos sintéticos. Cubren corte exacto, plazos ampliados, protección de negocio/auditoría financiera/unknown/dedupe/outbox, lecturas por usuario, cascade, límite de lotes, repetición, dry-run paginado, lock entre instancias, filas ocupadas y liberación tras fallo. Unitarias: configuración segura, mínimos, presupuesto, CLI omitida en test y errores sin datos. Solo pruebas relacionadas, un worker; TypeScript frontend/backend mediante `npm run lint`, sin build ni suite completa local.

Resultado local: **14 unitarias y 25 integraciones relacionadas aprobadas** (11 nuevas de retención y 14 de notificaciones/restauración de ventas); TypeScript frontend y backend aprobado. Se repitió la prueba de paginado tras reforzar su aserción. Los primeros intentos sufrieron timeouts con la máquina compartida bajo presión de RAM; las repeticiones terminaron en verde. Smoke adicional de CLI con entorno simulado de producción y DB local: sin `RETENTION_DRY_RUN`, informó un candidato y conservó la fila.
