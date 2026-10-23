# Sidenav de dos niveles y Patrones

| Grupo | Destinos del dueño |
| --- | --- |
| Comercial | Ventas, Canjes, Devoluciones |
| Stock | Equipos, Control de stock, Catálogo |
| Atención | Clientes, Servicio técnico |
| Finanzas | Proveedores |
| Análisis | Reportes, Patrones, Comisiones, Historial, Resumen periódico |
| Cuenta | Notificaciones, Ayuda, Configuración |

Dashboard sigue como acceso directo. Los módulos ocultos y los permisos existentes siguen filtrando cada grupo. Patrones hereda Ventas: por eso un empleado con Ventas ahora encuentra Patrones y Mis comisiones dentro de Análisis.

## Causa del blanco

Reproducido antes del cambio en Chrome local, DB falsa `imanager_sidenav2`: `/api/returns/patterns?groupBy=supplier` respondió 200 con cero grupos, con título Devoluciones y sin contenido ni mensaje. `ReturnsPatterns` filtraba `problems > 0` y devolvía `null` cuando el resultado quedaba vacío; además convertía errores de consulta en ese mismo vacío. No fue un fallo de montaje por hash. Se conserva el filtro de #526 y se muestra «No hay equipos con problemas en esta agrupación.». Los errores ahora son visibles y una revalidación fallida conserva los últimos datos válidos.

## Decisiones de producto

- Patrones es una subsección de Análisis con ruta `#/analisis/patrones` y título propio. Proveedor/Compra/Modelo son filtros internos, alineados bajo el header.
- Devoluciones abre directamente la lista de reclamos/RMA. Comercial tiene exactamente tres destinos.
- Resumen periódico es hermano de Reportes y su título coincide con el destino. Conserva `#/analisis/resumen-periodico` y el permiso Reportes.
- Catálogo móvil muestra Resumen y Equipos en una misma pantalla, primero el resumen y luego la lista paginada. Sin tabs ni accesos anidados. Las URLs antiguas de vistas se unifican.
- Enlaces antiguos de Devoluciones/Patrones y Resumen periódico se canonicalizan reemplazando la entrada, conservando los parámetros de proveedor, agrupación y período. La memoria de presentación sigue aislada por entrada y por tienda/usuario/permisos.

## Validación y evidencia

TypeScript frontend/backend aprobado. 194 pruebas relacionadas de 11 archivos aprobadas. Chrome local con API 3430/web 4430: seis grupos desplegados en desktop 1440×900 @1x y móvil 390×844 @2x, Patrones vacío/con datos, tres agrupaciones, lista de Devoluciones, enlaces antiguos y ausencia de errores de página/desborde. 8 E2E relacionados de navegación, Catálogo, recuperación offline y resumen periódico aprobados.

Capturas revisadas en `/workspace/qa-sidenav2/`: `menu-{comercial,stock,atencion,finanzas,analisis,cuenta}-{1440,390}.png`, `patrones-{empty,data}-{1440,390}.png` y `devoluciones-{1440,390}.png`. Todos los datos son ficticios; se sembraron Importadora Andes (ejemplo), una compra, un iPhone 14 y RMA-9001 de Lucía Fernández (ejemplo), vinculados entre sí para verificar la API existente. Scripts y resultados locales en la misma carpeta; no se incluyen sesiones de prueba en git.

Se reutilizan `ditem`, `sn-children`, `dscreen`, `ScreenTitle`, `gfilters`, `gchip`, `wempty`, `ferr` y los skeletons reales. CSS mínimo: agrupación flexible de filtros, layout unificado de Catálogo móvil y eliminación del padding del tercer nivel. Sin build, dependencias, API, Prisma ni acceso a producción.
