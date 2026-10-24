# Diseño definitivo: variante 1

La cruz aparece en el extremo derecho del encabezado de los pagos 2–4 sin flag. Usa `ImanagerIcon cerrar` de 16 px, `--secondary`, área transparente de 44×44 y foco neutro visible. Se reutilizan `Field`, `Segs` y `Sheet`; el CSS se incorpora junto a `.acct-tenders` en `desk.css`. Se retiran ambas clases de wireframe y el archivo exploratorio.

Cada fila recibe un identificador local incremental, independiente de su posición, usado como key y como parte del id del importe (con prefijo único de instancia). Los cambios y la remoción se resuelven por id; las etiquetas usan el índice actual. Los ids no se envían al backend.

Al quitar una fila se conserva el id de la anterior y se restaura su foco después del commit de React; si el control no está disponible, se enfoca «Agregar pago». El primer pago nunca ofrece remoción. La lógica existente deriva tenders, excedentes y saldo financiable de las filas actuales, sin acumuladores adicionales.

La QA usa exclusivamente la base ficticia existente, API 3550 y web 4550 mediante `/workspace/qa-pago/iniciar.sh`. Las cuatro capturas finales se guardan en `/workspace/qa-pago/final-{venta,canje}-{1440,390}.png` y se inspeccionan antes del PR.
