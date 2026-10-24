import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type ReturnResolution = 'REPARACION' | 'CAMBIO' | 'REINTEGRO';
export type ReturnSettlement = 'REINTEGRO' | 'NOTA_CREDITO' | 'NINGUNO';
export type ReturnDestination = 'STOCK' | 'PROVEEDOR' | 'CLIENTE';
export type RmaStatus = 'ENVIADO' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'RECIBIDO';

export type PatternGroupBy = 'supplier' | 'purchase' | 'model';

export interface PatternClaimView {
  id: string;
  caseNumber: string;
  deviceLabel: string;
  imei: string;
  reason: string;
  status: string;
  rmaStatus: string | null;
  openedAt: string;
  clientName: string;
}

export interface ReturnPatternView {
  key: string;
  label: string;
  supplierId: string | null;
  purchaseId: string | null;
  devices: number;
  problems: number;
  claims: number;
  percent: number;
  hot: boolean;
  topReason: { family: string; label: string; claims: number } | null;
  claimsDetail: PatternClaimView[];
  claimsTruncated: boolean;
}

export interface ReturnPatternSummary {
  devices: number;
  problems: number;
  percent: number;
  claims: number;
  topReason: ReturnPatternView['topReason'];
}

export function fetchReturnAnalysis(user: AuthUserLike, groupBy: PatternGroupBy) {
  return apiRequest<{ patterns: ReturnPatternView[]; summary: ReturnPatternSummary }>(user, `/api/returns/patterns?groupBy=${groupBy}`, {
    fallback: 'No se pudieron cargar las fallas',
  });
}

export function fetchReturnPatterns(user: AuthUserLike, groupBy: PatternGroupBy) {
  return fetchReturnAnalysis(user, groupBy).then(data => data.patterns);
}

export interface CreditNoteView {
  id: string;
  clientId: string;
  returnCaseId: string;
  code: string;
  amount: number;
  remaining: number;
  currency: string;
  status: string;
  deletedAt: string | null;
}

export interface ReturnCaseView {
  id: string;
  code: string;
  caseNumber: number;
  saleId: string | null;
  clientId: string | null;
  clientName: string;
  inventoryItemId: string | null;
  imei: string;
  deviceLabel: string;
  supplierId: string | null;
  supplierName: string | null;
  reason: string;
  diagnosis: string | null;
  openedOn: string;
  resolution: string | null;
  settlement: string | null;
  moneyAmount: number;
  moneyCurrency: string | null;
  destination: string | null;
  stockStatus: string | null;
  previousStatus: string | null;
  rmaStatus: string | null;
  status: string;
  resolvedOn: string | null;
  deletedAt: string | null;
  refundable: number;
  saleAmount: number;
  saleCurrency: string | null;
  saleDate: string | null;
  warrantyDays: number | null;
  itemCost: number;
  itemCurrency: string | null;
  creditNote: { id: string; amount: number; remaining: number; currency: string; status: string } | null;
  events: Array<{ status: string; note: string | null; createdAt: string }>;
}

export interface ReturnInput {
  saleId: string;
  reason: string;
  openedOn: string;
  diagnosis?: string | null;
  imei?: string | null;
}

export interface UpdateReturnInput {
  reason?: string;
  openedOn?: string;
  diagnosis?: string | null;
  status?: 'ABIERTO' | 'EN_DIAGNOSTICO';
  note?: string | null;
}

export interface ResolveReturnInput {
  diagnosis?: string | null;
  note?: string | null;
  resolution: ReturnResolution;
  settlement: ReturnSettlement;
  amount: number;
  destination: ReturnDestination;
  stockStatus?: string | null;
}

export function fetchReturns(user: AuthUserLike, archived = false) {
  const query = archived ? '?archived=1' : '';
  return apiRequest<{ returns: ReturnCaseView[] }>(user, `/api/returns${query}`, {
    fallback: 'No se pudieron cargar las devoluciones',
  }).then((data) => data.returns);
}

export function fetchCreditNotes(user: AuthUserLike, clientId?: string) {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  return apiRequest<{ creditNotes: CreditNoteView[] }>(user, `/api/returns/credit-notes${query}`, {
    fallback: 'No se pudieron cargar las notas de crédito',
  }).then((data) => data.creditNotes);
}

export function createReturn(user: AuthUserLike, input: ReturnInput) {
  return apiRequest<{ return: ReturnCaseView }>(user, '/api/returns', {
    method: 'POST',
    body: input,
    fallback: 'No se pudo abrir el reclamo',
    errorFrom: 'friendly',
  }).then((data) => data.return);
}

export function updateReturn(user: AuthUserLike, id: string, input: UpdateReturnInput) {
  return apiRequest<{ return: ReturnCaseView }>(user, `/api/returns/${id}`, {
    method: 'PATCH', body: input,
    fallback: 'No se pudo guardar el reclamo', errorFrom: 'friendly',
  }).then(data => data.return);
}

export function updateReturnDiagnosis(user: AuthUserLike, id: string, diagnosis: string) {
  return apiRequest<{ return: ReturnCaseView }>(user, `/api/returns/${id}`, {
    method: 'PATCH',
    body: { diagnosis },
    fallback: 'No se pudo guardar el diagnóstico',
    errorFrom: 'friendly',
  }).then((data) => data.return);
}

export function resolveReturn(user: AuthUserLike, id: string, input: ResolveReturnInput) {
  return apiRequest<{ return: ReturnCaseView }>(user, `/api/returns/${id}/resolve`, {
    method: 'POST',
    body: input,
    fallback: 'No se pudo resolver el reclamo',
    errorFrom: 'friendly',
  }).then((data) => data.return);
}

export function advanceRma(user: AuthUserLike, id: string, status: RmaStatus, stockStatus?: string | null, note?: string | null) {
  return apiRequest<{ return: ReturnCaseView }>(user, `/api/returns/${id}/rma`, {
    method: 'POST',
    body: { status, stockStatus, note },
    fallback: 'No se pudo actualizar el RMA',
    errorFrom: 'friendly',
  }).then((data) => data.return);
}

export function archiveReturn(user: AuthUserLike, id: string, reason?: string) {
  return apiRequest<void>(user, `/api/returns/${id}`, {
    method: 'DELETE',
    body: { reason },
    fallback: 'No se pudo anular el reclamo',
    errorFrom: 'friendly',
  });
}

export function restoreReturn(user: AuthUserLike, id: string) {
  return apiRequest<{ return: ReturnCaseView }>(user, `/api/returns/${id}/restore`, {
    method: 'POST',
    fallback: 'No se pudo restaurar el reclamo',
    errorFrom: 'friendly',
  }).then((data) => data.return);
}
