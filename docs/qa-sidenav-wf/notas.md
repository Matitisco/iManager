# Sidenav con acordeón exclusivo aprobado

Prototipo aprobado por Matias el 23/10/2026; implementación en `wireframe/sidenav-acordeon`, rebasada sobre `origin/main` (`6fb919b`). Inventario del relevamiento previo: [INVENTARIO.md](INVENTARIO.md). La aprobación reemplaza R20 de la guía visual para esta navegación.

## Qué cambia

- Comercial, Stock, Atención, Finanzas, Análisis y Cuenta tienen botones de expandir/cerrar. Puede haber cero o un grupo abierto. Expandir no navega ni remonta el contenido.
- La ruta activa abre su grupo antes de pintar. Un usuario puede cerrarlo manualmente. Cambiar de ruta, incluidos Atrás/Adelante y vistas del mismo módulo, sincroniza el grupo y el destino seleccionado.
- Los destinos usan `aria-current="page"`. Los botones de grupo usan `aria-expanded` y `aria-controls`; Enter/Espacio alternan y Tab recorre controles nativos. Foco neutro visible, sin animaciones nuevas.
- Se retiran los GroupTabs del shell y el tablist particular de Reportes. Resumen periódico vive bajo Reportes con su ruta propia `#/analisis/resumen-periodico` de #534, sin duplicar el destino. Se conservan las correcciones de sincronización, selectores y CI de #535. Devoluciones ofrece Reclamos y Patrones en el menú; desaparece su selector de Vista. Catálogo móvil ofrece Resumen y Equipos desde Stock.
- En 390 se reutiliza la pantalla Más con el mismo componente de navegación. Mantiene la barra inferior y abre el grupo de la última pantalla visitada. No había drawer ni modo compacto; no se agregaron. Por eso la captura del modo compacto no aplica.
- Se conservan los filtros de registros y las reglas de acceso de `desktopNav`, `sectionAllowed` y módulos ocultos. Cuenta corriente, Seguimientos, Cajas y Gastos no se reactivan. Mis comisiones conserva su comportamiento propio para empleados.

## Componentes y estilos

Se reutilizan `ditem`, `dgroup`, `dnav`, `dcount`, `dic`, `side`, `mprofile`, `av-c k`, íconos reales y DM Sans. CSS aditivo en `src/desk/desk.css`: prefijo `sn-` para jerarquía, borde de grupo, chevron, scroll y foco; colores de `--card`, `--bg`, `--border`, `--primary` y `--secondary`. Selección con el lime-soft existente. Ancho desktop original de 248 px, filas originales de 42 px, área táctil móvil mínima de 44 px. Sin textos secundarios nuevos ni indicadores de carga nuevos. Avatar del menú reutiliza la variante negra existente.

`GroupTabs` sigue disponible para otros contextos y pruebas aisladas; el shell lo suprime explícitamente con NavChrome. Las vistas nuevas del menú reutilizan el hash y la lógica existentes; no hay datos de negocio en un estado paralelo.

El verificador de clases de la guía reconoce los componentes utilizados. Reporta `.hist-screen` ausente también en la base actual (la guía referencia un historial móvil anterior); este prototipo no usa esa clase. Los colores heredados de gráficos/estados fuera del menú se conservan: no se rediseñaron esas pantallas.

## Entorno y datos

App en http://127.0.0.1:4410, API http://127.0.0.1:3410, PostgreSQL falso `imanager_sidenav` en loopback :5433. Login dueño: `dueno@imanager.local` / `test123456`; empleado: `empleado@imanager.local` con la misma contraseña de prueba. Datos sembrados de ejemplo, sin usar DB real ni tocar producción. Sin cambios de API, schema, AppContext o dependencias. No se ejecutó build.

Runner externo: `/workspace/qa-sidenav-wf/run-local.sh /workspace/wt-sidenav`. Se instalaron las dependencias faltantes con npm ci. Vite usa `CHOKIDAR_USEPOLLING=true` porque el entorno agotó los watchers; no cambia el repo.

## Capturas

Carpeta `/workspace/qa-sidenav-wf/`; galería `index.html`. Playwright con `/usr/bin/google-chrome` y `--no-sandbox`. Desktop 1440×900 @1x; móvil 390×844 @2x (PNG 780×1688).

| Prefijo | Estado | Anchos |
|---|---|---|
| 01-antes | Menú actual en Dashboard | 1440, 390 |
| 02-antes | Más actual con todos los enlaces | 390 |
| 03-antes | Inventario con islitas | 1440, 390 |
| 04-antes | Reportes con islitas | 1440, 390 |
| 05-antes | Historial con islitas | 1440, 390 |
| 06-antes | Resumen periódico con islitas | 1440, 390 |
| 07-antes | Devoluciones con selector de vistas | 1440, 390 |
| 10-despues | Todos los grupos cerrados | 1440, 390 |
| 11-despues | Stock desplegado con Enter | 1440, 390 |
| 12-despues | Análisis desplegado con Espacio; Stock cerrado | 1440, 390 |
| 13-despues | Reportes sin tabs de navegación | 1440, 390 |
| 14-despues | Más recupera Análisis y Reportes activo | 390 |
| 15-despues | Resumen periódico desde menú | 1440, 390 |
| 16-despues | Inventario sin tabs de navegación | 1440, 390 |
| 17-despues | Historial sin tabs de navegación | 1440, 390 |
| 18-despues | Patrones desde menú, sin selector de vistas | 1440, 390 |
| 19-despues | Menú filtrado del empleado | 1440, 390 |
| 20-despues | Catálogo móvil con vistas en el menú | 390 |
| 21-despues | Cuenta activa en Más | 390 |

El antes no tiene estados de expansión/compacto: sus equivalentes son el menú macro y las islitas que se muestran al navegar. Las capturas son de viewport; las listas y Más pueden desplazarse verticalmente. El marco de foco negro en 11/12 es intencional: demuestra navegación por teclado.

## Verificación

- `npm run lint` y `npm --prefix backend run lint`: TypeScript sin errores; los scripts lint del repo son `tsc --noEmit`.
- Suite frontend completa: 219 archivos / 1.944 pruebas, 204,72 s con dos workers. Repetición final posterior a dividir la matriz de Análisis y sumar pruebas de Tab: resultado en `produccion-suite-final.log`.
- Shell y acordeón finales: 66 pruebas aprobadas, incluyendo las 24 transiciones independientes de Análisis, URL de Resumen periódico, contadores, permisos, exclusividad, Enter/Espacio y Tab. Se dividió la matriz para evitar el timeout de un solo test con doce transiciones; sin ampliar timeouts globales.
- Reportes: las 25 pruebas pasaron con un worker. El timeout previo no se reprodujo con carga controlada. Las pruebas de Devoluciones y Patrones usan las rutas del menú; el vacío se comprueba semánticamente por su encabezado.
- E2E locales: ocho flujos distintos aprobados entre humo de onboarding/equipo/venta, menú móvil dueño/empleado, resumen periódico y contadores de escritorio/móvil. Tres flujos adicionales de Comisiones, Catálogo de escritorio y navegación legacy aprobados. Cada runner usa un worker y la DB dedicada falsa `imanager_sidenav_tests` (:5433).
- Playwright visual: exclusividad, Enter/Espacio, activo por defecto, ausencia de islitas, Resumen periódico y Atrás en 1440/390; sin errores de página ni overflow. Dueño/empleado, acceso directo denegado a la ruta propia del resumen, Catálogo móvil y Cuenta verificados. Evidencia en `verificacion-playwright.json` y `verificacion-roles.json`.
- Se actualizaron el helper E2E compartido y sus consumidores: los grupos ya no navegan y los destinos cerrados no son visibles. Los casos aislados de GroupTabs se conservan para contextos sin sidenav.
- La expectativa E2E de un botón Reintentar en Resumen periódico era anterior al comportamiento actual: se comprueba un 503 sin contenido falso y la recuperación mediante cambio de período, sin alterar el producto.
- Verificador de clases: falta heredada `.hist-screen`, también ausente en la base; el sidenav no la usa. Sin tokens nuevos, sin build local.

## Decisiones para producción

- Los tipos de Reportes (Ventas, Stock, Canjes, Clientes, Servicio y Comisiones según permisos), períodos y dimensiones permanecen como filtros del reporte.
- Todos/Activos/Archivados y Proveedor/Compra/Modelo permanecen en Devoluciones: filtran o agrupan datos. Reclamos/Patrones son vistas y se accede desde Comercial en el menú; cada destino conserva su URL y el historial del navegador.
- Catálogo móvil conserva Resumen/Equipos accesibles desde Stock en Más. En escritorio ambas columnas siguen juntas.
- Se mantiene Más con el mismo acordeón y la barra inferior existentes. Sin drawer ni compacto nuevos.
- Reporte automático es el formulario de envío por email exclusivo del dueño; no es Resumen periódico. Encendido y frecuencia siguen siendo campos del formulario.

## Cierre de producción

Capturas seleccionadas: [antes de Reportes](capturas/antes-reportes-1440.png), [después de Reportes](capturas/despues-reportes-1440.png), [antes de Más](capturas/antes-mas-390.png), [después de Más](capturas/despues-mas-390.png). Revisadas visualmente en ambos tamaños. Los scripts y logs de QA están en `/workspace/qa-sidenav-wf/`; solo las capturas seleccionadas para el PR se incluyen en el repo. Sin cambios de datos reales, API, schema o dependencias y sin build local.
