## 1. Fix badge de conteo en header

- [x] 1.1 En `src/pages/Inventory.tsx` línea ~1185, reemplazar `{total}` por un condicional: si `isInitialLoading`, mostrar un skeleton (`<span className="animate-pulse bg-gray-200 rounded-full w-6 h-4 inline-block" />`); si no, mostrar `{total}`

## 2. Fix footer de conteo

- [x] 2.1 En `src/pages/Inventory.tsx` línea ~1636, reemplazar la expresión del footer por un condicional: si `isInitialLoading`, mostrar `"Cargando..."`; si no, mantener `Mostrando ${items.length} de ${total}`

## 3. Verificación

- [x] 3.1 Verificar visualmente que al cargar Inventario por primera vez no aparece "0" en el badge ni "Mostrando 0 de 0" en el footer
- [x] 3.2 Verificar que al cambiar de categoría el badge muestra skeleton hasta que resuelve el fetch
- [x] 3.3 Correr `npm run lint` sin errores
