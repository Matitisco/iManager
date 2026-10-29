# Inventario · total de equipos

Antes: `OnboardingInventorySummary` filtraba por `isInStock` (`DISPONIBLE` o estado vacío), de ahí 23 frente a las 59 filas de Todos.

Ahora: «Equipos» cuenta todos los equipos no archivados y muestra debajo el desglose de estados sin ceros. Admite reservados, estados personalizados y singular/plural. No depende de filtros o paginación. El cálculo de «Valor del stock» conserva su comportamiento.

Se reutilizan `first-stock-summary`, sus tarjetas, `small` y `b`; la única clase nueva, `first-stock-breakdown`, agrega separación, interlineado y ajuste de palabras. Mismo diseño y tipografía existente, también en móvil.

Validación:

- Las 8 regresiones nuevas fallaron con la implementación anterior; 48 pruebas relacionadas pasan con el cambio.
- TypeScript frontend y backend sin errores. Sin build ni watchers.
- `timeout 600 node scripts/test-inventory-equipment-summary.mjs`: Chromium con el componente real, actualizaciones de 0→59 después de importar y 59→58 al archivar; contador y desglose correctos, tarjeta dentro del viewport, sin errores de consola.
- Revisados [1440×900 @1x](inventario-1440.png) y [390×844 @2x](inventario-390.png), sin cortes en el desglose.

Las capturas usan datos de ejemplo: 23 disponibles, 30 en revisión, 6 vendidos y precios USD 100. Contexto sintético, sin API ni escrituras en bases de datos. El fixture muestra la pantalla de Inventario sin el chrome de navegación; las fuentes externas están bloqueadas.

La tabla puede incorporar filas archivadas atenuadas como contexto. Esas filas complementarias no forman parte del total no archivado solicitado.
