import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { changedEntries, createPlan } from './ci-test-plan.mjs';
const plan = (...paths) => createPlan(paths.map(path => ({ status: 'M', path })));

test('UI selects frontend and browser; backend-only selects dependents without browser', () => {
  assert.deepEqual(plan('src/desk/screens/ClientsScreen.tsx'), { frontend: 'related', backend: 'off', browser: true, files: ['src/desk/screens/ClientsScreen.tsx'] });
  assert.deepEqual(plan('backend/src/modules/clients/clients.service.ts'), { frontend: 'related', backend: 'related', browser: false, files: ['backend/src/modules/clients/clients.service.ts'] });
});
test('docs skip suites; frontend tests alone do not run browser smoke', () => {
  assert.deepEqual(plan('README.md', 'docs/image.png', 'openspec/config.yaml', 'skills/test/SKILL.md'), { frontend: 'off', backend: 'off', browser: false, files: [] });
  assert.equal(plan('src/desk/clients.test.tsx').browser, false);
});
test('config/setup/dependency changes invalidate selection regardless of other files', () => {
  for (const path of ['package.json', 'package-lock.json', 'vitest.config.ts', 'vite.config.ts', 'tsconfig.json', '.npmrc', '.github/workflows/ci.yml', 'scripts/ci-test-plan.mjs']) {
    const selected = plan(path, 'src/utils/format.ts');
    assert.equal(selected.frontend, 'full', path);
    assert.equal(selected.backend, 'full', path);
    assert.equal(selected.browser, true, path);
  }
  for (const path of ['backend/prisma/schema.prisma', 'backend/prisma/migrations/001/migration.sql', 'backend/vitest.shared.ts', 'backend/src/test/setup-env.ts', 'backend/package-lock.json', 'backend/tsconfig.build.json']) {
    assert.equal(plan(path).backend, 'full', path);
    assert.equal(plan(path).frontend, 'full', path);
    assert.equal(plan(path).browser, false, path);
  }
  assert.equal(plan('src/test/setup.ts').frontend, 'full');
});
test('PWA, routing, styles and fixtures run browser coverage', () => {
  for (const path of ['src/App.tsx', 'src/desk/desk.css', 'public/manifest.webmanifest', 'public/sw.js', 'scripts/service-worker.js', 'scripts/pwa.mjs', 'scripts/serve-spa.mjs', 'e2e/smoke.spec.ts']) {
    assert.equal(plan(path).browser, true, path);
  }
});
test('deletions use complete affected suites; mixed changes preserve both scopes', () => {
  assert.equal(createPlan([{ status: 'D', path: 'src/lib/helper.ts' }]).frontend, 'full');
  const deleted = createPlan([{ status: 'D', path: 'backend/src/lib/helper.ts' }]);
  assert.equal(deleted.backend, 'full');
  assert.equal(deleted.frontend, 'full');
  const mixed = plan('src/components/Card.tsx', 'backend/src/modules/sales/sales.service.ts');
  assert.equal(mixed.frontend, 'related'); assert.equal(mixed.backend, 'related'); assert.equal(mixed.browser, true);
});
test('main, nightly and dispatch retain full suites even with no changed files', () => {
  for (const event of ['push', 'schedule', 'workflow_dispatch']) {
    assert.deepEqual(createPlan([], event), { frontend: 'full', backend: 'full', browser: true, files: [] });
  }
});
test('real git diff uses merge-base, retains earlier commits, renames and literal filenames', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-plan-'));
  const previous = process.cwd();
  try {
    process.chdir(dir);
    const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
    git('init', '-q'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'Test');
    writeFileSync('original.ts', 'a'); git('add', '.'); git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    git('checkout', '-qb', 'feature'); git('mv', 'original.ts', 'renamed.ts'); git('commit', '-qm', 'rename');
    const literal = 'file with spaces\n$(literal).ts';
    writeFileSync(literal, 'b'); git('add', '.'); git('commit', '-qm', 'second');
    const head = git('rev-parse', 'HEAD');
    git('checkout', '-q', base); writeFileSync('base-only.ts', 'c'); git('add', '.'); git('commit', '-qm', 'base advances');
    const entries = changedEntries(git('rev-parse', 'HEAD'), head);
    assert.deepEqual(entries, [{ status: 'A', path: literal }, { status: 'D', path: 'original.ts' }, { status: 'A', path: 'renamed.ts' }]);
    assert.throws(() => changedEntries('', head), /required/);
  } finally { process.chdir(previous); rmSync(dir, { recursive: true, force: true }); }
});

test('related inputs keep browser-only assets valid and include filesystem dependencies precisely', async () => {
  const { relatedInputs } = await import('./ci-related-tests.mjs');
  const readers = {
    'src/lib/utf8-copy.test.ts': "readdirSync; const roots = ['src', 'backend/src', 'e2e']; readFileSync",
    'src/lib/visible-loading-copy.test.ts': "readdirSync; sources('src'); readFileSync",
    'src/desk/styles.test.ts': "readFileSync(resolve(__dirname, 'desk.css'))",
    'src/pages/login.test.ts': "readFileSync(join(__dirname, './Login.tsx'))",
  };
  const select = files => relatedInputs({ files }, 'frontend', Object.keys(readers), path => readers[path]);
  assert.deepEqual(select(['public/manifest.webmanifest']), ['public/manifest.webmanifest']);
  assert.deepEqual(select(['backend/src/lib/ar-money.ts']), ['backend/src/lib/ar-money.ts', 'src/lib/utf8-copy.test.ts']);
  assert.deepEqual(select(['src/desk/desk.css']), ['src/desk/desk.css', 'src/lib/utf8-copy.test.ts', 'src/lib/visible-loading-copy.test.ts', 'src/desk/styles.test.ts']);
  assert.ok(select(['src/pages/Login.tsx']).includes('src/pages/login.test.ts'));
  const backend = relatedInputs({ files: ['backend/src/modules/clients/service.ts'] }, 'unit', ['backend/src/modules/clients/routes.test.ts', 'backend/src/modules/sales/sales.test.ts']);
  assert.deepEqual(backend, ['src/modules/clients/service.ts', 'src/modules/clients/routes.test.ts']);
});
