# Diseño

Agrupar la colección filtrada antes de paginar. Helper puro para normalización, parse de marca/generación/variante, capacidad y agregación. iPhone primero, otras marcas reconocidas después y desconocidos al final. Precio min/max ignora null; costo promedio ponderado por cantidad con centavos enteros y proyección monetaria existente, sin persistir cálculos. No combinar monedas sin cotización.

Componente independiente con filas expandibles, tres registros de preview y expansión inline completa. Cada registro abre el detalle existente. Cantidades sin IMEI permanecen como un registro con cantidad. Paginación por modelos. Costo protegido por canSeeFinancials de la pantalla. Tokens desk para claro/oscuro y tarjetas en móvil. Preferencia localStorage por tienda, sin datos de negocio.

Validación: unitarios de orden/agrupación, componentes en móvil/desktop, lint frontend/backend. No hay endpoints/transacciones nuevos que requieran integración backend ni flujo de escritura nuevo que requiera E2E.
