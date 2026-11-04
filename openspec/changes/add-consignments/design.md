# Diseño

Tabla Consignment aditiva, por tienda y equipo, con precio unitario/moneda y cantidad entregada. Estado EN_CONSIGNACION sin descontar stock. Bloqueos de inventario y transacciones con reintento Serializable; cobro y cierre reutilizan createSaleInTransaction de sales.service. Sin pagos parciales ni deuda de cuenta corriente antes del cobro. UI Desk con tokens de ambos temas; acceso asociado al permiso Ventas.
