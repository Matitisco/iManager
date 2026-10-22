# Diseño

DashboardContent conserva listas de AppContext y consulta `/reports/overview` mediante un servicio tipado sólo con permiso financiero y sesión lista. Las respuestas tardías se descartan al cambiar rango, tienda, usuario o datos. Los KPI financieros y gráficos usan la misma respuesta; sin acceso se conservan equipos/stock y accesos autorizados. Errores discretos sin cifras inventadas.

Rango inclusivo en días argentinos, mes actual hasta hoy por defecto. Ventana anterior contigua de igual duración. El backend excluye `voidedAt` también en el período anterior y omite variaciones con base menor que una unidad. Serie diaria con límites argentinos; frontend agrupa día/semana/mes según duración.

CSS acotado a Dashboard con tokens existentes, grilla desktop 4 KPI y dos columnas de contenido; móvil 2×2 y navegación real del shell. Selector de rango accesible con borrador, presets, navegación, selección de extremos, Aplicar, Escape y foco restaurado. Se reutiliza useModalLayer y la isla FirstStepsIsland existente.
