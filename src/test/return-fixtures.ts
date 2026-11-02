import type { ReturnCaseView } from '../services/returns-api';

export function partialReturn(overrides: Partial<ReturnCaseView> = {}): ReturnCaseView {
  return {
    id: 'r', code: 'RMA-0001', caseNumber: 1, saleId: 's', clientId: 'c1', clientName: 'Cliente ficticio',
    inventoryItemId: 'p', imei: '', deviceLabel: 'Equipo ficticio', supplierId: null, supplierName: null,
    reason: 'Dos unidades devueltas', diagnosis: null, openedOn: '2026-10-02', resolution: 'REINTEGRO',
    settlement: 'REINTEGRO', moneyAmount: 200, moneyCurrency: 'USD', destination: 'STOCK', stockStatus: 'EN_REVISION',
    previousStatus: 'DISPONIBLE', rmaStatus: null, status: 'RESUELTO', resolvedOn: '2026-10-02', compensatedOn: '2026-10-02',
    deletedAt: null, refundable: 1000, saleAmount: 1000, saleQuantity: 10, saleCurrency: 'USD', saleDate: '2026-10-01',
    warrantyDays: null, itemCost: 60, itemCurrency: 'USD', creditNote: null, events: [], ...overrides,
  };
}
