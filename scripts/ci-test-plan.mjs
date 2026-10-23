import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const docs = path => /^(docs|openspec|skills)\//.test(path) || /\.md$/.test(path);
const sourceTest = path => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
const globalConfig = path => /^(package(-lock)?\.json|(?:vite|vitest|playwright)[^/]*\.[^/]+|tsconfig[^/]*\.json|\.npmrc|\.nvmrc|\.node-version|index\.html)$/.test(path);
const backendConfig = path => /^backend\/(prisma\/|(?:package(-lock)?\.json|vitest[^/]*\.[^/]+|tsconfig[^/]*\.json|\.npmrc)$|src\/(test|testing|config)\/)/.test(path);

// Unknown files deliberately expand coverage instead of silently skipping tests.
export function createPlan(entries, event = 'pull_request') {
  const plan = { frontend: 'off', backend: 'off', browser: false, files: [] };
  const enable = (project, mode = 'related') => {
    if (plan[project] !== 'full') plan[project] = mode;
  };
  if (event !== 'pull_request') return { ...plan, frontend: 'full', backend: 'full', browser: true };
  for (const { status, path } of entries) {
    if (docs(path)) continue;
    plan.files.push(path);
    if (globalConfig(path)) {
      enable('frontend', 'full'); enable('backend', 'full'); plan.browser = true;
    } else if (backendConfig(path)) {
      enable('backend', 'full'); enable('frontend', 'full');
    } else if (path.startsWith('backend/src/')) {
      enable('backend', status === 'D' ? 'full' : 'related');
      // Some frontend tests import backend helpers; retain those dependents.
      enable('frontend', status === 'D' ? 'full' : 'related');
    } else if (path.startsWith('src/')) {
      enable('frontend', status === 'D' ? 'full' : 'related');
      if (path.startsWith('src/test/')) enable('frontend', 'full');
      if (!sourceTest(path)) plan.browser = true;
    } else if (/^(public|e2e)\//.test(path) || /^scripts\/(pwa[^/]*|service-worker\.js|serve-spa\.mjs)$/.test(path)) {
      enable('frontend'); plan.browser = true;
    } else {
      enable('frontend', 'full'); enable('backend', 'full');
      // Backend scripts/fixtures/config do not affect the browser build.
      if (!path.startsWith('backend/')) plan.browser = true;
    }
  }
  return plan;
}

export function changedEntries(base, head) {
  if (!base || !head) throw new Error('PR_BASE and PR_HEAD are required for PR selection');
  const common = execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim();
  // No rename detection: old paths become deletions, which trigger the safe fallback.
  const fields = execFileSync('git', ['diff', '--no-renames', '--name-status', '-z', common, head], { encoding: 'utf8' }).split('\0');
  const entries = [];
  for (let i = 0; i < fields.length - 1; i += 2) entries.push({ status: fields[i], path: fields[i + 1] });
  return entries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = process.env.CI_EVENT;
  if (!event) throw new Error('CI_EVENT is required');
  const plan = createPlan(event === 'pull_request' ? changedEntries(process.env.PR_BASE, process.env.PR_HEAD) : [], event);
  console.log(JSON.stringify(plan, null, 2));
  const outputs = {
    plan: JSON.stringify(plan),
    frontend: plan.frontend,
    backend: plan.backend,
    browser: String(plan.browser),
    'frontend-shards': JSON.stringify(plan.frontend === 'full' ? [1, 2] : [1]),
  };
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
}
