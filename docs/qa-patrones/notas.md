# Patrones sin selector

Proveedor, Compra y Modelo quedan apilados, con títulos existentes y selección independiente. Se reutilizan `dgrid`, `dch`, `card`, `ledger-list`, `wempty` y los componentes de detalles existentes. El CSS adicional solo define gap de 24 px y min-width de las secciones; se elimina el CSS del selector.

Los enlaces conservan la agrupación/registro solicitado, incluso al reabrir la misma URL. Los cambios de tienda o permisos invalidan las tres instancias. Sin cambios de backend ni datos de negocio.

Validación: TypeScript frontend/backend y 107 pruebas relacionadas aprobadas. Navegador Chrome a 1440×900 @1x y 390×844 @2x: tres secciones con datos, expansión independiente, enlace a compra, cero overflow horizontal y cero errores de página; el último reclamo móvil queda accesible sobre la navegación inferior. E2E de navegación/enlaces adaptado al nuevo diseño y aprobado en ambos tamaños (1 escenario).

Datos exclusivamente ficticios en PostgreSQL local `imanager_patrones` (127.0.0.1:5433); API 3470 y web 4470. Proveedor Importadora Andes (ejemplo), Lote de prueba y RMA-9001. Capturas inspeccionadas: `/workspace/qa-patrones/patrones-1440.png`, `patrones-390.png` y `patrones-390-modelo.png`.

Otros selectores encontrados, sin modificar:
- Reportes: Ventas / Stock / Canjes / Clientes / Servicio / Comisiones (`src/desk/screens/ReportsScreen.tsx`, tipo de reporte).
- Actividad interna: Tiendas / Embudo (`src/pages/StoreActivity.tsx`).
- Servicio técnico: Tablero / Lista (`src/desk/screens/ServiceScreen.tsx`), cambio de presentación de los mismos datos.

Los filtros de estado, períodos, perfiles de permisos y opciones de formularios permanecen. `GroupTabs` existe como componente, pero el shell actual lo omite mediante `NavChrome sidenav`.
