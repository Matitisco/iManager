import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { analyzeTextImport, amountInSource, imeiInSource, TEXT_PROMPT, type TextAnalysis } from '../src/modules/import/text-import.service.js';
import { textOutputSchema, textRowSchema, type TextRow } from '../src/modules/import/text-import.schema.js';
import { importModel } from '../src/modules/import/responses-client.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturesDir = path.join(root, 'backend/test/fixtures/import-text');
const reportPath = path.join(root, 'docs/evals/issue-338-import-llm.md');
const fields = ['model', 'capacity', 'color', 'batteryHealth', 'condition', 'imei', 'serial', 'price', 'currency', 'cost', 'quantity'] as const;
type Field = typeof fields[number];
type Score = { total: number; correct: number; present: number; presentCorrect: number };
type Run = { name: string; expected: TextRow[]; result?: TextAnalysis; raw: TextRow[]; error?: string; ms: number; missed: number; extra: number; inventedImei: number; inventedPrice: number; rawInventedImei: number; rawInventedPrice: number; mismatches: string[] };
const metrics = Object.fromEntries(fields.map((field) => [field, { total: 0, correct: 0, present: 0, presentCorrect: 0 }])) as Record<Field, Score>;
const zeroMetrics = structuredClone(metrics);
const rawMetrics = structuredClone(metrics);
const runs: Run[] = [];
const normalize = (value: unknown) => typeof value === 'string' ? value.toLowerCase().trim().replace(/\s+/g, ' ') : value;

function scoreRows(expected: TextRow[], actual: TextRow[], scores: Record<Field, Score>, mismatches: string[]) {
  const remaining = [...actual];
  let missed = 0;
  for (const [index, row] of expected.entries()) {
    // Provenance plus model, with fallback within the same line. This distinguishes multiple devices per line.
    let match = remaining.findIndex((item) => item.line === row.line && normalize(item.model) === normalize(row.model));
    if (match < 0) match = remaining.findIndex((item) => item.line === row.line);
    const found = match >= 0 ? remaining.splice(match, 1)[0] : undefined;
    if (!found) missed++;
    for (const field of fields) {
      const correct = Boolean(found && normalize(found[field]) === normalize(row[field]));
      scores[field].total++;
      scores[field].correct += Number(correct);
      if (row[field] !== null) { scores[field].present++; scores[field].presentCorrect += Number(correct); }
      if (!correct) mismatches.push(`fila ${index + 1} ${field}: esperado ${JSON.stringify(row[field])}, obtenido ${JSON.stringify(found?.[field] ?? '(fila ausente)')}`);
    }
  }
  return { missed, extra: remaining.length };
}

function hallucinations(rows: TextRow[], text: string, expected: TextRow[]) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let imei = 0, price = 0;
  const remaining = [...expected];
  for (const row of rows) {
    let match = remaining.findIndex((item) => item.line === row.line && normalize(item.model) === normalize(row.model));
    if (match < 0) match = remaining.findIndex((item) => item.line === row.line);
    const labeled = match >= 0 ? remaining.splice(match, 1)[0] : undefined;
    const source = lines.slice(row.line - 1, row.endLine).join('\n');
    if (row.imei && (!imeiInSource(row.imei, source) || row.imei !== labeled?.imei)) imei++;
    if (row.price !== null && (!amountInSource(row.price, source) || row.price !== labeled?.price)) price++;
  }
  return { imei, price };
}

async function run(name: string, text: string, expected: TextRow[]) {
  const raw: TextRow[] = [];
  const start = Date.now();
  let providerError = '';
  let result: TextAnalysis | undefined, error: string | undefined;
  try { result = await analyzeTextImport({ text, currency: 'ARS' }, { observe: (rows) => raw.push(...rows), fetchImpl: async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const payload = await response.clone().json().catch(() => ({})) as { error?: { code?: string } };
      providerError = `OpenAI HTTP ${response.status}${payload.error?.code ? ` (${payload.error.code})` : ''}`;
    }
    return response;
  } }); }
  catch (err) { error = `${providerError ? providerError + ': ' : ''}${err instanceof Error ? err.message : String(err)}`; }
  const actual = result?.rows.map((row, index) => textRowSchema.parse({
    ...Object.fromEntries(fields.map((field) => [field, ['price', 'cost', 'quantity'].includes(field) ? (row[field] ? Number(row[field]) : null) : row[field] || null])),
    line: result.review[index].line, endLine: result.review[index].line + result.review[index].original.split('\n').length - 1, dudas: result.review[index].dudas,
  })) ?? [];
  const mismatches: string[] = [];
  const score = scoreRows(expected, actual, name === 'large-500' ? structuredClone(zeroMetrics) : metrics, mismatches);
  scoreRows(expected, raw, name === 'large-500' ? structuredClone(zeroMetrics) : rawMetrics, []);
  const after = hallucinations(actual, text, expected), before = hallucinations(raw, text, expected);
  const record: Run = { name, expected, result, raw, error, ms: Date.now() - start, ...score, inventedImei: after.imei, inventedPrice: after.price, rawInventedImei: before.imei, rawInventedPrice: before.price, mismatches: error ? [] : mismatches };
  runs.push(record);
  console.log(`${name}: ${actual.length}/${expected.length} filas, ${record.ms}ms${error ? ` ERROR: ${error}` : ''}`);
}
const pct = (correct: number, total: number) => total ? `${(100 * correct / total).toFixed(2)}%` : '—';
const sum = (field: 'ms' | 'missed' | 'extra' | 'inventedImei' | 'inventedPrice' | 'rawInventedImei' | 'rawInventedPrice') => runs.reduce((total, run) => total + run[field], 0);
const safe = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

async function report() {
  const successes = runs.filter((run) => run.result);
  const costs = successes.map((run) => run.result!.usage.estimatedUsd);
  const cost = successes.length === 0 || costs.some((value) => value === null) ? null : costs.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const keyFields: Field[] = ['model', 'capacity', 'imei', 'price', 'currency', 'quantity'];
  const passed = runs.some((run) => run.name === 'large-500') && runs.every((run) => !run.error && (run.name !== 'large-500' || run.mismatches.length === 0)) && keyFields.every((field) => metrics[field].correct / metrics[field].total >= 0.95 && metrics[field].presentCorrect / metrics[field].present >= 0.95) && sum('inventedImei') === 0 && sum('inventedPrice') === 0 && sum('rawInventedImei') === 0 && sum('rawInventedPrice') === 0 && sum('missed') === 0 && sum('extra') === 0;
  const large = runs.find((run) => run.name === 'large-500');
  const lines = [
    '# Issue #338 — eval real del importador de texto', '',
    `Fecha UTC: ${new Date().toISOString()}. Modelo: \`${importModel()}\`. Prompt SHA256: \`${createHash('sha256').update(TEXT_PROMPT).digest('hex').slice(0, 16)}\`.`, '',
    'Corpus: 57 listados sintéticos realistas curados manualmente, más 500 líneas. No se recibieron listados privados reales; este corpus no reemplaza validación con datos reales autorizados. Expectativas independientes, null cuenta como campo ausente; precisión de campos presentes se informa aparte para no inflar métricas.', '',
    `Resultado del umbral (≥95% en campos clave, 0 IMEIs/precios inventados y 0 filas perdidas/extra): **${successes.length === 0 ? 'BLOQUEADO — sin respuestas válidas' : passed ? 'APROBADO' : 'NO ALCANZADO'}**.`, '',
    ...(successes.length === 0 && runs.find((run) => run.error)?.error ? [`Bloqueo observado: ${runs.find((run) => run.error)!.error}`, ''] : []),
    `Importaciones: ${runs.length}; errores: ${runs.filter((run) => run.error).length}; filas esperadas: ${runs.reduce((sum, run) => sum + run.expected.length, 0)}; perdidas: ${sum('missed')}; extra: ${sum('extra')}.`,
    `IMEIs/precios inventados o asignados incorrectamente (comparación con líneas fuente y etiquetas independientes): crudas IMEI ${sum('rawInventedImei')}, precio ${sum('rawInventedPrice')}; tras normalización IMEI ${sum('inventedImei')}, precio ${sum('inventedPrice')}. También se cuentan como críticos los precios tomados de capacidad/batería/costo o de otro equipo, aunque ese número exista en la fuente. Campos ausentes eliminados no se cuentan como inventados, pero penalizan la precisión.`,
    `Latencia acumulada: ${(sum('ms') / 1000).toFixed(2)} s; media: ${(sum('ms') / Math.max(runs.length, 1) / 1000).toFixed(2)} s. Costo estimado de llamadas exitosas: ${cost === null ? 'no medible (sin uso válido o modelo sin tarifa conocida)' : `US$ ${cost.toFixed(6)}`}. Errores pueden consumir tokens que no fueron devueltos; no se presupone costo cero.`, '',
    'Estimación conservadora sin descuentos de caché: gpt-6-luna $0.10/M entrada y $0.50/M salida, tarifa estándar, [OpenAI pricing](https://developers.openai.com/api/docs/pricing). Los tokens incluyen reintentos que devolvieron usage. CI no llama al modelo real.', '',
    'Precisión de campos calculada sólo sobre los 57 listados variados (84 filas): las 500 líneas se evalúan aparte y no inflan el umbral del corpus.', '',
    '| Campo | Precisión final | Presentes | Precisión cruda | Muestras |', '|---|---:|---:|---:|---:|',
    ...fields.map((field) => `| ${field} | ${successes.length ? pct(metrics[field].correct, metrics[field].total) : 'N/A'} | ${successes.length ? pct(metrics[field].presentCorrect, metrics[field].present) : 'N/A'} | ${successes.length ? pct(rawMetrics[field].correct, rawMetrics[field].total) : 'N/A'} | ${metrics[field].total} (${metrics[field].present} presentes) |`), '',
    `500 líneas: ${large?.result ? `${large.result.rows.length}/500 filas; ${large.ms} ms; ${large.result.usage.calls} llamadas; ${large.result.usage.inputTokens} tokens entrada / ${large.result.usage.outputTokens} salida; ${large.result.usage.estimatedUsd === null ? 'costo desconocido' : `US$ ${large.result.usage.estimatedUsd.toFixed(6)}`}` : large?.error ?? 'pendiente'}.`, '',
    '| Listado | Filas | Perdidas | Extra | Latencia ms | Costo US$ | Resultado |', '|---|---:|---:|---:|---:|---:|---|',
    ...runs.map((run) => `| ${run.name} | ${run.result?.rows.length ?? 0}/${run.expected.length} | ${run.missed} | ${run.extra} | ${run.ms} | ${run.result?.usage.estimatedUsd?.toFixed(6) ?? '—'} | ${safe(run.error ?? (run.mismatches.length ? `${run.mismatches.length} diferencias` : 'OK'))} |`), '',
    ...(successes.length === 0 ? ['**Sin respuestas válidas del LLM:** las tasas por campo no son una medición de calidad; no se pueden evaluar alucinaciones, latencia de inferencia ni costo real. Los contadores de filas perdidas reflejan importaciones fallidas, no extracciones incorrectas. Hace falta una clave válida para reejecutar.', ''] : []),
    '## Diferencias y errores', '',
    ...runs.filter((run) => run.error || run.mismatches.length).flatMap((run) => [`### ${run.name}`, '', ...(run.error ? [run.error, ''] : []), ...run.mismatches.map((item) => `- ${item}`), '']),
    '## Reproducir', '', '`npm --prefix backend run eval:import` con OPENAI_API_KEY en el shell. OPENAI_IMPORT_MODEL es opcional. El script hace llamadas reales, no persiste equipos y escribe este reporte; exit code 1 indica umbral no alcanzado.', '',
  ];
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, lines.join('\n'));
  return passed;
}

if (!process.env.OPENAI_API_KEY) {
  await run('configuration', 'iPhone 13 usado USD 420', [textRowSchema.parse({ line: 1, endLine: 1, model: 'iPhone 13', capacity: null, color: null, batteryHealth: null, condition: 'USADO', imei: null, serial: null, price: 420, currency: 'USD', cost: null, quantity: 1, dudas: [] })]);
  await report();
  process.exitCode = 1;
} else {
  const names = (await readdir(fixturesDir)).filter((name) => name.endsWith('.txt')).sort();
  // Bounded parallelism for offline eval only; production uses per-store quota.
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < names.length) {
      const name = names[next++];
      const text = await readFile(path.join(fixturesDir, name), 'utf8');
      const expected = textOutputSchema.shape.rows.parse(JSON.parse(await readFile(path.join(fixturesDir, name.replace('.txt', '.expected.json')), 'utf8')).rows);
      await run(name.replace('.txt', ''), text, expected);
      await report();
    }
  }));
  const expected = Array.from({ length: 500 }, (_, index) => textRowSchema.parse({ line: index + 1, endLine: index + 1, model: ['iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'][index % 4], capacity: '128GB', color: 'negro', batteryHealth: '89%', condition: 'USADO', imei: String(350000000000000 + index), serial: null, price: 400 + index, currency: index % 2 ? 'ARS' : 'USD', cost: null, quantity: 1, dudas: [] }));
  const text = expected.map((row) => `${row.model} 128GB negro usado bat 89% IMEI ${row.imei} precio ${row.currency} ${row.price}`).join('\n');
  await run('large-500', text, expected);
  const passed = await report();
  console.log(`Reporte: ${reportPath} — ${passed ? 'APROBADO' : 'NO ALCANZADO'}`);
  process.exitCode = passed ? 0 : 1;
}
