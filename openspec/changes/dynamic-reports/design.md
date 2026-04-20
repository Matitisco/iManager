## Context

`Reports` ya consume SQL real, pero hoy expone una sola composicion fija. El nuevo pedido no requiere otra fuente de datos sino mas flexibilidad sobre el mismo endpoint: filtros de fecha custom, valor real del inventario y bloques reordenables que el usuario pueda esconder o mostrar.

La restriccion principal del repo sigue igual: sin fallback silencioso si el backend no esta listo y sin llevar reportes a `AppContext`.

## Goals / Non-Goals

**Goals**
- Soportar un rango `custom` validado en backend.
- Entregar un payload suficientemente rico para widgets independientes.
- Permitir personalizar visibilidad y orden del layout sin agregar persistencia server-side.
- Mantener export local alineado con lo que el usuario ve en pantalla.

**Non-Goals**
- No crear un constructor libre de consultas.
- No guardar preferencias en PostgreSQL.
- No introducir librerias nuevas de date picker o drag-and-drop.

## Decisions

### 1. `rangeKey=custom` con validacion fuerte en backend
La ruta `GET /api/reports/overview` acepta `custom` y usa un helper comun para parsear fechas, exigir `startDate` + `endDate` y rechazar rangos invertidos con `400`.

Esto evita que cada cliente reimplemente reglas de validacion distintas y deja un contrato claro para tests.

### 2. Payload de overview ampliado, no endpoint nuevo
Se mantiene un solo endpoint de overview y se agregan:
- `inventory.valuation.costValue`
- `inventory.valuation.retailValue`
- `topProducts`

Se evita abrir otro endpoint porque el volumen de datos actual sigue siendo compatible con una respuesta unica por rango visible.

### 3. Personalizacion local por usuario + store
El layout se guarda en `localStorage`, scoping la clave por `user.uid` y `store.id`.

Se elige almacenamiento local porque:
- no requiere schema nuevo;
- respeta el alcance de la iteracion;
- cubre el caso principal de uso sin complejidad extra de backend.

### 4. Modal simple para orden y visibilidad
La personalizacion usa el `Modal` existente y controles explicitos de mostrar/ocultar y subir/bajar. No se agrega drag-and-drop en esta v1 para mantener el cambio liviano y predecible.

### 5. Export basado en widgets visibles
El CSV se genera desde helpers puros del frontend y solo incluye secciones correspondientes a widgets visibles. El rango aplicado siempre se agrega al final del archivo para trazabilidad.

## Risks / Trade-offs

- [Timezone del rango custom] Los inputs `type="date"` trabajan en horario local del navegador. Mitigacion: convertir a limites explicitos de inicio y fin del dia antes de pedir el overview.
- [Layout vacio] El usuario puede ocultar todos los widgets. Mitigacion: mostrar un estado vacio con CTA a `Personalizar`.
- [Cambio de contrato] `topModels` se reemplaza por `topProducts`. Mitigacion: actualizar tipos compartidos y pantalla en la misma iteracion.

## Migration Plan

1. Actualizar artefactos OpenSpec del change.
2. Extender backend y tests de reportes.
3. Refactorizar tipos/helpers compartidos del frontend.
4. Reescribir `Reports.tsx` sobre widgets configurables.
5. Ejecutar tests y lint en frontend y backend.
