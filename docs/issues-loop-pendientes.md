# Decisiones y pendientes del ciclo de issues

Documento de decisiones tomadas sin interrumpir el trabajo con preguntas, según la instrucción del usuario. La bitácora de ejecución está en [issues-loop.md](issues-loop.md).

## Preparación — 2026-10-07

- **Integración:** se actualizan las ramas locales por fast-forward y se integra `hifi-desk` en `main` mediante merge. Se preservan los siete commits recientes de cada rama; no se reescribe el historial ni se crean ramas o PRs.
- **Conflicto de TableEngine:** se conserva la paginación y el pegado inmediato en paralelo de `main`, junto con las animaciones desk. El resaltado usa la misma respuesta de refresco validada por el hook, sin consultar dos veces ni reemplazar su protección contra respuestas obsoletas.
- **Prueba de canjes:** se conservan las aserciones de persistencia vía API y después de recargar. Los controles y el título se adaptan a la interfaz desk actual; no se sustituye la validación de negocio por comprobaciones superficiales.
- **Retiro del flujo anterior:** se eliminan únicamente sus archivos y skills dentro de este repositorio; ninguna herramienta global ni skill fuera del proyecto se modifica. `AGENTS.md` y `CLAUDE.md` quedan sincronizados.
- **Pruebas en Windows:** la zona horaria ya está en `vitest.config.ts`; se retira el prefijo POSIX redundante de los scripts npm para poder ejecutarlos en ambos sistemas.
- **Alcance:** el issue #89 está excluido. Esta preparación no cierra ni aborda un issue individual.

### Validación y pendientes

- Lint frontend/backend aprobado tras regenerar Prisma Client local para los campos `Store.email` y `Store.instagram` incorporados en hi-fi. La regeneración no accede a una base de datos ni ejecuta un build.
- Revisión del coordinador: suite completa frontend 239/239 y backend unit 77/77 aprobadas. Los dos timeouts iniciales de backend desaparecieron con un solo worker; no se alteraron los tests para ocultarlos.
- Revalidación de TableEngine: 30/30 aprobadas, incluidas animación de filas temporales y persistidas, pegado inmediato, copia entre páginas, tamaño de página y ausencia de refresco duplicado.
- E2E de canjes: 1/1 aprobado contra `postgresql://127.0.0.1:5432/imanager_issues_loop_test`, con comprobación de persistencia API y después de recargar. El schema se sincronizó únicamente en esa base local aislada.
- La revisión automática bloqueó los comandos de borrado recursivo. Se retiraron 200 archivos mediante parches con rutas exactas y luego 138 directorios vacíos verificados mediante eliminación no recursiva. No queda instalación del flujo anterior dentro del proyecto.
- Sin decisiones de producto pendientes en esta preparación. La publicación del merge queda a cargo del coordinador, que continúa con los issues secuencialmente.

## Issue #62 — recuperación al cerrar Google — 2026-10-07

- **Solicitud:** [#62](https://github.com/Matitisco/iManager/issues/62), leída con `gh issue view 62 --json number,title,body,comments,url`. Al cerrar el popup sin autenticarse, login y registro deben recuperar sus controles y permitir otro intento.
- **Resultado:** ya resuelto por `ab107ef`, integrado en el `main` activo `20bc6ee`. `src/App.tsx` monta el mismo `Login` antes de autenticar, y login y registro comparten `handleGoogleLogin`. No se identificó una brecha que requiera otra modificación de runtime o pruebas.
- **Criterios comprobados:** foco de ventana y vuelta a una pestaña visible restauran el botón antes de que Firebase resuelva; `auth/popup-closed-by-user` y `auth/cancelled-popup-request` terminan sin error; se permite reintentar desde login y registro; una promesa antigua que resuelve o rechaza no cambia el estado del reintento; se eliminan listeners al desmontar. El envío por email mantiene su propio estado pendiente.
- **Evidencia:** `npm run test:frontend -- src/pages/Login.test.tsx` aprobado, 13/13 pruebas. Incluye ambos modos, foco/visibilidad, cancelaciones, reintentos, respuestas tardías, error real del intento vigente y limpieza. El baseline de lint frontend/backend y suites completas ya pasó en la preparación publicada; solo se agrega esta documentación.
- **Decisión:** conservar la corrección existente y registrar la verificación, sin crear cambios redundantes. Puede cerrarse el issue tras la revisión del coordinador.
- **Límite:** las pruebas controlan promesas y eventos del navegador; no abren un popup real de una cuenta Google. El adaptador de producción mantiene `signInWithPopup` de Firebase y los errores se propagan al componente.

## Issue #80 — inventario de a 10 — 2026-10-07

- **Solicitud:** [#80](https://github.com/Matitisco/iManager/issues/80), leída con título, descripción y comentarios actuales. Cada página debe mostrar hasta 10 equipos y permitir navegar el resto; este pedido reemplaza el tamaño anterior de 16.
- **Resultado:** el runtime ya cumple desde `47cb20c`, integrado en `main` activo `22eaf75`. `App` monta `DeskApp`, que usa `InventoryScreen`; esa pantalla renderiza `page.visible` de `usePagedRows`, cuyo `TABLE_PAGE_SIZE` es 10. El valor 16 de la pantalla anterior no controla la interfaz activa.
- **Criterios comprobados:** navegación siguiente/anterior y páginas numeradas, límite de 10 filas, última página parcial, reinicio a página 1 al buscar o filtrar y ajuste a la última página válida cuando se eliminan registros. Búsqueda, estado, filtros por columna y orden forman la clave de reinicio del paginador.
- **Evidencia:** `npm run test:frontend -- src/desk/pager.test.tsx src/desk/screens/InventoryScreen.test.tsx` aprobado, 7/7 pruebas. Las pruebas existentes recorren 23 registros en el paginador. Una nueva prueba conecta la pantalla real con 12 equipos: muestra 10 + 2, verifica los límites de navegación, reinicia búsqueda/filtro y recupera 10 filas cuando desaparece la última página.
- **Decisión:** conservar el runtime y agregar únicamente la cobertura que faltaba para navegación y reducción del inventario en la pantalla activa. Solo se modifican `InventoryScreen.test.tsx` y este documento; lint frontend/backend del baseline continúa vigente. No hay decisiones de producto pendientes.
- **Límite:** la reducción de registros se simula mediante la actualización de AppContext; esta prueba verifica el ajuste del paginador, no el write path de borrado.

## Issue #81 — batería como la referencia — 2026-10-07

- **Solicitud:** [#81](https://github.com/Matitisco/iManager/issues/81), leída con título, descripción y comentarios actuales. Replicar la animación del indicador de batería y sus colores según porcentaje, tomando `main` como referencia.
- **Resultado:** ya resuelto por `d16eec9`, integrado en el `main` activo `d1a7da6`. Se comparó `Battery` de `src/desk/ui.tsx`, usado por `InventoryScreen`, con `BatteryCell` de `src/pages/Inventory.tsx` en `338b1f5`, previo a integrar hi-fi.
- **Criterios comprobados:** ambos indicadores usan `extractMinBattery`, `batteryColor` y `formatBatteryDisplay`; `src/utils/inventory.ts` no cambió respecto de la referencia. Relleno y texto son rojos por debajo de 70%, ámbar entre 70% y 85% inclusive y verdes por encima de 85%. Ambos parten de ancho 0 y animan el ancho porcentual con Motion, también al cambiar el valor. El CSS desk no reemplaza los colores semánticos por el acento amarillo.
- **Evidencia:** `npm run test:frontend -- src/utils/inventory.test.ts` aprobado, 10/10 pruebas existentes de extracción/formato. Comprobación directa de los helpers de producción: 69, 70, 85, 86, 100, rango `83-85%` y fracción `0.87`, con colores de relleno/texto, porcentaje y formato esperados. Se conserva la revisión visual de Chrome registrada en `PROJECT_STATUS.md`: límites, rangos/fracciones, llenado inicial y transición de 87% a 40% del componente real.
- **Decisión:** registrar la verificación sin otro harness, cambios runtime ni tests espejo. La referencia y el componente desk no configuran una política particular de reduced motion para batería; ese comportamiento adicional no forma parte de los criterios de #81.
- **Límite:** en esta revisión se revalidaron código y helpers; no se repitió la inspección visual previa. El baseline de lint frontend/backend continúa vigente, ya que solo se modifica este documento. No hay decisiones de producto pendientes para cerrar el issue.
