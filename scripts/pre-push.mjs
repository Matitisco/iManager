import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const zero = /^0+$/;
export function pushedFiles(input, runGit = git) {
  const paths = new Set();
  for (const line of input.trim().split('\n').filter(Boolean)) {
    const [, local, , remote] = line.split(/\s+/);
    if (zero.test(local)) continue; // Ref deletion has no source to check.
    let base = remote;
    if (zero.test(remote)) {
      let target;
      try {
        target = runGit('symbolic-ref', 'refs/remotes/origin/HEAD');
      } catch {
        target = 'origin/test';
      }
      base = runGit('merge-base', target, local);
    }
    const names = runGit(
      'diff',
      '--no-renames',
      '--name-only',
      '--diff-filter=ACMRD',
      '-z',
      base,
      local,
    );
    for (const path of names.split('\0').filter(Boolean)) paths.add(path);
  }
  return [...paths];
}
export function affectedProjects(files) {
  const global = files.some((p) =>
    /^(package(-lock)?\.json|tsconfig.*\.json)$/.test(p),
  );
  return {
    // Frontend tests import backend helpers: backend edits can affect both graphs.
    frontend:
      global ||
      files.some((p) =>
        /^(src\/|backend\/.*\.[cm]?tsx?$|(?:vite|vitest).*\.ts$)/.test(p),
      ),
    backend:
      global ||
      files.some((p) =>
        /^backend\/(src\/|scripts\/|prisma\/|package.*\.json|tsconfig.*\.json)/.test(
          p,
        ),
      ),
  };
}
function command(bin, args, cwd = '.') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} failed (${code})`)),
    );
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const start = performance.now();
  // With no hook input, check the outgoing diff against the tracking branch.
  const input = process.stdin.isTTY ? '' : readFileSync(0, 'utf8');
  let files;
  if (input.trim()) files = pushedFiles(input);
  else {
    let base;
    try {
      base = git('rev-parse', '--abbrev-ref', '@{upstream}');
    } catch {
      base = 'origin/test';
    }
    files = git(
      'diff',
      '--no-renames',
      '--name-only',
      '--diff-filter=ACMRD',
      '-z',
      git('merge-base', base, 'HEAD'),
      'HEAD',
    )
      .split('\0')
      .filter(Boolean);
  }
  if (!files.length) {
    console.log('pre-push: no changed files');
    process.exit(0);
  }
  const format = process.argv.includes('--format');
  const existing = files.filter(existsSync);
  const formatted = existing.filter(
    (p) =>
      /\.(?:[cm]?[jt]sx?|json|ya?ml|md|css|html)$/.test(p) &&
      !p.endsWith('package-lock.json'),
  );
  const source = existing.filter((p) => /\.[cm]?[jt]sx?$/.test(p));
  const projects = affectedProjects(files);
  const tasks = [];
  if (formatted.length)
    tasks.push(
      command('node_modules/prettier/bin/prettier.cjs', [
        format ? '--write' : '--check',
        '--ignore-unknown',
        ...formatted,
      ]),
    );
  if (!format) {
    if (source.length)
      tasks.push(
        command('node_modules/oxlint/bin/oxlint', [
          '-c',
          '.oxlintrc.json',
          ...source,
        ]),
      );
    if (projects.frontend)
      tasks.push(
        command('node_modules/typescript/bin/tsc', [
          '--noEmit',
          '--incremental',
          '--tsBuildInfoFile',
          'node_modules/.cache/pre-push.tsbuildinfo',
        ]),
      );
    if (projects.backend)
      tasks.push(
        command(
          'node_modules/typescript/bin/tsc',
          [
            '--noEmit',
            '--incremental',
            '--tsBuildInfoFile',
            'node_modules/.cache/pre-push.tsbuildinfo',
          ],
          'backend',
        ),
      );
  }
  const results = await Promise.allSettled(tasks);
  for (const result of results)
    if (result.status === 'rejected') {
      console.error(result.reason.message);
      process.exitCode = 1;
    }
  console.log(
    `pre-push: ${files.length} changed files checked in ${((performance.now() - start) / 1000).toFixed(2)} s`,
  );
}
