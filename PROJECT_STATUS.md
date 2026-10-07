# iManager - Project Status

Documento vivo. Se actualiza al cerrar cada iteracion importante.
**Ultima actualizacion: 2026-10-07**

## Preparación del ciclo de issues — 2026-10-07

- Integración de `hifi-desk` hasta `e625808` con `main` hasta `338b1f5`, preservando ambos historiales. Las correcciones recientes de TableEngine (paginación, selección, copiar/pegar y borrados persistidos) se conservan junto con la interfaz desk y los avances #90–#96.
- El pegado conserva la aparición inmediata y las solicitudes en paralelo; las filas temporales y los nuevos registros persistidos reciben la animación desk. El refresco de tabla conserva sus controles de concurrencia y evita una segunda consulta para animar.
- Retirado OpenSpec del repositorio por instrucción del usuario: artefactos, configuración, comandos, workflows y skills locales de los distintos agentes. Las herramientas globales del usuario no se modificaron.
- Las decisiones del ciclo se registran en `docs/issues-loop-pendientes.md`; el avance se mantiene en `docs/issues-loop.md`. El issue #89 queda excluido por instrucción del usuario.
- Los scripts de pruebas frontend usan la zona horaria definida en Vitest y ejecutan en Windows y Linux sin sintaxis de variables exclusiva de POSIX.
- Validación: lint frontend/backend aprobado tras regenerar el cliente Prisma local por los campos de contacto de #96; suite completa frontend 239/239 (49 archivos) y backend unit 77/77 (18 archivos), revisadas por el coordinador. Los dos timeouts iniciales de backend desaparecieron al ejecutar con un solo worker. Las 30 pruebas de TableEngine vuelven a pasar con comprobaciones de animación temporal y persistida, sin consulta de refresco duplicada.
- E2E de canjes aprobado: creación de cliente y canje, comprobación API y recuperación tras recargar usando exclusivamente `imanager_issues_loop_test` en PostgreSQL local. No se ejecutaron builds ni se accedió a producción.

## Ciclo de issues — 2026-10-07

- Issue #99: la marca de la sidebar desk y la pantalla Sesión cerrada usan el mismo icono `Box` de Lucide que la sidebar de referencia de `main`. Conservan el fondo amarillo existente `#FFD000`, trazo oscuro y composición hi-fi (22 px en una superficie de 38 px; 40 px en la pantalla de salida).
- Validación #99: TypeScript frontend/backend aprobado en paralelo; inspección del componente real en Chrome a 1440/1024 px y de Sesión cerrada tras terminar su animación. La geometría SVG coincide con `Box` de la referencia. Los íconos de dispositivo del inventario y los KPI conservan su significado.
- Issue #98: el editor compartido de catálogos replica el modal `stx` de la demo desktop: lista, paleta con selección y nombres, íconos SVG, contadores, eliminación reversible, mensajes y botones. Conserva el amarillo vigente de #95. La lista se desplaza en ventanas de poca altura sin ocultar las acciones.
- La reasignación al eliminar una opción ahora usa el valor final canónico del destino, incluso cuando se crea o renombra en el mismo guardado. Se conserva la transacción PostgreSQL; el editor permanece abierto al fallar y bloquea cierres/ediciones durante una solicitud pendiente.
- Validación #98: TypeScript frontend/backend aprobado, 11 pruebas frontend pertinentes y 4 de backend aprobadas; el coordinador revisó además la suite backend completa, 81/81 con un worker. QA real contra la demo a 1440×900 y 680×600, incluidos paleta, borrados, mensajes, error y estado pendiente. Reasignación a `En diagnóstico` comprobada por API y tras recargar: catálogo y equipo usan `EN_DIAGNOSTICO`, contador 1. Solo se usó PostgreSQL local aislado.
- Issue #97: Canjes reemplaza el kanban por la tabla desk compartida, con código/fecha/cliente/equipos/IMEI, valor de toma/diferencia y estado. Conserva detalle, menú contextual de edición/borrado, crear/importar y agrega orden Recientes/Antiguos. La paginación vigente sigue siendo de 10; #104 se aborda aparte.
- Los filtros de Canjes usan el catálogo cargado más los valores históricos presentes, sin agregar estados borrados por defecto. La tabla incluye registros incompletos y estados personalizados; búsqueda/filtro/orden reinician la página y la eliminación de registros ajusta el paginador. A 1024 px, la tabla se desplaza dentro de su tarjeta y el footer permanece fuera del desplazamiento horizontal.
- Validación #97: frontend/paginador 7/7, E2E existente de Canjes 1/1 y TypeScript frontend/backend aprobados. QA real a 1440/1024 px con 12 canjes, navegación 10+2, estado personalizado/histórico, búsqueda por IMEI, detalle, edición/guardado/recarga, importación abierta y creación/borrado/recarga. Solo DB local aislada. La carrera preexistente de inicialización de catálogos se registra para la auditoría #70.

## Iteración hifi-desk — 2026-10-06

- Ajuste visual #84: los calendarios de Reportes reemplazan el popup nativo por un desplegable del sistema: tipografía DM Sans, superficies blancas, bordes redondeados, selección oscura y acentos lima. Incluye escritura dd/mm/aaaa, selección de mes/año, Hoy/Borrar, navegación por teclado, cierre externo/Escape y ubicación dentro del viewport. Las fechas siguen siendo borradores hasta aplicar el período.
- Validación del calendario: 37 pruebas de calendario, períodos y Reportes aprobadas; TypeScript frontend/backend aprobado. Revisión visual del componente real a 1440 px y del popup en una ventana de 680×600 px, con selección, cambios de mes/año y cierre verificados.
- Issue #84: Reportes incorpora Personalizado con fecha de inicio/fin inclusivas y aplicación explícita. Fechas faltantes, inválidas o invertidas conservan el último reporte válido. Totales, gráficos, listas y CSV usan el mismo período en Ventas, Stock y Canjes; la exportación también respeta el filtro de categoría.
- Stock informa equipos ingresados en el período con su estado actual y explica los registros sin fecha excluidos. Los gráficos cubren todo el rango con hasta 12 barras; fechas YYYY-MM-DD se interpretan y muestran en el calendario local.
- Validación #84 (2026-10-07): 45 pruebas aprobadas, incluidas 29 nuevas de fechas y pantalla; TypeScript frontend/backend aprobado. Revisión del componente real con datos de prueba a 1440/1024 px, rango de seis años y error de fechas invertidas. Sin cambios de API, AppContext o Prisma.
- Issue #85: el rol STAFF se muestra como Empleado en toda la interfaz: invitaciones, equipo, perfil, navegación, login, onboarding y selector de tienda. También se unificaron las referencias anteriores a Vendedor.
- Validación #85: 19 pruebas existentes de Login, Onboarding, Settings y StoreSwitcher aprobadas; TypeScript frontend/backend aprobado. Búsqueda en `src/` sin etiquetas Agente/Vendedor restantes. Cambio de texto, sin modificaciones de permisos, API o base de datos.
- Issue #62: al volver del popup de Google, el login y el registro recuperan el botón sin esperar la respuesta diferida de Firebase. Cierres/cancelaciones no muestran un error; respuestas de intentos anteriores no alteran un reintento.
- Validación: 12 pruebas de Login aprobadas, incluidos foco, visibilidad, reintentos y limpieza al desmontar. TypeScript de frontend y backend aprobado. La autenticación real continúa en Firebase; las pruebas usan promesas controladas y eventos del navegador.
- Issue #81: el indicador de batería hi-fi reutiliza los colores de `main` (rojo <70%, ámbar 70–85%, verde >85%) y anima el llenado con Motion. Conserva rangos y convierte fracciones decimales con los mismos helpers de la referencia.
- Validación #81: revisión en Chrome del componente real con 69/70/85/86/100%, rangos y fracciones; transición de 87% a 40% y llenado de entrada observados. Los 10 tests existentes de los helpers y TypeScript frontend/backend pasaron. Vista temporal de QA retirada.

---

## Estado actual

- Core estable con datos reales en Railway (Postgres + Firebase Auth)
- Inventory es el modulo mas maduro: categorias, import XLSX, inline edit, bulk actions, paginacion, sort
- Trade-ins ya usa TableEngine para el historial, alineado con Inventory, Clients y Sales
- Tests unitarios de frontend + CI con GitHub Actions agregados hoy
- Dashboard sigue siendo demo (Fase 3 pendiente)
- Reports ahora consume SQL real con widgets configurables, rango custom y export local de lo visible

---

## Modulos: estado detallado

### Produccion

| Modulo     | Notas |
|------------|-------|
| Auth       | Google + email/password, `/api/me`, retry automatico cada 15 s |
| Onboarding | Pantalla real para usuarios sin Store/StoreMember; crea contexto antes del core |
| Inventory  | Categorias con tabs, inline edit (dbl-click), bulk select (shift+click), delete, import CSV/XLSX con mapeo de columnas, paginacion (20/pag), sort, columnas custom |
| Clients    | CRUD real en backend |
| Sales      | Transaccional; muta status de inventario y totalSpent del cliente |
| Trade-ins  | CRUD real filtrado por storeId; write path hardened y historial migrado a TableEngine |

### Demo / pendiente

| Modulo        | Estado |
|---------------|--------|
| Dashboard     | No consulta SQL real; KPIs hardcodeados |
| Reports       | SQL real; widgets configurables, rango custom, charts dinamicos y export local |
| Notifications | Preview local, no persiste |
| Settings      | UI presente; sin persistencia real por ahora |

---

## Issues conocidos

### Activos

- `AppContext.tsx` linea ~179: hay un `onSnapshot` a `tradeIns` en Firestore que corre siempre, incluso cuando el backend esta activo. Es redundante con el useEffect de `backendTradeInsEnabled`.
- Sales y clients aun tienen fallback silencioso a Firestore en sus write paths (a diferencia de inventory y trade-ins que ya fueron hardened).

### Resueltos

- Inventory: eliminado fallback fantasma a Firestore cuando el backend esta activo
- Trade-ins: hardened write path
- Trade-ins: historial migrado a TableEngine
- Formularios: ya no cierran el modal antes de esperar resultado async
- Timeout de fetch: 15 s en helpers HTTP
- `batteryHealth`: migrado a `string` para soportar rangos como `"83-85%"`
- Import XLSX: normalizacion de decimales (`0.84` -> `"84%"`)

---

## Roadmap

### Fase 0 - Fundaciones

- Stack real: Firebase Auth + Postgres + Railway backend

### Fase 1 - Sesion y bootstrap

- `/api/me`, onboarding real, retry automatico de sesion

### Fase 2 - Migracion de dominio

- Clients, Inventory, Sales, Trade-ins -> PostgreSQL
- Inventory: categorias, import, inline edit, bulk actions, paginacion
- Trade-ins: historial sobre TableEngine

### Fase 3 - Operacion y reporting

- [ ] Dashboard sobre SQL real
- [x] Reports sobre SQL real
- [ ] Audit logs centralizados
- [ ] Settings con persistencia

### Hardening pendiente

- [ ] Harden write path de Sales (eliminar fallback a Firestore)
- [ ] Harden write path de Clients (eliminar fallback a Firestore)
- [ ] Eliminar doble onSnapshot de tradeIns en AppContext
- [ ] Sincronizar avatarUrl del perfil desde backend

---

## Decisiones vigentes

- Firebase Auth se mantiene por pragmatismo (no migrar a Clerk todavia)
- PostgreSQL es la fuente de verdad del negocio
- Backend propio en Railway es obligatorio para logica sensible
- No dual-write como estrategia permanente
- En modulos migrados: sin fallback silencioso - falla con error visible
- El onboarding bloquea el core hasta tener Store + StoreMember

---

## Riesgos actuales

- Dashboard y Reports en demo pueden generar expectativas falsas en testers
- El origen historico de clients en Firestore estaba vacio (migracion no trajo datos)
- Si un modulo queda a medias en migracion, puede haber mezcla Firestore/Postgres

---

## Handoff para proximos agentes

1. Leer `CLAUDE.md` / `AGENTS.md` (onboarding del proyecto)
2. Leer este archivo para el estado vivo
3. Si tocas codigo, correr `npm run lint` (no build)
4. Actualizar este archivo al cerrar cada iteracion importante
