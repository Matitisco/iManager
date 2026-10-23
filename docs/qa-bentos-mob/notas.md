# Bentos del Dashboard móvil

Se reutilizan `.dstats`, `.dstat`, `.eb`, `.big`, `.spill`, `.mut` y `.budget`, con los colores, borde, radio y DM Sans existentes. CSS exclusivo del Dashboard bajo 760 px: dos columnas, filas iguales de 126 px, padding de 14 px y tipografía fluida de 18–24 px. El pie común alinea variaciones y barra; en móvil el porcentaje del margen acompaña a la variación.

QA en Chromium local, web 4450 / API 3450 y PostgreSQL **falso** `imanager_bentos`. Los datos inventados producen US$ 22,78M, US$ 651.280 y margen 3%. Capturas revisadas a 360, 412 y 473 px (también se comprobó 390): sin overflow, valores en una línea y las tres filas internas alineadas. Stress adicional a 360 px sobre los nodos reales con 99.999 vendidos y 12.345 de 99.999 en stock, sin desbordes. Escritorio 1440×900 conserva la geometría del DOM anterior. Capturas y mediciones en `/workspace/qa-bentos-mob/`.

TypeScript frontend/backend y `git diff --check` aprobados. El formato monetario existente no cambia; no se agregan pruebas de formato. El verificador del catálogo de diseño detecta únicamente `.hist-screen`, ausente ya en la base y ajeno a este cambio.
