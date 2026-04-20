import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/imanager_test';
const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  const repoRoot = path.resolve(currentDir, '..');
  const backendDir = path.resolve(repoRoot, 'backend');
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;

  process.env.DATABASE_URL = databaseUrl;

  execSync('npx prisma db push --skip-generate', {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
  });
}
