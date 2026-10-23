# Proveedores #308 — frontend A

Implementación del diseño aprobado A/B/E y #483 punto 13 sobre el backend existente. Sin cambios de backend, Prisma, AppContext, build ni operaciones de escritura de git.

## Pantallas

- **A-lista:** cantidad y última compra sin texto sustituto cuando falta la fecha. Pastilla solo para problemCount > 0, con ícono + número en móvil y texto completo accesible.
- **E-ver-proveedor:** Sheet de 540 px, encabezado y pie fijos, scroll interno, contacto con íconos, nota, aviso de problemas y las tres compras más recientes. «Más acciones» conserva edición/archivo/restauración. Encabezado inicial con los datos disponibles de la lista y skeleton con espacio reservado, sin texto visible de carga.
- **E-ver-todas:** aparece solo con más de tres compras. Segunda capa .ov.center.subov de 520 px en escritorio; pantalla completa con .wback en móvil. Al volver de una compra se recupera el historial completo.
- **A-detalle:** consulta GET /api/suppliers/:id/purchases/:purchaseId. Equipos, IMEI completo cuando existe y etiquetas del backend (En revisión, En RMA, Reclamo o servicio). Cada equipo abre su detalle existente. Costos y totales solo con canSeeFinancials; se respetan también totales en varias monedas. El nombre del lote tiene prioridad; se conserva fecha/nota. No aparecen equipos sueltos como una compra ficticia.
- **B-cargar:** las dos entradas Registrar equipo / Subir listado. La ficha permanece debajo.
- **B-importar y registro:** se reutilizan DeskOverlays, EquipmentForm, ImportHost e ImportModal. El selector de proveedor queda bloqueado en el alta, el payload fuerza supplierId y el escaneo conserva ese origen. La importación conserva el proveedor en título/payload para CSV, TXT y pegado. Una persistencia fallida conserva el formulario y muestra el error; una exitosa refresca el proveedor y su historial. Se mantiene la pantalla de resultado compartida de importación hasta cerrarla.

## Desvíos y pendientes

- **Enlace a Devoluciones → Patrones pendiente para la ronda siguiente:** no hay pestaña/ruta de Patrones en este frontend. El aviso se presenta como información, sin flecha ni acción ficticia.
- Se conservan tokens reales de desk.css, DM Sans, el avatar azul y los colores semánticos reales (incluidos --c-blue, Reservado #3B82F6 y Enviado #5B8DEF); no se copian los reemplazos grises/negros del mockup.
- Las cifras vienen del backend local. La base sembrada tiene 15 equipos activos de Mayorista Centro y cinco con problemas antes del alta de QA; difiere de los 23/cuatro del mockup. El flujo crítico dejó dos altas locales (una ejecución se detuvo después de guardar por un selector de Volver ambiguo; la ejecución corregida completó la verificación). Las capturas finales reflejan esos registros reales.
- Los iconos utilizan los componentes reales de la app y Lucide. Se mantiene el foco visible del textarea compartido de importación.
- Inventario C, Patrones D y Carga en serie no se modifican.

## Validación

- npm run lint y npm --prefix backend run lint: aprobados, sin build.
- 148 pruebas / 16 archivos Vitest relacionados: proveedores, contratos HTTP, carga con proveedor fijado, permisos, errores, retorno móvil, archivo/restauración, capas/foco de Sheet, importación y formularios de equipo.
- Un flujo crítico con Playwright contra http://127.0.0.1:4310 y API 3310, usando la base local imanager_308 sin borrar datos: registrar desde proveedor, comprobar selector bloqueado y payload, guardar en móvil, verificar nueva compra/refresco y persistencia tras recargar. Aprobado. No se agrega suite E2E al CI.
- Revisión de las seis vistas a 1440×900 y 390×844, comparadas con los PNG aprobados. Capturas y scripts temporales fuera del repo: /workspace/qa-308/tmp/{A-lista,A-detalle,B-cargar,B-importar,E-ver-proveedor,E-ver-todas}-{1440,390}.png. Registro adicional en registro-{1440,390}.png. Sin overflow horizontal; header/footer visibles con scroll interno.

## Archivos tocados

Código:
- src/desk/screens/SuppliersScreen.tsx
- src/desk/overlays/supplier.tsx
- src/desk/overlays/supplier-purchases.tsx (nuevo)
- src/desk/overlays/supplier.css
- src/desk/overlays/equipment.tsx
- src/desk/overlays/import.tsx
- src/desk/DeskOverlays.tsx
- src/desk/ui.tsx
- src/services/suppliers-api.ts

Pruebas:
- src/desk/overlays/supplier.test.tsx
- src/desk/overlays/supplier-import.test.tsx (nuevo)
- src/desk/screens/ledger-screens.test.tsx
- src/services/suppliers-api.test.ts (nuevo)

Documentación:
- PROJECT_STATUS.md
- docs/qa-308/frontend-proveedores.md (este archivo)
- openspec/changes/supplier-frontend-308/proposal.md
- openspec/changes/supplier-frontend-308/design.md
- openspec/changes/supplier-frontend-308/tasks.md
- openspec/changes/supplier-frontend-308/specs/suppliers/spec.md
