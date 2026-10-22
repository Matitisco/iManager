import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  returnCase: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  returnEvent: { create: vi.fn() }, auditEvent: { create: vi.fn() },
}));
vi.mock('../../plugins/prisma.js', () => ({ prisma: db }));
vi.mock('../../lib/with-serializable-retry.js', () => ({ withSerializableRetry: (work: (tx: typeof db) => Promise<unknown>) => work(db) }));
vi.mock('../../lib/advisory-lock.js', () => ({ lockTransactionKey: vi.fn() }));
import { archiveReturnCase, listReturnCases, restoreReturnCase, updateReturnCase } from './returns.service.js';
const actor = { userId: 'user', name: 'Dueño', role: 'OWNER' };
const row = {
  id: 'claim', storeId: 'store', caseNumber: 1, status: 'ABIERTO', diagnosis: null, reason: 'No enciende',
  openedAt: new Date('2026-10-21T15:00:00Z'), deletedAt: null, resolvedAt: null,
  events: [], sale: null, supplier: null, inventoryItem: null, creditNote: null,
};
beforeEach(() => { vi.clearAllMocks(); db.returnCase.findFirst.mockResolvedValue(row); db.returnCase.findMany.mockResolvedValue([]); });
describe('reclamos: cambios auditados y baja lógica', () => {
  it('stores state and optional note in the same transaction and returns the new event', async () => {
    const event = { status: 'EN_DIAGNOSTICO', note: 'Revisar batería', createdAt: new Date('2026-10-22T15:00:00Z') };
    db.returnCase.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, status: 'EN_DIAGNOSTICO', events: [event] });
    const saved = await updateReturnCase('store', 'claim', { status: 'EN_DIAGNOSTICO', note: ' Revisar batería ' }, actor);
    expect(saved?.events).toEqual([{ status: 'EN_DIAGNOSTICO', note: 'Revisar batería', createdAt: '2026-10-22T15:00:00.000Z' }]);
    expect(db.returnCase.update).toHaveBeenCalledWith({ where: { id: 'claim' }, data: { status: 'EN_DIAGNOSTICO', diagnosis: null } });
    expect(db.returnEvent.create).toHaveBeenCalledWith({ data: { storeId: 'store', caseId: 'claim', status: 'EN_DIAGNOSTICO', note: 'Revisar batería' } });
    expect(db.auditEvent.create).toHaveBeenCalledOnce();
  });
  it('does not append duplicate timeline entries for an unchanged draft', async () => {
    await updateReturnCase('store', 'claim', { status: 'ABIERTO', note: ' ' }, actor);
    expect(db.returnCase.update).not.toHaveBeenCalled();
    expect(db.returnEvent.create).not.toHaveBeenCalled();
  });
  it('edits metadata without losing the current resolved state', async () => {
    db.returnCase.findFirst.mockResolvedValue({ ...row, status: 'RESUELTO' });
    await updateReturnCase('store', 'claim', { reason: 'Falla de cámara', openedOn: '2026-10-20', diagnosis: null }, actor);
    expect(db.returnCase.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'RESUELTO', reason: 'Falla de cámara', openedAt: new Date('2026-10-20T15:00:00Z') }) }));
  });
  it('cannot reopen a settled claim through PATCH', async () => {
    db.returnCase.findFirst.mockResolvedValue({ ...row, status: 'RESUELTO' });
    await expect(updateReturnCase('store', 'claim', { status: 'ABIERTO' }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.returnCase.update).not.toHaveBeenCalled();
  });
  it.each(['ABIERTO', 'EN_DIAGNOSTICO', 'EN_PROVEEDOR', 'RESUELTO'])('soft deletes %s with an event and actor, without a physical delete', async status => {
    db.returnCase.findFirst.mockResolvedValue({ ...row, status });
    expect(await archiveReturnCase('store', 'claim', actor, 'Duplicado')).toBe(true);
    expect(db.returnCase.update).toHaveBeenCalledWith({ where: { id: 'claim' }, data: { status: 'ANULADO', deletedAt: expect.any(Date), deletedBy: 'Dueño' } });
    expect(db.returnEvent.create).toHaveBeenCalledWith({ data: { storeId: 'store', caseId: 'claim', status: 'ANULADO', note: 'Duplicado' } });
    expect(db.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'return.cancelled', actorUserId: 'user', reason: 'Duplicado' }) });
    expect(db.returnCase.delete).not.toHaveBeenCalled();
  });
  it('scopes deletion to the store and never writes if the case is missing', async () => {
    db.returnCase.findFirst.mockResolvedValue(null);
    expect(await archiveReturnCase('other', 'claim', actor)).toBe(false);
    expect(db.returnCase.findFirst).toHaveBeenCalledWith({ where: { id: 'claim', storeId: 'other', deletedAt: null } });
    expect(db.returnCase.update).not.toHaveBeenCalled();
  });
  it('keeps ANULADO read-only even without a deletion timestamp', async () => {
    db.returnCase.findFirst.mockResolvedValue({ ...row, status: 'ANULADO' });
    expect(await updateReturnCase('store', 'claim', { reason: 'Cambio' }, actor)).toBeNull();
    await expect(restoreReturnCase('store', 'claim', actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.returnCase.update).not.toHaveBeenCalled();
  });
  it('includes timestamp-less cancellations only in the archived query', async () => {
    await listReturnCases('store');
    expect(db.returnCase.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { storeId: 'store', deletedAt: null, status: { not: 'ANULADO' } } }));
    await listReturnCases('store', true);
    expect(db.returnCase.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { storeId: 'store', OR: [{ deletedAt: { not: null } }, { status: 'ANULADO' }] } }));
  });
});
