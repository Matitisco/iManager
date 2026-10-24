## Frontend

- [x] Envolver la única acción Cerrar del reclamo anulado en el contenedor existente `sacts one`.
- [x] Copiar solo el overlay modificado al runtime y verificar ancho/cierre a 390×844 @2x y 1440×900 @1x.

## Backend

No requiere cambios de backend, Prisma ni AppContext.

## Validation and delivery

- [x] Ejecutar lint frontend/backend en paralelo y tests relacionados con lock y maxWorkers=2 (40 pruebas aprobadas).

Entrega: PR con label pendiente de revisión y merge con CI verde. El estado final, informe y DONE se registran fuera de git en `/workspace/qa-orq/devoluciones`.
