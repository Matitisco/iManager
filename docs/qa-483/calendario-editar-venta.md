# Calendario de Editar Venta — #483, punto 16

## Causa y corrección

A 1440×620, `.sheet-scroll` mide 361 px y el calendario requiere 373 px. El posicionamiento anterior lo limitaba a la mayor mitad del cuerpo: terminaba con 212 px de alto y scroll propio. Desplazar el formulario no puede resolver un cuerpo menor que el panel.

`placeCalendar` recibe el viewport visual además del cuerpo preferido. Conserva la ubicación dentro del cuerpo cuando alcanza; de lo contrario muestra el panel completo al costado del campo (derecha/izquierda), o lo voltea/reubica dentro del viewport. Solo limita su altura si el viewport completo es menor que el panel. Usa la altura real de contenido más bordes, incluso tras una restricción previa de `maxHeight`. Sigue respondiendo a scroll, ResizeObserver, resize y cambios del viewport visual.

En móvil se conserva `dp-inline` y se desplaza únicamente el formulario al abrir, para revelar el pie del calendario por encima de las acciones fijas. Se reutilizan `.dp-*`, `.sheet-scroll` y los tokens vigentes: no se agrega CSS, texto de UI ni dependencias.

## Evidencia local

App en API 3380 / web 4380, PostgreSQL ficticio dedicado `imanager_483b` en 127.0.0.1:5433. Cuenta `dueno@imanager.local`. Todos los clientes, ventas e importes de las capturas son datos de ejemplo. Sin acceso a producción ni cambios de schema.

Capturas y script reproducible: `/workspace/qa-483/calendario/`. Chrome `/usr/bin/google-chrome`, `--no-sandbox`; escritorio @1x y móvil @2x. Comparación visual con el calendario de las referencias RMA de la guía de diseño.

| Tamaño | Antes | Después |
| --- | --- | --- |
| 1440×620 | Panel de 212 px, contenido de 373 px; pie y semanas recortados | Panel completo de 373 px, x=970 / y=235, a 8 px del campo y 12 px del borde inferior del viewport |
| 1440×900 | Panel completo dentro del cuerpo | Misma geometría: x=478 / y≈383,6, sin scroll propio |
| 390×844 | Calendario inline con pie parcialmente detrás de las acciones | Formulario desplazado 35 px; panel de y≈388,1 a 761,1, completo y sobre el pie fijo |

Archivos: `antes-1440x620.png`, `despues-1440x620.png`, `antes-1440x900.png`, `despues-1440x900.png`, `antes-390x844.png`, `despues-390x844.png`; métricas en `antes.json` y `despues.json`.

`node /workspace/qa-483/calendario/capturas.mjs despues` verifica además la ausencia de scroll propio, los límites visibles, selección de fecha, restauración del foco, Escape sin cerrar la venta y resize 620↔900 con el calendario abierto. Sin errores de página. No guarda cambios en las ventas.

## Verificación automatizada

- `npm run lint` y `npm --prefix backend run lint`: aprobados; equivalen a `tsc --noEmit`.
- Regresión de función pura y componente: 24 pruebas, incluyendo 1440×620, altura medida distinta de la estimada, bordes, giro a izquierda, viewport visual desplazado, viewport menor que el panel y revelado inline.
- Suite frontend completa: 215 archivos aprobados, 1.914 pruebas aprobadas; dos timeouts y un worker que no arrancó. Se repitieron los tres archivos afectados junto con las pruebas relacionadas, con un worker: garantías y tablas aprobaron; layout registró un timeout en otra prueba. Reintento aislado de layout con `--testTimeout=20000`: sus 24 pruebas aprobaron. Todos los archivos quedaron verificados; logs completos en el directorio de evidencia.
- El reintento relacionado cubre selección y payload de fecha en el formulario real de Editar Venta, canjes, otros formularios de fecha, Reportes y capas modales (120 pruebas entre los archivos repetidos).
- Backend: suite unitaria completa, 84 archivos / 606 pruebas aprobadas. La integración backend y el smoke E2E quedan cubiertos por el CI del PR.
- `git diff --check`: aprobado.

## Alcance y limitaciones

El validador de clases de la guía avisa que falta `.hist-screen`: el catálogo quedó desactualizado tras los cambios previos del historial RMA. No se usa ni se agrega esa clase en este cambio. Se mantienen los textos y estilos existentes de Editar Venta, incluido su subtítulo previo. El scroll del panel sigue siendo necesario si el viewport es físicamente menor que el calendario. No se evaluaron otros puntos de #483.
