# iManager - Project Status

- PostHog US (2026-10-26, `feat/posthog`): integración frontend sin cambios visuales, guardas DEV/test/automatización, identidad con IDs internos/tienda/rol y reset de sesión. Eventos de registro, onboarding, inventario, importación, ventas/canjes e invitaciones; replay enmascara texto/inputs/atributos y autocapture omite textos/atributos. Se conservan las métricas internas existentes. Primer equipo observado deduplicado por tienda/navegador; detalles y evidencia en `/workspace/qa-posthog/IMPL.md`. Entrega por PR para revisión, sin merge ni acceso a producción/DB.

- Onboarding · salida de stock (2026-10-25): el paso opcional deja entrar a una tienda ya creada aunque fallen progreso o lecturas secundarias. Decisión local por uid/tienda, sincronización idempotente al entrar/recuperar conexión/foco, sin omitir creación de Store/OWNER ni errores reales de equipos. Registro nuevo probado con salto, Excel, lista, manual y ejemplos; 53 pruebas relacionadas, seis escenarios de navegador y TypeScript frontend/backend aprobados, sin build. Evidencia y entrega en `/workspace/qa-onb-bug/IMPL.md`.
- #374, reporte por mail (2026-10-25): mail HTML/texto variante 1 y pestaña Envío por mail variante 2; semana lunes a lunes, día/hora local, destinatario del dueño, prueba con permisos y límite persistente. Entregas únicas por tienda/período/destinatario, payload congelado y claim atómico; SMTP incierto requiere revisión para evitar duplicados. Worker de una ejecución preparado y apagado, sin servicios nuevos ni acceso a Railway. TypeScript frontend/backend, 49 unitarias backend, 10 integraciones, 107 frontend y E2E relacionado aprobados. Capturas de app y mail claro/oscuro con SMTP falso en `/workspace/qa-reporte-impl/`; activación manual de Resend/cron en `docs/issue-374/mail-activation.md`.

- Detalle de Reclamo (2026-10-25): variante 2 definitiva con equipo/cliente junto al historial, filas de estado/fecha/IMEI/proveedor y textos guardados. Sin flags de QA, wireframes ni variante descartada. Conserva edición en la misma hoja, permisos, errores y navegación de Fallas; historial en segunda hoja/pantalla móvil. TypeScript frontend/backend y 42 pruebas relacionadas aprobados con máximo dos workers. Capturas locales ficticias de abierto/resuelto inspeccionadas a 1440/390 en `/workspace/qa-reclamo/final-*.png`; sin build.

- Detalle de Proveedor, variante 1 (2026-10-25): composición aprobada integrada en el modal real, inversión por moneda y permisos existentes, reloj junto al importe, contacto/stock y tres compras con Ver todas. Retirados wireframes y selector de variantes; sin cambios de otras pantallas ni API. TypeScript frontend/backend y 37 tests relacionados aprobados. QA con DB ficticia a 1440/390: capturas finales idénticas píxel por píxel a la variante 1, sin overflow, historial en segunda hoja y scroll interno a 600 px. Evidencia en `/workspace/qa-prov2/final-{1440,390}.png`; entrega en `/workspace/qa-prov2/IMPL.md`.

- Quitar pagos adicionales (2026-10-24): Venta y Canje usan la variante 1 definitiva, con cruz en el encabezado desde el pago 2, sin flag de QA ni CSS exploratorio. Identificadores estables, renumeración y foco al importe anterior (con alternativa en Agregar pago); el borrador recalcula pagos, excedentes y saldo financiable. TypeScript frontend/backend y 16 pruebas relacionadas aprobados con máximo dos workers, sin build. QA local en API 3550/web 4550 con la DB ficticia existente; cuatro capturas inspeccionadas en `/workspace/qa-pago/final-{venta,canje}-{1440,390}.png`.

- QA de importaciones (2026-10-23): equipos/clientes/ventas recorridos desde Chromium local con DB falsa, archivos de 50 filas, variantes desordenadas/ajenas y stock Mendoza, a 1440/390. Corregidos CSV con comillas/coma decimal, moneda de equipos, ventas repetidas con bloqueo transaccional, filas de venta con precio inválido y presentación de errores. TypeScript frontend/backend y 185 pruebas relacionadas aprobados. Pendientes: identidad de lotes sin IMEI (Mendoza repite 48 unidades), proveedor/fecha en mapeo genérico y diferencias de diseño del modal. Informe en `docs/qa-import/notas.md`; evidencia en `/workspace/qa-import/`.

- Fallas (2026-10-23): renombra Patrones con redirect; resumen exacto de equipos con reclamo y motivo, top 5 de proveedores/compras/modelos por porcentaje, detalle en hojas y vacío de una línea. QA 1440/390 con 90 equipos falsos y seis grupos por ranking; TypeScript y tests relacionados. Detalles en `docs/qa-fallas/notas.md`, capturas en `/workspace/qa-fallas/`.

- Patrones sin pastillas (2026-10-23): Proveedor, Compra y Modelo apilados con títulos existentes, selección independiente, enlaces y caché conservados. TypeScript frontend/backend, 107 pruebas relacionadas y QA local falsa a 1440/390 aprobados, sin overflow ni errores de página. Otros selectores reportados sin cambios en `docs/qa-patrones/notas.md`; capturas en `/workspace/qa-patrones/`.

- Shell Historial/Más y selects (2026-10-23): audit-layout deja de modificar tipografía/ancho del sidenav; Más separa perfil/menú con 16px y restaura la tarjeta. Selects visibles de Historial, Equipos/proveedor, reclamos/venta, catálogos e importación usan DeskSelect. Onboarding conserva sus cinco nativos fuera del desk. TypeScript frontend/backend, 305 pruebas relacionadas, importación E2E y métricas en 22 rutas × 1440/390; Más a 390/360/375 con/sin banner y grupos abiertos/cerrados. Evidencia en `docs/qa-sidenav2/notas.md` y `/workspace/qa-sidenav2/`.

- Corrección sidenav de dos niveles (2026-10-23): Comercial conserva Ventas/Canjes/Devoluciones; Patrones pasa a Análisis con ruta/título propios y permiso Ventas; Resumen periódico queda como hermano con título propio; Catálogo móvil unifica resumen y equipos. Vacío de Patrones explícito y fallos visibles con caché previa; enlaces antiguos canonicalizados sin pasos extra de historial. TypeScript frontend/backend, 194 pruebas relacionadas y QA Chrome local 1440/390 con datos falsos; detalles en `docs/qa-sidenav2/notas.md`, capturas en `/workspace/qa-sidenav2/`.

- Seguimiento CI/PWA (2026-10-23): #535 pasó el gate en 3m48s y todos los shards E2E de main; PWA escritorio expuso una toma de control tardía del worker que anunciaba de nuevo el bundle ya cargado. Se valida el build antes de ese aviso y se descartan respuestas después de desmontar; conserva confirmación y protección de borradores. Diagnóstico y validación en `docs/qa-main-verde/diagnostico.md`.

- #374 / navegación de Resumen periódico (2026-10-23): destino compartido de Análisis con ruta propia y permiso Reportes; GroupTabs conserva el acceso desde Reportes, Comisiones e Historial, y la selección se recupera por URL/recarga/historial. Sin rediseño, API ni schema. TypeScript frontend/backend, 169 pruebas relacionadas, 606 unitarias backend y 7 integraciones del resumen aprobadas; matriz Playwright 24/24 a 1440/390 y capturas antes/después en `/workspace/qa-reporte-nav/`. Corridas globales locales afectadas por saturación y una expectativa ajena de historial de reparaciones; detalle y límites en `docs/issue-374/navigation.md`.
- Sidenav acordeón aprobado por Matias (2026-10-23): shell de escritorio y Más móvil con cero o un grupo abierto, rutas activas, teclado y permisos existentes; sin islitas de navegación. Reclamos/Patrones y vistas de Catálogo móvil accesibles desde menú, filtros conservados. Integrada la ruta propia de Resumen periódico de #534 sin duplicarla. TypeScript frontend/backend, suite frontend completa, regresiones y Playwright 1440/390 dueño/empleado verificados con datos falsos. Decisiones y evidencia en `docs/qa-sidenav-wf/notas.md`; capturas completas externas en `/workspace/qa-sidenav-wf/`. Sin API, Prisma, AppContext, dependencias ni build local.

- Recuperación CI completa de main (2026-10-23, `fix/main-verde`): avisos persistentes sin superponer controles; corrección UTC en cursores/límites del historial de reparaciones; actualización de regresiones según #503/#505/#506/#512/#515/#521/#531. Suite completa en 8 shards E2E y 3 proyectos PWA; smoke de PR y límites conservados. Diagnóstico, primeras corridas y evidencia local en `docs/qa-main-verde/diagnostico.md`. Validación remota en el PR y entrega final.

- Autocompletado de modelo por TAC (2026-10-23, `feat/imei-specs-autocompletar`): tabla local de 18.587 TAC (4147 iPhone + 14.440 Samsung Galaxy), 188 sugerencias Samsung compartidas, CSV curados, generador determinístico, deltas base36 con decodificación perezosa y aviso MIT ampliado. IMEI válido completa solo Modelo en equipo, scan-review, lote y recibido de canjes/ventas; prioridad Apple y ediciones manuales conservadas, sin inferir detalles Samsung. Normalización distingue Samsung S24/S24+ y Note10/Note10+ sin cambiar Apple. Registro silencioso de faltantes: solo TAC de ocho dígitos, deduplicado por sesión, POST autenticado `/api/imei-tac-misses` limitado a 60/min por usuario, modelo Prisma aditivo sin identidad y upsert atómico. Consulta de solo lectura: `GET /admin/imei-tac-misses?limit=100` (1–500), Bearer con email verificado en `ADMIN_EMAILS`, orden por count descendente; dueños de tienda sin permiso de plataforma reciben 403. Control de stock ciego fuera del registro. Validación: TypeScript/lint frontend y backend, 59 pruebas frontend relacionadas, 1877 frontend completas, 606 unitarias backend, 16 integraciones TAC/analytics en DB dedicada local :5433 y 2 del generador, reproducción sin diff. JS del árbol inicial → final: 2.982.711 → 3.028.852 bytes; gzip 834.738 → 861.485 (+26.747). Incremento total frente a HEAD 904ffc2: 43.701 bytes gzip, bajo ~45 KB, sin chunk dinámico. Consulta y evidencia en `openspec/changes/autocomplete-imei-tac/`. Sin dependencias, textos de UI ni pantallas nuevas; sin commit ni push.

- RMA #316 / #483 (2, 2.1, 2.2), ronda visual aprobada (2026-10-23): alta con fecha primero y sin diagnóstico; detalle con resumen, segmentos y próximo paso; historial completo exclusivamente en segunda capa (480 px desktop/pantalla completa móvil), con reloj compartido sin texto. Menú Editar/Anular y hoja móvil con código/cliente, foco contenido y resaltado desktop; anulados con importe «—» y sin acciones; confirmación semántica. Calendario `dp-inline` corrige colisión Tailwind en Reclamos/Alta de ventas/Reportes. Conserva resolución financiera, proveedor, créditos y permisos. Sin API/Prisma/dependencias ni comandos git de escritura. Evidencia y diferencias en `docs/qa-316/frontend-rma.md`; capturas temporales en `/workspace/qa-316/work/`. Lint frontend/backend, suite frontend de 200 archivos y 1.666 pruebas, build solicitado y revisión 1440×900/390×844.

- Proveedores #308, ronda 4 / Devoluciones → Patrones (2026-10-23): segmentos Reclamos/Patrones y Proveedor/Compra/Modelo con endpoint existente, porcentajes/hot, reclamos expandibles y aviso topReason; lista/detalle en escritorio y expansión dentro de lista en móvil. Aviso de Ver proveedor enlazado con proveedor seleccionado, respetando Devoluciones; enlaces de origen requieren Inventario y costos del detalle reutilizado requieren canSeeFinancials. Skeletons compartidos, sin relleno/error secundario, caché por agrupación y aislamiento por usuario/tienda/permisos. Validación: lint frontend/backend, 98 pruebas relacionadas y un flujo crítico local de consulta en 1440/390, sin overflow ni errores de página. Capturas externas en /workspace/qa-308/tmp/D-*.png; archivos y desvíos en docs/qa-308/frontend-patrones.md. Se conservan tokens/azules reales y datos del endpoint; no se inventa la fila de equipo sin reclamo del PNG porque el contrato solo trae claimsDetail. Sin backend/Prisma, build, commit ni push.

- Proveedores #308, ronda frontend B / Inventario (2026-10-22): marca con ícono proveedor · fecha bajo el modelo en tabla y tarjetas; filtro por supplierId en encabezado desktop y junto a Seleccionar en móvil, integrado con filtros, conteo, paginación y estado de navegación. Equipo con enlaces a proveedor/compra, nombre opcional del lote y aviso desde purchaseSummary solo si problems > 0, con skeleton y reserva estable; datos históricos ausentes y fallos secundarios se omiten. Reclamos muestran supplierName cuando existe. Se reutilizan Sheet y el detalle de compra de la ronda A con canSeeFinancials. Validación: lint frontend/backend, 122 pruebas relacionadas y un flujo crítico local de consulta en 1440/390; geometría del modal, garantías y pie idéntica antes/después del resumen demorado, sin overflow ni errores de página. Capturas externas en /workspace/qa-308/tmp/C-*.png y detalle de archivos/desvíos en docs/qa-308/frontend-inventario.md. Tokens/azules reales conservados. Sin backend/Prisma, datos, build, commit ni push.
- Dashboard sin parpadeo de carga (2026-10-23): conserva el último reporte válido en cambios de rango/datos y errores de revalidación; KPIs, tendencia, pagos y ventas recientes cambian juntos con el rango resuelto. Caché de memoria por tienda/uid/rol/secciones y rango, máximo ocho entradas, con miembros y carga inicial resueltos. Cada montaje vuelve al mes actual y recupera solo el reporte de su clave exacta; si no existe (también al cambiar de día/mes), muestra skeleton en la zona del reporte y conserva miembros y carga inicial del alcance. Limpieza al salir/cambiar usuario y descarte de respuestas/escrituras tardías. Reserva invisible de avatares; tabla y pagos se sustituyen por período. Primera carga y permisos conservados. Validación: lint frontend/backend, Vitest completo 205 archivos / 1.705 pruebas con dos workers (incluye remonte desde 7 días/Total y clave ausente tras cambio de día/mes), build solicitado y diff check aprobados. Medición local repetida en 1440-normal/390-normal con `range,nav` (evidencia local en `/workspace/qa-flicker3/`): cero skeletons en rangos y navegación; cero layout shifts > 0,0005 en 1440 y navegación móvil. Persiste el salto de contenido de Total en 390 (dos eventos de 0,0166): el margen con porcentaje ocupa dos líneas y eleva la primera fila de KPI de 126 a 160 px; chip dólar estable de 194×36 y gráficos con altura estable.

- Proveedores #308, ronda frontend A y #483 punto 13 (2026-10-22): lista con última compra y pastilla responsive de problemas; ficha de 540 px con contacto, nota, tres compras y «Ver todas»; detalle de compra con IMEI/estado y costos sujetos a canSeeFinancials. Historial/detalle usan Sheet compartido, segunda capa desktop y pantalla completa móvil con Volver. «Cargar stock» reutiliza EquipmentForm e ImportHost con proveedor fijado (también en escaneo), conserva errores y refresca ficha/historial tras persistir. Patrones todavía no existe: aviso informativo sin enlace; pendiente conectar en la ronda siguiente. Se mantienen los colores semánticos reales, incluido el avatar azul. Validación: lint frontend/backend, 148 pruebas relacionadas y un flujo crítico de alta móvil con backend local y persistencia tras recargar; revisión 1440/390 de A/B/E, sin overflow horizontal. Evidencia temporal en /workspace/qa-308/tmp/; alcance, archivos y desvíos en docs/qa-308/frontend-proveedores.md. Sin backend/Prisma, build, commit ni push.
- Boot/refetch sin parpadeos (2026-10-22, `fix/boot-flicker-polish`): splash HTML externo y estático `#F7F8FA`, salida única de 100 ms tras auth/sesión/lecturas iniciales y pantalla sin placeholders pendientes; helpers compartidos con PWA. Identidad por uid y tokens reales mediante ref; listas esperan tienda/permisos y conservan referencias iguales mediante structural sharing, sin limpiar datos ni reactivar loading en refetch. Retiradas cargas duplicadas de onboarding-progress desde banners/Primeros pasos; caché de listas parseada una vez por montaje.
- PWA difiere actualización visible hasta hidden seguro; regreso con pendiente tras tres minutos usa splash antes de reload, manteniendo guardas de formularios y bucles. Compuerta de listas/billing de 15 s desde finalización, mutaciones inmediatas; health a 5 s y pausado oculto. Sin fades de ruta, overlays breves con scrim independiente y hoja móvil opaca, skeletons estáticos diferidos 180 ms, reduced-motion global. Chip dólar reservado, avisos fuera del flujo y contacto después del splash; catálogo público conserva datos ante fallos de revalidación.
- Validación final: lint/typecheck frontend y backend; 202 archivos / 1.675 pruebas Vitest en 82,01 s; PWA 15/15; build solicitado aprobado (avisos existentes por chunks/imports), diff check limpio. Sin E2E nuevos, cambios de backend/Prisma, dependencias ni comandos git de escritura. Pantallas/tests/CSS específicos del Dashboard intactos: persisten `setReport(null)` ante cambios reales y recarga de overview al remontar la ruta. Detalle A–H, límites y lista completa de archivos en `docs/boot-flicker-polish.md`; OpenSpec `fix-boot-flicker-polish` sin archivar.

- Dashboard v3 aprobado (2026-10-22): recupera tokens/clases compartidas (`dstats`, `dstat`, `dcard`, `dch`, `dgrid`, tabla compacta y `phone-rows`) y retira `.dashboard-v2`. Ventas neutral, cinco registros desktop/cuatro móvil por rango; Contanos oscuro con WhatsApp y selector de 420 px con cinco presets. Conserva Total, recálculo, permisos y carga coordinada. Revisión visual con fixtures a 1440/390: mismas posiciones/alturas en skeleton inicial, espera de overview y datos finales. Typecheck/lint de ambos paquetes, 1.647 pruebas frontend y 572 unitarios backend aprobados; selectores E2E existentes adaptados, sin E2E nuevos ni ejecutados. OpenSpec `align-dashboard-v3` y body en `docs/qa-dashv3/pr-body-v3.md`. Sin Prisma, build, commit ni push; cambios en working tree.

- Resolución en working tree del merge de `origin/main` en `feat/dashboard-total-ajustes` (2026-10-22): conservados Total sin fechas/comparación, recálculo por rango y carga coordinada; integrado #515 para ocultar mensajes de fallos de red también en Total y con backend desconectado. Sin subtítulos ni textos visibles de carga o acciones rojas de reintento. Conservadas ambas entradas de estado y el reloj fijo de las pruebas de novedades. Regresión adicional para Total con respuesta demorada y fallo de red. Sin build, commit, push ni escritura del índice; `.git` de solo lectura.
- Validación del merge: typecheck/lint frontend y backend aprobados (`tsc --noEmit` en ambos scripts); unitarios backend 81 archivos / 572 pruebas. Vitest completo inicial 198 archivos / 1.642 pruebas aprobado; tras agregar la regresión, una pasada tuvo cuatro timeouts de interacción (5 s), todos aprobados aislados (19/19). Pasada completa final con `npx vitest run --maxWorkers=2`: 198 archivos / 1.643 pruebas aprobados, sin cambiar timeouts ni pruebas ajenas. `git diff --check HEAD` aprobado y los tres archivos sin marcadores de conflicto; el índice conserva los conflictos pendientes por ser de solo lectura.

- Ajustes Dashboard posteriores a #512 (2026-10-22), alcance acotado: Total sin fechas/comparación y series mensuales; recálculo de métricas y ventas recientes por rango; carga coordinada sin cifras parciales. Stock, canjes activos no anulados y deuda neta pendiente conservan alcance actual, sin variación ni atenuación al cambiar período; métricas sin permiso de lectura se omiten.
- Se conservan las filas de ventas recientes (cinco desktop, cuatro móvil), bentos, tarjetas y estilos de #512. `ui.tsx`, `desk.css` y selectores E2E sin cambios respecto de HEAD. Sólo se agregan espacio/wrap para Total y reservas mínimas para Skeleton y layout estable.
- Auditoría y body en `docs/qa-dashv3`; sin documento de rediseño. Validación del alcance acotado: typecheck/lint frontend y backend aprobados; Vitest completo 196 archivos / 1.585 pruebas; unitarios backend 81 archivos / 572 pruebas; `git diff --check` aprobado. Sin Prisma, build, E2E nuevos ni commit; cambios en working tree.

- Variante B completa de Historial #372 (2026-10-22): consulta de solo lectura al control cerrado por entityId con fetchStockCount existente; cuatro selectores con Sin escanear inicial y contadores exclusivamente del evento. Lista del bucket con modelo · capacidad, IMEI, ícono compartido, tarjeta con borde, scroll interno y degradé inferior mientras quedan equipos por ver. Sheet/tokens y encabezado/Ver control fijos; carga, errores, ausencia de datos y falta de permiso sin mensajes ni Reintentar. Respuestas tardías descartadas. Corregida la afirmación anterior: GET /api/stock-counts/:id sí devuelve buckets guardados. Typecheck frontend/backend y 116 pruebas Vitest relevantes aprobados; OpenSpec `mobile-stock-history-v2` actualizado. Sin backend, build, E2E, commit ni push.

- Detalle de Historial modal-v3 #372 (2026-10-22): variantes A/C con comparación real o valores nuevos sin Antes/Después; autor y fecha en una fila, sin subtítulos extra. Sheet compartido con variante detail y tokens: 480 px centrado, máximo viewport menos 96 px, header/footer fijos y scroll interno; móvil con handle, máximo 85 %, una acción negra de ancho completo y safe area. B inicialmente mostró solo los contadores guardados; la lista por grupo se completa en la entrada de variante B de esta sesión. Ver control lleva a la pestaña existente con permiso de Inventario. Retiradas las reglas antiguas que desplazaban el detalle. Typecheck frontend/backend, 149 pruebas Vitest relevantes y última pasada 38/38 aprobados; previews de componentes revisadas en 1440/390. OpenSpec `mobile-stock-history-v2` actualizado. Sin backend/Prisma, E2E nuevos/ejecutados, build, commit ni push.

- Móvil v2 #318/#372 (2026-10-22): referencias de `redisenio-372-318/mobile-v2/src` aplicadas hasta 760 px. Encabezado sin chrome de tienda, pestañas segmentadas, cuatro grupos en una fila, cinco equipos con IMEI y expansión; Registrar conteo de 50 px en franja blanca fija con espacio reservado sobre la nav. Inicio simplificado a alcance y CTA. Historial con búsqueda/período en una fila, Persona/Acción/Sección ocultos en móvil y primer nombre junto al registro. El detalle conserva estilos/overflow; solo omite Después sobre valores sin Antes real en todos los viewports. CSS fuera del breakpoint comparado con HEAD e idéntico, incluidos 1024/1440. Typecheck frontend/backend y 122 pruebas Vitest de componentes/regresión aprobados; expectativas E2E existentes ajustadas, sin ejecutar ni agregar E2E. OpenSpec `mobile-stock-history-v2`; sin build, commits ni push.

- Historial #372 (2026-10-22): el detalle omite Antes y la flecha por campo cuando el valor anterior es null, vacío, espacios o —; Después ocupa el ancho disponible y se conservan comparaciones con valores reales, incluido "0", y Después ausente. Cobertura de componentes para cierre de control de stock y filas mixtas en escritorio/móvil. Typecheck frontend/backend y 55 pruebas Vitest relevantes aprobados. Sin selectores E2E afectados, E2E nuevos ni build; commit en español en la rama actual, sin push.

- Actualización visual #318/#372 (2026-10-22): nuevas referencias aprobadas desde `redisenio-372-318/propia/src`, con CSS específico, tarjetas de grupos, tres pasos, filas compactas expandibles, filtros en una fila móvil y modales de 520 px/hojas inferiores. La acción de iniciar otro control queda en el paso Contar, con nombre accesible Iniciar control, sin agregar una acción al encabezado del diseño. Tras integrar `origin/main`, el acceso desde Inventario es exclusivamente por pestaña, sin el botón antiguo ni la flecha de regreso; se conservan los encabezados sin subtítulos y la etiqueta móvil Control del diseño aprobado.
- Conserva operaciones, permisos, cuatro grupos, errores y diferencias basadas exclusivamente en cambios registrados. Alcance disponible presentado desde el inventario ya cargado; sin cambios de API, backend ni AppContext. Antes/Después admite varios campos y valores ausentes; no duplica el separador de capacidad de etiquetas históricas.
- Validación del ajuste: 121 pruebas Vitest relevantes; typecheck frontend/backend; comparación visual de componentes con fixtures a 1440/390 contra el HTML entregado. Coinciden posición y tamaño de los bloques principales desktop y del resumen móvil de stock; historial móvil difiere 1 px en posición vertical. Sin desborde horizontal a 390; última fila accesible sobre la acción y navegación. Solo se actualizaron selectores E2E existentes, sin ejecutar ni agregar E2E. Sin build; commit local en la rama actual, sin push.
- Validación del merge con `origin/main`: typecheck frontend/backend aprobado y 349 pruebas Vitest relevantes verificadas en 25 archivos. La tanda tuvo un timeout de 5 s en filtros de Inventario; el archivo completo pasó al repetirlo aislado (25/25). Adaptadas las pruebas al componente sin props de navegación y a la etiqueta móvil Control, conservando la regresión de acceso exclusivo por pestaña. Merge concluido en la rama actual, con mensaje en español y sin push ni build.

- #372 Historial rediseñado según referencias aprobadas de 1440/390: persona, acción, registro con IMEI y hora; agrupación por fecha argentina completa y descendente, 30 días iniciales y filtros con valor visible. Mantiene Cargar más y cuenta movimientos mostrados, con errores/reintentos y descarte de páginas tardías.
- Detalle #372: modal desktop y hoja inferior mobile con identidad, rol y fecha/hora; Antes/Después solo desde cambios estructurados, texto histórico y motivo registrados. Navega al registro únicamente con destino existente y permiso; los errores de archivados conservan el detalle abierto. La API agrega IMEI desde inventario y cliente de venta existentes; búsqueda IMEI aislada por tienda. Sin cambios de Prisma, AppContext ni datos de negocio.
- Validación #372: TypeScript frontend/backend; 76 tests frontend, 12 unitarios backend y 4 integraciones con PostgreSQL local exclusivo `imanager_372_test`. Revisión visual del componente real con datos de prueba a 1440/390 (modal 578×420 y hoja 390×465), sin build ni E2E. Commit en rama actual, sin push por instrucción del pedido.
- Ajustes #372: chip de sección alineado a la derecha en la misma línea que el IMEI/subtítulo móvil; vacío con padding, borde y tipografía compartidos con las otras pantallas. Typecheck frontend/backend y 19 tests de HistoryScreen aprobados, incluida limpieza de filtros desde el vacío; revisión visual a 390/1440, sin build ni push.

Documento vivo. Se actualiza al cerrar cada iteracion importante.
**Ultima actualizacion: 2026-10-22**

## Dashboard v2 — Referencias aprobadas — 2026-10-22

- Dashboard desktop/celular con cuatro KPI, tendencia SVG agrupada por día/semana/mes, medios de pago, ventas recientes y accesos a canjes/saldos. Calendario flotante de rango con borrador/Aplicar en desktop; mes y CTA en móvil. Se reutiliza la isla existente de Primeros pasos encima del calendario y la navegación real del shell.
- Finanzas desde `/reports/overview`, sólo con permiso y sesión lista; respuestas tardías descartadas y vacíos discretos. Stock/canjes/saldos/ventas recientes conservan AppContext. Sin cambios de Prisma, AppContext, Figma ni build.
- Hallazgo del 398 %: cálculo local divergente del Dashboard, posible desborde de fecha anterior y fechas futuras actuales; no se atribuye el valor productivo sin sus datos. Backend ya comparaba ventanas contiguas de igual duración. Ahora excluye anuladas también en la base, omite bases menores a una unidad y agrupa por calendario argentino. Informe en `docs/dashv2-hallazgo-398.md`; copiar al destino solicitado en `/workspace` está impedido por el filesystem de sólo lectura.
- Validación: 1.535 tests frontend, 569 unitarios backend, regresiones finales del área y TypeScript/lint de ambos paquetes. Cuatro E2E existentes de Dashboard/menús pasaron con PostgreSQL local exclusivo `imanager_dashboard_v2_test`; los 12 de detalle no pudieron iniciar por falta de WebKit y dependencias del sistema (el binario se descargó en `/tmp` sin instalar paquetes globales). Selectores existentes actualizados, sin casos E2E nuevos. Commit impedido por `.git` de sólo lectura (`index.lock`); cambios locales en `feat/dashboard-redisenio`, sin push. Capturas locales desktop 1440×1100, móvil 390 px y selector en `/tmp/dashboard-v2-shots`; sin errores de página ni desborde horizontal.

- Integración de `origin/main` en `feat/dashboard-redisenio`: conflicto documental resuelto conservando ambas entradas completas; encabezados sin subtítulos y cargas secundarias compatibles con Dashboard v2. Typecheck frontend/backend, 1.560 tests frontend y 569 unitarios backend aprobados. Sin cambios de código, build, commit ni push; resolución en working tree, con índice pendiente por `.git` de sólo lectura.

## Conectividad sin avisos visibles — 2026-10-22

- Retirados el aviso global de conexión y los mensajes locales de cargas, incluidos catálogo público, sesión, invitaciones, Servicio y Notificaciones. Los fallos de red no generan mensajes sustitutos ni vacíos; las acciones conservan errores neutrales y no se cierran como éxito.
- `NETWORK_ERROR_MESSAGE` sigue como señal interna: se conservan sondeos de salud, reconexión y reintentos automáticos de cargas y borradores. Regresiones de componentes sin contenedor global, autenticación, catálogo y acciones; expectativas E2E existentes actualizadas, sin agregar ni ejecutar E2E.
- Validación: lint/typecheck frontend y backend, 1.566 pruebas en la suite Vitest completa, 130 pruebas de regresiones y 160 pruebas posteriores a los ajustes finales aprobados; diff check limpio. OpenSpec `hide-connection-messages`. Sin cambios de backend/Prisma, build, commit ni push.

## CI — Objetivo de PR menor a cinco minutos — 2026-10-22

- Frontend, E2E y PWA usan la imagen oficial de Playwright derivada del lockfile, sin apt ni descargas de navegadores durante el job. E2E conecta al servicio PostgreSQL por hostname; instalaciones npm de frontend/backend una vez por proyecto y en paralelo, con cachés ajustadas a los lockfiles necesarios. Mantiene pruebas, selección PR/full, dos shards frontend, integración backend serial y cancelación existentes.
- YAML/shell, condiciones de tests, propagación de errores de instalación y typechecks frontend/backend validados. Vitest local: 1.485 pruebas y 183 archivos aprobados en 85,95 s; siete suites de navegador fallaron al iniciar Chromium por restricciones del sandbox, dejando 42 pruebas sin ejecutar. OpenSpec `ci-under-five-minutes`; sin build, commit ni push. Falta medir la duración total y validar los contenedores en el próximo PR de GitHub.

## Control de stock — Acceso por pestaña — 2026-10-22

- Retirado el botón antiguo del encabezado de Inventario en escritorio y móvil, junto con el estado local, el montaje alternativo y el modo con flecha de regreso. La pestaña y su ruta conservan el flujo de conteo; Carga en serie mantiene sus estilos compartidos.
- Componentes actualizados y regresión de navegación por pestañas en escritorio/móvil; el selector E2E usa `getByRole('tab', { name: 'Control de stock' })`. Typecheck frontend/backend y 93 pruebas Vitest de conteo, Inventario y navegación aprobados. Sin build ni ejecución E2E; commit en español en la rama actual, sin push.

## Issue #308 / #483 punto 13 — Confirmaciones de archivo — 2026-10-22

- Proveedor y gasto reemplazan su Sheet por ReasonSheet al archivar: un solo diálogo montado. Cancelar o cerrar recupera el detalle sin refetch ni skeleton y conserva las ediciones del gasto. Los fallos mantienen motivo y error; el éxito cierra todo.
- Validación: 74 pruebas de overlays y TypeScript frontend/backend aprobados. Sin cambios de layout, textos, backend ni Prisma; sin build. Entrega en un único commit local con el mensaje solicitado, sin push.

## Issue #318 — Control de stock — 2026-10-22

- Rediseño aprobado en 1440/390: resultado reciente con estado Por revisar, cuatro grupos con IMEI completo y controles anteriores. Inicio mínimo en Sheet (hoja inferior móvil); registro únicamente mediante RECORD, sin selección ni acciones de archivar/cargar/ajustar inventario. Continúa el conteo abierto y conserva lector, ingreso manual, cámara y permisos.
- Base y exclusiones limitadas a DISPONIBLE, sin cambios de Prisma ni reescritura de fotos históricas. Sin escaneos usa lenguaje de observación; historial con Sin escanear / Sin cargar. Espacio inferior y scroll con reserva para navegación y safe area.
- Tests de componentes cubren inicio, ciegas, cámara/manual/lector, grupos, errores, permisos, históricos y RECORD sin mutación; unitarios e integración PostgreSQL cubren el filtro de estados, exclusiones, aislamiento y registro. Evidencia de revisión visual sintética y comandos en `docs/stock-count-redesign-318.md`. Sin build ni E2E; commit en la rama actual, sin push.

## Cargas secundarias discretas — 2026-10-22

- Resumen periódico, catálogo y selectores de vendedores muestran vacíos neutrales ante fallos de consulta. Se ocultan avisos y reintentos de señas secundarias, Primeros pasos, vista previa de catálogo, contador de comisiones y datos archivados complementarios. Los filtros de archivados conservan sus vacíos existentes y las listas activas permanecen disponibles.
- Las consultas fallidas registran la causa original con `console.warn`; estados e imports de error/reintento retirados. Guardados, pagos, aplicación/cancelación de señas y eliminación conservan sus errores visibles. Una consulta de vendedores tardía no sobrescribe un error de guardado, y una consulta de señas fallida conserva el crédito conocido del cliente.
- TypeScript frontend/backend y 263 pruebas afectadas aprobados. Suite completa: 1.515/1.516 aprobadas; un timeout en la prueba existente de Chromium `sheet-compatibility` pasó al repetir el archivo aislado (7/7). Cambio OpenSpec `quiet-load-failures`. Sin build ni nuevos E2E; commit en `fix/ocultar-errores-secundarios`, sin push, según el pedido.

## Issue #374 — Resumen periódico dentro de Reportes — 2026-10-22

- Pestaña «Resumen periódico», quincenas/meses calendario cerrados según zona de la tienda, selector histórico y tres bentos v3b sin textos secundarios innecesarios. Cada «Ver todas» abre su lista completa en el modal Sheet compartido, sin navegación, con cierre y foco accesibles. Estados vacío, skeleton y error/reintento; móvil 390 px y desktop 1440 px, permisos y moneda compartidos con la aplicación.
- Endpoint de solo lectura por tenant. Ventas anuladas visibles y excluidas del total; reintegros/notas ubicados por resolución comercial, aun durante RMA pendiente. Diferencias desde snapshots de conteos cerrados, deduplicadas por IMEI; conserva autorización de resultados de conteos.
- Validación v3b aprobada: 1.469 pruebas frontend (incluidas 16 del componente), suite unitaria backend, 396 integraciones PostgreSQL locales, typecheck/lint frontend/backend y un E2E de los tres modales en ambos tamaños. Detalles en `docs/issue-374/README.md`; OpenSpec `periodic-summary-374`. Wireframes de pantalla y modal regenerados antes de cambiar código en `/workspace/imanager-local/shots/374/`.
- Sin cambios de Prisma ni scheduler SMTP, build, escrituras productivas, commits, push, ramas o PR. Cambios en working tree.

## Issue #483 punto 13 — Modal de proveedor — 2026-10-22

- Ficha con contacto adaptable, notas separadas y compras con padding, divisores, IMEI completo y estado por equipo. Pie fijo con Registrar equipo y menú compartido para Subir stock, Editar y Archivar; restauración conservada para archivados. Alta/edición en una columna con separación entre campos y sin texto secundario redundante. Guardado bloquea controles, cierre y envíos repetidos; fallos visibles conservan el borrador y la ficha permite reintentar su consulta.
- Validación: 1.453 pruebas frontend (14 nuevas de Proveedor), 59 regresiones del área, lint/typecheck frontend/backend, OpenSpec estricto y diff check aprobados. Playwright local en 1440×900 y 390×844 con iPhone 13 emulado: ficha, alta/edición persistidas tras recargar, menú, cancelación de archivo, guardado pendiente/fallido, contacto y compras extensas, scroll, vacío, skeleton y error/reintento; sin desbordes, superposiciones ni errores de página. Estados extremos y fallos simulados por intercepción HTTP local.
- Capturas previas de main, wireframe previo generado con imagegen y evidencia externa en `/workspace/imanager-local/shots/483-j/`. OpenSpec `supplier-modal-483-j`; estilos exclusivos de Proveedor. Un commit en `feat/483-medios`, PR #495 sin merge; sin imágenes/prompts versionados, build, backend, AppContext, Prisma, producción ni cambios en puntos previos o 6/8/14.

## Issue #483 puntos 11 y 12 — Importador compacto — 2026-10-22

- Un único ImportModal/Sheet para stock, proveedores, clientes, ventas y la alternativa de planillas del onboarding: 600 px desktop y bottom sheet móvil, DM Sans, modos CSV / Subir .txt / Pegar listado, dropzone accesible, preview virtualizada compacta con errores por fila y footer con acción principal. Edición/exclusión de texto, ajuste de hojas/encabezado/mapeo y errores de persistencia conservados; cierre bloqueado durante guardado y respuestas tardías descartadas al volver.
- Sin cambios al parser ni API: CSV conserva XLSX y stock conserva el analizador de texto; clientes, ventas y consumidores sin analizador libre reutilizan parseWorkbook CSV para TXT/listados con columnas. No se alteran las reglas de importación parcial ni los valores por defecto.
- Validación: 1.439 pruebas frontend, 69 pruebas del área (9 nuevas) y 7 E2E existentes de importación aprobados; lint/typecheck frontend/backend, diff check y OpenSpec estricto aprobados. OpenSpec informa que el spec base inventory-import carece de sección Requirements; es previo y sólo afecta su futuro archivado. Playwright local en 1440×900 y 390×844 (iPhone 13): tres modos, previews de stock/clientes/ventas, corrección de precio y ausencia de desbordes/errores de página. CSV de stock con mapeo y persistencia PostgreSQL fake comprobada tras recargar en ambos tamaños; texto de stock usa intercepción del análisis sin llamadas externas.
- Referencias de main, mockup previo generado con imagegen y capturas finales en `/workspace/imanager-local/shots/483-i/`, fuera del repo. OpenSpec `redesign-import-modal-483-i`; rama `feat/483-medios`, un commit y checklist 11/12 del PR #495. Sin build, backend/Prisma, operaciones productivas, merge ni cambios en 6/8/14 o puntos anteriores.

## Issue #483 punto 4 — Historial en segundo modal — 2026-10-22

- Los seguimientos de Stock, Ventas y Canjes (antiguos e integrados) ofrecen un botón Historial con reloj. Retirados el historial inline y los enlaces Ocultar historial/Ver todo de esos detalles. Segundo Sheet superpuesto con timeline, cambios, motivo, autor y fecha/hora completa; cerrar devuelve el foco y conserva el detalle/borrador.
- Consulta bajo demanda y carga de todas las páginas del mismo registro dentro del modal. Skeleton sin texto visible, vacío breve y error con reintento; las respuestas tardías se descartan al cerrar/cambiar registro, usuario o tienda. Clientes, Reparaciones y la sección general Historial conservan su comportamiento.
- Validación: suite completa frontend (1.427 pruebas) y regresiones de componentes, lint/typecheck frontend/backend, OpenSpec estricto y diff check aprobados. Revisión Playwright local en 1440×900 y 390×844 (iPhone 13): apertura/cierre, foco, borrador conservado, skeleton, reintento y paginación de 51 eventos; sin overflow ni errores de página. API/datos fake locales y estados de consulta sintéticos por intercepción HTTP. Referencias, mockup previo generado con imagegen y capturas finales externas en `/workspace/imanager-local/shots/483-h/`.
- Sin cambios de backend, AppContext o Prisma ni producción/build; puntos previos conservados y 6/8/14 fuera del alcance. OpenSpec `record-history-modal-483-h`; un commit sobre `feat/483-medios`, PR #495 sin merge.

## Issue #483 punto 3 — Novedades vistas por sección — 2026-10-22

- Equipos, Ventas, Canjes y Clientes guardan en PostgreSQL las versiones vistas por usuario y tienda. Abrir la sección limpia sus badges desktop/móvil; la instantánea de entrada queda primero antes de paginar, con punto/fondo sutil y el tratamiento de anuladas intacto. Los cambios posteriores quedan pendientes para la próxima visita; fallos visibles con reintento, sin modificar las lecturas de la bandeja de notificaciones.
- Prisma exclusivamente aditivo: `SectionRecordView` y relaciones. Validación: 1.393 pruebas frontend, 522 unitarias backend, 3 integraciones PostgreSQL locales, lint/typecheck de ambos paquetes y OpenSpec estricto aprobados. Playwright local en 1440×900 y 390×844 (iPhone 13): cuatro secciones, limpieza/persistencia del badge, prioridad, anuladas y edición concurrente verificados, sin overflow ni errores de página.
- Evidencia externa al repo en `/workspace/imanager-local/shots/483-f/`; sin capturas ni prompts versionados, build, operaciones productivas o cambios a los puntos 6, 8 y 14. OpenSpec `section-novelties-483-f`; rama `feat/483-medios`, un commit para este punto y PR #495 a main sin merge.

## Issue #483 puntos 2.1 y 2.2 — Reclamos — 2026-10-22

- Modal con borrador de estado, nota opcional, diagnóstico/resolución separados, seguimiento compacto con fecha/hora y footer Cancelar/Guardar. RMA persiste únicamente al guardar; errores conservan el formulario y el envío bloquea repetición.
- Click derecho, long-press y ⋯ abren Editar/Eliminar. Edición precargada con calendario compartido y vínculo a venta fijo. Eliminar confirma y registra ANULADO, fecha, usuario, evento y auditoría; sin borrado físico ni restauración. Fila roja con importe tachado; exclusión de Activos y de contadores/importes de reclamos y ganancia neta, incluso sin deletedAt. La baja conserva movimientos de caja/stock ya registrados y lo aclara cuando hay resolución.
- Validación: 1.412 pruebas frontend, 533 unitarias backend y ocho integraciones de Reclamos con PostgreSQL local; TypeScript frontend/backend, OpenSpec estricto y diff check aprobados. Verificación real con Playwright a 1440×900 y 390×844 (iPhone 13): edición, estados/notas, cancelación, menús, long-press y persistencia tras recargar; sin desborde ni errores de página.
- Evidencia fuera del repo: `/workspace/imanager-local/shots/483-g/` (antes, wireframe imagegen y después). OpenSpec `redesign-return-claims-483`. Sin cambios de Prisma ni producción, sin build. Rama `feat/483-medios`, PR #495; puntos anteriores conservados y 6/8/14 fuera del alcance.

## Issue #483 punto 5 — Capacidad duplicada al registrar equipo — 2026-10-22

- El selector compartido de alta/edición agrupa capacidades GB/TB equivalentes de base, catálogo e inventario, ignorando espacios y mayúsculas de unidad. Conserva etiquetas/orden del catálogo y el valor histórico al editar; capacidades personalizadas distintas siguen disponibles. Se retiraron los subtítulos redundantes del formulario.
- Validación: cinco regresiones reproducidas antes del fix, 56 pruebas Vitest relevantes aprobadas (10 nuevas), TypeScript frontend/backend y diff check aprobados. Doce capturas locales desktop/iPhone 13 en `.shots-483/`, cero pasos fallidos. Mockup previo `.wireframe-483.png`; OpenSpec `fix-equipment-capacity-483`.
- Script `.shots-483.mjs` con puerto 4210 por defecto; verificado contra este worktree en 4213 porque 4210 sirve otro checkout. Sin cambios de backend/Prisma, build, formularios enviados a DB, commit, push ni PR; puntos 6, 8 y 14 fuera del alcance.

## Issue #375 — Filtros de columnas y Compras del cliente — 2026-10-22

- Opciones de filtros compartidos en una línea, con elipsis y contador separado; menú contenido en el viewport. Compras muestra IMEI completo, tres registros y modal superpuesto; vista móvil completa con regreso a la ficha.
- Garantías vigentes, por vencer en hasta 30 días calendario y vencidas con fecha completa. Anuladas visibles en rosa con importe tachado y pill; excluidas de importes, contadores y garantías. Carga de anuladas/productos archivados y vendedores al abrir Clientes; recálculo histórico backend excluye CANCELADA/ANULADA y voidedAt, incluso al modificar únicamente el estado.
- Validación: TypeScript/lint frontend/backend, 1.257 pruebas frontend y 520 unitarias backend aprobadas. Capturas y pruebas de componentes a 390×900 y 1440×900 en `docs/issue-375/`. Sin nuevas pruebas E2E, build, migraciones ni escrituras a bases reales. OpenSpec: `fix-client-purchases-375`. Cambios en working tree, sin commit, push ni PR.


## Issue #466 — Invitación de instalación PWA — 2026-10-21

- Un banner blanco sólo en Dashboard móvil después de 30 segundos elegibles; navegación, pestaña oculta y formularios/diálogos globales o locales lo retiran inmediatamente y reinician la espera. Android con/sin prompt e iOS con guía por navegador; desktop y standalone quedan excluidos.
- Ahora no aplaza siete días; No volver a mostrar quita banner/tarjeta de Más y deja instalación en Ayuda. Primeros pasos conserva progreso y remite a Ayuda tras el descarte permanente. Preferencia v2 con migración conservadora, memoria si falla almacenamiento, sincronización y vencimiento en sesiones abiertas. Prompt con resultados explícitos y consumo único, sin confundir aceptación con instalación real.
- Validación: 1.182 pruebas frontend, 516 unitarias backend, 362 integraciones locales en seis particiones secuenciales, 15 pruebas PWA y cinco E2E simulados aprobados; TypeScript/lint frontend/backend, OpenSpec estricto y diff check aprobados. Once PNG a 390×844 y 1440×900 en `docs/issue-466/`; iPhone emulado en Chromium porque WebKit carece de bibliotecas del sistema. Sin comprobación física de instalación ni reproducción autenticada productiva.
- OpenSpec: `fix-install-invitation-466`; comandos y límites en `docs/issue-466/README.md`. Sin cambios de navegación/estructura de Más, AppContext, backend o Prisma. Sin build, despliegue, commit ni push; únicamente DB local `imanager_test`.

## Issue #450 — Navegación móvil y significado de indicadores — 2026-10-21

- Revisión del check `test` E2E: Comisiones comprueba el contador explicado y abre opciones antes de seleccionar; Clientes vuelve a expandirlas tras recargar y el recorrido del escáner las abre antes de Carga en serie. La medición del menú de reglas espera la animación del Sheet sin reducir el mínimo de 44 px (20 repeticiones aprobadas). Suite completa con código 0: 296 aprobados, 1 intermitente aprobado al reintentar y 7 omitidos; frontend (1128), backend unitario (516), integración local (322), PWA assets/worker/servidor (15) y TypeScript/lint aprobados. Sin cambios de aplicación/backend/Prisma ni imágenes versionadas; reproducción y límites en `docs/issue-450/README.md`. Cambios sin commit ni push.
- Corrección del CI `39671052307`: el test de actualización tras guardar contaba también el `replaceState` del shell como navegación. Ahora cuenta peticiones del documento principal y espera su carga, manteniendo las verificaciones de persistencia y recarga única. Suites frontend (1128), backend unitario (516), integración local (322), PWA assets/worker/servidor (15) y TypeScript/lint aprobados. El escenario PWA corregido pasó en desktop Chromium, Android e iPhone WebKit con servicios sintéticos, sin build ni retries. Cambios de esta revisión en working tree, sin commit ni push.
- Cada módulo nuevo abre `.stage` arriba. Atrás/Adelante y Volver desde Más restauran la entrada anterior; Inventario, Ventas y Clientes recuperan búsqueda, filtros, orden y página por entrada. La memoria se aísla por usuario/tienda/permisos, sin guardar datos de negocio ni formularios. Edición, búsqueda y cargas no reinician el scroll.
- Indicadores conservan las sumas y explican avisos sin leer, canjes en curso, órdenes abiertas, seguimientos y personas con comisiones pendientes. Descripciones accesibles en barra/lateral/pestañas, explicación desplegable en el grupo y detalle en Más; Proveedores sigue en Finanzas y todas las etiquetas móviles permanecen visibles.
- Opciones móviles secundarias plegadas; menús contenidos y acciones táctiles. Selección reemplaza al dock desde cero seleccionados, conserva navegación y reserva altura real para llegar a última fila/paginación a 320/390 px. Sin cambios de backend, API, AppContext, Prisma ni escáner.
- Validación: 1128 pruebas frontend, 516 unitarias backend, 322 integraciones PostgreSQL locales y TypeScript/lint aprobados; evidencia en `docs/issue-450/README.md`. Fixture automatizado del shell real con contexto sintético, antes/después en 320×844, 390×844 y 1440×900, incluyendo historial, búsqueda, página, modales, selección, carga, vacío y error. Sin despliegue local completo.
- Main base `2e5f50b`; versión HTTP servida `60658746e56ddaa2` registrada sin caché/PWA, sin sesión productiva para acreditar el recorrido servido. OpenSpec: `fix-mobile-navigation-450`. Cambios en working tree, sin build, commit ni push.

## Issue #461 — Concurrencia y consultas por lote — 2026-10-21

- Cobros/movimientos, edición y archivo de clientes, importaciones y presupuesto de reparaciones usan lecturas actuales dentro de reintentos Serializable. Los cambios de estado de reparación, archivos/restauraciones de gastos/proveedores y ajustes de stock bloquean y revalidan antes de escribir. Resolución de stock, inventario y auditorías se confirman juntos.
- Catálogos inicializan/guardan con el mismo lock. Comisiones y elegibilidad de stock precargan relaciones e historial por lote; pruebas de equivalencia y presupuestos para 120 meses y 30 registros.
- Frontend invalida lecturas antes de mutar, usa scope/época, generaciones y tickets; protege respuestas y rollback por registro y reconcilia superposiciones. El formulario de clientes envía solo campos editados, preservando saldos y contactos concurrentes, sin cambios visuales.
- Validación: 1.157 tests frontend, 516 unitarios backend y 362 integraciones aprobados; TypeScript/lint de ambos paquetes y `git diff --check` aprobados. 78 regresiones nuevas; reproducción rojo/verde y presupuestos de consultas en `docs/issue-461/README.md`. OpenSpec: `fix-concurrency-query-batching-461`. Sin schema, build, despliegue, commit ni push; exclusivamente PostgreSQL local `imanager_test`.

## Issue #449 — Filtros legibles en inventario móvil — 2026-10-21

- Etiquetas de ancho completo y altura automática con blancos táctiles de 44 px, sin heredar los 18×18 de `.chk`. Corrección exclusiva del panel, compatible con el Sheet/acciones de #447.
- Batería/precio antes de Color; listas largas de colores plegadas y buscador sin pérdida ni fusión de valores históricos/compuestos. Cantidad del borrador visible y explicación de Limpiar/Aplicar; cerrar sin aplicar conserva los filtros vigentes.
- Validación: 1119 pruebas frontend, 516 unitarias backend, 322 integraciones y TypeScript/lint en ambos paquetes aprobados. Componente real aislado con datos sintéticos y capturas antes/después en 320×844, 390×844, 1440×900 y 1536×640. La segunda corrida completa de integración pasó tras un deadlock durante la limpieza de tablas de la primera.
- Main base `9b30ecf`; CSS servido con la regla defectuosa y buildId `60658746e56ddaa2` registrados por HTTP sin PWA. Sin sesión autenticada productiva; evidencia y límites en `docs/issue-449/README.md`; OpenSpec: `fix-inventory-filter-layout-449`. Sin cambios de backend, API, permisos ni Prisma; sin build, commit o push.

## Issue #448 — Selección explícita en Control de stock — 2026-10-21

- Abrir/reabrir/cambiar de control o grupo vacía la selección; las acciones muestran cantidad y consecuencia, quedan deshabilitadas sin selección y respetan los permisos de gestión. La confirmación compartida permite revisar equipos, IMEI y motivo Faltante; cancelar no escribe, el envío bloquea repetición y los errores conservan selección y se desplazan a la vista.
- Resultados distinguen sin escaneos, esperados sin escanear y comparación sin faltantes sin afirmar pérdidas ni completitud física. Los excluidos sin IMEI se muestran separados; se conservan conteo a ciegas, clasificación, auditoría y resolución única existentes. Sin cambios de API, backend, AppContext ni schema.
- Validación: 1114 pruebas frontend, 516 unitarias backend, 322 integraciones y TypeScript/lint frontend/backend aprobados. Componente aislado con servicios sintéticos aprobado en 390×844, 1440×900 y 1536×640; capturas antes/después y confirmación revisadas. La base local atrasada se sincronizó con adiciones del schema existente, sin pérdida de datos ni unicidades nuevas en tablas existentes.
- Base main `d215d8a`; despliegue registrado por HTTP con buildId `60658746e56ddaa2`, sin sesión autenticada para comprobar conteos reales. Evidencia y límites: `docs/stock-count-selection-448.md`; OpenSpec: `fix-stock-count-selection-448`. Cambios en working tree, sin build, commit, push ni operaciones productivas.

## Seguridad de dependencias — 2026-10-21

- Rama `fix/dependency-security-audit` basada en `main`/`7f4b7ce`: auditoría raíz 53 → 0, backend 50 → 0, landing 0 → 0.
- Locks compatibles, protobufjs 7.6.6, gRPC 1.13.7, Vitest 4.1.12, tsx 4.23.15 y overrides uuid 11.1.1 por consumidor; sin cambios funcionales ni schema.
- Excepción de deepmerge-ts resuelta con override 8.0.2 limitado a @prisma/config@6.19.3, sin cambiar Prisma/client de major. Reproducción rojo/verde del advisory y 6 pruebas nuevas de compatibilidad; 516 unitarias backend aprobadas. Alcance y riesgos en `docs/security/dependency-audit-2026-10-21/deepmerge-prisma6.md`.
- Builds y TypeScript de los tres paquetes, 1077 pruebas frontend, 516 unitarias backend y 322 integraciones aprobadas usando únicamente PostgreSQL local. Resultados de navegador y limitaciones en el informe.
- CI de 00158bf aprobó todas las etapas previas a E2E y falló en cinco selectores preexistentes. Se adaptan al helper de navegación actual y al badge Stock; fixtures de cotización explícita, sin debilitar aserciones. 6/6 escenarios locales sin retries aprobados; CI de esta nueva revisión pendiente. Sin cambios en Railway ni push/merge a main.

## Issue #440 — Pendientes post-QA — 2026-10-20

- Proveedores queda en Finanzas junto a Gastos; conserva el permiso de Inventario y los enlaces anteriores. La barra mobile muestra todas las etiquetas y mantiene botones de al menos 44×44px sin overflow entre 320 y 390px.
- La investigación del CI ubicó P2034 en el alta de una venta, antes de la anulación. Se reprodujo además una carrera real entre anulaciones simultáneas: P2002 sobre la reversa de caja. Venta/canje ahora bloquean su registro antes de anular para mantener idempotencia; agotar reintentos Serializable devuelve 409 con un mensaje para reintentar.
- TypeScript frontend/backend, 50 tests frontend, 12 unitarios backend, 99 integraciones y 20 E2E distintos aprobados. Cinco escenarios de cámara WebKit no se validan en Windows por falta de MediaStream/captureStream; Chromium desktop y Android emulado sí aprobaron. Sin build ni cambios de Prisma; solo bases PostgreSQL locales aisladas.
- Las pruebas de escáner con Samsung/iPhone/PWA, lector físico y condiciones difíciles siguen pendientes. SMTP queda pospuesto por indicación del usuario. Evidencia y reproducción: `docs/post-qa-follow-ups-440.md`; OpenSpec: `resolve-post-qa-follow-ups`.
- Prueba física posterior en Galaxy S23/Chrome: imagen borrosa y sin lectura, reportada con captura. Corrección del frontend: captura HD sin zoom agregado, enfoque/zoom independientes, liberación exclusiva de lentes y limpieza al cerrar, recuperación ante cambio fallido y botón Cambiar cámara. Vista previa sin oscurecer. Pasaron 27 tests del escáner y siete E2E Android, incluido cambio de lente exclusivo seguido de lectura Code128. El resultado físico sigue pendiente de repetir con la versión desplegada.


## Corrección — Editar vendedor de ventas — 2026-10-18

- Ventas canceladas sin Editar en detalle/menú; formularios abiertos muestran aviso y bloquean guardar. Errores de guardado se desplazan a la vista, conservando estilos.
- Cambiar/quitar vendedor conserva importe, moneda, estado y cliente; auditoría y comisiones verificadas para integradas, legacy, pendientes, canje y señas en ARS/USD. Comparación a centavos para señas y diferencia del canje antes de señas conservada al editar.
- Lint/TypeScript frontend/backend, 965 tests frontend, 460 unitarios backend, 305 integraciones y builds aprobados. Ocho E2E Chromium desktop/390 px aprobados sin retries. Solo PostgreSQL local `imanager_test_vendedor`, sin cambios de Prisma ni commit/push. Detalles: `docs/edit-sale-seller.md`; OpenSpec: `fix-edit-sale-seller`.


## Issue #376 — Catálogo configurable por permisos — 2026-10-18

- Catálogo se habilita explícitamente por miembro, apagado por defecto incluso para Socios con secciones legacy. Permisos conserva el diseño, agrega la fila debajo de Inventario y distribuye 6 + 5; Todo incluye Catálogo, Vendedor/Técnico no. Menú desktop y Más respetan el permiso, siempre fuera de la barra inferior; hash directo sin permiso muestra el aviso estándar sin redirigir.
- API por sección; regeneración del enlace y cambios del estado activo de un catálogo existente siguen exclusivos del propietario. Creación inicial permitida; validación transaccional y auditoría conservadas. El sheet del empleado oculta las tres acciones exclusivas y guarda sin active. Sin cambios de Prisma.
- Validación: lint/typecheck frontend/backend, build frontend, 949 tests frontend, 460 unitarios backend, 286 integraciones y dos E2E Chromium aprobados. Seis capturas revisadas contra mockups, mobile 390×844 a escala 2 y desktop 1440×900. Detalles y reproducción: `docs/catalog-permissions-376.md`; capturas: `docs/pr-shots/376-*.png`.
- Solo PostgreSQL local: integración en `imanager_test` y E2E en `imanager_376_e2e`.


## Issue #395 — Onboarding Nombre / Stock — 2026-10-18

- Dos pasos con el copy aprobado: Nombre y Stock. Excel primero, seguido de Pegar lista y A mano; muestras y omisión conservan sus flujos. Moneda/dólar muestra la cotización real y despliega los controles existentes.
- Se quitó Equipo del recorrido; la invitación sigue en Primeros pasos. Nombre cuenta como 1/5 y solo stock real completa 2/5; muestras quedan en 1/5. Etapas anteriores invite/video retoman Stock y tiendas completadas no vuelven al recorrido.
- Dashboard y píldora/panel de #386 conservados, con cambios únicamente de espaciado. Sin cambios de Prisma ni facturación; sin build, commit o push. Solo PostgreSQL local `127.0.0.1:5432/imanager_test`.
- Validación y capturas antes/después: `docs/onboarding-395.md`; OpenSpec: `simplify-onboarding-395`.
- Revisión CI #413: corregidas carreras de selectores al navegar a Ventas; reproducido el fallo de catálogo por 429 y aislado el límite en el servidor E2E. El 500 de `POST /api/operations/sales` no se reprodujo; fixtures de Caja sin cotización remota y diagnóstico seguro. Aprobados 150 E2E (tres repeticiones, dos workers), 12 casos aislados adicionales, 904 tests frontend, siete integraciones de catálogo y TypeScript frontend/backend. Cambios en working tree, sin commit/push ni cambios de Prisma; solo PostgreSQL local.


## Issue #71 — Equipo e invitaciones por link — 2026-10-17

- Equipo y permisos mobile/desktop según diseños aprobados: perfiles rápidos derivados, saldo de cajas anidado, acciones sensibles y baja confirmada; Socio sólo invita y gestiona Empleados ajenos.
- Preview con estados válidos/vencidos/usados/revocados/inexistentes, creador nullable y fallback al Propietario. Aceptación por link sin coincidencia de email, de un uso, transaccional y con vencimiento. Empleado con defaults explícitos sin Cajas, saldos, Reportes o administración de Comisiones.
- Hash sin permiso conserva URL y muestra pantalla de acceso denegado con nombre del dueño, sin notificación. Reportes respeta los accesos a listas/categorías, y Catálogos filtra GET/PUT por sección.
- Schema aditivo aplicado sólo al Postgres local. TypeScript, build frontend, 834 tests frontend, 449 unitarios backend y 268 integraciones aprobados; E2E nuevos mobile/desktop y regresiones de Configuración/Reportes aprobados. Detalles: `docs/team-permissions-71.md`; OpenSpec: `team-section-permissions`. Cambios en working tree, sin commit ni push.


## Issue #359 — Suscripciones con Mercado Pago — 2026-10-15

- Catálogo Básico/Negocio mensual/anual en USD, convertido a ARS con blue vendedor. Script `billing:sync` crea cuatro planes idempotentes, conserva IDs y vendedor, recupera altas interrumpidas y actualiza planes/contratos por PUT. Cotización temporal del monto ARS/email y checkout propio con Secure Fields estilizados, solo tarjeta sin cuenta MP. Alta de preapproval por API con plan/token/email; intento durable para evitar cobros duplicados ante respuestas inciertas.
- Cuentas existentes internas gratis de por vida, ilimitadas, incluidas las anteriores sin tienda. Nuevas cuentas reciben prueba de siete días sin tarjeta en ambos caminos de alta. Prisma aditivo con defaults seguros; db push comprobado sobre cuenta, tienda, membresía e inventario previos sin aceptar pérdida ni crear unicidades en tablas existentes. Sin exportaciones de filas.
- Webhook `/webhooks/mercadopago`: HMAC obligatorio con MP_WEBHOOK_SECRET (sin secreto responde 401), reconsulta obligatoria de preapproval, facturas reconsultadas, validación de tienda/plan/moneda/frecuencia/email y períodos por cobros confirmados. Locks y fecha remota evitan regresión por duplicados y concurrencia. Cancelación idempotente conserva el período abonado y un cobro reciente aún sin webhook.
- Plan y facturación owner en Configuración, con USD, confirmación ARS y cancelación; contador de prueba en Dashboard, aviso de solo lectura y límites 3/5 incluyendo owner (prueba: 5). Backend protege escrituras; aceptación concurrente de invitaciones respeta el último lugar y owner puede quitar exceso tras un cambio de plan. Un onboarding incompleto no impide acceder a facturación cuando vence la prueba.
- Validación de los ajustes: lint y builds frontend/backend aprobados; 769 unitarios frontend, 414 backend, 32 integraciones de facturación y cuatro E2E afectados desktop/WebKit iPhone, sin retries. Todos los comandos de prueba con timeout 900; no se ejecutó Playwright completo ni se regeneraron capturas de otros issues. db push desde el schema anterior conservó una tienda y cotización sintéticas, con default QUOTED e ID remoto null. Capturas nuevas revisadas únicamente en temporal.
- Capturas: `docs/pr-shots/issue-359-*.png`; operación y validación: `docs/subscriptions-359.md`; OpenSpec: `add-mercadopago-subscriptions`. Ajustes 15/10: requiere MP_PUBLIC_KEY de la misma aplicación/entorno del access token. Pendiente externo: no hay credenciales MP inyectadas; falta validar Secure Fields reales y débito sin cuenta MP en iPhone/desktop, referencia/email y CVV de 3/4 dígitos. No habilitar cobros productivos sin esa validación. No se tocaron datos ni configuración de Railway.

## Regresión #307 — Reintegros de cobros fuera de caja — 2026-10-15

- Las compensaciones revisan la asignación del movimiento original: si no tenía caja, quedan sin caja ni sesión aunque ahora haya una compatible abierta. Los cobros originalmente asignados conservan la selección de caja abierta o sin asignar, sin modificar originales ni cierres.
- La regla se aplica por cobro tras ajustes de precio: el original fuera de caja y una diferencia cobrada dentro se compensan por separado. Sin configuración al cobrar no se inventan movimientos retroactivos; se conserva la devolución del cliente fuera de Cajas.
- Se agregaron cuatro unitarios, seis integraciones y doce E2E desktop/iPhone para caja sin abrir, cerrada, sin configuración, suba/baja de precio, cobros mixtos, idempotencia y cierre con saldo/diferencia cero. La regresión falló antes de corregir en unitarios, integración y E2E desktop.
- Validación: lint/typecheck frontend/backend, 756 unitarios frontend, 392 unitarios backend, 198 integraciones y 59 E2E relevantes aprobados, estos últimos sin reintentos. Incluye caja, cuenta corriente #305, cancelaciones/reintegros, señas y edición de operaciones. Los helpers nuevos esperan la navegación y seleccionan cajas dentro de su pantalla.
- Sin cambios de Prisma ni nuevas unicidades; bases locales separadas sincronizadas mediante `prisma db push`. Sin build ni push.

## CI — Limpieza de cotizaciones al desmontar — 2026-10-15

- ExchangeProvider cancela las consultas activas e invalida respuestas pendientes al desmontarse, cambiar de configuración o iniciar otra actualización. Conserva la limpieza del intervalo y evita actualizar React después de destruir el entorno de prueba.
- Ambas fuentes reciben la señal de cancelación; las respuestas tardías no guardan caché. Ocho regresiones deterministas cubren desmontaje, cambio a manual, cambio de fuente y StrictMode; las ocho fallan con el código original.
- Validación: lint frontend/backend aprobado y tres ejecuciones completas consecutivas de frontend con 116 archivos y 756 tests aprobados en cada una, sin errores no manejados. Sin build ni push.

## Corrección de producción #307 / #369 — Caja opcional — 2026-10-15

- Ventas, cobros, cancelaciones y correcciones de precio no exigen caja abierta. Sin configuración compatible por moneda/medio no generan movimientos; con configuración sin apertura quedan persistidos sin caja ni sesión. Se prioriza la predeterminada entre cajas compatibles abiertas hoy.
- Las compensaciones van a una caja compatible abierta o quedan sin asignar, incluso si la caja original está archivada. No modifican movimientos originales, saldos cerrados ni conteos; conservan idempotencia e historial de anulación.
- Subir el precio pagado conserva el cargo por diferencia de #305 sin duplicar efectivo. Corregidos «1 equipo» en inventario, dashboard, vista previa de catálogo y auditoría. Prueba de caché de iPhone estabilizada evitando leer cuerpos de respuesta de un documento descartado al recargar.
- Prisma compatible: `registerId` opcional y moneda/medio opcionales, sin nuevas unicidades. `prisma db push` sobre una caja con movimiento y cierre previos conservó importes, relaciones y conteo, sin aceptar pérdida de datos. Sólo bases locales sintéticas.
- Validación final: lint/typecheck frontend/backend, 748 unitarios frontend, 388 unitarios backend, 192 integraciones y 73 E2E relevantes aprobados sin consumir reintentos. Incluye diez E2E nuevos desktop/iPhone y las regresiones de cuenta corriente / cancel-refund de #305. Incidencias transitorias de corridas previas documentadas.
- Documentación: `docs/cash-registers-307.md`; OpenSpec: `fix-cash-register-blocking`. Sin build ni push.

## Issue #307 — Caja diaria por moneda y medio — 2026-10-14

- Cajas ARS/USD y Efectivo/Transferencia independientes: fondo, ingresos/egresos categorizados, ajustes sin resultados, archivo y predeterminada. Cambiar dólar o moneda de tienda no convierte saldos; Convertir fondos guarda la cotización y ambas patas. Anulación compensatoria única e historial con filtros locales y paginación en PostgreSQL.
- Ventas/canjes, pagos mixtos, cuotas, señas y reparaciones impactan caja en la misma transacción. Aplicar señas no duplica cobros. Con cajas configuradas, una caja compatible sin abrir rechaza el cobro completo. Sin backfill histórico. Proveedores: egreso manual categorizado hasta contar con ese módulo.
- Conteo a ciegas por denominaciones o total bancario, nota por diferencia, aprobación/reconteo del dueño, intentos conservados y ajuste de arqueo vinculado a la sesión. Apertura del próximo día solo con cierre aprobado. Permiso «Ver saldo de cajas» separado del acceso para registrar y contar. Layout desktop e iPhone.
- Merge de main resuelto conservando Caja, onboarding y cuenta corriente. Prisma aditivo, SQL corregido y `prisma db push` verificado sobre datos previos sin aceptar pérdida ni agregar unicidades en tablas anteriores.
- Validación: lint/typecheck frontend/backend, 747 unitarios frontend, 380 unitarios backend, 181 integraciones y 23 E2E relevantes aprobados sin retries (incluyen 8 nuevos de Caja desktop/iPhone). Sin build ni push. Documentación: `docs/cash-registers-307.md`; capturas: `docs/pr-shots/issue-307-*.png`; OpenSpec: `daily-cash-registers`.

## Issue #344 — Onboarding y Primeros pasos — 2026-10-14

- Recorrido: nombre de tienda → invitación opcional → stock. Solo pregunta el nombre; USD y dólar blue automático quedan plegados. La etapa se guarda en PostgreSQL y se retoma al recargar. Las tiendas existentes conservan su acceso habitual. Ayuda puede volver a mostrar Primeros pasos en el Dashboard.
- Reutiliza el análisis de texto de #338. Si la respuesta llega completa, la pantalla muestra los equipos por tandas antes de la revisión y no se queda en «0 equipos». Las filas sin moneda no entran al total en dólares. Las dudas no bloquean y se guardan como «Para revisar». Un guardado parcial reintenta únicamente lo que falló. Excel, carga manual e invitaciones reutilizan los flujos actuales.
- Primeros pasos muestra solo pendientes. Stock, venta, empleado y catálogo salen de datos reales; el descarte y la instalación se guardan por membresía. La invitación se completa al incorporarse una persona, no al generar el enlace. Los datos de ejemplo también se ofrecen al cargar stock desde el Dashboard.
- Ayuda en Más y Cuenta, con la guía PWA existente y la opción de mostrar de nuevo Primeros pasos.
- Muestras con `sampleBatchId` asignado por servidor; creación/borrado transaccionales y confirmación que conserva equipos reales y otras tiendas. Prisma únicamente aditivo, comprobado con `prisma db push` sin aceptar pérdida de datos. Sin exportaciones de filas.
- Validación: TypeScript frontend/backend, 724 unitarios frontend, 348 unitarios backend, 153 integraciones PostgreSQL, 15 pruebas PWA/worker y builds frontend/backend. E2E general: 173 aprobados y 2 omisiones de plataforma, sin fallos ni retries; los 12 casos nuevos de desktop/iPhone pasan. Capturas en `docs/pr-shots/issue-344-*`. Se excluyen bundles y reportes generados del typecheck. Documentación: `docs/onboarding-344.md`; OpenSpec: `redesign-onboarding`.

## Issue #338 — Inventario desde texto y .txt — 2026-10-14

- Implementación local, sin commit ni push por pedido explícito. ImportModal agrega Excel / Pegar listado / Subir .txt sólo en inventario; comparte vista previa virtualizada desktop y tarjetas iPhone, dudas resaltadas, edición/exclusión por fila y descartes con motivo. Confirmar es la única operación que persiste.
- POST `/api/import/analyze-text`: Firebase/sesión y permisos, GPT 6 Luna vía Responses con schema estricto, Zod, un reintento de JSON inválido y errores visibles en español. Sólo texto aportado e instrucciones estáticas salen al proveedor. Catálogo compartido + modelos de la tienda se aplican localmente, sin enviar inventario ni datos financieros existentes.
- Límites: 100 KB UTF-8, 1000 líneas, 2000 equipos, bloques 40 líneas / 8000 caracteres, tres llamadas simultáneas, 30 s por llamada / 180 s total; un análisis activo y cinco cada 10 minutos por tienda y por instancia (no global entre réplicas). Sin cambios de Prisma ni exportaciones. Monedas por equipo, cantidades expandidas tras revisión, serie en customFields.serial y batería ausente N/A. Cambiar moneda de un IMEI existente respeta permisos sensibles; moneda legacy null usa la moneda de la tienda.
- Corpus de 57 listados sintéticos realistas y 84 filas esperadas, incluido un mixto de 24 líneas. No se suministraron listados privados reales. CI mockea el LLM; los fixtures live existentes quedan fuera de test:unit. `npm --prefix backend run eval:import` evalúa corpus y 500 líneas aparte y guarda precisión cruda/final, campos presentes, IMEIs/precios incorrectos, omisiones, latencia y costo.
- Validación: lint frontend/backend y build solicitado; 608 tests frontend, 312 unitarios backend y 123 integraciones PostgreSQL aprobados. Corridas finales limitan workers y aumentan timeouts por carga del entorno; integración limita el pool a cinco conexiones. E2E general: 148/149 en la corrida completa, el restante (indicador móvil tras resize) pasó en retry y quedó flaky. Los seis nuevos E2E pasan también en corrida aislada, incluido WebKit/iPhone. PWA: 47 aprobados / 36 omisiones, y el único fallo de actualización en iPhone pasó al repetirlo (48 aprobados efectivos). Las suites regeneraron capturas existentes en docs/pr-shots y dos PNG de issue89; no se revirtieron ni commitearon.
- Eval real con `gpt-6-luna` (2026-10-14): **APROBADO**. 58 importaciones sin errores, 584/584 filas (incluye 500 líneas), 100% en todos los campos, 0 IMEIs/precios inventados, 0 filas perdidas/extra; latencia media 4,5 s, costo total ≈ US$ 0,03. Reporte en `docs/evals/issue-338-import-llm.md`; configuración/uso en `docs/inventory-text-import.md`.
## Issue #350 — Chips de filtros y aviso offline — 2026-10-14

- El catálogo público ya no usa `<select>`. En desktop los filtros son chips con menú (modelo, capacidad, condición, batería y precio). En el teléfono quedan dentro del sheet «Filtrar lista»: chips de selección única, batería mínima con «Cualquiera» y precio desde/hasta. El botón dice «Filtros · N».
- El aviso «No hay conexión» de #347 sólo escuchaba `online` dentro del catálogo, así que en Más (y otras lecturas) el texto quedaba en el estado de React. Ahora una suscripción compartida avisa con `online`, al volver a primer plano y si `navigator.onLine` pasa de falso a verdadero; cada lectura reintenta y el aviso se va sin navegar. Un pago no se reenvía solo.
- «Cargá un WhatsApp válido…» abre el formulario de la tienda con el teléfono enfocado.
- Sin cambios de Prisma ni exportación de filas.
- Validación: lint frontend/backend, build, 665 tests frontend, 245 unitarios backend (20 fixtures externos omitidos), 123 integraciones, 148 E2E (1 omitido) y 57 PWA E2E (36 omisiones por plataforma). El E2E nuevo corta la red y comprueba que el aviso desaparece al reconectar, en la lista pública y en Más, sin cambiar de pantalla.

## Issue #347 — Ajustes del catálogo público — 2026-10-14

- El botón de WhatsApp de `/c/:slug` usa `wa.me` con el texto en UTF-8. Un teléfono argentino local pasa a `549` más 10 dígitos; un internacional explícito conserva su prefijo. Sin un número válido no hay botón, y Catálogo muestra el aviso con enlace a Configuración.
- «Disponibles» cuenta sólo equipos en estado disponible. El encabezado dice «precios en» la moneda del catálogo o la de la tienda. En el teléfono los modelos son chips; en desktop los filtros son pastillas y la lista queda en dos columnas. El aviso «No hay conexión» se limpia y reintenta con el evento `online`.
- Sin cambios de Prisma ni exportación de filas. La respuesta pública suma `store.currency` para el encabezado.

## Issue #341 — Catálogo público de tienda — 2026-10-14

- Diseño v2: sección Catálogo después de Inventario en desktop y primero en Más/Módulos móvil; Resumen/Equipos, selección individual/masiva, reglas de stock/reserva/batería, precio/moneda, enlace compartible, regeneración y desactivación. Inventario sólo incorpora la marca y cantidad efectiva «En catálogo».
- `/c/:slug` abre fuera de la sesión, sin login. Lista por modelo, sin fotos de equipos; filtros/búsqueda, logo/ubicación/horario opcionales y un único WhatsApp general flotante en móvil/desktop. Vista previa privada usa la misma API pública y conversión real.
- API anónima con proyección explícita: no costo, IMEI, serial, proveedor, customFields ni IDs internos. Precio/moneda omitidos al ocultar precios. Rate limit 60/min por IP e instancia, 429/Retry-After, no-store y sin exportaciones. Configuración y selección sólo OWNER, aisladas por tienda, atómicas y auditadas. Slugs con sufijo aleatorio, anterior revocado al regenerar.
- Prisma aditivo: visibilidad default false y StorePublicCatalog. Migración aplicada al schema anterior con equipo existente: importes/IMEI conservados, visibilidad apagada y Prisma diff sin diferencias. PostgreSQL local exclusivo `imanager_issue341_test`, `imanager_issue341_integration_test`, `imanager_issue341_migration_test`; sin operaciones sobre producción.
- SEO/OG en HTML del servidor SPA y PNG 1200×630 generado con nombre/modelos/cantidades públicos. Worker excluye /c/ y API pública. Página abierta revalida al foco y cada 15 segundos; no conserva filas ante revocación/error. Detalles y límites de operación en `docs/api/public-catalog.md`.
- Validación: lint frontend/backend y build solicitado aprobados; 653 tests frontend, 244 unitarios backend locales, 123 integraciones y 17 tests de servidor/worker/SEO. Suite backend completa: 20 fixtures live externos de importación fallan con Decisions/Responses, igual a los fallos previamente documentados; suite local aprobada excluyendo `**/*.live.test.ts`.
- E2E general: 144/145 aprobados en la corrida completa. La prueba restante medía el indicador móvil durante la transición al redimensionar 390→360; ahora espera la geometría estable. Repetición de patrones móvil/desktop y catálogo: 4/4 aprobados. PWA completo: 57 aprobados y 36 omisiones por plataforma, sin fallos; incluye OG antes de JavaScript, navegación pública anónima y revocación con worker real en desktop, iPhone/WebKit y Android.
- Capturas v2 reales: `docs/pr-shots/issue-341-{desktop,iphone}-{public,manage,rules}.png`. Reproducir con `ISSUE_341_SHOTS=docs/pr-shots npm run test:e2e -- e2e/public-catalog.spec.ts --workers=1`, con DB local y puertos libres. Cambios sin commit ni push por pedido explícito.

## Issue #342 — Errores de solicitudes en español — 2026-10-14

- `toUserMessage` centraliza los mensajes exactos de conexión, timeout y servidor. `fetchWithTimeout` distingue el vencimiento del timer y conserva nombres de error para los reintentos de invitaciones; el cliente HTTP conserva status y validaciones 4xx en español y oculta diagnósticos 5xx incluso con respuestas HTML.
- Diálogos, formularios, comisiones, toasts, importación, sesión y pantalla de error global usan la traducción compartida. El diálogo de eliminar canje permanece abierto ante un fallo y permite reintentar sin anunciar éxito.
- Validación: lint frontend/backend, build solicitado, 644 unitarios frontend y 143 E2E generales aprobados. PWA: 53 aprobados, 1 flaky de actualización iPhone aprobado en el reintento y 36 omisiones por plataforma. Los tres fallos iniciales de navegación iPhone pasaron al repetirlos; un timeout aislado de filtros de inventario pasó al repetir los unitarios con dos workers. Las seis regresiones PWA nuevas cubren offline real con service worker, 5xx y 4xx en desktop, iPhone y Android.
- Base local exclusiva `imanager_issue342_e2e_test`, API 3342 y frontend 4342; sin cambios de Prisma ni operaciones sobre producción. Cambios en el working tree, sin commit ni push, según el pedido explícito.

## Issue #334 — Ajustes de comisiones — 2026-10-14

- Causa raíz: `getCommissionPeriod` conservaba el crédito completo del snapshot anulado cuando existía `adjustmentPeriod`, sumándolo a ganado y pendiente hasta el siguiente mes. El detalle anulaba la línea individual pero los agregados, incluida la API de Reportes/CSV, seguían contando el crédito. DELETE ya conservaba el snapshot y su anulación previa, por lo que borrar físicamente Sale no retiraba ese crédito del cálculo.
- Las bajas aportan cero ganado/conteo inmediatamente. Pagos efectivos se asignan por orden de venta, persona y moneda de liquidación, sólo antes de la baja y hasta el monto del snapshot. El ajuste del siguiente mes contiene sólo lo pagado; reclasifica el débito del saldo anterior sin descontarlo dos veces. Borrar tras cancelar conserva fecha y período y marca DELETED. Anular un pago lo excluye también de asignaciones/ajustes.
- Reglas: `active` y `deletedAt`; activar/desactivar y borrado lógico sólo afectan nuevas aplicaciones. Pagos: `voidedAt`/`voidedBy`, registro histórico y endpoint idempotente. Guards OWNER/commissions y writeAudit en transacciones, independientes del permiso de acciones sensibles. Migración SQL aditiva probada sobre el schema previo con reglas y pagos existentes, importes conservados y Prisma diff sin diferencias.
- Desktop y móvil comparten acciones confirmadas en reglas/pagos, conservan errores de persistencia y bloquean doble envío. El selector incluye el próximo mes para revisar A descontar. Corregidos icono Reglas, venta/ventas y Propietario. La búsqueda de equipos sin Estado fallaba en `getOperationOptions` y en la validación al crear la venta; ambos aceptan Estado vacío conservando exclusiones de vendidos, reservados y archivados.
- Validación: lint frontend/backend, build solicitado, 580 tests frontend, 229 unitarios backend (20 fixtures externos de importación omitidos tras confirmar los fallos previamente documentados), 114 integraciones PostgreSQL y 14 pruebas de worker. PWA: 48 aprobados, 36 omisiones por plataforma/offline WebKit. Suite E2E general: 139 aprobados con un worker, sin retries ni fallos en la corrida final.
- Evidencia en `docs/pr-shots/issue-334-{mobile,desktop}-*.png`, reproducible con `npm run test:e2e -- e2e/commissions-qa.spec.ts e2e/commissions-qa-iphone.spec.ts --workers=1`. PostgreSQL local exclusivo `imanager_issue334_test`, `imanager_issue334_e2e_test` y `imanager_issue334_migration_test`; puertos 3334/4334 y PWA 4434. Exportación sólo en Reportes. Commit en `fix/comisiones-qa`, sin push, según el pedido específico; sin operaciones sobre producción.

## Issue #330 — Comisiones, parte 1: datos y API — 2026-10-13

- Migración aditiva: vendedor opcional (StoreMember, SetNull), registrador y cotización en Sale; reglas por equipo/persona y pagos parciales sin unique. CommissionAccrual congela la regla/cálculo y conserva bajas tras borrar físicamente la venta. Vendedor sin default en altas, edición e importación; blue vendedor actual o cotización explícita.
- Backend: períodos en zona horaria de tienda, tres bases (ganancia resta costo y valor tomado), comisión en moneda de venta, saldos separados ARS/USD, pagos cruzados a la cotización del pago y ajustes «A descontar» en el mes siguiente a la baja pagada. Auditoría en reglas, pagos y cambios de vendedor, incluida asignación masiva atómica.
- Comisiones por defecto solo Dueño. Socio/Empleado necesitan permiso explícito; mine filtra por el miembro de sesión y nunca devuelve costos/ganancia. Detalle financiero requiere Reportes también. Datos del reporte requieren ambos permisos. Endpoints y contratos en `docs/api/commissions.md`; cliente HTTP y tipos listos para las partes 2/3. Sin pantallas ni exportaciones.
- Validación: 556 tests frontend, 229 unitarios backend y 105 integraciones PostgreSQL; ambos typechecks/lint. Los 20 fixtures live opcionales de importación fallan con el servicio externo (igual que en #328); suite local ejecutada con `npm --prefix backend run test:unit -- --exclude '**/*.live.test.ts'`. Migración SQL aplicada al schema anterior con venta existente, importes conservados y campos nuevos null; Prisma diff sin diferencias. Bases locales exclusivas `imanager_issue330_test` y `imanager_issue330_migration_test`; sin build ni cambios en Railway.
- Commit en `feat/330-comisiones-backend`, sin push por pedido explícito. Partes 2/3 de interfaz y consumo en Reportes pendientes.

## Issue #328 — Eliminar ventas canceladas — 2026-10-12

- Causa: AppContext y DELETE volvían a cancelar cualquier venta integrada, aun si estaba cancelada; el servicio bloqueaba ventas vinculadas y la selección masiva excluía canceladas.
- Las ventas `CANCELADA` se borran con auditoría `sale.deleted`, sin restaurar stock ni recalcular cliente, canje o pagos. Las ventas activas conservan su comportamiento previo, permisos sensibles y aislamiento por tienda. Sin cambios de Prisma.
- Desktop y hoja móvil comparten confirmación de eliminación real. Seleccionar solo canceladas ofrece «Eliminar selección»; las activas mantienen «Cancelar ventas» y las selecciones mixtas indican que deben separarse.
- Validación: 552 unitarios frontend, 216 unitarios backend y 81 integraciones PostgreSQL aprobados; 20 fixtures externos de importación omitidos con la opción existente, después de fallar en la corrida con servicio externo. Ambos typechecks aprobados. Los dos E2E nuevos pasan en desktop e iPhone/WebKit; las cuatro regresiones existentes de selección y menú también pasan.
- Regresiones comprueban cancelar y eliminar ventas pendientes/cobradas, con/sin canje, pagos y devoluciones conservados, stock vendido nuevamente intacto, permisos, auditoría y persistencia tras recargar. PostgreSQL local exclusivo: `imanager_issue328_integration_test` y `imanager_issue328_test`.
- Seis capturas en `docs/pr-shots/issue-328-{desktop,mobile-iphone}-{delete,bulk,deleted}.png`. Regenerar con `ISSUE_328_SHOTS=docs/pr-shots npm run test:e2e -- e2e/delete-cancelled-sales.spec.ts --workers=1`, usando la DB de pruebas y puertos libres. Commit en la rama del issue, sin push, según el pedido específico.

## Issue #303 — Selección móvil explícita y retiro de exportaciones por tabla — 2026-10-12

- Restaurado `usePress` desde `bf8318a`, previo a PR #295: toque largo de 480 ms abre la hoja Editar/Eliminar sin seleccionar; movimiento de más de 8 px, scroll y cancelación abortan el gesto, y el clic posterior se suprime por 700 ms. Se conserva limpieza del timer al desmontar.
- Inventario, Ventas, Canjes y Clientes muestran «Seleccionar» sobre la lista móvil. Los checkboxes solo aparecen en modo selección; la hoja suma «Seleccionar varios» con esa fila seleccionada. Barra inferior con cantidad, acción destructiva confirmada y «Listo», incluso con cero seleccionados. Desktop conserva selección visible, rango con Shift y barra existente, sin exportar.
- Retirados CSV de selección, campos destinados a exportación y Lista de precios/copia de filas. Eliminados sus tests; CSV compartido y exportaciones de Reportes se conservan. No había endpoints de exportación de tablas en el backend actual. Permisos sensibles, aislamiento por tienda y auditoría se verifican con los tres tests de integración existentes, en PG local exclusivo `imanager_issue303_security_test`.
- `skipWaiting()` se solicita al comenzar `install`, independiente del precache. Test unitario mantiene precache pendiente; regresión de producción usa dos pestañas, recarga y actualización y comprueba la versión del worker que controla ambas mediante un mensaje disponible solo en el servidor de QA. No queda worker en espera en Chromium/WebKit.
- Se conservan padding de Canjes, layout de Clientes y nowrap en Ventas. Las regresiones verifican filas normales sobre el dock y checkboxes seleccionables sobre la barra móvil. Las capturas de tests de layout se guardan en `test-results` por defecto para conservar evidencia histórica.
- Evidencia revisada: `docs/pr-shots/issue-303-mobile-list.png`, `issue-303-mobile-longpress-sheet.png`, `issue-303-mobile-selection.png`, `issue-303-desktop.png`. Regenerar con `ISSUE_303_SHOTS=docs/pr-shots npm run test:e2e -- e2e/bulk-actions.spec.ts --workers=1` usando PG local y puertos libres.
- Validación final: lint frontend/backend, build solicitado, 548 unitarios frontend, 14 pruebas de worker, 132 E2E y 48 PWA E2E aprobados (36 omisiones por plataforma/offline WebKit), sin retries ni fallos en las corridas finales. También 212 unitarios backend (20 fixtures de IA en vivo omitidos sin API key) y tres integraciones de permisos/auditoría aprobados. E2E completo usa un worker, PG local exclusivo `imanager_issue303_final_test` y puertos 3304/4304; PWA de producción usa 4395. Commit en `feat/bulk-redo-303`, sin push, según el pedido específico.

## Issue #300/#299 — Correcciones de QA móvil — 2026-10-12

- El toast de actualización móvil se ubica arriba con `safe-area-inset-top`, dejando libres Registrar venta, Importar y las barras inferiores. Desktop conserva su ubicación. Los tests de producción comprueban recarga automática sin tocar Actualizar al cerrar y después de terminar un guardado; la respuesta POST se retiene más que el debounce para verificar que no interrumpe la persistencia.
- Más resuelve la visibilidad de Instalar app con un snapshot síncrono de instalación/media query. Las regresiones comprueban la tarjeta antes del primer paint, la posición estable del perfil y el tap inmediato. El callback de cierre de la guía es estable para conservar foco e inert ante cambios del instalador.
- La X y el backdrop de la guía consumen la secuencia pointerdown/pointerup y el clic posterior. La hoja cierra con un solo tap en Chromium/WebKit, conserva teclado, restaura foco y permite scroll propio; un gesto cancelado del backdrop no cierra.
- Android sin `beforeinstallprompt` muestra el banner oscuro a los 30 s elegibles en Dashboard. Al salir se desmonta también el contenedor de `AnimatePresence`: el test anterior recargaba antes de comprobar la ausencia y ocultaba la retención de la animación. Ahora verifica Inventario, Ventas, Reportes y Más sin recargar, además de descarte/standalone.
- Evidencia QA: `docs/pr-shots/issue-300-qa-{toast-mobile,mas,sheet-iphone,android-banner,desktop}.png`. Regenerar con `ISSUE_300_QA_SHOTS=docs/pr-shots PLAYWRIGHT_PWA_PORT=4393 npm run test:pwa:e2e -- --workers=1`. La prueba del POST diferido bloquea el worker solo en ese contexto para que WebKit entregue la petición al router de Playwright; los demás casos de actualización prueban el worker real y el bundle de producción.
- Validación final: `lint` frontend/backend, `build`, `test` (549 unitarios), `test:pwa` (13), `test:e2e` (132) y `test:pwa:e2e` (45 aprobados, 36 omisiones por plataforma/offline WebKit), sin fallos ni retries. E2E general usa exclusivamente PG local `imanager_issue300_qa_test` y puertos 3301/4301; PWA de producción usa 4393. Commit en `fix/install-help-qa-300`, sin push, según el pedido específico.

## Issue #300 — Ayuda para instalar la app — 2026-10-12

- Android sin `beforeinstallprompt`, incluido fuera de Chrome, recibe una tarjeta oscura al inicio del Dashboard después de los mismos 30 s elegibles. Conserva icono, menú amarillo, instrucciones, descarte persistente por plataforma y exclusión de standalone. El evento nativo tardío reemplaza la guía por «Instalar app».
- Más incorpora como primera tarjeta «Instalar app», amarilla y disponible incluso después del descarte automático. Comparte el consumo de un solo uso del prompt con el banner; sin prompt abre la hoja ilustrada. No agrega Comisiones ni módulos, y no modifica backend, Prisma o AppContext.
- Hoja «Instalá iManager» con tres beneficios, cuatro pasos por plataforma, «Tu celular» primero y la otra guía colapsada. Safari → Compartir → Agregar a inicio → Agregar para iPhone; Chrome → ⋮ → Instalar app/Agregar a pantalla principal → Instalar para Android. Foco contenido/restaurado, fondo inert, scroll propio y safe areas; entradas ocultas en standalone y después de `appinstalled`.
- Validación completada: lint frontend/backend, build solicitado, 545 unitarios frontend y 13 pruebas PWA/worker. Suite PWA de producción: 36 casos aprobados (27 omisiones por plataforma/limitación offline WebKit ya existente), sin fallos. Doce unitarios y siete escenarios de navegador nuevos, compartidos entre Vite y la PWA de producción.
- Suite E2E general final: 128 casos aprobados con un worker, sin utilizar retries. Todos los comandos solicitados (`lint`, `build`, `test`, `test:pwa`, `test:e2e`, `test:pwa:e2e`) completados. Commit en `feat/install-help-300`, sin push, según la instrucción específica del issue.
- El test existente de Clientes ahora espera el saldo actualizado antes de editar: esperar un toast oculto podía adelantarse al pago async y sobrescribir el saldo con el valor anterior. Pasó tres repeticiones consecutivas. Un timeout previo del toast en el detalle de venta pasó al repetir el caso sin modificar su lógica.
- Cinco capturas generadas e inspeccionadas en `docs/pr-shots/issue-300-{android-banner,mas,sheet-android,sheet-iphone,desktop}.png`: Android/Más 412×852, iPhone 393×852, desktop 1440×900. Regenerar con `ISSUE_300_SHOTS=docs/pr-shots npm run test:e2e -- e2e/install-help.spec.ts e2e/install-help-iphone.spec.ts --workers=1`. DB local exclusiva `imanager_issue300_test`; puertos 3300/4300 y PWA 4392, configurables sin tocar otros checkouts.

## Issue #286 — Seguimiento QA del detalle de venta — 2026-10-12

- `SaleDetail` entrega sus acciones al footer explícito de `Sheet`; el cuerpo conserva scroll propio y el footer no encoge. La misma vista atiende Ventas, Reportes («Ventas del período»), Dashboard y notificaciones, también para ventas iniciadas desde la ficha del cliente.
- Grilla de dos columnas iguales con separación de 10 px para dos, tres o cuatro acciones; la última acción impar ocupa toda la fila. Canje agrupado en «Canje como parte de pago», botones de al menos 48 px y safe areas de iPhone.
- Validación: lint frontend/backend, build solicitado y 497 tests Vitest aprobados. Suite E2E completa: 116 casos aprobados con `--workers=1`; pasada final del detalle: 12 casos aprobados, con geometría y scroll a 1280×640, 1280×800, 1440×900 e iPhone 13 (WebKit). La ejecución secuencial evita los conflictos de serialización de los fixtures observados con cuatro workers.
- Las cuatro capturas `docs/pr-shots/issue-286-fix-{desktop,mobile-iphone}-{canje,sin-canje}.png` fueron generadas e inspeccionadas. Regenerar con `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_issue286_fix_test ISSUE_286_SHOTS=docs/pr-shots npm run test:e2e -- e2e/sale-detail-layout.spec.ts --workers=1`. La evidencia con canje se abre desde Reportes y muestra todo el bloque después del scroll; la venta histórica sin canje se importa por API para ejercitar tres botones reales.
- El test de menú de filas guarda sus capturas en `test-results/row-actions-shots` (o `ROW_ACTIONS_SHOTS`) para funcionar sin permisos sobre `/opt/cursor/artifacts`. Commit en la rama actual, sin push y sin incluir `.qa`, según el pedido.

## Issue #287 — Desplegable propio de Reportes — 2026-10-12

- `DeskSelect` reemplaza el selector nativo de Desglose en todos los reportes y se reutiliza en moneda/cotización de Configuración. Conserva valores, permisos y validación; no modifica backend ni AppContext.
- Combobox/listbox con flechas, Enter/Espacio, Home/End, typeahead, Escape y clic externo; selección amarilla, hover y foco visible. En teléfonos usa sheet modal con safe areas, filas de 52 px, fondo inert y foco contenido/restaurado. Escape cierra el selector antes del modal padre.
- Validación: lint frontend/backend, build solicitado por el issue y 487 tests frontend (12 nuevos del componente) aprobados. Los 12 escenarios Playwright de Reportes, Configuración, moneda y cotización pasan, incluido WebKit con emulación iPhone 13.
- Capturas revisadas: `docs/pr-shots/issue-287-desktop.png` (1440×900) y `docs/pr-shots/issue-287-mobile-iphone.png` (iPhone 13, retina). E2E usa exclusivamente Postgres local `imanager_issue287_test`; puertos 3127/4177 por colisión con los habituales mediante configuración temporal retirada. Para regenerar capturas: `ISSUE_287_SHOTS=docs/pr-shots npx playwright test e2e/report-dropdown*.spec.ts` con los servidores/DB de la configuración E2E.
- Commit en la rama actual y sin push, según la instrucción específica del issue.

## Issue #285 — Acciones masivas en las tablas — 2026-10-12

- Inventario, Ventas, Canjes y Clientes incorporan checkboxes por fila, selección del filtro completo entre páginas, rangos con Shift+click y barra con cantidad. La selección se limita al usuario/tienda y descarta registros que salen del filtro.
- Las cuatro tablas exportan los campos explícitos seleccionados a CSV con moneda original, sin costos ocultos. El helper de descarga se comparte con Reportes y conserva acentos, comillas y saltos de línea; neutraliza fórmulas de planilla.
- Inventario/Clientes permiten eliminar; Ventas permite cancelar operaciones integradas o asociadas a un canje; Canjes permite cancelar operaciones pendientes/confirmadas. Los registros históricos sin operación y los cancelados se pueden exportar. Las acciones destructivas usan confirmación y `canManageSensitive`, y reutilizan los endpoints existentes con permisos, scope de tienda, auditoría y reglas de stock/saldos. Sin endpoints ni cambios de Prisma; sin cambios en comisiones.
- Cada lote procesa solicitudes individuales en secuencia: ante el primer error se detiene, informa completados/pendientes y conserva los pendientes seleccionados. No se promete atomicidad global. Cambiar de sección, tienda o usuario impide continuar la secuencia; se bloquean doble envío y cierre durante el procesamiento.
- En móvil, mantener presionada una tarjeta selecciona sin abrir el detalle/menú; scroll/cancelación interrumpe el gesto. Barra inferior con safe areas, controles de 44 px; reemplaza la navegación inferior mientras hay selección. El menú ⋯ sigue disponible fuera de selección.
- Validación: lint frontend/backend, build, 496 tests frontend, 232 unitarios y 75 de integración backend aprobados. 14 escenarios Playwright aprobados: acciones en las cuatro tablas, inventario, patrones móviles y menú por fila. La suite de menú acepta `ROW_ACTIONS_SHOTS` para evitar rutas de capturas de otra máquina.
- Capturas generadas e inspeccionadas en `docs/pr-shots/issue-285-desktop.png`, `issue-285-mobile-iphone.png` e `issue-285-desktop-confirm.png`: desktop 1440×900 e iPhone 13/WebKit 390×844, sin overflow, barra/confirmación completas. Regenerar con `ISSUE_285_SHOTS=docs/pr-shots npm run test:e2e -- e2e/bulk-actions.spec.ts` y una base local de pruebas. Esta sesión usó `imanager_issue285_test`/`imanager_issue285_e2e_test` y puertos temporales 3125/4195 por colisión con los habituales.
- Commit en la rama actual, sin push, según el pedido de la issue.

- Corrección CI #285: la celda de selección usa el nombre genérico «Selección» y el input conserva «Seleccionar …», evitando que los nombres de registros coincidan con dos celdas. Las filas desktop abren el detalle sin cambiar la selección, incluso con selección activa; solo el checkbox y su label seleccionan. Las tarjetas móviles conservan sus gestos. Cuatro regresiones nuevas cubren las tablas; se mantienen las expectativas E2E existentes.
- Validación de la corrección: lint frontend/backend, build solicitado, 512 tests frontend y los 109 escenarios de la suite E2E completa aprobados. Ejecución final E2E con un worker, sin retries, usando exclusivamente PostgreSQL local `imanager_issue285_regression_test`; se prepararon las carpetas de capturas existentes en `/opt/cursor/artifacts/` sin cambiar tests. Commit en la rama actual, sin push.

## Issue #286 — Detalle de venta compacto — 2026-10-12

- El detalle agrupa los datos del canje en dos columnas. El cuerpo tiene scroll propio y las acciones permanecen visibles en el footer en desktop y mobile, con botones de al menos 48 px y safe area inferior. Conserva textos, permisos y operaciones existentes; solo frontend.
- Validación: lint frontend/backend, build y 478 tests frontend aprobados. Seis escenarios Playwright aprobados, incluidas regresiones de ventas/canjes y layout en WebKit a 1440×900 e iPhone 13 con viewport 390×844. El footer permanece fijo también al forzar scroll con 500 px de altura; sin overflow horizontal.
- Capturas generadas e inspeccionadas en `docs/pr-shots/issue-286-desktop.png` y `docs/pr-shots/issue-286-mobile-iphone.png`: las cuatro acciones visibles sin scroll. Regenerar con `ISSUE_286_SHOTS=docs/pr-shots npm run test:e2e -- e2e/sale-detail-layout.spec.ts` usando una base local de pruebas. Validación local en `imanager_issue286_test`, con puertos temporales 3119/4189 por colisión con los habituales.
- Commit en la rama actual, sin push, según el pedido de esta issue.

## Issue #290 — PWA instalable — 2026-10-12

- Manifest completo y assets del logo propuesta 3: íconos normales/maskable, Apple touch y 26 splash screens de iPhone. Guía Safari ilustrada y prompt Android después de 30 s con sesión/tienda lista; descarte persistente, sin invitación en desktop/standalone.
- Worker de producción con caché explícita de shell/bundles/branding, excluyendo API, sesión, helpers Firebase y query strings. Actualizaciones esperan el cierre de clientes. Safe areas en login/onboarding, shell y navegación.
- Google en iOS standalone usa redirect y helpers del mismo origen a través del servidor web; errores visibles en Login. Email/password y popup del navegador conservados. El handler del dominio desplegado debe estar autorizado en Firebase/Google OAuth.
- Build y TypeScript frontend/backend aprobados, pruebas PWA/worker/servidor aprobadas y unitarios backend aprobados sin tests live. La validación de navegador está bloqueada por sandbox/sockets/DNS; queda suite WebKit/Chromium en CI y checklist de iPhone/OAuth real en `docs/pwa.md`.
- Commit local bloqueado porque `.git` es solo lectura (`.git/index.lock`). Cambios en la rama existente, sin push ni PR.

## Iteración hifi-desk — 2026-10-06

- Issue #89: Inventario, Ventas, Clientes y Canjes comparten operaciones atómicas. Venta/canje mantiene el precio total de salida, diferencia y deuda; los borradores persisten y se recuperan, y cancelar restaura la salida, archiva el recibido y revierte saldos sin borrar historia.
- Las notificaciones de operaciones y el alta/cambio manual a VENDIDO se guardan en PostgreSQL. Cada evento se comparte por tienda, las lecturas son por usuario, la lista respeta permisos de sección y los enlaces abren registros autorizados, incluido el detalle archivado de un recibido.
- Validación #89: integración backend, pruebas frontend y Playwright de operaciones, recuperación, cancelación y notificaciones; lint TypeScript frontend/backend. Tests E2E usan exclusivamente la base local `imanager_issue89_test`; no se corrió build.

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

- Issue #146: editar una venta permite agregar, modificar o quitar el canje en desktop y mobile con el formulario compartido. Quitar conserva la venta activa y el historial del canje, archiva el recibido y recalcula la deuda; un recibido ya vendido bloquea la operación sin cambios parciales. Compatible con ventas históricas; sin cambios de Prisma.
- Validación #146: 450 tests frontend, 225 unitarios backend y 72 de integración aprobados; lint frontend/backend aprobado. Playwright verifica agregar, cambiar, quitar y persistir tras recargar a 1440×900 y 390×844. Capturas en `docs/pr-shots/issue-146-*.png`; sin build.

- Issue #288: Canjes muestra Cancelado con ícono y color en historial/filtros y mantiene los filtros mobile en una fila. Al quitar un canje, conserva el número de venta en `TradeIn.removedFromSaleNumber` (único campo nuevo nullable, solo lectura) y muestra «Canje quitado de la venta V-XXXX» tras recargar; las otras cancelaciones y registros antiguos sin referencia muestran «Operación cancelada». El aviso usa el estado técnico real del canje, incluido Pendiente, y los modales mobile cubren la navegación inferior hasta el borde de la pantalla con safe area y scroll interno.
- Validación #288: lint frontend/backend, 453 tests frontend, 232 unitarios backend, 73 de integración con Postgres local `imanager_test` y 6 escenarios Playwright aprobados (regresión #146, patrones compartidos y presentación #288). Ocho capturas a 1440×900 y 390×844 en `docs/pr-shots/issue-288-*.png`; sin build. Los E2E usaron puertos 3118/4178 mediante una configuración temporal por colisión con otra app local.
- Corrección CI #288: cancelar la operación completa vuelve a mostrar «Operación cancelada» en aviso, historial y detalle. Settings comprueba que el sheet cubre la tab bar y sus acciones reciben clics; el walkthrough mobile cierra la OT antes de navegar. Sus capturas son opcionales mediante `REFACTOR_WALKTHROUGH_SHOTS`, sin depender de rutas de Cursor. Validación local: 19 escenarios E2E aprobados (los cuatro specs fallidos, presentación #288 y patrones), 33 tests frontend, 27 de integración y lint frontend/backend; bases Postgres locales separadas y puertos 3118/4178, sin build ni regeneración de capturas del PR.

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
| Notifications | Eventos persistidos por tienda; lectura individual por usuario y filtro de permisos |
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

- Fallas: «Todos los reclamos» reemplaza la hoja del grupo en un único Sheet ajustado al contenido; cada reclamo abre un segundo Sheet y conserva lista/foco al cerrar. Validado con DB falsa en 1440/390, scroll en viewport reducido, tests relacionados y TypeScript frontend/backend. Capturas en `/workspace/qa-fallas2/ver-todos-{1440,390}.png`.

- Dashboard mobile: acceso «Invitar al equipo» para OWNER/MANAGER con hasta un integrante adicional y sin invitaciones pendientes; Más mantiene el acceso al flujo existente. Píldora de cotización ajustada al contenido. El overview convierte ventas y costos según moneda guardada antes de sumar y declara la moneda de esos importes; evita mostrar totales ARS como USD. Validación local con DB falsa `imanager_invite`, Playwright a 390×844/1440×900 y capturas en `/workspace/qa-invite/`.

- QA pendientes de diseño: retirados subtítulos de reglas de catálogo, detalle de equipo y carga en serie y ayudas redundantes de reglas. El conteo resume tres filas y conserva expansión/filtros. Onboarding abre cotizaciones y lleva foco/scroll al campo inválido con error asociado, incluso al reenviar. Validación: 97 tests relacionados, TypeScript frontend/backend, QA Chromium en 3560/4560 con DB ficticia y veinte capturas antes/después 1440/390 inspeccionadas en `/workspace/qa-pend/`.

- Comisiones · detalle de vendedor variante 2: hoja de 540 px, saldos 2×2, pestañas Ventas/Pagos y tres registros con «Ver todas (N)» en segunda hoja/pantalla móvil. Tinte integral de anulados; conserva saldos ARS/USD, ajustes, permisos y acciones. Solo detalle administrativo; Resumen periódico y Mis comisiones intactos. Validación: TypeScript frontend/backend, 35 tests relacionados, 4 regresiones E2E desktop/iPhone y pago/anulación con persistencia real en PostgreSQL ficticio local. Capturas 1440/390 en `/workspace/qa-comis-impl/`.

- QA Gestión 01: Gastos visible para OWNER desde Finanzas y rutas existentes, con permisos de los demás roles intactos. Regresión roja/verda, 117 pruebas relacionadas y TypeScript frontend/backend aprobados. Capturas ficticias 1440/390 en `/workspace/qa-medios/gestion-01-*.png`. Entrega visual pendiente de revisión.

- Venta · variante B (2026-10-26, propuesta draft): ARS principal y USD secundario. Precio, deuda, pagos, recargo, cuotas y canje usan la misma presentación; equivalentes con la cotización actual de la tienda y hasta dos decimales, sin alterar persistencia. Revisión con PostgreSQL ficticio local `imanager_var_venta_1026`, 86 pruebas relacionadas y TypeScript frontend/backend aprobados. Capturas 1440/390 en `/workspace/qa-variantes-1026/venta/varB-{1440,390}.png`. Alternativa independiente desde origin/main; sin merge.
