# Fallas

Patrones se renombra a Fallas, con ruta `#/analisis/fallas`. La ruta anterior y los enlaces desde proveedores conservan sus parámetros y se canonicalizan sin un paso extra de historial.

Resumen global calculado en backend sobre equipos no archivados: cada equipo con al menos un reclamo no anulado cuenta una vez, incluidos reclamos resueltos. Equipos sin proveedor o lote participan del total. El motivo se calcula sobre reclamos únicos completos, sin depender del límite de detalle; también admite motivos libres. Los rankings ordenan por porcentaje y luego cantidad, muestran cinco filas y permiten ver el resto.

Reutilizados: `ScreenTitle`, `dstat`, `dcard`, `dch`, `bar`, `member`, `phone-row`, `Pill`, `Sheet`, `ret-sec`, `wlink`, `wempty` y `ListSkeleton`. CSS `pat-*` para distribución, barras y hojas; todos los colores usan tokens existentes. Detalle con tres reclamos y segunda hoja para la lista; móvil ajustado al contenido y lista completa con volver. Cerrar el detalle antes de navegar evita una tercera capa. Se conserva caché durante reconexión/revalidación y se aísla por usuario, tienda y permisos. Vacío global de una línea.

Datos exclusivamente ficticios: DB local `imanager_fallas`, API 3480 / web 4480; 90 equipos, seis proveedores, seis compras, seis modelos y 16 reclamos. Resumen esperado: 16/90 → 18%, batería en 13/16 reclamos. Sin acceso a producción, cambios de schema, builds ni AppContext.

Validación: TypeScript frontend/backend; 166 pruebas frontend relacionadas, 24 de cálculo backend, ocho integraciones en DB local separada `imanager_fallas_tests` y E2E de navegación/redirect/vacío desktop y mobile; Playwright 1440×900 @1x y 390×844 @2x, rankings completos, hojas, teclado, redirect y cero overflow/errores de página. El catálogo de clases confirma las clases usadas; su entrada histórica `.hist-screen` ya no existe en el repo, por lo que la lista móvil usa `Sheet mobileBack` y `.pat-all-sheet`.

Evidencia en `/workspace/qa-fallas/`: `antes-{1440,390}.png`, `despues-{1440,390}.png`, `despues-390-{compras,modelos}.png`, `reclamos-{1440,390}.png`, `todos-reclamos-{1440,390}.png`, `resultados.json`. Cada PNG fue revisado visualmente. Fixture y verificación reproducibles en `seed.cjs` y `after.cjs` de esa carpeta. La API mantiene el límite existente de 50 reclamos por grupo y avisa cuando el detalle está truncado; los totales no se truncan.
