# Diseño

Agregar `margin-left: auto` a `.gfilters .gperiods` para alinear el grupo en desktop, incluso al pasar a otra línea. Dentro del breakpoint móvil existente (760 px), agregar el mismo margen al primer chip para ocupar únicamente el espacio libre sin impedir el scroll. No modificar JSX ni otros estilos.

Validar con Playwright sobre PostgreSQL local: desktop 1280×800 y desktop con salto de línea; WebKit iPhone 393×852, 320 px y una fila móvil donde entren los chips. Capturar BEFORE antes de editar código y AFTER con los mismos tamaños y navegadores. Ejecutar lint, TypeScript, Vitest, build y e2e de Reportes/permisos.
