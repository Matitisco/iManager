# Navegación móvil (#450)

## Regresiones E2E del check `test`

Revisión sobre `1f2cbc1`, con los dos commits de #450 presentes. Se reprodujeron los fallos de Comisiones en Android, filtros de Clientes tras recargar y Carga en serie en móvil. Los recorridos ahora verifican «2 personas con comisiones pendientes» y abren «Opciones de lista» antes de usar sus controles. La segunda selección de ventas espera la cabecera de Ventas antes de expandir las opciones. Se conservan las aserciones de datos, permisos, pagos, escáner y persistencia.

Sin cambios adicionales, aprobaron cuatro repeticiones de acciones masivas desktop con dos workers, el recorrido de permisos de Comisiones en WebKit y los tres escenarios de detalle de venta a 320 px. El 409 del alta no se reprodujo en esas repeticiones.

La corrida completa también detectó una medición intermitente del menú de reglas mientras el Sheet todavía estaba animándose (43,99 px frente al mínimo de 44 px). El test espera ahora el transform final, como ya hacía el escenario vecino de ventas, sin cambiar dimensiones ni tolerancias. Aprobaron 20 repeticiones sin retries: cinco en cada viewport de 320, 390, 1440 y 1536 px.

La suite E2E completa final terminó con código 0: 296 aprobados, 1 intermitente aprobado al reintentar y 7 omitidos por la configuración habitual (304 casos). Se ejecutó con `--workers=4 --retries=1`, usando la política de reintentos de CI. Los ocho fallos señalados en el reporte aprobaron. El caso intermitente fue el menú contextual de eliminación de canjes móvil, ajeno a los selectores de #450; también había aprobado sin retries en la pasada completa anterior con dos workers. Sus aserciones permanecen iguales.

Validación local: 1128 pruebas frontend, 516 unitarias backend, 322 integraciones PostgreSQL y 15 pruebas PWA de assets/worker/servidor aprobadas; TypeScript/lint de ambos paquetes aprobado. Integraciones en `127.0.0.1:5432/imanager_test`; E2E completos aislados en `127.0.0.1:5432/imanager_450_e2e_test`. La configuración de ejecución deshabilita credenciales de Mercado Pago: un refresco externo de la suscripción sintética provocó un fallo de facturación ajeno al recorrido de navegación, que aprobó al aislar esa configuración.

Las capturas heredadas de los tests se redirigieron a un directorio temporal dentro del workspace. No se escribieron imágenes en `docs/pr-shots` ni quedaron cambios en capturas versionadas. WebKit y sus bibliotecas se prepararon dentro del workspace. Sin build, cambios de aplicación/backend/Prisma, commit, push ni operaciones sobre bases reales.

## Corrección del check CI

El run `39671052307` falló en `Test PWA on iPhone WebKit and Android Chromium`: el escenario de actualización después del guardado esperaba una navegación y observaba dos en los tres proyectos. `framenavigated` incluye el `history.replaceState` que registra la entrada del shell después de recargar; ese evento adicional no representa otra carga de documento.

El test ahora cuenta exclusivamente peticiones de navegación del documento principal y espera `load`. Conserva las condiciones de seguridad: ninguna recarga durante el POST retenido, formulario y aviso visibles mientras persiste, una única recarga al terminar, desaparición del aviso y cliente guardado visible después de cargar.

Revalidación: 1128 pruebas frontend, 516 unitarias backend, 322 integraciones contra PostgreSQL local y 15 pruebas de assets/worker/servidor PWA aprobadas; TypeScript/lint de ambos paquetes aprobado. El fixture de navegación volvió a aprobar antes/después en 320, 390 y 1440 px. Sin build, despliegue completo, cambios de schema, commit ni push.

El mismo escenario PWA que falló en CI aprobó en desktop Chromium (1440 px), Android Chromium e iPhone 13 WebKit (390 px), sin retries. Se ejecutó con un servidor Vite de prueba en modo producción, API y versiones sintéticas y service workers bloqueados, como exige ese escenario. Las dependencias faltantes de WebKit/EGL se extrajeron dentro del workspace; sin instalación en el sistema. El descubrimiento de los 93 casos PWA también aprobó. No se ejecutó la suite PWA completa que requiere build ni la suite de despliegue completo; esta comprobación no acredita un iPhone físico.

## Reproducción y versión

- Fecha: 21/10/2026. HEAD y `origin/main` al iniciar: `2e5f50bd415643b0e3c3cd1759b5c9b5f5512853`, con #447–#449 incluidos. Working tree inicial limpio.
- El fixture automatizado ejecutó el DeskApp y las listas reales del commit base, con contexto sintético. En 320 y 390 px, abrir Reportes desde una fila baja de Más conservaba un desplazamiento mayor a 100 px y dejaba la cabecera fuera del inicio. La regresión vuelve a medir el contenedor `.stage`, no window.
- Lectura HTTP sin caché de navegador/PWA: `https://app.imanager.com.ar/version.json` devolvió `buildId=60658746e56ddaa2`. HTML servido: `/assets/index-9zHD6QKo.js`; SHA-256 del bundle: `dca4253e024fd69d7f44b172d253644c1a50e9f547ae8b036cf76877049d79fa`.
- No hubo sesión autenticada productiva para reproducir el recorrido servido. El buildId no demuestra un commit específico. La reproducción funcional y las capturas corresponden al código de main y al cambio local, sin operar sobre producción. Los contextos nuevos del fixture no registran service workers y bloquean servicios remotos.

## Comportamiento

Cada entrada nueva del historial abre su módulo en el inicio de `.stage`. Atrás/Adelante recuperan la posición de esa entrada; Volver desde un módulo abierto directamente desde Más recorre el historial a Más y recupera su posición. Un enlace directo conserva su ruta y usa Más como destino de respaldo.

Inventario, Ventas y Clientes guardan en memoria la búsqueda, filtros, orden, vista y página de cada entrada. Una visita nueva parte del estado inicial. Usuario, tienda o permisos diferentes invalidan esa memoria. No se guardan registros, selecciones, errores ni formularios. Abrir/cerrar un modal, escribir o recibir datos no reinicia scroll ni remonta la lista. Una posición que requiere contenido demorado se restaura al alcanzar la altura suficiente, y deja de intervenir ante interacción del usuario. Las páginas de listas archivadas no pierden la página solicitada durante una respuesta inicialmente vacía.

Los indicadores conservan las sumas y explican sus componentes: avisos sin leer, canjes en curso, órdenes de servicio abiertas, seguimientos para hoy, personas con comisiones pendientes y notificaciones sin leer. El número de Comisiones representa personas, como ya lo calcula el shell. La barra inferior usa una descripción accesible completa conservando el nombre y la etiqueta del botón. Las pestañas mantienen sus nombres, con descripción y título. “Qué cuenta cada indicador” despliega la explicación visible del grupo; Más explica cada sección. Las descripciones usan únicamente las secciones permitidas.

Las opciones de menor frecuencia quedan bajo “Opciones de lista”: selección, archivados, orden y accesos auxiliares según módulo; en Ventas incluye vendedor y estado. Los filtros aplicados siguen identificados en el resumen plegado. Se mantienen búsqueda/filtros principales, acción primaria e Importar. Los menús desplegados se distribuyen dentro del ancho móvil y sus acciones miden al menos 44 px.

Durante selección, incluso con cero seleccionados, la barra masiva reemplaza al dock principal y queda sobre la navegación inferior. Su altura real reserva el espacio del contenedor, evitando acumulaciones de padding y permitiendo recorrer la última fila y paginación. El ajuste se limita a las tres listas; otros módulos conservan sus barras actuales.

Se preservan lateral simplificado, etiquetas móviles, grupos activos, rutas anteriores, permisos, Proveedores en Finanzas, escáner y modales/filtros compartidos. Sin cambios de backend, API, AppContext, Prisma ni reglas financieras.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm run test:frontend -- --maxWorkers=2` | 157 archivos, 1128 pruebas aprobadas |
| `npm --prefix backend run test:unit -- --maxWorkers=2` | 76 archivos, 516 pruebas aprobadas |
| `npm --prefix backend run test:integration` | 39 archivos, 322 pruebas aprobadas |
| `npm run lint` y `npm --prefix backend run lint` en paralelo | Ambos aprobados |
| `node scripts/test-mobile-navigation.mjs` | Ambos aprobados en 320×844, 390×844 y 1440×900 |

La integración usa exclusivamente `127.0.0.1:5432/imanager_test`, con DATABASE_URL explícita. No hubo cambios de schema ni comandos de sincronización de Prisma.

El fixture sirve exclusivamente el shell y componentes reales con contexto sintético, sin backend ni despliegue completo de la aplicación. Comprueba scroll inicial/restaurado, búsquedas y página al volver, ausencia de reset por actualización de datos o cierre de modal, nueva visita sin filtros heredados, ancho y blancos táctiles de menús, ausencia de overflow horizontal, sustitución del dock por selección y paginación por encima de las barras. Incluye inventario vacío, carga y error de borradores. Corre con StrictMode y exige cero errores de página. Las pruebas unitarias agregan aislamiento por usuario/tienda/permisos, deep links con query, metadata ajena de history.state, restauración demorada e interrupción del usuario, descripciones accesibles y conteos sin cambios.

La validación inicial actualizó los recorridos E2E para expandir las opciones y reconocer descripciones, junto con la regresión Más → Reportes → Volver, y comprobó el descubrimiento/sintaxis de la suite (304 casos en 78 archivos). La revisión posterior del check `test`, documentada arriba, agrega la ejecución completa contra servicios y bases locales de prueba.

No hubo build, commit, push, rama nueva ni operaciones productivas. Chromium con viewport emulado no acredita Safari/PWA o iPhone físico.

## Evidencia visual sintética

| Estado | 320×844 | 390×844 | 1440×900 |
| --- | --- | --- | --- |
| Reportes, antes | [Captura](before-reports-320.png) | [Captura](before-reports-390.png) | [Captura](before-reports-1440.png) |
| Reportes, después | [Captura](after-reports-320.png) | [Captura](after-reports-390.png) | [Captura](after-reports-1440.png) |
| Inventario, antes | [Captura](before-inventario-320.png) | [Captura](before-inventario-390.png) | [Captura](before-inventario-1440.png) |
| Inventario, después | [Captura](after-inventario-320.png) | [Captura](after-inventario-390.png) | [Captura](after-inventario-1440.png) |
| Ventas, antes | [Captura](before-ventas-320.png) | [Captura](before-ventas-390.png) | [Captura](before-ventas-1440.png) |
| Ventas, después | [Captura](after-ventas-320.png) | [Captura](after-ventas-390.png) | [Captura](after-ventas-1440.png) |
| Clientes, antes | [Captura](before-clientes-320.png) | [Captura](before-clientes-390.png) | [Captura](before-clientes-1440.png) |
| Clientes, después | [Captura](after-clientes-320.png) | [Captura](after-clientes-390.png) | [Captura](after-clientes-1440.png) |
| Paginación de Inventario sobre barras | [Captura](after-inventario-pagination-320.png) | [Captura](after-inventario-pagination-390.png) | — |
| Paginación de Ventas sobre barras | [Captura](after-ventas-pagination-320.png) | [Captura](after-ventas-pagination-390.png) | — |
| Paginación de Clientes sobre barras | [Captura](after-clientes-pagination-320.png) | [Captura](after-clientes-pagination-390.png) | — |
| Selección en Inventario | [Captura](after-inventario-selection-320.png) | [Captura](after-inventario-selection-390.png) | — |
| Selección en Ventas | [Captura](after-ventas-selection-320.png) | [Captura](after-ventas-selection-390.png) | — |
| Selección en Clientes | [Captura](after-clientes-selection-320.png) | [Captura](after-clientes-selection-390.png) | — |
| Inventario vacío | [Captura](after-empty-320.png) | [Captura](after-empty-390.png) | [Captura](after-empty-1440.png) |
| Inventario cargando | [Captura](after-loading-320.png) | [Captura](after-loading-390.png) | [Captura](after-loading-1440.png) |
| Error de borradores | [Captura](after-error-320.png) | [Captura](after-error-390.png) | [Captura](after-error-1440.png) |

[Contrato y diseño OpenSpec](../../openspec/changes/fix-mobile-navigation-450/design.md).
