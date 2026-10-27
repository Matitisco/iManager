## Why
Inventory muestra todas las tarjetas de mapeo a la vez. La variante C elegida divide Ajustar importación en Archivo, Columnas y Resumen para reducir la cantidad de decisiones simultáneas.

## What Changes
- Archivo conserva hojas y encabezado; Columnas presenta pendientes estables durante la edición; Resumen agrupa destinos y permite corregir cualquier columna.
- Se conservan importación, validaciones, campos personalizados, accesibilidad y rama no inventario.

## Non-goals
Sin cambios de backend, AppContext, schema Prisma, datos ni flujo de otros módulos. Sin ejecución local de la app ni acceso a producción.

## Impact
Componentes ImportModal / ImportColumnCards, estilos y tests de frontend.
