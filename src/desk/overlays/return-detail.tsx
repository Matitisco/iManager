import type { ReactNode } from 'react';
import type { ReturnCaseView } from '../../services/returns-api';
import { formatShortDate, isVoidRow } from '../format';
import { Pill } from '../ui';
import './return-detail.css';

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return <div className="kv" data-testid={testId}><span>{label}</span><b data-ph-mask={label === 'IMEI' || undefined}>{children}</b></div>;
}

function Text({ label, children }: { label: string; children: string }) {
  return <section className="rcl-text"><h4>{label}</h4><p>{children}</p></section>;
}

export function ReturnDetailContent({ current, historyButton }: { current: ReturnCaseView; historyButton: ReactNode }) {
  const state = isVoidRow(current) ? 'ANULADO' : current.rmaStatus || current.status;
  const resolution = RESOLUTION_LABELS[current.resolution ?? ''];

  return <>
    <div className="tracking-summary rcl-identity">
      <div><h4>{current.deviceLabel || 'Sin equipo'}</h4><p data-ph-mask>{current.clientName || 'Sin cliente'}</p></div>
      {historyButton}
    </div>
    <div className="rcl-rows" data-testid="return-detail">
      <Row label="Estado"><Pill status={state} /></Row>
      <Row label="Fecha">{formatShortDate(current.openedOn)}</Row>
      {current.imei ? <Row label="IMEI">{current.imei}</Row> : null}
      {current.supplierName ? <Row label="Proveedor" testId="return-supplier">{current.supplierName}</Row> : null}
    </div>
    <Text label="Motivo">{current.reason}</Text>
    {current.diagnosis ? <Text label="Diagnóstico">{current.diagnosis}</Text> : null}
    {resolution || current.resolvedOn ? <div className="rcl-rows rcl-resolution">
      {resolution ? <Row label="Resolución">{resolution}</Row> : null}
      {current.resolvedOn ? <Row label="Resuelto el">{formatShortDate(current.resolvedOn)}</Row> : null}
    </div> : null}
  </>;
}

const RESOLUTION_LABELS: Record<string, string> = {
  REPARACION: 'Reparación', CAMBIO: 'Cambio', REINTEGRO: 'Reintegro',
};
