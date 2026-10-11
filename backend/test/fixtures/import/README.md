# Fixtures del importador

- `f0`–`f7 *.xlsx`: planillas de prueba (f0 = Excel real de Matias; f1–f7 generadas con `gen.py`).
- `*.grid.json`: la grilla tal como la arma el frontend (`grid.mjs`, misma lógica que `src/utils/parse-workbook.ts`).
- `*.expected.json`: resultado esperado (moneda de la tienda + filas).
- `n1_gastos` y `n2_alumnos`: planillas que no son inventario. No se importa nada y el aviso es «Este archivo no parece tener equipos para importar».
- Tests sin red: `backend/src/modules/import/import-fixtures.test.ts` (corren sobre las grillas).
- Tests contra la API real: `backend/src/modules/import/import-fixtures.live.test.ts` (se saltean si no hay `OPENAI_API_KEY`).
