## 1. OpenSpec

- [x] 1.1 Crear el change `tradeins-table-engine`
- [x] 1.2 Documentar proposal, design y delta spec del cambio

## 2. Frontend

- [x] 2.1 Crear `src/services/trade-ins-table-api.ts` con cache, filtros, ordenamiento y `fetchFilteredIds`
- [x] 2.2 Migrar `src/pages/TradeIns.tsx` para reemplazar el historial manual por `TableEngine`
- [x] 2.3 Reutilizar mutaciones de `AppContext` e invalidar cache del adapter despues de create/update/delete
- [x] 2.4 Conectar `importConfig` del TableEngine para Canjes y recargar el historial real tras importar

## 3. Backend

- [x] 3.1 Agregar endpoint `/api/trade-ins/import` con validacion de filas
- [x] 3.2 Implementar import/upsert de canjes por store usando IMEI recibido como referencia de duplicados

## 4. Validacion

- [x] 4.1 Correr `npm run lint` en frontend
- [x] 4.2 Correr `npm run lint` en backend
- [x] 4.3 Verificar que la pantalla siga mostrando KPIs y cards recientes, y que el historial soporte filtros, import, edicion y delete
