# Diseño

Usar tokens y clases compartidas de `desk.css` según `/workspace/redisenio-dashboard/v3/tokens.md` y `src/v3.css`. Retirar `.dashboard-v2` y los overrides de cards, títulos y KPI. Conservar CSS específico de tendencia, pagos, calendario y las reservas necesarias para la carga.

Ventas usa `dtable compact` con cinco registros en escritorio y `PhoneRecords`/`RecentSaleCard` con cuatro en móvil. Ambas vistas siguen el rango aplicado y conservan apertura y menú. Contanos reutiliza `commission-hero` y `btn2 l`: columna derecha debajo de saldos en escritorio y última card en móvil. Los accesos operativos se muestran en escritorio según la referencia.

Los skeletons comparten estructura con el contenido final, incluida la tabla/lista y el bento, sin cifras parciales. Se mantiene la coordinación existente de sesión, primeros pasos, listas y overview, el descarte de respuestas obsoletas y Total sin fechas ni comparación.
