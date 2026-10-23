import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export function relatedInputs(plan, target, tracked, read = path => readFileSync(path, 'utf8')) {
  const frontend = target === 'frontend';
  const tests = tracked.filter(path => /\.(test|spec)\.[jt]sx?$/.test(path));
  const seeds = new Set(plan.files);
  if (frontend) {
    // Vite only tracks imports. Include filesystem readers explicitly, also for
    // CSS, fixtures and source assertions that would otherwise have no graph edge.
    for (const path of tests.filter(path => path.startsWith('src/'))) {
      const source = read(path);
      if (!/\b(readFile|readFileSync|readdirSync)\b/.test(source)) continue;
      const readsChangedFile = plan.files.some(file => source.includes(file) || source.includes(basename(file)));
      // Directory-wide copy guards scan these trees recursively.
      const scansChangedTree = /\breaddirSync\b/.test(source) && plan.files.some(file =>
        ['src', 'backend/src', 'e2e'].some(root => file.startsWith(`${root}/`) &&
          (source.includes(`'${root}'`) || source.includes(`"${root}"`))));
      if (readsChangedFile || scansChangedTree) seeds.add(path);
    }
  } else {
    seeds.clear();
    for (const path of plan.files.filter(path => path.startsWith('backend/src/'))) {
      seeds.add(path);
      const module = path.match(/^backend\/src\/modules\/[^/]+\//)?.[0];
      if (module) for (const test of tests.filter(test => test.startsWith(module))) seeds.add(test);
    }
  }
  return [...seeds].map(path => frontend ? path : path.slice('backend/'.length));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  if (!['frontend', 'unit', 'integration'].includes(target)) throw new Error('Expected frontend, unit or integration');
  const plan = JSON.parse(process.env.TEST_PLAN);
  const frontend = target === 'frontend';
  if (plan[frontend ? 'frontend' : 'backend'] !== 'related') throw new Error('Related runner requires a related plan');
  const tracked = execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const inputs = relatedInputs(plan, target, tracked);
  if (!inputs.length) throw new Error('Refusing to run related without inputs');
  const args = ['related', '--run', '--passWithNoTests', '--maxWorkers=2'];
  if (!frontend) args.push('--config', `vitest.${target}.config.ts`);
  args.push(...inputs);
  console.log(`Selected ${target}:`, JSON.stringify(args));
  // No shell: filenames from the PR remain literal arguments.
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', ...args], {
    cwd: frontend ? process.cwd() : `${process.cwd()}/backend`, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
