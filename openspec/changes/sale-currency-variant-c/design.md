# Diseño

Presentación en selector de moneda, con conversión de venta y pagos desde su moneda guardada mediante projectAmount (dos decimales). El mismo renderizador alcanza precio, deuda, cuotas, recargo y canje; no altera el comprobante ni operaciones. Sin cotización conserva moneda original e informa que no hay equivalente. Reutiliza Sheet, kv, dhero, Segs y tokens de desk.css. Fixtures exclusivamente en PostgreSQL local.
