# Corpus issue #338

57 listados sintéticos realistas, curados manualmente a partir de formatos habituales; no se aportaron listados privados reales en el issue. Las expectativas son independientes del LLM. Cada `.txt` tiene un `.expected.json` con campos explícitos; `null` significa ausente, no completar por conocimiento general. `dudas` no exige redacción exacta.

Incluye WhatsApp, emojis, abreviaturas, faltas, SIM física, tabs/comas/barras, monedas mezcladas, números argentinos, costo/venta, IMEI con ceros y separadores, serie, cantidades, varias filas en un renglón, equipo multilínea, encabezados, accesorios, basura, textos ajenos y prompt injection. `57-mixto-24-lineas` cubre el criterio 20+. El eval añade un listado independiente de 500 líneas.

CI: schema/servicio/normalización con Responses API mockeada. No valida calidad del modelo real. Eval fuera de CI: `npm --prefix backend run eval:import`, requiere OPENAI_API_KEY; usa gpt-6-luna salvo OPENAI_IMPORT_MODEL. Guarda métricas crudas y posteriores a normalización y errores en `docs/evals/issue-338-import-llm.md`.
