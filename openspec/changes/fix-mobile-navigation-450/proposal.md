# Navegación y controles móviles (#450)

## Why
El contenedor real `.stage` hereda el desplazamiento al cambiar de módulo. Los indicadores de grupo no explican sus componentes y las listas móviles repiten controles secundarios.

## What changes
- Cada entrada nueva abre arriba; el historial restaura posición y estado de lista por entrada.
- Descripciones visibles y accesibles de pendientes, filtradas por permisos, sin alterar sumas.
- Opciones secundarias de Inventario, Ventas y Clientes plegadas, acción principal y navegación disponibles, espacio reservado según altura real de acciones.

## Non-goals
Sin backend, AppContext, Prisma, reglas de negocio, escáner, instalación ni rediseño general. Sin build, despliegue, commit o push.
