import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// gh auth supplies credentials. Never reads repository secrets or application env.
const gh = (...args) =>
  JSON.parse(
    execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }),
  );
const seconds = (start, end) =>
  Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000);
const execution =
  /^(Test |Lint |Typecheck|Build$|E2E smoke|Full E2E|Full PWA|PWA smoke|Verify |Select tests|Check required)/i;
export function timing(job) {
  const steps = job.steps.filter(
    (s) => s.conclusion !== 'skipped' && s.started_at && s.completed_at,
  );
  const execute = steps
    .filter((s) => execution.test(s.name))
    .reduce((n, s) => n + seconds(s.started_at, s.completed_at), 0);
  const cleanup = steps
    .filter((s) => /^(Post |Stop containers|Complete job)/.test(s.name))
    .reduce((n, s) => n + seconds(s.started_at, s.completed_at), 0);
  const total = seconds(job.started_at, job.completed_at);
  return {
    queue: seconds(job.created_at, job.started_at),
    setup: Math.max(0, total - execute - cleanup),
    execute,
    cleanup,
    total,
  };
}
const median = (xs) => {
  xs.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};
export function report(data, conclusion = 'success') {
  const groups = new Map();
  for (const { jobs } of data)
    for (const job of jobs) {
      const group = groups.get(job.name) ?? [];
      group.push(job);
      groups.set(job.name, group);
    }
  const rows = [
    `| Job | ${conclusion === 'success' ? 'OK' : conclusion} / total | Queue | Setup | Execution | Cleanup | Job total |`,
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [name, jobs] of groups) {
    const ok = jobs.filter((j) => j.conclusion === conclusion).map(timing);
    if (conclusion !== 'success' && !ok.length) continue;
    rows.push(
      `| ${name} | ${ok.length}/${jobs.length} | ${['queue', 'setup', 'execute', 'cleanup', 'total'].map((k) => (ok.length ? `${median(ok.map((t) => t[k])).toFixed(1)} s` : '—')).join(' | ')} |`,
    );
  }
  return rows.join('\n') + '\n';
}
if (process.argv[1]?.endsWith('/ci-timings.mjs')) {
  const [mode, output, ...ids] = process.argv.slice(2);
  if (mode === 'report')
    console.log(
      report(JSON.parse(readFileSync(output, 'utf8')), ids[0] ?? 'success'),
    );
  else if (mode === 'collect') {
    const repo = gh('repo', 'view', '--json', 'nameWithOwner').nameWithOwner;
    const runs = ids.length
      ? ids.map((id) => ({ databaseId: Number(id) }))
      : gh(
          'run',
          'list',
          '--workflow',
          'ci.yml',
          '--limit',
          '30',
          '--json',
          'databaseId,event,headBranch,headSha,conclusion,createdAt,url',
        );
    const data = [];
    // Sequential requests avoid bursts against the API rate limit.
    for (const run of runs) {
      const full = gh('api', `repos/${repo}/actions/runs/${run.databaseId}`);
      const jobs = gh(
        'api',
        `repos/${repo}/actions/runs/${run.databaseId}/jobs?per_page=100`,
      ).jobs;
      if (jobs.length === 100)
        throw new Error(
          'Job pagination required; refusing partial measurements',
        );
      data.push({
        run: {
          ...run,
          event: full.event,
          headBranch: full.head_branch,
          headSha: full.head_sha,
          conclusion: full.conclusion,
          url: full.html_url,
        },
        jobs: jobs.map(
          ({
            name,
            conclusion,
            created_at,
            started_at,
            completed_at,
            html_url,
            steps,
          }) => ({
            name,
            conclusion,
            created_at,
            started_at,
            completed_at,
            html_url,
            steps: steps.map(
              ({ name, conclusion, started_at, completed_at }) => ({
                name,
                conclusion,
                started_at,
                completed_at,
              }),
            ),
          }),
        ),
      });
    }
    writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
    console.log(report(data));
  } else
    throw new Error(
      'Usage: ci-timings.mjs collect output.json [run IDs...] | report input.json',
    );
}
