import { ListSkeleton } from '../list-skeleton';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { parseDeviceCode } from '../../lib/device-scan';
import { IMEI_FORMAT_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError } from '../../lib/imei';
import { createWedgeBuffer } from '../../lib/keyboard-wedge';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { voidedTrade } from '../archive-cache';
import { RecordHistory } from '../screens/HistoryScreen';
import type { TradeIn } from '../../types';
import type { OperationSource } from '../../services/operations-api';
import { formatShortDate, parseMoney, statusLabel, tradeCancellationLabel, tradeClientLabel, tradeCode } from '../format';
import { cancellationPlan, type RefundTarget } from '../cancel-refund';
import { fetchClientPayments, type ClientPaymentRecord } from '../../services/clients-api';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { CatalogEditor, catalogChoices, useCatalogs } from '../catalog';
import type { CatalogKind } from '../../services/catalogs-api';
import { ClientField } from '../ClientField';
import { QualityField } from '../QualityField';
import { canonicalQuality, displayQuality, qualityDetail, tradeQuality } from '../quality';
import { confirmScan } from '../scan/beep';
import { CameraScanner } from '../scan/CameraScanner';
import { ScanCameraButton } from '../scan/ImeiScanField';
import { Actions, Field, Pill, Segs, Sheet, SheetActionMenu, SheetActions, useDesk } from '../ui';
import { clearBad, CJ_STATUS, stampedCurrency, ConfirmOperationDialog, AuditLine, type FormProps } from './shared';
import { operationMoneyInput, OperationForm } from './operation';

export function TradeForm({ id, source = 'tradeins', run, busy, error }: FormProps & { id?: string; source?: OperationSource }) {
  const { tradeIns } = useAppContext();
  const legacy = id ? tradeIns.find((trade) => trade.id === id && trade.confirmationStatus == null) : undefined;
  if (legacy) return <LegacyTradeForm trade={legacy} run={run} busy={busy} error={error} />;
  return <OperationForm tradeId={id} source={source} startWithTrade run={run} busy={busy} error={error} />;
}

function LegacyTradeForm({ trade, run, busy, error }: FormProps & { trade: TradeIn }) {
  const { tradeIns, clients, updateTradeIn } = useAppContext();
  const money = useMoney();
  const { close } = useDesk();
  const [clientId, setClientId] = useState(trade.clientId || '');
  const [buyer, setBuyer] = useState(trade.clientName || clients.find((client) => client.id === trade.clientId)?.name || '');
  const [received, setReceived] = useState(trade.deviceReceived || '');
  const [imei, setImei] = useState(trade.deviceReceivedImei || '');
  const [given, setGiven] = useState(trade.deviceGiven || '');
  const [take, setTake] = useState(money.inputValue(trade.takeValue, trade.currency) || '0');
  const [difference, setDifference] = useState(money.inputValue(trade.differencePaid, trade.currency) || '0');
  const [status, setStatus] = useState(trade.status || 'PENDIENTE');
  const [grade, setGrade] = useState<string>(canonicalQuality(trade.grade));
  const [bad, setBad] = useState<Record<string, string>>({});
  const [camera, setCamera] = useState(false);
  const wedge = useRef(createWedgeBuffer());
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  return (
    <>
    <Sheet title="Editar canje" subtitle={`${tradeCode(tradeIns, trade.id)} · ${formatShortDate(trade.date)}`} onClose={close} busy={busy} className="operation-form cj-sheet" footer={<Actions busy={busy} primary="Guardar cambios" onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (!received.trim()) next.received = 'Completá este dato';
        if (imeiFormatError(imei)) next.imei = IMEI_FORMAT_MESSAGE;
        if (!given.trim()) next.given = 'Completá este dato';
        setBad(next);
        if (Object.keys(next).length) return;
        const priced = money.commitGroup([
          { typed: parseMoney(take), original: trade.takeValue, currency: trade.currency },
          { typed: parseMoney(difference), original: trade.differencePaid, currency: trade.currency },
        ]);
        if (priced.blocked) {
          setBad({ take: FX_WARNING });
          return;
        }
        void run(async () => await updateTradeIn({
          ...trade,
          clientId,
          clientName: buyer.trim(),
          deviceReceived: received.trim(),
          deviceReceivedImei: imei.trim(),
          deviceGiven: given.trim(),
          takeValue: priced.amounts[0]?.amount ?? trade.takeValue,
          differencePaid: priced.amounts[1]?.amount ?? trade.differencePaid,
          currency: stampedCurrency(priced.amounts[0]?.currency),
          status,
          grade,
        }), 'Canje actualizado');
      }} />}>
      {error && <div className="ferr">{error}</div>}
      <ClientField clients={clients} value={buyer} linked={Boolean(clientId)} error={bad.client}
        onValue={(value) => { setBuyer(value); setClientId(''); clearBad(setBad, 'client'); }}
        onPick={(client) => { setBuyer(client.name); setClientId(client.id); clearBad(setBad, 'client'); }} />
      <div className="frow">
        <Field label="Equipo que recibís" error={bad.received}><input value={received} onChange={(event) => { setReceived(event.target.value); clearBad(setBad, 'received'); }} /></Field>
        <div className="scan-imei">
          <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}><input value={imei} inputMode="numeric" maxLength={15} autoComplete="off" onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'imei'); }} placeholder="15 dígitos" onKeyDown={(event) => {
            const pushed = wedge.current.push(event.key);
            if (pushed.type !== 'scan') return;
            event.preventDefault();
            const parsed = parseDeviceCode(pushed.value);
            if (!parsed.imei) return;
            confirmScan();
            setImei(parsed.imei);
            if (parsed.model && !received.trim()) setReceived([parsed.model, parsed.capacity].filter(Boolean).join(' '));
          }} /></Field>
          <ScanCameraButton onClick={() => setCamera(true)} />
        </div>
      </div>
      <Field label="Equipo entregado" error={bad.given}><input value={given} onChange={(event) => { setGiven(event.target.value); clearBad(setBad, 'given'); }} /></Field>
      <div className="frow">
        <Field label="Valor tomado" mark={money.active}><input value={take} inputMode="numeric" onChange={(event) => setTake(operationMoneyInput(event.target.value))} /></Field>
        <Field label="Diferencia" mark={money.active}><input value={difference} inputMode="numeric" onChange={(event) => setDifference(operationMoneyInput(event.target.value))} /></Field>
      </div>
      <Field label="Estado técnico"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'TRADE_IN_STATUS', CJ_STATUS)} value={status} onChange={setStatus} onEdit={catalogs?.canEdit ? () => setEditor('TRADE_IN_STATUS') : undefined} />
      <QualityField label="Calidad del recibido" value={grade} onChange={setGrade} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
    </Sheet>
    {camera ? <CameraScanner onClose={() => setCamera(false)} onManual={() => setCamera(false)} onUse={(parsed) => { setCamera(false); if (!parsed.imei) return; confirmScan(); setImei(parsed.imei); if (parsed.model && !received.trim()) setReceived([parsed.model, parsed.capacity].filter(Boolean).join(' ')); }} /> : null}
    </>
  );
}

export function TradeDetail({ id, source = 'tradeins', kind, run, busy, error }: FormProps & { id: string; source?: OperationSource; kind?: string }) {
  const { tradeIns, sales, clients, user, updateTradeIn, updateTradeOperation, cancelTradeOperation, fetchTradeOperation } = useAppContext();
  const money = useMoney();
  const { close, open, canManageSensitive = true } = useDesk();
  const catalogs = useCatalogs();
  const archivedReceivedLink = kind === 'ARCHIVED_TRADE_IN_RECEIVED';
  const [loadedOperation, setLoadedOperation] = useState<Awaited<ReturnType<typeof fetchTradeOperation>> | null>(null);
  const trade = tradeIns.find((item) => item.id === id) ?? voidedTrade(id) ?? loadedOperation?.tradeIn;
  const [detailError, setDetailError] = useState<string | null>(null);
  const [technicalStatus, setTechnicalStatus] = useState(trade?.status || 'PENDIENTE');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [movements, setMovements] = useState<ClientPaymentRecord[]>([]);
  useEffect(() => {
    const clientId = trade?.clientId;
    if (!user || !clientId) return;
    let active = true;
    fetchClientPayments(user, clientId).then((rows) => { if (active) setMovements(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [user, trade?.clientId]);
  useEffect(() => {
    if (archivedReceivedLink || !trade || trade.confirmationStatus != null) {
      void fetchTradeOperation(source, id)
        .then(setLoadedOperation)
        .catch((err: unknown) => setDetailError(getFriendlyErrorMessage(err, 'No se pudo cargar el canje.')));
    }
  }, [id, source, archivedReceivedLink, trade?.confirmationStatus]);
  useEffect(() => {
    setTechnicalStatus(trade?.status || 'PENDIENTE');
  }, [trade?.id, trade?.status]);
  if (!trade && !detailError) return <Sheet title="Canje" onClose={close} className="cj-sheet"><ListSkeleton variant="lines" rows={6} /></Sheet>;
  if (!trade) return <Sheet title="Registro no disponible" onClose={close} className="cj-sheet"><div className="ferr">{detailError}</div></Sheet>;
  const linkedSale = trade.saleId ? sales.find((sale) => sale.id === trade.saleId) : undefined;
  if (archivedReceivedLink) {
    const archivedReceived = loadedOperation?.inventory.find((item) => item.archivedAt);
    return (
      <Sheet title="Equipo recibido archivado" subtitle="Registro histórico · fuera del stock activo" onClose={close} busy={busy} className="cj-sheet" footer={<SheetActions><button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button></SheetActions>}>
        {detailError && <div className="ferr">{detailError}</div>}
        {archivedReceived ? <>
          <div className="kv"><span>Modelo</span><b>{archivedReceived.model || trade.deviceReceived || '—'}</b></div>
          <div className="kv"><span>Calidad</span><b>{displayQuality(archivedReceived.condition, archivedReceived.grade) || tradeQuality(trade.grade) || '—'}</b></div>
          <div className="kv"><span>Capacidad</span><b>{archivedReceived.capacity || '—'}</b></div>
          <div className="kv"><span>Estado técnico</span><b><Pill status={archivedReceived.status} kind="TRADE_IN_STATUS" /></b></div>
          <div className="kv"><span>Valor tomado</span><b>{money.show(trade.takeValue, trade.currency)}</b></div>
          <div className="kv"><span>Fecha</span><b>{formatShortDate(trade.date)}</b></div>
        </> : loadedOperation ? <div className="wempty">El equipo ya no está en stock activo.</div> : <ListSkeleton variant="lines" rows={3} />}
      </Sheet>
    );
  }
  if (trade.confirmationStatus != null) {
    const knownStatuses = catalogChoices(catalogs?.options ?? [], 'TRADE_IN_STATUS', CJ_STATUS);
    const technicalOptions = !technicalStatus || knownStatuses.some((option) => option.id === technicalStatus)
      ? knownStatuses
      : [...knownStatuses, { id: technicalStatus, label: statusLabel(technicalStatus) || technicalStatus }];
    const saveTechnicalStatus = () => {
      if (technicalStatus === trade.status) return;
      void run(
        async () => await updateTradeOperation(source, id, {
          tradeIn: {
            deviceReceived: trade.deviceReceived,
            takeValue: trade.takeValue,
            status: technicalStatus,
            ...(trade.deviceReceivedImei ? { deviceReceivedImei: trade.deviceReceivedImei } : {}),
            ...(trade.batteryHealth != null ? { batteryHealth: trade.batteryHealth } : {}),
            ...(trade.grade != null ? { grade: trade.grade } : {}),
            ...(trade.customFields ? { customFields: trade.customFields } : {}),
          },
        }),
        'Estado técnico actualizado',
        { keepOpen: true },
      );
    };
    const linkedSaleForRefund = trade.saleId
      ? sales.find((item) => item.id === trade.saleId) ?? loadedOperation?.sale
      : loadedOperation?.sale;
    const refundSales = sales.filter((item) => item.clientId && item.clientId === trade.clientId && item.status !== 'CANCELADA').map((item): RefundTarget => {
      const linked = item.tradeInId ? tradeIns.find((row) => row.id === item.tradeInId) : undefined;
      return { id: item.id, cash: Math.max(0, (linked ? linked.differencePaid : item.amount) - (item.depositAppliedAmount ?? 0)), status: item.status, openBalance: item.openBalance, soldAt: item.date };
    });
    const buyer = clients.find((item) => item.id === trade.clientId);
    const plan = trade.confirmationStatus === 'CONFIRMED' && linkedSaleForRefund
      ? cancellationPlan({
        id: linkedSaleForRefund.id,
        cash: trade.differencePaid - (linkedSaleForRefund.depositAppliedAmount ?? 0),
        status: linkedSaleForRefund.status,
        openBalance: linkedSaleForRefund.openBalance,
        soldAt: linkedSaleForRefund.date,
      }, refundSales, movements, buyer?.pendingBalance ?? 0)
      : { refund: 0, credit: 0 };
    const statusChanged = technicalStatus !== trade.status;
    const detailFooter = trade.confirmationStatus === 'CANCELLED'
      ? <SheetActions><button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>{canManageSensitive && !trade.voidedAt ? <SheetActionMenu><button className="btn2 danger" type="button" disabled={busy} onClick={() => open({ type: 'del', kind: 'cj', id, label: 'Canje' })}>Anular</button></SheetActionMenu> : null}</SheetActions>
      : trade.confirmationStatus === 'PENDING'
        ? <SheetActions>
            <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
            <SheetActionMenu>
              <button className="btn2 s" type="button" disabled={busy || !statusChanged} onClick={saveTechnicalStatus}>{busy ? 'Guardando…' : 'Guardar estado'}</button>
              {canManageSensitive && !trade.voidedAt ? <button className="btn2 danger" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}>Anular</button> : null}
            </SheetActionMenu>
            <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={() => open({ type: 'edit-cj', id, source })}>Retomar</button>
          </SheetActions>
        : statusChanged
          ? <SheetActions>
              <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
              <SheetActionMenu>
                <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'edit-cj', id, source })}>Editar</button>
                {canManageSensitive && !trade.voidedAt ? <button className="btn2 danger" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}>Anular</button> : null}
              </SheetActionMenu>
              <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={saveTechnicalStatus}>{busy ? 'Guardando…' : 'Guardar estado'}</button>
            </SheetActions>
          : <SheetActions>
              <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
              {canManageSensitive ? <SheetActionMenu><button className="btn2 danger" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}>Anular</button></SheetActionMenu> : null}
              <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={() => open({ type: 'edit-cj', id, source })}>Editar</button>
            </SheetActions>;
    if (confirmCancel) {
      return (
        <ConfirmOperationDialog
          title="Anular canje"
          label={tradeCode(tradeIns, trade.id)}
          refund={plan.refund}
          coveredCredit={plan.credit}
          depositCredit={linkedSaleForRefund?.depositAppliedAmount}
          currency={trade.currency}
          busy={busy}
          error={error}
          onClose={() => { if (!busy) setConfirmCancel(false); }}
          onOk={reason => { void run(async () => await cancelTradeOperation(source, id, reason), 'Operación anulada'); }}
        />
      );
    }
    return (
      <Sheet title={`${tradeCode(tradeIns, trade.id)} · ${tradeClientLabel(trade, clients)}`} subtitle={`${formatShortDate(trade.date)} · ${trade.confirmationStatus === 'PENDING' ? 'Pendiente de confirmación' : trade.confirmationStatus === 'CANCELLED' ? tradeCancellationLabel(trade) : 'Canje confirmado'}`} onClose={close} busy={busy} className="cj-sheet" footer={detailFooter}>
        {error && <div className="ferr">{error}</div>}{detailError && <div className="ferr">{detailError}</div>}
        {trade.voidedAt ? <div className="pending-sale" data-testid="voided-banner"><div><b>Anulado</b><small>{trade.voidedBy ? `por ${trade.voidedBy}` : 'Este canje está anulado'}{trade.voidReason ? ` · ${trade.voidReason}` : ''}. No se puede restaurar.</small></div></div> : null}
        <RecordHistory entityType="trade" entityId={trade.id} />
        <div className="kv"><span>Estado técnico</span><b><Pill status={trade.voidedAt || trade.confirmationStatus === 'CANCELLED' ? 'ANULADA' : trade.status} kind="TRADE_IN_STATUS" /></b></div>
        {trade.confirmationStatus === 'CANCELLED' ? <AuditLine action="Anulada" by={trade.voidedBy ?? trade.cancelledBy} at={trade.voidedAt ?? trade.cancelledAt} /> : null}
        {trade.confirmationStatus !== 'CANCELLED' ? (
          <>
            <Segs options={technicalOptions} value={technicalStatus} onChange={setTechnicalStatus} />
          </>
        ) : null}
        <div className="kv"><span>Equipo recibido</span><b>{trade.deviceReceived || '—'}</b></div>
        <div className="kv"><span>Calidad</span><b>{tradeQuality(trade.grade) ? qualityDetail(tradeQuality(trade.grade)) : '—'}</b></div>
        {trade.deviceReceivedImei ? <div className="kv"><span>IMEI recibido</span><b>{trade.deviceReceivedImei}</b></div> : null}
        <div className="kv"><span>Valor tomado</span><b>{money.show(trade.takeValue, trade.currency)}</b></div>
        <div className="kv"><span>Equipo entregado</span><b>{trade.deviceGiven || trade.draftDeviceLabel || '—'}</b></div>
        {trade.confirmationStatus === 'CONFIRMED' ? <>
            <div className="kv"><span>Precio de salida</span><b>{linkedSale ? money.show(linkedSale.amount, linkedSale.amountCurrency) : '—'}</b></div>
          <div className="kv"><span>Diferencia</span><b>{money.show(trade.differencePaid, trade.currency)}</b></div>
            <div className="kv"><span>Deuda</span><b>{linkedSale?.status === 'PENDIENTE' ? money.show(trade.differencePaid - (linkedSale?.depositAppliedAmount ?? 0), trade.currency) : money.showActive(0)}</b></div>
        </> : null}
      </Sheet>
    );
  }
  const flow = ['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN', 'APROBADO', 'LISTO'];
  const nextLabel: Record<string, string> = { PENDIENTE: 'Enviar a peritaje', 'PERITAJE TÉC.': 'Pasar a revisión', 'EN REVISIÓN': 'Aprobar canje', APROBADO: 'Completar canje' };
  const index = flow.indexOf(trade.status);
  const next = index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
  const code = tradeCode(tradeIns, trade.id);
  return (
    <Sheet title={`${code} · ${tradeClientLabel(trade, clients)}`} subtitle={`${formatShortDate(trade.date)} · ${statusLabel(trade.status)}`} onClose={close} busy={busy} className="cj-sheet" footer={next && !trade.voidedAt ? <SheetActions>
      <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={trade.status === 'APROBADO' ? close : () => run(async () => { await updateTradeIn({ ...trade, status: 'RECHAZADO' }); }, `${code} rechazado`)}>{trade.status === 'APROBADO' ? 'Después' : 'Rechazar'}</button>
      <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={() => run(async () => { await updateTradeIn({ ...trade, status: next }); }, `${code} · ${statusLabel(next)}`, { keepOpen: true })}>{nextLabel[trade.status] || 'Avanzar'}</button>
    </SheetActions> : <SheetActions><button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button></SheetActions>}>
      {error && <div className="ferr">{error}</div>}
      <div className="steps">{flow.map((step, stepIndex) => <i key={step} className={index >= stepIndex ? 'on' : ''} />)}</div>
      <div className="dhero"><div className="eb">Diferencia a cobrar</div><div className="big">{money.show(trade.differencePaid, trade.currency)}</div></div>
      <div className="kv"><span>Recibido</span><b>{trade.deviceReceived}</b></div>
      <div className="kv"><span>Calidad</span><b>{tradeQuality(trade.grade) ? qualityDetail(tradeQuality(trade.grade)) : '—'}</b></div>
      <div className="kv"><span>Valor tomado</span><b>{money.show(trade.takeValue, trade.currency)}</b></div>
      <div className="kv"><span>Entrega</span><b>{trade.deviceGiven}</b></div>
      <div className="kv"><span>Estado</span><b><Pill status={trade.voidedAt || trade.confirmationStatus === 'CANCELLED' ? 'ANULADA' : trade.status} kind="TRADE_IN_STATUS" /></b></div>
    </Sheet>
  );
}
