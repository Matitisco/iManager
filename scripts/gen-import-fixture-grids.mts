/** Run: npx tsx scripts/gen-import-fixture-grids.mts
 * Only reads the anonymized fixtures; grids are the real browser parser's output.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseWorkbook } from '../src/utils/parse-workbook.ts';
const dir = resolve('backend/test/fixtures/import/natan');
for (const name of (await readdir(dir)).filter(name => /\.(xlsx|csv)$/.test(name)).sort()) {
  const workbook = await parseWorkbook(new File([await readFile(resolve(dir, name))], name));
  const sheets = workbook.sheetNames.map(name => ({ name, rows: workbook.getSheet(name) }));
  await writeFile(resolve(dir, name.replace(/\.(xlsx|csv)$/, '.grid.json')), JSON.stringify(sheets, null, 2) + '\n');
  console.log(name, sheets.map(sheet => `${sheet.name}: ${sheet.rows.length}×${Math.max(...sheet.rows.map(row => row.length))}`).join(', '));
}
