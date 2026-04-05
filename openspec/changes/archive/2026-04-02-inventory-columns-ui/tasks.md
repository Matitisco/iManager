## 1. Columnas redimensionables

- [x] 1.1 Drag handle en el borde derecho de cada header de columna
- [x] 1.2 Pointer events para resize: `pointerdown` en handle → `pointermove` en document → `pointerup`
- [x] 1.3 Respetar `MIN_COL_WIDTH` como límite inferior
- [x] 1.4 Fix: `table-layout: fixed` para que los anchos custom sean respetados

## 2. Columnas reordenables

- [x] 2.1 Pointer events para reorder: `pointerdown` en header → floating pill → `pointerup`
- [x] 2.2 Floating pill con nombre de columna que sigue el cursor durante el drag
- [x] 2.3 Cursor oculto durante el drag; restaurado al soltar
- [x] 2.4 Indicador vertical de posición de drop entre columnas
- [x] 2.5 Aplicar nuevo orden al soltar

## 3. Columnas renombrables

- [x] 3.1 Doble click en header → input inline con el nombre actual
- [x] 3.2 Enter o blur → guarda via API; Escape cancela
- [x] 3.3 Límite de 30 caracteres en nombre de columna
- [x] 3.4 Headers planos: sin gradiente, sin borde inferior; indicador de edición con borde redondeado

## 4. Menú contextual

- [x] 4.1 Right-click en fila → menú contextual flotante con acciones
- [x] 4.2 Acciones individuales: Editar, Eliminar, Mover a categoría
- [x] 4.3 Acciones bulk si hay selección: aparecen en el mismo menú
- [x] 4.4 Fix: botones del menú no disparaban por cierre prematuro en mousedown → corregido

## 5. UX polish

- [x] 5.1 Escape → deseleccionar todos los rows
- [x] 5.2 Tercer tier de color en battery indicator: rojo para < 70%
- [x] 5.3 Fix: cursor management en `useEffect` para evitar cursor invisible pegado en hover
- [x] 5.4 Cerrar modales (Columnas, Filtros, Importar) al hacer click fuera
