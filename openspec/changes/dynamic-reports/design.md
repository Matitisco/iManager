## Context

`Reports` es hoy una pantalla puramente visual con valores hardcodeados. Aunque `AppContext` ya carga varias colecciones reales, usar ese estado para reporting tiene dos problemas: mezcla datos de distintos módulos con estrategias de carga diferentes y obliga a duplicar lógica agregada en el cliente. Inventory, por ejemplo, ya tiene caminos paginados y listados completos según el consumo.

El cambio cruza backend y frontend, pero no requiere cambios de schema. La solución debe respetar la regla del repo de no mostrar datos demo cuando el backend no está listo.

## Goals / Non-Goals

**Goals:**
- Centralizar el cálculo de métricas en un endpoint backend por store autenticado.
- Permitir que la pantalla consuma un resumen consistente para un rango seleccionado.
- Mostrar estados claros de carga, vacío y error sin fallback a mocks.
- Mantener el cambio acotado, sin meter reportes dentro de `AppContext`.

**Non-Goals:**
- No crear un sistema genérico de analytics reutilizable por Dashboard.
- No agregar caching, jobs ni materialized views.
- No implementar export server-side; alcanza con export local del resumen visible.

## Decisions

### 1. Endpoint agregado dedicado
Se agrega `GET /api/reports/overview` en un módulo nuevo de Fastify. El endpoint recibe `rangeKey`, `startDate` y `endDate`, valida el contexto del store y devuelve un payload listo para render.

Se elige esta opción sobre calcular todo en `Reports.tsx` porque:
- evita depender de qué datasets están o no cargados en memoria;
- mantiene la lógica de negocio y agregación cerca de Prisma;
- deja la pantalla lista para crecer sin tocar `AppContext.tsx`.

### 2. Agregación en servicio con Prisma + reducción en memoria
El servicio consulta ventas, canjes, clientes e inventario filtrados por store y rango, y arma los agregados en TypeScript. Para esta primera iteración es suficientemente simple, evita SQL ad hoc más difícil de mantener y no requiere cambiar el schema.

Alternativa descartada:
- usar queries SQL agregadas por cada widget. Se descartó por complejidad innecesaria para el volumen actual y porque vuelve más rígido el shape de respuesta.

### 3. Rango controlado desde el frontend
La UI calcula los límites temporales del preset elegido y los envía al backend. Así la interpretación del rango sigue la zona horaria efectiva del navegador del usuario y no depende del timezone del contenedor en Railway.

### 4. UI honesta y autocontenida
La página gestiona su propio fetch con un service dedicado. Si el backend no está `ready`, muestra una advertencia y no renderiza métricas ficticias. El botón de exportación genera un CSV local con el resumen visible.

## Risks / Trade-offs

- [Rango horario] Los registros históricos pueden venir de fechas parseadas en distintos contextos horarios. → Mitigación: el filtro se envía con límites explícitos y la UI usa copy de “rango visible” en lugar de prometer precisión contable fina.
- [Costo de agregación] El endpoint reduce datos en memoria. → Mitigación: se limita al store autenticado y reutiliza modelos ya indexados por `storeId` y fecha.
- [Relaciones faltantes] Algunas ventas pueden quedar sin `inventoryItem` si el producto fue borrado. → Mitigación: el margen usa costo `0` cuando no hay referencia y la UI lo etiqueta como estimado.

## Migration Plan

1. Registrar el nuevo módulo backend en `app.ts`.
2. Exponer `GET /api/reports/overview` con validación de rango.
3. Crear el service frontend y el tipo compartido del payload.
4. Reemplazar la página mockeada por la vista dinámica.
5. Correr `npm run lint` en frontend y backend.

Rollback:
- quitar el registro del módulo y volver a la página anterior si apareciera una regresión visual o de datos.

## Open Questions

- Ninguna para esta iteración. Si después se pide export contable o dashboard real-time, conviene separar una capa de analytics compartida.
