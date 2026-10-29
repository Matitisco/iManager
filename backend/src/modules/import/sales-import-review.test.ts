import { afterEach, describe, expect, it, vi } from 'vitest';
import { inventedSalesWorkbook } from '../../../test/fixtures/invented-sales.js';
import { applyImportPlan, analyzeImport } from './analyze-import.service.js';
import { prepareSaleReviewRows } from './sale-import-row.js';
import { scriptDecisionAnswers } from '../../../test/script-decisions.js';


afterEach(() => { delete process.env.OPENAI_API_KEY; vi.restoreAllMocks(); });

describe('sales import from invented Excel files', () => {
  it('retains each nonempty physical row, totals, duplicates, notes and columns without a header', async () => {
    delete process.env.OPENAI_API_KEY;
    const sheets = await inventedSalesWorkbook();
    const result = await analyzeImport({ section: 'sales', currency: 'USD', sheets });
    expect(result.rows).toHaveLength(6);
    expect(result.rows.map(row => row._sourceRow)).toEqual(['2', '3', '4', '5', '7', '8']);
    expect(result.rows.every(row => row._sourceSheet === 'Ventas ficticias')).toBe(true);
    for (const row of result.rows.slice(0, 2)) expect(row._review).toContain('duplicada');
    expect(new Set(result.rows.map(row => row._importFingerprint)).size).toBe(6);
    expect(result.rows[0].notes).toContain('Con funda');
    expect(result.rows[0].notes).toContain('Referencia de caja (origen): CAJA-QA-1');
    expect(result.rows[0].notes).toContain('Columna J (origen): valor sin título');
    expect(result.rows[2]).toMatchObject({ paymentMethod: 'POR REVISAR' });
    expect(result.rows[3]).toMatchObject({ _possibleTotal: 'true' });
    expect(result.rows[3]._review).toContain('fila de total');
    expect(result.rows[4].notes).toContain('Llamar mañana');
    expect(result.rows[5].notes).toContain('desconocido');
    expect(result.rows[5]._review).toContain('IMEI inválido');
    const repeated = prepareSaleReviewRows(result.rows, 'USD');
    expect(repeated.map(row => row._importFingerprint)).toEqual(result.rows.map(row => row._importFingerprint));
    expect(repeated.map(row => row.notes)).toEqual(result.rows.map(row => row.notes));
    const applied = applyImportPlan({ section: 'sales', currency: 'USD', sheets, plan: result.plan });
    expect(applied.rows).toEqual(result.rows);
  });

  it('keeps rows when the amount column is missing and allows assigning notes', async () => {
    delete process.env.OPENAI_API_KEY;
    const sheets = [{ name: 'Ventas', rows: [['Fecha', 'Cliente', 'Equipo', 'Observaciones'], ['10/01/2024', 'Cliente QA', 'Equipo QA', 'Texto íntegro']] }];
    const result = await analyzeImport({ section: 'sales', currency: 'USD', sheets });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ notes: 'Texto íntegro', _unpriced: 'true' });
    expect(result.plan[0].mapping.find(column => column.header === 'Observaciones')?.field).toBe('notes');
  });

  it('validates an incorrect model mapping against every row and retries with feedback', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const sheets = [{ name: 'Ventas', rows: [['Fecha', 'Cliente', 'Equipo', 'Precio'], ['10/01/2024', 'Persona QA', 'Equipo QA', '500']] }];
    let attempt = 0;
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const answers = scriptDecisionAnswers(body);
      attempt++;
      if (attempt === 1) for (const answer of answers) if (answer.name === 'h0_c3') answer.choice = 'device';
      if (attempt > 1) expect(body.input).toContain('Validación de TODAS las filas');
      return new Response(JSON.stringify({ answers, usage: { input_tokens: 100, output_tokens: 10 } }));
    });
    const result = await analyzeImport({ section: 'sales', currency: 'USD', sheets }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.rows[0]).toMatchObject({ amount: '500', device: 'Equipo QA' });
  });
});
