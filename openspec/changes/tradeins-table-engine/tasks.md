## 1. OpenSpec

- [x] 1.1 Crear el change `tradeins-table-engine`
- [x] 1.2 Documentar proposal, design y delta spec del cambio

## 2. Frontend

- [x] 2.1 Crear `src/services/trade-ins-table-api.ts` con cache, filtros, ordenamiento y `fetchFilteredIds`
- [x] 2.2 Migrar `src/pages/TradeIns.tsx` para reemplazar el historial manual por `TableEngine`
- [x] 2.3 Reutilizar mutaciones de `AppContext` e invalidar cache del adapter despues de create/update/delete

## 3. Validacion

- [x] 3.1 Correr `npm run lint` en frontend
- [ ] 3.2 Verificar que la pantalla siga mostrando KPIs y cards recientes, y que el historial soporte filtros, edicion y delete
