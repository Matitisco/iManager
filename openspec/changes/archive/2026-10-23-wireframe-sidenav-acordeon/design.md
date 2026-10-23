# Diseño

Navegación compartida en escritorio y pantalla Más móvil, alimentada por desktopNav y sectionAllowed. Estado único de grupo expandido, inicializado y sincronizado con el destino activo; pulsar grupo alterna expansión sin navegar. Botones nativos con aria-expanded/aria-controls y destinos con aria-current. Al cambiar de grupo solo queda uno abierto. Cuenta participa del mismo acordeón y abre sus enlaces existentes.

GroupTabs se suprime en el shell mediante NavChrome; sus componentes siguen disponibles fuera de él. Resumen periódico usa la ruta propia #/analisis/resumen-periodico y el permiso Reportes, incorporados por #534. El menú consume ese destino de desktopNav, debajo de Reportes, sin duplicarlo. Devoluciones reutiliza view=patterns existente. Catálogo usa view=items en móvil. No se agregan textos secundarios ni animaciones de carga. Reutilizar ditem, dgroup, dcount, dnav, tokens de desk.css; CSS sn-* solo para jerarquía y foco.

Los filtros de datos se conservan; las vistas de navegación pasan al menú. Decisiones documentadas en INVENTARIO y notas. QA sobre PostgreSQL falso imanager_sidenav, API 3410 / web 4410. Evidencia externa /workspace/qa-sidenav-wf.
