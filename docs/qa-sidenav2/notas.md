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

## Tipografía, desplegables y Más (seguimiento)

- `audit-layout.css` aplicaba `.desk-app:has(.stock-page, .history-screen) .ditem`: cambiaba los ítems de 14px/700 (hijos 13px/700) a 15px/600, y `.side` de 248 a 246px. Los ítems medían 219px en Dashboard y 217px en Historial; line-height seguía `normal`. Eliminadas las reglas del sidenav; tokens limitados al contenido/overlay y fondo preservado en `.stage`.
- Más no tenía separación perfil/nav. Además, `.desk-app button` anulaba el fondo y borde de `.mprofile`. La tarjeta recupera esos estilos con especificidad adecuada y `margin-bottom: var(--space-4)` (16px); el banner conserva sus 14px. Flujo normal, sin posiciones nuevas.
- Migrados a `DeskSelect`: Persona/Período/Acción/Sección de Historial; Proveedor de Equipos (escritorio, móvil y hoja de filtros); Proveedor del formulario de equipo; Venta de Nuevo reclamo; reasignación de catálogos/estados; Moneda/Condición y mapeo de columnas de Importar. Reportes y los demás formularios ya lo usaban. Se conservan labels, valores, opciones deshabilitadas, filtros y formas compactas.
- Escáner: `focusNextControl` reconoce los botones `role="combobox"` del selector propio; conserva el foco IMEI → Proveedor en lugar de saltar a Costo. Las 34 pruebas de TAC/wedge pasan después de la regresión detectada en CI.
- Únicos nativos conservados: el control oculto/aria-hidden del propio `DeskSelect` para formulario/validación; tres selects de `pages/Onboarding.tsx` y dos de `pages/StockOnboarding.tsx`, pantallas de onboarding fuera del desk y sus modales, con su propio estilo.
- Validación local: TypeScript frontend/backend; 305 pruebas relacionadas (18 archivos, máximo dos workers); E2E de importación desktop/mobile; regresión de navegación en las 22 rutas a 1440×900 y 390×844, con estilos de items/labels (tamaño, line-height, peso, ancho). En la tienda sembrada, el ancho libre del label varía cuando desaparece su badge al leer una sección: el JSON conserva el ancho bruto y verifica el ancho más el espacio del badge; el ancho del ítem y la tipografía son constantes. La regresión con tienda nueva compara también los anchos brutos.
- Más: 390×844, 360×740 y 375×667; con/sin banner Android, cada grupo abierto/cerrado y scroll al último destino por encima de `.mtab`. Filtros verificados con flechas/Home/End/Enter/Escape, restauración de foco, scroll y popup dentro del viewport. Sin errores de página. Solo API 3430, web 4430 y datos falsos de `imanager_sidenav2`; sin build.
- Evidencia externa mínima en `/workspace/qa-sidenav2/`: `historial-before-1440.png`, `historial-after-1440.png` (lista propia abierta), `historial-select-390.png`, `mas-before-390.png`, `mas-after-390.png`, `mas-banner-after-390.png`. Mediciones: `font-before.json`, `font-after.json`; ejecuciones: `font-tests-final.log`, `font-scanner-tests.log`, `font-e2e.log`, `font-import-e2e.log`, `font-final.log`. PNG revisados visualmente.
