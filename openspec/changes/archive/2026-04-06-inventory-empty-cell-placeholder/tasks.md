## 1. helper displayVal

- [x] 1.1 En `src/pages/Inventory.tsx`, agregar dentro del componente la función `const displayVal = (v: any): string | null => (v === null || v === undefined || v === '') ? null : String(v);`

## 2. placeholders en renderTd

- [x] 2.1 `case 'imei'`: en el branch display (no editing), envolver el contenido en `{displayVal(cellDisplay(invItem, 'imei', invItem.imei)) ?? <span className="text-gray-300">---</span>}`
- [x] 2.2 `case 'model'`: mismo patrón que 2.1 para `invItem.model`
- [x] 2.3 `case 'battery'`: si `displayVal(cellDisplay(invItem, 'batteryHealth', invItem.batteryHealth))` es `null`, renderizar solo `<span className="text-gray-300">---</span>` sin la barra de progreso
- [x] 2.4 `case 'price'`: mostrar `---` si `invItem.price === null || invItem.price === undefined`; mantener `$0` cuando `price === 0`
- [x] 2.5 `case 'status'`: si `statusVal` está vacío (null/undefined/""), mostrar `<span className="text-gray-300">---</span>` en lugar del badge

## 3. verificación

- [x] 3.1 Correr `npm run lint` en frontend — sin errores TypeScript
- [x] 3.2 Verificar en dev que ítems con campos vacíos muestran `---` en todas las columnas afectadas
- [x] 3.3 Verificar que hacer click en una celda con `---` activa el input vacío (no el string `---`)
- [x] 3.4 Verificar que `price = 0` muestra `$0` (no `---`)
