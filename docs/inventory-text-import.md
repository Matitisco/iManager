# Importación de equipos desde texto (.txt o pegado)

En Inventario → Importar, elegir Excel, Pegar listado o Subir .txt. El texto se interpreta en el backend y siempre pasa por la misma vista previa antes de confirmar. Revisar / editar permite corregir modelo, capacidad, color, condición, batería, IMEI, serie, precio, moneda, costo y cantidad; Excluir fila la retira de la confirmación. Las dudas se resaltan y las líneas descartadas tienen motivo. No se agregan exportaciones.

## Configuración

- `OPENAI_API_KEY`: clave únicamente en el backend. Falta de clave, clave rechazada, cuota, timeout y JSON inválido muestran errores en español; texto nunca usa un fallback silencioso.
- `OPENAI_IMPORT_MODEL`: override opcional; default `gpt-6-luna`.
- Responses API: `text.format` con JSON schema estricto, validación Zod, un reintento de JSON/schema inválido. `store: false`. Sólo se envían instrucciones estáticas y líneas/encabezados del texto aportado. El catálogo y los datos existentes se usan localmente para normalizar, nunca se envían al modelo.

## Límites

100 KB UTF-8, 1000 líneas, 4000 caracteres por línea, 2000 equipos después de expandir cantidades, cantidad 1–100. Bloques de hasta 40 líneas / 8000 caracteres, máximo 3 llamadas simultáneas, 30 segundos por llamada y 180 segundos por análisis completo. Se preservan descripciones cortas multilínea al partir bloques. El cliente permite 190 segundos para recibir la respuesta.

Por tienda: un análisis activo, hasta 5 intentos cada 10 minutos, incluidos fallos del proveedor. **El rate limit es por instancia y se reinicia con el servidor**; un despliegue con varias réplicas necesita un almacén compartido para un límite global. No se agregan tablas ni migraciones de Prisma.

## Datos ausentes y confirmación

El LLM devuelve null para datos ausentes. La vista previa propone la moneda de la tienda y USADO si faltan y lo informa con dudas; un precio ausente requiere edición explícita (se puede ingresar 0). La batería ausente se guarda como N/A, nunca como 100%. Una serie se conserva en `customFields.serial`, dado que el contrato de IMEI permite sólo 15 dígitos. Las cantidades se expanden tras la revisión; cantidad mayor a uno con IMEI/serie requiere corregir el identificador antes de confirmar. Cada equipo conserva su moneda (ARS/USD); costo y precio comparten moneda, y los costos de otra moneda no se infieren ni convierten.

La normalización verifica que IMEIs/series y los valores numéricos de precio/costo estén en las líneas fuente. Valores no verificables se eliminan y agregan dudas. Esto no demuestra que un número presente sea el campo correcto: la revisión humana y el eval por campo siguen siendo necesarios.

## Pruebas y eval

57 listados sintéticos realistas curados manualmente con 84 filas esperadas en `backend/test/fixtures/import-text`, incluido un listado mixto de 24 líneas. No se suministraron listados privados reales en el issue. El corpus cubre WhatsApp, abreviaturas, errores de tipeo, varias monedas, IMEIs/series, cantidades, varios equipos por línea, descripciones multilínea, encabezados y textos ajenos.

CI usa Responses API mockeada. Los archivos `*.live.test.ts` existentes se excluyen de `test:unit`; para correrlos explícitamente: `npx vitest run --config vitest.config.ts src/modules/import/import-fixtures.live.test.ts` desde backend. El eval de texto está separado: `npm --prefix backend run eval:import`. Requiere una clave válida y guarda `docs/evals/issue-338-import-llm.md` con precisión cruda/final y de campos presentes, IMEIs/precios inventados, filas perdidas/extra, latencia/costo y 500 líneas. Los errores del proveedor no cuentan como evidencia de precisión ni costo cero.

E2E: `e2e/import-text.spec.ts` (desktop) y `e2e/import-text-iphone.spec.ts` (WebKit/iPhone 13). Mockean sólo la respuesta de análisis y confirman importación real en el backend y PostgreSQL; integración backend prueba la ruta autenticada con el LLM mockeado.
