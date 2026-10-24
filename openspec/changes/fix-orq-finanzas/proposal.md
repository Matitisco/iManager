## Why

QA local de Finanzas reprodujo estados ambiguos en Proveedores: la lista identifica archivados solo por color y el filtro Activos vacío afirma que nunca se cargaron proveedores, incluso después de archivar uno. Además, los campos móviles heredan texto menor a los 16 px requeridos por la guía.

## What Changes

- Identificar cada proveedor archivado con el texto visible y accesible «Archivado» en la lista.
- Mostrar «No hay proveedores activos.» cuando el filtro Activos no tiene resultados.
- Conservar el mensaje de primera carga en Todos y el mensaje específico de Archivados.
- Ajustar a 16 px los campos del formulario móvil de Proveedores, que heredan 15 px en inputs y 14 px en Notas.

## Capabilities

### New Capabilities
- `supplier-list-status`: estado accesible de archivo y vacíos según el filtro.

### Modified Capabilities
- Ninguna.

## Impact

Solo SuppliersScreen, CSS local de Proveedores y pruebas relacionadas. Se reutiliza la píldora existente `spill mid`. No hay cambios de API, AppContext ni schema Prisma.

## Non-goals

Habilitar Caja/Gastos/Seguimientos, cambiar navegación, rediseñar pantallas, modificar componentes compartidos, backend, fixtures ajenos o procesos del runtime.
