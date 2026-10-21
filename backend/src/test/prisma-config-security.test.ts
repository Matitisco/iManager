import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfigFromFile } from '@prisma/config';

// Resolve the implementation actually consumed by Prisma, including nested overrides.
const require = createRequire(import.meta.url);
const prismaRequire = createRequire(require.resolve('@prisma/config'));
const { deepmerge, deepmergeInto } = prismaRequire('deepmerge-ts') as typeof import('deepmerge-ts');
const temporaryDirectories: string[] = [];

async function configDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'imanager-prisma-config-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Prisma 6 configuration security compatibility', () => {
  it('merges ordinary configuration without changing arrays, callbacks or input records', () => {
    const adapter = () => Promise.resolve('fixture');
    const left = {
      schema: 'prisma/schema.prisma',
      migrations: { path: 'migrations', seed: 'node seed.js' },
      tables: { external: ['first'] },
      studio: { adapter },
    };
    const result = deepmerge(left, {
      schema: undefined,
      migrations: { path: 'db/migrations' },
      tables: { external: ['second'] },
    });
    expect(result).toEqual({
      ...left,
      migrations: { path: 'db/migrations', seed: 'node seed.js' },
      tables: { external: ['first', 'second'] },
    });
    expect(result.studio.adapter).toBe(adapter);
    expect(left.migrations.path).toBe('migrations');
    expect(left.tables.external).toEqual(['first']);
  });

  it.each(['deepmerge', 'deepmergeInto'] as const)('handles the advisory recursive graph with %s', (api) => {
    type Recursive = { self?: Recursive; left?: boolean; right?: boolean };
    const left: Recursive = { left: true };
    const right: Recursive = { right: true };
    left.self = left;
    right.self = right;
    let result: Recursive;
    if (api === 'deepmerge') result = deepmerge(left, right);
    else {
      deepmergeInto(left, right);
      result = left;
    }
    expect(result.left).toBe(true);
    expect(result.right).toBe(true);
    expect(result.self).toBe(result);
  });

  it('loads default configuration without a file, as this repository does', async () => {
    const result = await loadConfigFromFile({ configRoot: await configDirectory() });
    expect(result.error).toBeUndefined();
    expect(result.resolvedPath).toBeNull();
    expect(result.config).toBeDefined();
  });

  it('loads TypeScript configuration through Prisma/c12 and resolves relative paths', async () => {
    const directory = await configDirectory();
    await writeFile(path.join(directory, 'prisma.config.ts'), `export default {
      schema: 'prisma/schema.prisma',
      migrations: { path: 'prisma/migrations', seed: 'node seed.js' },
    };`);
    const result = await loadConfigFromFile({ configRoot: directory });
    expect(result.error).toBeUndefined();
    expect(result.config?.schema).toBe(path.join(directory, 'prisma/schema.prisma'));
    expect(result.config?.migrations).toMatchObject({
      path: path.join(directory, 'prisma/migrations'), seed: 'node seed.js',
    });
  });

  it('reports an invalid configuration instead of accepting it silently', async () => {
    const directory = await configDirectory();
    await writeFile(path.join(directory, 'prisma.config.ts'), 'export default { schema: 42 };');
    const result = await loadConfigFromFile({ configRoot: directory });
    expect(result.error).toBeDefined();
  });
});
