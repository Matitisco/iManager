## Context

La página de Ventas hoy mezcla estadísticas, filtros, tabla, menú contextual y panel de edición manual dentro de un componente grande. Inventario ya resolvió este problema con `TableEngine`, así que Ventas puede adoptar el mismo template reusable sin tocar el backend ni el modelo de negocio.

El objetivo no es inventar una nueva tabla, sino mapear el dominio de Ventas al contrato existente del engine: datos locales, columnas customizables, selección, inline edit y acciones de fila.

## Goals / Non-Goals

**Goals:**

- Reemplazar la tabla artesanal de Ventas por `TableEngine`.
- Preservar la UX de tabla que Inventario ya expuso: selección, sort, paginación, inline edit, menu contextual, bulk actions y preferencias de columnas.
- Mantener filtros y panel de edición como capas de página, no como responsabilidad del engine.
- Hacer que la exportación de Ventas respete el view actual del usuario, incluyendo columnas ocultas y labels renombrados.

**Non-Goals:**

- Cambiar el backend de Sales.
- Añadir workflows propios de Inventario que no tengan sentido en Ventas, como categorías o drag-to-category.
- Rehacer el motor genérico de tablas.
- Introducir dependencias nuevas.

## Decisions

1. **Usar `TableEngine` en modo local para Ventas**
   - Ventas ya opera con datos cargados en memoria desde `AppContext`, así que no hace falta un adapter remoto.
   - Alternativa: adapter remoto específico para Sales. Rechazada por ahora porque no aporta valor y agrega complejidad innecesaria.

2. **Mantener filtros de Ventas fuera del engine**
   - Los filtros por fecha, cliente, modelo y método de pago siguen siendo responsabilidad de la página.
   - Alternativa: traducirlos a `TableEngine` filters. Rechazada porque no hay necesidad de unificar la UI de filtros ahora mismo y la página ya tiene ese contrato.

3. **Extraer helpers de dominio para Ventas**
   - Se crea una capa pequeña para construir filas derivadas, columnas, acciones y export.
   - Alternativa: dejar todo inline en `Sales.tsx`. Rechazada porque repetiría el problema de acoplamiento que ya sufrimos en la tabla vieja.

4. **Persistir preferencias de columnas con la misma convención del engine**
   - Ventas reutiliza el storage contract del motor para orden, visibilidad y labels.
   - Alternativa: inventar un storage paralelo por página. Rechazada porque fragmenta el contrato y hace más difícil reutilizar el template.

5. **Controlar solo la selección desde la página**
   - La selección debe poder limpiarse tras bulk delete y después de cerrar acciones.
   - Alternativa: dejar todo 100% interno al engine. Rechazada porque Ventas necesita coordinar confirmaciones y borrar filas seleccionadas sin estados fantasmas.

## Risks / Trade-offs

- [La exportación] no será una réplica exacta del estado interno de paginación del engine → La exportación se apoyará en la vista filtrada y en el sort tracking de página, que es suficiente para Ventas.
- [El refactor] puede mover bastante código de `Sales.tsx` → Se mitigará extrayendo helpers de dominio y dejando el componente page como orquestador.
- [La selección controlada] agrega un poco de estado extra en la página → A cambio permite limpiar selección después de bulk delete y evita inconsistencias.

## Migration Plan

1. Crear helpers de dominio para Ventas: filas derivadas, columnas, acciones y export.
2. Reemplazar la tabla custom por `TableEngine` con `viewId` estable.
3. Conectar selección controlada, acciones de fila y bulk delete.
4. Mantener el panel lateral de edición y los filtros existentes.
5. Agregar tests unitarios para los helpers y la exportación.
6. Validar el comportamiento sin ejecutar build; solo lint y tests focalizados.

## Open Questions

- Ninguna bloqueante. El alcance está suficientemente definido para implementar directamente.
