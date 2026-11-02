import assert from 'node:assert/strict';
import { test } from 'node:test';
import { report, timing } from './ci-timings.mjs';
const at = (n) => new Date(n * 1000).toISOString();
const step = (name, a, b, conclusion = 'success') => ({
  name,
  started_at: at(a),
  completed_at: at(b),
  conclusion,
});
test('queue excludes dependency wait; setup includes containers, cleanup stays separate', () => {
  assert.deepEqual(
    timing({
      created_at: at(8),
      started_at: at(10),
      completed_at: at(30),
      steps: [
        step('Install dependencies', 10, 15),
        step('Test backend unit', 15, 25),
        step('Post cache', 25, 28),
        step('Test related', 0, 100, 'skipped'),
      ],
    }),
    { queue: 2, setup: 7, execute: 10, cleanup: 3, total: 20 },
  );
});
test('failures are counted but cannot create an apparent runtime improvement', () => {
  const failed = { name: 'unit', conclusion: 'failure' };
  assert.match(report([{ jobs: [failed] }]), /unit \| 0\/1 \| —/);
});

test('failed runtime is available separately with an explicit outcome label', () => {
  const failed = {
    name: 'integration',
    conclusion: 'failure',
    created_at: at(0),
    started_at: at(2),
    completed_at: at(15),
    steps: [step('Test integration', 5, 14, 'failure')],
  };
  const table = report([{ jobs: [failed] }], 'failure');
  assert.match(table, /failure \/ total/);
  assert.match(table, /integration \| 1\/1 \| 2.0 s \| 4.0 s \| 9.0 s/);
});
