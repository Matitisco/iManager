# Fixtures del importador (bench #264 → Decisions API)

- `f0`–`f7 *.xlsx`: planillas de prueba (f0 = Excel real de Matias; f1–f7 generadas con `gen.py`).
- `*.grid.json`: la grilla tal como la arma el frontend (`grid.mjs`, misma lógica que `src/utils/parse-workbook.ts`).
- `*.expected.json`: resultado esperado (moneda de la tienda + filas).
- `bench2.ts`: bench Luna vs Decisions optimizada. Correr desde `backend/`: `npx tsx test/fixtures/import/bench2.ts` (requiere OPENAI_API_KEY; `RUNS`, `ONLY`, `OUT` opcionales).
