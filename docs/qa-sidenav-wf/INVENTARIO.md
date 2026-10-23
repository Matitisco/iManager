# Inventario del sidenav y las islitas actuales

Base: origin/main `492b837`, relevado el 23/10/2026. Prototipo aislado en `wireframe/sidenav-acordeon`.

## Navegación real

`src/desk/nav.ts` define grupos, secciones y permisos. `src/desk/DeskApp.tsx` muestra un botón por grupo en escritorio: pulsarlo navega a su primera sección permitida. `GroupTabs` (`src/desk/group-tabs.tsx`) dibuja las subsecciones en cada pantalla, a través de `ScreenTitle`/`PageHead` en `src/desk/ui.tsx`, con usos explícitos adicionales. No hay expand/collapse actual.

| Sección del menú | Subsecciones | Dónde están las islitas hoy |
|---|---|---|
| Dashboard | Ninguna | Sin islitas de navegación; selector de rango = filtro. |
| Comercial | Ventas, Canjes, Devoluciones | `SalesScreen`, `TradeInsScreen`, `ReturnsScreen`: GroupTabs desde cabecera compartida. |
| Stock | Equipos (Inventario), Control de stock, Catálogo | `InventoryScreen`, `PublicCatalogScreen`: cabecera compartida; `StockCountScreen`: GroupTabs explícito, en móvil Control de stock se abrevia Control. |
| Atención | Clientes, Servicio técnico | `ClientsScreen`, `ServiceScreen`: cabecera compartida. Seguimientos está definido pero oculto globalmente. |
| Finanzas | Proveedores | `SuppliersScreen`: sin chips si solo queda una sección. Cajas y Gastos están ocultos globalmente, aunque existen en el código. |
| Análisis | Reportes, Comisiones / Mis comisiones, Historial, Resumen periódico | `ReportsScreen`: tablist propio con las secciones del grupo más Resumen periódico. `HistoryScreen`: GroupTabs explícito sin pendientes. `CommissionsScreen`: cabecera compartida (sin Resumen periódico). |
| Cuenta | Notificaciones, Ayuda, Configuración | Cabeceras compartidas y GroupTabs explícito en `AccountScreens`. Cuenta ya tiene enlaces individuales en el sidebar. En el prototipo se agrupan bajo Cuenta con el mismo acordeón exclusivo. |
| Devoluciones (dentro de Comercial) | Reclamos / Patrones | `ReturnsScreen.tsx`: selector Vista con dos gchip. Son vistas diferentes; se trasladan al menú como enlaces bajo Devoluciones, sin segundo acordeón. |
| Clientes | Lista / Cuenta corriente / Seguimientos | `ClientsScreen.tsx`: `acct-views` / ChipRow. Actualmente solo Lista es visible; el selector no aparece. No reactivar las vistas ocultas. |
| Catálogo (móvil) | Resumen / Equipos | `PublicCatalogScreen.tsx`: `.cat-tabs`; alternan las columnas que en escritorio se ven juntas. Se trasladan al menú móvil conservando la composición de escritorio. |
| Reporte automático | No tiene subsecciones | `AccountScreens.tsx` abre overlay `periodic-report.tsx`, solo OWNER. Segmentos Apagado/Encendido y Cada 15 días/Cada mes son campos del formulario; se conservan. No confundir con Resumen periódico. |

## Selectores que filtran datos (se conservan por decisión de implementación aprobada)

- Reportes: Tipo de reporte (Ventas, Stock, Canjes, Clientes, Servicio, Comisiones, según permisos) cambia el modelo del reporte, widgets y desglose. Período y dimensiones filtran/agregan datos. Se conservan accesibles en la pantalla.
- Historial: grupo/sección, persona, período y búsqueda filtran eventos; no navegan a módulos. En el detalle de controles, los contadores cambian el conjunto de diferencias.
- Inventario: Disponible/Reservado/etc., Archivados y filtros de columnas cambian filas, no pantallas. Las categorías antiguas ya no son subsecciones activas del producto.
- Devoluciones: Todos/Activos/Archivados y Patrones por Proveedor/Compra/Modelo son filtros/agrupaciones, no navegación.
- Notificaciones: Todas/Sin leer y módulos filtran avisos.
- Ventas, Canjes, Servicio técnico, Cajas, Proveedores, Seguimientos: estado, archivo, período y búsquedas son filtros de registros. Los módulos ocultos permanecen ocultos.
- Configuración/Equipo y detalles usan filas y rutas propias, no islitas equivalentes a GroupTabs.

## Móvil y compacto

A 390 px no hay sidebar ni drawer: existe barra inferior Dashboard/Ventas/Equipos/Clientes/Más y una pantalla Más con todos los enlaces agrupados y descripciones. El prototipo reutiliza Más como menú acordeón, sin agregar un drawer. Conserva la barra inferior. Abre el grupo de la última pantalla activa al entrar a Más; seleccionar un destino vuelve al contenido.

No existe modo compacto del sidebar en esta base. No se inventa uno; captura de ese modo no aplica.

## Roles

Conservar `desktopNav`, `sectionAllowed`, `canManageCommissions`, `HIDDEN_SECTIONS`, denominación Mis comisiones y contadores existentes. Resumen periódico hereda acceso a Reportes. Patrones hereda acceso a Devoluciones. Catálogo conserva su permiso explícito. No modificar backend, AppContext, Prisma ni reglas de acceso.
