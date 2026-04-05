## 1. Fix sort panel labels

- [x] 1.1 En `src/pages/Inventory.tsx`, reemplazar el array literal de sort options hardcodeado por una derivación dinámica: para las keys `model`, `price`, `battery` usar `colNames[key] || DEFAULT_COL_NAMES[key as ColId]`; para `condition` mantener `'Condición'`

## 2. Verificación

- [ ] 2.1 Verificar manualmente: renombrar "Modelo" → "Marca", abrir panel Ordenar → debe mostrar "Marca"
- [ ] 2.2 Verificar manualmente: recargar la página → header y panel Ordenar muestran "Marca"
- [x] 2.3 Correr lint: `npm run lint` en frontend sin errores de TypeScript
