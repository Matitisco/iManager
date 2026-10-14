# Issue #338 — eval real del importador de texto

Fecha UTC: 2026-10-14T17:54:16Z (corrida en un servicio temporal de Railway, ya eliminado). Modelo: `gpt-6-luna`. Prompt SHA256: `6654bff234cf698e`.

Corpus: 57 listados sintéticos realistas curados manualmente, más 500 líneas. No se recibieron listados privados reales; este corpus no reemplaza validación con datos reales autorizados. Expectativas independientes, null cuenta como campo ausente; precisión de campos presentes se informa aparte para no inflar métricas.

Resultado del umbral (≥95% en campos clave, 0 IMEIs/precios inventados y 0 filas perdidas/extra): **APROBADO**.

Importaciones: 58; errores: 0; filas esperadas: 584; perdidas: 0; extra: 0.
IMEIs/precios inventados o asignados incorrectamente (comparación con líneas fuente y etiquetas independientes): crudas IMEI 0, precio 0; tras normalización IMEI 0, precio 0. También se cuentan como críticos los precios tomados de capacidad/batería/costo o de otro equipo, aunque ese número exista en la fuente. Campos ausentes eliminados no se cuentan como inventados, pero penalizan la precisión.
Latencia acumulada: 231.40 s; media: 3.99 s. Costo estimado de llamadas exitosas: US$ 0.032078. Errores pueden consumir tokens que no fueron devueltos; no se presupone costo cero.

Estimación conservadora sin descuentos de caché: gpt-6-luna $0.10/M entrada y $0.50/M salida, tarifa estándar, [OpenAI pricing](https://developers.openai.com/api/docs/pricing). Los tokens incluyen reintentos que devolvieron usage. CI no llama al modelo real.

Precisión de campos calculada sólo sobre los 57 listados variados (84 filas): las 500 líneas se evalúan aparte y no inflan el umbral del corpus.

| Campo | Precisión final | Presentes | Precisión cruda | Muestras |
|---|---:|---:|---:|---:|
| model | 100.00% | 100.00% | 100.00% | 84 (84 presentes) |
| capacity | 100.00% | 100.00% | 100.00% | 84 (82 presentes) |
| color | 100.00% | 100.00% | 100.00% | 84 (50 presentes) |
| batteryHealth | 100.00% | 100.00% | 100.00% | 84 (36 presentes) |
| condition | 100.00% | 100.00% | 100.00% | 84 (76 presentes) |
| imei | 100.00% | 100.00% | 100.00% | 84 (7 presentes) |
| serial | 100.00% | 100.00% | 100.00% | 84 (2 presentes) |
| price | 100.00% | 100.00% | 100.00% | 84 (78 presentes) |
| currency | 100.00% | 100.00% | 100.00% | 84 (80 presentes) |
| cost | 100.00% | 100.00% | 100.00% | 84 (5 presentes) |
| quantity | 100.00% | 100.00% | 100.00% | 84 (84 presentes) |

500 líneas: 500/500 filas; 70060 ms; 13 llamadas; 26897 tokens entrada / 35806 salida; US$ 0.020593.

| Listado | Filas | Perdidas | Extra | Latencia ms | Costo US$ | Resultado |
|---|---:|---:|---:|---:|---:|---|
| 01-whatsapp-midnight | 1/1 | 0 | 0 | 3965 | 0.000161 | OK |
| 02-abreviatura-pm | 1/1 | 0 | 0 | 4140 | 0.000176 | OK |
| 03-guiones | 1/1 | 0 | 0 | 4363 | 0.000171 | OK |
| 05-tabs | 1/1 | 0 | 0 | 2245 | 0.000161 | OK |
| 04-barras | 1/1 | 0 | 0 | 2954 | 0.000168 | OK |
| 07-imei | 1/1 | 0 | 0 | 2613 | 0.000169 | OK |
| 06-comas | 1/1 | 0 | 0 | 4746 | 0.000158 | OK |
| 08-imei-ceros | 1/1 | 0 | 0 | 2594 | 0.000170 | OK |
| 10-compra-venta | 1/1 | 0 | 0 | 2116 | 0.000160 | OK |
| 09-serie | 1/1 | 0 | 0 | 2868 | 0.000181 | OK |
| 11-cant-x3 | 1/1 | 0 | 0 | 3047 | 0.000171 | OK |
| 12-unidades | 1/1 | 0 | 0 | 2232 | 0.000157 | OK |
| 13-sim-fisica | 1/1 | 0 | 0 | 3122 | 0.000195 | OK |
| 14-typo-iphone | 1/1 | 0 | 0 | 2558 | 0.000166 | OK |
| 15-typo-pro | 1/1 | 0 | 0 | 4862 | 0.000250 | OK |
| 17-encabezado-cambio | 2/2 | 0 | 0 | 3674 | 0.000228 | OK |
| 16-encabezado-usd | 2/2 | 0 | 0 | 3818 | 0.000219 | OK |
| 18-varios-por-linea | 2/2 | 0 | 0 | 3184 | 0.000190 | OK |
| 20-basura-entre-equipos | 2/2 | 0 | 0 | 3164 | 0.000220 | OK |
| 19-mas-por-linea | 2/2 | 0 | 0 | 3400 | 0.000207 | OK |
| 22-decimal-coma | 1/1 | 0 | 0 | 2656 | 0.000166 | OK |
| 21-pesos-miles | 1/1 | 0 | 0 | 3176 | 0.000170 | OK |
| 23-k-pesos | 1/1 | 0 | 0 | 3005 | 0.000169 | OK |
| 24-tb | 1/1 | 0 | 0 | 2636 | 0.000164 | OK |
| 25-bateria-rango | 1/1 | 0 | 0 | 2726 | 0.000160 | OK |
| 26-bateria-fraccion | 1/1 | 0 | 0 | 2546 | 0.000161 | OK |
| 27-sin-precio | 1/1 | 0 | 0 | 2924 | 0.000178 | OK |
| 28-sin-moneda | 1/1 | 0 | 0 | 2899 | 0.000171 | OK |
| 29-sin-imei | 1/1 | 0 | 0 | 3051 | 0.000179 | OK |
| 30-sin-bateria | 1/1 | 0 | 0 | 2825 | 0.000163 | OK |
| 31-minimo | 1/1 | 0 | 0 | 2806 | 0.000162 | OK |
| 32-desconocido | 1/1 | 0 | 0 | 2748 | 0.000166 | OK |
| 33-samsung | 1/1 | 0 | 0 | 2252 | 0.000166 | OK |
| 34-pixel | 1/1 | 0 | 0 | 2583 | 0.000168 | OK |
| 35-multilinea | 1/1 | 0 | 0 | 2891 | 0.000176 | OK |
| 37-con-guiones-imei | 1/1 | 0 | 0 | 3173 | 0.000189 | OK |
| 36-lista-numerada | 2/2 | 0 | 0 | 4132 | 0.000227 | OK |
| 38-outlet | 1/1 | 0 | 0 | 3504 | 0.000174 | OK |
| 39-preowned | 1/1 | 0 | 0 | 2903 | 0.000166 | OK |
| 40-seminuevo | 1/1 | 0 | 0 | 2965 | 0.000170 | OK |
| 41-mini | 1/1 | 0 | 0 | 2619 | 0.000158 | OK |
| 42-plus | 1/1 | 0 | 0 | 2344 | 0.000166 | OK |
| 43-pro-vs-max | 2/2 | 0 | 0 | 3361 | 0.000195 | OK |
| 44-costo-solo | 1/1 | 0 | 0 | 3272 | 0.000205 | OK |
| 45-monedas-costo-distintas | 1/1 | 0 | 0 | 3630 | 0.000173 | OK |
| 47-precio-desde | 1/1 | 0 | 0 | 2414 | 0.000186 | OK |
| 46-cantidad-imei | 1/1 | 0 | 0 | 3322 | 0.000199 | OK |
| 49-xr | 1/1 | 0 | 0 | 1939 | 0.000151 | OK |
| 48-precio-rango | 1/1 | 0 | 0 | 2466 | 0.000177 | OK |
| 50-se | 1/1 | 0 | 0 | 2372 | 0.000171 | OK |
| 51-whatsapp-fecha | 2/2 | 0 | 0 | 3617 | 0.000215 | OK |
| 53-no-inventario-receta | 0/0 | 0 | 0 | 2406 | 0.000168 | OK |
| 52-accesorios | 1/1 | 0 | 0 | 4019 | 0.000201 | OK |
| 55-no-inventario-charla | 0/0 | 0 | 0 | 1772 | 0.000145 | OK |
| 56-no-inventario-instrucciones | 0/0 | 0 | 0 | 2008 | 0.000132 | OK |
| 54-no-inventario-gastos | 0/0 | 0 | 0 | 2729 | 0.000160 | OK |
| 57-mixto-24-lineas | 24/24 | 0 | 0 | 16942 | 0.001302 | OK |
| large-500 | 500/500 | 0 | 0 | 77609 | 0.020563 | OK |

## Diferencias y errores

## Reproducir

`npm --prefix backend run eval:import` con OPENAI_API_KEY en el shell. OPENAI_IMPORT_MODEL es opcional. El script hace llamadas reales, no persiste equipos y escribe este reporte; exit code 1 indica umbral no alcanzado.
