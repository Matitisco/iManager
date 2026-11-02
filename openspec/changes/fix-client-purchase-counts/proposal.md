# Contadores de compras y garantías del cliente

Corregir el reporte confirmado de siete ventas frente a cuatro Compras sin consultar producción. La ficha usa ventas de la sesión y solo reconsulta anuladas: una sesión con cuatro registros conserva Compras=4 aunque la API ya tenga siete. Agregar lectura completa por cliente y tienda al abrir la ficha mobile/desktop, con carga, error y reintento visibles, conservando el vínculo por ID y sin adjudicar homónimos ni ventas sin vínculo.

Compras cuenta operaciones, conservando ventas distintas del mismo modelo o día; Garantías suma unidades con cobertura vigente (fix anterior en este mismo PR). La vista previa no debe limitar los indicadores. Reproducir siete ventas reales en PostgreSQL local con fecha 02/11/2026, USD y cantidades x2/x3; verificar en navegador rojo→verde: Compras=7, tres filas y siete al abrir Ver todas.
