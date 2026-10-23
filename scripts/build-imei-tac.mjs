import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const samsungOrder = ['S', 'Z', 'A', 'Note', 'M', 'F'];
function compareModels(a, b) {
  const family = model => samsungOrder.findIndex(prefix => model.startsWith(`Samsung Galaxy ${prefix}`));
  return family(a) - family(b) || a.localeCompare(b, 'en', { numeric: true });
}

export function buildImeiTacFiles(appleCsv, samsungCsv) {
  const groups = new Map();
  const seen = new Set();
  const samsungModels = new Set();
  const appleModels = new Set([...readFileSync(new URL('../src/lib/apple-part-numbers.ts', import.meta.url), 'utf8').matchAll(/\["([^"]+)"/g)].map(match => match[1]));
  for (const [csv, header, samsung] of [[appleCsv, 'tac,model,anumber', false], [samsungCsv, 'tac,model,smodel', true]]) {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.shift() !== header) throw new Error('Unexpected CSV header');
    for (const line of lines) {
      const columns = line.split(',');
      const [tac, rawModel, number] = columns;
      const model = samsung ? rawModel : rawModel?.replace(/^IPHONE /, 'iPhone ').replace(/PRO/g, 'Pro').replace(/MAX/g, 'Max').replace(/PLUS/g, 'Plus').replace(/MINI/g, 'mini').replace(/16E/g, '16e').replace(/AIR/g, 'Air');
      // The curated CSV stores the SM-base without the literal SM- prefix.
      const validModel = samsung
        ? /^(?:SM-)?[A-Z]\d{3}$/.test(number) && /^Samsung Galaxy (?:S\d|Z (?:Flip|Fold)|A\d|Note\d|M\d|F\d)[\w +]*$/.test(model)
        : /^A\d{4}$/.test(number) && appleModels.has(model);
      if (columns.length !== 3 || !/^\d{8}$/.test(tac) || !validModel || seen.has(tac)) throw new Error(`Invalid or duplicate TAC row: ${line}`);
      seen.add(tac);
      if (samsung) samsungModels.add(model);
      if (!groups.has(model)) groups.set(model, []);
      groups.get(model).push(Number(tac));
    }
  }
  // Absolute first TAC, then positive deltas in base36, grouped by model.
  const rows = [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([model, tacs]) => {
    let previous = 0;
    const packed = tacs.sort((a, b) => a - b).map(tac => { const delta = tac - previous; previous = tac; return delta.toString(36); }).join('.');
    return `  ${JSON.stringify(model)}: ${JSON.stringify(packed)},`;
  });
  const notice = '// Generado por scripts/build-imei-tac.mjs. No editar a mano.\n// Fuente y licencia: THIRD_PARTY_NOTICES.md.';
  return {
    data: `${notice} ${seen.size} TAC; solo modelo.\nexport const IMEI_TAC_DATA = {\n${rows.join('\n')}\n} as const;\n`,
    models: `${notice}\nexport const SAMSUNG_MODELS = ${JSON.stringify([...samsungModels].sort(compareModels), null, 2)} as const;\n`,
  };
}

export function buildImeiTac(appleCsv, samsungCsv) { return buildImeiTacFiles(appleCsv, samsungCsv).data; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appleCsv = readFileSync(new URL('./data/iphone-tac.csv', import.meta.url), 'utf8');
  const samsungCsv = readFileSync(new URL('./data/samsung-tac.csv', import.meta.url), 'utf8');
  const output = buildImeiTacFiles(appleCsv, samsungCsv);
  writeFileSync(new URL('../src/lib/imei-tac-data.ts', import.meta.url), output.data);
  writeFileSync(new URL('../backend/src/lib/samsung-models.ts', import.meta.url), output.models);
}
