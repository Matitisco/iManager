# Importar equipos · selector en encabezados

Trigger visible de variante A con popover buscable de variante B. Sin panel lateral. Columnas reales del Excel en orden físico, Modelo fijo cuando está asignado; orden y ancho manuales por hoja/encabezado/índice físico. Los destinos sin origen se resuelven desde el aviso de Precio. Descartar distingue decisión manual de columna pendiente. Elegir un destino utilizado lo mueve.

Reutiliza `Sheet`, `Field`, `Segs`, `useModalLayer`, `ReplayValue`, `dtable compact`, `dsel`, `wlink`, `btn2`, `sheet-grab`, `modal-x` y los tokens de desk.css. CSS aditivo con prefijo `imp-` para triggers, estados y popover/hoja inferior; retirados estilos del panel. Excepción de encabezado del wireframe: trigger 32 px escritorio / 36 px móvil. Inputs 48 px y 16 px móvil. Tabla con scroll interno, encabezado sticky y drag por asa, encabezado de escritorio o teclado.

«N por revisar» recorre rojas/amarillas en orden visual conservando la fila actual. «Asignar» abre Precio en primera sin asignar; si no hay, usa la primera física. Letras de uso en el selector, búsqueda sin tildes y alta Texto/Fecha/Número. Mantiene reaplicación con debounce, respuestas viejas descartadas, restauración de plan válido, diagnósticos, inclusión de hojas, captura de texto y confirmación existentes.

Validación: TypeScript frontend/backend, 86 pruebas relacionadas y 11 E2E de importación (más repetición final de los 3 casos del selector) con PostgreSQL local ficticio aislado (`imanager_selector_header`), máximo dos workers y sin build local. Capturas 1440×900 @1x y 390×844 @2x en `/workspace/qa-selector-header/` y `test-results/import-auto/`, revisadas visualmente. Todos los equipos, IMEIs y tiendas de las capturas son ficticios.
