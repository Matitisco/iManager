import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImeiTacFiles } from './build-imei-tac.mjs';
const apple = readFileSync(new URL('./data/iphone-tac.csv', import.meta.url), 'utf8');
const samsung = readFileSync(new URL('./data/samsung-tac.csv', import.meta.url), 'utf8');

test('reproduces both generated files and ignores CSV row order', () => {
  const generated = buildImeiTacFiles(apple, samsung);
  assert.equal(generated.data, readFileSync(new URL('../src/lib/imei-tac-data.ts', import.meta.url), 'utf8'));
  assert.equal(generated.models, readFileSync(new URL('../backend/src/lib/samsung-models.ts', import.meta.url), 'utf8'));
  const reverse = csv => { const [header, ...rows] = csv.trim().split(/\r?\n/); return [header, ...rows.reverse()].join('\n'); };
  assert.deepEqual(buildImeiTacFiles(reverse(apple), reverse(samsung)), generated);
});
test('rejects duplicate TAC within or across sources and malformed rows', () => {
  const appleRow = apple.trim().split(/\r?\n/)[1];
  const samsungRow = samsung.trim().split(/\r?\n/)[1];
  assert.throws(() => buildImeiTacFiles(apple + '\n' + appleRow, samsung));
  assert.throws(() => buildImeiTacFiles(apple, samsung + '\n' + samsungRow));
  assert.throws(() => buildImeiTacFiles(apple, samsung.replace(samsungRow.slice(0, 8), appleRow.slice(0, 8))));
  for (const row of ['1234567,Samsung Galaxy S24 Ultra,S928', '12345678,Other,S928', '12345678,Samsung Galaxy S24 Ultra,wrong', '12345678,Samsung Galaxy S24 Ultra,S928,extra']) {
    assert.throws(() => buildImeiTacFiles(apple, `tac,model,smodel\n${row}`));
  }
});
