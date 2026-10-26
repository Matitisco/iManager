import { describe, expect, it } from 'vitest';
import { applyPlans, heuristicSheet } from './sheet-plan.js';
import { IMPORT_CATALOGS } from './import-catalog.js';
describe('client opening history Excel mapping', () => {
  it('preserves total and currency from the sheet to import rows', () => {
    const sheet = { name: 'Clientes', rows: [['Nombre', 'DNI', 'Total comprado', 'Moneda'], ['Lucía Fernández', '35444111', '2.400,50', 'USD']] };
    const plan = heuristicSheet(sheet, IMPORT_CATALOGS.clients, 'ARS');
    expect(applyPlans([sheet], [plan], 'clients', 'ARS').rows).toEqual([
      expect.objectContaining({ name: 'Lucía Fernández', importedSpent: '2.400,50', importedSpentCurrency: 'USD' }),
    ]);
  });
});
