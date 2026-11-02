import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affectedProjects, pushedFiles } from './pre-push.mjs';

test('outgoing diff uses pushed SHAs, literal filenames and skips deleted refs', () => {
  const calls = [];
  const files = pushedFiles(
    'refs/heads/a abc refs/heads/a def\nrefs/heads/b 000 refs/heads/b def',
    (...args) => {
      calls.push(args);
      return 'src/a b.ts\0src/$(literal).ts\0';
    },
  );
  assert.deepEqual(files, ['src/a b.ts', 'src/$(literal).ts']);
  assert.deepEqual(calls, [
    [
      'diff',
      '--no-renames',
      '--name-only',
      '--diff-filter=ACMRD',
      '-z',
      'def',
      'abc',
    ],
  ]);
});
test('new branch compares with merge base; all refs contribute and paths deduplicate', () => {
  const calls = [];
  const files = pushedFiles(
    'refs/heads/a abc refs/heads/a 000\nrefs/heads/b xyz refs/heads/b def',
    (...args) => {
      calls.push(args);
      return args[0] === 'symbolic-ref'
        ? 'refs/remotes/origin/test'
        : args[0] === 'merge-base'
          ? 'base'
          : 'backend/src/a.ts\0';
    },
  );
  assert.deepEqual(files, ['backend/src/a.ts']);
  assert.deepEqual(calls[2].slice(-2), ['base', 'abc']);
});
test('typechecks retain project context and backend-to-frontend dependencies', () => {
  assert.deepEqual(affectedProjects(['docs/notes.md']), {
    frontend: false,
    backend: false,
  });
  assert.deepEqual(affectedProjects(['src/App.tsx']), {
    frontend: true,
    backend: false,
  });
  assert.deepEqual(affectedProjects(['backend/src/service.ts']), {
    frontend: true,
    backend: true,
  });
  assert.deepEqual(affectedProjects(['package-lock.json']), {
    frontend: true,
    backend: true,
  });
});

test('deleted source files still select their TypeScript project graph', () => {
  const files = pushedFiles(
    'refs/heads/a abc refs/heads/a def',
    () => 'src/deleted.ts\0',
  );
  assert.deepEqual(files, ['src/deleted.ts']);
  assert.deepEqual(affectedProjects(files), { frontend: true, backend: false });
});
