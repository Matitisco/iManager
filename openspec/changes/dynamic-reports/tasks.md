## 1. Backend

- [x] 1.1 Extender `GET /api/reports/overview` para soportar `rangeKey=custom` con validacion de fechas obligatorias y orden correcto.
- [x] 1.2 Ampliar el overview con `inventory.valuation` y `topProducts`, excluyendo ventas `PENDIENTE`.
- [x] 1.3 Cubrir con tests la validacion del rango custom y la agregacion del overview.

## 2. Frontend

- [x] 2.1 Extender los tipos/helpers de reportes para rango custom, widgets configurables y export visible.
- [x] 2.2 Reescribir `src/pages/Reports.tsx` con toolbar de presets + rango custom y modal de personalizacion.
- [x] 2.3 Persistir el layout de widgets en `localStorage` con scope por usuario y tienda.
- [x] 2.4 Agregar tests para helpers de rango custom, normalizacion de preferencias y CSV visible.

## 3. OpenSpec y validacion

- [x] 3.1 Actualizar proposal, design y delta specs del change `dynamic-reports` para reflejar esta segunda iteracion.
- [x] 3.2 Ejecutar `npm run lint`, `npm run test`, `npm --prefix backend run lint` y `npm --prefix backend run test`.
