# Enfoque

Ejercitar el formulario real con click y tap, medir área/hit testing, registrar eventos y cambios de estado, y verificar estabilidad tras rerenders y scroll. Separar la apertura del panel (`tradeOpen`) de la inclusión del canje (`hasTrade`). Documentar el resultado antes de decidir un cambio visual. Las operaciones de QA se guardan solo en PostgreSQL descartable en loopback.

La reproducción base pasa en las seis combinaciones (1440/390/360 × click/tap). No se cambia ningún handler ni estado. El encabezado móvil recibe un indicador derivado del `hasTrade` existente: «Sin canje» gris / «Con canje» resaltado. Abrir el panel conserva «Sin canje» hasta marcar el checkbox; plegarlo conserva «Con canje». Desktop conserva el checkbox nativo visible. La prueba de feedback falla antes del cambio porque falta «Sin canje»; las pruebas funcionales ya pasaban.
