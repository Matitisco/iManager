import { afterEach, describe, expect, it, vi } from 'vitest';
import { csvText, downloadCsv } from './csv';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('CSV export', () => {
  it('preserves Spanish, commas, quotes and newlines while neutralizing formulas', () => {
    expect(csvText([['José, Pérez', 'Modelo "A"\nNegro', '=HYPERLINK("evil")', ' +1', '@SUM(A1)', '-1']])).toBe('"José, Pérez","Modelo ""A""\nNegro","\'=HYPERLINK(""evil"")","\' +1","\'@SUM(A1)","\'-1"');
  });
  it('downloads a UTF-8 CSV and releases its URL after the browser consumes it', () => {
    vi.useFakeTimers();
    const create = vi.fn((_blob: Blob) => 'blob:report'); const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe('reporte-ventas.csv'); });
    downloadCsv([['Nombre'], ['José']], 'reporte-ventas.csv');
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob); expect(click).toHaveBeenCalledOnce(); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:report');
  });
});
