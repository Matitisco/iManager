# Datos TAC de iPhone y Samsung Galaxy

Fuente: [MoazEb/tac-database](https://github.com/MoazEb/tac-database).

`scripts/data/iphone-tac.csv` contiene 4147 TAC únicos de la hoja ALL, marca
APPLE, correspondientes a iPhone 11–17, iPhone 16e y iPhone Air. Se incluyeron
solo registros con número de modelo Apple A####, se descartaron «TEST DEVICE»
y entradas que contradicen su propio rótulo. La relación A#### → modelo es
unívoca en este subconjunto. El generador normaliza los nombres del catálogo
y produce `src/lib/imei-tac-data.ts`, que conserva únicamente TAC → modelo.

`scripts/data/samsung-tac.csv` contiene 14.440 TAC únicos y 188 modelos de
Samsung Galaxy de la misma hoja ALL, marca SAMSUNG, bajo la misma licencia MIT.
Incluye S8–S26, Note8–20, Z Flip/Fold y series A/M/F. `smodel` conserva la base
del número SM- (por ejemplo S928). Se descartaron filas sin número SM-, etiquetas
contradictorias con la mayoría de su número SM- y equipos fuera de alcance
(series J, Grand, S3–S7, tablets y otros). Se corrigieron las bases S942/S947/S948
a S26/S26+/S26 Ultra, que el dataset rotulaba S26 Pro/Edge. Según la curación de
origen, 173 de 186 nombres cotejados coinciden con una lista pública independiente
por número SM-. No se deducen capacidad ni color Samsung ni se incorporan a la
tabla de números de parte Apple.

El generador valida unicidad de TAC entre ambos CSV y genera la tabla compacta
TAC → modelo y el catálogo pequeño `backend/src/lib/samsung-models.ts` desde
estas fuentes versionadas. No se consulta el dataset durante el uso de la app.

El dataset declara como fuentes bases públicas de IMEI/TAC. Los datos usados
son pares objetivos TAC → modelo; su cobertura es parcial y no identifica
capacidad, color ni características de una unidad particular. La consulta
funciona con datos embebidos, sin servicios externos ni dependencias de pago.

## MIT License

Copyright (c) 2026 Moaz Ebrahem

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
