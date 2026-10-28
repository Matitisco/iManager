# Fixtures sintéticos de mapeo

Grids JSON del generador de `/workspace/ai-compare/gen_fake.py` y etiquetas explícitas de su `expected.json`. Cubren inglés, sinónimos rioplatenses, ARS/USD, encabezados combinados, múltiples hojas, orden variable, columnas ajenas, costo/margen, ausencia de encabezados, abreviaturas, dos IMEIs, condición/calidad/fecha y textos monetarios. Son datos inventados; no se versionan los archivos Excel fuente.

`inventory-ai-fixtures.test.ts` usa las etiquetas para simular decisiones del modelo. Natan reutiliza los grids anonimizados de `../natan/`; las variantes grandes se verifican con datos sintéticos generados en memoria. CI nunca llama al modelo real.
