# Importar · campos nuevos automáticos

Implementados los estados 01 y 02. Cada columna sin asignar se guarda como campo personalizado de texto; el encabezado queda gris con + y «Campo nuevo: <nombre>». Nombre original del encabezado, o «Columna <letra>» cuando falta. Sin chip rojo ni nuevos bloqueos. «Revisar» recorre las columnas nuevas en orden visual, desplaza horizontalmente, conserva la fila visible y resalta las columnas nuevas. En 390 la línea del pie precede a ambos botones.

Se reutilizan Sheet/sheet-frame, sheet-scroll, sheet-foot, dtable compact, wlink, btn2 y ReplayValue. CSS aditivo imp-new-field-* en ImportModal.css, con tokens existentes y columnas nuevas de 260 px para acomodar la etiqueta. Las columnas descartadas explícitamente siguen descartadas. La línea cuenta las columnas nuevas de todas las hojas incluidas.

Valores y definiciones se envían juntos en la transacción existente de #644. No se expanden, descartan ni reordenan equipos al agregar campos. Encabezados duplicados conservan valores independientes; campos existentes de texto compatibles pueden reutilizarse sin pisar destinos ya asignados. Se respeta el límite existente de 100 caracteres para nombres de campos.

Validación: TypeScript frontend/backend; pruebas relacionadas del importador, payload, descartes, encabezados vacíos/duplicados, múltiples hojas y error de guardado. Chromium comprueba colores, pie dentro del viewport y línea arriba de botones en 390. Las cuatro capturas adjuntas usan 42 equipos ficticios en una representación DOM del componente real con su CSS, sin conexión a datos del negocio. El desplazamiento de la captura se posiciona sobre las columnas nuevas; el comportamiento de Revisar se verifica también con pruebas de componente.

Capturas: [01 · 1440](01-sin-asignar-1440.png), [01 · 390](01-sin-asignar-390.png), [02 · 1440](02-revisar-1440.png), [02 · 390](02-revisar-390.png). Revisadas visualmente en ambos tamaños.

Regenerar: `IMPORT_DISCARD_SHOTS=/workspace/qa-import-unassigned timeout 600 npx vitest run src/components/ImportModal.layout.test.tsx -t 'campos nuevos neutros' --maxWorkers=2`.
