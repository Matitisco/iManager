# Issue #338 — eval real del importador de texto

Fecha UTC: 2026-10-14T12:16:13.842Z. Modelo: `gpt-6-luna`. Prompt SHA256: `6654bff234cf698e`.

Corpus: 57 listados sintéticos realistas curados manualmente, más 500 líneas. No se recibieron listados privados reales; este corpus no reemplaza validación con datos reales autorizados. Expectativas independientes, null cuenta como campo ausente; precisión de campos presentes se informa aparte para no inflar métricas.

Resultado del umbral (≥95% en campos clave, 0 IMEIs/precios inventados y 0 filas perdidas/extra): **BLOQUEADO — sin respuestas válidas**.

Bloqueo observado: OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.

Importaciones: 58; errores: 58; filas esperadas: 584; perdidas: 584; extra: 0.
IMEIs/precios inventados o asignados incorrectamente (comparación con líneas fuente y etiquetas independientes): crudas IMEI 0, precio 0; tras normalización IMEI 0, precio 0. También se cuentan como críticos los precios tomados de capacidad/batería/costo o de otro equipo, aunque ese número exista en la fuente. Campos ausentes eliminados no se cuentan como inventados, pero penalizan la precisión.
Latencia acumulada: 5.49 s; media: 0.09 s. Costo estimado de llamadas exitosas: no medible (sin uso válido o modelo sin tarifa conocida). Errores pueden consumir tokens que no fueron devueltos; no se presupone costo cero.

Estimación conservadora sin descuentos de caché: gpt-6-luna $0.10/M entrada y $0.50/M salida, tarifa estándar, [OpenAI pricing](https://developers.openai.com/api/docs/pricing). Los tokens incluyen reintentos que devolvieron usage. CI no llama al modelo real.

Precisión de campos calculada sólo sobre los 57 listados variados (84 filas): las 500 líneas se evalúan aparte y no inflan el umbral del corpus.

| Campo | Precisión final | Presentes | Precisión cruda | Muestras |
|---|---:|---:|---:|---:|
| model | N/A | N/A | N/A | 84 (84 presentes) |
| capacity | N/A | N/A | N/A | 84 (82 presentes) |
| color | N/A | N/A | N/A | 84 (50 presentes) |
| batteryHealth | N/A | N/A | N/A | 84 (36 presentes) |
| condition | N/A | N/A | N/A | 84 (76 presentes) |
| imei | N/A | N/A | N/A | 84 (7 presentes) |
| serial | N/A | N/A | N/A | 84 (2 presentes) |
| price | N/A | N/A | N/A | 84 (78 presentes) |
| currency | N/A | N/A | N/A | 84 (80 presentes) |
| cost | N/A | N/A | N/A | 84 (5 presentes) |
| quantity | N/A | N/A | N/A | 84 (84 presentes) |

500 líneas: OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY..

| Listado | Filas | Perdidas | Extra | Latencia ms | Costo US$ | Resultado |
|---|---:|---:|---:|---:|---:|---|
| 01-whatsapp-midnight | 0/1 | 1 | 0 | 382 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 02-abreviatura-pm | 0/1 | 1 | 0 | 268 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 03-guiones | 0/1 | 1 | 0 | 280 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 05-tabs | 0/1 | 1 | 0 | 83 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 04-barras | 0/1 | 1 | 0 | 96 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 06-comas | 0/1 | 1 | 0 | 96 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 08-imei-ceros | 0/1 | 1 | 0 | 74 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 07-imei | 0/1 | 1 | 0 | 95 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 09-serie | 0/1 | 1 | 0 | 101 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 11-cant-x3 | 0/1 | 1 | 0 | 66 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 10-compra-venta | 0/1 | 1 | 0 | 90 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 12-unidades | 0/1 | 1 | 0 | 72 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 13-sim-fisica | 0/1 | 1 | 0 | 83 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 15-typo-pro | 0/1 | 1 | 0 | 58 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 14-typo-iphone | 0/1 | 1 | 0 | 102 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 16-encabezado-usd | 0/2 | 2 | 0 | 66 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 17-encabezado-cambio | 0/2 | 2 | 0 | 64 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 18-varios-por-linea | 0/2 | 2 | 0 | 133 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 20-basura-entre-equipos | 0/2 | 2 | 0 | 157 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 19-mas-por-linea | 0/2 | 2 | 0 | 162 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 21-pesos-miles | 0/1 | 1 | 0 | 73 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 23-k-pesos | 0/1 | 1 | 0 | 64 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 22-decimal-coma | 0/1 | 1 | 0 | 73 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 24-tb | 0/1 | 1 | 0 | 77 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 25-bateria-rango | 0/1 | 1 | 0 | 76 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 26-bateria-fraccion | 0/1 | 1 | 0 | 67 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 27-sin-precio | 0/1 | 1 | 0 | 73 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 28-sin-moneda | 0/1 | 1 | 0 | 72 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 29-sin-imei | 0/1 | 1 | 0 | 69 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 30-sin-bateria | 0/1 | 1 | 0 | 87 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 32-desconocido | 0/1 | 1 | 0 | 63 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 33-samsung | 0/1 | 1 | 0 | 75 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 34-pixel | 0/1 | 1 | 0 | 74 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 35-multilinea | 0/1 | 1 | 0 | 81 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 36-lista-numerada | 0/2 | 2 | 0 | 63 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 31-minimo | 0/1 | 1 | 0 | 250 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 37-con-guiones-imei | 0/1 | 1 | 0 | 73 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 38-outlet | 0/1 | 1 | 0 | 82 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 39-preowned | 0/1 | 1 | 0 | 85 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 40-seminuevo | 0/1 | 1 | 0 | 77 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 41-mini | 0/1 | 1 | 0 | 64 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 42-plus | 0/1 | 1 | 0 | 81 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 43-pro-vs-max | 0/2 | 2 | 0 | 87 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 44-costo-solo | 0/1 | 1 | 0 | 68 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 45-monedas-costo-distintas | 0/1 | 1 | 0 | 69 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 47-precio-desde | 0/1 | 1 | 0 | 62 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 46-cantidad-imei | 0/1 | 1 | 0 | 77 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 48-precio-rango | 0/1 | 1 | 0 | 80 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 49-xr | 0/1 | 1 | 0 | 69 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 50-se | 0/1 | 1 | 0 | 69 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 51-whatsapp-fecha | 0/2 | 2 | 0 | 79 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 53-no-inventario-receta | 0/0 | 0 | 0 | 66 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 52-accesorios | 0/1 | 1 | 0 | 73 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 54-no-inventario-gastos | 0/0 | 0 | 0 | 63 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 55-no-inventario-charla | 0/0 | 0 | 0 | 72 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 56-no-inventario-instrucciones | 0/0 | 0 | 0 | 65 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| 57-mixto-24-lineas | 0/24 | 24 | 0 | 69 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |
| large-500 | 0/500 | 500 | 0 | 91 | — | OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY. |

**Sin respuestas válidas del LLM:** las tasas por campo no son una medición de calidad; no se pueden evaluar alucinaciones, latencia de inferencia ni costo real. Los contadores de filas perdidas reflejan importaciones fallidas, no extracciones incorrectas. Hace falta una clave válida para reejecutar.

## Diferencias y errores

### 01-whatsapp-midnight

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 02-abreviatura-pm

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 03-guiones

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 05-tabs

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 04-barras

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 06-comas

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 08-imei-ceros

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 07-imei

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 09-serie

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 11-cant-x3

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 10-compra-venta

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 12-unidades

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 13-sim-fisica

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 15-typo-pro

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 14-typo-iphone

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 16-encabezado-usd

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 17-encabezado-cambio

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 18-varios-por-linea

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 20-basura-entre-equipos

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 19-mas-por-linea

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 21-pesos-miles

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 23-k-pesos

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 22-decimal-coma

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 24-tb

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 25-bateria-rango

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 26-bateria-fraccion

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 27-sin-precio

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 28-sin-moneda

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 29-sin-imei

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 30-sin-bateria

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 32-desconocido

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 33-samsung

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 34-pixel

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 35-multilinea

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 36-lista-numerada

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 31-minimo

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 37-con-guiones-imei

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 38-outlet

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 39-preowned

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 40-seminuevo

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 41-mini

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 42-plus

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 43-pro-vs-max

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 44-costo-solo

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 45-monedas-costo-distintas

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 47-precio-desde

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 46-cantidad-imei

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 48-precio-rango

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 49-xr

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 50-se

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 51-whatsapp-fecha

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 53-no-inventario-receta

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 52-accesorios

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 54-no-inventario-gastos

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 55-no-inventario-charla

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 56-no-inventario-instrucciones

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### 57-mixto-24-lineas

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


### large-500

OpenAI HTTP 401 (invalid_api_key): La clave del servicio de análisis no es válida. Pedile al administrador que revise OPENAI_API_KEY.


## Reproducir

`npm --prefix backend run eval:import` con OPENAI_API_KEY en el shell. OPENAI_IMPORT_MODEL es opcional. El script hace llamadas reales, no persiste equipos y escribe este reporte; exit code 1 indica umbral no alcanzado.
