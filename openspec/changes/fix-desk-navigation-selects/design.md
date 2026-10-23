# Diseño

Eliminar las reglas de audit-layout que modifican el sidenav y limitar los tokens de la pantalla a su contenido. Más conserva el flujo normal con separación mediante tokens existentes. Reutilizar DeskSelect para filtros, formularios, catálogos e importación; conservar nombres accesibles, valores, opciones deshabilitadas y validación. El select oculto del componente mantiene los datos del formulario. Onboarding conserva sus controles fuera del desk.

Validar computed styles en todas las rutas, geometría móvil con/sin banner y grupos desplegados/cerrados, teclado y viewport de los desplegables. Solo lint y pruebas relacionadas; sin build.

El avance de foco tras un escaneo incluye botones combobox como campos del formulario y sigue excluyendo controles ocultos/deshabilitados. Se conserva el orden IMEI → Proveedor.
