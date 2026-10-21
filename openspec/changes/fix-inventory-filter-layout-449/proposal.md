## Why

#449: las etiquetas del panel de inventario heredan el tamaño 18×18 de `.chk`; los textos largos se parten y los colores desplazan batería/precio.

## What Changes

- Opciones con ancho completo, texto natural y área táctil de al menos 44 px, con estilos exclusivos del panel.
- Batería/precio antes de Color; colores plegables y buscables sin modificar los valores guardados.
- Cantidad de grupos seleccionados y explicación de Limpiar/Aplicar; conservar borrador y modal compartido de #447.

## Impact

Frontend, pruebas automatizadas aisladas y documentación. Sin cambios de backend, permisos, schema o normalización. Sin build, commit, push ni operaciones productivas.
