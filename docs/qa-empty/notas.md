# Devoluciones · estado vacío

El vacío se integra al fondo de la pantalla, sin card, borde punteado ni sombra. Ícono RotateCcw de lucide-react, título corto, descripción acotada y una única acción «Nuevo reclamo» que abre el formulario existente. Los textos distinguen Todos, Activos y Archivados. La cabecera y el dock mantienen sus acciones con registros, durante carga o ante error.

No existe un componente EmptyState compartido: Devoluciones reutilizaba `card team-empty`, CSS del módulo Equipo. El cambio queda acotado a Devoluciones para respetar los vacíos particulares de otras pantallas.

- Reutilizado: ScreenTitle, gfilters/gchip, btn2 p, ImanagerIcon/agregar, MobileDock fuera del vacío, tokens primary/secondary y DM Sans.
- CSS aditivo: ret-empty; padding 64/20 desktop y 40/16 mobile; ícono 24 px sin recuadro; h2 16/800; descripción 14/500, ancho máximo 320 y altura de línea 1.5; CTA 52 px con padding lateral 24 y foco neutro.
- La descripción solicitada y la ausencia de borde prevalecen sobre R1/R24 de la guía únicamente para este vacío. Se conserva la cabecera sin subtítulo.

## Evidencia

Capturas de la app real con API interceptada y datos ficticios (Tienda de prueba, usuario y cotización de ejemplo). Sin conexión a base de datos ni backend de producción. Antes: commit 1827dda. Copia original de los cuatro PNG en `/workspace/qa-empty/`.

| Tamaño | Antes | Después |
| --- | --- | --- |
| Desktop 1440×900 @1x | [Antes](antes-1440.png) | [Después](despues-1440.png) |
| Mobile 390×844 @2x | [Antes](antes-390.png) | [Después](despues-390.png) |

Los cuatro PNG fueron inspeccionados visualmente. Chromium verificó geometría sin overflow, ausencia de borde/sombra del contenedor, un solo CTA, textos de los tres filtros y apertura del formulario por teclado a ambos tamaños. La barra de navegación móvil permanece visible y libre de superposiciones.

## Validación

TypeScript frontend/backend y 38 tests relacionados (returns-screen, returns-patterns, archived-load-failures) aprobados con máximo dos workers. `verificar-clases.sh` y `git diff --check` aprobados. Sin build ni watchers; servidor QA con `watch: null` y HMR deshabilitado. Comandos limitados a 600 segundos.

Entrega en PR abierto para revisión de Matias; sin merge.
