# Issue #461 — Concurrencia y consultas por lote

Base revisada: `2e5f50b`, rama `fix/461-concurrencia-n1`. Fecha: 2026-10-21.
Cambios conservados en el working tree. Sin cambios de schema, build, despliegue, commit o push.
Todas las escrituras de validación usan exclusivamente PostgreSQL local, `127.0.0.1:5432/imanager_test`.

## Cambios

| Área | Protección | Prueba |
| --- | --- | --- |
| Cobros y movimientos | Lecturas de moneda, cliente, venta, reparación y cuotas dentro de cada intento Serializable. Pagos, caja, saldos y auditoría se confirman juntos. | Cobros parciales y excesivos, distintas ventas del mismo cliente, cuotas, reparación y cancelación concurrente. |
| Clientes | PATCH escribe solo campos provistos; elegibilidad y diferencias de auditoría se calculan dentro de la transacción. | Renombrar durante un cobro/venta, contacto independiente y edición financiera frente a una operación nueva. |
| Formulario de clientes | Envía solo diferencias con el borrador inicial. Conserva campos no editados, borrados explícitos y moneda del saldo editado. | Regresiones del formulario a 390 y 1440 px y del cuerpo HTTP PATCH; los cuatro casos del formulario fallaron antes de corregir el envío. |
| Importación de ventas | Relectura después del bloqueo de inventario, totales incrementales desde el cliente actual y caché de clientes nuevos actualizada solo tras commit. | Importación frente a venta/otra importación, reserva entre búsqueda y bloqueo, rollback seguido de otra fila; sin nuevos movimientos de caja históricos. |
| Control de stock | Bloquea y revalida el control antes de ajustar; archivos, altas, auditorías y resolución comparten una transacción. | ADJUST/ADJUST, ADJUST/RECORD, selección superpuesta, venta/reserva concurrente y fallo posterior al archivo de faltantes. |
| Archivo | Inventario bloqueado en orden por ID, asociaciones consultadas con IN y revalidación dentro de la transacción. Clientes con protección Serializable y depósitos/operaciones consultados allí. | Alta de operación/seña durante archivo y solicitudes duplicadas; una sola auditoría por transición. |
| Reparaciones | Presupuesto, anticipo, moneda y permisos se recomputan en cada intento; el cambio de estado bloquea la orden antes de comparar. | Bajar presupuesto frente a subir/cobrar anticipo, permiso de precio frente a presupuesto concurrente y estado idéntico simultáneo sin historial duplicado. |
| Catálogos, gastos y proveedores | Inicialización/guardado de catálogos comparten advisory lock transaccional; archivo/restauración/edición bloquean y leen el estado actual. | Inicialización simultánea y contra guardado, doble archivo/restauración y edición posterior a archivo. |
| Comisiones | Proyección pura por período con historial cargado una vez; asignación masiva precarga ventas/relaciones, reglas, devengamientos y pagos. | Equivalencia con proyección mensual y ejecución secuencial; pagos FIFO, saldos anteriores, monedas, bajas, ajustes, vendedor nulo y asignación sin cambios. |
| Estado frontend | Scope con época de sesión, generación y ticket por lectura. Invalidación antes de escribir; versiones por registro y reconciliación tras escrituras superpuestas o una carga inicial interrumpida. | Promesas diferidas en cargas iniciales, refresh invertidos, logout/cambio de tienda, rollback optimista antiguo, respuestas invertidas y dos clientes independientes sin recarga extra. |

Las operaciones que afectan varios registros conservan una reconciliación conjunta. Los cambios independientes de inventario, cliente y reparación usan su propia clave; no se descartan por el orden de otra solicitud. Las respuestas de sesión/configuración/onboarding/invitación también respetan el scope al completar.

Se conservan las validaciones secuenciales y la importación con éxito parcial por fila. El método legacy `createSale` no es el defecto HTTP presentado: `POST /api/sales` ya usa `createOperation`. No se modificó su comportamiento.

## Reproducción y presupuestos de consultas

La suite nueva usa un cliente Prisma real instrumentado únicamente en tests. Las barreras controlan lecturas o entrada de transacciones; el contador registra solo cuántos SELECT se emitieron, sin parámetros. La analítica de primera venta se aísla para que sus tareas en segundo plano no capturen una barrera de negocio.

Se ejecutaron las nuevas regresiones contra los servicios originales de `2e5f50b`, restaurando inmediatamente los cambios de trabajo: 33 fallos de backend y 15 de frontend, sin fallos de infraestructura. Después se reforzaron los casos de exceso de cobro/cancelación, permiso de reparación y scope, y se añadieron las cuatro regresiones del formulario antes de cambiar su envío.

Mediciones del código original en esa reproducción:

| Operación | Tamaño pequeño | Tamaño grande |
| --- | --- | --- |
| Ajuste de faltantes | 10 SELECT para 1 equipo | 155 para 30 |
| Asignación de vendedor | 11 SELECT para 1 venta | 260 para 30 |
| Reporte mensual | 8 SELECT para 1 mes | 74 para 12 |

Las regresiones verifican que el crecimiento corregido sea como máximo dos SELECT para 1/30 equipos o ventas, y uno para reportes de 1/12/120 meses. El margen permite consultas de relaciones vacías frente a relaciones presentes. Los fixtures quedan fuera del conteo; escrituras y auditorías siguen correspondiendo a cada registro.

## Validación

Comandos con `DATABASE_URL` apuntando a la base local indicada arriba:

```sh
npm run test:frontend
npm --prefix backend run test:unit
npm --prefix backend run test:integration
npm run lint
npm --prefix backend run lint
git diff --check
```

Resultados finales:

| Comprobación | Resultado |
| --- | --- |
| Frontend | 158 archivos, 1.157 tests aprobados |
| Backend unitario | 76 archivos, 516 tests aprobados |
| Backend integración | 40 archivos, 362 tests aprobados |
| TypeScript frontend/backend | Ambos aprobados |
| `git diff --check` | Aprobado |

Se agregaron 38 regresiones frontend y 40 de integración backend. Las seis fallas de la primera corrida unitaria se resolvieron actualizando los mocks de la nueva lectura transaccional/lock y la expectativa del incremento atómico; las aserciones de integridad monetaria se verifican además contra PostgreSQL. La primera corrida completa de integración tuvo una falla de la barrera de exceso de cobro porque interceptaba analítica de fondo; la corrida final aislada de esa tarea pasó completa, sin omitir tests ni aplicar retries del runner.

No se cambió el layout ni CSS. Las pruebas del formulario ejercitan los flujos de edición a 390/1440 px; no se levantó un despliegue local ni se hizo QA manual sobre datos reales.

OpenSpec: `openspec/changes/fix-concurrency-query-batching-461/`. Los cuatro artefactos se prepararon antes de implementar. El ejecutable OpenSpec no está instalado en este entorno; se mantuvo el formato spec-driven del repositorio, sin archivar el change.
