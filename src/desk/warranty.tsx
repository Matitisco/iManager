import type { CoverageLine } from '../lib/warranty';
import { coverageHeadline } from '../lib/warranty';

export function CoverageBlock({ lines, testId }: { lines: CoverageLine[]; testId: string }) {
  return (
    <section className="warranty-list" aria-label="Garantías" data-testid={testId}>
      <h4>Garantías</h4>
      <p className="eqs-note" data-testid="warranty-headline">{coverageHeadline(lines)}</p>
      {lines.map((line) => (
        <div className="warranty-line" key={line.id}>
          <span>{line.title}</span>
          <b className={line.state === 'vigente' ? 'ok' : line.state === 'vencida' ? 'bad' : undefined}>{line.detail}</b>
        </div>
      ))}
    </section>
  );
}
