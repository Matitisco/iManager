# Diseño

CSV filtrado versionado y generador Node determinístico: TAC agrupados por modelo y codificados como deltas en base36. Lookup síncrono embebido; imeiSpecs reutiliza Luhn existente. Los formularios distinguen edición manual de valores autocompletados y conservan foco y validación de guardado. La vista previa conserva detected/touched y distingue TAC de etiqueta. Lote mantiene su modelo compartido existente, sin campos por fila.

## B — Samsung y tamaño

Se unifican los CSV Apple y Samsung en un generador que valida TAC únicos de
ocho dígitos entre fuentes, A#### y catálogo Apple para Apple, nombre Samsung
Galaxy y base SM- para Samsung. El CSV curado almacena `smodel` sin el prefijo
literal SM-. Se aceptan bases como S928 y SM-S928. Los TAC se ordenan por modelo
y valor; se codifica el primer valor absoluto y deltas positivos en base36,
separados por puntos. Un Map se decodifica una sola vez, perezosamente al primer
lookup. Se genera además un archivo pequeño de nombres para frontend y backend;
el backend no importa el CSV ni la tabla completa. Orden de sugerencias:
iPhone, Samsung S, Z, A, Note, M, F; nombres numéricos dentro de cada familia.

La auditoría con rg de DTO/Zod de inventario, ventas y canjes, pickers, filtros,
agrupaciones, ordenamientos y catálogo público no encontró restricciones a
Apple. `normalizeTextModel` usa el catálogo compartido y conserva el signo + para
Samsung (S24/S24+, Note10/Note10+); sus abreviaturas y normalización Apple
se mantienen. `shortCatalogModel` quita únicamente el prefijo iPhone y conserva
Samsung completo. No existe un parser `getModelFamily` restrictivo en estos
flujos. La tabla Apple de números de parte se conserva separada.

## A — Registro de faltantes

`autofillImeiSpecs` conserva el lookup síncrono y, solo con Luhn válido y sin
modelo, deriva el TAC antes de llamar a `reportUnknownTac(tac)`. Este helper
rechaza cualquier valor que no tenga exactamente ocho dígitos, deduplica en un
Set de sesión en memoria, usa el usuario del bridge existente y `apiRequest`
con `void` y catch vacío. No espera al envío ni modifica la UI. Se usa en
`useModelAutofill`, creación/edición de borradores de scan-review y carga de
lote; también se registra si el usuario ya eligió manualmente el modelo. El
parser general y el lookup puro no reportan, para excluir stock ciego y búsqueda
de equipos vendidos. Las ediciones manuales y la prioridad de etiqueta se conservan.

`POST /api/imei-tac-misses` aplica authenticate + resolveAppUser, valida el cuerpo
estricto `{ tac: /^\d{8}$/ }` con longitud exacta de ocho caracteres y responde 204.
Limita a 60 envíos por usuario por minuto, descartando exceso con 204, como analytics, con caché limitada a 5000
usuarios. El upsert atómico incrementa count y actualiza lastSeenAt, conservando
firstSeenAt. Prisma agrega solo ImeiTacMiss (tac, count, firstSeenAt, lastSeenAt),
sin relaciones, storeId, userId ni IMEI; la migración contiene solo CREATE TABLE.
No se verifica el catálogo desde el backend.

### Cómo consultar

`GET /admin/imei-tac-misses?limit=100` con el mismo Bearer de la API y email
verificado incluido en `ADMIN_EMAILS`. Los dueños de tienda no tienen acceso por
su rol. Devuelve `{ items: [{ tac, count, firstSeenAt, lastSeenAt }] }`, ordenado
por count descendente y TAC ascendente para empates, con no-store. El límite es
opcional, por defecto 100 y permitido de 1 a 500. Solo lectura; sin nueva pantalla.

## Verificación y medición

- `npx tsc --noEmit -p .` y `npm run lint` en frontend y backend: aprobados.
- Frontend: 59 pruebas relacionadas en 5 archivos; suite completa 213 archivos /
  1877 pruebas, 81,00 s. Incluye pegar Samsung en Registrar equipo sin completar
  detalles de unidad, preservar edición manual y reporte deduplicado en equipo,
  scan-review, lote, canje nuevo/histórico y venta con canje.
- Backend: suite unitaria completa 84 archivos / 606 pruebas, 9,90 s. Los 188
  modelos Samsung conservan su nombre canónico, incluidos los +.
- Integración TAC y analytics: 2 archivos / 16 pruebas, 5,10 s. Base dedicada
  `imanager_imei_tac_test_20261023` del PostgreSQL local de 127.0.0.1:5433;
  schema anterior inicializado en esa base y migración CREATE TABLE ejecutada
  directamente antes de probar. Sin acceso a producción.
- Generador: 2 pruebas Node aprobadas; unicidad entre fuentes, formato, nombres,
  reproducibilidad byte a byte y mismo resultado al invertir filas. Los 18.587
  TAC se decodifican sin duplicados; todos los Samsung coinciden con el CSV.
  `node scripts/build-imei-tac.mjs` no modifica ninguno de sus dos outputs.
- Cliente Prisma generado; `git diff --check` aprobado. CSV Samsung idéntico
  al archivo curado proporcionado. CLI OpenSpec no disponible en el entorno;
  artefactos actualizados en este mismo change, sin crear ni archivar otro.

Medición de los archivos JavaScript de `assets/*.js` producidos por Vite en
modo production, sumando bytes sin gzip y gzip de cada archivo (Node zlib,
nivel predeterminado). Outputs temporales fuera del árbol. No se incluyen CSS,
mapas ni service worker; se mide el JS entregado por los mismos tres chunks.

| Referencia | JS bytes | gzip bytes |
|---|---:|---:|
| HEAD 904ffc2, antes de todo el trabajo TAC | 2.945.631 | 817.784 |
| Árbol inicial de esta ampliación, con iPhone TAC | 2.982.711 | 834.738 |
| Resultado con A y B | 3.028.852 | 861.485 |
| Aumento de A+B sobre árbol inicial | 46.141 | 26.747 |
| Aumento total sobre HEAD | 83.221 | 43.701 |

La tabla generada ocupa 76.156 bytes y el catálogo Samsung 4961 bytes de fuente.
El aumento total gzip (43.701 bytes, 42,68 KiB) queda debajo de ~45 KB, por lo
que se mantiene el lookup síncrono embebido con decodificación perezosa. No se
agrega un import dinámico ni precarga, evitando estados transitorios de lookup.
Sin dependencias nuevas, textos de UI nuevos, pantallas, commit ni push.
