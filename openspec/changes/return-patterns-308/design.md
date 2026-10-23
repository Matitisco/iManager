# Diseño

Cliente tipado en returns-api y consulta secundaria acotada a usuario, tienda, permisos y agrupación. No recalcular métricas del backend. Skeleton existente durante la primera lectura; omitir fallos secundarios, ignorar respuestas tardías y conservar resultados completos al volver a una agrupación.

Segmentos gchip Reclamos/Patrones y Proveedor/Compra/Modelo con useNavigationState, sin remontar la pantalla al cambiar segmentos. Hash con view/groupBy/group para entrar desde Ver proveedor; restaurar también el destino cuando ya coincide la URL. Lista/detalle en escritorio; acordeón único en móvil, sin dock de alta en Patrones como el PNG. Nombre abre proveedor/compra, porcentaje expande reclamos; reutilizar SupplierPurchaseDetail y Pill con tokens reales. Acceso a Patrones por permiso de Devoluciones; enlaces a proveedor/compra por Inventario y costos por canSeeFinancials.

El contrato contiene claimsDetail (máximo 50), no equipos problemáticos sin reclamo: no inventar esa fila del PNG. Indicar el recorte de reclamos cuando claimsTruncated sea true.
