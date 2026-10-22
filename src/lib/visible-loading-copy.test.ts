import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { visibleLoadingCopy } from '../test/visible-loading-copy';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx$/.test(path) && !/\.(?:test|spec)\.tsx$/.test(path) ? [path] : [];
  });
}

describe('visible loading copy guard', () => {
  it.each([
    '<p>Cargando…</p>',
    '<div>{pending ? "Cargando clientes..." : "Listo"}</div>',
    '<input value="Cargando proveedores…" />',
    '<Sheet title="Loading details" />',
    'const copy = "Cargando lista"; const View = () => <p>{copy}</p>;',
    '<p>{`Cargando ${count}`}</p>',
    '<p>{pending && "Loading..."}</p>',
    '<p>{pending ? "loading" : "ready"}</p>',
  ])('rejects visible copy: %s', source => {
    expect(visibleLoadingCopy(source)).not.toEqual([]);
  });

  it('allows accessible copy, skeleton hooks and internal state', () => {
    expect(visibleLoadingCopy('const [state] = useState("loading"); const View = () => <div role="status" aria-label="Cargando" aria-busy={state === "loading"} data-testid="loading"><span className="sr-only">Cargando datos</span></div>;')).toEqual([]);
  });

  it('has no visible Cargando or Loading copy in frontend TSX', () => {
    const hits = sources('src').flatMap(path => visibleLoadingCopy(readFileSync(path, 'utf8')).map(hit => `${path}:${hit}`));
    expect(hits).toEqual([]);
  });
});
