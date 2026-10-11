# Fixtures de ventas y clientes

Planillas de tiendas de iPhone en Argentina. `*.grid.json` es la grilla que arma el frontend. `*.expected.json` es el resultado: todas esas filas y ninguna más.

Ventas (`import-sales`): fecha, cliente, equipo, IMEI, precio, moneda ARS/USD, medio de pago, canje y vendedor.

- `s1_mostrador`: planilla limpia.
- `s2_encabezado_corrido`: título y encabezado corrido una columna, IMEI con espacios, filas vacías.
- `s3_varias_tablas`: dos tablas en la misma hoja, una hoja de resumen y una fila de total.
- `s4_monedas_fechas`: fechas mezcladas y precios en ARS o USD dentro de la misma columna.
- `s5_abreviado`: encabezados cortos (Día, Comprador, Serie, Importe USD, Permuta, Vend).
- `s6_basura`: notas, total y una fila suelta.
- `n_gastos`: no es una planilla de ventas. No se importa nada.

Clientes (`import-clients`): nombre, teléfono/WhatsApp, Instagram, email y DNI.

- `c1_agenda`: planilla limpia, teléfonos con y sin +54.
- `c2_encabezado_corrido`: título y encabezado corrido.
- `c3_varias_tablas`: dos tablas y una hoja de notas.
- `c4_telefonos`: la misma línea escrita de varias formas.
- `c5_instagram_dni`: links de Instagram, mail en mayúsculas y DNI con puntos.
- `c6_basura`: teléfono y WhatsApp en columnas distintas, filas vacías y un total. Se usa el WhatsApp.
- `n_alumnos`: no es una planilla de clientes.

Los tests sin red están en `section-import-fixtures.test.ts`. Los que llaman a la API real están en `section-import-fixtures.live.test.ts` y se saltean si no hay `OPENAI_API_KEY`.
