## Context

La tabla de inventario cargaba todos los productos sin límite, lo que degradaba la performance con inventarios grandes. Además, no había forma de seleccionar múltiples items para operaciones en masa, ni de ordenar por criterios relevantes (precio, batería, modelo).

## Goals / Non-Goals

**Goals:**
- Paginación client-side: 20 items/página, botones numerados con elipsis
- Ordenamiento client-side por Modelo, Precio, Batería, Condición
- Selección masiva: checkbox por fila, Shift+click para rangos, header checkbox = seleccionar todos en página
- Bulk delete con confirmación modal
- Split de `capacityColor` en columnas independientes `Capacidad` y `Color`
- Columna de estado: Disponible / Vendido + fecha de venta
- Click en fila → modal de edición completa

**Non-Goals:**
- Paginación server-side (el backend devuelve todo; la paginación es client-side)
- El orden no persiste entre sesiones
- No hay ordenamiento por columnas custom

## Decisions

**1. Paginación client-side**
El backend devuelve todos los productos del store. La paginación se aplica sobre el array en memoria. Es suficiente para inventarios de hasta ~500 productos. Si crece, se migrará a paginación server-side.

**2. Shift+click para rangos**
El estado mantiene un `lastCheckedIndex` para resolver rangos de selección. Comportamiento igual al de los gestores de archivos.

**3. Split de capacityColor**
Era un campo concatenado (`"128GB Negro"`) que impedía filtrar por capacidad o color independientemente. Se separó en dos campos en el schema de Prisma.

**4. Estado de venta como campo calculado**
`sold: boolean` + `soldDate: DateTime?` en el schema. La columna de estado se renderiza en el frontend sin lógica extra en el API.

## Risks / Trade-offs

- **Paginación client-side con datos grandes**: con >500 productos el array en memoria puede ser grande. Mitigación aceptada hasta que el uso lo justifique.
- **Reset de selección al cambiar página**: la selección se limpia al navegar entre páginas para evitar confusion. Trade-off intencional.
