# Diseño

Separar estado de consulta y de acciones donde se comparten. Omitir datos decorativos fallidos sin mantener skeletons indefinidos. Usar vacíos neutrales para resumen periódico, catálogo, selección de vendedores y listas archivadas; conservar datos activos y cachés existentes. Registrar la causa original con console.warn, descartando respuestas fuera de su scope. Sin cambios de API ni persistencia.
