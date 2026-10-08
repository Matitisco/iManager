import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.md', '.json', '.html', '.prisma']);
const MOJIBAKE = /\u00C3[\u0080-\u00BF]/;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return TEXT_EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

describe('utf-8 spanish copy', () => {
  it('has no mojibake left in the app source', () => {
    const hits = ['src', 'backend/src', 'e2e'].flatMap(filesUnder).filter((file) => MOJIBAKE.test(readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('keeps the corrected session, notification and payment copy', () => {
    const app = readFileSync('src/context/AppContext.tsx', 'utf8');
    expect(app).toContain('No hay sesión');
    expect(app).toContain('No tenés permiso para ver notificaciones.');
    expect(app).toContain('No tenés acceso a esta notificación.');
    expect(readFileSync('src/pages/Sales.tsx', 'utf8')).toContain("{ value: 'T. Crédito', label: 'T. Crédito' }");
    expect(readFileSync('src/components/ConfirmModal.test.tsx', 'utf8')).toContain('Esta acción no se puede deshacer.');
    expect(readFileSync('src/pages/Onboarding.test.tsx', 'utf8')).toContain('El backend tardó en responder');
  });
});
