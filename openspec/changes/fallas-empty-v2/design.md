# Diseño

- Mantener todos los equipos del snapshot en grupos; usar `none` con IDs nulos para orígenes faltantes/inaccesibles.
- Una compra vigente conserva su identidad aunque falte proveedor. Los grupos sin origen no ofrecen navegación al origen.
- Contar `openClaims` sobre los mismos reclamos deduplicados del resumen, excluyendo `RESUELTO` y `CERRADO`; anulados/archivados ya se excluyen en el snapshot.
- Grid stretch con tarjetas flex y contenido arriba; vacío sin borde, centrado en el espacio disponible, DeskIcon tenue de 24 px y dos líneas cortas.
- Mantener porcentajes reales en texto y un mínimo visual del 2% en barras positivas. Conservar texto de motivos sin transformación CSS.
- Verificar solo módulos relacionados y TypeScript. QA en PostgreSQL local ficticio aislado y servidores propios; capturas desktop y cada tab móvil. No build ni push.
